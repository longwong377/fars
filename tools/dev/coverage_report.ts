// Coverage report (D-233, D-235): aggregates shots/coverage.json (tests/e2e/coverage.spec.ts) per area and sub-area, worst
// views first, placeholder and low-detail objects by the pixels they cost, repetition, life and scene variety across days
// (shots/coverage_variety.json), and writes REVIEWS/coverage_report.md plus a contact sheet of the worst 30 thumbnails
// (REVIEWS/coverage_worst.jpg, python3 + Pillow; skipped with a note if unavailable).
// The MASTER_PLAN board (§5): per (interim) area and threshold id, the cell's status from the evidence: PASS, FAIL,
// INSUFFICIENT (fewer views than the row's sample_min and no failure) or STALE (evidence rendered with another dependency hash
// than the tree's: tools/dev/coverage_dep.ts; STALE counts as FAIL), with the evidence commit and hash. Evidence whose view ids
// or cameras differ from the sample file (another seed, another sampler) is REFUSED and listed, never counted; worst-first
// extras are reported apart and never counted in a pass rate.
// Evidence (MASTER_PLAN rev 2.1): with --evidence, every threshold id this report measures on at least one view gets
// REVIEWS/evidence/coverage-<commit8>/<id>.json {id, value, n, commit, tool, dep, status, areas}; with --board, COVERAGE.md
// gets a cell for EVERY id of gates/thresholds.json (--thresholds <file> to point elsewhere): this report's ids measured,
// SUPERSEDED rows, other tools' committed evidence shown as found, everything else NOT-MEASURED (which counts as FAIL).
// Usage: npx tsx tools/dev/coverage_report.ts [coverage.json] [out.md] [Q filter, e.g. test] [--legacy] [--evidence] [--board] [--thresholds <file>]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { depHash } from './coverage_dep';
import { HOUR_BANDS, WEATHERS, pairCoverage } from './coverage_time';

/** the threshold rows this report computes (MASTER_PLAN §4, gates/thresholds.json; the file wins when present) */
export const GATE_IDS = ['T-A1', 'T-A1m', 'T-A2f', 'T-A3c', 'T-A3c2', 'T-A3k', 'T-A3n', 'T-B2m', 'T-B2f', 'T-B2s', 'T-B2l', 'T-B1m', 'T-B1h', 'T-B1w', 'T-B1p', 'T-C1'] as const;
/** ids this report owns but cannot measure yet: they need reference photographs per stratum (T-A2r), never renders */
export const NEEDS_REFERENCES = ['T-A2f2', 'T-A2s2', 'T-A2k'] as const;
const FALLBACK: Record<string, { op: string; value: number; unit: string; sample_min: number }> = {
  'T-A1': { op: '<=', value: 0, unit: '% of pixels', sample_min: 59 }, 'T-A1m': { op: '>=', value: 100, unit: '%', sample_min: 1 }, 'T-A2f': { op: '<=', value: 3, unit: '% of frame', sample_min: 59 },
  'T-A3c': { op: '<=', value: 0.5, unit: '% of frame', sample_min: 59 }, 'T-A3c2': { op: '<=', value: 0.5, unit: '% of frame', sample_min: 59 },
  'T-B2s': { op: '>=', value: 3, unit: '/255', sample_min: 8 }, 'T-B2l': { op: '>=', value: 8, unit: '/255', sample_min: 8 }, 'T-A3k': { op: '<=', value: 1, unit: '% of frame', sample_min: 59 },
  'T-A3n': { op: '<=', value: 0, unit: 'count', sample_min: 59 }, 'T-B2m': { op: '<=', value: 20, unit: '/255', sample_min: 8 }, 'T-B2f': { op: '<=', value: 45, unit: '/255', sample_min: 8 },
  'T-B1m': { op: '>=', value: 12, unit: 'count', sample_min: 1 }, 'T-B1h': { op: '>=', value: 8, unit: 'count', sample_min: 1 }, 'T-B1w': { op: '>=', value: 9, unit: 'count', sample_min: 1 },
  'T-B1p': { op: '>=', value: 100, unit: '%', sample_min: 1 }, 'T-C1': { op: '<=', value: 0, unit: 'count', sample_min: 16 } };
export function thresholds(file = 'gates/thresholds.json') {
  const out = { ...FALLBACK }; let src = 'embedded copy (gates/thresholds.json not in this tree)';
  if (existsSync(file)) { const rows = JSON.parse(readFileSync(file, 'utf8')).thresholds as any[]; for (const r of rows) if (r.id in out) out[r.id] = { op: r.op, value: r.value, unit: r.unit, sample_min: r.sample_min }; src = file; }
  return { rows: out, src };
}
/** per-view values of the gate metrics (null where the view does not qualify: T-A3k by day only, T-B2 at night away from fire) */
export function viewGate(r: Rec) {
  const g = r.gate, s = r.shares; if (!g || !s) return null;
  const awayFromFire = (g.fireLux ?? 0) < 0.05, fullMoon = r.band === 'moonlit-night' && (r.moonFrac ?? 0) >= 0.9 && awayFromFire;
  return { 'T-A1': 100 * (s.phOrUntiered ?? (s.placeholder + s.untiered)), 'T-A1m': typeof r.tieredSourced === 'number' ? 100 * r.tieredSourced : null, 'T-A2f': 100 * g.flatRegion, 'T-A3c': 100 * g.clipped, 'T-A3c2': typeof g.clipped2 === 'number' ? 100 * g.clipped2 : null, 'T-A3k': (r.sunAlt ?? -90) > 0 ? 100 * g.crush : null, 'T-A3n': g.blackTiles,
    'T-B2m': r.band === 'moonless-night' && awayFromFire ? g.meanLuma : null, 'T-B2f': fullMoon ? g.meanLuma : null, 'T-B2l': fullMoon ? g.meanLuma : null,
    'T-B2s': r.band === 'moonless-night' && typeof g.skylineContrast === 'number' ? g.skylineContrast : null,
    'T-C1': r.rigClear ?? 0 } as Record<string, number | null>;
}
const pass = (op: string, v: number, t: number) => op === '<=' ? v <= t + 1e-9 : op === '>=' ? v >= t - 1e-9 : op === '<' ? v < t : v > t;
export interface Cell { status: 'PASS' | 'FAIL' | 'INSUFFICIENT' | 'STALE' | 'n/a'; n: number; fails: number; worst: number | null; commit: string; dep: string }
/** one board cell: every qualifying view must meet the threshold; fewer than sample_min views and no failure = INSUFFICIENT */
export function cell(recs: Rec[], id: string, th: { op: string; value: number; sample_min: number }, currentDep: string | null): Cell {
  const vals = recs.map(r => ({ r, v: viewGate(r)?.[id] ?? null })).filter(x => x.v !== null) as { r: Rec; v: number }[];
  const commits = [...new Set(vals.map(x => (x.r.commit ?? '?').slice(0, 8)))], deps = [...new Set(vals.map(x => x.r.dep ?? '?'))];
  if (!vals.length) return { status: 'n/a', n: 0, fails: 0, worst: null, commit: '', dep: '' };
  const f = vals.filter(x => !pass(th.op, x.v, th.value)).length, worst = th.op.startsWith('<') ? Math.max(...vals.map(x => x.v)) : Math.min(...vals.map(x => x.v));
  const stale = currentDep !== null && deps.some(d => d !== currentDep);
  return { status: stale ? 'STALE' : f ? 'FAIL' : vals.length < th.sample_min ? 'INSUFFICIENT' : 'PASS', n: vals.length, fails: f, worst, commit: commits.join(','), dep: deps.join(',') };
}
/** evidence validation: the record's seed and camera must be the sample file's for its id */
export function validate(recs: Rec[], sample: any) {
  const byId = new Map((sample?.points ?? []).map((p: any) => [p.id, p])); const ok: Rec[] = [], refused: { id: string; why: string }[] = [], extras: Rec[] = [];
  for (const r of recs) { const p: any = byId.get(r.id);
    if (r.extra) { extras.push(r); continue; }
    if (r.seed === undefined || r.seed !== sample?.meta?.seed) { refused.push({ id: r.id, why: `seed ${r.seed ?? 'none'} ≠ sample ${sample?.meta?.seed}` }); continue; }
    if (!p || (r.cam && JSON.stringify(r.cam) !== JSON.stringify([p.e, p.n, p.eye, p.az, p.pitch]))) { refused.push({ id: r.id, why: 'camera differs from the sample' }); continue; }
    ok.push(r); }
  return { ok, refused, extras };
}

/** provisional pass/fail thresholds per view (C, Q-633): tuned once a full pass exists; never lowered to pass */
export const FAIL = { placeholder: 0.05, missing: 0.05, lowDetail: 0.25 } as const;
export interface Rec { id: string; place?: string; area: string; sub: string; state: string; q: string; error?: string; revisit?: boolean; sunAlt?: number;
  seed?: number; commit?: string; dep?: string; extra?: boolean; tieredSourced?: number; cam?: number[]; month?: number; band?: string; weather?: string; moonFrac?: number; forced?: boolean; rigClear?: number;
  gate?: { flatRegion: number; clipped: number; clipped2?: number; crush: number; blackTiles: number; meanLuma: number; skylineContrast?: number | null; fireLux?: number } | null;
  shares?: { sky: number; placeholder: number; untiered: number; phOrUntiered?: number; skyHole: number; badId: number }; missing?: number | null; flatness?: number | null; lowDetail?: number | null;
  frame?: any; objects?: { key: string; share: number; ph: boolean; tier: string | null; tris: number; density: number }[]; phObjects?: { key: string; share: number }[]; groups?: Record<string, number>;
  drawCalls?: number; triangles?: number; materials?: number; geometries?: number; visibleMeshes?: number; repetition?: any; life?: any; ms?: number }

/** a view's badness: placeholder + missing + half the low-detail share (errors rank first) */
export const score = (r: Rec) => r.error ? 9 : (r.shares?.placeholder ?? 0) + (r.missing ?? 0) + 0.5 * (r.lowDetail ?? 0);
export const fails = (r: Rec) => !!r.error || (r.shares?.placeholder ?? 0) > FAIL.placeholder || (r.missing ?? 0) > FAIL.missing || (r.lowDetail ?? 0) > FAIL.lowDetail;
/** object keys aggregate across instances of the same kind: digits become # */
export const normKey = (k: string) => k.replace(/\d+(\.\d+)?/g, '#');
const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const median = (a: number[]) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

export interface Group { key: string; n: number; errors: number; failRate: number; ph: number; phMax: number; missing: number; low: number; flat: number; tiling: number; rep: number; people: number; idle: number; score: number; worst: string }
function group(key: string, rs: Rec[]): Group {
  const ok = rs.filter(r => !r.error), f = (g: (r: Rec) => number | null | undefined) => ok.map(g).filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  const people = f(r => r.life?.people), idle = ok.map(r => r.life).filter(l => l && l.people > 0).map(l => (l.byCls.idle + l.byCls.resting) / l.people);
  const worst = [...rs].sort((a, b) => score(b) - score(a))[0];
  return { key, n: rs.length, errors: rs.length - ok.length, failRate: rs.filter(fails).length / Math.max(1, rs.length), ph: mean(f(r => r.shares?.placeholder)), phMax: Math.max(0, ...f(r => r.shares?.placeholder)),
    missing: mean(f(r => r.missing)), low: mean(f(r => r.lowDetail)), flat: median(f(r => r.flatness)), tiling: mean(f(r => r.frame?.tiling ? r.frame.tiling.periodic / Math.max(1, r.frame.tiling.textured) : null)),
    rep: median(f(r => r.repetition?.maxIdentical)), people: mean(people), idle: mean(idle), score: mean(rs.map(score)), worst: worst?.id ?? '' };
}
/** the aggregation (pure: tests/coverage.test.ts) */
export function aggregate(recs: Rec[]) {
  const by = (k: (r: Rec) => string) => { const m = new Map<string, Rec[]>(); for (const r of recs) { const x = k(r); let a = m.get(x); if (!a) m.set(x, a = []); a.push(r); } return m; };
  const areas = [...by(r => r.area)].map(([k, rs]) => group(k, rs)).sort((a, b) => b.score - a.score);
  const subs = [...by(r => r.sub)].map(([k, rs]) => group(k, rs)).sort((a, b) => b.score - a.score);
  const states = [...by(r => r.state)].map(([k, rs]) => group(k, rs)).sort((a, b) => b.score - a.score);
  const worst = [...recs].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  const N = recs.filter(r => !r.error).length || 1;
  const objCost = (pick: (r: Rec) => { key: string; share: number }[]) => { const m = new Map<string, { key: string; cost: number; views: number; max: number; subs: Set<string> }>();
    for (const r of recs) { if (r.error) continue; const seen = new Set<string>(); for (const o of pick(r)) { const k = normKey(o.key); let e = m.get(k); if (!e) m.set(k, e = { key: k, cost: 0, views: 0, max: 0, subs: new Set() });
      e.cost += o.share / N; e.max = Math.max(e.max, o.share); e.subs.add(r.sub); if (!seen.has(k)) { e.views++; seen.add(k); } } }
    return [...m.values()].sort((a, b) => b.cost - a.cost).map(e => ({ key: e.key, cost: e.cost, views: e.views, max: e.max, subs: [...e.subs].sort() })); };
  const placeholderObjects = objCost(r => r.phObjects ?? (r.objects ?? []).filter(o => o.ph));
  const lowObjects = objCost(r => r.frame?.lowObjects ?? []);
  const repeated = objCost(r => (r.repetition?.top ?? []).map((t: any) => ({ key: t.key, share: t.n })));
  return { n: recs.length, errors: recs.filter(r => r.error).length, failRate: recs.filter(fails).length / Math.max(1, recs.length), areas, subs, states, worst, placeholderObjects, lowObjects, repeated };
}

export interface VarShot { day: number; objects: Record<string, number>; people: string[]; acts: Record<string, number>; animals: number; impostors: number; Y: number[] }
/** scene variety across days at one place and hour (D-236): pairwise similarity; near-identical = a failure */
export function varietyOf(shots: VarShot[]) {
  const jac = (a: string[], b: string[]) => { const A = new Set(a), B = new Set(b); if (!A.size && !B.size) return 1; let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i); };
  const cos = (a: Record<string, number>, b: Record<string, number>) => { const k = new Set([...Object.keys(a), ...Object.keys(b)]); let d = 0, na = 0, nb = 0; for (const x of k) { const u = a[x] ?? 0, v = b[x] ?? 0; d += u * v; na += u * u; nb += v * v; } return na && nb ? d / Math.sqrt(na * nb) : (na || nb ? 0 : 1); };
  const inter = (a: Record<string, number>, b: Record<string, number>) => { const k = new Set([...Object.keys(a), ...Object.keys(b)]); let mn = 0, mx = 0; for (const x of k) { mn += Math.min(a[x] ?? 0, b[x] ?? 0); mx += Math.max(a[x] ?? 0, b[x] ?? 0); } return mx ? mn / mx : 1; };
  const img = (a: number[], b: number[]) => mean(a.map((x, i) => Math.abs(x - b[i])));
  const pairs: { a: number; b: number; people: number; acts: number; objects: number; imgDiff: number; identical: boolean }[] = [];
  for (let i = 0; i < shots.length; i++) for (let j = i + 1; j < shots.length; j++) { const A = shots[i], B = shots[j];
    const p = { a: A.day, b: B.day, people: jac(A.people, B.people), acts: cos(A.acts, B.acts), objects: inter(A.objects, B.objects), imgDiff: img(A.Y, B.Y), identical: false };
    p.identical = p.people >= 0.7 && p.acts >= 0.9 && p.imgDiff < 4; pairs.push(p); }
  const empty = shots.every(s => s.people.length === 0);
  return { pairs, empty, identicalPairs: pairs.filter(p => p.identical).length, verdict: empty ? 'EMPTY on every day' : pairs.some(p => p.identical) ? 'FAIL: near-identical across days' : 'differs' };
}

const pc = (x: number) => Number.isFinite(x) ? `${(x * 100).toFixed(1)} %` : '–';
const f2 = (x: number) => Number.isFinite(x) ? x.toFixed(2) : '–';
export function boardMd(recs: Rec[], sample: any, currentDep: string | null, th = thresholds()) {
  const L: string[] = [], areas = [...new Set(recs.map(r => r.area))].sort(), ids = GATE_IDS.filter(i => !i.startsWith('T-B1'));
  L.push('## Board (MASTER_PLAN §5; INTERIM areas, not the §4.3 registry)', '', `Thresholds from ${th.src}. Current dependency hash ${currentDep ?? '(not computed)'}. A cell: status, failing/qualifying views, worst value, evidence commit, dependency hash. STALE counts as FAIL; INSUFFICIENT = fewer views than the row's sample_min and none failing.`, '');
  L.push(`| area | ${ids.map(i => `${i} (${th.rows[i].op} ${th.rows[i].value} ${th.rows[i].unit})`).join(' | ')} |`, `|---|${ids.map(() => '---').join('|')}|`);
  for (const a of [...areas, '(world)']) { const rs = a === '(world)' ? recs : recs.filter(r => r.area === a);
    L.push(`| ${a} | ${ids.map(i => { const c = cell(rs, i, th.rows[i], currentDep); return c.status === 'n/a' ? 'n/a' : `**${c.status}** ${c.fails}/${c.n}, worst ${c.worst === null ? '–' : +c.worst.toFixed(2)} @${c.commit} #${c.dep}`; }).join(' | ')} |`); }
  // time coverage: the sample's plan and what has been rendered (T-B1m/h/w per area, T-B1p world pairs)
  const hits = (rs: { month?: number; band?: string; weather?: string }[]) => ({ m: new Set(rs.map(r => r.month).filter(Boolean)).size, h: new Set(rs.map(r => r.band).filter(Boolean)).size, w: new Set(rs.map(r => r.weather).filter(Boolean)).size });
  L.push('', '### Time coverage (T-B1m ≥ 12 months, T-B1h ≥ 8 hour bands, T-B1w ≥ 9 weathers per area; T-B1p world pairs)', '', '| area | planned (sample) months / bands / weathers | rendered months / bands / weathers |', '|---|---|---|');
  const sAreas = [...new Set((sample?.points ?? []).map((p: any) => p.area))].sort() as string[];
  for (const a of sAreas) { const P = hits((sample.points as any[]).filter(p => p.area === a)), R = hits(recs.filter(r => r.area === a));
    const st = (x: { m: number; h: number; w: number }) => `${x.m} / ${x.h} / ${x.w} ${x.m >= 12 && x.h >= 8 && x.w >= 9 ? 'PASS' : 'FAIL'}`; L.push(`| ${a} | ${st(P)} | ${st(R)} |`); }
  const pr = (rows: any[]) => pairCoverage(rows.filter(r => r.month && r.band && r.weather), sAreas).share;
  L.push('', `World pairs (band × weather, month × band, area × weather): planned ${(100 * pr(sample?.points ?? [])).toFixed(1)} %, rendered ${(100 * pr(recs)).toFixed(1)} % (T-B1p ≥ 100 %). Bands ${HOUR_BANDS.length}, weathers ${WEATHERS.length}.`);
  return L.join('\n');
}
/** a threshold id's evidence from the valid records: the worst per-view value (or the least area's hits), n, per area */
export function evidenceFor(id: string, recs: Rec[], sample: any, th: { op: string; value: number; sample_min: number }, dep: string | null) {
  const commits = [...new Set(recs.map(r => (r.commit ?? '').replace(/-dirty$/, '')).filter(Boolean))];
  const base = { id, commit: commits.length === 1 ? commits[0] : commits.join(','), tool: id.startsWith('T-B1') ? 'tools/dev/coverage_points.ts' : 'tools/dev/coverage_report.ts', dep, threshold: th, generated: new Date().toISOString() };
  if (id.startsWith('T-B1')) {
    const areas = [...new Set(recs.map(r => r.area))].sort(), per: Record<string, number> = {};
    if (id === 'T-B1p') { const v = 100 * pairCoverage(recs.filter(r => r.month && r.band && r.weather) as any, [...new Set((sample?.points ?? []).map((p: any) => p.area))] as string[]).share;
      return { ...base, value: +v.toFixed(2), n: recs.length, status: pass(th.op, v, th.value) ? 'PASS' : 'FAIL', planned: sample?.meta?.time?.pairs?.share != null ? 100 * sample.meta.time.pairs.share : null }; }
    const key = id === 'T-B1m' ? 'month' : id === 'T-B1h' ? 'band' : 'weather';
    for (const a of areas) per[a] = new Set(recs.filter(r => r.area === a).map(r => (r as any)[key]).filter(Boolean)).size;
    const v = areas.length ? Math.min(...Object.values(per)) : 0;
    return { ...base, value: v, n: areas.length, status: areas.length && pass(th.op, v, th.value) ? 'PASS' : 'FAIL', areas: per, planned: sample?.meta?.time?.areaHits ?? null };
  }
  const c = cell(recs, id, th, dep), areas: Record<string, any> = {};
  for (const a of [...new Set(recs.map(r => r.area))].sort()) { const x = cell(recs.filter(r => r.area === a), id, th, dep); if (x.n) areas[a] = { status: x.status, n: x.n, fails: x.fails, worst: x.worst }; }
  return { ...base, value: c.worst, n: c.n, fails: c.fails, status: c.status, areas };
}
export function writeEvidence(recs: Rec[], sample: any, dep: string | null, th = thresholds()) {
  const commits = [...new Set(recs.map(r => (r.commit ?? '').replace(/-dirty$/, '').slice(0, 8)).filter(Boolean))].sort();
  const dir = `REVIEWS/evidence/coverage-${commits[commits.length - 1] ?? 'none'}`; const written: string[] = [];
  for (const id of GATE_IDS) { if (!(id in th.rows)) continue; const e = evidenceFor(id, recs, sample, th.rows[id], dep); if (!e.n) continue;
    mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/${id}.json`, JSON.stringify(e, null, 1) + '\n'); written.push(id); }
  return { dir, written };
}
/** COVERAGE.md: a cell for every threshold id (rev 2.1) */
export function boardAll(recs: Rec[], sample: any, dep: string | null, file = 'gates/thresholds.json') {
  const L: string[] = ['# COVERAGE (generated by tools/dev/coverage_report.ts --board; do not edit)', ''];
  const rows: any[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).thresholds : GATE_IDS.map(id => ({ id, ...FALLBACK[id], axis: '?', metric: '(gates/thresholds.json not in this tree)' }));
  const found = new Map<string, any>(); if (existsSync('REVIEWS/evidence')) for (const d of readdirSync('REVIEWS/evidence')) { const p = `REVIEWS/evidence/${d}`; try { for (const f of readdirSync(p)) if (f.endsWith('.json')) { const e = JSON.parse(readFileSync(`${p}/${f}`, 'utf8')); if (e.id) found.set(e.id, e); } } catch { /* not a dir */ } }
  L.push(`Areas are INTERIM (not the MASTER_PLAN §4.3 registry). Current dependency hash ${dep}. NOT-MEASURED and STALE count as FAIL. Thresholds: ${existsSync(file) ? file : 'embedded (file absent)'}.`, '');
  L.push('| id | axis | threshold | status | value | n | evidence |', '|---|---|---|---|---|---|---|');
  for (const r of rows) { let status = 'NOT-MEASURED', value = '–', n = '–', ev = '';
    if (r.superseded_by) status = `SUPERSEDED by ${r.superseded_by}`;
    else if ((GATE_IDS as readonly string[]).includes(r.id)) { const e = evidenceFor(r.id, recs, sample, { op: r.op, value: r.value, sample_min: r.sample_min }, dep); if (e.n) { status = e.status; value = String(e.value ?? '–'); n = String(e.n); ev = `@${String(e.commit).slice(0, 8)} #${dep}`; } }
    else if ((NEEDS_REFERENCES as readonly string[]).includes(r.id)) status = 'NOT-MEASURED (needs reference photographs per stratum, T-A2r)';
    else if (found.has(r.id)) { const e = found.get(r.id); status = `${e.status ?? 'EVIDENCE'} (other tool)`; value = String(e.value); n = String(e.n); ev = `@${String(e.commit).slice(0, 8)}`; }
    L.push(`| ${r.id} | ${r.axis ?? ''} | ${r.op} ${r.value} ${r.unit} (n ≥ ${r.sample_min}) | ${status} | ${value} | ${n} | ${ev} |`); }
  return L.join('\n') + '\n';
}
export function reportMd(recs: Rec[], vari: Record<string, any>, o: { q: string; sheet: string | null; src: string; board?: string; refused?: { id: string; why: string }[]; extras?: Rec[] }) {
  const A = aggregate(recs), L: string[] = [];
  const at = recs.map(r => (r as any).at).filter(Boolean).sort();
  const vrows = Object.values(vari).filter((v: any) => (v.shots?.length ?? 0) >= 2).map((v: any) => ({ v, r: varietyOf(v.shots) }));
  L.push('# Coverage report (D-233, D-235)', '');
  L.push(`Generated by \`tools/dev/coverage_report.ts\` from \`${o.src}\` (quality \`${o.q}\`; ${A.n} views; renders ${at[0] ?? '?'} … ${at[at.length - 1] ?? '?'}).`, '');
  L.push('## Read first: what is broken, unverified or provisional', '');
  L.push(`- **${pc(A.failRate)} of the views fail** at least one provisional threshold (placeholder > ${pc(FAIL.placeholder)}, missing > ${pc(FAIL.missing)} or low detail > ${pc(FAIL.lowDetail)} of the frame; thresholds C, Q-633). ${A.errors} views errored.`);
  const cover = new Set(recs.map(r => r.sub)).size;
  L.push(`- This covers ${cover} sub-areas. Views of the sample not yet rendered are not in this report; the sample is \`tests/data/coverage_points.json\`.`);
  L.push('- The low-detail measure (triangles per steradian at the pixel\'s distance AND shading high-frequency detail, both below thresholds) is a proxy (C, Q-632): it catches unflagged boxes, but a procedurally shaded low-poly surface can pass it and a clean real surface can fail it. The tiling measure is a heuristic: colonnades, merlons, courses and steps are periodic by design.');
  L.push('- Metrics are measurements, not judgements: the rubric reviewer\'s scores on a stratified sample are separate (D-233).');
  L.push('- Areas are INTERIM (six top-level areas and their strata from the walkable grid, the town plan, the plain data and the terrain), not the MASTER_PLAN §4.3 registry: `data/areas.json` / `tools/dev/areas.ts` is not built.');
  if (o.refused?.length) L.push(`- **${o.refused.length} records REFUSED** (seed or camera not the sample file's): ${[...new Set(o.refused.map(r => r.why))].slice(0, 3).join('; ')}. Not counted anywhere below${o.q.includes('legacy') ? ' except where marked pilot' : ''}.`);
  if (o.extras?.length) L.push(`- ${o.extras.length} worst-first extra views are reported apart and never counted in a pass rate.`);
  if (vrows.length) L.push(`- Scene variety (D-236): ${vrows.filter(x => x.r.verdict !== 'differs').length} of ${vrows.length} places are near-identical or empty across days.`);
  L.push('');
  if (o.board) L.push(o.board, '');
  L.push('## Per area (worst first)', '', '| area | views | fail | placeholder (mean / max) | missing | low detail | flatness (median) | tiling blocks | identical inst. ≤ 30 m (median) | people in view | idle share | worst view |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const g of A.areas) L.push(`| ${g.key} | ${g.n}${g.errors ? ` (${g.errors} err)` : ''} | ${pc(g.failRate)} | ${pc(g.ph)} / ${pc(g.phMax)} | ${pc(g.missing)} | ${pc(g.low)} | ${f2(g.flat)} | ${pc(g.tiling)} | ${Number.isFinite(g.rep) ? g.rep : '–'} | ${f2(g.people)} | ${pc(g.idle)} | ${g.worst} |`);
  L.push('', '## Per sub-area (worst first)', '', '| sub-area | views | fail | placeholder | missing | low detail | flatness | people | worst |', '|---|---|---|---|---|---|---|---|---|');
  for (const g of A.subs) L.push(`| ${g.key} | ${g.n} | ${pc(g.failRate)} | ${pc(g.ph)} | ${pc(g.missing)} | ${pc(g.low)} | ${f2(g.flat)} | ${f2(g.people)} | ${g.worst} |`);
  L.push('', '## Per world state', '', '| state | views | fail | placeholder | missing | low detail |', '|---|---|---|---|---|---|');
  for (const g of A.states) L.push(`| ${g.key} | ${g.n} | ${pc(g.failRate)} | ${pc(g.ph)} | ${pc(g.missing)} | ${pc(g.low)} |`);
  L.push('', '## Placeholder objects by the pixels they cost', '', 'Cost = the object\'s share of the frame summed over views ÷ views (the mean share of every frame it takes).', '', '| object | cost | views | max share | where |', '|---|---|---|---|---|');
  for (const e of A.placeholderObjects.slice(0, 25)) L.push(`| ${e.key} | ${pc(e.cost)} | ${e.views} | ${pc(e.max)} | ${e.subs.slice(0, 6).join(', ')}${e.subs.length > 6 ? ' …' : ''} |`);
  L.push('', '## Low-detail objects (flag-free) by the pixels they cost', '', '| object | cost | views | max share | where |', '|---|---|---|---|---|');
  for (const e of A.lowObjects.slice(0, 25)) L.push(`| ${e.key} | ${pc(e.cost)} | ${e.views} | ${pc(e.max)} | ${e.subs.slice(0, 6).join(', ')}${e.subs.length > 6 ? ' …' : ''} |`);
  L.push('', '## Repetition: the most repeated geometries within 30 m', '', '| object | instances per view (mean over all views) | views | max in one view |', '|---|---|---|---|');
  for (const e of A.repeated.slice(0, 15)) L.push(`| ${e.key} | ${e.cost.toFixed(1)} | ${e.views} | ${e.max} |`);
  const lifeR = recs.filter(r => r.life && r.life.people > 0);
  L.push('', '## Life in view', '');
  if (lifeR.length) { const s = (k: string) => lifeR.reduce((a, r) => a + (r.life.byCls[k] ?? 0), 0), t = (k: string) => lifeR.reduce((a, r) => a + (r.life.after?.[k] ?? 0), 0), P = lifeR.reduce((a, r) => a + r.life.people, 0);
    L.push(`${lifeR.length} views with people (${P} people seen): moving ${s('moving')}, active ${s('active')}, idle ${s('idle')}, resting ${s('resting')}. After 2 s of world time: frozen walkers ${t('frozen')}, sliding non-walkers ${t('sliding')}, jumped ${t('jumped')}, off the walkable grid ${t('clipping')} of ${t('clipChecked')} checked. Twins (people sharing a body variant in one view): ${lifeR.reduce((a, r) => a + r.life.twins, 0)}.`); }
  else L.push('No view had people drawn in it.');
  L.push('', '## Scene variety across days (D-236)', '');
  if (vrows.length) { L.push('| place | sub | days | people Jaccard (pairs) | activity similarity | object overlap | image diff (8-bit) | verdict |', '|---|---|---|---|---|---|---|---|');
    for (const { v, r } of vrows) L.push(`| ${v.place} | ${v.sub} | ${v.shots.map((s: any) => s.day).join(', ')} | ${r.pairs.map(p => f2(p.people)).join(' / ')} | ${r.pairs.map(p => f2(p.acts)).join(' / ')} | ${r.pairs.map(p => f2(p.objects)).join(' / ')} | ${r.pairs.map(p => p.imgDiff.toFixed(1)).join(' / ')} | ${r.verdict} |`); }
  else L.push('Not run.');
  L.push('', '## Worst 30 views', '', o.sheet ? `Contact sheet: \`${o.sheet}\` (thumbnails in this order).` : 'Contact sheet: not made (python3 with Pillow unavailable, or no thumbnails).', '',
    '| # | view | sub-area | state | sun | placeholder | missing | low detail | flatness | biggest objects |', '|---|---|---|---|---|---|---|---|---|---|');
  A.worst.slice(0, 30).forEach((r, i) => L.push(`| ${i + 1} | ${r.id} | ${r.sub} | ${r.state} | ${r.sunAlt ?? '–'}° | ${r.error ? 'ERROR' : pc(r.shares?.placeholder ?? NaN)} | ${pc(r.missing ?? NaN)} | ${pc(r.lowDetail ?? NaN)} | ${r.flatness ?? '–'} | ${r.error ? r.error.slice(0, 80) : (r.objects ?? []).slice(0, 3).map(o => `${o.key}${o.ph ? ' [PH]' : ''} ${pc(o.share)}`).join('; ')} |`));
  L.push('', '## Performance per view', '', `Draw calls (median) ${median(recs.filter(r => r.drawCalls).map(r => r.drawCalls!))}, triangles (median) ${(median(recs.filter(r => r.triangles).map(r => r.triangles!)) / 1e6).toFixed(2)} M, materials in view (median) ${median(recs.filter(r => r.materials).map(r => r.materials!))}, distinct geometries in view (median) ${median(recs.filter(r => r.geometries).map(r => r.geometries!))}; wall time per view (median) ${(median(recs.filter(r => r.ms).map(r => r.ms!)) / 1000).toFixed(0)} s.`);
  return { md: L.join('\n') + '\n', agg: A };
}

if (process.argv[1]?.endsWith('coverage_report.ts')) {
  const src = process.argv[2] ?? 'shots/coverage.json', out = process.argv[3] ?? 'REVIEWS/coverage_report.md', qf = process.argv[4];
  const all: Record<string, Rec> = existsSync(src) ? JSON.parse(readFileSync(src, 'utf8')) : {};
  const legacy = process.argv.includes('--legacy'), sample = existsSync('tests/data/coverage_points.json') ? JSON.parse(readFileSync('tests/data/coverage_points.json', 'utf8')) : null;
  const val = validate(Object.values(all).filter(r => !qf || r.q === qf), sample);
  const recs = legacy ? [...val.ok, ...Object.values(all).filter(r => (!qf || r.q === qf) && val.refused.some(x => x.id === r.id))] : val.ok;
  const board = boardMd(val.ok, sample, depHash('.'));
  const vsrc = src.replace(/\.json$/, '_variety.json'), vari = existsSync(vsrc) ? Object.fromEntries(Object.entries(JSON.parse(readFileSync(vsrc, 'utf8'))).filter(([k]) => !qf || k.includes(`|${qf}|`))) : {};
  const q = qf ?? [...new Set(recs.map(r => r.q))].join(', ');
  // contact sheet of the worst 30 (python3 + Pillow)
  const worst = aggregate(recs).worst.slice(0, 30).filter(r => existsSync(`shots/coverage/${r.id}-${r.q}.jpg`));
  let sheet: string | null = null;
  if (worst.length) {
    const spec = JSON.stringify(worst.map((r, i) => ({ f: `shots/coverage/${r.id}-${r.q}.jpg`, t: `${i + 1}. ${r.id} ${r.sub} ${r.state} ph ${pc(r.shares?.placeholder ?? NaN)} miss ${pc(r.missing ?? NaN)} low ${pc(r.lowDetail ?? NaN)}` })));
    const py = `import json,sys
from PIL import Image, ImageDraw
L=json.loads(sys.argv[1]); w,h,c=320,180,5; rows=(len(L)+c-1)//c
S=Image.new('RGB',(c*w,rows*(h+16)),(20,20,20)); D=ImageDraw.Draw(S)
for i,e in enumerate(L):
  im=Image.open(e['f']).convert('RGB').resize((w,h)); x,y=(i%c)*w,(i//c)*(h+16); S.paste(im,(x,y+16)); D.text((x+3,y+2),e['t'][:52],fill=(255,230,120))
S.save(sys.argv[2],quality=82)`;
    try { execFileSync('python3', ['-c', py, spec, 'REVIEWS/coverage_worst.jpg']); sheet = 'REVIEWS/coverage_worst.jpg'; } catch (e) { console.warn('contact sheet skipped:', String(e).slice(0, 200)); }
  }
  const { md } = reportMd(recs, vari, { q: legacy ? q + ' (legacy pilot records included)' : q, sheet, src, board, refused: val.refused, extras: val.extras });
  writeFileSync(out, md); console.log(`${recs.length} views → ${out}${sheet ? ` + ${sheet}` : ''}`);
  const ti = process.argv.indexOf('--thresholds'), tfile = ti >= 0 ? process.argv[ti + 1] : 'gates/thresholds.json', dep = depHash('.');
  if (process.argv.includes('--evidence')) { const w = writeEvidence(val.ok, sample, dep, thresholds(tfile)); console.log(`evidence: ${w.written.length ? w.written.join(', ') + ' → ' + w.dir : 'none (no valid records)'}`); }
  if (process.argv.includes('--board')) { writeFileSync('COVERAGE.md', boardAll(val.ok, sample, dep, tfile)); console.log('board → COVERAGE.md'); }
}
