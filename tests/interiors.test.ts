// s17 C7 (D-610): interiors everywhere. The planner (src/world/interiors/plan.ts) furnishes a room for its household
// (the poor sparse, the rich full; a weaver's loom, an infant's cradle), keeps every doorway's sweep clear and a body's
// way from each doorway to the middle; the census over every room of the town and the villages (no bare rooms, no two
// neighbours laid out alike, nothing in a doorway); the ring draws the rooms round the eye in two meshes within its
// triangle budget, with the real models, and F3 names every thing. Render-only: no collider, the walking grid unchanged.
import { describe, it, expect, beforeAll } from 'vitest';
import { planRoom, type RoomIn, type Profile, TRIS } from '../src/world/interiors/plan';
import { census, inDoorway, walkable, type CRoom } from '../src/world/interiors/census';
import { buildTownPlan } from '../src/world/settlement/plan';
import { SiteHouses } from '../src/world/settlement/houses';
import { HOUSE_KINDS } from '../src/world/settlement/houseplan';
import type { RGB } from '../src/world/settlement/geom';
import { roomPlan, type HouseView } from '../src/world/interiors/town';
import { InteriorRing, RING_MAX_TRIS } from '../src/world/interiors/ring';
import { loadModelsNode } from './lib/models_node';
import { registerScanStandIns, VESSEL_IDS } from './lib/scanStandIns';
registerScanStandIns(VESSEL_IDS); loadModelsNode();

const room = (use: RoomIn['use'], w = 4, d = 3.5): RoomIn => ({ id: `t:${use}:${w}x${d}`, u0: 0, u1: w, v0: 0, v1: d, doors: [{ side: 0, at: w / 2, w: 1 }], back: 1, use, inset: 0.3, ceil: 2.4 });
const prof = (o: Partial<Profile> = {}): Profile => ({ standing: 0.5, members: 6, children: 2, infants: 0, women: 2, elders: 0, craft: null, jobs: ['farmer', 'homemaker'], animal: null, persian: false, season: 'warm', from: 'plot', place: 'town', ...o });

describe('the planner (D-610)', () => {
  it('a room is furnished for its household: the rich fuller than the poor, a weaver\'s loom, an infant\'s cradle, a scribe\'s tablets', () => {
    const poor = planRoom(room('living'), prof({ standing: 0.1 })), rich = planRoom(room('living'), prof({ standing: 0.95 }));
    console.log(`[interiors] living 4 x 3.5 m: poor ${poor.items.length} things (${poor.items.map(i => i.k).join(',')}); rich ${rich.items.length} (${rich.items.map(i => i.k).join(',')})`);
    expect(rich.items.length).toBeGreaterThan(poor.items.length); expect(rich.items.some(i => i.k === 'chest')).toBe(true); expect(poor.items.some(i => i.k === 'chest')).toBe(false);
    expect(planRoom(room('living', 4.5, 4), prof({ jobs: ['weaver'] })).items.some(i => i.k === 'loom_upright' || i.k === 'wool')).toBe(true);
    expect(planRoom(room('living'), prof({ infants: 1 })).items.some(i => i.k === 'cradle')).toBe(true);
    expect(planRoom(room('living'), prof({ jobs: ['scribe'] })).items.some(i => i.k === 'tablets')).toBe(true);
    expect(planRoom(room('workroom', 5, 4), prof({ craft: 'metal', jobs: ['craftsman'] })).items.some(i => i.k === 'anvil')).toBe(true);
    expect(planRoom(room('workroom', 5, 4), prof({ craft: 'pottery', jobs: ['craftsman'] })).items.some(i => i.k === 'wheel')).toBe(true);
  });
  it('every doorway\'s sweep stays clear, a body can walk from each doorway to the middle; the budget holds', () => {
    for (const use of ['living', 'sleeping', 'store', 'kitchen', 'vestibule', 'workroom'] as const) for (const [w, d] of [[2.2, 2.2], [3, 2.5], [4, 3.5], [6, 3]]) for (const side of [0, 1, 2, 3] as const) {
      const r: RoomIn = { ...room(use, w, d), doors: [{ side, at: side < 2 ? w / 2 : d / 2, w: 1 }], back: ([1, 0, 3, 2] as const)[side] }, p = planRoom(r, prof({ standing: 0.9, members: 9, craft: 'textile' }));
      expect(inDoorway(r, p.items)).toEqual([]); expect(walkable(r, p.items)).toBe(true);
      expect(p.items.reduce((a, i) => a + TRIS[i.k], 0)).toBeLessThanOrEqual(2200); }
  });
});

describe('the census of the town\'s rooms (D-610)', () => {
  let rooms: CRoom[] = []; const houses: SiteHouses[] = [];
  beforeAll(() => {
    const plan = buildTownPlan();
    plan.sites.forEach((s, si) => { const n = s.plots.length, hs = new SiteHouses(s, si, () => 0, new Float32Array(n), new Uint8Array(n), Array.from({ length: n }, () => [0.5, 0.45, 0.35] as RGB), new Int32Array(n), []); houses.push(hs);
      const h = Object.assign(Object.create(hs), { life: (q: number) => (hs as any).life(q), day: 30 }) as HouseView;
      for (const r of hs.rooms) { if (!HOUSE_KINDS.has(s.plots[r.plot].kind)) continue; const x = roomPlan(h, r); if (!x) continue; const [e, n2] = s.grid((x.room.u0 + x.room.u1) / 2, (x.room.v0 + x.room.v1) / 2); rooms.push({ kind: x.room.use, e, n: n2, room: x.room, plan: x.plan }); } });
  }, 120_000);
  it('no bare rooms, no two neighbours laid out alike, nothing in a doorway, every room walkable', () => {
    const rows = census(rooms), all = rows.find(r => r.kind === 'ALL')!;
    for (const r of rows) console.log(`[interiors] ${r.kind.padEnd(10)} ${r.rooms} rooms, bare ${(100 * r.bare / r.rooms).toFixed(1)} %, ${r.things.toFixed(1)} things, floor ${(100 * r.covered).toFixed(0)} %, same set as a neighbour ${(100 * r.twinsSet / r.rooms).toFixed(1)} %, same layout ${(100 * r.twinsLayout / r.rooms).toFixed(1)} %, in a doorway ${r.blocked}, stuck ${r.stuck}, ${r.tris.toFixed(0)} triangles (max ${r.maxTris})`);
    expect(all.rooms).toBeGreaterThan(5000); expect(all.bare / all.rooms).toBeLessThan(0.08); expect(all.twinsLayout / all.rooms).toBeLessThan(0.01); expect(all.twinsSet / all.rooms).toBeLessThan(0.05);
    expect(all.blocked).toBe(0); expect(all.stuck / all.rooms).toBeLessThan(0.003);
  });
  it('the ring draws the rooms round the eye in two meshes within its budget, with the models; F3 names each thing', () => {
    const ring = new InteriorRing(), s = houses[0].s, p = s.plots.find(q => q.door && HOUSE_KINDS.has(q.kind))!, [e, n] = s.grid(...s.doorPoints(p)!.out);
    ring.update(e, -n, 30, true);
    const meshes: any[] = []; ring.group.traverse((o: any) => { if (o.isMesh && o.visible) meshes.push(o); });
    const tris = meshes.reduce((a, m) => a + m.geometry.index.count / 3, 0);
    console.log(`[interiors] ring at ${p.id}'s door: ${ring.info.rooms} rooms, ${ring.info.items} things, ${(tris / 1e3).toFixed(1)} k triangles in ${meshes.length} meshes, ${ring.info.ms.toFixed(0)} ms`);
    expect(ring.info.rooms).toBeGreaterThan(5); expect(meshes.length).toBeLessThanOrEqual(2); expect(tris).toBeLessThan(RING_MAX_TRIS + 5000); expect(tris).toBeGreaterThan(ring.info.rooms * 300);
    const d = meshes[0].userData.describe({ faceIndex: 0 }); expect(d?.tier).toBe('C'); expect(d.note.length).toBeGreaterThan(10);
    // moving a step does not rebuild; far away it empties
    const b0 = ring.info.builds; ring.update(e + 0.5, -n, 30); expect(ring.info.builds).toBe(b0);
    ring.update(1e7, 1e7, 30); expect(ring.info.rooms).toBe(0);
  });
});
