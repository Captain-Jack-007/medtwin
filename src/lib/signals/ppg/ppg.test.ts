import { describe, expect, it } from "vitest";
import { estimateHeartRate } from "./heartRate";
import { preprocessPpg } from "./preprocess";
import { calculatePpgQuality } from "./quality";
import { PpgSample } from "./capture";

function mathematicalSignal(
  frequencyHz: number,
  durationSeconds: number,
  sampleRate = 30
) {
  return Array.from({ length: durationSeconds * sampleRate }, (_, index) => ({
    timestamp: (index / sampleRate) * 1000,
    value:
      Math.sin((2 * Math.PI * frequencyHz * index) / sampleRate) +
      0.08 * Math.sin((2 * Math.PI * 5 * index) / sampleRate),
  }));
}

function ppgFrames(clipping = 0): PpgSample[] {
  return mathematicalSignal(1.2, 16).map((sample) => ({
    timestamp: sample.timestamp,
    value: sample.value,
    red: 160,
    green: 80 + sample.value,
    blue: 45,
    luminance: 95,
    clipping,
    coverage: 0.9,
  }));
}

describe("camera PPG processing", () => {
  it("estimates 72 BPM from a deterministic 1.2 Hz signal", () => {
    const processed = preprocessPpg(mathematicalSignal(1.2, 16));
    const estimate = estimateHeartRate(processed);
    expect(estimate).not.toBeNull();
    expect(estimate!.bpm).toBeGreaterThan(70);
    expect(estimate!.bpm).toBeLessThan(74);
  });

  it("rejects a flat signal", () => {
    const flat = Array.from({ length: 480 }, (_, index) => ({
      timestamp: (index / 30) * 1000,
      value: 0.5,
    }));
    expect(estimateHeartRate(preprocessPpg(flat))).toBeNull();
  });

  it("accepts periodic unclipped capture quality", () => {
    const frames = ppgFrames();
    const estimate = estimateHeartRate(preprocessPpg(frames));
    const quality = calculatePpgQuality(frames, estimate);
    expect(quality.score).toBeGreaterThanOrEqual(0.55);
  });

  it("rejects heavily clipped capture quality", () => {
    const frames = ppgFrames(0.9);
    const estimate = estimateHeartRate(preprocessPpg(frames));
    const quality = calculatePpgQuality(frames, estimate);
    expect(quality.score).toBeLessThan(0.55);
  });
});
