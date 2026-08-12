export interface TimedSignalSample {
  timestamp: number;
  value: number;
}

export interface ProcessedSignal {
  timestamps: number[];
  values: number[];
  sampleRate: number;
  durationMs: number;
}

export interface PreprocessOptions {
  targetSampleRate?: number;
  lowCutHz?: number;
  highCutHz?: number;
}

export function preprocessPpg(
  samples: TimedSignalSample[],
  options: PreprocessOptions = {}
): ProcessedSignal {
  const targetSampleRate = options.targetSampleRate ?? 30;
  const lowCutHz = options.lowCutHz ?? 0.7;
  const highCutHz = options.highCutHz ?? 3;
  const clean = samples
    .filter(
      (sample) =>
        Number.isFinite(sample.timestamp) && Number.isFinite(sample.value)
    )
    .sort((left, right) => left.timestamp - right.timestamp);

  if (clean.length < 3) {
    return { timestamps: [], values: [], sampleRate: targetSampleRate, durationMs: 0 };
  }

  const start = clean[0].timestamp;
  const end = clean[clean.length - 1].timestamp;
  const intervalMs = 1000 / targetSampleRate;
  const timestamps: number[] = [];
  const values: number[] = [];
  let sourceIndex = 0;

  for (let timestamp = start; timestamp <= end; timestamp += intervalMs) {
    while (
      sourceIndex < clean.length - 2 &&
      clean[sourceIndex + 1].timestamp < timestamp
    ) {
      sourceIndex += 1;
    }
    const left = clean[sourceIndex];
    const right = clean[Math.min(sourceIndex + 1, clean.length - 1)];
    const span = Math.max(1, right.timestamp - left.timestamp);
    const ratio = Math.max(0, Math.min(1, (timestamp - left.timestamp) / span));
    timestamps.push(timestamp);
    values.push(left.value + (right.value - left.value) * ratio);
  }

  const mean = average(values);
  const centered = values.map((value) => value - mean);
  const filtered = lowPass(
    highPass(centered, targetSampleRate, lowCutHz),
    targetSampleRate,
    highCutHz
  );
  const deviation = standardDeviation(filtered);
  const normalized =
    deviation > Number.EPSILON
      ? filtered.map((value) => value / deviation)
      : filtered.map(() => 0);

  return {
    timestamps,
    values: normalized,
    sampleRate: targetSampleRate,
    durationMs: end - start,
  };
}

export function highPass(
  values: number[],
  sampleRate: number,
  cutoffHz: number
): number[] {
  if (values.length === 0) return [];
  const delta = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = rc / (rc + delta);
  const output = new Array<number>(values.length).fill(0);
  let previousOutput = 0;
  let previousInput = values[0];
  for (let index = 1; index < values.length; index += 1) {
    const next = alpha * (previousOutput + values[index] - previousInput);
    output[index] = next;
    previousOutput = next;
    previousInput = values[index];
  }
  return output;
}

export function lowPass(
  values: number[],
  sampleRate: number,
  cutoffHz: number
): number[] {
  if (values.length === 0) return [];
  const delta = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = delta / (rc + delta);
  const output = new Array<number>(values.length).fill(values[0]);
  for (let index = 1; index < values.length; index += 1) {
    output[index] = output[index - 1] + alpha * (values[index] - output[index - 1]);
  }
  return output;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  return Math.sqrt(
    average(values.map((value) => (value - mean) * (value - mean)))
  );
}
