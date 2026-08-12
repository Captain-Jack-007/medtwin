import type {
  Measurement,
  RealScanResult,
  ScreeningMeasurement,
  StructuredSymptomAnswer,
} from "@/lib/measurements/types";
import type { SynthPatient } from "@/lib/types";
import { ACTION_TEXT, PRIORITY_HEADLINE } from "@/lib/ui";
import {
  PATIENT_ASSISTANT_CONTEXT_VERSION,
  type AssistantMeasurementSource,
  type PatientAssistantContext,
  type PatientAssistantLanguage,
  type PatientAssistantMeasurement,
  type PatientAssistantScreeningSignal,
  type ScanAssistantSnapshot,
} from "./types";

export interface ScanContextInput {
  sessionId: string;
  currentStep: string;
  language: PatientAssistantLanguage;
  scan: ScanAssistantSnapshot | null;
  demographics: {
    ageRange: string | null;
    sex: "M" | "F" | null;
    area: string | null;
  };
  symptoms: string[];
  structuredSymptoms: StructuredSymptomAnswer[];
  heartRate: Measurement<number> | null;
  respiratoryRate: Measurement<number> | null;
  facialSymmetry: ScreeningMeasurement | null;
  movementSymmetry: ScreeningMeasurement | null;
  speechTask: ScreeningMeasurement | null;
}

export function buildScanAssistantContext(
  input: ScanContextInput
): PatientAssistantContext {
  const measurements: PatientAssistantMeasurement[] = [];
  if (input.heartRate) {
    measurements.push(
      numericMeasurement("heart_rate", "Heart rate", input.heartRate)
    );
  }
  if (input.respiratoryRate) {
    measurements.push(
      numericMeasurement(
        "respiratory_rate",
        "Respiratory rate",
        input.respiratoryRate
      )
    );
  }
  const screeningSignals: PatientAssistantScreeningSignal[] = [];
  if (input.facialSymmetry) {
    screeningSignals.push(
      screeningSignal(
        "facial_symmetry",
        "Facial symmetry screen",
        input.facialSymmetry
      )
    );
  }
  if (input.movementSymmetry) {
    screeningSignals.push(
      screeningSignal(
        "movement_symmetry",
        "Movement symmetry screen",
        input.movementSymmetry
      )
    );
  }
  if (input.speechTask) {
    screeningSignals.push(
      screeningSignal("speech_task", "Speech task", input.speechTask)
    );
  }
  return {
    version: PATIENT_ASSISTANT_CONTEXT_VERSION,
    sessionId: input.sessionId,
    currentRoute: "scan",
    dataMode: "in_progress",
    language: input.language,
    scan: input.scan ? { ...input.scan, currentStep: input.currentStep } : null,
    demographics: input.demographics,
    symptoms: input.symptoms,
    structuredSymptoms: input.structuredSymptoms,
    measurements,
    screeningSignals,
    triage: null,
    availableActions: ["SHOW_SCAN_HELP", "UPDATE_STRUCTURED_SYMPTOM"],
  };
}

export function buildTwinAssistantContext({
  patient,
  area,
  language,
}: {
  patient: SynthPatient;
  area: string | null;
  language: PatientAssistantLanguage;
}): PatientAssistantContext {
  const realScan = patient.realScan;
  const highPriority = patient.triage.priority === "RED";
  return {
    version: PATIENT_ASSISTANT_CONTEXT_VERSION,
    sessionId: patient.info.id,
    currentRoute: "twin",
    dataMode: realScan ? "real" : "demo",
    language,
    scan: null,
    demographics: {
      ageRange: patient.info.ageRange,
      sex: patient.info.sex,
      area,
    },
    symptoms: patient.info.symptoms,
    structuredSymptoms: realScan?.structuredSymptoms ?? [],
    measurements: realScan
      ? realMeasurements(realScan)
      : demoMeasurements(patient),
    screeningSignals: realScan ? realScreeningSignals(realScan) : [],
    triage: {
      priority: patient.triage.priority,
      headline: PRIORITY_HEADLINE[patient.triage.priority],
      reasons: patient.triage.evidence
        .filter((evidence) => evidence.contributes !== false)
        .map((evidence) => evidence.text),
      recommendedAction:
        ACTION_TEXT[patient.triage.recommendedAction] ??
        patient.triage.recommendedAction,
      ruleVersion: patient.triage.ruleVersion,
    },
    availableActions: [
      "OPEN_WHY",
      "OPEN_CLINICAL_BRIEF",
      "SHOW_MEASUREMENTS",
      "FOCUS_HEART",
      "FOCUS_LUNGS",
      "FOCUS_BRAIN",
      "RESET_ANATOMY_VIEW",
      ...(highPriority ? (["REQUEST_CLINICIAN_REVIEW"] as const) : []),
    ],
  };
}

function realMeasurements(result: RealScanResult): PatientAssistantMeasurement[] {
  return [
    numericMeasurement("heart_rate", "Heart rate", result.heartRate),
    numericMeasurement(
      "respiratory_rate",
      "Respiratory rate",
      result.respiratoryRate
    ),
    {
      key: "blood_pressure",
      label: "Blood pressure",
      value: result.bloodPressure.value
        ? `${result.bloodPressure.value.systolic}/${result.bloodPressure.value.diastolic}`
        : null,
      unit: result.bloodPressure.unit,
      source: sourceFor(result.bloodPressure),
      status: result.bloodPressure.status,
      quality: result.bloodPressure.signalQuality,
    },
    numericMeasurement("spo2", "SpO₂", result.spo2),
  ];
}

function demoMeasurements(patient: SynthPatient): PatientAssistantMeasurement[] {
  return [
    {
      key: "heart_rate",
      label: "Heart rate",
      value: patient.session.heartRate,
      unit: "bpm",
      source: "demo_scenario",
      status: patient.session.heartRate === null ? "unavailable" : "estimated",
      quality: null,
    },
    {
      key: "respiratory_rate",
      label: "Respiratory rate",
      value: patient.session.respiratoryRate,
      unit: "/min",
      source: "demo_scenario",
      status:
        patient.session.respiratoryRate === null ? "unavailable" : "estimated",
      quality: null,
    },
    {
      key: "blood_pressure",
      label: "Blood pressure",
      value:
        patient.session.systolic != null && patient.session.diastolic != null
          ? `${patient.session.systolic}/${patient.session.diastolic}`
          : null,
      unit: "mmHg",
      source:
        patient.session.systolic != null
          ? "demo_scenario"
          : "not_measured",
      status:
        patient.session.systolic != null ? "estimated" : "not_measured",
      quality: null,
    },
    {
      key: "spo2",
      label: "SpO₂",
      value: patient.session.spo2 ?? null,
      unit: "%",
      source:
        patient.session.spo2 != null ? "demo_scenario" : "not_measured",
      status:
        patient.session.spo2 != null
          ? "estimated"
          : "external_device_required",
      quality: null,
    },
  ];
}

function realScreeningSignals(
  result: RealScanResult
): PatientAssistantScreeningSignal[] {
  return [
    screeningSignal(
      "facial_symmetry",
      "Facial symmetry screen",
      result.facialSymmetry
    ),
    screeningSignal(
      "movement_symmetry",
      "Movement symmetry screen",
      result.movementSymmetry
    ),
    screeningSignal("speech_task", "Speech task", result.speechTask),
  ];
}

function numericMeasurement(
  key: PatientAssistantMeasurement["key"],
  label: string,
  measurement: Measurement<number>
): PatientAssistantMeasurement {
  return {
    key,
    label,
    value: measurement.value,
    unit: measurement.unit,
    source: sourceFor(measurement),
    status: measurement.status,
    quality: measurement.signalQuality,
  };
}

function screeningSignal(
  key: PatientAssistantScreeningSignal["key"],
  label: string,
  measurement: ScreeningMeasurement
): PatientAssistantScreeningSignal {
  return {
    key,
    label,
    value: measurement.value?.classification ?? null,
    source: sourceFor(measurement),
    status: measurement.status,
    quality: measurement.signalQuality,
  };
}

function sourceFor(
  measurement: Measurement<unknown>
): AssistantMeasurementSource {
  if (measurement.value === null || measurement.source === "unavailable") {
    return "not_measured";
  }
  if (measurement.algorithm === "camera_ppg_v1") return "camera_ppg";
  if (measurement.algorithm === "pose_respiration_v1") return "camera_pose";
  if (measurement.algorithm?.includes("face")) return "camera_face_landmarks";
  if (measurement.algorithm?.includes("movement")) return "camera_pose_landmarks";
  if (measurement.source === "microphone-derived") {
    return "microphone_voice_activity";
  }
  if (measurement.source === "user-reported") return "user_reported";
  if (measurement.source === "device-measured") return "external_device";
  return "derived";
}

