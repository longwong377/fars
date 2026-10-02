// D-460 (UD-32): wrongs and their consequences for every actor alike (deeds/law.ts): a theft by a townsman found out days
// later and judged; a blow by the stranger with its wound, the kin's demand, the judges and the town's memory of it; a feud
// between two houses; a lie found out; the town's own month of wrongs and their courses, with no stranger at all.
import { describe, it, expect } from 'vitest';
import { simAt } from './sim_fixture';
import { segAt } from '../src/people/population';
import type { PeopleSim } from '../src/people/sim';

const DAY = 60;
/** step the world's days (the living world, the economy, the minds and the law), then put the clock at 10 h */
const step = (sim: PeopleSim, to: number) => { for (let d = Math.floor(sim.t / 24) + 1; d <= to; d++) sim.econTo(d); sim.jumpTo(to * 24 + 10); };
const awake = (sim: PeopleSim, pid: number, day: number, h: number) => segAt(sim.pop.plan(pid, day), h).act !== 'sleep';

describe('D-460 a theft by a townsman: found out later, suspected, heard, judged (a scripted fortnight)', () => {
  it('the loss is noticed, a house suspected (sometimes the wrong one), the elder hears it, restitution or the whip follows', () => {
    const sim = simAt(1, DAY, 10, { asks: true }), P = sim.pop, E = sim.econTo(DAY), L = sim.deeds.law;
    const men = P.persons.filter(p => P.present(p.id, DAY) && p.sex === 'm' && P.ageOn(p.id, DAY) >= 20 && P.ageOn(p.id, DAY) < 50).map(p => p.id);
    // several thieves, each robbing a house of his own quarter at night (unseen: the house asleep)
    const thefts: { thief: number; victim: number; g0: number }[] = [];
    for (const thief of men) { if (thefts.length >= 4) break; const q = P.households[P.home(thief, DAY)].q;
      const victim = men.find(v => v !== thief && P.households[P.home(v, DAY)].q === q && P.home(v, DAY) !== P.home(thief, DAY) && (E.hh.get(`h:${P.home(v, DAY)}`)?.grain ?? 0) > 20 && !thefts.some(t => t.victim === v || t.thief === v) && thefts.every(t => P.home(t.victim, DAY) !== P.home(v, DAY)));
      if (victim === undefined) continue; const g0 = E.hh.get(`h:${P.home(victim, DAY)}`)!.grain;
      const rec = sim.deeds.act({ verb: 'steal', actor: thief, target: victim, good: 'grain', qty: 12 }, DAY * 24 + 2.5);
      if (!rec.out.ok || rec.out.effects.some(e => e.k === 'law')) continue; // (seen: not this course)
      expect(E.hh.get(`h:${P.home(victim, DAY)}`)!.grain).toBeLessThan(g0); thefts.push({ thief, victim, g0 }); }
    expect(thefts.length).toBeGreaterThanOrEqual(2);
    // nothing is known yet: no news, no suspicion, the robbed are not angry with anyone
    for (const t of thefts) { const l = L.losses.find(x => x.thief === t.thief)!; expect(l.noticed).toBeFalsy(); expect(sim.deeds.minds.feelOf(t.victim, t.thief, DAY).anger).toBeLessThan(0.1); }
    step(sim, DAY + 4);
    const ls = thefts.map(t => L.losses.find(x => x.thief === t.thief)!);
    for (const l of ls) { expect(l.noticed).toBe(true); expect(l.suspect).not.toBeUndefined(); }
    // suspicion acted on: a complaint to the elder or an accusation, with a case before the elder for most
    step(sim, DAY + 14);
    const cases = sim.deeds.cases.filter(c => c.crime === 'theft' && ls.some(l => l.hh === `h:${P.home(c.victim as number, DAY)}` || l.victim === c.victim));
    expect(cases.length).toBeGreaterThan(0);
    // the course run: at least one thief judged (restitution, labour or the whip), and the robbed house got grain back
    const judged = cases.filter(c => c.ruled && c.ruled !== 'dismissed' && thefts.some(t => t.thief === c.accused));
    expect(judged.length).toBeGreaterThan(0);
    for (const c of judged) { expect(c.sentence!.why.length).toBeGreaterThan(10); expect(['B', 'C']).toContain(c.sentence!.tier); const l = L.losses.find(x => x.thief === c.accused)!; expect(l.returned).toBe(true);
      const hard = c.ruled === 'labour' ? P.plan(c.accused as number, c.due + 1).some(s => /working off/.test(s.why)) : true; expect(hard).toBe(true); }
    // the thief's record is known to the robbed house: he is refused where he was not before
    const c0 = judged[0], vic = (c0.victim as number);
    expect(L.record(vic, c0.accused, DAY + 14)!.v).toBeLessThan(0);
    // and every wrong suspicion either cleared or still standing as a wrong one (never a conviction of the innocent by default)
    for (const c of sim.deeds.cases.filter(c => c.crime === 'theft' && c.innocent && c.ruled)) expect(c.ruled).toBe('dismissed');
  });
  it('across many thefts the lane sometimes blames the wrong house, and a wrong suspicion is cleared when the truth comes out', () => {
    const sim = simAt(1, DAY, 10, { asks: true }), P = sim.pop, E = sim.econTo(DAY), L = sim.deeds.law;
    const men = P.persons.filter(p => P.present(p.id, DAY) && p.sex === 'm' && P.ageOn(p.id, DAY) >= 20 && P.ageOn(p.id, DAY) < 55).map(p => p.id);
    let n = 0;
    for (let i = 0; i < men.length && n < 30; i += 3) { const thief = men[i], q = P.households[P.home(thief, DAY)].q;
      const victim = men.find((v, j) => j > i && P.households[P.home(v, DAY)].q === q && P.home(v, DAY) !== P.home(thief, DAY) && (E.hh.get(`h:${P.home(v, DAY)}`)?.grain ?? 0) > 15 && !L.losses.some(l => l.victim === v));
      if (victim === undefined) continue; const r = sim.deeds.act({ verb: 'steal', actor: thief, target: victim, good: 'grain', qty: 6 }, DAY * 24 + 3); if (r.out.ok) n++; }
    step(sim, DAY + 30);
    const noticed = L.losses.filter(l => l.noticed);
    expect(noticed.length).toBeGreaterThan(8);
    expect(noticed.filter(l => l.wrong).length).toBeGreaterThan(0); // (the wrong house blamed)
    expect(noticed.filter(l => l.wrong === false).length).toBeGreaterThan(0); // (the right one)
    expect(noticed.filter(l => l.found !== undefined).length).toBeGreaterThan(0); // (the truth out)
  });
});

describe('D-460 a blow by the stranger: the wound, the kin, the demand, the judges, the town remembers (a scripted fortnight)', () => {
  const victimOf = (sim: PeopleSim) => { const P = sim.pop; return P.persons.find(p => P.present(p.id, DAY) && p.sex === 'm' && P.ageOn(p.id, DAY) >= 22 && P.ageOn(p.id, DAY) < 45 && awake(sim, p.id, DAY, 10)
    && P.membersOn(P.home(p.id, DAY), DAY).filter(x => x !== p.id && P.ageOn(x, DAY) >= 16).length >= 2 && sim.deeds.law.elderOf(P.households[P.home(p.id, DAY)].q, DAY) !== null)!.id; };
  it('unpaid: the kin demand the price of the wound, the judges rule, the debt stands, the quarter keeps away, the wound heals', () => {
    const sim = simAt(1, DAY, 10, { asks: true }), P = sim.pop, E = sim.econTo(DAY), L = sim.deeds.law, S = E.stranger(); S.purse.cash = 0;
    const v = victimOf(sim), hh = `h:${P.home(v, DAY)}`, kin = P.membersOn(P.home(v, DAY), DAY).filter(x => x !== v && P.ageOn(x, DAY) >= 16);
    const other = P.households.find(H => H.q === P.households[P.home(v, DAY)].q && `h:${H.id}` !== hh && E.hh.has(`h:${H.id}`) && H.members.some(m => P.ageOn(m, DAY) >= 20))!;
    const oh = `h:${other.id}`, t0 = E.trust!.trustOf(oh, 'player', DAY), helper = kin[0], lean0 = sim.deeds.judge({ verb: 'help', actor: 'player', target: helper }, sim.t).lean!;
    const r = sim.strangerDeed(v, 'I will beat you!')!; expect(r.deed.verb).toBe('attack'); const rec = sim.strangerDeedDo(r.deed); expect(rec.out.ok).toBe(true);
    // the wound, fresh; the kin take it up; a quarrel between the house and the stranger
    expect(L.wound(v, DAY)?.stage).toBe('fresh');
    expect(Math.max(...kin.map(x => sim.deeds.minds.feelOf(x, 'player', DAY).anger))).toBeGreaterThan(0.1);
    const f = L.feuds.find(x => x.a === hh && x.b === 'player')!; expect(f).toBeTruthy(); expect(f.price).toBeGreaterThan(0);
    // the next days: the house demands the price; unpaid by its day, the matter goes to the king's judges
    step(sim, DAY + 2); expect(['demanded', 'refused', 'judged']).toContain(f.state);
    expect(sim.deeds.log.some(x => x.deed.target === 'player' && /compensation/.test(x.deed.about ?? '') && x.day > DAY)).toBe(true);
    step(sim, DAY + 14);
    const c = sim.deeds.cases.find(x => x.accused === 'player' && x.crime === 'assault')!; expect(c.ruled).toBeTruthy();
    if (c.ruled !== 'dismissed') { expect(c.court).toBe('judges'); expect(L.stranger.owed).toBeGreaterThan(0); expect(c.sentence!.why).toMatch(/compensation|whip|put out/); }
    expect(['judged', 'settled']).toContain(f.state);
    // the town remembers: the struck house and its quarter know it; the quarter trusts him less; the kin refuse him more
    expect(L.record(helper, 'player', DAY + 14)!.v).toBeLessThan(0);
    expect(L.record(other.members.find(m => P.ageOn(m, DAY) >= 20)!, 'player', DAY + 14)).not.toBeNull();
    expect(E.trust!.trustOf(oh, 'player', DAY + 14)).toBeLessThan(t0);
    expect(sim.deeds.judge({ verb: 'help', actor: 'player', target: helper }, sim.t).lean!).toBeLessThan(lean0);
    expect(sim.deeds.briefOf(helper, DAY + 14).join(' ')).toMatch(/stranger/);
    // the wound heals (a bruise in days, a cut in a fortnight; a bone longer)
    const w = L.wound(v, DAY + 14); if (w) expect(w.stage).not.toBe('fresh');
  });
  it('paid: the stranger pays the price of the wound to the house, and the quarrel is settled', () => {
    const sim = simAt(1, DAY, 10, { asks: true }), P = sim.pop, E = sim.econTo(DAY), L = sim.deeds.law, S = E.stranger(); S.purse.cash = 5;
    const v = victimOf(sim), hh = `h:${P.home(v, DAY)}`, kin = P.membersOn(P.home(v, DAY), DAY).filter(x => x !== v && P.ageOn(x, DAY) >= 16);
    sim.strangerDeedDo(sim.strangerDeed(v, 'I will beat you!')!.deed);
    const f = L.feuds.find(x => x.a === hh && x.b === 'player')!; step(sim, DAY + 1);
    const a0 = Math.max(...kin.map(x => sim.deeds.minds.feelOf(x, 'player', DAY + 1).anger));
    const head = L.head(hh, DAY + 1)!, coins = Math.ceil((f.price - f.paid) / 0.05);
    const g = sim.deeds.act({ verb: 'give', actor: 'player', target: head, good: 'silver', qty: coins, about: 'compensation for the blow' }, sim.t); expect(g.out.ok).toBe(true);
    expect(f.state).toBe('settled'); expect(S.purse.cash).toBeLessThan(5);
    expect(Math.max(...kin.map(x => sim.deeds.minds.feelOf(x, 'player', DAY + 1).anger))).toBeLessThan(a0);
  });
  it('seized in the act: a blow before a guard on duty is taken by the watch and held for the judges', () => {
    const sim = simAt(1, DAY, 10, { asks: true }), P = sim.pop, L = sim.deeds.law, t = sim.t;
    // a guard on duty at his post
    let done = false;
    for (const g of P.persons.filter(p => p.job === 'guard' && P.present(p.id, DAY)).map(p => p.id)) { if (!['stand_guard', 'patrol'].includes(segAt(P.plan(g, DAY), 10).act)) continue;
      const v = g; // (a guard at his post: struck by the stranger)
      const rec = sim.deeds.act({ verb: 'attack', actor: 'player', target: v, force: 0.5 }, t); if (!rec.out.ok) continue;
      const c = sim.deeds.cases.find(x => x.accused === 'player' && x.victim === v)!; if (!c.seized) continue;
      expect(c.court).toBe('judges'); expect(L.stranger.held).toBeTruthy(); expect(rec.out.why).toMatch(/seize/); done = true; break; }
    expect(done).toBe(true);
  });
});

describe('D-460 between the town\'s own houses: a feud, a lie found out, a month of wrongs with no stranger', () => {
  it('a blow between two houses: the price demanded, paid or refused, a kinsman\'s blow or the elders\' peace', () => {
    const sim = simAt(1, DAY, 10, { asks: true }), P = sim.pop, L = sim.deeds.law;
    const men = P.persons.filter(p => P.present(p.id, DAY) && p.sex === 'm' && P.ageOn(p.id, DAY) >= 20 && P.ageOn(p.id, DAY) < 50 && awake(sim, p.id, DAY, 10)).map(p => p.id);
    const feuds: number[] = [];
    for (let i = 0; i + 1 < men.length && feuds.length < 6; i += 7) { const a = men[i], b = men.find(x => P.households[P.home(x, DAY)].q === P.households[P.home(a, DAY)].q && P.home(x, DAY) !== P.home(a, DAY) && x !== a);
      if (b === undefined) continue; const r = sim.deeds.act({ verb: 'attack', actor: a, target: b, force: 0.55 }, sim.t); if (!r.out.ok) continue;
      const f = L.feuds.find(x => x.by === a && x.victim === b); if (f) feuds.push(f.id); }
    expect(feuds.length).toBeGreaterThanOrEqual(3);
    step(sim, DAY + 16);
    const fs = feuds.map(i => L.feuds[i]);
    expect(sim.deeds.log.some(r => r.deed.verb === 'ask_for' && /compensation/.test(r.deed.about ?? ''))).toBe(true); // (the demand, through the same engine)
    expect(fs.filter(f => f.state === 'settled' || f.state === 'judged').length).toBeGreaterThanOrEqual(Math.ceil(fs.length / 2));
    expect(fs.some(f => /elders|compensation paid|before the|judges|harms even/.test(f.why ?? ''))).toBe(true);
  });
  it('a lie about a neighbour is checked by the hearer, found out, and the liar loses their trust (the stranger and a townsman alike)', () => {
    const sim = simAt(1, DAY, 10, { asks: true }), P = sim.pop, L = sim.deeds.law, M = sim.deeds.minds;
    // a hearer and the one lied about from the same house (they will ask each other)
    const pairs: [number, number][] = [];
    for (const H of P.households) { const m = H.members.filter(x => P.present(x, DAY) && P.ageOn(x, DAY) >= 18 && P.home(x, DAY) === H.id && awake(sim, x, DAY, 10)); if (m.length >= 2) pairs.push([m[0], m[1]]); if (pairs.length >= 8) break; }
    const liarT = P.persons.find(p => P.present(p.id, DAY) && P.ageOn(p.id, DAY) >= 25 && !pairs.some(q => q.includes(p.id)))!.id;
    pairs.forEach(([h, th], i) => sim.deeds.act({ verb: 'lie', actor: i % 2 ? liarT : 'player', target: h, third: th, about: 'he stole a goat from the temple herd' }, sim.t));
    expect(L.claims.length).toBe(pairs.length);
    step(sim, DAY + 20);
    const found = L.claims.filter(c => c.found !== undefined);
    expect(found.length).toBeGreaterThanOrEqual(pairs.length / 2);
    expect(found.some(c => c.liar === 'player')).toBe(true); expect(found.some(c => c.liar === liarT)).toBe(true);
    for (const c of found) { expect(M.feelOf(c.hearer, c.liar, DAY + 20).anger).toBeGreaterThan(0); expect(L.record(c.hearer, c.liar, DAY + 20)?.why).toMatch(/liar/); }
  });
  it('the town alone for a month: its own quarrels, thefts and blows run their courses (losses noticed, cases heard, feuds settled)', () => {
    const sim = simAt(1, DAY, 10, { asks: true, }), L = sim.deeds.law, n0 = sim.deeds.log.length;
    step(sim, DAY + 30);
    const own = sim.deeds.log.slice(n0).filter(r => r.deed.actor !== 'player');
    expect(new Set(own.map(r => r.deed.verb)).size).toBeGreaterThanOrEqual(8);
    expect(own.some(r => r.deed.verb === 'steal' && r.out.ok)).toBe(true);
    expect(L.losses.filter(l => l.noticed).length + L.cases.length).toBeGreaterThan(0);
    expect(L.cases.filter(c => c.ruled).length).toBeGreaterThan(0);
    expect(L.cases.every(c => c.accused !== 'player')).toBe(true);
    // saved and loaded, the law goes on where it stood
    const s = JSON.parse(JSON.stringify(sim.save())), b = simAt(1, DAY, 10, { asks: true }); b.load(s);
    expect(b.deeds.law.cases.length).toBe(L.cases.length); expect(b.deeds.law.losses.length).toBe(L.losses.length); expect(b.deeds.law.feuds.length).toBe(L.feuds.length);
  });
});
