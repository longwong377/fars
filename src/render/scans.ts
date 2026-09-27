// Scanned surface detail (session 11, BLOCKERS B7 lifted: the GPU machine reaches Poly Haven). CC0 photo scans of real stone,
// mud plaster, earth and timber (src/data/scans.json, ASSET_LEDGER.md) laid over the procedural surfaces of materials.ts, never
// replacing them: the measured albedo, the masonry layout, the joints and the weathering stay; the scan adds the grain a
// procedural noise cannot (pitting, grit, tool and erosion texture at 1 mm-1 m).
// - albedo: the scan's colour divided by its own mean (so the surface keeps its measured tint and mean), blended by `alb`
// - height: the scan's luminance detail as a bump (metres), added to the surface's own height field
// - roughness: the scan's roughness over its mean, blended by `rough`
// Triplanar in world space (no UVs on the procedural geometry), two scales on the ground so the tiling does not read.
// Tier C (the scans are modern stone and earth standing in for the grain of 467's; the tint is the evidence's).
// In node (tests, bakes) no texture is loaded and applyScan is the identity, so every CPU mirror of materials.ts still holds.
import * as THREE from 'three/webgpu';
import { texture, positionWorld, normalWorld, vec3, float, abs, pow, mix, dot, max, smoothstep } from 'three/tsl';
import SCANS from '../data/scans.json';

export interface ScanUse { scan: string; scale: number; alb: number; height: number; rough: number; scale2?: number;
  /** D-303: the scan's normal map (nor.jpg, OpenGL) at this strength, triplanar with a UDN blend in world space, in place of
   *  the luminance bump (a colour edge is not a relief edge) */
  nor?: Nor;
  /** D-303: up-facing faces (the materials' `top` surface: roofs, wall tops) take another scan */
  top?: { scan: string; scale: number; scale2?: number; alb: number; nor?: Nor };
  /** steep ground takes a rock scan at large scale (the mountain and the outcrops: a 2.5 m tile averages to flat colour at 1 km) */
  rock?: { scan: string; scale: number; scale2: number; alb: number; ny0: number; ny1: number } }
/** a normal map: strength `k` (1 = the map as scanned); by default the colour scan's own map at its scale, or another scan's
 *  (`scan`, at `scale` m per tile) where the colour scan's relief is too flat (D-303: a trowelled clay floor's colour, an eroded
 *  earth wall's relief) */
export interface Nor { k: number; scan?: string; scale?: number }
/** metres per tile (`scale`), blend weights, bump amplitude in metres; `scale2`: a second, larger tile multiplied in (ground) */
export const SCAN_USE: Record<string, ScanUse> = {
  limestone: { scan: 'rock_wall_02', scale: 1.6, alb: 0.55, height: 0.004, rough: 0.5 },
  limestone_merlon: { scan: 'rock_wall_02', scale: 1.6, alb: 0.55, height: 0.004, rough: 0.5 },
  limestone_dark: { scan: 'rock_wall_02', scale: 1.6, alb: 0.55, height: 0.004, rough: 0.5 },
  terrace: { scan: 'rock_wall_02', scale: 2.0, alb: 0.7, height: 0.006, rough: 0.5 },
  terrace_now: { scan: 'rock_wall_02', scale: 2.0, alb: 0.8, height: 0.008, rough: 0.5 },
  stone_plain: { scan: 'rock_wall_02', scale: 1.6, alb: 0.6, height: 0.005, rough: 0.5 },
  takht_stone: { scan: 'rock_wall_02', scale: 2.0, alb: 0.7, height: 0.006, rough: 0.5 },
  nr_dressed: { scan: 'rock_wall_02', scale: 2.0, alb: 0.7, height: 0.006, rough: 0.5 },
  rubble: { scan: 'cliff_side', scale: 2.5, alb: 0.8, height: 0.02, rough: 0.5 },
  nr_rock: { scan: 'cliff_side', scale: 4.0, alb: 0.8, height: 0.03, rough: 0.5 },
  mudbrick: { scan: 'brown_mud_dry', scale: 1.5, alb: 0.6, height: 0.004, rough: 0.4 },
  house_brick: { scan: 'brown_mud_dry', scale: 1.5, alb: 0.6, height: 0.004, rough: 0.4 },
  baked_brick: { scan: 'clay_block_wall', scale: 1.5, alb: 0.5, height: 0.003, rough: 0.4 },
  // D-303: the town's and villages' mud plaster: a hand-trowelled clay coat's colour (clay_floor_001) with an eroded earth wall's
  // relief (rain rills, trowel ridges: excavated_soil_wall's normal map); the roofs' rolled clay-and-straw coat on up-facing faces
  // (dirt); was clay_plaster, whose grain did not read (the town's before renders: flat brown walls)
  mud_plaster: { scan: 'clay_floor_001', scale: 2.4, scale2: 7, alb: 0.6, height: 0.003, rough: 0.4, nor: { k: 0.15, scan: 'excavated_soil_wall', scale: 3 }, top: { scan: 'dirt', scale: 2.5, scale2: 10, alb: 0.85, nor: { k: 0.7 } } },
  house_plaster: { scan: 'clay_floor_001', scale: 2.4, scale2: 9, alb: 0.9, height: 0.003, rough: 0.4, nor: { k: 0.5, scan: 'excavated_soil_wall', scale: 3 }, top: { scan: 'dirt', scale: 2.5, scale2: 10, alb: 0.85, nor: { k: 0.7 } } },
  house_socle: { scan: 'dry_riverbed_rock', scale: 1.0, alb: 0.6, height: 0.003, rough: 0.4, nor: { k: 0.35 } }, // D-303: fieldstone (was a plaster scan on stone)
  plaster: { scan: 'clay_plaster', scale: 2.0, alb: 0.35, height: 0.002, rough: 0.3 },
  earth: { scan: 'dry_ground_01', scale: 2.5, scale2: 11, alb: 0.8, height: 0.01, rough: 0.5, rock: { scan: 'aerial_ground_rock', scale: 60, scale2: 240, alb: 0.9, ny0: 0.8, ny1: 0.92 } },
  court_fill: { scan: 'gravelly_sand', scale: 2.0, scale2: 9, alb: 0.7, height: 0.006, rough: 0.5 },
  road: { scan: 'Ground025', scale: 2.2, scale2: 10, alb: 0.85, height: 0.008, rough: 0.5, nor: { k: 0.8 } }, // D-303: trodden dry earth with grit and prints (was sandy_gravel_02: smooth)
  bank: { scan: 'dry_ground_rocks', scale: 2.5, scale2: 11, alb: 0.8, height: 0.015, rough: 0.5 },
  litter: { scan: 'dirt', scale: 0.8, alb: 0.4, height: 0.001, rough: 0.3 }, // D-303: the lanes' litter (grain only; the colour is each piece's)
  refuse: { scan: 'burned_ground_01', scale: 1.5, scale2: 7, alb: 0.8, height: 0.01, rough: 0.5, nor: { k: 0.8 } }, // D-303: ash, straw and dung (middens, pens)
  timber: { scan: 'rough_wood', scale: 1.2, alb: 0.6, height: 0.002, rough: 0.5 },
  roof_timber: { scan: 'rough_wood', scale: 1.2, alb: 0.6, height: 0.002, rough: 0.5 },
  house_timber: { scan: 'rough_wood', scale: 1.2, alb: 0.6, height: 0.002, rough: 0.5 },
  scaffold: { scan: 'rough_wood', scale: 1.2, alb: 0.6, height: 0.002, rough: 0.5 },
};

type ScanMeta = { meanLinear: [number, number, number]; meanRough: number; meanAO: number };
const META = SCANS as unknown as Record<string, ScanMeta>;
const TEX = new Map<string, { diff?: THREE.Texture; arm?: THREE.Texture; nor?: THREE.Texture }>();
/** `?noscans` turns the scans off (A/B); set before the first surfaceMaterial call */
export let scansOn = true;
/** the scans each use needs, and whether its normal map is loaded (D-303) */
export function scanIds(): { id: string; col: boolean; nor: boolean }[] {
  const m = new Map<string, { col: boolean; nor: boolean }>(), add = (id: string, col: boolean, nor: boolean) => { const e = m.get(id) ?? { col: false, nor: false }; m.set(id, { col: e.col || col, nor: e.nor || nor }); };
  const addNor = (n: Nor | undefined, own: string) => { if (n) add(n.scan ?? own, false, true); };
  for (const u of Object.values(SCAN_USE)) { add(u.scan, true, false); addNor(u.nor, u.scan); if (u.rock) add(u.rock.scan, true, false); if (u.top) { add(u.top.scan, true, false); addNor(u.top.nor, u.top.scan); } }
  return [...m].map(([id, e]) => ({ id, ...e }));
}

/** load every scan used (awaited before the world builds its materials); a no-op without a DOM (node) */
export async function loadScans(base = '/', anisotropy = 8): Promise<void> {
  if (typeof document === 'undefined') return;
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('noscans')) { scansOn = false; return; }
  const L = new THREE.TextureLoader();
  await Promise.all(scanIds().map(async ({ id, col, nor }) => {
    const files = [...(col ? ['diff', 'arm'] : []), ...(nor ? ['nor'] : [])], tx = await Promise.all(files.map(f => L.loadAsync(`${base}textures/${id}/${f}.jpg`)));
    const e: { diff?: THREE.Texture; arm?: THREE.Texture; nor?: THREE.Texture } = {};
    files.forEach((f, i) => { const t = tx[i]; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
      t.colorSpace = f === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace; (e as any)[f] = t; });
    TEX.set(id, e);
  }));
}
export const scansLoaded = () => TEX.size > 0;

const triW = () => { const w0 = pow(abs(normalWorld), vec3(4)); return w0.div(max(dot(w0, vec3(1)), float(1e-4))); };
/** triplanar sample of a texture at `scale` metres per tile (world space, weights from the world normal) */
function tri(t: THREE.Texture, scale: number) {
  const p = positionWorld.div(scale), w = triW();
  return texture(t, p.zy).mul(w.x).add(texture(t, p.xz).mul(w.y)).add(texture(t, p.xy).mul(w.z));
}
/** D-303: a triplanar normal map as a world-space tilt of the normal (UDN blend): each projection's tangent-space x, y along
 *  the world axes its u, v run on (x plane: z, y; y plane: x, z; z plane: x, y). Consistent with the albedo's projection on
 *  either side of a face (the slope is along +u wherever u runs), so no sign flips */
function triNormal(t: THREE.Texture, scale: number) {
  const p = positionWorld.div(scale), w = triW();
  const X = texture(t, p.zy).xy.mul(2).sub(1), Y = texture(t, p.xz).xy.mul(2).sub(1), Z = texture(t, p.xy).xy.mul(2).sub(1);
  return vec3(0, X.y, X.x).mul(w.x).add(vec3(Y.x, 0, Y.y).mul(w.y)).add(vec3(Z.x, Z.y, 0).mul(w.z));
}
/** a scan's colour detail (colour over its own mean), with the larger tile multiplied in */
function detail(T: { diff?: THREE.Texture }, M: ScanMeta, scale: number, scale2?: number) {
  const mean = vec3(...M.meanLinear); let det = tri(T.diff!, scale).rgb.div(mean);
  if (scale2) det = det.mul(tri(T.diff!, scale2).rgb.div(mean)); // the larger tile breaks the small one's repeat
  return det;
}

/** the layer with the scan's detail laid over it (identity when the surface has no scan or none is loaded) */
export function applyScan<L extends { alb: any; rough: any; height: any | null; tilt?: any }>(name: string, L: L): L {
  const u = SCAN_USE[name], T = u && TEX.get(u.scan), M = u && META[u.scan];
  if (!scansOn || !u || !T?.diff || !M) return L;
  let det = detail(T, M, u.scale, u.scale2);
  const R = u.rock, RT = R && TEX.get(R.scan), RM = R && META[R.scan];
  if (R && RT && RM) { // slope-driven rock: full below ny0 (~37°), none above ny1 (~23°)
    const rmean = vec3(...RM.meanLinear), rdet = tri(RT.diff!, R.scale).rgb.div(rmean).mul(tri(RT.diff!, R.scale2).rgb.div(rmean));
    det = mix(det, mix(vec3(1), rdet, R.alb / u.alb), float(1).sub(smoothstep(R.ny0, R.ny1, normalWorld.y)));
  }
  const norOf = (n: Nor | undefined, own: string, scale: number) => { const t = n && TEX.get(n.scan ?? own)?.nor; return n && t ? triNormal(t, n.scale ?? scale).mul(n.k) : null; };
  let tilt: any = norOf(u.nor, u.scan, u.scale);
  const TP = u.top, TT = TP && TEX.get(TP.scan), TM = TP && META[TP.scan];
  let blendAlb: any = float(u.alb);
  if (TP && TT && TM) { // D-303: the up-facing faces' own scan (the materials' `top` blend: smoothstep 0.7-0.9 of the normal's y)
    const t = smoothstep(0.7, 0.9, normalWorld.y);
    det = mix(det, detail(TT, TM, TP.scale, TP.scale2), t); blendAlb = mix(float(u.alb), float(TP.alb), t);
    const tt = norOf(TP.nor, TP.scan, TP.scale);
    if (tt || tilt) tilt = mix(tilt ?? vec3(0), tt ?? vec3(0), t);
  }
  const lum = dot(det, vec3(0.2126, 0.7152, 0.0722));
  const alb = L.alb.mul(mix(vec3(1), det, blendAlb));
  // the scan's roughness costs a sampler; a surface with a rock layer (the terrain) is at WebGPU's 16 samplers per stage
  // without it, so there the procedural roughness stands (session 11: 17 samplers failed the terrain's pipeline)
  const rough = u.rock ? L.rough : L.rough.mul(mix(float(1), tri(T.arm!, u.scale).g.div(M.meanRough), u.rough)).clamp(0.05, 1);
  // with a normal map the relief is the map's; the luminance bump stays at a quarter (the fine grit the 1K map does not hold)
  const bump = lum.sub(1).mul(tilt ? u.height * 0.25 : u.height);
  return { ...L, alb, rough, height: L.height ? L.height.add(bump) : bump, ...(tilt ? { tilt: L.tilt ? L.tilt.add(tilt) : tilt } : {}) };
}
