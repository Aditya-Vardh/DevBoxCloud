import { afterEach, describe, expect, it } from "vitest";
import { isLocalAuthRequest } from "./_core/localAuth";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("local authentication guard", () => {
  it("allows only loopback development requests", () => {
    process.env.NODE_ENV = "development";
    expect(
      isLocalAuthRequest({
        hostname: "localhost",
        socket: { remoteAddress: "127.0.0.1" },
      } as any)
    ).toBe(true);
    expect(
      isLocalAuthRequest({
        hostname: "127.0.0.1",
        socket: { remoteAddress: "::1" },
      } as any)
    ).toBe(true);
    expect(
      isLocalAuthRequest({
        hostname: "example.test",
        socket: { remoteAddress: "127.0.0.1" },
      } as any)
    ).toBe(false);
  });

  it("remains unavailable in production even for loopback hosts", () => {
    process.env.NODE_ENV = "production";
    expect(
      isLocalAuthRequest({
        hostname: "localhost",
        socket: { remoteAddress: "127.0.0.1" },
      } as any)
    ).toBe(false);
  });
});
