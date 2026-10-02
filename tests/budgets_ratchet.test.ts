// The merge budget only tightens (session 15; tools/dev/budget.mjs, gates/budgets.json): against every committed version, no
// target and no baseline value may grow (a heavier, slower game cannot be accepted by editing the file), the tolerance never
// widens, and a metric once baselined is never dropped.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const F = 'gates/budgets.json';
const versions = (): any[] => git('log', '--format=%H', '--', F).split('\n').filter(Boolean)
  .map(r => { try { return JSON.parse(git('show', `${r}:${F}`)); } catch { return null; } }).filter(Boolean);

describe('the merge budget (session 15)', () => {
  it('targets and baselines only tighten; the tolerance never widens', () => {
    const cur = JSON.parse(readFileSync(F, 'utf8'));
    for (const v of versions()) {
      for (const [k, x] of Object.entries<number>(v.target ?? {})) expect(cur.target[k], `target ${k} loosened`).toBeLessThanOrEqual(x);
      for (const [k, x] of Object.entries<number>(v.baseline ?? {})) {
        expect(cur.baseline?.[k], `baseline ${k} dropped`).not.toBeUndefined();
        expect(cur.baseline[k], `baseline ${k} loosened`).toBeLessThanOrEqual(x);
      }
      expect(cur.tolerance, 'tolerance widened').toBeLessThanOrEqual(v.tolerance);
    }
  });
});
