// D-276: the Terrace's room ranges (src/arch/rooms.ts, terrace_rooms.ts, built by terrace.ts): every room has walls with
// thickness, doorways at least 0.8 m wide, a roof over it, no gap in its walls, is reached by the walkable grid, and holds
// its fittings where people can use them; the people's places in them (popgeo) are under the roof, on the grid, off the
// aisles. The anti-proxy (how this could pass while the intent fails): a room whose "walls" are its neighbour's absent wall
// (an omitted side with nothing there) is caught by the enclosure test sampling just outside every side; a room drawn but
// unreachable by the grid (a doorway blocked by a bench) by the reach test; a sleeper counted as "under a roof" by the old
// footprint rule by the roofs test on the open courts and the unroofed Tripylon.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { terraceBuilt } from '../src/arch/built';
import { terraceRanges, terraceRooms, roomFit } from '../src/arch/terrace_rooms';
import { keepClear } from '../src/arch/rooms';
import { v } from '../src/arch/spec';
import type { Box } from '../src/arch/parts';
import { terraceRoofed, roofAt } from '../src/people/roofs';
import { NavGrid } from '../src/people/navgrid';

const T = terraceBuilt(), R = terraceRooms(), F = roomFit();
const solids = (T.parts.filter(p => p.type === 'box' && p.solid !== false && p.kind !== 'roof' && p.kind !== 'door_leaf') as Box[]);
function inBox(p: Box, e: number, n: number, y: number) {
  if (y < p.y0 || y > p.y1) return false; const a = -(p.rot ?? 0), dx = e - p.c[0], dy = n - p.c[1], u = dx * Math.cos(a) - dy * Math.sin(a), w = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(u) <= p.size[0] / 2 + 1e-6 && Math.abs(w) <= p.size[1] / 2 + 1e-6;
}
const solidAt = (e: number, n: number, y: number) => solids.some(p => inBox(p, e, n, y));

describe('D-276 room ranges: geometry', () => {
  it('the three buildings have their ranges, with rooms', () => {
    const B = terraceRanges().map(b => b.b); expect(B).toEqual(['treasury', 'harem', 'garrison', 'terrace']);
    const by = (b: string, use?: string) => R.filter(x => x.room.building === b && (!use || x.room.use === use)).length;
    expect(by('treasury', 'store')).toBeGreaterThanOrEqual(20); expect(by('treasury', 'hall')).toBe(2);
    // the Harem's 22 apartments (ISAC-PA: 6 in the main wing and 16 in the W wing, B)
    expect(by('harem', 'apartment')).toBe(22);
    expect(by('garrison', 'quarters')).toBeGreaterThanOrEqual(6); expect(by('garrison', 'mess')).toBe(1);
  });
  it('every wall of every range is at least the building\'s wall thickness, every doorway at least 0.8 m wide and 1.9 m high', () => {
    for (const B of terraceRanges()) for (const { R: rr, G } of B.ranges) {
      for (const w of G.walls) expect(Math.min(w.x[1] - w.x[0], w.y[1] - w.y[0]), `${B.b} ${w.id}`).toBeGreaterThanOrEqual(B.D.wall - 1e-9);
      for (const o of G.openings) expect(o.width, `${B.b} ${o.id}`).toBeGreaterThanOrEqual(0.8);
      expect(B.D.door_height).toBeGreaterThanOrEqual(1.9); expect(B.D.inner_height).toBeGreaterThanOrEqual(1.9); void rr;
    }
    // the built doorways (parts' doorway descriptors) of the ranges
    const ids = new Set(terraceRanges().flatMap(B => B.ranges.flatMap(({ G }) => G.openings.map(o => `${B.b}:${o.id}`))));
    const built = T.doorways.filter(d => ids.has(d.id)); expect(built.length).toBe(ids.size);
    for (const d of built) { expect(d.width, d.id).toBeGreaterThanOrEqual(0.8); expect(d.height, d.id).toBeGreaterThanOrEqual(1.9); }
  });
  it('every room is under a roof of its own building, at its clear height', () => {
    for (const { room } of R) for (const r of [room, ...(room.back ? [room.back] : [])]) {
      for (const [fx, fy] of [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
        const e = r.x[0] + (r.x[1] - r.x[0]) * fx, n = r.y[0] + (r.y[1] - r.y[0]) * fy;
        expect(roofAt(e, n), `${room.id} at ${e.toFixed(1)},${n.toFixed(1)}`).toBe(room.building);
      }
      const roof = (T.parts.filter(p => p.type === 'box' && p.kind === 'roof' && p.building === room.building) as Box[]).find(p => inBox({ ...p, y0: -1e9, y1: 1e9 }, (r.x[0] + r.x[1]) / 2, (r.y[0] + r.y[1]) / 2, 0))!;
      expect(roof.y0, room.id).toBeCloseTo(room.fl + room.clear, 6);
    }
  });
  it('no gap in any room\'s walls: just outside every side (except open sides and doorways) stands something solid', () => {
    const fails: string[] = [];
    for (const { room } of R) {
      const y = room.fl + Math.min(1.2, room.clear / 2), rects = [{ r: room as { x: [number, number]; y: [number, number] }, back: false }, ...(room.back ? [{ r: room.back, back: true }] : [])];
      for (const { r, back } of rects) for (const s of ['N', 'S', 'E', 'W'] as const) {
        if (!back && room.open.includes(s)) continue;
        const vert = s === 'E' || s === 'W', [q0, q1] = vert ? r.y : r.x, off = 0.3, line = s === 'N' ? r.y[1] + off : s === 'S' ? r.y[0] - off : s === 'E' ? r.x[1] + off : r.x[0] - off;
        for (let q = q0 + 0.25; q < q1 - 0.25; q += 0.5) {
          const [e, n] = vert ? [line, q] : [q, line];
          // a doorway of this room (its own, a neighbour's it is entered by, the back room's opening) leaves the side open
          const doors = [...room.doors, ...(room.backDoor ? [room.backDoor] : [])];
          if (doors.some(d => Math.abs((e - d.c[0]) * d.u[0] + (n - d.c[1]) * d.u[1]) < d.width / 2 + 0.3 && Math.abs((e - d.c[0]) * d.n[0] + (n - d.c[1]) * d.n[1]) < d.depth + off)) continue;
          if (!solidAt(e, n, y)) fails.push(`${room.id}${back ? ' back' : ''} ${s} at ${e.toFixed(1)},${n.toFixed(1)}`);
        }
      }
    }
    expect([...new Set(fails.map(f => f.split(' at ')[0]))]).toEqual([]);
  });
  it('fittings stay out of the doorways\' leaf sweeps and approaches, and the sleeping mats do not overlap', () => {
    for (const { room, fit } of R) {
      const clear = keepClear(room, F);
      const hit = (x0: number, x1: number, y0: number, y1: number) => clear.some(z => z.x[0] < x1 && z.x[1] > x0 && z.y[0] < y1 && z.y[1] > y0);
      for (const m of fit.mats) expect(hit(m.c[0] - m.size[0] / 2, m.c[0] + m.size[0] / 2, m.c[1] - m.size[1] / 2, m.c[1] + m.size[1] / 2), `${room.id} mat`).toBe(false);
      for (const j of fit.jars) expect(hit(j[0] - F.jar_r, j[0] + F.jar_r, j[1] - F.jar_r, j[1] + F.jar_r), `${room.id} jar`).toBe(false);
      for (const w of fit.work) expect(clear.some(z => w[0] > z.x[0] && w[0] < z.x[1] && w[1] > z.y[0] && w[1] < z.y[1]), `${room.id} work place`).toBe(false);
      for (let i = 0; i < fit.mats.length; i++) for (let k = i + 1; k < fit.mats.length; k++) { const a = fit.mats[i], b = fit.mats[k];
        expect(Math.abs(a.c[0] - b.c[0]) < (a.size[0] + b.size[0]) / 2 - 1e-6 && Math.abs(a.c[1] - b.c[1]) < (a.size[1] + b.size[1]) / 2 - 1e-6, `${room.id} mats ${i}/${k}`).toBe(false); }
    }
  });
  it('the quarters sleep the garrison and a watch of the royal guard; every quarters room and the kitchens have a hearth', () => {
    const q = R.filter(x => x.room.building === 'garrison' && x.room.use === 'quarters');
    expect(q.reduce((a, x) => a + x.fit.sleep.length, 0)).toBeGreaterThanOrEqual(600);
    for (const x of R.filter(x => x.room.use === 'quarters' || x.room.use === 'service')) expect(x.fit.hearths.length, x.room.id).toBeGreaterThanOrEqual(1);
    for (const x of R.filter(x => x.room.use === 'apartment')) expect(x.fit.sleep.length, x.room.id).toBeLessThanOrEqual(F.mats_apartment);
  });
  it('the store rooms\' benches carry the stored goods (manifest storeBenches) and their doors are sealed or barred', () => {
    const m = T.manifest.treasury as any; expect(m.storeBenches.length).toBeGreaterThanOrEqual(60);
    const leaves = T.parts.filter(p => p.type === 'box' && p.kind === 'door_leaf' && p.building === 'treasury' && (p as Box).door?.id.match(/_stores|court_|e_range/)) as Box[];
    expect(leaves.length).toBeGreaterThanOrEqual(40);
    for (const l of leaves) expect(['scheduled_sealed', 'scheduled_locked']).toContain(l.door!.state);
    const goods = v<{ share: number }[]>('treasury', 'stored_goods'); expect(goods.reduce((a, g) => a + g.share, 0)).toBeCloseTo(1, 6);
  });
});

describe('D-276 room ranges: reached and used', () => {
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  it('every room is reached by the walkable grid (a third of its floor at least), and every sleeping place is walkable', () => {
    for (const { room, fit } of R) {
      let n = 0, w = 0;
      for (const r of [room, ...(room.back ? [room.back] : [])]) for (let x = r.x[0] + 0.25; x < r.x[1]; x += 0.5) for (let y = r.y[0] + 0.25; y < r.y[1]; y += 0.5) { n++; if (nav.walkable(x, y)) w++; }
      expect(w / n, room.id).toBeGreaterThan(0.3);
      for (const s of fit.sleep) expect(nav.walkable(s[0], s[1]), `${room.id} mat at ${s[0].toFixed(1)},${s[1].toFixed(1)}`).toBe(true);
    }
  });
  it('roofs are the built roofs: the rooms are under them, the open courts and the unroofed Tripylon are not', () => {
    for (const { room } of R) expect(terraceRoofed((room.x[0] + room.x[1]) / 2, (room.y[0] + room.y[1]) / 2), room.id).toBe(true);
    const HC = v<any>('harem', 'court'); expect(terraceRoofed((HC.x[0] + HC.x[1]) / 2, (HC.y[0] + HC.y[1]) / 2)).toBe(false); // the Harem's N court
    const TH = v<any>('tripylon', 'hall'); expect(terraceRoofed(TH.centre[0], TH.centre[1])).toBe(false); // under construction, no roof yet
    expect(terraceRoofed(185, 20)).toBe(false); // the garrison street
    expect(roofAt(0, 0)).toBe('apadana');
  });
});
