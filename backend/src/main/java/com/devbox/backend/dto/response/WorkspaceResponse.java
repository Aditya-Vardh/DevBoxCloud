package com.devbox.backend.dto.response;

import com.devbox.backend.entity.Workspace;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class WorkspaceResponse {

    private UUID id;
    private String name;
    private String description;
    private Instant createdAt;
    private Instant updatedAt;
    private int applicationCount;

    public static WorkspaceResponse from(Workspace w) {
        return WorkspaceResponse.builder()
                .id(w.getId())
                .name(w.getName())
                .description(w.getDescription())
                .createdAt(w.getCreatedAt())
                .updatedAt(w.getUpdatedAt())
                .applicationCount(w.getApplications() != null ? w.getApplications().size() : 0)
                .build();
    }
}
