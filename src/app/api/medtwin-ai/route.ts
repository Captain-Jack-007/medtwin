import { generateMedTwinAIExplanation } from "@/lib/medtwin-ai/service";
import { parseMedTwinAIRequest } from "@/lib/medtwin-ai/validation";

export const runtime = "nodejs";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 8;
const sessions = new Map<string, number[]>();

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 8_000) return Response.json({ error: "Request is too large", requestId }, { status: 413 });
    const input = parseMedTwinAIRequest(await request.json());
    if (!withinLimit(input.sessionId)) return Response.json({ error: "MedTwin Intelligence request limit reached", requestId }, { status: 429, headers: { "retry-after": "60" } });
    const message = await generateMedTwinAIExplanation(input);
    return Response.json({ message, requestId }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.warn("[medtwin-ai] unavailable", { requestId, error: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "AI explanation temporarily unavailable.", requestId }, { status: 503 });
  }
}

function withinLimit(sessionId: string) {
  const now = Date.now();
  const active = (sessions.get(sessionId) ?? []).filter((time) => now - time < WINDOW_MS);
  if (active.length >= MAX_REQUESTS) return false;
  active.push(now);
  sessions.set(sessionId, active);
  return true;
}
