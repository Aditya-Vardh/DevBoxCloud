# DevBox Workspace Image
# Base: Ubuntu 22.04 — matches the existing "ubuntu" and "fullstack" templates.
# Provides: development tools + ttyd (browser terminal on :8080).
#
# ttyd is a minimal terminal-over-WebSocket server (<4 MB binary).
# It serves a full xterm.js terminal in the browser, giving users a real
# shell without requiring a heavyweight IDE to be installed.
#
# Port 8080 is the unified workspace access port used by all templates
# that need a browser UI. The container binds 0.0.0.0:8080.

FROM ubuntu:22.04

# Avoid interactive prompts during apt
ENV DEBIAN_FRONTEND=noninteractive
ENV TERM=xterm-256color

# ── System packages ───────────────────────────────────────────────────────────
RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    # Core dev tools (matching installedTools in TemplateSeedData)
    bash \
    curl \
    wget \
    git \
    vim \
    build-essential \
    openssh-client \
    # Runtime dependencies for ttyd
    libjson-c-dev \
    libwebsockets-dev \
    libssl-dev \
    # Useful extras for a dev workspace
    less \
    man-db \
    procps \
    ca-certificates \
    locales \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# ── Install ttyd ──────────────────────────────────────────────────────────────
# ttyd is a small (~3 MB) static binary — no build from source needed.
# We use the official GitHub release binary for amd64.
# Pin to 1.7.7 (latest stable as of mid-2025).
ARG TTYD_VERSION=1.7.7
RUN curl -fsSL \
    "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.x86_64" \
    -o /usr/local/bin/ttyd \
    && chmod +x /usr/local/bin/ttyd \
    && ttyd --version

# ── Workspace directory (matches PVC mount point) ────────────────────────────
RUN mkdir -p /workspace
WORKDIR /workspace

# ── Create a non-root user for the terminal session ──────────────────────────
RUN useradd -m -s /bin/bash -u 1000 devuser \
    && chown devuser:devuser /workspace

# ── Entrypoint ───────────────────────────────────────────────────────────────
# ttyd flags:
#   -p 8080          : listen on port 8080
#   -i 0.0.0.0       : bind all interfaces (required — 127.0.0.1 is NOT reachable from K8s)
#   -t fontSize=14   : sensible default font size
#   -t 'theme={"background":"#1e1e1e"}' : dark theme
#   /bin/bash        : the shell served to the browser
#
# We run as root so the shell has permission to install packages in the workspace.
# Users who need isolation should use the devuser account inside the terminal.
EXPOSE 8080

CMD ["/usr/local/bin/ttyd", \
     "--port", "8080", \
     "--interface", "0.0.0.0", \
     "--writable", \
     "--client-option", "fontSize=14", \
     "--client-option", "theme={\"background\":\"#1e1e1e\",\"foreground\":\"#d4d4d4\"}", \
     "/bin/bash"]
