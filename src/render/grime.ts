// D-366 (session 15, agent surfaces): one shared world-space grime layer over every surface of the world (surfaceMaterial,
// materials.ts), so no big plane reads as one flat colour at any distance. All tier C (no measurement of 467's soiling exists;
// the forms are those of lived-in earthen and stone towns, the amplitudes judged against the references' ruin and modern
// villages and kept below them).
//  - drift: low-frequency colour drift at 100 m and 10 m (and 1 m where the surface has no broad tone of its own), with a faint
//    warm/cool shift: batches of plaster and earth, beds of stone, dust blown over one end of a court
//  - the grime map (world raster, 1 m cells, sparse 32 m tiles; built once from the world: buildGrime): soot above every fire
//    (hearths, ovens, kilns, braziers, torches, lamps: walls and ceilings blacken from the flame up) and above every town street
//    door (the house's smoke leaves through it); the ash and charcoal trodden into the ground round hearths, ovens and kilns, the
//    damp round wells and troughs; the wear of the town's lanes by how many households walk them (each street door's way out of
//    its quarter, along the lanes, counted) and along the roads
//  - lichen on the old stone: sparse crustose rosettes in patches, more on north faces and ledges
// The map is read with textureLoad (no sampler: WebGPU's 16 per fragment stage, D-300) and bilinear filtered by hand; tiles carry
// a one-texel border so a lookup never crosses a tile. In node the map is empty (every term 0) unless a test builds one.
import * as THREE from 'three/webgpu';
import { uniform, positionWorld, normalWorld, mx_noise_float, mx_worley_noise_float, vec2, vec3, float, mix, smoothstep, max, abs, floor, fract, step, dot, textureLoad, ivec2, int, fwidth, clamp } from 'three/tsl';
import { roofedNode } from './probes/roofs';
import { cacheGetSync, cachePutSync } from '../world/cache/worldCache';

/** the grime map's frame: grid (e, n) metres of the index's corner, tile size (m) and index side; atlas tiles per row and rows */
export const GRIME_MAP = { E0: -4096, N0: -4096, TILE: 32, IDX: 256, PER_ROW: 60, ROWS: 30, Y0: -80, YS: 120 };
const ST = GRIME_MAP.TILE + 2; // a stored tile: the tile and a one-texel border
/** A/B (window.__parsaSurf.grime): 1 on, 0 the surfaces before D-366 */
export const GRIME_ON = uniform(1);
if (typeof globalThis !== 'undefined') (globalThis as any).__parsaSurf = { ...((globalThis as any).__parsaSurf ?? {}), grime: GRIME_ON };

const idxData = new Float32Array(GRIME_MAP.IDX * GRIME_MAP.IDX);
const IDX_TEX = new THREE.DataTexture(idxData, GRIME_MAP.IDX, GRIME_MAP.IDX, THREE.RedFormat, THREE.FloatType);
IDX_TEX.magFilter = IDX_TEX.minFilter = THREE.NearestFilter; IDX_TEX.generateMipmaps = false; IDX_TEX.needsUpdate = true;
const atlasData = new Uint8Array(GRIME_MAP.PER_ROW * ST * GRIME_MAP.ROWS * ST * 4);
const ATLAS_TEX = new THREE.DataTexture(atlasData, GRIME_MAP.PER_ROW * ST, GRIME_MAP.ROWS * ST, THREE.RGBAFormat, THREE.UnsignedByteType);
ATLAS_TEX.magFilter = ATLAS_TEX.minFilter = THREE.NearestFilter; ATLAS_TEX.generateMipmaps = false; ATLAS_TEX.needsUpdate = true;

// ------------------------------------------------------------------------------------------------ the map (CPU)
/** channels of a cell: soot (walls and ceilings above the source), the source's height (world y), the walked wear, the ground stain
 *  (ash and charcoal; damp) */
export interface GrimeCell { soot: number; y: number; wear: number; stain: number }
/** a sparse 1 m raster in 32 m tiles (grid e, n) */
export class GrimeRaster {
  readonly tiles = new Map<number, Float32Array>(); // key tj * IDX + ti â†’ 32 Ã— 32 Ã— [soot, y, wear, stain, weight of y]
  private key(e: number, n: number): [number, number, number] | null {
    const M = GRIME_MAP, ti = Math.floor((e - M.E0) / M.TILE), tj = Math.floor((n - M.N0) / M.TILE);
    if (ti < 0 || tj < 0 || ti >= M.IDX || tj >= M.IDX) return null;
    const i = Math.floor(e - M.E0) - ti * M.TILE, j = Math.floor(n - M.N0) - tj * M.TILE;
    return [tj * M.IDX + ti, i, j];
  }
  private cell(e: number, n: number, make: boolean): [Float32Array, number] | null {
    const k = this.key(e, n); if (!k) return null;
    let t = this.tiles.get(k[0]); if (!t) { if (!make) return null; t = new Float32Array(GRIME_MAP.TILE * GRIME_MAP.TILE * 5); this.tiles.set(k[0], t); }
    return [t, (k[2] * GRIME_MAP.TILE + k[1]) * 5];
  }
  at(e: number, n: number): GrimeCell { const c = this.cell(e, n, false); if (!c) return { soot: 0, y: 0, wear: 0, stain: 0 }; const [t, o] = c; return { soot: t[o], y: t[o + 1], wear: t[o + 2], stain: t[o + 3] }; }
  /** a disc of radius r round (e, n): soot and stain by (1 âˆ’ (d/r)Â²)^1.5, combined as 1 âˆ’ Î (1 âˆ’ a); y = the source's height where it
   *  contributes most */
  disc(e: number, n: number, r: number, o: { soot?: number; stain?: number; wear?: number; y?: number }) {
    for (let j = Math.floor(n - r); j <= Math.ceil(n + r); j++) for (let i = Math.floor(e - r); i <= Math.ceil(e + r); i++) {
      const d = Math.hypot(i + 0.5 - e, j + 0.5 - n); if (d >= r) continue;
      const f = Math.pow(1 - (d / r) ** 2, 1.5), c = this.cell(i + 0.5, j + 0.5, true); if (!c) continue; const [t, k] = c;
      const a = (o.soot ?? 0) * f, s = (o.stain ?? 0) * f, w = (o.wear ?? 0) * f;
      if (o.y !== undefined && a + s > t[k + 4]) { t[k + 1] = o.y; t[k + 4] = a + s; }
      t[k] = 1 - (1 - t[k]) * (1 - a); t[k + 3] = 1 - (1 - t[k + 3]) * (1 - s); t[k + 2] = Math.max(t[k + 2], w);
    }
  }
  /** a band of half-width hw along a polyline (grid e, n), wear `w` at its middle falling to 0 at its edges (max) */
  band(pts: [number, number][], hw: number, w: number) {
    for (let s = 1; s < pts.length; s++) { const [a, b] = [pts[s - 1], pts[s]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-3) continue;
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
      // D-392 (s15/load): the segment in pieces of <= 4 m, each piece's own box (a long diagonal's one box was most of the
      // cells, ~5 s of the build); a cell seen twice takes the same max again (the distance is to the whole segment)
      const np = Math.max(1, Math.ceil(L / 4));
      for (let q = 0; q < np; q++) { const c0x = a[0] + ux * L * q / np, c0y = a[1] + uy * L * q / np, c1x = a[0] + ux * L * (q + 1) / np, c1y = a[1] + uy * L * (q + 1) / np;
      for (let j = Math.floor(Math.max(Math.min(a[1], b[1]), Math.min(c0y, c1y)) - hw); j <= Math.ceil(Math.min(Math.max(a[1], b[1]), Math.max(c0y, c1y)) + hw); j++) for (let i = Math.floor(Math.max(Math.min(a[0], b[0]), Math.min(c0x, c1x)) - hw); i <= Math.ceil(Math.min(Math.max(a[0], b[0]), Math.max(c0x, c1x)) + hw); i++) {
        const px = i + 0.5 - a[0], py = j + 0.5 - a[1], t = px * ux + py * uy; if (t < -hw || t > L + hw) continue;
        const d = t < 0 ? Math.hypot(px, py) : t > L ? Math.hypot(px - ux * L, py - uy * L) : Math.abs(px * uy - py * ux); if (d >= hw) continue;
        const c = this.cell(i + 0.5, j + 0.5, true); if (!c) continue; const [T, k] = c; T[k + 2] = Math.max(T[k + 2], w * (1 - (d / hw) ** 2));
      } } }
  }
}

/** the sources the map is built from (all optional; world.ts passes what the world built) */
export interface GrimeSources {
  /** every fire of the fire system: world position of the flame (x, y, z = âˆ’n) and its kind */
  fires?: { kind: string; pos: { x: number; y: number; z: number } }[];
  /** the town's street doors (settlement/houses.ts StreetDoor): hinge (grid), the leaf's closed yaw (world), threshold y, height */
  doors?: { hinge: [number, number]; closedYaw: number; y: number; h: number }[];
  /** the town plan: its sites (lanes and street doors for the walked wear; wells and troughs for the damp) and roads */
  town?: { sites: any[]; roads: { pts: [number, number][]; width: number }[] } | null;
  /** ground height at grid (e, n) */
  ground?: (e: number, n: number) => number;
}
/** soot (walls and ceilings above the flame), its radius, and the ash trodden round it (C: a hearth blackens its room's walls and
 *  ceiling and the floor round it is grey with ash; a wall torch and a lamp leave a tongue of soot above them; an oven its mouth) */
export const SOOT_OF: Record<string, { r: number; soot: number; ash: number; ashR: number }> = {
  hearth: { r: 3.6, soot: 0.95, ash: 0.75, ashR: 1.3 }, oven: { r: 1.8, soot: 0.85, ash: 0.6, ashR: 1.4 }, kiln: { r: 3.0, soot: 0.8, ash: 0.75, ashR: 2.6 },
  torch: { r: 0.8, soot: 0.8, ash: 0, ashR: 0 }, brazier: { r: 1.3, soot: 0.45, ash: 0.35, ashR: 1.3 }, lamp: { r: 0.55, soot: 0.4, ash: 0, ashR: 0 }, altar: { r: 1.6, soot: 0.5, ash: 0.5, ashR: 1.6 },
};
/** the narrowest soot stamp (m): a disc under ~1.3 m between 1 m cells reads back at a fraction of its strength */
export const SOOT_MIN_R = 1.3;
export const OPEN_CODES = new Set([-1, -2, -3, -4]); // site.ts OUT, LANE, FREE, SQUARE
/** the walked wear of one site's lanes: from each plot's street door the shortest way (4-neighbour, open cells) to the site's edge,
 *  every cell on it counted once per door; returns per cell the count (0 where no one passes) */
export function laneFlow(s: { W: number; H: number; cell: Int32Array; plots: { door: { cell: number; out: number } | null }[] }): Float32Array {
  const { W, H, cell } = s, N = W * H, dist = new Int32Array(N).fill(-1), next = new Int32Array(N).fill(-1), q = new Int32Array(N), flow = new Float32Array(N);
  const open = (k: number) => OPEN_CODES.has(cell[k]);
  let qh = 0, qt = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if ((i === 0 || j === 0 || i === W - 1 || j === H - 1)) { const k = j * W + i; if (open(k)) { dist[k] = 0; q[qt++] = k; } }
  while (qh < qt) { const k = q[qh++], i = k % W, j = (k / W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const kk = jj * W + ii;
      if (dist[kk] >= 0 || !open(kk)) continue; dist[kk] = dist[k] + 1; next[kk] = k; q[qt++] = kk; } }
  for (const p of s.plots) { if (!p.door) continue; let k = p.door.out; if (k < 0 || k >= N || dist[k] < 0) continue;
    for (let g = 0; k >= 0 && g < N; g++) { flow[k] += 1; k = next[k]; } }
  return flow;
}
/** per cell, the distance (m, 4-neighbour steps from cell centre to the nearest closed cell's edge: 0.5 next to a wall) to the nearest
 *  cell that is not open ground (a wall, a house): the lanes' walked middle and their edges by the walls */
export function wallDistance(s: { W: number; H: number; cell: Int32Array }): Float32Array {
  const { W, H, cell } = s, N = W * H, d = new Float32Array(N).fill(1e9), q = new Int32Array(N); let qh = 0, qt = 0;
  for (let k = 0; k < N; k++) if (!OPEN_CODES.has(cell[k])) { d[k] = -0.5; q[qt++] = k; }
  while (qh < qt) { const k = q[qh++], i = k % W, j = (k / W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const kk = jj * W + ii; if (d[kk] <= d[k] + 1) continue; d[kk] = d[k] + 1; q[qt++] = kk; } }
  return d;
}
/** wear (0..1) of a lane cell walked by `f` doors' households (a lane every household uses is trodden bare; C) */
export const wearOfFlow = (f: number, lane: boolean) => Math.max(lane ? 0.15 : 0, 1 - Math.exp(-f / 6));

/** the grime map from the world's sources (C throughout) */
export function grimeRaster(S: GrimeSources): GrimeRaster {
  const R = new GrimeRaster(), G = S.ground ?? (() => 0);
  for (const f of S.fires ?? []) { const k = SOOT_OF[f.kind]; if (!k) continue; const e = f.pos.x, n = -f.pos.z;
    R.disc(e, n, Math.max(k.r, SOOT_MIN_R), { soot: k.soot, y: f.pos.y }); // (the 1 m raster resolves no narrower tongue: a torch's or a lamp's widened to ~2.5 m, C)
    if (k.ash) R.disc(e, n, k.ashR, { stain: k.ash, y: f.pos.y }); }
  // the street doors: the house's smoke leaves through the doorway's top, a tongue of soot over the lintel (both faces: the vestibule's too)
  for (const d of S.doors ?? []) { const e = d.hinge[0] + Math.cos(d.closedYaw) * 0.5, n = d.hinge[1] + Math.sin(d.closedYaw) * 0.5; R.disc(e, n, 1.15, { soot: 0.55, y: d.y + d.h - 0.1 }); }
  const T = S.town;
  if (T) {
    for (const s of T.sites) {
      const flow = laneFlow(s), dW = wallDistance(s);
      for (let k = 0; k < s.W * s.H; k++) { const c = s.cell[k]; if (!OPEN_CODES.has(c)) continue; const lane = c === -2 || c === -4;
        const w = wearOfFlow(flow[k], lane) * (0.35 + 0.65 * Math.min(1, Math.max(0, (dW[k] - 0.6) / 1.0))); if (w <= 0.01) continue; const g = s.cellGrid(k); R.disc(g[0], g[1], 0.85, { wear: w }); }
      for (const p of s.plots) if (p.door) { // the threshold: worn by every going in and out
        const a = s.cellGrid(p.door.cell), b = s.cellGrid(p.door.out); R.disc((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 1.3, { wear: 0.85 }); }
      for (const f of s.fittings ?? []) if (f.kind === 'well' || f.kind === 'trough') { const g = s.grid(f.u, f.v); R.disc(g[0], g[1], f.kind === 'well' ? 2.6 : 1.6, { stain: 0.55, y: G(g[0], g[1]) }); }
    }
    for (const r of T.roads ?? []) R.band(r.pts, Math.max(1.2, r.width * 0.3), 0.6); // the roads: the trodden middle (wheels and feet)
  }
  return R;
}
/** the map into the textures (index: slot + 1 per tile; atlas: each tile with its border from the neighbours). Returns the tiles used */
export function uploadGrime(R: GrimeRaster): { tiles: number; dropped: number } {
  const M = GRIME_MAP, W = M.PER_ROW * ST, cap = M.PER_ROW * M.ROWS; idxData.fill(0); atlasData.fill(0);
  let slot = 0, dropped = 0;
  const keys = [...R.tiles.keys()].sort((a, b) => a - b);
  for (const key of keys) { if (slot >= cap) { dropped++; continue; } idxData[key] = slot + 1;
    const ti = key % M.IDX, tj = Math.floor(key / M.IDX), sx = (slot % M.PER_ROW) * ST, sy = Math.floor(slot / M.PER_ROW) * ST;
    for (let bj = 0; bj < ST; bj++) for (let bi = 0; bi < ST; bi++) {
      const e = M.E0 + ti * M.TILE + bi - 1 + 0.5, n = M.N0 + tj * M.TILE + bj - 1 + 0.5, c = R.at(e, n), o = ((sy + bj) * W + sx + bi) * 4;
      atlasData[o] = Math.round(255 * Math.min(1, c.soot)); atlasData[o + 1] = Math.round(255 * Math.min(1, Math.max(0, (c.y - M.Y0) / M.YS)));
      atlasData[o + 2] = Math.round(255 * Math.min(1, c.wear)); atlasData[o + 3] = Math.round(255 * Math.min(1, c.stain));
    }
    slot++; }
  IDX_TEX.needsUpdate = true; ATLAS_TEX.needsUpdate = true;
  return { tiles: slot, dropped };
}
/** build and upload the map (world.ts, once the fires, the town and the plain are built) */
/** D-392: with bakeKey (the world's inputs: seed, quality, settings), the maps read from the baked world when unchanged */
export function buildGrime(S: GrimeSources, bakeKey?: string) { const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const hit = bakeKey ? cacheGetSync<{ idx: Float32Array; atlas: Uint8Array; tiles: number; dropped: number }>('grime', bakeKey) : null;
  let u: { tiles: number; dropped: number };
  if (hit && hit.idx.length === idxData.length && hit.atlas.length === atlasData.length) { idxData.set(hit.idx); atlasData.set(hit.atlas); IDX_TEX.needsUpdate = true; ATLAS_TEX.needsUpdate = true; u = { tiles: hit.tiles, dropped: hit.dropped }; }
  else { u = uploadGrime(grimeRaster(S)); if (bakeKey) cachePutSync('grime', bakeKey, { idx: idxData, atlas: atlasData, ...u }); }
  const info = { ...u, ms: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0) }; (globalThis as any).__parsaGrime = info; return info; }

// ------------------------------------------------------------------------------------------------ the nodes (GPU)
/** the map at the pixel (bilinear by hand): vec4(soot, source y 0..1, wear, stain); 0 outside every tile */
export function grimeSample(): any {
  const M = GRIME_MAP, p = positionWorld, e = p.x, n = p.z.negate();
  const gx = e.sub(M.E0).div(M.TILE), gy = n.sub(M.N0).div(M.TILE);
  const ti = clamp(floor(gx), 0, M.IDX - 1), tj = clamp(floor(gy), 0, M.IDX - 1);
  const slot = textureLoad(IDX_TEX, ivec2(int(ti), int(tj))).r, has = step(0.5, slot), s = slot.sub(1).max(0);
  const sx = s.sub(floor(s.div(M.PER_ROW)).mul(M.PER_ROW)).mul(ST), sy = floor(s.div(M.PER_ROW)).mul(ST);
  // texel space inside the stored tile (texel centres at +0.5; the border shifts by one): u in [0.5, 32.5]
  const u = clamp(gx.sub(ti).mul(M.TILE).add(0.5), 0.5, M.TILE + 0.5), v = clamp(gy.sub(tj).mul(M.TILE).add(0.5), 0.5, M.TILE + 0.5);
  const iu = floor(u), iv = floor(v), fu = fract(u), fv = fract(v);
  const at = (du: number, dv: number) => textureLoad(ATLAS_TEX, ivec2(int(sx.add(iu).add(du)), int(sy.add(iv).add(dv))));
  const a = mix(at(0, 0), at(1, 0), fu), b = mix(at(0, 1), at(1, 1), fu);
  return mix(a, b, fv).mul(has);
}

/** grime classes by surface (what each kind of surface takes) */
export type GrimeClass = 'stone' | 'plaster' | 'ground' | 'floor' | 'timber' | 'none';
const CLASS: Record<string, GrimeClass> = {
  limestone: 'stone', limestone_merlon: 'stone', limestone_carved: 'stone', limestone_dark: 'stone', frame_coat: 'stone', terrace: 'stone', terrace_foot: 'stone', terrace_now: 'stone', stone_rough: 'stone',
  stone_plain: 'stone', takht_stone: 'stone', nr_dressed: 'stone', nr_rock: 'stone', rubble: 'stone', kaba_white: 'stone', house_socle: 'stone',
  mudbrick: 'plaster', mudbrick_painted: 'plaster', palace_plaster: 'plaster', mudbrick_bare: 'plaster', plaster: 'plaster', mud_plaster: 'plaster', house_plaster: 'plaster', house_brick: 'plaster', baked_brick: 'plaster', village_mud: 'plaster',
  roof_earth: 'plaster', mud_roof: 'plaster', house_roof: 'plaster', matting: 'plaster',
  earth: 'ground', court_fill: 'ground', road: 'ground', bank: 'ground', refuse: 'ground',
  plaster_red: 'floor', timber: 'timber', roof_timber: 'timber', house_timber: 'timber', door_planks: 'timber', scaffold: 'timber',
};
export const grimeClass = (name: string): GrimeClass => CLASS[name] ?? 'none';
/** drift 1Ïƒ (fraction of the albedo) at 100 m, 10 m and 1 m, and the warm/cool shift, per class (C). The 1 m octave only where the
 *  surface has no broad tone of its own (SurfaceDef.tone, D-157) */
export const DRIFT: Record<Exclude<GrimeClass, 'none'>, { a100: number; a10: number; a1: number; chroma: number }> = {
  stone: { a100: 0.05, a10: 0.055, a1: 0.025, chroma: 0.012 }, plaster: { a100: 0.06, a10: 0.07, a1: 0.035, chroma: 0.015 },
  ground: { a100: 0.07, a10: 0.065, a1: 0.04, chroma: 0.02 }, floor: { a100: 0.03, a10: 0.03, a1: 0.02, chroma: 0.008 }, timber: { a100: 0.04, a10: 0.05, a1: 0.03, chroma: 0.015 },
};
/** D-752 (holes.md #6): none on the 467 Terrace's own stone (15-50 years from the quarry, kept by a court; the foot's rough blocks a
 *  trace). Was: lichen's cover inside its patches (share of the area, C): the Terrace's open retaining walls and the fieldstone footings most, the
 *  palaces' dressed walls a little, the carved and polished stone none; the ruin (Now view) and the living rock much more */
export const LICHEN: Record<string, number> = { terrace: 0, terrace_foot: 0.03, limestone: 0, stone_plain: 0.1, takht_stone: 0.1, house_socle: 0.12, rubble: 0.15, nr_rock: 0.22, terrace_now: 0.3 };
const MX_SD = 0.265; // the measured 1Ïƒ of mx_noise_float (materials.ts MX_NOISE_SD)
/** soot's linear albedo (wood soot on plaster, C) and the ash's (grey with charcoal) */
export const SOOT_ALB: [number, number, number] = [0.028, 0.025, 0.023], ASH_ALB: [number, number, number] = [0.13, 0.125, 0.118], DAMP_K = 0.22;
/** the layer with the grime laid over it: `hasTone` (the surface's own broad tone stands for the 1 m octave), `macro` (a ground with
 *  its own 30/12 m tone: the drift's 10 m octave at half) */
export function applyGrime<L extends { alb: any; rough: any; height: any | null }>(name: string, L: L, o: { hasTone?: boolean; macro?: boolean; /** the up-facing faces are another surface of the ground class (the Terrace's court fill) */ topGround?: boolean } = {}): L {
  const cls = grimeClass(name); if (cls === 'none' || !grimeBuild) return L;
  const D = DRIFT[cls], p = positionWorld, nW = normalWorld;
  // the drift: 2-D at 100 m (it does not change up a wall), 3-D at 10 m and 1 m, in a frame turned off the world's axes
  const q = vec3(dot(p, vec3(0.89157, -0.37121, 0.25944)), dot(p, vec3(0.45289, 0.73077, -0.51075)), dot(p, vec3(0, 0.57287, 0.81965)));
  const fp = fwidth(p).length().max(1e-6);
  const o100 = mx_noise_float(vec2(p.x, p.z).div(100).add(vec2(13.7, 4.1)));
  const o10 = mx_noise_float(q.div(10).add(vec3(5.3, 9.1, 2.7)));
  let f: any = o100.mul(D.a100).add(o10.mul(o.macro ? D.a10 * 0.5 : D.a10));
  if (!o.hasTone) f = f.add(mx_noise_float(q.div(1.1).add(vec3(1.9, 7.7, 3.3))).mul(D.a1).mul(float(1).sub(smoothstep(0.15, 0.35, fp.div(1.1)))));
  f = f.div(MX_SD).mul(GRIME_ON);
  const ch = o10.mul(D.chroma / MX_SD).add(o100.mul(D.chroma / MX_SD * 0.7)).mul(GRIME_ON);
  let alb: any = L.alb.mul(vec3(float(1).add(f).add(ch), float(1).add(f), float(1).add(f).sub(ch.mul(1.3)))).max(0);
  let rough: any = L.rough, height: any = L.height;
  // the map
  const S = grimeSample(), ys = S.y.mul(GRIME_MAP.YS).add(GRIME_MAP.Y0), dy = p.y.sub(ys);
  const vert = float(1).sub(smoothstep(0.3, 0.7, abs(nW.y))), up = smoothstep(0.7, 0.9, nW.y), down = smoothstep(0.5, 0.8, nW.y.negate());
  if (cls !== 'ground') { // soot: on walls a tongue rising 1-4 m from the flame (streaked by the draught), under ceilings a spread
    const streak = smoothstep(0.15, 0.85, mx_noise_float(vec3(p.x.mul(2.3), p.y.mul(0.32), p.z.mul(2.3)).add(vec3(3.1, 0.7, 8.3))).mul(0.5).add(0.5)).mul(0.55).add(0.45);
    // (a hearth's smoke fills the room's upper half before it finds the door or the roof hole: the soot thickens with the height over the
    // flame, up to the ceiling; a torch's or lamp's is a tongue a metre or two tall, as its source is weak and its radius small)
    const plume = smoothstep(-0.25, 0.35, dy).mul(smoothstep(-0.6, 2.2, dy).mul(0.6).add(0.4)).mul(float(1).sub(smoothstep(float(1.6), float(5.5), dy.sub(S.x.mul(1.5))))).mul(streak).mul(vert);
    const ceil = down.mul(smoothstep(-0.1, 0.6, dy)).mul(float(1).sub(smoothstep(4, 8, dy)));
    const soot = S.x.mul(max(plume, ceil)).mul(GRIME_ON).clamp(0, 1);
    alb = mix(alb, vec3(...SOOT_ALB), float(1).sub(float(1).sub(soot).pow(2.5)).mul(0.9));
    rough = mix(rough, float(0.92), soot.mul(0.5));
  }
  if (cls === 'ground' || cls === 'floor' || o.topGround) { // the ground: ash and damp round the hearths, wells and troughs; the lanes' wear
    const near = float(1).sub(smoothstep(0.6, 1.4, abs(dy))); // (not on a roof over the hearth)
    const st = S.w.mul(up).mul(near).mul(GRIME_ON);
    alb = mix(alb, vec3(...ASH_ALB), st.mul(0.55));
    rough = mix(rough, float(0.97), st.mul(0.4));
    const w = S.z.mul(up).mul(GRIME_ON); // the walked lanes: the coarse grains kicked aside, the fines powdered and pressed: smoother,
    // a little lighter and greyer (dust) in the middle, the relief flattened (C)
    alb = alb.mul(vec3(float(1).add(w.mul(0.12)), float(1).add(w.mul(0.12)), float(1).add(w.mul(0.16))));
    rough = rough.mul(float(1).sub(w.mul(0.15)));
    if (height) height = height.mul(float(1).sub(w.mul(0.6)));
  }
  else if (cls === 'plaster') { // ash trodden into a room's earthen floor round its hearth (up-facing, at the hearth's level: not a roof over it)
    const st = S.w.mul(up).mul(float(1).sub(smoothstep(0.6, 1.4, abs(dy)))).mul(GRIME_ON);
    alb = mix(alb, vec3(...ASH_ALB), st.mul(0.5));
  }
  if (cls === 'stone' && LICHEN[name]) { // lichen (C): crustose rosettes 2-6 cm in patches on the weathered stone, on walls (more on the
    // north faces: world z = âˆ’north, so a north face's normal has z < 0), none under a roof; band-limited to its mean cover where a
    // rosette spans under ~3 px. The 467 stone (â‰ˆ50 years from the quarry, D-230) takes a fraction of the ruin's
    const north = smoothstep(0.2, 0.8, nW.z.negate()).mul(0.65).add(0.35);
    const patch = smoothstep(0.55, 0.8, mx_noise_float(q.div(3.1).add(vec3(7.3, 1.1, 4.4))).mul(0.5).add(0.5).add(north.mul(0.2)).sub(0.1));
    const cover = patch.mul(LICHEN[name]).mul(vert).mul(float(1).sub(roofedNode())), r = cover.max(1e-4).div(Math.PI).sqrt();
    const cq = q.div(0.11), fq = fwidth(cq).length(), wv = mx_worley_noise_float(cq.add(vec3(2.2, 5.5, 1.7)));
    const ros = mix(float(1).sub(smoothstep(r.mul(0.8), r.mul(1.2), wv)).mul(step(1e-3, cover)), cover, smoothstep(0.25, 0.6, fq)).mul(GRIME_ON);
    const lichen = mix(vec3(0.36, 0.37, 0.32), vec3(0.42, 0.24, 0.07), step(0.85, fract(wv.mul(37.1).add(cq.x.floor().mul(0.37))))); // pale grey-green (linear), a few orange (Caloplaca-like)
    alb = mix(alb, lichen, ros.mul(0.65));
  }
  return { ...L, alb, rough, height };
}

/** CPU mirror of grimeSample() over the uploaded textures (tests: the map lands where its sources are; z = −n) */
export function grimeSampleCPU(x: number, z: number): [number, number, number, number] {
  const M = GRIME_MAP, e = x, n = -z, gx = (e - M.E0) / M.TILE, gy = (n - M.N0) / M.TILE;
  const ti = Math.min(M.IDX - 1, Math.max(0, Math.floor(gx))), tj = Math.min(M.IDX - 1, Math.max(0, Math.floor(gy)));
  const slot = idxData[tj * M.IDX + ti]; if (slot < 0.5) return [0, 0, 0, 0];
  const s = slot - 1, sx = (s % M.PER_ROW) * ST, sy = Math.floor(s / M.PER_ROW) * ST, W = M.PER_ROW * ST;
  const u = Math.min(M.TILE + 0.5, Math.max(0.5, (gx - ti) * M.TILE + 0.5)), v = Math.min(M.TILE + 0.5, Math.max(0.5, (gy - tj) * M.TILE + 0.5));
  const iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv;
  const at = (du: number, dv: number, c: number) => atlasData[((sy + iv + dv) * W + sx + iu + du) * 4 + c] / 255;
  return [0, 1, 2, 3].map(c => (at(0, 0, c) * (1 - fu) + at(1, 0, c) * fu) * (1 - fv) + (at(0, 1, c) * (1 - fu) + at(1, 1, c) * fu) * fv) as [number, number, number, number];
}
/** tests: build the materials without the grime layer (a shader-size comparison) */
export let grimeBuild = true;
export function setGrimeBuild(on: boolean) { grimeBuild = on; }
