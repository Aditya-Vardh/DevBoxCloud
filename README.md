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
