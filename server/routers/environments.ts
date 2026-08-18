import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createAuditLog,
  createEnvironmentEvent,
  createEnvironmentRecord,
  getActiveTemplateById,
  getDashboardSummary,
  getEnvironmentByNameForUser,
  getEnvironmentForUser,
  getEnvironmentWithTemplate,
  listActiveTemplates,
  listAuditLogsForResource,
  listEnvironmentEvents,
  listEnvironmentsForUser,
  listRecentAuditActivity,
  setEnvironmentStatus,
} from "../db";
import {
  canTransitionEnvironment,
  environmentResourceNames,
  validateEnvironmentConfiguration,
} from "../environment-domain";
import { KubernetesUnavailableError, kubernetesProvider } from "../kubernetes";
import { protectedProcedure, router } from "../_core/trpc";

const environmentIdInput = z.object({
  environmentId: z.number().int().positive(),
});
const runtimeValues = ["node", "python", "go", "ubuntu", "java"] as const;
const statusValues = [
  "provisioning",
  "running",
  "stopped",
  "deleted",
  "failed",
] as const;

const createEnvironmentInput = z.object({
  name: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9 _.-]*$/,
      "Use letters, numbers, spaces, periods, hyphens, or underscores."
    ),
  description: z.string().trim().max(512).optional(),
  templateId: z.number().int().positive(),
  cpuLimit: z.string().trim().max(24).optional(),
  memoryLimit: z.string().trim().max(24).optional(),
  storageLimit: z.string().trim().max(24).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  repositoryUrl: z.string().trim().max(2048).optional(),
  branch: z.string().trim().max(255).optional(),
});

function safeErrorMessage(error: unknown) {
  if (error instanceof KubernetesUnavailableError) return error.message;
  if (error instanceof Error) return error.message.slice(0, 900);
  return "The requested operation could not be completed.";
}

export function isDuplicateError(error: unknown) {
  let candidate = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (!candidate || typeof candidate !== "object") return false;
    const detail = candidate as {
      code?: string | number;
      errno?: number;
      message?: string;
      cause?: unknown;
      originalError?: unknown;
    };
    if (
      detail.code === "ER_DUP_ENTRY" ||
      detail.code === 1062 ||
      detail.errno === 1062 ||
      /duplicate entry|unique constraint/i.test(detail.message ?? "")
    ) {
      return true;
    }
    candidate = detail.cause ?? detail.originalError;
  }
  return false;
}

export function canAccessEnvironment(
  user: { id: number; role: "user" | "admin" },
  ownerId: number
) {
  return user.role === "admin" || user.id === ownerId;
}

async function workspaceForRequest(
  environmentId: number,
  user: { id: number; role: "user" | "admin" }
) {
  const workspace =
    user.role === "admin"
      ? await getEnvironmentWithTemplate(environmentId)
      : await getEnvironmentForUser(environmentId, user.id);
  if (!workspace) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Environment not found.",
    });
  }
  if (!canAccessEnvironment(user, workspace.environment.userId)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Environment not found.",
    });
  }
  return workspace;
}

async function persistObservedStatus(
  workspace: Awaited<ReturnType<typeof workspaceForRequest>>
) {
  const observed = await kubernetesProvider.getEnvironmentStatus(workspace);
  const current = workspace.environment.status;
  if (observed.status === "failed" && current !== "deleted") {
    await setEnvironmentStatus({
      environmentId: workspace.environment.id,
      status: "failed",
      failureReason: observed.failureReason,
    });
    await createEnvironmentEvent({
      environmentId: workspace.environment.id,
      eventType: "error",
      status: "failed",
      message:
        observed.failureReason ?? "Kubernetes reported a failed workload.",
    });
  } else if (
    observed.status !== current &&
    canTransitionEnvironment(current, observed.status)
  ) {
    await setEnvironmentStatus({
      environmentId: workspace.environment.id,
      status: observed.status,
      failureReason: observed.failureReason,
      accessUrl: observed.accessUrl,
    });
    await createEnvironmentEvent({
      environmentId: workspace.environment.id,
      eventType: "status_changed",
      status: observed.status,
      message: `Kubernetes confirmed this environment is ${observed.status}.`,
    });
  }
  return observed;
}

export const environmentRouter = router({
  templates: protectedProcedure.query(async () => listActiveTemplates()),

  dashboard: protectedProcedure.query(async ({ ctx }) => ({
    summary: await getDashboardSummary(ctx.user.id),
    recentActivity: await listRecentAuditActivity(ctx.user.id),
  })),

  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(statusValues).optional(),
        runtime: z.enum(runtimeValues).optional(),
        query: z.string().trim().max(64).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) =>
      listEnvironmentsForUser({ userId: ctx.user.id, ...input })
    ),

  create: protectedProcedure
    .input(createEnvironmentInput)
    .mutation(async ({ ctx, input }) => {
      const template = await getActiveTemplateById(input.templateId);
      if (!template) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Select an active environment template.",
        });
      }

      const configuration = {
        cpuLimit: input.cpuLimit ?? template.defaultCpu,
        memoryLimit: input.memoryLimit ?? template.defaultMemory,
        storageLimit: input.storageLimit ?? template.defaultStorage,
        port: input.port ?? template.allowedPorts[0],
        repositoryUrl: input.repositoryUrl || null,
        branch: input.branch || null,
      };

      try {
        validateEnvironmentConfiguration(template, configuration);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: safeErrorMessage(error),
        });
      }

      const names = environmentResourceNames(ctx.user.id, input.name);
      let environmentId: number;
      try {
        environmentId = await createEnvironmentRecord({
          userId: ctx.user.id,
          name: input.name,
          description: input.description || null,
          templateId: template.id,
          status: "provisioning",
          runtime: template.runtime,
          cpuLimit: configuration.cpuLimit,
          memoryLimit: configuration.memoryLimit,
          storageLimit: configuration.storageLimit,
          port: configuration.port,
          repositoryUrl: configuration.repositoryUrl,
          branch: configuration.branch,
          ...names,
        });
      } catch (error) {
        if (isDuplicateError(error)) {
          const existing = await getEnvironmentByNameForUser(
            ctx.user.id,
            input.name
          );
          if (existing?.status === "failed") {
            environmentId = existing.id;
            await setEnvironmentStatus({
              environmentId,
              status: "provisioning",
              failureReason: null,
              accessUrl: null,
            });
            await createEnvironmentEvent({
              environmentId,
              eventType: "status_changed",
              status: "provisioning",
              message:
                "Retrying the failed environment with the existing validated configuration.",
            });
            await createAuditLog({
              userId: ctx.user.id,
              action: "environment.retry_provisioning",
              resourceType: "environment",
              resourceId: String(environmentId),
            });
          } else {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "An active environment already uses this name. Open it or choose a different name.",
            });
          }
        } else {
          console.error("[CNAD32] Environment record creation failed", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "The environment record could not be created.",
          });
        }
      }

      await createEnvironmentEvent({
        environmentId,
        eventType: "created",
        status: "provisioning",
        message: "Configuration validated. Creating Kubernetes resources.",
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "environment.created",
        resourceType: "environment",
        resourceId: String(environmentId),
      });

      const workspace = await getEnvironmentWithTemplate(environmentId);
      if (!workspace) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The newly created environment could not be loaded.",
        });
      }

      try {
        const observed = await kubernetesProvider.createEnvironment(workspace);
        if (observed.status === "running") {
          await setEnvironmentStatus({
            environmentId,
            status: "running",
            accessUrl: observed.accessUrl,
          });
          await createEnvironmentEvent({
            environmentId,
            eventType: "status_changed",
            status: "running",
            message: "Kubernetes confirmed the workspace is ready.",
          });
        } else {
          await createEnvironmentEvent({
            environmentId,
            eventType: "status_changed",
            status: "provisioning",
            message:
              "Kubernetes resources were accepted. Waiting for readiness.",
          });
        }
        return {
          environmentId,
          status: observed.status,
          ready: observed.status === "running",
        };
      } catch (error) {
        const message = safeErrorMessage(error);
        await setEnvironmentStatus({
          environmentId,
          status: "failed",
          failureReason: message,
        });
        await createEnvironmentEvent({
          environmentId,
          eventType: "error",
          status: "failed",
          message,
        });
        await createAuditLog({
          userId: ctx.user.id,
          action: "environment.error",
          resourceType: "environment",
          resourceId: String(environmentId),
          metadata: { operation: "create" },
        });
        throw new TRPCError({
          code:
            error instanceof KubernetesUnavailableError
              ? "PRECONDITION_FAILED"
              : "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  detail: protectedProcedure
    .input(environmentIdInput)
    .query(async ({ ctx, input }) => {
      const workspace = await workspaceForRequest(
        input.environmentId,
        ctx.user
      );
      try {
        const kubernetes = await persistObservedStatus(workspace);
        const current = await workspaceForRequest(
          input.environmentId,
          ctx.user
        );
        return { ...current, kubernetes };
      } catch (error) {
        if (error instanceof KubernetesUnavailableError) {
          return {
            ...workspace,
            kubernetes: null,
            kubernetesError: error.message,
          };
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: safeErrorMessage(error),
        });
      }
    }),

  health: protectedProcedure
    .input(environmentIdInput)
    .query(async ({ ctx, input }) => {
      const workspace = await workspaceForRequest(
        input.environmentId,
        ctx.user
      );
      try {
        return await persistObservedStatus(workspace);
      } catch (error) {
        throw new TRPCError({
          code:
            error instanceof KubernetesUnavailableError
              ? "PRECONDITION_FAILED"
              : "INTERNAL_SERVER_ERROR",
          message: safeErrorMessage(error),
        });
      }
    }),

  start: protectedProcedure
    .input(environmentIdInput)
    .mutation(async ({ ctx, input }) => {
      const workspace = await workspaceForRequest(
        input.environmentId,
        ctx.user
      );
      if (workspace.environment.status !== "stopped") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only stopped environments can be started.",
        });
      }
      try {
        await kubernetesProvider.startEnvironment(workspace);
        await createEnvironmentEvent({
          environmentId: input.environmentId,
          eventType: "started",
          status: "stopped",
          message: "Start accepted by Kubernetes. Waiting for readiness.",
        });
        await createAuditLog({
          userId: ctx.user.id,
          action: "environment.started",
          resourceType: "environment",
          resourceId: String(input.environmentId),
        });
        return { accepted: true };
      } catch (error) {
        const message = safeErrorMessage(error);
        await createEnvironmentEvent({
          environmentId: input.environmentId,
          eventType: "error",
          status: workspace.environment.status,
          message,
        });
        throw new TRPCError({
          code:
            error instanceof KubernetesUnavailableError
              ? "PRECONDITION_FAILED"
              : "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  stop: protectedProcedure
    .input(environmentIdInput)
    .mutation(async ({ ctx, input }) => {
      const workspace = await workspaceForRequest(
        input.environmentId,
        ctx.user
      );
      if (workspace.environment.status !== "running") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only running environments can be stopped.",
        });
      }
      try {
        await kubernetesProvider.stopEnvironment(workspace);
        await createEnvironmentEvent({
          environmentId: input.environmentId,
          eventType: "stopped",
          status: "running",
          message:
            "Stop accepted by Kubernetes. Waiting for all replicas to terminate.",
        });
        await createAuditLog({
          userId: ctx.user.id,
          action: "environment.stopped",
          resourceType: "environment",
          resourceId: String(input.environmentId),
        });
        return { accepted: true };
      } catch (error) {
        const message = safeErrorMessage(error);
        await createEnvironmentEvent({
          environmentId: input.environmentId,
          eventType: "error",
          status: workspace.environment.status,
          message,
        });
        throw new TRPCError({
          code:
            error instanceof KubernetesUnavailableError
              ? "PRECONDITION_FAILED"
              : "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  restart: protectedProcedure
    .input(environmentIdInput)
    .mutation(async ({ ctx, input }) => {
      const workspace = await workspaceForRequest(
        input.environmentId,
        ctx.user
      );
      if (workspace.environment.status !== "running") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only running environments can be restarted.",
        });
      }
      try {
        await kubernetesProvider.restartEnvironment(workspace);
        await createEnvironmentEvent({
          environmentId: input.environmentId,
          eventType: "restarted",
          status: "running",
          message:
            "Restart accepted by Kubernetes. Monitoring new pod readiness.",
        });
        await createAuditLog({
          userId: ctx.user.id,
          action: "environment.restarted",
          resourceType: "environment",
          resourceId: String(input.environmentId),
        });
        return { accepted: true };
      } catch (error) {
        const message = safeErrorMessage(error);
        await createEnvironmentEvent({
          environmentId: input.environmentId,
          eventType: "error",
          status: workspace.environment.status,
          message,
        });
        throw new TRPCError({
          code:
            error instanceof KubernetesUnavailableError
              ? "PRECONDITION_FAILED"
              : "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  delete: protectedProcedure
    .input(environmentIdInput)
    .mutation(async ({ ctx, input }) => {
      const workspace = await workspaceForRequest(
        input.environmentId,
        ctx.user
      );
      if (workspace.environment.status === "deleted") {
        return { deleted: true };
      }
      try {
        await kubernetesProvider.deleteEnvironment(workspace);
        await setEnvironmentStatus({
          environmentId: input.environmentId,
          status: "deleted",
        });
        await createEnvironmentEvent({
          environmentId: input.environmentId,
          eventType: "deleted",
          status: "deleted",
          message: "Kubernetes confirmed namespace cleanup completed.",
        });
        await createAuditLog({
          userId: ctx.user.id,
          action: "environment.deleted",
          resourceType: "environment",
          resourceId: String(input.environmentId),
        });
        return { deleted: true };
      } catch (error) {
        const message = safeErrorMessage(error);
        await createEnvironmentEvent({
          environmentId: input.environmentId,
          eventType: "error",
          status: workspace.environment.status,
          message,
        });
        throw new TRPCError({
          code:
            error instanceof KubernetesUnavailableError
              ? "PRECONDITION_FAILED"
              : "TIMEOUT",
          message,
        });
      }
    }),

  events: protectedProcedure
    .input(environmentIdInput)
    .query(async ({ ctx, input }) => {
      await workspaceForRequest(input.environmentId, ctx.user);
      return listEnvironmentEvents(input.environmentId);
    }),

  audit: protectedProcedure
    .input(environmentIdInput)
    .query(async ({ ctx, input }) => {
      await workspaceForRequest(input.environmentId, ctx.user);
      return listAuditLogsForResource(
        "environment",
        String(input.environmentId)
      );
    }),

  kubernetesEvents: protectedProcedure
    .input(environmentIdInput)
    .query(async ({ ctx, input }) => {
      const workspace = await workspaceForRequest(
        input.environmentId,
        ctx.user
      );
      try {
        return await kubernetesProvider.getKubernetesEvents(workspace);
      } catch (error) {
        throw new TRPCError({
          code:
            error instanceof KubernetesUnavailableError
              ? "PRECONDITION_FAILED"
              : "INTERNAL_SERVER_ERROR",
          message: safeErrorMessage(error),
        });
      }
    }),

  logs: protectedProcedure
    .input(
      environmentIdInput.extend({
        tailLines: z.number().int().min(10).max(1000).default(250),
      })
    )
    .query(async ({ ctx, input }) => {
      const workspace = await workspaceForRequest(
        input.environmentId,
        ctx.user
      );
      try {
        return await kubernetesProvider.getLogs(workspace, input.tailLines);
      } catch (error) {
        throw new TRPCError({
          code:
            error instanceof KubernetesUnavailableError
              ? "PRECONDITION_FAILED"
              : "INTERNAL_SERVER_ERROR",
          message: safeErrorMessage(error),
        });
      }
    }),

  metrics: protectedProcedure
    .input(environmentIdInput)
    .query(async ({ ctx, input }) => {
      const workspace = await workspaceForRequest(
        input.environmentId,
        ctx.user
      );
      try {
        return kubernetesProvider.getMetrics(workspace);
      } catch (error) {
        throw new TRPCError({
          code:
            error instanceof KubernetesUnavailableError
              ? "PRECONDITION_FAILED"
              : "INTERNAL_SERVER_ERROR",
          message: safeErrorMessage(error),
        });
      }
    }),

  platformHealth: protectedProcedure.query(async () =>
    kubernetesProvider.health()
  ),
});
