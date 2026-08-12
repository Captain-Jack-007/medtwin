'use client';

// AnatomicalGLBViewer — renders a locally-loaded GLB/GLTF anatomical model as
// the PRIMARY Digital Twin visualization (spec §1, §30, §56). Three.js is only
// the renderer; anatomical quality comes from the asset. This component:
//   • loads the GLB via useGLTF() (Suspense-suspends while streaming),
//   • classifies meshes into body / heart / lungs / brain via the mesh map,
//   • applies a translucent x-ray body shell + realistic organ materials,
//   • drives heart pulse, lung breathing, brain emissive, and risk highlighting
//     by mutating emissive / emissiveIntensity / opacity only (spec §17).
// GENERIC anatomy — not patient-specific imaging.
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { SystemName, SystemState } from '@/lib/types';
import { ANATOMY_MODEL } from './anatomyModelConfig';
import { shellOpacity } from './risk';
import { Brain, Heart, Kidneys, Liver, Lungs } from './organs';
import type { FocusTarget } from './HumanAnatomyScene';
import type { OrganSystem, RiskLevel } from '@/lib/pharma/types';

// A cavity is a union bounding box (in the SCENE coordinate space, after the
// model has been normalized) that a procedural organ is seated inside.
type Cavity = { center: THREE.Vector3; size: THREE.Vector3 };
type Cavities = {
  brain: Cavity | null;
  thorax: Cavity | null;
  sternum: Cavity | null;
};

// Draco decoder path (local /public, never a CDN so it works offline — spec).
const DRACO_ARG: string | boolean = ANATOMY_MODEL.draco
  ? ANATOMY_MODEL.dracoDecoderPath ?? '/draco/'
  : false;

// Preload so the twin appears fast after a scan (spec §33). Safe if missing:
// the resulting fetch error is surfaced only when a consumer actually renders
// the component under Suspense, where the fallback chain catches it.
useGLTF.preload(ANATOMY_MODEL.fullModel, DRACO_ARG);

export function AnatomicalGLBViewer({
  states,
  focus,
  heartRate,
  respiratoryRate,
  bodyVisible = true,
  organsVisible = true,
  skeletonVisible = false,
  xray = false,
  pharmaOrganRisks,
}: {
  states: Record<SystemName, SystemState>;
  focus: FocusTarget;
  heartRate?: number;
  respiratoryRate?: number;
  bodyVisible?: boolean;
  organsVisible?: boolean;
  skeletonVisible?: boolean;
  xray?: boolean;
  pharmaOrganRisks?: Partial<Record<OrganSystem, RiskLevel>>;
}) {
  const gltf = useGLTF(ANATOMY_MODEL.fullModel, DRACO_ARG);
  const root = useRef<THREE.Group>(null);
  // This model is bone + muscle only (audited: 826 meshes, no viscera). We
  // treat the whole import as the anatomical "shell" and overlay procedural
  // heart/lungs/brain seated inside cavities computed from the REAL geometry.
  const overlayOrgans = ANATOMY_MODEL.hasOrgans === false;

  // Clone once so multiple mounts / HMR don't mutate the cached scene.
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  // Split the shell into "bone" vs "muscle/soft" by material name so the
  // SKELETON layer can show bones only while BODY mode shows the soft shell.
  useMemo(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      const first = Array.isArray(src) ? src[0] : src;
      const matName = (first?.name || '').toLowerCase();
      const isBone = matName.includes('bone');
      mesh.userData.part = 'body';
      mesh.userData.tissue = isBone ? 'bone' : 'soft';
      const mat = first?.clone?.() as THREE.MeshStandardMaterial | undefined;
      if (!mat) return;
      // Premium translucent clinical shell (spec §8, §18, §19): cool neutral
      // gray, low opacity, no depth write so organs read straight through.
      mat.transparent = true;
      mat.depthWrite = false;
      mat.side = THREE.FrontSide;
      mat.color = new THREE.Color(isBone ? '#d7dee6' : '#aebccb');
      mat.emissive = new THREE.Color(isBone ? '#0e1b26' : '#0b1622');
      mat.emissiveIntensity = 0.12;
      mat.roughness = 0.6;
      mat.metalness = 0.0;
      mat.opacity = 0.22;
      mesh.material = mat;
      mesh.renderOrder = 2; // draw shell after organs to sort transparency
    });
    return scene;
  }, [scene]);

  // Normalize the model into scene space (spec §20, §21): compute Box3, scale
  // to a target height, recenter to origin, lift onto the base ring. Then
  // derive organ cavities from the REAL geometry in this same coordinate space
  // (spec §5, §6, §7) so organs are seated by anatomy, never guessed.
  const [cavities, setCavities] = useState<Cavities>({
    brain: null,
    thorax: null,
    sternum: null,
  });
  useLayoutEffect(() => {
    const g = root.current;
    if (!g) return;
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const targetHeight = 2.6;
    const s = size.y > 0.0001 ? targetHeight / size.y : 1;
    scene.scale.setScalar(s);
    scene.position.set(-center.x * s, -center.y * s + 0.35, -center.z * s);
    scene.updateMatrixWorld(true);
    // Cavities are unions of named bone meshes, measured AFTER normalization so
    // their boxes are already in scene space.
    const groups = ANATOMY_MODEL.cavityGroups;
    setCavities({
      brain: unionCavity(scene, groups?.brain ?? []),
      thorax: unionCavity(scene, groups?.thorax ?? []),
      sternum: unionCavity(scene, groups?.sternum ?? []),
    });
  }, [scene]);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    // The imported shell only ever needs visibility + opacity updates; organ
    // risk/selection is handled by the procedural overlay components.
    const anyFocus = focus !== 'body' && focus !== 'fullBody';
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.userData?.part !== 'body') return;
      const tissue = mesh.userData?.tissue as 'bone' | 'soft' | undefined;
      // Bones only show in SKELETON or X-RAY mode; soft shell is the BODY layer.
      const showBone = skeletonVisible || xray;
      mesh.visible = tissue === 'bone' ? showBone : bodyVisible && !xray;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const base = shellOpacity(false); // 0.14 soft shell target
      const target =
        tissue === 'bone'
          ? xray
            ? 0.5
            : 0.7
          : xray
          ? 0.04
          : anyFocus
          ? base * 0.7
          : base;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.12);
    });
  });

  return (
    <>
      <primitive ref={root} object={scene} />
      {overlayOrgans && organsVisible && (
        <ProceduralOrganOverlay
          states={states}
          focus={focus}
          heartRate={heartRate}
          respiratoryRate={respiratoryRate}
          cavities={cavities}
          pharmaOrganRisks={pharmaOrganRisks}
        />
      )}
    </>
  );
}

// Union the world-space bounding boxes of every mesh whose name matches any
// pattern. Returns null when nothing matches so callers can fall back.
function unionCavity(scene: THREE.Object3D, patterns: string[]): Cavity | null {
  if (!patterns.length) return null;
  const box = new THREE.Box3();
  let found = false;
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const n = (mesh.name || '').toLowerCase();
    if (!patterns.some((p) => n.includes(p))) return;
    box.expandByObject(mesh);
    found = true;
  });
  if (!found || box.isEmpty()) return null;
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  return { center, size };
}

// Natural (unscaled) size + internal center of each procedural organ, measured
// from organs.tsx geometry. Used to fit each organ into its cavity so nothing
// pokes through the skull/rib cage (spec §5, §6, §7). `offset` is the organ's
// own group translation which we cancel so the visual center lands on target.
const ORGAN_NATURAL = {
  brain: {
    size: new THREE.Vector3(0.58, 0.5, 0.53),
    offset: new THREE.Vector3(0, 0, 0),
  },
  heart: {
    size: new THREE.Vector3(0.34, 0.5, 0.3),
    offset: new THREE.Vector3(0.06, 0.46, 0.16),
  },
  lungs: {
    size: new THREE.Vector3(0.7, 0.6, 0.34),
    offset: new THREE.Vector3(0, 0.42, 0.04),
  },
  kidneys: {
    size: new THREE.Vector3(0.4, 0.24, 0.16),
    offset: new THREE.Vector3(0, 0.02, 0.08),
  },
  liver: {
    size: new THREE.Vector3(0.46, 0.2, 0.24),
    offset: new THREE.Vector3(-0.08, 0.2, 0.08),
  },
} as const;

// Fallback centers (raw model space) converted lazily if a cavity is missing.
// The viewer computes cavities from real bone geometry, so these are rarely hit.
const RAW = ANATOMY_MODEL.organAnchorsRaw;

// Fit an organ into a cavity: choose a scale so the organ fills a fraction of
// the cavity's smallest span (keeps it comfortably inside), and return the
// group position that cancels the organ's internal offset at that scale.
function seat(
  organ: keyof typeof ORGAN_NATURAL,
  cavity: Cavity | null,
  fill: number,
  drop = 0
): { position: [number, number, number]; scale: number } {
  const nat = ORGAN_NATURAL[organ];
  if (!cavity) {
    const raw =
      organ === 'kidneys'
        ? ([0, 0.55, 0] as const)
        : organ === 'liver'
        ? ([-0.08, 0.68, 0] as const)
        : RAW?.[organ] ?? [0, 0.9, 0];
    return { position: [raw[0], raw[1], raw[2]], scale: 0.4 };
  }
  // Scale each axis so the organ would fit the cavity, then take the min so it
  // fits on every axis; `fill` leaves clearance inside the bony cavity.
  const sx = cavity.size.x / nat.size.x;
  const sy = cavity.size.y / nat.size.y;
  const sz = cavity.size.z / nat.size.z;
  const scale = Math.min(sx, sy, sz) * fill;
  return {
    position: [
      cavity.center.x - nat.offset.x * scale,
      cavity.center.y - nat.offset.y * scale - drop,
      cavity.center.z - nat.offset.z * scale,
    ],
    scale,
  };
}

// ProceduralOrganOverlay — heart/lungs/brain seated inside cavities computed
// from the imported skeleton. Reuses the organ components (realistic base color
// + risk accent + subtle animation). Selection is passed as the cyan outline
// flag, independent of triage risk (spec §13).
function ProceduralOrganOverlay({
  states,
  focus,
  heartRate,
  respiratoryRate,
  cavities,
  pharmaOrganRisks,
}: {
  states: Record<SystemName, SystemState>;
  focus: FocusTarget;
  heartRate?: number;
  respiratoryRate?: number;
  cavities: Cavities;
  pharmaOrganRisks?: Partial<Record<OrganSystem, RiskLevel>>;
}) {
  const sel = (s: SystemName) => focus === s;
  // Brain fills most of the cranial vault; lungs fill the rib cage; the heart
  // is smaller and sits behind the sternum, nudged slightly left of midline.
  const brain = seat('brain', cavities.brain, 0.72, -0.11);
  const lungs = seat('lungs', cavities.thorax, 0.82);
  const heartCavity =
    cavities.sternum ?? cavities.thorax
      ? {
          // Heart center: behind the sternum, lower-third of the thorax, left.
          center: new THREE.Vector3(
            (cavities.thorax?.center.x ?? 0) -
              0.03 * (cavities.thorax?.size.x ?? 0.3),
            (cavities.thorax?.center.y ?? 0.95) -
              0.12 * (cavities.thorax?.size.y ?? 0.6),
            (cavities.sternum?.center.z ?? cavities.thorax?.center.z ?? 0) -
              0.05
          ),
          size: new THREE.Vector3(
            (cavities.thorax?.size.x ?? 0.3) * 0.45,
            (cavities.thorax?.size.y ?? 0.6) * 0.5,
            (cavities.thorax?.size.z ?? 0.25) * 0.6
          ),
        }
      : null;
  const heart = seat('heart', heartCavity, 0.95);
  const abdominalCavity = cavities.thorax
    ? {
        center: new THREE.Vector3(
          cavities.thorax.center.x,
          cavities.thorax.center.y - cavities.thorax.size.y * 0.72,
          cavities.thorax.center.z
        ),
        size: new THREE.Vector3(
          cavities.thorax.size.x * 0.72,
          cavities.thorax.size.y * 0.46,
          cavities.thorax.size.z * 0.8
        ),
      }
    : null;
  const kidneys = seat('kidneys', abdominalCavity, 0.68);
  const liver = seat('liver', abdominalCavity, 0.8, -0.05);
  return (
    <>
      <group position={heart.position} scale={heart.scale}>
        <Heart
          state={pharmaOrganRisks?.cardiovascular ? riskToState(pharmaOrganRisks.cardiovascular) : states.cardiovascular}
          selected={sel('cardiovascular')}
          heartRate={heartRate}
        />
      </group>
      <group position={lungs.position} scale={lungs.scale}>
        <Lungs
          state={states.respiratory}
          selected={sel('respiratory')}
          respiratoryRate={respiratoryRate}
        />
      </group>
      <group position={brain.position} scale={brain.scale}>
        <Brain
          state={states.neurological}
          selected={sel('neurological')}
          centered
        />
      </group>
      <group position={kidneys.position} scale={kidneys.scale}>
        <Kidneys state={pharmaOrganRisks?.renal ? riskToState(pharmaOrganRisks.renal) : "GREEN"} selected={focus === 'renal'} />
      </group>
      <group position={liver.position} scale={liver.scale}>
        <Liver state={pharmaOrganRisks?.hepatic ? riskToState(pharmaOrganRisks.hepatic) : "GREEN"} selected={focus === 'hepatic'} />
      </group>
    </>
  );
}

function riskToState(risk: RiskLevel): SystemState {
  const states: Record<RiskLevel, SystemState> = { LOW: 'GREEN', MODERATE: 'YELLOW', HIGH: 'ORANGE', CRITICAL: 'RED' };
  return states[risk];
}
