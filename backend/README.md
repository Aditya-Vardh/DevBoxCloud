# DevBox Backend

Spring Boot 4.1.0 REST API that manages developer workspaces and applications, builds Docker images, and orchestrates deployments on Kubernetes/Minikube.

---

## Requirements

| Tool | Version | Notes |
|------|---------|-------|
| Java JDK | 21+ | `java -version` |
| Maven Wrapper | included | `./mvnw` / `mvnw.cmd` |
| PostgreSQL | 14+ | or use Docker Compose |
| Docker Desktop | latest | required for builds |
| kubectl | 1.28+ | for K8s operations |
| Minikube | 1.32+ | local Kubernetes cluster |

---

## Quick start

### Option A — Docker Compose (PostgreSQL only, backend on host)

```bash
# From repo root: start PostgreSQL
docker compose up postgres -d

# Start the backend
cd backend
./mvnw spring-boot:run        # Linux / macOS / WSL
.\mvnw.cmd spring-boot:run    # Windows PowerShell
```

### Option B — Docker Compose (full stack)

```bash
# Builds and starts PostgreSQL + backend together
docker compose up --build
```

### Option C — Standalone (bring your own PostgreSQL)

```bash
cd backend
export DB_URL=jdbc:postgresql://localhost:5432/devboxdb
export DB_USERNAME=devbox
export DB_PASSWORD=devbox123
./mvnw spring-boot:run
```

The server starts on **http://localhost:8080**.

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_URL` | `jdbc:postgresql://localhost:5432/devboxdb` | JDBC connection string |
| `DB_USERNAME` | `devbox` | Database user |
| `DB_PASSWORD` | `devbox123` | Database password |
| `K8S_NAMESPACE` | `devbox` | Namespace where app workloads are deployed |
| `MINIKUBE_ENABLED` | `true` | Use `minikube image build` instead of plain `docker build` |

Copy `.env.example` to `.env` at the repo root and adjust values.

---

## Running tests

Tests use an H2 in-memory database — no PostgreSQL or Kubernetes needed.

```bash
cd backend
./mvnw test               # Linux / macOS / WSL
.\mvnw.cmd test           # Windows PowerShell
```

Expected output: **41 tests, 0 failures, 0 errors**.

Test classes:

| Class | Coverage |
|-------|----------|
| `WorkspaceControllerTest` | Workspace CRUD, validation, 404/409 error codes |
| `ApplicationControllerTest` | Application CRUD, name validation, status endpoint, health endpoint |
| `WorkspaceServiceTest` | Service-layer logic, conflict/not-found exceptions |
| `K8sNameUtilTest` | DNS name sanitisation, length truncation, prefix/suffix rules |
| `BackendApplicationTests` | Spring context loads with H2 |

---

## Building a JAR

```bash
cd backend
./mvnw package -DskipTests
# Output: target/backend-0.0.1-SNAPSHOT.jar
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

---

## Building a Docker image

```bash
cd backend
docker build -t devbox/backend:latest .
```

---

## API reference

All endpoints are under `/api`. Errors return a consistent JSON envelope:

```json
{
  "timestamp": "2026-08-18T13:00:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Workspace not found with id: ...",
  "path": "/api/workspaces/..."
}
```

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness check — always returns `{"status":"UP"}` |
| GET | `/api/health/dependencies` | Docker / kubectl / minikube / K8s reachability |

### Workspaces

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/workspaces` | — | List all workspaces |
| POST | `/api/workspaces` | `CreateWorkspaceRequest` | Create workspace |
| GET | `/api/workspaces/:id` | — | Get workspace by ID |
| PUT | `/api/workspaces/:id` | `UpdateWorkspaceRequest` | Update name / description |
| DELETE | `/api/workspaces/:id` | — | Delete workspace + all its applications |

**CreateWorkspaceRequest**

```json
{ "name": "my-workspace", "description": "optional" }
```

**WorkspaceResponse**

```json
{
  "id": "uuid",
  "name": "my-workspace",
  "description": "...",
  "applicationCount": 2,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Applications

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/workspaces/:wsId/applications` | — | List applications in a workspace |
| POST | `/api/workspaces/:wsId/applications` | `CreateApplicationRequest` | Create application |
| GET | `/api/applications/:id` | — | Get application by ID |
| PUT | `/api/applications/:id` | `UpdateApplicationRequest` | Update description / sourcePath / port / replicas |
| DELETE | `/api/applications/:id` | — | Delete app + K8s resources |

**CreateApplicationRequest**

```json
{
  "name": "my-app",
  "description": "optional",
  "sourcePath": "/absolute/path/to/dockerfile/dir",
  "containerPort": 8080,
  "replicas": 1
}
```

Name rules: lowercase alphanumeric + hyphens only, 1-63 chars, must start and end with alphanumeric (Kubernetes-safe).

### Build & Deploy

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/applications/:id/build` | Build Docker image via Minikube/Docker. Returns `BuildResponse`. |
| POST | `/api/applications/:id/deploy` | Create/update K8s Deployment + Service. Returns `DeploymentStatusResponse`. |
| POST | `/api/applications/:id/redeploy` | Build then deploy in one call. |
| POST | `/api/applications/:id/scale` | Body: `{"replicas": N}`. Scales the K8s Deployment. |
| POST | `/api/applications/:id/stop` | Scales to 0 replicas. |

**BuildResponse**

```json
{
  "success": true,
  "status": "NOT_DEPLOYED",
  "imageName": "devbox/my-app:latest",
  "log": "...",
  "error": null
}
```

**DeploymentStatusResponse**

```json
{
  "applicationId": "uuid",
  "applicationName": "my-app",
  "status": "RUNNING",
  "desiredReplicas": 2,
  "availableReplicas": 2,
  "readyReplicas": 2,
  "message": "2/2 replicas running"
}
```

### Observability

| Method | Path | Query | Description |
|--------|------|-------|-------------|
| GET | `/api/applications/:id/status` | — | Live K8s deployment status (reconciles DB) |
| GET | `/api/applications/:id/pods` | — | List pods for the application |
| GET | `/api/applications/:id/logs` | `?lines=200` | Tail logs from the first running pod |
| GET | `/api/applications/:id/service` | — | NodePort / ClusterIP info + Minikube access URL |

### Deployment status values

| Status | Meaning |
|--------|---------|
| `NOT_DEPLOYED` | Never deployed or resources deleted externally |
| `BUILDING` | Docker build in progress |
| `BUILD_FAILED` | Docker build exited non-zero |
| `DEPLOYING` | K8s rollout in progress |
| `RUNNING` | All desired replicas ready |
| `DEGRADED` | Some but not all replicas ready |
| `FAILED` | Zero replicas ready, deployment not progressing |
| `STOPPED` | Scaled to 0 by user |
| `DELETING` | Deletion in progress |

---

## Kubernetes / Minikube setup

```bash
# Start Minikube
minikube start

# Verify
kubectl cluster-info
kubectl get namespaces

# The backend auto-creates the 'devbox' namespace on first deploy.
# To create it manually:
kubectl apply -f ../k8s/namespace.yaml
```

---

## Deploy to Kubernetes with Helm

```bash
# From repo root
helm install devbox ./helm/devbox

# Upgrade
helm upgrade devbox ./helm/devbox

# Uninstall
helm uninstall devbox
```

After install:
```bash
minikube service devbox-release-devbox-backend-svc -n devbox --url
```

---

## Deploy to Kubernetes with raw manifests

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml

# Check rollout
kubectl rollout status deployment/devbox-backend -n devbox
```

---

## Troubleshooting

**Backend won't start — DataSource error**

The most common cause is PostgreSQL not running or wrong credentials.

```bash
# Start PostgreSQL via Docker Compose
docker compose up postgres -d

# Verify it's healthy
docker compose ps
```

**Build fails — Docker not found**

```
GET /api/health/dependencies  ->  "docker": "error: docker not found..."
```

Start Docker Desktop. On Windows, make sure the Docker Engine is running (system tray icon).

**Deploy fails — Kubernetes not reachable**

```
GET /api/health/dependencies  ->  "kubernetes": "error: exit=1..."
```

```bash
minikube start
kubectl cluster-info   # should show a running master
```

**Pods stuck in `Pending` or `ImagePullBackOff`**

The image was not built into Minikube's Docker daemon. Run build first via the API or manually:

```bash
minikube image build -t devbox/my-app:latest /path/to/app
```

**Port already in use on 8080**

```bash
# Windows
netstat -ano | findstr :8080
taskkill /PID <pid> /F

# Linux/macOS
lsof -ti:8080 | xargs kill
```
