# CNAD32

CNAD32 is a **cloud-native development environment control plane**. Authenticated users create, operate, observe, and remove isolated development environments backed by real Kubernetes resources. The application uses Manus OAuth, a React and tRPC interface, MySQL-compatible persistence, and the `@kubernetes/client-node` SDK.

| Capability            | Implementation                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| Identity              | Manus OAuth session with backend-enforced user and admin roles                                                |
| Environment lifecycle | `provisioning → running → stopped → deleted`, with a separate failure path                                    |
| Isolation             | One namespace per environment with quota, limit range, PVC, Deployment, Service, ConfigMap, and NetworkPolicy |
| Observability         | Live deployment/pod health, Kubernetes events, bounded pod logs, and Metrics API measurements when installed  |
| Governance            | Environment events plus persisted audit records for authentication and lifecycle operations                   |

## Quick start

Install packages, provide the required environment variables, apply the schema migration, and start the server.

```bash
pnpm install
pnpm drizzle-kit generate
pnpm dev
```

The development server runs on the platform-provided `PORT`. Set `KUBECONFIG` to a credential file with the least-privilege RBAC in `k8s/platform/service-account-rbac.yaml`, or deploy the application in-cluster with the supplied service account.

> CNAD32 does not simulate Kubernetes work. Without a reachable Kubernetes API, creation and lifecycle actions fail safely, record an environment error event, and show the actual provider error in the interface.

## Verification commands

```bash
pnpm lint
pnpm check
pnpm test
pnpm build
```

Detailed installation and operations instructions are in [SETUP.md](./SETUP.md), [KUBERNETES.md](./KUBERNETES.md), and [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## DevBox — Spring Boot workspace and application deployment layer

DevBox is the Java/Spring Boot subsystem in this repository. It exposes a REST API for managing developer workspaces and containerised applications, building Docker images, and deploying them to Kubernetes/Minikube. It runs alongside the CNAD32 Node.js platform as a separate process.

### Repository layout

```
backend/        Spring Boot 4.1.0 REST API (Java 21, JPA, PostgreSQL)
frontend/       React 18 + Vite UI consuming the backend API
sample-app/     Minimal Node.js app used as a deployable test workload
k8s/            Raw Kubernetes manifests (namespace, postgres, backend, platform/)
helm/devbox/    Helm chart for the DevBox Spring Boot stack
scripts/        verify-kubernetes.mjs  (CNAD32 K8s e2e)
                verify-devbox.ps1      (DevBox e2e — Windows)
                verify-devbox.sh       (DevBox e2e — Linux/macOS/WSL)
```

### Quick start (DevBox)

```bash
# 1. Start PostgreSQL
docker compose up postgres -d

# 2. Start the backend (picks up DB from application.properties / env vars)
cd backend
.\mvnw.cmd spring-boot:run      # Windows
./mvnw spring-boot:run          # Linux / macOS

# 3. Start the frontend (separate terminal)
cd frontend
npm install
npm run dev
# => http://localhost:5173
```

### Run backend tests

```bash
cd backend
.\mvnw.cmd test     # no PostgreSQL or Kubernetes required (H2 in-memory)
# Expected: 41 tests, 0 failures
```

### End-to-end verification

```bash
# Windows (backend must already be running)
pwsh -File scripts/verify-devbox.ps1

# Skip Kubernetes steps
pwsh -File scripts/verify-devbox.ps1 -SkipK8s

# Linux / macOS / WSL
bash scripts/verify-devbox.sh
SKIP_K8S=true bash scripts/verify-devbox.sh

# Via pnpm
pnpm devbox:verify
pnpm devbox:verify:skip-k8s
```

### Deploy with Helm

```bash
minikube start
helm install devbox ./helm/devbox
minikube service devbox-release-devbox-backend-svc -n devbox --url
```

Full backend documentation, API reference, and troubleshooting guide: [backend/README.md](./backend/README.md)
