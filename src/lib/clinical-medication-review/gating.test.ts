import { describe, expect, it } from "vitest";
import { gateMedicationReview } from "./gating";
import type { ClinicianMedicationContext } from "./types";
import type { TriageResult } from "@/lib/types";

const completeContext: ClinicianMedicationContext = {
  currentMedications: [],
  allergies: ["none_known"],
  knownConditions: ["none_recorded"],
  kidneyFunction: "normal",
  liverFunction: "normal",
  pregnancyStatus: "not_applicable",
};

function triage(priority: TriageResult["priority"]): TriageResult {
  return {
    priority,
    systems: priority === "GREEN" ? [] : ["cardiovascular"],
    systemStates: { cardiovascular: priority, neurological: "GREEN", respiratory: "GREEN" },
    observationStates: { cardiovascular: priority === "GREEN" ? "NORMAL" : "ABNORMAL", neurological: "NORMAL", respiratory: "NORMAL" },
    evidence: [],
    recommendedAction: "test",
    ruleVersion: "test",
  };
}

describe("medication review gate", () => {
  it("does not allow a medication proposal for a healthy screening", () => {
    expect(gateMedicationReview(triage("GREEN"), completeContext)).toEqual({ status: "no_scan_indication", priority: "GREEN" });
  });

  it("requires clinician-entered safety context before an AI review", () => {
    const result = gateMedicationReview(triage("ORANGE"), { ...completeContext, kidneyFunction: "unknown", allergies: [] });
    expect(result.status).toBe("context_incomplete");
    if (result.status === "context_incomplete") expect(result.missingFields).toEqual(expect.arrayContaining(["kidneyFunction", "allergies"]));
  });

  it("allows a review draft only for an escalated screening with complete context", () => {
    expect(gateMedicationReview(triage("ORANGE"), completeContext)).toEqual({ status: "eligible_for_clinician_review", priority: "ORANGE" });
  });
});
