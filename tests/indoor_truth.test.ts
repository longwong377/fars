// D-244: indoors drawn as indoors (MASTER_PLAN §6 order, step 1; UD-07, UD-08). What the crowd would DRAW (the population
// view settled as the renderer's pool is fed, tools/dev/people_trace.ts) against each person's plan, world-wide, on three seeds
// (T-E7: two fixed, one fresh each run, logged) with the court coming and going (the default, UD-10) and without it:
//  - T-D3  nobody drawn out of doors whose plan says indoors, at every moment traced (two moments of rain >= 0.5 and their dry
//          twins, 15 s after a rain begins, 15 s after dark, 23:00 of a clear night, 10:00 of a day with many sick);
//  - T-D3s every household member the plan has asleep at home at 23:00 is DRAWN lying in their own house (hidden is not asleep);
//  - T-D4  people in the open at the rain moments (jobs exempted by evidence: people_trace EXEMPT) <= 10 % of the dry twin's.
// Anti-proxies measured beside them (gates/thresholds.json): the rain does not empty the world (those the plan keeps in are
// drawn inside their rooms: few are left undrawn for want of a built room), the dry day is not emptied (most of the day's
// people are still drawn out of doors), and the sick are drawn nowhere out of doors.
// Timing: a gate is ~2-8 min on an idle box at a quarter of the households (the sample keeps whole households); under load it
// is slower, not failing.
import { describe, it, expect } from 'vitest';
import { randomInt } from 'node:crypto';
import { gate, type GateResult } from '../tools/dev/people_trace';

const SAMPLE = 4;
/** T-E7: a fresh random seed each run (logged; PARSA_FRESH_SEED repeats one) */
const FRESH = process.env.PARSA_FRESH_SEED ? +process.env.PARSA_FRESH_SEED : randomInt(2, 1_000_000);
const CASES: [number, boolean][] = [[1, true], [1, false], [7, true], [FRESH, true]];

function check(g: GateResult) {
  const tag = `seed ${g.seed}${g.court ? '' : ' (no court)'}`;
  console.log(`[indoor_truth] ${tag}: T-D3 ${g.TD3}, T-D3s ${g.TD3s.toFixed(2)} % of ${g.night.sleepers}, T-D4 ${g.TD4.toFixed(2)} % (worst area ${g.TD4area.toFixed(2)} %; ${g.rains.map(r => `day ${r.day} ${r.hour.toFixed(2)} h: ${r.open} of ${r.dryOpen}`).join('; ')}); d3 by moment ${JSON.stringify(g.d3ByMoment)}; no room ${JSON.stringify(g.noRoom)}; sleep fails ${JSON.stringify(g.night.sleepFail)}`);
  expect(g.TD3, `${tag}: T-D3 people drawn out of doors whose plan says indoors ${JSON.stringify(g.d3ByArea)}`).toBe(0);
  expect(g.TD3s, `${tag}: T-D3s asleep at home drawn asleep there (${JSON.stringify(g.night.sleepFail)})`).toBeGreaterThanOrEqual(100);
  expect(g.TD4, `${tag}: T-D4 in the open in the rain as a share of the dry day`).toBeLessThanOrEqual(10);
  expect(g.TD4area, `${tag}: T-D4 at its scope, the worst area (${JSON.stringify(g.rains.map(r => r.worstArea))})`).toBeLessThanOrEqual(10);
  expect(g.areasJudged, `${tag}: rain days x areas judged`).toBeGreaterThanOrEqual(8);
  expect(g.night.sleepers, `${tag}: households asleep at 23:00 traced`).toBeGreaterThan(20);
  for (const m of g.moments) {
    const r = m.r, what = `${tag} ${m.kind} day ${m.day} ${m.hour.toFixed(3)} h`;
    // (the anti-proxies: the rain and the night are not an emptied world; the plan's indoors are drawn indoors)
    expect(r.noRoom / Math.max(1, r.present), `${what}: left undrawn for want of a built room`).toBeLessThan(0.02);
    if (m.kind === 'rain' || m.kind === 'night') expect((r.drawnIn + r.drawnOpen + r.withCarer) / Math.max(1, r.present), `${what}: drawn somewhere (indoors or out)`).toBeGreaterThan(0.8);
    if (m.kind === 'dry') expect(r.drawnOpen / Math.max(1, r.present), `${what}: the dry day's people out of doors`).toBeGreaterThan(0.5);
    expect(r.sickDrawn - r.sickDrawnIn, `${what}: the sick drawn out of doors`).toBe(0);
  }
}

describe('indoors drawn as indoors (D-244: T-D3, T-D3s, T-D4)', () => {
  for (const [seed, court] of CASES)
    it(`seed ${seed}${seed === FRESH ? ' (fresh, T-E7)' : ''}${court ? ', the court coming and going' : ', no court'}`, () => { check(gate(seed, SAMPLE, court)); }, 3_600_000);
});
