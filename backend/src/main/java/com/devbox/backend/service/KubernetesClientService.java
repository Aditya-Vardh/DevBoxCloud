package com.devbox.backend.service;

import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.util.Config;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;

/**
 * Provides configured Kubernetes API clients.
 * Uses the default kubeconfig (same as kubectl on the host machine).
 * Initialization is lazy/graceful — if K8s is unavailable the service still starts.
 */
@Service
@Slf4j
public class KubernetesClientService {

    private ApiClient apiClient;

    @PostConstruct
    public void init() {
        try {
            apiClient = Config.defaultClient();
            // Set a reasonable timeout so K8s calls don't hang forever
            apiClient.setConnectTimeout(5_000);
            apiClient.setReadTimeout(30_000);
            apiClient.setWriteTimeout(30_000);
            io.kubernetes.client.openapi.Configuration.setDefaultApiClient(apiClient);
            log.info("Kubernetes client initialized (using kubeconfig)");
        } catch (IOException e) {
            log.warn("Could not initialize Kubernetes client: {}. " +
                    "Kubernetes features will be unavailable until cluster is reachable.", e.getMessage());
        }
    }

    /**
     * Returns a fresh AppsV1Api backed by the current client.
     * Re-initializes the client if it was previously unavailable.
     */
    public AppsV1Api appsApi() {
        ensureClient();
        return new AppsV1Api(apiClient);
    }

    /**
     * Returns a fresh CoreV1Api backed by the current client.
     */
    public CoreV1Api coreApi() {
        ensureClient();
        return new CoreV1Api(apiClient);
    }

    private void ensureClient() {
        if (apiClient == null) {
            init();
        }
        if (apiClient == null) {
            throw new IllegalStateException(
                "Kubernetes client is not available. " +
                "Check that kubectl is configured and the cluster is reachable.");
        }
    }
}
