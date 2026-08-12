import type { FaceLandmarker as FaceLandmarkerType } from "@mediapipe/tasks-vision";

let instancePromise: Promise<FaceLandmarkerType> | null = null;

export function loadFaceLandmarker(): Promise<FaceLandmarkerType> {
  if (!instancePromise) {
    instancePromise = createFaceLandmarker().catch((error) => {
      instancePromise = null;
      throw error;
    });
  }
  return instancePromise;
}

async function createFaceLandmarker(): Promise<FaceLandmarkerType> {
  const { FaceLandmarker, FilesetResolver } = await import(
    "@mediapipe/tasks-vision"
  );
  const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  const options = {
    runningMode: "VIDEO" as const,
    numFaces: 2,
    minFaceDetectionConfidence: 0.55,
    minFacePresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
  };
  try {
    return await FaceLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: {
        modelAssetPath: "/models/mediapipe/face_landmarker.task",
        delegate: "GPU",
      },
    });
  } catch {
    return FaceLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: {
        modelAssetPath: "/models/mediapipe/face_landmarker.task",
        delegate: "CPU",
      },
    });
  }
}
