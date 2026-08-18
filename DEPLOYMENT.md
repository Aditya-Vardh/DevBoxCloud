# CNAD32 Deployment

CNAD32 includes a multi-stage `Dockerfile`, platform Kubernetes manifests, and GitHub Actions workflows. The production image builds both the Vite frontend and Express server, retains external runtime dependencies, runs as UID 10001, and listens on the runtime-provided `PORT`.

## Container build

```bash
docker build -t cnad32:local .
```

The sandbox does not include Docker, so run the command in a local or CI environment. The CI workflow validates formatting, types, tests, production build, production dependency advisories, and a Docker build.

## Kubernetes deployment

Create a Kubernetes Secret named `cnad32-secrets` containing the variables listed in [SETUP.md](./SETUP.md). Set a real immutable image reference in `k8s/platform/deployment.yaml`, then apply the resources.

```bash
kubectl apply -f k8s/platform/namespace.yaml
kubectl apply -f k8s/platform/service-account-rbac.yaml
kubectl apply -f k8s/platform/network-policy.yaml
kubectl apply -f k8s/platform/deployment.yaml
kubectl apply -f k8s/platform/service.yaml
kubectl -n cnad32-platform rollout status deployment/cnad32 --timeout=180s
```

The manual GitHub Actions deployment workflow expects a base64-encoded kubeconfig and application secrets stored as GitHub environment secrets. It applies controller RBAC, updates the secret declaratively, deploys the supplied immutable image, and waits for rollout success.
