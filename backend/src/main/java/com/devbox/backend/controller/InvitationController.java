package com.devbox.backend.controller;

import com.devbox.backend.dto.request.CreateInvitationRequest;
import com.devbox.backend.dto.response.EnvironmentResponse;
import com.devbox.backend.dto.response.InvitationResponse;
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

    /** POST /api/environments/:envId/invitations — create an invitation */
    @PostMapping("/api/environments/{environmentId}/invitations")
    public ResponseEntity<InvitationResponse> create(
            @PathVariable UUID environmentId,
            @Valid @RequestBody(required = false) CreateInvitationRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(invitationService.create(environmentId, req));
    }

    /** GET /api/environments/:envId/invitations — list invitations for an env */
    @GetMapping("/api/environments/{environmentId}/invitations")
    public ResponseEntity<List<InvitationResponse>> list(@PathVariable UUID environmentId) {
        return ResponseEntity.ok(invitationService.listByEnvironment(environmentId));
    }

    /** DELETE /api/invitations/:id — revoke an invitation */
    @DeleteMapping("/api/invitations/{id}")
    public ResponseEntity<InvitationResponse> revoke(@PathVariable UUID id) {
        return ResponseEntity.ok(invitationService.revoke(id));
    }

    /** GET /api/invitations/info/:code — get invitation info (public, no auth required) */
    @GetMapping("/api/invitations/info/{code}")
    public ResponseEntity<InvitationResponse> info(@PathVariable String code) {
        return ResponseEntity.ok(invitationService.info(code));
    }

    /** POST /api/invitations/redeem/:code — redeem an invitation */
    @PostMapping("/api/invitations/redeem/{code}")
    public ResponseEntity<EnvironmentResponse> redeem(@PathVariable String code) {
        return ResponseEntity.ok(invitationService.redeem(code));
    }
}
