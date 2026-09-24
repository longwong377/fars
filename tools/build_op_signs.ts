// The carved Old Persian sign sequence (D-184, replacing D-177's Kent-copy basis). For every inscription in
// src/data/inscriptions.json with an Old Persian version this writes `op_signs` (the carved lines sign by sign,
// "ba-ga : va-za-ra-ka : …", ":" = word divider), `op_lined` and `op_words` (one row per word of the stone: its signs, what
// the edition marks in it, and Schmitt's normalised word with how Kent's spelling rules on it compare).
//
// What is carved: the published sign-by-sign edition, ORACC ARIo in CATF (R. Schmitt 2009, CC0; data/corpus/ario_catf.json,
// extracted by tools/extract_ario_catf.py), line by line and sign by sign, as the stone stood in 467 BCE:
//  - every sign the edition reads on the stone, with its word dividers and logograms (XŠ where the stone writes it);
//  - an extra sign the engraver cut (<<…>>) is carved: it is on the stone;
//  - a sign the engraver omitted, which the editor supplies (<…>), is NOT carved: it was never on the stone;
//  - a sign lost since antiquity and restored by the editor ([…]) IS carved (the stone was whole in 467), tier C, counted;
//  - a stretch lost and not restored ([...]) is carved as LOST_RUN uncut blanks (how many signs is not known: C, flagged).
// Schmitt's normalised words (`op_translit`, the text the translation layer glosses) are aligned with the stone's words only
// to report how Kent's orthographic rules on them compare with what the stone has (research/OP_SIGNS.md): `same`, `glide`,
// `logogram`, `engraver` (an extra or omitted sign), `reading` (anything else), `damaged` (a word with a lost stretch).
// Run: npx tsx tools/build_op_signs.ts [--report]   (after tools/build_inscriptions.py; writes src/data/inscriptions.json and
// research/OP_SIGNS.md; --report writes only the report)
import { readFileSync, writeFileSync } from 'node:fs';
import { catfWords, edSignLines, spellNormalised, signString, parseSigns, LOST, LOST_RUN, type EdWord } from '../src/lang/oldPersian';

const INS = 'src/data/inscriptions.json', ED = 'data/corpus/ario_catf.json';
const ins = JSON.parse(readFileSync(INS, 'utf8')), ed = JSON.parse(readFileSync(ED, 'utf8')).texts;

const lev = (x: string[], y: string[]) => { const d = [...Array(y.length + 1).keys()]; for (let i = 1; i <= x.length; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= y.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (x[i - 1] === y[j - 1] ? 0 : 1)); prev = t; } } return d[y.length]; };
/** Needleman–Wunsch over sign strings: cost 0 for equal words, scaled edit distance otherwise, 1 for a gap */
function align(a: string[][], b: string[][]): [number, number][] {
  const n = a.length, m = b.length, D: number[][] = [...Array(n + 1)].map(() => Array(m + 1).fill(0)), P: number[][] = [...Array(n + 1)].map(() => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) { D[i][0] = i; P[i][0] = 1; } for (let j = 1; j <= m; j++) { D[0][j] = j; P[0][j] = 2; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const s = D[i - 1][j - 1] + 1.6 * lev(a[i - 1], b[j - 1]) / Math.max(a[i - 1].length, b[j - 1].length, 1), u = D[i - 1][j] + 1, l = D[i][j - 1] + 1;
    if (s <= u && s <= l) { D[i][j] = s; P[i][j] = 0; } else if (u <= l) { D[i][j] = u; P[i][j] = 1; } else { D[i][j] = l; P[i][j] = 2; }
  }
  const pairs: [number, number][] = []; let i = n, j = m;
  while (i > 0 || j > 0) { const p = P[i][j]; if (i > 0 && j > 0 && p === 0) { pairs.push([i - 1, j - 1]); i--; j--; } else if (i > 0 && (j === 0 || p === 1)) { pairs.push([i - 1, -1]); i--; } else { pairs.push([-1, j - 1]); j--; } }
  return pairs.reverse();
}
/** the difference is only written glides: i before ya, ya after i, va after u (inserted or left out) */
function glideOnly(r: string[], k: string[]): boolean {
  const glide = (s: string[], i: number) => (s[i] === 'i' && s[i + 1] === 'ya') || (s[i] === 'ya' && s[i - 1] === 'i') || (s[i] === 'va' && s[i - 1] === 'u');
  const memo = new Map<number, boolean>();
  const ok = (i: number, j: number): boolean => {
    if (i === r.length && j === k.length) return true;
    const key = i * 1000 + j; if (memo.has(key)) return memo.get(key)!;
    const v = (i < r.length && j < k.length && r[i] === k[j] && ok(i + 1, j + 1)) || (i < r.length && glide(r, i) && ok(i + 1, j)) || (j < k.length && glide(k, j) && ok(i, j + 1));
    memo.set(key, v); return v;
  };
  return r.join('-') !== k.join('-') && ok(0, 0);
}
export type Cmp = 'same' | 'glide' | 'logogram' | 'engraver' | 'reading' | 'damaged' | 'stone-only' | 'ario-only';
function compare(ario: string[], ws: EdWord[]): Cmp {
  if (!ario.length) return 'stone-only'; if (!ws.length) return 'ario-only';
  const carved = ws.flatMap(w => w.signs.map(s => s.s)), r = ario.map(w => spellNormalised(w)).flat();
  if (signString(r) === signString(carved)) return 'same';
  if (ws.some(w => w.lost)) return 'damaged';
  if (carved.some(s => /^[A-Z]/.test(s))) return 'logogram';
  if (ws.some(w => w.omitted.length || w.signs.some(s => s.excess))) return 'engraver';
  return glideOnly(r, carved) ? 'glide' : 'reading';
}

const report: string[] = [], stats: Record<string, Record<string, number>> = {};
const texts = Object.entries<any>(ins).filter(([id, t]) => id !== '_meta' && t.op_translit);
for (const [id, t] of texts) {
  const E = ed[id]; if (!E?.op?.length) throw new Error(`${id}: no Old Persian lines in ${ED}`);
  const ario: string[] = String(t.op_translit).split(/\s+/).filter(Boolean), W = catfWords(E.op);
  const st: Record<string, number> = stats[id] = { words: W.length, signs: 0, restored: 0, excess: 0, omitted: 0, lostRuns: 0, same: 0, glide: 0, logogram: 0, engraver: 0, reading: 0, damaged: 0, 'stone-only': 0, 'ario-only': 0, ario: ario.length };
  for (const w of W) { st.signs += w.signs.filter(s => s.s !== LOST).length; st.restored += w.signs.filter(s => s.restored && s.s !== LOST).length; st.excess += w.signs.filter(s => s.excess).length; st.omitted += w.omitted.length; if (w.lost) st.lostRuns++; }
  t.op_signs = edSignLines(W); t.op_lined = true;
  for (const l of t.op_signs) parseSigns(l); // throws on an unknown sign
  // Schmitt's words ↔ the stone's words: one to one where the counts agree (the same edition), else aligned by signs
  const pairs: [number, number][] = ario.length === W.length ? ario.map((_, i) => [i, i]) : align(ario.map(w => spellNormalised(w)), W.map(w => w.signs.map(s => s.s)));
  const rows: any[] = [];
  for (const [ai, wi] of pairs) {
    const aw = ai >= 0 ? [ario[ai]] : [], ws = wi >= 0 ? [W[wi]] : [], cmp = compare(aw, ws);
    st[cmp]++;
    const w = ws[0], row: any = { ario: aw[0] ?? null, signs: w ? signString(w.signs.map(s => s.s)) : null, cmp };
    if (w?.signs.some(s => s.restored && s.s !== LOST)) row.restored = w.signs.filter(s => s.restored && s.s !== LOST).length;
    if (w?.signs.some(s => s.excess)) row.excess = w.signs.filter(s => s.excess).map(s => s.s);
    if (w?.omitted.length) row.omitted = w.omitted;
    if (w?.lost) row.lost = true;
    if (w && rows.length && !w.divBefore) row.div = false;
    rows.push(row);
    const marks = [row.excess ? `extra ${row.excess.join(',')} cut` : '', row.omitted ? `${row.omitted.join(',')} omitted (not carved)` : '', row.restored ? `${row.restored} restored` : '', row.lost ? 'lost stretch (blank)' : ''].filter(Boolean).join('; ');
    if (cmp !== 'same' || marks) report.push(`| ${id} | ${aw[0] ?? '—'} | ${aw.length ? signString(spellNormalised(aw[0])) : '—'} | ${row.signs ?? 'not on the stone'} | ${marks} | ${cmp} |`);
  }
  t.op_words = rows;
  t.tier = { ...t.tier, op_signs: `A (the published sign-by-sign edition, ARIo in CATF, CC0; data/corpus/ario_catf.json; D-184); restorations of later damage C (${st.restored} signs); lost stretches blank (C)`, op_lines: 'A (the edition\'s lines)' };
  delete t.tier.op_signs_old;
}
const cols = ['words', 'signs', 'restored', 'excess', 'omitted', 'lostRuns', 'same', 'glide', 'logogram', 'engraver', 'reading', 'damaged', 'stone-only', 'ario-only', 'ario'];
const md = ['# Old Persian: the carved sign sequence (generated by tools/build_op_signs.ts; D-184)', '',
  'What is carved: the published sign-by-sign edition, ORACC ARIo in CATF (Schmitt 2009, CC0; data/corpus/ario_catf.json), line by line',
  'and sign by sign, as the stone stood in 467: the engraver\'s extra signs (<<…>>) carved, the signs he omitted (<…>, supplied by the',
  `editor) NOT carved, the editor's restorations of later damage ([…]) carved (C), a stretch lost and not restored ([...]) left as ${LOST_RUN}`,
  'uncut blanks (C, flagged). tests/lang.test.ts re-reads the edition independently and compares every carved sign and divider.', '',
  'The comparison columns set Kent\'s orthographic rules on Schmitt\'s normalised word (the text the translation layer shows) against',
  'what the stone has: same; glide (a written i/y/v); logogram (the stone writes XŠ); engraver (an extra or omitted sign); reading',
  '(anything else); damaged (a word with a lost stretch). They describe the stone\'s spelling; they change nothing carved.', '',
  `Columns: words, signs = the stone's words and signs carved; restored = signs restored ([…]) and carved; excess = extra signs cut by the`,
  'engraver; omitted = signs the engraver left out (not carved); lostRuns = unrestored stretches; ario = Schmitt\'s normalised words.', '',
  `| Text | ${cols.join(' | ')} |`, `|---|${cols.map(() => '---').join('|')}|`,
  ...Object.entries(stats).map(([id, s]) => `| ${id} | ${cols.map(c => s[c] ?? 0).join(' | ')} |`), '',
  '## Every word where the stone is not simply Kent\'s rules on Schmitt\'s word, or that carries an edition mark', '',
  '| Text | ARIo (normalised) | Kent\'s rules on it | carved (the edition\'s signs) | edition marks | comparison |', '|---|---|---|---|---|---|', ...report, ''];
writeFileSync('research/OP_SIGNS.md', md.join('\n'));
if (!process.argv.includes('--report')) writeFileSync(INS, JSON.stringify(ins, null, 1));
console.log(Object.entries(stats).map(([id, s]) => `${id}: ${cols.map(c => `${c} ${s[c] ?? 0}`).join(', ')}`).join('\n'));
