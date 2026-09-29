// D-348 (the lead, s13; closes Q-1040): nobody under 18 marries, is betrothed, courts or conceives anywhere in the simulation,
// the population included. Over a seeded year of each seed the project uses (1-8): every wedding (bride and groom), every
// betrothal (the courting days before it), every wife, every pregnancy and birth of the year and the next year's (the mother
// at conception), every child's mother at its birth (the households' histories), and, for seed 1, every relations event,
// pregnancy and courting or lover state. The wedding and birth counts are reported against the seed-1 values before D-348
// (353 weddings, 1,787 births) to keep them plausible.
import { describe, it, expect } from 'vitest';
import { Population, ADULT } from '../src/people/population';
import { Relations } from '../src/people/relations/world';
import { REGNAL_DAYS } from '../src/people/calendar';
import livesData from '../src/data/lives.json';

const L = livesData as any, GEST = L.pregnancy.gestation_days, COURT = L.body_care.court_days;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function check(P: Population) {
  const bad: string[] = []; let weddings = 0, births = 0, due = 0;
  for (let d = 0; d < REGNAL_DAYS; d++) {
    for (const b of P.lifeOn(d).marriages) { const B = P.persons[b]; if (B.moved || B.spouse === undefined) continue; weddings++;
      for (const x of [b, B.spouse]) for (const t of [d, d - COURT]) if (P.ageAt(x, t) < ADULT) bad.push(`wedding/betrothal ${x} on ${t}`); }
    for (const c of P.lifeOn(d).births) { births++; const m = P.persons[c].mother; if (m >= 0 && P.ageAt(m, d - GEST) < ADULT) bad.push(`birth ${c}: mother ${m}`); }
  }
  for (const p of P.persons) {
    if (p.wife && p.age < ADULT) bad.push(`wife ${p.id} aged ${p.age}`);
    if (p.spouse !== undefined && P.ageAt(p.id, Math.min(p.marry, REGNAL_DAYS - 1)) < ADULT) bad.push(`spouse ${p.id}`);
    if (p.sex === 'f') { const k = P.dueIn(p.id, 0); if (k !== null) { due++; if (P.ageAt(p.id, k - GEST) < ADULT) bad.push(`due ${p.id}`); } }
    if (p.mother >= 0 && p.born < 0) { const M = P.persons[p.mother]; if (M.age - p.age < ADULT) bad.push(`history: ${M.id} (${M.age}) mother of ${p.id} (${p.age})`); }
  }
  return { bad, weddings, births, due };
}

describe('D-348: nobody under 18 marries, is betrothed, courts or conceives', () => {
  it('the population, every seed', () => {
    const out: Record<number, { weddings: number; births: number; due: number }> = {};
    for (const s of SEEDS) { const r = check(new Population(s)); out[s] = { weddings: r.weddings, births: r.births, due: r.due }; expect(r.bad.slice(0, 5)).toEqual([]); }
    console.log('D-348 counts', JSON.stringify(out));
    for (const s of SEEDS) { expect(out[s].weddings).toBeGreaterThan(100); expect(out[s].births).toBeGreaterThan(1300); }
  }, 600_000);

  it('the relations layer, seed 1: no event, pregnancy, courting or lover state involves anyone under 18', () => {
    const P = new Population(1), R = new Relations(P, 1); R.advance(REGNAL_DAYS - 1);
    const minor = (x: number | undefined, d: number) => x !== undefined && x >= 0 && P.ageAt(x, d) < ADULT;
    expect(R.events.filter(e => [e.a, e.b, e.c].some(x => minor(x, e.day))).slice(0, 3)).toEqual([]);
    for (const g of R.pregnancies) expect(minor(g.mother, g.conceived) || minor(g.father, g.conceived)).toBe(false);
    for (const pr of R.pairs.values()) { if (pr.status === 'courting' || pr.status === 'lovers' || pr.status === 'betrothed' || pr.status === 'married') expect(minor(pr.a, REGNAL_DAYS - 1) || minor(pr.b, REGNAL_DAYS - 1)).toBe(false);
      if (pr.intimate > 0) expect(minor(pr.a, pr.lastBed * 7) || minor(pr.b, pr.lastBed * 7)).toBe(false); }
    for (const f of R.fathers()) expect(minor(f.mother, f.conceived) || minor(f.father, f.conceived)).toBe(false);
  }, 600_000);
});
