import type { Priority } from "@/lib/types";

export const ORGAN_FUNCTION_STATUSES = ["normal", "impaired", "unknown"] as const;
export type OrganFunctionStatus = (typeof ORGAN_FUNCTION_STATUSES)[number];

export const PREGNANCY_STATUSES = ["not_applicable", "negative", "positive", "unknown"] as const;
export type PregnancyStatus = (typeof PREGNANCY_STATUSES)[number];

export interface ClinicianMedicationContext {
  currentMedications: string[];
  allergies: string[];
  knownConditions: string[];
  kidneyFunction: OrganFunctionStatus;
  liverFunction: OrganFunctionStatus;
  pregnancyStatus: PregnancyStatus;
}

export type MedicationReviewGate =
  | { status: "no_scan_indication"; priority: Priority }
  | { status: "context_incomplete"; priority: Priority; missingFields: string[] }
  | { status: "eligible_for_clinician_review"; priority: Priority };

export interface MedicationReviewResponse {
  gate: MedicationReviewGate;
  message: string;
  requestId: string;
}
