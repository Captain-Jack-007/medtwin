import { describe, expect, it } from "vitest";
import { isValidUsername, normalizeUsername } from "./username";

describe("MedTwin username validation", () => {
  it("normalizes usernames consistently", () => {
    expect(normalizeUsername("  Azizbek_01 ")).toBe("azizbek_01");
  });

  it("accepts only the configured public username format", () => {
    expect(isValidUsername("azizbek_01")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("aziz bek")).toBe(false);
    expect(isValidUsername("-aziz")).toBe(false);
  });
});
