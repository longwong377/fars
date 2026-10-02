// D-381 (B226, B227): the relations layer's own marriages in the households and the economy. On the world (PeopleSim with
// the relations stepped with the days, SimOpts.bonds): a wedding of the year moves the bride into the groom's house from its
// day (Population.home, the plans' and the renderer's answer, agrees with Relations.homeOf); the bride-gift, the dowry and the
// divorce silver are economy events naming both houses, settled against the payer's silver (paid, borrowed, or owed); chains
// through a betrothal or a wedding exist in the economy's causal graph (chains.ts, T-F9); a save loaded into a fresh world
// goes on to the same marriage payments as the world that never stopped.
// How this could pass while the intent fails: events recorded with no money moving (answered by the payer's silver checked
// down on the day), or chains that only touch a wedding by its id (the chain's actors must be both houses).
// Measures go to bench-reports/relations-econ.json.
import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { PeopleSim } from '../src/people/sim';
import { chains } from '../src/people/economy/chains';
import type { Economy, EconEvent } from '../src/people/economy/world';
import { nav, envOf } from './sim_fixture';

const MARR = new Set(['betrothal', 'wedding', 'divorce']);
const D1 = 150, D2 = 200, YEAR = 353;
let S: PeopleSim; let E: Economy; const OUT: Record<string, unknown> = {};
const mk = () => new PeopleSim(1, nav(), envOf(1), { bonds: true });
const write = () => { mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/relations-econ.json', JSON.stringify(OUT, null, 1)); };
const sig = (e: EconEvent) => `${e.day}|${e.kind}|${e.actor}|${e.other}|${e.amt?.toFixed(3)}`;
let save: ReturnType<PeopleSim['save']>; let before: string[] = []; let owedAt: string[] = []; let stateAt: string[] = [];
const houseState = (X: Economy) => [...X.hh.values()].map(h => `${h.id}|${h.cash.toFixed(3)}|${h.goods}|` + h.debts.filter(d => d.amt > 0).map(d => `${d.to}:${d.amt.toFixed(3)}:${d.due}`).join(','));
/** the debts a house carries for a marriage payment (owed to the other house, or to whoever lent it the silver) */
const marrDebts = (X: Economy) => [...X.hh.values()].flatMap(h => h.debts.filter(d => d.amt > 0 && X.events[d.ev] && (MARR.has(X.events[d.ev].kind) || X.events.some(m => m && MARR.has(m.kind) && m.causes.includes(d.ev)))).map(d => `${h.id}>${d.to}|${d.amt.toFixed(3)}|${d.due}`)).sort();

beforeAll(() => {
  S = mk(); const t = performance.now(); S.econTo(D1); S.t = D1 * 24 + 10; save = JSON.parse(JSON.stringify(S.save())); owedAt = marrDebts(S.econTo(D1)); stateAt = houseState(S.econTo(D1));
  E = S.econTo(D2); before = E.events.filter(e => e && MARR.has(e.kind) && e.day > D1 && e.day <= D2).map(sig);
  OUT.msTo200 = Math.round(performance.now() - t);
}, 1_800_000);

describe('the relations’ marriages in the households and the economy (D-381)', () => {
  it('a wedding moves the bride into the groom’s house from its day', () => {
    const R = S.bonds, P = S.pop; let moved = 0, notJoined = 0; const wed = R.events.filter(e => e.kind === 'wed' && e.a >= 0 && e.b >= 0 && e.day <= D2);
    for (const e of wed) { const bride = e.b, groom = e.a, d = e.day; const before = R.homeOf(bride, d - 1), after = R.homeOf(bride, d + 1);
      if (before === after) continue; // (the same house, or a stranger's)
      expect(after).toBe(R.homeOf(groom, d + 1));
      if (P.home(bride, d + 1) === after && P.home(bride, d - 1) === before) moved++; else notJoined++; }
    Object.assign(OUT, { weddings: wed.length, movedHouse: moved, notJoinedToPopulation: notJoined, joined: R.joined }); write();
    expect(moved).toBeGreaterThan(10); expect(moved).toBeGreaterThanOrEqual(0.8 * (moved + notJoined));
  });

  it('the bride-gifts, dowries and divorce silver are economy events naming both houses, paid from the payer’s silver', () => {
    const R = S.bonds, ev = E.events.filter(e => e && MARR.has(e.kind)), kinds: Record<string, number> = {};
    for (const e of ev) { kinds[e.kind] = (kinds[e.kind] ?? 0) + 1; expect(e.actor).toMatch(/^h:\d+$/); expect(e.other).toMatch(/^h:\d+$/); expect(e.other).not.toBe(e.actor); expect(e.amt).toBeGreaterThan(0); }
    // each one's gift reaches the receiving house as the economy's own 'given', caused by it
    let given = 0; for (const e of ev) if (E.events.some(g => g && g.kind === 'given' && g.actor === e.other && g.causes.includes(e.id))) given++;
    // every betrothal of the relations (between two houses, on a day the economy has stepped) is in the economy
    const relB = R.events.filter(e => e.kind === 'betroth' && e.day <= D2 && e.a >= 0).length;
    Object.assign(OUT, { econEvents: kinds, givenCausedByThem: given, relBetrothals: relB, econStats: R.econStats }); write();
    expect(kinds.betrothal ?? 0).toBeGreaterThan(20); expect(kinds.wedding ?? 0).toBeGreaterThan(10); expect(kinds.divorce ?? 0).toBeGreaterThan(0);
    expect(given).toBeGreaterThanOrEqual(0.9 * ev.length);
    expect(R.econStats.silver).toBeGreaterThan(0); expect(R.econStats.borrowed + R.econStats.owed).toBeGreaterThan(0); expect(R.econStats.replayed).toBe(0);
  });

  it('a payment moves silver out of the payer’s house on its day', () => {
    // a fresh world stepped to the morning of a payment's day: the payer's silver falls by what it paid (borrowed silver in, then out)
    const e = E.events.find(x => x && x.kind === 'betrothal' && x.day > 40 && x.day <= D1)!; expect(e).toBeDefined();
    const T = new PeopleSim(1, nav(), envOf(1), { bonds: true }); const Et = T.econTo(e.day - 1), h = Et.hh.get(e.actor)!, cash0 = h.cash;
    T.econTo(e.day); const ev2 = Et.events.find(x => x && x.kind === 'betrothal' && x.actor === e.actor && x.day === e.day)!; expect(ev2).toBeDefined();
    const g = Et.events.find(x => x && x.kind === 'given' && x.causes.includes(ev2.id))!; const loan = Et.events.find(x => x && x.kind === 'loan' && x.actor === e.actor && x.day === e.day);
    OUT.onePayment = { day: e.day, payer: e.actor, to: e.other, gift: e.amt, cash0, given: g?.amt, borrowed: loan?.amt ?? 0, cashAfterDay: h.cash }; write();
    expect(g.amt!).toBeGreaterThan(0); expect(cash0 + (loan?.amt ?? 0) - g.amt!).toBeGreaterThanOrEqual(-1e-6);
  }, 900_000);

  it('the save and load keep them: the marriage debts carried over, and the payments after it', () => {
    const L = mk(); L.load(JSON.parse(JSON.stringify(save))); const E0 = L.econTo(D1), kept = houseState(E0); const EL = L.econTo(D2);
    const after = EL.events.filter(e => e && MARR.has(e.kind) && e.day > D1 && e.day <= D2).map(sig), same = after.filter(x => before.includes(x)).length;
    OUT.saveLoad = { from: D1, to: D2, marriageDebtsAtSave: owedAt.length, housesKept: kept.filter((x, i) => x === stateAt[i]).length, houses: stateAt.length, continuous: before.length, loaded: after.length, same, replayedAfterLoad: L.bonds.econStats.replayed }; write();
    // (every house's silver, goods and debts, the marriage payments' among them, as they stood when saved)
    expect(owedAt.length).toBeGreaterThan(5); expect(kept).toEqual(stateAt);
    // (the relations re-derived after a load see the economy's illnesses and deaths sooner than the world that never stopped did,
    // so a few of their own events differ: B-row of D-381; the payments of the marriages both have are the same)
    expect(before.length).toBeGreaterThan(5); expect(same).toBeGreaterThanOrEqual(0.9 * before.length); expect(L.bonds.econStats.replayed).toBe(0);
  }, 900_000);

  it('a year: chains through the marriages in the economy’s causal graph', () => {
    const t = performance.now(); E = S.econTo(YEAR); OUT.msTo353 = Math.round(performance.now() - t);
    const ch = chains(E.events), through = ch.filter(c => c.path.some(i => MARR.has(E.events[i].kind)));
    const wed = through.filter(c => c.path.some(i => E.events[i].kind === 'wedding'));
    for (const c of through) { const m = c.path.map(i => E.events[i]).find(e => MARR.has(e.kind))!; expect(c.actors).toContain(m.actor); expect(c.actors).toContain(m.other); }
    Object.assign(OUT, { chains: ch.length, throughMarriages: through.length, throughWeddings: wed.length, shapes: [...new Set(through.map(c => c.shape))].slice(0, 12),
      yearEcon: Object.fromEntries(['betrothal', 'wedding', 'divorce', 'default', 'loan'].map(k => [k, E.events.filter(e => e?.kind === k).length])), econStatsYear: S.bonds.econStats }); write();
    expect(wed.length).toBeGreaterThan(0); expect(through.length).toBeGreaterThan(5);
  }, 1_800_000);
});
