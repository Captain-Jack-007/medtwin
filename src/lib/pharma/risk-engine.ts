import { INTERACTION_RULES } from "./interaction-rules";
import type { Medication, PatientMedicationContext, PharmaFinding, PharmaRiskResult, RiskLevel } from "./types";

const WEIGHT: Record<RiskLevel, number> = { LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 };
const riskFromWeight = (weight: number): RiskLevel => weight >= 4 ? "CRITICAL" : weight >= 3 ? "HIGH" : weight >= 2 ? "MODERATE" : "LOW";

export function assessPharmaceuticalRisk(context: PatientMedicationContext): PharmaRiskResult {
  const medicationIds = new Set(context.medications.map((item) => item.id));
  const interactions = INTERACTION_RULES.filter((rule) => rule.medications.every((id) => medicationIds.has(id))).map((rule) => finding({
    id: `interaction-${rule.explanationKey}`, severity: rule.severity, title: "Potential medication interaction", summary: rule.summary,
    contributors: rule.medications.map((id) => medicationName(id, context.medications)), medicationIds: rule.medications,
    relatedSystem: rule.type === "renal" || rule.type === "metabolic" ? "renal" : rule.type === "cardiovascular" ? "cardiovascular" : undefined, kind: "interaction",
  }));
  const organWarnings = context.medications.flatMap((item) => organFindings(item, context));
  const doseConcerns = context.medications.flatMap((item) => {
    const markers = context.syntheticLabFlags.filter((flag) => flag.toLowerCase().includes(item.id));
    return markers.length ? [finding({ id: `dose-${item.id}`, severity: "HIGH", title: "Synthetic dose-related concern", summary: `${item.genericName} has a configured synthetic dose-monitoring signal.`, contributors: markers, medicationIds: [item.id], kind: "dose" })] : [];
  });
  const allergyWarnings = context.medications.flatMap((item) => context.allergies.some((allergy) => allergy.toLowerCase() === item.id) ? [finding({ id: `allergy-${item.id}`, severity: "CRITICAL", title: "Synthetic allergy flag", summary: `${item.genericName} matches an allergy recorded in this synthetic scenario.`, contributors: ["Synthetic allergy record"], medicationIds: [item.id], kind: "allergy" })] : []);
  const adverseEventSignals = context.medications.flatMap((item) => item.adverseEventSignals.map((signal) => finding({ id: `adverse-${item.id}-${signal}`, severity: signal.includes("bleeding") ? "HIGH" : "MODERATE", title: "Adverse-event signal", summary: signal, contributors: [item.genericName], medicationIds: [item.id], relatedSystem: signal.includes("hepatic") ? "hepatic" : signal.includes("accumulation") ? "renal" : undefined, kind: "adverse-event" })));
  const all = [...interactions, ...doseConcerns, ...organWarnings, ...allergyWarnings, ...adverseEventSignals];
  const priorityFinding = [...all].sort((left, right) => WEIGHT[right.severity] - WEIGHT[left.severity])[0] ?? null;
  return { overallRisk: priorityFinding ? riskFromWeight(WEIGHT[priorityFinding.severity]) : "LOW", interactions, doseConcerns, organWarnings, allergyWarnings, adverseEventSignals, priorityFinding };
}

function organFindings(medication: Medication, context: PatientMedicationContext): PharmaFinding[] {
  const warnings: PharmaFinding[] = [];
  if (WEIGHT[context.kidneyStatus] >= 3 && WEIGHT[medication.renalSensitivity] >= 3) warnings.push(finding({ id: `renal-${medication.id}`, severity: "HIGH", title: "Renal medication risk", summary: `${medication.genericName} has a synthetic accumulation concern with the configured kidney status.`, contributors: ["Reduced synthetic kidney function", `${medication.genericName} renal sensitivity`], medicationIds: [medication.id], relatedSystem: "renal", kind: "organ" }));
  if (WEIGHT[context.liverStatus] >= 3 && WEIGHT[medication.hepaticSensitivity] >= 3) warnings.push(finding({ id: `hepatic-${medication.id}`, severity: "HIGH", title: "Hepatic medication risk", summary: `${medication.genericName} has a synthetic processing concern with the configured liver status.`, contributors: ["Reduced synthetic liver function", `${medication.genericName} hepatic sensitivity`], medicationIds: [medication.id], relatedSystem: "hepatic", kind: "organ" }));
  return warnings;
}

function medicationName(id: string, medications: Medication[]) { return medications.find((item) => item.id === id)?.genericName ?? id; }
function finding(findingInput: PharmaFinding): PharmaFinding { return findingInput; }
