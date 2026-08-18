import { beforeEach, describe, expect, it, vi } from "vitest";

const template = {
  id: 2,
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
} as const;

const failedEnvironment = {
  id: 44,
  userId: 7,
  name: "retry workspace",
  description: null,
  templateId: 2,
  status: "failed",
  runtime: "node",
  cpuLimit: "500m",
  memoryLimit: "1Gi",
  storageLimit: "5Gi",
  port: 3000,
  repositoryUrl: null,
  branch: null,
  namespace: "cnad-7-retry-workspace-test",
  deploymentName: "workspace",
  serviceName: "workspace",
  persistentVolumeClaimName: "workspace-data",
  accessUrl: null,
  failureReason: "Old cluster endpoint failure",
  createdAt: new Date(),
  updatedAt: new Date(),
  startedAt: null,
  stoppedAt: null,
  deletedAt: null,
} as const;

vi.mock("./db", () => ({
  createAuditLog: vi.fn(),
  createEnvironmentEvent: vi.fn(),
  createEnvironmentRecord: vi.fn(),
  getActiveTemplateById: vi.fn(),
  getDashboardSummary: vi.fn(),
  getEnvironmentByNameForUser: vi.fn(),
  getEnvironmentForUser: vi.fn(),
  getEnvironmentWithTemplate: vi.fn(),
  listActiveTemplates: vi.fn(),
  listAuditLogsForResource: vi.fn(),
  listEnvironmentEvents: vi.fn(),
  listEnvironmentsForUser: vi.fn(),
  listRecentAuditActivity: vi.fn(),
  setEnvironmentStatus: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("./kubernetes", () => ({
  KubernetesUnavailableError: class KubernetesUnavailableError extends Error {},
  kubernetesProvider: {
    createEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
    getEnvironmentStatus: vi.fn(),
    getKubernetesEvents: vi.fn(),
    getLogs: vi.fn(),
    getMetrics: vi.fn(),
    health: vi.fn(),
    restartEnvironment: vi.fn(),
    startEnvironment: vi.fn(),
    stopEnvironment: vi.fn(),
  },
}));

import {
  createAuditLog,
  createEnvironmentEvent,
  createEnvironmentRecord,
  getActiveTemplateById,
  getEnvironmentByNameForUser,
  getEnvironmentWithTemplate,
  setEnvironmentStatus,
} from "./db";
import { kubernetesProvider } from "./kubernetes";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextForUser(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "retry-test-user",
      name: "Retry Test",
      email: null,
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("environment.create failed-workspace retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveTemplateById).mockResolvedValue(template as never);
    vi.mocked(createEnvironmentRecord).mockRejectedValue({
      code: "ER_DUP_ENTRY",
    });
    vi.mocked(getEnvironmentByNameForUser).mockResolvedValue(
      failedEnvironment as never
    );
    vi.mocked(getEnvironmentWithTemplate).mockResolvedValue({
      environment: { ...failedEnvironment, status: "provisioning" },
      template,
    } as never);
    vi.mocked(kubernetesProvider.createEnvironment).mockResolvedValue({
      status: "provisioning",
      health: {
        deploymentAvailable: false,
        readyReplicas: 0,
        desiredReplicas: 1,
        podPhase: "Pending",
        lastCheckedAt: new Date(),
      },
      podName: null,
      failureReason: null,
      accessUrl: null,
    });
  });

  it("reuses a failed same-name environment and returns an accepted provisioning response", async () => {
    const caller = appRouter.createCaller(contextForUser());
    const result = await caller.environment.create({
      name: "retry workspace",
      templateId: 2,
    });

    expect(result).toEqual({
      environmentId: 44,
      status: "provisioning",
      ready: false,
    });
    expect(getEnvironmentByNameForUser).toHaveBeenCalledWith(
      7,
      "retry workspace"
    );
    expect(setEnvironmentStatus).toHaveBeenCalledWith(
      expect.objectContaining({ environmentId: 44, status: "provisioning" })
    );
    expect(createEnvironmentEvent).toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalled();
    expect(kubernetesProvider.createEnvironment).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: expect.objectContaining({ id: 44 }),
      })
    );
  });
});
