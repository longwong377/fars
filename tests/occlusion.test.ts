// Audio occlusion (brief §11; D-178; Q-304): a wall between a sound and the listener attenuates it and takes its highs;
// an open doorway lets it through, not fully when the listener is off its axis; a closed door leaf costs a timber leaf's
// loss; the terrace edge shadows the plain. Measured on a synthetic wall and on the built Terrace (buildTerrace).
import { describe, it, expect } from 'vitest';
import { OcclusionField, maekawa, diffractionCutoff, TRANSMISSION_DB, LEAF_DB, OPEN_HZ, type P3 } from '../src/audio/occlusion';
import { buildTerrace } from '../src/arch/terrace';
import type { Part, Doorway } from '../src/arch/parts';

const base = { building: 'test', material: 'mudbrick' as const, tier: 'C' as const, src: 'TEST' };
/** a 40 m wall along grid north = 0, 2 m thick, 10 m high, with a 3 m doorway (2.5 m high, lintel above) at e = 0 */
function wallWithDoor(): { parts: Part[]; doorways: Doorway[] } {
  const parts: Part[] = [
    { ...base, type: 'box', kind: 'wall', c: [-11.5, 0], size: [20, 2], y0: 0, y1: 10 },
    { ...base, type: 'box', kind: 'wall', c: [11.5, 0], size: [20, 2], y0: 0, y1: 10 },
    { ...base, type: 'box', kind: 'wall', c: [0, 0], size: [3, 2], y0: 2.5, y1: 10 }, // lintel zone
  ];
  const doorways: Doorway[] = [{ id: 'test:D', building: 'test', door: 'D', side: 'N', at: 0, c: [0, 0], u: [1, 0], n: [0, 1], width: 3, height: 2.5, y0: 0, depth: 2, proj: 0, jamb: 0, framed: false }];
  return { parts, doorways };
}
const P = (e: number, n: number, y = 1.6): P3 => ({ e, n, y });

describe('occlusion: the physics pieces', () => {
  it("Maekawa: 0 dB with no detour, ~5 dB at grazing, rising with the detour, capped at 25 dB", () => {
    expect(maekawa(0)).toBe(0); expect(maekawa(1e-6)).toBeCloseTo(4.77, 1);
    expect(maekawa(1)).toBeGreaterThan(maekawa(0.2)); expect(maekawa(1)).toBeCloseTo(10 * Math.log10(3 + 20 * (2 * 500 / 343)), 6); expect(maekawa(100)).toBe(25);
  });
  it('the cutoff falls as the detour grows and stays in the audible band', () => {
    expect(diffractionCutoff(0.05)).toBeGreaterThan(diffractionCutoff(1)); expect(diffractionCutoff(100)).toBeGreaterThanOrEqual(2000); expect(diffractionCutoff(1e-9)).toBe(OPEN_HZ);
  });
});

describe('occlusion: a wall with a doorway (synthetic)', () => {
  const { parts, doorways } = wallWithDoor(); const F = new OcclusionField(parts, doorways);
  it('in the open, nothing is lost', () => { const q = F.query(P(-25, -10), P(-24, 10)); expect(q.gainDb).toBe(0); expect(q.direct).toBe(true); });
  it('a wall between source and listener attenuates (>= 10 dB) and low-passes', () => {
    const q = F.query(P(-12, -6), P(-12, 6)); expect(q.direct).toBe(false); expect(q.gainDb).toBeLessThan(-10); expect(q.cutoffHz).toBeLessThan(5000);
  });
  it('an open doorway on the line of sight lets the sound through unchanged', () => { const q = F.query(P(0, -8), P(0.5, 8)); expect(q.direct).toBe(true); expect(q.gainDb).toBe(0); });
  it('off the doorway axis the doorway lets some through: less loss than the wall, more than none', () => {
    const q = F.query(P(-6, -5), P(-6, 5)); expect(q.path).toMatch(/doorway/);
    expect(q.gainDb).toBeLessThan(-3); expect(q.gainDb).toBeGreaterThan(-TRANSMISSION_DB + 10);
    // farther from the doorway, more loss (the detour grows)
    expect(F.query(P(-15, -5), P(-15, 5)).gainDb).toBeLessThan(q.gainDb);
  });
  it('the wall top diffracts sound over it when the sky is open, and not under a roof', () => {
    const open = F.query(P(-15, -5, 8), P(-15, 5, 8)); expect(open.path).toMatch(/over the top|doorway/);
    const roofed = new OcclusionField(parts, doorways, [{ cx: -15, cy: -10, sx: 20, sy: 16, fl: 0, h: 10 }]).query(P(-15, -5, 8), P(-15, 5, 8));
    expect(roofed.path).not.toMatch(/over the top/);
  });
  it('a closed door leaf across the doorway costs a timber leaf', () => {
    const G = new OcclusionField(parts, doorways); G.leaves = [{ a: [-1.5, 0.5], b: [1.5, 0.5], y0: 0, y1: 2.5 }];
    const q = G.query(P(0, -8), P(0.5, 8)); expect(q.gainDb).toBeCloseTo(-LEAF_DB, 6); expect(q.cutoffHz).toBeLessThan(2000);
  });
  it('a person standing against the wall is not behind it (the last half metre is their own place)', () => { expect(F.query(P(-12, -1.2), P(-12, -8)).gainDb).toBe(0); });
});

describe('occlusion: the built Terrace', () => {
  const { parts, manifest, doorways } = buildTerrace();
  const roofs = Object.values(manifest).filter(m => Array.isArray((m as any).room)).map(m => { const [cx, cy, sx, sy, fl, h] = (m as any).room as number[]; return { cx, cy, sx, sy, fl, h }; });
  const t0 = performance.now(); const F = new OcclusionField(parts, doorways, roofs); const buildMs = performance.now() - t0;
  const G = (e: number, n: number, ear = 1.6) => P(e, n, F.floorBelow(e, n, 40) + ear);
  const S = G(22, -159.5, 1.5); // the middle of the Hadish hall (floor 6 m)
  it('the Hadish: through its solid walls a voice from the hall is gone (transmission only)', () => {
    for (const L of [G(42.7, -152), G(5.1, -173.6), G(38.9, -173.6)]) { const q = F.query(S, L); expect(q.gainDb, JSON.stringify(L)).toBeLessThan(-40); expect(q.cutoffHz).toBeLessThanOrEqual(300); }
  });
  it('the Hadish: in line with a doorway it is heard unchanged; off its axis, through the doorway, it is weaker but heard', () => {
    expect(F.query(S, G(44, -159.5)).gainDb).toBe(0); // on the E doorway's axis
    const off = F.query(S, G(25.8, -137.8)); expect(off.path).toMatch(/doorway hadish:N/); expect(off.gainDb).toBeGreaterThan(-25); expect(off.gainDb).toBeLessThan(-6);
  });
  it('the plain below the Terrace is shadowed by the terrace edge, not silenced', () => {
    const q = F.query(P(-120, 60, -10.4), P(-30, 60, 1.6)); expect(q.direct).toBe(false); expect(q.path).toMatch(/over the top/); expect(q.gainDb).toBeLessThan(-4); expect(q.gainDb).toBeGreaterThan(-20);
  });
  it('budget: the field builds in under 1.5 s and a query costs under 0.5 ms on average (±60 m pairs on the Terrace)', () => {
    expect(buildMs).toBeLessThan(1500);
    let n = 0; const t1 = performance.now(); let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    while (n < 400) { const s = G(-40 + rnd() * 260, -200 + rnd() * 330), l = G(s.e + (rnd() - 0.5) * 120, s.n + (rnd() - 0.5) * 120); if (!(s.y === s.y && l.y === l.y)) continue; F.query(s, l); n++; }
    const per = (performance.now() - t1) / n; console.log(`occlusion: field ${F.w}x${F.h} cells built in ${buildMs.toFixed(0)} ms; ${(per * 1000).toFixed(0)} µs per query`);
    expect(per).toBeLessThan(0.5);
  });
});
