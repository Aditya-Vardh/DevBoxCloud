#!/usr/bin/env bash
# DevBox workspace entrypoint.
# Starts: TigerVNC -> XFCE4, websockify, ttyd, nginx.
# DEVBOX_TEMPLATE_ID is injected by Kubernetes via ConfigMap.
set -Eeuo pipefail

DESKTOP_WIDTH="${DESKTOP_WIDTH:-1280}"
DESKTOP_HEIGHT="${DESKTOP_HEIGHT:-720}"
DISPLAY_NUM="${VNC_DISPLAY_NUM:-1}"
VNC_DISPLAY=":${DISPLAY_NUM}"
VNC_PORT="${VNC_PORT:-5901}"
NOVNC_PORT="${NOVNC_PORT:-6080}"
TTYD_PORT="${TTYD_PORT:-7681}"

DEVBOX_ENV_NAME="${DEVBOX_ENV_NAME:-workspace}"
DEVBOX_TEMPLATE_NAME="${DEVBOX_TEMPLATE_NAME:-DevBox}"
DEVBOX_TEMPLATE_ID="${DEVBOX_TEMPLATE_ID:-ubuntu}"

WEBSOCKIFY_PID=""
TTYD_PID=""
NGINX_PID=""

# ── Home / runtime dirs ───────────────────────────────────────────────────────
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

# ── Template-specific colours and tool info ───────────────────────────────────
case "${DEVBOX_TEMPLATE_ID}" in
    python)    TMPL_COLOR="33"; TMPL_ICON="🐍" ;;
    nodejs)    TMPL_COLOR="32"; TMPL_ICON="🟩" ;;
    java)      TMPL_COLOR="31"; TMPL_ICON="☕" ;;
    react)     TMPL_COLOR="36"; TMPL_ICON="⚛" ;;
    fullstack) TMPL_COLOR="35"; TMPL_ICON="🚀" ;;
    *)         TMPL_COLOR="34"; TMPL_ICON="🐧" ;;   # ubuntu default
esac

# ── Write ~/.bashrc (all tool detection at bash startup time) ─────────────────
cat > "${HOME}/.bashrc" << BASHRC_EOF
export HOME=/tmp/devbox-home
export USER=devuser
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export TERM=xterm-256color
export XDG_RUNTIME_DIR=/tmp/xdg-runtime-devuser
export DEVBOX_ENV_NAME="${DEVBOX_ENV_NAME}"
export DEVBOX_TEMPLATE_NAME="${DEVBOX_TEMPLATE_NAME}"
export DEVBOX_TEMPLATE_ID="${DEVBOX_TEMPLATE_ID}"

if [ -d /usr/lib/jvm/java-21-openjdk-amd64 ]; then
    export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
    export PATH="\${JAVA_HOME}/bin:\${PATH}"
fi

command -v python  &>/dev/null || { command -v python3 &>/dev/null && alias python='python3'; }
command -v pip     &>/dev/null || { command -v pip3    &>/dev/null && alias pip='pip3';       }

HISTSIZE=5000
HISTFILESIZE=10000
HISTCONTROL=ignoreboth:erasedups
shopt -s histappend checkwinsize
CDPATH=.:~:/workspace

_devbox_prompt() {
    local rc=\$?
    local branch=""
    if command -v git &>/dev/null; then
        branch=\$(git -C "\${PWD}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
        [ -n "\${branch}" ] && branch=" \033[0;33m(\${branch})\033[0m"
    fi
    local pwd_short="\${PWD/#\${HOME}/~}"
    PS1="\[\033[1;32m\]devuser\[\033[0m\]@\[\033[1;${TMPL_COLOR}m\]${DEVBOX_TEMPLATE_ID}\[\033[0m\]:\[\033[0;36m\]\${pwd_short}\[\033[0m\]\${branch}\\\$ "
    return \$rc
}
PROMPT_COMMAND='_devbox_prompt'

alias ls='ls --color=auto'
alias ll='ls -lah --color=auto'
alias la='ls -A --color=auto'
alias grep='grep --color=auto'
alias workspace='cd /workspace'

if [ -z "\${DEVBOX_WELCOME_SHOWN:-}" ]; then
    export DEVBOX_WELCOME_SHOWN=1
    printf '\n'
    printf '\033[1;${TMPL_COLOR}m  ╭──────────────────────────────────────────╮\033[0m\n'
    printf '\033[1;${TMPL_COLOR}m  │  DevBox  %-32s│\033[0m\n' "${DEVBOX_TEMPLATE_NAME}"
    printf '\033[1;${TMPL_COLOR}m  ├──────────────────────────────────────────┤\033[0m\n'
    printf '  │  Workspace : %-27s│\n' "${DEVBOX_ENV_NAME}"
    printf '  │  Directory : /workspace                    │\n'
    printf '\033[1;${TMPL_COLOR}m  ├──────────────────────────────────────────┤\033[0m\n'
    printf '  │  Tools:                                    │\n'
    case "${DEVBOX_TEMPLATE_ID}" in
        python)
            command -v python3 &>/dev/null && printf '  │  \033[0;32m✓\033[0m  python3   %-29s│\n' "\$(python3 --version 2>&1)"
            command -v pip3    &>/dev/null && printf '  │  \033[0;32m✓\033[0m  pip3      %-29s│\n' "\$(pip3 --version 2>&1 | cut -d' ' -f1-2)"
            command -v git     &>/dev/null && printf '  │  \033[0;32m✓\033[0m  git       %-29s│\n' "\$(git --version 2>&1)"
            printf '\033[1;${TMPL_COLOR}m  ├──────────────────────────────────────────┤\033[0m\n'
            printf '  │  Quick start:                              │\n'
            printf '  │  \033[0;36m$\033[0m python3 --version                        │\n'
            printf '  │  \033[0;36m$\033[0m python3 -m venv .venv                    │\n'
            printf '  │  \033[0;36m$\033[0m pip3 install <package>                   │\n'
            ;;
        nodejs)
            command -v node &>/dev/null && printf '  │  \033[0;32m✓\033[0m  node      %-29s│\n' "\$(node --version 2>&1)"
            command -v npm  &>/dev/null && printf '  │  \033[0;32m✓\033[0m  npm       %-29s│\n' "\$(npm --version 2>&1)"
            command -v git  &>/dev/null && printf '  │  \033[0;32m✓\033[0m  git       %-29s│\n' "\$(git --version 2>&1)"
            printf '\033[1;${TMPL_COLOR}m  ├──────────────────────────────────────────┤\033[0m\n'
            printf '  │  Quick start:                              │\n'
            printf '  │  \033[0;36m$\033[0m node --version                           │\n'
            printf '  │  \033[0;36m$\033[0m npm init -y                              │\n'
            ;;
        java)
            command -v java    &>/dev/null && printf '  │  \033[0;32m✓\033[0m  java      %-29s│\n' "\$(java --version 2>&1 | head -1)"
            command -v javac   &>/dev/null && printf '  │  \033[0;32m✓\033[0m  javac     %-29s│\n' "\$(javac --version 2>&1)"
            command -v mvn     &>/dev/null && printf '  │  \033[0;32m✓\033[0m  maven     %-29s│\n' "\$(mvn --version 2>&1 | head -1 | cut -c1-28)"
            command -v gradle  &>/dev/null && printf '  │  \033[0;32m✓\033[0m  gradle    %-29s│\n' "\$(gradle --version 2>&1 | grep '^Gradle' | head -1)"
            command -v git     &>/dev/null && printf '  │  \033[0;32m✓\033[0m  git       %-29s│\n' "\$(git --version 2>&1)"
            printf '\033[1;${TMPL_COLOR}m  ├──────────────────────────────────────────┤\033[0m\n'
            printf '  │  Quick start:                              │\n'
            printf '  │  \033[0;36m$\033[0m java --version                           │\n'
            printf '  │  \033[0;36m$\033[0m mvn --version                            │\n'
            ;;
        react)
            command -v node &>/dev/null && printf '  │  \033[0;32m✓\033[0m  node      %-29s│\n' "\$(node --version 2>&1)"
            command -v npm  &>/dev/null && printf '  │  \033[0;32m✓\033[0m  npm       %-29s│\n' "\$(npm --version 2>&1)"
            command -v git  &>/dev/null && printf '  │  \033[0;32m✓\033[0m  git       %-29s│\n' "\$(git --version 2>&1)"
            printf '\033[1;${TMPL_COLOR}m  ├──────────────────────────────────────────┤\033[0m\n'
            printf '  │  Quick start:                              │\n'
            printf '  │  \033[0;36m$\033[0m npm create vite@latest my-app            │\n'
            printf '  │  \033[0;36m$\033[0m cd my-app && npm install && npm run dev  │\n'
            ;;
        fullstack)
            command -v node    &>/dev/null && printf '  │  \033[0;32m✓\033[0m  node      %-29s│\n' "\$(node --version 2>&1)"
            command -v python3 &>/dev/null && printf '  │  \033[0;32m✓\033[0m  python3   %-29s│\n' "\$(python3 --version 2>&1)"
            command -v java    &>/dev/null && printf '  │  \033[0;32m✓\033[0m  java      %-29s│\n' "\$(java --version 2>&1 | head -1)"
            command -v mvn     &>/dev/null && printf '  │  \033[0;32m✓\033[0m  mvn       %-29s│\n' "\$(mvn --version 2>&1 | head -1 | cut -c1-28)"
            command -v psql    &>/dev/null && printf '  │  \033[0;32m✓\033[0m  psql      %-29s│\n' "\$(psql --version 2>&1)"
            command -v docker  &>/dev/null && printf '  │  \033[0;32m✓\033[0m  docker    %-29s│\n' "\$(docker --version 2>&1 | cut -d',' -f1)"
            command -v git     &>/dev/null && printf '  │  \033[0;32m✓\033[0m  git       %-29s│\n' "\$(git --version 2>&1)"
            ;;
        *)
            command -v bash    &>/dev/null && printf '  │  \033[0;32m✓\033[0m  bash      %-29s│\n' "\$(bash --version 2>&1 | head -1 | cut -c1-28)"
            command -v git     &>/dev/null && printf '  │  \033[0;32m✓\033[0m  git       %-29s│\n' "\$(git --version 2>&1)"
            command -v python3 &>/dev/null && printf '  │  \033[0;32m✓\033[0m  python3   %-29s│\n' "\$(python3 --version 2>&1)"
            command -v curl    &>/dev/null && printf '  │  \033[0;32m✓\033[0m  curl      %-29s│\n' "\$(curl --version 2>&1 | head -1 | cut -c1-28)"
            printf '\033[1;${TMPL_COLOR}m  ├──────────────────────────────────────────┤\033[0m\n'
            printf '  │  Quick start:                              │\n'
            printf '  │  \033[0;36m$\033[0m uname -a                                 │\n'
            printf '  │  \033[0;36m$\033[0m ls /workspace                            │\n'
            ;;
    esac
    printf '\033[1;${TMPL_COLOR}m  ╰──────────────────────────────────────────╯\033[0m\n'
    printf '\n'
fi
BASHRC_EOF

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

# ── XFCE terminal config ──────────────────────────────────────────────────────
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
mkdir -p /var/lib/devbox

case "${DEVBOX_TEMPLATE_ID}" in
    python)    PAGE_COLOR="#2563eb"; PAGE_ICON="🐍"; PAGE_LANG="Python 3.12" ;;
    nodejs)    PAGE_COLOR="#16a34a"; PAGE_ICON="🟩"; PAGE_LANG="Node.js 20 LTS" ;;
    java)      PAGE_COLOR="#dc2626"; PAGE_ICON="☕"; PAGE_LANG="OpenJDK 21 / Maven / Gradle" ;;
    react)     PAGE_COLOR="#0891b2"; PAGE_ICON="⚛"; PAGE_LANG="React / Vite / Node.js 20" ;;
    fullstack) PAGE_COLOR="#7c3aed"; PAGE_ICON="🚀"; PAGE_LANG="Node · Python · Java · PostgreSQL" ;;
    *)         PAGE_COLOR="#ea580c"; PAGE_ICON="🐧"; PAGE_LANG="Ubuntu 24.04" ;;
esac

TOOL_HTML=""
add_tool() {
    local name="$1" ver="$2"
    [ -n "$ver" ] && TOOL_HTML="${TOOL_HTML}<div class='tool'><span class='ok'>✓</span><span class='tn'>${name}</span><span class='tv'>${ver}</span></div>"
}

case "${DEVBOX_TEMPLATE_ID}" in
    python)
        add_tool "python3"  "$(python3 --version 2>&1 | tr -d '\n')"
        add_tool "pip3"     "$(pip3 --version 2>&1 | cut -d' ' -f1-2)"
        add_tool "venv"     "built-in"
        add_tool "git"      "$(git --version 2>&1 | tr -d '\n')"
        ;;
    nodejs)
        add_tool "node"     "$(node --version 2>&1 | tr -d '\n')"
        add_tool "npm"      "npm $(npm --version 2>&1 | tr -d '\n')"
        add_tool "npx"      "npx $(npx --version 2>&1 | tr -d '\n')"
        add_tool "git"      "$(git --version 2>&1 | tr -d '\n')"
        ;;
    java)
        add_tool "java"     "$(java --version 2>&1 | head -1 | tr -d '\n')"
        add_tool "javac"    "$(javac --version 2>&1 | tr -d '\n')"
        add_tool "maven"    "$(mvn --version 2>&1 | head -1 | cut -c1-32 | tr -d '\n')"
        add_tool "gradle"   "$(gradle --version 2>&1 | grep '^Gradle' | head -1 | tr -d '\n')"
        add_tool "git"      "$(git --version 2>&1 | tr -d '\n')"
        ;;
    react)
        add_tool "node"     "$(node --version 2>&1 | tr -d '\n')"
        add_tool "npm"      "npm $(npm --version 2>&1 | tr -d '\n')"
        add_tool "npx"      "npx $(npx --version 2>&1 | tr -d '\n')"
        add_tool "git"      "$(git --version 2>&1 | tr -d '\n')"
        ;;
    fullstack)
        add_tool "node"     "$(node --version 2>&1 | tr -d '\n')"
        add_tool "python3"  "$(python3 --version 2>&1 | tr -d '\n')"
        add_tool "java"     "$(java --version 2>&1 | head -1 | tr -d '\n')"
        add_tool "mvn"      "$(mvn --version 2>&1 | head -1 | cut -c1-28 | tr -d '\n')"
        add_tool "psql"     "$(psql --version 2>&1 | tr -d '\n')"
        add_tool "docker"   "$(docker --version 2>&1 | cut -d',' -f1 | tr -d '\n')"
        add_tool "git"      "$(git --version 2>&1 | tr -d '\n')"
        ;;
    *)
        add_tool "bash"     "$(bash --version 2>&1 | head -1 | cut -c1-28 | tr -d '\n')"
        add_tool "git"      "$(git --version 2>&1 | tr -d '\n')"
        add_tool "python3"  "$(python3 --version 2>&1 | tr -d '\n')"
        add_tool "curl"     "$(curl --version 2>&1 | head -1 | cut -c1-28 | tr -d '\n')"
        add_tool "vim"      "$(vim --version 2>&1 | head -1 | cut -c1-28 | tr -d '\n')"
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
          padding:32px 36px;max-width:520px;width:100%;
          box-shadow:0 20px 60px rgba(0,0,0,0.5)}
    .hdr{display:flex;align-items:center;gap:12px;margin-bottom:4px}
    .icon{font-size:32px;line-height:1}
    .brand{font-size:11px;font-weight:700;color:#64748b;
           text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px}
    .title{font-size:20px;font-weight:800;color:#f1f5f9;letter-spacing:-0.02em}
    .sub{font-size:12px;color:#94a3b8;margin-top:3px}
    .ws{display:flex;align-items:center;gap:8px;
        background:#0f172a;border:1px solid #1e3a5f;border-radius:8px;
        padding:9px 13px;margin:16px 0 18px}
    .wsl{font-size:10px;font-weight:700;color:#64748b;
         text-transform:uppercase;letter-spacing:0.06em;flex-shrink:0}
    .wsn{font-size:13px;font-weight:700;color:${PAGE_COLOR};font-family:monospace}
    .wsd{font-size:11px;color:#475569;font-family:monospace;margin-left:auto}
    .tools{margin-bottom:20px}
    .tl{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;
        letter-spacing:0.06em;margin-bottom:8px}
    .tool{display:flex;align-items:center;gap:7px;padding:5px 0;
          border-bottom:1px solid #1e293b}
    .tool:last-child{border-bottom:none}
    .ok{color:#4ade80;font-size:11px;width:12px;flex-shrink:0}
    .tn{font-family:monospace;font-size:11px;color:#cbd5e1;font-weight:600;
        flex-shrink:0;width:76px}
    .tv{font-family:monospace;font-size:10px;color:#64748b;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    .btn{display:flex;align-items:center;justify-content:center;gap:7px;
         padding:12px 18px;border-radius:9px;font-weight:700;font-size:13px;
         text-decoration:none;cursor:pointer;transition:opacity 0.15s}
    .btn:hover{opacity:0.85}
    .btn-t{background:${PAGE_COLOR};color:#fff}
    .btn-d{background:#1e293b;color:#cbd5e1;border:1px solid #334155}
    .foot{margin-top:14px;font-size:10px;color:#475569;text-align:center}
    .dot{width:6px;height:6px;border-radius:50%;background:#4ade80;
         display:inline-block;margin-right:3px;
         animation:pulse 1.8s ease-in-out infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  </style>
</head>
<body>
<div class="card">
  <div class="hdr">
    <span class="icon">${PAGE_ICON}</span>
    <div>
      <div class="brand">DevBox Workspace</div>
      <div class="title">${DEVBOX_TEMPLATE_NAME}</div>
      <div class="sub">${PAGE_LANG}</div>
    </div>
  </div>
  <div class="ws">
    <span class="wsl">Env</span>
    <span class="wsn">${DEVBOX_ENV_NAME}</span>
    <span class="wsd">/workspace</span>
  </div>
  <div class="tools">
    <div class="tl"><span class="dot"></span>Verified tools</div>
    ${TOOL_HTML}
  </div>
  <div class="actions">
    <a href="/terminal/" class="btn btn-t">💻 Open Terminal</a>
    <a href="/desktop/vnc.html?autoconnect=true&path=websockify" class="btn btn-d">🖥 Open Desktop</a>
  </div>
  <div class="foot">Files in /workspace persist across restarts</div>
</div>
</body>
</html>
HTML_EOF

# ── Cleanup ───────────────────────────────────────────────────────────────────
cleanup() {
    echo "[devbox] shutting down (env=${DEVBOX_ENV_NAME} template=${DEVBOX_TEMPLATE_ID})"
    vncserver -kill "${VNC_DISPLAY}" 2>/dev/null || true
    for _pid in "${NGINX_PID:-}" "${TTYD_PID:-}" "${WEBSOCKIFY_PID:-}"; do
        [ -n "${_pid:-}" ] && kill "${_pid}" 2>/dev/null || true
    done
    wait 2>/dev/null || true
}
trap cleanup TERM INT EXIT

rm -f "/tmp/.X${DISPLAY_NUM}-lock" "/tmp/.X11-unix/X${DISPLAY_NUM}" 2>/dev/null || true

# ── TigerVNC ──────────────────────────────────────────────────────────────────
echo "[devbox] starting TigerVNC ${VNC_DISPLAY} ${DESKTOP_WIDTH}x${DESKTOP_HEIGHT} template=${DEVBOX_TEMPLATE_ID}"
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
    --client-option 'theme={"background":"#0f172a","foreground":"#e2e8f0","cursor":"#60a5fa"}' \
    --cwd /workspace \
    bash --login &
TTYD_PID=$!

# ── nginx ─────────────────────────────────────────────────────────────────────
echo "[devbox] starting nginx on 0.0.0.0:8080"
nginx -g 'daemon off;' &
NGINX_PID=$!

echo "[devbox] ready: env=${DEVBOX_ENV_NAME} template=${DEVBOX_TEMPLATE_ID}"
echo "[devbox]   /          -> workspace landing page"
echo "[devbox]   /terminal/ -> ttyd browser terminal"
echo "[devbox]   /desktop/  -> noVNC XFCE desktop"
echo "[devbox]   /healthz   -> 200 OK"

wait -n "${WEBSOCKIFY_PID}" "${TTYD_PID}" "${NGINX_PID}" 2>/dev/null || true
echo "[devbox] a service exited — shutting down"
