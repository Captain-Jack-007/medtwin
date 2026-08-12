# Anatomical 3D models

`medtwin-anatomy.glb` is a Draco-compressed human skeleton + musculature model
from **Z-Anatomy (CC BY-SA 4.0)**. See [`../../docs/ASSETS.md`](../../docs/ASSETS.md)
for full provenance, attribution, the Draco decoder note, and how the viewer
overlays procedural organs on top of it.

To swap in a different model, replace this file and update
`src/components/anatomy/anatomyModelConfig.ts`. If the file is removed, the app
falls back to the procedural hologram — never a blank card.

The `mediapipe/` subdirectory contains the official Face Landmarker and Pose
Landmarker Lite task assets used by the real-device scan. Their exact sources
and runtime license are recorded in [`../../docs/ASSETS.md`](../../docs/ASSETS.md).
