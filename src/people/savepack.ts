// D-378 (B400): the save made small. A people's save is JSON; its large, regular parts (the trust ledger's ~80,000 records,
// the economy's household columns and kept events) are written as varint columns and/or JSON, deflated (fflate, shipped with
// three) and carried as one base64 string. Lossless and deterministic (the same state packs to the same string), plain ASCII.
import { deflateSync, inflateSync } from 'three/examples/jsm/libs/fflate.module.js';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64I = new Int16Array(128).fill(-1); for (let i = 0; i < 64; i++) B64I[B64.charCodeAt(i)] = i;
export function toB64(b: Uint8Array): string {
  const out: string[] = []; let line = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0), r = b.length - i;
    line += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (r > 1 ? B64[(n >> 6) & 63] : '=') + (r > 2 ? B64[n & 63] : '=');
    if (line.length >= 4096) { out.push(line); line = ''; }
  }
  out.push(line); return out.join('');
}
export function fromB64(s: string): Uint8Array {
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0, n = (s.length / 4) * 3 - pad, b = new Uint8Array(n);
  for (let i = 0, j = 0; i < s.length; i += 4) {
    const x = (B64I[s.charCodeAt(i)] << 18) | (B64I[s.charCodeAt(i + 1)] << 12) | ((B64I[s.charCodeAt(i + 2)] & 63) << 6) | (B64I[s.charCodeAt(i + 3)] & 63);
    b[j++] = (x >> 16) & 255; if (j < n) b[j++] = (x >> 8) & 255; if (j < n) b[j++] = x & 255;
  }
  return b;
}
export const pack = (b: Uint8Array) => toB64(deflateSync(b, { level: 9 }));
export const unpack = (s: string) => inflateSync(fromB64(s));
export const packJSON = (x: unknown) => pack(new TextEncoder().encode(JSON.stringify(x)));
export const unpackJSON = (s: string) => JSON.parse(new TextDecoder().decode(unpack(s)));

/** varint columns: unsigned LEB128, signed zigzag; safe for |x| < 2^52 */
export class Cols {
  private c: number[][] = [];
  private col(i: number) { return this.c[i] ??= []; }
  u(i: number, x: number) { const a = this.col(i); while (x >= 128) { a.push((x % 128) | 128); x = Math.floor(x / 128); } a.push(x); }
  s(i: number, x: number) { this.u(i, x < 0 ? -x * 2 - 1 : x * 2); }
  /** the columns, each deflated alone (a column's numbers are alike; mixed, they compress worse), behind a header of their
   *  deflated lengths, as base64 */
  pack(): string {
    const z = Array.from(this.c, a => deflateSync(Uint8Array.from(a ?? []), { level: 9 })), head = new Cols(); head.u(0, z.length); for (const x of z) head.u(0, x.length);
    const h = head.c[0], out = new Uint8Array(h.length + z.reduce((n, x) => n + x.length, 0)); out.set(h, 0);
    let o = h.length; for (const x of z) { out.set(x, o); o += x.length; } return toB64(out);
  }
}
export class ColsReader {
  private c: Uint8Array[] = []; private p: number[] = [];
  constructor(s: string) {
    const b = fromB64(s); let o = 0; const u = () => { let x = 0, m = 1, v: number; do { v = b[o++]; x += (v & 127) * m; m *= 128; } while (v & 128); return x; };
    const n = u(), lens: number[] = []; for (let i = 0; i < n; i++) lens.push(u());
    for (const l of lens) { this.c.push(inflateSync(b.subarray(o, o + l))); this.p.push(0); o += l; }
  }
  u(i: number): number { const b = this.c[i]; let x = 0, m = 1, v: number; do { v = b[this.p[i]++]; x += (v & 127) * m; m *= 128; } while (v & 128); return x; }
  s(i: number): number { const x = this.u(i); return x % 2 ? -(x + 1) / 2 : x / 2; }
}
