package com.devbox.backend.controller;

import com.devbox.backend.dto.request.CreateInvitationRequest;
import com.devbox.backend.dto.response.EnvironmentResponse;
import com.devbox.backend.dto.response.InvitationResponse;
import com.devbox.backend.service.EnvironmentProvisioningService;
import com.devbox.backend.service.InvitationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class InvitationController {

    private final InvitationService invitationService;
    private final EnvironmentProvisioningService provisioningService;

    /** POST /api/environments/:envId/invitations */
    @PostMapping("/api/environments/{environmentId}/invitations")
    public ResponseEntity<InvitationResponse> create(
            @PathVariable UUID environmentId,
            @Valid @RequestBody(required = false) CreateInvitationRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(invitationService.create(environmentId, req));
    }

    /** GET /api/environments/:envId/invitations */
    @GetMapping("/api/environments/{environmentId}/invitations")
    public ResponseEntity<List<InvitationResponse>> list(@PathVariable UUID environmentId) {
        return ResponseEntity.ok(invitationService.listByEnvironment(environmentId));
    }

    /** DELETE /api/invitations/:id */
    @DeleteMapping("/api/invitations/{id}")
    public ResponseEntity<InvitationResponse> revoke(@PathVariable UUID id) {
        return ResponseEntity.ok(invitationService.revoke(id));
    }

    /** GET /api/invitations/info/:code — public, no auth required */
    @GetMapping("/api/invitations/info/{code}")
    public ResponseEntity<InvitationResponse> info(@PathVariable String code) {
        return ResponseEntity.ok(invitationService.info(code));
    }

    /**
     * POST /api/invitations/redeem/:code
     * Validates and redeems the invitation, then returns a fresh environment status
     * so the returned accessUrl/terminalUrl/desktopUrl use the correct configured host
     * (important for LAN sharing — the friend gets reachable URLs, not 127.0.0.1).
     */
    @PostMapping("/api/invitations/redeem/{code}")
    public ResponseEntity<EnvironmentResponse> redeem(@PathVariable String code) {
        EnvironmentResponse env = invitationService.redeem(code);
        // Refresh status to (re-)establish port-forward tunnel with the correct host
        // and return up-to-date terminal/desktop URLs to the invited user.
        try {
            return ResponseEntity.ok(provisioningService.getStatus(env.getId()));
        } catch (Exception e) {
            // If K8s is unavailable, still return the redeemed environment
            return ResponseEntity.ok(env);
        }
    }
}
