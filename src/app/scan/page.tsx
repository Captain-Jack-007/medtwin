"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { StepScreen } from "@/components/scan/StepScreen";
import { CapabilityPanel } from "@/components/scan/CapabilityPanel";
import {
  FaceBreathingResult,
  FaceBreathingStep,
} from "@/components/scan/FaceBreathingStep";
import { PpgStep } from "@/components/scan/PpgStep";
import { MovementStep } from "@/components/scan/MovementStep";
import { SpeechStep } from "@/components/scan/SpeechStep";
import { CUSTOM_SYMPTOM_KEY, SYMPTOM_OPTIONS, type SymptomOption } from "@/components/scan/scanLogic";
import { VILLAGES } from "@/lib/region";
import {
  Measurement,
  RealScanResult,
  ScreeningMeasurement,
} from "@/lib/measurements/types";
import { unavailableMeasurement } from "@/lib/measurements/validation";
import { saveRealScan } from "@/lib/measurements/store";
import {
  PatientAssistant,
  type StructuredSymptomPrompt,
} from "@/components/patient-assistant/PatientAssistant";
import { buildScanAssistantContext } from "@/lib/patient-assistant/context";
import type { ScanAssistantSnapshot } from "@/lib/patient-assistant/types";
import type { StructuredSymptomAnswer } from "@/lib/measurements/types";
import { useLanguage } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isBrowserProductionDataMode } from "@/lib/supabase/env";

type Step =
  | "consent"
  | "info"
  | "symptoms"
  | "face_breathing"
  | "pulse"
  | "movement"
  | "speech"
  | "result";

const ORDER: Step[] = [
  "consent",
  "info",
  "symptoms",
  "face_breathing",
  "pulse",
  "movement",
  "speech",
  "result",
];

const REAL_LOCATIONS = VILLAGES.filter((location) => !location.isSynthetic);
const CONSENT_VERSION = "medtwin-sensor-consent-v1";

export default function ScanPage() {
  const { language, t } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState<Step>("consent");
  const [consented, setConsented] = useState(false);
  const [ageRange, setAgeRange] = useState("");
  const [sex, setSex] = useState<"M" | "F" | "">("");
  const [location, setLocation] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");
  const customSymptomInput = useRef<HTMLInputElement>(null);
  const [structuredSymptoms, setStructuredSymptoms] = useState<
    StructuredSymptomAnswer[]
  >([]);
  const [draftSessionId] = useState(() => `SCAN-${crypto.randomUUID()}`);
  const [assistantScanState, setAssistantScanState] = useState<{
    step: Step;
    state: ScanAssistantSnapshot;
  } | null>(null);
  const [faceBreathing, setFaceBreathing] =
    useState<FaceBreathingResult | null>(null);
  const [heartRate, setHeartRate] = useState<Measurement<number> | null>(null);
  const [movement, setMovement] = useState<ScreeningMeasurement | null>(null);
  const [speech, setSpeech] = useState<ScreeningMeasurement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const index = ORDER.indexOf(step);
  const progress = Math.round((index / (ORDER.length - 1)) * 100);
  const next = () => setStep(ORDER[Math.min(index + 1, ORDER.length - 1)]);
  const back = () => setStep(ORDER[Math.max(index - 1, 0)]);

  const hasCustomSymptom = symptoms.includes(CUSTOM_SYMPTOM_KEY);
  const reportedSymptoms = useMemo(() => [
    ...symptoms.filter((symptom) => symptom !== CUSTOM_SYMPTOM_KEY),
    ...(hasCustomSymptom && customSymptom.trim() ? [customSymptom.trim()] : []),
  ], [customSymptom, hasCustomSymptom, symptoms]);

  useEffect(() => {
    if (!hasCustomSymptom) return;
    const frame = window.requestAnimationFrame(() => customSymptomInput.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [hasCustomSymptom]);

  const toggleSymptom = (symptom: string) => {
    setSymptoms((current) => {
      if (!current.includes(symptom)) return [...current, symptom];
      setStructuredSymptoms((answers) =>
        answers.filter((answer) => answer.symptom !== symptom)
      );
      if (symptom === CUSTOM_SYMPTOM_KEY) setCustomSymptom("");
      return current.filter((item) => item !== symptom);
    });
  };

  const captureAssistantState = useCallback(
    (captureStep: Step, state: ScanAssistantSnapshot) => {
      setAssistantScanState({ step: captureStep, state });
    },
    []
  );
  const onFaceAssistantState = useCallback(
    (state: ScanAssistantSnapshot) =>
      captureAssistantState("face_breathing", state),
    [captureAssistantState]
  );
  const onPulseAssistantState = useCallback(
    (state: ScanAssistantSnapshot) => captureAssistantState("pulse", state),
    [captureAssistantState]
  );
  const onMovementAssistantState = useCallback(
    (state: ScanAssistantSnapshot) =>
      captureAssistantState("movement", state),
    [captureAssistantState]
  );
  const onSpeechAssistantState = useCallback(
    (state: ScanAssistantSnapshot) => captureAssistantState("speech", state),
    [captureAssistantState]
  );

  const currentScanState =
    assistantScanState?.step === step
      ? assistantScanState.state
      : defaultAssistantScanState(step);
  const assistantContext = useMemo(
    () =>
      buildScanAssistantContext({
        sessionId: draftSessionId || "scan-session-preparing",
        currentStep: step,
        language,
        scan: currentScanState,
        demographics: {
          ageRange: ageRange || null,
          sex: sex || null,
          area:
            REAL_LOCATIONS.find((item) => item.id === location)?.name ?? null,
        },
        symptoms: reportedSymptoms,
        structuredSymptoms,
        heartRate,
        respiratoryRate: faceBreathing?.respiratoryRate ?? null,
        facialSymmetry: faceBreathing?.facialSymmetry ?? null,
        movementSymmetry: movement,
        speechTask: speech,
      }),
    [
      ageRange,
      language,
      currentScanState,
      draftSessionId,
      faceBreathing,
      heartRate,
      location,
      movement,
      sex,
      speech,
      step,
      structuredSymptoms,
      reportedSymptoms,
    ]
  );
  const structuredPrompt = getStructuredSymptomPrompt(
    reportedSymptoms,
    structuredSymptoms
  );

  const answerStructuredSymptom = (
    answer: StructuredSymptomAnswer["answer"]
  ) => {
    if (!structuredPrompt) return;
    setStructuredSymptoms((current) => [
      ...current.filter(
        (item) => item.questionId !== structuredPrompt.questionId
      ),
      {
        questionId: structuredPrompt.questionId,
        symptom: structuredPrompt.symptom,
        answer,
        recordedAt: new Date().toISOString(),
      },
    ]);
  };

  const finish = async () => {
    if (!faceBreathing || !heartRate || !movement || !speech || !sex) return;
    if (submitting) return;
    const sessionId = `MT-${Date.now().toString(36).toUpperCase()}`;
    const completedAt = new Date().toISOString();
    const result: RealScanResult = {
      sessionId,
      demographics: { ageRange, sex, location },
      symptoms: reportedSymptoms,
      structuredSymptoms,
      heartRate,
      respiratoryRate: faceBreathing.respiratoryRate,
      facialSymmetry: faceBreathing.facialSymmetry,
      movementSymmetry: movement,
      speechTask: speech,
      bloodPressure: unavailableMeasurement(
        "mmHg",
        "not_measured",
        completedAt
      ),
      spo2: unavailableMeasurement(
        "%",
        "external_device_required",
        completedAt
      ),
      consentVersion: CONSENT_VERSION,
      completedAt,
    };
    if (!isBrowserProductionDataMode()) {
      saveRealScan({ id: sessionId, result });
      router.push(`/twin/${sessionId}`);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setSubmissionError(t("scan.productionUnavailable"));
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.push("/auth?next=%2Fscan");
        return;
      }
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !isSavedRecord(body)) throw new Error("Record save failed");
      router.push(`/twin/${body.id}`);
    } catch {
      setSubmissionError(t("scan.productionSaveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-5 sm:py-8">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="tick">{t("scan.title")}</span>
            <span className="mono text-xs text-[var(--muted)]">
              {t("scan.step", { current: index + 1, total: ORDER.length })}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-elev)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {t("scan.duration")}
          </p>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(330px,0.9fr)]">
          <div className="min-w-0">
        {step === "consent" && (
          <StepScreen
            title={t("scan.consentTitle")}
            onNext={next}
            nextLabel={t("scan.begin")}
            nextDisabled={!consented}
          >
            <div className="space-y-3 text-sm leading-relaxed text-[var(--muted)]">
              <p>
                {t("scan.consentText")}
              </p>
              <p>
                {t("scan.privacy")}
              </p>
            </div>
            <CapabilityPanel />
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4 text-sm">
              <input
                type="checkbox"
                checked={consented}
                onChange={(event) => setConsented(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                {t("scan.consent")}
              </span>
            </label>
          </StepScreen>
        )}

        {step === "info" && (
          <StepScreen
            title={t("scan.infoTitle")}
            onNext={next}
            onBack={back}
            nextDisabled={!ageRange || !sex || !location}
          >
            <Field label={t("scan.age")}>
              <Select
                value={ageRange}
                onChange={setAgeRange}
                placeholder={t("scan.selectAge")}
                options={["18-29", "30-44", "45-59", "60-74", "75+"]}
              />
            </Field>
            <Field label={t("scan.sex")}>
              <Select
                value={sex}
                onChange={(value) => setSex(value as "M" | "F" | "")}
                placeholder={t("scan.selectSex")}
                options={["M", "F"]}
                labels={{ M: t("scan.male"), F: t("scan.female") }}
              />
            </Field>
            <Field label={t("scan.location")}>
              <Select
                value={location}
                onChange={setLocation}
                placeholder={t("scan.selectLocation")}
                options={REAL_LOCATIONS.map((item) => item.id)}
                labels={Object.fromEntries(
                  REAL_LOCATIONS.map((item) => [item.id, item.name])
                )}
              />
            </Field>
            <p className="text-xs text-[var(--muted)]">
              {t("scan.locationNote")}
            </p>
          </StepScreen>
        )}

        {step === "symptoms" && (
          <StepScreen title={t("scan.symptomsTitle")} onNext={next} onBack={back} nextDisabled={hasCustomSymptom && !customSymptom.trim()}>
            <p className="mb-3 text-sm text-[var(--muted)]">
              {t("scan.symptomsText")}
            </p>
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_OPTIONS.map((symptom) => {
                const selected = symptoms.includes(symptom);
                return (
                  <button
                    key={symptom}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSymptom(symptom)}
                    className={
                      "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                      (selected
                        ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                        : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]")
                    }
                  >
                    {symptomLabel(t, symptom)}
                  </button>
                );
              })}
              <button type="button" aria-pressed={hasCustomSymptom} onClick={() => toggleSymptom(CUSTOM_SYMPTOM_KEY)} className={"rounded-full border px-3 py-1.5 text-sm transition-colors " + (hasCustomSymptom ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]" : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]")}>{t("scan.symptomOther")}</button>
            </div>
            {hasCustomSymptom && <label className="mt-4 block"><span className="mb-1.5 block text-sm font-medium">{t("scan.customSymptomLabel")}</span><input ref={customSymptomInput} value={customSymptom} maxLength={100} onChange={(event) => setCustomSymptom(event.target.value)} placeholder={t("scan.customSymptomPlaceholder")} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]" /></label>}
            <div className="mt-4 text-xs text-[var(--muted)]">
              {t("scan.source")}: {t("scan.userReported")}
            </div>
          </StepScreen>
        )}

        {step === "face_breathing" && (
          <FaceBreathingStep
            onNext={next}
            onBack={back}
            onComplete={setFaceBreathing}
            result={faceBreathing}
            onAssistantStateChange={onFaceAssistantState}
          />
        )}

        {step === "pulse" && (
          <PpgStep
            onNext={next}
            onBack={back}
            onComplete={setHeartRate}
            result={heartRate}
            onAssistantStateChange={onPulseAssistantState}
          />
        )}

        {step === "movement" && (
          <MovementStep
            onNext={next}
            onBack={back}
            onComplete={setMovement}
            result={movement}
            onAssistantStateChange={onMovementAssistantState}
          />
        )}

        {step === "speech" && (
          <SpeechStep
            onNext={next}
            onBack={back}
            onComplete={setSpeech}
            result={speech}
            onAssistantStateChange={onSpeechAssistantState}
          />
        )}

        {step === "result" && faceBreathing && heartRate && movement && speech && (
          <StepScreen
            title={t("scan.resultTitle")}
            onNext={finish}
            onBack={back}
            nextLabel={t("scan.buildTwin")}
            nextDisabled={submitting}
          >
            <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
              {t("scan.resultText")}
            </p>
            <div className="divide-y divide-[var(--border)] rounded-xl bg-[var(--bg-elev)] px-4">
              <SummaryRow label={t("scan.face")} status={faceBreathing.facialSymmetry.status} />
              <SummaryRow label={t("scan.pulse")} status={heartRate.status} />
              <SummaryRow label={t("scan.breathing")} status={faceBreathing.respiratoryRate.status} />
              <SummaryRow label={t("scan.movement")} status={movement.status} />
              <SummaryRow label={t("scan.speech")} status={speech.status} />
              <SummaryRow label={t("scan.bloodPressure")} status="not_measured" />
              <SummaryRow label="SpO₂" status="external_device_required" />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
              {t("scan.consentText")}
            </p>
            {submissionError && (
              <p role="alert" className="mt-3 text-sm text-[var(--danger, #f87171)]">
                {submissionError}
              </p>
            )}
          </StepScreen>
        )}
          </div>

          <aside className="min-w-0 lg:sticky lg:top-20">
            <PatientAssistant
                key={assistantContext.sessionId}
                context={assistantContext}
                language={language}
                structuredPrompt={structuredPrompt}
                onStructuredAnswer={answerStructuredSymptom}
                className="lg:max-h-[calc(100dvh-6.5rem)]"
              />
          </aside>
        </div>
      </main>
    </>
  );
}

function isSavedRecord(value: unknown): value is { id: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    /^MT-[A-Z0-9-]{5,80}$/.test(value.id)
  );
}

function defaultAssistantScanState(step: Step): ScanAssistantSnapshot {
  const activeSensor =
    step === "pulse"
      ? "rear_camera"
      : step === "face_breathing" || step === "movement"
        ? "front_camera"
        : step === "speech"
          ? "microphone"
          : "none";
  return {
    status: step === "result" ? "complete" : "not_started",
    activeSensor,
    permissions: { camera: "not_requested", microphone: "not_requested" },
    signalQuality: null,
    indicators: {},
  };
}

function getStructuredSymptomPrompt(
  symptoms: string[],
  answers: StructuredSymptomAnswer[]
): StructuredSymptomPrompt | null {
  const prompts: StructuredSymptomPrompt[] = [
    {
      questionId: "chest_discomfort_current",
      symptom: "Chest discomfort",
      question: {
        uz: "Ko‘krak qafasidagi noqulaylik hozir ham davom etyaptimi?",
        ru: "Дискомфорт в груди сохраняется сейчас?",
        en: "Is the chest discomfort still present now?",
      },
    },
    {
      questionId: "shortness_of_breath_at_rest",
      symptom: "Shortness of breath",
      question: {
        uz: "Tinch holatda ham nafas qisishi bormi?",
        ru: "Одышка есть даже в состоянии покоя?",
        en: "Is shortness of breath present even while resting?",
      },
    },
  ];
  return (
    prompts.find(
      (prompt) =>
        symptoms.includes(prompt.symptom) &&
        !answers.some((answer) => answer.questionId === prompt.questionId)
    ) ?? null
  );
}

function symptomLabel(t: ReturnType<typeof useLanguage>["t"], symptom: SymptomOption) {
  const keys: Record<SymptomOption, "scan.symptomChest" | "scan.symptomBreath" | "scan.symptomPalpitations" | "scan.symptomDizziness" | "scan.symptomCough" | "scan.symptomHeadache" | "scan.symptomNumbness" | "scan.symptomFatigue"> = {
    "Chest discomfort": "scan.symptomChest", "Shortness of breath": "scan.symptomBreath", Palpitations: "scan.symptomPalpitations", Dizziness: "scan.symptomDizziness", "Persistent cough": "scan.symptomCough", "Severe headache": "scan.symptomHeadache", "Numbness in arm": "scan.symptomNumbness", Fatigue: "scan.symptomFatigue",
  };
  return t(keys[symptom]);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  options,
  labels,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}

function SummaryRow({ label, status }: { label: string; status: string }) {
  const { t } = useLanguage();
  const available = ["measured", "estimated", "completed"].includes(status);
  const statusLabels: Record<string, ReturnType<typeof useLanguage>["t"] extends (key: infer Key, ...args: never[]) => string ? Key : never> = {
    measured: "scan.statusMeasured",
    estimated: "scan.statusEstimated",
    completed: "scan.statusCompleted",
    not_measured: "common.notMeasured",
    external_device_required: "common.externalDeviceRequired",
    insufficient_signal: "scan.statusInsufficientSignal",
  };
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <span>{label}</span>
      <span
        className="mono text-xs"
        style={{ color: available ? "var(--green)" : "var(--muted)" }}
      >
        {statusLabels[status] ? t(statusLabels[status]) : t("common.unavailable")}
      </span>
    </div>
  );
}
