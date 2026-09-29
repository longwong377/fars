// D-346 (ROADMAP 3e): relationships and sexuality as life, node side. On a seeded year of the whole town and plain: marriages,
// affairs, divorces and scandals per 1,000 adults, each checked to have arisen from the pair's state at the time (the
// thresholds of law.ts REL are necessary conditions, and with desire ablated nothing of it happens at all); a discovered
// affair makes divorce far likelier; replay is identical; nobody under 18 takes part in any of it; the player's API (court,
// propose, share a home and a bed, take a lover) works through the same state and the partner remembers; the fertility hook
// feeds the population's birth draw; the bride-gifts, dowries and divorce silver enter the economy.
// How this could pass while the intent fails: events drawn at random with the state merely recorded (answered by the
// ablation and the discovery-divorce contrast), or rates that are plausible only because thresholds were tuned to them (the
// rates are reported, not gated tightly; RECON numbers in law.ts, D-346). Measures go to bench-reports/relations.json.
import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Population } from '../src/people/population';
import { Relations, PLAYER, type RelEvent } from '../src/people/relations/world';
import { REL } from '../src/people/relations/law';
import type { Intent } from '../src/people/economy/api';
import { Economy } from '../src/people/economy/world';
import { householdsOf } from '../src/people/economy/chains';

let P: Population; let R: Relations; const intents: Intent[] = []; let adults = 0; const OUT: Record<string, unknown> = {};
const write = () => { mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/relations.json', JSON.stringify(OUT, null, 1)); };
beforeAll(() => {
  P = new Population(1); R = new Relations(P, 1, { econ: i => intents.push(i) });
  const t = performance.now(); R.advance(353); OUT.yearMs = Math.round(performance.now() - t);
  for (const p of P.persons) { const z = P.households[p.hh].zone; if ((z === 'town' || z === 'plain') && p.age >= 18) adults++; }
}, 600_000);

describe('relations (ROADMAP 3e)', () => {
  it('a seeded year: marriages, affairs, divorces, scandals per 1,000 adults', () => {
    const c = R.counts(), per = (n: number) => +(n / adults * 1000).toFixed(2);
    const rates = { marriages: per((c.wed ?? 0) + (c.wed_arranged ?? 0)), ofWhichFromCourtship: per(c.wed ?? 0), courtships: per(c.court ?? 0), rejections: per(c.reject ?? 0), familyRefusals: per(c.refused ?? 0),
      affairs: per(c.affair ?? 0), discovered: per(c.discovered ?? 0), divorces: per(c.divorce ?? 0), scandals: per(R.news.length), conceptions: per(c.conceive ?? 0), doubtfulParentage: per(c.doubt ?? 0) };
    const fathers = R.fathers();
    Object.assign(OUT, { adults, counts: c, per1000Adults: rates, stats: R.stats, newsHearers: R.news.reduce((a, n) => a + n.knows.size, 0),
      populationBirthsAndDues: fathers.length, doubtEvents: c.doubt ?? 0, birthsFatherKnown: fathers.filter(f => f.father >= 0).length, birthsDoubtful: fathers.filter(f => f.doubt.length).length,
      populationBridesUnder18: P.persons.filter(p => p.sex === 'f' && p.spouse !== undefined && p.marry < 1e9 && P.ageOn(p.id, p.marry) < 18).length });
    write();
    expect(fathers.filter(f => f.doubt.length).length + (c.doubt ?? 0)).toBeGreaterThan(0);
    for (const k of ['marriages', 'ofWhichFromCourtship', 'affairs', 'divorces', 'scandals', 'conceptions'] as const) { expect(rates[k]).toBeGreaterThan(0.5); expect(rates[k]).toBeLessThan(30); }
  });

  it('each event arises from the pair state', () => {
    const byPair = new Map<string, RelEvent[]>(); const pk = (e: RelEvent) => `${Math.min(e.a, e.b)}:${Math.max(e.a, e.b)}`;
    for (const e of R.events) (byPair.get(pk(e)) ?? byPair.set(pk(e), []).get(pk(e))!).push(e);
    let checked = 0;
    for (const e of R.events) {
      const s = e.s;
      if (e.kind === 'court') { expect(Math.min(s.wantA, s.wantB)).toBeGreaterThanOrEqual(REL.courtDesire); expect(s.aff).toBeGreaterThanOrEqual(REL.courtAff); checked++; }
      if (e.kind === 'betroth' && e.a !== PLAYER) { expect(s.aff).toBeGreaterThanOrEqual(REL.betrothAff); expect(s.trust).toBeGreaterThanOrEqual(REL.betrothTrust); expect(byPair.get(pk(e))!.some(x => x.kind === 'court' && x.day < e.day)).toBe(true); checked++; }
      if (e.kind === 'wed') { expect(byPair.get(pk(e))!.some(x => x.kind === 'betroth' && x.day < e.day)).toBe(true); checked++; }
      if (e.kind === 'affair') { expect(Math.min(s.wantA, s.wantB)).toBeGreaterThanOrEqual(REL.affairDesire); expect(s.fam).toBeGreaterThanOrEqual(REL.affairFam);
        expect(s.spouseAffA !== undefined || s.spouseAffB !== undefined).toBe(true); for (const v of [s.spouseAffA, s.spouseAffB]) if (v !== undefined) expect(v).toBeLessThan(REL.affairSpouseAff + 1e-3); checked++; }
      if (e.kind === 'divorce') { expect(s.aff).toBeLessThan(REL.divorceAff + 1e-3); expect(s.trust).toBeLessThan(REL.divorceTrust + 1e-3); checked++; }
      if (e.kind === 'reject') { expect(Math.max(s.wantA, s.wantB)).toBeGreaterThanOrEqual(REL.advanceDesire - 1e-3); expect(Math.min(s.wantA, s.wantB)).toBeLessThan(REL.rejectBelow + 1e-3); checked++; }
      if (e.kind === 'conceive') { expect(e.b >= 0 || e.b === PLAYER).toBe(true); checked++; }
    }
    for (const n of R.news) expect(R.events[n.ev]).toBeDefined();
    // a discovered affair makes divorce far likelier than a marriage's base rate
    const disc = new Set(R.events.filter(e => e.kind === 'discovered' && e.c !== undefined).map(e => `${Math.min(e.a, e.c!)}:${Math.max(e.a, e.c!)}`));
    const div = new Set(R.events.filter(e => e.kind === 'divorce').map(pk)); const married = [...R.pairs.values()].filter(p => p.wedDay < 1e9 && p.status !== 'betrothed').length;
    const afterDisc = [...disc].filter(k => div.has(k)).length / Math.max(1, disc.size), base = div.size / Math.max(1, married);
    Object.assign(OUT, { eventsChecked: checked, divorceAfterDiscovery: +afterDisc.toFixed(3), divorceBase: +base.toFixed(4) }); write();
    expect(checked).toBeGreaterThan(200); expect(afterDisc).toBeGreaterThan(5 * base);
  });

  it('with desire ablated, no courting, rejection, lover or affair arises; replay is identical', () => {
    const A = new Relations(P, 1, { ablate: true }); A.advance(90); const ca = A.counts();
    for (const k of ['court', 'reject', 'affair', 'lovers', 'betroth', 'wed', 'conceive']) expect(ca[k] ?? 0).toBe(0);
    const R2 = new Relations(P, 1); R2.advance(90);
    const early = (x: Relations) => JSON.stringify(x.events.filter(e => e.day < 91));
    expect(early(R2)).toBe(early(R)); expect(R.events.filter(e => e.day < 91 && ['court', 'reject', 'affair'].includes(e.kind)).length).toBeGreaterThan(0);
    OUT.ablation = { days: 90, counts: ca }; OUT.replay = { days: 90, identical: true }; write();
  }, 600_000);

  it('nobody under 18 takes part in any of it', () => {
    const minor = (x: number | undefined, d: number) => x !== undefined && x >= 0 && P.ageOn(x, d) < REL.adult;
    const bad = R.events.filter(e => [e.a, e.b, e.c].some(x => minor(x, e.day))); expect(bad.slice(0, 3)).toEqual([]);
    for (const g of R.pregnancies) { expect(minor(g.mother, g.conceived)).toBe(false); expect(minor(g.father, g.conceived)).toBe(false); }
    let beds = 0; for (const pr of R.pairs.values()) if (pr.intimate > 0) { beds++; const d = pr.lastBed * 7 + 3; expect(minor(pr.a, d) || minor(pr.b, d)).toBe(false); if (pr.status === 'lovers' || pr.status === 'courting') expect(minor(pr.a, 353) || minor(pr.b, 353)).toBe(false); }
    // desire itself is zero toward and from anyone under 18
    const kids = P.persons.filter(p => p.age >= 12 && p.age < 17 && (P.households[p.hh].zone === 'town' || P.households[p.hh].zone === 'plain')).slice(0, 300);
    const grown = P.persons.filter(p => p.age >= 20 && p.age < 40 && P.households[p.hh].zone === 'town').slice(0, 50);
    for (const k of kids) for (const g of grown) { expect(R.want(g.id, k.id, 10, 1)).toBe(0); expect(R.want(k.id, g.id, 10, 1)).toBe(0); }
    // the player's API refuses every act of courting, love and bed with a minor, and there is no act of undressing anyone
    const X = new Relations(P, 1); const k = kids[0].id;
    for (const a of ['court', 'propose', 'take_lover', 'share_bed', 'share_home'] as const) expect(X.act(k, 5, a).ok).toBe(false);
    for (const n of Object.getOwnPropertyNames(Relations.prototype)) expect(/undress|strip|disrobe|naked/i.test(n)).toBe(false);
    OUT.minors = { events: R.events.length, pregnancies: R.pregnancies.length, intimatePairs: beds, kidsChecked: kids.length, apiRefused: true }; write();
  }, 600_000);

  it('the player: court, marry, share a home and a bed (cut away); the partner remembers; save/load replays', () => {
    const X = new Relations(P, 1, { player: { sex: 'm', age: 30 } });
    const cands = P.persons.filter(p => p.sex === 'f' && p.single && p.age >= 20 && p.age <= 30 && p.marry >= 1e9 && p.dies > 400 && P.households[p.hh].zone === 'town' && X.want(p.id, PLAYER, 5, 0.5) > 0.45).slice(0, 4).map(p => p.id);
    expect(cands.length).toBeGreaterThan(1);
    for (let d = 3; d <= 45; d += 7) for (const c of cands) { X.act(c, d, 'talk'); X.act(c, d + 1, d % 2 ? 'gift' : 'help'); }
    const courted = cands.filter(c => X.act(c, 50, 'court').ok); expect(courted.length).toBeGreaterThan(0);
    for (const c of courted) X.act(c, 60, 'gift');
    let wife = -1, wd = 0; for (const c of courted) { const r = X.act(c, 90, 'propose'); if (r.ok) { wife = c; wd = r.weddingDay!; break; } }
    expect(wife).toBeGreaterThanOrEqual(0);
    X.advance(wd + 1); expect(X.spouseOn(wife, wd + 1)).toBe(PLAYER);
    expect(X.act(wife, wd + 3, 'share_home').ok).toBe(true); expect(X.homeOf(PLAYER, wd + 4)).toBe(X.homeOf(wife, wd + 4));
    const bed = X.act(wife, wd + 5, 'share_bed'); expect(bed.ok).toBe(true); expect(bed.cutAway).toBe(true);
    X.act(wife, wd + 12, 'slight');
    const mem = X.memoryOf(wife); expect(mem.some(m => m.kind === 'gift')).toBe(true); expect(mem.some(m => m.kind === 'wed')).toBe(true); expect(mem.some(m => m.kind === 'slight' && m.aff < 0.9)).toBe(true);
    const mood = X.moodOf(wife, wd + 13);
    const Y = new Relations(P, 1, { player: { sex: 'm', age: 30 } }); Y.load(JSON.parse(JSON.stringify(X.save()))); Y.advance(wd + 13);
    expect(JSON.stringify(Y.memoryOf(wife))).toBe(JSON.stringify(mem)); expect(Y.spouseOn(wife, wd + 13)).toBe(PLAYER);
    OUT.player = { candidates: cands.length, courted: courted.length, wife, weddingDay: wd, memory: mem.length, mood, bed }; write();
  }, 600_000);

  it('the player takes a lover: refused where she does not want it; with a married woman, an affair that can be found out; she remembers', () => {
    const X = new Relations(P, 1, { player: { sex: 'm', age: 30 } });
    const wives = P.persons.filter(p => p.sex === 'f' && p.age >= 20 && p.age <= 34 && p.dies > 400 && X.spouseOn(p.id, 5) >= 0 && P.households[p.hh].zone === 'town');
    const keen = wives.filter(p => X.want(p.id, PLAYER, 5, 0.5) > 0.45).slice(0, 3).map(p => p.id), cold = wives.find(p => X.want(p.id, PLAYER, 5, 1) === 0)!.id;
    expect(keen.length).toBeGreaterThan(0);
    for (let d = 3; d <= 45; d += 7) for (const c of keen) { X.act(c, d, 'gift'); X.act(c, d + 1, 'help'); }
    const no = X.act(cold, 46, 'take_lover'); expect(no.ok).toBe(false);
    const lover = keen.find(c => X.act(c, 50, 'take_lover').ok); expect(lover).toBeDefined();
    const bed = X.act(lover!, 51, 'share_bed'); expect(bed.ok).toBe(true); expect(bed.cutAway).toBe(true);
    for (let d = 58; d <= 240; d += 7) X.act(lover!, d, 'share_bed');
    X.advance(250); const mem = X.memoryOf(lover!), found = X.events.find(e => e.kind === 'discovered' && (e.a === lover || e.b === lover) && (e.a === PLAYER || e.b === PLAYER));
    expect(mem.some(m => m.kind === 'affair')).toBe(true); expect(mem.filter(m => m.kind === 'intimate').length).toBeGreaterThan(1);
    OUT.playerLover = { refusedWhereNoDesire: !no.ok, lover, nights: mem.filter(m => m.kind === 'intimate').length, foundOut: found ? found.day : null, moodAfter: X.moodOf(lover!, 250), husbandMood: X.moodOf(X.spouseOn(lover!, 5), 250) }; write();
  }, 600_000);

  it('the couple feeds the population’s birth draw (the one hook); the dowries and news enter the economy', () => {
    const births = (Q: Population) => { let n = 0; for (let d = 0; d < 354; d++) n += Q.lifeOn(d).births.length; return n; };
    const f = R.fertility(); const P0 = new Population(1), P1 = new Population(1, { fertility: f });
    expect(births(P0)).toBe(births(P)); // (no hook: the population is unchanged)
    const b1 = births(P1), zero = P.persons.filter(p => p.wife && f(p.id) === 0).map(p => p.id);
    const zeroBirths = zero.filter(i => P1.childrenOf(i).some(c => P1.persons[c].born >= 0)).length;
    OUT.fertility = { birthsWithout: births(P0), birthsWithHook: b1, wivesWithoutHusbandAtYearEnd: zero.length, theirBirths: zeroBirths }; write();
    expect(zeroBirths).toBe(0); expect(Math.abs(b1 - births(P0)) / births(P0)).toBeLessThan(0.1);
    const kinds: Record<string, number> = {}; for (const i of intents) kinds[String(i.payload.what)] = (kinds[String(i.payload.what)] ?? 0) + 1;
    const E = new Economy(1, householdsOf(P), { interventions: intents }); for (let d = 0; d <= 353; d++) E.step(d);
    const given = E.events.filter(e => e.kind === 'given' && intents.some(i => i.to === e.actor && i.day === e.day)).length, news = E.events.filter(e => e.kind === 'news').length;
    expect(kinds['dowry'] ?? 0).toBeGreaterThan(0); expect(given).toBeGreaterThan(0);
    OUT.fertility = { birthsWithout: births(P0), birthsWithHook: b1, wivesWithoutHusbandAtYearEnd: zero.length, theirBirths: zeroBirths }; OUT.economy = { intents: intents.length, kinds, givenEvents: given, newsEvents: news }; write();
  }, 600_000);
});
