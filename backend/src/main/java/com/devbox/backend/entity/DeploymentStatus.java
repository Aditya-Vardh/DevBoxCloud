package com.devbox.backend.entity;

/**
 * Application-level deployment status.
 * Maps actual Kubernetes states into predictable application states.
 */
public enum DeploymentStatus {
    /** Never been deployed */
    NOT_DEPLOYED,
    /** Docker build in progress */
    BUILDING,
    /** Docker build failed */
    BUILD_FAILED,
    /** K8s deployment resources being created / rollout in progress */
    DEPLOYING,
    /** All desired replicas are available and ready */
    RUNNING,
    /** Some replicas available but fewer than desired */
    DEGRADED,
    /** Deployment exists but zero pods are ready / crash loop */
    FAILED,
    /** Deployment scaled to 0 by user */
    STOPPED,
    /** Deletion in progress */
    DELETING
}
