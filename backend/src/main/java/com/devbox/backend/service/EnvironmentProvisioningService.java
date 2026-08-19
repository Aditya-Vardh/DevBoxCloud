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

import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Manages the lifecycle of template-based development environments:
 * create → provision on K8s → start → stop → delete.
 *
 * No Docker build step — environments use the template's prebuilt image directly.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class EnvironmentProvisioningService {

    private final EnvironmentRepository environmentRepository;
    private final WorkspaceService workspaceService;
    private final TemplateService templateService;
    private final SystemHealthService systemHealthService;
    private final KubernetesClientService kubernetesClientService;

    @Value("${devbox.kubernetes.namespace:devbox}")
    private String defaultNamespace;

    @Value("${devbox.kubernetes.minikube:true}")
    private boolean minikubeEnabled;

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
        Template template  = templateService.findOrThrow(req.getTemplateId());

        if (environmentRepository.existsByWorkspaceIdAndName(workspaceId, req.getName())) {
            throw new ConflictException(
                    "Environment '" + req.getName() + "' already exists in this workspace");
        }

        // Build Kubernetes-safe resource names
        String k8sName     = K8sNameUtil.sanitize(req.getName());
        String deployName  = k8sName;
        String svcName     = k8sName + "-svc";
        String pvcName     = k8sName + "-pvc";

        Environment env = Environment.builder()
                .workspace(workspace)
                .template(template)
                .name(req.getName())
                .description(req.getDescription())
                .status(EnvironmentStatus.PROVISIONING)
                .cpuRequest(coalesce(req.getCpuRequest(), template.getDefaultCpu()))
                .memoryRequest(coalesce(req.getMemoryRequest(), template.getDefaultMemory()))
                .storageSize(coalesce(req.getStorageSize(), template.getDefaultStorage()))
                .k8sNamespace(defaultNamespace)
                .k8sDeploymentName(deployName)
                .k8sServiceName(svcName)
                .k8sPvcName(pvcName)
                .build();

        Environment saved = environmentRepository.save(env);
        log.info("Created environment: {} ({}) from template {}", saved.getName(), saved.getId(), template.getId());

        // Attempt immediate K8s provisioning — non-fatal
        if (systemHealthService.isKubernetesAvailable()) {
            try {
                provisionK8s(saved, template);
            } catch (Exception e) {
                String reason = describeException(e);
                log.warn("K8s provisioning deferred for {} — {}", saved.getName(), reason);
                saved.setFailureReason("Provisioning deferred: " + reason);
                environmentRepository.save(saved);
            }
        } else {
            log.info("K8s not available; environment {} saved as PROVISIONING", saved.getName());
        }

        return EnvironmentResponse.from(environmentRepository.findById(saved.getId()).orElse(saved));
    }

    // ── START (resume after stop) ─────────────────────────────────────────────

    public EnvironmentResponse start(UUID id) {
        Environment env = findOrThrow(id);

        if (!systemHealthService.isKubernetesAvailable()) {
            throw new KubernetesException("Kubernetes is not reachable. Start Minikube and try again.");
        }

        // If resources were never created, provision them now
        if (env.getStatus() == EnvironmentStatus.PROVISIONING
                || env.getStatus() == EnvironmentStatus.FAILED) {
            try {
                provisionK8s(env, env.getTemplate());
            } catch (ApiException e) {
                String reason = describeException(e);
                throw new KubernetesException("Provisioning failed: " + reason, e);
            }
        } else if (env.getStatus() == EnvironmentStatus.STOPPED) {
            // Scale back up
            try {
                AppsV1Api appsApi = kubernetesClientService.appsApi();
                V1Deployment existing = appsApi
                        .readNamespacedDeployment(env.getK8sDeploymentName(), defaultNamespace)
                        .execute();
                existing.getSpec().setReplicas(1);
                appsApi.replaceNamespacedDeployment(env.getK8sDeploymentName(), defaultNamespace, existing)
                        .execute();
            } catch (ApiException e) {
                throw new KubernetesException("Start failed: " + e.getResponseBody(), e);
            }
        } else {
            throw new BadRequestException("Environment must be STOPPED or PROVISIONING to start. Current status: " + env.getStatus());
        }

        env.setStatus(EnvironmentStatus.PROVISIONING);
        env.setStartedAt(Instant.now());
        env.setStoppedAt(null);
        env.setFailureReason(null);
        environmentRepository.save(env);
        log.info("Started environment: {} ({})", env.getName(), env.getId());
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
        } catch (ApiException e) {
            if (e.getCode() != 404) {
                throw new KubernetesException("Stop failed: " + e.getResponseBody(), e);
            }
        }

        env.setStatus(EnvironmentStatus.STOPPED);
        env.setStoppedAt(Instant.now());
        environmentRepository.save(env);
        log.info("Stopped environment: {} ({})", env.getName(), env.getId());
        return EnvironmentResponse.from(env);
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    public void delete(UUID id) {
        Environment env = findOrThrow(id);
        env.setStatus(EnvironmentStatus.DELETING);
        environmentRepository.save(env);

        if (systemHealthService.isKubernetesAvailable()) {
            cleanupK8s(env);
        }

        environmentRepository.delete(env);
        log.info("Deleted environment: {} ({})", env.getName(), id);
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

            EnvironmentStatus derived = deriveStatus(deployment);
            boolean changed = (derived != env.getStatus());

            if (changed) {
                env.setStatus(derived);
                if (derived == EnvironmentStatus.RUNNING && env.getStartedAt() == null) {
                    env.setStartedAt(Instant.now());
                }
            }

            // Resolve access URL once running — may not have been set on create
            // (e.g. service was created before nodePort was captured)
            if (derived == EnvironmentStatus.RUNNING && env.getAccessUrl() == null) {
                resolveAccessUrl(env);
                changed = true;
            }

            // Also ensure nodePort is persisted if the service was already created
            if (env.getNodePort() == null && derived != EnvironmentStatus.DELETED) {
                refreshNodePort(env);
                changed = true;
            }

            if (changed) {
                environmentRepository.save(env);
            }

        } catch (ApiException e) {
            if (e.getCode() == 404) {
                env.setStatus(EnvironmentStatus.DELETED);
                environmentRepository.save(env);
            } else {
                log.warn("Could not check K8s status for {}: {}", env.getName(), e.getMessage());
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
            V1PodList list = kubernetesClientService.coreApi()
                    .listNamespacedPod(defaultNamespace)
                    .labelSelector("devbox-env=" + env.getName())
                    .execute();
            return list.getItems().stream().map(this::toPodInfo).collect(Collectors.toList());
        } catch (ApiException e) {
            log.warn("Pod list error for {}: {}", env.getName(), e.getResponseBody());
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
                return "No pods found for environment '" + env.getName() + "'.";
            }
            V1Pod pod = list.getItems().stream()
                    .filter(p -> "Running".equals(p.getStatus() != null ? p.getStatus().getPhase() : null))
                    .findFirst()
                    .orElse(list.getItems().get(0));
            String podName = pod.getMetadata().getName();
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
        ensureNamespaceExists();
        createOrUpdatePvc(env, template);
        createOrUpdateDeployment(env, template);
        createOrUpdateService(env, template);
        log.info("Provisioned K8s resources for {} in {}", env.getName(), defaultNamespace);
    }

    private void ensureNamespaceExists() {
        try {
            CoreV1Api coreApi = kubernetesClientService.coreApi();
            try {
                coreApi.readNamespace(defaultNamespace).execute();
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    coreApi.createNamespace(new V1Namespace()
                            .metadata(new V1ObjectMeta().name(defaultNamespace))).execute();
                    log.info("Created namespace: {}", defaultNamespace);
                }
            }
        } catch (ApiException e) {
            log.warn("Could not ensure namespace {}: {}", defaultNamespace, e.getResponseBody());
        }
    }

    private void createOrUpdatePvc(Environment env, Template template) throws ApiException {
        CoreV1Api coreApi = kubernetesClientService.coreApi();
        String pvcName = env.getK8sPvcName();
        try {
            coreApi.readNamespacedPersistentVolumeClaim(pvcName, defaultNamespace).execute();
            log.debug("PVC {} already exists", pvcName);
        } catch (ApiException e) {
            if (e.getCode() == 404) {
                V1PersistentVolumeClaim pvc = new V1PersistentVolumeClaim()
                        .metadata(new V1ObjectMeta()
                                .name(pvcName)
                                .namespace(defaultNamespace)
                                .putLabelsItem("devbox-env", env.getName())
                                .putLabelsItem("managed-by", "devbox"))
                        .spec(new V1PersistentVolumeClaimSpec()
                                .accessModes(List.of("ReadWriteOnce"))
                                .resources(new V1VolumeResourceRequirements()
                                        .putRequestsItem("storage",
                                                Quantity.fromString(env.getStorageSize()))));
                coreApi.createNamespacedPersistentVolumeClaim(defaultNamespace, pvc).execute();
                log.info("Created PVC: {}", pvcName);
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
            log.info("Updated Deployment: {}", env.getK8sDeploymentName());
        } catch (ApiException e) {
            if (e.getCode() == 404) {
                appsApi.createNamespacedDeployment(defaultNamespace, spec).execute();
                log.info("Created Deployment: {}", env.getK8sDeploymentName());
            } else {
                throw e;
            }
        }
    }

    private void createOrUpdateService(Environment env, Template template) throws ApiException {
        CoreV1Api coreApi = kubernetesClientService.coreApi();
        V1Service spec = buildServiceSpec(env, template);
        try {
            V1Service existing = coreApi.readNamespacedService(env.getK8sServiceName(), defaultNamespace).execute();
            spec.getSpec().setClusterIP(existing.getSpec().getClusterIP());
            spec.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
            coreApi.replaceNamespacedService(env.getK8sServiceName(), defaultNamespace, spec).execute();
            log.info("Updated Service: {}", env.getK8sServiceName());
        } catch (ApiException e) {
            if (e.getCode() == 404) {
                V1Service created = coreApi.createNamespacedService(defaultNamespace, spec).execute();
                // Capture the assigned nodePort
                if (created.getSpec() != null && created.getSpec().getPorts() != null
                        && !created.getSpec().getPorts().isEmpty()) {
                    Integer np = created.getSpec().getPorts().get(0).getNodePort();
                    if (np != null) {
                        env.setNodePort(np);
                        resolveAccessUrl(env);
                        environmentRepository.save(env);
                    }
                }
                log.info("Created Service: {}", env.getK8sServiceName());
            } else {
                throw e;
            }
        }
    }

    private V1Deployment buildDeploymentSpec(Environment env, Template template) {
        // Parse environment variables from template
        List<V1EnvVar> envVars = new ArrayList<>();
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

        // Resolve the startup command for this template.
        // The command MUST bind a real server to 0.0.0.0:{containerPort} so the
        // Kubernetes Service endpoint is reachable from outside the pod.
        String startupCmd = (template.getStartupCommand() != null
                && !template.getStartupCommand().isBlank())
                ? template.getStartupCommand()
                : defaultStartupCommand(template.getContainerPort());

        V1Container container = new V1Container()
                .name(env.getName())
                .image(template.getImage())
                .imagePullPolicy("IfNotPresent")
                .addPortsItem(new V1ContainerPort()
                        .containerPort(template.getContainerPort()))
                .env(envVars.isEmpty() ? null : envVars)
                .resources(new V1ResourceRequirements()
                        .putRequestsItem("cpu",    Quantity.fromString(env.getCpuRequest()))
                        .putRequestsItem("memory", Quantity.fromString(env.getMemoryRequest()))
                        .putLimitsItem("cpu",    Quantity.fromString(env.getCpuRequest()))
                        .putLimitsItem("memory", Quantity.fromString(env.getMemoryRequest())))
                .addVolumeMountsItem(new V1VolumeMount()
                        .name("workspace-data")
                        .mountPath("/workspace"))
                // Run the template's workspace server command via sh -c so env vars are expanded
                .command(List.of("/bin/sh", "-c", startupCmd));

        return new V1Deployment()
                .apiVersion("apps/v1")
                .kind("Deployment")
                .metadata(new V1ObjectMeta()
                        .name(env.getK8sDeploymentName())
                        .namespace(defaultNamespace)
                        .putLabelsItem("devbox-env", env.getName())
                        .putLabelsItem("managed-by", "devbox")
                        .putLabelsItem("template", template.getId()))
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
     * Fallback startup command if the template has no startupCommand set.
     * Uses ttyd if available, otherwise a minimal Python HTTP server.
     * This should only fire for templates that predate the startupCommand field.
     */
    private String defaultStartupCommand(int port) {
        return String.format(
            "if command -v /usr/local/bin/ttyd >/dev/null 2>&1; then " +
            "  /usr/local/bin/ttyd --port %d --interface 0.0.0.0 --writable /bin/sh; " +
            "elif command -v python3 >/dev/null 2>&1; then " +
            "  python3 -m http.server %d --bind 0.0.0.0; " +
            "else " +
            "  echo 'No workspace server found. Set startupCommand on the template.' && sleep infinity; " +
            "fi", port, port);
    }

    private V1Service buildServiceSpec(Environment env, Template template) {
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
                                .port(template.getContainerPort())
                                .targetPort(new IntOrString(template.getContainerPort()))
                                .protocol("TCP")));
    }

    private void cleanupK8s(Environment env) {
        // Deployment
        try {
            kubernetesClientService.appsApi()
                    .deleteNamespacedDeployment(env.getK8sDeploymentName(), defaultNamespace)
                    .execute();
            log.info("Deleted Deployment: {}", env.getK8sDeploymentName());
        } catch (ApiException e) {
            if (e.getCode() != 404) log.warn("Delete deployment error: {}", e.getResponseBody());
        }
        // Service
        try {
            kubernetesClientService.coreApi()
                    .deleteNamespacedService(env.getK8sServiceName(), defaultNamespace)
                    .execute();
            log.info("Deleted Service: {}", env.getK8sServiceName());
        } catch (ApiException e) {
            if (e.getCode() != 404) log.warn("Delete service error: {}", e.getResponseBody());
        }
        // PVC — delete last so data is preserved until resources are gone
        try {
            kubernetesClientService.coreApi()
                    .deleteNamespacedPersistentVolumeClaim(env.getK8sPvcName(), defaultNamespace)
                    .execute();
            log.info("Deleted PVC: {}", env.getK8sPvcName());
        } catch (ApiException e) {
            if (e.getCode() != 404) log.warn("Delete PVC error: {}", e.getResponseBody());
        }
    }

    private void resolveAccessUrl(Environment env) {
        if (!minikubeEnabled || env.getNodePort() == null) return;
        try {
            ProcessBuilder pb = new ProcessBuilder("minikube", "ip");
            pb.redirectErrorStream(true);
            Process p = pb.start();
            p.waitFor(5, TimeUnit.SECONDS);
            String ip = new String(p.getInputStream().readAllBytes()).trim();
            if (!ip.isBlank() && !ip.startsWith("Error") && !ip.contains(" ")) {
                env.setAccessUrl("http://" + ip + ":" + env.getNodePort());
            }
        } catch (Exception e) {
            log.debug("Could not resolve Minikube URL: {}", e.getMessage());
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
                    env.setNodePort(np);
                    resolveAccessUrl(env);
                }
            }
        } catch (ApiException e) {
            log.debug("Could not refresh nodePort for {}: {}", env.getName(), e.getMessage());
        }
    }

    /**
     * Produces a non-null, human-readable error description from any exception.
     * ApiException carries the K8s API response body which is more useful than getMessage().
     */
    private String describeException(Exception e) {
        if (e instanceof ApiException ae) {
            String body = ae.getResponseBody();
            if (body != null && !body.isBlank()) {
                // Trim K8s JSON response to a readable length
                return body.length() > 300 ? body.substring(0, 300) + "..." : body;
            }
            int code = ae.getCode();
            return "Kubernetes API error " + (code > 0 ? "HTTP " + code : "") +
                   (ae.getMessage() != null ? ": " + ae.getMessage() : "");
        }
        return e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
    }

    private EnvironmentStatus deriveStatus(V1Deployment deployment) {
        if (deployment.getSpec() == null) return EnvironmentStatus.FAILED;
        int desired = deployment.getSpec().getReplicas() != null ? deployment.getSpec().getReplicas() : 0;
        if (desired == 0) return EnvironmentStatus.STOPPED;

        V1DeploymentStatus s = deployment.getStatus();
        if (s == null) return EnvironmentStatus.PROVISIONING;

        int ready = s.getReadyReplicas() != null ? s.getReadyReplicas() : 0;
        if (ready >= desired) return EnvironmentStatus.RUNNING;

        if (s.getConditions() != null) {
            boolean progressing = s.getConditions().stream()
                    .anyMatch(c -> "Progressing".equals(c.getType()) && "True".equals(c.getStatus()));
            if (!progressing && ready == 0) return EnvironmentStatus.FAILED;
        }
        return EnvironmentStatus.PROVISIONING;
    }

    private PodInfo toPodInfo(V1Pod pod) {
        String phase = pod.getStatus() != null && pod.getStatus().getPhase() != null
                ? pod.getStatus().getPhase() : "Unknown";
        boolean ready = false;
        int restarts = 0;
        String image = "";
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
                .createdAt(pod.getMetadata() != null && pod.getMetadata().getCreationTimestamp() != null
                        ? pod.getMetadata().getCreationTimestamp().toInstant() : null)
                .nodeName(pod.getSpec() != null ? pod.getSpec().getNodeName() : null)
                .containerImage(image)
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public Environment findOrThrow(UUID id) {
        return environmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Environment", id));
    }

    private static String coalesce(String first, String second) {
        return (first != null && !first.isBlank()) ? first : second;
    }
}
