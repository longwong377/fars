// D-254: the villages of the plain as real places (brief: WORLD_INVENTORY G2 / A072 / B-023; BLOCKERS B64; UD-06, UD-08,
// UD-14; T-A1, T-D3). Measured, not eyeballed:
//  - the plan (villages.ts): every compound on its village's 1 m grid, never overlapping a neighbour (a lane of >= 2 m), with
//    rooms, a court, a pen, a gate, an oven, a hearth, a manger, storage; no two compounds alike (T-E5's copy-paste);
//  - the raster (villagesite.ts): walls with thickness, every doorway >= 0.8 m clear, every room, yard and pen joined to the
//    gate, the fittings in the yard or the pen and never in a doorway's way;
//  - the drawn world agrees with the plan (villagehouses.ts): the gates, the far level's tiles and the lamps computed at load
//    equal what the town's house generator makes of the raster; the near level is hollow: from a room cell of the people's
//    raster the drawn walls stand round and the drawn roof overhead, and no collider stands where a person lies;
//  - the sleepers (T-D3 over village people: the anti-proxy of B64): a village household's members asleep at 23:00 are placed
//    in a room of their own compound that is drawn and hollow, in the very raster the drawn village is built from.
// How this could pass while the intent fails (brief clause 1): a raster can be right while the drawn houses read as boxes
// (the far level beyond ~72 m is massing; a render is needed: the report lists it), a room can be hollow and empty or dark
// (furnish is the town's; judged only in a render), and the sleepers' test proves place, not pose.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { loadTerrain, loadRiversFile } from './plainLib';
import { buildCanals } from '../src/world/plain/canals';
import { placeVillages, villageCompounds, threshingFloor, LANE_MIN, COMPOUND_MIN, THRESH_R, type Compound } from '../src/world/plain/villages';
import { villageSite, villageFrame, compoundCorner } from '../src/world/plain/villagesite';
import { VillageHouses, VILLAGE_NEAR_STATE, binBox } from '../src/world/plain/villagehouses';
import { ROOM, YARD, toLocal, toGrid } from '../src/world/settlement/site';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { PopGeo } from '../src/people/popgeo';
import { registerScanStandIns, VESSEL_IDS } from './lib/scanStandIns';
// Q-960: the houses' scan vessels at the triangles the browser draws (node cannot load the GLBs)
registerScanStandIns(VESSEL_IDS);

const T = loadTerrain(), R = loadRiversFile(), C = buildCanals(T, R.rivers, 1), V = placeVillages(T, R.rivers, C, 1);
const comps = V.map(v => villageCompounds(v, T, 1));
const H = (e: number, n: number) => T.heightAt(e, -n);
const SAMPLE = ['village_p22', 'village_masumabad_west', 'village_p31'];

describe('the compounds as planned (villages.ts, D-254)', () => {
  it('stand on their village\'s 1 m grid in whole metres, never overlap, and leave a lane of >= 2 m between them', () => {
    let n = 0;
    V.forEach((v, vi) => { const fr = villageFrame(v, comps[vi]), rects: number[][] = [];
      for (const c of comps[vi]) { n++; expect(c.angle).toBe(comps[vi][0].angle);
        const [lu, lv] = toLocal(fr.frame, c.x, c.y), u0 = lu - c.w / 2, v0 = lv - c.d / 2;
        expect(Math.abs(u0 - Math.round(u0))).toBeLessThan(1e-6); expect(Math.abs(v0 - Math.round(v0))).toBeLessThan(1e-6);
        expect(Number.isInteger(c.w) && Number.isInteger(c.d)).toBe(true); expect(Math.min(c.w, c.d)).toBeGreaterThanOrEqual(COMPOUND_MIN);
        rects.push([Math.round(u0), Math.round(v0), Math.round(u0) + c.w, Math.round(v0) + c.d]); }
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], b = rects[j];
        const apart = a[2] + LANE_MIN <= b[0] || b[2] + LANE_MIN <= a[0] || a[3] + LANE_MIN <= b[1] || b[3] + LANE_MIN <= a[1]; expect(apart, `${v.id} ${i}/${j}`).toBe(true); } });
    expect(n).toBeGreaterThan(3500);
  });
  it('each has rooms, a court, a pen, a gate, an oven, a hearth, a manger and storage; no two plans alike (T-E5)', () => {
    const plans = new Set<string>(); let n = 0;
    for (const cs of comps) for (const c of cs) { n++;
      expect(c.rooms.length).toBeGreaterThanOrEqual(2);
      for (const r of c.rooms) { expect(r.u0).toBeGreaterThanOrEqual(-c.w / 2 - 1e-9); expect(r.u1).toBeLessThanOrEqual(c.w / 2 + 1e-9); expect(r.v0).toBeGreaterThanOrEqual(-c.d / 2 - 1e-9); expect(r.v1).toBeLessThanOrEqual(c.d / 2 + 1e-9); expect(Math.min(r.u1 - r.u0, r.v1 - r.v0)).toBeGreaterThanOrEqual(3); }
      const roofed = c.rooms.reduce((a, r) => a + (r.u1 - r.u0) * (r.v1 - r.v0), 0), pen = (c.pen.u1 - c.pen.u0) * (c.pen.v1 - c.pen.v0);
      expect(c.w * c.d - roofed - pen, 'the court').toBeGreaterThanOrEqual(30); expect(pen).toBeGreaterThanOrEqual(9);
      expect(c.doors.length).toBeGreaterThanOrEqual(c.rooms.length); expect(Math.abs(c.gateU)).toBeLessThan(c.w / 2 - 1);
      const k = (x: string) => c.fittings.filter(f => f.kind === x).length;
      expect(k('oven'), 'oven').toBe(1); expect(k('hearth'), 'hearth').toBe(1); expect(k('manger'), 'manger').toBe(1); expect(k('bin') + k('jar'), 'storage').toBeGreaterThanOrEqual(2);
      plans.add(JSON.stringify([c.w, c.d, c.rooms.map(r => [r.u0, r.v0, r.u1, r.v1]), c.pen, c.gateU, c.fittings.map(f => [f.kind, f.u.toFixed(2), f.v.toFixed(2)])])); }
    // (the plans' variety: sizes, rooms, wing, pen, gate and fittings; identical plans would be the copy-paste T-E5 forbids)
    expect(plans.size / n).toBeGreaterThan(0.98);
  });
  it('the threshing floor lies beyond every compound of its village, on the people\'s own bearing', () => {
    V.forEach((v, vi) => { const f = threshingFloor(v, comps[vi], 1);
      for (const c of comps[vi]) expect(Math.hypot(f[0] - c.x, f[1] - c.y) - Math.hypot(c.w, c.d) / 2, v.id).toBeGreaterThan(THRESH_R + 4); });
  });
});

describe('the village rasters (villagesite.ts): walls, doorways, rooms, fittings', () => {
  it('walls have thickness; every doorway keeps >= 0.8 m clear; every room, yard and pen is joined to its gate; fittings stand in their yard or pen, clear of the doorways', () => {
    let walls = 0, doors = 0, minClear = 9, fits = 0;
    V.forEach((v, vi) => { const vs = villageSite(v, comps[vi]), s = vs.site;
      for (const w of s.walls()) { walls++; expect(w.thick, `${v.id} ${w.kind}`).toBeGreaterThanOrEqual(w.kind === 'partition' ? 0.4 : 0.45); }
      for (const e of s.doors) { doors++; const c = s.doorClear(e); minClear = Math.min(minClear, c); expect(c, `${v.id} door ${e}`).toBeGreaterThanOrEqual(0.8); }
      const joined = s.connectPlots(0.8); expect(joined, v.id).toEqual({ added: 0, shut: 0 });
      vs.comps.forEach((c, ci) => { expect(vs.gates[ci], `${v.id} c${ci} gate`).toBe(ci); const p = s.plots[ci]; expect(p.door).toBeTruthy();
        let yard = 0, room = 0; for (let k = 0; k < s.cell.length; k++) if (s.cell[k] === ci) { if (s.sub[k] === YARD) yard++; else if (s.sub[k] === ROOM) room++; }
        expect(room).toBe(c.rooms.reduce((a, r) => a + (r.u1 - r.u0) * (r.v1 - r.v0), 0)); expect(yard).toBeGreaterThanOrEqual(30);
        expect(vs.pens[ci]).toBeGreaterThanOrEqual(0); });
      // a door's cells (either side) never hold a fitting
      const doorCells = new Set<number>(); for (const e of s.doors) { const N = s.W * s.H, k = e < N ? e : e - N, k2 = e < N ? k + s.W : k + 1; doorCells.add(k); doorCells.add(k2); }
      for (const f of s.fittings) { fits++; const k = s.k(s.ci(f.u), s.cj(f.v)); expect(doorCells.has(k), `${v.id} ${f.kind}`).toBe(false);
        if (f.plot >= 0) { expect(s.cell[k], `${v.id} ${f.kind} in its plot`).toBe(f.plot); expect(s.sub[k]).toBe(YARD); } }
      expect(vs.well, `${v.id} well`).toBeTruthy(); });
    console.log(`village rasters: ${walls} walls, ${doors} doorways (least clear ${minClear.toFixed(2)} m), ${fits} fittings`);
  }, 300_000);
});

describe('the villages as drawn agree with the plan and are hollow (villagehouses.ts)', () => {
  let vh: VillageHouses; const fires: { kind: string; pos: THREE.Vector3; sched?: string }[] = [];
  beforeAll(() => { vh = new VillageHouses(V, comps, T, null, { add: (kind: string, pos: THREE.Vector3, m: any) => fires.push({ kind, pos: pos.clone(), sched: m.sched }) } as any, 1); }, 300_000);
  it('the load-time gates, tiles and lamps equal the town house generator\'s reading of the raster', () => {
    for (const id of SAMPLE) { const vi = V.findIndex(v => v.id === id), hs = vh.ensure(vi), S = vh.st[vi];
      S.comps.forEach((c, ci) => { expect(S.tile[ci], `${id} c${ci} tile`).toBe(hs.plotTile[ci]); });
      const mine = vh.gates.filter(g => g.site === id), theirs = hs.doors; expect(mine.length).toBe(theirs.length);
      for (const g of theirs) { const m = mine.find(x => x.id === g.id)!; expect(m, g.id).toBeTruthy();
        for (const k of ['hinge', 'y', 'h', 'wood', 'tile', 'theta'] as const) expect(JSON.stringify(m[k]) === JSON.stringify(g[k]) || Math.abs((m[k] as number) - (g[k] as number)) < 1e-6 || (Array.isArray(m[k]) && Math.hypot((m[k] as number[])[0] - (g[k] as number[])[0], (m[k] as number[])[1] - (g[k] as number[])[1]) < 1e-6), `${g.id} ${k}`).toBe(true);
        for (const k of ['closedYaw', 'openYaw'] as const) expect(Math.abs(Math.sin(m[k] - g[k])) + Math.abs(1 - Math.cos(m[k] - g[k])), `${g.id} ${k}`).toBeLessThan(1e-6); }
      // each lamp in a room the house generator furnishes as a living room, inside that room's cells
      vh.lamps[vi].forEach((L, ci) => { if (!L) return; const s = hs.s, r = hs.rooms[hs.roomOf.get(L.room)!]; expect(hs.roomUse(r), `${id} c${ci}`).toBe('living');
        const [u, w] = toLocal(s.frame, L.at[0], L.at[1]), k = s.k(s.ci(u), s.cj(w)); expect(s.sub[k]).toBe(ROOM); expect(s.room[k]).toBe(L.room); expect(s.cell[k]).toBe(ci); }); }
    const nComp = comps.reduce((a, c) => a + c.length, 0), lamps = vh.lamps.flat().filter(Boolean).length;
    expect(fires.filter(f => f.kind === 'hearth').length).toBe(nComp); expect(fires.filter(f => f.kind === 'oven').length).toBe(0); // (Q-690)
    expect(fires.filter(f => f.kind === 'lamp').length).toBe(lamps); expect(lamps / nComp).toBeGreaterThan(0.9);
    console.log(`fires: ${nComp} hearths, ${lamps} lamps; ${JSON.stringify(vh.info)}`);
  }, 300_000);
  it('near a village its rooms are hollow and roofed as drawn: walls round, the roof overhead, no collider where a person lies; the far level stands down there', () => {
    const vi = V.findIndex(v => v.id === 'village_p22'), v = V[vi], hs = vh.ensure(vi), s = hs.s, S = vh.st[vi];
    vh.nearUpdate(v.x, -v.y, 0, true); expect(vh.nearInfo.tiles).toBeGreaterThan(4);
    const [struct] = vh.nearMeshes(); struct.updateMatrixWorld(true); expect(struct.visible).toBe(true); expect(struct.geometry.groups.length).toBeGreaterThanOrEqual(3);
    const shown = [...hs.tiles.keys()].filter(t => vh.nearTile(t)), state = VILLAGE_NEAR_STATE.image.data as Uint8Array;
    for (const t of shown) expect(state[(t + 1) * 4]).toBe(255);
    // room cells of the compounds drawn near (every 7th), at sleeping and standing height; the inner ones (all four neighbours
    // in the room: where popgeo places people, D-254) must keep a body's clearance from every collider
    const inner = (k: number) => [1, -1, s.W, -s.W].every(d => s.cell[k + d] === s.cell[k] && s.sub[k + d] === ROOM && s.room[k + d] === s.room[k]);
    const cells: number[] = []; for (let k = 0; k < s.cell.length; k += 7) { const c = s.cell[k]; if (c < 0 || c >= S.comps.length || s.sub[k] !== ROOM || !vh.nearTile(hs.plotTile[c])) continue; cells.push(k); }
    expect(cells.length).toBeGreaterThan(80);
    const ray = new THREE.Raycaster(), boxes = S.col!.boxes; let enclosed = 0, roofed = 0, n = 0;
    for (const k of cells.slice(0, 160)) { n++;
      const [e, nn] = s.cellGrid(k), y = H(e, nn), p = new THREE.Vector3(e, y + 1.0, -nn);
      // no collider box over the cell's centre from the floor to 1.7 m; none within 0.4 m of an inner cell's (a person there)
      const clear = inner(k) ? 0.4 : 0;
      for (const b of boxes) { const dx = p.x - b.x, dz = p.z - b.z, c = Math.cos(b.rot), sn = Math.sin(b.rot), lx = Math.abs(dx * c - dz * sn) - b.hx, lz = Math.abs(dx * sn + dz * c) - b.hz;
        const inY = y + 0.1 < b.y + b.hy && y + 1.7 > b.y - b.hy; expect(inY && lx < clear && lz < clear, `collider over room cell ${k} (${lx.toFixed(2)}, ${lz.toFixed(2)})`).toBe(false); }
      ray.set(p, new THREE.Vector3(0, 1, 0)); ray.far = 4; const up = ray.intersectObject(struct, false)[0]; if (up && up.distance > 0.8) roofed++;
      let hits = 0; const th = s.frame.theta;
      for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const dx = du * Math.cos(th) - dv * Math.sin(th), dn = du * Math.sin(th) + dv * Math.cos(th); ray.set(p, new THREE.Vector3(dx, 0, -dn)); ray.far = 6; const h = ray.intersectObject(struct, false)[0]; if (h && h.distance > 0.15) hits++; }
      if (hits >= 3) enclosed++; }
    console.log(`p22 near: ${vh.nearInfo.tiles} tiles, ${vh.nearInfo.tris} triangles; ${n} room cells: roofed ${roofed}, walled round (>= 3 of 4 sides within 6 m) ${enclosed}`);
    expect(roofed).toBe(n); expect(enclosed / n).toBeGreaterThan(0.95);
  }, 300_000);
  it('the bins\' colliders match their drawn size', () => { const f = { kind: 'bin', u: 0, v: 0, rot: 0, size: 1, plot: 0 } as any; const b = binBox(f); expect(b.hu).toBeCloseTo(0.32); expect(b.hy * 2).toBeCloseTo(1.1); });
});

describe('the village sleepers (T-D3 over village people; B64\'s anti-proxy)', () => {
  it('a village household asleep at 23:00 lies in a room of its own compound, in the raster the drawn village is built from, where no collider stands', () => {
    const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const env = (): Env => ({ rain: 0, lightning: false, windMs: 1, tempC: 12 });
    const sim = new PeopleSim(1, nav, env), geo = new PopGeo({ pop: sim.pop, nav, town: null, ground: H, villages: V, compounds: vi => villageCompounds(V[vi], T, 1), canals: C.map(c => c.pts), seed: 1 });
    const vh = new VillageHouses(V, comps, T, null, null, 1);
    let n = 0, inRoom = 0, own = 0; const byVillage = new Map<number, number>();
    const plain = sim.pop.households.filter(h => h.zone === 'plain');
    for (let i = 0; i < plain.length; i += 25) { const hh = plain[i], m = geo.villageOf(hh.id); if (!m) continue;
      const S = vh.st[m.vi], hs = vh.ensure(m.vi), s = hs.s; expect(geo.villageSites()[m.vi], 'one raster for the people and the drawn village').toBe(s);
      for (const pid of hh.members) { const sp = geo.spot(pid, `h:${hh.id}`, 'sleep', 100, 23, true); if (!sp.ok) continue; n++;
        const [u, w] = toLocal(s.frame, sp.e, sp.n), k = s.k(s.ci(u), s.cj(w));
        if (sp.inside && s.sub[k] === ROOM) inRoom++; if (s.cell[k] === m.ci) own++;
        const y = H(sp.e, sp.n); for (const b of S.col!.boxes) { const dx = sp.e - b.x, dz = -sp.n - b.z, c = Math.cos(b.rot), sn = Math.sin(b.rot), lx = Math.abs(dx * c - dz * sn) - b.hx, lz = Math.abs(dx * sn + dz * c) - b.hz;
          expect(y + 0.05 < b.y + b.hy && y + 0.5 > b.y - b.hy && lx < 0.3 && lz < 0.3, `sleeper ${pid} within 0.3 m of a collider`).toBe(false); }
        byVillage.set(m.vi, (byVillage.get(m.vi) ?? 0) + 1); } }
    console.log(`village sleepers sampled: ${n} in ${byVillage.size} villages; in a room ${inRoom}, in their own compound ${own}`);
    expect(n).toBeGreaterThan(100); expect(inRoom).toBe(n); expect(own).toBe(n);
    void toGrid;
  }, 600_000);
});
