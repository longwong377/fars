// The plants a walker brushes past on the uncultivated ground (session 9; WORLD_INVENTORY G72): tragacanth thorn cushions
// (Astragalus: grey-green spiny domes on the rocky slopes and the stony steppe; tragacanth gum is a known product of the Zagros:
// B for the plant's presence, C for the stands), camelthorn (Alhagi: low twiggy bushes of the dry plain and fallow edges, green
// through the summer on its deep roots, brown by October; C) and thistles (a stem and a head: green in spring, purple in flower
// May-July, dry straw heads after; C). Drawn only near the viewer (within FLORA_R) from each 8 m cell's context
// (smallLife.ts cells), static positions from a hash of (seed, cell, index), grown in from nothing over the last 20 % of the
// radius so nothing pops. Three InstancedMeshes, receiving shadows, casting none.
// D-332 (session 12): each kind is drawn as the real species, modelled in Blender (tools/blender/life_flora.py;
// src/world/lifeModels.ts): the tragacanth's grey-green dome under bristling spine-tipped tufts with its pale flowers in May-June,
// camelthorn's green spiny twigs with pink flowers in summer, browning in autumn, the thistles' winged stems, spiny rosettes and
// heads of spiny bracts under purple florets; two levels (near: within FLORA_LOD_NEAR), their seasons as a tint on the modelled
// colours and the flowers shown in their months. Without the models: the D-310 scans (nearest real forms), then the procedural
// stand-ins (flagged PLACEHOLDER).
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, float, vec3, vec4, mix, uniform, length, smoothstep, cameraPosition, cameraViewMatrix, normalView, faceDirection, texture, uv } from 'three/tsl';
import type { P2 } from '../people/navgrid';
import { CELL, type CellCtx, type SmallWorld } from './smallLife';
import { scanProp, scanMaterial, fitProp, type ScanProp } from '../render/scanProps';
import { lifeModel, lifeMaterial } from './lifeModels';
import { vergeZone } from './plain/verge';
import { resolveCell, sameLook, bumpYaw } from './plain/variety';
/** D-332: the months (0 = January) the modelled flowers show: the tragacanth's (C: Astragalus flowers in late spring),
 *  camelthorn's (summer) */
export const FLORA_BLOOM = { cushion: [0, 0, 0, 0.3, 1, 0.6, 0, 0, 0, 0, 0, 0], camelthorn: [0, 0, 0, 0, 0, 0.8, 1, 0.7, 0.2, 0, 0, 0] };

export type FloraKind = 'cushion' | 'camelthorn' | 'thistle' | 'shrub' | 'grass' | 'deadwood' | 'flower';
export const FLORA_R = 36;
/** per kind: the contexts and, for each, the share of cells holding it and how many there; size range (m) */
export const FLORA: Record<FloraKind, { name: string; where: Partial<Record<CellCtx, [number, number, number]>>; size: [number, number]; max: number }> = {
  cushion: { name: 'tragacanth thorn cushion (Astragalus)', where: { rock: [0.6, 3, 7], steppe: [0.3, 1, 4] }, size: [0.3, 0.7], max: 900 },
  camelthorn: { name: 'camelthorn (Alhagi)', where: { steppe: [0.3, 2, 5], field: [0.05, 1, 2] }, size: [0.25, 0.5], max: 700 },
  thistle: { name: 'thistles', where: { steppe: [0.25, 2, 6], field: [0.08, 1, 3] }, size: [0.4, 0.9], max: 700 },
  // D-670 (s18, Vagon's CC0 plant scans: real meshes for the plain's open ground; the kinds drawn only from scans): the steppe's
  // wild shrubs (sumac-kin Searsia, a broom-like needle bush: the Zagros foot's Rhus, almond scrub and broom, C), bunch grasses
  // (Bermuda grass and steppe grasses, straw by summer), dead wood (a fallen trunk, a stump, roots, rare) and the spring
  // flowers (dandelion, celandine, March-May)
  shrub: { name: 'wild shrubs (sumac-kin, broom)', where: { rock: [0.16, 1, 2], steppe: [0.07, 1, 1] }, size: [0.8, 1.7], max: 260 },
  grass: { name: 'bunch grasses (Bermuda grass, steppe grasses)', where: { steppe: [0.75, 2, 6], field: [0.3, 1, 3], rock: [0.45, 1, 4], water: [0.6, 2, 5] }, size: [0.22, 0.55], max: 1600 },
  deadwood: { name: 'dead wood (a fallen trunk, a stump, roots)', where: { steppe: [0.012, 1, 1], rock: [0.02, 1, 1], water: [0.03, 1, 1] }, size: [0.35, 0.8], max: 40 },
  flower: { name: 'spring flowers (dandelion, celandine)', where: { steppe: [0.2, 1, 4], field: [0.1, 1, 2], water: [0.25, 1, 3] }, size: [0.1, 0.25], max: 700 },
};
function h32(...v: number[]) { let h = 2166136261 >>> 0; for (const x of v) { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; } return h >>> 0; }
const u01 = (...v: number[]) => h32(...v) / 4294967296;
const KIDX: Record<FloraKind, number> = { cushion: 1, camelthorn: 2, thistle: 3, shrub: 4, grass: 5, deadwood: 6, flower: 7 };
/** session 12 (D-310): the CC0 scans (Poly Haven; src/render/scanProps.ts) each kind is drawn with, when loaded; the procedural
 *  forms below are then the stand-ins (hidden, still filled: tests and the A/B). No Astragalus or Alhagi scan exists in a CC0
 *  library: the nearest forms are used (a dense low twiggy shrub squashed to the cushion's dome, a low twiggy shrub, upright
 *  stems) and tinted with the kinds' measured, seasonal colours (C for the forms). */
export const FLORA_SCANS: Record<FloraKind, { ids: string[]; fit: 'box' | 'height' }> = {
  cushion: { ids: ['shrub_03_v1', 'shrub_03_v2', 'shrub_03_v3', 'shrub_03_v4'], fit: 'box' },
  camelthorn: { ids: ['shrub_03_v1', 'shrub_03_v2', 'shrub_03_v3', 'shrub_03_v4'], fit: 'height' },
  thistle: { ids: ['nettle_plant_v1', 'nettle_plant_v2', 'nettle_plant_v5', 'nettle_plant_v6'], fit: 'height' },
  shrub: { ids: ['searsia_burchellii', 'searsia_lucida_v1', 'wild_rooibos_bush_v1'], fit: 'height' },
  grass: { ids: ['grass_medium_01_v1', 'grass_medium_01_v2', 'grass_medium_01_v3', 'grass_medium_01_v4', 'grass_medium_02_v1', 'grass_medium_02_v2', 'grass_medium_02_v3', 'grass_bermuda_01_v1', 'grass_bermuda_01_v2', 'grass_bermuda_01_v3'], fit: 'height' },
  deadwood: { ids: ['dead_tree_trunk', 'dead_tree_trunk_02', 'tree_stump_01', 'root_cluster_01'], fit: 'height' },
  flower: { ids: ['dandelion_01_v1', 'dandelion_01_v2', 'celandine_01_v1', 'celandine_01_v2'], fit: 'height' },
};
/** D-670: kinds drawn only from scans (no modelled species, no stand-in shown) */
const SCAN_ONLY = new Set<FloraKind>(['shrub', 'grass', 'deadwood', 'flower']);
export const FLORA_LOD_NEAR = 12;
/** one plant: grid (e, n), index, size (m), yaw; s17 (D-560): its proportions (asp: width over height, 0.8-1.25) and its lean
 *  (radians about grid e and n, up to ~9 deg): no two plants of a model within 20 m stand as copies of each other */
export interface FloraItem { e: number; n: number; i: number; sz: number; yaw: number; asp: number; lean: [number, number] }
function shapeOf(seed: number, ix: number, iy: number, i: number, k: number): { asp: number; lean: [number, number] } {
  const a = u01(seed, ix, iy, i, k, 91) * 6.283, m = 0.16 * Math.sqrt(u01(seed, ix, iy, i, k, 92));
  return { asp: 0.8 + 0.45 * u01(seed, ix, iy, i, k, 93), lean: [Math.cos(a) * m, Math.sin(a) * m] };
}
/** the plants of kind k in one 8 m cell (ix, iy) of context weights w (FLORA[k].where[ctx]): grid (e, n), index i, size sz (m),
 *  yaw; a hash of (seed, cell, index), the same in the page and the census (tools/dev/plain_census.ts) */
export function floraCellItems(seed: number, k: FloraKind, ix: number, iy: number, w: [number, number, number]) {
  const out: FloraItem[] = [];
  if (u01(seed, ix, iy, KIDX[k], 31) >= w[0]) return out;
  const n = w[1] + (h32(seed, ix, iy, KIDX[k], 32) % (w[2] - w[1] + 1));
  for (let i = 0; i < n; i++) { const e = (ix + u01(seed, ix, iy, i, KIDX[k], 33)) * CELL, nn = (iy + u01(seed, ix, iy, i, KIDX[k], 34)) * CELL;
    const vz = vergeZone(e, nn)?.zone; if (vz === 'tread' || vz === 'median') continue; // (s17: nothing grows on a worn tread)
    out.push({ e, n: nn, i, sz: FLORA[k].size[0] + (FLORA[k].size[1] - FLORA[k].size[0]) * u01(seed, ix, iy, i, KIDX[k], 35), yaw: u01(seed, ix, iy, i, 36) * 6.283, ...shapeOf(seed, ix, iy, i, KIDX[k]) }); }
  return out;
}
/** s17 (D-560): the roadside weeds of one 8 m cell: thistles and camelthorn (and a few thorn cushions) on the verges of the paths
 *  (verge.ts), whatever the cell's context; 24 candidate points a cell (s17: was 14, the verges read thin), those on a verge kept by kind share (C) */
export const VERGE_FLORA: Record<FloraKind, number> = { thistle: 0.34, camelthorn: 0.2, cushion: 0.05, shrub: 0, grass: 0, deadwood: 0, flower: 0 };
export function vergeFloraItems(seed: number, k: FloraKind, ix: number, iy: number) {
  const out: FloraItem[] = [];
  for (let i = 0; i < 24; i++) { const e = (ix + u01(seed, ix, iy, i, 71)) * CELL, nn = (iy + u01(seed, ix, iy, i, 72)) * CELL, z = vergeZone(e, nn); if (z?.zone !== 'verge') continue;
    const u = u01(seed, ix, iy, i, 73), kk: FloraKind = u < VERGE_FLORA.thistle ? 'thistle' : u < VERGE_FLORA.thistle + VERGE_FLORA.camelthorn ? 'camelthorn' : u < VERGE_FLORA.thistle + VERGE_FLORA.camelthorn + VERGE_FLORA.cushion ? 'cushion' : 'none' as any;
    if (kk !== k) continue;
    out.push({ e, n: nn, i: 100 + i, sz: (FLORA[k].size[0] + (FLORA[k].size[1] - FLORA[k].size[0]) * u01(seed, ix, iy, i, 74)), yaw: u01(seed, ix, iy, i, 75) * 6.283, ...shapeOf(seed, ix, iy, 100 + i, KIDX[k]) }); }
  return out;
}
/** the unit box a scan is fitted to, as the procedural unit forms: the cushion a dome 1 x 0.55 x 1; the others unit height, their own proportions */
function scanUnit(k: FloraKind, p: ScanProp): [number, number, number] {
  if (FLORA_SCANS[k].fit === 'box') return [1, 0.55, 1];
  const h = Math.max(1e-3, p.size[1]); return [p.size[0] / h, 1, p.size[2] / h];
}

/** the season's look (month 0 = January): camelthorn's dryness, the thistles' green, flower and dryness (C) */
export function floraSeason(month: number) {
  const thornDry = [0.8, 0.8, 0.6, 0.3, 0.1, 0.05, 0.05, 0.1, 0.25, 0.6, 0.8, 0.85][month];
  const thistleGreen = [0, 0.2, 0.7, 1, 1, 0.6, 0.2, 0, 0, 0, 0, 0][month], thistleFlower = [0, 0, 0, 0, 0.4, 1, 0.6, 0.1, 0, 0, 0, 0][month];
  return { thornDry, thistleGreen, thistleFlower };
}

// geometry: [position, normal, `part` (0 body, 1 head/tip)]
function build(parts: THREE.BufferGeometry[], tags: number[]): THREE.BufferGeometry {
  const P: number[] = [], N: number[] = [], T: number[] = [];
  parts.forEach((g0, k) => { const g = g0.index ? g0.toNonIndexed() : g0, p = g.getAttribute('position'), n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); T.push(tags[k]); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('part', new THREE.Float32BufferAttribute(T, 1)); return g;
}
/** a cushion: a low dome of unit width, its surface broken into facets (the spines' texture at a distance) */
function cushionGeometry() { const d = new THREE.SphereGeometry(0.5, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2); d.scale(1, 0.55, 1);
  const p = d.getAttribute('position'); for (let i = 0; i < p.count; i++) { const k = 1 + 0.08 * Math.sin(i * 12.9898); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } d.computeVertexNormals(); return build([d], [0]); }
/** camelthorn: twigs radiating up and out from the ground (thin boxes), unit height */
function camelthornGeometry() { const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 9; k++) { const a = k * 2.39996, tilt = 0.35 + 0.3 * ((k * 37) % 7) / 7, b = new THREE.BoxGeometry(0.02, 1, 0.02); b.translate(0, 0.5, 0); b.rotateZ(tilt); b.rotateY(a); parts.push(b); }
  return build(parts, parts.map(() => 1)); }
/** a thistle: a stem (unit height) and a head at its top */
function thistleGeometry() { const s = new THREE.BoxGeometry(0.012, 1, 0.012); s.translate(0, 0.5, 0); const h = new THREE.SphereGeometry(0.035, 6, 4); h.translate(0, 1.0, 0);
  const l1 = new THREE.BoxGeometry(0.16, 0.008, 0.04); l1.translate(0, 0.3, 0); const l2 = new THREE.BoxGeometry(0.04, 0.008, 0.14); l2.translate(0, 0.55, 0);
  return build([s, l1, l2, h], [0, 0, 0, 1]); }

/** s17 (D-560): the plants of kind k drawn in cell (ix, iy): its context's stands and the roadside weeds, with any copy of an
 *  earlier plant within 20 m turned (variety.ts); `ctxOf` the cells' context, `memo` caches raw cells (per kind) */
const twinF = (a: FloraItem, b: FloraItem) => sameLook({ s: a.sz, asp: a.asp, yaw: a.yaw, lean: a.lean }, { s: b.sz, asp: b.asp, yaw: b.yaw, lean: b.lean });
export function floraCell(seed: number, k: FloraKind, ix: number, iy: number, ctxOf: (ix: number, iy: number) => CellCtx, memo?: Map<number, FloraItem[]>): FloraItem[] {
  const raw = (x: number, y: number) => { const key = ((x + 32768) * 65536 + (y + 32768)) * 8 + KIDX[k]; let l = memo?.get(key); if (l) return l;
    const cx = ctxOf(x, y), w = FLORA[k].where[cx]; l = [...(w ? floraCellItems(seed, k, x, y, w) : []), ...(cx !== 'none' && cx !== 'water' ? vergeFloraItems(seed, k, x, y) : [])];
    if (memo) { if (memo.size > 60000) memo.clear(); memo.set(key, l); } return l; };
  const rk = -1 - (((ix + 32768) * 65536 + (iy + 32768)) * 8 + KIDX[k]), hit = memo?.get(rk); if (hit) return hit; // (the resolved cell: the same wherever the viewer is)
  const res = resolveCell(ix, iy, CELL, raw, twinF, (t, j) => ({ ...t, yaw: bumpYaw(t.yaw, j) })); memo?.set(rk, res); return res;
}

export class GroundFlora {
  readonly group = new THREE.Group();
  readonly meshes = new Map<FloraKind, THREE.InstancedMesh>();
  private uDry = uniform(0.5); private uGreen = uniform(0); private uFlower = uniform(0);
  /** D-332: the modelled kinds' flowers shown (0/1 by month) and the thistles' heads (flowering or standing dry) */
  private uBloomC = uniform(0); private uBloomA = uniform(0); private uHeads = uniform(1);
  /** D-332: per kind the modelled levels (near, far) */
  readonly model = new Map<FloraKind, { near: THREE.InstancedMesh; far: THREE.InstancedMesh }>();
  private cells = new Map<number, CellCtx>(); private rawMemo = new Map<number, FloraItem[]>(); private ctxOf = (ix: number, iy: number) => this.ctx(ix, iy);
  private scanCounts: Record<FloraKind, number[]> = { cushion: [], camelthorn: [], thistle: [], shrub: [], grass: [], deadwood: [], flower: [] };
  private last: { e: number; n: number; month: number } = { e: 1e9, n: 1e9, month: -1 };
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private eu = new THREE.Euler(); private v = new THREE.Vector3(); private s = new THREE.Vector3();
  stats: Record<FloraKind, number> = { cushion: 0, camelthorn: 0, thistle: 0, shrub: 0, grass: 0, deadwood: 0, flower: 0 };
  /** per kind: the scans drawn and their meshes ([scan * 2 + level]) */
  readonly scan = new Map<FloraKind, { props: ScanProp[]; slots: THREE.InstancedMesh[]; per: number }>();
  constructor(private seed: number, private world: SmallWorld) {
    this.group.name = 'ground-flora';
    const geos: Record<FloraKind, THREE.BufferGeometry> = { cushion: cushionGeometry(), camelthorn: camelthornGeometry(), thistle: thistleGeometry(), shrub: cushionGeometry(), grass: thistleGeometry(), deadwood: cushionGeometry(), flower: thistleGeometry() };
    for (const k of Object.keys(FLORA) as FloraKind[]) {
      const g = geos[k], fpos = new THREE.InstancedBufferAttribute(new Float32Array(FLORA[k].max * 3), 3); g.setAttribute('fpos', fpos);
      const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.9, side: THREE.DoubleSide });
      const part = attribute('part', 'float'), d = length(attribute('fpos', 'vec3').xz.sub(cameraPosition.xz)), grow = float(1).sub(smoothstep(FLORA_R * 0.8, FLORA_R, d));
      m.positionNode = positionLocal.mul(grow);
      if (k === 'cushion') m.colorNode = mix(vec3(0.3, 0.33, 0.22), vec3(0.4, 0.42, 0.3), positionLocal.y.mul(3).clamp(0, 1)); // grey-green, paler on top
      else if (k === 'camelthorn') m.colorNode = mix(vec3(0.2, 0.28, 0.1), vec3(0.36, 0.27, 0.17), this.uDry);
      else m.colorNode = mix(mix(vec3(0.48, 0.42, 0.3), vec3(0.2, 0.3, 0.11), this.uGreen), mix(vec3(0.55, 0.47, 0.34), vec3(0.45, 0.2, 0.45), this.uFlower), part);
      const mesh = new THREE.InstancedMesh(g, m, FLORA[k].max); mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.name = `flora-${k}`;
      mesh.userData = { tier: k === 'cushion' ? 'B/C' : 'C', src: 'SMALL-R', note: `${FLORA[k].name}: near the viewer only, stands and density reconstructed (C)` };
      this.meshes.set(k, mesh); this.group.add(mesh);
      // D-332: the modelled species (D-670: only where no real scan of the kind loaded: Vagon's T4 frames showed the modelled cards as
      // pale blobs with no stems; the scans are real plants)
      const lm = FLORA_SCANS[k].ids.some(id => !!scanProp(id)) ? null : lifeModel(k as any);
      if (lm) {
        const L = attribute('life', 'vec4'), part = L.x, ONE3 = vec3(1, 1, 1);
        const tint = k === 'cushion' ? ONE3 : k === 'camelthorn' ? mix(ONE3, vec3(1.8, 0.96, 1.7), this.uDry.mul(float(1).sub(part)))
          : mix(mix(vec3(1.25, 0.96, 0.86), ONE3, this.uGreen), mix(vec3(1.5, 3.2, 1.35), ONE3, this.uFlower), part); // (thistle: leaves green to straw; florets purple, then the dry heads' pale pappus)
        const vis = k === 'cushion' ? this.uBloomA : k === 'camelthorn' ? this.uBloomC : this.uHeads;
        const sm = lifeMaterial(lm, { fallback: [0.35, 0.4, 0.25], tint, roughness: 0.9, side: THREE.DoubleSide, flowerVis: vis });
        sm.positionNode = positionLocal.mul(grow);
        // s17 (D-560, V2's probe frames: camelthorn and thistle cards drawn black): thin spiny cards lit like a low canopy: the
        // facing-corrected geometry normal bent two thirds toward the sky (no card ever faces away from the light into black),
        // and the baked occlusion (the normal texture's alpha) kept to a third of its depth
        sm.normalMap = null; sm.normalNode = mix(normalView.mul(faceDirection), cameraViewMatrix.mul(vec4(0, 1, 0, 0)).xyz, 0.65).normalize();
        // D-670 (Vagon's T4 frame: pale blobs with no ground contact): the plant darkens toward its foot (the shade and the soil
        // splashed on the lowest leaves over its first ~12 cm), so it sits in the ground instead of floating on it
        const foot = smoothstep(0.0, 0.12, positionLocal.y.mul(grow)).mul(0.55).add(0.45);
        sm.aoNode = lm.nrm ? texture(lm.nrm, uv()).a.mul(0.3).add(0.7).mul(foot) : foot;
        const mk = (lvl: string) => { const g = lm.levels[lvl].clone(); g.setAttribute('fpos', new THREE.InstancedBufferAttribute(new Float32Array(FLORA[k].max * 3), 3));
          const im = new THREE.InstancedMesh(g, sm, FLORA[k].max); im.count = 0; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true; im.name = `flora-${k}:model:${lvl}`;
          im.userData = { tier: mesh.userData.tier, src: 'SMALL-R;RECON', placeholder: false, note: `${FLORA[k].name}: modelled as the species (tools/blender/life_flora.py; D-332: forms from botanical descriptions, C); near the viewer only, stands and density reconstructed (C)` };
          this.group.add(im); return im; };
        this.model.set(k, { near: mk('lod0'), far: mk('lod1') }); mesh.visible = false; continue;
      }
      // the scans (D-310): one InstancedMesh per scan and level, the same placements; the stand-in hidden
      const props = FLORA_SCANS[k].ids.map(scanProp).filter((p): p is ScanProp => !!p);
      if (props.length) {
        const per = Math.ceil(FLORA[k].max / props.length) + 8, slots: THREE.InstancedMesh[] = [];
        for (const p of props) {
          const u = p.size[1] > 0 ? scanUnit(k, p) : [1, 1, 1] as [number, number, number];
          const part = smoothstep(0.78, 0.95, positionLocal.y); // the head of a stem (thistle) or the top of the plant
          const tint = SCAN_ONLY.has(k) ? (k === 'grass' ? mix(vec3(1, 1, 1), vec3(1.25, 1.05, 0.62), this.uDry) : vec3(1, 1, 1)) // (D-670: the scan's own colour; the grass straw by summer)
            : k === 'cushion' ? mix(vec3(0.3, 0.33, 0.22), vec3(0.4, 0.42, 0.3), positionLocal.y.mul(2).clamp(0, 1)) : k === 'camelthorn' ? mix(vec3(0.2, 0.28, 0.1), vec3(0.36, 0.27, 0.17), this.uDry)
            : mix(mix(vec3(0.48, 0.42, 0.3), vec3(0.2, 0.3, 0.11), this.uGreen), mix(vec3(0.55, 0.47, 0.34), vec3(0.45, 0.2, 0.45), this.uFlower), part);
          const sm = scanMaterial(p, tint, { roughness: 0.9, side: THREE.DoubleSide }); sm.positionNode = positionLocal.mul(grow);
          if (k !== 'cushion') { sm.normalMap = null; sm.normalNode = mix(normalView.mul(faceDirection), cameraViewMatrix.mul(vec4(0, 1, 0, 0)).xyz, 0.65).normalize(); } // (s17: the cards lit as a canopy, as the models above)
          for (const lod of [0, 1]) {
            const sg = fitProp(p.lods[lod], u); sg.setAttribute('fpos', new THREE.InstancedBufferAttribute(new Float32Array(per * 3), 3));
            const im = new THREE.InstancedMesh(sg, sm, per); im.count = 0; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true; im.name = `flora-${k}:${p.id}:lod${lod}`;
            im.userData = { tier: mesh.userData.tier, src: 'SMALL-R;POLYHAVEN-CC0', placeholder: false, note: `${FLORA[k].name}: CC0 scan ${p.id} (Poly Haven), the nearest real form (no CC0 scan of the species exists), in the kind's measured seasonal colour; near the viewer only, stands and density reconstructed (C)` };
            slots.push(im); this.group.add(im);
          }
        }
        this.scan.set(k, { props, slots, per }); mesh.visible = false;
      } else mesh.userData = { ...mesh.userData, placeholder: true, note: `PLACEHOLDER: procedural stand-in (the CC0 scans did not load). ${mesh.userData.note}` };
    }
  }
  private ctx(ix: number, iy: number): CellCtx {
    const key = (ix + 32768) * 65536 + (iy + 32768); let c = this.cells.get(key);
    if (c === undefined) { if (this.cells.size > 40000) this.cells.clear(); c = this.world.ctxAt((ix + 0.5) * CELL, (iy + 0.5) * CELL); this.cells.set(key, c); }
    return c;
  }
  /** month 0 = January; the viewer's grid position. Rebuilds when the viewer has moved 4 m or the month changed */
  update(month: number, viewer: P2) {
    const S = floraSeason(month); this.uDry.value = S.thornDry; this.uGreen.value = S.thistleGreen; this.uFlower.value = S.thistleFlower;
    this.uBloomA.value = FLORA_BLOOM.cushion[month] > 0.25 ? 1 : 0; this.uBloomC.value = FLORA_BLOOM.camelthorn[month] > 0.25 ? 1 : 0; this.uHeads.value = S.thistleFlower > 0.05 || (month >= 6 && month <= 11) ? 1 : 0;
    if (Math.hypot(viewer[0] - this.last.e, viewer[1] - this.last.n) < 4 && month === this.last.month) return false;
    this.last = { e: viewer[0], n: viewer[1], month };
    const counts = Object.fromEntries(Object.keys(FLORA).map(k => [k, 0])) as Record<FloraKind, number>, mn = Object.fromEntries(Object.keys(FLORA).map(k => [k, [0, 0]])) as Record<FloraKind, [number, number]>;
    for (const k of Object.keys(FLORA) as FloraKind[]) this.scanCounts[k] = (this.scan.get(k)?.slots ?? []).map(() => 0);
    const i0 = Math.floor((viewer[0] - FLORA_R) / CELL), i1 = Math.floor((viewer[0] + FLORA_R) / CELL), j0 = Math.floor((viewer[1] - FLORA_R) / CELL), j1 = Math.floor((viewer[1] + FLORA_R) / CELL);
    for (let ix = i0; ix <= i1; ix++) for (let iy = j0; iy <= j1; iy++) {
      if (Math.hypot((ix + 0.5) * CELL - viewer[0], (iy + 0.5) * CELL - viewer[1]) > FLORA_R + CELL) continue;
      const cx = this.ctx(ix, iy);
      for (const k of Object.keys(FLORA) as FloraKind[]) {
        if (k === 'flower' && (month < 2 || month > 4)) continue; // (D-670: the spring flowers, March-May)
        void cx; const items = floraCell(this.seed, k, ix, iy, this.ctxOf, this.rawMemo); if (!items.length) continue;
        const sc = this.scanCounts[k];
        const mesh = this.meshes.get(k)!, fpos = mesh.geometry.getAttribute('fpos') as THREE.InstancedBufferAttribute;
        for (const it of items) { if (counts[k] >= FLORA[k].max) break;
          const { e, n: nn, i, sz } = it, y = this.world.ground(e, nn); if (!Number.isFinite(y)) continue;
          // D-356: plants stand upright, so on a slope the stem is set at the lowest ground under the plant's footprint (a
          // tragacanth dome on the hills' slopes showed daylight under its downhill side)
          const fr = (k === 'cushion' ? 0.5 : 0.3) * sz, low = Math.min(y, ...[this.world.ground(e + fr, nn), this.world.ground(e - fr, nn), this.world.ground(e, nn + fr), this.world.ground(e, nn - fr)].filter(Number.isFinite));
          // (s17: leaning (about grid e: world x; about grid n: world -z), then turned; a lean lifts one side: sunk by it)
          this.eu.set(it.lean[0], it.yaw, -it.lean[1], 'YXZ'); this.q.setFromEuler(this.eu); this.v.set(e, low - 0.03 - Math.hypot(it.lean[0], it.lean[1]) * fr * 0.5, -nn);
          const sh = it.asp; this.m4.compose(this.v, this.q, k === 'cushion' ? this.s.set(sz * sh, sz, sz * sh) : this.s.set(sz * 0.8 * sh, sz, sz * 0.8 * sh)); // (the height in its range, the spread by asp)
          const c = counts[k]++; mesh.setMatrixAt(c, this.m4); fpos.setXYZ(c, e, y, -nn);
          const Mo = this.model.get(k); if (Mo) { const nearL = Math.hypot(e - viewer[0], nn - viewer[1]) < FLORA_LOD_NEAR, im = nearL ? Mo.near : Mo.far, j2 = mn[k][nearL ? 0 : 1]++;
            im.setMatrixAt(j2, this.m4); (im.geometry.getAttribute('fpos') as THREE.InstancedBufferAttribute).setXYZ(j2, e, y, -nn); }
          const S = this.scan.get(k); if (S) { const vi = h32(this.seed, ix, iy, i, KIDX[k], 37) % S.props.length, near = Math.hypot(e - viewer[0], nn - viewer[1]) < FLORA_LOD_NEAR ? 0 : 1, si = vi * 2 + near, im = S.slots[si];
            if (sc[si] < S.per) { const j2 = sc[si]++; im.setMatrixAt(j2, this.m4); (im.geometry.getAttribute('fpos') as THREE.InstancedBufferAttribute).setXYZ(j2, e, y, -nn); } }
        }
      }
    }
    for (const k of Object.keys(FLORA) as FloraKind[]) { const m = this.meshes.get(k)!; m.count = counts[k]; m.instanceMatrix.needsUpdate = true; (m.geometry.getAttribute('fpos') as THREE.InstancedBufferAttribute).needsUpdate = true; this.stats[k] = counts[k];
      const Mo = this.model.get(k); if (Mo) ([Mo.near, Mo.far] as THREE.InstancedMesh[]).forEach((im, i) => { im.count = mn[k][i]; im.instanceMatrix.needsUpdate = true; (im.geometry.getAttribute('fpos') as THREE.InstancedBufferAttribute).needsUpdate = true; });
      const S = this.scan.get(k); if (S) S.slots.forEach((im, i) => { im.count = this.scanCounts[k][i]; im.instanceMatrix.needsUpdate = true; (im.geometry.getAttribute('fpos') as THREE.InstancedBufferAttribute).needsUpdate = true; }); }
    return true;
  }
}

/** session 9 (WORLD_INVENTORY G73): rose bushes along the paradise's channels (the damask and the other old roses of Persian
 *  gardens: C for 467), 0.6-1.1 m domes whose blossoms (small pale quads on the dome) open pink in May-June and a few again in
 *  October (`roseBloom`). Fixed positions from the garden's frame (world.ts); static, always drawn (a few hundred). */
export const roseBloom = (month: number) => [0, 0, 0, 0.05, 0.8, 1, 0.3, 0.05, 0.1, 0.35, 0.1, 0][month];
function roseGeometry() {
  const d = new THREE.SphereGeometry(0.5, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2); d.scale(1, 0.9, 1);
  const bl: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 22; k++) { const a = k * 2.39996, el = 0.25 + 1.1 * ((k * 0.618) % 1), r = 0.5, q = new THREE.PlaneGeometry(0.06, 0.06);
    q.lookAt(new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el) * 0.9, Math.sin(a) * Math.cos(el))); q.translate(Math.cos(a) * Math.cos(el) * r * 1.02, Math.sin(el) * r * 0.92, Math.sin(a) * Math.cos(el) * r * 1.02); bl.push(q); }
  return build([d, ...bl], [0, ...bl.map(() => 1)]);
}
export const ROSE_NEAR = 30;
export class RoseBeds {
  readonly mesh: THREE.InstancedMesh; private uBloom = uniform(0);
  /** D-332: the modelled damask roses (near and far levels: the near ones within ROSE_NEAR of the viewer), in one group */
  readonly group = new THREE.Group(); private far: THREE.InstancedMesh | null = null; private near: THREE.InstancedMesh | null = null; private uShow = uniform(0);
  private spots: { e: number; n: number; y: number; size: number; rot: number }[] = []; private last: P2 = [1e9, 1e9];
  constructor(spots: { e: number; n: number; y: number; size: number; rot: number }[]) {
    this.spots = spots;
    const g = roseGeometry(), m = new THREE.MeshStandardNodeMaterial({ roughness: 0.85, side: THREE.DoubleSide });
    const part = attribute('part', 'float');
    m.colorNode = mix(vec3(0.12, 0.2, 0.08), mix(vec3(0.12, 0.2, 0.08), vec3(0.85, 0.45, 0.55), this.uBloom), part);
    this.mesh = new THREE.InstancedMesh(g, m, Math.max(1, spots.length)); this.mesh.name = 'flora-roses'; this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    spots.forEach((p, i) => { e.set(0, p.rot, 0); q.setFromEuler(e); M.compose(v.set(p.e, p.y - 0.05, -p.n), q, s.set(p.size, p.size, p.size)); this.mesh.setMatrixAt(i, M); });
    this.mesh.count = spots.length;
    this.mesh.userData = { tier: 'C', src: 'RECON', note: 'rose bushes along the paradise\'s channels (old roses of Persian gardens: C for 467); blossoms May-June, a few in October' };
    this.group.name = 'flora-roses'; this.group.add(this.mesh);
    const lm = lifeModel('rose');
    if (lm) {
      const m2 = lifeMaterial(lm, { fallback: [0.15, 0.25, 0.1], roughness: 0.85, side: THREE.DoubleSide, flowerVis: this.uShow });
      const mk = (lvl: string) => { const im = new THREE.InstancedMesh(lm.levels[lvl], m2, Math.max(1, spots.length)); im.count = 0; im.castShadow = lvl === 'lod0'; im.receiveShadow = true; im.frustumCulled = false; im.name = `flora-roses:${lvl}`;
        im.userData = { tier: 'C', src: 'RECON', placeholder: false, note: 'damask rose bushes along the paradise\'s channels, modelled (tools/blender/life_flora.py; D-332: canes, pinnate leaves, semi-double pink blooms, C for 467); blossoms May-June, a few in October' }; this.group.add(im); return im; };
      this.near = mk('lod0'); this.far = mk('lod1'); this.mesh.visible = false; this.place([0, 0]);
    } else this.mesh.userData.placeholder = true;
  }
  /** the modelled bushes by level from the viewer (grid) */
  private place(viewer: P2) {
    if (!this.near || !this.far) return; this.last = viewer; const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(); let a = 0, b = 0;
    for (const p of this.spots) { e.set(0, p.rot, 0); q.setFromEuler(e); M.compose(v.set(p.e, p.y - 0.03, -p.n), q, s.set(p.size, p.size, p.size)); if (Math.hypot(p.e - viewer[0], p.n - viewer[1]) < ROSE_NEAR) this.near.setMatrixAt(a++, M); else this.far.setMatrixAt(b++, M); }
    this.near.count = a; this.far.count = b; this.near.instanceMatrix.needsUpdate = true; this.far.instanceMatrix.needsUpdate = true;
  }
  update(month: number, viewer?: P2) { this.uBloom.value = roseBloom(month); this.uShow.value = roseBloom(month) > 0.08 ? 1 : 0;
    if (viewer && Math.hypot(viewer[0] - this.last[0], viewer[1] - this.last[1]) > 5) this.place(viewer); }
}
