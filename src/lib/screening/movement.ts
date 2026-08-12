import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { ScreeningMeasurement } from "@/lib/measurements/types";

export const MOVEMENT_CONFIG = {
  holdDurationMs: 5_000,
  minimumVisibility: 0.55,
  reviewThreshold: 0.11,
} as const;

export interface MovementFrame {
  timestamp: number;
  bothArmsRaised: boolean;
  leftRaised: boolean;
  rightRaised: boolean;
  asymmetry: number | null;
  confidence: number;
}

export function analyzeMovementFrame(
  landmarks: NormalizedLandmark[] | undefined,
  timestamp: number
): MovementFrame {
  if (!landmarks || landmarks.length < 25) {
    return {
      timestamp,
      bothArmsRaised: false,
      leftRaised: false,
      rightRaised: false,
      asymmetry: null,
      confidence: 0,
    };
  }
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const tracked = [
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
  ];
  const confidence = average(
    tracked.map((landmark) => landmark.visibility ?? 0)
  );
  const leftRaised =
    confidence >= MOVEMENT_CONFIG.minimumVisibility &&
    leftWrist.y < leftShoulder.y &&
    leftElbow.y < leftShoulder.y + 0.08;
  const rightRaised =
    confidence >= MOVEMENT_CONFIG.minimumVisibility &&
    rightWrist.y < rightShoulder.y &&
    rightElbow.y < rightShoulder.y + 0.08;
  const torsoWidth = Math.max(0.05, Math.abs(leftShoulder.x - rightShoulder.x));
  const wristHeightDifference = Math.abs(leftWrist.y - rightWrist.y) / torsoWidth;
  const elbowHeightDifference = Math.abs(leftElbow.y - rightElbow.y) / torsoWidth;
  return {
    timestamp,
    bothArmsRaised: leftRaised && rightRaised,
    leftRaised,
    rightRaised,
    asymmetry: wristHeightDifference * 0.65 + elbowHeightDifference * 0.35,
    confidence,
  };
}

export function buildMovementMeasurement(
  frames: MovementFrame[]
): ScreeningMeasurement {
  const timestamp = new Date().toISOString();
  const valid = frames.filter(
    (frame) => frame.bothArmsRaised && frame.asymmetry !== null
  );
  if (valid.length < 8) {
    return {
      value: { classification: "INSUFFICIENT_SIGNAL", score: null },
      unit: "screening",
      source: "camera-derived",
      timestamp,
      confidence: 0,
      signalQuality: frames.length
        ? average(frames.map((frame) => frame.confidence))
        : null,
      algorithm: "pose_arm_symmetry_v1",
      status: "insufficient_signal",
    };
  }
  const asymmetry = median(valid.map((frame) => frame.asymmetry ?? 0));
  const confidence = average(valid.map((frame) => frame.confidence));
  return {
    value: {
      classification:
        asymmetry >= MOVEMENT_CONFIG.reviewThreshold
          ? "POSSIBLE_ASYMMETRY"
          : "SYMMETRIC",
      score: asymmetry,
    },
    unit: "normalized asymmetry",
    source: "camera-derived",
    timestamp,
    confidence,
    signalQuality: confidence,
    algorithm: "pose_arm_symmetry_v1",
    status: "estimated",
  };
}

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
