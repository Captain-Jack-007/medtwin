import { describe, expect, it } from "vitest";
import { derivePatientResult } from "./patient-results";
import { runTriage } from "./triage";
import type { SynthPatient } from "./types";

const emptyPatient: SynthPatient = {
  info: { id: "MT-EMPTY", ageRange: "30-44", sex: "F", location: "v-i", symptoms: [], consent: true, createdAt: "2026-01-01T00:00:00.000Z" },
  session: { patientId: "MT-EMPTY", heartRate: null, respiratoryRate: null, faceSymmetry: null, armSymmetry: null, speechResult: null, signalQuality: "POOR" },
  triage: runTriage({ patientId: "MT-EMPTY", heartRate: null, respiratoryRate: null, faceSymmetry: null, armSymmetry: null, speechResult: null, signalQuality: "POOR" }),
  dataMode: "real",
  realScan: undefined,
};

describe("patient result derivation", () => {
  it("does not derive risk or affected systems from missing data", () => {
    const result = derivePatientResult(emptyPatient);
    expect(result.status).toBe("incomplete");
    expect(result.affectedSystems).toEqual([]);
    expect(result.detectedSignalCount).toBe(0);
  });

  it("keeps a recorded abnormal measurement distinct from a missing one", () => {
    const patient: SynthPatient = {
      ...emptyPatient,
      dataMode: "demo",
      session: { ...emptyPatient.session, heartRate: 125 },
      triage: runTriage({ ...emptyPatient.session, heartRate: 125 }),
    };
    const result = derivePatientResult(patient);
    expect(result.measurements.find((measurement) => measurement.key === "heart_rate")?.status).toBe("measured_abnormal");
    expect(result.measurements.find((measurement) => measurement.key === "spo2")?.status).toBe("unavailable");
  });
});
