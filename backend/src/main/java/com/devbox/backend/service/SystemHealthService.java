package com.devbox.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Checks external environment health: Docker, kubectl, Kubernetes cluster, Minikube.
 * Every check is non-fatal — results are returned to the caller who decides.
 *
 * Renamed from EnvironmentService to avoid name clash with the new
 * EnvironmentProvisioningService that manages Environment JPA entities.
 */
@Service
@Slf4j
public class SystemHealthService {

    @Value("${devbox.kubernetes.namespace:devbox}")
    private String namespace;

    @Value("${devbox.kubernetes.minikube:true}")
    private boolean minikubeEnabled;

    /**
     * Returns a map of component name → status string.
     * Values start with "ok:" on success or "error:" on failure.
     */
    public Map<String, Object> checkAll() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("docker", checkDocker());
        result.put("kubectl", checkKubectl());
        result.put("kubernetes", checkKubernetesCluster());
        if (minikubeEnabled) {
            result.put("minikube", checkMinikube());
        }
        result.put("namespace", namespace);
        return result;
    }

    public String checkDocker() {
        return runCommand("docker", "info", "--format", "{{.ServerVersion}}");
    }

    public String checkKubectl() {
        return runCommand("kubectl", "version", "--client", "--short");
    }

    public String checkKubernetesCluster() {
        return runCommand("kubectl", "cluster-info", "--request-timeout=5s");
    }

    public String checkMinikube() {
        return runCommand("minikube", "status");
    }

    public boolean isKubernetesAvailable() {
        return checkKubernetesCluster().startsWith("ok:");
    }

    public boolean isDockerAvailable() {
        return checkDocker().startsWith("ok:");
    }

    private String runCommand(String... cmd) {
        try {
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.redirectErrorStream(true);
            Process p = pb.start();
            boolean finished = p.waitFor(10, TimeUnit.SECONDS);
            if (!finished) {
                p.destroyForcibly();
                return "error: timed out after 10s";
            }
            String output = new String(p.getInputStream().readAllBytes()).trim();
            int exitCode = p.exitValue();
            if (exitCode == 0) {
                return "ok: " + (output.isEmpty() ? "available"
                        : output.lines().findFirst().orElse("available"));
            } else {
                return "error: exit=" + exitCode + " "
                        + output.lines().findFirst().orElse("");
            }
        } catch (IOException e) {
            return "error: " + cmd[0] + " not found or not accessible (" + e.getMessage() + ")";
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return "error: interrupted";
        }
    }
}
