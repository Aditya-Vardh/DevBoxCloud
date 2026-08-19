package com.devbox.backend.entity;

/**
 * Lifecycle status of a template-based development environment.
 */
public enum EnvironmentStatus {
    /** Resources have not been created yet */
    PENDING,
    /** Kubernetes resources are being created */
    PROVISIONING,
    /** All pods ready — workspace is accessible */
    RUNNING,
    /** Scaled to 0 by user, resources preserved */
    STOPPED,
    /** Pods not ready / crash loop */
    FAILED,
    /** Deletion in progress */
    DELETING,
    /** All resources deleted */
    DELETED
}
