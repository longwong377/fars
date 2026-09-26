// The thresholds ratchet (MASTER_PLAN.md §4.1, UD-12): every threshold of the Walker Test lives in gates/thresholds.json and
// can only tighten. Rev 2.1 (the second critique's attacks R1–R14, REVIEWS/master_plan_critique_rev2.md §2):
// - it fails CLOSED: no git, a missing baseline, or any committed version that does not parse is a failure, never a skip;
// - it compares against every committed version reachable from HEAD AND every `ratchet/*` tag (pushed at every session close),
//   and requires the rev 2 baseline to be an ancestor (a squash cannot erase history);
// - metric, unit, axis, scope, op and sample never change; tool never changes once a row is partial or built;
// - values only tighten and sample_min never falls, unless "loosened_by" names a UD whose own text names the id and new value;
// - a threshold proven wrong in principle takes "superseded_by" with gates/errata/<id>.md (it stays, and reads SUPERSEDED);
// - status is derived from evidence (REVIEWS/evidence/**/<id>.json written by the row's tool); demotion is always allowed;
// - every row states an anti-proxy (≥ 20 characters).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

type Op = '<=' | '<' | '>=' | '>' | '==';
interface Row { id: string; axis: string; scope: string; metric: string; op: Op; value: number; unit: string; sample_min: number;
  sample: string; tool: string; status: 'to-build' | 'partial' | 'built'; anti_proxy: string; ud: string; since: string;
  loosened_by?: string; superseded_by?: string }
const FILE = 'gates/thresholds.json';
const SKIP = 'gates/errata/unparsable_revs.txt';
/** MASTER_PLAN rev 2, where the thresholds file began: every later tree must descend from it */
const BASELINE = 'acf73a4';
const AXES = ['walker', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'R'];
const SCOPES = ['area', 'world', 'session', 'process'];
const STATUS = ['to-build', 'partial', 'built'];
const LOCKED = ['metric', 'unit', 'axis', 'scope', 'op', 'sample'] as const;
const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const rowsOf = (text: string, where: string): Row[] => {
  const j = JSON.parse(text); // throws on a version that does not parse: the test fails and names it (fail closed)
  if (!Array.isArray(j.thresholds)) throw new Error(`${where}: no thresholds array`);
  return j.thresholds;
};
const now = rowsOf(readFileSync(FILE, 'utf8'), 'working tree');
const byId = new Map(now.map(r => [r.id, r]));
const ledger = readFileSync('USER_DIRECTIONS.md', 'utf8');
const udText = new Map([...ledger.matchAll(/^\| (UD-\d{2}) \|(.*)$/gm)].map(m => [m[1], m[2]]));

/** every committed version reachable from HEAD and every ratchet/* tag, oldest first; throws if git is unavailable */
function history(): { rev: string; rows: Row[] }[] {
  const revs = git('log', '--format=%H', '--', FILE).split('\n').filter(Boolean).reverse();
  let tags: string[] = [];
  try { tags = git('tag', '--list', 'ratchet/*').split('\n').filter(Boolean); } catch { tags = []; }
  // a committed version that does not parse fails the test, unless it is recorded in gates/errata/unparsable_revs.txt: skipping it
  // loses no constraint (every parsable version is still compared), so the record cannot be used to loosen anything
  const skip = existsSync(SKIP) ? new Set(readFileSync(SKIP, 'utf8').split('\n').map(l => l.split('#')[0].trim()).filter(Boolean)) : new Set<string>();
  for (const rev of revs.filter(r => skip.has(r))) { let parses = true; try { JSON.parse(git('show', `${rev}:${FILE}`)); } catch { parses = false; }
    if (parses) throw new Error(`${SKIP} lists ${rev.slice(0, 8)}, which parses: only an unparsable version may be skipped`); }
  const out = revs.filter(rev => !skip.has(rev)).map(rev => ({ rev: rev.slice(0, 8), rows: rowsOf(git('show', `${rev}:${FILE}`), rev.slice(0, 8)) }));
  for (const t of tags) out.push({ rev: t, rows: rowsOf(git('show', `${t}:${FILE}`), t) });
  return out;
}
function asStrict(op: Op, a: number, b: number): boolean {
  return op === '<=' || op === '<' ? b <= a : op === '>=' || op === '>' ? b >= a : b === a;
}
const evidenceFiles = (d = 'REVIEWS/evidence'): string[] => !existsSync(d) ? [] :
  readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? evidenceFiles(p) : f.endsWith('.json') ? [p] : []; });

describe('thresholds ratchet (MASTER_PLAN §4.1)', () => {
  it('git is available, the history is complete back to the rev 2 baseline, and every version parses (fail closed)', () => {
    expect(() => git('rev-parse', 'HEAD'), 'git unavailable: the ratchet cannot run, so it fails').not.toThrow();
    expect(() => git('merge-base', '--is-ancestor', BASELINE, 'HEAD'), `HEAD does not descend from the baseline ${BASELINE} (a squash or a rewritten history; or a clone too shallow: run git fetch --unshallow --tags)`).not.toThrow();
    const H = history();
    expect(H.length, 'no committed version of the thresholds file').toBeGreaterThan(0);
  });
  it('every row is well formed: ids unique, axis, scope, operator, sample, a real UD, an anti-proxy of substance', () => {
    expect(byId.size).toBe(now.length);
    for (const r of now) {
      expect(r.id, JSON.stringify(r)).toMatch(/^T-[A-Z][0-9A-Za-z]*$/);
      expect(AXES, r.id).toContain(r.axis);
      expect(SCOPES, r.id).toContain(r.scope);
      expect(['<=', '<', '>=', '>', '=='], r.id).toContain(r.op);
      expect(Number.isFinite(r.value), r.id).toBe(true);
      expect(r.sample_min, r.id).toBeGreaterThanOrEqual(1);
      expect(STATUS, r.id).toContain(r.status);
      expect(r.metric.length && r.unit.length && r.sample.length && r.tool.length, r.id).toBeTruthy();
      expect(r.anti_proxy.trim().length, `${r.id}: anti_proxy must say how the row could pass while the intent fails`).toBeGreaterThanOrEqual(20);
      expect(udText.has(r.ud), `${r.id}: ${r.ud} is not in USER_DIRECTIONS.md`).toBe(true);
    }
    for (const a of AXES) expect(now.some(r => r.axis === a), `axis ${a} has no threshold`).toBe(true);
  });
  it('status is derived from evidence: partial needs an evidence file written by the row\'s tool; built needs n ≥ sample_min', () => {
    const ev = new Map<string, { id: string; value: number; n: number; commit: string; tool: string }[]>();
    for (const f of evidenceFiles()) { try { const e = JSON.parse(readFileSync(f, 'utf8')); if (e && typeof e.id === 'string') (ev.get(e.id) ?? ev.set(e.id, []).get(e.id)!).push(e); } catch { /* not an evidence record */ } }
    for (const r of now) {
      if (r.status === 'to-build') continue;
      const mine = (ev.get(r.id) ?? []).filter(e => e.tool === r.tool);
      expect(existsSync(r.tool) && readFileSync(r.tool, 'utf8').includes(r.id), `${r.id} (${r.status}): its tool ${r.tool} must exist and name the id`).toBe(true);
      expect(mine.length, `${r.id} (${r.status}): no evidence file from ${r.tool} in REVIEWS/evidence`).toBeGreaterThan(0);
      if (r.status === 'built') expect(mine.some(e => e.n >= r.sample_min), `${r.id} built: no evidence with n ≥ ${r.sample_min}`).toBe(true);
    }
  });
  it('against every committed version and ratchet tag: no id removed, nothing reworded, no value loosened, no sample thinned', () => {
    for (const { rev, rows } of history()) {
      for (const old of rows) {
        const r = byId.get(old.id);
        expect(r, `${old.id} (present at ${rev}) was removed`).toBeTruthy();
        if (!r) continue;
        for (const k of LOCKED) if ((old as any)[k] !== undefined) expect((r as any)[k], `${r.id}: ${k} changed since ${rev}`).toBe((old as any)[k]);
        if (old.status !== 'to-build' && r.status !== 'to-build') expect(r.tool, `${r.id}: tool changed since ${rev} while measured`).toBe(old.tool);
        if (old.superseded_by) expect(r.superseded_by, `${r.id}: un-superseded since ${rev}`).toBe(old.superseded_by);
        const looser = !asStrict(old.op, old.value, r.value) || r.sample_min < old.sample_min;
        if (looser) {
          const t = r.loosened_by ? udText.get(r.loosened_by) ?? '' : '';
          expect(t.includes(r.id) && t.includes(String(r.value)), `${r.id} loosened since ${rev} (${old.value} → ${r.value}, n ${old.sample_min} → ${r.sample_min}): "loosened_by" must name a user direction whose own text names ${r.id} and ${r.value}`).toBe(true);
        }
      }
    }
  });
  it('a superseded row points to a real, as-strict replacement and an erratum with its measurement and signature', () => {
    for (const r of now.filter(x => x.superseded_by)) {
      const n = byId.get(r.superseded_by!);
      expect(n, `${r.id}: superseded_by ${r.superseded_by} does not exist`).toBeTruthy();
      expect(n!.superseded_by, `${r.id}: its replacement is itself superseded`).toBeUndefined();
      expect(n!.axis, `${r.id}: its replacement is on another axis`).toBe(r.axis);
      const f = `gates/errata/${r.id}.md`;
      expect(existsSync(f), `${r.id}: no erratum ${f}`).toBe(true);
      const t = readFileSync(f, 'utf8');
      expect(t).toContain('## Measurement'); expect(t).toContain('## Signature'); expect(t).toContain(r.superseded_by!);
      for (const m of t.matchAll(/REVIEWS\/[\w./-]+\.md/g)) expect(existsSync(m[0]), `${f} cites ${m[0]}, which does not exist`).toBe(true);
    }
  });
  it('the plan quotes every threshold id, and every T- id the plan quotes exists', () => {
    const plan = readFileSync('MASTER_PLAN.md', 'utf8');
    const quoted = new Set([...plan.matchAll(/\bT-[A-Z][0-9A-Za-z]*\b/g)].map(m => m[0]));
    for (const r of now) expect(quoted.has(r.id), `${r.id} not quoted in MASTER_PLAN.md`).toBe(true);
    for (const q of quoted) expect(byId.has(q), `MASTER_PLAN.md quotes ${q}, which gates/thresholds.json lacks`).toBe(true);
  });
});
