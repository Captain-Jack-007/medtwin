// Risk → visual mapping for the anatomical viewer.
//
// Highlighting rule (spec §8, §40, §41): realistic organ base colors are kept;
// risk is expressed through an emissive ACCENT + intensity, never by recoloring
// the whole organ. LOW is deliberately subtle (not neon green).
import * as THREE from "three";
import type { SystemState } from "@/lib/types";

export type RiskVisual = {
  // Emissive accent color layered over the realistic base material.
  accent: THREE.Color;
  // Emissive intensity applied when the organ is NOT focused.
  emissive: number;
  // Extra emissive added when the organ IS focused (selected/cinematic).
  focusBoost: number;
  // Whether to show a persistent label for this organ (abnormal → yes).
  abnormal: boolean;
};

// Concrete accent hexes (independent of CSS vars so shaders/materials are
// deterministic on the GPU). Tuned to the spec color strategy.
const ACCENT: Record<SystemState, string> = {
  GREEN: "#39d98a", // subtle green — only a hint
  YELLOW: "#f2c14e", // amber
  ORANGE: "#f2913d", // orange
  RED: "#e5484d", // red
};

const BASE_EMISSIVE: Record<SystemState, number> = {
  GREEN: 0.06, // barely-there; realistic coloration dominates
  YELLOW: 0.35,
  ORANGE: 0.6,
  RED: 0.9,
};

export function riskVisual(state: SystemState): RiskVisual {
  return {
    accent: new THREE.Color(ACCENT[state]),
    emissive: BASE_EMISSIVE[state],
    focusBoost: state === "GREEN" ? 0.25 : 0.6,
    abnormal: state !== "GREEN",
  };
}

// Body-shell x-ray opacity target given whether any organ is focused.
// A focused organ nudges the shell more transparent so the organ reads clearly.
export function shellOpacity(focused: boolean): number {
  return focused ? 0.06 : 0.14;
}
