import { describe, expect, it } from "vitest";
import { getPharmaScenario } from "./scenarios";
import { assessPharmaceuticalRisk } from "./risk-engine";
import { simulateScenario } from "./treatment-simulator";

describe("pharmaceutical risk engine", () => {
  it("detects the deterministic warfarin and NSAID signal", () => {
    const scenario = getPharmaScenario("MT-1042");
    const result = assessPharmaceuticalRisk(scenario.context);
    expect(result.interactions.some((finding) => finding.id === "interaction-warfarin_nsaid")).toBe(true);
    expect(result.priorityFinding?.severity).toBe("CRITICAL");
  });

  it("makes the lower-signal configuration score lower", () => {
    const simulations = simulateScenario(getPharmaScenario("MT-1042"));
    expect(simulations[2].result.overallRiskScore).toBeLessThan(simulations[0].result.overallRiskScore);
    expect(simulations[2].result.interactionCount).toBeLessThan(simulations[0].result.interactionCount);
  });
});
