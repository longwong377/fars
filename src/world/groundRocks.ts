// The loose rock of the open ground (session 12, D-310): stones and cobbles on the steppe and the fallow edges, stones,
// rock clusters and boulders fallen from the limestone on the hill slopes (the cell context `rock`: slope > 0.3), as real
// 3D CC0 scans (Poly Haven; src/render/scanProps.ts) re-tinted to the measured limestone palette (terrainPlain.ts PAL: rock,
// rockDark, scree). Until session 12 the world drew rock only as the terrain's texture: no stone stood proud of the ground.
// Drawn near the viewer (stones within ROCK_R.stone, boulders within ROCK_R.boulder) from the 8 m cells' context (smallLife.ts),
// static positions from a hash of (seed, cell, index), grown in over the last 20 % of the radius so nothing pops; two
// levels per model (lod0 within LOD_NEAR m). One InstancedMesh per model and level; stones receive shadows, boulders cast too.
// Tiers: rock and stones on these slopes B (the Kuh-e Rahmat limestone, the ground today); their number and place C.
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, float, length, smoothstep, cameraPosition } from 'three/tsl';
import type { P2 } from '../people/navgrid';
import { CELL, type CellCtx, type SmallWorld } from './smallLife';
import { propsFor, scanMaterial, type ScanProp } from '../render/scanProps';
import { vergeZone } from './plain/verge';
import { resolveCell, sameLook, bumpYaw } from './plain/variety';

export type RockKind = 'stone' | 'boulder';
export const ROCK_R: Record<RockKind, number> = { stone: 40, boulder: 110 };
export const LOD_NEAR = 14;
/** per kind: the contexts and, for each, the share of cells holding it and how many there; the size (m, the largest
 *  horizontal extent) range; the roles of the scans it draws from; the most instances */
export const ROCKS: Record<RockKind, { where: Partial<Record<CellCtx, [number, number, number]>>; size: [number, number]; roles: string[]; max: number }> = {
  stone: { where: { rock: [1, 8, 20], steppe: [0.8, 3, 8], field: [0.2, 1, 3] }, size: [0.14, 0.7], roles: ['stone'], max: 7000 },
  boulder: { where: { rock: [0.35, 1, 3], steppe: [0.03, 1, 1] }, size: [0.7, 3.2], roles: ['boulder', 'outcrop'], max: 1400 },
};
// the measured limestone palette (terrainPlain.ts PAL, D-190): rock, rockDark, scree
const PAL: [number, number, number][] = [[0.55, 0.44, 0.36], [0.40, 0.29, 0.22], [0.62, 0.51, 0.42]];
function h32(...v: number[]) { let h = 2166136261 >>> 0; for (const x of v) { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; } return h >>> 0; }
const u01 = (...v: number[]) => h32(...v) / 4294967296;
const KIDX: Record<RockKind, number> = { stone: 11, boulder: 12 };

/** one rock: grid (e, n), index, scan variant, size (m), yaw; its tilt (the D-356 bedding's random tilt, radians, hashes 38/39)
 *  and s17's height (sy: 0.8-1.15 of the scan's own, D-560): no two stones of a scan within 20 m lie as copies */
export interface RockItem { e: number; n: number; i: number; vi: number; sz: number; yaw: number; tilt: [number, number]; sy: number }
const rockShape = (seed: number, ix: number, iy: number, i: number) => ({ tilt: [(u01(seed, ix, iy, i, 38) - 0.5) * 0.25, (u01(seed, ix, iy, i, 39) - 0.5) * 0.25] as [number, number], sy: 0.8 + 0.35 * u01(seed, ix, iy, i, 87) });
/** the rocks of kind k in one 8 m cell (ix, iy) of context weights w (ROCKS[k].where[ctx]), for nv scan variants: grid (e, n),
 *  index i, variant vi, size sz (m, largest extent); a hash of (seed, cell, index), the same in the page and the census
 *  (tools/dev/plain_census.ts) */
export function rockCellItems(seed: number, k: RockKind, ix: number, iy: number, w: [number, number, number], nv: number) {
  const out: RockItem[] = [];
  if (u01(seed, ix, iy, KIDX[k], 31) >= w[0]) return out;
  const n = w[1] + (h32(seed, ix, iy, KIDX[k], 32) % (w[2] - w[1] + 1));
  for (let i = 0; i < n; i++) {
    // size: small ones common (a power law over the range), the scan's own proportions kept, scaled to its largest extent
    const t = u01(seed, ix, iy, i, KIDX[k], 35), sz = ROCKS[k].size[0] + (ROCKS[k].size[1] - ROCKS[k].size[0]) * t * t;
    const e = (ix + u01(seed, ix, iy, i, KIDX[k], 33)) * CELL, nn = (iy + u01(seed, ix, iy, i, KIDX[k], 34)) * CELL, z = vergeZone(e, nn);
    if (z && z.zone !== 'verge' && (k === 'boulder' || sz > 0.3)) continue; // (s17: the carts keep the tread clear of all but pebbles)
    out.push({ e, n: nn, i, vi: h32(seed, ix, iy, i, KIDX[k], 37) % nv, sz, yaw: u01(seed, ix, iy, i, 36) * 6.283, ...rockShape(seed, ix, iy, i) });
  }
  return out;
}
/** s17 (D-560): the stones thrown out to the path's edge by the ploughs and the carts: in the first 1.5 m of every verge
 *  (verge.ts), 10 candidate points an 8 m cell; small (0.12-0.45 m), C */
export function vergeRockItems(seed: number, ix: number, iy: number, nv: number) {
  const out: RockItem[] = [];
  for (let i = 0; i < 10; i++) { const e = (ix + u01(seed, ix, iy, i, 81)) * CELL, nn = (iy + u01(seed, ix, iy, i, 82)) * CELL, z = vergeZone(e, nn);
    if (z?.zone !== 'verge' || z.hit.d - z.hit.hw > 1.5 || u01(seed, ix, iy, i, 83) > 0.55) continue;
    const t = u01(seed, ix, iy, i, 84); out.push({ e, n: nn, i: 200 + i, vi: h32(seed, ix, iy, i, 85) % nv, sz: 0.12 + 0.33 * t * t, yaw: u01(seed, ix, iy, i, 86) * 6.283, ...rockShape(seed, ix, iy, 200 + i) }); }
  return out;
}
/** s17 (D-560): the rocks of kind k drawn in cell (ix, iy): its context's and the verges' stones, with any copy of an earlier
 *  rock within 20 m turned (variety.ts); `memo` caches raw cells */
const twinR = (a: RockItem, b: RockItem) => a.vi === b.vi && sameLook({ s: a.sz, asp: a.sy, yaw: a.yaw, lean: a.tilt }, { s: b.sz, asp: b.sy, yaw: b.yaw, lean: b.tilt });
export function rockCell(seed: number, k: RockKind, ix: number, iy: number, nv: number, ctxOf: (ix: number, iy: number) => CellCtx, memo?: Map<number, RockItem[]>): RockItem[] {
  const raw = (x: number, y: number) => { const key = ((x + 32768) * 65536 + (y + 32768)) * 2 + (k === 'stone' ? 0 : 1); let l = memo?.get(key); if (l) return l;
    const cx = ctxOf(x, y), w = ROCKS[k].where[cx]; l = [...(w ? rockCellItems(seed, k, x, y, w, nv) : []), ...(k === 'stone' && cx !== 'none' && cx !== 'water' ? vergeRockItems(seed, x, y, nv) : [])];
    if (memo) { if (memo.size > 80000) memo.clear(); memo.set(key, l); } return l; };
  return resolveCell(ix, iy, CELL, raw, twinR, (t, j) => ({ ...t, yaw: bumpYaw(t.yaw, j) }));
}
interface Slot { prop: ScanProp; lod: 0 | 1; mesh: THREE.InstancedMesh; fpos: THREE.InstancedBufferAttribute; n: number }
export class GroundRocks {
  readonly group = new THREE.Group();
  readonly slots: Record<RockKind, Slot[]> = { stone: [], boulder: [] };
  stats: Record<RockKind, number> = { stone: 0, boulder: 0 };
  private cells = new Map<number, CellCtx>(); private rawMemo = new Map<number, RockItem[]>(); private ctxOf = (ix: number, iy: number) => this.ctx(ix, iy);
  private last = { e: 1e9, n: 1e9 };
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private eu = new THREE.Euler(); private v = new THREE.Vector3(); private s = new THREE.Vector3(); private col = new THREE.Color();
  private up = new THREE.Vector3(); private Y = new THREE.Vector3(0, 1, 0); private qs = new THREE.Quaternion();
  /** false when no scan was loaded (node, ?props=0, a failed load): then nothing is drawn (the terrain's rock texture remains) */
  readonly active: boolean;
  constructor(private seed: number, private world: SmallWorld) {
    this.group.name = 'ground-rocks';
    let any = false;
    for (const k of Object.keys(ROCKS) as RockKind[]) {
      const props = ROCKS[k].roles.flatMap(r => propsFor(r)); if (!props.length) continue; any = true;
      const per = Math.ceil(ROCKS[k].max / props.length);
      for (const p of props) {
        const mat = scanMaterial(p, [1, 1, 1], { roughness: 0.92, tintAttr: 'rtint' });
        const d = length(attribute('fpos', 'vec3').xz.sub(cameraPosition.xz)), grow = float(1).sub(smoothstep(ROCK_R[k] * 0.8, ROCK_R[k], d));
        mat.positionNode = positionLocal.mul(grow);
        for (const lod of [0, 1] as const) {
          const g = p.lods[lod].clone(), fpos = new THREE.InstancedBufferAttribute(new Float32Array(per * 3), 3); g.setAttribute('fpos', fpos);
          const mesh = new THREE.InstancedMesh(g, mat, per); mesh.count = 0; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = k === 'boulder';
          g.setAttribute('rtint', new THREE.InstancedBufferAttribute(new Float32Array(per * 3), 3));
          mesh.name = `rock-${k}:${p.id}:lod${lod}`;
          mesh.userData = { tier: 'B/C', src: 'KR-BEDROCK;POLYHAVEN-CC0', placeholder: false, note: `${k === 'stone' ? 'loose stones' : 'boulders and fallen blocks'} of the Kuh-e Rahmat limestone (B for the rock; number and place C): CC0 scan ${p.id} (Poly Haven), re-tinted to the measured rock palette` };
          this.slots[k].push({ prop: p, lod, mesh, fpos, n: per }); this.group.add(mesh);
        }
      }
    }
    this.active = any;
  }
  private ctx(ix: number, iy: number): CellCtx {
    const key = (ix + 32768) * 65536 + (iy + 32768); let c = this.cells.get(key);
    if (c === undefined) { if (this.cells.size > 60000) this.cells.clear(); c = this.world.ctxAt((ix + 0.5) * CELL, (iy + 0.5) * CELL); this.cells.set(key, c); }
    return c;
  }
  /** the viewer's grid position; rebuilds when the viewer has moved 5 m */
  update(viewer: P2) {
    if (!this.active) return false;
    if (Math.hypot(viewer[0] - this.last.e, viewer[1] - this.last.n) < 5) return false;
    this.last = { e: viewer[0], n: viewer[1] };
    for (const k of Object.keys(ROCKS) as RockKind[]) {
      const slots = this.slots[k]; if (!slots.length) continue; const counts = slots.map(() => 0), nv = slots.length / 2, R = ROCK_R[k];
      const i0 = Math.floor((viewer[0] - R) / CELL), i1 = Math.floor((viewer[0] + R) / CELL), j0 = Math.floor((viewer[1] - R) / CELL), j1 = Math.floor((viewer[1] + R) / CELL);
      let total = 0;
      for (let ix = i0; ix <= i1; ix++) for (let iy = j0; iy <= j1; iy++) {
        const dc = Math.hypot((ix + 0.5) * CELL - viewer[0], (iy + 0.5) * CELL - viewer[1]); if (dc > R + CELL) continue;
        const items = rockCell(this.seed, k, ix, iy, nv, this.ctxOf, this.rawMemo); if (!items.length) continue;
        for (const it of items) {
          const { e, n: nn, i, vi, sz } = it;
          const dist = Math.hypot(e - viewer[0], nn - viewer[1]); if (dist > R) continue;
          const y = this.world.ground(e, nn); if (!Number.isFinite(y)) continue;
          const si = vi * 2 + (dist < LOD_NEAR ? 0 : 1), S = slots[si]; if (counts[si] >= S.n) continue;
          const ext = Math.max(S.prop.size[0], S.prop.size[2], 1e-3), sc = sz / ext;
          // bedded: a stone sits a tenth of its height in the ground, a boulder a fifth; tilted a little (C)
          const hgt = S.prop.size[1] * sc * it.sy, sink = hgt * (k === 'stone' ? 0.1 : 0.2);
          // D-356 (the brief's "rocks float over puddles"): the scans' base is their lowest point (y = 0), and they stood upright
          // on the ground at their centre, so on any slope the downhill half of the footprint hung in the air (a 2.5 m boulder on
          // the `rock` context's >30 % slopes: 0.4-0.8 m of daylight under it). Now each piece is bedded in the ground's plane
          // over its footprint (the ground sampled at its four quarter points, the plane's normal its up), and seated at the
          // lowest of those samples less the sink, so no edge stands clear of the drawn ground (C for the bedding)
          const yaw = it.yaw, rr = 0.5 * sz, gE = this.world.ground(e + rr, nn), gW = this.world.ground(e - rr, nn), gN = this.world.ground(e, nn + rr), gS = this.world.ground(e, nn - rr);
          const fin = Number.isFinite(gE) && Number.isFinite(gW) && Number.isFinite(gN) && Number.isFinite(gS);
          const dx = fin ? (gE - gW) / (2 * rr) : 0, dn = fin ? (gN - gS) / (2 * rr) : 0, low = fin ? Math.min(y, (gE + gW + gN + gS) / 4) : y;
          this.up.set(-dx, 1, dn).normalize(); this.qs.setFromUnitVectors(this.Y, this.up); // (world z = -north)
          this.eu.set(it.tilt[0], yaw, it.tilt[1]); this.q.setFromEuler(this.eu); this.q.premultiply(this.qs);
          const tiltSink = 0.5 * sz * 0.125; // the random tilt (up to 7 deg) lifts one edge by up to this
          this.v.set(e, low - sink - tiltSink, -nn); this.m4.compose(this.v, this.q, this.s.set(sc, sc * it.sy, sc));
          const c = counts[si]++; S.mesh.setMatrixAt(c, this.m4); S.fpos.setXYZ(c, e, y, -nn);
          // colour: the rock / dark / scree tones of the palette mixed by hash, each over the scan's own albedo variation
          const a = u01(this.seed, ix, iy, i, 40), b = u01(this.seed, ix, iy, i, 41), P0 = PAL[0], P1 = PAL[a < 0.5 ? 1 : 2], m = (a < 0.5 ? a : a - 0.5) * 1.4;
          const f = 0.92 + 0.16 * b; // (the palette is sRGB, as terrainPlain.ts reads it: linearised here)
          this.col.setRGB((P0[0] + (P1[0] - P0[0]) * m) * f, (P0[1] + (P1[1] - P0[1]) * m) * f, (P0[2] + (P1[2] - P0[2]) * m) * f, THREE.SRGBColorSpace);
          (S.mesh.geometry.getAttribute('rtint') as THREE.InstancedBufferAttribute).setXYZ(c, this.col.r, this.col.g, this.col.b); total++;
        }
      }
      slots.forEach((S, i) => { S.mesh.count = counts[i]; S.mesh.instanceMatrix.needsUpdate = true; S.fpos.needsUpdate = true; S.mesh.geometry.getAttribute('rtint').needsUpdate = true; });
      this.stats[k] = total;
    }
    return true;
  }
}
