package com.devbox.backend.controller;

import com.devbox.backend.dto.request.CreateWorkspaceRequest;
import com.devbox.backend.dto.request.UpdateWorkspaceRequest;
import com.devbox.backend.dto.response.WorkspaceResponse;
import com.devbox.backend.service.WorkspaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    /** GET /api/workspaces */
    @GetMapping
    public ResponseEntity<List<WorkspaceResponse>> listAll() {
        return ResponseEntity.ok(workspaceService.listAll());
    }

    /** GET /api/workspaces/:id */
    @GetMapping("/{id}")
    public ResponseEntity<WorkspaceResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(workspaceService.getById(id));
    }

    /** POST /api/workspaces */
    @PostMapping
    public ResponseEntity<WorkspaceResponse> create(@Valid @RequestBody CreateWorkspaceRequest req) {
        WorkspaceResponse created = workspaceService.create(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /** PUT /api/workspaces/:id */
    @PutMapping("/{id}")
    public ResponseEntity<WorkspaceResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateWorkspaceRequest req) {
        return ResponseEntity.ok(workspaceService.update(id, req));
    }

    /** DELETE /api/workspaces/:id */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        workspaceService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
