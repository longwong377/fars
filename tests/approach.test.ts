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
    expect(first!.ask!.voices.find(v => v.to === 'stranger')!.willing).toBe(true); expect(first!.trust).toBeGreaterThanOrEqual(0.45);
    expect(ap.next(near)).toBeNull(); // (not again at once)
    sim.t += 2; const second = ap.next(near); if (second) expect(second.hh).not.toBe(first!.hh);
    sim.t = d * 24 + 23; expect(new Approaches(sim).next(near)).toBeNull(); void E;
  }, 900_000);
});
describe('D-375 the town talks of the stranger', () => {
  it('a guest who left without thanks is talked of beyond the house, and those who hear trust him less', () => {
    const d = 100, sim = simAt(1, d, 10, { asks: true }); const E = sim.econTo(d), S = E.stranger(); S.purse.cash = 2; // (with the means to give back)
    const host = [...E.hh.values()].find(h => h.kind === 'farmer' && S.stayCheck(h.id, d).ok)!;
    S.do({ a: 'stay', day: d, hh: host.id }); sim.econTo(d + 8); S.do({ a: 'leave_stay', day: E.day }); sim.econTo(d + 60);
    expect(E.events.some(v => v.kind === 'ingrate' && v.other === host.id)).toBe(true);
    const R = sim.asksWorld.rumours, r = R.rumours.find(x => x.src === 'player_deed' && x.truth.kind === 'ingrate');
    expect(r).toBeTruthy(); const heard = [...r!.holds.keys()].filter(h => h !== host.id);
    console.log('[town talk] heard by', heard.length, 'houses');
    expect(heard.length).toBeGreaterThan(2);
    // (each house that heard it second hand or further holds a mark against him of its own; the host's kin and lane were told by the host)
    const marked = heard.filter(h => r!.holds.get(h)!.hand > 0 && r!.holds.get(h)!.v.certainty >= 0.3 && ((E.trust!.dyad.get(`${h}>player`)?.v ?? 0) < 0)).length, far = heard.filter(h => r!.holds.get(h)!.hand > 0).length;
    expect(far).toBeGreaterThan(0); expect(marked).toBe(far);
  }, 900_000);
});
describe('D-375 a friendly house invites the stranger', () => {
  it('in the evening a house that trusts the stranger well invites him to eat and stay', () => {
    const d = 120, sim = simAt(1, d, 18, { asks: true }); const E = sim.econTo(d + 1); E.stranger();
    const houses = [...E.hh.values()].filter(h => h.kind === 'farmer' && sim.asksWorld.openAsksOf(h.id).length === 0 && E.stranger().stayCheck(h.id, d).ok).slice(0, 30);
    for (const h of houses) E.trust!.note(h.id, 'player', 0.6, d);
    const near = houses.flatMap(h => sim.pop.households[Number(h.id.slice(2))].members);
    const a = new Approaches(sim).next(near); expect(a?.kind).toBe('invite'); expect(a!.trust).toBeGreaterThanOrEqual(0.7);
  }, 900_000);
});
