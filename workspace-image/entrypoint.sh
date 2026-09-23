#!/usr/bin/env bash
# DevBox workspace entrypoint.
# Starts: TigerVNC → XFCE4 desktop, websockify, ttyd terminal, nginx gateway.
# Template identity is passed via Kubernetes env vars by EnvironmentProvisioningService.
set -Eeuo pipefail

DESKTOP_WIDTH="${DESKTOP_WIDTH:-1280}"
DESKTOP_HEIGHT="${DESKTOP_HEIGHT:-720}"
DISPLAY_NUM="${VNC_DISPLAY_NUM:-1}"
VNC_DISPLAY=":${DISPLAY_NUM}"
VNC_PORT="${VNC_PORT:-5901}"
NOVNC_PORT="${NOVNC_PORT:-6080}"
TTYD_PORT="${TTYD_PORT:-7681}"

# Template identity — injected by Kubernetes at pod creation
DEVBOX_ENV_NAME="${DEVBOX_ENV_NAME:-workspace}"
DEVBOX_TEMPLATE_NAME="${DEVBOX_TEMPLATE_NAME:-DevBox}"
DEVBOX_TEMPLATE_ID="${DEVBOX_TEMPLATE_ID:-ubuntu}"

WEBSOCKIFY_PID=""
TTYD_PID=""
NGINX_PID=""

# ── Home directory ────────────────────────────────────────────────────────────
export HOME=/tmp/devbox-home
export USER=devuser
export DISPLAY="${VNC_DISPLAY}"
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export TERM=xterm-256color
export XDG_RUNTIME_DIR=/tmp/xdg-runtime-devuser

mkdir -p \
    "${HOME}/.config" \
    "${HOME}/.vnc" \
    "${HOME}/.local/share" \
    /tmp/.X11-unix \
    /workspace \
    "${XDG_RUNTIME_DIR}" \
    /var/lib/devbox
chmod 1777 /tmp/.X11-unix
chmod 0700 "${XDG_RUNTIME_DIR}"
chown -R devuser:devuser "${HOME}" "${XDG_RUNTIME_DIR}" /workspace 2>/dev/null || true

# ── Write ~/.bashrc ───────────────────────────────────────────────────────────
# The welcome banner and tool detection run entirely at bash startup time.
# We embed DEVBOX_TEMPLATE_ID as a literal so the generated .bashrc is
# self-contained and does not depend on the outer entrypoint environment.

cat > "${HOME}/.bashrc" << BASHRC_EOF
# DevBox workspace shell — template: ${DEVBOX_TEMPLATE_ID}
export HOME=/tmp/devbox-home
export USER=devuser
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export TERM=xterm-256color
export XDG_RUNTIME_DIR=/tmp/xdg-runtime-devuser
export DEVBOX_ENV_NAME="${DEVBOX_ENV_NAME}"
export DEVBOX_TEMPLATE_NAME="${DEVBOX_TEMPLATE_NAME}"
export DEVBOX_TEMPLATE_ID="${DEVBOX_TEMPLATE_ID}"

# Java home (no-op if not installed)
if [ -d /usr/lib/jvm/java-21-openjdk-amd64 ]; then
    export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
    export PATH="\${JAVA_HOME}/bin:\${PATH}"
fi

# Python convenience aliases — only add if not already present
command -v python  &>/dev/null || { command -v python3 &>/dev/null && alias python='python3'; }
command -v pip     &>/dev/null || { command -v pip3    &>/dev/null && alias pip='pip3';       }

# Shell history
HISTSIZE=5000
HISTFILESIZE=10000
HISTCONTROL=ignoreboth:erasedups
HISTTIMEFORMAT="%F %T "
shopt -s histappend checkwinsize
CDPATH=.:~:/workspace

# ── Prompt ────────────────────────────────────────────────────────────────────
# Color is template-specific — embedded as a literal ANSI code number.
_DEVBOX_PROMPT_COLOR="${DEVBOX_TEMPLATE_ID}"
case "\${_DEVBOX_PROMPT_COLOR}" in
    python)    _PC='33' ;;  # yellow
    nodejs)    _PC='32' ;;  # green
    java)      _PC='31' ;;  # red
    react)     _PC='36' ;;  # cyan
    fullstack) _PC='35' ;;  # magenta
    *)         _PC='34' ;;  # blue (ubuntu default)
esac

_devbox_prompt() {
    local rc=\$?
    local branch=""
    if command -v git &>/dev/null; then
        branch=\$(git -C "\${PWD}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
        [ -n "\${branch}" ] && branch=" \033[0;33m(\${branch})\033[0m"
    fi
    local pwd_short="\${PWD/#\${HOME}/~}"
    PS1="\[\033[1;32m\]devuser\[\033[0m\]@\[\033[1;\${_PC}m\]\${DEVBOX_TEMPLATE_ID}\[\033[0m\]:\[\033[0;36m\]\${pwd_short}\[\033[0m\]\${branch}\\\$ "
    return \$rc
}
PROMPT_COMMAND='_devbox_prompt'

# ── Aliases ───────────────────────────────────────────────────────────────────
alias ls='ls --color=auto'
alias ll='ls -lah --color=auto'
alias la='ls -A --color=auto'
alias grep='grep --color=auto'
alias workspace='cd /workspace'

# ── Welcome banner ────────────────────────────────────────────────────────────
# Runs once per session. All tool detection happens HERE at bash startup time,
# so the version output is always real and current.
if [ -z "\${DEVBOX_WELCOME_SHOWN:-}" ]; then
    export DEVBOX_WELCOME_SHOWN=1

    # Pick border color based on template
    case "\${DEVBOX_TEMPLATE_ID}" in
        python)    _BC='33' ;;
        nodejs)    _BC='32' ;;
        java)      _BC='31' ;;
        react)     _BC='36' ;;
        fullstack) _BC='35' ;;
        *)         _BC='34' ;;
    esac

    printf '\n'
    printf '\033[1;%sm  ╭──────────────────────────────────────────╮\033[0m\n' "\${_BC}"
    printf '\033[1;%sm  │  DevBox %-32s│\033[0m\n' "\${_BC}" "\${DEVBOX_TEMPLATE_NAME}"
    printf '\033[1;%sm  ├──────────────────────────────────────────┤\033[0m\n' "\${_BC}"
    printf '  │  Workspace : %-27s│\n' "\${DEVBOX_ENV_NAME}"
    printf '  │  Directory : /workspace                    │\n'
    printf '\033[1;%sm  ├──────────────────────────────────────────┤\033[0m\n' "\${_BC}"
    printf '  │  Installed tools:                          │\n'

    # Tool detection — runs at bash startup time with real version output
    case "\${DEVBOX_TEMPLATE_ID}" in
        python)
            command -v python3   &>/dev/null && printf '  │  \033[0;32m✓\033[0m  python3   %-29s│\n' "\$(python3 --version 2>&1)"
            command -v pip3      &>/dev/null && printf '  │  \033[0;32m✓\033[0m  pip3      %-29s│\n' "\$(pip3 --version 2>&1 | cut -d' ' -f1-2)"
            command -v python    &>/dev/null && printf '  │  \033[0;32m✓\033[0m  python    → python3                      │\n'
            command -v pip       &>/dev/null && printf '  │  \033[0;32m✓\033[0m  pip       → pip3                         │\n'
            command -v git       &>/dev/null && printf '  │  \033[0;32m✓\033[0m  git       %-29s│\n' "\$(git --version 2>&1)"
            printf '\033[1;%sm  ├──────────────────────────────────────────┤\033[0m\n' "\${_BC}"
            printf '  │  Quick start:                              │\n'
            printf '  │  \033[0;36m$\033[0m python3 --version                        │\n'
            printf '  │  \033[0;36m$\033[0m python3 -c "print(\"Hello DevBox\")"       │\n'
            printf '  │  \033[0;36m$\033[0m pip3 --version                           │\n'
            printf '  │  \033[0;36m$\033[0m python3 -m venv .venv                    │\n'
            ;;
        nodejs)
            command -v node      &>/dev/null && printf '  │  \033[0;32m✓\033[0m  node      %-29s│\n' "\$(node --version 2>&1)"
            command -v npm       &>/dev/null && printf '  │  \033[0;32m✓\033[0m  npm       %-29s│\n' "\$(npm --version 2>&1)"
            command -v npx       &>/dev/null && printf '  │  \033[0;32m✓\033[0m  npx       %-29s│\n' "\$(npx --version 2>&1)"
            command -v git       &>/dev/null && printf '  │  \033[0;32m✓\033[0m  git       %-29s│\n' "\$(git --version 2>&1)"
            printf '\033[1;%sm  ├──────────────────────────────────────────┤\033[0m\n' "\${_BC}"
            printf '  │  Quick start:                              │\n'
            printf '  │  \033[0;36m$\033[0m node --version                           │\n'
            printf '  │  \033[0;36m$\033[0m node -e "console.log(\"Hello DevBox\")"   │\n'
            printf '  │  \033[0;36m$\033[0m npm --version                            │\n'
            printf '  │  \033[0;36m$\033[0m npm init -y                              │\n'
            ;;
        java)
            command -v java      &>/dev/null && printf '  │  \033[0;32m✓\033[0m  java      %-29s│\n' "\$(java --version 2>&1 | head -1)"
            command -v javac     &>/dev/null && printf '  │  \033[0;32m✓\033[0m  javac     %-29s│\n' "\$(javac --version 2>&1)"
            command -v mvn       &>/dev/null && printf '  │  \033[0;32m✓\033[0m  maven     %-29s│\n' "\$(mvn --version 2>&1 | head -1 | cut -c1-28)"
            command -v gradle    &>/dev/null && printf '  │  \033[0;32m✓\033[0m  gradle    %-29s│\n' "\$(gradle --version 2>&1 | grep '^Gradle' | head -1)"
            command -v git       &>/dev/null && printf '  │  \033[0;32m✓\033[0m  git       %-29s│\n' "\$(git --version 2>&1)"
            printf '\033[1;%sm  ├──────────────────────────────────────────┤\033[0m\n' "\${_BC}"
            printf '  │  Quick start:                              │\n'
            printf '  │  \033[0;36m$\033[0m java --version                           │\n'
            printf '  │  \033[0;36m$\033[0m javac --version                          │\n'
            printf '  │  \033[0;36m$\033[0m mvn --version                            │\n'
            printf '  │  \033[0;36m$\033[0m mkdir myapp && cd myapp                  │\n'
            ;;
        react)
            command -v node      &>/dev/null && printf '  │  \033[0;32m✓\033[0m  node      %-29s│\n' "\$(node --version 2>&1)"
            command -v npm       &>/dev/null && printf '  │  \033[0;32m✓\033[0m  npm       %-29s│\n' "\$(npm --version 2>&1)"
            command -v npx       &>/dev/null && printf '  │  \033[0;32m✓\033[0m  npx       %-29s│\n' "\$(npx --version 2>&1)"
            command -v git       &>/dev/null && printf '  │  \033[0;32m✓\033[0m  git       %-29s│\n' "\$(git --version 2>&1)"
            printf '\033[1;%sm  ├──────────────────────────────────────────┤\033[0m\n' "\${_BC}"
            printf '  │  Quick start:                              │\n'
            printf '  │  \033[0;36m$\033[0m node --version                           │\n'
            printf '  │  \033[0;36m$\033[0m npm create vite@latest my-app            │\n'
            printf '  │  \033[0;36m$\033[0m cd my-app && npm install                 │\n'
            printf '  │  \033[0;36m$\033[0m npm run dev                              │\n'
            ;;
        fullstack)
            command -v node      &>/dev/null && printf '  │  \033[0;32m✓\033[0m  node      %-29s│\n' "\$(node --version 2>&1)"
            command -v python3   &>/dev/null && printf '  │  \033[0;32m✓\033[0m  python3   %-29s│\n' "\$(python3 --version 2>&1)"
            command -v java      &>/dev/null && printf '  │  \033[0;32m✓\033[0m  java      %-29s│\n' "\$(java --version 2>&1 | head -1)"
            command -v mvn       &>/dev/null && printf '  │  \033[0;32m✓\033[0m  mvn       %-29s│\n' "\$(mvn --version 2>&1 | head -1 | cut -c1-28)"
            command -v psql      &>/dev/null && printf '  │  \033[0;32m✓\033[0m  psql      %-29s│\n' "\$(psql --version 2>&1)"
            command -v docker    &>/dev/null && printf '  │  \033[0;32m✓\033[0m  docker    %-29s│\n' "\$(docker --version 2>&1 | cut -d',' -f1)"
            command -v git       &>/dev/null && printf '  │  \033[0;32m✓\033[0m  git       %-29s│\n' "\$(git --version 2>&1)"
            printf '\033[1;%sm  ├──────────────────────────────────────────┤\033[0m\n' "\${_BC}"
            printf '  │  Quick start:                              │\n'
            printf '  │  \033[0;36m$\033[0m node --version && python3 --version      │\n'
            printf '  │  \033[0;36m$\033[0m java --version && mvn --version          │\n'
            printf '  │  \033[0;36m$\033[0m psql --version                           │\n'
            ;;
        *)  # ubuntu
            command -v bash      &>/dev/null && printf '  │  \033[0;32m✓\033[0m  bash      %-29s│\n' "\$(bash --version 2>&1 | head -1 | cut -c1-28)"
            command -v git       &>/dev/null && printf '  │  \033[0;32m✓\033[0m  git       %-29s│\n' "\$(git --version 2>&1)"
            command -v python3   &>/dev/null && printf '  │  \033[0;32m✓\033[0m  python3   %-29s│\n' "\$(python3 --version 2>&1)"
            command -v curl      &>/dev/null && printf '  │  \033[0;32m✓\033[0m  curl      %-29s│\n' "\$(curl --version 2>&1 | head -1 | cut -c1-28)"
            command -v vim       &>/dev/null && printf '  │  \033[0;32m✓\033[0m  vim       %-29s│\n' "\$(vim --version 2>&1 | head -1 | cut -c1-28)"
            printf '\033[1;%sm  ├──────────────────────────────────────────┤\033[0m\n' "\${_BC}"
            printf '  │  Quick start:                              │\n'
            printf '  │  \033[0;36m$\033[0m uname -a                                 │\n'
            printf '  │  \033[0;36m$\033[0m git --version                            │\n'
            printf '  │  \033[0;36m$\033[0m ls /workspace                            │\n'
            ;;
    esac

    printf '\033[1;%sm  ╰──────────────────────────────────────────╯\033[0m\n' "\${_BC}"
    printf '\n'
fi

BASHRC_EOF

# ── .bash_profile and .profile ────────────────────────────────────────────────
cat > "${HOME}/.bash_profile" << 'BASH_PROFILE_EOF'
[ -f "$HOME/.bashrc" ] && source "$HOME/.bashrc"
BASH_PROFILE_EOF

cat > "${HOME}/.profile" << 'PROFILE_EOF'
[ -f "$HOME/.bashrc" ] && source "$HOME/.bashrc"
PROFILE_EOF

# ── VNC xstartup ─────────────────────────────────────────────────────────────
cat > "${HOME}/.vnc/xstartup" << 'XSTARTUP_EOF'
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
export HOME=/tmp/devbox-home
export XDG_RUNTIME_DIR=/tmp/xdg-runtime-devuser
mkdir -p "$XDG_RUNTIME_DIR"
chmod 0700 "$XDG_RUNTIME_DIR"
exec dbus-launch --exit-with-session startxfce4
XSTARTUP_EOF
chmod +x "${HOME}/.vnc/xstartup"

# ── XFCE terminal defaults ────────────────────────────────────────────────────
mkdir -p "${HOME}/.config/xfce4/terminal"
cat > "${HOME}/.config/xfce4/terminal/terminalrc" << 'TERMRC_EOF'
[Configuration]
BackgroundColor=#0f172a
ForegroundColor=#e2e8f0
ColorCursor=#60a5fa
FontName=Monospace 12
MiscDefaultGeometry=120x36
ScrollingLines=10000
ShortcutsNoMnemonics=TRUE
WorkingDirectory=/workspace
TERMRC_EOF

# ── Generate workspace landing page ──────────────────────────────────────────
# This is the HTML page served at / by nginx.
# It identifies the template, shows tool versions (via SSI-style static text
# since we can't run server-side scripts), and links to Terminal and Desktop.

mkdir -p /var/lib/devbox

# Pick theme colors per template
case "${DEVBOX_TEMPLATE_ID}" in
    python)    PG_COLOR="#2563eb"; PG_BG="#eff6ff"; PG_ICON="🐍"; PG_LANG="Python 3.12" ;;
    nodejs)    PG_COLOR="#16a34a"; PG_BG="#f0fdf4"; PG_ICON="🟩"; PG_LANG="Node.js 20 LTS" ;;
    java)      PG_COLOR="#dc2626"; PG_BG="#fef2f2"; PG_ICON="☕"; PG_LANG="OpenJDK 21 / Maven" ;;
    react)     PG_COLOR="#0891b2"; PG_BG="#ecfeff"; PG_ICON="⚛️"; PG_LANG="React / Vite / Node.js 20" ;;
    fullstack) PG_COLOR="#7c3aed"; PG_BG="#f5f3ff"; PG_ICON="🚀"; PG_LANG="Node · Python · Java · PostgreSQL" ;;
    *)         PG_COLOR="#ea580c"; PG_BG="#fff7ed"; PG_ICON="🐧"; PG_LANG="Ubuntu 24.04" ;;
esac

# Gather real tool versions for embedding in the landing page
PG_TOOLS=""
append_tool() {
    local name="$1" ver="$2"
    [ -n "$ver" ] && PG_TOOLS="${PG_TOOLS}<div class='tool'><span class='ok'>✓</span><span class='tname'>${name}</span><span class='tver'>${ver}</span></div>"
}

case "${DEVBOX_TEMPLATE_ID}" in
    python)
        append_tool "python3"  "$(python3 --version 2>&1 | tr -d '\n')"
        append_tool "pip3"     "$(pip3 --version 2>&1 | cut -d' ' -f1-2)"
        append_tool "venv"     "built-in"
        append_tool "git"      "$(git --version 2>&1 | tr -d '\n')"
        ;;
    nodejs)
        append_tool "node"     "$(node --version 2>&1 | tr -d '\n')"
        append_tool "npm"      "npm $(npm --version 2>&1 | tr -d '\n')"
        append_tool "npx"      "npx $(npx --version 2>&1 | tr -d '\n')"
        append_tool "git"      "$(git --version 2>&1 | tr -d '\n')"
        ;;
    java)
        append_tool "java"     "$(java --version 2>&1 | head -1 | tr -d '\n')"
        append_tool "javac"    "$(javac --version 2>&1 | tr -d '\n')"
        append_tool "maven"    "$(mvn --version 2>&1 | head -1 | cut -c1-32 | tr -d '\n')"
        append_tool "gradle"   "$(gradle --version 2>&1 | grep '^Gradle' | head -1 | tr -d '\n')"
        append_tool "git"      "$(git --version 2>&1 | tr -d '\n')"
        ;;
    react)
        append_tool "node"     "$(node --version 2>&1 | tr -d '\n')"
        append_tool "npm"      "npm $(npm --version 2>&1 | tr -d '\n')"
        append_tool "npx"      "npx $(npx --version 2>&1 | tr -d '\n')"
        append_tool "git"      "$(git --version 2>&1 | tr -d '\n')"
        ;;
    fullstack)
        append_tool "node"     "$(node --version 2>&1 | tr -d '\n')"
        append_tool "python3"  "$(python3 --version 2>&1 | tr -d '\n')"
        append_tool "java"     "$(java --version 2>&1 | head -1 | tr -d '\n')"
        append_tool "mvn"      "$(mvn --version 2>&1 | head -1 | cut -c1-28 | tr -d '\n')"
        append_tool "psql"     "$(psql --version 2>&1 | tr -d '\n')"
        append_tool "docker"   "$(docker --version 2>&1 | cut -d',' -f1 | tr -d '\n')"
        append_tool "git"      "$(git --version 2>&1 | tr -d '\n')"
        ;;
    *)
        append_tool "bash"     "$(bash --version 2>&1 | head -1 | cut -c1-28 | tr -d '\n')"
        append_tool "git"      "$(git --version 2>&1 | tr -d '\n')"
        append_tool "python3"  "$(python3 --version 2>&1 | tr -d '\n')"
        append_tool "curl"     "$(curl --version 2>&1 | head -1 | cut -c1-28 | tr -d '\n')"
        append_tool "vim"      "$(vim --version 2>&1 | head -1 | cut -c1-28 | tr -d '\n')"
        ;;
esac

cat > /var/lib/devbox/index.html << HTML_EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>DevBox — ${DEVBOX_TEMPLATE_NAME}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         background:#0f172a;color:#e2e8f0;min-height:100vh;
         display:flex;align-items:center;justify-content:center}
    .card{background:#1e293b;border:1px solid #334155;border-radius:16px;
          padding:36px 40px;max-width:560px;width:100%;
          box-shadow:0 20px 60px rgba(0,0,0,0.5)}
    .header{display:flex;align-items:center;gap:14px;margin-bottom:6px}
    .icon{font-size:36px;line-height:1}
    .brand{font-size:12px;font-weight:700;color:#64748b;
           text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px}
    .title{font-size:22px;font-weight:800;color:#f1f5f9;letter-spacing:-0.02em}
    .subtitle{font-size:13px;color:#94a3b8;margin-top:4px}
    .ws-row{display:flex;align-items:center;gap:8px;
            background:#0f172a;border:1px solid #1e3a5f;border-radius:8px;
            padding:10px 14px;margin:18px 0 20px}
    .ws-label{font-size:11px;font-weight:700;color:#64748b;
              text-transform:uppercase;letter-spacing:0.06em;flex-shrink:0}
    .ws-name{font-size:14px;font-weight:700;color:${PG_COLOR};font-family:monospace}
    .ws-dir{font-size:12px;color:#475569;font-family:monospace;margin-left:auto}
    .tools{margin-bottom:22px}
    .tools-title{font-size:11px;font-weight:700;color:#64748b;
                 text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px}
    .tool{display:flex;align-items:center;gap:8px;
          padding:6px 0;border-bottom:1px solid #1e293b}
    .tool:last-child{border-bottom:none}
    .ok{color:#4ade80;font-size:12px;flex-shrink:0;width:14px}
    .tname{font-family:monospace;font-size:12px;color:#cbd5e1;
           font-weight:600;flex-shrink:0;width:80px}
    .tver{font-family:monospace;font-size:11px;color:#64748b;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .btn{display:flex;align-items:center;justify-content:center;gap:8px;
         padding:13px 20px;border-radius:10px;font-weight:700;font-size:14px;
         text-decoration:none;border:none;cursor:pointer;transition:opacity 0.15s}
    .btn-terminal{background:${PG_COLOR};color:#fff}
    .btn-desktop{background:#1e293b;color:#cbd5e1;border:1px solid #334155}
    .btn:hover{opacity:0.85}
    .footer{margin-top:18px;font-size:11px;color:#475569;text-align:center}
    .dot{width:7px;height:7px;border-radius:50%;background:#4ade80;
         display:inline-block;margin-right:4px;
         animation:pulse 1.8s ease-in-out infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  </style>
</head>
<body>
<div class="card">
  <div class="header">
    <span class="icon">${PG_ICON}</span>
    <div>
      <div class="brand">DevBox Workspace</div>
      <div class="title">${DEVBOX_TEMPLATE_NAME}</div>
      <div class="subtitle">${PG_LANG}</div>
    </div>
  </div>

  <div class="ws-row">
    <span class="ws-label">Env</span>
    <span class="ws-name">${DEVBOX_ENV_NAME}</span>
    <span class="ws-dir">/workspace</span>
  </div>

  <div class="tools">
    <div class="tools-title"><span class="dot"></span>Installed &amp; verified</div>
    ${PG_TOOLS}
  </div>

  <div class="actions">
    <a href="/terminal/" class="btn btn-terminal">
      <span>💻</span> Open Terminal
    </a>
    <a href="/desktop/vnc.html?autoconnect=true&path=websockify" class="btn btn-desktop">
      <span>🖥</span> Open Desktop
    </a>
  </div>

  <div class="footer">
    Workspace data persists in /workspace across restarts
  </div>
</div>
</body>
</html>
HTML_EOF

# ── Cleanup handler ───────────────────────────────────────────────────────────
cleanup() {
    echo "[devbox] shutting down (env=${DEVBOX_ENV_NAME} template=${DEVBOX_TEMPLATE_ID})"
    vncserver -kill "${VNC_DISPLAY}" 2>/dev/null || true
    for _pid in "${NGINX_PID:-}" "${TTYD_PID:-}" "${WEBSOCKIFY_PID:-}"; do
        [ -n "${_pid:-}" ] && kill "${_pid}" 2>/dev/null || true
    done
    wait 2>/dev/null || true
}
trap cleanup TERM INT EXIT

# Remove stale VNC lock files (prevents "X :1 already in use" on restart)
rm -f "/tmp/.X${DISPLAY_NUM}-lock" "/tmp/.X11-unix/X${DISPLAY_NUM}" 2>/dev/null || true

# ── TigerVNC ──────────────────────────────────────────────────────────────────
echo "[devbox] starting TigerVNC on ${VNC_DISPLAY} (${DESKTOP_WIDTH}x${DESKTOP_HEIGHT}) template=${DEVBOX_TEMPLATE_ID}"
vncserver "${VNC_DISPLAY}" \
    -geometry "${DESKTOP_WIDTH}x${DESKTOP_HEIGHT}" \
    -depth 24 \
    -rfbport "${VNC_PORT}" \
    -localhost no \
    -securitytypes none \
    --I-KNOW-THIS-IS-INSECURE \
    -xstartup "${HOME}/.vnc/xstartup"

sleep 3

# ── websockify ────────────────────────────────────────────────────────────────
echo "[devbox] starting websockify 0.0.0.0:${NOVNC_PORT} -> 127.0.0.1:${VNC_PORT}"
python3 -m websockify \
    --web /usr/share/novnc \
    "0.0.0.0:${NOVNC_PORT}" \
    "127.0.0.1:${VNC_PORT}" &
WEBSOCKIFY_PID=$!

# ── ttyd ──────────────────────────────────────────────────────────────────────
echo "[devbox] starting ttyd on 127.0.0.1:${TTYD_PORT}"
/usr/local/bin/ttyd \
    --port "${TTYD_PORT}" \
    --interface 127.0.0.1 \
    --writable \
    --client-option fontSize=14 \
    --client-option 'theme={"background":"#0f172a","foreground":"#e2e8f0","cursor":"#60a5fa","cursorAccent":"#0f172a","selection":"rgba(96,165,250,0.3)"}' \
    --cwd /workspace \
    bash --login &
TTYD_PID=$!

# ── nginx ─────────────────────────────────────────────────────────────────────
echo "[devbox] starting nginx on 0.0.0.0:8080"
nginx -g 'daemon off;' &
NGINX_PID=$!

echo "[devbox] workspace ready"
echo "[devbox]   workspace  -> http://0.0.0.0:8080/"
echo "[devbox]   terminal   -> http://0.0.0.0:8080/terminal/"
echo "[devbox]   desktop    -> http://0.0.0.0:8080/desktop/vnc.html"
echo "[devbox]   healthz    -> http://0.0.0.0:8080/healthz"
echo "[devbox]   env=${DEVBOX_ENV_NAME}  template=${DEVBOX_TEMPLATE_ID}"

wait -n "${WEBSOCKIFY_PID}" "${TTYD_PID}" "${NGINX_PID}" 2>/dev/null || true
echo "[devbox] a service exited — shutting down"
