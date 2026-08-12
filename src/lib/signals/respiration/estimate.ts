import { dominantFrequency } from "../ppg/heartRate";
import {
  average,
  highPass,
  lowPass,
  TimedSignalSample,
} from "../ppg/preprocess";

export interface RespirationSample extends TimedSignalSample {
  confidence: number;
}

export interface RespirationEstimate {
  breathsPerMinute: number;
  confidence: number;
  periodicity: number;
  poseConfidence: number;
  durationMs: number;
}

export function estimateRespiration(
  samples: RespirationSample[],
  minimumDurationMs = 12_000
): RespirationEstimate | null {
  const clean = samples
    .filter(
      (sample) =>
        Number.isFinite(sample.timestamp) &&
        Number.isFinite(sample.value) &&
        Number.isFinite(sample.confidence)
    )
    .sort((left, right) => left.timestamp - right.timestamp);
  if (clean.length < 20) return null;
  const durationMs = clean[clean.length - 1].timestamp - clean[0].timestamp;
  if (durationMs < minimumDurationMs) return null;

  const sampleRate = 10;
  const interval = 1000 / sampleRate;
  const values: number[] = [];
  let index = 0;
  for (
    let timestamp = clean[0].timestamp;
    timestamp <= clean[clean.length - 1].timestamp;
    timestamp += interval
  ) {
    while (
      index < clean.length - 2 &&
      clean[index + 1].timestamp < timestamp
    ) {
      index += 1;
    }
    const left = clean[index];
    const right = clean[Math.min(index + 1, clean.length - 1)];
    const ratio = Math.max(
      0,
      Math.min(
        1,
        (timestamp - left.timestamp) /
          Math.max(1, right.timestamp - left.timestamp)
      )
    );
    values.push(left.value + (right.value - left.value) * ratio);
  }

  const centered = values.map((value) => value - average(values));
  const filtered = lowPass(highPass(centered, sampleRate, 0.08), sampleRate, 0.7);
  const spectrum = dominantFrequency(filtered, sampleRate, 0.1, 0.7, 0.005);
  if (!spectrum) return null;
  const poseConfidence = average(clean.map((sample) => sample.confidence));
  const confidence = clamp01(spectrum.periodicity * 0.75 + poseConfidence * 0.25);
  const breathsPerMinute = spectrum.frequency * 60;
  if (
    spectrum.periodicity < 0.16 ||
    poseConfidence < 0.45 ||
    breathsPerMinute < 6 ||
    breathsPerMinute > 40
  ) {
    return null;
  }
  return {
    breathsPerMinute,
    confidence,
    periodicity: spectrum.periodicity,
    poseConfidence,
    durationMs,
  };
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
