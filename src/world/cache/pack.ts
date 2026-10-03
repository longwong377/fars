// s14/load (D-354): a compact binary form of plain data (objects, arrays, numbers, strings, booleans, null, typed arrays, Sets, Maps),
// for the baked world cache. One JSON header, the typed arrays' bytes after it, each aligned to 8 bytes; unpacking views the
// arrays straight out of the fetched buffer (no copies). Lossless: unpack(pack(x)) deep-equals x, bit for bit in the arrays.
const TA: Record<string, any> = { Float32Array, Float64Array, Int8Array, Int16Array, Int32Array, Uint8Array, Uint16Array, Uint32Array, Uint8ClampedArray };
const MAGIC = 0x4b434150; // 'PACK'
/** s15 (D-392): classes packed by name and revived on unpack (geo.ts registers three's Vector3): test, to plain data, back */
const CLS = new Map<string, { test: (v: any) => boolean; to: (v: any) => any; from: (x: any) => any }>();
export function registerPackClass(name: string, test: (v: any) => boolean, to: (v: any) => any, from: (x: any) => any) { CLS.set(name, { test, to, from }); }

export function pack(value: unknown): Uint8Array {
  const blobs: [number, ArrayBufferView][] = []; let off = 0;
  const enc = (v: any): any => {
    if (v === null || typeof v !== 'object') { if (typeof v === 'number' && !Number.isFinite(v)) return { $n: String(v) }; return v; }
    if (ArrayBuffer.isView(v)) { const t = v.constructor.name; if (!TA[t]) throw new Error(`pack: ${t} unsupported`);
      off = (off + 7) & ~7; const r = { $t: t, at: off, n: (v as any).length }; blobs.push([off, v]); off += v.byteLength; return r; }
    if (Array.isArray(v)) return v.map(enc);
    for (const [name, c] of CLS) if (c.test(v)) return { $c: name, v: enc(c.to(v)) };
    if (v instanceof Set) return { $set: [...v].map(enc) }; // (s15: Sets and Maps, the town plan's doors)
    if (v instanceof Map) return { $map: [...v].map(([k, x]) => [enc(k), enc(x)]) };
    const o: Record<string, any> = {}; for (const k of Object.keys(v)) { if (v[k] === undefined || typeof v[k] === 'function') continue; o[k] = enc(v[k]); } return o;
  };
  const head = new TextEncoder().encode(JSON.stringify(enc(value)));
  const base = (8 + head.length + 7) & ~7, out = new Uint8Array(base + off), dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true); dv.setUint32(4, head.length, true); out.set(head, 8);
  for (const [at, b] of blobs) out.set(new Uint8Array(b.buffer, b.byteOffset, b.byteLength), base + at);
  return out;
}

export function unpack<T = any>(buf: ArrayBuffer | Uint8Array): T {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('unpack: not a packed buffer');
  const hl = dv.getUint32(4, true), base = (8 + hl + 7) & ~7, head = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + hl)));
  // views need their own buffer offset aligned to the element size: a buffer fetched whole starts at 0, so base + at is aligned
  const aligned = u8.byteOffset % 8 === 0 ? u8 : u8.slice();
  const dec = (e: any): any => {
    if (e === null || typeof e !== 'object') return e;
    // (D-580: the parsed header is this call's own: arrays and plain objects are decoded in place, not copied: the town's
    // fill and the villages' sites are 21-25 MB of JSON each, and the copy was a third of their unpack)
    if (Array.isArray(e)) { for (let i = 0; i < e.length; i++) { const x = e[i]; if (x !== null && typeof x === 'object') e[i] = dec(x); } return e; }
    if (e.$t) { const C = TA[e.$t]; return new C(aligned.buffer, aligned.byteOffset + base + e.at, e.n); }
    if (e.$n !== undefined && Object.keys(e).length === 1) return Number(e.$n);
    if (e.$c && Object.keys(e).length === 2) { const c = CLS.get(e.$c); if (!c) throw new Error(`unpack: class ${e.$c} not registered`); return c.from(dec(e.v)); }
    if (e.$set && Object.keys(e).length === 1) return new Set(e.$set.map(dec));
    if (e.$map && Object.keys(e).length === 1) return new Map(e.$map.map(([k, x]: any) => [dec(k), dec(x)]));
    for (const k in e) { const x = e[k]; if (x !== null && typeof x === 'object') e[k] = dec(x); } return e;
  };
  return dec(head) as T;
}

/** FNV-1a 64-bit-ish (two 32-bit lanes) over bytes: a content hash for identity checks, not for security */
export function hashBytes(u8: Uint8Array, seed = 0): string {
  let a = (0x811c9dc5 ^ seed) | 0, b = (0x9e3779b9 ^ seed) | 0;
  for (let i = 0; i < u8.length; i++) { const c = u8[i]; a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519) ^ (b >>> 13); }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
export const hashString = (s: string) => hashBytes(new TextEncoder().encode(s));
/** a content hash over several typed or plain numeric arrays (their values as float64), for keys made of runtime inputs */
export function hashArrays(...arrs: ArrayLike<number>[]): string {
  let n = 0; for (const a of arrs) n += a.length + 1;
  const f = new Float64Array(n); let k = 0; for (const a of arrs) { f[k++] = a.length; for (let i = 0; i < a.length; i++) f[k++] = a[i]; }
  return hashBytes(new Uint8Array(f.buffer));
}
