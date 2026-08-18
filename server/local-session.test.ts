import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

describe("local development session", () => {
  const originalAppId = ENV.appId;

  afterEach(() => {
    ENV.appId = originalAppId;
  });

  it("creates a verifiable session when hosted OAuth app variables are absent", async () => {
    ENV.appId = "";
    const token = await sdk.createSessionToken("local:operator", {
      name: "Local Operator",
    });
    await expect(sdk.verifySession(token)).resolves.toEqual({
      openId: "local:operator",
      appId: "cnad32-local-development",
      name: "Local Operator",
    });
  });
});
