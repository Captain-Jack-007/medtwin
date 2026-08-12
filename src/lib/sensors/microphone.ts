import { requestMedia } from "./media";

export interface MicrophoneCapture {
  stream: MediaStream;
  context: AudioContext;
  analyser: AnalyserNode;
  samples: Uint8Array<ArrayBuffer>;
  close: () => Promise<void>;
}

export async function startMicrophoneCapture(): Promise<MicrophoneCapture> {
  const stream = await requestMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.25;
  source.connect(analyser);
  const samples = new Uint8Array(new ArrayBuffer(analyser.fftSize));

  return {
    stream,
    context,
    analyser,
    samples,
    close: async () => {
      stream.getTracks().forEach((track) => track.stop());
      if (context.state !== "closed") await context.close();
    },
  };
}

export function readAudioFrame(capture: MicrophoneCapture): {
  waveform: number[];
  rms: number;
  clipping: boolean;
} {
  capture.analyser.getByteTimeDomainData(capture.samples);
  const waveform = Array.from(capture.samples, (sample) => (sample - 128) / 128);
  let sumSquares = 0;
  let clipping = false;
  for (const value of waveform) {
    sumSquares += value * value;
    if (Math.abs(value) >= 0.98) clipping = true;
  }
  return {
    waveform,
    rms: Math.sqrt(sumSquares / waveform.length),
    clipping,
  };
}
