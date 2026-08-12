"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FaceLandmarker,
  NormalizedLandmark,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import { StepScreen } from "./StepScreen";
import { CaptureError, CaptureMetrics, StatusRows } from "./CaptureUI";
import {
  attachVideoStream,
  requestFrontCamera,
  sampleCameraFrame,
} from "@/lib/sensors/camera";
import {
  MediaAccessError,
  stopMediaStream,
  watchTrackEnded,
} from "@/lib/sensors/media";
import { loadFaceLandmarker } from "@/lib/vision/faceLandmarker";
import { loadPoseLandmarker } from "@/lib/vision/poseLandmarker";
import {
  analyzeFaceFrame,
  buildFacialSymmetryMeasurement,
  FACE_CAPTURE_CONFIG,
  FaceScreeningSample,
} from "@/lib/screening/face";
import {
  estimateRespiration,
  RespirationSample,
} from "@/lib/signals/respiration/estimate";
import { calculateRespirationQuality } from "@/lib/signals/respiration/quality";
import {
  ScreeningMeasurement,
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
const MAX_CAPTURE_MS = 22_000;
const INFERENCE_INTERVAL_MS = 100;

export interface FaceBreathingResult {
  facialSymmetry: ScreeningMeasurement;
  respiratoryRate: Measurement<number>;
}

interface LiveState {
  elapsedMs: number;
  stableMs: number;
  faceQuality: number;
  respirationQuality: number;
  faceDetected: boolean;
  exactlyOneFace: boolean;
  lightingGood: boolean;
  motionLow: boolean;
  torsoVisible: boolean;
}

const INITIAL_LIVE: LiveState = {
  elapsedMs: 0,
  stableMs: 0,
  faceQuality: 0,
  respirationQuality: 0,
  faceDetected: false,
  exactlyOneFace: false,
  lightingGood: false,
  motionLow: false,
  torsoVisible: false,
};

export function FaceBreathingStep({
  onNext,
  onBack,
  onComplete,
  result,
  onAssistantStateChange,
}: {
  onNext: () => void;
  onBack: () => void;
  onComplete: (result: FaceBreathingResult) => void;
  result: FaceBreathingResult | null;
  onAssistantStateChange?: (state: ScanAssistantSnapshot) => void;
}) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRequestRef = useRef<number | null>(null);
  const stoppedWatchingRef = useRef<(() => void) | null>(null);
  const startTimeRef = useRef(0);
  const lastInferenceRef = useRef(0);
  const previousFaceCenterRef = useRef<{ x: number; y: number } | null>(null);
  const stableMsRef = useRef(0);
  const faceSamplesRef = useRef<FaceScreeningSample[]>([]);
  const respirationSamplesRef = useRef<RespirationSample[]>([]);
  const completedRef = useRef(false);
  const [sensorState, setSensorState] = useState<SensorState>(
    result ? "success" : "idle"
  );
  const [permission, setPermission] = useState<PermissionState>("not_requested");
  const [live, setLive] = useState<LiveState>(INITIAL_LIVE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onAssistantStateChange?.({
      status: sensorState,
      activeSensor: "front_camera",
      permissions: { camera: permission, microphone: "not_requested" },
      signalQuality: (live.faceQuality + live.respirationQuality) / 2,
      indicators: {
        faceDetected: live.faceDetected,
        exactlyOneFace: live.exactlyOneFace,
        lightingGood: live.lightingGood,
        motionLow: live.motionLow,
        upperBodyDetected: live.torsoVisible,
      },
    });
  }, [live, onAssistantStateChange, permission, sensorState]);

  const stopCapture = useCallback(() => {
    if (frameRequestRef.current !== null) {
      cancelAnimationFrame(frameRequestRef.current);
      frameRequestRef.current = null;
    }
    stoppedWatchingRef.current?.();
    stoppedWatchingRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopCapture, [stopCapture]);

  const finalize = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setSensorState("processing");
    const face = buildFacialSymmetryMeasurement(faceSamplesRef.current);
    const respirationEstimate = estimateRespiration(respirationSamplesRef.current);
    const respirationQuality = calculateRespirationQuality(
      respirationSamplesRef.current,
      respirationEstimate
    );
    const respiratoryRate = respirationEstimate
      ? validateNumericMeasurement({
          value: respirationEstimate.breathsPerMinute,
          unit: "/min",
          source: "camera-derived",
          algorithm: "pose_respiration_v1",
          confidence: respirationEstimate.confidence,
          signalQuality: respirationQuality,
          minimumQuality: 0.52,
          min: 6,
          max: 40,
          status: "estimated",
        })
      : unavailableMeasurement<number>("/min", "insufficient_signal");
    stopCapture();
    const nextResult = { facialSymmetry: face, respiratoryRate };
    onComplete(nextResult);
    setSensorState(
      face.status === "insufficient_signal" &&
        respiratoryRate.status === "insufficient_signal"
        ? "low_quality"
        : "success"
    );
  }, [onComplete, stopCapture]);

  const runFrame = useCallback(
    function frameLoop(
      faceLandmarker: FaceLandmarker,
      poseLandmarker: PoseLandmarker,
      timestamp: number
    ) {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (!video || !overlay || completedRef.current) return;
      frameRequestRef.current = requestAnimationFrame((nextTimestamp) =>
        frameLoop(faceLandmarker, poseLandmarker, nextTimestamp)
      );
      if (
        timestamp - lastInferenceRef.current < INFERENCE_INTERVAL_MS ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return;
      }
      const delta = lastInferenceRef.current
        ? timestamp - lastInferenceRef.current
        : 0;
      lastInferenceRef.current = timestamp;

      try {
        const faceResult = faceLandmarker.detectForVideo(video, timestamp);
        const poseResult = poseLandmarker.detectForVideo(video, timestamp);
        sampleCanvasRef.current ??= document.createElement("canvas");
        const frame = sampleCameraFrame(video, sampleCanvasRef.current, 0.8);
        const analysis = analyzeFaceFrame(
          faceResult.faceLandmarks,
          frame?.luminance ?? 0,
          previousFaceCenterRef.current
        );
        previousFaceCenterRef.current = analysis.center;
        stableMsRef.current =
          analysis.quality >= FACE_CAPTURE_CONFIG.minimumQuality
            ? stableMsRef.current + delta
            : 0;
        if (analysis.asymmetryScore !== null) {
          faceSamplesRef.current.push({
            timestamp,
            asymmetryScore: analysis.asymmetryScore,
            quality: analysis.quality,
          });
        }

        const pose = poseResult.landmarks[0];
        const respirationSample = poseToRespirationSample(pose, timestamp);
        if (respirationSample) respirationSamplesRef.current.push(respirationSample);
        const respirationEstimate = estimateRespiration(
          respirationSamplesRef.current,
          5_000
        );
        const respirationQuality = calculateRespirationQuality(
          respirationSamplesRef.current,
          respirationEstimate
        );
        const elapsedMs = timestamp - startTimeRef.current;
        setLive({
          elapsedMs,
          stableMs: stableMsRef.current,
          faceQuality: analysis.quality,
          respirationQuality,
          faceDetected: analysis.faceDetected,
          exactlyOneFace: analysis.exactlyOneFace,
          lightingGood: analysis.lightingScore >= 0.65,
          motionLow: analysis.stabilityScore >= 0.68,
          torsoVisible: Boolean(respirationSample),
        });
        drawOverlay(overlay, video, faceResult.faceLandmarks[0], pose);

        if (
          (elapsedMs >= TARGET_CAPTURE_MS &&
            stableMsRef.current >= FACE_CAPTURE_CONFIG.minimumStableMs) ||
          elapsedMs >= MAX_CAPTURE_MS
        ) {
          finalize();
        }
      } catch {
        setError(t("scan.faceProcessingStopped"));
        setSensorState("failed");
        stopCapture();
      }
    },
    [finalize, stopCapture, t]
  );

  const start = async () => {
    stopCapture();
    completedRef.current = false;
    faceSamplesRef.current = [];
    respirationSamplesRef.current = [];
    stableMsRef.current = 0;
    previousFaceCenterRef.current = null;
    lastInferenceRef.current = 0;
    setLive(INITIAL_LIVE);
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
      stoppedWatchingRef.current = watchTrackEnded(stream, () => {
        setError(t("scan.cameraStoppedCapture"));
        setSensorState("failed");
        stopCapture();
      });
      setSensorState("preparing");
      const [faceLandmarker, poseLandmarker] = await Promise.all([
        loadFaceLandmarker(),
        loadPoseLandmarker(),
      ]);
      startTimeRef.current = performance.now();
      setSensorState("capturing");
      frameRequestRef.current = requestAnimationFrame((timestamp) =>
        runFrame(faceLandmarker, poseLandmarker, timestamp)
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
          : t("scan.cameraPreparationFailed")
      );
    }
  };

  const skip = () => {
    stopCapture();
    completedRef.current = true;
    const timestamp = new Date().toISOString();
    onComplete({
      facialSymmetry: {
        value: { classification: "INSUFFICIENT_SIGNAL", score: null },
        unit: "screening",
        source: "unavailable",
        timestamp,
        confidence: 0,
        signalQuality: null,
        algorithm: null,
        status: "not_measured",
      },
      respiratoryRate: unavailableMeasurement("/min", "not_measured", timestamp),
    });
    setSensorState("low_quality");
  };

  const completeResult = result !== null;
  return (
    <StepScreen
      title={t("scan.faceBreathingTitle")}
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!completeResult}
    >
      <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
        {t("scan.faceBreathingDescription")}
      </p>

      <div className="relative mx-auto aspect-[4/3] w-full max-w-lg overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-full w-full -scale-x-100 object-cover"
          aria-label={t("scan.frontCameraPreview")}
        >
          {t("scan.browserVideoUnsupported")}
        </video>
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-[9%_24%] rounded-[50%] border border-dashed border-[var(--accent)]/70" />
        {sensorState !== "capturing" && sensorState !== "preparing" && (
          <div className="absolute inset-0 grid place-items-center bg-black/65 p-6 text-center text-sm text-white">
            {result ? t("scan.captureStored") : t("scan.faceCameraHint")}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-4">
        <CaptureMetrics
          elapsedMs={live.elapsedMs}
          targetMs={TARGET_CAPTURE_MS}
          quality={(live.faceQuality + live.respirationQuality) / 2}
        />
        <StatusRows
          rows={[
            { label: t("scan.checkOneFace"), ok: live.exactlyOneFace },
            { label: t("scan.checkLighting"), ok: live.lightingGood },
            { label: t("scan.checkMotion"), ok: live.motionLow },
            { label: t("scan.checkUpperTorso"), ok: live.torsoVisible },
            {
              label: t("scan.checkStableFace"),
              ok: live.stableMs >= FACE_CAPTURE_CONFIG.minimumStableMs,
              detail: `${(live.stableMs / 1000).toFixed(1)} / ${(FACE_CAPTURE_CONFIG.minimumStableMs / 1000).toFixed(1)} ${t("scan.seconds")}`,
            },
          ]}
        />
      </div>

      {error && <div className="mt-4"><CaptureError message={error} /></div>}
      {result && (
        <div className="mt-4 rounded-xl bg-[var(--bg-elev)] p-4 text-sm">
          <div className="font-semibold">
            {result.facialSymmetry.status === "estimated"
              ? t("scan.faceCaptureComplete")
              : t("scan.facialUnavailable")}
          </div>
          <p className="mt-1 text-[var(--muted)]">
            {t("scan.respiratoryRate")}: {result.respiratoryRate.value !== null
              ? `${result.respiratoryRate.value} /min · ${t("scan.poseEstimate")}`
              : t("common.unavailable")}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {!result && sensorState !== "capturing" && sensorState !== "preparing" && (
          <button
            onClick={start}
            disabled={sensorState === "requesting_permission" || sensorState === "processing"}
            className="sensor-primary-button"
          >
            {sensorState === "requesting_permission" ? t("scan.requesting") : t("scan.enableCamera")}
          </button>
        )}
        {!result &&
          sensorState !== "capturing" &&
          sensorState !== "preparing" &&
          sensorState !== "requesting_permission" &&
          sensorState !== "processing" && (
          <button onClick={skip} className="sensor-secondary-button">
            {t("scan.skipCamera")}
          </button>
          )}
        {sensorState === "capturing" && (
          <span className="inline-flex items-center gap-2 text-sm text-[var(--accent)]">
            <span className="live-dot h-2 w-2 rounded-full bg-[var(--accent)]" />
            {t("scan.capturingLocal")}
          </span>
        )}
      </div>
    </StepScreen>
  );
}

function poseToRespirationSample(
  landmarks: NormalizedLandmark[] | undefined,
  timestamp: number
): RespirationSample | null {
  if (!landmarks || landmarks.length < 25) return null;
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const tracked = [leftShoulder, rightShoulder, leftHip, rightHip];
  const confidence =
    tracked.reduce((sum, landmark) => sum + (landmark.visibility ?? 0), 0) /
    tracked.length;
  if (confidence < 0.45) return null;
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  return {
    timestamp,
    value: shoulderY - shoulderWidth * 0.16,
    confidence,
  };
}

function drawOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  face: NormalizedLandmark[] | undefined,
  pose: NormalizedLandmark[] | undefined
) {
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#2dd4bf";
  for (const index of [10, 33, 61, 1, 291, 263, 152]) {
    const landmark = face?.[index];
    if (!landmark) continue;
    context.beginPath();
    context.arc(landmark.x * canvas.width, landmark.y * canvas.height, 2.5, 0, Math.PI * 2);
    context.fill();
  }
  if (!pose) return;
  context.strokeStyle = "rgba(56, 189, 248, 0.85)";
  context.lineWidth = 2;
  for (const [start, end] of [[11, 12], [11, 23], [12, 24], [23, 24]]) {
    const left = pose[start];
    const right = pose[end];
    if (!left || !right || (left.visibility ?? 0) < 0.4 || (right.visibility ?? 0) < 0.4) continue;
    context.beginPath();
    context.moveTo(left.x * canvas.width, left.y * canvas.height);
    context.lineTo(right.x * canvas.width, right.y * canvas.height);
    context.stroke();
  }
}
