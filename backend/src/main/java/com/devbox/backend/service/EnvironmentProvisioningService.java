package com.devbox.backend.service;

import com.devbox.backend.dto.request.CreateEnvironmentRequest;
import com.devbox.backend.dto.response.EnvironmentResponse;
import com.devbox.backend.dto.response.PodInfo;
import com.devbox.backend.entity.*;
import com.devbox.backend.exception.*;
import com.devbox.backend.repository.EnvironmentRepository;
import com.devbox.backend.util.K8sNameUtil;
import io.kubernetes.client.custom.IntOrString;
import io.kubernetes.client.custom.Quantity;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.annotation.PreDestroy;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Manages the lifecycle of template-based development environments:
 * create → provision on K8s → start → stop → delete.
 *
 * No Docker build step — environments use the template's prebuilt image directly.
 *
 * Access URL model:
 *   accessUrl   = http://127.0.0.1:<localPort>        — workspace landing page (/)
 *   desktopUrl  = accessUrl + /desktop/vnc.html?...   — noVNC XFCE desktop
 *   terminalUrl = accessUrl + /terminal/              — ttyd browser terminal
 *
 * nginx inside the workspace container routes:
 *   /           → landing page (template-specific HTML)
 *   /terminal/  → ttyd:7681
 *   /desktop/   → noVNC static files
 *   /websockify → websockify:6080 (WebSocket bridge for noVNC)
 *   /healthz    → 200 OK
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class EnvironmentProvisioningService {

    // Gateway port: nginx inside the workspace container always listens on 8080.
    // This is the DevBox infrastructure port — completely distinct from any
    // development application port (e.g. React on 5173, Node on 3000, etc.).
    private static final int WORKSPACE_GATEWAY_PORT = 8080;

    private final EnvironmentRepository environmentRepository;
    private final WorkspaceService workspaceService;
    private final TemplateService templateService;
    private final SystemHealthService systemHealthService;
    private final KubernetesClientService kubernetesClientService;

    @Value("${devbox.kubernetes.namespace:devbox}")
    private String defaultNamespace;

    @Value("${devbox.kubernetes.minikube:true}")
    private boolean minikubeEnabled;

    private final Map<UUID, Process> activeTunnels    = new ConcurrentHashMap<>();
    private final Map<UUID, Integer> activeTunnelPorts = new ConcurrentHashMap<>();

    @PreDestroy
    public void cleanupAllTunnels() {
        log.info("Cleaning up all {} active workspace port-forward tunnel(s)", activeTunnels.size());
        activeTunnels.forEach((id, process) -> {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        });
        activeTunnels.clear();
        activeTunnelPorts.clear();
    }

    private void cleanupTunnel(UUID envId) {
        Process p = activeTunnels.remove(envId);
        activeTunnelPorts.remove(envId);
        if (p != null && p.isAlive()) {
            p.destroyForcibly();
            log.info("Terminated port-forward tunnel for environment {}", envId);
        }
    }

    // ── LIST / GET ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<EnvironmentResponse> listByWorkspace(UUID workspaceId) {
        workspaceService.findOrThrow(workspaceId);
        return environmentRepository.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId)
                .stream()
                .map(EnvironmentResponse::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public EnvironmentResponse getById(UUID id) {
        return EnvironmentResponse.from(findOrThrow(id));
    }

    // ── CREATE + PROVISION ────────────────────────────────────────────────────

    /**
     * Creates the DB record and immediately provisions Kubernetes resources.
     * The K8s call is best-effort: if the cluster is unreachable the record is
     * saved with PROVISIONING status and the user can retry via /start.
     */
    public EnvironmentResponse create(UUID workspaceId, CreateEnvironmentRequest req) {
        Workspace workspace = workspaceService.findOrThrow(workspaceId);
        Template  template  = templateService.findOrThrow(req.getTemplateId());

        if (environmentRepository.existsByWorkspaceIdAndName(workspaceId, req.getName())) {
            throw new ConflictException(
                    "Environment '" + req.getName() + "' already exists in this workspace");
        }

        String k8sName    = K8sNameUtil.sanitize(req.getName());
        String deployName = k8sName;
        String svcName    = k8sName + "-svc";
        String pvcName    = k8sName + "-pvc";

        Environment env = Environment.builder()
                .workspace(workspace)
                .template(template)
                .name(req.getName())
                .description(req.getDescription())
                .status(EnvironmentStatus.PROVISIONING)
                .cpuRequest(coalesce(req.getCpuRequest(),    template.getDefaultCpu()))
                .memoryRequest(coalesce(req.getMemoryRequest(), template.getDefaultMemory()))
                .storageSize(coalesce(req.getStorageSize(),   template.getDefaultStorage()))
                .k8sNamespace(defaultNamespace)
                .k8sDeploymentName(deployName)
                .k8sServiceName(svcName)
                .k8sPvcName(pvcName)
                .build();

        Environment saved = environmentRepository.save(env);
        log.info("Created environment '{}' ({}) from template '{}' in namespace '{}'",
                saved.getName(), saved.getId(), template.getDisplayName(), defaultNamespace);

        if (systemHealthService.isKubernetesAvailable()) {
            try {
                provisionK8s(saved, template);
            } catch (Exception e) {
                String reason = describeException(e);
                log.warn("K8s provisioning deferred for '{}' — {}", saved.getName(), reason);
                saved.setFailureReason("Provisioning deferred: " + reason);
                environmentRepository.save(saved);
            }
        } else {
            log.info("Kubernetes not available; environment '{}' saved as PROVISIONING (retry via Start)",
                    saved.getName());
        }

        return EnvironmentResponse.from(environmentRepository.findById(saved.getId()).orElse(saved));
    }

    // ── START ─────────────────────────────────────────────────────────────────

    public EnvironmentResponse start(UUID id) {
        Environment env = findOrThrow(id);

        if (!systemHealthService.isKubernetesAvailable()) {
            throw new KubernetesException("Kubernetes is not reachable. Start Minikube and try again.");
        }

        if (env.getStatus() == EnvironmentStatus.PROVISIONING
                || env.getStatus() == EnvironmentStatus.FAILED) {
            log.info("Re-provisioning environment '{}' (status={})", env.getName(), env.getStatus());
            try {
                provisionK8s(env, env.getTemplate());
            } catch (ApiException e) {
                throw new KubernetesException("Provisioning failed: " + describeException(e), e);
            }
        } else if (env.getStatus() == EnvironmentStatus.STOPPED) {
            log.info("Scaling up stopped environment '{}'", env.getName());
            try {
                AppsV1Api appsApi = kubernetesClientService.appsApi();
                V1Deployment existing = appsApi
                        .readNamespacedDeployment(env.getK8sDeploymentName(), defaultNamespace)
                        .execute();
                existing.getSpec().setReplicas(1);
                appsApi.replaceNamespacedDeployment(env.getK8sDeploymentName(), defaultNamespace, existing)
                        .execute();
                log.info("Scaled up deployment '{}' to 1 replica", env.getK8sDeploymentName());
            } catch (ApiException e) {
                throw new KubernetesException("Start failed: " + e.getResponseBody(), e);
            }
        } else {
            throw new BadRequestException(
                    "Environment must be STOPPED or PROVISIONING/FAILED to start. Current status: "
                    + env.getStatus());
        }

        env.setStatus(EnvironmentStatus.PROVISIONING);
        env.setStartedAt(Instant.now());
        env.setStoppedAt(null);
        env.setFailureReason(null);
        // Clear stale URLs — they will be re-resolved once the pod is Ready
        env.setAccessUrl(null);
        env.setDesktopUrl(null);
        env.setTerminalUrl(null);
        environmentRepository.save(env);
        log.info("Started environment '{}' ({})", env.getName(), env.getId());
        return EnvironmentResponse.from(env);
    }

    // ── STOP ─────────────────────────────────────────────────────────────────

    public EnvironmentResponse stop(UUID id) {
        Environment env = findOrThrow(id);

        if (!systemHealthService.isKubernetesAvailable()) {
            throw new KubernetesException("Kubernetes is not reachable. Start Minikube and try again.");
        }
        if (env.getStatus() == EnvironmentStatus.STOPPED) {
            throw new BadRequestException("Environment is already stopped.");
        }

        try {
            AppsV1Api appsApi = kubernetesClientService.appsApi();
            V1Deployment existing = appsApi
                    .readNamespacedDeployment(env.getK8sDeploymentName(), defaultNamespace)
                    .execute();
            existing.getSpec().setReplicas(0);
            appsApi.replaceNamespacedDeployment(env.getK8sDeploymentName(), defaultNamespace, existing)
                    .execute();
            log.info("Scaled deployment '{}' to 0 replicas (stopped)", env.getK8sDeploymentName());
        } catch (ApiException e) {
            if (e.getCode() != 404) {
                throw new KubernetesException("Stop failed: " + e.getResponseBody(), e);
            }
            log.debug("Deployment '{}' not found during stop (already deleted?)", env.getK8sDeploymentName());
        }

        cleanupTunnel(env.getId());
        env.setStatus(EnvironmentStatus.STOPPED);
        env.setStoppedAt(Instant.now());
        env.setAccessUrl(null);
        env.setDesktopUrl(null);
        env.setTerminalUrl(null);
        environmentRepository.save(env);
        log.info("Stopped environment '{}' ({})", env.getName(), env.getId());
        return EnvironmentResponse.from(env);
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    public void delete(UUID id) {
        Environment env = findOrThrow(id);
        cleanupTunnel(id);
        env.setStatus(EnvironmentStatus.DELETING);
        environmentRepository.save(env);

        if (systemHealthService.isKubernetesAvailable()) {
            cleanupK8s(env);
        }

        environmentRepository.delete(env);
        log.info("Deleted environment '{}' ({})", env.getName(), id);
    }

    // ── STATUS (reconcile with K8s) ───────────────────────────────────────────

    @Transactional
    public EnvironmentResponse getStatus(UUID id) {
        Environment env = findOrThrow(id);

        if (!systemHealthService.isKubernetesAvailable()
                || env.getStatus() == EnvironmentStatus.PENDING
                || env.getStatus() == EnvironmentStatus.DELETED) {
            return EnvironmentResponse.from(env);
        }

        try {
            V1Deployment deployment = kubernetesClientService.appsApi()
                    .readNamespacedDeployment(env.getK8sDeploymentName(), defaultNamespace)
                    .execute();

            EnvironmentStatus derived = deriveStatus(deployment, env.getName());
            boolean changed = (derived != env.getStatus());

            if (changed) {
                log.info("Environment '{}' status: {} → {}", env.getName(), env.getStatus(), derived);
                env.setStatus(derived);
                if (derived == EnvironmentStatus.RUNNING && env.getStartedAt() == null) {
                    env.setStartedAt(Instant.now());
                }
            }

            // Resolve access URLs once running.
            // Re-resolve if:
            //  - URL was never set
            //  - URL is the old node-IP form (unreachable on Windows Docker driver)
            //  - The port-forward process died (e.g. backend was restarted)
            String existingUrl   = env.getAccessUrl();
            boolean tunnelAlive  = isTunnelAlive(id);
            boolean needsUrl     = derived == EnvironmentStatus.RUNNING
                    && (existingUrl == null
                        || existingUrl.contains("192.168.")
                        || existingUrl.contains("172.")
                        || env.getDesktopUrl() == null
                        || env.getTerminalUrl() == null
                        || !tunnelAlive);

            if (needsUrl) {
                log.info("Resolving access URLs for '{}' (tunnelAlive={}, existingUrl={})",
                        env.getName(), tunnelAlive, existingUrl != null ? existingUrl : "none");
                resolveAccessUrl(env);
                changed = true;
            }

            if (env.getNodePort() == null && derived != EnvironmentStatus.DELETED) {
                refreshNodePort(env);
                changed = true;
            }

            if (changed) {
                environmentRepository.save(env);
            }

        } catch (ApiException e) {
            if (e.getCode() == 404) {
                log.info("Deployment for environment '{}' not found in K8s — marking DELETED", env.getName());
                env.setStatus(EnvironmentStatus.DELETED);
                environmentRepository.save(env);
            } else {
                log.warn("Could not check K8s status for '{}': HTTP {} — {}",
                        env.getName(), e.getCode(), e.getMessage());
            }
        }

        return EnvironmentResponse.from(env);
    }

    // ── PODS ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PodInfo> getPods(UUID id) {
        Environment env = findOrThrow(id);
        if (!systemHealthService.isKubernetesAvailable()) return List.of();
        try {
            // Label selector matches pods created by the deployment
            V1PodList list = kubernetesClientService.coreApi()
                    .listNamespacedPod(defaultNamespace)
                    .labelSelector("devbox-env=" + env.getName())
                    .execute();
            return list.getItems().stream().map(this::toPodInfo).collect(Collectors.toList());
        } catch (ApiException e) {
            log.warn("Pod list error for '{}': {}", env.getName(), e.getResponseBody());
            return List.of();
        }
    }

    // ── LOGS ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public String getLogs(UUID id, int lines) {
        Environment env = findOrThrow(id);
        if (!systemHealthService.isKubernetesAvailable()) {
            return "Kubernetes is not available. Start Minikube and try again.";
        }
        try {
            V1PodList list = kubernetesClientService.coreApi()
                    .listNamespacedPod(defaultNamespace)
                    .labelSelector("devbox-env=" + env.getName())
                    .execute();
            if (list.getItems().isEmpty()) {
                return "No pods found for environment '" + env.getName() + "'. "
                     + "The deployment may still be starting or may have failed.";
            }
            // Prefer a Running pod; fall back to the most recent one
            V1Pod pod = list.getItems().stream()
                    .filter(p -> "Running".equals(
                            p.getStatus() != null ? p.getStatus().getPhase() : null))
                    .findFirst()
                    .orElse(list.getItems().get(0));
            String podName = pod.getMetadata().getName();
            log.debug("Fetching {} log lines from pod '{}'", lines, podName);
            return kubernetesClientService.coreApi()
                    .readNamespacedPodLog(podName, defaultNamespace)
                    .tailLines(lines)
                    .execute();
        } catch (ApiException e) {
            return "Could not retrieve logs: " + e.getResponseBody();
        }
    }

    // ── Private: K8s provisioning ─────────────────────────────────────────────

    private void provisionK8s(Environment env, Template template) throws ApiException {
        log.info("Provisioning K8s resources for environment '{}' (template='{}')",
                env.getName(), template.getDisplayName());
        ensureNamespaceExists();
        createOrUpdatePvc(env, template);
        createOrUpdateDeployment(env, template);
        createOrUpdateService(env, template);
        log.info("K8s resources provisioned for '{}' in namespace '{}'",
                env.getName(), defaultNamespace);
    }

    private void ensureNamespaceExists() {
        try {
            CoreV1Api coreApi = kubernetesClientService.coreApi();
            try {
                coreApi.readNamespace(defaultNamespace).execute();
                log.debug("Namespace '{}' already exists", defaultNamespace);
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    coreApi.createNamespace(new V1Namespace()
                            .metadata(new V1ObjectMeta().name(defaultNamespace))).execute();
                    log.info("Created namespace '{}'", defaultNamespace);
                }
            }
        } catch (ApiException e) {
            log.warn("Could not ensure namespace '{}' exists: {}", defaultNamespace, e.getResponseBody());
        }
    }

    private void createOrUpdatePvc(Environment env, Template template) throws ApiException {
        CoreV1Api coreApi = kubernetesClientService.coreApi();
        String pvcName = env.getK8sPvcName();
        try {
            coreApi.readNamespacedPersistentVolumeClaim(pvcName, defaultNamespace).execute();
            log.debug("PVC '{}' already exists — skipping creation", pvcName);
        } catch (ApiException e) {
            if (e.getCode() == 404) {
                V1PersistentVolumeClaim pvc = new V1PersistentVolumeClaim()
                        .metadata(new V1ObjectMeta()
                                .name(pvcName)
                                .namespace(defaultNamespace)
                                .putLabelsItem("devbox-env",   env.getName())
                                .putLabelsItem("managed-by",   "devbox"))
                        .spec(new V1PersistentVolumeClaimSpec()
                                .accessModes(List.of("ReadWriteOnce"))
                                .resources(new V1VolumeResourceRequirements()
                                        .putRequestsItem("storage",
                                                Quantity.fromString(env.getStorageSize()))));
                coreApi.createNamespacedPersistentVolumeClaim(defaultNamespace, pvc).execute();
                log.info("Created PVC '{}' ({})", pvcName, env.getStorageSize());
            } else {
                throw e;
            }
        }
    }

    private void createOrUpdateDeployment(Environment env, Template template) throws ApiException {
        AppsV1Api appsApi = kubernetesClientService.appsApi();
        V1Deployment spec = buildDeploymentSpec(env, template);
        try {
            appsApi.readNamespacedDeployment(env.getK8sDeploymentName(), defaultNamespace).execute();
            appsApi.replaceNamespacedDeployment(env.getK8sDeploymentName(), defaultNamespace, spec).execute();
            log.info("Updated Deployment '{}'", env.getK8sDeploymentName());
        } catch (ApiException e) {
            if (e.getCode() == 404) {
                appsApi.createNamespacedDeployment(defaultNamespace, spec).execute();
                log.info("Created Deployment '{}'", env.getK8sDeploymentName());
            } else {
                throw e;
            }
        }
    }

    private void createOrUpdateService(Environment env, Template template) throws ApiException {
        CoreV1Api coreApi = kubernetesClientService.coreApi();
        V1Service spec = buildServiceSpec(env);
        try {
            V1Service existing = coreApi.readNamespacedService(env.getK8sServiceName(), defaultNamespace).execute();
            spec.getSpec().setClusterIP(existing.getSpec().getClusterIP());
            spec.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
            coreApi.replaceNamespacedService(env.getK8sServiceName(), defaultNamespace, spec).execute();
            log.info("Updated Service '{}'", env.getK8sServiceName());
        } catch (ApiException e) {
            if (e.getCode() == 404) {
                V1Service created = coreApi.createNamespacedService(defaultNamespace, spec).execute();
                if (created.getSpec() != null && created.getSpec().getPorts() != null
                        && !created.getSpec().getPorts().isEmpty()) {
                    Integer np = created.getSpec().getPorts().get(0).getNodePort();
                    if (np != null) {
                        env.setNodePort(np);
                        log.info("Service '{}' assigned NodePort {}", env.getK8sServiceName(), np);
                    }
                }
                log.info("Created Service '{}'", env.getK8sServiceName());
            } else {
                throw e;
            }
        }
    }

    private V1Deployment buildDeploymentSpec(Environment env, Template template) {
        // ── Environment variables for the pod ────────────────────────────────
        List<V1EnvVar> envVars = new ArrayList<>();

        // Inject DevBox identity vars so the welcome banner shows correct info
        envVars.add(new V1EnvVar().name("DEVBOX_ENV_NAME").value(env.getName()));
        envVars.add(new V1EnvVar().name("DEVBOX_TEMPLATE_NAME").value(template.getDisplayName()));
        envVars.add(new V1EnvVar().name("DEVBOX_TEMPLATE_ID").value(template.getId()));

        // Template-level extra env vars (KEY=VALUE\nKEY=VALUE format)
        if (template.getEnvVars() != null && !template.getEnvVars().isBlank()) {
            for (String line : template.getEnvVars().split("\\n")) {
                int eq = line.indexOf('=');
                if (eq > 0) {
                    envVars.add(new V1EnvVar()
                            .name(line.substring(0, eq).trim())
                            .value(line.substring(eq + 1).trim()));
                }
            }
        }

        // The workspace gateway port is always 8080 — this is the nginx port inside
        // the container, NOT a user development application port.
        // template.getContainerPort() should always be 8080 for DevBox workspace images.
        int gatewayPort = template.getContainerPort(); // should be 8080

        // Determine the startup command.
        // Simple executable path (no shell metacharacters) → run as PID 1 (exec form).
        // Shell syntax → wrap in sh -c so variable expansion works.
        String startupCmd = (template.getStartupCommand() != null
                && !template.getStartupCommand().isBlank())
                ? template.getStartupCommand()
                : defaultStartupCommand(gatewayPort);

        List<String> command;
        if (startupCmd.matches("[/\\w.-]+")) {
            command = List.of(startupCmd);
            log.debug("Deployment '{}' using exec-form command: {}", env.getK8sDeploymentName(), startupCmd);
        } else {
            command = List.of("/bin/sh", "-c", startupCmd);
            log.debug("Deployment '{}' using sh -c command: {}", env.getK8sDeploymentName(), startupCmd);
        }

        // Readiness probe: wait for nginx /healthz → HTTP 200 before marking pod Ready.
        // This prevents the port-forward from being opened before VNC + XFCE + nginx are up.
        // initialDelaySeconds=15 gives VNC/XFCE enough time to initialise.
        // failureThreshold=12 means we wait up to 15 + 12×5 = 75 seconds total.
        V1Probe readinessProbe = new V1Probe()
                .httpGet(new V1HTTPGetAction()
                        .path("/healthz")
                        .port(new IntOrString(gatewayPort)))
                .initialDelaySeconds(15)
                .periodSeconds(5)
                .failureThreshold(12)
                .successThreshold(1)
                .timeoutSeconds(3);

        // Liveness probe: restart the pod if nginx stops responding for ~45 seconds.
        V1Probe livenessProbe = new V1Probe()
                .httpGet(new V1HTTPGetAction()
                        .path("/healthz")
                        .port(new IntOrString(gatewayPort)))
                .initialDelaySeconds(30)
                .periodSeconds(15)
                .failureThreshold(3)
                .timeoutSeconds(5);

        // imagePullPolicy=Never: images are loaded into Minikube via
        // `minikube image load` so no registry pull is needed or expected.
        V1Container container = new V1Container()
                .name(env.getName())
                .image(template.getImage())
                .imagePullPolicy("Never")
                .addPortsItem(new V1ContainerPort()
                        .containerPort(gatewayPort)
                        .name("workspace-gw")
                        .protocol("TCP"))
                .env(envVars)
                .resources(new V1ResourceRequirements()
                        .putRequestsItem("cpu",    Quantity.fromString(env.getCpuRequest()))
                        .putRequestsItem("memory", Quantity.fromString(env.getMemoryRequest()))
                        .putLimitsItem("cpu",    Quantity.fromString(env.getCpuRequest()))
                        .putLimitsItem("memory", Quantity.fromString(env.getMemoryRequest())))
                .addVolumeMountsItem(new V1VolumeMount()
                        .name("workspace-data")
                        .mountPath("/workspace"))
                .command(command)
                .readinessProbe(readinessProbe)
                .livenessProbe(livenessProbe);

        return new V1Deployment()
                .apiVersion("apps/v1")
                .kind("Deployment")
                .metadata(new V1ObjectMeta()
                        .name(env.getK8sDeploymentName())
                        .namespace(defaultNamespace)
                        .putLabelsItem("devbox-env",  env.getName())
                        .putLabelsItem("managed-by",  "devbox")
                        .putLabelsItem("template-id", template.getId()))
                .spec(new V1DeploymentSpec()
                        .replicas(1)
                        .selector(new V1LabelSelector()
                                .putMatchLabelsItem("devbox-env", env.getName()))
                        .template(new V1PodTemplateSpec()
                                .metadata(new V1ObjectMeta()
                                        .putLabelsItem("devbox-env", env.getName())
                                        .putLabelsItem("managed-by", "devbox"))
                                .spec(new V1PodSpec()
                                        .addContainersItem(container)
                                        .addVolumesItem(new V1Volume()
                                                .name("workspace-data")
                                                .persistentVolumeClaim(
                                                        new V1PersistentVolumeClaimVolumeSource()
                                                                .claimName(env.getK8sPvcName()))))));
    }

    /**
     * Fallback startup command used only when a template has no startupCommand set.
     * This should never fire for well-configured DevBox workspace templates.
     */
    private String defaultStartupCommand(int port) {
        return String.format(
            "if command -v /usr/local/bin/devbox-entrypoint >/dev/null 2>&1; then " +
            "  /usr/local/bin/devbox-entrypoint; " +
            "elif command -v /usr/local/bin/ttyd >/dev/null 2>&1; then " +
            "  /usr/local/bin/ttyd --port %d --interface 0.0.0.0 --writable /bin/sh; " +
            "else " +
            "  echo 'No workspace server found. Set startupCommand on the template.' && sleep infinity; " +
            "fi", port);
    }

    /**
     * Builds the Service spec for a DevBox workspace environment.
     * The Service always targets the workspace gateway port (8080 on nginx).
     * Uses NodePort type so the gateway port is reachable via Minikube's node IP,
     * but in practice we use kubectl port-forward via localhost.
     */
    private V1Service buildServiceSpec(Environment env) {
        return new V1Service()
                .apiVersion("v1")
                .kind("Service")
                .metadata(new V1ObjectMeta()
                        .name(env.getK8sServiceName())
                        .namespace(defaultNamespace)
                        .putLabelsItem("devbox-env", env.getName())
                        .putLabelsItem("managed-by", "devbox"))
                .spec(new V1ServiceSpec()
                        .type("NodePort")
                        .putSelectorItem("devbox-env", env.getName())
                        .addPortsItem(new V1ServicePort()
                                .name("workspace-gw")
                                .port(WORKSPACE_GATEWAY_PORT)
                                .targetPort(new IntOrString(WORKSPACE_GATEWAY_PORT))
                                .protocol("TCP")));
    }

    private void cleanupK8s(Environment env) {
        try {
            kubernetesClientService.appsApi()
                    .deleteNamespacedDeployment(env.getK8sDeploymentName(), defaultNamespace)
                    .execute();
            log.info("Deleted Deployment '{}'", env.getK8sDeploymentName());
        } catch (ApiException e) {
            if (e.getCode() != 404)
                log.warn("Could not delete Deployment '{}': {}", env.getK8sDeploymentName(), e.getResponseBody());
        }
        try {
            kubernetesClientService.coreApi()
                    .deleteNamespacedService(env.getK8sServiceName(), defaultNamespace)
                    .execute();
            log.info("Deleted Service '{}'", env.getK8sServiceName());
        } catch (ApiException e) {
            if (e.getCode() != 404)
                log.warn("Could not delete Service '{}': {}", env.getK8sServiceName(), e.getResponseBody());
        }
        try {
            kubernetesClientService.coreApi()
                    .deleteNamespacedPersistentVolumeClaim(env.getK8sPvcName(), defaultNamespace)
                    .execute();
            log.info("Deleted PVC '{}'", env.getK8sPvcName());
        } catch (ApiException e) {
            if (e.getCode() != 404)
                log.warn("Could not delete PVC '{}': {}", env.getK8sPvcName(), e.getResponseBody());
        }
    }

    // ── Access URL resolution (kubectl port-forward) ──────────────────────────

    private void resolveAccessUrl(Environment env) {
        if (env.getK8sServiceName() == null) return;
        UUID id = env.getId();

        // 1. Reuse the existing tunnel if it is alive and healthy
        Process  existingProcess = activeTunnels.get(id);
        Integer  existingPort    = activeTunnelPorts.get(id);

        if (existingProcess != null && existingProcess.isAlive() && existingPort != null) {
            String candidateUrl = "http://127.0.0.1:" + existingPort;
            if (isHttpReady(candidateUrl)) {
                applyUrls(env, candidateUrl);
                log.info("Reusing existing tunnel for '{}': {}", env.getName(), candidateUrl);
                return;
            }
            log.debug("Existing tunnel for '{}' on port {} alive but /healthz not yet ready",
                    env.getName(), existingPort);
        }

        // 2. Clean up any stale process
        cleanupTunnel(id);

        // 3. Find a free local port and start kubectl port-forward
        try {
            int localPort = findFreeLocalPort();
            log.info("[tunnel] Starting kubectl port-forward for '{}': localhost:{} → svc/{} -n {} (targetPort={})",
                    env.getName(), localPort, env.getK8sServiceName(), defaultNamespace,
                    WORKSPACE_GATEWAY_PORT);

            ProcessBuilder pb = new ProcessBuilder(
                    "kubectl", "port-forward",
                    "svc/" + env.getK8sServiceName(),
                    "-n", defaultNamespace,
                    localPort + ":" + WORKSPACE_GATEWAY_PORT);
            pb.redirectErrorStream(true);
            Process p = pb.start();

            activeTunnels.put(id, p);
            activeTunnelPorts.put(id, localPort);

            String candidateUrl = "http://127.0.0.1:" + localPort;

            // Wait up to 45 seconds for nginx /healthz to respond HTTP 200.
            // The readiness probe on the pod ensures VNC+XFCE+nginx are up before
            // the pod is marked Ready, but the port-forward process itself needs
            // a moment to bind and establish the tunnel.
            boolean ready    = false;
            long    deadline = System.currentTimeMillis() + 45_000;
            int     attempt  = 0;

            while (System.currentTimeMillis() < deadline) {
                if (!p.isAlive()) {
                    String pfOutput = "";
                    try { pfOutput = new String(p.getInputStream().readAllBytes()); }
                    catch (Exception ignored) {}
                    log.warn("[tunnel] kubectl port-forward for '{}' exited prematurely (exit={}). " +
                             "Output: {}", env.getName(), p.exitValue(),
                             pfOutput.isBlank() ? "(none)" : pfOutput.trim());
                    break;
                }
                if (isHttpReady(candidateUrl)) {
                    ready = true;
                    break;
                }
                if (attempt % 10 == 0 && attempt > 0) {
                    log.debug("[tunnel] Waiting for '{}'/healthz... ({}ms elapsed, attempt {})",
                            env.getName(),
                            System.currentTimeMillis() - (deadline - 45_000),
                            attempt);
                }
                attempt++;
                Thread.sleep(200);
            }

            if (ready) {
                applyUrls(env, candidateUrl);
                log.info("[tunnel] Workspace '{}' ready at {} (desktop: {}/desktop/vnc.html)",
                        env.getName(), candidateUrl, candidateUrl);
            } else {
                // Set the URLs anyway — the workspace may still be starting.
                // The frontend will show a "preparing" state and the user can retry.
                applyUrls(env, candidateUrl);
                log.warn("[tunnel] Port-forward for '{}' on localhost:{} established, but /healthz " +
                         "did not respond OK within 45s. The workspace gateway may still be starting. " +
                         "URL: {}", env.getName(), localPort, candidateUrl);
            }

        } catch (Exception e) {
            log.error("[tunnel] Failed to start kubectl port-forward for '{}': {}",
                    env.getName(), e.getMessage());
            fallbackToNodeIpUrl(env);
        }
    }

    /**
     * Sets accessUrl, desktopUrl, and terminalUrl from the given base gateway URL.
     *
     * nginx routing inside the workspace container:
     *   /          → landing page  (template-specific HTML, links to terminal + desktop)
     *   /terminal/ → ttyd:7681     (browser terminal)
     *   /desktop/  → noVNC static  (XFCE desktop via TigerVNC + websockify)
     *   /websockify → websockify:6080 (WebSocket bridge for noVNC)
     *   /healthz   → 200 OK
     *
     * URL semantics:
     *   accessUrl   = base URL        — the workspace landing page (/)
     *   terminalUrl = base + /terminal/ — direct link to ttyd browser terminal
     *   desktopUrl  = base + /desktop/vnc.html?autoconnect=true&path=websockify
     */
    private void applyUrls(Environment env, String baseUrl) {
        env.setAccessUrl(baseUrl);
        env.setTerminalUrl(baseUrl + "/terminal/");
        env.setDesktopUrl(baseUrl + "/desktop/vnc.html?autoconnect=true&path=websockify");
    }

    private int findFreeLocalPort() {
        try (java.net.ServerSocket socket = new java.net.ServerSocket(0)) {
            socket.setReuseAddress(true);
            return socket.getLocalPort();
        } catch (Exception e) {
            // Fall back to a random port in the ephemeral range
            return 20000 + new java.util.Random().nextInt(10000);
        }
    }

    /**
     * Returns true if there is an active, healthy kubectl port-forward tunnel.
     * Uses a quick TCP connect check to avoid blocking on an HTTP round-trip.
     */
    private boolean isTunnelAlive(UUID envId) {
        Process p    = activeTunnels.get(envId);
        Integer port = activeTunnelPorts.get(envId);
        if (p == null || !p.isAlive() || port == null) return false;
        try (java.net.Socket s = new java.net.Socket()) {
            s.connect(new java.net.InetSocketAddress("127.0.0.1", port), 500);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Returns true if GET baseUrl/healthz responds HTTP 200. */
    private boolean isHttpReady(String baseUrl) {
        try {
            java.net.URL url = java.net.URI.create(baseUrl + "/healthz").toURL();
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(1000);
            conn.setReadTimeout(1000);
            conn.setRequestMethod("GET");
            int code = conn.getResponseCode();
            return code == 200;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Fallback: build the access URL from the Minikube node IP + NodePort.
     * Not reachable on Windows Docker driver but retained as metadata.
     */
    private void fallbackToNodeIpUrl(Environment env) {
        if (env.getNodePort() == null) return;
        try {
            ProcessBuilder pb = new ProcessBuilder("minikube", "ip");
            pb.redirectErrorStream(true);
            Process p = pb.start();
            p.waitFor(5, TimeUnit.SECONDS);
            String ip = new String(p.getInputStream().readAllBytes()).trim();
            if (!ip.isBlank() && !ip.startsWith("Error") && !ip.contains(" ")) {
                String url = "http://" + ip + ":" + env.getNodePort();
                applyUrls(env, url);
                log.info("Using fallback Minikube node URL for '{}': {}", env.getName(), url);
            }
        } catch (Exception e) {
            log.debug("Could not get minikube ip for fallback URL: {}", e.getMessage());
        }
    }

    /** Fetches the NodePort from the live K8s Service and updates the environment record. */
    private void refreshNodePort(Environment env) {
        if (env.getK8sServiceName() == null) return;
        try {
            V1Service svc = kubernetesClientService.coreApi()
                    .readNamespacedService(env.getK8sServiceName(), defaultNamespace)
                    .execute();
            if (svc.getSpec() != null && svc.getSpec().getPorts() != null
                    && !svc.getSpec().getPorts().isEmpty()) {
                Integer np = svc.getSpec().getPorts().get(0).getNodePort();
                if (np != null && !np.equals(env.getNodePort())) {
                    log.info("NodePort for '{}' updated: {} → {}", env.getName(), env.getNodePort(), np);
                    env.setNodePort(np);
                    env.setAccessUrl(null);
                    env.setDesktopUrl(null);
                    env.setTerminalUrl(null);
                    resolveAccessUrl(env);
                } else if (np != null && (env.getAccessUrl() == null || env.getDesktopUrl() == null)) {
                    resolveAccessUrl(env);
                }
            }
        } catch (ApiException e) {
            log.debug("Could not refresh NodePort for '{}': {}", env.getName(), e.getMessage());
        }
    }

    // ── Status derivation ─────────────────────────────────────────────────────

    private EnvironmentStatus deriveStatus(V1Deployment deployment, String envName) {
        if (deployment.getSpec() == null) return EnvironmentStatus.FAILED;

        int desired = deployment.getSpec().getReplicas() != null
                ? deployment.getSpec().getReplicas() : 0;
        if (desired == 0) return EnvironmentStatus.STOPPED;

        V1DeploymentStatus s = deployment.getStatus();
        if (s == null) return EnvironmentStatus.PROVISIONING;

        int ready = s.getReadyReplicas() != null ? s.getReadyReplicas() : 0;
        if (ready >= desired) return EnvironmentStatus.RUNNING;

        // Check deployment conditions for known failure modes
        if (s.getConditions() != null) {
            boolean replicaFailure = s.getConditions().stream()
                    .anyMatch(c -> "ReplicaFailure".equals(c.getType())
                                && "True".equals(c.getStatus()));
            if (replicaFailure) return EnvironmentStatus.FAILED;

            boolean progressing = s.getConditions().stream()
                    .anyMatch(c -> "Progressing".equals(c.getType())
                                && "True".equals(c.getStatus()));
            if (!progressing && ready == 0) return EnvironmentStatus.FAILED;
        }

        // Check pod-level crash states (CrashLoopBackOff, ImagePullBackOff, OOMKilled, etc.)
        try {
            V1PodList podList = kubernetesClientService.coreApi()
                    .listNamespacedPod(defaultNamespace)
                    .labelSelector("devbox-env=" + envName)
                    .execute();
            for (V1Pod pod : podList.getItems()) {
                if (pod.getStatus() == null) continue;
                if ("Failed".equals(pod.getStatus().getPhase())) return EnvironmentStatus.FAILED;
                if (pod.getStatus().getContainerStatuses() != null) {
                    for (V1ContainerStatus cs : pod.getStatus().getContainerStatuses()) {
                        if (cs.getState() != null && cs.getState().getWaiting() != null) {
                            String reason = cs.getState().getWaiting().getReason();
                            if (reason != null && (
                                    reason.contains("CrashLoopBackOff")
                                    || reason.contains("ImagePullBackOff")
                                    || reason.contains("ErrImagePull")
                                    || reason.contains("OOMKilled"))) {
                                log.warn("Pod crash detected for environment '{}': {}", envName, reason);
                                return EnvironmentStatus.FAILED;
                            }
                        }
                    }
                }
            }
        } catch (ApiException ex) {
            log.debug("Could not read pod states during status derivation for '{}': {}",
                    envName, ex.getMessage());
        }

        return EnvironmentStatus.PROVISIONING;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private PodInfo toPodInfo(V1Pod pod) {
        String phase    = pod.getStatus() != null && pod.getStatus().getPhase() != null
                ? pod.getStatus().getPhase() : "Unknown";
        boolean ready   = false;
        int restarts    = 0;
        String image    = "";
        if (pod.getStatus() != null && pod.getStatus().getContainerStatuses() != null
                && !pod.getStatus().getContainerStatuses().isEmpty()) {
            V1ContainerStatus cs = pod.getStatus().getContainerStatuses().get(0);
            ready    = Boolean.TRUE.equals(cs.getReady());
            restarts = cs.getRestartCount() != null ? cs.getRestartCount() : 0;
            image    = cs.getImage() != null ? cs.getImage() : "";
        }
        return PodInfo.builder()
                .name(pod.getMetadata() != null ? pod.getMetadata().getName() : "unknown")
                .phase(phase).status(phase).ready(ready).restartCount(restarts)
                .createdAt(pod.getMetadata() != null
                        && pod.getMetadata().getCreationTimestamp() != null
                        ? pod.getMetadata().getCreationTimestamp().toInstant() : null)
                .nodeName(pod.getSpec() != null ? pod.getSpec().getNodeName() : null)
                .containerImage(image)
                .build();
    }

    public Environment findOrThrow(UUID id) {
        return environmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Environment", id));
    }

    private String describeException(Exception e) {
        if (e instanceof ApiException ae) {
            String body = ae.getResponseBody();
            if (body != null && !body.isBlank()) {
                return body.length() > 300 ? body.substring(0, 300) + "..." : body;
            }
            int code = ae.getCode();
            return "Kubernetes API error" + (code > 0 ? " HTTP " + code : "")
                   + (ae.getMessage() != null ? ": " + ae.getMessage() : "");
        }
        return e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
    }

    private static String coalesce(String first, String second) {
        return (first != null && !first.isBlank()) ? first : second;
    }
}
