// The scope ledger (UD-12): the user's directions (USER_DIRECTIONS.md) are append-only and every one is traced in
// MASTER_PLAN.md. This fails if an entry is removed or renumbered, if the ledger shrinks below what it once held, or if the
// plan stops tracing an entry. Raise MIN_ENTRIES when entries are added (never lower it). Since rev 2 (the critique): the axes
// A–K and R stay in the plan, every trace row is measured by a real threshold id or an existing file (not "—"), and the
// reviewer and agent brief templates keep the scope words. The thresholds themselves: tests/gates_ratchet.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

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
  it('CLAUDE.md sends every session to the ledger, the plan and the thresholds first', () => {
    const c = readFileSync('CLAUDE.md', 'utf8');
    expect(c).toMatch(/USER_DIRECTIONS\.md/); expect(c).toMatch(/MASTER_PLAN\.md/); expect(c).toMatch(/gates\/thresholds\.json/);
  });
  it('the plan keeps its axes A–K and R, the illusion-break log, the ratchet, the sampling design and the area registry', () => {
    for (const a of 'ABCDEFGHIJKR') expect(plan, `axis ${a}`).toMatch(new RegExp(`^\\*\\*${a}\\. `, 'm'));
    for (const h of ['illusion-break log', '### 4.1 Thresholds are data and only tighten', '### 4.2 How coverage is measured', '### 4.3 The world']) expect(plan).toContain(h);
  });
  it('every trace row is measured by a threshold id in gates/thresholds.json or an existing file', () => {
    const ids = new Set(JSON.parse(readFileSync('gates/thresholds.json', 'utf8')).thresholds.map((r: { id: string }) => r.id));
    const rows = plan.slice(plan.indexOf('## 12.'), plan.indexOf('## 13.')).split('\n').filter(l => /^\| UD-\d{2} \|/.test(l));
    expect(rows.length).toBe(ids.size > 0 ? [...ledger.matchAll(/^\| (UD-\d{2}) \|/gm)].length : -1);
    for (const l of rows) {
      const cell = l.split('|').slice(-2, -1)[0].trim(), refs = cell.split(',').map(x => x.trim()).filter(Boolean);
      expect(refs.length, l).toBeGreaterThan(0);
      for (const r of refs) expect(ids.has(r) || existsSync(r), `${l.slice(0, 8)}: "${r}" is neither a threshold id nor a file`).toBe(true);
    }
  });
  it('the reviewer and agent brief templates keep the scope words', () => {
    const scope = ['every walkable area', "the player's lens and quality", 'in motion', 'with sound', 'at every hour, season and weather'];
    const r = readFileSync('handoff/review_template.md', 'utf8'), a = readFileSync('handoff/agent_template.md', 'utf8');
    for (const w of [...scope, 'Judge as a scene', 'how could this pass while the intent fails', 'anchor set']) expect(r, w).toContain(w);
    for (const w of [...scope, 'how your change could pass its tests while the intent fails', 'gates/thresholds.json']) expect(a, w).toContain(w);
  });
});
