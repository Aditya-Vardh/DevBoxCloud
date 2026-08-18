package com.devbox.backend.dto.response;

import com.devbox.backend.entity.DeploymentStatus;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class DeploymentStatusResponse {
    private UUID applicationId;
    private String applicationName;
    private DeploymentStatus status;
    private int desiredReplicas;
    private int availableReplicas;
    private int readyReplicas;
    private String message;
}
