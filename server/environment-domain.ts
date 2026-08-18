import type { EnvironmentTemplate } from "../drizzle/schema";
import type { EnvironmentStatus } from "../shared/cnad";
import { createHash } from "node:crypto";

const cpuQuantityPattern =
  /^(?:[1-9]\d{0,3}m|(?:0\.[1-9]\d*|[1-9]\d*)(?:\.\d+)?)$/;
const binaryQuantityPattern = /^[1-9]\d*(?:Mi|Gi)$/;
const branchPattern = /^[A-Za-z0-9._/-]{1,255}$/;

export const lifecycleTransitions: Record<
  EnvironmentStatus,
  readonly EnvironmentStatus[]
> = {
  provisioning: ["running", "failed", "deleted"],
  running: ["stopped", "deleted", "failed"],
  stopped: ["running", "deleted", "failed"],
  failed: ["provisioning", "deleted"],
  deleted: [],
};

export function canTransitionEnvironment(
  currentStatus: EnvironmentStatus,
  nextStatus: EnvironmentStatus
): boolean {
  return lifecycleTransitions[currentStatus].includes(nextStatus);
}

export function kubernetesName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || "environment";
}

export function environmentResourceNames(
  userId: number,
  environmentName: string
) {
  const fingerprint = createHash("sha256")
    .update(`${userId}:${environmentName}`)
    .digest("hex")
    .slice(0, 7);
  const suffix =
    `${userId}-${kubernetesName(environmentName)}-${fingerprint}`.slice(0, 52);
  const baseName = `cnad-${suffix}`.slice(0, 63).replace(/-+$/g, "");

  return {
    namespace: baseName,
    deploymentName: "workspace",
    serviceName: "workspace",
    persistentVolumeClaimName: "workspace-data",
  };
}

export function cpuMilliCores(value: string): number {
  if (!cpuQuantityPattern.test(value)) {
    throw new Error("CPU must be a valid Kubernetes CPU quantity.");
  }
  return value.endsWith("m")
    ? Number(value.slice(0, -1))
    : Number(value) * 1000;
}

export function binaryBytes(value: string): number {
  if (!binaryQuantityPattern.test(value)) {
    throw new Error("Memory and storage must use Mi or Gi quantities.");
  }
  const quantity = Number(value.slice(0, -2));
  return value.endsWith("Gi") ? quantity * 1024 ** 3 : quantity * 1024 ** 2;
}

export function validateEnvironmentConfiguration(
  template: EnvironmentTemplate,
  input: {
    cpuLimit: string;
    memoryLimit: string;
    storageLimit: string;
    port: number;
    repositoryUrl?: string | null;
    branch?: string | null;
  }
) {
  if (cpuMilliCores(input.cpuLimit) > cpuMilliCores(template.maxCpu)) {
    throw new Error(`CPU limit exceeds the ${template.name} template maximum.`);
  }
  if (binaryBytes(input.memoryLimit) > binaryBytes(template.maxMemory)) {
    throw new Error(
      `Memory limit exceeds the ${template.name} template maximum.`
    );
  }
  if (binaryBytes(input.storageLimit) > binaryBytes(template.maxStorage)) {
    throw new Error(
      `Storage limit exceeds the ${template.name} template maximum.`
    );
  }
  if (!template.allowedPorts.includes(input.port)) {
    throw new Error(
      `Port ${input.port} is not allowed by the ${template.name} template.`
    );
  }
  if (input.branch && !branchPattern.test(input.branch)) {
    throw new Error("Branch contains unsupported characters.");
  }
  if (input.repositoryUrl) {
    let parsed: URL;
    try {
      parsed = new URL(input.repositoryUrl);
    } catch {
      throw new Error("Repository URL must be a valid HTTPS URL.");
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      throw new Error(
        "Repository URL must be public HTTPS without embedded credentials."
      );
    }
  }
}
