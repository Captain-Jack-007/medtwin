// anatomyModelConfig — single source of truth for the anatomical 3D asset.
//
// The code must NOT be coupled to one specific downloaded model (spec §49–§51).
// Swap the path(s) here (or split into per-organ GLBs) to replace the model
// without touching risk logic, camera, or animation code.
//
// LICENSING: no model is bundled by default. Drop an appropriately-licensed
// GLB at `public/models/medtwin-anatomy.glb` (see docs/ASSETS.md). Until then
// the app renders the procedural hologram fallback — never a blank card.

import type { SystemName } from "@/lib/types";

// A single combined model is preferred; per-organ GLBs are an optional path
// (spec §48) if only separate open organ meshes are available.
export type AnatomyModelConfig = {
  // Combined model containing body shell + organs as separately-named meshes.
  fullModel: string;
  // Optional per-part models (used only if fullModel is absent/unset).
  parts?: {
    body?: string;
    heart?: string;
    lungs?: string;
    brain?: string;
  };
  // Whether the GLB is Draco-compressed (bundle decoder locally, no CDN).
  draco?: boolean;
  // Local Draco decoder directory (served from /public) when draco === true.
  dracoDecoderPath?: string;
  // Set false when the model has NO discrete organ meshes (e.g. a skeleton /
  // musculature model). The viewer then overlays procedural heart/lungs/brain
  // positioned anatomically inside the imported body so triage still works.
  hasOrgans?: boolean;
  // Mesh-name substrings whose UNION world bounding boxes define anatomical
  // cavities. The viewer computes these boxes from the REAL imported geometry
  // at load time (spec §5, §6, §7, §20, §21) and seats each procedural organ
  // inside its cavity — so nothing is hard-coded to one model or viewport.
  // If a group matches no meshes, the viewer falls back to `organAnchorsRaw`.
  cavityGroups?: {
    brain: string[]; // cranial vault bones → brain sits inside
    thorax: string[]; // rib cage → lungs fill it
    sternum: string[]; // sternum → heart sits just behind, slightly left
  };
  // Fallback organ centers in RAW model space (metres, Y-up, pre-normalization)
  // used only when a cavity group matches nothing. Derived from the audit.
  organAnchorsRaw?: {
    heart: [number, number, number];
    lungs: [number, number, number];
    brain: [number, number, number];
  };
};

// Active asset: Z-Anatomy skeleton + musculature (CC BY-SA 4.0), Draco-
// compressed, ~1.7 m, Y-up. It contains bones/muscles but NO viscera, so we
// treat the whole import as the body/skeleton and overlay procedural organs
// seated inside cavities computed from the real bone geometry (see audit in
// scripts/anatomy-anchors.mjs).
export const ANATOMY_MODEL: AnatomyModelConfig = {
  fullModel: "/models/medtwin-anatomy.glb",
  draco: true,
  dracoDecoderPath: "/draco/",
  hasOrgans: false,
  cavityGroups: {
    brain: [
      "parietal bone",
      "occipital bone",
      "frontal bone",
      "temporal bone",
      "sphenoid",
    ],
    thorax: ["rib"],
    sternum: ["sternum", "manubrium", "xiphoid"],
  },
  // Fallback centers in raw model space (from the audit): cranial vault, rib
  // cage, and just behind the sternum (slightly left of midline).
  organAnchorsRaw: {
    heart: [-0.03, 1.28, 0.03],
    lungs: [0, 1.25, 0.0],
    brain: [0, 1.63, -0.01],
  },
};

// System → organ key. Keeps triage systems decoupled from mesh names.
export const SYSTEM_TO_ORGAN: Record<SystemName, OrganKey> = {
  cardiovascular: "heart",
  respiratory: "lungs",
  neurological: "brain",
};

export type OrganKey = "heart" | "lungs" | "brain" | "kidneys" | "liver";
export type PartKey = "heart" | "lungs" | "brain" | "body";

// ANATOMY_MESH_MAP — candidate mesh-name substrings per part. When a GLB is
// loaded we walk its scene graph and classify each mesh by matching its
// (lower-cased) name against these patterns. This is the "AnatomyAssetAdapter"
// abstraction: different models name meshes differently, so we match loosely.
export const ANATOMY_MESH_MAP: Record<PartKey, string[]> = {
  heart: ["heart", "cardiac", "cor", "myocard", "aorta", "ventricle", "atrium"],
  lungs: ["lung", "pulmon", "bronch", "trachea", "respirat"],
  brain: ["brain", "cerebr", "cortex", "encephal", "neural", "cerebell"],
  body: [
    "body",
    "skin",
    "shell",
    "torso",
    "figure",
    "human",
    "outer",
    "surface",
    "mannequin",
  ],
};

// Classify a mesh name into a part, or null if it matches nothing known.
// Organs win over body so an "organs_body_group" style name doesn't hide them.
export function classifyMesh(name: string): PartKey | null {
  const n = (name || "").toLowerCase();
  const order: PartKey[] = ["heart", "lungs", "brain", "body"];
  for (const key of order) {
    if (ANATOMY_MESH_MAP[key].some((pat) => n.includes(pat))) return key;
  }
  return null;
}

// Realistic anatomical base colors (spec §41) used to gently correct imported
// materials toward clinical coloration. These are BASE colors, not risk colors.
export const ORGAN_BASE_COLOR: Record<OrganKey, string> = {
  heart: "#8a2626", // deep, dark red
  lungs: "#b07079", // muted pink / dark rose
  brain: "#b8a7a0", // warm gray with a faint pink cast
  kidneys: "#8f4b45",
  liver: "#8a4f35",
};
