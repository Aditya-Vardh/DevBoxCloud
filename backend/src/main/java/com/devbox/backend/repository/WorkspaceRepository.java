package com.devbox.backend.repository;

import com.devbox.backend.entity.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkspaceRepository extends JpaRepository<Workspace, UUID> {

    boolean existsByName(String name);

    Optional<Workspace> findByName(String name);
}
