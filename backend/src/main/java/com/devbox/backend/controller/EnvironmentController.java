package com.devbox.backend.controller;

import com.devbox.backend.dto.request.CreateEnvironmentRequest;
import com.devbox.backend.dto.response.EnvironmentResponse;
import com.devbox.backend.dto.response.PodInfo;
import com.devbox.backend.service.EnvironmentProvisioningService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class EnvironmentController {

    private final EnvironmentProvisioningService provisioningService;

    // ── Environments under workspaces ─────────────────────────────────────────

    /** GET /api/workspaces/:wsId/environments */
    @GetMapping("/api/workspaces/{workspaceId}/environments")
    public ResponseEntity<List<EnvironmentResponse>> list(@PathVariable UUID workspaceId) {
        return ResponseEntity.ok(provisioningService.listByWorkspace(workspaceId));
    }

    /** POST /api/workspaces/:wsId/environments */
    @PostMapping("/api/workspaces/{workspaceId}/environments")
    public ResponseEntity<EnvironmentResponse> create(
            @PathVariable UUID workspaceId,
            @Valid @RequestBody CreateEnvironmentRequest req) {
        EnvironmentResponse created = provisioningService.create(workspaceId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // ── Environment by ID ─────────────────────────────────────────────────────

    /** GET /api/environments/:id */
    @GetMapping("/api/environments/{id}")
    public ResponseEntity<EnvironmentResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(provisioningService.getById(id));
    }

    /** DELETE /api/environments/:id */
    @DeleteMapping("/api/environments/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        provisioningService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /** POST /api/environments/:id/start */
    @PostMapping("/api/environments/{id}/start")
    public ResponseEntity<EnvironmentResponse> start(@PathVariable UUID id) {
        return ResponseEntity.ok(provisioningService.start(id));
    }

    /** POST /api/environments/:id/stop */
    @PostMapping("/api/environments/{id}/stop")
    public ResponseEntity<EnvironmentResponse> stop(@PathVariable UUID id) {
        return ResponseEntity.ok(provisioningService.stop(id));
    }

    // ── Observability ─────────────────────────────────────────────────────────

    /** GET /api/environments/:id/status */
    @GetMapping("/api/environments/{id}/status")
    public ResponseEntity<EnvironmentResponse> status(@PathVariable UUID id) {
        return ResponseEntity.ok(provisioningService.getStatus(id));
    }

    /** GET /api/environments/:id/pods */
    @GetMapping("/api/environments/{id}/pods")
    public ResponseEntity<List<PodInfo>> pods(@PathVariable UUID id) {
        return ResponseEntity.ok(provisioningService.getPods(id));
    }

    /** GET /api/environments/:id/logs?lines=200 */
    @GetMapping("/api/environments/{id}/logs")
    public ResponseEntity<String> logs(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "200") int lines) {
        return ResponseEntity.ok(provisioningService.getLogs(id, lines));
    }
}
