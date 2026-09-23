// The Treasury N range and the scribes' room (D-067): walls as read on REF-PLAN, one doorway per room from the S, the
// desk inside the scribes' room and reachable on foot from the N door, the visitor zone = the room, props on the benches.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { buildTerrace } from '../src/arch/terrace';
import type { Box } from '../src/arch/parts';
import { v } from '../src/arch/spec';
import { NavGrid } from '../src/people/navgrid';
import { terraceZoneAt } from '../src/world/visitor/access';
import { buildScribesRoom } from '../src/world/furnish';
import placesJson from '../src/data/people_places.json';

const { parts, manifest } = buildTerrace();
const NR = v<any>('treasury', 'n_range'), SR = v<any>('treasury', 'scribes_room'), NH = v<any>('treasury', 'r_n_range_height');
const T = parts.filter((p): p is Box => p.building === 'treasury' && p.type === 'box');
const solidAt = (x: number, y: number, h: number) => T.some(b => b.solid && Math.abs(x - b.c[0]) <= b.size[0] / 2 && Math.abs(y - b.c[1]) <= b.size[1] / 2 && h >= b.y0 && h <= b.y1);
const fl = (manifest.treasury as any).room[4];
const desk = (placesJson as any).places.find((p: any) => p.id === 'treasury_desk').at as [number, number];

describe('Treasury N range (REF-PLAN)', () => {
  it('the inner wall stands between the doorways, open at each doorway below its lintel', () => {
    const yc = (NR.inner_wall[0] + NR.inner_wall[1]) / 2;
    for (const [d0, d1] of NR.hall_doors) {
      expect(solidAt((d0 + d1) / 2, yc, fl + 1), `door ${d0}`).toBe(false);
      expect(solidAt((d0 + d1) / 2, yc, fl + NH.door_height + 0.5), `lintel ${d0}`).toBe(true);
      expect(solidAt(d0 - 0.5, yc, fl + 1)).toBe(true); expect(solidAt(d1 + 0.5, yc, fl + 1)).toBe(true);
    }
  });
  it('rooms are closed by cross walls and roofed; each room has its doorway', () => {
    for (const [c0, c1] of NR.cross_walls) expect(solidAt((c0 + c1) / 2, -82.5, fl + 1)).toBe(true);
    const roof = T.find(b => b.kind === 'roof' && b.c[1] > -87)!;
    expect(roof.y0).toBeCloseTo(fl + NH.clear, 6);
    NR.rooms.forEach(([r0, r1]: number[], i: number) => expect(NR.hall_doors.some(([d0, d1]: number[]) => d0 >= r0 && d1 <= r1), `room ${i}`).toBe(true));
  });
  it('the scribes\' room holds the desk, and the visitor zone is that room only', () => {
    const [r0, r1] = NR.rooms[SR.room];
    expect(desk).toEqual(SR.desk);
    expect(desk[0] > r0 && desk[0] < r1 && desk[1] < NR.inner_face_n && desk[1] > NR.inner_wall[1]).toBe(true);
    expect(terraceZoneAt(desk[0], desk[1])).toBe('treasury_desk');
    expect(terraceZoneAt(desk[0], NR.inner_face_n + 3)).toBe('treasury_street'); // the street N of the wall stays the street
    expect(terraceZoneAt(r1 + 3, -82.5)).not.toBe('treasury_desk'); // the vestibule is not the scribes' room
  });
  it('the desk is reachable on foot from the N door, through the vestibule and the room\'s S doorway', () => {
    const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const path = nav.findPath([206.6, -74], desk);
    expect(path, 'street → desk').not.toBeNull();
    const [d0, d1] = NR.hall_doors[SR.room];
    // where the route crosses the inner wall's mid-line, it is inside the room's doorway, clear of the jambs by the body radius
    const yc = (NR.inner_wall[0] + NR.inner_wall[1]) / 2, xs: number[] = [];
    for (let i = 1; i < path!.length; i++) { const [a, b] = [path![i - 1], path![i]]; if ((a[1] - yc) * (b[1] - yc) < 0) xs.push(a[0] + (b[0] - a[0]) * (yc - a[1]) / (b[1] - a[1])); }
    expect(xs.some(x => x > d0 + 0.25 && x < d1 - 0.25), `crossings ${xs.map(x => x.toFixed(2))} vs doorway ${d0}–${d1}`).toBe(true);
  });
  it('the room is furnished: filed tablets on the benches, fresh tablets, clay, baskets (tier C)', () => {
    const g = buildScribesRoom((manifest.treasury as any).scribesRoom, (manifest.treasury as any).scribesShelves);
    const filed = g.getObjectByName('scribes:tablets_filed') as any;
    expect(filed.count).toBeGreaterThan(200);
    for (const n of ['scribes:tablets_fresh', 'scribes:clay', 'scribes:baskets', 'scribes:drying_board']) expect(g.getObjectByName(n), n).toBeTruthy();
    g.traverse(o => { if ((o as any).isMesh) expect(o.userData.tier).toBe('C'); });
  });
});
