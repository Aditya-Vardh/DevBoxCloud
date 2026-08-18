# CNAD32 Setup

## Prerequisites

Use Node.js 22, pnpm 10, a MySQL-compatible database, and a Kubernetes cluster for environment provisioning. The database is mandatory for user records, templates, environments, events, and audit history. Kubernetes is mandatory only for environment operations; the dashboard remains available and reports an unavailable provider when no cluster can be reached.

## Configuration

| Variable                       | Purpose                                                                      | Required                          |
| ------------------------------ | ---------------------------------------------------------------------------- | --------------------------------- |
| `DATABASE_URL`                 | MySQL-compatible connection string                                           | Yes                               |
| `JWT_SECRET`                   | Session signing secret                                                       | Yes                               |
| `VITE_APP_ID`                  | Manus OAuth application identifier                                           | Hosted Manus OAuth only           |
| `VITE_OAUTH_PORTAL_URL`        | Manus OAuth portal URL                                                       | Hosted Manus OAuth only           |
| `OAUTH_SERVER_URL`             | Manus OAuth server URL                                                       | Hosted Manus OAuth only           |
| `CNAD32_LOCAL_AUTH_NAME`       | Optional label for the loopback-only local development operator              | Optional                          |
| `VITE_ANALYTICS_ENDPOINT`      | Optional HTTPS analytics origin; analytics is disabled if absent             | Optional                          |
| `VITE_ANALYTICS_WEBSITE_ID`    | Optional analytics website identifier; analytics is disabled if absent       | Optional                          |
| `KUBECONFIG`                   | Absolute path to a Kubernetes configuration file                             | For external-cluster provisioning |
| `CNAD32_KUBECONFIG_B64`        | Base64-encoded kubeconfig for securely injected local/managed runtime access | Alternative to `KUBECONFIG`       |
| `CNAD32_WORKSPACE_HOST_SUFFIX` | Optional DNS suffix for workspace ingress                                    | Optional                          |
| `CNAD32_INGRESS_CLASS_NAME`    | Optional ingress class name                                                  | Optional                          |

Do not commit local `.env` files, kubeconfig files, secrets, tokens, or Git credentials. Repository URLs are accepted only as public HTTPS URLs without embedded credentials.

## Database

The repository includes `drizzle/0001_demonic_silver_sable.sql`. Apply it through your approved migration process. The active Node.js, Python, Go, and Ubuntu templates are seeded idempotently on first template access.

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

## Local application development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

On `http://localhost`, CNAD32 provides a signed **local development session** restricted to loopback traffic. It does not require or emulate Manus OAuth. Hosted deployments use Manus OAuth when `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, and `OAUTH_SERVER_URL` are configured. The session survives refreshes and logout clears it.

Analytics is optional. Leave both analytics variables unset to disable it completely; no placeholder request is emitted.

```bash
pnpm lint && pnpm check && pnpm test && pnpm build
```

## Local Minikube

When CNAD32 runs on the same machine as Minikube, no remote credential is necessary. The Kubernetes provider calls the standard Kubernetes client configuration loader, which reads the current context from `~/.kube/config` by default. Select Minikube before starting the application.

```bash
minikube start
kubectl config use-context minikube
pnpm dev
```

Run the guarded real provider lifecycle check only after confirming that the current kubeconfig context is the intended disposable local cluster. It creates a temporary CNAD32 namespace, waits for a real workload, stops, starts, restarts, and deletes it.

```powershell
$env:CNAD32_KUBERNETES_VERIFICATION="yes"
pnpm k8s:verify
```

On Windows PowerShell, `pnpm dev` works directly. CNAD32's development bootstrap sets development mode inside Node rather than relying on Unix shell assignment syntax.

> A Minikube kubeconfig normally points at a loopback HTTPS endpoint. Run the CNAD32 server on the same machine as Minikube for real provisioning. A hosted preview cannot route to `127.0.0.1` on your computer; it will report this limitation without disabling TLS verification.

## Repository source

GitHub is optional. Leave **GitHub Repository (Optional)** blank or choose **Skip repository** to start with an empty workspace. Only a public HTTPS repository URL triggers the existing init-container clone behavior.
