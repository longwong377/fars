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
  /** steep ground takes a rock scan at large scale (the mountain and the outcrops: a 2.5 m tile averages to flat colour at 1 km) */
  rock?: { scan: string; scale: number; scale2: number; alb: number; ny0: number; ny1: number } }
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

type ScanMeta = { meanLinear: [number, number, number]; meanRough: number; meanAO: number };
const META = SCANS as unknown as Record<string, ScanMeta>;
const TEX = new Map<string, { diff: THREE.Texture; arm: THREE.Texture }>();
/** `?noscans` turns the scans off (A/B); set before the first surfaceMaterial call */
export let scansOn = true;

/** load every scan used (awaited before the world builds its materials); a no-op without a DOM (node) */
export async function loadScans(base = '/', anisotropy = 8): Promise<void> {
  if (typeof document === 'undefined') return;
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('noscans')) { scansOn = false; return; }
  const L = new THREE.TextureLoader(), ids = [...new Set(Object.values(SCAN_USE).flatMap(u => u.rock ? [u.scan, u.rock.scan] : [u.scan]))];
  await Promise.all(ids.map(async id => {
    const [diff, arm] = await Promise.all(['diff', 'arm'].map(f => L.loadAsync(`${base}textures/${id}/${f}.jpg`)));
    for (const t of [diff, arm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; }
    diff.colorSpace = THREE.SRGBColorSpace; arm.colorSpace = THREE.NoColorSpace;
    TEX.set(id, { diff, arm });
  }));
}
export const scansLoaded = () => TEX.size > 0;

/** triplanar sample of a texture at `scale` metres per tile (world space, weights from the world normal) */
function tri(t: THREE.Texture, scale: number) {
  const p = positionWorld.div(scale), w0 = pow(abs(normalWorld), vec3(4)), w = w0.div(max(dot(w0, vec3(1)), float(1e-4)));
  return texture(t, p.zy).mul(w.x).add(texture(t, p.xz).mul(w.y)).add(texture(t, p.xy).mul(w.z));
}

/** the layer with the scan's detail laid over it (identity when the surface has no scan or none is loaded) */
export function applyScan<L extends { alb: any; rough: any; height: any | null }>(name: string, L: L): L {
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
  return { ...L, alb, rough, height: L.height ? L.height.add(bump) : bump };
}
