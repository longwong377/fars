// Coverage report (D-233, D-235): aggregates shots/coverage.json (tests/e2e/coverage.spec.ts) per area and sub-area, worst
// views first, placeholder and low-detail objects by the pixels they cost, repetition, life and scene variety across days
// (shots/coverage_variety.json), and writes REVIEWS/coverage_report.md plus a contact sheet of the worst 30 thumbnails
// (REVIEWS/coverage_worst.jpg, python3 + Pillow; skipped with a note if unavailable).
// Usage: npx tsx tools/dev/coverage_report.ts [coverage.json] [out.md] [Q filter, e.g. test]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/** provisional pass/fail thresholds per view (C, Q-633): tuned once a full pass exists; never lowered to pass */
export const FAIL = { placeholder: 0.05, missing: 0.05, lowDetail: 0.25 } as const;
export interface Rec { id: string; place?: string; area: string; sub: string; state: string; q: string; error?: string; revisit?: boolean; sunAlt?: number;
  shares?: { sky: number; placeholder: number; untiered: number; skyHole: number; badId: number }; missing?: number | null; flatness?: number | null; lowDetail?: number | null;
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
export function reportMd(recs: Rec[], vari: Record<string, any>, o: { q: string; sheet: string | null; src: string }) {
  const A = aggregate(recs), L: string[] = [];
  const at = recs.map(r => (r as any).at).filter(Boolean).sort();
  const vrows = Object.values(vari).map((v: any) => ({ v, r: varietyOf(v.shots) }));
  L.push('# Coverage report (D-233, D-235)', '');
  L.push(`Generated by \`tools/dev/coverage_report.ts\` from \`${o.src}\` (quality \`${o.q}\`; ${A.n} views; renders ${at[0] ?? '?'} … ${at[at.length - 1] ?? '?'}).`, '');
  L.push('## Read first: what is broken, unverified or provisional', '');
  L.push(`- **${pc(A.failRate)} of the views fail** at least one provisional threshold (placeholder > ${pc(FAIL.placeholder)}, missing > ${pc(FAIL.missing)} or low detail > ${pc(FAIL.lowDetail)} of the frame; thresholds C, Q-633). ${A.errors} views errored.`);
  const cover = new Set(recs.map(r => r.sub)).size;
  L.push(`- This covers ${cover} sub-areas. Views of the sample not yet rendered are not in this report; the sample is \`tests/data/coverage_points.json\`.`);
  L.push('- The low-detail measure (triangles per steradian at the pixel\'s distance AND shading high-frequency detail, both below thresholds) is a proxy (C, Q-632): it catches unflagged boxes, but a procedurally shaded low-poly surface can pass it and a clean real surface can fail it. The tiling measure is a heuristic: colonnades, merlons, courses and steps are periodic by design.');
  L.push('- Metrics are measurements, not judgements: the rubric reviewer\'s scores on a stratified sample are separate (D-233).');
  if (vrows.length) L.push(`- Scene variety (D-236): ${vrows.filter(x => x.r.verdict !== 'differs').length} of ${vrows.length} places are near-identical or empty across days.`);
  L.push('');
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
  const recs = Object.values(all).filter(r => !qf || r.q === qf);
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
  const { md } = reportMd(recs, vari, { q, sheet, src });
  writeFileSync(out, md); console.log(`${recs.length} views → ${out}${sheet ? ` + ${sheet}` : ''}`);
}
