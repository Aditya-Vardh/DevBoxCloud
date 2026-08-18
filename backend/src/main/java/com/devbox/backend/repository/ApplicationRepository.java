package com.devbox.backend.repository;

import com.devbox.backend.entity.Application;
import com.devbox.backend.entity.DeploymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ApplicationRepository extends JpaRepository<Application, UUID> {

    List<Application> findByWorkspaceId(UUID workspaceId);

    boolean existsByWorkspaceIdAndName(UUID workspaceId, String name);

    Optional<Application> findByWorkspaceIdAndName(UUID workspaceId, String name);

    List<Application> findByDeploymentStatus(DeploymentStatus status);

    List<Application> findByK8sNamespace(String namespace);
}
