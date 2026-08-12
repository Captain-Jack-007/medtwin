export type MeasurementSource =
  | "camera-derived"
  | "microphone-derived"
  | "user-reported"
  | "device-measured"
  | "derived"
  | "unavailable";

export type MeasurementStatus =
  | "measured"
  | "estimated"
  | "completed"
  | "insufficient_signal"
  | "not_measured"
  | "external_device_required"
  | "unavailable";

export interface Measurement<T> {
  value: T | null;
  unit: string;
  source: MeasurementSource;
  timestamp: string;
  confidence: number;
  signalQuality: number | null;
  algorithm: string | null;
  status: MeasurementStatus;
}

export type ScreeningClassification =
  | "NORMAL_RANGE"
  | "REVIEW"
  | "SYMMETRIC"
  | "POSSIBLE_ASYMMETRY"
  | "CAPTURED"
  | "INSUFFICIENT_SIGNAL";

export interface ScreeningValue {
  classification: ScreeningClassification;
  score: number | null;
}

export type ScreeningMeasurement = Measurement<ScreeningValue>;

export interface BloodPressureValue {
  systolic: number;
  diastolic: number;
}

export interface ScanDemographics {
  ageRange: string;
  sex: "M" | "F";
  location: string;
}

export interface StructuredSymptomAnswer {
  questionId: string;
  symptom: string;
  answer: "yes" | "no" | "unsure";
  recordedAt: string;
}

export interface RealScanResult {
  sessionId: string;
  demographics: ScanDemographics;
  symptoms: string[];
  structuredSymptoms?: StructuredSymptomAnswer[];
  heartRate: Measurement<number>;
  respiratoryRate: Measurement<number>;
  facialSymmetry: ScreeningMeasurement;
  movementSymmetry: ScreeningMeasurement;
  speechTask: ScreeningMeasurement;
  bloodPressure: Measurement<BloodPressureValue>;
  spo2: Measurement<number>;
  consentVersion: string;
  completedAt: string;
}

export type SensorState =
  | "idle"
  | "requesting_permission"
  | "preparing"
  | "capturing"
  | "processing"
  | "success"
  | "low_quality"
  | "failed"
  | "unsupported";

export type PermissionState =
  | "not_requested"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable";

export const SOURCE_LABEL: Record<MeasurementSource, string> = {
  "camera-derived": "Camera derived",
  "microphone-derived": "Microphone derived",
  "user-reported": "User reported",
  "device-measured": "External device",
  derived: "Derived",
  unavailable: "Not measured",
};
