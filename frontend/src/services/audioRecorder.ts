function encodeWav16kMono(samples: Float32Array): Blob {
  const sampleRate = 16000;
  const numBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + numBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeStr(36, 'data');
  view.setUint32(40, numBytes, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function convertBlobToWav16k(blob: Blob): Promise<Blob> {
  const cleanMime = (blob.type || 'audio/webm').split(';')[0].trim() || 'audio/webm';
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx || !('OfflineAudioContext' in window)) {
    return new Blob([blob], { type: cleanMime });
  }

  const audioCtx = new AudioCtx();
  try {
    const arrayBuf = await blob.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuf.slice(0));
    const targetLen = Math.max(1, Math.ceil(decoded.duration * 16000));
    const offlineCtx = new OfflineAudioContext(1, targetLen, 16000);
    const src = offlineCtx.createBufferSource();
    src.buffer = decoded;
    src.connect(offlineCtx.destination);
    src.start(0);
    const rendered = await offlineCtx.startRendering();
    return encodeWav16kMono(rendered.getChannelData(0));
  } catch {
    return new Blob([blob], { type: cleanMime });
  } finally {
    await audioCtx.close().catch(() => undefined);
  }
}

