# CNAD32 Troubleshooting

| Symptom                                        | Diagnosis                                                                    | Resolution                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Environment creation fails before provisioning | Kubernetes configuration is unavailable or unauthenticated                   | Supply a valid `KUBECONFIG`, or deploy in-cluster with the `cnad32-controller` service account              |
| Environment remains provisioning               | Inspect the environment detail events and namespace pod state                | Check `kubectl -n <namespace> get pods`, pod events, PVC binding, image availability, and quota messages    |
| CPU and memory show unavailable                | Metrics API is absent or inaccessible                                        | Install metrics-server and permit the controller `metrics.k8s.io` read access                               |
| No pod logs                                    | The pod is not yet created, terminated, or the container name is unavailable | Inspect Kubernetes events; only a running workspace pod emits live container logs                           |
| Stop does not complete immediately             | Kubernetes is terminating existing pods                                      | Keep the detail page open; CNAD32 waits until active pods are gone before recording `stopped`               |
| Delete reports cleanup in progress             | Namespace finalizers or dependent resources have not completed               | Inspect `kubectl get namespace <namespace> -o yaml`; resolve invalid finalizers according to cluster policy |
| Workspace URL is missing                       | No workspace ingress suffix is configured                                    | Set `CNAD32_WORKSPACE_HOST_SUFFIX` and, when needed, `CNAD32_INGRESS_CLASS_NAME`                            |
| OAuth login fails                              | Portal URL, application ID, or callback configuration is incorrect           | Verify the Manus OAuth variables and registered callback URL                                                |

Use the health endpoint for platform probes:

```bash
curl -fsS https://your-cnad32-host/healthz
```

For development diagnostics, inspect the application’s structured server logs and browser console. Do not paste session cookies, kubeconfig files, OAuth access tokens, or database credentials into issue reports.
