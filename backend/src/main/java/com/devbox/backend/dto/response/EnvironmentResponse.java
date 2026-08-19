package com.devbox.backend.dto.response;

import com.devbox.backend.entity.Environment;
import com.devbox.backend.entity.EnvironmentStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class EnvironmentResponse {

    private UUID id;
    private UUID workspaceId;
    private String workspaceName;

    private String templateId;
    private String templateName;
    private String templateIcon;

    private String name;
    private String description;
    private EnvironmentStatus status;

    private String cpuRequest;
    private String memoryRequest;
    private String storageSize;

    private String k8sNamespace;
    private String k8sDeploymentName;
    private String k8sServiceName;
    private String k8sPvcName;

    private Integer nodePort;
    private String accessUrl;
    private String failureReason;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant startedAt;
    private Instant stoppedAt;

    public static EnvironmentResponse from(Environment e) {
        return EnvironmentResponse.builder()
                .id(e.getId())
                .workspaceId(e.getWorkspace().getId())
                .workspaceName(e.getWorkspace().getName())
                .templateId(e.getTemplate().getId())
                .templateName(e.getTemplate().getDisplayName())
                .templateIcon(e.getTemplate().getIcon())
                .name(e.getName())
                .description(e.getDescription())
                .status(e.getStatus())
                .cpuRequest(e.getCpuRequest())
                .memoryRequest(e.getMemoryRequest())
                .storageSize(e.getStorageSize())
                .k8sNamespace(e.getK8sNamespace())
                .k8sDeploymentName(e.getK8sDeploymentName())
                .k8sServiceName(e.getK8sServiceName())
                .k8sPvcName(e.getK8sPvcName())
                .nodePort(e.getNodePort())
                .accessUrl(e.getAccessUrl())
                .failureReason(e.getFailureReason())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .startedAt(e.getStartedAt())
                .stoppedAt(e.getStoppedAt())
                .build();
    }
}
