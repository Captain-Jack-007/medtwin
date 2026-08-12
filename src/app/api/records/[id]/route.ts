import { requireAuthenticatedUser, requireClinician } from "@/lib/supabase/auth";
import { isProductionDataMode } from "@/lib/supabase/env";
import { parseRealScanResult } from "@/lib/production/scan-validation";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RecordAudience = "patient" | "clinician";

export async function GET(request: Request, context: RouteContext<"/api/records/[id]">) {
  const requestId = crypto.randomUUID();
  try {
    if (!isProductionDataMode()) {
      return Response.json({ error: "Production data mode is not enabled", requestId }, { status: 503 });
    }

    const audience = new URL(request.url).searchParams.get("audience") as RecordAudience | null;
    if (audience !== "patient" && audience !== "clinician") throw new Error("Invalid audience");
    const actor = audience === "clinician" ? await requireClinician() : await requireAuthenticatedUser();
    const { id } = await context.params;
    if (!/^MT-[A-Z0-9-]{5,80}$/.test(id)) throw new Error("Invalid record");

    const admin = getSupabaseAdminClient();
    const { data: record, error } = await admin
      .from("screening_records")
      .select("id, patient_id, scan_result")
      .eq("public_id", id)
      .maybeSingle();
    if (error || !record) throw new Error("Record not found");

    if (audience === "patient") {
      if (record.patient_id !== actor.id) throw new Error("Record not found");
    } else {
      const { data: grant, error: grantError } = await admin
        .from("record_clinician_access")
        .select("record_id")
        .eq("record_id", record.id)
        .eq("clinician_id", actor.id)
        .maybeSingle();
      if (grantError || (!grant && actor.role !== "admin")) throw new Error("Record not found");
    }

    const result = parseRealScanResult(record.scan_result);
    const { error: auditError } = await admin.from("audit_events").insert({
      actor_id: actor.id,
      record_id: record.id,
      event_type: audience === "clinician" ? "screening_record.viewed_by_clinician" : "screening_record.viewed_by_patient",
      metadata: { audience },
    });
    if (auditError) throw new Error("Unable to audit record access");
    return Response.json({ result, requestId }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.warn("[records.get] rejected", { requestId, error: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "Unable to access this screening result", requestId }, { status: 404 });
  }
}
