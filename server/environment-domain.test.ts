import { describe, expect, it } from "vitest";
import type { EnvironmentTemplate } from "../drizzle/schema";
import {
  canTransitionEnvironment,
  environmentResourceNames,
  validateEnvironmentConfiguration,
} from "./environment-domain";

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
  allowedPorts: [3000, 8080],
  configurationSchema: {},
  active: "true",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("environment lifecycle domain", () => {
  it("only permits the supported lifecycle transitions", () => {
    expect(canTransitionEnvironment("provisioning", "running")).toBe(true);
    expect(canTransitionEnvironment("running", "stopped")).toBe(true);
    expect(canTransitionEnvironment("stopped", "running")).toBe(true);
    expect(canTransitionEnvironment("running", "deleted")).toBe(true);
    expect(canTransitionEnvironment("deleted", "running")).toBe(false);
    expect(canTransitionEnvironment("provisioning", "stopped")).toBe(false);
  });

  it("creates deterministic, DNS-safe resource names without normalization collisions", () => {
    const first = environmentResourceNames(42, "Payments API");
    const second = environmentResourceNames(42, "payments_api");
    expect(first.namespace).toMatch(/^cnad-[a-z0-9-]+$/);
    expect(first.namespace.length).toBeLessThanOrEqual(63);
    expect(first.namespace).not.toBe(second.namespace);
  });

  it("rejects forbidden ports, over-limit resources, unsafe repositories, and invalid branches", () => {
    expect(() =>
      validateEnvironmentConfiguration(template, {
        cpuLimit: "3",
        memoryLimit: "1Gi",
        storageLimit: "5Gi",
        port: 3000,
      })
    ).toThrow(/CPU limit/);
    expect(() =>
      validateEnvironmentConfiguration(template, {
        cpuLimit: "500m",
        memoryLimit: "1Gi",
        storageLimit: "5Gi",
        port: 9000,
      })
    ).toThrow(/not allowed/);
    expect(() =>
      validateEnvironmentConfiguration(template, {
        cpuLimit: "500m",
        memoryLimit: "1Gi",
        storageLimit: "5Gi",
        port: 3000,
        repositoryUrl: "https://token@example.com/source.git",
      })
    ).toThrow(/credentials/);
    expect(() =>
      validateEnvironmentConfiguration(template, {
        cpuLimit: "500m",
        memoryLimit: "1Gi",
        storageLimit: "5Gi",
        port: 3000,
        branch: "main;rm -rf",
      })
    ).toThrow(/Branch/);
  });

  it("accepts a compliant template configuration", () => {
    expect(() =>
      validateEnvironmentConfiguration(template, {
        cpuLimit: "500m",
        memoryLimit: "1Gi",
        storageLimit: "5Gi",
        port: 3000,
        repositoryUrl: "https://github.com/acme/example.git",
        branch: "feature/workspace",
      })
    ).not.toThrow();
  });
});
