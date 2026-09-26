// The thresholds ratchet (MASTER_PLAN.md §4.1, UD-12): every threshold of the Walker Test lives in gates/thresholds.json and
// can only tighten. Checked against every committed version of the file (git history), so a threshold cannot be dropped,
// loosened, sampled more thinly or quietly demoted to "to-build" in one commit or in several. A loosening passes only when
// its row carries "loosened_by": a UD-nn of USER_DIRECTIONS.md (the user's own words), never a decision of a session.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

interface Row { id: string; axis: string; metric: string; op: '<=' | '<' | '>=' | '>' | '=='; value: number; unit: string; sample_min: number;
  sample: string; tool: string; status: 'to-build' | 'partial' | 'built'; anti_proxy: string; ud: string; since: string; loosened_by?: string }
const FILE = 'gates/thresholds.json';
const AXES = ['walker', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'R'];
const STATUS = ['to-build', 'partial', 'built'];
const rowsOf = (text: string): Row[] => JSON.parse(text).thresholds;
const now = rowsOf(readFileSync(FILE, 'utf8'));
const byId = new Map(now.map(r => [r.id, r]));
const uds = new Set([...readFileSync('USER_DIRECTIONS.md', 'utf8').matchAll(/^\| (UD-\d{2}) \|/gm)].map(m => m[1]));

/** every committed version of the thresholds file, oldest first ([] where git or its history is unavailable) */
function history(): { rev: string; rows: Row[] }[] {
  try {
    const revs = execFileSync('git', ['log', '--format=%H', '--', FILE], { encoding: 'utf8' }).split('\n').filter(Boolean).reverse();
    return revs.map(rev => ({ rev: rev.slice(0, 8), rows: rowsOf(execFileSync('git', ['show', `${rev}:${FILE}`], { encoding: 'utf8' })) }));
  } catch { return []; }
}
/** true when `b` is at least as strict as `a` under the operator */
function asStrict(op: Row['op'], a: number, b: number): boolean {
  return op === '<=' || op === '<' ? b <= a : op === '>=' || op === '>' ? b >= a : b === a;
}

describe('thresholds ratchet (MASTER_PLAN §4.1)', () => {
  it('every row is well formed, ids unique, each axis present, each UD real', () => {
    expect(byId.size).toBe(now.length);
    for (const r of now) {
      expect(r.id, JSON.stringify(r)).toMatch(/^T-[A-Z][0-9A-Za-z]*$/);
      expect(AXES, r.id).toContain(r.axis);
      expect(['<=', '<', '>=', '>', '=='], r.id).toContain(r.op);
      expect(Number.isFinite(r.value), r.id).toBe(true);
      expect(r.sample_min, r.id).toBeGreaterThanOrEqual(1);
      expect(STATUS, r.id).toContain(r.status);
      expect(r.metric.length && r.unit.length && r.sample.length && r.tool.length, r.id).toBeTruthy();
      expect(uds.has(r.ud), `${r.id}: ${r.ud} is not in USER_DIRECTIONS.md`).toBe(true);
    }
    for (const a of AXES) expect(now.some(r => r.axis === a), `axis ${a} has no threshold`).toBe(true);
  });
  it('a row whose tool is partial or built names a file that exists (to-build rows are the plan\'s honest TO-BUILD list)', () => {
    for (const r of now) if (r.status !== 'to-build') expect(existsSync(r.tool), `${r.id}: ${r.tool} (${r.status})`).toBe(true);
  });
  it('against every committed version: no id removed, no value loosened, no sample thinned, no status demoted', () => {
    const H = history();
    for (const { rev, rows } of H) {
      expect(now.length, `fewer thresholds than at ${rev}`).toBeGreaterThanOrEqual(rows.length);
      for (const old of rows) {
        const r = byId.get(old.id);
        expect(r, `${old.id} (present at ${rev}) was removed`).toBeTruthy();
        if (!r) continue;
        expect(r.op, `${r.id}: operator changed since ${rev}`).toBe(old.op);
        const looser = !asStrict(old.op, old.value, r.value) || r.sample_min < old.sample_min;
        if (looser) expect(r.loosened_by && uds.has(r.loosened_by), `${r.id} loosened since ${rev} (${old.value} → ${r.value}, n ${old.sample_min} → ${r.sample_min}) without a user direction`).toBeTruthy();
        expect(STATUS.indexOf(r.status), `${r.id}: status demoted since ${rev}`).toBeGreaterThanOrEqual(STATUS.indexOf(old.status));
      }
    }
  });
  it('the plan quotes every threshold id, and every T- id the plan quotes exists', () => {
    const plan = readFileSync('MASTER_PLAN.md', 'utf8');
    const quoted = new Set([...plan.matchAll(/\bT-[A-Z][0-9A-Za-z]*\b/g)].map(m => m[0]));
    for (const r of now) expect(quoted.has(r.id), `${r.id} not quoted in MASTER_PLAN.md`).toBe(true);
    for (const q of quoted) expect(byId.has(q), `MASTER_PLAN.md quotes ${q}, which gates/thresholds.json lacks`).toBe(true);
  });
});
