// D-214 (gap audit item 31): the Terrace's drains and cisterns (terrace.r_drains, terrace.r_cisterns; all placement C). The
// drains were 'hewn out of the rock' beneath the platform (search extract, B); what is drawn is where they meet the light:
// mouths with spouts in the retaining walls, inlets and gutters on the court, well-heads over cisterns at the people's
// water points. Measured: every piece stands where its row says, on the wall or on the open court, and costs little.
import { describe, it, expect, beforeAll } from 'vitest';
import { buildTerrace } from '../src/arch/terrace';
import { waterPlan, buildWaterworks } from '../src/arch/waterworks';
import { pointInPoly, type Box, type Prism, type Column, type Pt } from '../src/arch/parts';
import { v } from '../src/arch/spec';
import { loadTerrain } from './plainLib';
import court from '../src/data/court.json';
import places from '../src/data/people_places.json';

let B: ReturnType<typeof buildTerrace>, ground: (e: number, n: number) => number;
beforeAll(() => { B = buildTerrace(); const T = loadTerrain(); ground = (e, n) => T.heightAt(e, -n); }, 120_000);
const segDist = (p: Pt, a: Pt, b: Pt) => { const ex = b[0] - a[0], ey = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / (ex * ex + ey * ey))); return Math.hypot(p[0] - a[0] - ex * t, p[1] - a[1] - ey * t); };
const polyDist = (p: Pt, poly: Pt[]) => Math.min(...poly.map((a, i) => segDist(p, a, poly[(i + 1) % poly.length])));

describe('the Terrace\'s drains (terrace.r_drains)', () => {
  it('mouths stand on the W and S retaining walls, on the wall line, their sills between the ground and the court', () => {
    const R = v<any>('terrace', 'r_drains'), plan = waterPlan(B.parts, ground), poly = (B.parts.find(p => p.building === 'terrace' && p.type === 'prism') as Prism).polygon;
    expect(plan.drains.length).toBeGreaterThanOrEqual(8);
    expect(new Set(plan.drains.map(d => d.edge))).toEqual(new Set(['W', 'S']));
    for (const d of plan.drains) {
      expect(polyDist(d.at, poly), `${d.at} on the wall line`).toBeLessThan(1e-6);
      if (d.edge === 'W') expect(d.n[0]).toBeLessThan(-0.9); else expect(d.n[1]).toBeLessThan(-0.9);
      // outward: a step out of the wall is off the Terrace, a step in is on it
      expect(pointInPoly(d.at[0] + d.n[0] * 0.5, d.at[1] + d.n[1] * 0.5, poly)).toBe(false); expect(pointInPoly(d.at[0] - d.n[0] * 0.5, d.at[1] - d.n[1] * 0.5, poly)).toBe(true);
      expect(d.sill - d.ground).toBeCloseTo(R.mouth.above_ground, 6);
      expect(d.sill + R.mouth.h).toBeLessThan(-0.5); // under the court (datum 0), on the face of the wall
      expect(d.ground).toBeCloseTo(ground(d.at[0] + d.n[0] * 1.5, d.at[1] + d.n[1] * 1.5), 6);
    }
    // on one wall stretch, mouths `spacing` apart
    const byEdge = new Map<number, typeof plan.drains>(); for (const d of plan.drains) (byEdge.get(d.edgeIndex) ?? byEdge.set(d.edgeIndex, []).get(d.edgeIndex)!).push(d);
    for (const run of byEdge.values()) for (let i = 1; i < run.length; i++) expect(Math.hypot(run[i].at[0] - run[i - 1].at[0], run[i].at[1] - run[i - 1].at[1])).toBeCloseTo(R.spacing, 3);
  });
  it('inlets and gutters lie on the open court: inside the Terrace, clear of every building part, clear of the S wall\'s inscriptions', () => {
    const R = v<any>('terrace', 'r_drains'), SW = v<any>('terrace', 'r_south_wall_inscriptions'), plan = waterPlan(B.parts, ground);
    const poly = (B.parts.find(p => p.building === 'terrace' && p.type === 'prism') as Prism).polygon;
    const clear = (p: Pt) => { let d = Infinity; for (const q of B.parts) { if (q.building === 'terrace') continue;
      if (q.type === 'box') { const b = q as Box; d = Math.min(d, Math.hypot(Math.max(0, Math.abs(p[0] - b.c[0]) - b.size[0] / 2), Math.max(0, Math.abs(p[1] - b.c[1]) - b.size[1] / 2))); }
      else if (q.type === 'prism') d = Math.min(d, pointInPoly(p[0], p[1], (q as Prism).polygon) ? 0 : polyDist(p, (q as Prism).polygon));
      else d = Math.min(d, Math.hypot(p[0] - (q as Column).c[0], p[1] - (q as Column).c[1])); } return d; };
    for (const d of plan.drains) {
      expect(Math.hypot(d.inlet[0] - d.at[0], d.inlet[1] - d.at[1])).toBeCloseTo(R.inlet.back, 6);
      for (const p of [d.inlet, ...d.channel]) { expect(pointInPoly(p[0], p[1], poly), `${p} on the Terrace`).toBe(true); expect(clear(p), `${p} clear of buildings`).toBeGreaterThanOrEqual(R.clear); }
      expect(Math.hypot(d.channel[1][0] - d.channel[0][0], d.channel[1][1] - d.channel[0][1])).toBeCloseTo(R.channel.length, 6);
    }
    // the S wall's inscription panels (centred on the southernmost S-facing edge): no mouth within 2 m of their span
    const south = poly.map((a, i) => [a, poly[(i + 1) % poly.length]] as [Pt, Pt]).filter(([a, b]) => Math.abs(b[0] - a[0]) > SW.texts.length * (SW.panel_width + SW.gap)).sort((p, q) => (p[0][1] + p[1][1]) - (q[0][1] + q[1][1]))[0];
    const mid: Pt = [(south[0][0] + south[1][0]) / 2, (south[0][1] + south[1][1]) / 2], half = (SW.texts.length * SW.panel_width + (SW.texts.length - 1) * SW.gap) / 2;
    for (const d of plan.drains) expect(Math.hypot(d.at[0] - mid[0], d.at[1] - mid[1]), `${d.at}`).toBeGreaterThanOrEqual(half + 2 - 1e-6);
    expect(plan.skipped.length).toBeGreaterThan(0); for (const s of plan.skipped) expect(s.why.length).toBeGreaterThan(5);
  });
});

describe('the cistern heads (terrace.r_cisterns)', () => {
  it('a well-head beside each of the people\'s two water points on the Terrace, leaving the spot where water is drawn free', () => {
    const C = v<any>('terrace', 'r_cisterns'), plan = waterPlan(B.parts, ground);
    const points: Record<string, Pt> = { court_cistern: (court as any).places.find((p: any) => p.id === 'court_cistern').at, water: (places as any).places.find((p: any) => p.id === 'water').at };
    expect(plan.cisterns.map(c => c.serves).sort()).toEqual(Object.keys(points).sort());
    for (const h of plan.cisterns) {
      const p = points[h.serves], d = Math.hypot(h.at[0] - p[0], h.at[1] - p[1]);
      expect(d, h.serves).toBeCloseTo(1.2, 6);
      expect(d - C.kerb.r_out, `${h.serves}: the drawing spot clear of the kerb`).toBeGreaterThan(0.4);
    }
    // each head on its floor: the court (0) or the garrison's raised floor
    expect(plan.cisterns.find(c => c.serves === 'court_cistern')!.y).toBe(0);
    expect(plan.cisterns.find(c => c.serves === 'water')!.y).toBeCloseTo(v<number>('garrison', 'r_floor_raise'), 6);
  });
});

describe('what the waterworks cost', () => {
  it('two draws (stone, the dark of the openings), few triangles; every kerb has a collider and blocks the people\'s grid', () => {
    const W = buildWaterworks(B.parts, ground);
    expect(W.group.children.map(c => c.name).sort()).toEqual(['waterworks:dark', 'waterworks:stone']);
    expect(W.tris).toBeLessThan(6000);
    expect(W.colliders.length).toBe(W.plan.cisterns.length); expect(W.navDiscs.length).toBe(W.plan.cisterns.length);
    for (const [e, n, r] of W.navDiscs) { expect(r).toBeCloseTo(v<any>('terrace', 'r_cisterns').kerb.r_out, 6); expect(W.plan.cisterns.some(c => c.at[0] === e && c.at[1] === n)).toBe(true); }
    for (const m of W.group.children as any[]) { expect(m.userData.tier).toBe('C'); expect(m.userData.note).toMatch(/D-214/); }
    // every mouth's spout projects out of the wall: its stone lies outside the Terrace outline (grid), its sill level
    const poly = (B.parts.find(p => p.building === 'terrace' && p.type === 'prism') as Prism).polygon, R = v<any>('terrace', 'r_drains');
    for (const d of W.plan.drains) { const tip: Pt = [d.at[0] + d.n[0] * R.mouth.spout * 0.9, d.at[1] + d.n[1] * R.mouth.spout * 0.9]; expect(pointInPoly(tip[0], tip[1], poly)).toBe(false); }
  });
});
