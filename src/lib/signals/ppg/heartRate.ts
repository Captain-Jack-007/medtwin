import { ProcessedSignal } from "./preprocess";

export interface HeartRateEstimate {
  bpm: number;
  confidence: number;
  periodicity: number;
  peakConsistency: number;
  spectralBpm: number;
  peakBpm: number | null;
}

export const HEART_RATE_BAND = { minimumHz: 0.7, maximumHz: 3 } as const;

export function estimateHeartRate(
  signal: ProcessedSignal,
  minimumDurationMs = 12_000
): HeartRateEstimate | null {
  if (
    signal.durationMs < minimumDurationMs ||
    signal.values.length < signal.sampleRate * 8
  ) {
    return null;
  }

  const spectrum = dominantFrequency(
    signal.values,
    signal.sampleRate,
    HEART_RATE_BAND.minimumHz,
    HEART_RATE_BAND.maximumHz,
    0.01
  );
  if (!spectrum || spectrum.periodicity < 0.12) return null;

  const peaks = findPeaks(signal.values, signal.sampleRate);
  const intervals = peaks
    .slice(1)
    .map((peak, index) => (peak - peaks[index]) / signal.sampleRate)
    .filter((interval) => interval >= 1 / 3 && interval <= 1 / 0.7);
  const medianInterval = median(intervals);
  const peakBpm = medianInterval ? 60 / medianInterval : null;
  const consistency = intervalConsistency(intervals);
  const spectralBpm = spectrum.frequency * 60;
  const estimatesAgree =
    peakBpm !== null && Math.abs(peakBpm - spectralBpm) <= 12;
  const bpm = estimatesAgree
    ? spectralBpm * 0.65 + peakBpm * 0.35
    : spectralBpm;
  const confidence = clamp01(
    spectrum.periodicity * 0.68 + consistency * 0.22 + (estimatesAgree ? 0.1 : 0)
  );

  if (!Number.isFinite(bpm) || bpm < 42 || bpm > 180) return null;
  return {
    bpm,
    confidence,
    periodicity: spectrum.periodicity,
    peakConsistency: consistency,
    spectralBpm,
    peakBpm,
  };
}

export function dominantFrequency(
  values: number[],
  sampleRate: number,
  minimumHz: number,
  maximumHz: number,
  stepHz: number
): { frequency: number; periodicity: number } | null {
  if (values.length < 4) return null;
  const totalEnergy =
    values.reduce((sum, value) => sum + value * value, 0) / values.length;
  if (totalEnergy <= Number.EPSILON) return null;

  let bestFrequency = minimumHz;
  let bestEnergy = 0;
  for (
    let frequency = minimumHz;
    frequency <= maximumHz;
    frequency += stepHz
  ) {
    let cosine = 0;
    let sine = 0;
    for (let index = 0; index < values.length; index += 1) {
      const phase = (2 * Math.PI * frequency * index) / sampleRate;
      cosine += values[index] * Math.cos(phase);
      sine += values[index] * Math.sin(phase);
    }
    const amplitude = (2 * Math.hypot(cosine, sine)) / values.length;
    const energy = (amplitude * amplitude) / 2;
    if (energy > bestEnergy) {
      bestEnergy = energy;
      bestFrequency = frequency;
    }
  }

  return {
    frequency: bestFrequency,
    periodicity: clamp01(bestEnergy / totalEnergy),
  };
}

function findPeaks(values: number[], sampleRate: number): number[] {
  const minimumDistance = Math.floor(sampleRate / HEART_RATE_BAND.maximumHz);
  const threshold = 0.15;
  const peaks: number[] = [];
  for (let index = 1; index < values.length - 1; index += 1) {
    if (
      values[index] > threshold &&
      values[index] > values[index - 1] &&
      values[index] >= values[index + 1] &&
      (peaks.length === 0 || index - peaks[peaks.length - 1] >= minimumDistance)
    ) {
      peaks.push(index);
    }
  }
  return peaks;
}

function intervalConsistency(intervals: number[]): number {
  if (intervals.length < 3) return 0;
  const midpoint = median(intervals);
  if (!midpoint) return 0;
  const deviations = intervals.map((value) => Math.abs(value - midpoint));
  const medianDeviation = median(deviations) ?? 0;
  return clamp01(1 - medianDeviation / midpoint / 0.25);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
