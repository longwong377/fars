// The generated board (MASTER_PLAN §5, D-277): COVERAGE.md is written only by tools/dev/coverage_report.ts from the evidence
// files; this regenerates it and fails on any difference, so a PASS cannot be typed. It also checks the cell rules on a
// synthetic evidence set: NOT-MEASURED without evidence from the row's own tool, STALE without a dependency hash or with
// another one or with a commit outside the history, FAIL-EXCEPTION never PASS, INSUFFICIENT below sample_min, SUPERSEDED.
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { boardFromEvidence, BOARD_FILE } from '../tools/dev/coverage_report';
import { depHashFor } from '../tools/dev/coverage_dep';

describe('COVERAGE.md, the generated board', () => {
  it('is exactly what tools/dev/coverage_report.ts --board-only generates from the evidence (regenerate: npm run board)', () => {
    const now = boardFromEvidence(), committed = readFileSync(BOARD_FILE, 'utf8');
    if (now !== committed) { const a = now.split('\n'), b = committed.split('\n'); const i = a.findIndex((l, k) => l !== b[k]); expect(`line ${i + 1}: ${b[i]}`).toBe(`line ${i + 1}: ${a[i]}`); }
    expect(now).toBe(committed);
  });
  it('has one cell for every threshold id of gates/thresholds.json', () => {
    const ids: string[] = JSON.parse(readFileSync('gates/thresholds.json', 'utf8')).thresholds.map((r: any) => r.id), md = readFileSync(BOARD_FILE, 'utf8');
    for (const id of ids) expect(md.match(new RegExp(`^\\| ${id.replace(/[-]/g, '\\-')} \\|`, 'gm'))?.length ?? 0, id).toBe(1);
  });
  it('derives every status from the evidence by the §5 rules', () => {
    const dir = mkdtempSync(join(tmpdir(), 'board-')), ev = join(dir, 'ev'); mkdirSync(join(ev, 'x'), { recursive: true });
    const tool = 'tools/dev/areas.ts', dep = depHashFor(tool), head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
    const row = (id: string, extra: any = {}) => ({ id, axis: 'A', scope: 'world', metric: 'm', op: '>=', value: 99.5, unit: '%', sample_min: 2, tool, status: 'to-build', ...extra });
    const th = join(dir, 'th.json');
    writeFileSync(th, JSON.stringify({ thresholds: [row('T-P1'), row('T-P2'), row('T-P3'), row('T-P4'), row('T-P5'), row('T-P6'), row('T-P7'), row('T-P8', { superseded_by: 'T-P1' }), row('T-P9'), row('T-P10')] }));
    const put = (id: string, e: any) => writeFileSync(join(ev, 'x', `${id}.json`), JSON.stringify({ id, commit: head, tool, dep, n: 5, value: 100, ...e }));
    put('T-P1', {}); put('T-P2', { dep: undefined }); put('T-P3', { dep: 'deadbeef0000' }); put('T-P4', { value: 90 }); put('T-P5', { status: 'PASS with logged exceptions (FAIL-EXCEPTION)' });
    put('T-P6', { n: 1 }); put('T-P7', { tool: 'tools/dev/other.ts' }); put('T-P9', { commit: 'fffffff' }); // T-P10: no evidence
    const md = boardFromEvidence({ thresholds: th, evidence: ev, areas: join(dir, 'none.json') });
    const st = (id: string) => (new RegExp(`^\\| ${id} \\|[^\\n]*?\\*\\*([^*]+)\\*\\*`, 'm').exec(md) ?? [])[1];
    expect(st('T-P1')).toBe('PASS'); expect(st('T-P2')).toBe('STALE'); expect(st('T-P3')).toBe('STALE'); expect(st('T-P4')).toBe('FAIL');
    expect(st('T-P5')).toBe('FAIL-EXCEPTION'); expect(st('T-P6')).toBe('INSUFFICIENT'); expect(st('T-P7')).toBe('NOT-MEASURED'); expect(st('T-P8')).toBe('SUPERSEDED by T-P1');
    expect(st('T-P9')).toBe('STALE'); expect(st('T-P10')).toBe('NOT-MEASURED');
    expect(md).toMatch(/\*\*1 of 10 ids PASS\.\*\*/);
  });
});
