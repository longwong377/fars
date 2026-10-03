// The limestone's ledges as continuous strips of rock (session 12, D-335). The terrain shader draws, on every cliff-forming
// package of beds, its resistant top bed as a riser band (terrainPlain.ts: HILL.pkg, cliffShare, riser; pinched out along the
// strike by a noise and cut by the gullies). Here that same riser stands up as geometry: along the riser's foot (the contour
// of the stratigraphic height at the band's lower edge, found by marching squares on a 2 m grid) a strip of rock runs with
// the contour, a face 1.6-4.2 m high leaning back a little, a rounded lip, and a tread back into the slope, its height
// following the strike noise so each ledge pinches out and resumes as the band does (and dies into the ground where a gully
// cuts it). The face wears a scanned bedded cliff (Poly Haven coastal_cliff_04, CC0), baked in Blender from the front into
// albedo, normal and relief maps (tools/blender/land_ledgeface.py): near the viewer the relief moves the face's vertices
// (the strata's overhangs and recesses as geometry, casting shadow), farther off the normal map carries it.
// Every tile's strips are built once (cached); the drawn geometry is the tiles within reach merged into two meshes (near:
// fine and displaced; far: coarse), rebuilt as the viewer moves. Tiers: the bedding B (KR-BEDROCK), each ledge's place C.
import * as THREE from 'three/webgpu';
import { texture, uv, vec3, dot, attribute, float, uniform, positionLocal, smoothstep, distance, mix, normalMap, normalView } from 'three/tsl';
import { groundScan } from '../../render/scans';
import { HILL } from '../plain/terrainPlain';
import { stratY, cliffPkg, riserBreak, type BedrockEnv } from './bedrock';
import { TERRACE_BOX } from '../plain/townGround';
import { BASE } from '../../core/base';

/** reach (m): strips drawn to R, fine (displaced) within NEAR; tile (m, as the bedrock's), grid step (m); rebuild step (m) */
export const LEDGES = { R: 1600, NEAR: 95, CAST: 600, /** solid (player colliders) within */ SOLID: 45, tile: 64, step: 4, moveM: 25, budgetMs: 6 } as const;
/** the strip's form (C): face height range (m) by package, its lean back (m per m of height), the lip, the buried foot; the
 *  strike noise's thresholds for presence; the face's share of the baked image's height (the rest is the ground above) */
export const LEDGE_FORM = { h: [1.6, 4.2] as [number, number], lean: 0.14, lip: 0.45, footOut: 0.5, footDown: 0.4, brk: [0.5, 0.85] as [number, number], minSlope: 0.26, fullSlope: 0.5, faceV: 0.93 } as const;
const CLEAR = { e0: TERRACE_BOX.e0 - 60, e1: TERRACE_BOX.e1 + 90, n0: TERRACE_BOX.n0 - 60, n1: TERRACE_BOX.n1 + 60 };
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function h32(...v: number[]) { let h = 2166136261 >>> 0; for (const x of v) { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; } return h >>> 0; }
const u01 = (...v: number[]) => h32(...v) / 4294967296;

/** one ledge run in a tile: its points (world x, z), the package, and per point the face height (m, 0 where pinched out) */
export interface LedgeRun { k: number; pts: [number, number][]; h: number[] }
/** the runs of a tile (ti, tj: world x, z / tile): polylines of the riser foot of every cliff package crossing it, clipped to
 *  the tile (a run crossing the tile's edge meets its neighbour's at the same point: the grids share the edge's samples) */
export function ledgeRuns(env: BedrockEnv, ti: number, tj: number, seed: number): LedgeRun[] {
  const T = LEDGES.tile, G = LEDGES.step, n = T / G + 1, x0 = ti * T, z0 = tj * T, out: LedgeRun[] = [];
  let smax = 0; for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const x = x0 + i * T / 4, z = z0 + j * T / 4, d = 4;
    smax = Math.max(smax, Math.hypot(env.ground(x + d, z) - env.ground(x - d, z), env.ground(x, z + d) - env.ground(x, z - d)) / (2 * d)); }
  if (smax < LEDGE_FORM.minSlope * 0.8) return out;
  const S = new Float32Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const x = x0 + c * G, z = z0 + r * G; S[r * n + c] = stratY(x, env.ground(x, z), z); }
  let lo = Infinity, hi = -Infinity; for (const v of S) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let k = Math.floor(lo / HILL.pkg); k <= Math.floor(hi / HILL.pkg); k++) {
    if (!cliffPkg(k)) continue;
    const level = HILL.pkg * (k + 1 - HILL.riser);
    // marching squares: a segment per crossed cell between two edge points, keyed by the grid edge (h: row edge, v: column edge)
    const P = new Map<string, [number, number]>(), adj = new Map<string, string[]>();
    const ek = (r: number, c: number, horiz: boolean) => `${horiz ? 'h' : 'v'}${r}:${c}`;
    const cross = (r: number, c: number, horiz: boolean): string | null => {
      const a = S[r * n + c], b = horiz ? S[r * n + c + 1] : S[(r + 1) * n + c];
      if ((a - level) * (b - level) >= 0) return null; const t = (level - a) / (b - a), key = ek(r, c, horiz);
      if (!P.has(key)) P.set(key, horiz ? [x0 + (c + t) * G, z0 + r * G] : [x0 + c * G, z0 + (r + t) * G]); return key;
    };
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const e = [cross(r, c, true), cross(r, c + 1, false), cross(r + 1, c, true), cross(r, c, false)].filter((x): x is string => !!x);
      const link = (a: string, b: string) => { (adj.get(a) ?? adj.set(a, []).get(a)!).push(b); (adj.get(b) ?? adj.set(b, []).get(b)!).push(a); };
      if (e.length === 2) link(e[0], e[1]); else if (e.length === 4) { link(e[0], e[1]); link(e[2], e[3]); } // (a saddle: either pairing; C)
    }
    // chains: start at the ends (a point with one neighbour), then any loop left
    const seen = new Set<string>();
    const walk = (s: string) => { const chain = [s]; seen.add(s); let cur = s;
      for (;;) { const nx = (adj.get(cur) ?? []).find(q => !seen.has(q)); if (!nx) break; chain.push(nx); seen.add(nx); cur = nx; }
      return chain; };
    const chains: string[][] = [];
    for (const [key, nb] of adj) if (nb.length === 1 && !seen.has(key)) chains.push(walk(key));
    for (const key of adj.keys()) if (!seen.has(key)) chains.push(walk(key));
    for (const ch of chains) {
      if (ch.length < 2) continue;
      const pts = ch.map(q => P.get(q)!);
      // the face height along the run: the package's own height, the strike noise's pinch-outs, the slope (a riser needs a
      // slope to stand on), the gullies' cuts, trodden ground and the Terrace kept clear
      const Hk = LEDGE_FORM.h[0] + (LEDGE_FORM.h[1] - LEDGE_FORM.h[0]) * u01(seed, k, 91);
      const h = pts.map(([x, z]) => {
        const e = x, nn = -z; if (e > CLEAR.e0 && e < CLEAR.e1 && nn > CLEAR.n0 && nn < CLEAR.n1) return 0;
        const d = 3, s = Math.hypot(env.ground(x + d, z) - env.ground(x - d, z), env.ground(x, z + d) - env.ground(x, z - d)) / (2 * d);
        const w = smooth(LEDGE_FORM.brk[0], LEDGE_FORM.brk[1], riserBreak(x, z, k)) * smooth(LEDGE_FORM.minSlope, LEDGE_FORM.fullSlope, s)
          * (1 - smooth(0.25, 0.55, env.gully?.(x, z) ?? 0)) * (1 - smooth(0.2, 0.4, env.trodden?.(x, z) ?? 0));
        return Hk * w * (0.8 + 0.4 * u01(seed, k, Math.round(x / 6), Math.round(z / 6), 92));
      });
      if (h.some(v => v > 0.3)) out.push({ k, pts, h });
    }
  }
  return out;
}

/** the face maps as the page loads them (ledgeface_*.png; null in node or when absent: the strips draw undisplaced) */
export interface LedgeFace { map: THREE.Texture; normal: THREE.Texture; relief: { data: Uint8ClampedArray; w: number; h: number } | null; width_m: number; height_m: number; relief_m: number; mean: [number, number, number] }
let FACE: LedgeFace | null = null;
export const ledgeFace = () => FACE;
export function _setLedgeFace(f: LedgeFace | null) { FACE = f; }
export async function loadLedgeFace(base = BASE): Promise<LedgeFace | null> {
  try {
    const meta = await (await fetch(base + 'models/land/ledgeface.json')).json(), tl = new THREE.TextureLoader();
    const [map, normal, hImg] = await Promise.all([tl.loadAsync(base + 'models/land/ledgeface_diff.jpg'), tl.loadAsync(base + 'models/land/ledgeface_nor.jpg'), tl.loadAsync(base + 'models/land/ledgeface_height.png')]);
    map.colorSpace = THREE.SRGBColorSpace;
    for (const t of [map, normal]) { t.wrapS = THREE.MirroredRepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; t.needsUpdate = true; }
    let relief: LedgeFace['relief'] = null, mean: [number, number, number] = [0.2, 0.2, 0.2];
    try { const im = hImg.image as HTMLImageElement, cv = new OffscreenCanvas(im.width, im.height), g = cv.getContext('2d')!; g.drawImage(im, 0, 0); relief = { data: g.getImageData(0, 0, im.width, im.height).data, w: im.width, h: im.height };
      const mi = map.image as HTMLImageElement, c2 = new OffscreenCanvas(16, 16), g2 = c2.getContext('2d')!; g2.drawImage(mi, 0, 0, 16, 16); const d = g2.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, b = 0;
      const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; for (let i = 0; i < d.length; i += 4) { r += lin(d[i]); gg += lin(d[i + 1]); b += lin(d[i + 2]); } mean = [r / 256, gg / 256, b / 256];
    } catch { /* no relief: normal map only */ }
    FACE = { map, normal, relief, width_m: meta.width_m, height_m: meta.height_m, relief_m: meta.relief_range_m ?? 1.2, mean };
  } catch (e) { console.warn('[ledges] no face maps:', (e as Error).message); FACE = null; }
  return FACE;
}
/** the relief at face (u, v) (u in image widths, mirrored; v 0 foot .. 1 top): 0..1, 0.5 when unknown */
function reliefAt(f: LedgeFace | null, u: number, v: number): number {
  const R = f?.relief; if (!R) return 0.5;
  const m = ((u % 2) + 2) % 2, uu = m > 1 ? 2 - m : m, x = Math.min(R.w - 1, Math.max(0, Math.round(uu * (R.w - 1)))), y = Math.min(R.h - 1, Math.max(0, Math.round((1 - v) * (R.h - 1))));
  return R.data[(y * R.w + x) * 4] / 255;
}

/** the strip geometry of runs: positions, normals (computed), uv, colour (palette tint x occlusion). fine: 0.5 m along, eight
 *  face rows and the relief as displacement; coarse: every run point (~2 m), three face rows */
export function stripGeometry(runs: LedgeRun[], env: BedrockEnv, seed: number, fine: boolean, face: LedgeFace | null = ledgeFace()): { pos: Float32Array; uv: Float32Array; col: Float32Array; disp: Float32Array; idx: Uint32Array } {
  const pos: number[] = [], uvs: number[] = [], col: number[] = [], disp: number[] = [], idx: number[] = [];
  const F = LEDGE_FORM, faceRows = fine ? 8 : 3, uLen = (face ? face.width_m / face.height_m : 9.7); // the image's width in its heights
  const tint = new THREE.Color();
  for (const run of runs) {
    // resample (fine: 0.5 m)
    let P = run.pts, H = run.h;
    if (fine) { const q: [number, number][] = [], qh: number[] = [];
      for (let i = 1; i < P.length; i++) { const [ax, az] = P[i - 1], [bx, bz] = P[i], L = Math.hypot(bx - ax, bz - az), m = Math.max(1, Math.ceil(L / 0.5));
        for (let j = 0; j < m; j++) { const t = j / m; q.push([ax + (bx - ax) * t, az + (bz - az) * t]); qh.push(H[i - 1] + (H[i] - H[i - 1]) * t); } }
      q.push(P[P.length - 1]); qh.push(H[H.length - 1]); P = q; H = qh; }
    const Hk = Math.max(...run.h) || 1, u0 = u01(seed, run.k, Math.round(P[0][0]), Math.round(P[0][1]), 93) * 20;
    // colour: the limestone palette by package, the weathered rock toward the fresher, paler scree tone (probe b4: toward
    // rockDark the faces read as a red-brown wall along the mountain's foot; the scan's own shading darkens its recesses), C
    const a = u01(seed, run.k, 94), P0 = HILL.rock, P1 = HILL.scree, m = 0.2 + a * 0.5;
    tint.setRGB(P0[0] + (P1[0] - P0[0]) * m, P0[1] + (P1[1] - P0[1]) * m, P0[2] + (P1[2] - P0[2]) * m, THREE.SRGBColorSpace);
    let arc = 0; const base = pos.length / 3, rows = faceRows + 3; // foot, face rows (base .. top), lip, tread end
    for (let i = 0; i < P.length; i++) {
      const [x, z] = P[i]; if (i) arc += Math.hypot(x - P[i - 1][0], z - P[i - 1][1]);
      // downhill (horizontal unit) from the ground's gradient over ±3 m
      const d = 3, gx = (env.ground(x + d, z) - env.ground(x - d, z)) / (2 * d), gz = (env.ground(x, z + d) - env.ground(x, z - d)) / (2 * d), s = Math.hypot(gx, gz) || 1e-3;
      const dx = -gx / s, dz = -gz / s, g0 = env.ground(x, z), h = H[i], u = u0 + arc / (uLen * Hk * 1.0 / F.faceV) ;
      const put = (px: number, py: number, pz: number, vv: number, ao: number, ox = 0, oz = 0) => { pos.push(px, py, pz); uvs.push(u, vv); col.push(tint.r * ao, tint.g * ao, tint.b * ao); disp.push(ox, 0, oz); };
      // foot: out in front, buried
      put(x + dx * F.footOut, env.ground(x + dx * F.footOut, z + dz * F.footOut) - F.footDown, z + dz * F.footOut, 0, 0.55);
      // the face: from the ground up to its top, leaning back; the relief pushes it out (fine only)
      for (let j = 0; j < faceRows; j++) { const f = j / (faceRows - 1), vv = f * F.faceV, back = f * h * F.lean;
        // the scan's relief (m about its local mean) at the ledge's scale (this face's height over the image's)
        const out = fine && face ? (reliefAt(face, u, vv) - 0.5) * 2 * face.relief_m * (h / face.height_m) * Math.min(1, f * 4) : 0;
        // (D-600: the relief is an offset the shader fades out toward LEDGES.NEAR, so the fine strip meets the coarse one
        // with no pop; it was baked into the position and dropped at the tile's switch: up to 0.58 m, ~8 px at 70 m)
        put(x - dx * back, g0 - 0.05 + f * h, z - dz * back, vv, 0.6 + 0.4 * f, dx * out, dz * out); }
      // the lip, rounded back over the top
      const bt = h * F.lean + F.lip * Math.min(1, h);
      put(x - dx * bt, g0 + h + 0.03 * Math.min(1, h), z - dz * bt, F.faceV + 0.06, 1);
      // the tread: back into the slope until it is buried (where the rising ground meets the top), then under it
      const w = Math.min(12, Math.max(1, (h + 0.3) / s)), tx = x - dx * (bt + w), tz = z - dz * (bt + w);
      put(tx, Math.min(g0 + h, env.ground(tx, tz)) - 0.3, tz, 1, 0.9);
      if (i && Math.max(H[i - 1], H[i]) > 0.12) { const s0 = base + (i - 1) * rows, s1 = base + i * rows; // (no quads where the ledge is pinched out)
        for (let r = 0; r < rows - 1; r++) idx.push(s0 + r, s1 + r, s0 + r + 1, s0 + r + 1, s1 + r, s1 + r + 1); }
    }
  }
  return { pos: new Float32Array(pos), uv: new Float32Array(uvs), col: new Float32Array(col), disp: new Float32Array(disp), idx: new Uint32Array(idx) };
}

/** D-600: the viewer the strips' fades are measured from (set by Ledges.update every frame; the shadow pass sees the same) */
export const LEDGE_VIEWER = uniform(new THREE.Vector3(1e7, 0, 1e7));
/** the fades by the vertex's distance from the viewer (m): the relief offset full to 0.5 NEAR, gone by 0.9 NEAR (the
 *  fine strips are drawn for tiles within NEAR at each rebuild, so a tile is coarse no nearer than NEAR - moveM = 70 m and its
 *  relief is 0 there; NEAR was 70 m before D-600); the far end:
 *  sunk SINK m into the ground over the last 15 % of R (the tiles were dropped whole every 25 m: a 5 m face, ~3 px at 1.6 km) */
export const LEDGE_FADE = { relief: [0.37, 0.72] as [number, number], far: [0.85, 1] as [number, number], sink: 7 } as const;
export const reliefShare = (d: number) => 1 - smooth(LEDGES.NEAR * LEDGE_FADE.relief[0], LEDGES.NEAR * LEDGE_FADE.relief[1], d);
export const farSink = (d: number) => LEDGE_FADE.sink * smooth(LEDGES.R * LEDGE_FADE.far[0], LEDGES.R * LEDGE_FADE.far[1], d);
const F_V = LEDGE_FORM.faceV;
function ledgeMaterial(face: LedgeFace | null): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const d = distance(positionLocal.xz, LEDGE_VIEWER.xz);
  const rel = float(1).sub(smoothstep(float(LEDGES.NEAR * LEDGE_FADE.relief[0]), float(LEDGES.NEAR * LEDGE_FADE.relief[1]), d));
  const sink = smoothstep(float(LEDGES.R * LEDGE_FADE.far[0]), float(LEDGES.R * LEDGE_FADE.far[1]), d).mul(LEDGE_FADE.sink);
  m.positionNode = positionLocal.add(attribute('disp', 'vec3').mul(rel)).sub(vec3(0, sink, 0)); // (no vertexColors: colorNode reads the colour itself; with the flag three multiplies it in twice)
  if (face) { const t = texture(face.map, uv()).rgb, meanY = Math.max(0.02, 0.2126 * face.mean[0] + 0.7152 * face.mean[1] + 0.0722 * face.mean[2]);
    // D-475 (s17 V8): the lip and the tread (v over faceV) took the image's top rows, clamped and stretched over up to 12 m of
    // tread: the grey streaks of sb-town-from-rahmat. There the scree scan (world triplanar, the terrain's own layer) and the
    // geometric normal; the face keeps its baked image and normal map
    const tread = smoothstep(float(F_V), float(F_V + 0.05), uv().y), sc = groundScan('scree', 2.4, { tri: true }), st = groundScan('stony', 3.0, { tri: true });
    const faceK = dot(t, vec3(0.2126, 0.7152, 0.0722)).div(meanY).clamp(0, 1.7), treadK = sc.c.mul(st.c).clamp(0, 1.8);
    m.colorNode = attribute('color', 'vec3').mul(mix(vec3(faceK), treadK, tread));
    m.normalNode = (mix(normalMap(texture(face.normal, uv())) as any, normalView, tread) as any).normalize(); } // (clamped: the lit bed tops read as white patches at 2.2)
  else m.colorNode = attribute('color', 'vec3').mul(float(1));
  m.name = 'ledges'; return m;
}

export class Ledges {
  readonly group = new THREE.Group();
  readonly near: THREE.Mesh; readonly mid: THREE.Mesh; readonly far: THREE.Mesh;
  private runs = new Map<number, LedgeRun[]>(); private strips = new Map<string, ReturnType<typeof stripGeometry>>();
  private last = { x: 1e9, z: 1e9 }; private pending = false; private budgetT = 0;
  stats = { tiles: 0, runs: 0, nearTris: 0, midTris: 0, farTris: 0, ms: 0 };
  /** the player's colliders of the near strips (a face is a wall: the walker goes round by the gaps), per tile */
  private solids = new Map<string, any>();
  constructor(private env: BedrockEnv, private seed: number, face: LedgeFace | null = ledgeFace(), private phys: { addTrimesh(p: Float32Array, i: Uint32Array, u?: unknown): any; world: { removeCollider(c: any, wake: boolean): void } } | null = null) {
    this.group.name = 'ledges';
    const mat = ledgeMaterial(face);
    const mk = (name: string, cast = true) => { const g = new THREE.BufferGeometry(); const m = new THREE.Mesh(g, mat); m.name = name; m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; m.visible = false;
      m.userData = { tier: 'B/C', src: 'KR-BEDROCK;COP-DEM;POLYHAVEN-CC0', placeholder: !face, note: `the limestone's ledges (D-335): the cliff-forming beds' risers as rock strips along the strata${face ? ', faced with a scanned bedded cliff baked in Blender (Poly Haven coastal_cliff_04, CC0)' : ' (PLACEHOLDER: no face maps loaded, plain palette colour)'}; bedding B, each ledge C` };
      this.group.add(m); return m; };
    // near (fine, displaced) and mid (coarse) cast shadows; beyond the cascades' reach (LEDGES.CAST) the far set casts none
    this.near = mk('ledges:near'); this.mid = mk('ledges:mid'); this.far = mk('ledges:far', false);
  }
  private tileRuns(ti: number, tj: number): LedgeRun[] | null {
    const key = (ti + 32768) * 65536 + (tj + 32768); let r = this.runs.get(key);
    if (!r) { if (performance.now() > this.budgetT) { this.pending = true; return null; } if (this.runs.size > 8000) { this.runs.clear(); this.strips.clear(); } r = ledgeRuns(this.env, ti, tj, this.seed); this.runs.set(key, r); }
    return r;
  }
  private strip(ti: number, tj: number, fine: boolean, runs: LedgeRun[]) {
    const key = `${ti}:${tj}:${fine ? 1 : 0}`; let s = this.strips.get(key); if (!s) { s = stripGeometry(runs, this.env, this.seed, fine); this.strips.set(key, s); } return s;
  }
  /** D-680: swapped-out strip geometries, disposed two updates after the swap (never while a render list may still draw
   *  them: a geometry disposed mid-frame destroyed its buffers under the shadow pass, "used in submit while destroyed") */
  private retired: { g: THREE.BufferGeometry; at: number }[] = []; private tick = 0;
  update(cam: THREE.Vector3, force = false): boolean {
    LEDGE_VIEWER.value.copy(cam); this.tick++;
    if (this.retired.length) this.retired = this.retired.filter(r => { if (this.tick - r.at < 2) return true; r.g.dispose(); return false; });
    if (!force && !this.pending && Math.hypot(cam.x - this.last.x, cam.z - this.last.z) < LEDGES.moveM) return false;
    const t0 = performance.now(); this.last = { x: cam.x, z: cam.z }; this.pending = false; this.budgetT = force ? Infinity : t0 + LEDGES.budgetMs;
    const T = LEDGES.tile, R = LEDGES.R + LEDGES.moveM, parts: Record<'near' | 'mid' | 'far', ReturnType<typeof stripGeometry>[]> = { near: [], mid: [], far: [] };
    let tiles = 0, nr = 0;
    for (let ti = Math.floor((cam.x - R) / T); ti <= Math.floor((cam.x + R) / T); ti++) for (let tj = Math.floor((cam.z - R) / T); tj <= Math.floor((cam.z + R) / T); tj++) {
      const d = Math.hypot(Math.max(0, Math.abs((ti + 0.5) * T - cam.x) - T / 2), Math.max(0, Math.abs((tj + 0.5) * T - cam.z) - T / 2)); if (d > R) continue;
      const runs = this.tileRuns(ti, tj); if (!runs) continue; tiles++; if (!runs.length) continue; nr += runs.length;
      const fine = d < LEDGES.NEAR; (fine ? parts.near : d < LEDGES.CAST ? parts.mid : parts.far).push(this.strip(ti, tj, fine, runs));
      const sk = ti + ':' + tj;
      if (this.phys && d < LEDGES.SOLID && !this.solids.has(sk)) { const g = this.strip(ti, tj, true, runs); if (g.idx.length) { const p = g.pos.slice(); for (let i = 0; i < p.length; i++) p[i] += g.disp[i]; this.solids.set(sk, this.phys.addTrimesh(p, g.idx, { ledge: sk })); } } // (the relief in full: SOLID is inside the fade's start)
    }
    const merge = (m: THREE.Mesh, ps: ReturnType<typeof stripGeometry>[]) => {
      const nv = ps.reduce((a, p) => a + p.pos.length / 3, 0), ni = ps.reduce((a, p) => a + p.idx.length, 0);
      const pos = new Float32Array(nv * 3), uvA = new Float32Array(nv * 2), col = new Float32Array(nv * 3), disp = new Float32Array(nv * 3), idx = new Uint32Array(ni); let ov = 0, oi = 0;
      for (const p of ps) { pos.set(p.pos, ov * 3); uvA.set(p.uv, ov * 2); col.set(p.col, ov * 3); disp.set(p.disp, ov * 3); for (let i = 0; i < p.idx.length; i++) idx[oi + i] = p.idx[i] + ov; ov += p.pos.length / 3; oi += p.idx.length; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uvA, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('disp', new THREE.BufferAttribute(disp, 3));
      g.setIndex(new THREE.BufferAttribute(idx, 1)); if (nv) g.computeVertexNormals(); g.computeBoundingSphere();
      this.retired.push({ g: m.geometry, at: this.tick }); m.geometry = g; m.visible = ni > 0; return ni / 3;
    };
    if (this.phys) for (const [k, c] of this.solids) { const [ti, tj] = k.split(':').map(Number), d = Math.hypot(Math.max(0, Math.abs((ti + 0.5) * T - cam.x) - T / 2), Math.max(0, Math.abs((tj + 0.5) * T - cam.z) - T / 2));
      if (d > LEDGES.SOLID + 30) { this.phys.world.removeCollider(c, false); this.solids.delete(k); } }
    const nt = merge(this.near, parts.near), mt = merge(this.mid, parts.mid), ft = merge(this.far, parts.far);
    this.stats = { tiles, runs: nr, nearTris: nt, midTris: mt, farTris: ft, ms: Math.round(performance.now() - t0) };
    return true;
  }
}
