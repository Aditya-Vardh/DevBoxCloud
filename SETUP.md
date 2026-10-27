# DevBox Cloud — Setup, LAN Sharing & Demo Guide

## Architecture

| Layer | Technology | Port |
|-------|-----------|------|
| Frontend | React 18 + Vite (`frontend/`) | 5173 |
| Backend API | Spring Boot 4.1 (`backend/`) | 8080 |
| Database | PostgreSQL (`devboxdb`, port 5433) | 5433 |
| Kubernetes | minikube (`devbox` namespace) | via kubectl |
| Workspace containers | `devbox/workspace:latest` | per pod, via port-forward |

---

## Normal startup (localhost only)

```powershell
# Terminal 1 — Backend (default: workspace URLs use 127.0.0.1)
docker start devbox-postgres
minikube start
cd backend
.\mvnw.cmd spring-boot:run

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open: **http://localhost:5173**

---

## LAN Sharing Startup (other devices on same Wi-Fi)

The key difference: set `DEVBOX_WORKSPACE_HOST` to your Wi-Fi IP before starting the backend.
This causes the port-forward to bind on `0.0.0.0` instead of `127.0.0.1`,
making workspace terminal/desktop links reachable from other devices.

### Step 1 — Find your Wi-Fi IP

```powershell
Invoke-RestMethod "http://localhost:8080/api/config/lan-addresses"
# Returns: { "addresses": ["192.168.1.9"], ... }
```

Or directly:
```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" -and $_.IPAddress -notlike "192.168.144.*" } |
  Select-Object IPAddress,InterfaceAlias
```

### Step 2 — Start backend with LAN host

```powershell
cd backend
$env:DEVBOX_WORKSPACE_HOST = "192.168.1.9"   # <-- your actual Wi-Fi IP
.\mvnw.cmd spring-boot:run
```

### Step 3 — Open Windows Firewall (run as Administrator)

```powershell
New-NetFirewallRule -DisplayName "DevBox Frontend" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Domain,Private
New-NetFirewallRule -DisplayName "DevBox Backend"  -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Domain,Private
```

Note: Workspace terminal/desktop ports are dynamic (50000–65000 range). To allow all:
```powershell
New-NetFirewallRule -DisplayName "DevBox Workspace Tunnels" -Direction Inbound -Protocol TCP -LocalPort 50000-65535 -Action Allow -Profile Domain,Private
```

### Step 4 — Share the dashboard

Other devices open: **http://192.168.1.9:5173**

The Vite dev server proxies API calls to the backend, so the full app works from any device.

### What a friend's laptop can access

After the owner creates an environment and shares an invitation:

1. Friend opens `http://192.168.1.9:5173/invite/CODE`
2. Invitation page shows environment name and template
3. Friend clicks **Accept invitation** → redirected to environment detail
4. Environment detail shows **Terminal ↗** link: `http://192.168.1.9:PORT/terminal/`
5. Friend opens it → full browser terminal connected to **the same workspace pod**
6. Both users see the same `/workspace` filesystem
7. Desktop link: `http://192.168.1.9:PORT/desktop/vnc.html?autoconnect=true&path=websockify`

### Collaborative workspace behavior

- **Shared filesystem**: both users read/write the same PVC-mounted `/workspace`
- **Separate terminal sessions**: each browser tab gets its own ttyd session (independent shell)
- **Desktop**: noVNC connects to a single TigerVNC session — only one user controls it at a time (the VNC protocol doesn't support simultaneous independent control)
- **Both users see live changes** to files immediately (same container filesystem)

---

## Verify LAN mode is active

```powershell
Invoke-RestMethod "http://localhost:8080/api/config"
# Should return: { "workspaceHost": "192.168.1.9", "workspaceLanMode": true, ... }
```

Check port-forward binding (should show 0.0.0.0 not 127.0.0.1):
```powershell
# After refreshing an environment status
Get-NetTCPConnection | Where-Object { $_.LocalPort -gt 49999 -and $_.State -eq "Listen" }
# Should show 0.0.0.0:PORT not 127.0.0.1:PORT
```

---

## LAN Sharing — Actual Test Results

**Tested on this machine (2026-10-27):**
- Backend with `DEVBOX_WORKSPACE_HOST=192.168.1.9`
- `Get-NetTCPConnection -LocalPort 57756` returned `LocalAddress=0.0.0.0` ✓
- `Invoke-WebRequest "http://192.168.1.9:57756/terminal/"` returned HTTP 200 ✓
- `Invoke-WebRequest "http://192.168.1.9:57756/desktop/vnc.html"` returned HTTP 200, 14.9KB ✓
- `Invoke-WebRequest "http://192.168.1.9:5173"` returned HTTP 200 ✓

**Not tested from a physically separate device** — the LAN IP is accessible from this machine's LAN interface, confirming the binding is correct. A friend's laptop on the same Wi-Fi should work the same way.

**WebSocket routing**: noVNC uses `/websockify` path for WebSockets. nginx in the workspace container proxies this path to websockify:6080 which bridges to VNC. The entire path (browser → port-forward → nginx → websockify → VNC) works through the single gateway port.

---

## Invitation Flow

1. Owner opens an environment → **🔗 Share** tab
2. Clicks **"+ Create link (72 hours)"** → link copied to clipboard
3. Link format: `http://192.168.1.9:5173/invite/CODE` (uses `window.location.host`)
4. Friend opens link → sees environment name/template, clicks **Accept invitation**
5. Backend validates invitation, increments use count, returns environment with fresh tunnel URLs
6. Friend redirected to `/environments/ID` → sees Terminal and Desktop buttons with LAN-reachable URLs
7. Invitation can be revoked from the Share tab → further redemption returns HTTP 400

---

## Startup Commands Summary

```powershell
# Localhost only
docker start devbox-postgres ; minikube start
cd backend ; .\mvnw.cmd spring-boot:run
# (separate terminal)
cd frontend ; npm run dev
# → http://localhost:5173

# LAN sharing
docker start devbox-postgres ; minikube start
cd backend
$env:DEVBOX_WORKSPACE_HOST = "192.168.1.9"  # your Wi-Fi IP
.\mvnw.cmd spring-boot:run
# (separate terminal)
cd frontend ; npm run dev
# → http://192.168.1.9:5173 from any LAN device
```

---

## Six Templates

| Template | ID | Starter Project | Verified |
|----------|----|-----------------|---------|
| Ubuntu | `ubuntu` | `bash /workspace/starter/welcome.sh` | ✓ |
| Python | `python` | `python3 /workspace/starter/hello.py` | ✓ |
| Node.js | `nodejs` | `node /workspace/starter/hello.js` | ✓ |
| Java | `java` | `cd /workspace/starter && javac Hello.java && java Hello` | ✓ |
| React | `react` | `bash /workspace/starter/create-react-app.sh` | ✓ image |
| Full Stack | `fullstack` | `bash /workspace/starter/verify.sh` | ✓ image |

---

## Remaining Limitations

1. **Physical two-device test**: Not performed from a separate physical laptop. The socket binding (`0.0.0.0`) and reachability via LAN IP were verified from the same machine using the LAN interface. A friend's laptop on the same Wi-Fi should work identically.

2. **Dynamic port firewall**: Each workspace gets a fresh port from the ephemeral range (~50000-65535). Windows Firewall needs to allow this range for LAN access. The rule above covers it.

3. **Desktop sharing**: noVNC/TigerVNC supports one active desktop session. Two users CAN connect but will share control of the same mouse/keyboard. This is a VNC protocol limitation, not a DevBox limitation.

4. **No user authentication**: Backend is open — any caller can create/delete environments. Appropriate for a trusted LAN demo; not production-ready.

5. **minikube port-forward persistence**: Tunnels are lost when the backend restarts. Call `GET /api/environments/:id/status` to re-establish them.

6. **Internet (public) access**: Requires a tunnel (cloudflared, ngrok, etc.) or cloud K8s cluster. Not implemented.
