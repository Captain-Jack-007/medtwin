import { describe, expect, it } from "vitest";
import { getPharmaScenario } from "./scenarios";
import { simulateScenario } from "./treatment-simulator";
import { compareTreatmentPlans } from "./treatment-delta";

describe("treatment deltas", () => {
  it("derives plan and simulation differences without invented attribution", () => {
    const simulations = simulateScenario(getPharmaScenario("MT-1042"));
    const delta = compareTreatmentPlans(simulations[0].plan, simulations[2].plan, simulations[0].result, simulations[2].result);
    expect(delta.medicationsRemoved.map((item) => item.medicationId)).toEqual(expect.arrayContaining(["warfarin", "ibuprofen", "atorvastatin"]));
    expect(delta.riskChanges.find((item) => item.key === "overallRisk")).toMatchObject({ before: 98, after: 14, direction: "down" });
    expect(delta.organRiskChanges.find((item) => item.system === "renal")).toMatchObject({ before: "HIGH", after: "LOW" });
    expect(delta.contributors.length).toBeGreaterThan(0);
  });
});
