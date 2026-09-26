// The small life (session 9; both gap hunters: WORLD_INVENTORY G59 lizards, G60 butterflies, G61 dragonflies, G62 flies):
// what a walker sees at their feet and knee height, drawn only around the viewer (within R of the camera). The ground is cut
// into 8 m cells; each cell's context (a midden, the water's edge, rock, a field, the steppe) is read once from the world, and
// a hash of (seed, cell) decides whether it holds creatures and which. Their positions are closed-form in (seed, cell, index,
// world time), like the birds (wildlife.ts): nothing is saved, time skips and loads stay continuous; only the lizards react
// (one slips away when someone comes within 3 m). Species are those expected in Fars, the lead's recollection (SMALL-R, C):
//  - house flies at the town's middens, Apr-Oct by day, darting a hand's breadth to half a metre over the heap (C);
//  - dragonflies at the rivers' and canals' edges, May-Sep 9-17 h, patrolling 0.6-1.8 m up, hovering and darting (C);
//  - butterflies (whites, clouded yellows, a painted lady) over fields and steppe in spring (Mar-Jun) and again in
//    Sep-Oct, 9-17 h, fluttering 0.3-1.5 m up and drifting (C);
//  - rock agamas (Paralaudakia / Laudakia, large-scaled rock agama in Fars: recollection, C) basking on rock by day
//    Apr-Oct, still for long spells, dashing a metre or two now and then (C).
// No creature flies in rain or wind over 8 m/s (C). One InstancedMesh per kind (4 draws, none while empty; no shadows).
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, sin, float, vec3, abs, uniform } from 'three/tsl';
import type { P2 } from '../people/navgrid';

export type SmallKind = 'fly' | 'dragonfly' | 'butterfly' | 'lizard';
export type CellCtx = 'midden' | 'water' | 'rock' | 'field' | 'steppe' | 'none';
export const SMALL = {
  fly: { name: 'house fly', months: [3, 4, 5, 6, 7, 8, 9], hours: [8, 18] as [number, number], ctx: ['midden'] as CellCtx[], p: 1, per: [5, 9] as [number, number], max: 160, span: 0.013, length: 0.008, flapHz: 25, colour: [0.06, 0.06, 0.06] as [number, number, number] },
  dragonfly: { name: 'dragonfly', months: [4, 5, 6, 7, 8], hours: [9, 17] as [number, number], ctx: ['water'] as CellCtx[], p: 0.45, per: [1, 2] as [number, number], max: 40, span: 0.09, length: 0.07, flapHz: 6, colour: [0.2, 0.32, 0.45] as [number, number, number] },
  butterfly: { name: 'butterflies (whites, clouded yellow, painted lady)', months: [2, 3, 4, 5, 8, 9], hours: [9, 17] as [number, number], ctx: ['field', 'steppe'] as CellCtx[], p: 0.18, per: [1, 2] as [number, number], max: 60, span: 0.055, length: 0.02, flapHz: 5, colour: [1, 1, 1] as [number, number, number] },
  lizard: { name: 'rock agama', months: [3, 4, 5, 6, 7, 8, 9], hours: [9, 17] as [number, number], ctx: ['rock', 'steppe'] as CellCtx[], p: 0.3, per: [1, 1] as [number, number], max: 40, span: 0, length: 0.3, flapHz: 0, colour: [0.46, 0.41, 0.33] as [number, number, number] },
} as const;
const BUTTERFLY_COLOURS: [number, number, number][] = [[0.92, 0.91, 0.86], [0.92, 0.91, 0.86], [0.93, 0.78, 0.25], [0.86, 0.5, 0.2]];
export const CELL = 8, R = 36;
const TAG = { tier: 'C', src: 'SMALL-R' };

function h32(...v: number[]) { let h = 2166136261 >>> 0; for (const x of v) { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; } return h >>> 0; }
const u01 = (...v: number[]) => h32(...v) / 4294967296;
const smooth = (u: number) => u * u * (3 - 2 * u);

export interface SmallPose { e: number; n: number; up: number /* metres over the ground */; heading: number; flap: number; visible: boolean }
/** a darting path: a new random point within `r` of the centre every `period` s, eased between (`hold`: the share of each
 *  period spent still at the point, for hovering and basking) */
export function dartAt(seed: number, t: number, period: number, r: number, hold: number): { x: number; y: number; vx: number; vy: number } {
  const k = Math.floor(t / period), f = t / period - k, pt = (j: number) => { const a = u01(seed, j, 1) * 6.2832, d = r * Math.sqrt(u01(seed, j, 2)); return [Math.cos(a) * d, Math.sin(a) * d]; };
  const [ax, ay] = pt(k), [bx, by] = pt(k + 1), m = f < hold ? 0 : smooth((f - hold) / (1 - hold));
  return { x: ax + (bx - ax) * m, y: ay + (by - ay) * m, vx: bx - ax, vy: by - ay };
}
/** where creature `i` of `kind` in cell (ix, iy) is at world time t (grid metres; `up` over the ground) */
export function smallAt(kind: SmallKind, seed: number, ix: number, iy: number, i: number, t: number, out: SmallPose) {
  const s = h32(seed, ix, iy, i, kind.length * 7 + kind.charCodeAt(0)), cx = (ix + 0.2 + 0.6 * u01(s, 3)) * CELL, cy = (iy + 0.2 + 0.6 * u01(s, 4)) * CELL, ph = u01(s, 5) * 100;
  out.visible = true;
  if (kind === 'fly') { const d = dartAt(s, t + ph, 0.35, 0.45, 0.2); out.e = cx + d.x; out.n = cy + d.y; out.up = 0.08 + 0.45 * u01(s, Math.floor((t + ph) / 0.35)); out.heading = Math.atan2(d.vx, d.vy); out.flap = 1; return; }
  if (kind === 'dragonfly') { const d = dartAt(s, t + ph, 2.2, 3.5, 0.55); out.e = cx + d.x; out.n = cy + d.y; out.up = 0.6 + 1.2 * u01(s, 6) + 0.15 * Math.sin(t * 1.3 + ph); out.heading = Math.atan2(d.vx, d.vy); out.flap = 1; return; }
  if (kind === 'butterfly') { const d = dartAt(s, t + ph, 3.2, 3, 0.1); out.e = cx + d.x + 0.12 * Math.sin(t * 7.1 + ph); out.n = cy + d.y + 0.12 * Math.cos(t * 5.3 + ph); out.up = 0.3 + 1.0 * u01(s, 7) + 0.2 * Math.abs(Math.sin(t * 4.3 + ph)); out.heading = Math.atan2(d.vx, d.vy) + 0.4 * Math.sin(t * 3 + ph); out.flap = 1; return; }
  // lizard: basks through each 25-60 s spell, then dashes to a spot within 1.6 m in 0.7 s (up to ~3.5 m/s at the peak)
  const T = 25 + 35 * u01(s, 8), d = dartAt(s, t + ph, T, 1.6, 1 - 0.7 / T); out.e = cx + d.x; out.n = cy + d.y; out.up = 0.01; out.heading = Math.atan2(d.vx, d.vy); out.flap = 0;
}

/** a winged insect: a thin body along +z and two (or four) wing quads whose tip vertices carry `wing` = +-1 */
function wingedGeometry(span: number, len: number, broad: number, pairs: number): THREE.BufferGeometry {
  const P: number[] = [], W: number[] = [], w = span / 2, l = len / 2, b = len * 0.1;
  const quad = (a: number[], c: number[], d: number[], e: number[], wa: number[]) => { P.push(...a, ...c, ...d, ...a, ...d, ...e); W.push(wa[0], wa[1], wa[2], wa[0], wa[2], wa[3]); };
  quad([-b, 0, l], [b, 0, l], [b, 0, -l], [-b, 0, -l], [0, 0, 0, 0]); quad([0, -b, l], [0, b, l], [0, b, -l], [0, -b, -l], [0, 0, 0, 0]); // body cross
  for (let p = 0; p < pairs; p++) { const z0 = l * (0.35 - p * 0.45), z1 = z0 - broad;
    quad([b, 0, z0], [w, 0, z0 - broad * 0.2], [w, 0, z1], [b, 0, z1 + broad * 0.3], [0, 1, 1, 0]); quad([-b, 0, z0], [-b, 0, z1 + broad * 0.3], [-w, 0, z1], [-w, 0, z0 - broad * 0.2], [0, 0, -1, -1]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('wing', new THREE.Float32BufferAttribute(W, 1)); g.computeVertexNormals(); return g;
}
/** an agama: body, head and a long tapering tail as boxes, lying flat (+z forward) */
function lizardGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, z: number, y = h / 2) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y, z); parts.push(g); };
  box(0.04, 0.022, 0.1, 0.02); box(0.028, 0.02, 0.035, 0.088, 0.013); box(0.02, 0.012, 0.07, -0.063, 0.007); box(0.011, 0.008, 0.07, -0.13, 0.004);
  for (const [x, z] of [[0.028, 0.055], [-0.028, 0.055], [0.028, -0.015], [-0.028, -0.015]]) box(0.03, 0.006, 0.008, z, 0.004), parts[parts.length - 1].translate(x, 0, 0);
  const n = parts.reduce((s, g) => s + g.getAttribute('position').count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), W = new Float32Array(n); let o = 0; const idx: number[] = [];
  for (const g of parts) { const p = g.getAttribute('position'), q = g.getAttribute('normal'); for (let i = 0; i < p.count; i++) { pos.set([p.getX(i), p.getY(i), p.getZ(i)], (o + i) * 3); nor.set([q.getX(i), q.getY(i), q.getZ(i)], (o + i) * 3); } for (const k of g.index!.array) idx.push(k + o); o += p.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('wing', new THREE.BufferAttribute(W, 1)); g.setIndex(idx); return g;
}

export interface SmallWorld {
  /** the walkable/visible ground height at a grid point (world y) */ ground(e: number, n: number): number;
  /** the context of a grid point */ ctxAt(e: number, n: number): CellCtx;
}
export class SmallLife {
  readonly group = new THREE.Group();
  readonly meshes = new Map<SmallKind, THREE.InstancedMesh>();
  private uTime = uniform(0);
  private cells = new Map<number, CellCtx>();
  private pose: SmallPose = { e: 0, n: 0, up: 0, heading: 0, flap: 0, visible: false };
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(0, 0, 0, 'YXZ'); private p = new THREE.Vector3(); private c = new THREE.Color();
  private fled = new Map<number, number>();
  stats = { fly: 0, dragonfly: 0, butterfly: 0, lizard: 0, cells: 0 };
  constructor(private seed: number, private world: SmallWorld) {
    this.group.name = 'wildlife-small';
    const geos: Record<SmallKind, THREE.BufferGeometry> = { fly: wingedGeometry(SMALL.fly.span, SMALL.fly.length, 0.005, 1), dragonfly: wingedGeometry(SMALL.dragonfly.span, SMALL.dragonfly.length, 0.011, 2), butterfly: wingedGeometry(SMALL.butterfly.span, SMALL.butterfly.length, 0.03, 1), lizard: lizardGeometry() };
    for (const k of Object.keys(SMALL) as SmallKind[]) {
      const sp = SMALL[k], m = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(...sp.colour, THREE.SRGBColorSpace), roughness: k === 'dragonfly' ? 0.45 : 0.85, side: THREE.DoubleSide });
      if (sp.flapHz) { const wing = attribute('wing', 'float'), phase = attribute('phase', 'float');
        // wingbeat: the tips swing through +-70 deg (a butterfly's clap, a fly's blur), scaled to the half-span
        m.positionNode = positionLocal.add(vec3(0, abs(wing).mul(sin(this.uTime.mul(sp.flapHz * 2 * Math.PI).add(phase))).mul(float(sp.span * 0.45)), 0)); }
      const g = geos[k]; g.setAttribute('phase', new THREE.InstancedBufferAttribute(new Float32Array(sp.max).map((_, i) => u01(seed, i, 9) * 6.28), 1));
      const mesh = new THREE.InstancedMesh(g, m, sp.max); mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false; mesh.name = `small-${k}`;
      if (k === 'butterfly') for (let i = 0; i < sp.max; i++) mesh.setColorAt(i, this.c.setRGB(...BUTTERFLY_COLOURS[h32(seed, i, 11) % BUTTERFLY_COLOURS.length], THREE.SRGBColorSpace));
      mesh.userData = { ...TAG, note: `${sp.name}: ${k === 'lizard' ? 'basking and dashing' : 'flight'} procedural, around the viewer only (C)` };
      this.meshes.set(k, mesh); this.group.add(mesh);
    }
  }
  private ctx(ix: number, iy: number): CellCtx {
    const key = (ix + 32768) * 65536 + (iy + 32768); let c = this.cells.get(key);
    if (c === undefined) { if (this.cells.size > 40000) this.cells.clear(); c = this.world.ctxAt((ix + 0.5) * CELL, (iy + 0.5) * CELL); this.cells.set(key, c); }
    return c;
  }
  /** month 0 = January; hour local; t world seconds; the viewer's grid position; rain 0-1; wind m/s */
  update(month: number, hour: number, t: number, viewer: P2, rain: number, windMs: number) {
    this.uTime.value = t % 10000;
    const counts: Record<SmallKind, number> = { fly: 0, dragonfly: 0, butterfly: 0, lizard: 0 };
    const i0 = Math.floor((viewer[0] - R) / CELL), i1 = Math.floor((viewer[0] + R) / CELL), j0 = Math.floor((viewer[1] - R) / CELL), j1 = Math.floor((viewer[1] + R) / CELL);
    const live = (Object.keys(SMALL) as SmallKind[]).filter(k => { const sp = SMALL[k]; return (sp.months as readonly number[]).includes(month) && hour >= sp.hours[0] && hour <= sp.hours[1] && rain < 0.15 && (k === 'lizard' || windMs < 8); });
    let cells = 0;
    if (live.length) for (let ix = i0; ix <= i1; ix++) for (let iy = j0; iy <= j1; iy++) {
      if (Math.hypot((ix + 0.5) * CELL - viewer[0], (iy + 0.5) * CELL - viewer[1]) > R) continue;
      const cx = this.ctx(ix, iy); if (cx === 'none') continue; cells++;
      for (const k of live) {
        const sp = SMALL[k]; if (!(sp.ctx as readonly CellCtx[]).includes(cx)) continue;
        const p = (k === 'lizard' && cx === 'steppe') ? 0.06 : sp.p; if (u01(this.seed, ix, iy, k.charCodeAt(0), 13) >= p) continue;
        const n = sp.per[0] + (h32(this.seed, ix, iy, 17) % (sp.per[1] - sp.per[0] + 1)), mesh = this.meshes.get(k)!;
        for (let i = 0; i < n && counts[k] < sp.max; i++) {
          const P = this.pose; smallAt(k, this.seed, ix, iy, i, t, P);
          if (k === 'lizard') { const key = h32(ix, iy, i), gone = this.fled.get(key); if (gone !== undefined && t - gone < 90) continue; if (Math.hypot(P.e - viewer[0], P.n - viewer[1]) < 3) { this.fled.set(key, t); continue; } }
          const y = this.world.ground(P.e, P.n); if (!Number.isFinite(y)) continue;
          this.e.set(0, P.heading, 0); this.q.setFromEuler(this.e); this.p.set(P.e, y + P.up, -P.n);
          this.m4.compose(this.p, this.q, ONE); mesh.setMatrixAt(counts[k]++, this.m4);
        }
      }
    }
    for (const k of Object.keys(SMALL) as SmallKind[]) { const m = this.meshes.get(k)!; m.count = counts[k]; if (counts[k]) m.instanceMatrix.needsUpdate = true; this.stats[k] = counts[k]; }
    this.stats.cells = cells;
    if (this.fled.size > 2000) this.fled.clear();
  }
}
const ONE = new THREE.Vector3(1, 1, 1);
