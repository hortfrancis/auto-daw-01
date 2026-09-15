export type DecodedAudio = { sampleRate: number; channels: Float32Array[] };

/** Reads a PCM WAV file: 16-bit integer or 32-bit float, any number of channels. */
export function decodeWav(file: Buffer): DecodedAudio {
  if (file.length < 12 || file.toString('ascii', 0, 4) !== 'RIFF' || file.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a WAV file: it has no RIFF/WAVE header.');
  }

  let format: { code: number; channelCount: number; sampleRate: number; bitsPerSample: number } | undefined;
  let data: Buffer | undefined;
  for (let offset = 12; offset + 8 <= file.length; ) {
    const id = file.toString('ascii', offset, offset + 4);
    const size = file.readUInt32LE(offset + 4);
    const body = file.subarray(offset + 8, offset + 8 + size);
    if (id === 'fmt ') {
      format = {
        code: body.readUInt16LE(0),
        channelCount: body.readUInt16LE(2),
        sampleRate: body.readUInt32LE(4),
        bitsPerSample: body.readUInt16LE(14),
      };
    } else if (id === 'data') {
      data = body;
    }
    offset += 8 + size + (size % 2); // chunks are padded to an even length
  }
  if (!format || !data) throw new Error('WAV file is missing its fmt or data chunk.');

  const { code, channelCount, sampleRate, bitsPerSample } = format;
  const isInt16 = code === 1 && bitsPerSample === 16;
  const isFloat32 = code === 3 && bitsPerSample === 32;
  if (!isInt16 && !isFloat32) {
    throw new Error(`Unsupported WAV format (format code ${code}, ${bitsPerSample}-bit). Supported: 16-bit PCM and 32-bit float.`);
  }

  const bytesPerSample = bitsPerSample / 8;
  const frames = Math.floor(data.length / (bytesPerSample * channelCount));
  const channels = Array.from({ length: channelCount }, () => new Float32Array(frames));
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const at = (frame * channelCount + channel) * bytesPerSample;
      channels[channel][frame] = isInt16 ? data.readInt16LE(at) / 32768 : data.readFloatLE(at);
    }
  }
  return { sampleRate, channels };
}
