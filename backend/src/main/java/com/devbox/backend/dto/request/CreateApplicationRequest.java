package com.devbox.backend.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CreateApplicationRequest {

    @NotBlank(message = "Application name is required")
    @Size(min = 1, max = 63, message = "Name must be between 1 and 63 characters")
    @Pattern(regexp = "^[a-z0-9][a-z0-9\\-]*[a-z0-9]$|^[a-z0-9]$",
             message = "Name must be lowercase alphanumeric and hyphens only (Kubernetes-safe)")
    private String name;

    @Size(max = 500, message = "Description must not exceed 500 characters")
    private String description;

    /** Absolute path to directory containing the Dockerfile */
    @NotBlank(message = "Source path is required")
    private String sourcePath;

    @Min(value = 1, message = "Container port must be between 1 and 65535")
    @Max(value = 65535, message = "Container port must be between 1 and 65535")
    private int containerPort = 8080;

    @Min(value = 1, message = "Replicas must be at least 1")
    @Max(value = 50, message = "Replicas cannot exceed 50")
    private int replicas = 1;
}
