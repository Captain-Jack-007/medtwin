// Phase-1 audit (spec §1, §21): load the GLB with DRACO and print, for every
// mesh, its name, parent, world position, bounding box, bounding sphere, scale,
// and material. Also classify against the app's mesh map and flag candidate
// brain / heart / lung / body / skeleton meshes. Node-only; no browser.
//
// Usage: node scripts/inspect-glb.mjs [path-to-glb]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const glbPath = resolve(
  __dirname,
  "..",
  process.argv[2] ?? "public/models/medtwin-anatomy.glb"
);

// Minimal DOM-ish shims GLTFLoader touches in Node.
globalThis.self = globalThis;
if (typeof globalThis.URL.createObjectURL !== "function")
  globalThis.URL.createObjectURL = () => "blob:stub";

// Let three's FileLoader read file:// URLs by shimming fetch for them.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const s = String(url);
  if (s.startsWith("file://")) {
    const p = fileURLToPath(s);
    const data = readFileSync(p);
    return new Response(data, { status: 200, headers: { "content-type": "application/octet-stream" } });
  }
  return realFetch(url, opts);
};

const dracoDir = resolve(__dirname, "..", "public/draco/");
const draco = new DRACOLoader();
draco.setDecoderPath("file://" + dracoDir + "/");

const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

const buf = readFileSync(glbPath);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const PATTERNS = {
  heart: ["heart", "cardiac", "cor", "myocard", "aorta", "ventricle", "atrium"],
  lungs: ["lung", "pulmon", "bronch", "trachea", "respirat", "alveol"],
  brain: ["brain", "cerebr", "cortex", "encephal", "neural", "cerebell"],
  skull: ["skull", "cranium", "cranial", "head", "mandible", "maxilla"],
  skeleton: ["bone", "skelet", "rib", "vertebra", "spine", "femur", "pelvis", "sternum", "clavicle", "scapula", "humerus"],
  muscle: ["muscle", "muscul", "biceps", "triceps", "deltoid", "pectoral"],
  body: ["body", "skin", "shell", "torso", "figure", "human", "surface"],
};
function classify(name) {
  const n = (name || "").toLowerCase();
  for (const [k, pats] of Object.entries(PATTERNS))
    if (pats.some((p) => n.includes(p))) return k;
  return "(unmapped)";
}

loader.parse(
  ab,
  "",
  (gltf) => {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);
    const rows = [];
    const counts = {};
    let meshCount = 0;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      meshCount++;
      const box = new THREE.Box3().setFromObject(o);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const sph = box.getBoundingSphere(new THREE.Sphere());
      const wp = new THREE.Vector3();
      o.getWorldPosition(wp);
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      const cls = classify(o.name) === "(unmapped)" ? classify(o.parent?.name) : classify(o.name);
      counts[cls] = (counts[cls] || 0) + 1;
      rows.push({
        name: o.name || "(unnamed)",
        parent: o.parent?.name || "(root)",
        cls,
        wpos: `${wp.x.toFixed(2)},${wp.y.toFixed(2)},${wp.z.toFixed(2)}`,
        center: `${center.x.toFixed(2)},${center.y.toFixed(2)},${center.z.toFixed(2)}`,
        size: `${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}`,
        sphR: sph.radius.toFixed(2),
        scale: `${o.scale.x.toFixed(2)},${o.scale.y.toFixed(2)},${o.scale.z.toFixed(2)}`,
        mat: mat?.name || "(unnamed)",
      });
    });
    const whole = new THREE.Box3().setFromObject(scene);
    const wsz = new THREE.Vector3();
    const wc = new THREE.Vector3();
    whole.getSize(wsz);
    whole.getCenter(wc);
    console.log("=== SCENE SUMMARY ===");
    console.log("meshes:", meshCount);
    console.log("scene size:", `${wsz.x.toFixed(2)}x${wsz.y.toFixed(2)}x${wsz.z.toFixed(2)}`);
    console.log("scene center:", `${wc.x.toFixed(2)},${wc.y.toFixed(2)},${wc.z.toFixed(2)}`);
    console.log("class counts:", JSON.stringify(counts));
    console.log("\n=== CANDIDATE ORGAN/STRUCTURE MESHES ===");
    for (const r of rows)
      if (["heart", "lungs", "brain", "skull"].includes(r.cls))
        console.log(`[${r.cls}] ${r.name} | parent=${r.parent} | wpos=${r.wpos} | size=${r.size} | sphR=${r.sphR} | mat=${r.mat}`);
    console.log("\n=== ALL MESH NAMES (first 120) ===");
    for (const r of rows.slice(0, 120))
      console.log(`${r.cls.padEnd(10)} ${r.name} | size=${r.size} | ctr=${r.center}`);
    console.log(`\n(total meshes: ${meshCount})`);
  },
  (err) => {
    console.error("PARSE ERROR:", err?.message || err);
    process.exit(1);
  }
);
