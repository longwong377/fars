// D-720: D-358 (s14-simtalk, never merged) ported onto the talk path as it stands. Talking to people reaches the running
// simulation: a person's means and debts are the economy's (nothing invented), they reach the brief and the answer, and
// the stranger's words of lending and of asking for help are decided by the house's own state, move its stores and enter
// the economy's events, through talkTurn. What D-358 had that session 15 rebuilt (the stranger's buying, gifts, work,
// guest-right and petitions: D-370; real debts and dealings: D-371; the house's needs and the quarter's talk: D-375; the
// trust gate) is tested where it lives (stranger*.test.ts, history.test.ts).
// How this could pass while the intent fails: a means line that is not the house's numbers (measured against the economy's
// barley and silver); a loan that records an event but moves nothing (the silver, the debt and its cause checked); the answer
// echoing the note (the own lines must name the house's barley in the first person).
import { describe, it, expect, beforeAll } from 'vitest';
import { simAt } from './sim_fixture';
import type { PeopleSim } from '../src/people/sim';
import { lifeRecord, lifeBriefShort } from '../src/people/converse/life';
import { groundFact } from '../src/people/converse/ground';
import { ownReply, OwnMind } from '../src/people/converse/ownlines';
import { talkTurn } from '../src/people/converse/turn';
import { strangerAsk } from '../src/people/speech/verbs';
import { fenceHits } from '../src/people/converse/fence';

const D = 60;
let sim: PeopleSim;
beforeAll(() => { sim = simAt(1, D, 17); }, 900_000);
const adults = (n: number, ok: (pid: number) => boolean) => { const P = sim.pop, out: number[] = [];
  for (let pid = 7; pid < P.persons.length && out.length < n; pid += 97) if (P.present(pid, D) && P.ageOn(pid, D) >= 18 && ok(pid)) out.push(pid); return out; };

describe('the grammar of lending and asking (verbs.ts)', () => {
  const c = { day: 50, hh: 'h:7', q: 'q1', job: 'farmer' };
  it('reads a loan offered and help asked, and leaves the others to their own', () => {
    expect(strangerAsk('I can lend you half a shekel.', c)).toMatchObject({ a: 'lend', cash: 0.5 });
    expect(strangerAsk('Let me lend your house 2 shekels of silver.', c)).toMatchObject({ a: 'lend', cash: 2 });
    expect(strangerAsk('I have no food, help me please.', c)).toMatchObject({ a: 'ask_help' });
    expect(strangerAsk('Can I help you? I will work for your house.', c)?.a).not.toBe('ask_help');
    expect(strangerAsk('Take these 2 shekels.', c)?.a).toBe('give');
  });
});

describe('a person\'s means are the simulation\'s', () => {
  it('the house\'s barley and silver, the market\'s price; no debt invented; in the brief and the answer, in words', () => {
    const E = sim.econTo(D); let houses = 0, said = 0;
    for (const pid of adults(120, () => true)) {
      const L = lifeRecord(sim.pop, sim.cal, pid, D, 10), hh = `h:${sim.pop.home(pid, D)}`, H = E.hh.get(hh);
      // the debts are exactly the economy's: none where the house owes nothing and is owed nothing
      const owes = H ? H.debts.filter(d => d.amt > 0.01).length : 0; let owed = 0; for (const o of E.hh.values()) if (o !== H) for (const d of o.debts) if (d.to === hh && d.amt > 0.01) owed++;
      if (!owes && !owed) expect(L.debts, `${pid}`).toEqual([]);
      for (const m of [...(L.means ?? []), ...L.debts]) { expect(m).not.toMatch(/\d/); expect(fenceHits(m), m).toEqual([]); }
      if (!H) continue; houses++;
      const days = H.grain / Math.max(0.55, H.eaters * 0.55);
      expect(L.means![0], `${pid}`).toMatch(H.grain < 0.5 ? /no barley left/ : days >= 60 ? /barley for .* months?/ : days >= 2 ? /barley for .* days?/ : /a day or less/);
      expect(L.means![0]).toMatch(H.cash < 0.01 ? /no silver/ : /silver|shekel/);
      expect(L.means!.some(m => /barley at the market/.test(m))).toBe(true);
      expect(lifeBriefShort(L)).toContain(`Means: ${L.means![0]}.`);
      expect(groundFact(L, 'Do you have enough to eat this winter?')).toContain(L.means![0].slice(0, 20));
      const a = ownReply(L, 'Are you poor? Do you have enough barley?').text; if (/our house has/i.test(a)) said++;
    }
    expect(houses).toBeGreaterThan(30); expect(said).toBeGreaterThan(houses * 0.9);
  }, 600_000);
});

describe('the stranger\'s words enter the economy through the talk (talkTurn)', () => {
  it('a loan to a house short of silver: the silver moves, the debt is owed to him, from the house\'s want; refused where not needed', async () => {
    const E = sim.econTo(D), S = E.stranger(), m = new OwnMind(); S.purse.cash = Math.max(S.purse.cash, 3);
    const trusts = (hh: string) => !E.trust || E.trust.trustOf(hh, 'player', D) >= 0.35;
    const [pid] = adults(1, p => { const H = E.hh.get(`h:${sim.pop.home(p, D)}`); return !!H && H.cash < 1 && H.cause.cash !== undefined && trusts(H.id); });
    expect(pid).toBeDefined(); const hh = `h:${sim.pop.home(pid, D)}`, H = E.hh.get(hh)!, c0 = H.cash, p0 = S.purse.cash, want = H.cause.cash;
    const o = await talkTurn(m, sim, pid, 'I can lend you half a shekel.', { conv: sim.t });
    expect(o.sandbox?.act.a).toBe('lend'); expect(o.sandbox?.done?.ok).toBe(true);
    expect(H.cash).toBeCloseTo(c0 + 0.5, 6); expect(S.purse.cash).toBeCloseTo(p0 - 0.5, 6);
    const debt = H.debts.find(d => d.to === 'player'); expect(debt?.amt).toBeCloseTo(0.5, 6);
    const ev = E.events[debt!.ev]; expect(ev.kind).toBe('lent_by_stranger'); expect(ev.causes).toContain(want);
    // a rich house has no need of it, and nothing moves
    const [rich] = adults(1, p => { const R = E.hh.get(`h:${sim.pop.home(p, D)}`); return !!R && R.cash > 5 && !R.debts.some(d => d.amt > 0.05) && trusts(R.id); });
    if (rich !== undefined) { const R = E.hh.get(`h:${sim.pop.home(rich, D)}`)!, r0 = R.cash; const o2 = await talkTurn(m, sim, rich, 'I can lend you half a shekel.', { conv: sim.t });
      expect(o2.sandbox?.verdict.ok).toBe(false); expect(o2.sandbox?.done ?? null).toBeNull(); expect(R.cash).toBe(r0); }
  }, 600_000);
  it('asking a house for help: bread from its own barley when it has it to spare, recorded; a short house says no', async () => {
    const E = sim.econTo(D), S = E.stranger(), m = new OwnMind();
    const trusts = (hh: string) => !E.trust || E.trust.trustOf(hh, 'player', D) >= 0.3;
    const [pid] = adults(1, p => { const H = E.hh.get(`h:${sim.pop.home(p, D)}`); return !!H && H.grain > H.eaters * 0.55 * 40 && trusts(H.id); });
    const H = E.hh.get(`h:${sim.pop.home(pid, D)}`)!, g0 = H.grain, p0 = S.purse.grain, n0 = E.events.length;
    const o = await talkTurn(m, sim, pid, 'I have no food, help me please.', { conv: sim.t });
    expect(o.sandbox?.act.a).toBe('ask_help'); expect(o.sandbox?.done?.ok).toBe(true);
    expect(H.grain).toBeCloseTo(g0 - 1.1, 6); expect(S.purse.grain).toBeCloseTo(p0 + 1.1, 6);
    expect(E.events.slice(n0).some(e => e?.kind === 'helped_stranger' && e.actor === H.id)).toBe(true);
    const [poor] = adults(1, p => { const P = E.hh.get(`h:${sim.pop.home(p, D)}`); return !!P && P.grain < P.eaters * 0.55 * 25 && trusts(P.id); });
    if (poor !== undefined) { const P = E.hh.get(`h:${sim.pop.home(poor, D)}`)!, q0 = P.grain; const o2 = await talkTurn(m, sim, poor, 'I have no food, help me please.', { conv: sim.t });
      expect(o2.sandbox?.verdict.ok).toBe(false); expect(P.grain).toBe(q0); expect(o2.answer.text.toLowerCase()).toMatch(/no|cannot|not/); }
  }, 600_000);
});
