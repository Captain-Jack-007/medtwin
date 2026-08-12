import { PermissionState } from "@/lib/measurements/types";

export type MediaFailureCode =
  | "insecure_context"
  | "unsupported"
  | "permission_denied"
  | "device_missing"
  | "device_busy"
  | "constraints_unavailable"
  | "unknown";

export class MediaAccessError extends Error {
  constructor(
    public readonly code: MediaFailureCode,
    message: string
  ) {
    super(message);
    this.name = "MediaAccessError";
  }
}

export interface DeviceCapabilities {
  secureContext: boolean;
  mediaDevices: boolean;
  camera: PermissionState;
  microphone: PermissionState;
  webAssembly: boolean;
  webGL: boolean;
  visionModels: boolean;
}

export function isMediaSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export async function inspectDeviceCapabilities(): Promise<DeviceCapabilities> {
  const secureContext =
    typeof window !== "undefined" && window.isSecureContext;
  const mediaDevices = isMediaSupported();
  let camera: PermissionState = mediaDevices ? "not_requested" : "unavailable";
  let microphone: PermissionState = mediaDevices
    ? "not_requested"
    : "unavailable";

  if (mediaDevices) {
    try {
      const devices = await withTimeout(
        navigator.mediaDevices.enumerateDevices(),
        1_500,
        []
      );
      camera = devices.some((device) => device.kind === "videoinput")
        ? "not_requested"
        : "unavailable";
      microphone = devices.some((device) => device.kind === "audioinput")
        ? "not_requested"
        : "unavailable";
    } catch {
      camera = "not_requested";
      microphone = "not_requested";
    }
  }

  const visionModels =
    typeof fetch !== "undefined" &&
    (await Promise.all([
      assetAvailable("/models/mediapipe/face_landmarker.task"),
      assetAvailable("/models/mediapipe/pose_landmarker_lite.task"),
    ])).every(Boolean);

  return {
    secureContext,
    mediaDevices,
    camera,
    microphone,
    webAssembly: typeof WebAssembly !== "undefined",
    webGL: supportsWebGL(),
    visionModels,
  };
}

export async function requestMedia(
  constraints: MediaStreamConstraints
): Promise<MediaStream> {
  if (typeof window === "undefined" || !window.isSecureContext) {
    throw new MediaAccessError(
      "insecure_context",
      "Camera and microphone access requires HTTPS."
    );
  }
  if (!isMediaSupported()) {
    throw new MediaAccessError(
      "unsupported",
      "This browser does not support camera or microphone capture."
    );
  }

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    throw classifyMediaError(error);
  }
}

export function classifyMediaError(error: unknown): MediaAccessError {
  const name =
    error instanceof DOMException
      ? error.name
      : typeof error === "object" && error !== null && "name" in error
        ? String(error.name)
        : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return new MediaAccessError(
      "permission_denied",
      "Permission was denied. Enable access in browser settings and try again."
    );
  }
  if (name === "NotFoundError") {
    return new MediaAccessError(
      "device_missing",
      "No compatible camera or microphone was found."
    );
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return new MediaAccessError(
      "device_busy",
      "The device is busy in another application. Close it there and retry."
    );
  }
  if (name === "OverconstrainedError") {
    return new MediaAccessError(
      "constraints_unavailable",
      "The requested camera mode is unavailable on this device."
    );
  }
  return new MediaAccessError("unknown", "Unable to start media capture.");
}

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function watchTrackEnded(
  stream: MediaStream,
  onEnded: () => void
): () => void {
  const tracks = stream.getTracks();
  tracks.forEach((track) => track.addEventListener("ended", onEnded));
  return () =>
    tracks.forEach((track) => track.removeEventListener("ended", onEnded));
}

function supportsWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") || canvas.getContext("webgl")
    );
  } catch {
    return false;
  }
}

async function assetAvailable(path: string): Promise<boolean> {
  try {
    const response = await withTimeout(fetch(path, { method: "HEAD" }), 1_500, null);
    return response?.ok === true;
  } catch {
    return false;
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}
