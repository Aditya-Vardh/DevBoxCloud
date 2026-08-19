package com.devbox.backend.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CreateEnvironmentRequest {

    @NotBlank(message = "Environment name is required")
    @Size(min = 1, max = 63, message = "Name must be between 1 and 63 characters")
    @Pattern(regexp = "^[a-z0-9][a-z0-9\\-]*[a-z0-9]$|^[a-z0-9]$",
             message = "Name must be lowercase alphanumeric and hyphens only (Kubernetes-safe)")
    private String name;

    @Size(max = 500)
    private String description;

    @NotBlank(message = "Template ID is required")
    private String templateId;

    /** CPU request, e.g. "250m". Defaults to template default if omitted. */
    private String cpuRequest;

    /** Memory request, e.g. "512Mi". Defaults to template default if omitted. */
    private String memoryRequest;

    /** PVC storage size, e.g. "1Gi". Defaults to template default if omitted. */
    private String storageSize;
}
