// Deterministic clinical triage engine.
// NOTE: This is a rules engine, not an LLM. It produces a reproducible
// triage priority + evidence. An LLM may later EXPLAIN this output, but
// never overrides the safety-critical decision made here.

import {
  EvidenceItem,
  Priority,
  PRIORITY_ORDER,
  ScreeningSession,
  SignalQuality,
  SystemName,
  SystemState,
  TriageResult,
} from "./types";
import { RealScanResult, SOURCE_LABEL } from "./measurements/types";

export const RULE_VERSION = "medtwin-rules-2.0";

// Configured screening thresholds (prototype values, not clinical guidance).
const TH = {
  hrHigh: 100,
  hrVeryHigh: 120,
  hrLow: 50,
  rrHigh: 22,
  rrVeryHigh: 26,
  spo2Low: 94,
  spo2VeryLow: 92,
  sysHigh: 140,
  sysVeryHigh: 160,
  diaHigh: 90,
  diaVeryHigh: 100,
};

// Symptom keywords that raise a specific system.
const SYMPTOM_MAP: { match: string[]; system: SystemName; code: string; text: string }[] = [
  { match: ["chest"], system: "cardiovascular", code: "sym_chest", text: "Chest discomfort reported" },
  { match: ["palpitation", "heart"], system: "cardiovascular", code: "sym_palp", text: "Palpitations reported" },
  { match: ["short", "breath"], system: "respiratory", code: "sym_sob", text: "Shortness of breath reported" },
  { match: ["cough"], system: "respiratory", code: "sym_cough", text: "Persistent cough reported" },
  { match: ["dizz", "faint"], system: "neurological", code: "sym_dizzy", text: "Dizziness / faintness reported" },
  { match: ["numb", "weak", "speech"], system: "neurological", code: "sym_focal", text: "Focal neurological symptom reported" },
  { match: ["headache"], system: "neurological", code: "sym_headache", text: "Severe headache reported" },
];

function raise(current: SystemState, next: SystemState): SystemState {
  return PRIORITY_ORDER[next] > PRIORITY_ORDER[current] ? next : current;
}

function maxPriority(states: SystemState[]): Priority {
  return states.reduce<Priority>(
    (acc, s) => (PRIORITY_ORDER[s] > PRIORITY_ORDER[acc] ? s : acc),
    "GREEN"
  );
}

export function runTriage(
  s: ScreeningSession,
  symptoms: string[] = [],
  realScan?: RealScanResult
): TriageResult {
  const systemStates: Record<SystemName, SystemState> = {
    cardiovascular: "GREEN",
    neurological: "GREEN",
    respiratory: "GREEN",
  };
  const evidence: EvidenceItem[] = [];

  const add = (sys: SystemName, level: SystemState, e: EvidenceItem) => {
    systemStates[sys] = raise(systemStates[sys], level);
    if (!evidence.some((x) => x.code === e.code)) evidence.push(e);
  };

  // Symptoms
  for (const sym of symptoms.map((x) => x.toLowerCase())) {
    for (const rule of SYMPTOM_MAP) {
      if (rule.match.some((m) => sym.includes(m))) {
        add(rule.system, "ORANGE", {
          code: rule.code,
          text: rule.text,
          source: "USER REPORTED",
          contributes: true,
        });
      }
    }
  }

  // Heart rate
  const heartEvidence = (code: string, text: string): EvidenceItem => ({
    code,
    text,
    source: realScan ? "CAMERA PPG" : undefined,
    quality: realScan?.heartRate.signalQuality,
    contributes: true,
  });
  if (s.heartRate !== null && s.heartRate >= TH.hrVeryHigh)
    add("cardiovascular", "RED", heartEvidence("hr_vhigh", `Heart rate markedly elevated (${s.heartRate} bpm)`));
  else if (s.heartRate !== null && s.heartRate >= TH.hrHigh)
    add("cardiovascular", "ORANGE", heartEvidence("hr_high", `Heart rate elevated (${s.heartRate} bpm)`));
  else if (s.heartRate !== null && s.heartRate <= TH.hrLow)
    add("cardiovascular", "YELLOW", heartEvidence("hr_low", `Heart rate low (${s.heartRate} bpm)`));

  // Respiration
  const respirationEvidence = (code: string, text: string): EvidenceItem => ({
    code,
    text,
    source: realScan ? "CAMERA / POSE ESTIMATE" : undefined,
    quality: realScan?.respiratoryRate.signalQuality,
    contributes: true,
  });
  if (s.respiratoryRate !== null && s.respiratoryRate >= TH.rrVeryHigh)
    add("respiratory", "RED", respirationEvidence("rr_vhigh", `Respiratory rate markedly elevated (${s.respiratoryRate}/min)`));
  else if (s.respiratoryRate !== null && s.respiratoryRate >= TH.rrHigh)
    add("respiratory", "ORANGE", respirationEvidence("rr_high", `Respiratory rate elevated (${s.respiratoryRate}/min)`));

  // SpO2 is evaluated only when an external device value exists.
  if (s.spo2 != null) {
    if (s.spo2 <= TH.spo2VeryLow)
      add("respiratory", "RED", {
        code: "spo2_vlow",
        text: `Oxygen saturation below screening threshold (${s.spo2}%)`,
        synthetic: !realScan,
        source: realScan ? "EXTERNAL DEVICE" : undefined,
        contributes: true,
      });
    else if (s.spo2 <= TH.spo2Low)
      add("respiratory", "ORANGE", {
        code: "spo2_low",
        text: `Oxygen saturation reduced (${s.spo2}%)`,
        synthetic: !realScan,
        source: realScan ? "EXTERNAL DEVICE" : undefined,
        contributes: true,
      });
  }

  // Blood pressure is evaluated only when an external device value exists.
  if (s.systolic != null && s.diastolic != null) {
    if (s.systolic >= TH.sysVeryHigh || s.diastolic >= TH.diaVeryHigh)
      add("cardiovascular", "RED", {
        code: "bp_vhigh",
        text: `Blood pressure markedly elevated (${s.systolic}/${s.diastolic})`,
        synthetic: !realScan,
        source: realScan ? "EXTERNAL DEVICE" : undefined,
        contributes: true,
      });
    else if (s.systolic >= TH.sysHigh || s.diastolic >= TH.diaHigh)
      add("cardiovascular", "ORANGE", {
        code: "bp_high",
        text: `Blood pressure elevated (${s.systolic}/${s.diastolic})`,
        synthetic: !realScan,
        source: realScan ? "EXTERNAL DEVICE" : undefined,
        contributes: true,
      });
  }

  // Neuro screen
  if (s.faceSymmetry === false)
    add("neurological", realScan ? "ORANGE" : "RED", {
      code: "neuro_face",
      text: "Facial asymmetry screening signal recommended for review",
      source: realScan ? "CAMERA / FACE LANDMARKS" : undefined,
      quality: realScan?.facialSymmetry.signalQuality,
      contributes: true,
    });
  if (s.armSymmetry === false)
    add("neurological", "ORANGE", {
      code: "neuro_arm",
      text: "Movement asymmetry screening signal recommended for review",
      source: realScan ? "CAMERA / POSE LANDMARKS" : undefined,
      quality: realScan?.movementSymmetry.signalQuality,
      contributes: true,
    });
  if (s.speechResult === false)
    add("neurological", "ORANGE", {
      code: "neuro_speech",
      text: "Speech task was not completed successfully",
      source: realScan ? "MICROPHONE TASK" : undefined,
      quality: realScan?.speechTask.signalQuality,
      contributes: true,
    });

  if (realScan) addAvailabilityEvidence(evidence, realScan);

  const priority = maxPriority(Object.values(systemStates));
  const systems = (Object.keys(systemStates) as SystemName[])
    .filter((k) => PRIORITY_ORDER[systemStates[k]] >= PRIORITY_ORDER["ORANGE"])
    .sort((a, b) => PRIORITY_ORDER[systemStates[b]] - PRIORITY_ORDER[systemStates[a]]);
  const observationStates = buildObservationStates(s, systemStates);
  const allUnknown = Object.values(observationStates).every(
    (state) => state === "UNKNOWN"
  );

  return {
    priority,
    systems,
    systemStates,
    observationStates,
    evidence,
    recommendedAction: allUnknown
      ? "incomplete_screening_review"
      : RECOMMENDED_ACTION[priority],
    ruleVersion: RULE_VERSION,
  };
}

function buildObservationStates(
  session: ScreeningSession,
  systemStates: Record<SystemName, SystemState>
): TriageResult["observationStates"] {
  return {
    cardiovascular:
      systemStates.cardiovascular !== "GREEN"
        ? "ABNORMAL"
        : session.heartRate === null &&
            session.systolic == null &&
            session.diastolic == null
          ? "UNKNOWN"
          : "NORMAL",
    respiratory:
      systemStates.respiratory !== "GREEN"
        ? "ABNORMAL"
        : session.respiratoryRate === null && session.spo2 == null
          ? "UNKNOWN"
          : "NORMAL",
    neurological:
      systemStates.neurological !== "GREEN"
        ? "ABNORMAL"
        : session.faceSymmetry === null &&
            session.armSymmetry === null &&
            session.speechResult === null
          ? "UNKNOWN"
          : "NORMAL",
  };
}

export function runRealTriage(result: RealScanResult): TriageResult {
  return runTriage(realScanToSession(result), result.symptoms, result);
}

export function realScanToSession(result: RealScanResult): ScreeningSession {
  return {
    patientId: result.sessionId,
    heartRate: result.heartRate.value,
    respiratoryRate: result.respiratoryRate.value,
    faceSymmetry:
      result.facialSymmetry.value?.classification === "NORMAL_RANGE"
        ? true
        : result.facialSymmetry.value?.classification === "REVIEW"
          ? false
          : null,
    armSymmetry:
      result.movementSymmetry.value?.classification === "SYMMETRIC"
        ? true
        : result.movementSymmetry.value?.classification === "POSSIBLE_ASYMMETRY"
          ? false
          : null,
    speechResult:
      result.speechTask.value?.classification === "CAPTURED" ? true : null,
    signalQuality: overallQuality(result),
    systolic: result.bloodPressure.value?.systolic,
    diastolic: result.bloodPressure.value?.diastolic,
    spo2: result.spo2.value ?? undefined,
  };
}

function addAvailabilityEvidence(
  evidence: EvidenceItem[],
  result: RealScanResult
) {
  const unavailable = [
    ["hr_unavailable", "Heart rate", result.heartRate],
    ["rr_unavailable", "Respiratory rate", result.respiratoryRate],
    ["bp_unavailable", "Blood pressure", result.bloodPressure],
    ["spo2_unavailable", "SpO₂", result.spo2],
  ] as const;
  for (const [code, label, measurement] of unavailable) {
    if (measurement.value !== null) continue;
    evidence.push({
      code,
      text: `${label}: ${measurement.status.replaceAll("_", " ")}`,
      source: SOURCE_LABEL[measurement.source].toUpperCase(),
      quality: measurement.signalQuality,
      contributes: false,
    });
  }
}

function overallQuality(result: RealScanResult): SignalQuality {
  const qualities = [
    result.heartRate.signalQuality,
    result.respiratoryRate.signalQuality,
    result.facialSymmetry.signalQuality,
    result.movementSymmetry.signalQuality,
    result.speechTask.signalQuality,
  ].filter((quality): quality is number => quality !== null);
  if (!qualities.length) return "POOR";
  const average = qualities.reduce((sum, quality) => sum + quality, 0) / qualities.length;
  return average >= 0.75 ? "GOOD" : average >= 0.5 ? "FAIR" : "POOR";
}

export const RECOMMENDED_ACTION: Record<Priority, string> = {
  GREEN: "self_care_or_review",
  YELLOW: "routine_review",
  ORANGE: "professional_assessment",
  RED: "urgent_professional_assessment",
};
