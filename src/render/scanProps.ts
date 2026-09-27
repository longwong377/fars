// CC0 scanned props in the game (session 12, D-310): rocks, stones, ground flora, jars, pots, baskets, crates, bowls from Poly
// Haven (CC0 1.0; ASSET_LEDGER.md), converted by tools/blender/ph_props.mjs into public/models/props/<id>.glb (Draco, two
// levels `lod0` / `lod1`, the scan's albedo / normal / ARM maps as JPEG) and public/models/props/manifest.json.
// Loaded once before the world is built (world.ts), so every builder can ask synchronously:
//  - scanProp(id) / propsFor(role): the levels (geometry, base on y = 0, footprint centred) and the maps; null when the
//    props are absent, failed or switched off (?props=0): the builder then draws its procedural stand-in and flags it;
//  - scanMaterial(id, tint): the scan's surface with its albedo re-tinted to the builder's measured colour (tint x the scan's
//    albedo / its own mean: the grain and the variation of the scan, the colour of the place), its normal and ARM maps kept;
//  - fitProp(): a level scaled to a builder's box (as models.ts fitLevel), for the procedural generators' own sizes.
// The generators keep their placement, counts, sizes and tiers: only the shape and the surface change.
import * as THREE from 'three/webgpu';
import { texture, uv, vec3, float, dot, attribute } from 'three/tsl';

export interface PropEntry { file: string; role: string; licence: string; source: string; bytes: number; sha256: string; srcTris: number; tris: Record<string, number>; size_m: number[]; tex: number }
export interface ScanProp { id: string; entry: PropEntry; lods: THREE.BufferGeometry[]; map: THREE.Texture | null; normal: THREE.Texture | null; arm: THREE.Texture | null; mean: [number, number, number]; size: [number, number, number] }
const PROPS = new Map<string, ScanProp>();
const LOAD = { ms: 0, loaded: [] as string[], failed: [] as string[], off: false };
export const scanPropStats = () => ({ ...LOAD, count: PROPS.size });

/** the mean colour of a texture's image (linear-ish sRGB 0..1), from a 16x16 draw; 0.5 grey when it cannot be read */
function meanColour(t: THREE.Texture | null): [number, number, number] {
  try {
    const img = t?.image as CanvasImageSource | undefined; if (!img || typeof OffscreenCanvas === 'undefined') return [0.5, 0.5, 0.5];
    const c = new OffscreenCanvas(16, 16), g = c.getContext('2d')!; g.drawImage(img, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, b = 0;
    const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    for (let i = 0; i < d.length; i += 4) { r += lin(d[i]); gg += lin(d[i + 1]); b += lin(d[i + 2]); }
    const n = d.length / 4; return [r / n, gg / n, b / n];
  } catch { return [0.5, 0.5, 0.5]; }
}

/** load every prop of the manifest (browser). Never throws: a failed prop leaves its builder's stand-in (and says so). */
export async function loadScanProps(base = '/'): Promise<ReturnType<typeof scanPropStats>> {
  const t0 = performance.now();
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('props') === '0') { LOAD.off = true; return scanPropStats(); }
  let man: { assets: Record<string, PropEntry> };
  try { const r = await fetch(base + 'models/props/manifest.json'); if (!r.ok) throw new Error(`manifest ${r.status}`); man = await r.json(); }
  catch (e) { console.warn(`[props] no manifest (${(e as Error).message}): procedural stand-ins drawn`); return scanPropStats(); }
  const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js')]);
  const draco = new DRACOLoader().setDecoderPath(base + 'models/lib/draco/'), loader = new GLTFLoader().setDRACOLoader(draco);
  await Promise.all(Object.entries(man.assets).map(async ([id, e]) => {
    try {
      const g = await loader.loadAsync(base + e.file);
      const lods: THREE.BufferGeometry[] = []; let mat: THREE.MeshStandardMaterial | null = null;
      for (const name of ['lod0', 'lod1']) {
        const m = g.scene.getObjectByName(name) as THREE.Mesh | undefined; if (!m?.isMesh) throw new Error(`level ${name} missing`);
        m.updateMatrixWorld(true); const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld);
        for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
        if (!geo.getAttribute('normal')) geo.computeVertexNormals();
        geo.computeBoundingBox(); geo.computeBoundingSphere(); lods.push(geo); mat ??= m.material as THREE.MeshStandardMaterial;
      }
      const b = lods[0].boundingBox!, size: [number, number, number] = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
      const map = mat?.map ?? null, normal = mat?.normalMap ?? null, arm = mat?.roughnessMap ?? mat?.metalnessMap ?? null;
      for (const t of [map, normal, arm]) if (t) { t.anisotropy = 8; t.needsUpdate = true; }
      PROPS.set(id, { id, entry: e, lods, map, normal, arm, mean: meanColour(map), size }); LOAD.loaded.push(id);
    } catch (err) { LOAD.failed.push(id); console.warn(`[props] ${id}: ${(err as Error).message}; its procedural stand-in is drawn`); }
  }));
  draco.dispose();
  LOAD.ms = Math.round(performance.now() - t0);
  if (typeof window !== 'undefined') (window as any).__scanProps = { stats: scanPropStats, ids: () => [...PROPS.keys()] };
  return scanPropStats();
}
export const scanProp = (id: string): ScanProp | null => PROPS.get(id) ?? null;
/** the loaded props standing for `role` (manifest order), empty when none */
export const propsFor = (role: string): ScanProp[] => [...PROPS.values()].filter(p => p.entry.role === role).sort((a, b) => (a.id < b.id ? -1 : 1));
/** register a prop directly (tests; node has no GLTF loading) */
export function _setScanProp(p: ScanProp) { PROPS.set(p.id, p); }

/** a copy of a level scaled so its box is `size` (x, y, z m), base on y = 0, footprint centred */
export function fitProp(g: THREE.BufferGeometry, size: [number, number, number]): THREE.BufferGeometry {
  const out = g.clone(); out.computeBoundingBox(); const b = out.boundingBox!;
  const s = [size[0] / Math.max(1e-6, b.max.x - b.min.x), size[1] / Math.max(1e-6, b.max.y - b.min.y), size[2] / Math.max(1e-6, b.max.z - b.min.z)];
  const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, P = out.getAttribute('position'), N = out.getAttribute('normal');
  for (let i = 0; i < P.count; i++) {
    P.setXYZ(i, (P.getX(i) - cx) * s[0], (P.getY(i) - b.min.y) * s[1], (P.getZ(i) - cz) * s[2]);
    if (N) { const x = N.getX(i) / s[0], y = N.getY(i) / s[1], z = N.getZ(i) / s[2], l = Math.hypot(x, y, z) || 1; N.setXYZ(i, x / l, y / l, z / l); }
  }
  P.needsUpdate = true; if (N) N.needsUpdate = true; out.computeBoundingBox(); out.computeBoundingSphere(); return out;
}

type Tint = [number, number, number] | any;
/** the scan's surface re-tinted: albedo = tint x (scan albedo / its mean), clamped; normal and ARM (occlusion, roughness)
 *  maps kept. `tint` a colour or a colour node (a season's mix). Not cached: the caller keeps it. */
export function scanMaterial(p: ScanProp, tint?: Tint, o: { roughness?: number; side?: THREE.Side; /** a per-instance colour attribute multiplied in */ tintAttr?: string } = {}): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: o.roughness ?? 0.9, metalness: 0, side: o.side ?? THREE.FrontSide });
  if (p.map) {
    // the scan's luminance relative to its mean: its grain and shading variation without its own hue (a Namaqualand granite,
    // a sandstone), so the hue is the place's measured one
    const t = texture(p.map, uv()).rgb, W = vec3(0.2126, 0.7152, 0.0722), meanY = Math.max(0.02, 0.2126 * p.mean[0] + 0.7152 * p.mean[1] + 0.0722 * p.mean[2]);
    const rel = dot(t, W).div(meanY).clamp(0, 2.5);
    let c = tint ? (Array.isArray(tint) ? vec3(...tint) : tint).mul(rel) : t;
    if (o.tintAttr) c = c.mul(attribute(o.tintAttr, 'vec3'));
    m.colorNode = c;
  } else if (tint) m.colorNode = Array.isArray(tint) ? vec3(...tint) : tint;
  if (p.normal) { m.normalMap = p.normal; }
  if (p.arm) { const a = texture(p.arm, uv()); m.roughnessNode = a.g.mul(float(1)); m.aoNode = a.r; }
  m.name = `scan:${p.id}`;
  return m;
}

/** the scanned shapes by class (D-310): the builders of jars, pots, baskets and bowls take their geometry from these, fitted to
 *  their own measured box, and keep their own materials (the vertex-coloured merges of the rooms and the performances) */
export const SHAPES = {
  jar: ['ceramic_vase_01', 'ceramic_vase_04', 'antique_ceramic_vase_01'],
  pot: ['ceramic_pot', 'planter_pot_clay'],
  basket: ['wicker_basket_01', 'wicker_basket_02'],
  bowl: ['wooden_bowl_01'],
  crate: ['wooden_crate_02'],
} as const;
/** a scanned shape of `cls` (variant by `seed`) fitted to `size` (x, y, z m; base on y = 0, footprint centred); null when no
 *  scan of the class is loaded (the caller draws its procedural form) */
export function scanShape(cls: keyof typeof SHAPES, seed: number, size: [number, number, number], lod: 0 | 1 = 0): THREE.BufferGeometry | null {
  const ps = SHAPES[cls].map(id => PROPS.get(id)).filter((p): p is ScanProp => !!p); if (!ps.length) return null;
  const p = ps[Math.abs(Math.floor(seed)) % ps.length]; return fitProp(p.lods[lod], size);
}
