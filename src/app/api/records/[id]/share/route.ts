import { isProductionDataMode } from "@/lib/supabase/env";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/records/[id]/share">) {
  const requestId = crypto.randomUUID();
  try {
    if (!isProductionDataMode()) return Response.json({ error: "Production data mode is not enabled", requestId }, { status: 503 });
    const actor = await requireAuthenticatedUser();
    const { id } = await context.params;
    const body = await request.json() as { clinicianId?: unknown };
    if (typeof body.clinicianId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.clinicianId)) throw new Error("Invalid clinician");
    const admin = getSupabaseAdminClient();
    const { data: record, error: recordError } = await admin.from("screening_records").select("id, patient_id").eq("public_id", id).maybeSingle();
    if (recordError || !record || record.patient_id !== actor.id) throw new Error("Record not found");
    const { data: clinician, error: clinicianError } = await admin.from("profiles").select("id, role").eq("id", body.clinicianId).maybeSingle();
    if (clinicianError || !clinician || (clinician.role !== "clinician" && clinician.role !== "admin")) throw new Error("Clinician not found");
    const { error: grantError } = await admin.from("record_clinician_access").upsert({ record_id: record.id, clinician_id: clinician.id, granted_by: actor.id }, { onConflict: "record_id,clinician_id" });
    if (grantError) throw new Error("Unable to grant clinician access");
    const { error: auditError } = await admin.from("audit_events").insert({ actor_id: actor.id, record_id: record.id, event_type: "screening_record.shared_with_clinician", metadata: { clinicianId: clinician.id } });
    if (auditError) throw new Error("Unable to write audit event");
    return Response.json({ ok: true, requestId }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.warn("[records.share] rejected", { requestId, error: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "Unable to share this record", requestId }, { status: 400 });
  }
}
