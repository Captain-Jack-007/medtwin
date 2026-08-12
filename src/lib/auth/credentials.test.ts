import { describe, expect, it } from "vitest";
import { internalAuthEmail, isValidPassword } from "./credentials";

describe("username-only credentials", () => {
  it("creates a stable internal-only provider identifier", () => {
    expect(internalAuthEmail(" Azizbek_01 ")).toBe("azizbek_01@accounts.medtw-internal.invalid");
  });

  it("rejects invalid public usernames and weak passwords", () => {
    expect(() => internalAuthEmail("a b")).toThrow("Invalid username");
    expect(isValidPassword("short")).toBe(false);
    expect(isValidPassword("long-enough-password")).toBe(true);
  });
});
