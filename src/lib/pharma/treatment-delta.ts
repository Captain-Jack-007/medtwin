import type {
  MedicationPlanChange,
  RiskLevel,
  SimulationMetricChange,
  TreatmentDelta,
  TreatmentPlan,
  TreatmentSimulationResult,
} from "./types";

const RANK: Record<RiskLevel, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function compareTreatmentPlans(
  currentPlan: TreatmentPlan,
  alternativePlan: TreatmentPlan,
  currentResult: TreatmentSimulationResult,
  alternativeResult: TreatmentSimulationResult
): TreatmentDelta {
  const currentById = new Map(currentPlan.medications.map((medication) => [medication.id, medication]));
  const alternativeById = new Map(alternativePlan.medications.map((medication) => [medication.id, medication]));
  const toChange = (medication: TreatmentPlan["medications"][number]): MedicationPlanChange => ({
    medicationId: medication.id,
    genericName: medication.genericName,
    category: medication.category,
  });
  const medicationsRemoved = currentPlan.medications
    .filter((medication) => !alternativeById.has(medication.id))
    .map(toChange);
  const medicationsAdded = alternativePlan.medications
    .filter((medication) => !currentById.has(medication.id))
    .map(toChange);
  const medicationsRetained = alternativePlan.medications
    .filter((medication) => currentById.has(medication.id))
    .map(toChange);
  const riskChanges: SimulationMetricChange[] = [
    metric("overallRisk", currentResult.overallRiskScore, alternativeResult.overallRiskScore, "lower"),
    metric("bleedingRisk", currentResult.bleedingRisk, alternativeResult.bleedingRisk, "lower"),
    metric("renalRisk", currentResult.renalRisk, alternativeResult.renalRisk, "lower"),
    metric("hepaticRisk", currentResult.hepaticRisk, alternativeResult.hepaticRisk, "lower"),
    metric("cardiovascularRisk", currentResult.cardiovascularRisk, alternativeResult.cardiovascularRisk, "lower"),
    metric("interactionCount", currentResult.interactionCount, alternativeResult.interactionCount, "lower"),
    metric("adverseEventCount", currentResult.adverseEventCount, alternativeResult.adverseEventCount, "lower"),
    metric("stabilityScore", currentResult.stabilityScore, alternativeResult.stabilityScore, "higher"),
  ];
  const organRiskChanges = ([
    ["renal", currentResult.renalRisk, alternativeResult.renalRisk],
    ["hepatic", currentResult.hepaticRisk, alternativeResult.hepaticRisk],
    ["cardiovascular", currentResult.cardiovascularRisk, alternativeResult.cardiovascularRisk],
  ] as const).map(([system, before, after]) => ({
    system,
    before,
    after,
    direction: direction(before, after, "lower"),
  }));
  return {
    currentPlanId: currentPlan.id,
    alternativePlanId: alternativePlan.id,
    medicationsAdded,
    medicationsRemoved,
    medicationsRetained,
    interventionsAdded: alternativePlan.interventions.filter((item) => !currentPlan.interventions.includes(item)),
    interventionsRemoved: currentPlan.interventions.filter((item) => !alternativePlan.interventions.includes(item)),
    riskChanges,
    organRiskChanges,
    contributors: contributors(medicationsRemoved, currentResult, alternativeResult),
  };
}

function metric(
  key: SimulationMetricChange["key"],
  before: number | RiskLevel,
  after: number | RiskLevel,
  betterWhen: "lower" | "higher"
): SimulationMetricChange {
  return { key, before, after, direction: direction(before, after, betterWhen) };
}

function direction(
  before: number | RiskLevel,
  after: number | RiskLevel,
  betterWhen: "lower" | "higher"
): "up" | "down" | "unchanged" {
  const beforeValue = typeof before === "number" ? before : RANK[before];
  const afterValue = typeof after === "number" ? after : RANK[after];
  if (beforeValue === afterValue) return "unchanged";
  const isIncrease = afterValue > beforeValue;
  if (betterWhen === "lower") return isIncrease ? "up" : "down";
  return isIncrease ? "up" : "down";
}

function contributors(
  medicationsRemoved: MedicationPlanChange[],
  currentResult: TreatmentSimulationResult,
  alternativeResult: TreatmentSimulationResult
): TreatmentDelta["contributors"] {
  const removedIds = new Set(medicationsRemoved.map((item) => item.medicationId));
  const out: TreatmentDelta["contributors"] = [];
  const removedInteractionIds = currentResult.detectedRisks
    .filter((finding) => finding.kind === "interaction" && finding.medicationIds.some((id) => removedIds.has(id)))
    .map((finding) => finding.id);
  if (removedInteractionIds.length) out.push({ level: "major", kind: "interactionRemoved", sourceFindingIds: removedInteractionIds });
  if (RANK[alternativeResult.bleedingRisk] < RANK[currentResult.bleedingRisk]) out.push({ level: "major", kind: "bleedingReduced", sourceFindingIds: [] });
  if (RANK[alternativeResult.renalRisk] < RANK[currentResult.renalRisk]) out.push({ level: "moderate", kind: "renalReduced", sourceFindingIds: [] });
  if (alternativeResult.interactionCount < currentResult.interactionCount) out.push({ level: "moderate", kind: "interactionsReduced", sourceFindingIds: [] });
  return out;
}
