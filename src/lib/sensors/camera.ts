import { requestMedia } from "./media";

export interface CameraFrameSample {
  timestamp: number;
  red: number;
  green: number;
  blue: number;
  luminance: number;
  clipping: number;
}

export async function requestFrontCamera(): Promise<MediaStream> {
  return requestMedia({
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: false,
  });
}

export async function requestRearCamera(): Promise<MediaStream> {
  return requestMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: false,
  });
}

export async function attachVideoStream(
  video: HTMLVideoElement,
  stream: MediaStream
): Promise<void> {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
}

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
type TorchConstraint = MediaTrackConstraintSet & { torch?: boolean };

export async function tryEnableTorch(stream: MediaStream): Promise<boolean> {
  const track = stream.getVideoTracks()[0];
  if (!track?.getCapabilities) return false;
  const capabilities = track.getCapabilities() as TorchCapabilities;
  if (!capabilities.torch) return false;
  try {
    await track.applyConstraints({
      advanced: [{ torch: true } as TorchConstraint],
    });
    return true;
  } catch {
    return false;
  }
}

export function sampleCameraFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  roiScale = 0.32
): CameraFrameSample | null {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
  const width = Math.max(1, Math.min(160, video.videoWidth));
  const height = Math.max(1, Math.round((width * video.videoHeight) / video.videoWidth));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, 0, 0, width, height);

  const roiWidth = Math.max(8, Math.round(width * roiScale));
  const roiHeight = Math.max(8, Math.round(height * roiScale));
  const startX = Math.round((width - roiWidth) / 2);
  const startY = Math.round((height - roiHeight) / 2);
  const data = context.getImageData(startX, startY, roiWidth, roiHeight).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let clipped = 0;
  const pixels = data.length / 4;

  for (let index = 0; index < data.length; index += 4) {
    red += data[index];
    green += data[index + 1];
    blue += data[index + 2];
    if (
      data[index] >= 250 ||
      data[index + 1] >= 250 ||
      data[index + 2] >= 250 ||
      data[index] <= 3 ||
      data[index + 1] <= 3 ||
      data[index + 2] <= 3
    ) {
      clipped += 1;
    }
  }

  red /= pixels;
  green /= pixels;
  blue /= pixels;
  return {
    timestamp: performance.now(),
    red,
    green,
    blue,
    luminance: 0.2126 * red + 0.7152 * green + 0.0722 * blue,
    clipping: clipped / pixels,
  };
}
