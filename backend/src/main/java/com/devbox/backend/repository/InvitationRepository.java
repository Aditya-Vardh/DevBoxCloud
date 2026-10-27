package com.devbox.backend.repository;

import com.devbox.backend.entity.Invitation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InvitationRepository extends JpaRepository<Invitation, UUID> {

    Optional<Invitation> findByCode(String code);

    List<Invitation> findByEnvironmentIdOrderByCreatedAtDesc(UUID environmentId);

    void deleteByEnvironmentId(UUID environmentId);
}
