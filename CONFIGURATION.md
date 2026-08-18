# CNAD32 Configuration Reference

CNAD32 supports two deployment modes. **Hosted mode** delegates identity to Manus OAuth. **Local development mode** uses a signed session restricted to loopback traffic; it is appropriate only when the CNAD32 process runs on the developer’s own machine. No frontend secret is required or exposed in either mode.

| Variable                    | Hosted Manus deployment                 | Local development    | Purpose                                                                             |
| --------------------------- | --------------------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Required                                | Required             | MySQL-compatible CNAD32 data store.                                                 |
| `JWT_SECRET`                | Required                                | Required             | Server-only session signing secret.                                                 |
| `VITE_APP_ID`               | Required                                | Omit                 | Manus OAuth application identifier.                                                 |
| `VITE_OAUTH_PORTAL_URL`     | Required                                | Omit                 | Manus OAuth portal origin.                                                          |
| `OAUTH_SERVER_URL`          | Required                                | Omit                 | Manus OAuth API origin.                                                             |
| `CNAD32_LOCAL_AUTH_NAME`    | Omit                                    | Optional             | Local operator display name; defaults to `Local Operator`.                          |
| `KUBECONFIG`                | Required when running outside a cluster | Optional             | Path to the kubeconfig to use. The standard default kubeconfig is used when absent. |
| `CNAD32_KUBECONFIG_B64`     | Optional alternative                    | Optional alternative | Base64-encoded kubeconfig for a managed runtime.                                    |
| `VITE_ANALYTICS_ENDPOINT`   | Optional                                | Optional             | HTTPS analytics origin. Leave unset with the ID to disable analytics.               |
| `VITE_ANALYTICS_WEBSITE_ID` | Optional                                | Optional             | Analytics website identifier. Leave unset with the endpoint to disable analytics.   |

## Local Minikube

Run the API server on the same Windows or Linux computer as Minikube. Its active kubeconfig commonly uses a loopback HTTPS address, so a remote preview service cannot reach it. CNAD32 preserves TLS verification, resolves a missing or incorrect HTTP scheme to HTTPS when the kubeconfig requires TLS, and uses the active kubeconfig host and port.

```powershell
kubectl config use-context minikube
pnpm dev
```

Open `http://localhost:3000`, select **Continue on this computer**, and create an environment. A repository is optional; use **Skip repository** to create an empty workspace.

> Do not commit a real `.env`, kubeconfig, token, database password, or private key. This document intentionally lists variable names and behavior only, never live values.
