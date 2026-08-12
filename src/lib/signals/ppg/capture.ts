import { CameraFrameSample } from "@/lib/sensors/camera";

export interface PpgSample extends CameraFrameSample {
  value: number;
  coverage: number;
}

export function toPpgSample(frame: CameraFrameSample): PpgSample {
  const total = Math.max(1, frame.red + frame.green + frame.blue);
  const redDominance = frame.red / Math.max(1, frame.green + frame.blue);
  const brightnessScore = triangularScore(frame.luminance, 25, 115, 245);
  const rednessScore = clamp01((redDominance - 0.65) / 0.85);
  const clippingScore = 1 - clamp01(frame.clipping / 0.45);

  return {
    ...frame,
    value: frame.green / total,
    coverage: clamp01(
      brightnessScore * 0.35 + rednessScore * 0.45 + clippingScore * 0.2
    ),
  };
}

function triangularScore(
  value: number,
  minimum: number,
  optimum: number,
  maximum: number
): number {
  if (value <= minimum || value >= maximum) return 0;
  if (value <= optimum) return (value - minimum) / (optimum - minimum);
  return (maximum - value) / (maximum - optimum);
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
