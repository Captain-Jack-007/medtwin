import type { RealScanResult } from "@/lib/measurements/types";

const MAX_SYMPTOMS = 20;

export function parseRealScanResult(input: unknown): RealScanResult {
  if (!isRecord(input)) fail("Scan result must be an object");
  const result = input as unknown as RealScanResult;
  if (!validId(result.sessionId) || !validDate(result.completedAt)) fail("Invalid scan identity");
  if (!isRecord(result.demographics) || !validAge(result.demographics.ageRange) || !validSex(result.demographics.sex) || !validText(result.demographics.location, 1, 80)) fail("Invalid demographics");
  if (!Array.isArray(result.symptoms) || result.symptoms.length > MAX_SYMPTOMS || !result.symptoms.every((symptom) => validText(symptom, 1, 100))) fail("Invalid symptoms");
  if (
    result.structuredSymptoms !== undefined &&
    (!Array.isArray(result.structuredSymptoms) ||
      result.structuredSymptoms.length > MAX_SYMPTOMS ||
      !result.structuredSymptoms.every(validStructuredSymptom))
  ) {
    fail("Invalid structured symptoms");
  }
  if (!validText(result.consentVersion, 1, 100)) fail("Invalid consent version");
  validateMeasurement(result.heartRate, "heart rate");
  validateMeasurement(result.respiratoryRate, "respiratory rate");
  validateMeasurement(result.facialSymmetry, "facial symmetry");
  validateMeasurement(result.movementSymmetry, "movement symmetry");
  validateMeasurement(result.speechTask, "speech task");
  validateMeasurement(result.bloodPressure, "blood pressure");
  validateMeasurement(result.spo2, "SpO2");
  return result;
}

function validateMeasurement(measurement: unknown, label: string) {
  if (!isRecord(measurement) || !validText(String(measurement.unit ?? ""), 1, 32) || !validDate(String(measurement.timestamp ?? "")) || !validMeasurementStatus(measurement.status)) fail(`Invalid ${label} measurement`);
  if (measurement.value !== null && measurement.value !== undefined && typeof measurement.value !== "number" && !isRecord(measurement.value)) fail(`Invalid ${label} value`);
  const signalQuality = measurement.signalQuality;
  if (signalQuality !== null && signalQuality !== undefined && (typeof signalQuality !== "number" || !Number.isFinite(signalQuality) || signalQuality < 0 || signalQuality > 1)) fail(`Invalid ${label} quality`);
  const confidence = measurement.confidence;
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) fail(`Invalid ${label} confidence`);
  if (!validMeasurementSource(measurement.source)) fail(`Invalid ${label} source`);
  if (measurement.algorithm !== null && measurement.algorithm !== undefined && !validText(String(measurement.algorithm), 1, 120)) fail(`Invalid ${label} algorithm`);
}

function validMeasurementStatus(value: unknown) { return value === "measured" || value === "estimated" || value === "completed" || value === "insufficient_signal" || value === "not_measured" || value === "external_device_required" || value === "unavailable"; }
function validMeasurementSource(value: unknown) { return value === "camera-derived" || value === "microphone-derived" || value === "user-reported" || value === "device-measured" || value === "derived" || value === "unavailable"; }
function validStructuredSymptom(value: unknown) {
  return isRecord(value) &&
    validText(value.questionId, 1, 100) &&
    validText(value.symptom, 1, 100) &&
    (value.answer === "yes" || value.answer === "no" || value.answer === "unsure") &&
    validDate(value.recordedAt);
}
function validAge(value: unknown) { return typeof value === "string" && ["18-29", "30-44", "45-59", "60-74", "75+"].includes(value); }
function validSex(value: unknown) { return value === "M" || value === "F"; }
function validId(value: unknown) { return typeof value === "string" && /^MT-[A-Z0-9-]{5,80}$/.test(value); }
function validDate(value: unknown) { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }
function validText(value: unknown, min: number, max: number) { return typeof value === "string" && value.trim().length >= min && value.length <= max; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function fail(message: string): never { throw new Error(message); }
