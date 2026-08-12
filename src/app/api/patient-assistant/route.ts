import { generatePatientAssistantResponse } from "@/lib/patient-assistant/service";
import { parsePatientAssistantRequest } from "@/lib/patient-assistant/validation";

export const runtime = "nodejs";

const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const MIN_REQUEST_GAP_MS = 650;

interface RequestBucket {
  timestamps: number[];
  lastRequestAt: number;
  inFlight: boolean;
}

const buckets = new Map<string, RequestBucket>();

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let sessionId = "invalid";
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 28_000) {
      return Response.json(
        { error: "Assistant request is too large", requestId },
        { status: 413 }
      );
    }
    const parsed = parsePatientAssistantRequest(await request.json());
    sessionId = parsed.context.sessionId;
    const rate = acquireRequestSlot(sessionId);
    if (!rate.allowed) {
      return Response.json(
        { error: rate.reason, requestId },
        { status: 429, headers: { "retry-after": "1" } }
      );
    }
    try {
      const generated = await generatePatientAssistantResponse(parsed);
      const response = {
        ...generated.response,
        requestId,
        provider: generated.provider,
      };
      console.info("[patient-assistant]", {
        requestId,
        sessionId,
        contextVersion: parsed.context.version,
        provider: generated.provider,
        allowedActions: parsed.context.availableActions,
        toolActions: response.suggestedActions,
      });
      return Response.json(response, {
        headers: { "cache-control": "no-store" },
      });
    } finally {
      releaseRequestSlot(sessionId);
    }
  } catch (error) {
    console.warn("[patient-assistant] rejected", {
      requestId,
      sessionId,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      { error: "Invalid assistant request", requestId },
      { status: 400 }
    );
  }
}

function acquireRequestSlot(sessionId: string): {
  allowed: boolean;
  reason?: string;
} {
  const now = Date.now();
  const bucket = buckets.get(sessionId) ?? {
    timestamps: [],
    lastRequestAt: 0,
    inFlight: false,
  };
  bucket.timestamps = bucket.timestamps.filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS
  );
  if (bucket.inFlight) return { allowed: false, reason: "A request is already in progress" };
  if (now - bucket.lastRequestAt < MIN_REQUEST_GAP_MS) {
    return { allowed: false, reason: "Requests are arriving too quickly" };
  }
  if (bucket.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, reason: "Assistant request limit reached" };
  }
  bucket.inFlight = true;
  bucket.lastRequestAt = now;
  bucket.timestamps.push(now);
  buckets.set(sessionId, bucket);
  return { allowed: true };
}

function releaseRequestSlot(sessionId: string) {
  const bucket = buckets.get(sessionId);
  if (bucket) bucket.inFlight = false;
}

