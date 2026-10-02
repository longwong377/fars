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
describe('D-375 the town talks of the stranger', () => {
  it('a guest who left without thanks is talked of beyond the house, and those who hear trust him less', () => {
    const d = 100, sim = simAt(1, d, 10, { asks: true }); const E = sim.econTo(d), S = E.stranger();
    const host = [...E.hh.values()].find(h => h.kind === 'farmer' && S.stayCheck(h.id, d).ok)!;
    S.do({ a: 'stay', day: d, hh: host.id }); sim.econTo(d + 8); S.do({ a: 'leave_stay', day: E.day }); sim.econTo(d + 60);
    expect(E.events.some(v => v.kind === 'ingrate' && v.other === host.id)).toBe(true);
    const R = sim.asksWorld.rumours, r = R.rumours.find(x => x.src === 'player_deed' && x.truth.kind === 'ingrate');
    expect(r).toBeTruthy(); const heard = [...r!.holds.keys()].filter(h => h !== host.id);
    console.log('[town talk] heard by', heard.length, 'houses');
    expect(heard.length).toBeGreaterThan(2);
    const others = [...E.hh.values()].filter(h => h.q === host.q && !r!.holds.has(h.id)).slice(0, 10);
    const tH = heard.slice(0, 10).reduce((a, h) => a + E.trust!.trustOf(h, 'player', E.day), 0) / Math.min(10, heard.length), tO = others.reduce((a, h) => a + E.trust!.trustOf(h.id, 'player', E.day), 0) / Math.max(1, others.length);
    expect(tH).toBeLessThan(tO);
  }, 900_000);
});
