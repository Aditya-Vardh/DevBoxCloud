package com.devbox.backend.dto.response;

import com.devbox.backend.entity.Invitation;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class InvitationResponse {

    private UUID   id;
    private String code;
    private UUID   environmentId;
    private String environmentName;
    private String templateName;
    private Integer maxUses;
    private int     useCount;
    private boolean revoked;
    private boolean valid;
    private Instant expiresAt;
    private Instant createdAt;

    public static InvitationResponse from(Invitation inv) {
        return InvitationResponse.builder()
                .id(inv.getId())
                .code(inv.getCode())
                .environmentId(inv.getEnvironment().getId())
                .environmentName(inv.getEnvironment().getName())
                .templateName(inv.getEnvironment().getTemplate().getDisplayName())
                .maxUses(inv.getMaxUses())
                .useCount(inv.getUseCount())
                .revoked(inv.isRevoked())
                .valid(inv.isValid())
                .expiresAt(inv.getExpiresAt())
                .createdAt(inv.getCreatedAt())
                .build();
    }
}
