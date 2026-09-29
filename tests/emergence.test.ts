// T-F9 (UD-26): consequence chains per simulated year with no player input, on 3 seeds, and the share of chains a player can
// enter and change through a seeded set of interventions. The threshold stays as written in gates/thresholds.json; this test
// measures and records (REVIEWS/evidence/F/T-F9.json) and asserts only what is built: determinism, the save round trip,
// chains from more than one causal root, and interventions that change outcomes. The honest count is in the evidence file.
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Population } from '../src/people/population';
import { Economy } from '../src/people/economy/world';
import { chains, householdsOf, type Chain } from '../src/people/economy/chains';
import type { Intent } from '../src/people/economy/api';
import { u01, salt } from '../src/people/hash';

const SEEDS = [1, 7, 42], YEAR = 354, N_INT = 10;
const run = (seed: number, hs: ReturnType<typeof householdsOf>, iv: Intent[] = []) => { const e = new Economy(seed, hs, { interventions: iv }); for (let d = 0; d < YEAR; d++) e.step(d); return e; };

/** a seeded intervention entering a chain at its first household event: grain and silver given (action) on odd samples,
 *  speaking for the household before the judge (speech) on even ones, on the day before that event */
function intervention(e: Economy, c: Chain, i: number): Intent {
  // the player meets the chain at the step before its end: the household nearest the end, the day before the last step
  const evs = c.path.map(x => e.events[x]), leaf = evs[evs.length - 1], prev = evs[evs.length - 2];
  const who = [...evs].reverse().map(v => v.actor.startsWith('h:') ? v.actor : v.other?.startsWith('h:') ? v.other : '').find(Boolean)!;
  const day = Math.max(0, prev.day - 1 + (i % 2));
  const court = e.events[c.leaf].actor === 'court' || /suit|accusation/.test(prev.kind);
  void leaf;
  return court ? { kind: 'petition', from: 'player', to: who, day, payload: { days: 120 } }
    : { kind: 'help', from: 'player', to: who, day, payload: { grain: 400, cash: 6 } };
}
const leafKey = (e: Economy, id: number) => { const v = e.events[id]; return `${v.actor}|${v.kind}|${v.other ?? ''}`; };

describe('T-F9 emergent consequence chains', () => {
  const results: any[] = [];
  for (const seed of SEEDS) it(`seed ${seed}: a year of the economy`, () => {
    const pop = new Population(seed); const hs = householdsOf(pop);
    const e = run(seed, hs); const cs = chains(e.events);

    const r = Economy.restore(JSON.parse(JSON.stringify(e.snapshot())) as any, hs); expect(r.events.length).toBe(e.events.length); expect(JSON.stringify(r.events.slice(-50))).toBe(JSON.stringify(e.events.slice(-50))); // the save replays identically
    const roots = new Set(cs.map(c => e.events[c.path[0]].kind));
    // enterable: a seeded sample of chains, each re-run with one intervention; entered if the chain's leaf no longer happens
    const sample = [...cs].sort((a, b) => u01(seed, salt('t-f9'), a.leaf) - u01(seed, salt('t-f9'), b.leaf)).slice(0, N_INT);
    let entered = 0;
    for (const [i, c] of sample.entries()) {
      const iv = intervention(e, c, i); const x = run(seed, hs, [iv]); const k = leafKey(e, c.leaf), d0 = e.events[c.leaf].day;
      if (!x.events.some(v => leafKey(x, v.id) === k && Math.abs(v.day - d0) <= 10)) entered++;
    }
    const kinds: Record<string, number> = {}; for (const v of e.events) kinds[v.kind] = (kinds[v.kind] ?? 0) + 1;
    results.push({ seed, households: hs.length, events: e.events.length, chains: cs.length, shapes: new Set(cs.map(c => c.shape)).size, roots: [...roots],
      longest: Math.max(0, ...cs.map(c => c.path.length)), enterable: entered / Math.max(1, sample.length), sampled: sample.length, kinds,
      examples: cs.slice(0, 5).map(c => c.path.map(i => `${e.events[i].kind}(${e.events[i].actor})`).join(' -> ')) });
    expect(cs.length).toBeGreaterThan(0);
    expect(roots.size).toBeGreaterThanOrEqual(2);
    expect(entered).toBeGreaterThan(0);
  }, 600_000);
  it('records the measurement', () => {
    // strict: distinct shapes over the whole world (r.chains counts shape@leaf-household)
    const min = Math.min(...results.map(r => r.shapes)), ent = Math.min(...results.map(r => r.enterable));
    mkdirSync('REVIEWS/evidence/F', { recursive: true });
    writeFileSync('REVIEWS/evidence/F/T-F9.json', JSON.stringify({ id: 'T-F9', tool: 'tests/emergence.test.ts', value: min, enterable: ent, pass: min >= 50 && ent >= 0.5, perSeed: results }, null, 1) + '\n');
    console.log(JSON.stringify(results.map(r => ({ seed: r.seed, hh: r.households, chains: r.chains, shapes: r.shapes, enterable: r.enterable, ex: r.examples.slice(0, 2) }))));
  });
});
