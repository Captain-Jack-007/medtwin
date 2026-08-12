import { ScreeningMeasurement } from "@/lib/measurements/types";

export interface SpeechFrame {
  rms: number;
  clipping: boolean;
}

export function buildSpeechMeasurement(
  frames: SpeechFrame[],
  durationMs: number
): ScreeningMeasurement {
  const timestamp = new Date().toISOString();
  const voiceFrames = frames.filter((frame) => frame.rms >= 0.025).length;
  const voiceActivity = frames.length ? voiceFrames / frames.length : 0;
  const clippingRate = frames.length
    ? frames.filter((frame) => frame.clipping).length / frames.length
    : 1;
  const durationScore = Math.max(0, Math.min(1, durationMs / 5_000));
  const quality = Math.max(
    0,
    Math.min(
      1,
      durationScore * 0.35 +
        Math.min(1, voiceActivity / 0.35) * 0.5 +
        (1 - clippingRate) * 0.15
    )
  );
  const captured = durationMs >= 4_000 && voiceActivity >= 0.12 && clippingRate < 0.35;
  return {
    value: {
      classification: captured ? "CAPTURED" : "INSUFFICIENT_SIGNAL",
      score: voiceActivity,
    },
    unit: "task completion",
    source: "microphone-derived",
    timestamp,
    confidence: captured ? quality : 0,
    signalQuality: quality,
    algorithm: "speech_voice_activity_v1",
    status: captured ? "completed" : "insufficient_signal",
  };
}
