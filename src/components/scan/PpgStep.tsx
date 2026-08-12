"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StepScreen } from "./StepScreen";
import { CaptureError, CaptureMetrics, StatusRows } from "./CaptureUI";
import { LiveTrace } from "./LiveTrace";
import {
  attachVideoStream,
  requestRearCamera,
  sampleCameraFrame,
  tryEnableTorch,
} from "@/lib/sensors/camera";
import {
  MediaAccessError,
  stopMediaStream,
  watchTrackEnded,
} from "@/lib/sensors/media";
import { PpgSample, toPpgSample } from "@/lib/signals/ppg/capture";
import { preprocessPpg } from "@/lib/signals/ppg/preprocess";
import { estimateHeartRate } from "@/lib/signals/ppg/heartRate";
import { calculatePpgQuality, PpgQuality } from "@/lib/signals/ppg/quality";
import {
  Measurement,
  PermissionState,
  SensorState,
} from "@/lib/measurements/types";
import type { ScanAssistantSnapshot } from "@/lib/patient-assistant/types";
import {
  unavailableMeasurement,
  validateNumericMeasurement,
} from "@/lib/measurements/validation";
import { MEDIA_ERROR_TRANSLATION_KEYS, useLanguage } from "@/lib/i18n";

const TARGET_CAPTURE_MS = 15_000;
const UI_INTERVAL_MS = 125;

const EMPTY_QUALITY: PpgQuality = {
  score: 0,
  fingerCoverage: 0,
  periodicity: 0,
  clippingScore: 0,
  durationScore: 0,
  peakConsistency: 0,
};

export function PpgStep({
  onNext,
  onBack,
  onComplete,
  result,
  onAssistantStateChange,
}: {
  onNext: () => void;
  onBack: () => void;
  onComplete: (measurement: Measurement<number>) => void;
  result: Measurement<number> | null;
  onAssistantStateChange?: (state: ScanAssistantSnapshot) => void;
}) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);
  const stopWatchingRef = useRef<(() => void) | null>(null);
  const samplesRef = useRef<PpgSample[]>([]);
  const lastUiRef = useRef(0);
  const completedRef = useRef(false);
  const [sensorState, setSensorState] = useState<SensorState>(
    result ? "success" : "idle"
  );
  const [permission, setPermission] = useState<PermissionState>("not_requested");
  const [error, setError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState<boolean | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [quality, setQuality] = useState<PpgQuality>(EMPTY_QUALITY);
  const [trace, setTrace] = useState<number[]>([]);

  useEffect(() => {
    onAssistantStateChange?.({
      status: sensorState,
      activeSensor: "rear_camera",
      permissions: { camera: permission, microphone: "not_requested" },
      signalQuality: quality.score,
      indicators: {
        fingerCoverage: quality.fingerCoverage,
        pulsePeriodicity: quality.periodicity,
        clippingControlled: quality.clippingScore >= 0.7,
      },
    });
  }, [onAssistantStateChange, permission, quality, sensorState]);

  const stopCapture = useCallback(() => {
    if (requestRef.current !== null) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    stopWatchingRef.current?.();
    stopWatchingRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopCapture, [stopCapture]);

  const finalize = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setSensorState("processing");
    const processed = preprocessPpg(samplesRef.current);
    const estimate = estimateHeartRate(processed);
    const finalQuality = calculatePpgQuality(samplesRef.current, estimate);
    const measurement = estimate
      ? validateNumericMeasurement({
          value: estimate.bpm,
          unit: "bpm",
          source: "camera-derived",
          algorithm: "camera_ppg_v1",
          confidence: estimate.confidence,
          signalQuality: finalQuality.score,
          minimumQuality: 0.55,
          min: 42,
          max: 180,
        })
      : unavailableMeasurement<number>("bpm", "insufficient_signal");
    setTrace(processed.values.slice(-240));
    setQuality(finalQuality);
    stopCapture();
    onComplete(measurement);
    setSensorState(measurement.value === null ? "low_quality" : "success");
  }, [onComplete, stopCapture]);

  const captureFrame = useCallback(
    function frameLoop(timestamp: number) {
      if (completedRef.current) return;
      requestRef.current = requestAnimationFrame(frameLoop);
      const video = videoRef.current;
      if (!video) return;
      canvasRef.current ??= document.createElement("canvas");
      const frame = sampleCameraFrame(video, canvasRef.current);
      if (!frame) return;
      const sample = toPpgSample(frame);
      samplesRef.current.push(sample);
      const first = samplesRef.current[0]?.timestamp ?? sample.timestamp;
      const elapsed = sample.timestamp - first;

      if (timestamp - lastUiRef.current >= UI_INTERVAL_MS) {
        lastUiRef.current = timestamp;
        const processed = preprocessPpg(samplesRef.current);
        const estimate = estimateHeartRate(processed, 6_000);
        setElapsedMs(elapsed);
        setTrace(processed.values.slice(-240));
        setQuality(calculatePpgQuality(samplesRef.current, estimate));
      }
      if (elapsed >= TARGET_CAPTURE_MS) finalize();
    },
    [finalize]
  );

  const start = async () => {
    stopCapture();
    completedRef.current = false;
    samplesRef.current = [];
    lastUiRef.current = 0;
    setTrace([]);
    setQuality(EMPTY_QUALITY);
    setElapsedMs(0);
    setError(null);
    setTorchEnabled(null);
    setSensorState("requesting_permission");
    setPermission("requesting");
    try {
      const stream = await requestRearCamera();
      setPermission("granted");
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error(t("common.unavailable"));
      await attachVideoStream(video, stream);
      stopWatchingRef.current = watchTrackEnded(stream, () => {
        setError(t("scan.cameraStoppedPulse"));
        setSensorState("failed");
        stopCapture();
      });
      setTorchEnabled(await tryEnableTorch(stream));
      setSensorState("capturing");
      requestRef.current = requestAnimationFrame(captureFrame);
    } catch (cause) {
      stopCapture();
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
          : t("scan.pulseStartFailed")
      );
    }
  };

  const skip = () => {
    stopCapture();
    completedRef.current = true;
    onComplete(unavailableMeasurement("bpm", "not_measured"));
    setSensorState("low_quality");
  };

  return (
    <StepScreen
      title={t("scan.pulseTitle")}
      onNext={onNext}
      onBack={onBack}
      nextDisabled={result === null}
    >
      <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
        {t("scan.pulseDescription")}
      </p>

      <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full object-cover"
            aria-label={t("scan.pulseCameraPreview")}
          >
            {t("scan.browserVideoUnsupported")}
          </video>
          {sensorState !== "capturing" && (
            <div className="absolute inset-0 grid place-items-center bg-black/70 p-4 text-center text-xs text-white">
              {t("scan.rearCameraPreview")}
            </div>
          )}
        </div>
        <LiveTrace
          values={trace}
          label={t("scan.cameraPpgLive")}
          color="var(--red)"
          height={150}
        />
      </div>

      <div className="mt-4 space-y-4">
        <CaptureMetrics
          elapsedMs={elapsedMs}
          targetMs={TARGET_CAPTURE_MS}
          quality={quality.score}
        />
        <StatusRows
          rows={[
            {
              label: t("scan.checkFingerCoverage"),
              ok: quality.fingerCoverage >= 0.48,
              detail: `${Math.round(quality.fingerCoverage * 100)}%`,
            },
            {
              label: t("scan.checkPulsePeriodicity"),
              ok: quality.periodicity >= 0.18,
              detail: quality.periodicity > 0 ? `${Math.round(quality.periodicity * 100)}%` : t("scan.acquiring"),
            },
            {
              label: t("scan.checkClipping"),
              ok: quality.clippingScore >= 0.7,
            },
            {
              label: t("scan.checkTorch"),
              ok: torchEnabled,
              detail: torchEnabled === null ? t("scan.checking") : torchEnabled ? t("scan.on") : t("common.unavailable"),
            },
          ]}
        />
      </div>

      {error && <div className="mt-4"><CaptureError message={error} /></div>}
      {result && (
        <div className="mt-4 rounded-xl bg-[var(--bg-elev)] p-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-semibold">{t("vitals.heartRate")}</span>
            <span className="mono text-xl">
              {result.value === null ? t("common.notMeasured") : `${result.value} BPM`}
            </span>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {result.value === null
              ? t("scan.pulseUnavailable")
              : `${t("scan.cameraPpg")}: ${t("common.quality")} ${Math.round((result.signalQuality ?? 0) * 100)}%`}
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
            {sensorState === "requesting_permission" ? t("scan.requesting") : t("scan.startPpg")}
          </button>
        )}
        {!result &&
          sensorState !== "capturing" &&
          sensorState !== "requesting_permission" &&
          sensorState !== "processing" && (
          <button onClick={skip} className="sensor-secondary-button">
            {t("scan.skipPulse")}
          </button>
          )}
        {sensorState === "capturing" && (
          <span className="inline-flex items-center gap-2 text-sm text-[var(--accent)]">
            <span className="live-dot h-2 w-2 rounded-full bg-[var(--accent)]" />
            {t("scan.samplingCamera")}
          </span>
        )}
      </div>
      <p className="mt-4 text-xs text-[var(--muted)]">
        {t("scan.pulseNote")}
      </p>
    </StepScreen>
  );
}
