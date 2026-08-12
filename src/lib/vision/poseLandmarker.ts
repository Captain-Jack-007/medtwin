import type { PoseLandmarker as PoseLandmarkerType } from "@mediapipe/tasks-vision";

let instancePromise: Promise<PoseLandmarkerType> | null = null;

export function loadPoseLandmarker(): Promise<PoseLandmarkerType> {
  if (!instancePromise) {
    instancePromise = createPoseLandmarker().catch((error) => {
      instancePromise = null;
      throw error;
    });
  }
  return instancePromise;
}

async function createPoseLandmarker(): Promise<PoseLandmarkerType> {
  const { FilesetResolver, PoseLandmarker } = await import(
    "@mediapipe/tasks-vision"
  );
  const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  const options = {
    runningMode: "VIDEO" as const,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };
  try {
    return await PoseLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: {
        modelAssetPath: "/models/mediapipe/pose_landmarker_lite.task",
        delegate: "GPU",
      },
    });
  } catch {
    return PoseLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: {
        modelAssetPath: "/models/mediapipe/pose_landmarker_lite.task",
        delegate: "CPU",
      },
    });
  }
}
