# DevBox Cloud

On-demand cloud development environments, built on Kubernetes.

Pick a template (Java, Python, Node.js, React, Full Stack, Ubuntu), click **Create**, and DevBox starts an isolated container with every tool already installed. You get a browser terminal and a full Linux desktop in your browser. Nothing to install on your own machine.

```
Browser
  ↓
React frontend (Vite, :5173)
  ↓  /api
Spring Boot backend (:8080)  ←→  PostgreSQL (:5433)
  ↓
Kubernetes (Minikube)
  ↓
Workspace pod (one per environment)
  ├── nginx gateway  → /  /terminal/  /desktop/  /healthz
  ├── ttyd           → browser terminal
  ├── TigerVNC + XFCE + noVNC → browser desktop
  └── /workspace     → PersistentVolume (survives stop/start)
```

---

## 1. What you need installed

| Tool | Version | Check |
|---|---|---|
| Git | any | `git --version` |
| Java (JDK) | 21 | `java --version` |
| Node.js | 20 or newer | `node --version` |
| Docker Desktop | any, **must be running** | `docker ps` |
| Minikube | 1.33+ | `minikube version` |
| kubectl | 1.29+ | `kubectl version --client` |

Maven is **not** needed, the project includes its own wrapper (`mvnw`).

Recommended machine: 8 GB RAM or more, ~15 GB free disk. Windows 10/11, macOS and Linux all work. Commands below are shown for **Windows PowerShell** with macOS/Linux notes where they differ.

---

## 2. Get the code

```bash
git clone https://github.com/Aditya-Vardh/DevBoxCloud.git
cd DevBoxCloud
```

---

## 3. Run it (5 steps, in order)

Open **Docker Desktop** first and wait until it says it's running.

### Step 1: Start the database

```bash
docker compose up -d
docker compose ps
```

Wait until the status shows `healthy`.

### Step 2: Start Kubernetes (Minikube)

```bash
minikube start --driver=docker --cpus=4 --memory=4096
kubectl config use-context minikube
kubectl get nodes
```

The node should show `Ready`. If your machine has less than 6 GB RAM free, use `--memory=3072`.

### Step 3: Build the workspace image

This is the container image every environment runs on (Ubuntu + all toolchains + desktop). **The first build takes 10 to 25 minutes** (it downloads a lot). Do it once.

```bash
docker build -t devbox/workspace:latest ./workspace-image
minikube image load devbox/workspace:latest
```

Check it loaded:

```bash
minikube image ls | findstr devbox        # Windows
minikube image ls | grep devbox           # macOS / Linux
```

You should see `devbox/workspace:latest`.

### Step 4: Start the backend (Terminal 1)

```powershell
cd backend
.\mvnw.cmd spring-boot:run          # Windows
```
```bash
cd backend
chmod +x mvnw && ./mvnw spring-boot:run     # macOS / Linux
```

Wait for these lines (first run downloads dependencies, give it a couple of minutes):

```
Started BackendApplication in N seconds
Seeded 6 environment template(s)
Kubernetes client initialized (using kubeconfig)
```

Leave this terminal running.

### Step 5: Start the frontend (Terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** 🎉

---

## 4. Using DevBox

1. Click **Get started**, then **+ New Workspace** and give it a name.
2. Inside the workspace click **+ New Environment**.
3. Pick a template (for example **Java**), name it, click **Create Environment**.
4. Wait 30 to 75 seconds while the status goes `Starting` → `Running`.
5. Use the buttons:

| Button | What you get |
|---|---|
| **Workspace** | Landing page showing the installed tool versions |
| **Terminal** | Browser terminal inside the container, in `/workspace` |
| **Desktop** | Full Linux (XFCE) desktop in the browser |

Try a starter program in the terminal:

| Template | Command |
|---|---|
| Java | `cd /workspace/starter && javac Hello.java && java Hello` |
| Python | `python3 /workspace/starter/hello.py` |
| Node.js | `node /workspace/starter/hello.js` |
| Ubuntu | `bash /workspace/starter/welcome.sh` |

**Stop** keeps your files. **Delete** removes the environment and its files.

---

## 5. Templates

All six use the same image (`devbox/workspace:latest`). The template ID only changes the landing page, prompt and defaults.

| Template | Tools |
|---|---|
| Ubuntu | bash, git, curl, vim, htop, build-essential |
| Python | python 3.12, pip, venv |
| Node.js | node 20, npm, npx |
| Java | OpenJDK 21, javac, Maven, Gradle |
| React | node 20, npm, Vite |
| Full Stack | node, python, java, maven, psql, docker CLI |

---

## 6. Ports

| Port | Service |
|---|---|
| 5173 | Frontend (Vite) |
| 8080 | Backend API |
| 5433 | PostgreSQL |
| dynamic | `kubectl port-forward` to each environment (auto-managed) |

Make sure 5173, 8080 and 5433 are free before starting.

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `docker compose up` fails / Docker error | Start Docker Desktop and wait until it is fully running |
| Backend: can't connect to database | `docker compose ps` must show `healthy`. Check nothing else uses port 5433 |
| Backend: Kubernetes client error | Run `minikube start`, then `kubectl cluster-info` |
| Environment stuck on `Starting`, `ErrImageNeverPull` or `ImagePullBackOff` | Image not in Minikube. Run `minikube image load devbox/workspace:latest` |
| Environment `CrashLoopBackOff` | `kubectl get pods -n devbox` then `kubectl logs <pod> -n devbox` |
| Terminal or Desktop link gives 404 or blank | Wait 30 to 75 s, then click **Refresh** on the environment page |
| Grey desktop | XFCE is still loading, wait 15 s and reload the tab |
| `Port 8080 already in use` | Close the other app using 8080 (or an old backend run) |
| `permission denied: ./mvnw` (macOS/Linux) | `chmod +x backend/mvnw` |
| After a Minikube/PC restart, pods show `Error` | `kubectl delete pods -n devbox --field-selector status.phase=Failed` and wait ~30 s |
| Out of memory | Run `minikube stop`, then `minikube start --memory=3072`, or delete unused environments |

Complete reset (wipes everything):

```bash
docker compose down -v
minikube delete
```

---

## 8. Daily start (after first setup)

```bash
docker compose up -d
minikube start
cd backend && ./mvnw spring-boot:run        # Terminal 1  (.\mvnw.cmd on Windows)
cd frontend && npm run dev                  # Terminal 2
```

---

## 9. Run tests

No database or Kubernetes needed (tests use in-memory H2).

```bash
cd backend
./mvnw test          # .\mvnw.cmd test on Windows
```

---

## 10. Project structure

```
backend/          Spring Boot 4 REST API (Java 21, JPA, PostgreSQL, Kubernetes client)
frontend/         React 18 + Vite UI
workspace-image/  Dockerfile, entrypoint and nginx config for the workspace container
k8s/              Raw Kubernetes manifests
helm/devbox/      Helm chart
scripts/          Verification scripts
docker-compose.yml   PostgreSQL for local development
```

> `server/`, `client/` and `drizzle/` are an earlier Node/tRPC prototype and are **not** used by the running app.

---

## 11. Optional: demo on another device (same Wi-Fi)

Set your PC's Wi-Fi IP before starting the backend so workspace links work from other devices:

```powershell
$env:DEVBOX_WORKSPACE_HOST = "<your-ip>"
.\mvnw.cmd spring-boot:run
```

Then open `http://<your-ip>:5173` from the other device (allow ports 5173 and 8080 in your firewall).

---

## Tech stack

Spring Boot 4.1 · Java 21 · PostgreSQL 16 · React 18 · Vite · Docker · Kubernetes (Minikube) · nginx · ttyd · TigerVNC · noVNC
