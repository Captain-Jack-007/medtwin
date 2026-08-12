import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { ScreeningMeasurement } from "@/lib/measurements/types";

export const FACE_CAPTURE_CONFIG = {
  minimumStableMs: 4_000,
  minimumQuality: 0.68,
  asymmetryReviewThreshold: 0.045,
} as const;

export interface FaceFrameAnalysis {
  faceDetected: boolean;
  exactlyOneFace: boolean;
  framingScore: number;
  sizeScore: number;
  stabilityScore: number;
  lightingScore: number;
  orientationScore: number;
  quality: number;
  center: { x: number; y: number } | null;
  asymmetryScore: number | null;
}

export interface FaceScreeningSample {
  timestamp: number;
  asymmetryScore: number;
  quality: number;
}

export function analyzeFaceFrame(
  faces: NormalizedLandmark[][],
  luminance: number,
  previousCenter: { x: number; y: number } | null
): FaceFrameAnalysis {
  if (faces.length !== 1) {
    return emptyFaceAnalysis(faces.length === 1, faces.length === 1);
  }

  const landmarks = faces[0];
  if (landmarks.length < 300) return emptyFaceAnalysis(false, true);
  const bounds = landmarkBounds(landmarks);
  const center = {
    x: (bounds.minimumX + bounds.maximumX) / 2,
    y: (bounds.minimumY + bounds.maximumY) / 2,
  };
  const width = bounds.maximumX - bounds.minimumX;
  const height = bounds.maximumY - bounds.minimumY;
  const centerDistance = Math.hypot(center.x - 0.5, center.y - 0.48);
  const framingScore = clamp01(1 - centerDistance / 0.28);
  const sizeScore = trapezoidScore(Math.max(width, height), 0.22, 0.34, 0.7, 0.9);
  const motion = previousCenter
    ? Math.hypot(center.x - previousCenter.x, center.y - previousCenter.y)
    : 0;
  const stabilityScore = clamp01(1 - motion / 0.018);
  const lightingScore = trapezoidScore(luminance, 35, 75, 205, 245);

  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const nose = landmarks[1];
  const eyeMidpoint = (leftEye.x + rightEye.x) / 2;
  const orientationScore = clamp01(1 - Math.abs(nose.x - eyeMidpoint) / Math.max(0.01, width * 0.16));
  const asymmetryScore = calculateFacialAsymmetry(landmarks, height);
  const quality = clamp01(
    framingScore * 0.23 +
      sizeScore * 0.18 +
      stabilityScore * 0.24 +
      lightingScore * 0.18 +
      orientationScore * 0.17
  );

  return {
    faceDetected: true,
    exactlyOneFace: true,
    framingScore,
    sizeScore,
    stabilityScore,
    lightingScore,
    orientationScore,
    quality,
    center,
    asymmetryScore,
  };
}

export function buildFacialSymmetryMeasurement(
  samples: FaceScreeningSample[]
): ScreeningMeasurement {
  const timestamp = new Date().toISOString();
  const qualified = samples.filter(
    (sample) => sample.quality >= FACE_CAPTURE_CONFIG.minimumQuality
  );
  if (qualified.length < 10) {
    return {
      value: { classification: "INSUFFICIENT_SIGNAL", score: null },
      unit: "screening",
      source: "camera-derived",
      timestamp,
      confidence: 0,
      signalQuality: samples.length ? average(samples.map((sample) => sample.quality)) : null,
      algorithm: "facial_symmetry_landmarks_v1",
      status: "insufficient_signal",
    };
  }
  const asymmetryScore = median(qualified.map((sample) => sample.asymmetryScore));
  const quality = average(qualified.map((sample) => sample.quality));
  return {
    value: {
      classification:
        asymmetryScore >= FACE_CAPTURE_CONFIG.asymmetryReviewThreshold
          ? "REVIEW"
          : "NORMAL_RANGE",
      score: asymmetryScore,
    },
    unit: "normalized asymmetry",
    source: "camera-derived",
    timestamp,
    confidence: quality,
    signalQuality: quality,
    algorithm: "facial_symmetry_landmarks_v1",
    status: "estimated",
  };
}

function calculateFacialAsymmetry(
  landmarks: NormalizedLandmark[],
  faceHeight: number
): number {
  const scale = Math.max(0.01, faceHeight);
  const mouth = Math.abs(landmarks[61].y - landmarks[291].y) / scale;
  const eyes = Math.abs(landmarks[33].y - landmarks[263].y) / scale;
  const brows = Math.abs(landmarks[70].y - landmarks[300].y) / scale;
  return mouth * 0.55 + eyes * 0.25 + brows * 0.2;
}

function landmarkBounds(landmarks: NormalizedLandmark[]) {
  let minimumX = 1;
  let minimumY = 1;
  let maximumX = 0;
  let maximumY = 0;
  for (const landmark of landmarks) {
    minimumX = Math.min(minimumX, landmark.x);
    minimumY = Math.min(minimumY, landmark.y);
    maximumX = Math.max(maximumX, landmark.x);
    maximumY = Math.max(maximumY, landmark.y);
  }
  return { minimumX, minimumY, maximumX, maximumY };
}

function emptyFaceAnalysis(
  faceDetected: boolean,
  exactlyOneFace: boolean
): FaceFrameAnalysis {
  return {
    faceDetected,
    exactlyOneFace,
    framingScore: 0,
    sizeScore: 0,
    stabilityScore: 0,
    lightingScore: 0,
    orientationScore: 0,
    quality: 0,
    center: null,
    asymmetryScore: null,
  };
}

function trapezoidScore(
  value: number,
  minimum: number,
  goodMinimum: number,
  goodMaximum: number,
  maximum: number
): number {
  if (value <= minimum || value >= maximum) return 0;
  if (value < goodMinimum) return (value - minimum) / (goodMinimum - minimum);
  if (value <= goodMaximum) return 1;
  return (maximum - value) / (maximum - goodMaximum);
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
