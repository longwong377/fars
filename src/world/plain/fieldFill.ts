// The farm year on the plain, near the walker (s17 C2, D-560): what stands on the fields and the threshing floors by date,
// from the project's period kit (tools/blender/model_props.py: the sheaves, stooks, threshing floor, grain heap, straw, sledge,
// ard and thorn fold; every model in ASSET_LEDGER.md). All C (the customs by analogy with the region's farming before
// machines, the dates from seasonal.ts' crop calendar):
//  - harvest: on every cereal plot (barley, wheat, emmer) from its own harvest day (the crop's day + the plot's offset), the
//    cut sheaves lie in the rows for ~9 days, and stand in stooks to dry from day 3 to day 18, then are carted away;
//  - threshing (each village's floor, villages.ts threshingFloor): from the first barley harvest to the end of the threshing
//    (about doy 150-250) the floor holds the trodden sheaves, the threshing sledge, grain heaps winnowed out beside it; from
//    then to the next spring the straw stands in stacks beside the floor (the year's fodder, eaten down by March);
//  - the plough: while a plot is being ploughed (seasonal.ts tilled) an ard lies at its edge, unyoked;
//  - the flocks: a thorn fold on the open ground near every village, all year (the flocks folded at night, C).
// Drawn within FIELD_R of the viewer, regenerated when the viewer has moved FIELD_R.move m or the day changed; one InstancedMesh
// per model, part and level. A model that did not load is not drawn (stats().missing; PLACEHOLDER: nothing stands in).
import * as THREE from 'three/webgpu';
import { model, modelParts, aoFactor } from '../../render/scanProps';
import { propMaterial } from '../../render/materials';
import { landUseAt, plotAt, hash2, unit, cellU, type ZoneMap } from './fields';
import { cropState, YEAR, type CropRow } from './seasonal';
import { vergeZone } from './verge';

export const FIELD_R = { near: 130, far: 260, lod0: 12, lod1: 45, move: 8, step: 18 } as const;
/** the cereals' harvest day (seasonal.ts winterCereal's `harvest`) */
export const HARVEST: Partial<Record<CropRow, number>> = { barley: 150, wheat: 178, emmer_spelt: 178 };
/** the threshing season on the floors (doy) and the straw stacks' (to the next March) */
export const THRESH = { from: 150, to: 250, strawTo: 75 } as const;
type RGB = [number, number, number];
/** the parts: [material kind, sRGB colour] */
const PART: Record<string, [string, RGB]> = {
  straw: ['reed', [0.78, 0.67, 0.42]], straw_d: ['reed', [0.62, 0.53, 0.34]], ears: ['reed', [0.74, 0.6, 0.33]], earth: ['mud', [0.56, 0.47, 0.36]],
  grain: ['mud', [0.76, 0.62, 0.38]], chaff: ['reed', [0.82, 0.74, 0.55]], wood: ['wood', [0.47, 0.37, 0.27]], wood_d: ['wood', [0.38, 0.3, 0.22]],
  cord: ['textile', [0.58, 0.5, 0.36]], iron: ['metal', [0.3, 0.29, 0.28]], thorn: ['wood', [0.42, 0.36, 0.28]], thorn_d: ['wood', [0.33, 0.28, 0.22]],
};
const MODELS = ['wo_sheaves', 'wo_stooks', 'wo_threshing_floor', 'wo_grain_heap', 'wo_fodder', 'wo_sledge', 'wo_ard', 'wo_fold'] as const;
type M = typeof MODELS[number];
/** the most instances per model (and per part and level) */
const CAP: Record<M, number> = { wo_sheaves: 700, wo_stooks: 500, wo_threshing_floor: 8, wo_grain_heap: 24, wo_fodder: 60, wo_sledge: 8, wo_ard: 16, wo_fold: 8 };
const BIG = new Set<M>(['wo_threshing_floor', 'wo_fold', 'wo_fodder', 'wo_grain_heap', 'wo_sledge', 'wo_ard']);

export interface FieldItem { m: M; e: number; n: number; rot: number; s: [number, number, number]; shade: number }
export interface FieldVillage { id: string; x: number; y: number; r: number; floor: [number, number] }

function h32(...v: number[]) { let h = 2166136261 >>> 0; for (const x of v) { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; } return h >>> 0; }
const u01 = (...v: number[]) => h32(...v) / 4294967296;
const dayDiff = (a: number, b: number) => ((a - b) % YEAR + YEAR + YEAR / 2) % YEAR - YEAR / 2; // a - b on the year's circle

/** the plot items near grid (e, n) on day-of-year `doy`: the harvest's sheaves and stooks, the plough's ard (pure: the page and the census) */
export function fieldItems(zm: ZoneMap, e: number, n: number, doy: number, R: number = FIELD_R.near): FieldItem[] {
  const out: FieldItem[] = [], seen = new Set<number>(), S = FIELD_R.step;
  for (let x = Math.floor((e - R) / S) * S; x <= e + R; x += S) for (let y = Math.floor((n - R) / S) * S; y <= n + R; y += S) {
    const p = plotAt(x, -y); if (seen.has(p.h)) continue; seen.add(p.h);
    const u = landUseAt(zm, x, -y); if (u.use !== 'irrigated' && u.use !== 'rainfed') continue;
    const H = HARVEST[u.row], ca = Math.cos(p.angle), sa = Math.sin(p.angle);
    // the plot's own grid in its strip frame (world x, z), from its seed: rows along the strip (the sowing ran with the plough)
    const grid = (sp: number, salt: number, f: (wx: number, wz: number, k: number) => void) => {
      const nu = Math.ceil(p.w * 1.6 / sp), nv = Math.ceil(p.l * 1.6 / sp);
      for (let i = -nu; i <= nu; i++) for (let j = -nv; j <= nv; j++) {
        const ju = (unit(hash2(cellU(i), cellU(j), (p.h + salt) >>> 0)) - 0.5) * sp * 0.5, jv = (unit(hash2(cellU(j), cellU(i), (p.h + salt + 1) >>> 0)) - 0.5) * sp * 0.4;
        const uu = i * sp + ju, vv = j * sp + jv, wx = p.seed[0] + uu * ca - vv * sa, wz = p.seed[1] + uu * sa + vv * ca;
        if (Math.hypot(wx - e, -wz - n) > R) continue;
        const q = plotAt(wx, wz); if (q.h !== p.h || q.edge < 1.5) continue;
        const vz = vergeZone(wx, -wz); if (vz && vz.zone !== 'verge') continue;
        f(wx, wz, i * 1000 + j); } };
    if (H !== undefined) {
      const t = dayDiff(doy + u.offsetDays, H); // (the plot runs offsetDays ahead of the calendar: cropState(row, doy + offset))
      // the sheaves lying in the rows (days 0-9), the stooks (days 3-18): denser on the near plots, as many as the harvest left
      if (t >= 0 && t < 9) grid(6.5, 31, (wx, wz, k) => { if (u01(p.h, k, 32) < 0.55) out.push({ m: 'wo_sheaves', e: wx, n: -wz, rot: -p.angle + Math.PI / 2 + (u01(p.h, k, 33) - 0.5) * 0.5, s: [1, 1, 1], shade: 0.9 + 0.2 * u01(p.h, k, 34) }); });
      if (t >= 3 && t < 18) grid(11, 41, (wx, wz, k) => { if (u01(p.h, k, 42) < Math.min(1, (t - 2) / 4) * 0.8) { const sc = 0.9 + 0.2 * u01(p.h, k, 43); out.push({ m: 'wo_stooks', e: wx, n: -wz, rot: u01(p.h, k, 44) * 6.283, s: [sc, sc * (0.92 + 0.16 * u01(p.h, k, 45)), sc], shade: 0.88 + 0.22 * u01(p.h, k, 46) }); } });
    }
    // the ard at the edge of a plot being ploughed (one a plot, on most)
    const st = cropState(u.row, doy + u.offsetDays);
    if (st.tilled > 0.35 && st.height < 0.05 && u01(p.h, 51) < 0.7) {
      let done = false; grid(9, 52, (wx, wz, k) => { if (done || plotAt(wx, wz).edge > 4) return; done = true; out.push({ m: 'wo_ard', e: wx, n: -wz, rot: -p.angle + (u01(p.h, k, 53) - 0.5) * 0.6, s: [1, 1, 1], shade: 0.9 + 0.2 * u01(p.h, 54) }); });
    }
  }
  return out;
}

/** each village's floor and fold by day-of-year (pure) */
export function villageItems(villages: FieldVillage[], doy: number, ground?: (e: number, n: number) => boolean): FieldItem[] {
  const out: FieldItem[] = [];
  for (const v of villages) {
    const [fe, fn] = v.floor, a0 = u01(h32(v.x | 0, v.y | 0), 61) * 6.283, ofs = (d: number, a: number): [number, number] => [fe + Math.cos(a0 + a) * d, fn + Math.sin(a0 + a) * d];
    const sinceThresh = doy - THRESH.from, threshing = doy >= THRESH.from && doy < THRESH.to, straw = doy >= THRESH.to || doy < THRESH.strawTo;
    if (threshing) {
      out.push({ m: 'wo_threshing_floor', e: fe, n: fn, rot: a0, s: [1, 1, 1], shade: 1 });
      const p = ofs(4.2, 0.4); out.push({ m: 'wo_sledge', e: p[0], n: p[1], rot: a0 + 1.9, s: [1, 1, 1], shade: 0.95 });
      const heaps = 1 + Math.min(3, Math.floor(sinceThresh / 25)); // grain winnowed out beside the floor as the weeks pass
      for (let i = 0; i < heaps; i++) { const q = ofs(9 + 1.6 * i, 2.2 + 0.55 * i); out.push({ m: 'wo_grain_heap', e: q[0], n: q[1], rot: a0 + i * 1.3, s: [1.1, 1 + 0.2 * u01(v.x | 0, i, 62), 1.1], shade: 0.92 + 0.12 * u01(v.y | 0, i, 63) }); }
    }
    if (threshing || straw) { // the straw: heaped beside the floor while threshing, stacked after (a fodder heap scaled up to a stack, 2-3 m)
      const k = threshing ? 2 : 4;
      for (let i = 0; i < k; i++) { const q = ofs(12 + 3.5 * i, -1.2 - 0.6 * i), w = 4.5 + 2.5 * u01(v.x | 0, i, 64), hgt = threshing ? 5 : 9 + 4 * u01(v.y | 0, i, 65);
        out.push({ m: 'wo_fodder', e: q[0], n: q[1], rot: u01(v.x | 0, v.y | 0, i, 66) * 6.283, s: [w, hgt, w * (0.8 + 0.3 * u01(v.y | 0, i, 67))], shade: threshing ? 1.05 : 0.85 }); }
    }
    // the fold, out on the open ground beyond the floor (all year)
    const fa = a0 + Math.PI * (0.7 + 0.6 * u01(v.x | 0, 68)), fd = v.r + 90 + 60 * u01(v.y | 0, 69), f: [number, number] = [v.x + Math.cos(fa) * fd, v.y + Math.sin(fa) * fd];
    if (!ground || ground(f[0], f[1])) out.push({ m: 'wo_fold', e: f[0], n: f[1], rot: fa, s: [0.9, 1, 0.9], shade: 0.95 });
  }
  return out;
}

interface Slot { mesh: THREE.InstancedMesh; part: string; n: number }
export class FieldFill {
  readonly group = new THREE.Group();
  private slots = new Map<M, Slot[][]>();
  private last: [number, number] = [1e9, 1e9]; private lastDoy = -1; private vItems: FieldItem[] = []; private vDoy = -1;
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private up = new THREE.Vector3(0, 1, 0); private p = new THREE.Vector3(); private sc = new THREE.Vector3(); private c = new THREE.Color();
  readonly missing: string[] = []; drawn = 0;
  constructor(private zm: ZoneMap, private villages: FieldVillage[], private ground: (e: number, n: number) => number, private open?: (e: number, n: number) => boolean) {
    this.group.name = 'plain-field-fill';
    this.group.userData = { tier: 'C', src: 'RECON', note: 'the farm year near the walker (D-560): sheaves and stooks on the cut cereal plots, the threshing floors\' season (sledge, grain heaps, straw), the straw stacks to spring, an ard at a plot being ploughed, the villages\' thorn folds; all C, modelled (tools/blender/model_props.py)' };
    for (const m of MODELS) {
      if (!model(m)) { this.missing.push(m); continue; } // (the registry is keyed by the model's `of`: wo_*)
      const levels: Slot[][] = [];
      for (let l = 0; l < 3; l++) { const parts = modelParts(m, l); if (!parts) break; const L: Slot[] = [];
        for (const [part, g0] of Object.entries(parts)) { const def = PART[part] ?? ['clay', [0.6, 0.5, 0.4]] as [string, RGB], g = new THREE.BufferGeometry(), N = g0.getAttribute('position').count, col = new Float32Array(N * 3);
          for (let i = 0; i < N; i++) { const a = aoFactor(g0, i); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = a; }
          g.setAttribute('position', g0.getAttribute('position')); g.setAttribute('normal', g0.getAttribute('normal') ?? (g0.computeVertexNormals(), g0.getAttribute('normal'))); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); if (g0.index) g.setIndex(g0.index);
          g.computeBoundingSphere();
          const mat = propMaterial(def[0], { vertexColors: true, metal: def[0] === 'metal' ? 0.6 : 0 });
          const mesh = new THREE.InstancedMesh(g, mat, CAP[m]); mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = l < 2 && m !== 'wo_sheaves';
          mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP[m] * 3), 3); mesh.name = `field:${m}:${part}:lod${l}`; mesh.userData = this.group.userData;
          this.group.add(mesh); L.push({ mesh, part, n: 0 }); }
        levels.push(L); }
      if (levels.length === 3) this.slots.set(m, levels); else this.missing.push(m);
    }
    if (this.missing.length) this.group.userData = { ...this.group.userData, placeholder: this.missing.length === MODELS.length, note: `${this.group.userData.note}; not loaded (not drawn): ${this.missing.join(', ')}` };
  }
  /** the viewer (grid e, n) and the day of the year */
  update(viewer: [number, number], doy: number, force = false): boolean {
    if (!this.slots.size) return false;
    if (!force && doy === this.lastDoy && Math.hypot(viewer[0] - this.last[0], viewer[1] - this.last[1]) < FIELD_R.move) return false;
    this.last = [viewer[0], viewer[1]]; this.lastDoy = doy;
    if (doy !== this.vDoy) { this.vDoy = doy; this.vItems = villageItems(this.villages, doy, this.open); }
    const items = [...fieldItems(this.zm, viewer[0], viewer[1], doy), ...this.vItems.filter(it => Math.hypot(it.e - viewer[0], it.n - viewer[1]) < FIELD_R.far)];
    items.sort((a, b) => Math.hypot(a.e - viewer[0], a.n - viewer[1]) - Math.hypot(b.e - viewer[0], b.n - viewer[1])); // (the nearest first when a cap is reached)
    for (const L of this.slots.values()) for (const S of L) for (const s of S) s.n = 0;
    let drawn = 0;
    for (const it of items) {
      const levels = this.slots.get(it.m); if (!levels) continue;
      const d = Math.hypot(it.e - viewer[0], it.n - viewer[1]); if (d > (BIG.has(it.m) ? FIELD_R.far : FIELD_R.near)) continue;
      const y = this.ground(it.e, it.n); if (!Number.isFinite(y)) continue;
      const L = levels[d < FIELD_R.lod0 ? 0 : d < FIELD_R.lod1 ? 1 : 2]; if (L.some(s => s.n >= CAP[it.m])) continue;
      this.q.setFromAxisAngle(this.up, it.rot); this.m4.compose(this.p.set(it.e, y - 0.02, -it.n), this.q, this.sc.set(it.s[0], it.s[1], it.s[2]));
      for (const s of L) { const c = PART[s.part]?.[1] ?? [0.6, 0.5, 0.4]; s.mesh.setMatrixAt(s.n, this.m4); this.c.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace).multiplyScalar(it.shade); s.mesh.setColorAt(s.n, this.c); s.n++; }
      drawn++;
    }
    for (const L of this.slots.values()) for (const S of L) for (const s of S) { s.mesh.count = s.n; s.mesh.visible = s.n > 0; if (s.n) { s.mesh.instanceMatrix.needsUpdate = true; s.mesh.instanceColor!.needsUpdate = true; } }
    this.drawn = drawn; return true;
  }
  stats() { return { drawn: this.drawn, missing: this.missing }; }
}
