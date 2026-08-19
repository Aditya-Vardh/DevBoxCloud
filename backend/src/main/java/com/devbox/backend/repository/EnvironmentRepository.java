package com.devbox.backend.repository;

import com.devbox.backend.entity.Environment;
import com.devbox.backend.entity.EnvironmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EnvironmentRepository extends JpaRepository<Environment, UUID> {

    List<Environment> findByWorkspaceIdOrderByCreatedAtDesc(UUID workspaceId);

    boolean existsByWorkspaceIdAndName(UUID workspaceId, String name);

    Optional<Environment> findByWorkspaceIdAndName(UUID workspaceId, String name);

    List<Environment> findByStatus(EnvironmentStatus status);

    List<Environment> findByK8sNamespace(String namespace);
}
