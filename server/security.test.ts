import { describe, expect, it } from "vitest";
import { rateLimit } from "./security";

function responseRecorder() {
  const state = {
    statusCode: 200,
    body: null as unknown,
    headers: new Map<string, string>(),
  };
  return {
    state,
    response: {
      setHeader: (name: string, value: string) =>
        state.headers.set(name, value),
      status: (code: number) => {
        state.statusCode = code;
        return {
          json: (body: unknown) => {
            state.body = body;
          },
        };
      },
    },
  };
}

describe("rateLimit", () => {
  it("returns a safe 429 response after the configured request threshold", () => {
    const middleware = rateLimit(60_000, 1, "test-limit");
    const request = { headers: {}, ip: "198.51.100.1" } as never;
    const first = responseRecorder();
    let continued = false;
    middleware(request, first.response as never, () => {
      continued = true;
    });
    expect(continued).toBe(true);
    const second = responseRecorder();
    middleware(request, second.response as never, () => undefined);
    expect(second.state.statusCode).toBe(429);
    expect(second.state.body).toEqual({
      error: "Too many requests. Please wait and retry.",
    });
  });
});
