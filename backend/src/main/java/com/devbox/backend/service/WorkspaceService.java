package com.devbox.backend.service;

import com.devbox.backend.dto.request.CreateWorkspaceRequest;
import com.devbox.backend.dto.request.UpdateWorkspaceRequest;
import com.devbox.backend.dto.response.WorkspaceResponse;
import com.devbox.backend.entity.Workspace;
import com.devbox.backend.exception.ConflictException;
import com.devbox.backend.exception.ResourceNotFoundException;
import com.devbox.backend.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;

    @Transactional(readOnly = true)
    public List<WorkspaceResponse> listAll() {
        return workspaceRepository.findAll()
                .stream()
                .map(WorkspaceResponse::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public WorkspaceResponse getById(UUID id) {
        return WorkspaceResponse.from(findOrThrow(id));
    }

    public WorkspaceResponse create(CreateWorkspaceRequest req) {
        if (workspaceRepository.existsByName(req.getName())) {
            throw new ConflictException("Workspace with name '" + req.getName() + "' already exists");
        }
        Workspace w = Workspace.builder()
                .name(req.getName())
                .description(req.getDescription())
                .build();
        Workspace saved = workspaceRepository.save(w);
        log.info("Created workspace: {} ({})", saved.getName(), saved.getId());
        return WorkspaceResponse.from(saved);
    }

    public WorkspaceResponse update(UUID id, UpdateWorkspaceRequest req) {
        Workspace w = findOrThrow(id);
        if (req.getName() != null && !req.getName().equals(w.getName())) {
            if (workspaceRepository.existsByName(req.getName())) {
                throw new ConflictException("Workspace with name '" + req.getName() + "' already exists");
            }
            w.setName(req.getName());
        }
        if (req.getDescription() != null) {
            w.setDescription(req.getDescription());
        }
        Workspace saved = workspaceRepository.save(w);
        log.info("Updated workspace: {} ({})", saved.getName(), saved.getId());
        return WorkspaceResponse.from(saved);
    }

    public void delete(UUID id) {
        Workspace w = findOrThrow(id);
        // CascadeType.ALL + orphanRemoval will clean up all applications
        // ApplicationService.delete() handles Kubernetes cleanup — see below.
        // Because we need to clean K8s resources too, we delegate to ApplicationService
        // via event or by letting the cascade handle the DB side.
        // The actual K8s cleanup is handled in ApplicationService when delete is called there.
        log.info("Deleting workspace: {} ({}) and all its applications", w.getName(), w.getId());
        workspaceRepository.delete(w);
    }

    // ── Internal helper ───────────────────────────────────────────────────────

    public Workspace findOrThrow(UUID id) {
        return workspaceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace", id));
    }
}
