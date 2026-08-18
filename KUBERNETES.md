# Kubernetes Operations

Each environment receives a dedicated namespace. The controller creates the following resources idempotently and deletes the namespace with foreground propagation when the environment is removed.

| Resource                     | Purpose                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| Namespace                    | Tenant boundary for the individual environment                    |
| ResourceQuota and LimitRange | Per-template ceilings and defaults                                |
| PersistentVolumeClaim        | Workspace persistence across stop/start                           |
| ConfigMap                    | Non-secret runtime settings                                       |
| Deployment                   | Workspace workload with readiness/liveness probes                 |
| Service                      | Internal ClusterIP endpoint                                       |
| NetworkPolicy                | Restricts ingress to namespaces labelled `cnad32.io/gateway=true` |
| Ingress                      | Created only when `CNAD32_WORKSPACE_HOST_SUFFIX` is configured    |

All resources are labelled with the application, environment ID, user ID, and template slug. Workloads run non-root, disable privilege escalation, drop Linux capabilities, use `RuntimeDefault` seccomp, do not automount service account tokens, and never mount the Docker socket.

## Controller installation

Apply the platform namespace, restricted controller service account, ClusterRole, and ClusterRoleBinding before deploying the application in-cluster.

```bash
kubectl apply -f k8s/platform/namespace.yaml
kubectl apply -f k8s/platform/service-account-rbac.yaml
kubectl apply -f k8s/platform/network-policy.yaml
```

The ClusterRole needs namespace creation and deletion because CNAD32 deliberately creates a separate namespace per environment. It is limited to the resource types and verbs required by the provider; it does not grant secret access, exec access, node access, or wildcard permissions.

For a local or managed runtime outside the cluster, set `CNAD32_KUBECONFIG_B64` to the base64 encoding of a restricted kubeconfig. The provider prefers this value, then `KUBECONFIG`, then in-cluster/default discovery. Do not expose a kubeconfig to the browser.

## Minikube development

CNAD32 supports Minikube without a project-specific remote credential. When the application is started on the same machine as Minikube, `KubeConfig.loadFromDefault()` reads `~/.kube/config` and uses the selected `minikube` context. If you keep kubeconfig elsewhere, set `KUBECONFIG` before starting the server.

```bash
kubectl config use-context minikube
CNAD32_KUBERNETES_VERIFICATION=yes pnpm k8s:verify
```

The verification script is intentionally destructive only to its own generated `cnad-e2e-*` namespace. It will not operate until the explicit verification environment flag is set and it attempts cleanup on both success and failure.

## Metrics and logs

Install a Kubernetes Metrics API implementation, such as metrics-server, to show live CPU and memory. If the API is not installed or unavailable, CNAD32 explicitly displays **Unavailable** rather than a derived or synthetic value. Log retrieval is bounded to 250 KB and 1,000 lines per request.
