// Compute anatomical anchor boxes from the GLB JSON so procedural organs can be
// seated using REAL model geometry (spec §5, §6, §7, §20, §21) instead of
// guessed coordinates. Prints union bounding boxes (in raw model space, metres,
// Y-up) for: skull/cranial cavity, thorax (rib cage), sternum, and the whole
// model. These feed anatomyModelConfig.organAnchors after the viewer's fit.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const glbPath = resolve(__dirname, "..", process.argv[2] ?? "public/models/medtwin-anatomy.glb");
const buf = readFileSync(glbPath);
let off = 12;
let json = null;
while (off < buf.length) {
  const clen = buf.readUInt32LE(off);
  const ctype = buf.readUInt32LE(off + 4);
  const cdata = buf.subarray(off + 8, off + 8 + clen);
  if (ctype === 0x4e4f534a) json = JSON.parse(cdata.toString("utf8"));
  off += 8 + clen;
}
const meshes = json.meshes || [];
const accessors = json.accessors || [];
const nodes = json.nodes || [];
const parentOf = new Array(nodes.length).fill(-1);
nodes.forEach((n, i) => (n.children || []).forEach((c) => (parentOf[c] = i)));
function worldT(i) {
  let t = [0, 0, 0], cur = i;
  while (cur >= 0) {
    const tr = nodes[cur].translation || [0, 0, 0];
    t = [t[0] + tr[0], t[1] + tr[1], t[2] + tr[2]];
    cur = parentOf[cur];
  }
  return t;
}
const nodeForMesh = new Array(meshes.length).fill(-1);
nodes.forEach((n, i) => {
  if (typeof n.mesh === "number" && nodeForMesh[n.mesh] === -1) nodeForMesh[n.mesh] = i;
});

// Build per-mesh world bbox.
const items = meshes.map((m, mi) => {
  const ni = nodeForMesh[mi];
  const name = (m.name || (ni >= 0 ? nodes[ni].name : "") || "").toLowerCase();
  const wt = ni >= 0 ? worldT(ni) : [0, 0, 0];
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  (m.primitives || []).forEach((p) => {
    const acc = accessors[p.attributes?.POSITION];
    if (acc?.min && acc?.max)
      for (let k = 0; k < 3; k++) {
        mn[k] = Math.min(mn[k], acc.min[k]);
        mx[k] = Math.max(mx[k], acc.max[k]);
      }
  });
  if (!isFinite(mn[0])) return null;
  return { name, wmin: mn.map((v, k) => v + wt[k]), wmax: mx.map((v, k) => v + wt[k]) };
}).filter(Boolean);

function union(filter) {
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  let n = 0;
  for (const it of items) {
    if (!filter(it.name)) continue;
    n++;
    for (let k = 0; k < 3; k++) {
      mn[k] = Math.min(mn[k], it.wmin[k]);
      mx[k] = Math.max(mx[k], it.wmax[k]);
    }
  }
  if (!n) return null;
  const size = mx.map((v, k) => v - mn[k]);
  const ctr = mx.map((v, k) => (v + mn[k]) / 2);
  return { n, mn, mx, size, ctr };
}
function show(label, u) {
  if (!u) return console.log(label, "-> (no match)");
  console.log(
    `${label}: n=${u.n} ctr=[${u.ctr.map((v) => v.toFixed(3)).join(", ")}] size=[${u.size.map((v) => v.toFixed(3)).join(", ")}] y=[${u.mn[1].toFixed(3)}..${u.mx[1].toFixed(3)}]`
  );
}

const has = (n, ...w) => w.some((x) => n.includes(x));
show("WHOLE", union(() => true));
// Cranial vault bones -> interior ≈ cavity for the brain.
show("CRANIAL (vault bones)", union((n) => has(n, "parietal bone", "occipital bone", "frontal bone", "temporal bone", "sphenoid")));
show("SKULL (all cranial)", union((n) => has(n, "parietal", "occipital", "temporal bone", "frontal bone", "maxilla", "mandible", "sphenoid", "zygomatic", "nasal bone")));
// Rib cage -> thoracic cavity for heart + lungs.
show("RIBS", union((n) => has(n, "rib") && !has(n, "cartilage")));
show("STERNUM", union((n) => has(n, "sternum", "manubrium", "xiphoid")));
show("THORACIC VERTEBRAE", union((n) => has(n, "thoracic vertebra")));
// Pelvis / diaphragm level reference.
show("DIAPHRAGM-ish (lowest ribs L10-12)", union((n) => has(n, "rib") && has(n, "11", "12", "10")));
show("CLAVICLE (shoulder line)", union((n) => has(n, "clavicle")));
