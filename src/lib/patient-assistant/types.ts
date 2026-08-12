import type {
  MeasurementStatus,
  PermissionState,
  SensorState,
  StructuredSymptomAnswer,
} from "@/lib/measurements/types";
import type { Priority } from "@/lib/types";

export const PATIENT_ASSISTANT_CONTEXT_VERSION = "1.0" as const;

export const PATIENT_ASSISTANT_ACTIONS = [
  "NONE",
  "OPEN_WHY",
  "OPEN_CLINICAL_BRIEF",
  "SHOW_MEASUREMENTS",
  "SHOW_SCAN_HELP",
  "UPDATE_STRUCTURED_SYMPTOM",
  "REQUEST_CLINICIAN_REVIEW",
  "FOCUS_HEART",
  "FOCUS_LUNGS",
  "FOCUS_BRAIN",
  "RESET_ANATOMY_VIEW",
] as const;

export type PatientAssistantAction =
  (typeof PATIENT_ASSISTANT_ACTIONS)[number];
export type PatientAssistantLanguage = "uz" | "ru" | "en";
export type PatientAssistantRoute = "scan" | "twin";

export type AssistantMeasurementSource =
  | "camera_ppg"
  | "camera_pose"
  | "camera_face_landmarks"
  | "camera_pose_landmarks"
  | "microphone_voice_activity"
  | "user_reported"
  | "external_device"
  | "health_station"
  | "derived"
  | "demo_scenario"
  | "not_measured";

export interface PatientAssistantMeasurement {
  key: "heart_rate" | "respiratory_rate" | "blood_pressure" | "spo2";
  label: string;
  value: number | string | null;
  unit: string;
  source: AssistantMeasurementSource;
  status: MeasurementStatus;
  quality: number | null;
}

export interface PatientAssistantScreeningSignal {
  key: "facial_symmetry" | "movement_symmetry" | "speech_task";
  label: string;
  value: string | null;
  source: AssistantMeasurementSource;
  status: MeasurementStatus;
  quality: number | null;
}

export interface ScanAssistantSnapshot {
  status: SensorState | "not_started" | "complete";
  activeSensor:
    | "front_camera"
    | "rear_camera"
    | "microphone"
    | "none";
  permissions: {
    camera: PermissionState;
    microphone: PermissionState;
  };
  signalQuality: number | null;
  indicators: {
    faceDetected?: boolean;
    exactlyOneFace?: boolean;
    lightingGood?: boolean;
    motionLow?: boolean;
    upperBodyDetected?: boolean;
    fingerCoverage?: number;
    pulsePeriodicity?: number;
    clippingControlled?: boolean;
    leftArmRaised?: boolean;
    rightArmRaised?: boolean;
    holdComplete?: boolean;
    voiceDetected?: boolean;
    audioClipping?: boolean;
  };
}

export interface PatientAssistantContext {
  version: typeof PATIENT_ASSISTANT_CONTEXT_VERSION;
  sessionId: string;
  currentRoute: PatientAssistantRoute;
  dataMode: "in_progress" | "real" | "demo";
  language: PatientAssistantLanguage;
  scan: (ScanAssistantSnapshot & { currentStep: string }) | null;
  demographics: {
    ageRange: string | null;
    sex: "M" | "F" | null;
    area: string | null;
  };
  symptoms: string[];
  structuredSymptoms: StructuredSymptomAnswer[];
  measurements: PatientAssistantMeasurement[];
  screeningSignals: PatientAssistantScreeningSignal[];
  triage: {
    priority: Priority;
    headline: string;
    reasons: string[];
    recommendedAction: string;
    ruleVersion: string;
  } | null;
  availableActions: PatientAssistantAction[];
}

export interface PatientAssistantChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PatientAssistantRequest {
  context: PatientAssistantContext;
  language: PatientAssistantLanguage;
  message: string;
  conversation: PatientAssistantChatMessage[];
}

export type PatientAssistantIntent =
  | "scan_guidance"
  | "explain_results"
  | "explain_measurement"
  | "explain_priority"
  | "missing_measurements"
  | "next_step"
  | "privacy"
  | "anatomy_focus"
  | "medication_boundary"
  | "diagnosis_boundary"
  | "triage_boundary"
  | "general_help"
  | "assistant_unavailable";

export interface PatientAssistantResponse {
  message: string;
  intent: PatientAssistantIntent;
  suggestedActions: PatientAssistantAction[];
  requiresEscalation: boolean;
  requestId?: string;
  provider?: string;
}

