import { getSupabaseServerClient } from "./server";

export type MedTwinRole = "patient" | "clinician" | "admin";

export interface AuthenticatedMedTwinUser {
  id: string;
  email: string | null;
  role: MedTwinRole;
}

export async function requireAuthenticatedUser() {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Authentication required");
  // `user_metadata` is user-editable. Privileged roles may only originate
  // from Supabase-controlled app metadata.
  const role = roleFromMetadata(data.user.app_metadata?.role);
  return { id: data.user.id, email: data.user.email ?? null, role } satisfies AuthenticatedMedTwinUser;
}

export async function requireClinician() {
  const user = await requireAuthenticatedUser();
  if (user.role !== "clinician" && user.role !== "admin") throw new Error("Clinician access required");
  return user;
}

function roleFromMetadata(value: unknown): MedTwinRole {
  return value === "clinician" || value === "admin" ? value : "patient";
}
