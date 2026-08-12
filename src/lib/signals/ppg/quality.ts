import { PpgSample } from "./capture";
import { HeartRateEstimate } from "./heartRate";

export interface PpgQuality {
  score: number;
  fingerCoverage: number;
  periodicity: number;
  clippingScore: number;
  durationScore: number;
  peakConsistency: number;
}

export function calculatePpgQuality(
  samples: PpgSample[],
  estimate: HeartRateEstimate | null,
  targetDurationMs = 15_000
): PpgQuality {
  if (samples.length < 2) {
    return {
      score: 0,
      fingerCoverage: 0,
      periodicity: 0,
      clippingScore: 0,
      durationScore: 0,
      peakConsistency: 0,
    };
  }
  const duration = samples[samples.length - 1].timestamp - samples[0].timestamp;
  const fingerCoverage = average(samples.map((sample) => sample.coverage));
  const clippingScore = 1 - average(samples.map((sample) => sample.clipping));
  const durationScore = clamp01(duration / targetDurationMs);
  const periodicity = estimate?.periodicity ?? 0;
  const peakConsistency = estimate?.peakConsistency ?? 0;
  const baseScore = clamp01(
    fingerCoverage * 0.22 +
      clippingScore * 0.12 +
      durationScore * 0.16 +
      periodicity * 0.38 +
      peakConsistency * 0.12
  );
  const score = clippingScore < 0.55 ? Math.min(baseScore, 0.25) : baseScore;
  return {
    score,
    fingerCoverage,
    periodicity,
    clippingScore,
    durationScore,
    peakConsistency,
  };
}

const average = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
