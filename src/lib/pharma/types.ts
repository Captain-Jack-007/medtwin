export const RISK_LEVELS = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export type OrganSystem = "renal" | "hepatic" | "cardiovascular";

export interface Medication {
  id: string;
  genericName: string;
  category: string;
  dose: string;
  frequency: string;
  renalSensitivity: RiskLevel;
  hepaticSensitivity: RiskLevel;
  adverseEventSignals: string[];
}

export interface DrugInteraction {
  medications: [string, string];
  severity: RiskLevel;
  type: "bleeding" | "renal" | "cardiovascular" | "metabolic";
  explanationKey: string;
  summary: string;
}

export interface PatientMedicationContext {
  medications: Medication[];
  allergies: string[];
  kidneyStatus: RiskLevel;
  liverStatus: RiskLevel;
  age: number;
  syntheticConditions: string[];
  syntheticLabFlags: string[];
}

export interface PharmaFinding {
  id: string;
  severity: RiskLevel;
  title: string;
  summary: string;
  contributors: string[];
  medicationIds: string[];
  relatedSystem?: OrganSystem;
  kind: "interaction" | "organ" | "dose" | "allergy" | "adverse-event";
}

export interface PharmaRiskResult {
  overallRisk: RiskLevel;
  interactions: PharmaFinding[];
  doseConcerns: PharmaFinding[];
  organWarnings: PharmaFinding[];
  allergyWarnings: PharmaFinding[];
  adverseEventSignals: PharmaFinding[];
  priorityFinding: PharmaFinding | null;
}

export interface TreatmentPlan {
  id: string;
  name: string;
  medications: Medication[];
  interventions: string[];
}

export interface TreatmentSimulationResult {
  treatmentPlanId: string;
  overallRiskScore: number;
  bleedingRisk: RiskLevel;
  renalRisk: RiskLevel;
  hepaticRisk: RiskLevel;
  cardiovascularRisk: RiskLevel;
  interactionCount: number;
  adverseEventCount: number;
  stabilityScore: number;
  detectedRisks: PharmaFinding[];
}

export interface MedicationPlanChange {
  medicationId: string;
  genericName: string;
  category: string;
}

export interface SimulationMetricChange {
  key:
    | "overallRisk"
    | "bleedingRisk"
    | "renalRisk"
    | "hepaticRisk"
    | "cardiovascularRisk"
    | "interactionCount"
    | "adverseEventCount"
    | "stabilityScore";
  before: number | RiskLevel;
  after: number | RiskLevel;
  direction: "up" | "down" | "unchanged";
}

export interface TreatmentDelta {
  currentPlanId: string;
  alternativePlanId: string;
  medicationsAdded: MedicationPlanChange[];
  medicationsRemoved: MedicationPlanChange[];
  medicationsRetained: MedicationPlanChange[];
  interventionsAdded: string[];
  interventionsRemoved: string[];
  riskChanges: SimulationMetricChange[];
  organRiskChanges: Array<{
    system: OrganSystem;
    before: RiskLevel;
    after: RiskLevel;
    direction: "up" | "down" | "unchanged";
  }>;
  contributors: Array<{
    level: "major" | "moderate";
    kind: "interactionRemoved" | "bleedingReduced" | "renalReduced" | "interactionsReduced";
    sourceFindingIds: string[];
  }>;
}

export interface PharmaTwinState {
  mode: "current" | "simulated";
  scenarioId: string;
  patientId: string;
  treatmentPlanId: string;
  treatmentPlanName: string;
  result: TreatmentSimulationResult;
  organRisks: Record<OrganSystem, RiskLevel>;
  selectedOrganSystem?: OrganSystem;
}

export interface PharmaScenario {
  id: string;
  title: string;
  patientId: string;
  context: PatientMedicationContext;
  plans: [TreatmentPlan, TreatmentPlan, TreatmentPlan];
  patientProfile?: SyntheticPharmaPatientProfile;
  medicineCandidates?: MedicineCandidate[];
}

/** Synthetic-only details used by the clinician medicine-safety workspace. */
export interface SyntheticPharmaPatientProfile {
  age: number;
  heightCm: number;
  weightKg: number;
  conditions: string[];
  kidneyEstimate?: string;
  cardiovascularSummary?: string;
  bleedingRisk?: RiskLevel;
}

export type MedicationSafetyStatus = "safe" | "not_recommended" | "high_risk";

export interface MedicineCandidate {
  id: string;
  medication: Medication;
  /** Medication ids removed only within this synthetic candidate simulation. */
  replacesMedicationIds: string[];
}

export type MedicineImpactOrgan = "renal" | "hepatic" | "cardiovascular" | "bleeding" | "overall";
export type MedicineImpactSeverity = "positive" | "neutral" | "moderate" | "negative" | "critical";

export interface MedicinePatientImpact {
  organ: MedicineImpactOrgan;
  severity: MedicineImpactSeverity;
  explanation: string;
}

export interface MedicineAssessment {
  medicineId: string;
  safetyStatus: MedicationSafetyStatus;
  safetyScore: number;
  isRecommended: boolean;
  reasons: string[];
  patientImpacts: MedicinePatientImpact[];
  interactionSignals: string[];
  organWarnings: string[];
  contraindicationSignals: string[];
  overallSummary: string;
  simulatedPlan: TreatmentPlan;
  simulation: TreatmentSimulationResult;
}
