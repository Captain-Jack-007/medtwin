export const MEDTWIN_AI_REQUEST_TYPES = [
  "EXPLAIN_PHARMA_RISK",
  "COMPARE_TREATMENTS",
  "EXPLAIN_ORGAN_RISK",
  "ANSWER_PATIENT_QUESTION",
] as const;

export type MedTwinAIRequestType = (typeof MEDTWIN_AI_REQUEST_TYPES)[number];
export type MedTwinAIAudience = "patient" | "clinician";

export interface MedTwinAIRequest {
  sessionId: string;
  scenarioId?: string;
  audience: MedTwinAIAudience;
  requestType: MedTwinAIRequestType;
  selectedFindingId?: string;
  selectedPlanId?: string;
  candidateId?: string;
  question?: string;
  patientContext?: PatientAIContext;
}

export interface PatientAIContext {
  resultSummary: string;
  measurements: Array<{ label: string; value: string | null; status: string }>;
  detectedSignals: string[];
  unavailableMeasurements: string[];
}
