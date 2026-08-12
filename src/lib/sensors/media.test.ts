import { describe, expect, it } from "vitest";
import { classifyMediaError } from "./media";

describe("media permission error mapping", () => {
  it.each([
    ["NotAllowedError", "permission_denied"],
    ["NotFoundError", "device_missing"],
    ["NotReadableError", "device_busy"],
    ["OverconstrainedError", "constraints_unavailable"],
  ])("maps %s to %s", (name, code) => {
    expect(classifyMediaError({ name }).code).toBe(code);
  });

  it("keeps unknown failures safe", () => {
    expect(classifyMediaError(new Error("other")).code).toBe("unknown");
  });
});
