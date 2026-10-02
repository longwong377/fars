// D-375: someone comes up to the stranger with their house's need (asks on, as in the game)
import { describe, it, expect } from 'vitest';
import { simAt } from './sim_fixture';
import { Approaches } from '../src/people/converse/approach';

describe('D-375 approaches', () => {
  it('a person whose house needs help and trusts the stranger comes up; never a house twice in a few days; none at night', () => {
    const d = 120, sim = simAt(1, d, 10, { asks: true }); const E = sim.econTo(d + 1), A = sim.asksWorld.asks;
    const needy = [...new Set([...(A as any).open.values()].map((a: any) => a.hh))] as string[];
    const near = needy.flatMap(h => sim.pop.households[Number(h.slice(2))].members).slice(0, 400);
    const ap = new Approaches(sim); const first = ap.next(near); expect(first).not.toBeNull();
    expect(first!.ask.voices.find(v => v.to === 'stranger')!.willing).toBe(true); expect(first!.trust).toBeGreaterThanOrEqual(0.45);
    expect(ap.next(near)).toBeNull(); // (not again at once)
    sim.t += 2; const second = ap.next(near); if (second) expect(second.hh).not.toBe(first!.hh);
    sim.t = d * 24 + 23; expect(new Approaches(sim).next(near)).toBeNull(); void E;
  }, 900_000);
});
