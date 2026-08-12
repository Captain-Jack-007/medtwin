import { describe, expect, it } from "vitest";
import { RULE_VERSION, RECOMMENDED_ACTION, runTriage } from "./triage";
import { getScenario } from "./scenarios";
import { ScreeningSession } from "./types";
import { RealScanResult } from "./measurements/types";
import { unavailableMeasurement } from "./measurements/validation";

// A baseline healthy session; individual tests override the fields they probe.
function base(overrides: Partial<ScreeningSession> = {}): ScreeningSession {
  return {
    patientId: "TEST",
    heartRate: 74,
    respiratoryRate: 15,
    faceSymmetry: true,
    armSymmetry: true,
    speechResult: true,
    signalQuality: "GOOD",
    ...overrides,
  };
}

const codes = (s: ScreeningSession, sym: string[] = []) =>
  runTriage(s, sym).evidence.map((e) => e.code);

describe("runTriage — fixed demo scenarios A-D", () => {
  it("A (normal) → GREEN with no evidence", () => {
    const t = getScenario("A")!.triage;
    expect(t.priority).toBe("GREEN");
    expect(t.evidence).toHaveLength(0);
    expect(t.systems).toHaveLength(0);
  });

  it("B (cardiovascular) → RED with cardiac evidence", () => {
    const t = getScenario("B")!.triage;
    expect(t.priority).toBe("RED");
    expect(t.systems[0]).toBe("cardiovascular");
    const c = t.evidence.map((e) => e.code);
    expect(c).toContain("sym_chest");
    expect(c).toContain("sym_sob");
    expect(c).toContain("hr_high"); // 112 bpm
    expect(c).toContain("bp_vhigh"); // 168/102
    expect(c).toContain("spo2_vlow"); // 91%
  });

  it("C (neurological) → RED driven by facial asymmetry", () => {
    const t = getScenario("C")!.triage;
    expect(t.priority).toBe("RED");
    expect(t.systemStates.neurological).toBe("RED");
    const c = t.evidence.map((e) => e.code);
    expect(c).toContain("neuro_face");
    expect(c).toContain("neuro_arm");
    expect(c).toContain("neuro_speech");
  });

  it("D (respiratory) → RED from RR + SpO2", () => {
    const t = getScenario("D")!.triage;
    expect(t.priority).toBe("RED");
    expect(t.systemStates.respiratory).toBe("RED");
    const c = t.evidence.map((e) => e.code);
    expect(c).toContain("rr_vhigh"); // 27/min
    expect(c).toContain("spo2_vlow"); // 90%
  });
});

describe("runTriage — heart-rate thresholds", () => {
  it("99 bpm stays GREEN", () => expect(runTriage(base({ heartRate: 99 })).priority).toBe("GREEN"));
  it("100 bpm → ORANGE (hr_high)", () => {
    const t = runTriage(base({ heartRate: 100 }));
    expect(t.priority).toBe("ORANGE");
    expect(t.evidence.map((e) => e.code)).toContain("hr_high");
  });
  it("120 bpm → RED (hr_vhigh)", () => {
    expect(runTriage(base({ heartRate: 120 })).priority).toBe("RED");
    expect(codes(base({ heartRate: 120 }))).toContain("hr_vhigh");
  });
  it("50 bpm → YELLOW (hr_low)", () => {
    const t = runTriage(base({ heartRate: 50 }));
    expect(t.priority).toBe("YELLOW");
    expect(t.evidence.map((e) => e.code)).toContain("hr_low");
  });
});

describe("runTriage — respiration & SpO2", () => {
  it("22/min → ORANGE, 26/min → RED", () => {
    expect(runTriage(base({ respiratoryRate: 22 })).priority).toBe("ORANGE");
    expect(runTriage(base({ respiratoryRate: 26 })).priority).toBe("RED");
  });
  it("SpO2 94 → ORANGE, 92 → RED, and marked synthetic", () => {
    expect(runTriage(base({ spo2: 94 })).priority).toBe("ORANGE");
    const red = runTriage(base({ spo2: 92 }));
    expect(red.priority).toBe("RED");
    expect(red.evidence.find((e) => e.code === "spo2_vlow")?.synthetic).toBe(true);
  });
  it("omitting spo2 contributes no oxygen evidence", () => {
    expect(codes(base())).not.toContain("spo2_low");
    expect(codes(base())).not.toContain("spo2_vlow");
  });
});

describe("runTriage — symptoms & neuro screen", () => {
  it("chest symptom raises cardiovascular to ORANGE", () => {
    const t = runTriage(base(), ["Chest discomfort"]);
    expect(t.systemStates.cardiovascular).toBe("ORANGE");
    expect(t.evidence.map((e) => e.code)).toContain("sym_chest");
  });
  it("facial asymmetry alone → RED neuro", () => {
    expect(runTriage(base({ faceSymmetry: false })).priority).toBe("RED");
  });
});

describe("runTriage — invariants", () => {
  it("is deterministic across repeated calls", () => {
    const a = runTriage(base({ heartRate: 112, spo2: 91 }), ["Chest discomfort"]);
    const b = runTriage(base({ heartRate: 112, spo2: 91 }), ["Chest discomfort"]);
    expect(a).toEqual(b);
  });
  it("stamps the rule version and maps action to priority", () => {
    const t = runTriage(base());
    expect(t.ruleVersion).toBe(RULE_VERSION);
    expect(t.recommendedAction).toBe(RECOMMENDED_ACTION[t.priority]);
  });
  it("does not emit duplicate evidence codes", () => {
    const c = codes(base({ heartRate: 130 }), ["Chest discomfort", "chest pain"]);
    expect(new Set(c).size).toBe(c.length);
  });
});

describe("runTriage — real scan missing data", () => {
  it("keeps unavailable measurements UNKNOWN instead of normal", () => {
    const timestamp = new Date(0).toISOString();
    const screeningUnavailable = {
      value: { classification: "INSUFFICIENT_SIGNAL" as const, score: null },
      unit: "screening",
      source: "unavailable" as const,
      timestamp,
      confidence: 0,
      signalQuality: null,
      algorithm: null,
      status: "not_measured" as const,
    };
    const result: RealScanResult = {
      sessionId: "REAL-UNKNOWN",
      demographics: { ageRange: "30-44", sex: "F", location: "v-e" },
      symptoms: [],
      heartRate: unavailableMeasurement("bpm", "not_measured", timestamp),
      respiratoryRate: unavailableMeasurement("/min", "insufficient_signal", timestamp),
      facialSymmetry: screeningUnavailable,
      movementSymmetry: screeningUnavailable,
      speechTask: screeningUnavailable,
      bloodPressure: unavailableMeasurement("mmHg", "not_measured", timestamp),
      spo2: unavailableMeasurement("%", "external_device_required", timestamp),
      consentVersion: "test",
      completedAt: timestamp,
    };
    const triage = runTriage(base({
      heartRate: null,
      respiratoryRate: null,
      faceSymmetry: null,
      armSymmetry: null,
      speechResult: null,
    }), [], result);
    expect(triage.observationStates).toEqual({
      cardiovascular: "UNKNOWN",
      respiratory: "UNKNOWN",
      neurological: "UNKNOWN",
    });
    expect(triage.recommendedAction).toBe("incomplete_screening_review");
    expect(triage.evidence.find((item) => item.code === "spo2_unavailable")?.contributes).toBe(false);
  });
});
