"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";
import { StepScreen } from "./StepScreen";
import { CaptureError, StatusRows } from "./CaptureUI";
import { attachVideoStream, requestFrontCamera } from "@/lib/sensors/camera";
import {
  MediaAccessError,
  stopMediaStream,
  watchTrackEnded,
} from "@/lib/sensors/media";
import { loadPoseLandmarker } from "@/lib/vision/poseLandmarker";
import {
  analyzeMovementFrame,
  buildMovementMeasurement,
  MOVEMENT_CONFIG,
  MovementFrame,
} from "@/lib/screening/movement";
import {
  PermissionState,
  ScreeningMeasurement,
  SensorState,
} from "@/lib/measurements/types";
import type { ScanAssistantSnapshot } from "@/lib/patient-assistant/types";
import { MEDIA_ERROR_TRANSLATION_KEYS, useLanguage } from "@/lib/i18n";

const INFERENCE_INTERVAL_MS = 100;

export function MovementStep({
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);
  const stopWatchingRef = useRef<(() => void) | null>(null);
  const framesRef = useRef<MovementFrame[]>([]);
  const lastInferenceRef = useRef(0);
  const holdStartRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const [sensorState, setSensorState] = useState<SensorState>(
    result ? "success" : "idle"
  );
  const [permission, setPermission] = useState<PermissionState>("not_requested");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState({
    leftRaised: false,
    rightRaised: false,
    holdMs: 0,
    confidence: 0,
  });

  useEffect(() => {
    onAssistantStateChange?.({
      status: sensorState,
      activeSensor: "front_camera",
      permissions: { camera: permission, microphone: "not_requested" },
      signalQuality: live.confidence,
      indicators: {
        leftArmRaised: live.leftRaised,
        rightArmRaised: live.rightRaised,
        holdComplete: live.holdMs >= MOVEMENT_CONFIG.holdDurationMs,
        upperBodyDetected: live.confidence >= MOVEMENT_CONFIG.minimumVisibility,
      },
    });
  }, [live, onAssistantStateChange, permission, sensorState]);

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
    const measurement = buildMovementMeasurement(framesRef.current);
    stopCapture();
    onComplete(measurement);
    setSensorState(
      measurement.status === "estimated" ? "success" : "low_quality"
    );
  }, [onComplete, stopCapture]);

  const runFrame = useCallback(
    function frameLoop(poseLandmarker: PoseLandmarker, timestamp: number) {
      if (completedRef.current) return;
      requestRef.current = requestAnimationFrame((nextTimestamp) =>
        frameLoop(poseLandmarker, nextTimestamp)
      );
      if (timestamp - lastInferenceRef.current < INFERENCE_INTERVAL_MS) return;
      lastInferenceRef.current = timestamp;
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (!video || !overlay || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      try {
        const resultFrame = poseLandmarker.detectForVideo(video, timestamp);
        const landmarks = resultFrame.landmarks[0];
        const frame = analyzeMovementFrame(landmarks, timestamp);
        if (frame.bothArmsRaised) {
          holdStartRef.current ??= timestamp;
          framesRef.current.push(frame);
        } else {
          holdStartRef.current = null;
          framesRef.current = [];
        }
        const holdMs = holdStartRef.current ? timestamp - holdStartRef.current : 0;
        setLive({
          leftRaised: frame.leftRaised,
          rightRaised: frame.rightRaised,
          holdMs,
          confidence: frame.confidence,
        });
        drawPoseOverlay(overlay, video, landmarks);
        if (holdMs >= MOVEMENT_CONFIG.holdDurationMs) finalize();
      } catch {
        setError(t("scan.movementProcessingStopped"));
        setSensorState("failed");
        stopCapture();
      }
    },
    [finalize, stopCapture, t]
  );

  const start = async () => {
    stopCapture();
    completedRef.current = false;
    framesRef.current = [];
    holdStartRef.current = null;
    lastInferenceRef.current = 0;
    setLive({ leftRaised: false, rightRaised: false, holdMs: 0, confidence: 0 });
    setError(null);
    setSensorState("requesting_permission");
    setPermission("requesting");
    try {
      const stream = await requestFrontCamera();
      setPermission("granted");
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error(t("common.unavailable"));
      await attachVideoStream(video, stream);
      stopWatchingRef.current = watchTrackEnded(stream, () => {
        setError(t("scan.cameraStoppedMovement"));
        setSensorState("failed");
        stopCapture();
      });
      setSensorState("preparing");
      const poseLandmarker = await loadPoseLandmarker();
      setSensorState("capturing");
      requestRef.current = requestAnimationFrame((timestamp) =>
        runFrame(poseLandmarker, timestamp)
      );
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
          : t("scan.movementStartFailed")
      );
    }
  };

  const skip = () => {
    stopCapture();
    completedRef.current = true;
    onComplete({
      value: { classification: "INSUFFICIENT_SIGNAL", score: null },
      unit: "screening",
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
      title={t("scan.movementTitle")}
      onNext={onNext}
      onBack={onBack}
      nextDisabled={result === null}
    >
      <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
        {t("scan.movementDescription")}
      </p>
      <div className="relative mx-auto aspect-[4/3] w-full max-w-lg overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-full w-full -scale-x-100 object-cover"
          aria-label={t("scan.movementCameraPreview")}
        />
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
          aria-hidden="true"
        />
        {sensorState !== "capturing" && sensorState !== "preparing" && (
          <div className="absolute inset-0 grid place-items-center bg-black/65 p-6 text-center text-sm text-white">
            {result ? t("scan.movementStored") : t("scan.movementCameraHint")}
          </div>
        )}
      </div>

      <div className="mt-4">
        <StatusRows
          rows={[
            { label: t("scan.leftArm"), ok: live.leftRaised, detail: live.leftRaised ? t("scan.raised") : t("scan.notRaised") },
            { label: t("scan.rightArm"), ok: live.rightRaised, detail: live.rightRaised ? t("scan.raised") : t("scan.notRaised") },
            {
              label: t("scan.hold"),
              ok: live.holdMs >= MOVEMENT_CONFIG.holdDurationMs,
              detail: `${(live.holdMs / 1000).toFixed(1)} / ${(MOVEMENT_CONFIG.holdDurationMs / 1000).toFixed(1)} ${t("scan.seconds")}`,
            },
            {
              label: t("scan.poseConfidence"),
              ok: live.confidence >= MOVEMENT_CONFIG.minimumVisibility,
              detail: `${Math.round(live.confidence * 100)}%`,
            },
          ]}
        />
      </div>

      {error && <div className="mt-4"><CaptureError message={error} /></div>}
      {result && (
        <div className="mt-4 rounded-xl bg-[var(--bg-elev)] p-4 text-sm">
          <span className="font-semibold">{t("scan.movementSymmetry")}: </span>
          <span className="mono">
            {result.value?.classification === "SYMMETRIC"
              ? t("scan.symmetric")
              : t("scan.insufficientCapture")}
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {!result && sensorState !== "capturing" && (
          <button
            onClick={start}
            disabled={sensorState === "requesting_permission" || sensorState === "preparing" || sensorState === "processing"}
            className="sensor-primary-button"
          >
            {t("scan.enableCamera")}
          </button>
        )}
        {!result &&
          sensorState !== "capturing" &&
          sensorState !== "requesting_permission" &&
          sensorState !== "preparing" &&
          sensorState !== "processing" && (
          <button onClick={skip} className="sensor-secondary-button">
            {t("scan.skipMovement")}
          </button>
          )}
      </div>
    </StepScreen>
  );
}

function drawPoseOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  landmarks: NormalizedLandmark[] | undefined
) {
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  context.strokeStyle = "#2dd4bf";
  context.fillStyle = "#38bdf8";
  context.lineWidth = 3;
  for (const [start, end] of [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16]]) {
    const left = landmarks[start];
    const right = landmarks[end];
    if (!left || !right || (left.visibility ?? 0) < 0.4 || (right.visibility ?? 0) < 0.4) continue;
    context.beginPath();
    context.moveTo(left.x * canvas.width, left.y * canvas.height);
    context.lineTo(right.x * canvas.width, right.y * canvas.height);
    context.stroke();
  }
  for (const index of [11, 12, 13, 14, 15, 16]) {
    const landmark = landmarks[index];
    if (!landmark || (landmark.visibility ?? 0) < 0.4) continue;
    context.beginPath();
    context.arc(landmark.x * canvas.width, landmark.y * canvas.height, 5, 0, Math.PI * 2);
    context.fill();
  }
}
