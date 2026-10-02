// The hills' bedrock standing as geometry (session 12, D-335; UD-19, UD-20, T-R12). Until now Kuh-e Rahmat and the other
// hills were the 30 m DEM's smooth surface with the rock drawn into its texture (terrainPlain.ts: the cliff packages' risers
// and benches, talus, aprons and fans, D-190/D-223/D-302): from the Terrace and the plain the mountain read as "a smooth
// dune" (sessions/s11.md). Here the same geology is built as real rock, from CC0 scans (Poly Haven; tools/blender/land_rocks.*,
// ASSET_LEDGER.md) re-tinted to the measured limestone palette (HILL, D-232/D-302):
//  - ledges: along every riser the shader draws (the resistant bed at the top of a cliff-forming package, where it is not
//    pinched out along the strike or cut by a gully), pieces of scanned cliff stand as a low cliff 2.3-4.2 m high, their
//    front downhill, their foot sunk into the bench below. The placement is the shader's own riser (the same stratigraphic
//    height, package hash, strike noise; CPU mirrors of its noise, mx_noise_cpu.ts), so the geometry stands on the band the
//    texture draws, and the pieces cover ~60 % of it (the gaps show the texture's rock);
//  - ground rock: bedrock outcrops and slabs on the convex hill ground, talus of fallen blocks on the bench under each riser,
//    and scree aprons in the gullies and under steep ground, tilted to the slope.
// Streamed round the viewer in 64 m tiles (ledges to R.ledge, ground rock to R.ground), each tile's rock computed once and
// cached; three levels per piece (lod2 shared by every ledge far off), shadows from the levels within the cascades' reach.
// Tiers: the limestone and its bedding B (KR-BEDROCK: the Terrace is cut from it); every ledge's and stone's place C.
import * as THREE from 'three/webgpu';
import { sharedDraco } from '../../render/loaders';
import { texture, uv, vec3, vec2, dot, attribute, float, uniform, positionLocal, smoothstep, distance } from 'three/tsl';
import type { Terrain } from '../../terrain/heightfield';
import { mxNoise3 } from '../../render/mx_noise_cpu';
import { pcg, unit } from '../plain/fields';
import { HILL } from '../plain/terrainPlain';
import { TERRACE_BOX } from '../plain/townGround';
import { BASE } from '../../core/base';

export type RockClass = 'ledge' | 'ground';
export interface RockPiece { id: string; cls: RockClass; size: [number, number, number]; lods: THREE.BufferGeometry[]; cell?: number }
export interface RockAtlas { map: THREE.Texture; normal: THREE.Texture; arm: THREE.Texture; mean: [number, number, number]; /** each 2x2 cell's mean luminance over the atlas's (a piece's colour is its own grain about the palette) */ cellK?: number[] }
export interface RockKit { ledge: RockPiece[]; ground: RockPiece[]; atlas: Partial<Record<RockClass, RockAtlas>> }

/** streaming radii (m) per class, level distances (m), the tile (m) and the rebuild step (m moved, deg turned) */
/** (D-600: the ground rock reaches 1 km, each piece only as far as it spans BEDROCK.farPx at the player's lens: 60 deg over
 *  1080 px, ~935 px a radian; it ended at 260 m for all, and the slopes beyond were texture only) */
export const BEDROCK = { R: { ledge: 1500, ground: 1000 }, farPx: 4, pxRad: 935, lod: [50, 260], castR: 600, tile: 64, step: 2, moveM: 20, turnDeg: 12, viewCone: 34, budgetMs: 6 } as const;
/** a riser's piece: its height (m, of the riser's 4.2 m of stratigraphic height), its sinking into the bench (share of the
 *  height), the pieces' share of the riser's length and their spacing (m) along it (C) */
export const LEDGE = { h: [2.3, 4.2] as [number, number], sink: 0.28, cover: 0.62, spacing: 5.5, minSlope: 0.22, fullSlope: 0.45 } as const;
/** ground rock per 16 m cell: the probability of an outcrop on convex hill ground, a talus heap under a riser, a scree apron (C) */
export const GROUND_ROCK = { cell: 16, outcrop: 0.3, talus: 0.6, scree: 0.3, size: { outcrop: [2.5, 6], slab: [3, 7], talus: [4, 8], scree: [5, 10] } } as const;
/** the Terrace, its E fortification on the mountain's foot and its approach: no rock drawn (m round TERRACE_BOX) */
const CLEAR = { e0: TERRACE_BOX.e0 - 60, e1: TERRACE_BOX.e1 + 90, n0: TERRACE_BOX.n0 - 60, n1: TERRACE_BOX.n1 + 60 };

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function h32(...v: number[]) { let h = 2166136261 >>> 0; for (const x of v) { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; } return h >>> 0; }
const u01 = (...v: number[]) => h32(...v) / 4294967296;

/** CPU mirror of the shader's stratigraphic height (terrainPlain.ts hillBase): world (x, y, z) */
export const stratY = (x: number, y: number, z: number) => y + (x * Math.cos(HILL.dipDir) + z * Math.sin(HILL.dipDir)) * HILL.dip + mxNoise3(x * 0.0031, 0.5, z * 0.0031) * 9;
/** the package k forms a cliff (its top HILL.riser is the riser): the shader's step(unitN(pcgN(k + 8192)), cliffShare) */
export const cliffPkg = (k: number) => unit(pcg((k + 8192) >>> 0)) <= HILL.cliffShare;
/** the riser's continuity along the strike (0..1, before the gully cut): the shader's `brk` */
export const riserBreak = (x: number, z: number, k: number) => smooth(-0.2, 0.25, mxNoise3(x * 0.011, k * 1.7 + 0.3, z * 0.011));

/** one placed piece: class, variant, world position, rotation (quaternion x, y, z, w), scale, colour (linear rgb) */
export interface RockSite { cls: RockClass; v: number; p: [number, number, number]; q: [number, number, number, number]; s: [number, number, number]; c: [number, number, number]; kind: string }
export interface BedrockEnv {
  /** the drawn ground's world y at world (x, z) */ ground(x: number, z: number): number;
  /** the gully strength 0..1 at world (x, z) (terrainDetail.ts R channel), when known */ gully?(x: number, z: number): number;
  /** the convexity (1/m, + convex) at world (x, z), when known */ curv?(x: number, z: number): number;
  /** trodden or built ground 0..1 (townGround.ts B; no rock where it is > 0.3), when known */ trodden?(x: number, z: number): number;
}
/** the measured limestone palette (terrainPlain.ts HILL, sRGB): rock, its dark weathered patches, fresh scree */
const PAL = [HILL.rock, HILL.rockDark, HILL.scree] as readonly (readonly number[])[];
const tintOf = (a: number, b: number, darkShare: number): [number, number, number] => {
  const P0 = PAL[0], P1 = PAL[a < darkShare ? 1 : 2], m = (a < darkShare ? a / darkShare : (a - darkShare) / (1 - darkShare)) * 0.7, f = 0.9 + 0.2 * b;
  const c = new THREE.Color().setRGB((P0[0] + (P1[0] - P0[0]) * m) * f, (P0[1] + (P1[1] - P0[1]) * m) * f, (P0[2] + (P1[2] - P0[2]) * m) * f, THREE.SRGBColorSpace);
  return [c.r, c.g, c.b];
};
const inClear = (x: number, z: number) => { const e = x, n = -z; return e > CLEAR.e0 && e < CLEAR.e1 && n > CLEAR.n0 && n < CLEAR.n1; };

/** the rock of one tile (ti, tj: world x, z / BEDROCK.tile), deterministic in (seed, tile). `kit` gives the pieces' sizes
 *  and variant counts (a node test may pass its own) */
export function bedrockTile(env: BedrockEnv, ti: number, tj: number, seed: number, sizes: { ledge: [number, number, number][]; ground: [number, number, number][] }): RockSite[] {
  const T = BEDROCK.tile, G = BEDROCK.step, x0 = ti * T, z0 = tj * T, n = T / G + 1, out: RockSite[] = [];
  // coarse slope test: flat tiles hold no rock
  let smax = 0; for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const x = x0 + i * T / 4, z = z0 + j * T / 4, d = 4;
    smax = Math.max(smax, Math.hypot(env.ground(x + d, z) - env.ground(x - d, z), env.ground(x, z + d) - env.ground(x, z - d)) / (2 * d)); }
  if (smax < 0.14) return out;
  // (the stratigraphic grid only for the ledge pieces: D-600, a ground-only tile costs ~1/4 without it)
  const nL = sizes.ledge.length, Y = new Float32Array(nL ? n * n : 0), S = new Float32Array(nL ? n * n : 0);
  if (nL) for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const x = x0 + c * G, z = z0 + r * G, y = env.ground(x, z); Y[r * n + c] = y; S[r * n + c] = stratY(x, y, z); }
  const slopeAt = (x: number, z: number) => { const d = 3; return { gx: (env.ground(x + d, z) - env.ground(x - d, z)) / (2 * d), gz: (env.ground(x, z + d) - env.ground(x, z - d)) / (2 * d) }; };
  const quatYaw = (yaw: number): [number, number, number, number] => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  const q = new THREE.Quaternion(), qa = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3();
  // ------------------------------------------------ ledges: marching squares on each cliff package's riser foot
  if (nL) for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const k0 = r * n + c, s00 = S[k0], s10 = S[k0 + 1], s01 = S[k0 + n], s11 = S[k0 + n + 1];
    const lo = Math.min(s00, s10, s01, s11), hi = Math.max(s00, s10, s01, s11);
    for (let k = Math.floor(lo / HILL.pkg); k <= Math.floor(hi / HILL.pkg); k++) {
      const level = HILL.pkg * (k + 1 - HILL.riser); if (level <= lo || level >= hi || !cliffPkg(k)) continue;
      // the level's crossings on the cell's edges (x, z world)
      const pts: [number, number][] = [], E: [number, number, number, number, number, number][] = [
        [s00, s10, 0, 0, 1, 0], [s10, s11, 1, 0, 1, 1], [s11, s01, 1, 1, 0, 1], [s01, s00, 0, 1, 0, 0]];
      for (const [a, b, ax, az, bx, bz] of E) if ((a - level) * (b - level) < 0) { const t = (level - a) / (b - a); pts.push([x0 + (c + ax + (bx - ax) * t) * G, z0 + (r + az + (bz - az) * t) * G]); }
      if (pts.length < 2) continue;
      const L = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
      const hsh = [seed, ti, tj, r, c, k];
      const t = u01(...hsh, 1), x = pts[0][0] + (pts[1][0] - pts[0][0]) * t, z = pts[0][1] + (pts[1][1] - pts[0][1]) * t;
      if (inClear(x, z)) continue;
      const { gx, gz } = slopeAt(x, z), s = Math.hypot(gx, gz);
      const gully = env.gully?.(x, z) ?? 0, trod = env.trodden?.(x, z) ?? 0;
      const p = (L / LEDGE.spacing) * LEDGE.cover * 1.6 * smooth(LEDGE.minSlope, LEDGE.fullSlope, s) * smooth(0.3, 0.7, riserBreak(x, z, k)) * (1 - smooth(0.3, 0.6, gully)) * (1 - smooth(0.2, 0.4, trod));
      if (u01(...hsh, 2) >= p) continue;
      const v = h32(...hsh, 3) % nL, sz = sizes.ledge[v];
      const H = LEDGE.h[0] + (LEDGE.h[1] - LEDGE.h[0]) * u01(...hsh, 4), sc = H / Math.max(0.1, sz[1]), sx = sc * (1 + 0.35 * u01(...hsh, 5));
      // front (+z local) downhill: yaw turns local +z to the horizontal downhill direction (-gx, -gz)
      const yaw = Math.atan2(-gx, -gz) + (u01(...hsh, 6) - 0.5) * 0.3;
      // the piece's centre behind its front by 35 % of its depth, upslope; its foot sunk into the bench
      const back = sz[2] * sc * 0.35, dx = gx / (s || 1), dz = gz / (s || 1), cx = x + dx * back, cz = z + dz * back;
      const y = env.ground(x, z) - H * LEDGE.sink;
      out.push({ cls: 'ledge', v, kind: 'ledge', p: [cx, y, cz], q: quatYaw(yaw), s: [sx, sc, sc], c: tintOf(u01(...hsh, 7), u01(...hsh, 8), 0.55) });
    }
  }
  // ------------------------------------------------ ground rock: outcrops, talus, scree (one draw per 16 m cell)
  const nG = sizes.ground.length, C = GROUND_ROCK.cell;
  if (nG) for (let a = 0; a < T / C; a++) for (let b = 0; b < T / C; b++) {
    const hsh = [seed, ti, tj, a, b, 77], x = x0 + (a + u01(...hsh, 1)) * C, z = z0 + (b + u01(...hsh, 2)) * C;
    if (inClear(x, z)) continue;
    const { gx, gz } = slopeAt(x, z), s = Math.hypot(gx, gz); if (s < 0.1 || s > 1.1) continue;
    if ((env.trodden?.(x, z) ?? 0) > 0.3) continue;
    const y0 = env.ground(x, z), sy = stratY(x, y0, z), k = Math.floor(sy / HILL.pkg), f = sy / HILL.pkg - k, gully = env.gully?.(x, z) ?? 0, curv = env.curv?.(x, z) ?? 0;
    const hillOn = smooth(0.1, 0.22, s);
    // talus: the bench under a riser (pkgF 0.3-0.6 of a cliff package, the shader's talusBench); scree: gully beds and the
    // concave middle slopes; outcrops and slabs: the convex ground and the gentle slopes between
    const talus = cliffPkg(k) && f > 0.3 && f < 0.62 ? GROUND_ROCK.talus * smooth(0.2, 0.4, s) : 0;
    const scree = GROUND_ROCK.scree * Math.max(smooth(0.3, 0.7, gully), smooth(0.25, 0.45, s) * smooth(0.0, -0.01, curv) * 0.6);
    const outc = GROUND_ROCK.outcrop * hillOn * (env.curv ? smooth(-0.002, 0.012, curv) : 0.5) * (1 - smooth(0.3, 0.6, gully));
    const pick = u01(...hsh, 3), kind = pick < talus ? 'talus' : pick < talus + scree ? 'scree' : pick < talus + scree + outc ? 'outcrop' : null;
    if (!kind) continue;
    // variants: 0 outcrop05, 1 slab02, 2 talus03, 3 scree04 (land_rocks.mjs CLASSES.ground order)
    // D-335 probe b3: the two flat scans (slab02, scree04) lay on the slope as grey-green stains, not rock: outcrops draw the
    // outcrop on its bedrock (0), talus and scree the talus blocks (2)
    const v = Math.min(nG - 1, kind === 'outcrop' ? 0 : 2), sz = sizes.ground[v];
    const R = GROUND_ROCK.size[(v === 1 ? 'slab' : kind) as keyof typeof GROUND_ROCK.size], ext = R[0] + (R[1] - R[0]) * u01(...hsh, 5);
    const sc = ext / Math.max(0.1, sz[0], sz[2]);
    // tilted to the ground (the scan's base plane on the slope), turned at random about the normal
    nv.set(-gx, 1, -gz).normalize(); qa.setFromUnitVectors(up, nv); q.setFromAxisAngle(up, u01(...hsh, 6) * Math.PI * 2); qa.multiply(q);
    const y = y0 - sz[1] * sc * (v === 0 ? 0.18 : 0.3);
    out.push({ cls: 'ground', v, kind, p: [x, y, z], q: [qa.x, qa.y, qa.z, qa.w], s: [sc, sc * (0.85 + 0.3 * u01(...hsh, 7)), sc], c: tintOf(u01(...hsh, 8), u01(...hsh, 9), kind === 'scree' || kind === 'talus' ? 0.25 : 0.55) });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the kit (browser)
let KIT: RockKit | null = null; const KSTAT = { ms: 0, failed: '' as string, pieces: 0 };
export const rockKit = () => KIT;
export const rockKitStats = () => ({ ...KSTAT, loaded: !!KIT });
/** register a kit directly (tests; node has no GLTF loading) */
export function _setRockKit(k: RockKit | null) { KIT = k; }
/** load public/models/land (manifest, GLBs, atlases). Never throws: without it the hills keep their texture only (flagged) */
export async function loadRockKit(base = BASE): Promise<RockKit | null> {
  const t0 = performance.now();
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('bedrock') === '0') { KSTAT.failed = 'off (?bedrock=0)'; return null; }
  try {
    const man = await (await fetch(base + 'models/land/manifest.json')).json();
    const [{ GLTFLoader }, draco] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), sharedDraco(base)]); // (D-392: the page's decoders)
    const loader = new GLTFLoader().setDRACOLoader(draco), tl = new THREE.TextureLoader();
    const kit: RockKit = { ledge: [], ground: [], atlas: {} };
    for (const cls of ['ledge', 'ground'] as RockClass[]) {
      const C = man.classes?.[cls]; if (!C) continue;
      const [g, map, normal, arm] = await Promise.all([loader.loadAsync(`${base}models/land/${cls}.glb`), tl.loadAsync(`${base}models/land/${cls}_diff.jpg`), tl.loadAsync(`${base}models/land/${cls}_nor.jpg`), tl.loadAsync(`${base}models/land/${cls}_arm.jpg`)]);
      map.colorSpace = THREE.SRGBColorSpace; for (const t of [map, normal, arm]) { t.anisotropy = 8; t.flipY = false; t.needsUpdate = true; }
      for (const pc of C.pieces as { id: string; size_m: [number, number, number] }[]) {
        const lods: THREE.BufferGeometry[] = [];
        for (let l = 0; l < 3; l++) { const m = g.scene.getObjectByName(`${pc.id}__lod${l}`) as THREE.Mesh | undefined; if (!m?.isMesh) throw new Error(`${cls} ${pc.id} lod${l} missing`);
          m.updateMatrixWorld(true); const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld);
          for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
          if (!geo.getAttribute('normal')) geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere(); lods.push(geo); }
        const b = lods[0].boundingBox!; kit[cls].push({ id: pc.id, cls, size: [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z], lods, cell: (pc as any).cell });
      }
      const mean = meanColour(map), Y = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      kit.atlas[cls] = { map, normal, arm, mean, cellK: [0, 1, 2, 3].map(i => Y(mean) / Math.max(0.01, Y(meanColour(map, i)))) };
    }
    KIT = kit; KSTAT.pieces = kit.ledge.length + kit.ground.length;
  } catch (e) { KSTAT.failed = String((e as Error).message ?? e); console.warn(`[bedrock] no rock kit (${KSTAT.failed}): the hills keep their texture only`); KIT = null; }
  KSTAT.ms = Math.round(performance.now() - t0); return KIT;
}
function meanColour(t: THREE.Texture, cell = -1): [number, number, number] {
  try { const img = t.image as HTMLImageElement, c = new OffscreenCanvas(16, 16), g = c.getContext('2d')!, W = img.width / 2, H = img.height / 2;
    // a cell (0..3, the atlas's 2x2 in Blender's order: rows bottom-up) or the whole image
    if (cell >= 0) g.drawImage(img, (cell % 2) * W, (1 - Math.floor(cell / 2)) * H, W, H, 0, 0, 16, 16); else g.drawImage(img, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, b = 0; const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    for (let i = 0; i < d.length; i += 4) { r += lin(d[i]); gg += lin(d[i + 1]); b += lin(d[i + 2]); } const n = d.length / 4; return [r / n, gg / n, b / n];
  } catch { return [0.2, 0.2, 0.2]; }
}
/** the rock's surface: the scan's luminance relative to its mean (its grain, bedding and shading, not its Namaqualand or
 *  coastal hue) times the instance's palette colour; its normal and ARM (occlusion, roughness) maps kept. Two-sided: the
 *  scans are open shells (photogrammetry sees one side) */
/** D-600: the viewer (world x, y, z) the rock's edge fade is measured from, set on every update call (not the shadow
 *  camera's position: the cascades must see the same sunk rock as the eye) */
export const BEDROCK_VIEWER = uniform(new THREE.Vector3(1e7, 0, 1e7));
/** the last 15 % of a class's reach: the piece sinks into the ground as it recedes (smoothstep of its origin's horizontal
 *  distance; sink depth and reach per instance in 'rorg'.z, w). Until D-600 this was set in the instance matrix at each rebuild (every 20 m
 *  moved), so a rock sank by up to ~3/4 of its depth in one step at 220-260 m (measured: tools/dev/far_pop.ts) */
export const sinkShare = (reach: number, d: number) => smooth(reach * 0.85, reach, d);
/** a piece's own reach (m): its class's R, and for ground rock no farther than where its width spans farPx pixels (never
 *  nearer than the near levels' end) */
export const reachOf = (cls: RockClass, ext: number) => cls === 'ground' ? Math.min(BEDROCK.R.ground, Math.max(BEDROCK.lod[1], (ext * BEDROCK.pxRad) / BEDROCK.farPx)) : BEDROCK.R[cls];
function rockMaterial(A: RockAtlas, name: string): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  // 'rorg': the piece's origin (x, z), its sink depth and its reach (reachOf)
  const org = attribute('rorg', 'vec4'), f = smoothstep(org.w.mul(0.85), org.w, distance(vec2(org.x, org.y), vec2(BEDROCK_VIEWER.x, BEDROCK_VIEWER.z)));
  m.positionNode = positionLocal.sub(vec3(0, org.z.mul(f), 0));
  const t = texture(A.map, uv()).rgb, meanY = Math.max(0.02, 0.2126 * A.mean[0] + 0.7152 * A.mean[1] + 0.0722 * A.mean[2]);
  m.colorNode = attribute('rtint', 'vec3').mul(dot(t, vec3(0.2126, 0.7152, 0.0722)).div(meanY).clamp(0, 2.2));
  // (glTF's UVs run v down: without tangents the normal map's green is flipped, as three's GLTFLoader does)
  m.normalMap = A.normal; m.normalScale.set(1, -1); const a = texture(A.arm, uv()); m.roughnessNode = a.g.mul(0.15).add(0.8); m.aoNode = a.r.mul(float(0.6)).add(0.4);
  m.name = name; return m;
}

/** D-600: the gap (m, unit scale; 99th percentile of the vertices above the ground) between a ground piece's levels 0-1 and
 *  1-2 (tools/dev/rock_lod_gap.mjs on public/models/land/ground.glb). A level is drawn from where its gap at the piece's scale
 *  spans LOD_PX at the player's lens: the fixed 50 / 260 m swapped levels up to ~8 / ~4 px apart for the largest pieces */
export const ROCK_LOD_GAP: Record<string, [number, number]> = { outcrop05: [0.068, 0.636], slab02: [0.124, 0.834], talus03: [0.125, 0.648], scree04: [0.086, 0.328] };
export const LOD_PX = 2;
/** the distances (m) where a piece of this id and scale changes to level 1 and to level 2 (unknown ids: BEDROCK.lod) */
export function lodDistances(id: string | undefined, scale: number): [number, number] {
  const g = id ? ROCK_LOD_GAP[id] : undefined; if (!g) return [BEDROCK.lod[0], BEDROCK.lod[1]];
  return [(g[0] * scale * BEDROCK.pxRad) / LOD_PX, (g[1] * scale * BEDROCK.pxRad) / LOD_PX];
}
/** how deep a piece sinks at the end of its reach (m): as before D-600 (four times its scale), and at least its own height
 *  (a large rock on a slope kept a corner up) */
export const sinkDepth = (st: RockSite) => Math.max(st.s[1] * 4, st.s[1] * 1.6 + 0.5);
/** D-600: a rock piece baked into a static geometry (the quarries' outcrops and spoil chips merge many into one draw):
 *  the piece's level transformed by `m`, with the rock material's per-vertex tint and an origin that never sinks */
export function bakedRockPiece(kit: RockKit, cls: RockClass, v: number, lod: number, m: THREE.Matrix4, tint: [number, number, number]): THREE.BufferGeometry {
  const P = kit[cls][v], g = P.lods[Math.min(lod, P.lods.length - 1)].clone().applyMatrix4(m), n = g.getAttribute('position').count;
  const k = kit.atlas[cls]?.cellK?.[P.cell ?? 0] ?? 1, t = new Float32Array(n * 3), o = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { t.set([tint[0] * k, tint[1] * k, tint[2] * k], i * 3); o.set([0, 0, 0, 1e9], i * 4); }
  g.setAttribute('rtint', new THREE.BufferAttribute(t, 3)); g.setAttribute('rorg', new THREE.BufferAttribute(o, 4));
  return g.index ? g.toNonIndexed() : g;
}
const MATS = new WeakMap<RockAtlas, THREE.MeshStandardNodeMaterial>();
/** the rock material of a class (shared with the hills' sets; null without the kit's atlas) */
export function rockMaterialOf(kit: RockKit, cls: RockClass): THREE.MeshStandardNodeMaterial | null {
  const A = kit.atlas[cls]; if (!A) return null; let m = MATS.get(A); if (!m) { m = rockMaterial(A, `bedrock:${cls}`); MATS.set(A, m); } return m;
}
/** the palette tint of a piece (linear rgb): a in 0..1 picks between the rock and its dark patches or the fresh scree */
export const rockTint = (a: number, b: number, darkShare: number) => tintOf(a, b, darkShare);
// ------------------------------------------------------------------------------------------------ the drawn rock
interface Set_ { cls: RockClass; v: number; lod: number; cast: boolean; mesh: THREE.InstancedMesh; tint: THREE.InstancedBufferAttribute; org: THREE.InstancedBufferAttribute; cap: number }
/** the most instances per drawn set (ledges: per variant near, all variants far; ground: per variant) */
export const BEDROCK_CAP = { ledge: [260, 1800, 5000, 9000], ground: [400, 2600, 2400, 4000] } as const;
export class Bedrock {
  readonly group = new THREE.Group();
  readonly sets: Set_[] = [];
  private tiles = new Map<number, RockSite[]>();
  private last = { x: 1e9, z: 1e9, yaw: 1e9 };
  private sizes: { ledge: [number, number, number][]; ground: [number, number, number][] };
  private ids: { ledge: string[]; ground: string[] };
  private cellK: Partial<Record<RockClass, number[]>> = {};
  stats = { tiles: 0, ledges: 0, ground: 0, drawn: 0, tris: 0, ms: 0 };
  readonly active: boolean;
  private m4 = new THREE.Matrix4(); private qq = new THREE.Quaternion(); private vv = new THREE.Vector3(); private ss = new THREE.Vector3();
  constructor(private env: BedrockEnv, private seed: number, kit: RockKit | null = rockKit()) {
    this.group.name = 'bedrock';
    this.sizes = { ledge: kit?.ledge.map(p => p.size) ?? [], ground: kit?.ground.map(p => p.size) ?? [] };
    this.ids = { ledge: kit?.ledge.map(p => p.id) ?? [], ground: kit?.ground.map(p => p.id) ?? [] };
    this.active = !!kit && (kit.ledge.length > 0 || kit.ground.length > 0);
    for (const cls of ['ledge', 'ground'] as RockClass[]) this.cellK[cls] = (kit?.[cls] ?? []).map(p => kit?.atlas[cls]?.cellK?.[p.cell ?? 0] ?? 1);
    this.group.userData = { tier: 'B/C', src: 'KR-BEDROCK;COP-DEM;POLYHAVEN-CC0', placeholder: !this.active,
      note: this.active ? 'the hills\' bedrock (D-335): ledges of the cliff-forming limestone beds along the shader\'s risers, outcrops, talus and scree, from CC0 scans (Poly Haven) re-tinted to the measured rock palette; lithology B, every place C'
        : 'PLACEHOLDER: the rock kit did not load; the hills\' rock is texture only' };
    if (!kit) return;
    const add = (cls: RockClass, v: number, lod: number, cast: boolean, geo: THREE.BufferGeometry, mat: THREE.Material, cap: number, name: string) => {
      const g = geo.clone(), tint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3), org = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); g.setAttribute('rtint', tint); g.setAttribute('rorg', org);
      const mesh = new THREE.InstancedMesh(g, mat, cap); mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.castShadow = cast; mesh.receiveShadow = true;
      mesh.name = name; mesh.userData = this.group.userData; this.sets.push({ cls, v, lod, cast, mesh, tint, org, cap }); this.group.add(mesh);
    };
    if (kit.atlas.ledge && kit.ledge.length) {
      const mat = rockMaterialOf(kit, 'ledge')!;
      kit.ledge.forEach((p, v) => { add('ledge', v, 0, true, p.lods[0], mat, BEDROCK_CAP.ledge[0], `bedrock-ledge:${p.id}:lod0`); add('ledge', v, 1, true, p.lods[1], mat, BEDROCK_CAP.ledge[1], `bedrock-ledge:${p.id}:lod1`); });
      // far off one shape stands for all (a piece spans a few pixels): the first piece's lod2, cast within the cascades
      add('ledge', -1, 2, true, kit.ledge[0].lods[2], mat, BEDROCK_CAP.ledge[2], 'bedrock-ledge:far:cast'); add('ledge', -1, 3, false, kit.ledge[0].lods[2], mat, BEDROCK_CAP.ledge[3], 'bedrock-ledge:far');
    }
    if (kit.atlas.ground && kit.ground.length) {
      const mat = rockMaterialOf(kit, 'ground')!;
      kit.ground.forEach((p, v) => { add('ground', v, 0, true, p.lods[0], mat, BEDROCK_CAP.ground[0], `bedrock-ground:${p.id}:lod0`); add('ground', v, 1, true, p.lods[1], mat, BEDROCK_CAP.ground[1], `bedrock-ground:${p.id}:lod1`);
        // D-600: past the near levels, each variant's own lod2 (no shape swap), cast within the cascades' reach
        add('ground', v, 2, true, p.lods[2], mat, BEDROCK_CAP.ground[2], `bedrock-ground:${p.id}:lod2:cast`); add('ground', v, 3, false, p.lods[2], mat, BEDROCK_CAP.ground[3], `bedrock-ground:${p.id}:lod2`); });
    }
  }
  private budgetT = 0; private pending = false;
  /** a tile's rock (cached); null when this update's time budget for new tiles is spent (the next update continues) */
  private tile(ti: number, tj: number): RockSite[] | null {
    const key = (ti + 32768) * 65536 + (tj + 32768); let t = this.tiles.get(key);
    if (!t) { if (performance.now() > this.budgetT) { this.pending = true; return null; }
      if (this.tiles.size > 6000) this.tiles.clear(); t = bedrockTile(this.env, ti, tj, this.seed, this.sizes); this.tiles.set(key, t); }
    return t;
  }
  /** the camera (world position, and its view direction for the far cull); rebuilds after BEDROCK.moveM m or turnDeg */
  update(cam: THREE.Vector3, dir?: THREE.Vector3, force = false): boolean {
    if (!this.active) return false;
    BEDROCK_VIEWER.value.copy(cam);
    const yaw = dir ? Math.atan2(dir.x, dir.z) : 0, dYaw = Math.abs(((yaw - this.last.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (!force && !this.pending && Math.hypot(cam.x - this.last.x, cam.z - this.last.z) < BEDROCK.moveM && dYaw < (BEDROCK.turnDeg * Math.PI) / 180) return false;
    const t0 = performance.now(); this.last = { x: cam.x, z: cam.z, yaw }; this.pending = false; this.budgetT = force ? Infinity : t0 + BEDROCK.budgetMs;
    const T = BEDROCK.tile, R = Math.max(...(['ledge', 'ground'] as RockClass[]).filter(c => this.sets.some(q => q.cls === c)).map(c => BEDROCK.R[c]), 0) + BEDROCK.moveM, cone = Math.cos(((BEDROCK.viewCone + 40) * Math.PI) / 180);
    const counts = this.sets.map(() => 0), idx = new Map<string, number>(); this.sets.forEach((s, i) => idx.set(`${s.cls}:${s.v}:${s.lod}`, i));
    let nL = 0, nG = 0, tiles = 0, tris = 0;
    const hx = dir ? dir.x / (Math.hypot(dir.x, dir.z) || 1) : 0, hz = dir ? dir.z / (Math.hypot(dir.x, dir.z) || 1) : 0;
    for (let ti = Math.floor((cam.x - R) / T); ti <= Math.floor((cam.x + R) / T); ti++) for (let tj = Math.floor((cam.z - R) / T); tj <= Math.floor((cam.z + R) / T); tj++) {
      const cx = (ti + 0.5) * T - cam.x, cz = (tj + 0.5) * T - cam.z, dT = Math.hypot(cx, cz); if (dT > R + T) continue;
      const sites = this.tile(ti, tj); if (!sites) continue; tiles++; if (!sites.length) continue;
      for (const st of sites) {
        const dx = st.p[0] - cam.x, dz = st.p[2] - cam.z, d = Math.hypot(dx, dz);
        const sz = this.sizes[st.cls][st.v], reach = reachOf(st.cls, sz ? Math.max(sz[0] * st.s[0], sz[2] * st.s[2]) : 0);
        if (d > reach + BEDROCK.moveM) continue; // (beyond its reach the shader has sunk it whole; the margin covers the next rebuild's walk)
        // beyond the near levels, what lies well outside the view (and cannot cast into it) is left out
        if (dir && d > BEDROCK.lod[0] * 2 && (dx * hx + dz * hz) / d < cone && d > BEDROCK.castR * 0.25) continue;
        const [d0, d1] = st.cls === 'ground' ? lodDistances(this.ids.ground[st.v], Math.max(st.s[0], st.s[1], st.s[2])) : [BEDROCK.lod[0], BEDROCK.lod[1]];
        const lod = d < d0 ? 0 : d < d1 ? 1 : d < BEDROCK.castR ? 2 : 3;
        if (lod < 0) continue;
        const si = idx.get(`${st.cls}:${lod >= 2 && st.cls === 'ledge' ? -1 : st.v}:${lod}`); if (si === undefined) continue;
        const S = this.sets[si]; if (counts[si] >= S.cap) continue;
        // the last 15 % of the radius: sunk into the ground as it recedes (no pop at the edge), by the shader every frame
        this.m4.compose(this.vv.set(st.p[0], st.p[1], st.p[2]), this.qq.set(st.q[0], st.q[1], st.q[2], st.q[3]), this.ss.set(st.s[0], st.s[1], st.s[2]));
        const c = counts[si]++, k = this.cellK[st.cls]?.[st.v] ?? 1; S.mesh.setMatrixAt(c, this.m4); S.tint.setXYZ(c, st.c[0] * k, st.c[1] * k, st.c[2] * k); S.org.setXYZW(c, st.p[0], st.p[2], sinkDepth(st), reach);
        if (st.cls === 'ledge') nL++; else nG++;
      }
    }
    this.sets.forEach((S, i) => { S.mesh.count = counts[i]; S.mesh.visible = counts[i] > 0; S.mesh.instanceMatrix.needsUpdate = true; S.tint.needsUpdate = true; S.org.needsUpdate = true;
      tris += counts[i] * ((S.mesh.geometry.index?.count ?? S.mesh.geometry.getAttribute('position').count) / 3); });
    this.stats = { tiles, ledges: nL, ground: nG, drawn: this.sets.filter(s => s.mesh.visible).length, tris, ms: Math.round(performance.now() - t0) };
    return true;
  }
}
