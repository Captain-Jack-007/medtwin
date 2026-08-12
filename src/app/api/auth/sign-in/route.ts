import { internalAuthEmail, isValidPassword } from "@/lib/auth/credentials";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isValidUsername, normalizeUsername } from "@/lib/auth/username";

export const runtime = "nodejs";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 8;
const attempts = new Map<string, number[]>();

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 4_000) {
      return Response.json({ error: "Invalid sign-in request", requestId }, { status: 413 });
    }
    const input = await request.json() as { username?: unknown; password?: unknown };
    const username = validUsername(input.username);
    const password = validPassword(input.password);
    const bucket = clientBucket(request);
    if (!withinLimit(bucket)) {
      return Response.json({ error: "Too many sign-in attempts. Please wait and try again.", requestId }, { status: 429, headers: { "retry-after": "60" } });
    }

    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email: internalAuthEmail(username), password });
    if (error) return invalidCredentials(requestId);
    return Response.json({ ok: true, requestId }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.warn("[auth.sign-in] rejected", { requestId, error: error instanceof Error ? error.name : "UnknownError" });
    return invalidCredentials(requestId);
  }
}

function validUsername(value: unknown) {
  if (typeof value !== "string") throw new Error("Invalid username");
  const username = normalizeUsername(value);
  if (!isValidUsername(username)) throw new Error("Invalid username");
  return username;
}

function validPassword(value: unknown) {
  if (!isValidPassword(value)) throw new Error("Invalid password");
  return value;
}

function invalidCredentials(requestId: string) {
  return Response.json({ error: "Invalid username or password", requestId }, { status: 401 });
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
