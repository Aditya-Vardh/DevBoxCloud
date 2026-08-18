import {
  KubeConfig,
  KubernetesObjectApi,
  Log,
  Metrics,
  PatchStrategy,
  type V1Deployment,
  type CoreV1Event,
  type V1Pod,
} from "@kubernetes/client-node";
import { Writable } from "node:stream";
import type { Environment, EnvironmentTemplate } from "../drizzle/schema";
import type {
  EnvironmentHealth,
  EnvironmentMetrics,
  EnvironmentStatus,
} from "../shared/cnad";
import { ENV } from "./_core/env";

export class KubernetesUnavailableError extends Error {}

export type KubernetesEnvironmentStatus = {
  status: EnvironmentStatus;
  health: EnvironmentHealth;
  podName: string | null;
  failureReason: string | null;
  accessUrl: string | null;
};

type Workspace = {
  environment: Environment;
  template: EnvironmentTemplate;
};

type KubernetesClients = {
  config: KubeConfig;
  objects: KubernetesObjectApi;
  metrics: Metrics;
  server: string;
};

function statusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    code?: number;
    statusCode?: number;
    response?: { statusCode?: number; status?: number; code?: number };
    body?: { code?: number };
    status?: number;
  };
  return (
    candidate.code ??
    candidate.statusCode ??
    candidate.response?.statusCode ??
    candidate.response?.status ??
    candidate.response?.code ??
    candidate.body?.code
  );
}

function isConflict(error: unknown) {
  return statusCode(error) === 409;
}

function isNotFound(error: unknown) {
  if (statusCode(error) === 404) return true;
  return error instanceof Error && /\b404\b|\bnot found\b/i.test(error.message);
}

/**
 * Resolve the active kubeconfig cluster endpoint into a complete URL before
 * client discovery. Kubeconfigs normally include an HTTPS scheme, but a bare
 * Minikube host:port is valid input for this local adapter and is made HTTPS
 * when certificate verification is active. A malformed HTTP Minikube entry is
 * upgraded to the same HTTPS host and port; certificate verification remains
 * enabled and a genuine TLS failure is still surfaced to the caller.
 */
export function resolveKubernetesServerUrl(
  server: string,
  skipTLSVerify: boolean
) {
  const raw = server.trim();
  if (!raw) {
    throw new KubernetesUnavailableError(
      "The active Kubernetes context has no API server URL."
    );
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `${skipTLSVerify ? "http" : "https"}://${raw}`;

  let endpoint: URL;
  try {
    endpoint = new URL(withProtocol);
  } catch {
    throw new KubernetesUnavailableError(
      "The active Kubernetes context has an invalid API server URL."
    );
  }

  if (endpoint.protocol === "http:" && !skipTLSVerify) {
    endpoint.protocol = "https:";
  }
  if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
    throw new KubernetesUnavailableError(
      "The active Kubernetes context must use an HTTP or HTTPS API server URL."
    );
  }

  return endpoint.toString().replace(/\/$/, "");
}

function asKubernetesMessage(error: unknown) {
  if (error instanceof Error && error.message)
    return error.message.slice(0, 900);
  return "Kubernetes returned an unexpected error.";
}

export function explainKubernetesConnectionFailure(
  error: unknown,
  server: string
) {
  const message = asKubernetesMessage(error);
  const networkFailure = /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(
    message
  );
  let endpoint: URL | null = null;
  try {
    endpoint = new URL(server);
  } catch {
    endpoint = null;
  }
  const loopback = endpoint
    ? ["localhost", "127.0.0.1", "::1"].includes(endpoint.hostname)
    : false;
  if (networkFailure && loopback) {
    return `Kubernetes API ${server} is a Minikube loopback endpoint. Run CNAD32 with pnpm dev on the same machine as Minikube; a hosted preview cannot reach that local API server.`;
  }
  return message;
}

function parseQuantity(value: string): number {
  const match = value.match(/^([0-9]+(?:\.[0-9]+)?)(n|u|m|Ki|Mi|Gi|Ti)?$/);
  if (!match) return 0;
  const magnitude = Number(match[1]);
  const unit = match[2] ?? "";
  const multipliers: Record<string, number> = {
    n: 1e-9,
    u: 1e-6,
    m: 1e-3,
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    "": 1,
  };
  return magnitude * (multipliers[unit] ?? 1);
}

function cpuMilliCores(value: string): number {
  return Math.round(parseQuantity(value) * 1000);
}

function resourceLabels(workspace: Workspace) {
  return {
    app: "cnad32-workspace",
    "cnad32.io/environment-id": String(workspace.environment.id),
    "cnad32.io/user-id": String(workspace.environment.userId),
    "cnad32.io/template": workspace.template.slug,
  };
}

function workspaceAccessUrl(workspace: Workspace) {
  if (!ENV.workspaceHostSuffix) return null;
  return `https://${workspace.environment.namespace}.${ENV.workspaceHostSuffix}`;
}

function readinessCommand() {
  return ["sh", "-c", "test -d /workspace && test -w /workspace"];
}

export class KubernetesProvider {
  private clients(): KubernetesClients {
    const config = new KubeConfig();
    try {
      if (ENV.kubeConfigBase64) {
        config.loadFromString(
          Buffer.from(ENV.kubeConfigBase64, "base64").toString("utf8")
        );
      } else if (ENV.kubeConfigPath) {
        config.loadFromFile(ENV.kubeConfigPath);
      } else {
        config.loadFromDefault();
      }
    } catch {
      throw new KubernetesUnavailableError(
        "Kubernetes configuration could not be loaded. Configure KUBECONFIG or run the service in-cluster."
      );
    }

    const cluster = config.getCurrentCluster();
    if (!cluster) {
      throw new KubernetesUnavailableError(
        "No Kubernetes cluster is configured. Configure KUBECONFIG or run the service in-cluster."
      );
    }
    const server = resolveKubernetesServerUrl(
      cluster.server,
      cluster.skipTLSVerify
    );
    if (cluster.server !== server) {
      (cluster as { server: string }).server = server;
    }

    return {
      config,
      objects: KubernetesObjectApi.makeApiClient(config),
      metrics: new Metrics(config),
      server,
    };
  }

  private async createIfMissing<
    T extends {
      apiVersion?: string;
      kind?: string;
      metadata?: { name?: string; namespace?: string };
    },
  >(objects: KubernetesObjectApi, resource: T) {
    try {
      await objects.create(resource, undefined, undefined, "cnad32");
    } catch (error) {
      if (!isConflict(error)) throw error;
    }
  }

  private resources(workspace: Workspace) {
    const { environment, template } = workspace;
    const labels = resourceLabels(workspace);
    const configMapName = "workspace-config";
    const imagePullPolicy = template.image.includes(":latest")
      ? "Always"
      : "IfNotPresent";
    const gitInitContainer = environment.repositoryUrl
      ? [
          {
            name: "clone-repository",
            image: "alpine/git:2.45.2",
            imagePullPolicy: "IfNotPresent",
            command: [
              "sh",
              "-c",
              'git clone --depth 1 --branch "$CNAD32_BRANCH" "$CNAD32_REPOSITORY_URL" /workspace/repository',
            ],
            env: [
              {
                name: "CNAD32_REPOSITORY_URL",
                value: environment.repositoryUrl,
              },
              { name: "CNAD32_BRANCH", value: environment.branch ?? "main" },
              { name: "HOME", value: "/tmp" },
            ],
            volumeMounts: [
              { name: "workspace", mountPath: "/workspace" },
              { name: "tmp", mountPath: "/tmp" },
            ],
            securityContext: {
              allowPrivilegeEscalation: false,
              capabilities: { drop: ["ALL"] },
              readOnlyRootFilesystem: true,
              runAsNonRoot: true,
              runAsUser: 10001,
            },
          },
        ]
      : [];

    const namespace = {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: environment.namespace,
        labels: {
          ...labels,
          "pod-security.kubernetes.io/enforce": "restricted",
        },
      },
    };
    const resourceQuota = {
      apiVersion: "v1",
      kind: "ResourceQuota",
      metadata: {
        name: "workspace-budget",
        namespace: environment.namespace,
        labels,
      },
      spec: {
        hard: {
          "requests.cpu": template.maxCpu,
          "limits.cpu": template.maxCpu,
          "requests.memory": template.maxMemory,
          "limits.memory": template.maxMemory,
          "requests.storage": template.maxStorage,
          persistentvolumeclaims: "1",
          pods: "2",
          services: "2",
        },
      },
    };
    const limitRange = {
      apiVersion: "v1",
      kind: "LimitRange",
      metadata: {
        name: "workspace-defaults",
        namespace: environment.namespace,
        labels,
      },
      spec: {
        limits: [
          {
            type: "Container",
            defaultRequest: {
              cpu: template.defaultCpu,
              memory: template.defaultMemory,
            },
            default: { cpu: template.maxCpu, memory: template.maxMemory },
          },
        ],
      },
    };
    const configMap = {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        name: configMapName,
        namespace: environment.namespace,
        labels,
      },
      data: {
        CNAD32_RUNTIME: environment.runtime,
        CNAD32_WORKSPACE: "/workspace",
        CNAD32_PORT: String(environment.port),
      },
    };
    const persistentVolumeClaim = {
      apiVersion: "v1",
      kind: "PersistentVolumeClaim",
      metadata: {
        name: environment.persistentVolumeClaimName,
        namespace: environment.namespace,
        labels,
      },
      spec: {
        accessModes: ["ReadWriteOnce"],
        resources: { requests: { storage: environment.storageLimit } },
      },
    };
    const networkPolicy = {
      apiVersion: "networking.k8s.io/v1",
      kind: "NetworkPolicy",
      metadata: {
        name: "workspace-ingress",
        namespace: environment.namespace,
        labels,
      },
      spec: {
        podSelector: { matchLabels: labels },
        policyTypes: ["Ingress"],
        ingress: [
          {
            from: [
              {
                namespaceSelector: {
                  matchLabels: { "cnad32.io/gateway": "true" },
                },
              },
            ],
            ports: [{ protocol: "TCP", port: environment.port }],
          },
        ],
      },
    };
    const deployment: V1Deployment = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: environment.deploymentName,
        namespace: environment.namespace,
        labels,
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: labels },
        template: {
          metadata: { labels, annotations: { "cnad32.io/managed": "true" } },
          spec: {
            automountServiceAccountToken: false,
            securityContext: {
              fsGroup: 10001,
              runAsNonRoot: true,
              runAsUser: 10001,
              runAsGroup: 10001,
              seccompProfile: { type: "RuntimeDefault" },
            },
            initContainers: gitInitContainer,
            containers: [
              {
                name: "workspace",
                image: template.image,
                imagePullPolicy,
                command: [
                  "sh",
                  "-c",
                  "mkdir -p /workspace/.home && trap : TERM INT; sleep infinity & wait",
                ],
                envFrom: [{ configMapRef: { name: configMapName } }],
                env: [{ name: "HOME", value: "/workspace/.home" }],
                ports: [
                  {
                    containerPort: environment.port,
                    name: "workspace",
                    protocol: "TCP",
                  },
                ],
                resources: {
                  requests: {
                    cpu: environment.cpuLimit,
                    memory: environment.memoryLimit,
                  },
                  limits: {
                    cpu: environment.cpuLimit,
                    memory: environment.memoryLimit,
                  },
                },
                readinessProbe: {
                  exec: { command: readinessCommand() },
                  initialDelaySeconds: 2,
                  periodSeconds: 5,
                },
                livenessProbe: {
                  exec: { command: readinessCommand() },
                  initialDelaySeconds: 10,
                  periodSeconds: 15,
                },
                volumeMounts: [
                  { name: "workspace", mountPath: "/workspace" },
                  { name: "tmp", mountPath: "/tmp" },
                ],
                securityContext: {
                  allowPrivilegeEscalation: false,
                  capabilities: { drop: ["ALL"] },
                  readOnlyRootFilesystem: true,
                  runAsNonRoot: true,
                  runAsUser: 10001,
                },
              },
            ],
            volumes: [
              {
                name: "workspace",
                persistentVolumeClaim: {
                  claimName: environment.persistentVolumeClaimName,
                },
              },
              { name: "tmp", emptyDir: {} },
            ],
          },
        },
      },
    };
    const service = {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: environment.serviceName,
        namespace: environment.namespace,
        labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [
          {
            name: "workspace",
            port: environment.port,
            targetPort: environment.port,
            protocol: "TCP",
          },
        ],
      },
    };
    const ingress = ENV.workspaceHostSuffix
      ? {
          apiVersion: "networking.k8s.io/v1",
          kind: "Ingress",
          metadata: {
            name: "workspace",
            namespace: environment.namespace,
            labels,
          },
          spec: {
            ...(ENV.ingressClassName
              ? { ingressClassName: ENV.ingressClassName }
              : {}),
            rules: [
              {
                host: `${environment.namespace}.${ENV.workspaceHostSuffix}`,
                http: {
                  paths: [
                    {
                      path: "/",
                      pathType: "Prefix",
                      backend: {
                        service: {
                          name: environment.serviceName,
                          port: { number: environment.port },
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        }
      : null;

    return {
      namespace,
      resourceQuota,
      limitRange,
      configMap,
      persistentVolumeClaim,
      networkPolicy,
      deployment,
      service,
      ingress,
    };
  }

  async createEnvironment(
    workspace: Workspace
  ): Promise<KubernetesEnvironmentStatus> {
    const { objects, server } = this.clients();
    const resources = this.resources(workspace);
    try {
      await this.createIfMissing(objects, resources.namespace);
      await this.createIfMissing(objects, resources.resourceQuota);
      await this.createIfMissing(objects, resources.limitRange);
      await this.createIfMissing(objects, resources.configMap);
      await this.createIfMissing(objects, resources.persistentVolumeClaim);
      await this.createIfMissing(objects, resources.networkPolicy);
      await this.createIfMissing(objects, resources.deployment);
      await this.createIfMissing(objects, resources.service);
      if (resources.ingress)
        await this.createIfMissing(objects, resources.ingress);
      return this.getEnvironmentStatus(workspace);
    } catch (error) {
      throw new KubernetesUnavailableError(
        explainKubernetesConnectionFailure(error, server)
      );
    }
  }

  async getEnvironmentStatus(
    workspace: Workspace
  ): Promise<KubernetesEnvironmentStatus> {
    const { objects, server } = this.clients();
    const { environment } = workspace;
    const labels = resourceLabels(workspace);
    const checkedAt = new Date();

    let deployment: V1Deployment;
    try {
      deployment = await objects.read<V1Deployment>({
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
          name: environment.deploymentName,
          namespace: environment.namespace,
        },
      });
    } catch (error) {
      if (isNotFound(error)) {
        return {
          status: "deleted",
          health: {
            deploymentAvailable: false,
            readyReplicas: 0,
            desiredReplicas: 0,
            podPhase: null,
            lastCheckedAt: checkedAt,
          },
          podName: null,
          failureReason: null,
          accessUrl: null,
        };
      }
      throw new KubernetesUnavailableError(
        explainKubernetesConnectionFailure(error, server)
      );
    }

    let pods: { items: V1Pod[] };
    try {
      pods = await objects.list<V1Pod>(
        "v1",
        "Pod",
        environment.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        Object.entries(labels)
          .map(([key, value]) => `${key}=${value}`)
          .join(","),
        10
      );
    } catch (error) {
      throw new KubernetesUnavailableError(
        explainKubernetesConnectionFailure(error, server)
      );
    }
    const pod = pods.items[0] ?? null;
    const desiredReplicas = deployment.spec?.replicas ?? 0;
    const readyReplicas = deployment.status?.readyReplicas ?? 0;
    const podPhase = pod?.status?.phase ?? null;
    const waitingReason = pod?.status?.containerStatuses
      ?.flatMap(container => container.state?.waiting?.reason ?? [])
      .find(Boolean);
    const terminatedReason = pod?.status?.containerStatuses
      ?.flatMap(container => container.state?.terminated?.reason ?? [])
      .find(Boolean);
    const failureReason =
      waitingReason ??
      terminatedReason ??
      (podPhase === "Failed" ? "Pod failed" : null);
    const podIsActive =
      podPhase === "Pending" ||
      podPhase === "Running" ||
      podPhase === "Unknown";
    const status: EnvironmentStatus = failureReason
      ? "failed"
      : desiredReplicas === 0
        ? podIsActive
          ? "provisioning"
          : "stopped"
        : readyReplicas >= desiredReplicas && podPhase === "Running"
          ? "running"
          : "provisioning";

    return {
      status,
      health: {
        deploymentAvailable:
          (deployment.status?.availableReplicas ?? 0) >= desiredReplicas &&
          desiredReplicas > 0,
        readyReplicas,
        desiredReplicas,
        podPhase,
        lastCheckedAt: checkedAt,
      },
      podName: pod?.metadata?.name ?? null,
      failureReason,
      accessUrl: status === "running" ? workspaceAccessUrl(workspace) : null,
    };
  }

  async startEnvironment(workspace: Workspace) {
    const { objects } = this.clients();
    const patch = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: workspace.environment.deploymentName,
        namespace: workspace.environment.namespace,
      },
      spec: { replicas: 1 },
    } as V1Deployment;
    await this.patchDeployment(objects, patch);
  }

  async stopEnvironment(workspace: Workspace) {
    const { objects } = this.clients();
    const patch = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: workspace.environment.deploymentName,
        namespace: workspace.environment.namespace,
      },
      spec: { replicas: 0 },
    } as V1Deployment;
    await this.patchDeployment(objects, patch);
  }

  async restartEnvironment(workspace: Workspace) {
    const { objects } = this.clients();
    const patch = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: workspace.environment.deploymentName,
        namespace: workspace.environment.namespace,
      },
      spec: {
        template: {
          metadata: {
            annotations: { "cnad32.io/restarted-at": new Date().toISOString() },
          },
        },
      },
    } as unknown as V1Deployment;
    await this.patchDeployment(objects, patch);
  }

  /**
   * Lifecycle operations change a narrow Deployment field set with a strategic
   * merge patch. Force is deliberately undefined: Kubernetes accepts it only
   * for server-side apply and rejects `force=false` on a non-apply PATCH.
   */
  private async patchDeployment(
    objects: KubernetesObjectApi,
    patch: V1Deployment
  ) {
    await objects.patch(
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      PatchStrategy.StrategicMergePatch
    );
  }

  async deleteEnvironment(workspace: Workspace) {
    const { objects } = this.clients();
    try {
      await objects.delete(
        {
          apiVersion: "v1",
          kind: "Namespace",
          metadata: { name: workspace.environment.namespace },
        },
        undefined,
        undefined,
        0,
        undefined,
        "Foreground"
      );
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }

    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      try {
        await objects.read({
          apiVersion: "v1",
          kind: "Namespace",
          metadata: { name: workspace.environment.namespace },
        });
      } catch (error) {
        if (isNotFound(error)) return;
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    throw new Error(
      "Kubernetes cleanup is still in progress. The environment remains available for status checks until namespace deletion completes."
    );
  }

  async getLogs(workspace: Workspace, tailLines: number) {
    const status = await this.getEnvironmentStatus(workspace);
    if (!status.podName) {
      return {
        lines: [],
        source: "unavailable" as const,
        message: "No pod is available for this environment yet.",
      };
    }
    const { config } = this.clients();
    const chunks: Buffer[] = [];
    const output = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });
    const completed = new Promise<void>((resolve, reject) => {
      output.once("finish", resolve);
      output.once("error", reject);
    });
    const log = new Log(config);
    const controller = await log.log(
      workspace.environment.namespace,
      status.podName,
      "workspace",
      output,
      {
        follow: false,
        tailLines,
        timestamps: true,
        limitBytes: 250_000,
      }
    );
    await completed;
    controller.abort();
    return {
      lines: Buffer.concat(chunks).toString("utf8").split("\n").filter(Boolean),
      source: "kubernetes" as const,
      message: null,
    };
  }

  async getMetrics(workspace: Workspace): Promise<EnvironmentMetrics> {
    const { metrics } = this.clients();
    try {
      const response = await metrics.getPodMetrics(
        workspace.environment.namespace
      );
      const matchingPod = response.items.find(
        pod =>
          pod.metadata.labels?.["cnad32.io/environment-id"] ===
          String(workspace.environment.id)
      );
      if (!matchingPod)
        return {
          cpuMilliCores: null,
          memoryBytes: null,
          collectedAt: null,
          source: "unavailable",
        };
      return {
        cpuMilliCores: matchingPod.containers.reduce(
          (total, container) => total + cpuMilliCores(container.usage.cpu),
          0
        ),
        memoryBytes: matchingPod.containers.reduce(
          (total, container) => total + parseQuantity(container.usage.memory),
          0
        ),
        collectedAt: new Date(matchingPod.timestamp),
        source: "metrics-api",
      };
    } catch {
      return {
        cpuMilliCores: null,
        memoryBytes: null,
        collectedAt: null,
        source: "unavailable",
      };
    }
  }

  async getKubernetesEvents(workspace: Workspace) {
    const { objects } = this.clients();
    const response = await objects.list<CoreV1Event>(
      "v1",
      "Event",
      workspace.environment.namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      30
    );
    return response.items.map(event => ({
      type: event.type ?? "Normal",
      reason: event.reason ?? "Kubernetes",
      message: event.message ?? "No message provided.",
      createdAt:
        event.eventTime ??
        event.lastTimestamp ??
        event.firstTimestamp ??
        new Date().toISOString(),
    }));
  }

  async health() {
    let server: string | null = null;
    try {
      const clients = this.clients();
      server = clients.server;
      const { objects } = clients;
      await objects.list(
        "v1",
        "Namespace",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1
      );
      return {
        configured: true,
        healthy: true,
        message: "Kubernetes API is reachable.",
      };
    } catch (error) {
      const message =
        error instanceof KubernetesUnavailableError
          ? error.message
          : server
            ? explainKubernetesConnectionFailure(error, server)
            : asKubernetesMessage(error);
      return {
        configured: !(error instanceof KubernetesUnavailableError),
        healthy: false,
        message,
      };
    }
  }
}

export const kubernetesProvider = new KubernetesProvider();
