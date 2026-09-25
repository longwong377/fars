// The palaces' furnishings (D-212; gap audit item 8): what is drawn in each state, that every standing piece stands clear of
// the column bases, the doorways, the court's places and the other pieces, that the hangings hang on plain wall, that the
// people's routes into every hall and side room survive the pieces, and that the colliders follow the court's presence.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import type { Box, Column } from '../src/arch/parts';
import { v } from '../src/arch/spec';
import { NavGrid } from '../src/people/navgrid';
import { Physics } from '../src/player/physics';
import { palaceFurnishingPlan, PalaceFurnishings, type FurnItem } from '../src/world/furnish_palaces';
import courtJson from '../src/data/court.json';
import sources from '../src/data/sources.json';

const { parts, manifest, doorways } = buildTerrace();
const plan = palaceFurnishingPlan(parts, manifest, doorways);
const R = v<any>('global', 'r_palace_furnishings');
type Rect = [number, number, number, number];
const rect = (it: FurnItem): Rect => { const c = Math.abs(Math.cos(it.theta)), s = Math.abs(Math.sin(it.theta)), ex = c * it.hu + s * it.hv, ey = s * it.hu + c * it.hv; return [it.e - ex, it.n - ey, it.e + ex, it.n + ey]; };
const hit = (a: Rect, b: Rect) => a[0] < b[2] - 1e-6 && a[2] > b[0] + 1e-6 && a[1] < b[3] - 1e-6 && a[3] > b[1] + 1e-6;
const cols = parts.filter((p): p is Column => p.type === 'column');
const colRect = (c: Column, pad = 0): Rect => { const h = c.order.baseW / 2 + pad; return [c.c[0] - h, c.c[1] - h, c.c[0] + h, c.c[1] + h]; };
const place = (id: string) => (courtJson as any).places.find((p: any) => p.id === id).at as [number, number];

describe('palace furnishings: the plan (all C)', () => {
  it('the court away: only stored pieces are drawn; the Apadana stands empty; the Tachara keeps its steward\'s corner', () => {
    const pf = new PalaceFurnishings(parts, manifest, doorways, { court: false });
    expect(pf.plan.every(it => it.state === 'stored')).toBe(true);
    expect(pf.plan.some(it => it.building === 'apadana')).toBe(false);
    const hall = pf.plan.filter(it => it.building === 'tachara' && it.room === 'hall').map(it => it.kind).sort();
    expect(hall).toEqual(['jar', 'lamp_stand', 'mat', 'stool']);
    for (const k of ['carpet_rolls', 'couch_covered', 'hanging_rolls', 'chest', 'jar', 'stool_stack']) expect(pf.plan.some(it => it.kind === k), k).toBe(true);
    expect(pf.plan.some(it => it.kind === 'couch' || it.kind === 'carpet' || it.kind === 'hanging' || it.kind === 'canopy')).toBe(false); // nothing laid out
    console.log(pf.summary());
  });
  it('the court in residence: the four palaces laid out; the canopy and the two incense burners at the throne', () => {
    const use = plan.filter(it => it.state === 'use');
    for (const b of ['apadana', 'tachara', 'hadish', 'harem']) for (const k of b === 'apadana' ? ['carpet', 'canopy', 'incense_burner', 'hanging'] : ['carpet', 'couch', 'footstool', 'table', 'lamp_stand'])
      expect(use.some(it => it.building === b && it.kind === k), `${b} ${k}`).toBe(true);
    const th = place('court_throne'), can = use.find(it => it.kind === 'canopy')!;
    expect(Math.hypot(can.e - th[0], can.n - th[1])).toBeLessThan(1); // over the throne's place
    const burners = use.filter(it => it.building === 'apadana' && it.kind === 'incense_burner');
    expect(burners.length).toBe(2);
    for (const b of burners) { expect(b.n).toBeGreaterThan(th[1]); expect(Math.abs(b.e - th[0])).toBeLessThan(1); } // before the king (N of the throne), as on the reliefs
  });
  it('every piece carries its tier C, a note, and sources that exist', () => {
    const row = v<any>('global', 'r_palace_furnishings'); void row;
    const srcRow = (manifest as any) && (JSON.parse(readFileSync('src/data/site_spec.json', 'utf8')).global.r_palace_furnishings);
    expect(srcRow.tier).toBe('C');
    for (const k of srcRow.src.split(';')) expect(Object.keys(sources), k).toContain(k);
    for (const it of plan) expect(it.note.length, it.kind).toBeGreaterThan(10);
  });
  it('standing pieces: inside their room, clear of the column bases, the doorways\' passages and one another', () => {
    for (const st of ['stored', 'use'] as const) {
      const solid = plan.filter(it => it.state === st && it.solid);
      for (const it of solid) {
        const r = rect(it);
        for (const c of cols.filter(c => c.building === it.building)) expect(hit(r, colRect(c)), `${it.building} ${it.room} ${it.kind} on a column base`).toBe(false);
        for (const d of doorways.filter(d => d.building === it.building)) { // the passage: the doorway's width, 1 m either side of the wall
          const ux = d.u[0], uy = d.u[1], hu = d.width / 2, hn = d.depth / 2 + 1.0, ex = Math.abs(ux) * hu + Math.abs(uy) * hn, ey = Math.abs(uy) * hu + Math.abs(ux) * hn;
          expect(hit(r, [d.c[0] - ex, d.c[1] - ey, d.c[0] + ex, d.c[1] + ey]), `${it.building} ${it.room} ${it.kind} in doorway ${d.id}`).toBe(false);
        }
      }
      for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) if (solid[i].building === solid[j].building)
        expect(hit(rect(solid[i]), rect(solid[j])), `${solid[i].kind} × ${solid[j].kind} in ${solid[i].building} ${solid[i].room}`).toBe(false);
    }
  });
  it('carpets lie clear of the column bases and of one another; the stored pieces stay in the Tachara\'s side rooms or along the hall walls', () => {
    for (const st of ['stored', 'use'] as const) {
      const cps = plan.filter(it => it.state === st && it.kind === 'carpet');
      for (const c of cps) for (const k of cols.filter(k => k.building === c.building)) expect(hit(rect(c), colRect(k)), `${c.building} carpet on a column base`).toBe(false);
      for (let i = 0; i < cps.length; i++) for (let j = i + 1; j < cps.length; j++) if (cps[i].building === cps[j].building) expect(hit(rect(cps[i]), rect(cps[j]))).toBe(false);
    }
    const PR = v<any[]>('tachara', 'plan_rooms');
    for (const it of plan.filter(q => q.building === 'tachara' && q.solid)) { const r = PR.find(q => q.id === it.room)!, f = rect(it);
      expect(f[0] >= r.x[0] - 1e-6 && f[2] <= r.x[1] + 1e-6 && f[1] >= r.y[0] - 1e-6 && f[3] <= r.y[1] + 1e-6, `${it.kind} inside ${it.room}`).toBe(true); }
  });
  it('the court\'s people keep their places: 0.5 m round every throne post and the audience front; the Hadish musicians\' floor is free', () => {
    const use = plan.filter(it => it.state === 'use' && it.building === 'apadana');
    const CN = R.canopy, can = use.find(it => it.kind === 'canopy')!, posts = [-1, 1].flatMap(sx => [-1, 1].map(sz => [can.e + sx * CN.w / 2, can.n + sz * CN.d / 2]));
    for (const id of ['court_throne', 'court_throne_whisk', 'court_throne_parasol', 'court_throne_g0', 'court_throne_g1', 'court_throne_g2', 'court_throne_g3', 'court_audience_front']) {
      const p = place(id);
      for (const q of posts) expect(Math.hypot(q[0] - p[0], q[1] - p[1]), `${id} to a canopy post`).toBeGreaterThan(0.8);
      for (const it of use.filter(q => q.solid)) { const r = rect(it); expect(hit(r, [p[0] - 0.3, p[1] - 0.3, p[0] + 0.3, p[1] + 0.3]), `${id} × ${it.kind}`).toBe(false); }
    }
    const [cx, cy] = (manifest.hadish as any).room as number[];
    for (const it of plan.filter(q => q.building === 'hadish' && q.solid)) expect(hit(rect(it), [cx - 3.5, cy + 2.5, cx + 3.5, cy + 7.5]), `${it.kind} on the musicians' floor`).toBe(false);
  });
  it('hangings hang on plain wall: under the ceiling, on the room\'s face, clear of every door, window and niche', () => {
    const frames = parts.filter((p): p is Box => p.type === 'box' && /^(door|window|niche)_frame$/.test(p.kind));
    const H = R.hanging, hs = plan.filter(it => it.kind === 'hanging');
    expect(hs.length).toBeGreaterThan(20);
    for (const it of hs) {
      const room = (manifest as any)[it.building].room as number[], ceiling = room[4] + room[5];
      expect(it.y + it.h, `${it.building} hanging top`).toBeLessThanOrEqual(ceiling - 0.3 + 1e-6);
      const ux = Math.cos(it.theta), uy = Math.sin(it.theta), a0: [number, number] = [it.e - ux * H.w / 2, it.n - uy * H.w / 2], a1: [number, number] = [it.e + ux * H.w / 2, it.n + uy * H.w / 2];
      const along = (x: number, y: number) => (x - it.e) * ux + (y - it.n) * uy, across = (x: number, y: number) => Math.abs((x - it.e) * -uy + (y - it.n) * ux);
      void a0; void a1;
      for (const f of frames.filter(f => f.building === it.building)) {
        const vert = Math.abs(uy) > 0.5, [sx, sy] = f.rot && Math.abs(Math.sin(f.rot)) > 0.7 ? [f.size[1], f.size[0]] : f.size, al = vert ? sy : sx, ac = vert ? sx : sy;
        const onFace = across(f.c[0], f.c[1]) - ac / 2 < 0.3, overlaps = Math.abs(along(f.c[0], f.c[1])) < H.w / 2 + al / 2 && f.y1 > it.y + it.h - H.h && f.y0 < it.y + it.h;
        expect(onFace && overlaps, `${it.building} hanging at ${it.e.toFixed(1)},${it.n.toFixed(1)} covers ${f.kind} at ${f.c.join(',')}`).toBe(false);
      }
      for (const d of doorways.filter(d => d.building === it.building)) expect(across(d.c[0], d.c[1]) - d.depth / 2 < 0.3 && Math.abs(along(d.c[0], d.c[1])) < H.w / 2 + d.width / 2, `hanging over doorway ${d.id}`).toBe(false);
    }
  });
});

describe('palace furnishings: routes and colliders', () => {
  const load = () => new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  for (const court of [false, true]) it(`every hall and Tachara side room stays reachable on foot with the pieces blocking the grid (court setting ${court ? 'on' : 'off'})`, () => {
    const nav = load(), base = load(), pf = new PalaceFurnishings(parts, manifest, doorways, { court });
    for (const [e, n, r] of pf.navDiscs()) nav.blockDisc(e, n, r);
    const from: [number, number] = [0, 45]; // the court before the Apadana N portico
    const target = (x: number, y: number) => nav.snap(x, y, 2.5);
    // a room the bare grid already cannot reach stays out of the test (the Tachara SW room: its 0.95 m doorway P_W is sealed
    // by the grid's body clearance before any furnishing, noted in D-212)
    const reachable = (x: number, y: number) => { const g = base.snap(x, y, 2.5); return !!g && !!base.findPath(from, g); };
    const goals: [string, number, number][] = [];
    for (const b of ['apadana', 'hadish', 'harem', 'tachara']) { const r = (manifest as any)[b].room as number[]; goals.push([`${b} hall`, r[0], r[1]]); }
    for (const r of v<any[]>('tachara', 'plan_rooms').filter(q => ['W1', 'W2', 'E2', 'NW_room', 'NE_room', 'SW', 'SE'].includes(q.id))) goals.push([`tachara ${r.id}`, (r.x[0] + r.x[1]) / 2, (r.y[0] + r.y[1]) / 2]);
    if (court) for (const id of ['court_throne', 'court_throne_parasol', 'court_throne_whisk', 'court_throne_g0', 'court_throne_g2', 'court_audience_front']) { const p = place(id); goals.push([id, p[0], p[1]]); }
    const skipped = goals.filter(([, x, y]) => !reachable(x, y)).map(q => q[0]); expect(skipped).toEqual(['tachara SW']);
    for (const [what, x, y] of goals) { if (skipped.includes(what)) continue; const g = target(x, y); expect(g, `${what}: a walkable cell near`).not.toBeNull(); if (court && what.startsWith('court_')) expect(Math.hypot(g![0] - x, g![1] - y), what).toBeLessThan(0.75);
      expect(nav.findPath(from, g!), `route to ${what}`).not.toBeNull(); }
  }, 120_000);
  it('the colliders follow the court: stored pieces while it is away, the laid-out pieces while it is here', async () => {
    const phys = await Physics.create(), count = () => { let n = 0; phys.world.forEachCollider(() => { n++; }); return n; };
    const n0 = count(), pf = new PalaceFurnishings(parts, manifest, doorways, { court: true, phys });
    expect(count() - n0).toBe(pf.info.colliders.stored);
    const cam = new THREE.Vector3(22, 8, 159.5);
    pf.update(cam, true); expect(pf.current).toBe('use'); expect(count() - n0).toBe(pf.info.colliders.use);
    expect(pf.group.getObjectByName('palace-furnishings:hadish:use')!.visible).toBe(true); expect(pf.group.getObjectByName('palace-furnishings:hadish:stored')!.visible).toBe(false);
    pf.update(cam, false); expect(pf.current).toBe('stored'); expect(count() - n0).toBe(pf.info.colliders.stored);
    pf.update(new THREE.Vector3(1000, 0, 0), false); expect(pf.group.getObjectByName('palace-furnishings:hadish:stored')!.visible).toBe(false); // far: not drawn
    // the default world never lays anything out
    const pd = new PalaceFurnishings(parts, manifest, doorways, { court: false }); pd.update(cam, true); expect(pd.current).toBe('stored');
    console.log(`colliders: stored ${pf.info.colliders.stored}, use ${pf.info.colliders.use}; tris stored ${pf.info.tris.stored}, use ${pf.info.tris.use}; meshes stored ${pf.info.meshes.stored}, use ${pf.info.meshes.use}`);
  });
});
