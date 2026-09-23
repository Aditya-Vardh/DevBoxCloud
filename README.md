# DevBox Cloud

A local cloud development workspace platform. Users create isolated development environments
backed by real Kubernetes resources, access a full XFCE desktop via noVNC in the browser,
and get a browser-based terminal — all from a single UI.

```
Browser
  ↓
DevBox Frontend (React, Vite — port 5173 in dev)
  ↓
Spring Boot Backend (port 8080)
  ↓
Kubernetes / Minikube
  ↓
Workspace Pod
  ├── nginx gateway     (port 8080 inside pod)
  │     /              → template-specific landing page
  │     /terminal/     → ttyd browser terminal
  │     /desktop/      → noVNC XFCE desktop
  │     /websockify    → WebSocket bridge for noVNC
  │     /healthz       → readiness probe (HTTP 200)
  ├── TigerVNC          (port 5901 inside pod)
  ├── websockify        (port 6080 inside pod)
  └── ttyd terminal     (port 7681 inside pod)
  ↓
/workspace  (PersistentVolumeClaim — survives stop/start)
```

---

## Prerequisites

| Tool | Min version | Check |
|---|---|---|
| Java | 21 | `java --version` |
| Maven wrapper | included | `.\mvnw.cmd` (in `backend/`) |
| Node.js | 20 LTS | `node --version` |
| npm | 10+ | `npm --version` |
| Docker Desktop | any | must be running |
| Minikube | 1.33+ | `minikube version` |
| kubectl | 1.29+ | `kubectl version --client` |
| PowerShell | 7+ | Windows scripts |

---

## Quick Start

### 1. Start PostgreSQL

```powershell
docker compose up postgres -d
docker compose ps   # wait for (healthy)
```

| Setting | Value |
|---|---|
| Host | `localhost:5433` |
| Database | `devboxdb` |
| User / Password | `devbox` / `devbox123` |

### 2. Start Minikube

```powershell
minikube start --cpus 4 --memory 4096
kubectl config use-context minikube
kubectl cluster-info
```

Recommended resources: 4 CPUs and 4 GB RAM. Workspaces require ~1 GB each.

### 3. Build and load the workspace image

The workspace image contains all six template toolchains (Python, Node, Java, etc.) plus
XFCE desktop, TigerVNC, noVNC, websockify, ttyd, and nginx.

```powershell
# Build (run from repo root)
docker build -t devbox/workspace:latest .\workspace-image\

# Load into Minikube's container runtime
minikube image load devbox/workspace:latest

# Verify it is available inside Minikube
minikube image ls | Select-String "devbox/workspace"
```

**Important:** Rebuild and reload after every change to `workspace-image/`.

```powershell
# Quick rebuild + reload after changes
docker build -t devbox/workspace:latest .\workspace-image\ ; minikube image load devbox/workspace:latest
```

### 4. Start the backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

The backend starts on **http://localhost:8080**. On startup it:
- Connects to PostgreSQL and runs schema migrations (Hibernate `ddl-auto=update`)
- Seeds / updates the 6 built-in environment templates with correct quick-start commands
- Initialises the Kubernetes client from your local `~/.kube/config`

Watch for these lines:
```
Started BackendApplication in N seconds
Seeded 6 environment template(s)
Kubernetes client initialized (using kubeconfig)
```

### 5. Start the frontend

In a **separate terminal**:

```powershell
cd frontend
npm install        # first time only
npm run dev
```

Opens on **http://localhost:5173**. All `/api` calls are proxied to `localhost:8080`.

---

## Using DevBox

1. Open **http://localhost:5173**
2. Click **+ New Workspace** → give it a name
3. Inside the workspace, click **+ New Environment**
4. **Step 1**: pick a template (Ubuntu, Python, Node.js, Java, React, or Full Stack)
5. **Step 2**: set a name, adjust resources if needed, review the quick-start commands
6. Click **Create Environment**
7. The environment detail page opens. Status shows **Starting** for 30–75 seconds while:
   - Kubernetes creates the Deployment, Service, and PVC
   - The pod starts and runs TigerVNC, XFCE, nginx
   - The readiness probe on `/healthz` passes
   - `kubectl port-forward` establishes the tunnel to `localhost:<dynamic-port>`
8. When **Running**, three buttons appear:

| Button | Opens |
|---|---|
| **Workspace** | Template-specific landing page with real tool versions and links |
| **Terminal** | Browser terminal (ttyd) starting in `/workspace` |
| **Desktop** | XFCE desktop via noVNC — full graphical environment |

---

## Nginx routing (inside each workspace pod)

| Path | Routes to | Purpose |
|---|---|---|
| `/` | Landing page | Template-specific HTML with verified tool versions |
| `/terminal/` | ttyd:7681 | Browser terminal (bash --login, cwd=/workspace) |
| `/desktop/` | noVNC static files | XFCE desktop launcher |
| `/desktop/vnc.html` | noVNC → websockify:6080 → VNC:5901 | XFCE desktop stream |
| `/websockify` | websockify:6080 | noVNC WebSocket bridge |
| `/healthz` | nginx return 200 | Readiness probe |

All paths are served through a single `kubectl port-forward` tunnel.
The user never needs to know the internal ports.

---

## Templates

All six templates use the same `devbox/workspace:latest` image.
Template identity is passed as `DEVBOX_TEMPLATE_ID` at pod start.
Each workspace gets a template-specific landing page, terminal banner, and prompt color.

| Template | ID | Color | Key tools |
|---|---|---|---|
| Ubuntu Development | `ubuntu` | Blue | bash, git, vim, build-essential, htop |
| Python Development | `python` | Yellow | python3, python, pip3, pip, venv |
| Node.js Development | `nodejs` | Green | node 20, npm, npx |
| Java Development | `java` | Red | java 21, javac, mvn, gradle |
| React Development | `react` | Cyan | node 20, npm, npx (scaffold with Vite) |
| Full Stack Development | `fullstack` | Magenta | node, python3, java, mvn, psql, docker CLI |

### Python aliases

`python` and `pip` are aliased to `python3` and `pip3` via `update-alternatives`.

### Java home

`JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64` is injected in Java and Full Stack pods.

### Terminal prompt

```
devuser@python:/workspace$     (Python — yellow)
devuser@nodejs:/workspace$     (Node.js — green)
devuser@java:/workspace$       (Java — red)
devuser@react:/workspace$      (React — cyan)
devuser@fullstack:/workspace$  (Full Stack — magenta)
devuser@ubuntu:/workspace$     (Ubuntu — blue)
```

Git branch is shown automatically when inside a git repository.

---

## Port architecture

| Port | What | Where |
|---|---|---|
| 5173 | Vite frontend dev server | host |
| 8080 | Spring Boot backend API | host |
| 5433 | PostgreSQL (Docker Compose) | host |
| `<dynamic>` | `kubectl port-forward` → workspace gateway | host (one per environment) |
| **8080** | nginx workspace gateway | inside each pod |
| 5901 | TigerVNC | inside pod |
| 6080 | websockify | inside pod |
| 7681 | ttyd | inside pod |

---

## Persistence

Each environment has a Kubernetes **PersistentVolumeClaim** mounted at `/workspace`.

| Operation | Effect on `/workspace` data |
|---|---|
| Stop | Pod scaled to 0. PVC survives. Data intact. |
| Start again | New pod, same PVC. All files present. |
| Delete | Deployment + Service + **PVC deleted**. Data gone. |

Back up files via the terminal before deleting an environment.

---

## Environment lifecycle

```
(new) → PROVISIONING → RUNNING → STOPPED → RUNNING (restart)
                    ↘ FAILED ↗
```

| Status | Meaning |
|---|---|
| PROVISIONING | K8s resources creating, or pod starting |
| RUNNING | Pod ready, tunnel active, gateway reachable |
| STOPPED | Deployment scaled to 0 (PVC kept) |
| FAILED | Pod crash, image pull error, or OOM |
| DELETING | Resources being removed |

The detail page polls every 5 seconds while PROVISIONING, DELETING, or RUNNING without an access URL.

---

## Multiple simultaneous environments

Each environment is fully isolated:
- Own Kubernetes Deployment, Service, and PVC in the `devbox` namespace
- Own `kubectl port-forward` process on an independent local port
- Own `/workspace` volume
- Own landing page, terminal, and desktop

Stopping or deleting one environment has no effect on others.

---

## Running backend tests

No PostgreSQL or Kubernetes required — tests use H2 in-memory.

```powershell
cd backend
.\mvnw.cmd test
# Expected: Tests run: 41, Failures: 0, Errors: 0 — BUILD SUCCESS
```

---

## Building the frontend

```powershell
cd frontend
npm run build
# Output: dist/  (48 modules, ~227 kB JS, ~2.5 kB CSS)
```

---

## Troubleshooting

### Pod stuck in PROVISIONING / ImagePullBackOff

Image not loaded into Minikube:
```powershell
minikube image load devbox/workspace:latest
minikube image ls | Select-String devbox
```

### Pod stuck in PROVISIONING — CrashLoopBackOff

Check pod logs for startup errors:
```powershell
kubectl get pods -n devbox
kubectl logs <pod-name> -n devbox
```
Common cause: stale VNC lock from a previous run.
The entrypoint cleans `/tmp/.X1-lock` automatically on each start.

### /healthz not responding after port-forward

The workspace stack (VNC + XFCE + nginx) takes 30–75 seconds on first start.
The readiness probe allows up to 75 seconds (`initialDelaySeconds=15, failureThreshold=12`).
Click **Refresh** on the environment detail page.

### Blank / grey desktop in noVNC

XFCE hasn't finished starting. Wait 10–15 seconds and reload the tab.
Check pod logs for `[devbox] starting TigerVNC` and XFCE error messages.

### Port-forward exits unexpectedly

Click **Refresh** — the backend detects the dead tunnel and starts a new one automatically.

### Terminal opens but shows wrong template

The workspace image was not rebuilt after entrypoint changes. Rebuild and reload:
```powershell
docker build -t devbox/workspace:latest .\workspace-image\
minikube image load devbox/workspace:latest
```
Then stop and restart the environment to pick up the new image.

### Backend fails to start — PostgreSQL not reachable

```powershell
docker compose up postgres -d
docker compose ps   # wait for (healthy)
```

### Minikube context wrong

```powershell
kubectl config use-context minikube
kubectl cluster-info
```

---

## Repository layout

```
backend/             Spring Boot 4.1 REST API (Java 21, JPA, PostgreSQL)
frontend/            React 18 + Vite UI
  src/
    theme.js         Design tokens (colors, radii, shadows, template accents)
    components/      Button, StatusBadge, ConfirmDialog, TemplateCard, ...
    pages/           WorkspacesPage, WorkspaceDetailPage, EnvironmentDetailPage, ...
workspace-image/
  Dockerfile         Ubuntu 24.04 — all runtimes + XFCE + nginx
  entrypoint.sh      Starts TigerVNC, XFCE, websockify, ttyd, nginx; generates
                     template-specific .bashrc and landing page HTML at pod start
  nginx.conf         Gateway routing: /, /terminal/, /desktop/, /websockify, /healthz
k8s/                 Raw Kubernetes manifests
helm/devbox/         Helm chart for the Spring Boot stack
scripts/
  verify-devbox.ps1  Windows end-to-end verification (backend + environment lifecycle)
  verify-devbox.sh   Linux/macOS end-to-end verification
```

---

## Verification scripts

```powershell
# Full verification (backend + K8s + environment lifecycle)
pwsh -File scripts/verify-devbox.ps1

# Skip Kubernetes and environment steps
pwsh -File scripts/verify-devbox.ps1 -SkipK8s
```

```bash
# Linux / macOS / WSL
bash scripts/verify-devbox.sh
SKIP_K8S=true bash scripts/verify-devbox.sh
```
