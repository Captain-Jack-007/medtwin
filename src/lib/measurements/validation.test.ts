import { describe, expect, it } from "vitest";
import {
  unavailableMeasurement,
  validateNumericMeasurement,
} from "./validation";

describe("measurement validation", () => {
  it("stores a plausible, quality-gated measurement with provenance", () => {
    const measurement = validateNumericMeasurement({
      value: 72.4,
      unit: "bpm",
      source: "camera-derived",
      algorithm: "camera_ppg_v1",
      confidence: 0.8,
      signalQuality: 0.75,
      minimumQuality: 0.55,
      min: 42,
      max: 180,
    });
    expect(measurement.value).toBe(72);
    expect(measurement.source).toBe("camera-derived");
    expect(measurement.status).toBe("measured");
  });

  it("marks low-quality or implausible values unavailable", () => {
    const lowQuality = validateNumericMeasurement({
      value: 72,
      unit: "bpm",
      source: "camera-derived",
      algorithm: "camera_ppg_v1",
      confidence: 0.4,
      signalQuality: 0.2,
      minimumQuality: 0.55,
      min: 42,
      max: 180,
    });
    expect(lowQuality.value).toBeNull();
    expect(lowQuality.status).toBe("insufficient_signal");
  });

  it("represents external-device requirements without a value", () => {
    const measurement = unavailableMeasurement<number>(
      "%",
      "external_device_required"
    );
    expect(measurement.value).toBeNull();
    expect(measurement.source).toBe("unavailable");
  });
});
