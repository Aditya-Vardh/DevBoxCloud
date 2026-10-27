# DevBox Cloud — Configuration Reference

The application is a **Spring Boot backend + React/Vite frontend**.
No environment variables are required for local development — all defaults are safe for localhost.

---

## Backend (`backend/src/main/resources/application.properties`)

All values can be overridden with environment variables before running `.\mvnw.cmd spring-boot:run`.

| Variable | Default | Purpose |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5433/devboxdb` | PostgreSQL JDBC URL |
| `DB_USERNAME` | `devbox` | Database user |
| `DB_PASSWORD` | `devbox123` | Database password |
| `K8S_NAMESPACE` | `devbox` | Kubernetes namespace for workspace pods |
| `DEVBOX_WORKSPACE_HOST` | `127.0.0.1` | Host used in workspace terminal/desktop URLs. Set to your LAN IP (e.g. `192.168.1.9`) to make workspace links reachable from another device on the same network. When set, `kubectl port-forward` binds on `0.0.0.0` instead of `127.0.0.1`. |

### Database

PostgreSQL 16 is started by `docker compose up -d`. The credentials above match the values in `docker-compose.yml`. Do not change them without updating both files.

### Kubernetes

The backend reads `~/.kube/config` automatically (the same config `kubectl` uses). No additional configuration is needed if `minikube start` has been run. Set `K8S_NAMESPACE` only if you want to use a namespace other than `devbox`.

---

## Frontend (`frontend/`)

No environment variables are required. The Vite dev server proxies `/api` to `http://localhost:8080` automatically.

---

## LAN sharing (optional)

To make workspace terminal and desktop links reachable from another laptop on the same Wi-Fi:

```powershell
$env:DEVBOX_WORKSPACE_HOST = "192.168.1.9"   # replace with your actual Wi-Fi IP
cd backend
.\mvnw.cmd spring-boot:run
```

Find your Wi-Fi IP:
```powershell
(Invoke-RestMethod "http://localhost:8080/api/config/lan-addresses").addresses
```

Also open the Windows Firewall for ports 5173 (frontend) and 8080 (backend).
Workspace tunnel ports are allocated dynamically from the ephemeral range — allow the full range if you want guests to open terminal/desktop links directly:

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "DevBox Frontend" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Domain,Private
New-NetFirewallRule -DisplayName "DevBox Backend"  -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Domain,Private
New-NetFirewallRule -DisplayName "DevBox Workspace Tunnels" -Direction Inbound -Protocol TCP -LocalPort 50000-65535 -Action Allow -Profile Domain,Private
```

---

## No secrets to manage

There are no OAuth credentials, JWT secrets, or API keys required for local development.
Do not commit real credentials, kubeconfig files, or `.env` files.

> **Note:** The older `server/`, `client/`, and `drizzle/` directories in this repository are a Node/tRPC prototype and are not used. Ignore any `.env.example` or `pnpm`-related instructions in those directories.
