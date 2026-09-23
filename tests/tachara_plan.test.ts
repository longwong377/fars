// The Tachara against REF-PLAN (D-130): the built walls, doorways, windows, niches, columns and rooms measured against the
// SITE_SPEC plan rows (plan_walls, plan_openings, plan_columns, plan_rooms, read on the registered plan), and the
// lance-bearers standing on the jambs of the W-room doorways. The plan itself is checked against the built model by
// tools/dev/tachara_overlay.py (IoU of the wall masks).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildTerrace } from '../src/arch/terrace';
import { v } from '../src/arch/spec';
import type { Box, Column, Doorway } from '../src/arch/parts';
import { phase4Programmes } from '../src/arch/relief_programmes';
import { kindBounds, baseKind } from '../src/arch/relief_figures';
import { alongX, type PlanWall, type PlanOpening } from '../src/arch/plan_walls';
import { NavGrid } from '../src/people/navgrid';

const { parts, manifest, doorways } = buildTerrace();
const T = parts.filter(p => p.building === 'tachara');
const fl = v<number>('tachara', 'floor');
const PW = v<PlanWall[]>('tachara', 'plan_walls'), PO = v<PlanOpening[]>('tachara', 'plan_openings');
const RM = v<{ id: string; x: [number, number]; y: [number, number] }[]>('tachara', 'plan_rooms'), PC = v<any>('tachara', 'plan_columns');
const RD = v<Record<string, { height: number }>>('tachara', 'r_doors'), WI = v<any>('global', 'r_window'), NI = v<any>('global', 'r_niche'), F = v<any>('global', 'r_door_frame');
const solid = T.filter(p => p.type === 'box' && p.solid !== false && p.kind !== 'roof' && p.kind !== 'door_leaf') as Box[];
const E = 1e-6;
const inBox = (q: Box, x: number, y: number, h: number) => !q.rot && Math.abs(x - q.c[0]) <= q.size[0] / 2 + E && Math.abs(y - q.c[1]) <= q.size[1] / 2 + E && h >= q.y0 - E && h < q.y1 - E;
const filled = (x: number, y: number, h: number) => solid.some(q => inBox(q, x, y, h));
const wallOf = (id: string) => PW.find(w => w.id === id)!;
/** along / across coordinates of a point in a wall's frame (along = x or y, across = the other) */
const axes = (w: PlanWall) => alongX(w) ? { along: w.x, across: w.y, pt: (a: number, c: number) => [a, c] as [number, number] } : { along: w.y, across: w.x, pt: (a: number, c: number) => [c, a] as [number, number] };
const built = PO.filter(o => o.present_467 !== false);
const room = (x: number, y: number) => RM.find(r => x > r.x[0] && x < r.x[1] && y > r.y[0] && y < r.y[1])?.id;

describe('Tachara walls from REF-PLAN (D-130)', () => {
  it('every plan wall is built between its measured faces; at 0.5 m and 2 m above the floor it is solid except in its openings', () => {
    let samples = 0;
    for (const w of PW) {
      const A = axes(w), mine = built.filter(o => o.wall === w.id);
      for (const hAbove of [0.5, 2]) {
        const h = fl + hAbove;
        for (let a = A.along[0] + 0.05; a < A.along[1]; a += 0.1) for (let c = A.across[0] + 0.03; c < A.across[1]; c += 0.1) {
          // expected empty: a doorway's clear passage; a window between sill and head; a niche's recess on its face
          const open = mine.some(o => {
            if (Math.abs(a - o.at) >= o.width / 2 - E) return false;
            const head = fl + RD[o.h].height;
            if (o.kind === 'door' || o.kind === 'gap') return h < head;
            if (h < fl + WI.sill || h >= head) return false;
            if (o.kind === 'window') return true;
            const faceHi = o.side === 'N' || o.side === 'E'; // the niche's face is the wall's high-coordinate side
            return faceHi ? c > A.across[1] - NI.depth : c < A.across[0] + NI.depth;
          });
          const [x, y] = A.pt(a, c);
          expect(filled(x, y, h), `${w.id} at (${x.toFixed(2)}, ${y.toFixed(2)}) +${hAbove} m: ${open ? 'open' : 'wall'} on the plan`).toBe(!open);
          samples++;
        }
      }
    }
    expect(samples).toBeGreaterThan(10000);
  });
  it('the walls reach the column tops plus the wall zone, under one roof over the whole building', () => {
    const top = fl + (manifest.tachara.room as number[])[5] + v('tachara', 'r_wall_above_columns');
    const walls = T.filter(p => p.kind === 'wall') as Box[];
    expect(Math.max(...walls.map(w => w.y1))).toBeCloseTo(top, 9);
    for (const w of PW) { const A = axes(w); for (let a = A.along[0] + 0.05; a < A.along[1]; a += 0.25) expect(filled(...A.pt(a, (A.across[0] + A.across[1]) / 2), top - 0.05), `${w.id} at the top`).toBe(true); }
    const roofs = T.filter(p => p.kind === 'roof') as Box[]; expect(roofs.length).toBe(1);
    for (const r of RM) for (const [x, y] of [[r.x[0], r.y[0]], [r.x[1], r.y[1]]]) expect(Math.abs(x - roofs[0].c[0]) <= roofs[0].size[0] / 2 + E && Math.abs(y - roofs[0].c[1]) <= roofs[0].size[1] / 2 + E, r.id).toBe(true);
  });
});

describe('Tachara doorways, windows and niches from REF-PLAN (D-130)', () => {
  it('every doorway and plain opening of the plan has a descriptor at its measured centre and width; doors are stone-framed and hung', () => {
    for (const o of built.filter(q => q.kind === 'door' || q.kind === 'gap')) {
      const d = doorways.find(q => q.id === `tachara:${o.id}`)!, w = wallOf(o.wall), A = axes(w); expect(d, o.id).toBeDefined();
      const [x, y] = A.pt(o.at, (A.across[0] + A.across[1]) / 2);
      expect(Math.hypot(d.c[0] - x, d.c[1] - y), `${o.id} centre`).toBeLessThan(E); expect(d.width).toBeCloseTo(o.width, 9);
      expect(d.height).toBeCloseTo(RD[o.h].height, 9); expect(d.depth).toBeCloseTo(A.across[1] - A.across[0], 9);
      expect(d.framed, o.id).toBe(o.kind === 'door');
      const leaves = T.filter(p => p.type === 'box' && p.door?.id === d.id);
      expect(leaves.length, `${o.id} leaves`).toBe(o.kind === 'door' ? 2 : 0);
      if (o.kind === 'door') for (const s of [-1, 1]) { // a jamb lines each side of the opening, through the wall and its projection
        const [jx, jy] = A.pt(o.at + s * (o.width / 2 + F.jamb / 2), (A.across[0] + A.across[1]) / 2);
        expect(solid.some(q => q.kind === 'door_frame' && inBox(q, jx, jy, fl + 1)), `${o.id} jamb ${s}`).toBe(true);
      }
    }
    expect(manifest.tachara.doorways).toBe(8); // S main, N ×2, W ×2, E, portico ×2
  });
  it('Artaxerxes III\'s outer W doorway (present_467 = false) is not built: the W wall stands whole there', () => {
    const o = PO.find(q => q.id === 'A3_W')!; expect(o.present_467).toBe(false); expect(doorways.some(d => d.id === 'tachara:A3_W')).toBe(false);
    const w = wallOf(o.wall), A = axes(w);
    for (let h = fl + 0.1; h < fl + 9; h += 0.5) expect(filled(...A.pt(o.at, (A.across[0] + A.across[1]) / 2), h), `+${(h - fl).toFixed(1)}`).toBe(true);
  });
  it('four windows through the hall S wall (the model had two), ten blind niches, all on the aisles between the columns', () => {
    expect(manifest.tachara.windows).toBe(4); expect(manifest.tachara.niches).toBe(10);
    const cx = PC.hall.x as number[], cy = PC.hall.y as number[];
    for (const o of built.filter(q => q.kind === 'window' || q.kind === 'niche')) {
      const w = wallOf(o.wall), A = axes(w), mid = (A.across[0] + A.across[1]) / 2, h = fl + WI.sill + 1;
      if (o.kind === 'window') expect(filled(...A.pt(o.at, mid), h), `${o.id} through`).toBe(false);
      else { const back = o.side === 'N' || o.side === 'E' ? A.across[0] + 0.05 : A.across[1] - 0.05; expect(filled(...A.pt(o.at, back), h), `${o.id} blind`).toBe(true); }
      if (w.id === 'S_line' || w.id === 'N_line') expect(cx.every(x => Math.abs(x - o.at) > o.width / 2), `${o.id} between the columns`).toBe(true);
      if (w.id === 'hall_W' || w.id === 'hall_E') expect(cy.every(y => Math.abs(y - o.at) > o.width / 2), `${o.id} between the rows`).toBe(true);
    }
  });
});

describe('Tachara columns and rooms from REF-PLAN (D-130)', () => {
  const cols = T.filter(p => p.type === 'column') as Column[];
  it('12 hall columns 4 across × 3 deep, 8 in the portico, 4 in each N room, at the measured centres, all of the hall\'s order', () => {
    expect(manifest.tachara.hallColumns).toBe(12); expect(manifest.tachara.porticoColumns).toBe(8); expect(manifest.tachara.nRoomColumns).toBe(8); expect(cols.length).toBe(28);
    const want: [number, number][] = [];
    for (const [xs, ys] of [[PC.hall.x, PC.hall.y], [PC.portico.x, PC.portico.y], [(PC.n_rooms.x as number[][]).flat(), PC.n_rooms.y]] as [number[], number[]][]) for (const y of ys) for (const x of xs) want.push([x, y]);
    for (const [x, y] of want) expect(cols.filter(c => Math.hypot(c.c[0] - x, c.c[1] - y) < E).length, `column at (${x}, ${y})`).toBe(1);
    const hall = cols.filter(c => room(c.c[0], c.c[1]) === 'hall');
    expect(new Set(hall.map(c => c.c[0])).size).toBe(4); expect(new Set(hall.map(c => c.c[1])).size).toBe(3);
    expect(new Set(cols.map(c => `${c.order.id}:${c.order.height}`)).size).toBe(1);
    for (const c of cols) { expect(c.y0).toBe(fl); expect(filled(c.c[0], c.c[1], fl + 1), 'no column in a wall').toBe(false); }
    expect(cols.filter(c => room(c.c[0], c.c[1]) === 'NW_room').length).toBe(4); expect(cols.filter(c => room(c.c[0], c.c[1]) === 'NE_room').length).toBe(4);
  });
  it('every room has a red plaster floor; the doorways join all rooms to the portico as the plan does', () => {
    for (const r of RM) expect(T.some(p => p.kind === 'floor_finish' && p.type === 'box' && Math.abs(p.c[0] - (r.x[0] + r.x[1]) / 2) < E && Math.abs(p.c[1] - (r.y[0] + r.y[1]) / 2) < E), r.id).toBe(true);
    const edges = new Set<string>(), step = (d: Doorway, s: number) => room(d.c[0] + d.n[0] * s * (d.depth / 2 + 0.3), d.c[1] + d.n[1] * s * (d.depth / 2 + 0.3));
    for (const d of doorways.filter(q => q.building === 'tachara')) { const a = step(d, 1), b = step(d, -1); expect(a && b, d.id).toBeTruthy(); if (a !== b) edges.add([a, b].sort().join('–')); }
    expect([...edges].sort()).toEqual(['E1–NE_room', 'E2–E3', 'E2–hall', 'NE_room–NE_side', 'NE_room–corridor', 'NE_room–hall', 'NW_room–NW_side', 'NW_room–hall', 'SE–portico', 'SW–portico',
      'W1–hall', 'W2–W3', 'W2–hall', 'hall–portico'].sort());
    const seen = new Set(['portico']); let grew = true;
    while (grew) { grew = false; for (const e of edges) { const [a, b] = e.split('–'); if (seen.has(a) !== seen.has(b)) { seen.add(a); seen.add(b); grew = true; } } }
    expect(seen.size).toBe(RM.length);
  });
});

describe('Tachara jamb programmes (D-130)', () => {
  const set = phase4Programmes(doorways).find(p => p.name === 'relief:tachara-jambs')!;
  const at = (door: string) => set.items.filter(i => String((i.meta as any).where).startsWith(`tachara:${door} `));
  it('lance-bearers with wicker shields stand on the jambs of the W-room doorways, one per reveal, walking out of the W rooms', () => {
    const lance = set.items.filter(i => i.kind === 'lance_bearer');
    expect(lance.length).toBe(6);
    for (const door of ['W_N', 'W_S', 'P_W']) {
      const its = at(door); expect(its.map(i => i.kind), door).toEqual(['lance_bearer', 'lance_bearer']);
      const d = doorways.find(q => q.id === `tachara:${door}`)!;
      expect(['W1', 'W2', 'SW'], `${door} leads into a W room`).toContain(room(d.c[0] - d.n[0] * (d.depth / 2 + 0.3), d.c[1] - d.n[1] * (d.depth / 2 + 0.3)));
      const sides = new Set<number>();
      for (const it of its) {
        const e = it.o.x, n = -it.o.z, along = (e - d.c[0]) * d.u[0] + (n - d.c[1]) * d.u[1], across = (e - d.c[0]) * d.n[0] + (n - d.c[1]) * d.n[1];
        expect(Math.abs(Math.abs(along) - d.width / 2), `${door} on a reveal`).toBeLessThan(E); sides.add(Math.sign(along));
        const zg = [it.Z.x, -it.Z.z], xg = [it.X.x, -it.X.z], b = kindBounds(baseKind(it.kind), it.seed), sx = it.mirror ? -1 : 1, xn = xg[0] * d.n[0] + xg[1] * d.n[1];
        expect(zg[0] * -Math.sign(along) * d.u[0] + zg[1] * -Math.sign(along) * d.u[1], 'faces the opening').toBeCloseTo(1, 6);
        for (const x of [b[0], b[2]]) expect(Math.abs(across + sx * x * it.S * xn), 'within the jamb depth').toBeLessThanOrEqual(d.depth / 2 + d.proj + E);
        expect(it.o.y + b[1] * it.S).toBeGreaterThanOrEqual(d.y0 - E); expect(it.o.y + b[3] * it.S).toBeLessThanOrEqual(d.y0 + d.height + E);
        expect(sx * xn, 'walks into the hall / portico').toBeGreaterThan(0);
        expect(it.S).toBeCloseTo(v<any>('global', 'r_jamb_relief').figure_of_door * d.height, 6);
      }
      expect(sides.size, `${door}: both reveals`).toBe(2);
    }
  });
  it('the other attested motifs stay on the doorways the plan has: king (S), hero (N W), attendants (N E and the E room); the portico E door plain', () => {
    expect(at('S_main').map(i => i.kind)).toEqual(['king_attendants', 'king_attendants']);
    expect(at('N_W').map(i => [i.kind, i.seed])).toEqual([['hero', 0], ['hero', 2]]);
    for (const door of ['N_E', 'E_S']) expect(at(door).length > 0 && at(door).every(i => i.kind === 'attendant'), door).toBe(true);
    expect(at('P_E')).toEqual([]);
  });
});

describe('Tachara rooms on the walkable grid (D-130)', () => {
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  it('the hall, portico, W1, W2, E2 and the two N rooms (doorways ≥ 1.1 m, D-067) are walkable and reached from the S court', () => {
    for (const id of ['hall', 'portico', 'W1', 'W2', 'E2', 'NW_room', 'NE_room']) {
      const r = RM.find(q => q.id === id)!, c: [number, number] = [(r.x[0] + r.x[1]) / 2, (r.y[0] + r.y[1]) / 2];
      const s = nav.snap(c[0], c[1], 1.5); expect(s, `${id} walkable`).not.toBeNull();
      expect(nav.heightAt(s![0], s![1]), `${id} floor`).toBeCloseTo(fl, 1);
      expect(nav.findPath([-21, -107], s!), `S court → ${id}`).not.toBeNull();
    }
  });
});
