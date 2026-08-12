import type { TriageResult } from "@/lib/types";
import type { ClinicianMedicationContext, MedicationReviewGate } from "./types";

/**
 * Screening signals are not prescriptions. This guard ensures that no AI
 * medication proposal is requested for an unremarkable screening, and that a
 * clinician supplies the minimum safety context before a review can begin.
 */
export function gateMedicationReview(
  triage: TriageResult,
  context: ClinicianMedicationContext,
): MedicationReviewGate {
  if (triage.priority === "GREEN" || triage.priority === "YELLOW") {
    return { status: "no_scan_indication", priority: triage.priority };
  }

  const missingFields: string[] = [];
  if (context.allergies.length === 0) missingFields.push("allergies");
  if (context.knownConditions.length === 0) missingFields.push("knownConditions");
  if (context.kidneyFunction === "unknown") missingFields.push("kidneyFunction");
  if (context.liverFunction === "unknown") missingFields.push("liverFunction");
  if (context.pregnancyStatus === "unknown") missingFields.push("pregnancyStatus");
  if (missingFields.length > 0) return { status: "context_incomplete", priority: triage.priority, missingFields };

  return { status: "eligible_for_clinician_review", priority: triage.priority };
}
