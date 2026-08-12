"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StepScreen } from "./StepScreen";
import { CaptureError, CaptureMetrics, StatusRows } from "./CaptureUI";
import { LiveTrace } from "./LiveTrace";
import {
  MicrophoneCapture,
  readAudioFrame,
  startMicrophoneCapture,
} from "@/lib/sensors/microphone";
import { MediaAccessError } from "@/lib/sensors/media";
import { buildSpeechMeasurement, SpeechFrame } from "@/lib/screening/speech";
import {
  PermissionState,
  ScreeningMeasurement,
  SensorState,
} from "@/lib/measurements/types";
import type { ScanAssistantSnapshot } from "@/lib/patient-assistant/types";
import { MEDIA_ERROR_TRANSLATION_KEYS, useLanguage } from "@/lib/i18n";

const TARGET_CAPTURE_MS = 5_000;
const UI_INTERVAL_MS = 100;

export function SpeechStep({
  onNext,
  onBack,
  onComplete,
  result,
  onAssistantStateChange,
}: {
  onNext: () => void;
  onBack: () => void;
  onComplete: (measurement: ScreeningMeasurement) => void;
  result: ScreeningMeasurement | null;
  onAssistantStateChange?: (state: ScanAssistantSnapshot) => void;
}) {
  const { t } = useLanguage();
  const captureRef = useRef<MicrophoneCapture | null>(null);
  const requestRef = useRef<number | null>(null);
  const framesRef = useRef<SpeechFrame[]>([]);
  const startedRef = useRef(0);
  const lastUiRef = useRef(0);
  const completedRef = useRef(false);
  const [sensorState, setSensorState] = useState<SensorState>(
    result ? "success" : "idle"
  );
  const [permission, setPermission] = useState<PermissionState>("not_requested");
  const [error, setError] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [rms, setRms] = useState(0);
  const [clipping, setClipping] = useState(false);

  useEffect(() => {
    onAssistantStateChange?.({
      status: sensorState,
      activeSensor: "microphone",
      permissions: { camera: "not_requested", microphone: permission },
      signalQuality: Math.min(1, rms / 0.08),
      indicators: {
        voiceDetected: rms >= 0.025,
        audioClipping: clipping,
      },
    });
  }, [clipping, onAssistantStateChange, permission, rms, sensorState]);

  const stopCapture = useCallback(async () => {
    if (requestRef.current !== null) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    const capture = captureRef.current;
    captureRef.current = null;
    if (capture) await capture.close();
  }, []);

  useEffect(
    () => () => {
      void stopCapture();
    },
    [stopCapture]
  );

  const finalize = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setSensorState("processing");
    const durationMs = performance.now() - startedRef.current;
    const measurement = buildSpeechMeasurement(framesRef.current, durationMs);
    await stopCapture();
    onComplete(measurement);
    setSensorState(
      measurement.status === "completed" ? "success" : "low_quality"
    );
  }, [onComplete, stopCapture]);

  const captureFrame = useCallback(
    function frameLoop(timestamp: number) {
      if (completedRef.current) return;
      requestRef.current = requestAnimationFrame(frameLoop);
      const capture = captureRef.current;
      if (!capture) return;
      const frame = readAudioFrame(capture);
      framesRef.current.push({ rms: frame.rms, clipping: frame.clipping });
      const elapsed = timestamp - startedRef.current;
      if (timestamp - lastUiRef.current >= UI_INTERVAL_MS) {
        lastUiRef.current = timestamp;
        setElapsedMs(elapsed);
        setWaveform(frame.waveform.filter((_, index) => index % 4 === 0));
        setRms(frame.rms);
        setClipping(frame.clipping);
      }
      if (elapsed >= TARGET_CAPTURE_MS) void finalize();
    },
    [finalize]
  );

  const start = async () => {
    await stopCapture();
    completedRef.current = false;
    framesRef.current = [];
    setError(null);
    setWaveform([]);
    setElapsedMs(0);
    setRms(0);
    setClipping(false);
    setSensorState("requesting_permission");
    setPermission("requesting");
    try {
      const capture = await startMicrophoneCapture();
      setPermission("granted");
      captureRef.current = capture;
      startedRef.current = performance.now();
      lastUiRef.current = 0;
      setSensorState("capturing");
      requestRef.current = requestAnimationFrame(captureFrame);
    } catch (cause) {
      await stopCapture();
      setPermission(
        cause instanceof MediaAccessError && cause.code === "permission_denied"
          ? "denied"
          : "unavailable"
      );
      setSensorState(
        cause instanceof MediaAccessError && cause.code === "unsupported"
          ? "unsupported"
          : "failed"
      );
      setError(
        cause instanceof MediaAccessError
          ? t(MEDIA_ERROR_TRANSLATION_KEYS[cause.code])
          : t("scan.microphoneStartFailed")
      );
    }
  };

  const skip = async () => {
    await stopCapture();
    completedRef.current = true;
    onComplete({
      value: { classification: "INSUFFICIENT_SIGNAL", score: null },
      unit: "task completion",
      source: "unavailable",
      timestamp: new Date().toISOString(),
      confidence: 0,
      signalQuality: null,
      algorithm: null,
      status: "not_measured",
    });
    setSensorState("low_quality");
  };

  return (
    <StepScreen
      title={t("scan.speechTitle")}
      onNext={onNext}
      onBack={onBack}
      nextDisabled={result === null}
    >
      <p className="text-sm text-[var(--muted)]">
        {t("scan.speechDescription")}
      </p>
      <blockquote className="my-4 rounded-xl bg-[var(--bg-elev)] p-4 text-center text-lg font-medium">
        “{t("scan.speechReading")}”
      </blockquote>
      <LiveTrace
        values={waveform}
        label={t("scan.microphoneLive")}
        color="var(--accent-2)"
        height={112}
        emptyText={t("scan.microphoneIdle")}
      />
      <div className="mt-4 space-y-4">
        <CaptureMetrics
          elapsedMs={elapsedMs}
          targetMs={TARGET_CAPTURE_MS}
          quality={Math.min(1, rms / 0.08)}
        />
        <StatusRows
          rows={[
            {
              label: t("scan.voiceActivity"),
              ok: rms >= 0.025,
              detail: rms >= 0.025 ? t("scan.detected") : t("scan.speakNow"),
            },
            {
              label: t("scan.inputClipping"),
              ok: !clipping,
              detail: clipping ? t("scan.tooLoud") : t("scan.clear"),
            },
          ]}
        />
      </div>

      {error && <div className="mt-4"><CaptureError message={error} /></div>}
      {result && (
        <div className="mt-4 rounded-xl bg-[var(--bg-elev)] p-4 text-sm">
          <span className="font-semibold">{t("scan.speechTitle")}: </span>
          <span className="mono">
            {result.value?.classification === "CAPTURED"
              ? t("scan.captured")
              : t("scan.insufficientSignal")}
          </span>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {t("scan.speechNote")}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {!result && sensorState !== "capturing" && (
          <button
            onClick={start}
            disabled={sensorState === "requesting_permission" || sensorState === "processing"}
            className="sensor-primary-button"
          >
            {t("scan.enableMicrophone")}
          </button>
        )}
        {!result &&
          sensorState !== "capturing" &&
          sensorState !== "requesting_permission" &&
          sensorState !== "processing" && (
          <button onClick={() => void skip()} className="sensor-secondary-button">
            {t("scan.skipSpeech")}
          </button>
          )}
        {sensorState === "capturing" && (
          <span className="inline-flex items-center gap-2 text-sm text-[var(--accent)]">
            <span className="live-dot h-2 w-2 rounded-full bg-[var(--accent)]" />
            {t("scan.recordingLocal")}
          </span>
        )}
      </div>
    </StepScreen>
  );
}
