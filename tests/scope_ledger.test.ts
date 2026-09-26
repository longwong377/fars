// The scope ledger (UD-12): the user's directions (USER_DIRECTIONS.md) are append-only and every one is traced in
// MASTER_PLAN.md with a real measure. Rev 2.1 closes the second critique's routes (REVIEWS/master_plan_critique_rev2.md §2,
// R8–R11): direction rows cannot be reworded or removed (checked against git history, fail closed); every trace row names a
// threshold of its own direction and only real files, and never loses a reference; the plan's normative sentences
// (gates/scope_phrases.json, append-only) stay verbatim; every TO-BUILD tool is named in the plan; every cited D/Q/B number
// exists; the brief templates keep their fixed clauses verbatim and every saved brief carries them; TASKS.md holds no
// verification ticks. The thresholds themselves: tests/gates_ratchet.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const BASELINE = 'acf73a4';
const versions = (file: string): string[] => {
  const revs = git('log', '--format=%H', '--', file).split('\n').filter(Boolean).reverse();
  let tags: string[] = []; try { tags = git('tag', '--list', 'ratchet/*').split('\n').filter(Boolean); } catch { tags = []; }
  return [...revs, ...tags].map(r => { try { return git('show', `${r}:${file}`); } catch { return null; } }).filter((t): t is string => t !== null);
};
const udRows = (t: string) => [...t.matchAll(/^\| (UD-\d{2}) \|(.*)$/gm)].map(m => ({ id: m[1], text: m[2] }));
const ledger = readFileSync('USER_DIRECTIONS.md', 'utf8'), plan = readFileSync('MASTER_PLAN.md', 'utf8');
const ids = udRows(ledger);
const TH: { id: string; ud: string; tool: string; status: string }[] = JSON.parse(readFileSync('gates/thresholds.json', 'utf8')).thresholds;
const thIds = new Set(TH.map(r => r.id));
const isFile = (p: string) => existsSync(p) && statSync(p).isFile();
const traceRows = (t: string) => { const a = t.indexOf('## 12.'), b = t.indexOf('## 13.', a);
  return a < 0 ? [] : t.slice(a, b < 0 ? undefined : b).split('\n').filter(l => /^\| UD-\d{2} \|/.test(l))
    .map(l => ({ ud: l.slice(2, 7), refs: l.split('|').slice(-2, -1)[0].split(',').map(x => x.trim()).filter(Boolean) })); };
const fixedBlock = (t: string) => { const a = t.indexOf('## Fixed clauses'), b = t.indexOf('## Slots'); return a < 0 || b < 0 ? '' : t.slice(a, b).trim(); };

describe('scope ledger (UD-12)', () => {
  it('the ledger is contiguous from UD-01, no row is reworded, and it never holds fewer rows than it ever did', () => {
    ids.forEach((r, i) => expect(r.id).toBe(`UD-${String(i + 1).padStart(2, '0')}`));
    const V = versions('USER_DIRECTIONS.md');
    expect(V.length, 'no committed version of USER_DIRECTIONS.md (git unavailable: fail closed)').toBeGreaterThan(0);
    const first = new Map<string, string>();
    let max = 0;
    for (const v of V) { const rows = udRows(v); max = Math.max(max, rows.length); for (const r of rows) if (!first.has(r.id)) first.set(r.id, r.text); }
    expect(ids.length, 'the ledger shrank').toBeGreaterThanOrEqual(max);
    for (const r of ids) if (first.has(r.id)) expect(r.text, `${r.id} was reworded`).toBe(first.get(r.id));
  });
  it('every direction is traced in §12 by a threshold of its own direction, only real ids or files, never losing a reference', () => {
    const rows = traceRows(plan);
    for (const { id } of ids) expect(rows.some(r => r.ud === id), `${id} not traced`).toBe(true);
    for (const r of rows) {
      expect(r.refs.length, r.ud).toBeGreaterThan(0);
      for (const x of r.refs) expect(thIds.has(x) || isFile(x), `${r.ud}: "${x}" is neither a threshold id nor a regular file`).toBe(true);
      expect(r.refs.some(x => TH.find(t => t.id === x)?.ud === r.ud), `${r.ud}: no threshold of its own direction (ud = ${r.ud}) in its trace`).toBe(true);
    }
    for (const v of versions('MASTER_PLAN.md')) for (const o of traceRows(v)) {
      const cur = rows.find(r => r.ud === o.ud);
      for (const x of o.refs) if (thIds.has(x) || /\.\w+$/.test(x)) expect(cur?.refs, `${o.ud} lost the reference ${x}`).toContain(x);
    }
  });
  it('CLAUDE.md sends every session to the ledger, the plan and the thresholds first', () => {
    const c = readFileSync('CLAUDE.md', 'utf8');
    expect(c).toMatch(/USER_DIRECTIONS\.md/); expect(c).toMatch(/MASTER_PLAN\.md/); expect(c).toMatch(/gates\/thresholds\.json/);
  });
  it('the plan keeps its axes A–K and R and its sections', () => {
    for (const a of 'ABCDEFGHIJKR') expect(plan, `axis ${a}`).toMatch(new RegExp(`^\\*\\*${a}\\. `, 'm'));
    for (const h of ['illusion-break log', '### 4.1 Thresholds are data and only tighten', '### 4.2 How coverage is measured', '### 4.3 The world']) expect(plan).toContain(h);
  });
  it('every normative sentence in gates/scope_phrases.json appears verbatim where it belongs, and the list only grows', () => {
    const P: { file: string; text: string }[] = JSON.parse(readFileSync('gates/scope_phrases.json', 'utf8')).phrases;
    const norm = (s: string) => s.replace(/\s+/g, ' ');
    for (const p of P) expect(norm(readFileSync(p.file, 'utf8')), `${p.file} lost: "${p.text}"`).toContain(norm(p.text));
    for (const v of versions('gates/scope_phrases.json')) for (const o of JSON.parse(v).phrases as { file: string; text: string }[])
      expect(P.some(p => p.file === o.file && p.text === o.text), `scope phrase removed or changed: "${o.text}"`).toBe(true);
  });
  it('every TO-BUILD tool of the thresholds is named in the plan', () => {
    for (const t of new Set(TH.filter(r => r.status === 'to-build').map(r => r.tool))) expect(plan, `${t} (a TO-BUILD tool) is not named in MASTER_PLAN.md`).toContain(t);
  });
  it('every D-, Q- and B- number cited by the plan or CLAUDE.md exists in its record or in the reserved-numbers table', () => {
    const recs = ['DECISIONS.md', 'research/OPEN_QUESTIONS.md', 'BLOCKERS.md', 'handoff/reserved_numbers.md'].map(f => readFileSync(f, 'utf8')).join('\n');
    const cited = new Set([...(plan + readFileSync('CLAUDE.md', 'utf8')).matchAll(/\b(D-\d{3}|Q-\d{3}|B\d{2,3})\b/g)].map(m => m[1]));
    for (const c of cited) {
      const re = c.startsWith('B') ? new RegExp(`\\| ${c} \\|`) : new RegExp(`(## ${c}\\b|\\| ${c} \\|)`);
      expect(re.test(recs), `${c} is cited but not recorded (DECISIONS / OPEN_QUESTIONS / BLOCKERS / handoff/reserved_numbers.md)`).toBe(true);
    }
  });
  it('the brief templates keep their fixed clauses verbatim (they may grow), and every saved brief carries them', () => {
    for (const f of ['handoff/review_template.md', 'handoff/agent_template.md']) {
      const base = fixedBlock(git('show', `${BASELINE}:${f}`)), cur = fixedBlock(readFileSync(f, 'utf8'));
      expect(base.length, `${f} at ${BASELINE}`).toBeGreaterThan(200);
      for (const para of base.split(/\n\s*\n/)) expect(cur, `${f}: a fixed clause changed`).toContain(para.trim());
    }
    const briefs = (d: string): string[] => !existsSync(d) ? [] : readdirSync(d).flatMap(x => { const p = join(d, x); return statSync(p).isDirectory() ? briefs(p) : p.endsWith('.md') ? [p] : []; });
    // a saved brief fills the {slots}: every literal piece of every fixed paragraph must appear (whitespace-normalised)
    const norm = (x: string) => x.replace(/\s+/g, ' ');
    const pieces = (block: string) => block.split(/\n\s*\n/).slice(1).flatMap(p => p.split(/\{[^}]*\}/)).map(x => norm(x).trim()).filter(x => x.length >= 12);
    const T = ['handoff/agent_template.md', 'handoff/review_template.md'].map(f => pieces(fixedBlock(readFileSync(f, 'utf8'))));
    for (const b of briefs('handoff/briefs')) { const t = norm(readFileSync(b, 'utf8'));
      expect(T.some(ps => ps.every(x => t.includes(x))), `${b} does not carry a template's fixed clauses verbatim`).toBe(true); }
  });
  it('TASKS.md lists work only: no verification ticks (verified lives on the generated board)', () => {
    expect(readFileSync('TASKS.md', 'utf8')).not.toMatch(/\[x\]/i);
  });
});
