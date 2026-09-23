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
 * Seeds and keeps up-to-date the six built-in DevBox environment templates.
 *
 * All templates share devbox/workspace:latest — Ubuntu 24.04 with full polyglot toolchain.
 * The entrypoint starts nginx (port 8080), TigerVNC, XFCE, websockify, and ttyd.
 *
 * DEVBOX_ENV_NAME and DEVBOX_TEMPLATE_ID are injected at pod-creation time by
 * EnvironmentProvisioningService so the in-workspace experience is template-aware.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TemplateSeedData implements ApplicationRunner {

    private final TemplateRepository templateRepository;

    private static final String WORKSPACE_IMAGE = "devbox/workspace:latest";
    private static final String ENTRYPOINT_CMD  = "/usr/local/bin/devbox-entrypoint";
    private static final String BASE_ENV        = "DEBIAN_FRONTEND=noninteractive\nTERM=xterm-256color";

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Template> templates = List.of(

            Template.builder()
                .id("ubuntu")
                .displayName("Ubuntu Development")
                .description(
                    "Ubuntu 24.04 workspace with XFCE desktop, browser terminal, and a full " +
                    "Linux development toolchain: bash, curl, git, vim, build-essential, htop.")
                .image(WORKSPACE_IMAGE)
                .category("Ubuntu 24.04")
                .icon("🐧")
                .defaultCpu("500m").maxCpu("2000m")
                .defaultMemory("1Gi").maxMemory("4Gi")
                .defaultStorage("5Gi")
                .containerPort(8080)
                .installedTools("bash,curl,git,vim,nano,build-essential,htop,tree,jq,xfce4,tigervnc,novnc,ttyd")
                .envVars(BASE_ENV)
                .startupCommand(ENTRYPOINT_CMD)
                .quickStartCommands("uname -a\ngit --version\nbash --version\nls /workspace")
                .sortOrder(1)
                .build(),

            Template.builder()
                .id("python")
                .displayName("Python Development")
                .description(
                    "Python 3.12 workspace. Both python/python3 and pip/pip3 are available. " +
                    "Includes venv, virtualenv, git, and the full XFCE desktop.")
                .image(WORKSPACE_IMAGE)
                .category("Python 3.12")
                .icon("🐍")
                .defaultCpu("500m").maxCpu("2000m")
                .defaultMemory("1Gi").maxMemory("4Gi")
                .defaultStorage("5Gi")
                .containerPort(8080)
                .installedTools("python3,python,pip3,pip,venv,virtualenv,bash,curl,git,vim")
                .envVars(BASE_ENV + "\nPYTHONUNBUFFERED=1")
                .startupCommand(ENTRYPOINT_CMD)
                .quickStartCommands(
                    "python3 --version\npip3 --version\npython3 -m venv .venv\n" +
                    "source .venv/bin/activate\ngit --version")
                .sortOrder(2)
                .build(),

            Template.builder()
                .id("nodejs")
                .displayName("Node.js Development")
                .description(
                    "Node.js 20 LTS workspace with npm and npx. Use npm to install packages " +
                    "and run scripts. Full XFCE desktop and browser terminal included.")
                .image(WORKSPACE_IMAGE)
                .category("Node.js 20 LTS")
                .icon("🟩")
                .defaultCpu("500m").maxCpu("2000m")
                .defaultMemory("1Gi").maxMemory("4Gi")
                .defaultStorage("5Gi")
                .containerPort(8080)
                .installedTools("node,npm,npx,bash,curl,git,vim")
                .envVars(BASE_ENV + "\nNODE_ENV=development")
                .startupCommand(ENTRYPOINT_CMD)
                .quickStartCommands(
                    "node --version\nnpm --version\nnpx --version\n" +
                    "npm init -y\nnpm install express")
                .sortOrder(3)
                .build(),

            Template.builder()
                .id("java")
                .displayName("Java Development")
                .description(
                    "OpenJDK 21 workspace with javac, Maven (mvn), and Gradle. " +
                    "Full XFCE desktop and browser terminal.")
                .image(WORKSPACE_IMAGE)
                .category("Java 21 / Maven / Gradle")
                .icon("☕")
                .defaultCpu("500m").maxCpu("2000m")
                .defaultMemory("1Gi").maxMemory("4Gi")
                .defaultStorage("5Gi")
                .containerPort(8080)
                .installedTools("java,javac,mvn,gradle,bash,curl,git,vim")
                .envVars(BASE_ENV + "\nJAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64")
                .startupCommand(ENTRYPOINT_CMD)
                .quickStartCommands(
                    "java --version\njavac --version\nmvn --version\ngradle --version\n" +
                    "mvn archetype:generate -DgroupId=com.example -DartifactId=myapp")
                .sortOrder(4)
                .build(),

            Template.builder()
                .id("react")
                .displayName("React Development")
                .description(
                    "Node.js 20 LTS workspace for React and Vite projects. " +
                    "Use npx to scaffold new apps. Full XFCE desktop and browser terminal.")
                .image(WORKSPACE_IMAGE)
                .category("React / Vite / TypeScript")
                .icon("⚛️")
                .defaultCpu("500m").maxCpu("2000m")
                .defaultMemory("1Gi").maxMemory("4Gi")
                .defaultStorage("5Gi")
                .containerPort(8080)
                .installedTools("node,npm,npx,bash,curl,git,vim")
                .envVars(BASE_ENV + "\nNODE_ENV=development")
                .startupCommand(ENTRYPOINT_CMD)
                .quickStartCommands(
                    "node --version\nnpm --version\n" +
                    "npm create vite@latest my-app -- --template react\n" +
                    "npx create-react-app my-app")
                .sortOrder(5)
                .build(),

            Template.builder()
                .id("fullstack")
                .displayName("Full Stack Development")
                .description(
                    "Polyglot workspace: Node.js 20, Python 3.12, OpenJDK 21, Maven, Gradle, " +
                    "PostgreSQL client, and Docker CLI. Ideal for multi-language projects.")
                .image(WORKSPACE_IMAGE)
                .category("Multi-language")
                .icon("🚀")
                .defaultCpu("1000m").maxCpu("2000m")
                .defaultMemory("1Gi").maxMemory("4Gi")
                .defaultStorage("5Gi")
                .containerPort(8080)
                .installedTools("node,npm,python3,pip3,java,javac,mvn,gradle,psql,docker,bash,curl,git")
                .envVars(BASE_ENV
                    + "\nNODE_ENV=development\nPYTHONUNBUFFERED=1"
                    + "\nJAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64")
                .startupCommand(ENTRYPOINT_CMD)
                .quickStartCommands(
                    "node --version\npython3 --version\njava --version\nmvn --version\npsql --version")
                .sortOrder(6)
                .build()
        );

        int inserted = 0, updated = 0;
        for (Template t : templates) {
            if (!templateRepository.existsById(t.getId())) {
                templateRepository.save(t);
                inserted++;
            } else {
                Template x = templateRepository.findById(t.getId()).get();
                boolean changed = false;
                if (!t.getImage().equals(x.getImage()))             { x.setImage(t.getImage());                     changed = true; }
                if (!t.getDisplayName().equals(x.getDisplayName())) { x.setDisplayName(t.getDisplayName());         changed = true; }
                if (!t.getDescription().equals(x.getDescription())) { x.setDescription(t.getDescription());         changed = true; }
                if (!t.getCategory().equals(x.getCategory()))       { x.setCategory(t.getCategory());               changed = true; }
                if (!t.getInstalledTools().equals(x.getInstalledTools())) { x.setInstalledTools(t.getInstalledTools()); changed = true; }
                if (t.getContainerPort() != x.getContainerPort())   { x.setContainerPort(t.getContainerPort());     changed = true; }
                if (t.getStartupCommand() != null && !t.getStartupCommand().equals(x.getStartupCommand())) { x.setStartupCommand(t.getStartupCommand()); changed = true; }
                if (t.getEnvVars() != null && !t.getEnvVars().equals(x.getEnvVars())) { x.setEnvVars(t.getEnvVars()); changed = true; }
                if (t.getSortOrder() != x.getSortOrder())           { x.setSortOrder(t.getSortOrder());             changed = true; }
                // Always sync quick-start commands
                if (t.getQuickStartCommands() != null
                        && !t.getQuickStartCommands().equals(x.getQuickStartCommands())) {
                    x.setQuickStartCommands(t.getQuickStartCommands()); changed = true;
                }
                if (changed) { templateRepository.save(x); updated++; }
            }
        }
        if (inserted > 0) log.info("Seeded {} template(s)", inserted);
        if (updated  > 0) log.info("Updated {} template(s)", updated);
        if (inserted == 0 && updated == 0) log.debug("All {} templates up-to-date", templates.size());
    }
}
