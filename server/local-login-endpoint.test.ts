import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type CookieWrite = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

describe("auth.localLogin", () => {
  it("creates a localhost-compatible signed session cookie and returns the local operator", async () => {
    const cookies: CookieWrite[] = [];
    const req = {
      protocol: "http",
      hostname: "localhost",
      socket: { remoteAddress: "127.0.0.1" },
      headers: {},
    } as unknown as TrpcContext["req"];
    const ctx = {
      user: null,
      req,
      res: {
        cookie: (
          name: string,
          value: string,
          options: Record<string, unknown>
        ) => {
          cookies.push({ name, value, options });
        },
      },
    } as unknown as TrpcContext;

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.localLogin();

    expect(result.user.openId).toBe("local:operator");
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({
      name: "app_session_id",
      options: { path: "/", sameSite: "lax", secure: false, httpOnly: true },
    });
    expect(cookies[0]?.value.split(".")).toHaveLength(3);
  });

  it("rejects a non-loopback request without issuing a session", async () => {
    const cookie = vi.fn();
    const ctx = {
      user: null,
      req: {
        protocol: "http",
        hostname: "example.test",
        socket: { remoteAddress: "198.51.100.8" },
        headers: {},
      },
      res: { cookie },
    } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.localLogin()).rejects.toThrow(
      "Local authentication is available only on localhost development servers."
    );
    expect(cookie).not.toHaveBeenCalled();
  });
});
