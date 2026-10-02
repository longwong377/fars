// D-370 (UD-25 mechanics 3, 6, 7, 8, 9, 10): the stranger as a person of the economy. Each mechanic on a real town (seed 1):
// state in the simulation, consequences in the economy's causal graph (chains), saved and replayed. What these tests cannot
// tell: whether a player would notice any of it (that needs the talk layer and the world to show it: the voice and the plans).
import { describe, it, expect } from 'vitest';
import { Population } from '../src/people/population';
import { Economy } from '../src/people/economy/world';
import { householdsOf, chains } from '../src/people/economy/chains';
import { PLAYER, STR_LAG, type SAct } from '../src/people/speech/stranger';

const pop = new Population(1), hs = householdsOf(pop);
const town = (to: number, acts: SAct[] = []) => { const e = new Economy(1, hs, { trust: true }); const S = e.stranger(); S.hear('Aramaic', 800, 1, true, 0); /* (some Aramaic: complex asks need words, D-370) */ for (const a of acts) S.do(a); for (let d = 0; d <= to; d++) e.step(d); return e; };
const evs = (e: Economy, kind: string) => e.events.filter(v => v && v.kind === kind && (v.actor === PLAYER || v.other === PLAYER));
const step = (e: Economy, n: number, each?: (d: number) => void) => { for (let i = 0; i < n; i++) { const d = e.day + 1; each?.(d); e.step(d); } };
/** the first house of a kind that takes the stranger on, on the day */
const hireAny = (e: Economy, pred: (h: any) => boolean) => { const S = e.stranger(); for (const h of e.hh.values()) { if (!pred(h)) continue; const v = S.do({ a: 'seek_work', day: e.day, hh: h.id }); if (v.ok) return h.id as string; } return null; };

describe('D-370 the stranger in the simulation', () => {
  it('(3) work: hired at the harvest by a real farm, paid from its stores, dismissed for days missed', () => {
    const e = town(40), S = e.stranger();
    const refusal = S.judge({ a: 'seek_work', day: 40, hh: [...e.hh.values()].find(h => h.kind === 'ration')!.id });
    expect(refusal.ok).toBe(false);
    const boss = hireAny(e, h => h.kind === 'farmer' && h.harvestDay >= 42 && h.harvestDay <= 50 && h.grain > 200);
    expect(boss).not.toBeNull();
    const g0 = S.purse.grain, bg0 = e.hh.get(boss!)!.grain;
    step(e, 13, d => S.do({ a: 'attend', day: d })); step(e, STR_LAG); // (settled STR_LAG days behind)
    expect(evs(e, 'wage_paid').length).toBeGreaterThanOrEqual(2);
    expect(S.purse.grain + S.purse.cash * 40).toBeGreaterThan(g0 + 5);
    expect(e.hh.get(boss!)!.grain).not.toBe(bg0);
    expect(S.job?.worked).toBe(13);
    step(e, 3); // two days missed
    expect(S.job).toBeNull(); expect(evs(e, 'dismissed').length).toBe(1);
    expect(e.trust!.trustOf(boss!, PLAYER, e.day)).toBeLessThan(0.5);
  });
  it('(3) work: a house that cannot pay owes the wage in the economy\'s own ledger, and the court can be asked for it (8)', () => {
    const e = town(40), S = e.stranger();
    const boss = hireAny(e, h => h.kind === 'farmer' && h.harvestDay >= 44 && h.harvestDay <= 52)!; const B = e.hh.get(boss)!;
    step(e, 7 + STR_LAG, d => { if (d < e.day + 8) S.do({ a: 'attend', day: d }); B.grain = Math.min(B.grain, B.eaters * 0.55 * 15); B.cash = 0; });
    expect(evs(e, 'wage_owed').length).toBeGreaterThan(0);
    S.do({ a: 'quit', day: e.day });
    expect(B.debts.some(d => d.to === PLAYER)).toBe(true);
    const v = S.do({ a: 'petition', day: e.day, to: 'headman', kind: 'wages', against: boss, q: B.q, gift: 0.2 });
    expect(v.ok).toBe(true);
    step(e, 3);
    const ruling = [...evs(e, 'ruling_for'), ...evs(e, 'ruling_against')];
    expect(ruling.length).toBe(1);
    // the chain: hired -> wage owed -> petition -> ruling (>= 3 events, >= 2 actors)
    const cs = chains(e.events).filter(c => c.actors.includes(PLAYER) && c.shape.includes('stranger_petition'));
    expect(cs.length).toBeGreaterThan(0);
  });
  it('(6) language: comprehension grows with hours heard, faster when simplified, fades unused; people simplify and gesture', () => {
    const e = town(1), S = e.stranger();
    const a = S.register('Elamite', 1, 0.8); expect(a.comp).toBe(0); expect(a.gloss).toBe(1); expect(a.gesture).toBeGreaterThan(0.5);
    for (let d = 1; d < 30; d++) S.hear('Elamite', 4, 1, true, d);
    const mid = S.comp('Elamite', 30); expect(mid).toBeGreaterThan(0.3);
    const b = S.register('Elamite', 30, 0.8); expect(b.gloss).toBeLessThan(a.gloss); expect(b.simplify).toBeLessThan(a.simplify);
    expect(S.register('Elamite', 30, 0.1).simplify).toBeLessThan(b.simplify); // the impatient do not bother
    expect(S.comp('Elamite', 300)).toBeLessThan(mid); // unused, it fades
    S.hear('Aramaic', 100, 0.5, false, 30); expect(S.comp('Babylonian', 30)).toBeGreaterThan(0); expect(S.comp('Greek', 30)).toBe(0); // a related tongue
  });
  it('(6) a house the stranger lives with notices the stranger speaking its tongue', () => {
    const e = town(40), S = e.stranger();
    const host = [...e.hh.values()].find(h => h.kind === 'farmer' && S.stayCheck(h.id, 40).ok)!.id;
    S.do({ a: 'stay', day: 40, hh: host }); S.hear(S.langOf(host), 300, 1, true, 40);
    step(e, 1); expect(evs(e, 'learned_tongue').length).toBe(1);
  });
  it('(7) identity: a claim spreads along kin and lane, and the stranger\'s deeds against it bring doubt', () => {
    const e = town(40), S = e.stranger();
    const first = [...e.hh.values()].find(h => h.kind === 'farmer' && h.harvestDay > 50 && h.harvestDay < 60)!;
    S.do({ a: 'claim', day: 40, hh: first.id, role: 'merchant' });
    step(e, 20); const r = S.claimReach(); expect(r.heard).toBeGreaterThan(3);
    const b0 = S.belief.get(first.id)!.b;
    const boss = hireAny(e, h => h.id === first.id) ?? hireAny(e, h => h.kind === 'farmer' && Math.abs(h.harvestDay - e.day) < 6)!;
    step(e, 12, d => S.do({ a: 'attend', day: d })); step(e, STR_LAG, d => S.do({ a: 'attend', day: d }));
    expect(S.consistency(e.day)).toBeLessThan(0);
    const bb = S.belief.get(boss); if (bb) expect(bb.b).toBeLessThan(Math.max(b0, 0.5)); // (the house that took him on may not have heard the tale yet)
    // a false claim of kinship, made to the very house named, is denied at once and costs trust
    const other = [...e.hh.values()].find(h => h.kind === 'craft')!;
    const t0 = e.trust!.trustOf(other.id, PLAYER, e.day);
    const v = S.do({ a: 'claim', day: e.day, hh: other.id, role: 'kin', kinOf: other.id });
    expect(v.ok).toBe(false); expect(evs(e, 'claim_denied').length).toBe(1);
    expect(e.trust!.trustOf(other.id, PLAYER, e.day)).toBeLessThan(t0);
  });
  it('(8) petitions: leave to stay (a sealed document) from an official; a plea for a house reaches its judgement', () => {
    const e = town(60), S = e.stranger();
    expect(S.judge({ a: 'petition', day: 60, to: 'headman', kind: 'leave' }).ok).toBe(false);
    S.do({ a: 'petition', day: 60, to: 'official', kind: 'leave', gift: 0.3 });
    step(e, 10); expect(evs(e, 'ruling_for').length + evs(e, 'ruling_against').length).toBe(1);
    if (evs(e, 'ruling_for').length) expect(S.halmi).toBeGreaterThan(e.day);
    const poor = [...e.hh.values()].find(h => h.debts.length > 0 && !h.dead)!;
    S.do({ a: 'petition', day: e.day, to: 'court', kind: 'plea', for: poor.id });
    step(e, 17);
    expect(evs(e, 'stranger_petition').length).toBe(2);
  });
  it('(9) hospitality: the guest eats from the host\'s grain; leaving with no return is ingratitude the lane hears', () => {
    const e = town(80), S = e.stranger(); S.purse.cash = 2; // (he has the means to give back and does not)
    const host = [...e.hh.values()].find(h => h.kind === 'farmer' && S.stayCheck(h.id, 80).ok)!; const g0 = host.grain;
    S.do({ a: 'stay', day: 80, hh: host.id }); expect(evs(e, 'hosted').length).toBe(1);
    step(e, 5); expect(host.grain).toBeLessThan(g0); expect(S.stay!.owed).toBeGreaterThan(0);
    const t0 = e.trust!.trustOf(host.id, PLAYER, e.day);
    S.do({ a: 'leave_stay', day: e.day }); step(e, 31);
    expect(evs(e, 'ingrate').length).toBe(1);
    expect(e.trust!.trustOf(host.id, PLAYER, e.day)).toBeLessThan(t0);
    expect(S.stayCheck(host.id, e.day).ok).toBe(false);
    // repaid with a gift: thanks, not a bad name
    const e2 = town(80), S2 = e2.stranger(); S2.purse.cash = 2;
    S2.do({ a: 'stay', day: 80, hh: host.id }); step(e2, 4); S2.do({ a: 'leave_stay', day: e2.day }); S2.do({ a: 'give', day: e2.day, hh: host.id, cash: 0.5 });
    step(e2, 31); expect(evs(e2, 'guest_repaid').length).toBe(1); expect(evs(e2, 'ingrate').length).toBe(0);
    // D-391: a guest with nothing to give is no ingrate (the host thinks a little less of him; the lane hears nothing)
    const e3 = town(80), S3 = e3.stranger(); S3.purse.cash = 0; S3.purse.grain = 0;
    S3.do({ a: 'stay', day: 80, hh: host.id }); step(e3, 3); S3.do({ a: 'leave_stay', day: e3.day }); S3.purse.cash = 0; S3.purse.grain = 0;
    step(e3, 31); expect(evs(e3, 'ingrate').length).toBe(0); expect(S3.stayCheck(host.id, e3.day).ok).toBe(true);
    // D-453: a guest with grain in his sack leaves the host a share for his keep: thanks, not a bad name
    const e4 = town(80), S4 = e4.stranger(); S4.purse.cash = 0; S4.purse.grain = 200; const h4 = e4.hh.get(host.id)!;
    S4.do({ a: 'stay', day: 80, hh: host.id }); step(e4, 4); const g4 = h4.grain; S4.do({ a: 'leave_stay', day: e4.day });
    step(e4, 31); expect(evs(e4, 'ingrate').length).toBe(0); expect(S4.purse.grain).toBeLessThan(200); void g4; expect(e4.events.some(v => v?.kind === 'given' && v.actor === host.id)).toBe(true);
  });
  it('(10) groups: a treasury gang feeds its member; a household takes in a known, trusted hand', () => {
    const e = town(90), S = e.stranger();
    expect(S.do({ a: 'join', day: 90, kind: 'gang' }).ok).toBe(true);
    step(e, 10 + STR_LAG, d => S.do({ a: 'attend', day: d })); expect(S.purse.grain).toBeGreaterThan(3);
    S.do({ a: 'leave_group', day: e.day });
    const host = [...e.hh.values()].find(h => h.kind === 'farmer' && h.workers < 3 && S.stayCheck(h.id, e.day).ok)!;
    expect(S.judge({ a: 'join', day: e.day, kind: 'household', hh: host.id }).ok).toBe(false); // a stranger they hardly know
    S.do({ a: 'stay', day: e.day, hh: host.id }); S.purse.cash = 3;
    step(e, 6 + STR_LAG, d => { if (d % 2 === 0) S.do({ a: 'give', day: d, hh: host.id, cash: 0.3 }); });
    e.trust!.note(host.id, PLAYER, 0.3, e.day); // (a friendship the test does not wait months for)
    const w0 = host.workers, v = S.do({ a: 'join', day: e.day, kind: 'household', hh: host.id });
    expect(v.ok).toBe(true); expect(host.workers).toBe(w0 + 1); expect(evs(e, 'joined_house').length).toBe(1);
    expect(S.stay).toBeNull();
  });
  it('saved and replayed: a scripted stranger replays identically, and a save mid-way goes on the same', () => {
    const acts: SAct[] = [{ a: 'claim', day: 41, hh: 'h:5', role: 'pilgrim', origin: 'Babylonian' }, { a: 'join', day: 45, kind: 'gang' }, ...Array.from({ length: 20 }, (_, i) => ({ a: 'attend' as const, day: 45 + i })),
      { a: 'leave_group', day: 66 }, { a: 'petition', day: 66, to: 'official', kind: 'leave' }, { a: 'hear', day: 67, lang: 'Elamite', hours: 50, simple: 0.5 }];
    const a = town(100, acts), b = town(100, acts);
    expect(JSON.stringify(a.events.slice(-200))).toBe(JSON.stringify(b.events.slice(-200)));
    expect(JSON.stringify(a.stranger().snapshot())).toBe(JSON.stringify(b.stranger().snapshot()));
    const mid = town(55, acts); const r = Economy.restore(JSON.parse(JSON.stringify(mid.snapshot())), hs, { trust: true });
    for (let d = 56; d <= 100; d++) r.step(d);
    expect(r.events.length).toBe(a.events.length);
    expect(JSON.stringify(r.events.slice(-100))).toBe(JSON.stringify(a.events.slice(-100)));
    expect(JSON.stringify(r.stranger().snapshot())).toBe(JSON.stringify(a.stranger().snapshot()));
    // without the stranger the world is untouched (no player input: T-F9's world is the same)
    const none = new Economy(1, hs, { trust: true }); for (let d = 0; d <= 100; d++) none.step(d);
    expect(none.events.some(v => v.actor === PLAYER || v.other === PLAYER)).toBe(false);
  });
  it('(4) haggling: the stranger buys barley from a house with some to spare and sells it again, paid from and into his own stores', () => {
    const e = town(60), S = e.stranger(); S.purse.cash = 5;
    const seller = [...e.hh.values()].find(h => h.kind === 'farmer' && h.grain > h.eaters * 0.55 * 60 && S.judge({ a: 'buy', day: 60, hh: h.id, good: 'grain', qty: 20 }).ok)!;
    const g0 = seller.grain, c0 = S.purse.cash; const v = S.do({ a: 'buy', day: 60, hh: seller.id, good: 'grain', qty: 20 });
    expect(v.ok).toBe(true); expect(S.purse.grain).toBe(20); expect(S.purse.cash).toBeLessThan(c0); expect(seller.grain).toBeCloseTo(g0 - 20, 5);
    expect(e.events.some(x => x.kind === 'haggle_deal' && x.actor === seller.id)).toBe(true);
    expect(S.judge({ a: 'sell', day: 60, hh: seller.id, good: 'grain', qty: 50 }).ok).toBe(false); // not his to sell
    const buyer = [...e.hh.values()].find(h => h.cash > 1 && S.judge({ a: 'sell', day: 60, hh: h.id, good: 'grain', qty: 10 }).ok);
    if (buyer) { const c1 = S.purse.cash; expect(S.do({ a: 'sell', day: 60, hh: buyer.id, good: 'grain', qty: 10 }).ok).toBe(true); expect(S.purse.cash).toBeGreaterThan(c1); expect(S.purse.grain).toBe(10); }
  });
  it('the stranger must eat: his own stores, a host, work; with nothing he goes hungry and people see it', () => {
    const e = town(60), S = e.stranger(); S.purse = { grain: 1.6, cash: 0, fuel: 0, goods: 0 }; S.do({ a: 'hear', day: 60, lang: 'Elamite', hours: 0.1 });
    step(e, 3 + STR_LAG); expect(S.purse.grain).toBeCloseTo(0, 5); expect(S.hungry).toBeGreaterThanOrEqual(1);
    step(e, 3); expect(e.events.some(v => v.kind === 'stranger_hungry')).toBe(true);
    const hh = [...e.hh.values()].find(h => h.kind === 'farmer')!.id; expect(S.factsFor(hh, e.day).some(f => /hungry/.test(f))).toBe(true);
    const host = [...e.hh.values()].find(h => h.kind === 'farmer' && S.stayCheck(h.id, e.day).ok)!; S.do({ a: 'stay', day: e.day, hh: host.id });
    step(e, 1 + STR_LAG); expect(S.hungry).toBe(0);
  });
  it('nights in the open: winter chills him, the watch questions a stranger without a document', () => {
    const e = town(300), S = e.stranger(); S.purse.grain = 100; S.do({ a: 'hear', day: 300, lang: 'Elamite', hours: 0.1 });
    step(e, 30); const k = (x: string) => e.events.filter(v => v.kind === x).length;
    expect(k('stranger_chilled')).toBeGreaterThan(0); expect(k('questioned_by_watch') + k('held_by_watch')).toBeGreaterThan(0);
    const before = k('questioned_by_watch') + k('held_by_watch'); S.halmi = 999; step(e, 20); expect(k('questioned_by_watch') + k('held_by_watch')).toBe(before);
  });
  it('complex asks need words: a stranger with none of the tongue is not understood in a petition or a bargain; gestures do for bread and a bed', () => {
    const e = new Economy(1, hs, { trust: true }); for (let d = 0; d <= 60; d++) e.step(d); const S = e.stranger(); S.purse.cash = 5;
    expect(S.judge({ a: 'petition', day: 60, to: 'official', kind: 'relief' }).why).toMatch(/cannot follow/);
    // D-450: leave to stay before an official goes through the official's interpreter on the days one is at hand (seeded)
    const days = Array.from({ length: 20 }, (_, i) => 41 + i).map(d => S.understood({ a: 'petition', day: d, to: 'official', kind: 'leave' }, d));
    expect(days.some(Boolean)).toBe(true); expect(days.every(Boolean)).toBe(false);
    expect(S.understood({ a: 'petition', day: 60, to: 'headman', kind: 'leave' }, 60)).toBe(false);
    const h = [...e.hh.values()].find(x => x.kind === 'farmer' && S.stayCheck(x.id, 60).ok)!; expect(S.judge({ a: 'stay', day: 60, hh: h.id }).ok).toBe(true);
    S.hear('Aramaic', 400, 1, true, 60); expect(S.judge({ a: 'petition', day: 60, to: 'official', kind: 'leave' }).ok).toBe(true);
  });
});
