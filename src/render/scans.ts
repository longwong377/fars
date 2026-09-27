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
  /** D-300: the scan's own normal map (nor.jpg, OpenGL), triplanar with a whiteout blend into the surface's normal, × this strength */
  nor?: number;
  /** steep ground takes a rock scan at large scale (the mountain and the outcrops: a 2.5 m tile averages to flat colour at 1 km) */
  rock?: { scan: string; scale: number; scale2: number; alb: number; ny0: number; ny1: number } }
/** metres per tile (`scale`), blend weights, bump amplitude in metres; `scale2`: a second, larger tile multiplied in (ground) */
export const SCAN_USE: Record<string, ScanUse> = {
  // D-300: the dressed and carved limestone take Rock Boulder Dry (a pale grey-buff weathered limestone boulder: chroma spread
  // R/B 1σ 0.07 over 10 cm, against 0.18 for Rock Wall 02, whose green lichen and orange patches drew a dirty camouflage over
  // fresh ashlar) with a second tile of 6-8 m multiplied in, so a block no longer repeats its 1.6-2 m tile's smudges (the
  // session-11 lens render). Fresh 467 stone (≈50 years from the quarry, D-230) at a lighter blend than the ruin's (Now view)
  limestone: { scan: 'rock_boulder_dry', scale: 1.7, scale2: 7.3, alb: 0.45, height: 0.004, rough: 0.5, nor: 1.5 },
  limestone_merlon: { scan: 'rock_boulder_dry', scale: 1.7, scale2: 7.3, alb: 0.45, height: 0.004, rough: 0.5, nor: 1.5 },
  limestone_carved: { scan: 'rock_boulder_dry', scale: 1.3, scale2: 5.9, alb: 0.35, height: 0.0015, rough: 0.4, nor: 0.5 },
  limestone_dark: { scan: 'rock_surface', scale: 1.4, alb: 0.35, height: 0.001, rough: 0.3 },
  terrace: { scan: 'rock_boulder_dry', scale: 2.1, scale2: 8.9, alb: 0.5, height: 0.006, rough: 0.5, nor: 1.8 },
  terrace_foot: { scan: 'rock_boulder_dry', scale: 2.1, scale2: 8.9, alb: 0.6, height: 0.01, rough: 0.5, nor: 2.2 }, // (the foot's rougher-dressed blocks)
  terrace_now: { scan: 'rock_boulder_dry', scale: 2.1, scale2: 8.9, alb: 0.8, height: 0.008, rough: 0.5, nor: 2.2 },
  stone_plain: { scan: 'rock_wall_02', scale: 1.6, alb: 0.6, height: 0.005, rough: 0.5 },
  takht_stone: { scan: 'rock_wall_02', scale: 2.0, alb: 0.7, height: 0.006, rough: 0.5 },
  nr_dressed: { scan: 'rock_wall_02', scale: 2.0, alb: 0.7, height: 0.006, rough: 0.5 },
  rubble: { scan: 'cliff_side', scale: 2.5, alb: 0.8, height: 0.02, rough: 0.5 },
  nr_rock: { scan: 'cliff_side', scale: 4.0, alb: 0.8, height: 0.03, rough: 0.5 },
  // D-300: the palaces' mud plaster takes Clay Floor 001 (a hand-floated clay coat: trowel sweeps and fine shrinkage, 0.5 m
  // windows Ystd/Y 0.062 at 1 cm/px) in place of Brown Mud Dry (a gravelly soil, 0.31: the Gate's walls read as sandpaper)
  mudbrick: { scan: 'clay_floor_001', scale: 2.2, scale2: 9.7, alb: 0.6, height: 0.003, rough: 0.4, nor: 2.0 },
  mudbrick_painted: { scan: 'clay_floor_001', scale: 2.2, scale2: 9.7, alb: 0.5, height: 0.003, rough: 0.4, nor: 2.0 },
  house_brick: { scan: 'brown_mud_dry', scale: 1.5, alb: 0.6, height: 0.004, rough: 0.4 },
  baked_brick: { scan: 'clay_block_wall', scale: 1.5, alb: 0.5, height: 0.003, rough: 0.4 },
  mud_plaster: { scan: 'clay_plaster', scale: 2.0, alb: 0.7, height: 0.003, rough: 0.4 },
  house_plaster: { scan: 'clay_plaster', scale: 2.0, alb: 0.7, height: 0.003, rough: 0.4 },
  house_socle: { scan: 'clay_plaster', scale: 2.0, alb: 0.6, height: 0.003, rough: 0.4 },
  plaster: { scan: 'clay_plaster', scale: 2.0, alb: 0.35, height: 0.002, rough: 0.3 },
  earth: { scan: 'dry_ground_01', scale: 2.5, scale2: 11, alb: 0.8, height: 0.01, rough: 0.5, rock: { scan: 'aerial_ground_rock', scale: 60, scale2: 240, alb: 0.9, ny0: 0.8, ny1: 0.92 } },
  court_fill: { scan: 'gravelly_sand', scale: 2.0, scale2: 9, alb: 0.7, height: 0.006, rough: 0.5 },
  road: { scan: 'sandy_gravel_02', scale: 2.0, scale2: 9, alb: 0.8, height: 0.008, rough: 0.5 },
  bank: { scan: 'dry_ground_rocks', scale: 2.5, scale2: 11, alb: 0.8, height: 0.015, rough: 0.5 },
  refuse: { scan: 'dry_ground_rocks', scale: 2.0, alb: 0.7, height: 0.01, rough: 0.5 },
  timber: { scan: 'rough_wood', scale: 1.2, alb: 0.6, height: 0.002, rough: 0.5 },
  roof_timber: { scan: 'rough_wood', scale: 1.2, alb: 0.6, height: 0.002, rough: 0.5 },
  house_timber: { scan: 'rough_wood', scale: 1.2, alb: 0.6, height: 0.002, rough: 0.5 },
  scaffold: { scan: 'rough_wood', scale: 1.2, alb: 0.6, height: 0.002, rough: 0.5 },
};

/** D-300 (T-A7): the surfaces for which the library holds a fitting CC0 scan (stone, earthen and lime plaster, earth and fill,
 *  timber). Drawn without one (no SCAN_USE entry, or a blend under ALB_MIN) such a surface is a procedural stand-in. Not here
 *  (no fitting scan: judged by T-A4): bronze, the glazed brick, the red-painted floors, reed matting, cloth */
export const ALB_MIN = 0.3;
export const SCANNABLE: Record<string, true> = Object.fromEntries(['limestone', 'limestone_merlon', 'limestone_carved', 'limestone_dark',
  'terrace', 'terrace_now', 'terrace_foot', 'stone_plain', 'takht_stone', 'nr_dressed', 'nr_rock', 'rubble', 'kaba_white', 'mudbrick', 'mudbrick_painted',
  'house_brick', 'baked_brick', 'mud_plaster', 'house_plaster', 'house_socle', 'plaster', 'village_mud', 'earth', 'court_fill', 'road', 'bank',
  'refuse', 'timber', 'roof_timber', 'house_timber', 'scaffold'].map(k => [k, true]));
/** the scan applied to a surface at a strength that reads (T-A7's anti-proxy: alb >= ALB_MIN), or null; what the builders record
 *  in material.userData.scan (node as well: there no texture loads, the tag says what the page applies) */
export function scanOf(name: string): string | null { const u = SCAN_USE[name]; return u && u.alb >= ALB_MIN ? u.scan : null; }
type ScanMeta = { meanLinear: [number, number, number]; meanRough: number; meanAO: number };
const META = SCANS as unknown as Record<string, ScanMeta>;
const TEX = new Map<string, { diff: THREE.Texture; arm: THREE.Texture; nor?: THREE.Texture }>();
/** `?noscans` turns the scans off (A/B); set before the first surfaceMaterial call */
export let scansOn = true;

/** load every scan used (awaited before the world builds its materials); a no-op without a DOM (node) */
export async function loadScans(base = '/', anisotropy = 8): Promise<void> {
  if (typeof document === 'undefined') return;
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('noscans')) { scansOn = false; return; }
  const L = new THREE.TextureLoader(), ids = [...new Set(Object.values(SCAN_USE).flatMap(u => u.rock ? [u.scan, u.rock.scan] : [u.scan]))];
  const withNor = new Set(Object.values(SCAN_USE).filter(u => u.nor).map(u => u.scan));
  await Promise.all(ids.map(async id => {
    const [diff, arm, nor] = await Promise.all(['diff', 'arm', ...(withNor.has(id) ? ['nor'] : [])].map(f => L.loadAsync(`${base}textures/${id}/${f}.jpg`)));
    for (const t of [diff, arm, nor]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; }
    diff.colorSpace = THREE.SRGBColorSpace; arm.colorSpace = THREE.NoColorSpace; if (nor) nor.colorSpace = THREE.NoColorSpace;
    TEX.set(id, { diff, arm, nor });
  }));
}
export const scansLoaded = () => TEX.size > 0;

/** triplanar sample of a texture at `scale` metres per tile (world space, weights from the world normal) */
function tri(t: THREE.Texture, scale: number) {
  const p = positionWorld.div(scale), w0 = pow(abs(normalWorld), vec3(4)), w = w0.div(max(dot(w0, vec3(1)), float(1e-4)));
  return texture(t, p.zy).mul(w.x).add(texture(t, p.xz).mul(w.y)).add(texture(t, p.xy).mul(w.z));
}

/** the layer with the scan's detail laid over it (identity when the surface has no scan or none is loaded) */
/** D-300: the scan's normal map as a world-space tilt of the shading normal (materials.ts finish adds a layer's `tilt` to the
 *  bumped normal): each projection's tangent-space xy along its own world axes (the triplanar's u, v), weighted as the albedo.
 *  Mirrored faces see the relief lit from the mirrored side (no per-face sign): invisible on rough stone and clay */
function triNormal(t: THREE.Texture, scale: number) {
  const p = positionWorld.div(scale), w0 = pow(abs(normalWorld), vec3(4)), w = w0.div(max(dot(w0, vec3(1)), float(1e-4)));
  const tx = texture(t, p.zy).xy.mul(2).sub(1), ty = texture(t, p.xz).xy.mul(2).sub(1), tz = texture(t, p.xy).xy.mul(2).sub(1);
  return vec3(float(0), tx.y, tx.x).mul(w.x).add(vec3(ty.x, float(0), ty.y).mul(w.y)).add(vec3(tz.x, tz.y, float(0)).mul(w.z));
}
export function applyScan<L extends { alb: any; rough: any; height: any | null; tilt?: any }>(name: string, L: L): L {
  const u = SCAN_USE[name], T = u && TEX.get(u.scan), M = u && META[u.scan];
  if (!scansOn || !u || !T || !M) return L;
  const mean = vec3(...M.meanLinear);
  let det = tri(T.diff, u.scale).rgb.div(mean);
  if (u.scale2) det = det.mul(tri(T.diff, u.scale2).rgb.div(mean)); // the larger tile breaks the small one's repeat
  const R = u.rock, RT = R && TEX.get(R.scan), RM = R && META[R.scan];
  if (R && RT && RM) { // slope-driven rock: full below ny0 (~37°), none above ny1 (~23°)
    const rmean = vec3(...RM.meanLinear), rdet = tri(RT.diff, R.scale).rgb.div(rmean).mul(tri(RT.diff, R.scale2).rgb.div(rmean));
    det = mix(det, mix(vec3(1), rdet, R.alb / u.alb), float(1).sub(smoothstep(R.ny0, R.ny1, normalWorld.y)));
  }
  const lum = dot(det, vec3(0.2126, 0.7152, 0.0722));
  const alb = L.alb.mul(mix(vec3(1), det, u.alb));
  // the scan's roughness costs a sampler; a surface with a rock layer (the terrain) is at WebGPU's 16 samplers per stage
  // without it, so there the procedural roughness stands (session 11: 17 samplers failed the terrain's pipeline)
  const rough = u.rock ? L.rough : L.rough.mul(mix(float(1), tri(T.arm, u.scale).g.div(M.meanRough), u.rough)).clamp(0.05, 1);
  const bump = lum.sub(1).mul(u.height);
  const nt = u.nor && T.nor ? triNormal(T.nor, u.scale).mul(u.nor) : null;
  return { ...L, alb, rough, height: L.height ? L.height.add(bump) : bump, ...(nt ? { tilt: L.tilt ? L.tilt.add(nt) : nt } : {}) };
}
