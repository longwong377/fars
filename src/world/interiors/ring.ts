// s17 C7 (D-610): the furnished rooms round the eye. The near tiles of the houses had no triangles to spare (the worst tile
// 59.9 k of its 60 k budget, tests/houses.test.ts, before any furnishing beyond a mat and a roll), and a room's things are
// seen only through its doorway from close by: so the rooms within RING_R of the eye are planned (plan.ts, for their
// household), drawn (draw.ts) and merged into two meshes of their own (earth, clay and stone; wood and cloth: two draw
// calls whatever the number of rooms), rebuilt when the eye has moved a few metres and the set of rooms has changed. The
// town's and the villages' houses (settlement/houses.ts SiteHouses) register themselves; Settlement.nearUpdate moves the
// ring with the eye. F3 names every thing (its note, tier C) through the meshes' describe.
import * as THREE from 'three/webgpu';
import { attribute } from 'three/tsl';
import { surfaceMaterial } from '../../render/materials';
import { Batch, type RGB } from '../settlement/geom';
import type { Site } from '../settlement/site';
import { toLocal } from '../settlement/site';
import type { HouseLife } from '../settlement/houseplan';
import { roomPlan, seasonOfDay, interiorsOn, type RoomRect, type HouseView } from './town';
import { drawItem, type DrawCtx } from './draw';
import { peopleVersion } from './household';
import type { Item, Profile } from './plan';

/** what the ring reads of a SiteHouses (settlement/houses.ts) */
interface Houses { s: Site; rooms: readonly (RoomRect & { R: number })[]; gl(u: number, v: number): number; lampSpot(plot: number): [number, number, number] | null }
const REG = new Set<WeakRef<Houses>>();
/** SiteHouses registers itself (its constructor: the hook) */
export function registerHouses(hs: Houses) { REG.add(new WeakRef(hs)); }
/** the rooms within this distance of the eye are furnished (m), and dropped beyond it plus the hysteresis */
export const RING_R = 22, RING_HYST = 6;
/** the ring's triangles at most (the nearest rooms first): two draws of at most this many */
export const RING_MAX_TRIS = 60_000;
interface Desc { tier: string; src: string; note: string; placeholder?: boolean }
export interface Built { clay: THREE.BufferGeometry | null; cloth: THREE.BufferGeometry | null; co: Int32Array; to: Int32Array; desc: Desc[]; tris: number; items: number }
/** a room within reach: its key, its distance from the eye and how to build it */
export interface NearRoom { key: string; d: number; build: () => Built | null }
/** a kind of rooms the ring furnishes (the houses register themselves; the Terrace's ranges through furnish.ts) */
export interface RoomSource { near(e: number, n: number, r: number, day: number): NearRoom[] }
const SOURCES: RoomSource[] = [];
export function addRoomSource(src: RoomSource) { if (!SOURCES.includes(src)) SOURCES.push(src); }
/** a plan's things drawn into a room's own batches (`label` names the room in F3) */
export function drawPlanned(items: Item[], label: string, at: { grid: (u: number, v: number) => [number, number]; theta: number; floor: (u: number, v: number) => number; prof: Profile }, extra?: (ctx: DrawCtx & { own: number }, own: (it: Item) => number) => number): Built {
  const clay = plaster(), cloth = plain(), desc: Desc[] = [];
  const own = (it: Item) => { desc.push({ tier: 'C', src: 'RECON;D-610', note: `${label}: ${it.note ?? it.k}` }); return desc.length - 1; };
  const ctx = { ...at, clay, cloth, own: 0 }; clay.set('ao', 0.2); cloth.set('ao', 0.2); let n = 0;
  for (const it of items) { ctx.own = own(it); if (drawItem(ctx, it)) n++; }
  if (extra) n += extra(ctx, own);
  return { clay: clay.tris ? clay.toGeometry() : null, cloth: cloth.tris ? cloth.toGeometry() : null, co: clay.owner.slice(), to: cloth.owner.slice(), desc, tris: clay.tris + cloth.tris, items: n };
}

const plaster = () => new Batch().addAttr('y0', 1, [-1000]).addAttr('ytop', 1, [1e4]).addAttr('ao', 1, [1]); // (houses.ts plasterBatch)
const plain = () => new Batch().addAttr('ao', 1, [1]);

export class InteriorRing {
  readonly group = new THREE.Group();
  private cache = new Map<string, Built | null>(); private pending = false;
  private key = ''; private last: [number, number] = [1e9, 1e9]; private season = '';
  private meshes: { clay: THREE.Mesh | null; cloth: THREE.Mesh | null } = { clay: null, cloth: null };
  private mats: { clay: THREE.Material; cloth: THREE.Material } | null = null;
  readonly info = { rooms: 0, items: 0, tris: 0, builds: 0, ms: 0 };
  constructor() { this.group.name = 'interiors'; this.group.userData = { tier: 'C', src: 'RECON', note: 'the furnishing of the rooms round the eye (s17 C7, D-610: src/world/interiors)' }; }
  /** the rooms (house view, room) within r of grid (e, n) */
  roomsNear(e: number, n: number, r: number, day = 0): { h: HouseView & Houses; room: RoomRect & { R: number }; key: string; d: number }[] {
    const out: { h: HouseView & Houses; room: RoomRect & { R: number }; key: string; d: number }[] = [];
    for (const ref of REG) { const hs = ref.deref(); if (!hs) { REG.delete(ref); continue; } const s = hs.s, rs = Math.hypot(s.W, s.H) / 2; if (Math.hypot(s.frame.c[0] - e, s.frame.c[1] - n) > rs + r) continue;
      const [u, v] = toLocal(s.frame, e, n), h = Object.assign(Object.create(hs), { life: (q: number) => (hs as any).life(q) as HouseLife, day }) as HouseView & Houses;
      for (const room of hs.rooms) { if (!room.full) continue; const u0 = s.u0 + room.i0, u1 = s.u0 + room.i1, v0 = s.v0 + room.j0, v1 = s.v0 + room.j1;
        const d = Math.hypot(Math.max(u0 - u, 0, u - u1), Math.max(v0 - v, 0, v - v1)); if (d > r) continue;
        out.push({ h, room, key: `${s.id}:${room.plot}:${room.room}`, d }); } }
    return out;
  }
  /** one house room's things, drawn into its own batches (cached until the season turns) */
  build(h: HouseView & Houses, room: RoomRect & { R: number }): Built | null {
    const x = roomPlan(h, room); if (!x) return null; const s = h.s;
    return drawPlanned(x.plan.items, `${s.plots[room.plot].id} (${x.room.use}${x.prof.from === 'population' ? ', the household of the population' : ''})`, { grid: (u, v) => s.grid(u, v), theta: s.frame.theta, floor: (u, v) => h.gl(u, v) + 0.1, prof: x.prof }, (ctx, own) => {
      const L = h.lampSpot(room.plot); if (!L) return 0; const [lu, lv] = toLocal(s.frame, L[0], L[1]);
      if (!(lu > x.room.u0 && lu < x.room.u1 && lv > x.room.v0 && lv < x.room.v1)) return 0; // the house's saucer lamp on its ledge of mud (its flame: the fire system's, houses.ts lampSpot)
      const tone: RGB = (h as any).tone?.(room.plot, 1, false) ?? [0.4, 0.33, 0.25], lamp: Item = { k: 'lamp', u: lu, v: lv, rot: 0, w: 0.17, d: 0.14, h: 0.035, y: 0, vr: 0.5, wall: -1, note: 'the house\'s saucer lamp on a ledge of mud (saucer lamps B by analogy, Q-516; burned every evening C)' };
      ctx.own = own(lamp); ctx.clay.box(L[0], L[1], s.frame.theta, 0.18, 0.18, L[2] - 0.1, L[2] - 0.02, [tone[0] * 0.7, tone[1] * 0.7, tone[2] * 0.7], [tone[0] * 0.8, tone[1] * 0.8, tone[2] * 0.8], ctx.own);
      drawItem({ ...ctx, floor: () => L[2] - 0.02 }, lamp); return 1; });
  }
  /** every room within r of grid (e, n): the houses' and the other sources' */
  allNear(e: number, n: number, r: number, day: number): NearRoom[] {
    const out: NearRoom[] = this.roomsNear(e, n, r, day).map(w => ({ key: w.key, d: w.d, build: () => this.build(w.h, w.room) }));
    for (const src of SOURCES) out.push(...src.near(e, n, r, day)); return out;
  }
  /** move the ring with the eye (world x, z; the day for the season): rebuild when the set of rooms within reach changed */
  update(x: number, z: number, day = 0, force = false, budgetMs = 6) {
    if (!interiorsOn) return; // (?interiors=0: houses.ts draws its own few things, to compare)
    const e = x, n = -z, season = seasonOfDay(day) + ':' + peopleVersion; if (!force && !this.pending && Math.hypot(e - this.last[0], n - this.last[1]) < 2 && season === this.season) return;
    if (season !== this.season) { this.season = season; for (const b of this.cache.values()) { b?.clay?.dispose(); b?.cloth?.dispose(); } this.cache.clear(); this.key = ''; }
    this.last = [e, n]; const t0 = performance.now();
    const want = this.allNear(e, n, RING_R, day), keep = new Set(want.map(w => w.key));
    // (hysteresis: a room shown stays until it is RING_R + RING_HYST away)
    if (this.key) for (const w of this.allNear(e, n, RING_R + RING_HYST, day)) if (!keep.has(w.key) && this.key.includes(`|${w.key}|`)) { want.push(w); keep.add(w.key); }
    want.sort((a, b) => (a.key < b.key ? -1 : 1)); const key = '|' + want.map(w => w.key).join('|') + '|';
    if (key === this.key && !force && !this.pending) return; this.key = key;
    for (const k of [...this.cache.keys()]) if (!keep.has(k)) { const b = this.cache.get(k); b?.clay?.dispose(); b?.cloth?.dispose(); this.cache.delete(k); }
    // the rooms not yet built: the nearest first, a few milliseconds a frame (the rest on the next frames; a jump or a test: all)
    const parts: Built[] = []; let tris = 0, missing = false;
    for (const w of [...want].sort((a, b) => a.d - b.d)) { if (tris > RING_MAX_TRIS) break; let b = this.cache.get(w.key);
      if (b === undefined) { if (!force && this.info.rooms > 0 && performance.now() - t0 > budgetMs) { missing = true; continue; } b = w.build(); this.cache.set(w.key, b); this.info.builds++; }
      if (b) { parts.push(b); tris += b.tris; } }
    this.pending = missing; if (!missing) this.swap(parts); this.info.ms = performance.now() - t0;
  }
  private swap(parts: Built[]) {
    this.mats ??= { clay: Object.assign(surfaceMaterial('house_plaster', { vertexColors: true, arch: true }), { aoNode: attribute('ao', 'float') }), cloth: Object.assign(surfaceMaterial('house_timber', { vertexColors: true }), { aoNode: attribute('ao', 'float') }) };
    let tris = 0, items = 0; for (const p of parts) { tris += p.tris; items += p.items; } this.info.rooms = parts.length; this.info.items = items; this.info.tris = tris;
    for (const k of ['clay', 'cloth'] as const) {
      const ps = parts.filter(p => p[k]); let m = this.meshes[k];
      if (!ps.length) { if (m) m.visible = false; continue; }
      const g0 = ps[0][k]!, names = Object.keys(g0.attributes); let nv = 0, ni = 0; for (const p of ps) { nv += p[k]!.getAttribute('position').count; ni += p[k]!.index!.count; }
      const arrs = names.map(a => ({ a, size: g0.getAttribute(a).itemSize, arr: new Float32Array(nv * g0.getAttribute(a).itemSize), o: 0 }));
      const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni); let io = 0, vb = 0; const ranges: { f0: number; f1: number; own: Int32Array; desc: Desc[] }[] = [];
      for (const p of ps) { const g = p[k]!; for (const A of arrs) { const src = g.getAttribute(A.a).array as Float32Array; A.arr.set(src, A.o); A.o += src.length; }
        const src = g.index!.array; for (let i = 0; i < src.length; i++) idx[io + i] = src[i] + vb; ranges.push({ f0: io / 3, f1: (io + src.length) / 3, own: k === 'clay' ? p.co : p.to, desc: p.desc }); io += src.length; vb += g.getAttribute('position').count; }
      const g = new THREE.BufferGeometry(); for (const A of arrs) g.setAttribute(A.a, new THREE.BufferAttribute(A.arr, A.size)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
      if (!m) { m = new THREE.Mesh(g, this.mats[k]); m.name = `interiors:${k}`; m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false; m.frustumCulled = false; this.meshes[k] = m; this.group.add(m); }
      else { m.geometry.dispose(); m.geometry = g; }
      m.visible = true;
      m.userData = { tier: 'C', src: 'RECON;D-610', note: `the furnishing of the rooms round the eye (${k})`, describe: (hit: any) => { const f = hit?.faceIndex ?? -1; const r = ranges.find(q => f >= q.f0 && f < q.f1); return r ? r.desc[r.own[f - r.f0]] ?? null : null; } };
    }
  }
}
/** the one ring (Settlement adds its group and moves it) */
export const interiorRing = new InteriorRing();
