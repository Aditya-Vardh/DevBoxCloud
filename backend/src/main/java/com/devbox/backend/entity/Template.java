package com.devbox.backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.List;

/**
 * A prebuilt container image template users can choose when creating
 * a development environment. No source path or Dockerfile required.
 */
@Entity
@Table(name = "templates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Template {

    @Id
    @Column(name = "id", length = 63)
    private String id;  // e.g. "ubuntu", "python", "nodejs"

    @NotBlank
    @Size(max = 100)
    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Size(max = 500)
    @Column(name = "description", length = 500)
    private String description;

    /** Docker image pulled from a public registry — no local build needed */
    @NotBlank
    @Column(name = "image", nullable = false, length = 256)
    private String image;

    /** Short category label shown on the card, e.g. "Linux", "Python 3.12" */
    @Column(name = "category", length = 100)
    private String category;

    /** Emoji or icon identifier for the card UI */
    @Column(name = "icon", length = 10)
    private String icon;

    /** Default CPU request in Kubernetes format, e.g. "250m" */
    @Column(name = "default_cpu", length = 20)
    @Builder.Default
    private String defaultCpu = "250m";

    /** Maximum CPU limit */
    @Column(name = "max_cpu", length = 20)
    @Builder.Default
    private String maxCpu = "1000m";

    /** Default memory request, e.g. "512Mi" */
    @Column(name = "default_memory", length = 20)
    @Builder.Default
    private String defaultMemory = "512Mi";

    /** Maximum memory limit */
    @Column(name = "max_memory", length = 20)
    @Builder.Default
    private String maxMemory = "2Gi";

    /** Default PVC storage size, e.g. "1Gi" */
    @Column(name = "default_storage", length = 20)
    @Builder.Default
    private String defaultStorage = "1Gi";

    /** Primary port the workspace container exposes */
    @Column(name = "container_port")
    @Builder.Default
    private int containerPort = 8080;

    /**
     * Comma-separated list of tools pre-installed, e.g.
     * "bash,curl,git,vim,python3,pip"
     */
    @Column(name = "installed_tools", length = 500)
    private String installedTools;

    /** Extra environment variables injected at pod start, stored as KEY=VALUE\nKEY=VALUE */
    @Column(name = "env_vars", columnDefinition = "TEXT")
    private String envVars;

    /**
     * Shell command passed to /bin/sh -c to start the workspace server.
     * Must bind to 0.0.0.0:{containerPort}.
     * If blank the provisioning service falls back to the default startup command.
     */
    @Column(name = "startup_command", columnDefinition = "TEXT")
    private String startupCommand;

    /** Whether this template is selectable by users */
    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    /** Display ordering — lower = shown first */
    @Column(name = "sort_order")
    @Builder.Default
    private int sortOrder = 0;
}
