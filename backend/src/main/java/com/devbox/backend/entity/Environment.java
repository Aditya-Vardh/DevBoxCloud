package com.devbox.backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * A running (or stopped) development workspace environment.
 * Provisioned from a Template — no source path or Dockerfile required.
 */
@Entity
@Table(name = "environments",
       uniqueConstraints = @UniqueConstraint(columnNames = {"workspace_id", "name"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Environment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    private Template template;

    /** Kubernetes-safe name (RFC 1123): lowercase alphanumeric + hyphens, 1-63 chars */
    @NotBlank
    @Size(min = 1, max = 63)
    @Pattern(regexp = "^[a-z0-9][a-z0-9\\-]*[a-z0-9]$|^[a-z0-9]$",
             message = "Name must be lowercase alphanumeric and hyphens only")
    @Column(name = "name", nullable = false, length = 63)
    private String name;

    @Size(max = 500)
    @Column(name = "description", length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private EnvironmentStatus status = EnvironmentStatus.PENDING;

    // ── Resource allocation ───────────────────────────────────────────────────

    @Column(name = "cpu_request", length = 20)
    private String cpuRequest;

    @Column(name = "memory_request", length = 20)
    private String memoryRequest;

    @Column(name = "storage_size", length = 20)
    private String storageSize;

    // ── Kubernetes resource identifiers ───────────────────────────────────────

    @Column(name = "k8s_namespace", length = 63)
    @Builder.Default
    private String k8sNamespace = "devbox";

    @Column(name = "k8s_deployment_name", length = 253)
    private String k8sDeploymentName;

    @Column(name = "k8s_service_name", length = 253)
    private String k8sServiceName;

    @Column(name = "k8s_pvc_name", length = 253)
    private String k8sPvcName;

    // ── Access ────────────────────────────────────────────────────────────────

    /** NodePort assigned to this environment's K8s Service */
    @Column(name = "node_port")
    private Integer nodePort;

    /**
     * Full URL the user can open in a browser to access their workspace.
     * Populated once the environment reaches RUNNING status.
     */
    @Column(name = "access_url", length = 512)
    private String accessUrl;

    // ── Audit ─────────────────────────────────────────────────────────────────

    @Column(name = "failure_reason", length = 1024)
    private String failureReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "stopped_at")
    private Instant stoppedAt;
}
