import { describe, it, expect } from 'vitest';
import { Visitor, VisitorWorld, ESCORT_WAIT_H } from '../src/world/visitor/controller';
import places from '../src/data/people_places.json';

// visitor mode (D-100 … D-104): the stop, the halmi, the escort and the errand, over a fake world
const P = (id: string) => (places as any).places.find((p: any) => p.id === id).at as [number, number];
const W = (id: string) => { const [e, n] = P(id); return { x: e, z: -n, yaw: 0 }; };
function fake() {
  const reacted: [number, string][] = []; let escort: any = null;
  const g = (id: number, post: string) => ({ id, pos: P(post), post, onDuty: true });
  const world: VisitorWorld = {
    guards: () => [g(1, 'post_gate_w1'), g(2, 'post_gate_w2'), g(3, 'post_gate_s1'), g(4, 'post_treas_1'), g(5, 'post_apa_w')],
    familiarity: () => 0, recognise: 0.25,
    react: (id, intent) => { reacted.push([id, intent]); return true; },
    escort: at => { escort = at; },
  };
  return { world, reacted, escort: () => escort };
}
describe('visitor mode', () => {
  it('the Gate guard stops the visitor, asks for the halmi; shown, he is admitted and an escort comes after a wait', () => {
    const f = fake(), v = new Visitor(f.world, null); v.s.step = 3; const t0 = 24 * 30 + 10;
    const outside = W('stair_foot'); expect(v.update(outside, t0, false, false).blocked).toBe(false);
    const inGate = W('gate_hall');
    const r = v.update(inGate, t0, false, false); expect(r.blocked).toBe(true); expect(r.x).toBeCloseTo(outside.x); // back to the last allowed point
    expect(f.reacted.some(([, i]) => i === 'ask_document')).toBe(true);
    expect(v.interact(inGate, t0, false, false)).toMatch(/halmi/);
    expect(v.update(inGate, t0 + 0.001, false, false).blocked).toBe(false);
    const court = W('forecourt');
    expect(v.update(court, t0 + 0.01, false, false).blocked).toBe(true); // courts: not alone
    expect(v.update(inGate, t0 + ESCORT_WAIT_H + 0.01, false, false).blocked).toBe(false);
    expect(v.s.escorted).toBe(true); expect(f.escort()).not.toBeNull();
    expect(v.update(court, t0 + ESCORT_WAIT_H + 0.02, false, false).blocked).toBe(false);
    // the Apadana stays closed, escort or not
    expect(v.update({ x: 1.9, z: 4.9, yaw: 0 }, t0 + ESCORT_WAIT_H + 0.03, false, false).blocked).toBe(true);
    expect(f.reacted.some(([, i]) => i === 'refuse')).toBe(true);
  });
  it('the letter handed in before midday is answered the next morning, not before; the log never shows in the world', () => {
    const f = fake(), v = new Visitor(f.world, null); v.s.step = 5; v.s.escorted = true;
    const door = W('post_treas_1'), day = 30, t = day * 24 + 10.5;
    expect(v.interact(door, t, false, false)).toMatch(/letter/); expect(v.s.answerAt).toBe((day + 1) * 24 + 7);
    expect(v.interact(door, t + 2, false, false)).toMatch(/not yet/);
    v.update({ x: -600, z: -122.5, yaw: 0 }, (day + 1) * 24 + 7.5, false, false); // the next morning, anywhere
    expect(v.s.step).toBe(7);
    expect(v.interact(door, (day + 1) * 24 + 8, false, false)).toMatch(/answer/); expect(v.s.letter).toBe('answer');
    expect(v.s.log.length).toBeGreaterThan(2);
  });
  it('the Grand Stair is free by day and closed at night', () => {
    const f = fake(), v = new Visitor(f.world, null); v.s.step = 2;
    const [e, n] = P('stair_foot');
    expect(v.update(W('stair_foot'), 300, false, false).blocked).toBe(false);
    expect(v.update({ x: e + 8, z: -(n + 2), yaw: 0 }, 300, false, false).blocked).toBe(false);
    void n;
  });
  it('saves and loads its state', () => {
    const f = fake(), v = new Visitor(f.world, null); v.s.step = 6; v.s.letter = 'handed'; v.s.answerAt = 999;
    const w = new Visitor(f.world, null); w.load(JSON.parse(JSON.stringify(v.save())));
    expect(w.s.step).toBe(6); expect(w.s.letter).toBe('handed'); expect(w.s.answerAt).toBe(999);
  });
});
