import { internalAuthEmail, isValidPassword } from "@/lib/auth/credentials";
import { isValidUsername, normalizeUsername } from "@/lib/auth/username";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;
const attempts = new Map<string, number[]>();

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 4_000) {
      return Response.json({ error: "Invalid registration request", requestId }, { status: 413 });
    }
    const input = await request.json() as { username?: unknown; password?: unknown };
    const username = validUsername(input.username);
    if (!isValidPassword(input.password)) throw new Error("Invalid password");
    if (!withinLimit(clientBucket(request))) {
      return Response.json({ error: "Too many registration attempts. Please wait and try again.", requestId }, { status: 429, headers: { "retry-after": "60" } });
    }

    const admin = getSupabaseAdminClient();
    const { data: existingProfile, error: profileError } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
    if (profileError) throw new Error("Profile lookup failed");
    if (existingProfile) return unavailableUsername(requestId);

    const { error: createError } = await admin.auth.admin.createUser({
      email: internalAuthEmail(username),
      password: input.password,
      email_confirm: true,
      user_metadata: { username },
    });
    if (createError) return unavailableUsername(requestId);

    // Establish the normal browser session through the SSR client. The
    // generated provider email remains entirely within this route.
    const supabase = await getSupabaseServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: internalAuthEmail(username), password: input.password });
    if (signInError) throw new Error("Session creation failed");
    return Response.json({ ok: true, requestId }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.warn("[auth.sign-up] rejected", { requestId, error: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "Unable to create account", requestId }, { status: 400 });
  }
}

function validUsername(value: unknown) {
  if (typeof value !== "string") throw new Error("Invalid username");
  const username = normalizeUsername(value);
  if (!isValidUsername(username)) throw new Error("Invalid username");
  return username;
}

function unavailableUsername(requestId: string) {
  return Response.json({ error: "Unable to create account", requestId }, { status: 400 });
}

function clientBucket(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function withinLimit(bucket: string) {
  const now = Date.now();
  const active = (attempts.get(bucket) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (active.length >= MAX_REQUESTS) return false;
  active.push(now);
  attempts.set(bucket, active);
  return true;
}
