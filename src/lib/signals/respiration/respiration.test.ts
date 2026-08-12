import { describe, expect, it } from "vitest";
import { estimateRespiration, RespirationSample } from "./estimate";

function respirationSignal(
  frequencyHz: number,
  durationSeconds: number,
  sampleRate = 10
): RespirationSample[] {
  return Array.from({ length: durationSeconds * sampleRate }, (_, index) => ({
    timestamp: (index / sampleRate) * 1000,
    value:
      Math.sin((2 * Math.PI * frequencyHz * index) / sampleRate) +
      index * 0.0003,
    confidence: 0.9,
  }));
}

describe("pose respiration estimation", () => {
  it("estimates 15 breaths/min from a deterministic 0.25 Hz signal", () => {
    const estimate = estimateRespiration(respirationSignal(0.25, 20));
    expect(estimate).not.toBeNull();
    expect(estimate!.breathsPerMinute).toBeGreaterThan(14);
    expect(estimate!.breathsPerMinute).toBeLessThan(16);
  });

  it("rejects an insufficient capture duration", () => {
    expect(estimateRespiration(respirationSignal(0.25, 5))).toBeNull();
  });

  it("rejects low pose confidence", () => {
    const samples = respirationSignal(0.25, 20).map((sample) => ({
      ...sample,
      confidence: 0.2,
    }));
    expect(estimateRespiration(samples)).toBeNull();
  });
});
