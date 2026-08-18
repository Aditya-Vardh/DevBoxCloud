package com.devbox.backend.dto.response;

import com.devbox.backend.entity.Application;
import com.devbox.backend.entity.DeploymentStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class ApplicationResponse {

    private UUID id;
    private UUID workspaceId;
    private String workspaceName;
    private String name;
    private String description;
    private String sourcePath;
    private String dockerImage;
    private int containerPort;
    private Integer servicePort;
    private int replicas;
    private DeploymentStatus deploymentStatus;
    private String k8sDeploymentName;
    private String k8sServiceName;
    private String k8sNamespace;
    private Instant createdAt;
    private Instant updatedAt;

    public static ApplicationResponse from(Application a) {
        return ApplicationResponse.builder()
                .id(a.getId())
                .workspaceId(a.getWorkspace().getId())
                .workspaceName(a.getWorkspace().getName())
                .name(a.getName())
                .description(a.getDescription())
                .sourcePath(a.getSourcePath())
                .dockerImage(a.getDockerImage())
                .containerPort(a.getContainerPort())
                .servicePort(a.getServicePort())
                .replicas(a.getReplicas())
                .deploymentStatus(a.getDeploymentStatus())
                .k8sDeploymentName(a.getK8sDeploymentName())
                .k8sServiceName(a.getK8sServiceName())
                .k8sNamespace(a.getK8sNamespace())
                .createdAt(a.getCreatedAt())
                .updatedAt(a.getUpdatedAt())
                .build();
    }
}
