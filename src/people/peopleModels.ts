import { BASE } from '../core/base';
// The people's Blender-built assets (D-307): strand cards for hair, beards and brows, and garment drape from Blender's
// cloth simulation. Built by `node tools/blender/build.mjs` from tools/blender/people.json (sources in
// tools/blender/sources/people_*.ts, Blender scripts tools/blender/hair_atlas.py and cloth.py) into public/models/people/,
// recorded in public/models/people/manifest.json (input and output hashes; tests/people_models.test.ts).
//
// Both assets are bound to the MakeHuman body's topology, not to one body, so every body variant (23) wears its own fitted
// copy, as the procedural pieces of outfits.ts do:
//  * cards: each card vertex is anchored on a triangle of the reference body (three render vertices and two barycentric
//    weights) with an offset in the bind frame, scaled by the variant's head size (headScale); its skin weights are the
//    anchor's. A card that leaves the head (a beard hanging below the chin, a bob below the ears) keeps the anchor where
//    it left the surface, so it hangs from there on every head.
//  * drape: per garment piece (outfits.ts geometry key, e.g. robe_skirt@0), the displacement Blender's cloth solver gave
//    each vertex of the procedural piece on the reference body of its group (men, women, children), in the piece's local
//    frame (radial, around, down for tubes; along the shell's normal and two tangents for shells), applied on every
//    variant of the group at placement.
// In node (tests) the files are read from disk; without them outfits.ts builds the procedural pieces (nothing is missing).

/** a typed-array slice of the binary: byte offset, element count, type */
export interface Slice { o: number; n: number; t: 'u8' | 'u16' | 'i16' | 'u32' | 'f32' }
export interface CardSetMeta {
  /** vertices, triangles; per-vertex: anchor (3 × u16 render vertices), bary (2 × f32), off (3 × f32, m, bind frame on the
   *  reference), uv (2 × f32: across 0..1, root → tip 0..1), cell (u8: class × 8 + column), ao (u8) ; index (u16) */
  n: number; tris: number; anchor: Slice; bary: Slice; off: Slice; uv: Slice; cell: Slice; ao: Slice; index: Slice;
  /** cards, tier, what it is */
  cards: number; note: string;
}
export interface CardsMeta {
  version: 1; ref: string;
  /** the reference variant's head height (head_top − chin, m): offsets scale by variant / reference */
  headH: number;
  atlas: { file: string; w: number; h: number; cols: number; rows: string[] };
  /** D-323: the normal atlas (same cells; R, G the lock's normal across and along the card, B occlusion, A coverage) */
  normal?: { file: string; w: number; h: number };
  /** card class → atlas row per hair style (looks.ts hairStyle: 0 natural curls, 1 court rows, 2 straight) */
  classRows: number[][];
  sets: Record<string, CardSetMeta>;
}
export interface CardSet { meta: CardSetMeta; anchor: Uint16Array; bary: Float32Array; off: Float32Array; uv: Float32Array; cell: Uint8Array; ao: Uint8Array; index: Uint16Array }
export interface PeopleCards { meta: CardsMeta; sets: Record<string, CardSet> }

export interface DrapeSetMeta {
  /** the piece's vertex count (must equal the procedural piece's), the group (men | women | children), the local frame
   *  kind, per-vertex displacement (3 × i16, 0.1 mm units) */
  n: number; group: string; frame: 'tube' | 'shell'; d: Slice; rms: number; max: number; note: string;
}
export interface DrapeMeta { version: 1 | 2; groups: Record<string, string>; sets: Record<string, DrapeSetMeta>;
  /** D-322 (version 2): per piece geometry key, each vertex's fold atlas coordinate (2 × f32; −1 none) */
  fuv?: Record<string, Slice>;
  /** D-322 rev 2: cuts per piece and group (sets `key|group` for the first, `key|group#s` for the others; body variant v wears
   *  seed v mod seeds) */
  seeds?: number;
  /** D-322: the fold layers' image (squares stacked vertically: 0 finer than full detail, 1 than the mid level; RGB the men's,
   *  women's, children's heights, sRGB-encoded about 0.5, ± scale m), its texel density and chart count */
  folds?: { file: string; layers: number; size: number; scale: number; texelsPerMetre: number; charts: number } }
export interface DrapeSet { meta: DrapeSetMeta; d: Int16Array }
export interface PeopleDrape { meta: DrapeMeta; sets: Record<string, DrapeSet>; fuv: Record<string, Float32Array> }

export interface PeopleModels { cards: PeopleCards | null; drape: PeopleDrape | null }
export const PEOPLE_DIR = 'models/people';
export const DRAPE_UNIT = 0.0001;

const view = (bin: ArrayBuffer, s: Slice): any => {
  const C = { u8: Uint8Array, u16: Uint16Array, i16: Int16Array, u32: Uint32Array, f32: Float32Array }[s.t];
  return new C(bin.slice(s.o, s.o + s.n * C.BYTES_PER_ELEMENT));
};
export function decodeCards(meta: CardsMeta, bin: ArrayBuffer): PeopleCards {
  const sets: Record<string, CardSet> = {};
  for (const [k, m] of Object.entries(meta.sets)) sets[k] = { meta: m, anchor: view(bin, m.anchor), bary: view(bin, m.bary), off: view(bin, m.off), uv: view(bin, m.uv), cell: view(bin, m.cell), ao: view(bin, m.ao), index: view(bin, m.index) };
  return { meta, sets };
}
export function decodeDrape(meta: DrapeMeta, bin: ArrayBuffer): PeopleDrape {
  const sets: Record<string, DrapeSet> = {};
  for (const [k, m] of Object.entries(meta.sets)) sets[k] = { meta: m, d: view(bin, m.d) };
  const fuv: Record<string, Float32Array> = {}; for (const [k, s] of Object.entries(meta.fuv ?? {})) fuv[k] = view(bin, s);
  return { meta, sets, fuv };
}

/** a variant's head height (head_top − chin landmarks, m): the cards' offsets scale with it */
export function headHeight(pos: Float32Array, topRV: number, chinRV: number) { return pos[topRV * 3 + 1] - pos[chinRV * 3 + 1]; }
/** the positions of a card set on a variant (render-vertex positions `pos`), its offsets scaled by `s` (variant head height
 *  over the reference's) */
export function placeCards(set: CardSet, pos: Float32Array, s: number, out = new Float32Array(set.meta.n * 3)): Float32Array {
  const { anchor, bary, off } = set;
  for (let v = 0; v < set.meta.n; v++) {
    const a = anchor[v * 3], b = anchor[v * 3 + 1], c = anchor[v * 3 + 2], u = bary[v * 2], w = bary[v * 2 + 1], x = 1 - u - w;
    for (let e = 0; e < 3; e++) out[v * 3 + e] = pos[a * 3 + e] * u + pos[b * 3 + e] * w + pos[c * 3 + e] * x + off[v * 3 + e] * s;
  }
  return out;
}

/** the drape's local frame per vertex of a placed piece: rows n (the area-weighted vertex normal), t (horizontal, ⟂ n),
 *  b = n × t; 9 floats a vertex. The same frame is built on every variant, so a displacement measured on the reference
 *  (Blender's settled cloth) follows each body's own fit. */
export function drapeFrames(pos: Float32Array, index: ArrayLike<number>, n: number): Float32Array {
  const acc = new Float64Array(n * 3);
  for (let t = 0; t < index.length; t += 3) { const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const q of [a, b, c]) { acc[q] += nx; acc[q + 1] += ny; acc[q + 2] += nz; } }
  const F = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) {
    let nx = acc[i * 3], ny = acc[i * 3 + 1], nz = acc[i * 3 + 2]; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    // t = normalize(up × n) (horizontal); near-vertical normals take the x axis
    let tx = nz, ty = 0, tz = -nx; let lt = Math.hypot(tx, tz); if (lt < 1e-4) { tx = 1; tz = 0; lt = 1; } tx /= lt; tz /= lt;
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
    F.set([nx, ny, nz, tx, ty, tz, bx, by, bz], i * 9);
  }
  return F;
}
/** add a drape displacement (local frame components, DRAPE_UNIT) to a placed piece, in place */
export function applyDrape(pos: Float32Array, index: ArrayLike<number>, d: Int16Array, capOut = Infinity): Float32Array {
  const n = pos.length / 3, F = drapeFrames(pos, index, n), cap = capOut / DRAPE_UNIT;
  // (s17 V3, D-500: capOut (m) limits how far out along its normal the settled cloth may stand: the short sleeves' caps settled
  // 3 cm proud of the shoulder, epaulettes on every working man)
  for (let i = 0; i < n; i++) { const dn = Math.min(d[i * 3], cap); for (let e = 0; e < 3; e++) pos[i * 3 + e] += (F[i * 9 + e] * dn + F[i * 9 + 3 + e] * d[i * 3 + 1] + F[i * 9 + 6 + e] * d[i * 3 + 2]) * DRAPE_UNIT; }
  return pos;
}

/** a binary writer for the tools: appends typed arrays 4-byte aligned, returns their slices */
export class BinWriter {
  private parts: Uint8Array[] = []; private o = 0;
  add(a: Uint8Array | Uint16Array | Int16Array | Uint32Array | Float32Array): Slice {
    const t = a instanceof Uint8Array ? 'u8' : a instanceof Uint16Array ? 'u16' : a instanceof Int16Array ? 'i16' : a instanceof Uint32Array ? 'u32' : 'f32';
    const pad = (4 - (this.o % 4)) % 4; if (pad) { this.parts.push(new Uint8Array(pad)); this.o += pad; }
    const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength).slice(); const s: Slice = { o: this.o, n: a.length, t };
    this.parts.push(b); this.o += b.length; return s;
  }
  bytes(): Uint8Array { const out = new Uint8Array(this.o); let p = 0; for (const b of this.parts) { out.set(b, p); p += b.length; } return out; }
}

/** browser loader: the people's assets from public/models/people (null for each that is absent or fails: the procedural
 *  pieces are drawn). `?models=0` or `?peoplemodels=0` switches them off. */
export async function loadPeopleModels(base = BASE): Promise<PeopleModels & { atlasUrl: string | null; normalUrl?: string | null }> {
  const off = typeof location !== 'undefined' && (new URLSearchParams(location.search).get('models') === '0' || new URLSearchParams(location.search).get('peoplemodels') === '0');
  if (off) return { cards: null, drape: null, atlasUrl: null };
  const dir = `${base}${PEOPLE_DIR}/`;
  const get = async (f: string) => { const r = await fetch(dir + f); if (!r.ok) throw new Error(`${f}: ${r.status}`); return r; };
  const one = async <T>(name: string, dec: (m: any, b: ArrayBuffer) => T): Promise<T | null> => {
    try { const [m, b] = await Promise.all([get(`${name}.json`).then(r => r.json()), get(`${name}.bin`).then(r => r.arrayBuffer())]); return dec(m, b); }
    catch (e) { console.warn(`[people models] ${name}: ${(e as Error).message}; the procedural pieces are drawn`); return null; }
  };
  const [cards, drape] = await Promise.all([one('people_hair', decodeCards), one('people_cloth', decodeDrape)]);
  return { cards, drape, atlasUrl: cards ? dir + cards.meta.atlas.file : null, normalUrl: cards?.meta.normal ? dir + cards.meta.normal.file : null };
}
/** the strand atlas (KTX2: UASTC + zstd with mipmaps, built by the pipeline's KTX step), transcoded by three's KTX2Loader
 *  (Basis transcoder served from public/models/lib/basis) to the GPU's compressed format: the loader needs the device's
 *  features before a renderer exists here, so they are read from the WebGPU adapter (three's WebGPU backend asks for every
 *  feature the adapter has; without WebGPU none: the transcoder writes RGBA8). Linear data (R shade, G depth, B strand
 *  direction, A coverage), not flipped (row 0 = the top of the atlas), clamped. null if it fails (then no cards are drawn). */
export async function loadHairAtlas(url: string, base = BASE): Promise<any | null> {
  try {
    const THREE = await import('three/webgpu');
    const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
    let feats = new Set<string>();
    try { const nav: any = typeof navigator !== 'undefined' ? navigator : null; const ad = nav?.gpu ? await nav.gpu.requestAdapter() : null; if (ad) feats = new Set([...ad.features]); } catch { /* none */ }
    const k = new KTX2Loader().setTranscoderPath(base + 'models/lib/basis/');
    k.detectSupport({ isWebGPURenderer: true, hasFeature: (f: string) => feats.has(f) } as any);
    const t = await k.loadAsync(url);
    t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
    k.dispose();
    return t;
  } catch (e) { console.warn(`[people models] hair atlas: ${(e as Error).message}; no strand cards`); return null; }
}
/** node: read the assets from public/ (tests, tools); null for each missing */
export function readPeopleModels(read: (file: string) => Uint8Array | null): PeopleModels {
  const one = <T>(name: string, dec: (m: any, b: ArrayBuffer) => T): T | null => {
    const j = read(`${PEOPLE_DIR}/${name}.json`), b = read(`${PEOPLE_DIR}/${name}.bin`); if (!j || !b) return null;
    return dec(JSON.parse(new TextDecoder().decode(j)), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
  };
  return { cards: one('people_hair', decodeCards), drape: one('people_cloth', decodeDrape) };
}
