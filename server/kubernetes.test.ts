import { describe, expect, it, vi } from "vitest";
import { PatchStrategy } from "@kubernetes/client-node";
import type { Environment, EnvironmentTemplate } from "../drizzle/schema";
import {
  explainKubernetesConnectionFailure,
  KubernetesProvider,
  KubernetesUnavailableError,
  resolveKubernetesServerUrl,
} from "./kubernetes";

const environment: Environment = {
  id: 7,
  userId: 3,
  name: "Billing API",
  description: null,
  templateId: 1,
  status: "provisioning",
  runtime: "node",
  cpuLimit: "500m",
  memoryLimit: "1Gi",
  storageLimit: "5Gi",
  port: 3000,
  repositoryUrl: null,
  branch: null,
  namespace: "cnad-3-billing-api-test",
  deploymentName: "workspace",
  serviceName: "workspace",
  persistentVolumeClaimName: "workspace-data",
  accessUrl: null,
  failureReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  startedAt: null,
  stoppedAt: null,
  deletedAt: null,
};

const template: EnvironmentTemplate = {
  id: 1,
  name: "Node.js Workspace",
  slug: "node",
  description: "Test template",
  runtime: "node",
  image: "node:22-bookworm-slim",
  defaultCpu: "500m",
  maxCpu: "2",
  defaultMemory: "1Gi",
  maxMemory: "4Gi",
  defaultStorage: "5Gi",
  maxStorage: "20Gi",
  allowedPorts: [3000],
  configurationSchema: {},
  active: "true",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("KubernetesProvider resource construction", () => {
  it("normalizes a bare Minikube host to HTTPS when TLS verification is enabled", () => {
    expect(resolveKubernetesServerUrl("127.0.0.1:8443", false)).toBe(
      "https://127.0.0.1:8443"
    );
    expect(resolveKubernetesServerUrl("https://127.0.0.1:8443", false)).toBe(
      "https://127.0.0.1:8443"
    );
  });

  it("upgrades an explicit HTTP Minikube endpoint to HTTPS when TLS verification is required", () => {
    expect(resolveKubernetesServerUrl("http://127.0.0.1:8443", false)).toBe(
      "https://127.0.0.1:8443"
    );
  });

  it("explains when a hosted process cannot reach a loopback Minikube API", () => {
    expect(
      explainKubernetesConnectionFailure(
        new Error("Failed to fetch resource metadata: fetch failed"),
        "https://127.0.0.1:8443"
      )
    ).toContain("same machine as Minikube");
  });

  it("creates the isolated namespace resource set with a hardened workspace pod", () => {
    const provider = new KubernetesProvider() as unknown as {
      resources: (workspace: {
        environment: Environment;
        template: EnvironmentTemplate;
      }) => Record<string, any>;
    };
    const resources = provider.resources({ environment, template });
    const podSpec = resources.deployment.spec.template.spec;
    const container = podSpec.containers[0];

    expect(resources.namespace.kind).toBe("Namespace");
    expect(resources.resourceQuota.kind).toBe("ResourceQuota");
    expect(resources.limitRange.kind).toBe("LimitRange");
    expect(resources.persistentVolumeClaim.kind).toBe("PersistentVolumeClaim");
    expect(resources.deployment.kind).toBe("Deployment");
    expect(resources.service.kind).toBe("Service");
    expect(resources.networkPolicy.kind).toBe("NetworkPolicy");
    expect(podSpec.automountServiceAccountToken).toBe(false);
    expect(podSpec.securityContext.runAsNonRoot).toBe(true);
    expect(container.securityContext.allowPrivilegeEscalation).toBe(false);
    expect(container.securityContext.readOnlyRootFilesystem).toBe(true);
    expect(container.securityContext.capabilities.drop).toEqual(["ALL"]);
    expect(container.resources.limits).toEqual({ cpu: "500m", memory: "1Gi" });
  });

  it("uses strategic-merge PATCH without apply-only force or field-manager options for all lifecycle mutations", async () => {
    const patch = vi.fn().mockResolvedValue({});
    const provider = new KubernetesProvider() as unknown as {
      clients: () => { objects: { patch: typeof patch } };
      startEnvironment: (workspace: {
        environment: Environment;
        template: EnvironmentTemplate;
      }) => Promise<void>;
      stopEnvironment: (workspace: {
        environment: Environment;
        template: EnvironmentTemplate;
      }) => Promise<void>;
      restartEnvironment: (workspace: {
        environment: Environment;
        template: EnvironmentTemplate;
      }) => Promise<void>;
    };
    provider.clients = () => ({ objects: { patch } });
    const workspace = { environment, template };

    await provider.startEnvironment(workspace);
    await provider.stopEnvironment(workspace);
    await provider.restartEnvironment(workspace);

    expect(patch).toHaveBeenCalledTimes(3);
    for (const call of patch.mock.calls) {
      expect(call.slice(1)).toEqual([
        undefined,
        undefined,
        undefined,
        undefined,
        PatchStrategy.StrategicMergePatch,
      ]);
      expect(call[0]).toMatchObject({
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: { name: "workspace", namespace: environment.namespace },
      });
    }
  });

  it("treats a Kubernetes 404 during temporary namespace deletion as successful idempotent cleanup", async () => {
    const notFound = Object.assign(
      new Error('namespaces "cnad-e2e" not found'),
      {
        statusCode: 404,
      }
    );
    const removeNamespace = vi.fn().mockRejectedValue(notFound);
    const readNamespace = vi.fn();
    const provider = new KubernetesProvider() as unknown as {
      clients: () => {
        objects: { delete: typeof removeNamespace; read: typeof readNamespace };
      };
      deleteEnvironment: (workspace: {
        environment: Environment;
        template: EnvironmentTemplate;
      }) => Promise<void>;
    };
    provider.clients = () => ({
      objects: { delete: removeNamespace, read: readNamespace },
    });

    await expect(
      provider.deleteEnvironment({ environment, template })
    ).resolves.toBeUndefined();
    expect(removeNamespace).toHaveBeenCalledTimes(1);
    expect(readNamespace).not.toHaveBeenCalled();
  });
});
