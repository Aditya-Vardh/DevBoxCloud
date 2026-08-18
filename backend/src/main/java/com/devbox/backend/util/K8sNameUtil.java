package com.devbox.backend.util;

/**
 * Utility for generating deterministic, collision-free Kubernetes resource names.
 * Names conform to RFC 1123 DNS subdomain rules: lowercase alphanumeric + hyphens,
 * max 63 characters, must start and end with alphanumeric.
 */
public final class K8sNameUtil {

    private K8sNameUtil() {}

    /**
     * Derive the Kubernetes Deployment name for an application.
     * Uses the application name directly (already validated as K8s-safe).
     */
    public static String deploymentName(String appName) {
        return sanitize(appName);
    }

    /**
     * Derive the Kubernetes Service name for an application.
     */
    public static String serviceName(String appName) {
        return sanitize(appName) + "-svc";
    }

    /**
     * Derive the Docker image name for an application.
     * Format: devbox/<appname>:latest
     */
    public static String imageName(String appName) {
        return "devbox/" + sanitize(appName) + ":latest";
    }

    /**
     * Sanitize a string to be RFC 1123 compliant.
     * Converts to lowercase, replaces non-alphanumeric chars with hyphens,
     * strips leading/trailing hyphens, truncates to 63 chars.
     */
    public static String sanitize(String input) {
        if (input == null || input.isBlank()) {
            throw new IllegalArgumentException("Name cannot be blank");
        }
        String lowered = input.toLowerCase().trim();
        // Replace any character that is not lowercase alphanumeric with a hyphen
        String replaced = lowered.replaceAll("[^a-z0-9]+", "-");
        // Strip leading/trailing hyphens
        replaced = replaced.replaceAll("^-+|-+$", "");
        // Truncate to 63 chars, then strip any trailing hyphens again
        if (replaced.length() > 63) {
            replaced = replaced.substring(0, 63).replaceAll("-+$", "");
        }
        if (replaced.isEmpty()) {
            throw new IllegalArgumentException("Sanitized name is empty for input: " + input);
        }
        return replaced;
    }
}
