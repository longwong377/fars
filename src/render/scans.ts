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
import { texture, positionWorld, normalWorld, vec3, float, int, abs, pow, mix, dot, max, smoothstep } from 'three/tsl';
import SCANS from '../data/scans.json';
import { loadBlockFace } from './blockface';
import { BASE } from '../core/base';
import { loadScanTexture, lowOf, addUpgrade } from './lowfirst';

export interface ScanUse { scan: string; scale: number; alb: number; height: number; rough: number; scale2?: number;
  /** roughness also follows the scan's luminance detail: × (1 + roughLum·(lum − 1)) (a burnished floor: the trowel's smooth strokes
   *  darker and glossier than the matte ground between them, where the scan's own roughness map is flat; D-301) */ roughLum?: number;
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
  stone_rough: { scan: 'rock_boulder_dry', scale: 1.7, scale2: 7.3, alb: 0.5, height: 0.004, rough: 0.5 }, // D-321: the blocks being worked (the Terrace's stone, quarry-fresh)
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
  mudbrick_bare: { scan: 'clay_block_wall', scale: 1.9, alb: 0.5, height: 0.003, rough: 0.4 }, // D-334: the walls under construction
  // D-334: the palaces' roofs and exposed tops: the rolled clay-and-straw coat (a clay plaster scan; the roller, straw and cracks baked)
  roof_earth: { scan: 'clay_plaster', scale: 2.4, scale2: 10.3, alb: 0.6, height: 0.003, rough: 0.4 },
  house_brick: { scan: 'brown_mud_dry', scale: 1.5, alb: 0.6, height: 0.004, rough: 0.4 },
  baked_brick: { scan: 'clay_block_wall', scale: 1.5, alb: 0.5, height: 0.003, rough: 0.4 },
  mud_plaster: { scan: 'clay_plaster', scale: 2.0, alb: 0.7, height: 0.003, rough: 0.4 },
  house_plaster: { scan: 'clay_plaster', scale: 2.0, alb: 0.7, height: 0.003, rough: 0.4 },
  house_socle: { scan: 'clay_plaster', scale: 2.0, alb: 0.6, height: 0.003, rough: 0.4 },
  plaster: { scan: 'clay_plaster', scale: 2.0, alb: 0.35, height: 0.002, rough: 0.3 },
  // D-302: the terrain, the rivers' banks, the tracks and the canal banks lay their own ground layers (GROUND below, groundScan);
  // this entry is the 'earth' of other meshes (the Now view's stumps, the lab ground): dust, not the cracked earth of D-295
  earth: { scan: 'dirt', scale: 2.0, scale2: 9, alb: 0.8, height: 0.008, rough: 0.5 },
  court_fill: { scan: 'gravelly_sand', scale: 2.0, scale2: 9, alb: 0.7, height: 0.006, rough: 0.5 },
  road: { scan: 'rocky_trail_02', scale: 2.0, scale2: 8.3, alb: 0.85, height: 0.01, rough: 0.5 }, // D-302: trodden earth and fine gravel (was sandy_gravel_02: too fine to read)
  bank: { scan: 'dry_ground_rocks', scale: 2.5, scale2: 11, alb: 0.8, height: 0.015, rough: 0.5 },
  refuse: { scan: 'dry_ground_rocks', scale: 2.0, alb: 0.7, height: 0.01, rough: 0.5 },
  timber: { scan: 'rough_wood', scale: 1.2, alb: 0.6, height: 0.002, rough: 0.5 },
  roof_timber: { scan: 'rough_wood', scale: 1.2, alb: 0.6, height: 0.002, rough: 0.5 },
  house_timber: { scan: 'rough_wood', scale: 1.2, alb: 0.6, height: 0.002, rough: 0.5 },
  scaffold: { scan: 'rough_wood', scale: 1.2, alb: 0.6, height: 0.002, rough: 0.5 },
  // D-301 (every inch real: the interiors). The halls' and rooms' own surfaces: the red lime-plaster floors (a trowelled clay
  // floor's marks, fine cracks and uneven sheen: the burnished coat was hand-laid, not poured), the Treasury's clay-painted mud
  // plaster, the carved limestone of the column shafts, bases and capitals (a fine-grained rock face at a rubbed finish's low
  // weight), the reed matting of the ceilings (a woven reed scan; roof_timber's underside: materials.ts applies each part's
  // own scan), bronze fittings
  plaster_red: { scan: 'clay_floor_001', scale: 2.0, alb: 0.6, height: 0.0012, rough: 0.9, roughLum: 1.2 }, // (the 7 m second tile drew dark blotches that read as blood in breath-dawn: the blind review, removed unrendered)
  matting: { scan: 'Wicker010B', scale: 0.6, alb: 0.75, height: 0.002, rough: 0.4 },
  bronze: { scan: 'Metal013', scale: 0.6, alb: 0.45, height: 0.0004, rough: 0.6 },
  // the palaces' furnishings (world/furnish_palaces.ts FURNISH_SURFACES, D-212): textiles as felted wool, clay, the metals
  furn_textile: { scan: 'Fabric043', scale: 0.5, alb: 0.55, height: 0.0008, rough: 0.4 },
  furn_clay: { scan: 'clay_floor_001', scale: 0.7, alb: 0.8, height: 0.0008, rough: 0.6 },
  furn_silver: { scan: 'Metal013', scale: 0.4, alb: 0.3, height: 0.0002, rough: 0.5 },
  furn_gilt: { scan: 'Metal013', scale: 0.4, alb: 0.3, height: 0.0002, rough: 0.5 },
  // the rooms' furnishings (world/furnish.ts, fire.ts: materials.ts propMaterial `prop_<kind>`), by what they are made of
  prop_reed: { scan: 'Tatami001', scale: 0.7, alb: 0.9, height: 0.0015, rough: 0.4 },
  prop_wicker: { scan: 'Wicker010B', scale: 0.35, alb: 0.85, height: 0.003, rough: 0.4 },
  prop_felt: { scan: 'Fabric043', scale: 0.5, alb: 0.7, height: 0.001, rough: 0.4 },
  prop_textile: { scan: 'hessian_230', scale: 0.35, alb: 0.6, height: 0.0008, rough: 0.4 },
  tent_cloth: { scan: 'hessian_230', scale: 0.5, alb: 0.45, height: 0.001, rough: 0.4 }, // D-330: the court tents' woven wool, linen and goat hair (the weave; the colour is the tent's)
  prop_clay: { scan: 'clay_floor_001', scale: 0.6, alb: 0.9, height: 0.0008, rough: 0.6 },
  prop_stone: { scan: 'rock_surface', scale: 0.7, alb: 0.8, height: 0.0015, rough: 0.5 },
  prop_leather: { scan: 'Leather014', scale: 0.5, alb: 0.5, height: 0.0005, rough: 0.5 },
  prop_metal: { scan: 'Metal013', scale: 0.4, alb: 0.35, height: 0.0003, rough: 0.6 },
  prop_wood: { scan: 'rough_wood', scale: 0.8, alb: 0.6, height: 0.0015, rough: 0.5 },
  prop_mud: { scan: 'brown_mud_dry', scale: 1.0, alb: 0.6, height: 0.003, rough: 0.4 },
};

/** D-324: detail baked in Blender from a dense modelled surface (tools/blender/wallbake.py), laid triplanar over the scan: one
 *  packed map per entry (public/textures/<tex>/bake.jpg: R, G the tangent normal's x, y, OpenGL; B the cavity, 0.5 neutral).
 *  `scale` metres a tile (not the scan's, so the two repeats do not line up), `nor` the normal's strength, `cav` how far the
 *  cavity darkens the grooves and lightens the ridges (± fraction of the albedo). The houses' plaster (town and villages, near
 *  and far) takes the mud-plaster wall: the float's arcs, the straw, grit and pits, shrinkage cracks, the brick courses faint
 *  through a thin coat (C) */
export const WALL_BAKE: Record<string, { tex: string; scale: number; nor: number; cav: number; /** D-334: the map is public/textures/<tex>/bake.ktx2 (UASTC) */ ktx?: boolean }> = {
  house_plaster: { tex: 'housewall_bake', scale: 2.37, nor: 1.1, cav: 0.3 },
  // D-334 (tools/blender/palacebake.py): the palaces' mud plaster as fresh in 467 (a finer finish coat, the finishing float's
  // wide sweeps, fine chaff, few hairline cracks, the square bricks' courses just through the coat) on every palace wall, painted
  // or not, and their parapets; the roofs' rolled clay-and-straw coat (the roller's tracks, coarse straw, a crack network)
  mudbrick: { tex: 'palacewall_bake', scale: 2.61, nor: 2.2, cav: 0.25, ktx: true },
  mudbrick_painted: { tex: 'palacewall_bake', scale: 2.61, nor: 2.2, cav: 0.25, ktx: true },
  roof_earth: { tex: 'palaceroof_bake', scale: 3.13, nor: 1.8, cav: 0.3, ktx: true },
};
const BAKE = new Map<string, THREE.Texture>();

/** D-300 (T-A7): the surfaces for which the library holds a fitting CC0 scan (stone, earthen and lime plaster, earth and fill,
 *  timber). Drawn without one (no SCAN_USE entry, or a blend under ALB_MIN) such a surface is a procedural stand-in. Not here
 *  (no fitting scan: judged by T-A4): bronze, the glazed brick, the red-painted floors, reed matting, cloth */
export const ALB_MIN = 0.3;
export const SCANNABLE: Record<string, true> = Object.fromEntries(['limestone', 'limestone_merlon', 'limestone_carved', 'limestone_dark',
  'terrace', 'terrace_now', 'terrace_foot', 'stone_rough', 'stone_plain', 'takht_stone', 'nr_dressed', 'nr_rock', 'rubble', 'kaba_white', 'mudbrick', 'mudbrick_painted', 'roof_earth', 'mudbrick_bare',
  'house_brick', 'baked_brick', 'mud_plaster', 'house_plaster', 'house_socle', 'plaster', 'village_mud', 'earth', 'court_fill', 'road', 'bank',
  'refuse', 'timber', 'roof_timber', 'house_timber', 'scaffold'].map(k => [k, true]));
/** the scan applied to a surface at a strength that reads (T-A7's anti-proxy: alb >= ALB_MIN), or null; what the builders record
 *  in material.userData.scan (node as well: there no texture loads, the tag says what the page applies) */
// merged D-300/D-301: in the browser null when the scans are off (?noscans) or this scan did not load; in node (no texture
// loads) the tag says what the page applies, unless a test registered stand-ins (then as in the browser)
export function scanOf(name: string): string | null {
  const u = SCAN_USE[name]; if (!u || u.alb < ALB_MIN || !META[u.scan]) return null;
  return !scansOn || (TEX.size > 0 && !TEX.has(u.scan)) ? null : u.scan;
}
type ScanMeta = { meanLinear: [number, number, number]; meanRough: number; meanAO: number };
const META = SCANS as unknown as Record<string, ScanMeta>;
const TEX = new Map<string, { diff: THREE.Texture; arm: THREE.Texture; nor?: THREE.Texture }>();
/** `?noscans` turns the scans off (A/B); set before the first surfaceMaterial call */
export let scansOn = true;

/** load every scan used (awaited before the world builds its materials); a no-op without a DOM (node) */
export async function loadScans(base = BASE, anisotropy = 8): Promise<void> {
  if (typeof document === 'undefined') return;
  await loadBlockFace(base, anisotropy); // D-321: the Blender-carved block faces (independent of ?noscans; ?noblockface)
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('noscans')) { scansOn = false; return; }
  const L = new THREE.TextureLoader(), ids = [...new Set(Object.values(SCAN_USE).flatMap(u => u.rock ? [u.scan, u.rock.scan] : [u.scan]))];
  const withNor = new Set(Object.values(SCAN_USE).filter(u => u.nor).map(u => u.scan));
  await Promise.all(ids.map(async id => {
    const [diff, arm, nor] = await Promise.all(['diff', 'arm', ...(withNor.has(id) ? ['nor'] : [])].map(f => loadScanTexture(base, `${base}textures/${id}/${f}.jpg`, L))); // (s15/ship: low copies first on the built site, lowfirst.ts)
    for (const t of [diff, arm, nor]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; }
    diff.colorSpace = THREE.SRGBColorSpace; arm.colorSpace = THREE.NoColorSpace; if (nor) nor.colorSpace = THREE.NoColorSpace;
    TEX.set(id, { diff, arm, nor });
  }));
  await loadGround(base, anisotropy);
  // D-324: the baked detail maps (a missing file leaves its surface as the scan alone)
  // D-334: the KTX2 bakes (UASTC, their own mips) through the KTX2 loader, as blockface.ts
  const ktxOf = new Set(Object.values(WALL_BAKE).filter(b => b.ktx).map(b => b.tex));
  let K: any = null;
  if (ktxOf.size) try { const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
    const ad = await (globalThis as any).navigator?.gpu?.requestAdapter?.().catch(() => null);
    K = new KTX2Loader().setTranscoderPath(base + 'models/lib/basis/'); K.detectSupport({ isWebGPURenderer: true, hasFeature: (f: string) => !!ad?.features?.has(f) } as any); } catch { K = null; }
  await Promise.all([...new Set(Object.values(WALL_BAKE).map(b => b.tex))].map(async id => { try {
    const kt = ktxOf.has(id); if (kt && !K) return;
    const t: THREE.Texture = kt ? await K.loadAsync(`${base}textures/${id}/bake.ktx2`) : await L.loadAsync(`${base}textures/${id}/bake.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy; if (!kt) t.generateMipmaps = true; else t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; BAKE.set(id, t); } catch { /* not built: the scan alone */ } }));
  K?.dispose?.();
}
export const scansLoaded = () => TEX.size > 0;
/** D-334: the baked detail maps loaded (their ids), for the probes and the dev overlay */
export const bakesLoaded = () => [...BAKE.keys()];
/** node tests (D-301): stand-in textures for scans, so the scanned material graphs build in node as in the browser */
export function registerScanTextures(ids: string[], make: () => THREE.Texture) { for (const id of ids) TEX.set(id, { diff: make(), arm: make() }); }
/** tests only (D-300): stand-in textures for every scan in use, so node builds the scanned shaders and counts their samplers
 *  (WebGPU's 16 samplers per fragment stage: render v4 failed the Terrace platform's pipeline at 17) */
export function setScanTexturesForTest(on = true): void {
  TEX.clear(); BAKE.clear(); if (!on) return;
  for (const u of Object.values(SCAN_USE)) for (const id of u.rock ? [u.scan, u.rock.scan] : [u.scan])
    if (!TEX.has(id)) TEX.set(id, { diff: new THREE.Texture(), arm: new THREE.Texture(), nor: Object.values(SCAN_USE).some(v => v.scan === id && v.nor) ? new THREE.Texture() : undefined });
  BAKE.clear(); for (const b of Object.values(WALL_BAKE)) BAKE.set(b.tex, new THREE.Texture());
}

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
/** `noRough`: keep the layer's procedural roughness (saves the arm map's sampler: a layer under another's, D-300) */
/** `noNor` (D-321): no normal map and a sixth of the luminance bump (the dressed block faces: their relief is the carved set's,
 *  blockface.ts, not a weathered boulder's; saves the normal map's sampler); the scan's colour grain and roughness stay */
export function applyScan<L extends { alb: any; rough: any; height: any | null; tilt?: any }>(name: string, L: L, noRough = false, noNor = false): L {
  const u = SCAN_USE[name], T = u && TEX.get(u.scan), M = u && META[u.scan];
  if (!scansOn || !u || !T || !M) return applyBake(name, L);
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
  // D-300: no roughness map on rock layers or where the sampler budget asks (noRough); D-301: roughness follows the scan's luminance where roughLum is set
  let rough = u.rock || noRough ? L.rough : L.rough.mul(mix(float(1), tri(T.arm, u.scale).g.div(M.meanRough), u.rough));
  if (u.roughLum) rough = rough.mul(float(1).add(lum.sub(1).mul(u.roughLum)));
  rough = rough.clamp(0.05, 1);
  const bump = lum.sub(1).mul(u.height * (noNor ? 1 / 6 : 1));
  const nt = u.nor && T.nor && !noNor ? triNormal(T.nor, u.scale).mul(u.nor) : null;
  return applyBake(name, { ...L, alb, rough, height: L.height ? L.height.add(bump) : bump, ...(nt ? { tilt: L.tilt ? L.tilt.add(nt) : nt } : {}) });
}
/** D-324: the Blender-baked detail (WALL_BAKE) over a layer: one sampler, three projections; the normal as a world-space tilt
 *  (as the scans' own normal maps, triNormal), the cavity into the albedo (mean-neutral). Identity when not loaded (node) */
function applyBake<L extends { alb: any; rough: any; height: any | null; tilt?: any }>(name: string, L: L): L {
  const b = WALL_BAKE[name], t = b && scansOn ? BAKE.get(b.tex) : undefined; if (!b || !t) return L;
  const p = positionWorld.div(b.scale), w0 = pow(abs(normalWorld), vec3(4)), w = w0.div(max(dot(w0, vec3(1)), float(1e-4)));
  const sx = texture(t, p.zy), sy = texture(t, p.xz), sz = texture(t, p.xy);
  const tx = sx.xy.mul(2).sub(1), ty = sy.xy.mul(2).sub(1), tz = sz.xy.mul(2).sub(1);
  const tilt = vec3(float(0), tx.y, tx.x).mul(w.x).add(vec3(ty.x, float(0), ty.y).mul(w.y)).add(vec3(tz.x, tz.y, float(0)).mul(w.z)).mul(b.nor);
  const cav = sx.z.mul(w.x).add(sy.z.mul(w.y)).add(sz.z.mul(w.z)).sub(0.5).mul(2 * b.cav).add(1);
  return { ...L, alb: L.alb.mul(cav), tilt: L.tilt ? L.tilt.add(tilt) : tilt };
}

// ---------------------------------------------------------------- the ground layers (D-302)
// The plain, the rivers' banks, the tracks and the hills are drawn by a few materials whose land cover changes per pixel (dust,
// herbs, stubble, tilled plots, trodden paths, wet mud, rock, scree). D-295 laid ONE scan over the terrain (cracked dry earth)
// before the plain's layers, which then replaced its albedo wherever a field, a path or the hills' rock was drawn: cracks on
// every bare patch and procedural colour everywhere else. Here each cover takes its own scan, multiplied into that cover's own
// albedo (scan ÷ its mean: the measured tints and layouts stay), with the scan's displacement as the cover's bump. The layers
// are one 2-D array texture (RGB the scan's colour, sRGB; A its displacement), so all of them cost one sampler (WebGPU allows
// 16 per fragment stage and the terrain's material had used all 16: D-295).
/** land cover -> scan (public/textures/<id>; src/data/scans.json; ASSET_LEDGER.md). Tier C: modern ground standing in for 467's */
export const GROUND = {
  dust: 'dirt', //             dry loam with grit and small stones: the plain's bare ground
  stony: 'rocks_ground_09', // stony soil: foot slopes, gravel fans, the steppe's stony patches
  packed: 'rocky_trail_02', // trodden earth and fine gravel: paths, tracks, the town's used ground
  straw: 'withered_grass', //  dry herbs, stubble, straw-coloured crops
  green: 'grass_ground', //    green herbs and young crops
  tilled: 'farm_soil', //      ploughed and sown ground
  mud: 'brown_mud_02', //      wet mud after rain, the waterline
  cracked: 'mud_cracked_dry_riverbed_002', // dried silt: the low spots where the rain stood, the rivers' summer bands
  rock: 'rock_face_03', //     limestone outcrops and the mountain's rock (near)
  rockFar: 'aerial_ground_rock', // the mountain's rock at 60-240 m tiles (an aerial scan: the pattern of outcrop and soil)
  scree: 'rocky_trail', //     angular scree and talus
  pebbles: 'dry_river_pebbles', // river gravel: the fords' and banks' beds
} as const;
export type GroundCover = keyof typeof GROUND;
const GROUND_KEYS = Object.keys(GROUND) as GroundCover[];
/** the array's side (texels); the scans are 2K */
export const GROUND_RES = 2048;
let groundArr: THREE.DataArrayTexture | null = null;
/** per layer: the colour's linear mean (src/data/scans.json) and the height channel's mean and sd (measured on load) */
const GSTAT = new Map<GroundCover, { mean: [number, number, number]; hMean: number; hSd: number }>();

async function loadGround(base: string, anisotropy: number): Promise<void> {
  const N = GROUND_KEYS.length, R = GROUND_RES, data = new Uint8Array(R * R * 4 * N);
  const cv = new OffscreenCanvas(R, R), g = cv.getContext('2d', { willReadFrequently: true })!;
  const pixels = async (url: string | Promise<Response>) => {
    const r = await (typeof url === 'string' ? fetch(url) : url); if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) return null; // (a dev server answers a missing file with its page)
    const bm = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    g.clearRect(0, 0, R, R); g.drawImage(bm, 0, 0, R, R); bm.close(); return g.getImageData(0, 0, R, R).data;
  };
  // s15/ship: every layer's files fetched at once (they were fetched one after another, each after the last one's decode), the
  // built site's low copies first (lowfirst.ts; drawn up to R like the full ones), the full files swapped in after the world is up
  const url = (id: string, f: string) => `${base}textures/${id}/${f}.jpg`;
  const pick = async (u: string) => { const lo = await lowOf(base, u); return { lo: !!lo, res: fetch(lo ? lo.url : u) }; };
  // (s15/ship D-393: the aerial rock has no displacement map: not asked for, so a visit logs no 404)
  const none = async () => ({ lo: false, res: Promise.resolve(new Response(null, { status: 404 })) });
  const files = GROUND_KEYS.map(k => [pick(url(GROUND[k], 'diff')), GROUND[k] === 'aerial_ground_rock' ? none() : pick(url(GROUND[k], 'disp'))]);
  const fill = (k: number, diff: Uint8ClampedArray, disp: Uint8ClampedArray | null) => { const o = k * R * R * 4;
    for (let i = 0; i < R * R * 4; i += 4) { const h = disp ? disp[i] : Math.round(0.2126 * diff[i] + 0.7152 * diff[i + 1] + 0.0722 * diff[i + 2]);
      data[o + i] = diff[i]; data[o + i + 1] = diff[i + 1]; data[o + i + 2] = diff[i + 2]; data[o + i + 3] = h; } };
  for (let k = 0; k < N; k++) {
    const id = GROUND[GROUND_KEYS[k]], [fd, fh] = await Promise.all(files[k]), diff = await pixels(fd.res);
    if (!diff) throw new Error(`ground scan ${id}: no diff.jpg`);
    const disp = await pixels(fh.res), o = k * R * R * 4;
    if (fd.lo || fh.lo) addUpgrade(async () => { const d2 = await pixels(url(id, 'diff')), h2 = disp ? await pixels(url(id, 'disp')) : null; if (!d2 || !groundArr) return;
      fill(k, d2, h2); (groundArr as THREE.DataArrayTexture).addLayerUpdate(k); groundArr.needsUpdate = true; });
    let s = 0, s2 = 0, n = 0;
    for (let i = 0; i < R * R * 4; i += 4) {
      // the height: the displacement map, or (no map: the aerial rock) the colour's luminance
      const h = disp ? disp[i] : Math.round(0.2126 * diff[i] + 0.7152 * diff[i + 1] + 0.0722 * diff[i + 2]);
      data[o + i] = diff[i]; data[o + i + 1] = diff[i + 1]; data[o + i + 2] = diff[i + 2]; data[o + i + 3] = h;
      if ((i & 60) === 0) { s += h; s2 += h * h; n++; }
    }
    const m = s / n / 255, sd = Math.sqrt(Math.max(1e-6, s2 / n / 65025 - m * m));
    GSTAT.set(GROUND_KEYS[k], { mean: META[id].meanLinear, hMean: m, hSd: sd });
  }
  const t = new THREE.DataArrayTexture(data, R, R, N);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = anisotropy; t.needsUpdate = true;
  groundArr = t;
}
export const groundLoaded = () => groundArr !== null;

/** one ground layer's detail at the pixel: `c` the scan's colour over its mean (1 on average), `h` its height in units of its
 *  own sd (0 on average). Planar (world x, z: the ground) at `scale` m per tile, or triplanar (`tri`: rock on steep ground);
 *  `scale2` multiplies in a second, larger tile turned 37° (breaks the repeat); `bias` a mip bias. Identity (c 1, h 0) when no scans are loaded */
export function groundScan(cover: GroundCover, scale: number, o: { tri?: boolean; scale2?: number; /** mip bias: the layer's fine detail left out (a macro layer: its colour and relief over metres, not texels) */ bias?: number } = {}): { c: any; h: any } {
  const S = GSTAT.get(cover);
  if (!scansOn || !groundArr || !S) return { c: vec3(1), h: float(0) };
  const k = int(GROUND_KEYS.indexOf(cover)), arr = groundArr, p = positionWorld;
  const at = (uv: any) => o.bias ? texture(arr, uv).depth(k).bias(float(o.bias)) : texture(arr, uv).depth(k);
  const one = (sc: number, rot: number) => {
    const c = Math.cos(rot), s = Math.sin(rot), P = rot ? vec3(p.x.mul(c).sub(p.z.mul(s)), p.y, p.x.mul(s).add(p.z.mul(c))).add(vec3(17.3, 0, 41.9)) : p;
    const q = P.div(sc);
    if (!o.tri) return at(q.xz);
    const w0 = pow(abs(normalWorld), vec3(4)), w = w0.div(max(dot(w0, vec3(1)), float(1e-4)));
    return at(q.zy).mul(w.x).add(at(q.xz).mul(w.y)).add(at(q.xy).mul(w.z));
  };
  const mean = vec3(...S.mean), a = one(scale, 0);
  let c: any = a.rgb.div(mean), h: any = a.a.sub(S.hMean).div(S.hSd);
  if (o.scale2) { const b = one(o.scale2, 0.65); c = c.mul(b.rgb.div(mean)); h = h.add(b.a.sub(S.hMean).div(S.hSd).mul(0.5)); }
  return { c, h };
}
