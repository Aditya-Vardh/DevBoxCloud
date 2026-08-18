import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";

describe("session cookie options", () => {
  it("uses Lax and non-secure cookies for localhost HTTP development", () => {
    expect(
      getSessionCookieOptions({ protocol: "http", headers: {} } as any)
    ).toMatchObject({ sameSite: "lax", secure: false, httpOnly: true });
  });

  it("retains secure SameSite=None cookies for hosted HTTPS OAuth", () => {
    expect(
      getSessionCookieOptions({ protocol: "https", headers: {} } as any)
    ).toMatchObject({ sameSite: "none", secure: true, httpOnly: true });
  });
});
