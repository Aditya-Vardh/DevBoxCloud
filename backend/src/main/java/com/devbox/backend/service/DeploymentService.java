package com.devbox.backend.service;

import com.devbox.backend.dto.response.*;
import com.devbox.backend.entity.Application;
import com.devbox.backend.entity.DeploymentStatus;
import com.devbox.backend.exception.BadRequestException;
import com.devbox.backend.exception.KubernetesException;
import com.devbox.backend.repository.ApplicationRepository;
import io.kubernetes.client.custom.IntOrString;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class DeploymentService {

    private final ApplicationService applicationService;
    private final ApplicationRepository applicationRepository;
    private final SystemHealthService environmentService;
    private final KubernetesClientService kubernetesClientService;

    @Value("${devbox.kubernetes.namespace:devbox}")
    private String namespace;

    @Value("${devbox.kubernetes.minikube:true}")
    private boolean minikubeEnabled;

    // ── BUILD ─────────────────────────────────────────────────────────────────

    public BuildResponse buildApplication(UUID id) {
        Application app = applicationService.findOrThrow(id);

        if (!environmentService.isDockerAvailable()) {
            throw new KubernetesException(
                    "Docker is not running. Start Docker Desktop and try again.");
        }

        Path sourceDir = Path.of(app.getSourcePath()).toAbsolutePath().normalize();
        Path dockerfile = sourceDir.resolve("Dockerfile");
        if (!Files.exists(dockerfile)) {
            applicationService.updateStatusAndLog(id, DeploymentStatus.BUILD_FAILED,
                    "Dockerfile not found at: " + dockerfile);
            return BuildResponse.builder()
                    .success(false)
                    .status(DeploymentStatus.BUILD_FAILED)
                    .error("Dockerfile not found at: " + dockerfile)
                    .build();
        }

        applicationService.updateStatus(id, DeploymentStatus.BUILDING);
        String imageName = app.getDockerImage();
        log.info("Building Docker image: {} from {}", imageName, sourceDir);

        try {
            StringBuilder logBuilder = new StringBuilder();
            boolean success;

            if (minikubeEnabled) {
                // Build directly into Minikube's Docker daemon
                success = runBuildCommand(logBuilder, sourceDir.toString(),
                        "minikube", "image", "build", "-t", imageName, ".");
            } else {
                // Standard Docker build
                success = runBuildCommand(logBuilder, sourceDir.toString(),
                        "docker", "build", "-t", imageName, ".");
            }

            String buildLog = logBuilder.toString();

            if (success) {
                applicationService.updateStatusAndLog(id, DeploymentStatus.NOT_DEPLOYED, buildLog);
                log.info("Build succeeded for {}: {}", app.getName(), imageName);
                return BuildResponse.builder()
                        .success(true)
                        .status(DeploymentStatus.NOT_DEPLOYED)
                        .imageName(imageName)
                        .log(buildLog)
                        .build();
            } else {
                applicationService.updateStatusAndLog(id, DeploymentStatus.BUILD_FAILED, buildLog);
                return BuildResponse.builder()
                        .success(false)
                        .status(DeploymentStatus.BUILD_FAILED)
                        .log(buildLog)
                        .error("Docker build exited with non-zero code. Check build log.")
                        .build();
            }

        } catch (Exception e) {
            String error = "Build failed: " + e.getMessage();
            applicationService.updateStatusAndLog(id, DeploymentStatus.BUILD_FAILED, error);
            log.error("Build failed for {}: {}", app.getName(), e.getMessage(), e);
            return BuildResponse.builder()
                    .success(false)
                    .status(DeploymentStatus.BUILD_FAILED)
                    .error(error)
                    .build();
        }
    }

    // ── DEPLOY ────────────────────────────────────────────────────────────────

    public DeploymentStatusResponse deployApplication(UUID id) {
        Application app = applicationService.findOrThrow(id);

        if (app.getDockerImage() == null || app.getDockerImage().isBlank()) {
            throw new BadRequestException("Build the application first before deploying.");
        }
        if (app.getDeploymentStatus() == DeploymentStatus.BUILDING) {
            throw new BadRequestException("Build is still in progress.");
        }
        if (!environmentService.isKubernetesAvailable()) {
            throw new KubernetesException(
                    "Kubernetes cluster is not reachable. Start Minikube and try again.");
        }

        ensureNamespaceExists();
        applicationService.updateStatus(id, DeploymentStatus.DEPLOYING);

        try {
            createOrUpdateDeployment(kubernetesClientService.appsApi(), app);
            createOrUpdateService(kubernetesClientService.coreApi(), app);

            applicationService.updateStatus(id, DeploymentStatus.DEPLOYING);
            log.info("Deployment created for {} in namespace {}", app.getName(), namespace);

            app = applicationService.findOrThrow(id);
            return buildStatusResponse(app, DeploymentStatus.DEPLOYING,
                    "Deployment created. Pods are starting.");
        } catch (ApiException e) {
            String msg = "Kubernetes API error: " + e.getResponseBody();
            applicationService.updateStatus(id, DeploymentStatus.FAILED);
            log.error("Deploy failed for {}: {}", app.getName(), msg);
            throw new KubernetesException(msg, e);
        }
    }

    // ── REDEPLOY ──────────────────────────────────────────────────────────────

    public DeploymentStatusResponse redeployApplication(UUID id) {
        if (!environmentService.isKubernetesAvailable()) {
            throw new KubernetesException(
                    "Kubernetes cluster is not reachable. Start Minikube and try again.");
        }
        BuildResponse buildResult = buildApplication(id);
        if (!buildResult.isSuccess()) {
            throw new BadRequestException(
                    "Redeploy failed: build unsuccessful. " + buildResult.getError());
        }
        return deployApplication(id);
    }

    // ── SCALE ─────────────────────────────────────────────────────────────────

    public DeploymentStatusResponse scaleApplication(UUID id, int replicas) {
        Application app = applicationService.findOrThrow(id);

        if (app.getDeploymentStatus() == DeploymentStatus.NOT_DEPLOYED
                || app.getDeploymentStatus() == DeploymentStatus.BUILD_FAILED) {
            throw new BadRequestException("Application must be deployed before scaling.");
        }
        if (!environmentService.isKubernetesAvailable()) {
            throw new KubernetesException(
                    "Kubernetes cluster is not reachable. Start Minikube and try again.");
        }

        try {
            AppsV1Api appsApi = kubernetesClientService.appsApi();
            V1Deployment existing = appsApi
                    .readNamespacedDeployment(app.getK8sDeploymentName(), namespace)
                    .execute();
            existing.getSpec().setReplicas(replicas);
            appsApi.replaceNamespacedDeployment(app.getK8sDeploymentName(), namespace, existing)
                    .execute();

            app.setReplicas(replicas);
            applicationRepository.save(app);

            DeploymentStatus newStatus = replicas == 0
                    ? DeploymentStatus.STOPPED : DeploymentStatus.DEPLOYING;
            applicationService.updateStatus(id, newStatus);

            log.info("Scaled {} to {} replicas", app.getName(), replicas);
            return buildStatusResponse(app, newStatus, "Scaling to " + replicas + " replicas.");
        } catch (ApiException e) {
            throw new KubernetesException("Scale failed: " + e.getResponseBody(), e);
        }
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    public void deleteApplication(UUID id) {
        Application app = applicationService.findOrThrow(id);
        applicationService.updateStatus(id, DeploymentStatus.DELETING);

        if (app.getK8sDeploymentName() != null && environmentService.isKubernetesAvailable()) {
            try {
                kubernetesClientService.appsApi()
                        .deleteNamespacedDeployment(app.getK8sDeploymentName(), namespace)
                        .execute();
                log.info("Deleted K8s Deployment: {}", app.getK8sDeploymentName());
            } catch (ApiException e) {
                if (e.getCode() != 404) {
                    log.warn("Could not delete deployment {}: {}", app.getK8sDeploymentName(), e.getResponseBody());
                }
            } catch (Exception e) {
                log.warn("K8s deployment cleanup error for {}: {}", app.getName(), e.getMessage());
            }

            try {
                kubernetesClientService.coreApi()
                        .deleteNamespacedService(app.getK8sServiceName(), namespace)
                        .execute();
                log.info("Deleted K8s Service: {}", app.getK8sServiceName());
            } catch (ApiException e) {
                if (e.getCode() != 404) {
                    log.warn("Could not delete service {}: {}", app.getK8sServiceName(), e.getResponseBody());
                }
            } catch (Exception e) {
                log.warn("K8s service cleanup error for {}: {}", app.getName(), e.getMessage());
            }
        }

        applicationService.delete(id);
    }

    // ── STATUS ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public DeploymentStatusResponse getStatus(UUID id) {
        Application app = applicationService.findOrThrow(id);

        if (!environmentService.isKubernetesAvailable()
                || app.getDeploymentStatus() == DeploymentStatus.NOT_DEPLOYED
                || app.getDeploymentStatus() == DeploymentStatus.BUILDING
                || app.getDeploymentStatus() == DeploymentStatus.BUILD_FAILED) {
            return buildStatusResponse(app, app.getDeploymentStatus(), null);
        }

        try {
            V1Deployment deployment = kubernetesClientService.appsApi()
                    .readNamespacedDeployment(app.getK8sDeploymentName(), namespace)
                    .execute();

            DeploymentStatus derivedStatus = deriveStatus(deployment);

            if (derivedStatus != app.getDeploymentStatus()) {
                applicationService.updateStatus(id, derivedStatus);
            }

            V1DeploymentStatus s = deployment.getStatus();
            int desired = deployment.getSpec().getReplicas() != null
                    ? deployment.getSpec().getReplicas() : 0;
            int available = s != null && s.getAvailableReplicas() != null
                    ? s.getAvailableReplicas() : 0;
            int ready = s != null && s.getReadyReplicas() != null
                    ? s.getReadyReplicas() : 0;

            return DeploymentStatusResponse.builder()
                    .applicationId(app.getId())
                    .applicationName(app.getName())
                    .status(derivedStatus)
                    .desiredReplicas(desired)
                    .availableReplicas(available)
                    .readyReplicas(ready)
                    .message(buildStatusMessage(derivedStatus, desired, ready))
                    .build();

        } catch (ApiException e) {
            if (e.getCode() == 404) {
                applicationService.updateStatus(id, DeploymentStatus.NOT_DEPLOYED);
                return buildStatusResponse(app, DeploymentStatus.NOT_DEPLOYED,
                        "Deployment not found in cluster. It may have been deleted externally.");
            }
            log.warn("Could not fetch K8s status for {}: {}", app.getName(), e.getResponseBody());
            return buildStatusResponse(app, app.getDeploymentStatus(),
                    "Could not reach Kubernetes: " + e.getMessage());
        }
    }

    // ── PODS ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PodInfo> getPods(UUID id) {
        Application app = applicationService.findOrThrow(id);

        if (!environmentService.isKubernetesAvailable()) {
            return List.of();
        }

        try {
            V1PodList podList = kubernetesClientService.coreApi()
                    .listNamespacedPod(namespace)
                    .labelSelector("app=" + app.getName())
                    .execute();

            return podList.getItems().stream()
                    .map(this::toPodInfo)
                    .collect(Collectors.toList());
        } catch (ApiException e) {
            log.warn("Could not list pods for {}: {}", app.getName(), e.getResponseBody());
            return List.of();
        }
    }

    // ── LOGS ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public String getLogs(UUID id, int lines) {
        Application app = applicationService.findOrThrow(id);

        if (!environmentService.isKubernetesAvailable()) {
            return "Kubernetes is not available. Start Minikube and try again.";
        }

        try {
            V1PodList podList = kubernetesClientService.coreApi()
                    .listNamespacedPod(namespace)
                    .labelSelector("app=" + app.getName())
                    .execute();

            if (podList.getItems().isEmpty()) {
                return "No pods found for application '" + app.getName() + "'.";
            }

            V1Pod targetPod = podList.getItems().stream()
                    .filter(p -> "Running".equals(
                            p.getStatus() != null ? p.getStatus().getPhase() : null))
                    .findFirst()
                    .orElse(podList.getItems().get(0));

            String podName = targetPod.getMetadata().getName();
            try {
                return kubernetesClientService.coreApi()
                        .readNamespacedPodLog(podName, namespace)
                        .tailLines(lines)
                        .execute();
            } catch (ApiException logEx) {
                return "Could not retrieve logs from pod " + podName + ": " + logEx.getMessage();
            }
        } catch (ApiException e) {
            return "Could not list pods: " + e.getResponseBody();
        }
    }

    // ── SERVICE INFO ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ServiceInfo getServiceInfo(UUID id) {
        Application app = applicationService.findOrThrow(id);

        if (app.getK8sServiceName() == null || !environmentService.isKubernetesAvailable()) {
            return ServiceInfo.builder()
                    .name(app.getK8sServiceName())
                    .type("NodePort")
                    .port(app.getContainerPort())
                    .build();
        }

        try {
            V1Service svc = kubernetesClientService.coreApi()
                    .readNamespacedService(app.getK8sServiceName(), namespace)
                    .execute();

            int nodePort = 0;
            int port = 0;
            int targetPort = 0;

            if (svc.getSpec() != null && svc.getSpec().getPorts() != null
                    && !svc.getSpec().getPorts().isEmpty()) {
                V1ServicePort sp = svc.getSpec().getPorts().get(0);
                port = sp.getPort();
                targetPort = sp.getTargetPort() != null
                        ? sp.getTargetPort().getIntValue() : port;
                nodePort = sp.getNodePort() != null ? sp.getNodePort() : 0;
            }

            if (nodePort > 0) {
                applicationService.updateServicePort(id, nodePort);
            }

            String accessUrl = buildMinikubeUrl(nodePort);

            return ServiceInfo.builder()
                    .name(svc.getMetadata().getName())
                    .type(svc.getSpec().getType())
                    .clusterIp(svc.getSpec().getClusterIP())
                    .port(port)
                    .targetPort(targetPort)
                    .nodePort(nodePort > 0 ? nodePort : null)
                    .accessUrl(accessUrl)
                    .build();

        } catch (ApiException e) {
            if (e.getCode() == 404) {
                return ServiceInfo.builder()
                        .name(app.getK8sServiceName())
                        .type("NodePort")
                        .port(app.getContainerPort())
                        .build();
            }
            log.warn("Could not get service info for {}: {}", app.getName(), e.getResponseBody());
            throw new KubernetesException("Could not retrieve service info: " + e.getMessage(), e);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private boolean runBuildCommand(StringBuilder logBuilder, String workDir, String... cmd)
            throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.directory(new File(workDir));
        pb.redirectErrorStream(true);
        Process process = pb.start();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                logBuilder.append(line).append("\n");
            }
        }

        boolean finished = process.waitFor(10, TimeUnit.MINUTES);
        if (!finished) {
            process.destroyForcibly();
            logBuilder.append("\nERROR: Build timed out after 10 minutes\n");
            return false;
        }
        return process.exitValue() == 0;
    }

    private void ensureNamespaceExists() {
        try {
            CoreV1Api coreApi = kubernetesClientService.coreApi();
            try {
                coreApi.readNamespace(namespace).execute();
            } catch (ApiException e) {
                if (e.getCode() == 404) {
                    V1Namespace ns = new V1Namespace()
                            .metadata(new V1ObjectMeta().name(namespace));
                    coreApi.createNamespace(ns).execute();
                    log.info("Created namespace: {}", namespace);
                }
            }
        } catch (ApiException e) {
            log.warn("Could not ensure namespace {}: {}", namespace, e.getResponseBody());
        }
    }

    private void createOrUpdateDeployment(AppsV1Api appsApi, Application app) throws ApiException {
        V1Deployment deployment = buildDeploymentSpec(app);
        try {
            appsApi.readNamespacedDeployment(app.getK8sDeploymentName(), namespace).execute();
            // Exists — update
            appsApi.replaceNamespacedDeployment(app.getK8sDeploymentName(), namespace, deployment)
                    .execute();
            log.info("Updated K8s Deployment: {}", app.getK8sDeploymentName());
        } catch (ApiException e) {
            if (e.getCode() == 404) {
                appsApi.createNamespacedDeployment(namespace, deployment).execute();
                log.info("Created K8s Deployment: {}", app.getK8sDeploymentName());
            } else {
                throw e;
            }
        }
    }

    private void createOrUpdateService(CoreV1Api coreApi, Application app) throws ApiException {
        V1Service service = buildServiceSpec(app);
        try {
            V1Service existing = coreApi
                    .readNamespacedService(app.getK8sServiceName(), namespace)
                    .execute();
            // Preserve clusterIP on update (required by K8s API)
            service.getSpec().setClusterIP(existing.getSpec().getClusterIP());
            service.getMetadata().setResourceVersion(
                    existing.getMetadata().getResourceVersion());
            coreApi.replaceNamespacedService(app.getK8sServiceName(), namespace, service)
                    .execute();
            log.info("Updated K8s Service: {}", app.getK8sServiceName());
        } catch (ApiException e) {
            if (e.getCode() == 404) {
                V1Service created = coreApi
                        .createNamespacedService(namespace, service)
                        .execute();
                if (created.getSpec() != null && created.getSpec().getPorts() != null
                        && !created.getSpec().getPorts().isEmpty()) {
                    Integer nodePort = created.getSpec().getPorts().get(0).getNodePort();
                    if (nodePort != null) {
                        applicationService.updateServicePort(app.getId(), nodePort);
                    }
                }
                log.info("Created K8s Service: {}", app.getK8sServiceName());
            } else {
                throw e;
            }
        }
    }

    private V1Deployment buildDeploymentSpec(Application app) {
        return new V1Deployment()
                .apiVersion("apps/v1")
                .kind("Deployment")
                .metadata(new V1ObjectMeta()
                        .name(app.getK8sDeploymentName())
                        .namespace(namespace)
                        .putLabelsItem("app", app.getName())
                        .putLabelsItem("managed-by", "devbox"))
                .spec(new V1DeploymentSpec()
                        .replicas(app.getReplicas())
                        .selector(new V1LabelSelector()
                                .putMatchLabelsItem("app", app.getName()))
                        .template(new V1PodTemplateSpec()
                                .metadata(new V1ObjectMeta()
                                        .putLabelsItem("app", app.getName()))
                                .spec(new V1PodSpec()
                                        .addContainersItem(new V1Container()
                                                .name(app.getName())
                                                .image(app.getDockerImage())
                                                .imagePullPolicy("IfNotPresent")
                                                .addPortsItem(new V1ContainerPort()
                                                        .containerPort(app.getContainerPort()))))));
    }

    private V1Service buildServiceSpec(Application app) {
        return new V1Service()
                .apiVersion("v1")
                .kind("Service")
                .metadata(new V1ObjectMeta()
                        .name(app.getK8sServiceName())
                        .namespace(namespace)
                        .putLabelsItem("app", app.getName())
                        .putLabelsItem("managed-by", "devbox"))
                .spec(new V1ServiceSpec()
                        .type("NodePort")
                        .putSelectorItem("app", app.getName())
                        .addPortsItem(new V1ServicePort()
                                .port(app.getContainerPort())
                                .targetPort(new IntOrString(app.getContainerPort()))
                                .protocol("TCP")));
    }

    private DeploymentStatus deriveStatus(V1Deployment deployment) {
        if (deployment.getSpec() == null) return DeploymentStatus.FAILED;
        int desired = deployment.getSpec().getReplicas() != null
                ? deployment.getSpec().getReplicas() : 0;
        if (desired == 0) return DeploymentStatus.STOPPED;

        V1DeploymentStatus s = deployment.getStatus();
        if (s == null) return DeploymentStatus.DEPLOYING;

        int ready = s.getReadyReplicas() != null ? s.getReadyReplicas() : 0;

        if (ready >= desired) return DeploymentStatus.RUNNING;
        if (ready > 0) return DeploymentStatus.DEGRADED;

        // Check whether the deployment is still progressing
        if (s.getConditions() != null) {
            boolean progressing = s.getConditions().stream()
                    .anyMatch(c -> "Progressing".equals(c.getType())
                            && "True".equals(c.getStatus()));
            if (!progressing && ready == 0) return DeploymentStatus.FAILED;
        }
        return DeploymentStatus.DEPLOYING;
    }

    private String buildMinikubeUrl(int nodePort) {
        if (!minikubeEnabled || nodePort == 0) return null;
        try {
            ProcessBuilder pb = new ProcessBuilder("minikube", "ip");
            pb.redirectErrorStream(true);
            Process p = pb.start();
            p.waitFor(5, TimeUnit.SECONDS);
            String ip = new String(p.getInputStream().readAllBytes()).trim();
            if (!ip.isBlank() && !ip.startsWith("Error") && !ip.contains(" ")) {
                return "http://" + ip + ":" + nodePort;
            }
        } catch (Exception e) {
            log.debug("Could not get minikube ip: {}", e.getMessage());
        }
        return null;
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
            ready = Boolean.TRUE.equals(cs.getReady());
            restarts = cs.getRestartCount() != null ? cs.getRestartCount() : 0;
            image = cs.getImage() != null ? cs.getImage() : "";
        }

        Instant created = null;
        if (pod.getMetadata() != null && pod.getMetadata().getCreationTimestamp() != null) {
            created = pod.getMetadata().getCreationTimestamp().toInstant();
        }

        return PodInfo.builder()
                .name(pod.getMetadata() != null ? pod.getMetadata().getName() : "unknown")
                .phase(phase)
                .status(phase)
                .ready(ready)
                .restartCount(restarts)
                .createdAt(created)
                .nodeName(pod.getSpec() != null ? pod.getSpec().getNodeName() : null)
                .containerImage(image)
                .build();
    }

    private DeploymentStatusResponse buildStatusResponse(Application app,
                                                          DeploymentStatus status,
                                                          String message) {
        return DeploymentStatusResponse.builder()
                .applicationId(app.getId())
                .applicationName(app.getName())
                .status(status)
                .desiredReplicas(app.getReplicas())
                .availableReplicas(0)
                .readyReplicas(0)
                .message(message)
                .build();
    }

    private String buildStatusMessage(DeploymentStatus status, int desired, int ready) {
        return switch (status) {
            case RUNNING -> ready + "/" + desired + " replicas running";
            case DEPLOYING -> "Deploying: " + ready + "/" + desired + " ready";
            case DEGRADED -> "Degraded: " + ready + "/" + desired + " replicas ready";
            case FAILED -> "Deployment failed — 0/" + desired + " replicas ready";
            case STOPPED -> "Deployment stopped (0 replicas)";
            default -> status.name();
        };
    }
}

