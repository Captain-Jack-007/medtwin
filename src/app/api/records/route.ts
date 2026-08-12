import { isProductionDataMode } from "@/lib/supabase/env";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { parseRealScanResult } from "@/lib/production/scan-validation";
import { runRealTriage } from "@/lib/triage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    if (!isProductionDataMode()) return Response.json({ error: "Production data mode is not enabled", requestId }, { status: 503 });
    if (Number(request.headers.get("content-length") ?? 0) > 32_000) return Response.json({ error: "Scan payload is too large", requestId }, { status: 413 });
    const actor = await requireAuthenticatedUser();
    const input = await request.json();
    const result = parseRealScanResult(input);
    const triage = runRealTriage(result);
    const admin = getSupabaseAdminClient();
    const { data: record, error } = await admin.from("screening_records").insert({
      public_id: result.sessionId,
      patient_id: actor.id,
      created_by: actor.id,
      status: triage.recommendedAction === "incomplete_screening_review" ? "incomplete" : "complete",
      consent_version: result.consentVersion,
      consented_at: result.completedAt,
      completed_at: result.completedAt,
      demographics: result.demographics,
      scan_result: result,
      triage_result: triage,
    }).select("id, public_id").single();
    if (error || !record) throw new Error("Unable to store screening record");
    const audit = await admin.from("audit_events").insert({ actor_id: actor.id, record_id: record.id, event_type: "screening_record.created", metadata: { source: "smartphone_screening", status: triage.recommendedAction === "incomplete_screening_review" ? "incomplete" : "complete" } });
    if (audit.error) throw new Error("Unable to write audit event");
    return Response.json({ id: record.public_id, requestId }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.warn("[records] rejected", { requestId, error: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "Unable to save this screening result", requestId }, { status: 400 });
  }
}
