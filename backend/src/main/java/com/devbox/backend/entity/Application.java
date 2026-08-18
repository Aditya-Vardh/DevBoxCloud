package com.devbox.backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "applications",
       uniqueConstraints = @UniqueConstraint(columnNames = {"workspace_id", "name"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    /** RFC 1123 DNS-safe name — used as Kubernetes resource name */
    @NotBlank
    @Size(min = 1, max = 63)
    @Pattern(regexp = "^[a-z0-9][a-z0-9\\-]*[a-z0-9]$|^[a-z0-9]$",
             message = "Name must be lowercase alphanumeric and hyphens only (Kubernetes-safe)")
    @Column(name = "name", nullable = false, length = 63)
    private String name;

    @Size(max = 500)
    @Column(name = "description", length = 500)
    private String description;

    /** Path to the application source / Dockerfile directory on the host */
    @Column(name = "source_path", length = 1024)
    private String sourcePath;

    /** Docker image name (e.g. devbox/myapp:latest) */
    @Column(name = "docker_image", length = 256)
    private String dockerImage;

    /** Port the container exposes */
    @Min(1) @Max(65535)
    @Column(name = "container_port")
    @Builder.Default
    private int containerPort = 8080;

    /** NodePort assigned on the Kubernetes Service (30000-32767) */
    @Column(name = "service_port")
    private Integer servicePort;

    /** Desired replica count */
    @Min(0) @Max(50)
    @Column(name = "replicas")
    @Builder.Default
    private int replicas = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "deployment_status", nullable = false, length = 20)
    @Builder.Default
    private DeploymentStatus deploymentStatus = DeploymentStatus.NOT_DEPLOYED;

    /** Last build log (truncated) */
    @Column(name = "build_log", columnDefinition = "TEXT")
    private String buildLog;

    /** Name of the Kubernetes Deployment resource */
    @Column(name = "k8s_deployment_name", length = 253)
    private String k8sDeploymentName;

    /** Name of the Kubernetes Service resource */
    @Column(name = "k8s_service_name", length = 253)
    private String k8sServiceName;

    /** Kubernetes namespace this application lives in */
    @Column(name = "k8s_namespace", length = 63)
    @Builder.Default
    private String k8sNamespace = "devbox";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
