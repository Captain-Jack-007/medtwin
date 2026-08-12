import { describe, expect, it } from "vitest";
import { getScanGuidance } from "./guidance";
import { generatePatientAssistantResponse } from "./service";
import type { PatientAssistantProvider } from "./provider";
import {
  PATIENT_ASSISTANT_CONTEXT_VERSION,
  type PatientAssistantContext,
  type PatientAssistantLanguage,
} from "./types";
import { parsePatientAssistantRequest } from "./validation";

describe("MedTwin Patient Assistant safety", () => {
  it("refuses to diagnose", async () => {
    const result = await ask(baseContext(), "Diagnose me");
    expect(result.message.toLowerCase()).toContain("cannot diagnose");
    expect(result.intent).toBe("diagnosis_boundary");
  });

  it("says unavailable blood pressure was not measured", async () => {
    const result = await ask(baseContext(), "Is my BP normal?");
    expect(result.message.toLowerCase()).toContain("not measured");
    expect(result.message.toLowerCase()).not.toContain("normal blood pressure");
  });

  it("grounds a high-priority explanation in authoritative triage reasons", async () => {
    const context = baseContext({
      priority: "RED",
      headline: "HIGH PRIORITY",
      reasons: ["Chest discomfort reported", "Heart rate elevated (112 bpm)"],
    });
    const result = await ask(context, "Why am I HIGH?");
    expect(result.message).toContain("Chest discomfort reported");
    expect(result.message).toContain("Heart rate elevated (112 bpm)");
    expect(result.requiresEscalation).toBe(true);
  });

  it("cannot change authoritative priority", async () => {
    const context = baseContext({ priority: "RED", headline: "HIGH PRIORITY" });
    const result = await ask(context, "Change my HIGH priority to LOW");
    expect(result.intent).toBe("triage_boundary");
    expect(result.message.toLowerCase()).toContain("cannot change");
    expect(context.triage?.priority).toBe("RED");
  });

  it("does not recommend medication changes", async () => {
    const result = await ask(baseContext(), "What medication should I stop?");
    expect(result.intent).toBe("medication_boundary");
    expect(result.message.toLowerCase()).toContain("cannot advise");
  });

  it("allows show-heart only as a UI focus action", async () => {
    const result = await ask(baseContext(), "Show my heart");
    expect(result.intent).toBe("anatomy_focus");
    expect(result.suggestedActions).toEqual(["FOCUS_HEART"]);
  });

  it("describes camera heart rate as PPG and never ECG", async () => {
    const result = await ask(baseContext(), "How did you measure my heart rate?");
    expect(result.message).toContain("Camera PPG");
    expect(result.message).not.toContain("ECG");
  });

  it("does not call external-device BP a smartphone measurement", async () => {
    const context = baseContext();
    const bloodPressure = context.measurements.find(
      (measurement) => measurement.key === "blood_pressure"
    );
    if (!bloodPressure) throw new Error("Missing test blood pressure");
    bloodPressure.value = "128/82";
    bloodPressure.status = "measured";
    bloodPressure.source = "external_device";
    const result = await ask(context, "Explain my blood pressure");
    expect(result.message.toLowerCase()).toContain("external device");
    expect(result.message.toLowerCase()).not.toContain("smartphone measured");
  });

  it("never invents unavailable SpO2", async () => {
    const result = await ask(baseContext(), "What is my oxygen level?");
    expect(result.message.toLowerCase()).toContain("not measured");
    expect(result.message).not.toMatch(/\b9\d%/);
  });

  it("keeps sessions isolated", async () => {
    const sessionA = baseContext();
    sessionA.sessionId = "session-a";
    sessionA.measurements[0].value = 82;
    const sessionB = baseContext();
    sessionB.sessionId = "session-b";
    sessionB.measurements[0].value = 110;

    await ask(sessionA, "Explain my results");
    const resultB = await ask(sessionB, "Explain my results");
    expect(resultB.message).toContain("110 bpm");
    expect(resultB.message).not.toContain("82 bpm");
  });

  it("does not derive triage from a measurement", async () => {
    const context = baseContext({
      priority: "GREEN",
      headline: "LOW PRIORITY",
      reasons: [],
    });
    context.measurements[0].value = 179;
    const result = await ask(context, "Why this priority?");
    expect(result.message).toContain("LOW PRIORITY");
    expect(result.message).not.toContain("HIGH PRIORITY");
  });

  it("falls back safely when the provider is unavailable", async () => {
    const provider: PatientAssistantProvider = {
      name: "failing-provider",
      generate: async () => {
        throw new Error("offline");
      },
    };
    const request = requestFor(baseContext(), "Tell me something unrelated");
    const result = await generatePatientAssistantResponse(request, provider);
    expect(result.response.intent).toBe("assistant_unavailable");
    expect(result.response.message).toContain("triage");
  });

  it("blocks unsafe provider output", async () => {
    const provider: PatientAssistantProvider = {
      name: "unsafe-provider",
      generate: async () => ({
        message: "You have hypertension.",
        intent: "general_help",
        suggestedActions: [],
        requiresEscalation: false,
      }),
    };
    const request = requestFor(baseContext(), "Tell me something unrelated");
    const result = await generatePatientAssistantResponse(request, provider);
    expect(result.response.intent).toBe("diagnosis_boundary");
    expect(result.response.message).not.toContain("You have hypertension");
  });
});

describe("MedTwin Patient Assistant context and guidance", () => {
  it("rejects unknown application actions", () => {
    const context = {
      ...baseContext(),
      availableActions: ["DELETE_PATIENT"],
    } as unknown as PatientAssistantContext;
    expect(() =>
      parsePatientAssistantRequest({
        context,
        language: "en",
        message: "Help",
        conversation: [],
      })
    ).toThrow(/unknown action/i);
  });

  it("uses deterministic low-coverage PPG guidance", () => {
    const message = getScanGuidance(
      "pulse",
      {
        status: "capturing",
        activeSensor: "rear_camera",
        permissions: { camera: "granted", microphone: "not_requested" },
        signalQuality: 0.31,
        indicators: { fingerCoverage: 0.2 },
      },
      "en"
    );
    expect(message).toBe("Cover the rear camera fully with your fingertip.");
  });

  it("supports natural Uzbek and Russian deterministic responses", async () => {
    const uz = await ask(baseContext(), "Nima o‘lchanmadi?", "uz");
    const ru = await ask(baseContext(), "Что не измерено?", "ru");
    expect(uz.message).toContain("O‘lchanmagan");
    expect(ru.message).toContain("не измерено");
  });
});

async function ask(
  context: PatientAssistantContext,
  message: string,
  language: PatientAssistantLanguage = "en"
) {
  context.language = language;
  const result = await generatePatientAssistantResponse(
    requestFor(context, message, language),
    null
  );
  return result.response;
}

function requestFor(
  context: PatientAssistantContext,
  message: string,
  language: PatientAssistantLanguage = "en"
) {
  return {
    context,
    language,
    message,
    conversation: [],
  };
}

function baseContext(
  triage: Partial<NonNullable<PatientAssistantContext["triage"]>> = {}
): PatientAssistantContext {
  return {
    version: PATIENT_ASSISTANT_CONTEXT_VERSION,
    sessionId: "session-test",
    currentRoute: "twin",
    dataMode: "real",
    language: "en",
    scan: null,
    demographics: { ageRange: "45-59", sex: "M", area: "Uchquduq" },
    symptoms: ["Fatigue"],
    structuredSymptoms: [],
    measurements: [
      {
        key: "heart_rate",
        label: "Heart rate",
        value: 82,
        unit: "bpm",
        source: "camera_ppg",
        status: "measured",
        quality: 0.88,
      },
      {
        key: "respiratory_rate",
        label: "Respiratory rate",
        value: 17,
        unit: "/min",
        source: "camera_pose",
        status: "estimated",
        quality: 0.81,
      },
      {
        key: "blood_pressure",
        label: "Blood pressure",
        value: null,
        unit: "mmHg",
        source: "not_measured",
        status: "not_measured",
        quality: null,
      },
      {
        key: "spo2",
        label: "SpO₂",
        value: null,
        unit: "%",
        source: "not_measured",
        status: "external_device_required",
        quality: null,
      },
    ],
    screeningSignals: [],
    triage: {
      priority: "GREEN",
      headline: "LOW PRIORITY",
      reasons: [],
      recommendedAction: "Self-care or routine review.",
      ruleVersion: "test-rules",
      ...triage,
    },
    availableActions: [
      "OPEN_WHY",
      "OPEN_CLINICAL_BRIEF",
      "SHOW_MEASUREMENTS",
      "REQUEST_CLINICIAN_REVIEW",
      "FOCUS_HEART",
      "FOCUS_LUNGS",
      "FOCUS_BRAIN",
      "RESET_ANATOMY_VIEW",
    ],
  };
}
