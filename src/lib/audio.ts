/**
 * Recording, kept behind a narrow interface.
 *
 * v0 is web-only, so this is MediaRecorder. Native (expo-audio) would implement
 * the same three functions — the design note in project-list.md about a thin
 * platform-specific recording layer is why this is its own module rather than
 * inlined into the screen.
 *
 * Recordings are re-encoded to 16 kHz mono WAV before upload. MediaRecorder
 * produces WebM/Opus on Chrome, which is not among the audio formats the Gemini
 * API documents accepting; WAV is, and 16 kHz mono is the standard rate for
 * speech while keeping a three-minute take to roughly 5-6 MB.
 */

const TARGET_RATE = 16_000;

export const isRecordingSupported = (): boolean =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined';

export type Recording = {
  /** WAV, 16 kHz mono. Ready to upload. */
  wav: Blob;
  /** Object URL for playback. Revoke it when the screen is done with it. */
  url: string;
  seconds: number;
};

export type Recorder = {
  stop(): Promise<Recording>;
  cancel(): void;
};

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  const startedAt = Date.now();

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start();

  const release = () => stream.getTracks().forEach((track) => track.stop());

  return {
    stop() {
      return new Promise<Recording>((resolve, reject) => {
        recorder.onstop = () => {
          release();
          const raw = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          toWav(raw)
            .then((wav) =>
              resolve({
                wav,
                url: URL.createObjectURL(wav),
                seconds: Math.round((Date.now() - startedAt) / 1000),
              }),
            )
            .catch(reject);
        };
        recorder.stop();
      });
    },
    cancel() {
      if (recorder.state !== 'inactive') recorder.stop();
      release();
    },
  };
}

/** Decode whatever the browser recorded, downmix to mono, resample, encode WAV. */
async function toWav(blob: Blob): Promise<Blob> {
  const buffer = await blob.arrayBuffer();
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(buffer);
    const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
    const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), TARGET_RATE);
  } finally {
    void context.close();
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);

  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([bytes], { type: 'audio/wav' });
}

/** Base64 without the data: prefix, which is what the Gemini inlineData field wants. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
