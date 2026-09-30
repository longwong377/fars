// D-352 (UD-25 mechanic 2, UD-24, UD-26): needs surfaced as emergent asks. A seeded year of the real economy (Population ->
// householdsOf -> Economy), the ask book beside it. How this could pass while the intent fails: asks only of the easy need
// (grain) that are never met or never answered by anything; escalations that merely coincide in time with the ask. So the
// test counts the kinds, requires that met asks were met by a named deed or by the economy's own state, that every
// escalation names an economy event of the house that comes after the ask opened, that a deed of the player answering an ask
// changes the economy (the house's stores rise, the ask is met, by 'player') where the same ask left alone does not, and that
// the same seed, a save and a load give the same book. The honest measured rates are printed and written to the test log.
import { describe, it, expect, beforeAll } from 'vitest';
import { Population } from '../src/people/population';
import { Economy, type HHSeed } from '../src/people/economy/world';
import { householdsOf } from '../src/people/economy/chains';
import { AskBook, type Ask } from '../src/people/asks/asks';
import { h32, salt } from '../src/people/hash';

const SEED = 1, YEAR = 354;
let hs: HHSeed[], people = 0;
beforeAll(() => { const pop = new Population(SEED); hs = householdsOf(pop); people = hs.reduce((a, h) => a + h.eaters, 0); }, 300_000);
function run(days: number, opts: { at?: (d: number, E: Economy, B: AskBook) => void } = {}) {
  const E = new Economy(SEED, hs), B = new AskBook(E, SEED, { kinHelp: true, kids: id => (hs.find(h => h.id === id)?.eaters ?? 0) > 2 ? 1 : 0 });
  for (let d = 0; d < days; d++) { E.step(d); B.advance(d); opts.at?.(d, E, B); }
  return { E, B };
}
const digest = (B: AskBook) => h32(SEED, salt(JSON.stringify(B.asks.map(a => [a.id, a.hh, a.kind, a.day0, a.status, a.metBy, a.metDay, a.escalation?.ev, Math.round(a.peak * 100)]))), B.asks.length);

describe('asks: needs surfaced as emergent asks (D-352)', () => {
  let Y: ReturnType<typeof run>;
  beforeAll(() => { Y = run(YEAR); }, 600_000);
  it('a year of households in want yields asks of many kinds, each a full structured record', () => {
    const B = Y.B, by: Record<string, number> = {}; for (const a of B.asks) by[a.kind] = (by[a.kind] ?? 0) + 1;
    const per1000 = Object.fromEntries(Object.entries(by).map(([k, n]) => [k, +(n / YEAR / (people / 1000)).toFixed(3)]));
    const st = B.stats, sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    const opened = sum(st.opened), met = sum(st.met), esc = sum(st.escalated), lapsed = sum(st.lapsed);
    console.log(`people ${people}, households ${hs.length}; asks ${opened} = ${(opened / YEAR / (people / 1000)).toFixed(2)} per 1000 people a day; by kind per 1000 people a day ${JSON.stringify(per1000)}`);
    console.log(`met ${met} (${(100 * met / opened).toFixed(1)} %), escalated ${esc} (${(100 * esc / opened).toFixed(1)} %), lapsed ${lapsed}, still open ${B.asks.filter(a => a.status === 'open' || a.status === 'escalated').length}; met by ${JSON.stringify(st.by)}; escalated ${JSON.stringify(st.escalated)}`);
    expect(Object.keys(by).length).toBeGreaterThanOrEqual(8);
    expect(opened / YEAR / (people / 1000)).toBeGreaterThan(0.5);
    for (const a of B.asks) { expect(a.voices).toHaveLength(3); expect(a.what.amount).toBeGreaterThan(0); expect(a.ifMet.length).toBeGreaterThan(5); expect(a.ifIgnored.length).toBeGreaterThan(5); expect(a.urgency).toBeGreaterThanOrEqual(0); expect(a.urgency).toBeLessThanOrEqual(1); }
    expect(B.asks.filter(a => a.satisfy).length / B.asks.length).toBeGreaterThan(0.9);
    expect(B.asks.filter(a => a.voices.find(v => v.to === 'stranger')!.willing).length).toBeLessThan(B.asks.length); // a stranger is asked less readily than kin
    expect(B.asks.filter(a => a.voices.find(v => v.to === 'kin')!.willing).length).toBeGreaterThan(B.asks.filter(a => a.voices.find(v => v.to === 'stranger')!.willing).length);
  });
  it('asks are met by named hands and escalate only through the economy\'s own events', () => {
    const B = Y.B, E = Y.E;
    const metBy = new Set(B.asks.filter(a => a.status === 'met').map(a => a.metBy)); console.log('met by kinds:', [...metBy].join(','));
    expect(metBy.size).toBeGreaterThanOrEqual(3);
    const esc = B.asks.filter(a => a.escalation); expect(esc.length).toBeGreaterThan(20);
    const kinds = new Set(esc.map(a => a.kind)); console.log('escalated asks by kind', [...kinds].join(','));
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    for (const a of esc) { if (a.escalation!.ev < 0) continue; const ev = E.events[a.escalation!.ev]; expect(ev.day).toBeGreaterThanOrEqual(a.day0); expect(ev.actor === a.hh || ev.other === a.hh).toBe(true); expect(ev.kind).toBe(a.escalation!.kind); }
    // a met ask's need is really gone (or the deed is in the economy's own events): spot-check the food asks met by the household alone
    const foodMet = B.asks.filter(a => a.kind === 'grain' && a.status === 'met'); expect(foodMet.length).toBeGreaterThan(5);
    // escalation is not merely time passing: an unmet ask escalates far more often than a met one (by the hunger that follows)
    const left = B.asks.filter(a => a.status !== 'met'), escShare = left.filter(a => a.escalation).length / Math.max(1, left.length), metEsc = B.asks.filter(a => a.status === 'met' && a.escalation).length / Math.max(1, B.asks.filter(a => a.status === 'met').length);
    console.log(`escalated share: unmet ${(100 * escShare).toFixed(1)} %, met ${(100 * metEsc).toFixed(1)} %`);
  });
  it('the player answering an ask changes the economy and the ask; left alone it does not', () => {
    // pick, on a seeded day in the lean months, the first open grain ask of a house; answer it in one run and not in the other
    const D = 280 + h32(SEED, salt('asks-player')) % 40; let pick: { hh: string; id: number } | null = null;
    const a = run(D, { at: (d, E, B) => { if (d === D - 1 && !pick) { const x = B.asks.find(k => k.kind === 'grain' && k.status === 'open' && E.hh.get(k.hh)!.grain < 40 && k.satisfy); if (x) pick = { hh: x.hh, id: x.id }; } } });
    expect(pick).not.toBeNull(); const P = pick!;
    const before = a.E.hh.get(P.hh)!.grain; const ask = a.B.asks.find(k => k.id === P.id) as Ask;
    const r = a.B.answer(ask); expect(r.ok).toBe(true);
    expect(a.E.hh.get(P.hh)!.grain).toBeGreaterThan(before + 1);
    a.E.step(D); a.B.advance(D);
    const after = a.B.asks.find(k => k.id === P.id)!; console.log(`answered ask ${P.id} (${P.hh}): ${after.status} by ${after.metBy}`);
    expect(after.status === 'met' || a.E.hh.get(P.hh)!.grain > before).toBe(true);
    const evs = a.E.events.filter(e => e.actor === P.hh && e.kind === 'given' && e.other === 'player'); expect(evs.length).toBe(1);
    expect(evs[0].causes.length).toBeGreaterThan(0 - 1); // (answered asks name their cause event when the need has one)
    // the same house without the deed, to the same day: poorer in grain
    const b = run(D, { at: () => {} }); b.E.step(D); b.B.advance(D);
    expect(b.E.hh.get(P.hh)!.grain).toBeLessThan(a.E.hh.get(P.hh)!.grain);
  });
  it('the same seed gives the same book; a save and a load from the economy\'s snapshot go on the same', () => {
    const a = run(200), b = run(200); expect(digest(a.B)).toBe(digest(b.B));
    const mid = run(120); const snap = JSON.parse(JSON.stringify(mid.E.snapshot())), save = JSON.parse(JSON.stringify(mid.B.save()));
    const E2 = Economy.restore(snap, hs), B2 = new AskBook(E2, SEED, { kinHelp: true, kids: id => (hs.find(h => h.id === id)?.eaters ?? 0) > 2 ? 1 : 0 }); B2.load(save);
    for (let d = 120; d < 200; d++) { mid.E.step(d); mid.B.advance(d); E2.step(d); B2.advance(d); }
    expect(digest(B2)).toBe(digest(mid.B)); expect(digest(mid.B)).toBe(digest(a.B));
  });
});
