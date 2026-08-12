import { assessPharmaceuticalRisk } from "./risk-engine";
import type { PatientMedicationContext, PharmaScenario, RiskLevel, TreatmentPlan, TreatmentSimulationResult } from "./types";

const SCORE: Record<RiskLevel, number> = { LOW: 18, MODERATE: 46, HIGH: 70, CRITICAL: 90 };
export function simulateTreatment(patient: PatientMedicationContext, treatmentPlan: TreatmentPlan): TreatmentSimulationResult {
  const findings = assessPharmaceuticalRisk({ ...patient, medications: treatmentPlan.medications });
  const all = [ ...findings.interactions, ...findings.doseConcerns, ...findings.organWarnings, ...findings.allergyWarnings, ...findings.adverseEventSignals ];
  const bleeding = all.filter((item) => item.summary.toLowerCase().includes("bleeding"));
  const renal = all.filter((item) => item.relatedSystem === "renal" || item.summary.toLowerCase().includes("renal"));
  const hepatic = all.filter((item) => item.relatedSystem === "hepatic");
  const cardiovascular = all.filter((item) => item.relatedSystem === "cardiovascular");
  const score = Math.min(98, Math.max(8, SCORE[findings.overallRisk] + Math.min(12, all.length * 2) - treatmentPlan.interventions.length * 4));
  return { treatmentPlanId: treatmentPlan.id, overallRiskScore: score, bleedingRisk: riskFor(bleeding), renalRisk: riskFor(renal), hepaticRisk: riskFor(hepatic), cardiovascularRisk: riskFor(cardiovascular), interactionCount: findings.interactions.length, adverseEventCount: findings.adverseEventSignals.length, stabilityScore: Math.max(2, 100 - score), detectedRisks: all };
}

function riskFor(findings: { severity: RiskLevel }[]): RiskLevel { return findings.length ? findings.reduce((highest, current) => SCORE[current.severity] > SCORE[highest] ? current.severity : highest, findings[0].severity) : "LOW"; }

export function simulateScenario(scenario: PharmaScenario) { return scenario.plans.map((plan) => ({ plan, result: simulateTreatment(scenario.context, plan) })); }
