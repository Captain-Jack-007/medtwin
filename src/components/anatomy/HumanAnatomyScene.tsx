"use client";

// HumanAnatomyScene — R3F scene rendering a GENERIC anatomical visualization
// (translucent body shell + heart/lungs/brain) with per-system triage
// highlighting and smooth camera focus. Not patient-specific imaging.
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { SystemName, SystemState } from "@/lib/types";
import { resolveColor } from "./hologram";
import { AnatomicalGLBViewer } from "./AnatomicalGLBViewer";
import { AnatomyDebug } from "./AnatomyDebug";
import type { OrganSystem, RiskLevel } from "@/lib/pharma/types";

export type FocusTarget = "body" | "fullBody" | SystemName | "renal" | "hepatic";

// Visual layers the user can toggle (spec §6, §27). SKELETON is optional/P1.
export type AnatomyLayers = { body: boolean; organs: boolean; skeleton: boolean };
export const DEFAULT_LAYERS: AnatomyLayers = {
  body: true,
  organs: true,
  skeleton: false,
};

// Camera presets in scene space. The normalized model spans y≈-0.95..1.65;
// chest center ≈ y1.0, cranial vault ≈ y1.5. CLINICAL (the default "body" view,
// spec §14–§16) frames head→upper-legs with the chest as the visual center on a
// gentle 3/4 angle — not the whole body with empty space. Organ presets move in
// close to the relevant cavity (spec §17) without clipping into geometry.
const FOCUS_POS: Record<FocusTarget, [number, number, number]> = {
  body: [0.72, 1.16, 1.65], // CLINICAL: head-to-upper-thigh, chest-centered
  fullBody: [0.9, 0.56, 2.25],
  cardiovascular: [0.55, 1.0, 1.15],
  respiratory: [0.5, 1.05, 1.25],
  neurological: [0.45, 1.55, 1.1],
  renal: [0.5, 0.22, 1.05],
  hepatic: [0.5, 0.34, 1.05],
};
const FOCUS_LOOK: Record<FocusTarget, [number, number, number]> = {
  body: [0, 1.02, 0], // chest center
  fullBody: [0, 0.34, 0],
  cardiovascular: [-0.02, 0.98, 0.02],
  respiratory: [0, 1.05, 0],
  neurological: [0, 1.52, 0],
  renal: [0, 0.02, 0],
  hepatic: [-0.08, 0.2, 0],
};

// AnatomyCameraController — smooth, damped cinematic transitions between the
// FULL BODY / HEART / LUNGS / BRAIN presets (spec §10, §11). Never teleports.
// `intro` starts the camera slightly farther for the opening approach (§26).
function AnatomyCameraController({
  focus,
  presentation = false,
}: {
  focus: FocusTarget;
  presentation?: boolean;
}) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(...FOCUS_LOOK.body));
  const damp = presentation ? 0.04 : 0.06; // slower = more cinematic in wow mode
  useFrame(() => {
    const p = FOCUS_POS[focus];
    const l = FOCUS_LOOK[focus];
    camera.position.lerp(new THREE.Vector3(p[0], p[1], p[2]), damp);
    target.current.lerp(new THREE.Vector3(l[0], l[1], l[2]), damp);
    camera.lookAt(target.current);
  });
  return null;
}

// Floating data particles drifting upward through the hologram column.
function ParticleField({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 90; // restrained; must not compete with anatomy (spec §30)
  const { geometry, material } = useMemo(() => {
    // Deterministic scatter (pure): a small hash keeps render idempotent.
    const rand = (n: number) => {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const r = 0.5 + rand(i + 1) * 0.9;
      const a = rand(i + 97) * Math.PI * 2;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = -1.2 + rand(i + 193) * 3.0;
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const m = new THREE.PointsMaterial({
      color: new THREE.Color(resolveColor(color)),
      size: 0.012,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, [color]);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      let y = pos.getY(i) + delta * 0.12;
      if (y > 1.8) y = -1.2;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    ref.current.rotation.y += delta * 0.03;
  });
  return <points ref={ref} geometry={geometry} material={material} />;
}

// Glowing base ring / platform the twin stands on (feet ≈ y-0.95).
function BaseGlow({ color }: { color: string }) {
  const col = resolveColor(color);
  return (
    <group position={[0, -0.98, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[0.55, 0.62, 64]} />
        <meshBasicMaterial
          color={col}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <circleGeometry args={[0.62, 64]} />
        <meshBasicMaterial
          color={col}
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function PrimaryAnatomy(props: {
  states: Record<SystemName, SystemState>;
  focus: FocusTarget;
  heartRate?: number;
  respiratoryRate?: number;
  layers: AnatomyLayers;
  xray: boolean;
  pharmaOrganRisks?: Partial<Record<OrganSystem, RiskLevel>>;
}) {
  return (
    <Suspense fallback={null}>
      <AnatomicalGLBViewer
        states={props.states}
        focus={props.focus}
        heartRate={props.heartRate}
        respiratoryRate={props.respiratoryRate}
        bodyVisible={props.layers.body}
        organsVisible={props.layers.organs}
        skeletonVisible={props.layers.skeleton}
        xray={props.xray}
        pharmaOrganRisks={props.pharmaOrganRisks}
      />
      <AnatomyDebug object3d />
    </Suspense>
  );
}

function Scene({
  states,
  focus,
  heartRate,
  respiratoryRate,
  layers,
  xray,
  pharmaOrganRisks,
  presentation,
}: {
  states: Record<SystemName, SystemState>;
  focus: FocusTarget;
  heartRate?: number;
  respiratoryRate?: number;
  layers: AnatomyLayers;
  xray: boolean;
  pharmaOrganRisks?: Partial<Record<OrganSystem, RiskLevel>>;
  presentation: boolean;
}) {
  const accent = "var(--accent)";
  return (
    <>
      {/* Premium medical lighting: soft key + fill + cyan rim (spec §18). */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={1.0} />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#5ec8ff" />
      <pointLight position={[0, 0.4, 1.4]} intensity={0.7} color="#7fdcff" distance={6} />
      <AnatomyCameraController focus={focus} presentation={presentation} />
      <AutoRotate active={focus === "body" || focus === "fullBody"}>
        <BaseGlow color={accent} />
        <ParticleField color={accent} />
        <group scale={presentation ? 1.12 : 1}>
          <PrimaryAnatomy
            states={states}
            focus={focus}
            heartRate={heartRate}
            respiratoryRate={respiratoryRate}
            layers={layers}
            xray={xray}
            pharmaOrganRisks={pharmaOrganRisks}
          />
        </group>
      </AutoRotate>
      {/* Restrained elliptical contact shadow at the feet — floating clinical
          look (§20). Feet sit near y≈-0.95 after normalization. */}
      <ContactShadows
        position={[0, -0.98, 0]}
        scale={2.4}
        blur={2.8}
        opacity={0.3}
        far={2}
        color="#000000"
      />
      <OrbitControls
        enablePan={false}
        minDistance={0.8}
        maxDistance={5.5}
        target={[0, 1.02, 0]}
        makeDefault
      />
    </>
  );
}

// Slow idle spin when the whole body is in view; stops when an organ is focused
// so the user can inspect it. Respects manual OrbitControls drag naturally
// because we only nudge rotation.y a tiny amount per frame.
function AutoRotate({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current && active) ref.current.rotation.y += delta * 0.06;
  });
  return <group ref={ref}>{children}</group>;
}

export function HumanAnatomyScene({
  states,
  focus = "body",
  heartRate,
  respiratoryRate,
  layers = DEFAULT_LAYERS,
  xray = false,
  presentation = false,
  pharmaOrganRisks,
}: {
  states: Record<SystemName, SystemState>;
  focus?: FocusTarget;
  heartRate?: number;
  respiratoryRate?: number;
  layers?: AnatomyLayers;
  xray?: boolean;
  presentation?: boolean;
  pharmaOrganRisks?: Partial<Record<OrganSystem, RiskLevel>>;
}) {
  // Cap DPR for perf on projectors / retina displays (spec §45).
  const dpr =
    typeof window !== "undefined"
      ? Math.min(window.devicePixelRatio || 1, 1.75)
      : 1;
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: FOCUS_POS.body, fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <Scene
        states={states}
        focus={focus}
        heartRate={heartRate}
        respiratoryRate={respiratoryRate}
        layers={layers}
        xray={xray}
        presentation={presentation}
        pharmaOrganRisks={pharmaOrganRisks}
      />
    </Canvas>
  );
}
