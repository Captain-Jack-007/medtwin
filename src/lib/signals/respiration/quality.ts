import { RespirationEstimate, RespirationSample } from "./estimate";

export function calculateRespirationQuality(
  samples: RespirationSample[],
  estimate: RespirationEstimate | null,
  targetDurationMs = 15_000
): number {
  if (samples.length < 2) return 0;
  const duration = samples[samples.length - 1].timestamp - samples[0].timestamp;
  const durationScore = Math.max(0, Math.min(1, duration / targetDurationMs));
  const poseConfidence =
    samples.reduce((sum, sample) => sum + sample.confidence, 0) / samples.length;
  const periodicity = estimate?.periodicity ?? 0;
  return Math.max(
    0,
    Math.min(1, durationScore * 0.25 + poseConfidence * 0.3 + periodicity * 0.45)
  );
}
