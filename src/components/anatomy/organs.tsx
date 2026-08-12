"use client";

// Procedural anatomical organs rendered as an energised medical hologram.
// GENERIC anatomical representations — not patient-specific imaging.
// Each organ tints to its system's triage color and can be highlighted.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SystemName, SystemState } from "@/lib/types";
import { makeHologramMaterial, makeOrganMaterial, resolveColor } from "./hologram";
import { ORGAN_BASE_COLOR, type OrganKey } from "./anatomyModelConfig";
import { riskVisual } from "./risk";

export type OrganProps = {
  // Triage state drives the RISK accent only (not the base color).
  state: SystemState;
  // True when the user has selected this system (cyan outline, not risk).
  selected: boolean;
  // Only animate at a real rate when one is provided (spec §23, §24).
  heartRate?: number;
  respiratoryRate?: number;
};

// Build (once) an organ shader material with a REALISTIC base color for the
// given organ. Risk/selection are per-frame uniforms driven via the group ref
// so we never mutate a hook return value directly (react-hooks/immutability).
function useOrganMaterial(organ: OrganKey) {
  return useMemo(() => makeOrganMaterial(ORGAN_BASE_COLOR[organ]), [organ]);
}

// Walk a group's meshes and drive their shared-organ uniforms for this frame:
// realistic base stays; uRisk grows with triage severity; uSelect is the cyan
// interaction outline, kept fully independent of risk (spec §13).
function updateOrganUniforms(
  group: THREE.Group,
  state: SystemState,
  selected: boolean,
  time: number
) {
  const rv = riskVisual(state);
  const riskTarget = rv.abnormal ? Math.min(1, rv.emissive) : 0;
  const selTarget = selected ? 1 : 0;
  group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
    if (!m || !m.uniforms || !m.uniforms.uRisk) return;
    m.uniforms.uTime.value = time;
    m.uniforms.uAccent.value.copy(rv.accent);
    m.uniforms.uRisk.value = THREE.MathUtils.lerp(
      m.uniforms.uRisk.value,
      riskTarget,
      0.08
    );
    m.uniforms.uSelect.value = THREE.MathUtils.lerp(
      m.uniforms.uSelect.value,
      selTarget,
      0.12
    );
  });
}

export function Heart({ state, selected, heartRate }: OrganProps) {
  const ref = useRef<THREE.Group>(null);
  const mat = useOrganMaterial("heart");
  useFrame((s) => {
    if (!ref.current) return;
    updateOrganUniforms(ref.current, state, selected, s.clock.elapsedTime);
    // Subtle beat ONLY when a real BPM is provided (spec §23). No fake pulse.
    if (heartRate && heartRate > 0) {
      const hz = Math.max(0.6, Math.min(3, heartRate / 60));
      const phase = (s.clock.elapsedTime * hz) % 1;
      const beat =
        Math.exp(-Math.pow((phase - 0.08) / 0.05, 2)) +
        Math.exp(-Math.pow((phase - 0.2) / 0.06, 2)) * 0.4;
      const amp = state === "RED" || state === "ORANGE" ? 0.03 : 0.02;
      ref.current.scale.setScalar(1 + amp * beat);
    } else {
      ref.current.scale.setScalar(1);
    }
  });
  return (
    <group ref={ref} position={[0.06, 0.34, 0.16]}>
      {/* ventricular mass, tapered toward the apex */}
      <mesh rotation={[0, 0, Math.PI * 0.1]} scale={[1, 1.18, 0.9]} material={mat}>
        <sphereGeometry args={[0.15, 32, 32]} />
      </mesh>
      {/* atria */}
      <mesh position={[0.075, 0.12, 0]} material={mat}>
        <sphereGeometry args={[0.08, 24, 24]} />
      </mesh>
      <mesh position={[-0.07, 0.12, 0.01]} material={mat}>
        <sphereGeometry args={[0.075, 24, 24]} />
      </mesh>
      {/* aortic arch */}
      <mesh position={[0.02, 0.2, 0]} rotation={[0, 0, 0.5]} material={mat}>
        <torusGeometry args={[0.06, 0.022, 12, 24, Math.PI]} />
      </mesh>
    </group>
  );
}

export function Lungs({ state, selected, respiratoryRate }: OrganProps) {
  const ref = useRef<THREE.Group>(null);
  const mat = useOrganMaterial("lungs");
  useFrame((s) => {
    if (!ref.current) return;
    updateOrganUniforms(ref.current, state, selected, s.clock.elapsedTime);
    // Subtle breathing ONLY when a real respiratory rate exists (spec §24).
    if (respiratoryRate && respiratoryRate > 0) {
      const hz = Math.max(0.15, Math.min(0.7, respiratoryRate / 60));
      const breath =
        1 + 0.025 * (0.5 - 0.5 * Math.cos(s.clock.elapsedTime * hz * Math.PI * 2));
      ref.current.scale.set(breath, 1, breath);
    } else {
      ref.current.scale.set(1, 1, 1);
    }
  });
  // A tapered lobe (broad base, narrow apex) mirrored per side.
  const lobe = (x: number, s: number) => (
    <mesh
      position={[x, 0.4, 0.04]}
      rotation={[0, 0, x > 0 ? -0.12 : 0.12]}
      scale={[0.78 * s, 1.35, 0.78]}
      material={mat}
    >
      <sphereGeometry args={[0.2, 28, 28]} />
    </mesh>
  );
  return (
    <group ref={ref}>
      {lobe(-0.23, 1)}
      {lobe(0.23, 0.94)}
      {/* trachea + primary bronchi */}
      <mesh position={[0, 0.62, 0.04]} material={mat}>
        <cylinderGeometry args={[0.028, 0.028, 0.16, 12]} />
      </mesh>
      <mesh position={[-0.1, 0.5, 0.04]} rotation={[0, 0, 0.6]} material={mat}>
        <cylinderGeometry args={[0.02, 0.02, 0.16, 10]} />
      </mesh>
      <mesh position={[0.1, 0.5, 0.04]} rotation={[0, 0, -0.6]} material={mat}>
        <cylinderGeometry args={[0.02, 0.02, 0.16, 10]} />
      </mesh>
    </group>
  );
}

export function Brain({
  state,
  selected,
  centered = false,
}: OrganProps & { centered?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const mat = useOrganMaterial("brain");
  useFrame((s) => {
    if (ref.current)
      updateOrganUniforms(ref.current, state, selected, s.clock.elapsedTime);
  });
  // Displace an icosphere with layered noise to suggest gyri/sulci folds.
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.25, 5);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = v.clone().normalize();
      const fold =
        Math.sin(n.x * 22) * Math.sin(n.y * 20) * Math.sin(n.z * 24) * 0.02 +
        Math.sin(n.x * 40 + n.z * 30) * 0.008;
      v.addScaledVector(n, fold);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group
      ref={ref}
      position={centered ? [0, 0, 0] : [0, 1.28, 0.03]}
      scale={[1.15, 1, 1.05]}
    >
      <mesh geometry={geo} material={mat} />
    </group>
  );
}

export function Kidneys({ state, selected }: { state: SystemState; selected: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const mat = useOrganMaterial("kidneys");
  useFrame((frame) => { if (ref.current) updateOrganUniforms(ref.current, state, selected, frame.clock.elapsedTime); });
  return <group ref={ref} position={[0, 0.02, 0.08]}>{[-0.16, 0.16].map((x) => <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, x < 0 ? -0.25 : 0.25]} scale={[0.72, 1.08, 0.55]} material={mat}><sphereGeometry args={[0.1, 24, 24]} /></mesh>)}</group>;
}

export function Liver({ state, selected }: { state: SystemState; selected: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const mat = useOrganMaterial("liver");
  useFrame((frame) => { if (ref.current) updateOrganUniforms(ref.current, state, selected, frame.clock.elapsedTime); });
  return <group ref={ref} position={[-0.08, 0.2, 0.08]}><mesh rotation={[0.15, 0, -0.08]} scale={[1.45, 0.58, 0.7]} material={mat}><sphereGeometry args={[0.16, 28, 20]} /></mesh></group>;
}

// Anatomically-proportioned holographic body shell so organs read through it.
// One shared shader material (Fresnel rim + travelling scan band).
export function BodyShell() {
  const ref = useRef<THREE.Group>(null);
  const mat = useMemo(
    () => makeHologramMaterial(resolveColor("var(--accent)")),
    []
  );
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    // Scan band sweeps bottom→top on a loop over the body height (~ -0.9..1.6).
    const scanY = -0.9 + ((state.clock.elapsedTime * 0.4) % 1) * 2.6;
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (!m || !m.uniforms || !m.uniforms.uScanY) return;
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uScanY.value = scanY;
    });
  });
  // Limb helper: tapered capsule.
  const limb = (
    pos: [number, number, number],
    rot: [number, number, number],
    r: number,
    len: number
  ) => (
    <mesh position={pos} rotation={rot} material={mat}>
      <capsuleGeometry args={[r, len, 10, 20]} />
    </mesh>
  );
  return (
    <group ref={ref}>
      {/* head + neck */}
      <mesh position={[0, 1.28, 0]} scale={[0.82, 1, 0.9]} material={mat}>
        <sphereGeometry args={[0.28, 40, 40]} />
      </mesh>
      <mesh position={[0, 0.98, 0]} material={mat}>
        <cylinderGeometry args={[0.09, 0.12, 0.22, 20]} />
      </mesh>
      {/* thorax (broad shoulders) + abdomen (narrower) */}
      <mesh position={[0, 0.55, 0]} scale={[0.66, 1, 0.42]} material={mat}>
        <capsuleGeometry args={[0.42, 0.4, 12, 28]} />
      </mesh>
      <mesh position={[0, 0.08, 0]} scale={[0.52, 1, 0.38]} material={mat}>
        <capsuleGeometry args={[0.38, 0.42, 12, 28]} />
      </mesh>
      {/* pelvis */}
      <mesh position={[0, -0.32, 0]} scale={[0.58, 0.6, 0.44]} material={mat}>
        <sphereGeometry args={[0.32, 28, 28]} />
      </mesh>
      {/* shoulders */}
      <mesh position={[-0.42, 0.72, 0]} material={mat}>
        <sphereGeometry args={[0.11, 20, 20]} />
      </mesh>
      <mesh position={[0.42, 0.72, 0]} material={mat}>
        <sphereGeometry args={[0.11, 20, 20]} />
      </mesh>
      {/* arms */}
      {limb([-0.5, 0.4, 0], [0, 0, 0.16], 0.075, 0.62)}
      {limb([0.5, 0.4, 0], [0, 0, -0.16], 0.075, 0.62)}
      {/* legs */}
      {limb([-0.17, -0.78, 0], [0, 0, 0.03], 0.1, 0.66)}
      {limb([0.17, -0.78, 0], [0, 0, -0.03], 0.1, 0.66)}
    </group>
  );
}

export const ORGAN_SYSTEM: Record<SystemName, "heart" | "lungs" | "brain"> = {
  cardiovascular: "heart",
  respiratory: "lungs",
  neurological: "brain",
};
