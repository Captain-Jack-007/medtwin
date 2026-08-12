import {
  PATIENT_ASSISTANT_ACTIONS,
  PATIENT_ASSISTANT_CONTEXT_VERSION,
  type PatientAssistantAction,
  type PatientAssistantContext,
  type PatientAssistantIntent,
  type PatientAssistantRequest,
  type PatientAssistantResponse,
} from "./types";

const ACTION_SET = new Set<string>(PATIENT_ASSISTANT_ACTIONS);
const INTENTS = new Set<PatientAssistantIntent>([
  "scan_guidance",
  "explain_results",
  "explain_measurement",
  "explain_priority",
  "missing_measurements",
  "next_step",
  "privacy",
  "anatomy_focus",
  "medication_boundary",
  "diagnosis_boundary",
  "triage_boundary",
  "general_help",
  "assistant_unavailable",
]);

export class PatientAssistantValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatientAssistantValidationError";
  }
}

export function parsePatientAssistantRequest(
  input: unknown
): PatientAssistantRequest {
  if (!isRecord(input)) fail("Request must be an object");
  const message = readString(input.message, "message", 1, 800);
  const language = input.language;
  if (language !== "uz" && language !== "ru" && language !== "en") {
    fail("Unsupported assistant language");
  }
  const context = parseContext(input.context);
  if (context.language !== language) fail("Language context mismatch");
  if (!Array.isArray(input.conversation) || input.conversation.length > 8) {
    fail("Conversation must contain at most 8 messages");
  }
  const conversation = input.conversation.map((entry, index) => {
    if (!isRecord(entry)) fail(`Conversation ${index} is invalid`);
    if (entry.role !== "user" && entry.role !== "assistant") {
      fail(`Conversation ${index} has an invalid role`);
    }
    const role: "user" | "assistant" = entry.role;
    return {
      role,
      content: readString(entry.content, `conversation.${index}`, 1, 800),
    };
  });
  return { context, language, message, conversation };
}

export function validateProviderResponse(
  input: unknown,
  allowedActions: PatientAssistantAction[]
): PatientAssistantResponse {
  if (!isRecord(input)) fail("Provider response must be an object");
  const message = readString(input.message, "response.message", 1, 1600);
  if (typeof input.intent !== "string" || !INTENTS.has(input.intent as PatientAssistantIntent)) {
    fail("Provider response intent is invalid");
  }
  if (!Array.isArray(input.suggestedActions)) {
    fail("Provider actions must be an array");
  }
  const allow = new Set<PatientAssistantAction>(["NONE", ...allowedActions]);
  const suggestedActions = input.suggestedActions.filter(
    (action): action is PatientAssistantAction =>
      typeof action === "string" &&
      ACTION_SET.has(action) &&
      allow.has(action as PatientAssistantAction)
  );
  if (typeof input.requiresEscalation !== "boolean") {
    fail("Provider escalation flag is invalid");
  }
  return {
    message,
    intent: input.intent as PatientAssistantIntent,
    suggestedActions,
    requiresEscalation: input.requiresEscalation,
  };
}

function parseContext(input: unknown): PatientAssistantContext {
  if (!isRecord(input)) fail("Assistant context must be an object");
  if (input.version !== PATIENT_ASSISTANT_CONTEXT_VERSION) {
    fail("Unsupported assistant context version");
  }
  const serialized = JSON.stringify(input);
  if (serialized.length > 24_000) fail("Assistant context is too large");
  readString(input.sessionId, "sessionId", 1, 100);
  if (input.currentRoute !== "scan" && input.currentRoute !== "twin") {
    fail("Assistant route is invalid");
  }
  if (
    input.dataMode !== "in_progress" &&
    input.dataMode !== "real" &&
    input.dataMode !== "demo"
  ) {
    fail("Assistant data mode is invalid");
  }
  if (input.language !== "uz" && input.language !== "ru" && input.language !== "en") {
    fail("Assistant context language is invalid");
  }
  if (!Array.isArray(input.symptoms) || input.symptoms.length > 20) {
    fail("Symptoms are invalid");
  }
  input.symptoms.forEach((symptom, index) =>
    readString(symptom, `symptoms.${index}`, 1, 100)
  );
  if (!Array.isArray(input.measurements) || input.measurements.length > 12) {
    fail("Measurements are invalid");
  }
  if (!Array.isArray(input.screeningSignals) || input.screeningSignals.length > 12) {
    fail("Screening signals are invalid");
  }
  if (!Array.isArray(input.structuredSymptoms) || input.structuredSymptoms.length > 20) {
    fail("Structured symptoms are invalid");
  }
  if (!Array.isArray(input.availableActions) || input.availableActions.length > 16) {
    fail("Available actions are invalid");
  }
  for (const action of input.availableActions) {
    if (typeof action !== "string" || !ACTION_SET.has(action)) {
      fail("Context contains an unknown action");
    }
  }
  validateBoundedContextRecords(input);
  return input as unknown as PatientAssistantContext;
}

function validateBoundedContextRecords(input: Record<string, unknown>) {
  if (!isRecord(input.demographics)) fail("Demographics are invalid");
  for (const key of ["ageRange", "area"] as const) {
    const value = input.demographics[key];
    if (value !== null) readString(value, `demographics.${key}`, 1, 80);
  }
  if (
    input.demographics.sex !== null &&
    input.demographics.sex !== "M" &&
    input.demographics.sex !== "F"
  ) {
    fail("Demographic sex is invalid");
  }
  if (input.scan !== null && !isRecord(input.scan)) fail("Scan context is invalid");
  if (input.triage !== null) {
    if (!isRecord(input.triage)) fail("Triage context is invalid");
    if (!Array.isArray(input.triage.reasons) || input.triage.reasons.length > 20) {
      fail("Triage reasons are invalid");
    }
    input.triage.reasons.forEach((reason, index) =>
      readString(reason, `triage.reasons.${index}`, 1, 240)
    );
  }
}

function readString(
  value: unknown,
  field: string,
  minLength: number,
  maxLength: number
) {
  if (
    typeof value !== "string" ||
    value.trim().length < minLength ||
    value.length > maxLength
  ) {
    fail(`${field} is invalid`);
  }
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new PatientAssistantValidationError(message);
}
