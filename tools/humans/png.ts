// Minimal PNG encode/decode (8-bit greyscale/RGB/RGBA, non-interlaced) for the human asset build. Node zlib only.
import { deflateSync, inflateSync } from 'node:zlib';

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b: Uint8Array) => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };

/** encode RGBA (channels=4), RGB (3) or grey (1) pixels, rows top to bottom; per-row filter chosen for size */
export function encodePNG(w: number, h: number, px: Uint8Array, channels: 1 | 3 | 4 = 4): Buffer {
  const chunk = (t: string, d: Buffer) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4, 'latin1'); d.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
  const stride = w * channels, raw = Buffer.alloc((stride + 1) * h);
  const cand = [Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride)];
  for (let y = 0; y < h; y++) {
    const row = px.subarray(y * stride, (y + 1) * stride), up = y ? px.subarray((y - 1) * stride, y * stride) : null;
    // filters: 1 sub, 2 up, 4 paeth; pick the smallest sum of abs (standard heuristic)
    let best = 0, bestSum = Infinity;
    for (let f = 0; f < 3; f++) {
      const out = cand[f]; let s = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= channels ? row[i - channels] : 0, b = up ? up[i] : 0, c = up && i >= channels ? up[i - channels] : 0;
        let pred = 0;
        if (f === 0) pred = a; else if (f === 1) pred = b; else { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        const v = (row[i] - pred) & 255; out[i] = v; s += v < 128 ? v : 256 - v;
      }
      if (s < bestSum) { bestSum = s; best = f; }
    }
    raw[y * (stride + 1)] = [1, 2, 4][best]; cand[best].copy(raw, y * (stride + 1) + 1);
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = channels === 4 ? 6 : channels === 3 ? 2 : 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** decode to RGBA (8-bit colour types 0, 2, 3 (palette), 4, 6; no interlace) */
export function decodePNG(buf: Buffer): { width: number; height: number; data: Uint8Array } {
  let p = 8, w = 0, h = 0, depth = 0, ct = 0, interlace = 0; const idat: Buffer[] = []; let pal: Buffer | null = null, trns: Buffer | null = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ct = d[9]; interlace = d[12]; }
    else if (type === 'PLTE') pal = d; else if (type === 'tRNS') trns = d; else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`png: unsupported depth ${depth} / interlace ${interlace}`);
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : 1, stride = w * ch;
  const raw = inflateSync(Buffer.concat(idat)); const out = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? out[y * stride + i - ch] : 0, b = y ? out[(y - 1) * stride + i] : 0, c = y && i >= ch ? out[(y - 1) * stride + i - ch] : 0;
      let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + i] = v & 255;
    }
  }
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (ct === 6) rgba.set(out.subarray(i * 4, i * 4 + 4), i * 4);
    else if (ct === 2) { rgba.set(out.subarray(i * 3, i * 3 + 3), i * 4); rgba[i * 4 + 3] = 255; }
    else if (ct === 4) { rgba.fill(out[i * 2], i * 4, i * 4 + 3); rgba[i * 4 + 3] = out[i * 2 + 1]; }
    else if (ct === 3 && pal) { const k = out[i]; rgba[i * 4] = pal[k * 3]; rgba[i * 4 + 1] = pal[k * 3 + 1]; rgba[i * 4 + 2] = pal[k * 3 + 2]; rgba[i * 4 + 3] = trns && k < trns.length ? trns[k] : 255; }
    else { rgba.fill(out[i], i * 4, i * 4 + 3); rgba[i * 4 + 3] = 255; }
  }
  return { width: w, height: h, data: rgba };
}

/** box-filter downscale of RGBA by an integer factor */
export function downscale(img: { width: number; height: number; data: Uint8Array }, f: number) {
  const w = Math.floor(img.width / f), h = Math.floor(img.height / f), out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
    let s = 0; for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) s += img.data[((y * f + j) * img.width + x * f + i) * 4 + c];
    out[(y * w + x) * 4 + c] = Math.round(s / (f * f));
  }
  return { width: w, height: h, data: out };
}
