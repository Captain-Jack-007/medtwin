import type { OrganSystem, PharmaScenario, PharmaTwinState, RiskLevel, TreatmentPlan, TreatmentSimulationResult } from "./types";

export const PHARMA_TWIN_STATE_KEY = "medtwin.pharma-twin-state.v1";

export function buildPharmaTwinState(
  scenario: PharmaScenario,
  plan: TreatmentPlan,
  result: TreatmentSimulationResult,
  mode: PharmaTwinState["mode"],
  selectedOrganSystem?: OrganSystem
): PharmaTwinState {
  return {
    mode,
    scenarioId: scenario.id,
    patientId: scenario.patientId,
    treatmentPlanId: plan.id,
    treatmentPlanName: plan.name,
    result,
    organRisks: {
      renal: result.renalRisk,
      hepatic: result.hepaticRisk,
      cardiovascular: result.cardiovascularRisk,
    },
    selectedOrganSystem,
  };
}

export function storePharmaTwinState(state: PharmaTwinState) {
  if (typeof window !== "undefined") window.sessionStorage.setItem(PHARMA_TWIN_STATE_KEY, JSON.stringify(state));
}

export function readPharmaTwinState(patientId: string): PharmaTwinState | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(PHARMA_TWIN_STATE_KEY) ?? "null") as PharmaTwinState | null;
    return parsed?.patientId === patientId && isTwinState(parsed) ? parsed : null;
  } catch { return null; }
}

export function riskToPriority(risk: RiskLevel): "GREEN" | "YELLOW" | "ORANGE" | "RED" {
  const priorities: Record<RiskLevel, "GREEN" | "YELLOW" | "ORANGE" | "RED"> = {
    LOW: "GREEN", MODERATE: "YELLOW", HIGH: "ORANGE", CRITICAL: "RED",
  };
  return priorities[risk];
}

export function focusForOrgan(system: OrganSystem): "renal" | "hepatic" | "cardiovascular" {
  return system;
}

function isTwinState(value: PharmaTwinState): boolean {
  return value.mode !== undefined && typeof value.patientId === "string" && typeof value.treatmentPlanId === "string" && typeof value.result?.overallRiskScore === "number";
}
