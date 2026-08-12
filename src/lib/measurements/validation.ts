import {
  Measurement,
  MeasurementStatus,
  MeasurementSource,
  ScreeningMeasurement,
} from "./types";

export interface NumericMeasurementInput {
  value: number;
  unit: string;
  source: MeasurementSource;
  algorithm: string;
  confidence: number;
  signalQuality: number;
  min: number;
  max: number;
  minimumQuality: number;
  status?: Extract<MeasurementStatus, "measured" | "estimated">;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function unavailableMeasurement<T>(
  unit: string,
  status: Extract<
    MeasurementStatus,
    | "insufficient_signal"
    | "not_measured"
    | "external_device_required"
    | "unavailable"
  >,
  timestamp = new Date().toISOString()
): Measurement<T> {
  return {
    value: null,
    unit,
    source: "unavailable",
    timestamp,
    confidence: 0,
    signalQuality: null,
    algorithm: null,
    status,
  };
}

export function validateNumericMeasurement({
  value,
  unit,
  source,
  algorithm,
  confidence,
  signalQuality,
  min,
  max,
  minimumQuality,
  status = "measured",
}: NumericMeasurementInput): Measurement<number> {
  const timestamp = new Date().toISOString();
  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    !Number.isFinite(signalQuality) ||
    signalQuality < minimumQuality
  ) {
    return unavailableMeasurement(unit, "insufficient_signal", timestamp);
  }

  return {
    value: Math.round(value),
    unit,
    source,
    timestamp,
    confidence: clamp01(confidence),
    signalQuality: clamp01(signalQuality),
    algorithm,
    status,
  };
}

export function validateScreeningMeasurement(
  measurement: ScreeningMeasurement
): ScreeningMeasurement {
  if (
    measurement.value === null ||
    !Number.isFinite(measurement.confidence) ||
    measurement.confidence < 0 ||
    measurement.confidence > 1 ||
    (measurement.signalQuality !== null &&
      (!Number.isFinite(measurement.signalQuality) ||
        measurement.signalQuality < 0 ||
        measurement.signalQuality > 1))
  ) {
    return {
      ...unavailableMeasurement<never>("screening", "insufficient_signal"),
      value: {
        classification: "INSUFFICIENT_SIGNAL",
        score: null,
      },
    };
  }
  return measurement;
}
