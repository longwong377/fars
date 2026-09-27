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
  await loadGround(base, anisotropy);
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
  const pixels = async (url: string) => {
    const r = await fetch(url); if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) return null; // (a dev server answers a missing file with its page)
    const bm = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    g.clearRect(0, 0, R, R); g.drawImage(bm, 0, 0, R, R); bm.close(); return g.getImageData(0, 0, R, R).data;
  };
  for (let k = 0; k < N; k++) {
    const id = GROUND[GROUND_KEYS[k]], diff = await pixels(`${base}textures/${id}/diff.jpg`);
    if (!diff) throw new Error(`ground scan ${id}: no diff.jpg`);
    const disp = await pixels(`${base}textures/${id}/disp.jpg`), o = k * R * R * 4;
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
