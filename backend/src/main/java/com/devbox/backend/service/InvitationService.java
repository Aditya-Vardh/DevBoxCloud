package com.devbox.backend.service;

import com.devbox.backend.dto.request.CreateInvitationRequest;
import com.devbox.backend.dto.response.EnvironmentResponse;
import com.devbox.backend.dto.response.InvitationResponse;
import com.devbox.backend.entity.Environment;
import com.devbox.backend.entity.Invitation;
import com.devbox.backend.exception.BadRequestException;
import com.devbox.backend.exception.ResourceNotFoundException;
import com.devbox.backend.repository.EnvironmentRepository;
import com.devbox.backend.repository.InvitationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class InvitationService {

    private final InvitationRepository invitationRepository;
    private final EnvironmentRepository environmentRepository;

    private static final SecureRandom RANDOM = new SecureRandom();

    private String generateCode() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private Environment findEnv(UUID envId) {
        return environmentRepository.findById(envId)
                .orElseThrow(() -> new ResourceNotFoundException("Environment not found: " + envId));
    }

    public InvitationResponse create(UUID environmentId, CreateInvitationRequest req) {
        Environment env = findEnv(environmentId);

        Invitation inv = Invitation.builder()
                .environment(env)
                .code(generateCode())
                .maxUses(req != null ? req.getMaxUses() : null)
                .expiresAt(req != null && req.getExpiresInHours() != null
                        ? Instant.now().plusSeconds(req.getExpiresInHours() * 3600L)
                        : null)
                .build();

        Invitation saved = invitationRepository.save(inv);
        log.info("Created invitation {} for environment '{}'", saved.getCode(), env.getName());
        return InvitationResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<InvitationResponse> listByEnvironment(UUID environmentId) {
        findEnv(environmentId);
        return invitationRepository
                .findByEnvironmentIdOrderByCreatedAtDesc(environmentId)
                .stream()
                .map(InvitationResponse::from)
                .collect(Collectors.toList());
    }

    public InvitationResponse revoke(UUID invitationId) {
        Invitation inv = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException("Invitation not found: " + invitationId));
        inv.setRevoked(true);
        log.info("Revoked invitation {}", inv.getCode());
        return InvitationResponse.from(invitationRepository.save(inv));
    }

    /**
     * Looks up and validates an invitation by code.
     * Returns the invitation info (used by the redemption page to show preview).
     */
    @Transactional(readOnly = true)
    public InvitationResponse info(String code) {
        Invitation inv = invitationRepository.findByCode(code)
                .orElseThrow(() -> new ResourceNotFoundException("Invitation not found"));
        return InvitationResponse.from(inv);
    }

    /**
     * Redeems an invitation. Returns the environment the invitee should access.
     * Increments use-count and validates the invitation is still usable.
     */
    public EnvironmentResponse redeem(String code) {
        Invitation inv = invitationRepository.findByCode(code)
                .orElseThrow(() -> new ResourceNotFoundException("Invitation not found or already expired"));

        if (!inv.isValid()) {
            String reason = inv.isRevoked()             ? "This invitation has been revoked."
                          : inv.getExpiresAt() != null
                            && Instant.now().isAfter(inv.getExpiresAt()) ? "This invitation has expired."
                          : "This invitation has reached its maximum number of uses.";
            throw new BadRequestException(reason);
        }

        inv.setUseCount(inv.getUseCount() + 1);
        invitationRepository.save(inv);
        log.info("Invitation {} redeemed (useCount={})", inv.getCode(), inv.getUseCount());

        return EnvironmentResponse.from(inv.getEnvironment());
    }
}
