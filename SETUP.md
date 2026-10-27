# DevBox Cloud — Startup & Demo Guide

## Architecture

| Layer | Technology | Port |
|-------|-----------|------|
| Frontend | React 18 + Vite (`frontend/`) | **5173** |
| Backend API | Spring Boot 4.1 + JPA (`backend/`) | **8080** |
| Database | PostgreSQL (`devboxdb`, port 5433) | 5433 |
| Kubernetes | minikube (`devbox` namespace) | via kubectl |
| Workspace containers | `devbox/workspace:latest` (Ubuntu 24.04) | per pod via port-forward |

> The `frontend/` Vite dev server proxies all `/api/*` to Spring Boot at 8080.  
> The `server/` directory (tRPC/MySQL) is a **separate prototype — do not use it**.

---

## Quick Start (Every Session)

```powershell
# Terminal 1 — Backend
docker start devbox-postgres        # or: docker compose up -d
minikube start
cd backend
.\mvnw.cmd spring-boot:run

# Terminal 2 — Frontend
cd frontend
npm run dev

# Open: http://localhost:5173
```

---

## First-Time Setup

```powershell
# 1. Install frontend dependencies
cd frontend ; npm install ; cd ..

# 2. Build workspace image into minikube
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
docker build -t devbox/workspace:latest ./workspace-image/

# 3. Run DB migrations (PostgreSQL must be running)
cd backend ; .\mvnw.cmd spring-boot:run   # Hibernate ddl-auto=update handles this
```

---

## LAN Expo Demo (Other Devices on Same Wi-Fi)

Both servers already bind on `0.0.0.0`. Other devices reach:

| Service | URL |
|---------|-----|
| Frontend + Dashboard | `http://192.168.1.9:5173` |
| Backend API | `http://192.168.1.9:8080` |

**Open Windows Firewall (run as Administrator):**
```powershell
New-NetFirewallRule -DisplayName "DevBox Frontend" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Domain,Private
New-NetFirewallRule -DisplayName "DevBox Backend"  -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Domain,Private
```

**Make workspace terminal/desktop URLs reachable from other devices:**

By default, `accessUrl`/`terminalUrl`/`desktopUrl` use `127.0.0.1` (localhost only).  
To make them reachable from another device, set `DEVBOX_WORKSPACE_HOST` before starting the backend:

```powershell
$env:DEVBOX_WORKSPACE_HOST = "192.168.1.9"
.\mvnw.cmd spring-boot:run
```

Then all new workspace URLs will use `http://192.168.1.9:<port>/terminal/` etc., which any LAN device can open.

> **Note:** The `kubectl port-forward` tunnel still binds on `127.0.0.1` — only the URL returned to clients changes. Existing environments need a `/status` refresh to get new LAN URLs.

---

## Demo Flow (Expo)

1. Open `http://localhost:5173` → **Landing page** with 6 template cards
2. Click **"Get started"** → Workspaces dashboard
3. Open a workspace → environment cards with status badges
4. Click **"Manage"** on any RUNNING environment → environment detail
5. Click **"💻 Terminal ↗"** → real browser terminal (ttyd)
6. In the terminal, run a starter command:
   - Ubuntu: `bash /workspace/starter/welcome.sh`
   - Python: `python3 /workspace/starter/hello.py`
   - Java: `cd /workspace/starter && javac Hello.java && java Hello`
   - Node.js: `node /workspace/starter/hello.js`
7. Click **"🖥 Desktop ↗"** → XFCE desktop via noVNC
8. Go to **🔗 Share** tab → **"+ Create link (72 hours)"** → link copied
9. Open link in incognito → invitation page → **"Accept invitation"**
10. Show stop/restart/start from the action bar

---

## Six Templates

All use `devbox/workspace:latest`. The `DEVBOX_TEMPLATE_ID` env var (injected via Kubernetes ConfigMap) selects the template-specific behavior in the entrypoint.

| Template | ID | Key tools | Starter files |
|----------|----|-----------|---------------|
| Ubuntu | `ubuntu` | bash, git, curl, vim, htop, python3 | `/workspace/starter/welcome.sh` |
| Python | `python` | python3.12, pip3, venv, virtualenv | `/workspace/starter/hello.py` |
| Node.js | `nodejs` | node 20, npm, npx | `/workspace/starter/hello.js` |
| Java | `java` | OpenJDK 21, javac, Maven, Gradle | `/workspace/starter/Hello.java` |
| React | `react` | node 20, npm, npx, vite-ready | `/workspace/starter/create-react-app.sh` |
| Full Stack | `fullstack` | node+python+java+mvn+psql+docker | `/workspace/starter/verify.sh` |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config` | Workspace host config |
| GET | `/api/templates` | List all 6 templates |
| GET/POST | `/api/workspaces` | List/create workspaces |
| GET/DELETE | `/api/workspaces/:id` | Get/delete workspace |
| GET | `/api/workspaces/:id/environments` | List environments |
| POST | `/api/workspaces/:id/environments` | Create environment |
| GET | `/api/environments/:id/status` | Status + re-resolve port-forward |
| POST | `/api/environments/:id/start` | Start stopped environment |
| POST | `/api/environments/:id/stop` | Stop running environment |
| POST | `/api/environments/:id/restart` | Restart (rolling) |
| DELETE | `/api/environments/:id` | Delete environment + K8s resources |
| POST | `/api/environments/:id/invitations` | Create invite link |
| GET | `/api/environments/:id/invitations` | List invitations |
| DELETE | `/api/invitations/:id` | Revoke invitation |
| GET | `/api/invitations/info/:code` | Validate invite (public) |
| POST | `/api/invitations/redeem/:code` | Redeem invite |

---

## Troubleshooting

**Port 8080 in use:**
```powershell
Get-Process -Id (netstat -ano | Select-String ":8080 .*LISTEN" | ForEach-Object { $_.Line.Trim().Split()[-1] }) -ErrorAction SilentlyContinue | Stop-Process -Force
```

**Terminal/Desktop URLs 404 after backend restart:**
Call `GET /api/environments/:id/status` — this re-establishes the `kubectl port-forward` tunnel.

**Minikube won't start:**
```powershell
minikube stop ; minikube start
```

**Pods in Error state after minikube restart:**
```powershell
kubectl delete pods -n devbox --field-selector status.phase=Failed
```
Wait ~30s for the deployment controller to recreate them.
