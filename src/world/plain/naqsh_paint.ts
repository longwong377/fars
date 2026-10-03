// s18 C15 (D-800): the paint and gilding of the tomb façades at Naqsh-e Rustam as they stood in 467 BCE. The reliefs (the
// bearers, the king, the altar, the winged figure, the guards) are painted by the relief system already (D-030, D-320); this
// paints the architecture they stand in: the column bases' tori, the astragals, the bull capitals (a warm wash, the horns and
// the harness band gilded), the architrave's three fasciae (red, blue, green), the dentils (blue faces, dark blue between),
// the cornice (red), the doorway's receding bands and its cavetto, the throne's beams and slab (red and blue) and its legs
// (gilded, as the Greek writers' golden thrones and the Terrace's gilded relief traces; C), the dais beams the bearers lift.
// The recess's back, the lower arm, the shafts and the ground line stay bare dressed stone (the Terrace reliefs' ground is the
// stone, D-030). Pigments are the project's palette (src/data/polychromy.json: Egyptian blue, dark blue, malachite, cinnabar,
// red and yellow ochre, white; the gilt as gold leaf, D-151): identification B, which zone takes which colour C (the Getty
// "Persepolis Reimagined" and the painted-architecture traces of the Terrace, RELIEFS_AND_COLOUR §3). Per vertex: `pcol`
// (linear), `pcov` (coverage), `pgilt`; one material, no texture (the T4's sampler budget).
import * as THREE from 'three/webgpu';
import { attribute, float, mix, vec3, mx_noise_float, positionWorld, smoothstep, fwidth, clamp } from 'three/tsl';
import PC from '../../data/polychromy.json';
import { labToLinear, type RGB } from '../../core/colour';
import { surfaceMaterial, type Layer } from '../../render/materials';
import { receiveReliefShadow } from '../../render/reliefShadow';

const PIG = (PC as any).pigment as Record<string, { v: [number, number, number] }>;
export const pigment = (k: string): RGB => labToLinear(...PIG[k].v);
const GOLD = (PC as any).paint.gold.v as { f0: [number, number, number]; roughness: number };

/** the façade's zones in its own frame: x from the façade's axis (m), h above the ancient foot (m), z out of the recess's back
 *  (m); hMid the median register's foot, ch the column height, colX the column axes. Returns [colour, coverage, gilt] */
export interface FacadeFrame { hMid: number; hTop: number; ch: number; colX: number[]; doorW: number; doorH: number; span: number; bearerH: number }
export function facadePaint(F: FacadeFrame, x: number, h: number, z: number, ny: number): [RGB | null, number, number] {
  const ax = Math.abs(x), nearCol = Math.min(...F.colX.map(c => Math.abs(x - c))), capTop = F.hMid + F.ch;
  if (z < 0.04) return [null, 0, 0]; // the recess's back: the reliefs' ground, bare stone
  // the doorway (its bands and cavetto: alternately red and blue by depth; the sealing slab bare)
  const d0 = F.hMid + 0.2, d1 = d0 + F.doorH + 0.85;
  if (h >= d0 && h <= d1 && ax <= F.doorW / 2 + 1.0) {
    if (ax < F.doorW / 2 - 0.02 && h < d0 + F.doorH) return [null, 0, 0];
    if (h > d0 + F.doorH + 0.35) return [pigment(z > 0.55 ? 'cinnabar' : 'egyptian_blue'), 0.9, 0];
    return [pigment(Math.floor(z / 0.12) % 2 ? 'red_ochre' : 'egyptian_blue'), 0.8, 0];
  }
  if (h >= F.hMid && h < F.hTop) {
    // the columns: torus of the base, the astragal under the capital, the bull capitals
    if (nearCol < 0.62 && h < F.hMid + 0.42) return h > F.hMid + 0.16 ? [pigment('egyptian_blue'), 0.85, 0] : [null, 0, 0];
    if (nearCol < 0.5 && h > capTop - 1.0 && h < capTop - 0.82) return [pigment('cinnabar'), 0.9, 0];
    if (nearCol < 1.4 && h >= capTop - 0.82 && h < capTop) {
      if (ny > 0.6 && h > capTop - 0.3 && z > 0.8) return [pigment('yellow_ochre'), 1, 1]; // the horns' and the backs' tops: gilded
      if (h < capTop - 0.62) return [pigment('cinnabar'), 0.85, 0.35]; // the harness band, studded with gold
      return [pigment('yellow_ochre'), 0.32, 0]; // the bull's body: a thin warm wash over the stone
    }
    // the entablature: three fasciae, dentils, cornice
    if (h >= capTop && h < capTop + 0.9) { const k = Math.floor((h - capTop) / 0.3); return [pigment(['cinnabar', 'egyptian_blue', 'malachite'][Math.min(2, k)]), 0.9, 0]; }
    if (h >= capTop + 0.9 && h < capTop + 1.2) return [pigment(z > 0.9 ? 'egyptian_blue' : 'dark_blue'), 0.9, 0];
    if (h >= capTop + 1.2 && h < capTop + 1.7) return [pigment(ny > 0.5 ? 'white' : 'cinnabar'), 0.85, 0];
    return [null, 0, 0];
  }
  if (h >= F.hTop) {
    const u0 = F.hTop, beams = [u0 + 0.35 + F.bearerH, u0 + 0.35 + 2 * F.bearerH + 0.3], top = u0 + 0.35 + 2 * (F.bearerH + 0.3);
    if (ax > F.span / 2 - 0.45 && ax < F.span / 2 + 0.4 && h > u0 + 0.35 && h < top + 0.05 && z > 0.12) return [pigment('yellow_ochre'), 1, 1]; // the throne's legs: gilded
    for (const b of beams) if (h >= b - 0.02 && h < b + 0.3 && ax < F.span / 2 + 0.1) return [pigment('egyptian_blue'), 0.9, 0];
    if (h >= top - 0.02 && h < top + 0.37 && ax < F.span / 2 + 0.4) return [pigment(h > top + 0.25 ? 'yellow_ochre' : 'cinnabar'), 0.9, h > top + 0.25 ? 0.6 : 0];
  }
  return [null, 0, 0];
}

/** writes `pcol`, `pcov`, `pgilt` on a façade geometry (world positions; `toLocal` gives x, h, z of the façade's frame) */
export function paintFacadeGeometry(g: THREE.BufferGeometry, F: FacadeFrame, toLocal: (wx: number, wy: number, wz: number) => [number, number, number]): { painted: number; gilt: number } {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), N = p.count;
  const col = new Float32Array(N * 3), cov = new Float32Array(N), gilt = new Float32Array(N); let painted = 0, gl = 0;
  for (let i = 0; i < N; i++) { const [x, h, z] = toLocal(p.getX(i), p.getY(i), p.getZ(i)), [c, k, gg] = facadePaint(F, x, h, z, n ? n.getY(i) : 0);
    if (c) { col.set(c, i * 3); cov[i] = k; gilt[i] = gg; painted++; if (gg > 0.5) gl++; } }
  g.setAttribute('pcol', new THREE.BufferAttribute(col, 3)); g.setAttribute('pcov', new THREE.BufferAttribute(cov, 1)); g.setAttribute('pgilt', new THREE.BufferAttribute(gilt, 1));
  return { painted, gilt: gl };
}

/** the façade's surface with its paint film and gold leaf (the relief paint's model, render/materials.ts paintedStoneMaterial,
 *  in the stone's own surface: a brushed film whose small losses show the stone, matte; the gold metal) */
const MATS = new Map<string, THREE.MeshStandardNodeMaterial>();
export function paintedFacadeMaterial(surface: string, variant: string): THREE.MeshStandardNodeMaterial {
  const key = `${surface}|${variant}`, hit = MATS.get(key); if (hit) return hit;
  const F = (PC as any).paint.film.v;
  let leafN: any = null;
  const m = surfaceMaterial(surface, { variant: `${variant}:painted`, modify: (L: Layer) => {
    const p = positionWorld, foot = fwidth(p).length();
    const n01 = (f: number) => mix(mx_noise_float(p.mul(f)).mul(0.5).add(0.5), float(0.5), smoothstep(0.2, 0.45, foot.mul(f)));
    const cov = clamp(attribute('pcov', 'float'), 0, 1), gilt = clamp(attribute('pgilt', 'float'), 0, 1);
    const kept = float(1).sub(smoothstep(0.78, 0.86, n01(140).add(float(1).sub(cov).mul(0.3)))); // small flaked losses (C)
    const thick = n01(F.brush_freq).mul(1 - F.thickness_min).add(F.thickness_min), film = cov.mul(float(1).sub(thick.mul(-F.hiding).exp())).mul(kept);
    const leaf = gilt.mul(kept); leafN = leaf;
    const tone = L.alb.div(L.alb.dot(vec3(0.33, 0.34, 0.33)).max(0.05)).mul(0.5).add(0.5); // the stone's grain under the film
    const alb = mix(mix(L.alb, attribute('pcol', 'vec3').mul(tone), film), vec3(...GOLD.f0), leaf);
    return { ...L, alb, rough: mix(mix(L.rough, float(F.roughness), film), float(GOLD.roughness), leaf) };
  } });
  if (leafN) m.metalnessNode = leafN;
  class GiltLighting extends (THREE as any).PhysicalLightingModel { // the skylight in the gold's specular lobe (as the reliefs', D-151)
    indirectSpecular(builder: any) { if (leafN) builder.context.radiance.addAssign(builder.context.irradiance.mul(leafN).mul(1 / Math.PI)); super.indirectSpecular(builder); }
  }
  (m as any).setupLightingModel = () => new GiltLighting();
  receiveReliefShadow(m); // the figures' shadows fall on the painted architecture as on the bare (D-226)
  m.userData = { ...m.userData, tier: 'C', note: `${m.userData?.note ?? surface}; s18 C15 (D-800): painted and gilded as in 467: pigments B (polychromy.json), zones C` };
  MATS.set(key, m); return m;
}
