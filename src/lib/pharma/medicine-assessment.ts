import { assessPharmaceuticalRisk } from "./risk-engine";
import { simulateTreatment } from "./treatment-simulator";
import type {
  MedicineAssessment,
  MedicineCandidate,
  MedicineImpactSeverity,
  MedicationSafetyStatus,
  PharmaFinding,
  PharmaScenario,
  RiskLevel,
  TreatmentPlan,
} from "./types";

const RISK_WEIGHT: Record<RiskLevel, number> = {
  LOW: 0,
  MODERATE: 12,
  HIGH: 28,
  CRITICAL: 52,
};

/**
 * Produces a reproducible, synthetic patient-specific assessment. It is not a
 * pharmacology recommendation engine: candidate data and all outcomes belong
 * to the configured demo scenario.
 */
export function assessMedicineCandidates(scenario: PharmaScenario): MedicineAssessment[] {
  const candidates = scenario.medicineCandidates ?? [];
  const assessments = candidates.map((candidate) => assessMedicineCandidate(scenario, candidate));
  const recommendedId = assessments
    .filter((assessment) => assessment.safetyStatus === "safe")
    .sort((left, right) => right.safetyScore - left.safetyScore || left.medicineId.localeCompare(right.medicineId))[0]
    ?.medicineId;

  return assessments
    .map((assessment) => ({ ...assessment, isRecommended: assessment.medicineId === recommendedId }))
    .sort((left, right) => {
      const group = assessmentGroup(left) - assessmentGroup(right);
      return group || right.safetyScore - left.safetyScore || left.medicineId.localeCompare(right.medicineId);
    });
}

export function assessMedicineCandidate(scenario: PharmaScenario, candidate: MedicineCandidate): MedicineAssessment {
  const simulatedPlan = candidatePlan(scenario, candidate);
  const findings = assessPharmaceuticalRisk({ ...scenario.context, medications: simulatedPlan.medications });
  const allFindings = allRiskFindings(findings);
  const candidateFindings = allFindings.filter((finding) => finding.medicationIds.includes(candidate.medication.id));
  const interactions = findings.interactions.filter((finding) => finding.medicationIds.includes(candidate.medication.id));
  const organWarnings = findings.organWarnings.filter((finding) => finding.medicationIds.includes(candidate.medication.id));
  const contraindications = [...findings.allergyWarnings, ...findings.doseConcerns]
    .filter((finding) => finding.medicationIds.includes(candidate.medication.id));
  const simulation = simulateTreatment(scenario.context, simulatedPlan);
  const status = classify(candidateFindings, interactions, organWarnings, contraindications);
  const score = scoreCandidate(status, candidateFindings, simulation);
  const impacts = buildImpacts(simulation, candidateFindings, status);
  const reasons = candidateFindings.length
    ? candidateFindings.slice(0, 3).map((finding) => finding.summary)
    : ["No major synthetic patient-specific risk signal was detected for this candidate configuration."];

  return {
    medicineId: candidate.id,
    safetyStatus: status,
    safetyScore: score,
    isRecommended: false,
    reasons,
    patientImpacts: impacts,
    interactionSignals: interactions.map((finding) => finding.summary),
    organWarnings: organWarnings.map((finding) => finding.summary),
    contraindicationSignals: contraindications.map((finding) => finding.summary),
    overallSummary: summaryFor(status, candidateFindings),
    simulatedPlan,
    simulation,
  };
}

export function candidatePlan(scenario: PharmaScenario, candidate: MedicineCandidate): TreatmentPlan {
  const remaining = scenario.context.medications.filter((medication) => !candidate.replacesMedicationIds.includes(medication.id));
  const withoutDuplicate = remaining.filter((medication) => medication.id !== candidate.medication.id);
  return {
    id: `candidate-${candidate.id}`,
    name: `Synthetic candidate: ${candidate.medication.genericName}`,
    medications: [...withoutDuplicate, candidate.medication],
    interventions: [`Synthetic candidate assessment: ${candidate.medication.genericName}`],
  };
}

function allRiskFindings(result: ReturnType<typeof assessPharmaceuticalRisk>) {
  return [...result.interactions, ...result.doseConcerns, ...result.organWarnings, ...result.allergyWarnings, ...result.adverseEventSignals];
}

function classify(
  candidateFindings: PharmaFinding[],
  interactions: PharmaFinding[],
  organWarnings: PharmaFinding[],
  contraindications: PharmaFinding[],
): MedicationSafetyStatus {
  if (candidateFindings.some((finding) => finding.severity === "CRITICAL") || interactions.some((finding) => finding.severity === "HIGH" || finding.severity === "CRITICAL") || contraindications.some((finding) => finding.severity === "CRITICAL")) return "high_risk";
  if (candidateFindings.some((finding) => finding.severity === "HIGH" || finding.severity === "MODERATE") || organWarnings.length > 0 || contraindications.length > 0) return "not_recommended";
  return "safe";
}

function scoreCandidate(status: MedicationSafetyStatus, findings: PharmaFinding[], simulation: ReturnType<typeof simulateTreatment>) {
  const penalty = findings.reduce((total, finding) => total + RISK_WEIGHT[finding.severity], 0);
  const baseline = status === "safe" ? 100 : status === "not_recommended" ? 80 : 50;
  // Candidate-specific findings determine the classification; the resulting
  // whole-plan simulation breaks ties between otherwise eligible candidates.
  return Math.max(0, Math.min(100, baseline - penalty - Math.round(simulation.overallRiskScore * 0.45)));
}

function buildImpacts(
  simulation: ReturnType<typeof simulateTreatment>,
  findings: PharmaFinding[],
  status: MedicationSafetyStatus,
) {
  const impact = (organ: "renal" | "hepatic" | "cardiovascular" | "bleeding", risk: RiskLevel, key: string) => ({
    organ,
    severity: impactSeverity(risk, status),
    explanation: impactText(key, risk, findings),
  });
  return [
    impact("renal", simulation.renalRisk, "renal"),
    impact("bleeding", simulation.bleedingRisk, "bleeding"),
    impact("cardiovascular", simulation.cardiovascularRisk, "cardiovascular"),
    { organ: "overall" as const, severity: (status === "safe" ? "positive" : status === "not_recommended" ? "moderate" : "critical") as MedicineImpactSeverity, explanation: summaryFor(status, findings) },
  ];
}

function impactSeverity(risk: RiskLevel, status: MedicationSafetyStatus): MedicineImpactSeverity {
  if (risk === "CRITICAL" || status === "high_risk") return "critical";
  if (risk === "HIGH") return "negative";
  if (risk === "MODERATE" || status === "not_recommended") return "moderate";
  return "positive";
}

function impactText(kind: string, risk: RiskLevel, findings: PharmaFinding[]) {
  const matching = findings.find((finding) => (kind === "bleeding" ? finding.summary.toLowerCase().includes("bleeding") : finding.relatedSystem === kind));
  return matching?.summary ?? `${kind} simulated risk is ${risk.toLowerCase()} in this synthetic candidate configuration.`;
}

function summaryFor(status: MedicationSafetyStatus, findings: PharmaFinding[]) {
  if (status === "safe") return "This candidate has no major patient-specific synthetic risk signal in the configured simulation.";
  const highest = findings.slice().sort((left, right) => RISK_WEIGHT[right.severity] - RISK_WEIGHT[left.severity])[0];
  return highest?.summary ?? "This candidate has a relevant synthetic patient-specific risk signal.";
}

function assessmentGroup(assessment: MedicineAssessment) {
  if (assessment.isRecommended) return 0;
  if (assessment.safetyStatus === "safe") return 1;
  if (assessment.safetyStatus === "not_recommended") return 2;
  return 3;
}
