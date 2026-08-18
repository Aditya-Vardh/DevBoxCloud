package com.devbox.backend.service;

import com.devbox.backend.dto.request.CreateApplicationRequest;
import com.devbox.backend.dto.request.UpdateApplicationRequest;
import com.devbox.backend.dto.response.ApplicationResponse;
import com.devbox.backend.entity.Application;
import com.devbox.backend.entity.DeploymentStatus;
import com.devbox.backend.entity.Workspace;
import com.devbox.backend.exception.BadRequestException;
import com.devbox.backend.exception.ConflictException;
import com.devbox.backend.exception.ResourceNotFoundException;
import com.devbox.backend.repository.ApplicationRepository;
import com.devbox.backend.util.K8sNameUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final WorkspaceService workspaceService;

    @Value("${devbox.kubernetes.namespace:devbox}")
    private String defaultNamespace;

    // ── CRUD ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ApplicationResponse> listByWorkspace(UUID workspaceId) {
        // Validate workspace exists
        workspaceService.findOrThrow(workspaceId);
        return applicationRepository.findByWorkspaceId(workspaceId)
                .stream()
                .map(ApplicationResponse::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ApplicationResponse getById(UUID id) {
        return ApplicationResponse.from(findOrThrow(id));
    }

    public ApplicationResponse create(UUID workspaceId, CreateApplicationRequest req) {
        Workspace workspace = workspaceService.findOrThrow(workspaceId);

        // Validate name uniqueness within workspace
        if (applicationRepository.existsByWorkspaceIdAndName(workspaceId, req.getName())) {
            throw new ConflictException(
                    "Application '" + req.getName() + "' already exists in this workspace");
        }

        // Validate source path exists
        validateSourcePath(req.getSourcePath());

        Application app = Application.builder()
                .workspace(workspace)
                .name(req.getName())
                .description(req.getDescription())
                .sourcePath(req.getSourcePath())
                .containerPort(req.getContainerPort())
                .replicas(req.getReplicas())
                .deploymentStatus(DeploymentStatus.NOT_DEPLOYED)
                .dockerImage(K8sNameUtil.imageName(req.getName()))
                .k8sDeploymentName(K8sNameUtil.deploymentName(req.getName()))
                .k8sServiceName(K8sNameUtil.serviceName(req.getName()))
                .k8sNamespace(defaultNamespace)
                .build();

        Application saved = applicationRepository.save(app);
        log.info("Created application: {} ({}) in workspace {}", saved.getName(), saved.getId(), workspaceId);
        return ApplicationResponse.from(saved);
    }

    public ApplicationResponse update(UUID id, UpdateApplicationRequest req) {
        Application app = findOrThrow(id);

        if (req.getDescription() != null) {
            app.setDescription(req.getDescription());
        }
        if (req.getSourcePath() != null) {
            validateSourcePath(req.getSourcePath());
            app.setSourcePath(req.getSourcePath());
        }
        if (req.getContainerPort() != null) {
            app.setContainerPort(req.getContainerPort());
        }
        if (req.getReplicas() != null) {
            app.setReplicas(req.getReplicas());
        }

        Application saved = applicationRepository.save(app);
        log.info("Updated application: {} ({})", saved.getName(), saved.getId());
        return ApplicationResponse.from(saved);
    }

    public void delete(UUID id) {
        Application app = findOrThrow(id);
        log.info("Deleting application: {} ({})", app.getName(), app.getId());
        // K8s cleanup is handled in DeploymentService — called by the controller
        applicationRepository.delete(app);
    }

    // ── Status helpers ───────────────────────────────────────────────────────

    public void updateStatus(UUID id, DeploymentStatus status) {
        Application app = findOrThrow(id);
        app.setDeploymentStatus(status);
        applicationRepository.save(app);
    }

    public void updateStatusAndLog(UUID id, DeploymentStatus status, String buildLog) {
        Application app = findOrThrow(id);
        app.setDeploymentStatus(status);
        if (buildLog != null) {
            // Truncate log to 10k chars to avoid unbounded DB growth
            app.setBuildLog(buildLog.length() > 10_000
                    ? buildLog.substring(buildLog.length() - 10_000)
                    : buildLog);
        }
        applicationRepository.save(app);
    }

    public void updateServicePort(UUID id, int nodePort) {
        Application app = findOrThrow(id);
        app.setServicePort(nodePort);
        applicationRepository.save(app);
    }

    // ── Internal helper ───────────────────────────────────────────────────────

    public Application findOrThrow(UUID id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application", id));
    }

    private void validateSourcePath(String sourcePath) {
        if (sourcePath == null || sourcePath.isBlank()) {
            throw new BadRequestException("Source path is required");
        }
        Path p = Path.of(sourcePath).toAbsolutePath().normalize();
        if (!Files.exists(p)) {
            throw new BadRequestException("Source path does not exist: " + sourcePath);
        }
        if (!Files.isDirectory(p)) {
            throw new BadRequestException("Source path must be a directory: " + sourcePath);
        }
    }
}
