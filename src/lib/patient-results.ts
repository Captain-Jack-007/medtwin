import type { MeasurementStatus } from "@/lib/measurements/types";
import type { Priority, SynthPatient, SystemName } from "@/lib/types";

export type MedTwinAudience = "patient" | "clinician";

export type PatientResultStatus =
  | "no_warning_detected"
  | "review_needed"
  | "urgent_review_needed"
  | "incomplete";

export type PatientMeasurementStatus =
  | "measured_normal"
  | "measured_abnormal"
  | "not_measured"
  | "device_required"
  | "unavailable";

export interface PatientMeasurementSummary {
  key: "heart_rate" | "respiratory_rate" | "blood_pressure" | "spo2";
  value: string | null;
  status: PatientMeasurementStatus;
}

export interface PatientResultSummary {
  audience: "patient";
  status: PatientResultStatus;
  detectedSignalCount: number;
  affectedSystems: SystemName[];
  measurements: PatientMeasurementSummary[];
  unavailableMeasurementCount: number;
  hasSufficientMeasurements: boolean;
}

const HIGH_PRIORITY: Priority[] = ["ORANGE", "RED"];

export function derivePatientResult(patient: SynthPatient): PatientResultSummary {
  const isRealPatient = patient.dataMode === "real";
  const measurements = patient.realScan
    ? realMeasurements(patient)
    : isRealPatient
      ? unavailableMeasurements()
      : demoMeasurements(patient);
  const contributingEvidence = patient.triage.evidence.filter(
    (evidence) => evidence.contributes
  );
  const detectedSignalCount = contributingEvidence.length;
  const hasSufficientMeasurements = isRealPatient
    ? measurements.some(
        (measurement) =>
          measurement.status === "measured_normal" ||
          measurement.status === "measured_abnormal"
      )
    : true;
  const status: PatientResultStatus = detectedSignalCount === 0
    ? hasSufficientMeasurements
      ? "no_warning_detected"
      : "incomplete"
    : patient.triage.priority === "RED"
      ? "urgent_review_needed"
      : "review_needed";

  return {
    audience: "patient",
    status,
    detectedSignalCount,
    affectedSystems:
      detectedSignalCount > 0
        ? patient.triage.systems.filter((system) =>
            HIGH_PRIORITY.includes(patient.triage.systemStates[system])
          )
        : [],
    measurements,
    unavailableMeasurementCount: measurements.filter(
      (measurement) =>
        measurement.status === "not_measured" ||
        measurement.status === "device_required" ||
        measurement.status === "unavailable"
    ).length,
    hasSufficientMeasurements,
  };
}

function realMeasurements(patient: SynthPatient): PatientMeasurementSummary[] {
  const scan = patient.realScan!;
  return [
    numeric("heart_rate", scan.heartRate.value, "bpm", scan.heartRate.status, hasEvidence(patient, ["hr_"])),
    numeric("respiratory_rate", scan.respiratoryRate.value, "/min", scan.respiratoryRate.status, hasEvidence(patient, ["rr_"])),
    {
      key: "blood_pressure",
      value: scan.bloodPressure.value
        ? `${scan.bloodPressure.value.systolic}/${scan.bloodPressure.value.diastolic} mmHg`
        : null,
      status: statusFor(scan.bloodPressure.status, scan.bloodPressure.value !== null, hasEvidence(patient, ["bp_"])),
    },
    numeric("spo2", scan.spo2.value, "%", scan.spo2.status, hasEvidence(patient, ["spo2_"])),
  ];
}

function unavailableMeasurements(): PatientMeasurementSummary[] {
  return ["heart_rate", "respiratory_rate", "blood_pressure", "spo2"].map((key) => ({
    key: key as PatientMeasurementSummary["key"],
    value: null,
    status: "unavailable" as const,
  }));
}

function demoMeasurements(patient: SynthPatient): PatientMeasurementSummary[] {
  const { session, triage } = patient;
  return [
    {
      key: "heart_rate",
      value: session.heartRate === null ? null : `${session.heartRate} bpm`,
      status: session.heartRate === null ? "unavailable" : triage.systemStates.cardiovascular === "GREEN" ? "measured_normal" : "measured_abnormal",
    },
    {
      key: "respiratory_rate",
      value: session.respiratoryRate === null ? null : `${session.respiratoryRate} /min`,
      status: session.respiratoryRate === null ? "unavailable" : triage.systemStates.respiratory === "GREEN" ? "measured_normal" : "measured_abnormal",
    },
    {
      key: "blood_pressure",
      value: session.systolic != null && session.diastolic != null ? `${session.systolic}/${session.diastolic} mmHg` : null,
      status: session.systolic != null && session.diastolic != null ? triage.systemStates.cardiovascular === "GREEN" ? "measured_normal" : "measured_abnormal" : "unavailable",
    },
    {
      key: "spo2",
      value: session.spo2 === undefined ? null : `${session.spo2}%`,
      status: session.spo2 === undefined ? "unavailable" : triage.systemStates.respiratory === "GREEN" ? "measured_normal" : "measured_abnormal",
    },
  ];
}

function numeric(
  key: PatientMeasurementSummary["key"],
  value: number | null,
  unit: string,
  status: MeasurementStatus,
  abnormal = false
): PatientMeasurementSummary {
  return {
    key,
    value: value === null ? null : `${value} ${unit}`,
    status: statusFor(status, value !== null, abnormal),
  };
}

function statusFor(
  status: MeasurementStatus,
  hasValue: boolean,
  abnormal = false
): PatientMeasurementStatus {
  if (status === "external_device_required") return "device_required";
  if (status === "not_measured") return "not_measured";
  if (!hasValue || status === "insufficient_signal" || status === "unavailable") {
    return "unavailable";
  }
  return abnormal ? "measured_abnormal" : "measured_normal";
}

function hasEvidence(patient: SynthPatient, prefixes: string[]) {
  return patient.triage.evidence.some(
    (evidence) => evidence.contributes && prefixes.some((prefix) => evidence.code.startsWith(prefix))
  );
}
