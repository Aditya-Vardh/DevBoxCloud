# CNAD32 API Contract

CNAD32 exposes tRPC procedures beneath `/api/trpc`. All environment procedures require a Manus-authenticated session. The server resolves the user from the session, so callers cannot choose an owner or lifecycle status.

| Procedure                                           | Access                 | Purpose                                                                |
| --------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| `auth.me` / `auth.logout`                           | Public session context | Read identity or clear the session                                     |
| `profile.updateName`                                | User                   | Update display name                                                    |
| `environment.templates`                             | User                   | List active runtime templates                                          |
| `environment.dashboard`                             | User                   | User-scoped aggregate and recent audit activity                        |
| `environment.list` / `detail`                       | User                   | List or inspect owned environments; admins may inspect any environment |
| `environment.create`                                | User                   | Validate configuration, persist record, then provision real resources  |
| `environment.start` / `stop` / `restart` / `delete` | User                   | Apply an allowed lifecycle operation to an owned environment           |
| `environment.health`                                | User                   | Get actual deployment/pod status                                       |
| `environment.logs` / `metrics` / `kubernetesEvents` | User                   | Retrieve real Kubernetes observability data                            |
| `environment.events` / `audit`                      | User                   | Retrieve lifecycle and audited action records                          |
| `admin.overview`                                    | Admin                  | Review platform totals, audit records, and Kubernetes provider health  |

Validation failures return a human-readable `BAD_REQUEST` or `PRECONDITION_FAILED` tRPC error. Ownership failures return `NOT_FOUND` so cross-account resource existence is not disclosed. Kubernetes errors are sanitized and are never returned with stack traces or credentials.
