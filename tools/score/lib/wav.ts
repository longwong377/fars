// WAV in and out for the score's stems and mixes: reads 16/24/32-bit PCM and 32-bit float, writes 32-bit float or 16-bit.
import { readFileSync, writeFileSync } from 'node:fs';
export interface Audio { sr: number; ch: Float32Array[] }

export function readWav(path: string): Audio {
  const b = readFileSync(path), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 12, fmt = 1, nch = 2, sr = 48000, bits = 16; let data: [number, number] | null = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = dv.getUint32(p + 4, true);
    if (id === 'fmt ') { fmt = dv.getUint16(p + 8, true); nch = dv.getUint16(p + 10, true); sr = dv.getUint32(p + 12, true); bits = dv.getUint16(p + 22, true); if (fmt === 0xfffe) fmt = dv.getUint16(p + 32, true); }
    else if (id === 'data') { data = [p + 8, Math.min(size, b.length - p - 8)]; break; }
    p += 8 + size + (size & 1);
  }
  if (!data) throw new Error(`no data chunk: ${path}`);
  const bps = bits / 8, n = Math.floor(data[1] / (bps * nch)), ch = Array.from({ length: nch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < nch; c++) {
    const o = data[0] + (i * nch + c) * bps;
    ch[c][i] = fmt === 3 ? (bits === 64 ? dv.getFloat64(o, true) : dv.getFloat32(o, true))
      : bits === 16 ? dv.getInt16(o, true) / 32768 : bits === 24 ? (((b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) << 8) >> 8) / 8388608 : dv.getInt32(o, true) / 2147483648;
  }
  return { sr, ch };
}

export function writeWav(path: string, a: Audio, float = true) {
  const nch = a.ch.length, n = a.ch[0].length, bps = float ? 4 : 2, dl = n * nch * bps, b = Buffer.alloc(44 + dl);
  b.write('RIFF', 0); b.writeUInt32LE(36 + dl, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(float ? 3 : 1, 20); b.writeUInt16LE(nch, 22); b.writeUInt32LE(a.sr, 24); b.writeUInt32LE(a.sr * nch * bps, 28);
  b.writeUInt16LE(nch * bps, 32); b.writeUInt16LE(bps * 8, 34); b.write('data', 36); b.writeUInt32LE(dl, 40);
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < nch; c++) {
    const x = a.ch[c][i]; if (float) b.writeFloatLE(x, o); else b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x * 32767))), o); o += bps; }
  writeFileSync(path, b);
}
