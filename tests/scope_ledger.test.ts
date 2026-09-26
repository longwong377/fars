// The scope ledger (UD-12): the user's directions (USER_DIRECTIONS.md) are append-only and every one is traced in
// MASTER_PLAN.md. This fails if an entry is removed or renumbered, if the ledger shrinks below what it once held, or if the
// plan stops tracing an entry. Raise MIN_ENTRIES when entries are added (never lower it).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const MIN_ENTRIES = 14;

describe('scope ledger (UD-12)', () => {
  const ledger = readFileSync('USER_DIRECTIONS.md', 'utf8'), plan = readFileSync('MASTER_PLAN.md', 'utf8');
  const ids = [...ledger.matchAll(/^\| (UD-\d{2}) \|/gm)].map(m => m[1]);
  it('the ledger is contiguous from UD-01 and never shrinks', () => {
    expect(ids.length).toBeGreaterThanOrEqual(MIN_ENTRIES);
    ids.forEach((id, i) => expect(id).toBe(`UD-${String(i + 1).padStart(2, '0')}`));
  });
  it('every direction is traced in MASTER_PLAN.md §12', () => {
    const trace = plan.slice(plan.indexOf('## 12.'));
    for (const id of ids) expect(trace, `${id} not traced`).toMatch(new RegExp(`\\| ${id} \\|`));
  });
  it('CLAUDE.md sends every session to the ledger and the plan first', () => {
    const c = readFileSync('CLAUDE.md', 'utf8');
    expect(c).toMatch(/USER_DIRECTIONS\.md/); expect(c).toMatch(/MASTER_PLAN\.md/);
  });
});
