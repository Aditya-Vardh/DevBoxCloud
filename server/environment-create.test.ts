import { describe, expect, it } from "vitest";
import { isDuplicateError } from "./routers/environments";

describe("environment creation database errors", () => {
  it("recognizes direct and nested TiDB/MySQL duplicate-key errors", () => {
    expect(isDuplicateError({ code: "ER_DUP_ENTRY" })).toBe(true);
    expect(isDuplicateError({ errno: 1062 })).toBe(true);
    expect(isDuplicateError({ cause: { code: 1062 } })).toBe(true);
    expect(
      isDuplicateError(new Error("Duplicate entry 'the one' for key"))
    ).toBe(true);
  });

  it("does not misclassify unrelated persistence errors as conflicts", () => {
    expect(isDuplicateError(new Error("Connection lost"))).toBe(false);
  });
});
