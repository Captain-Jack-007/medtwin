// Phase-1 audit WITHOUT decoding geometry: parse the GLB container's JSON chunk
// directly. This yields every node/mesh/material name, the node hierarchy, node
// TRS, and per-primitive POSITION accessor min/max (an axis-aligned bbox in the
// mesh's own space). No DRACO decode needed — names + accessor bounds are in the
// uncompressed JSON. Classifies against the app's mesh map.
//
// Usage: node scripts/inspect-glb-json.mjs [path-to-glb]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const glbPath = resolve(
  __dirname,
  "..",
  process.argv[2] ?? "public/models/medtwin-anatomy.glb"
);

const buf = readFileSync(glbPath);
// GLB header: magic(4) version(4) length(4), then chunks: len(4) type(4) data.
const magic = buf.readUInt32LE(0);
if (magic !== 0x46546c67) throw new Error("not a GLB");
let off = 12;
let json = null;
while (off < buf.length) {
  const clen = buf.readUInt32LE(off);
  const ctype = buf.readUInt32LE(off + 4);
  const cdata = buf.subarray(off + 8, off + 8 + clen);
  if (ctype === 0x4e4f534a) json = JSON.parse(cdata.toString("utf8")); // JSON
  off += 8 + clen;
}
if (!json) throw new Error("no JSON chunk");

const PATTERNS = {
  heart: ["heart", "cardiac", "cor", "myocard", "aorta", "ventricle", "atrium", "coeur"],
  lungs: ["lung", "pulmon", "bronch", "trachea", "respirat", "alveol", "poumon"],
  brain: ["brain", "cerebr", "cortex", "encephal", "cerebell", "cerveau", "gyrus"],
  skull: ["skull", "cranium", "cranial", "mandible", "maxilla", "crâne", "occipital", "frontal_bone", "parietal", "temporal"],
  head: ["head", "tete", "tête"],
  skeleton: ["bone", "skelet", "rib", "vertebra", "spine", "femur", "pelvis", "sternum", "clavicle", "scapula", "humerus", "os_", "phalange", "tibia", "fibula", "carpal"],
  muscle: ["muscle", "muscul", "biceps", "triceps", "deltoid", "pectoral", "gluteus", "trapezius"],
  body: ["body", "skin", "shell", "torso", "figure", "human", "surface", "peau"],
};
function classify(name) {
  const n = (name || "").toLowerCase();
  for (const [k, pats] of Object.entries(PATTERNS))
    if (pats.some((p) => n.includes(p))) return k;
  return "(unmapped)";
}

const meshes = json.meshes || [];
const accessors = json.accessors || [];
const materials = json.materials || [];
const nodes = json.nodes || [];

// Build node->parent + node world-ish translation (compose TRS chain).
const parentOf = new Array(nodes.length).fill(-1);
nodes.forEach((n, i) => (n.children || []).forEach((c) => (parentOf[c] = i)));
function worldTranslation(i) {
  let t = [0, 0, 0];
  let cur = i;
  while (cur >= 0) {
    const n = nodes[cur];
    const tr = n.translation || [0, 0, 0];
    t = [t[0] + tr[0], t[1] + tr[1], t[2] + tr[2]];
    cur = parentOf[cur];
  }
  return t;
}
// Which node references which mesh (for names + world pos).
const nodeForMesh = new Array(meshes.length).fill(-1);
nodes.forEach((n, i) => {
  if (typeof n.mesh === "number" && nodeForMesh[n.mesh] === -1) nodeForMesh[n.mesh] = i;
});

const counts = {};
const rows = [];
meshes.forEach((m, mi) => {
  const ni = nodeForMesh[mi];
  const nodeName = ni >= 0 ? nodes[ni].name : "";
  const name = m.name || nodeName || `(mesh ${mi})`;
  const wt = ni >= 0 ? worldTranslation(ni) : [0, 0, 0];
  // Union POSITION accessor bounds across primitives.
  let mn = [Infinity, Infinity, Infinity];
  let mx = [-Infinity, -Infinity, -Infinity];
  let matName = "";
  (m.primitives || []).forEach((p) => {
    if (typeof p.material === "number") matName = materials[p.material]?.name || matName;
    const pa = p.attributes?.POSITION;
    const acc = typeof pa === "number" ? accessors[pa] : null;
    if (acc?.min && acc?.max) {
      for (let k = 0; k < 3; k++) {
        mn[k] = Math.min(mn[k], acc.min[k]);
        mx[k] = Math.max(mx[k], acc.max[k]);
      }
    }
  });
  const hasB = isFinite(mn[0]);
  const size = hasB ? [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]] : [0, 0, 0];
  const ctr = hasB ? [(mx[0] + mn[0]) / 2, (mx[1] + mn[1]) / 2, (mx[2] + mn[2]) / 2] : [0, 0, 0];
  const cls = classify(name) === "(unmapped)" ? classify(nodeName) : classify(name);
  counts[cls] = (counts[cls] || 0) + 1;
  rows.push({ name, cls, matName, wt, size, ctr, mn, mx });
});

// Global bounds from world translation + local center (approx).
let gmn = [Infinity, Infinity, Infinity];
let gmx = [-Infinity, -Infinity, -Infinity];
rows.forEach((r) => {
  for (let k = 0; k < 3; k++) {
    gmn[k] = Math.min(gmn[k], r.wt[k] + r.mn[k]);
    gmx[k] = Math.max(gmx[k], r.wt[k] + r.mx[k]);
  }
});
console.log("=== SCENE SUMMARY ===");
console.log("meshes:", meshes.length, "| materials:", materials.length, "| nodes:", nodes.length);
console.log("approx world size:", gmx.map((v, k) => (v - gmn[k]).toFixed(2)).join(" x "));
console.log("approx world min:", gmn.map((v) => v.toFixed(2)).join(","), " max:", gmx.map((v) => v.toFixed(2)).join(","));
console.log("class counts:", JSON.stringify(counts));
console.log("\n=== CANDIDATE ORGAN/HEAD MESHES ===");
rows
  .filter((r) => ["heart", "lungs", "brain", "skull", "head"].includes(r.cls))
  .forEach((r) =>
    console.log(
      `[${r.cls}] ${r.name} | wt=${r.wt.map((v) => v.toFixed(2)).join(",")} | size=${r.size.map((v) => v.toFixed(2)).join("x")} | ctr=${r.ctr.map((v) => v.toFixed(2)).join(",")} | mat=${r.matName}`
    )
  );
console.log("\n=== ALL MESH NAMES ===");
rows.forEach((r) =>
  console.log(`${r.cls.padEnd(10)} ${r.name} | size=${r.size.map((v) => v.toFixed(2)).join("x")} | wt=${r.wt.map((v) => v.toFixed(2)).join(",")}`)
);
