import { MEDTWIN_AI_REQUEST_TYPES, type MedTwinAIRequest, type PatientAIContext } from "./types";

export function parseMedTwinAIRequest(input: unknown): MedTwinAIRequest {
  if (!isRecord(input)) throw new Error("Request must be an object");
  const sessionId = string(input.sessionId, "sessionId", 1, 100);
  const audience = input.audience === "patient" || input.audience === "clinician" ? input.audience : fail("Unsupported MedTwin AI audience");
  const scenarioId = optionalString(input.scenarioId, "scenarioId", 100);
  if (audience === "clinician" && !scenarioId) fail("scenarioId is required for clinician context");
  if (typeof input.requestType !== "string" || !MEDTWIN_AI_REQUEST_TYPES.includes(input.requestType as MedTwinAIRequest["requestType"])) throw new Error("Unsupported MedTwin AI request");
  const selectedFindingId = optionalString(input.selectedFindingId, "selectedFindingId", 100);
  const selectedPlanId = optionalString(input.selectedPlanId, "selectedPlanId", 100);
  const candidateId = optionalString(input.candidateId, "candidateId", 100);
  const question = optionalString(input.question, "question", 700);
  const patientContext = audience === "patient" ? parsePatientContext(input.patientContext) : undefined;
  if (audience === "patient" && !patientContext) fail("patientContext is required for patient context");
  return { sessionId, scenarioId, audience, requestType: input.requestType as MedTwinAIRequest["requestType"], selectedFindingId, selectedPlanId, candidateId, question, patientContext };
}

function optionalString(value: unknown, field: string, max: number) { return value === undefined ? undefined : string(value, field, 1, max); }
function string(value: unknown, field: string, min: number, max: number) { if (typeof value !== "string" || value.trim().length < min || value.length > max) throw new Error(`${field} is invalid`); return value.trim(); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function fail(message: string): never { throw new Error(message); }
function parsePatientContext(value: unknown): PatientAIContext {
  if (!isRecord(value)) fail("patientContext is invalid");
  const resultSummary = string(value.resultSummary, "patientContext.resultSummary", 1, 600);
  const measurements = stringList(value.measurements, "patientContext.measurements", 8, 1000, true);
  const detectedSignals = stringList(value.detectedSignals, "patientContext.detectedSignals", 12, 1000);
  const unavailableMeasurements = stringList(value.unavailableMeasurements, "patientContext.unavailableMeasurements", 12, 1000);
  return { resultSummary, measurements: measurements.map((value) => JSON.parse(value) as { label: string; value: string | null; status: string }), detectedSignals, unavailableMeasurements };
}
function stringList(value: unknown, field: string, max: number, totalMax: number, measurements = false): string[] {
  if (!Array.isArray(value) || value.length > max) fail(`${field} is invalid`);
  const list = value.map((item, index) => {
    if (measurements) {
      if (!isRecord(item)) fail(`${field}.${index} is invalid`);
      const label = string(item.label, `${field}.${index}.label`, 1, 80);
      const measurementValue = item.value === null ? null : string(item.value, `${field}.${index}.value`, 1, 80);
      const status = string(item.status, `${field}.${index}.status`, 1, 80);
      return JSON.stringify({ label, value: measurementValue, status });
    }
    return string(item, `${field}.${index}`, 1, 180);
  });
  if (list.join("").length > totalMax) fail(`${field} is too large`);
  return list;
}
