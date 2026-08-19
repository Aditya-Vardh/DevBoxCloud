package com.devbox.backend.config;

import com.devbox.backend.entity.Template;
import com.devbox.backend.repository.TemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Seeds the 6 built-in environment templates on startup.
 *
 * All templates use devbox/workspace:latest — an Ubuntu 22.04 image with:
 *   - bash, curl, git, vim, wget, build-essential, openssh-client
 *   - ttyd (browser terminal server) on port 8080
 *
 * The startupCommand for every template is the ttyd invocation that binds
 * 0.0.0.0:8080, which is the port exposed by the Kubernetes Service and
 * the port the user's browser connects to via the NodePort access URL.
 *
 * Existing records are updated when the image or startupCommand changes,
 * so re-seeding on application restart picks up fixes automatically.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TemplateSeedData implements ApplicationRunner {

    private final TemplateRepository templateRepository;

    /**
     * The unified workspace image — built into Minikube via:
     *   minikube image build -t devbox/workspace:latest ./workspace-image/
     *
     * imagePullPolicy: IfNotPresent in the Deployment spec ensures Minikube
     * uses the locally built image without trying to pull from Docker Hub.
     */
    private static final String WORKSPACE_IMAGE = "devbox/workspace:latest";

    /**
     * ttyd command that starts the browser terminal.
     * Binds 0.0.0.0:8080 — required so the Kubernetes Service endpoint
     * can reach the container (127.0.0.1 would be unreachable from outside the pod).
     * --writable allows the user to type in the terminal.
     */
    private static final String TTYD_CMD =
            "/usr/local/bin/ttyd --port 8080 --interface 0.0.0.0 --writable " +
            "--client-option fontSize=14 " +
            "--client-option \"theme={\\\"background\\\":\\\"#1e1e1e\\\",\\\"foreground\\\":\\\"#d4d4d4\\\"}\" " +
            "/bin/bash";

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Template> templates = List.of(

            Template.builder()
                .id("ubuntu")
                .displayName("Ubuntu Development")
                .description("General-purpose Ubuntu 22.04 workspace. Includes bash, curl, git, vim, " +
                             "wget, and build-essential. Browser terminal on port 8080.")
                .image(WORKSPACE_IMAGE)
                .category("Linux / Ubuntu")
                .icon("🐧")
                .defaultCpu("250m").maxCpu("1000m")
                .defaultMemory("512Mi").maxMemory("2Gi")
                .defaultStorage("2Gi")
                .containerPort(8080)
                .installedTools("bash,curl,git,vim,wget,build-essential,openssh-client")
                .envVars("DEBIAN_FRONTEND=noninteractive\nTERM=xterm-256color")
                .startupCommand(TTYD_CMD)
                .sortOrder(1)
                .build(),

            Template.builder()
                .id("python")
                .displayName("Python Development")
                .description("Ubuntu 22.04 workspace with Python 3 and pip pre-installed. " +
                             "Browser terminal on port 8080. Run pip install inside the workspace.")
                .image(WORKSPACE_IMAGE)
                .category("Python")
                .icon("🐍")
                .defaultCpu("250m").maxCpu("1000m")
                .defaultMemory("512Mi").maxMemory("2Gi")
                .defaultStorage("2Gi")
                .containerPort(8080)
                .installedTools("bash,curl,git,vim,python3,pip3")
                .envVars("DEBIAN_FRONTEND=noninteractive\nTERM=xterm-256color\nPYTHONUNBUFFERED=1")
                .startupCommand(TTYD_CMD)
                .sortOrder(2)
                .build(),

            Template.builder()
                .id("nodejs")
                .displayName("Node.js Development")
                .description("Ubuntu 22.04 workspace with Node.js 20 LTS and npm. " +
                             "Browser terminal on port 8080.")
                .image(WORKSPACE_IMAGE)
                .category("Node.js 20 LTS")
                .icon("🟩")
                .defaultCpu("250m").maxCpu("1000m")
                .defaultMemory("512Mi").maxMemory("2Gi")
                .defaultStorage("2Gi")
                .containerPort(8080)
                .installedTools("bash,curl,git,vim,node,npm,npx")
                .envVars("DEBIAN_FRONTEND=noninteractive\nTERM=xterm-256color\nNODE_ENV=development")
                .startupCommand(TTYD_CMD)
                .sortOrder(3)
                .build(),

            Template.builder()
                .id("java")
                .displayName("Java Development")
                .description("Ubuntu 22.04 workspace with OpenJDK 21 and Maven. " +
                             "Browser terminal on port 8080.")
                .image(WORKSPACE_IMAGE)
                .category("Java 21")
                .icon("☕")
                .defaultCpu("500m").maxCpu("2000m")
                .defaultMemory("1Gi").maxMemory("4Gi")
                .defaultStorage("3Gi")
                .containerPort(8080)
                .installedTools("bash,curl,git,vim,java,mvn")
                .envVars("DEBIAN_FRONTEND=noninteractive\nTERM=xterm-256color")
                .startupCommand(TTYD_CMD)
                .sortOrder(4)
                .build(),

            Template.builder()
                .id("react")
                .displayName("React Development")
                .description("Ubuntu 22.04 workspace with Node.js 20 and Vite for React/TypeScript. " +
                             "Browser terminal on port 8080.")
                .image(WORKSPACE_IMAGE)
                .category("React / TypeScript")
                .icon("⚛️")
                .defaultCpu("250m").maxCpu("1000m")
                .defaultMemory("768Mi").maxMemory("2Gi")
                .defaultStorage("2Gi")
                .containerPort(8080)
                .installedTools("bash,curl,git,vim,node,npm,npx")
                .envVars("DEBIAN_FRONTEND=noninteractive\nTERM=xterm-256color\nNODE_ENV=development")
                .startupCommand(TTYD_CMD)
                .sortOrder(5)
                .build(),

            Template.builder()
                .id("fullstack")
                .displayName("Full Stack Development")
                .description("Ubuntu 22.04 workspace with Node.js 20, Python 3, Git, and common build " +
                             "tools for polyglot development. Browser terminal on port 8080.")
                .image(WORKSPACE_IMAGE)
                .category("Multi-language")
                .icon("🚀")
                .defaultCpu("500m").maxCpu("2000m")
                .defaultMemory("1Gi").maxMemory("4Gi")
                .defaultStorage("5Gi")
                .containerPort(8080)
                .installedTools("bash,curl,git,vim,wget,build-essential,python3,pip3,node,npm")
                .envVars("DEBIAN_FRONTEND=noninteractive\nTERM=xterm-256color\nNODE_ENV=development\nPYTHONUNBUFFERED=1")
                .startupCommand(TTYD_CMD)
                .sortOrder(6)
                .build()
        );

        int inserted = 0;
        int updated = 0;
        for (Template t : templates) {
            if (!templateRepository.existsById(t.getId())) {
                templateRepository.save(t);
                inserted++;
            } else {
                // Always update image and startupCommand so fixes propagate on restart
                Template existing = templateRepository.findById(t.getId()).get();
                boolean changed = false;
                if (!t.getImage().equals(existing.getImage())) {
                    existing.setImage(t.getImage());
                    changed = true;
                }
                String newCmd = t.getStartupCommand();
                String oldCmd = existing.getStartupCommand();
                if (newCmd != null && !newCmd.equals(oldCmd)) {
                    existing.setStartupCommand(newCmd);
                    changed = true;
                }
                if (changed) {
                    templateRepository.save(existing);
                    updated++;
                }
            }
        }
        if (inserted > 0) log.info("Seeded {} environment template(s)", inserted);
        if (updated > 0)  log.info("Updated {} environment template(s) (image/startupCommand)", updated);
    }
}
