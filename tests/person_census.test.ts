// D-390: the person census (tools/dev/person_census.ts) for T-E2, T-E2h, T-E3, T-E3r, T-E3v on 3 seeds. The thresholds stay as
// written in gates/thresholds.json; this test measures and prints each value against its line and asserts only what is
// built (determinism, the checks themselves, the kinds locked), like tests/emergence.test.ts. It writes no evidence file.
import { describe, it, expect } from 'vitest';
import { Population } from '../src/people/population';
import { EventCalendar } from '../src/people/calendar';
import { lifeRecord } from '../src/people/converse/life';
import { systemPrompt } from '../src/people/converse/prompt';
import { pastOf, EVENT_KINDS } from '../src/people/history';
import { marksOf } from '../src/people/marks';
import { nameCensus, historyCensus, traceCensus, nameRoot, sameRoot, kinOf, checkPast } from '../tools/dev/person_census';
import TH from '../gates/thresholds.json';

const SEEDS = [1, 7, 42], DAY = 150, N_TRACE = 200;
const line = (id: string) => { const t = ((TH as any).thresholds ?? TH as any).find((x: any) => x.id === id); return `${t.op} ${t.value} ${t.unit}`; };
const out = (s: string) => process.stdout.write(s + '\n');
const pct = (x: number) => +(100 * x).toFixed(2);

describe('D-390 the person census', () => {
  it('names are compared by root: diacritics, asterisks, doubled letters and one letter apart', () => {
    expect(nameRoot('*Ašbatašda')).toBe(nameRoot('Asbatasda')); expect(nameRoot('Iršanna')).toBe(nameRoot('Irsana'));
    expect(sameRoot(nameRoot('Mardonda'), nameRoot('Mardunda'))).toBe(true); expect(sameRoot(nameRoot('Bakabana'), nameRoot('Bakabada'))).toBe(true);
    expect(sameRoot(nameRoot('Bakabana'), nameRoot('Irdabama'))).toBe(false);
  });
  it('the event kinds are the locked list (T-E3r anti-proxy)', () => {
    expect([...EVENT_KINDS]).toEqual(['realm', 'town', 'birth', 'family', 'work', 'incident', 'loss']);
  });
  it('the consistency check catches what it names (a planted past)', () => {
    const pop = new Population(1), pid = pop.persons.find(p => pop.present(p.id, DAY) && pop.ageOn(p.id, DAY) === 30 && p.sex === 'm')!.id, kin = kinOf(pop, pid, DAY);
    const bad = checkPast(pop, pid, DAY, [{ ago: 0, text: 'x', tier: 'C', kind: 'incident' }, { ago: 40, text: 'y', tier: 'C', kind: 'incident' }, { ago: 7, text: 'remembers z', tier: 'A', kind: 'realm' },
      { ago: 25, text: 'married his wife', tier: 'C', kind: 'family' }], kin, { sibs: new Map(), spouse: null }, 1);
    for (const r of ['after-archive', 'before-birth', 'realm-date', 'too-young']) expect(bad).toContain(r);
  });
  const res: any[] = [];
  for (const seed of SEEDS) it(`seed ${seed}: the whole population on day ${DAY}`, () => {
    const pop = new Population(seed);
    const cal = new EventCalendar(seed, pop, () => ({ rain: 0, lightning: 0, windMs: 2, tempC: 20, dust: 0 }) as any); pop.attach(cal);
    const N = nameCensus(pop, DAY), H = historyCensus(pop, DAY);
    const T = traceCensus(pop, DAY, N_TRACE, pid => /^Before this year: /m.test(systemPrompt(lifeRecord(pop, cal, pid, DAY, 12), 'none')));
    res.push({ seed, N, H, T });
    // what is built: deterministic, every person counted, the past never after the archive's last year
    const pid = pop.persons.find(p => pop.present(p.id, DAY) && pop.ageOn(p.id, DAY) > 40)!.id;
    expect(JSON.stringify(pastOf(pop, pid, DAY, kinOf(pop, pid, DAY)))).toBe(JSON.stringify(pastOf(pop, pid, DAY, kinOf(pop, pid, DAY))));
    expect(H.n).toBeGreaterThan(30000); expect(H.byRule['after-archive'] ?? 0).toBe(0); expect(N.groups.length).toBeGreaterThan(0);
    // D-452: spouses are mutual (no one's husband or wife names another), no two of a house share a name by root, and the men's
    // names are dealt so no name is more than 1 % of a large group (the women's pools are too small: see DECISIONS D-452)
    expect(H.oneSided).toBe(0); expect(N.sameHouse).toBe(0);
    for (const g of N.groups) if (g.key.startsWith('m:')) expect(g.top[0].share, g.key).toBeLessThanOrEqual(0.01);
  }, 600_000);
  it('D-452: a named spouse names back, in every house of a seed (life.ts relOf, as the talk gives it)', () => {
    const pop = new Population(7), day = 200; let pairs = 0;
    for (const p of pop.persons) { if (!pop.present(p.id, day) || p.dies <= day) continue; const k = kinOf(pop, p.id, day).find(x => x.rel === 'wife' || x.rel === 'husband'); if (!k) continue; pairs++;
      const back = kinOf(pop, k.pid, day).find(x => x.pid === p.id); expect(back?.rel, `${p.id} -> ${k.pid}`).toBe(p.sex === 'm' ? 'husband' : 'wife'); }
    expect(pairs).toBeGreaterThan(5000);
  }, 600_000);
  it('D-452: every mark has its cause, and a scar of the past is in the past', () => {
    const pop = new Population(1); let n = 0;
    for (const p of pop.persons.filter(q => pop.present(q.id, DAY) && q.dies > DAY).slice(0, 3000)) { const past = pastOf(pop, p.id, DAY);
      for (const m of marksOf(pop, p.id, DAY)) { n++; expect(m.cause.length, m.look).toBeGreaterThan(5); expect(m.tier).toBe('C');
        if (['scar_brow', 'burn_arm', 'bite_leg', 'tooth_gap', 'crooked_arm'].includes(m.look)) expect(past.some(e => m.cause.startsWith(e.text)), `${p.id} ${m.look}`).toBe(true); } }
    expect(n).toBeGreaterThan(500);
    expect(JSON.stringify(marksOf(pop, 123, DAY))).toBe(JSON.stringify(marksOf(new Population(1), 123, DAY)));
  }, 600_000);
  it('prints each value against its line', () => {
    const worst = (f: (r: any) => number, hi: boolean) => (hi ? Math.max : Math.min)(...res.map(f));
    out(`[census] T-E2  largest name share in a (sex, origin) group > 2000: ${pct(worst(r => r.N.worst, true))} % (line ${line('T-E2')}); per seed ${res.map(r => `${r.seed}: ${pct(r.N.worst)} % ${r.N.worstGroup}`).join(', ')}`);
    for (const g of res[0].N.groups) out(`[census]   seed 1 ${g.key} n ${g.n} unnamed ${g.unnamed}: ${g.top.map((t: any) => `${t.name}${t.attested ? '' : ' (recalled)'} ${pct(t.share)} %`).join(', ')}`);
    out(`[census] T-E2h household members sharing a name by root: ${worst(r => r.N.sameHouse, true)} (line ${line('T-E2h')}); per seed ${res.map(r => `${r.seed}: ${r.N.sameHouse} ${JSON.stringify(r.N.sameHouseByRel)}`).join('; ')}`);
    out(`[census]   e.g. ${res[0].N.examples.slice(0, 3).join(' | ')}`);
    out(`[census] T-E3  people with >= 5 consistent events: ${pct(worst(r => r.H.share, false))} % (line ${line('T-E3')}); per seed ${res.map(r => `${r.seed}: ${pct(r.H.share)} % (adults ${pct(r.H.shareAdults)} %, >=5 events ${pct(r.H.withFive / r.H.n)} %, consistent ${pct(r.H.consistent / r.H.n)} %, mean ${r.H.meanEvents.toFixed(1)} events)`).join('; ')}`);
    out(`[census]   broken rules ${res.map(r => `${r.seed}: ${JSON.stringify(r.H.byRule)}`).join('; ')}; one-sided spouses (life.ts relOf: a 'wife' who names another husband) ${res.map(r => r.H.oneSided).join(', ')}; fewer than 5 by age ${JSON.stringify(res[0].H.thin)}`);
    for (const e of res[0].H.examples) out(`[census]   ${e.slice(0, 400)}`);
    out(`[census] T-E3r pairs sharing the last-4 kind sequence: ${pct(worst(r => r.H.seqPairs, true))} % (line ${line('T-E3r')}); per seed ${res.map(r => `${r.seed}: ${pct(r.H.seqPairs)} % of ${r.H.seqPeople} people, ${r.H.seqDistinct} sequences (first-4 variant ${pct(r.H.firstPairs)} %)`).join('; ')}; top ${JSON.stringify(res[0].H.seqTop.slice(0, 3))}`);
    out(`[census] T-E3v people with a trace a walker can see or hear: ${pct(worst(r => r.T.any, false))} % (line ${line('T-E3v')}); unprompted (seen without speaking) ${pct(worst(r => r.T.unprompted, false))} %, of it drawn by the renderer today ${pct(worst(r => r.T.drawn, false))} %; per seed ${res.map(r => `${r.seed}: talk ${pct(r.T.talk)} %, marks ${pct(r.T.marked)} % ${JSON.stringify(r.T.byLook)}, mourning ${pct(r.T.mourning)} %, limp ${pct(r.T.limp)} %, lame ${r.T.lame} of which ${r.T.lameWithCause} with a cause in the past`).join('; ')}`);
    expect(res.length).toBe(SEEDS.length);
  });
});
