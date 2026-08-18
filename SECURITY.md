# CNAD32 Security

CNAD32 treats the API as the trust boundary. The browser provides configuration intent only; the server validates it, authorizes the requesting account, resolves the active template, and then constructs Kubernetes resources from controlled fields.

| Control            | Implementation                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication     | Manus OAuth callback and signed HTTP-only session cookie                                                                                                     |
| Authorization      | `protectedProcedure`, `adminProcedure`, owner-scoped environment queries, and non-disclosing `NOT_FOUND` ownership failures                                  |
| Input safety       | Zod validation, resource quantity checks, allowed port lists, DNS-safe Kubernetes names, and public HTTPS-only repository URLs                               |
| HTTP hardening     | Secure response headers, 1 MB request-body limits, proxy-aware rate limits, and no Express fingerprint header                                                |
| Secrets            | Environment variables and Kubernetes Secrets only; no plaintext password, source credential, or secret logging                                               |
| Workload hardening | Non-root identity, dropped capabilities, no privilege escalation, read-only root filesystem, seccomp, no service account token, quota, and network isolation |
| Auditability       | Login, logout, profile, lifecycle, and failure records persisted without sensitive payloads                                                                  |

The in-memory rate limiter is pragmatic protection for a single controller instance. Production deployments that need coordinated rate limiting across replicas should place an API gateway or shared limiter in front of CNAD32.

Review the controller RBAC before every cluster deployment. The application must never be configured with a cluster-admin credential.
