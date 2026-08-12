"use client";

// AnatomyDebug — dev-only model inspector (spec §5). Activated with the query
// flag `?anatomyDebug=1`. Walks the loaded scene graph once and logs each
// mesh name, material name, and world-space bounding box to the console, and
// draws box helpers around classified organs. Renders nothing in normal mode.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { classifyMesh } from "./anatomyModelConfig";

export function debugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("anatomyDebug") === "1";
}

// `object3d` is a marker prop so this can sit inside the R3F tree next to the
// GLB viewer; it inspects the whole scene via the three.js scene root.
export function AnatomyDebug({ object3d }: { object3d?: boolean }) {
  const { scene } = useThree();
  useEffect(() => {
    if (!object3d || !debugEnabled()) return;
    const helpers: THREE.Box3Helper[] = [];
    // Defer a frame so the GLB has mounted into the scene graph.
    const id = requestAnimationFrame(() => {
      const rows: Array<Record<string, string>> = [];
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.Material | THREE.Material[];
        const matName = Array.isArray(mat)
          ? mat.map((m) => m.name).join(",")
          : mat?.name || "(unnamed)";
        const box = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3();
        box.getSize(size);
        const part = classifyMesh(mesh.name) ?? "(unmapped)";
        rows.push({
          mesh: mesh.name || "(unnamed)",
          material: matName,
          part,
          bbox: `${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)}`,
        });
        if (part !== "(unmapped)") {
          const helper = new THREE.Box3Helper(box, new THREE.Color("#5ec8ff"));
          scene.add(helper);
          helpers.push(helper);
        }
      });
      // Compact, CDP-serializable summary + the full table for humans.
      const whole = new THREE.Box3().setFromObject(scene);
      const wsz = new THREE.Vector3();
      whole.getSize(wsz);
      const mapped = rows.filter((r) => r.part !== "(unmapped)").length;
      console.log(
        `[anatomyDebug] meshes=${rows.length} mapped=${mapped} ` +
          `sceneBBox=${wsz.x.toFixed(2)}x${wsz.y.toFixed(2)}x${wsz.z.toFixed(2)}`
      );
      console.groupCollapsed("[anatomyDebug] scene graph");
      console.table(rows);
      console.groupEnd();
    });
    return () => {
      cancelAnimationFrame(id);
      for (const h of helpers) scene.remove(h);
    };
  }, [object3d, scene]);
  return null;
}
