import { describe, expect, it } from "vitest";
import { assessMedicineCandidates } from "./medicine-assessment";
import { getPharmaScenario } from "./scenarios";

describe("medicine candidate assessment", () => {
  const scenario = getPharmaScenario("MT-1042");

  it("is deterministic for a fixed synthetic patient and candidate set", () => {
    expect(assessMedicineCandidates(scenario)).toEqual(assessMedicineCandidates(scenario));
  });

  it("selects the highest scoring safe candidate as the simulated best fit", () => {
    const assessments = assessMedicineCandidates(scenario);
    const recommended = assessments.filter((assessment) => assessment.isRecommended);
    const safe = assessments.filter((assessment) => assessment.safetyStatus === "safe");
    expect(recommended).toHaveLength(1);
    expect(recommended[0]?.safetyStatus).toBe("safe");
    expect(recommended[0]?.safetyScore).toBe(Math.max(...safe.map((assessment) => assessment.safetyScore)));
  });

  it("derives high-risk signals from configured interaction rules", () => {
    const ibuprofen = assessMedicineCandidates(scenario).find((assessment) => assessment.medicineId === "ibuprofen");
    expect(ibuprofen?.safetyStatus).toBe("high_risk");
    expect(ibuprofen?.interactionSignals.some((signal) => signal.toLowerCase().includes("bleeding"))).toBe(true);
  });

  it("classifies configured NSAID and antiplatelet candidates from the synthetic rule set", () => {
    const assessments = assessMedicineCandidates(scenario);

    for (const medicineId of ["aspirin", "diclofenac", "naproxen", "meloxicam"]) {
      expect(assessments.find((assessment) => assessment.medicineId === medicineId)?.safetyStatus).toBe("high_risk");
    }
  });

  it("keeps non-interacting gastroprotective candidates eligible in this synthetic configuration", () => {
    const assessment = assessMedicineCandidates(scenario).find((item) => item.medicineId === "pantoprazole");
    expect(assessment?.safetyStatus).toBe("safe");
  });

  it("makes a configured renal accumulation candidate not preferred", () => {
    const dabigatran = assessMedicineCandidates(scenario).find((assessment) => assessment.medicineId === "dabigatran");
    expect(dabigatran?.safetyStatus).toBe("not_recommended");
    expect(dabigatran?.patientImpacts.find((impact) => impact.organ === "renal")?.severity).not.toBe("positive");
  });

  it("does not fabricate a recommendation when no candidate is safe", () => {
    const noSafeScenario = {
      ...scenario,
      medicineCandidates: scenario.medicineCandidates?.filter((candidate) => candidate.id === "ibuprofen" || candidate.id === "warfarin"),
    };
    expect(assessMedicineCandidates(noSafeScenario).some((assessment) => assessment.isRecommended)).toBe(false);
  });
});
