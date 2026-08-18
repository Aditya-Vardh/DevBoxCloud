import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getEnvironmentForUser: vi.fn() };
});

import { getEnvironmentForUser } from "./db";
import { appRouter } from "./routers";
import { canAccessEnvironment } from "./routers/environments";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "user" | "admin"): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "authorization-test-user",
      name: "Authorization test user",
      email: null,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("CNAD32 authorization", () => {
  beforeEach(() => {
    vi.mocked(getEnvironmentForUser).mockReset();
  });

  it("rejects the administrator overview for a standard user before any platform query runs", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.admin.overview()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows only the owning user or an administrator to access an environment", () => {
    expect(canAccessEnvironment({ id: 7, role: "user" }, 7)).toBe(true);
    expect(canAccessEnvironment({ id: 7, role: "user" }, 8)).toBe(false);
    expect(canAccessEnvironment({ id: 7, role: "admin" }, 8)).toBe(true);
  });

  it("returns a non-disclosing rejection when a non-owner requests environment events", async () => {
    vi.mocked(getEnvironmentForUser).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(
      caller.environment.events({ environmentId: 44 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(getEnvironmentForUser).toHaveBeenCalledWith(44, 7);
  });
});
