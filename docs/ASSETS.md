# 3D Anatomy Assets

The Digital Twin viewer renders a **locally-loaded GLB/GLTF anatomical model**
as its primary visualization, with a procedural hologram and a 2D figure as
fallbacks. This document covers the asset contract and licensing.

## Licensing rule (read first)

**No 3D model is bundled with this repository.** Do not commit a model whose
license you have not verified. Only add assets that are clearly:

- CC0 / public domain, or
- CC-BY (with attribution recorded below), or
- otherwise explicitly licensed for this use.

Do **not** use Sketchfab downloads with unclear reuse permissions, scraped GLB
mirrors, or commercial models without an explicit license.

## Where the model goes

Place the model at:

```
public/models/medtwin-anatomy.glb
```

That path is configured in `src/components/anatomy/anatomyModelConfig.ts`
(`ANATOMY_MODEL.fullModel`). Change it there to point elsewhere or to split
into per-organ GLBs (`parts.body`, `parts.heart`, ...). The code is written
against this config, not against any specific model, so the asset is
replaceable without touching risk, camera, or animation logic.

When the file is absent, `useModelAvailable` (a lightweight HEAD probe) reports
`unavailable` and the viewer renders the procedural hologram fallback instead —
so a missing model degrades gracefully rather than throwing.

## Mesh naming

The viewer classifies meshes into `body`, `heart`, `lungs`, `brain` by matching
each mesh name (case-insensitive substring) against `ANATOMY_MESH_MAP` in
`anatomyModelConfig.ts`. Preferred mesh names:

| Part  | Preferred names                          |
| ----- | ---------------------------------------- |
| Body  | `BodyShell`, `Skin`, `Body`              |
| Heart | `Heart`                                  |
| Lungs | `LeftLung`, `RightLung`                  |
| Brain | `Brain`                                  |

If your model uses different names, either rename the meshes in a GLTF editor
or add the substrings to `ANATOMY_MESH_MAP`. Verify classification with the
debug inspector (below). **Keep organs as independent meshes** — the risk
highlighting and per-organ animation depend on separable heart / lungs / brain
meshes surviving any optimization pass.

## Model inspector (`?anatomyDebug=1`)

Open the twin page with `?anatomyDebug=1`, e.g.:

```
/twin/MT-LIVE?anatomyDebug=1
```

`AnatomyDebug` logs a table of every mesh (name, material, mapped part,
bounding box) to the console and draws box helpers around classified organs.
It renders nothing in normal mode.

## Draco compression

If the GLB is Draco-compressed, set `ANATOMY_MODEL.draco = true` and bundle the
decoder locally under `public/draco/` (do not rely on a CDN that can fail
offline). If compression proves fragile, prefer a slightly larger uncompressed
GLB.

## Optimization targets

- Target file size: **< 15 MB**, ideally **5–10 MB**.
- Tools: `gltf-transform`, `gltfpack`.
- Do **not** merge/weld organ meshes during optimization (see Mesh naming).

## Current bundled asset

`public/models/medtwin-anatomy.glb` — a human **skeleton + musculature** model
(no viscera). Because it has no heart/lungs/brain meshes, the viewer treats the
whole import as the translucent body/skeleton (`ANATOMY_MODEL.hasOrgans = false`)
and overlays procedural heart/lungs/brain positioned via `organAnchors` so triage
highlighting and per-organ animation still work.

- **Source:** Z-Anatomy dataset, re-exported for the browser by the
  `hpfrei/body-anatomy-3d-viewer` project (`public/body.glb`).
- **Author:** Z-Anatomy contributors; browser build by @hpfrei.
- **License:** **CC BY-SA 4.0** (both the Z-Anatomy data and the derived build).
- **Attribution requirements:** Must credit Z-Anatomy and preserve the
  share-alike terms. Shown on-screen under the twin viewport ("Anatomy model:
  Z-Anatomy · CC BY-SA 4.0") and here.
- **Original URL / reference:** https://www.z-anatomy.com/ ·
  https://github.com/hpfrei/body-anatomy-3d-viewer
- **Modifications made:** Downloaded as-is to `public/models/medtwin-anatomy.glb`;
  Draco-compressed (`KHR_draco_mesh_compression`). Rendered with a translucent
  clinical material and re-fit to the scene at load time. No mesh edits.
- **Share-alike note:** CC BY-SA is copyleft — if this model (or a derivative of
  it) is redistributed, the redistribution must remain under CC BY-SA 4.0.

## Draco decoder (bundled locally)

This model is Draco-compressed, so `ANATOMY_MODEL.draco = true` and the decoder
is served from `public/draco/` (copied from `three/examples/jsm/libs/draco/gltf/`
— `draco_decoder.js`, `draco_decoder.wasm`, `draco_wasm_wrapper.js`). No CDN is
used, so decoding works offline. If you upgrade `three`, re-copy these files so
the decoder matches the loader version.

## Medical labeling

This is a **generic anatomical visualization**, not patient-specific medical
imaging. The model must not imply reconstruction from a specific patient's body.
Keep the on-screen "Generic anatomical visualization" disclaimer intact.

## MediaPipe vision assets

The real-device scan uses the official `@mediapipe/tasks-vision` Web package
(Apache-2.0) and serves its WASM runtime locally from `public/mediapipe/wasm/`.
The face and pose loaders expect these official model files:

- `public/models/mediapipe/face_landmarker.task` — Face Landmarker, float16 v1
- `public/models/mediapipe/pose_landmarker_lite.task` — Pose Landmarker Lite,
  float16 v1

Official sources:

- `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
- `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`

If either model is unavailable, the scan reports vision processing unavailable;
it does not substitute a synthetic face, respiration, or movement result.
