// s14/load (D-354): a compact binary form of plain data (objects, arrays, numbers, strings, booleans, null and typed arrays),
// for the baked world cache. One JSON header, the typed arrays' bytes after it, each aligned to 8 bytes; unpacking views the
// arrays straight out of the fetched buffer (no copies). Lossless: unpack(pack(x)) deep-equals x, bit for bit in the arrays.
// s15 (D-386): also Maps and Sets, instances of registered classes (registerClass: own fields kept, the prototype restored,
// e.g. the town plan's Sites), and an object or typed array met more than once (shared, or a cycle) packed once and referred to
// ({$r}), so the graph unpacks with the same sharing. Functions and undefined are dropped, as before.
const TA: Record<string, any> = { Float32Array, Float64Array, Int8Array, Int16Array, Int32Array, Uint8Array, Uint16Array, Uint32Array, Uint8ClampedArray };
const MAGIC = 0x4b434150; // 'PACK'
const CLASSES = new Map<string, any>();
/** a class whose instances pack as data (own enumerable fields) and unpack with its prototype (no constructor call) */
export function registerClass(C: any, name: string = C.name) { CLASSES.set(name, C); }
const classOf = (v: any): string | null => { const p = Object.getPrototypeOf(v); if (p === Object.prototype || p === null) return null;
  for (const [n, C] of CLASSES) if (C.prototype === p) return n; throw new Error(`pack: instance of unregistered class ${p?.constructor?.name}`); };
const taName = (v: ArrayBufferView) => { for (const n in TA) if (Object.getPrototypeOf(v) === TA[n].prototype || v.constructor.name === n) return n; return v.constructor.name; };

export function pack(value: unknown): Uint8Array {
  // pass 1: objects met twice (shared or cyclic) get an id
  const count = new Map<object, number>();
  const walk = (v: any) => { if (v === null || typeof v !== 'object') return; const c = count.get(v) ?? 0; count.set(v, c + 1); if (c) return;
    if (ArrayBuffer.isView(v)) return;
    if (v instanceof Map) { for (const [k, x] of v) { walk(k); walk(x); } return; }
    if (v instanceof Set) { for (const x of v) walk(x); return; }
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    for (const k of Object.keys(v)) walk(v[k]); };
  walk(value);
  const ids = new Map<object, number>(); let nid = 0;
  const blobs: [number, ArrayBufferView][] = []; let off = 0;
  const enc = (v: any): any => {
    if (v === null || typeof v !== 'object') { if (typeof v === 'number' && !Number.isFinite(v)) return { $n: String(v) }; return v; }
    const multi = (count.get(v) ?? 0) > 1;
    if (multi) { const id = ids.get(v); if (id !== undefined) return { $r: id }; }
    const tag = multi ? { $id: (ids.set(v, nid), nid++) } : {};
    if (ArrayBuffer.isView(v)) { const t = taName(v); if (!TA[t]) throw new Error(`pack: ${t} unsupported`);
      off = (off + 7) & ~7; const r = { ...tag, $t: t, at: off, n: (v as any).length }; blobs.push([off, v]); off += v.byteLength; return r; }
    if (v instanceof Map) return { ...tag, $m: [...v].map(([k, x]) => [enc(k), enc(x)]) };
    if (v instanceof Set) return { ...tag, $s: [...v].map(enc) };
    if (Array.isArray(v)) return multi ? { ...tag, $a: v.map(enc) } : v.map(enc);
    const c = classOf(v), o: Record<string, any> = { ...tag, ...(c ? { $c: c } : {}) };
    for (const k of Object.keys(v)) { if (v[k] === undefined || typeof v[k] === 'function') continue; if (k[0] === '$') throw new Error(`pack: key ${k}`); o[k] = enc(v[k]); } return o;
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
  const refs = new Map<number, any>();
  const dec = (e: any): any => {
    if (e === null || typeof e !== 'object') return e;
    if (Array.isArray(e)) return e.map(dec);
    if (e.$r !== undefined) { if (!refs.has(e.$r)) throw new Error(`unpack: reference ${e.$r} before its object`); return refs.get(e.$r); }
    const id = e.$id;
    if (e.$t) { const C = TA[e.$t]; const a = new C(aligned.buffer, aligned.byteOffset + base + e.at, e.n); if (id !== undefined) refs.set(id, a); return a; }
    if (e.$n !== undefined && Object.keys(e).length === 1) return Number(e.$n);
    if (e.$m) { const m = new Map(); if (id !== undefined) refs.set(id, m); for (const [k, x] of e.$m) m.set(dec(k), dec(x)); return m; }
    if (e.$s) { const s = new Set(); if (id !== undefined) refs.set(id, s); for (const x of e.$s) s.add(dec(x)); return s; }
    if (e.$a) { const a: any[] = []; if (id !== undefined) refs.set(id, a); for (const x of e.$a) a.push(dec(x)); return a; }
    let o: Record<string, any>;
    if (e.$c) { const C = CLASSES.get(e.$c); if (!C) throw new Error(`unpack: class ${e.$c} not registered`); o = Object.create(C.prototype); } else o = {};
    if (id !== undefined) refs.set(id, o);
    for (const k of Object.keys(e)) { if (k === '$id' || k === '$c') continue; o[k] = dec(e[k]); } return o;
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
