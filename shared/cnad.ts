export const environmentStatuses = [
  "provisioning",
  "running",
  "stopped",
  "deleted",
  "failed",
] as const;

export type EnvironmentStatus = (typeof environmentStatuses)[number];

export const environmentRuntimes = [
  "node",
  "python",
  "go",
  "ubuntu",
  "java",
] as const;

export type EnvironmentRuntime = (typeof environmentRuntimes)[number];

export const environmentEventTypes = [
  "created",
  "started",
  "stopped",
  "restarted",
  "deleted",
  "error",
  "status_changed",
] as const;

export type EnvironmentEventType = (typeof environmentEventTypes)[number];

export const auditActions = [
  "login",
  "logout",
  "environment.created",
  "environment.started",
  "environment.stopped",
  "environment.restarted",
  "environment.deleted",
  "environment.error",
  "template.updated",
  "role.updated",
] as const;

export type AuditAction = (typeof auditActions)[number];

export const statusLabels: Record<EnvironmentStatus, string> = {
  provisioning: "Provisioning",
  running: "Running",
  stopped: "Stopped",
  deleted: "Deleted",
  failed: "Failed",
};

export const dashboardNavigation = [
  { label: "Overview", path: "/", capability: "dashboard" },
  { label: "Environments", path: "/environments", capability: "environments" },
  { label: "Templates", path: "/templates", capability: "templates" },
  { label: "Activity", path: "/activity", capability: "activity" },
  { label: "Platform", path: "/platform", capability: "admin" },
] as const;

export type EnvironmentResourceConfig = {
  cpu: string;
  memory: string;
  storage: string;
  port: number;
};

export type EnvironmentMetrics = {
  cpuMilliCores: number | null;
  memoryBytes: number | null;
  collectedAt: Date | null;
  source: "metrics-api" | "unavailable";
};

export type EnvironmentHealth = {
  deploymentAvailable: boolean;
  readyReplicas: number;
  desiredReplicas: number;
  podPhase: string | null;
  lastCheckedAt: Date;
};
