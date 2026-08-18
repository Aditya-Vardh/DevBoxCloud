package com.devbox.backend.controller;

import com.devbox.backend.dto.request.CreateApplicationRequest;
import com.devbox.backend.dto.request.ScaleRequest;
import com.devbox.backend.dto.request.UpdateApplicationRequest;
import com.devbox.backend.dto.response.*;
import com.devbox.backend.service.ApplicationService;
import com.devbox.backend.service.DeploymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService applicationService;
    private final DeploymentService deploymentService;

    // ── Applications under workspaces ─────────────────────────────────────────

    /** GET /api/workspaces/:workspaceId/applications */
    @GetMapping("/api/workspaces/{workspaceId}/applications")
    public ResponseEntity<List<ApplicationResponse>> listByWorkspace(
            @PathVariable UUID workspaceId) {
        return ResponseEntity.ok(applicationService.listByWorkspace(workspaceId));
    }

    /** POST /api/workspaces/:workspaceId/applications */
    @PostMapping("/api/workspaces/{workspaceId}/applications")
    public ResponseEntity<ApplicationResponse> create(
            @PathVariable UUID workspaceId,
            @Valid @RequestBody CreateApplicationRequest req) {
        ApplicationResponse created = applicationService.create(workspaceId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // ── Applications by ID ────────────────────────────────────────────────────

    /** GET /api/applications/:id */
    @GetMapping("/api/applications/{id}")
    public ResponseEntity<ApplicationResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(applicationService.getById(id));
    }

    /** PUT /api/applications/:id */
    @PutMapping("/api/applications/{id}")
    public ResponseEntity<ApplicationResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateApplicationRequest req) {
        return ResponseEntity.ok(applicationService.update(id, req));
    }

    /** DELETE /api/applications/:id */
    @DeleteMapping("/api/applications/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        deploymentService.deleteApplication(id);
        return ResponseEntity.noContent().build();
    }

    // ── Build / Deploy / Operations ───────────────────────────────────────────

    /** POST /api/applications/:id/build */
    @PostMapping("/api/applications/{id}/build")
    public ResponseEntity<BuildResponse> build(@PathVariable UUID id) {
        return ResponseEntity.ok(deploymentService.buildApplication(id));
    }

    /** POST /api/applications/:id/deploy */
    @PostMapping("/api/applications/{id}/deploy")
    public ResponseEntity<DeploymentStatusResponse> deploy(@PathVariable UUID id) {
        return ResponseEntity.ok(deploymentService.deployApplication(id));
    }

    /** POST /api/applications/:id/redeploy */
    @PostMapping("/api/applications/{id}/redeploy")
    public ResponseEntity<DeploymentStatusResponse> redeploy(@PathVariable UUID id) {
        return ResponseEntity.ok(deploymentService.redeployApplication(id));
    }

    /** POST /api/applications/:id/scale */
    @PostMapping("/api/applications/{id}/scale")
    public ResponseEntity<DeploymentStatusResponse> scale(
            @PathVariable UUID id,
            @Valid @RequestBody ScaleRequest req) {
        return ResponseEntity.ok(deploymentService.scaleApplication(id, req.getReplicas()));
    }

    /** POST /api/applications/:id/stop */
    @PostMapping("/api/applications/{id}/stop")
    public ResponseEntity<DeploymentStatusResponse> stop(@PathVariable UUID id) {
        return ResponseEntity.ok(deploymentService.scaleApplication(id, 0));
    }

    // ── Status / Pods / Logs / Service ────────────────────────────────────────

    /** GET /api/applications/:id/status */
    @GetMapping("/api/applications/{id}/status")
    public ResponseEntity<DeploymentStatusResponse> status(@PathVariable UUID id) {
        return ResponseEntity.ok(deploymentService.getStatus(id));
    }

    /** GET /api/applications/:id/pods */
    @GetMapping("/api/applications/{id}/pods")
    public ResponseEntity<List<PodInfo>> pods(@PathVariable UUID id) {
        return ResponseEntity.ok(deploymentService.getPods(id));
    }

    /** GET /api/applications/:id/logs */
    @GetMapping("/api/applications/{id}/logs")
    public ResponseEntity<String> logs(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "200") int lines) {
        return ResponseEntity.ok(deploymentService.getLogs(id, lines));
    }

    /** GET /api/applications/:id/service */
    @GetMapping("/api/applications/{id}/service")
    public ResponseEntity<ServiceInfo> service(@PathVariable UUID id) {
        return ResponseEntity.ok(deploymentService.getServiceInfo(id));
    }
}
