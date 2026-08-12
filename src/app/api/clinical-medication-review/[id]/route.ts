import { generateClinicianMedicationReviewDraft } from "@/lib/clinical-medication-review/ai";
import { gateMedicationReview } from "@/lib/clinical-medication-review/gating";
import { parseClinicianMedicationContext } from "@/lib/clinical-medication-review/validation";
import { parseRealScanResult } from "@/lib/production/scan-validation";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { requireClinician } from "@/lib/supabase/auth";
import { isProductionDataMode } from "@/lib/supabase/env";
import { runRealTriage } from "@/lib/triage";
import type { MedicationReviewResponse } from "@/lib/clinical-medication-review/types";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/clinical-medication-review/[id]">) {
  const requestId = crypto.randomUUID();
  try {
    if (!isProductionDataMode()) return Response.json({ error: "Production data mode is not enabled", requestId }, { status: 503 });
    if (Number(request.headers.get("content-length") ?? 0) > 12_000) return Response.json({ error: "Medication review payload is too large", requestId }, { status: 413 });
    const actor = await requireClinician();
    const { id } = await context.params;
    if (!/^MT-[A-Z0-9-]{5,80}$/.test(id)) throw new Error("Invalid record");
    const medicationContext = parseClinicianMedicationContext((await request.json() as { medicationContext?: unknown }).medicationContext);
    const admin = getSupabaseAdminClient();
    const { data: record, error } = await admin.from("screening_records").select("id, scan_result").eq("public_id", id).maybeSingle();
    if (error || !record) throw new Error("Record not found");
    if (actor.role !== "admin") {
      const { data: grant, error: grantError } = await admin.from("record_clinician_access").select("record_id").eq("record_id", record.id).eq("clinician_id", actor.id).maybeSingle();
      if (grantError || !grant) throw new Error("Record not found");
    }

    const result = parseRealScanResult(record.scan_result);
    const triage = runRealTriage(result);
    const gate = gateMedicationReview(triage, medicationContext);
    const message = gate.status === "no_scan_indication"
      ? "No medication proposal: the deterministic screening result does not indicate a medication review."
      : gate.status === "context_incomplete"
        ? `No medication proposal: clinician-entered safety context is incomplete (${gate.missingFields.join(", ")}).`
        : await generateClinicianMedicationReviewDraft({ result, triage, context: medicationContext });

    const { error: auditError } = await admin.from("audit_events").insert({
      actor_id: actor.id,
      record_id: record.id,
      event_type: "clinical_medication_review.requested",
      metadata: { gate: gate.status, triage_priority: triage.priority, medication_count: medicationContext.currentMedications.length },
    });
    if (auditError) throw new Error("Unable to audit medication review");
    return Response.json({ gate, message, requestId } satisfies MedicationReviewResponse, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.warn("[clinical-medication-review] rejected", { requestId, error: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "Clinical medication review is temporarily unavailable", requestId }, { status: 503 });
  }
}
