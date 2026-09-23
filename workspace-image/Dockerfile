# DevBox Workspace Image
# Base: Ubuntu 24.04 LTS
#
# Provides a unified development environment for:
#   1. Ubuntu Development (XFCE desktop via noVNC, VNC, ttyd terminal)
#   2. Python Development (Python 3.12, pip, venv, virtualenv)
#   3. Node.js Development (Node.js 20 LTS, npm, npx)
#   4. Java Development (OpenJDK 21, javac, Maven, Gradle)
#   5. React Development (Node 20, npm, npx, Vite/TypeScript support)
#   6. Full Stack Development (Polyglot + PostgreSQL client + Docker CLI)

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TERM=xterm-256color
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# Bypass Docker Desktop's intercepting proxy for apt repositories
ENV no_proxy="archive.ubuntu.com,security.ubuntu.com,*.ubuntu.com,ppa.launchpad.net,github.com,*.github.com,objects.githubusercontent.com,raw.githubusercontent.com,nodesource.com,*.nodesource.com"
ENV NO_PROXY="archive.ubuntu.com,security.ubuntu.com,*.ubuntu.com,ppa.launchpad.net,github.com,*.github.com,objects.githubusercontent.com,raw.githubusercontent.com,nodesource.com,*.nodesource.com"

# Template identity — overridden at runtime via Kubernetes env vars
ENV DEVBOX_ENV_NAME="workspace"
ENV DEVBOX_TEMPLATE_NAME="DevBox"

# ── Core system packages & developer toolchains ─────────────────────────────
RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    bash \
    curl \
    wget \
    git \
    vim \
    nano \
    build-essential \
    openssh-client \
    ca-certificates \
    locales \
    procps \
    less \
    unzip \
    zip \
    htop \
    tree \
    jq \
    # Python 3.12 & environment tools
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    python3-setuptools \
    python3-wheel \
    virtualenv \
    # Java 21 JDK, Maven & Gradle
    openjdk-21-jdk-headless \
    maven \
    gradle \
    # Database client tools
    postgresql-client \
    # Docker CLI
    docker.io \
    # XFCE Desktop
    xfce4 \
    xfce4-goodies \
    xfce4-terminal \
    dbus-x11 \
    x11-xserver-utils \
    # VNC & noVNC
    tigervnc-standalone-server \
    novnc \
    # Nginx HTTP gateway
    nginx \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

# ── python / pip convenience aliases ─────────────────────────────────────────
# Provide `python` and `pip` as first-class commands pointing to python3/pip3.
# This does NOT replace the system python3; it simply adds the shorter aliases
# so developers can use either form without confusion.
RUN update-alternatives --install /usr/local/bin/python python /usr/bin/python3 10 \
    && update-alternatives --install /usr/local/bin/pip    pip   /usr/bin/pip3   10

# ── Install Node.js 20 LTS ──────────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && node -v \
    && npm -v \
    && rm -rf /var/lib/apt/lists/*

# ── Install ttyd ──────────────────────────────────────────────────────────────
ARG TTYD_VERSION=1.7.7
RUN curl -fsSL \
    "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.x86_64" \
    -o /usr/local/bin/ttyd \
    && chmod +x /usr/local/bin/ttyd \
    && ttyd --version

# ── Verify python websockify ─────────────────────────────────────────────────
RUN python3 -c "import websockify; print('websockify OK')"

# ── Verify key tool aliases work ──────────────────────────────────────────────
RUN python --version && pip --version

# ── Workspace directory ───────────────────────────────────────────────────────
RUN mkdir -p /workspace
WORKDIR /workspace

# ── Non-root user ─────────────────────────────────────────────────────────────
RUN useradd -m -s /bin/bash -u 10001 devuser \
    && chown devuser:devuser /workspace

# ── nginx directories + workspace landing dir writable by devuser ─────────────
RUN mkdir -p /run/nginx /var/log/nginx /var/lib/nginx/body /var/lib/devbox \
    && chown -R devuser:devuser /run/nginx /var/log/nginx /var/lib/nginx /var/lib/devbox

# ── Copy configuration ────────────────────────────────────────────────────────
COPY nginx.conf    /etc/nginx/nginx.conf
COPY entrypoint.sh /usr/local/bin/devbox-entrypoint
# Normalise line endings so the shebang works on Linux
RUN tr -d '\r' < /usr/local/bin/devbox-entrypoint \
        > /usr/local/bin/devbox-entrypoint.tmp \
    && mv /usr/local/bin/devbox-entrypoint.tmp /usr/local/bin/devbox-entrypoint \
    && chmod +x /usr/local/bin/devbox-entrypoint

EXPOSE 8080

USER devuser
ENTRYPOINT ["/usr/local/bin/devbox-entrypoint"]
