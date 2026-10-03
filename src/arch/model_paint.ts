// D-752 (holes.md #3; RELIEFS_AND_COLOUR §3b and s18 D-771): the Blender-built sculpture of the Terrace painted and partly
// gilded as a living court kept it, not the bare stone of the ruin. Every zone C (no zone-by-zone evidence for the capitals or
// the colossi was read), the pigments B (§3a: Egyptian blue, cinnabar and red ochre, yellow ochre, malachite, carbon black,
// calcite white; gold leaf on the Terrace, Iranica 'traces of green, gold, blue and red paint'):
//  - the double-bull protome capitals: horns and ears gilded, the hooves dark, the heads and the hide a warm ochre wash;
//  - the Gate's man-headed bulls (lamassu): the crown gilded with a blue band, hair and beard dark blue (§3b: 'dark blue was used
//    for hair and beard', B/C), the face in flesh ochre, the wings' feather rows in bands of blue, red and green on an ochre
//    ground, the hooves dark; the hide the stone's own colour under a thin ochre wash;
//  - the Gate's bulls: horns gilded, a red collar, hooves dark;
//  - the volute members: the rolls' rims blue, their faces red, the central rosettes gilded.
// The zones are read from the model's own space (each GLB's bounding box, measured: the colossi 5 x 5.5 x 1.6 m with the head
// at +x and the jamb block at -x; the protome a 3.3 x 2.1 x 1 m double bull with the heads at ±x). Drawn through the vertex
// colour (`color`, linear albedo) and the gilt mask (`gilt`) on the model's own baked material: no new texture or sampler.
import * as THREE from 'three/webgpu';
import { attribute, float, mix, vec3, clamp, texture, uv, normalMap, normalView } from 'three/tsl';
import { surfaceMaterial, SURFACES } from '../render/materials';
import PC from '../data/polychromy.json';
import { labToLinear } from '../core/colour';

const pig = (k: string): [number, number, number] => { const L = (PC as any).pigment[k].v; return labToLinear(L[0], L[1], L[2]) as [number, number, number]; };
const srgb = (c: number[]) => { const q = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [q.r, q.g, q.b] as [number, number, number]; };
/** linear albedos of the pigments (polychromy.json's Lab rows, as the reliefs use them) */
export const MP = {
  stone: srgb(SURFACES.limestone_carved.albedo), blue: pig('egyptian_blue'), dark: pig('dark_blue'), red: pig('cinnabar'),
  ochre: pig('yellow_ochre'), flesh: srgb([0.74, 0.5, 0.36]), green: pig('malachite'), black: pig('black'), white: pig('white'),
  gold: [1, 0.78, 0.34] as [number, number, number],
};
/** a wash: the pigment laid thin over the stone (its mean the mix) */
const wash = (c: number[], k: number) => MP.stone.map((s, i) => s * (1 - k) + c[i] * k) as [number, number, number];

type Zone = (x: number, y: number, z: number, u: number, v: number, w: number) => { c: number[]; g?: number } | null;
/** the zone rule per model: (x, y, z) in the model's space, (u, v, w) the same normalised to its box (0..1) */
const RULES: Record<string, Zone> = {
  capital_protome: (x, y) => {
    const ax = Math.abs(x);
    if (ax > 1.0 && y > 1.72) return { c: MP.gold, g: 1 }; // horns and ears
    if (y < 0.35 && ax > 0.55) return { c: MP.black }; // the hooves of the folded forelegs
    if (ax > 1.1) return { c: wash(MP.ochre, 0.35) }; // the heads
    return { c: wash(MP.ochre, 0.22) }; // the hide
  },
  colossus_lamassu: (x, y, z) => {
    if (x < -1.85) return null; // the jamb block: stone
    if (x > 1.25 && y > 4.85) return { c: y > 5.05 && y < 5.18 ? MP.blue : MP.gold, g: y > 5.05 && y < 5.18 ? 0 : 1 }; // the crown
    if (x > 1.95 && y > 4.4 && y <= 4.85) return { c: MP.flesh }; // the face
    if (x > 1.3 && y > 3.7 && y <= 4.85) return { c: MP.dark }; // hair and beard
    if (y > 3.55 && x <= 1.3 && Math.abs(z) > 0.25) { // the wings: rows of feathers along x, in bands
      // (the feather rows run along the wing, stacked upward: a band per ~0.22 m row; the coverts at the wing's root ochre)
      const row = Math.floor((y - 3.55) / 0.22), cov = y > 4.6;
      return { c: cov ? MP.ochre : [MP.blue, MP.ochre, MP.red, MP.ochre, MP.green, MP.ochre][((row % 6) + 6) % 6] };
    }
    if (y < 0.45) return { c: MP.black }; // hooves
    return { c: wash(MP.ochre, 0.18) };
  },
  colossus_bull: (x, y) => {
    if (x < -1.85) return null;
    if (x > 1.35 && y > 4.05) return { c: MP.gold, g: 1 }; // horns
    if (x > 1.1 && y > 3.08 && y < 3.2) return { c: MP.red }; // the collar
    if (y < 0.45) return { c: MP.black };
    return { c: wash(MP.ochre, 0.18) };
  },
  capital_volute: (x, y, z, u, v) => {
    const r = Math.min(v, 1 - v);
    if (Math.abs(z) > 0.4) return r < 0.08 ? { c: MP.gold, g: 1 } : { c: r < 0.2 ? MP.blue : MP.red }; // the faces of the rolls
    return { c: wash(MP.blue, 0.4) };
  },
};
export const PAINTED_MODELS = Object.keys(RULES);

const done = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
/** the model level with its paint (`color`, linear albedo; `gilt`, 0/1), computed once per source geometry */
export function paintedLevel(id: string, g: THREE.BufferGeometry): THREE.BufferGeometry {
  const hit = done.get(g); if (hit) return hit;
  const R = RULES[id]; if (!R) return g;
  const out = g.clone(); out.computeBoundingBox(); const b = out.boundingBox!, s = b.getSize(new THREE.Vector3());
  const P = out.getAttribute('position'), n = P.count, col = new Float32Array(n * 3), gilt = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), r = R(x, y, z, (x - b.min.x) / s.x, (y - b.min.y) / s.y, (z - b.min.z) / s.z);
    const c = r?.c ?? MP.stone; col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; gilt[i] = r?.g ?? 0;
  }
  out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setAttribute('gilt', new THREE.BufferAttribute(gilt, 1));
  done.set(g, out); return out;
}
/** the painted level's share of vertices by colour (tests) */
export function paintShares(g: THREE.BufferGeometry) {
  const C = g.getAttribute('color'), G = g.getAttribute('gilt'), n = C.count; let painted = 0, gilt = 0;
  for (let i = 0; i < n; i++) { if (Math.abs(C.getX(i) - MP.stone[0]) + Math.abs(C.getY(i) - MP.stone[1]) + Math.abs(C.getZ(i) - MP.stone[2]) > 0.02) painted++; if (G.getX(i) > 0.5) gilt++; }
  return { painted: painted / n, gilt: gilt / n };
}

const MATS = new Map<string, THREE.MeshStandardNodeMaterial>();
/** the model's baked material (render/models.ts bakedMaterial: the normal map and the occlusion) with the paint: the vertex
 *  colour as the albedo under the stone's scan, the gilt mask as burnished gold leaf (metal, roughness 0.3) */
export function paintedModelMaterial(surface: string, map: THREE.Texture, key: string): THREE.MeshStandardNodeMaterial {
  const k = `${surface}|${key}`, hit = MATS.get(k); if (hit) return hit;
  const m = surfaceMaterial(surface, { vertexColors: true, variant: `model-paint:${key}` });
  const G = clamp(attribute('gilt', 'float'), 0, 1);
  m.metalnessNode = G.mul(0.95);
  m.roughnessNode = mix((m.roughnessNode ?? float(SURFACES[surface]?.roughness ?? 0.6)) as any, float(0.3), G);
  m.colorNode = mix((m.colorNode ?? attribute('color', 'vec3')) as any, vec3(MP.gold[0], MP.gold[1], MP.gold[2]), G);
  withMap(m, map);
  m.name = `model-paint:${key}:${surface}`; m.userData = { ...m.userData, tier: 'C', note: `${m.userData.note ?? ''}; D-752: painted and gilded (src/arch/model_paint.ts: zones C, pigments B)` };
  MATS.set(k, m); return m;
}
// the baked map as bakedMaterial lays it (render/models.ts): the normal map with the surface's own fine relief carried over, and
// the occlusion in the map's alpha
function withMap(m: THREE.MeshStandardNodeMaterial, map: THREE.Texture) {
  const t = texture(map, uv()), nMap = normalMap(t.rgb) as any, fine = m.normalNode as any;
  m.normalNode = fine ? nMap.add(fine.sub(normalView)).normalize() : nMap;
  m.aoNode = t.a;
}
