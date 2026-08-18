package com.devbox.backend.dto.response;

import com.devbox.backend.entity.DeploymentStatus;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class BuildResponse {
    private boolean success;
    private DeploymentStatus status;
    private String imageName;
    private String log;
    private String error;
}
