// The carved Old Persian sign sequence (D-177). For every inscription in src/data/inscriptions.json with an Old Persian
// version this writes `op_signs` (the carved lines sign by sign, "ba-ga : va-za-ra-ka : …", ":" = word divider),
// `op_lined` and `op_words` (one row per word: the corpus word, the carved signs and how Schmitt's reading compares).
//
// What is carved: the published sign sequence, i.e. the sign-by-sign transliteration in Kent's convention
// (data/corpus/op_translit.json, D-176), word by word, with its word division and its lines:
//  - every corpus word is spelled by the convention (src/lang/oldPersian.ts spellKentParts: every letter but the inherent a
//    is a sign; â after a consonant is Ca-a; logograms XŠ, DH, BG, BU, AM; "+" a lost sign, left uncut), or taken sign by
//    sign where the corpus prints signs (DPa);
//  - a slip of the copy (a letter the copy mistyped: "Xšhayâršâm", "gâthun") is corrected ONLY by a listed decision in
//    data/corpus/op_sign_decisions.json, with its evidence: `ario` (the corrected signs are those Kent's rules give for
//    Schmitt's reading of the same word) or `copy` (the corrected word stands, so spelled, elsewhere in the corpus). Every
//    decision must be used as many times as it says (`count`) and meet its evidence, or the build fails;
//  - a word Schmitt reads that the corpus does not have is NOT carved; a word the corpus has that Schmitt does not read IS
//    carved (the corpus is the sign sequence). Both are listed.
// Schmitt's edition (ARIo, CC0: `op_translit`, the text the translation layer shows) is aligned with the corpus word by word
// only to report how the two compare (research/OP_SIGNS.md): `same` (Kent's rules on Schmitt's word give the carved signs),
// `glide` (they differ only by a written glide i/y/v), `logogram` (the stone writes a logogram), `reading` (another reading:
// Q-288), `corpus-only`, `ario-only` (not carved).
// Texts the corpus lacks (DPh: sealed plates, never carved) get Kent's rules on Schmitt's words, tier C, `op_lined` false.
// Run: npx tsx tools/build_op_signs.ts [--report]   (after tools/build_inscriptions.py; writes src/data/inscriptions.json and
// research/OP_SIGNS.md; --report writes only the report)
import { readFileSync, writeFileSync } from 'node:fs';
import { corpusWords, corpusSignLines, spellNormalised, signString, parseSigns, LOST } from '../src/lang/oldPersian';

const INS = 'src/data/inscriptions.json', CORPUS = 'data/corpus/op_translit.json', DEC = 'data/corpus/op_sign_decisions.json';
const ins = JSON.parse(readFileSync(INS, 'utf8')), corpus = JSON.parse(readFileSync(CORPUS, 'utf8'));
export interface Correction { id: string; copy: string; read: string; count: number; evidence: 'ario' | 'copy' | 'convention'; why: string }
const corrections: Correction[] = JSON.parse(readFileSync(DEC, 'utf8')).corrections;

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
export type Cmp = 'same' | 'glide' | 'logogram' | 'reading' | 'corpus-only' | 'ario-only';
/** how Schmitt's word(s) compare with the carved corpus word(s) */
function compare(ario: string[], carved: string[]): Cmp {
  if (!ario.length) return 'corpus-only'; if (!carved.length) return 'ario-only';
  const r = ario.map(w => spellNormalised(w)).flat();
  if (signString(r) === signString(carved)) return 'same';
  if (carved.some(s => /^[A-Z]/.test(s))) return 'logogram';
  return glideOnly(r, carved) ? 'glide' : 'reading';
}

const used = corrections.map(() => 0), problems: string[] = [], report: string[] = [], stats: Record<string, Record<string, number>> = {};
const texts = Object.entries<any>(ins).filter(([id, t]) => id !== '_meta' && t.op_translit);
for (const [id, t] of texts) {
  const ario: string[] = String(t.op_translit).split(/\s+/).filter(Boolean);
  const st: Record<string, number> = stats[id] = { corpus: 0, same: 0, glide: 0, logogram: 0, reading: 0, 'corpus-only': 0, 'ario-only': 0, corrected: 0, lost: 0, ario: ario.length };
  if (!corpus[id]) { // no corpus copy: Kent's rules on Schmitt's words (not carved: DPh)
    t.op_signs = [ario.map(w => signString(spellNormalised(w))).join(' : ')]; t.op_lined = false;
    t.op_words = ario.map(w => ({ ario: w, copy: null, signs: signString(spellNormalised(w)), cmp: 'ario-only' as Cmp, basis: 'rule (no corpus copy)' }));
    t.tier = { ...t.tier, op_signs: 'C (Kent\'s rules on the ARIo words: the corpus has no copy of this text; not carved)', op_lines: 'C (no lineation read)' };
    continue;
  }
  const fixes = corrections.map((c, i) => [c, i] as const).filter(([c]) => c.id === id);
  const W = corpusWords(corpus[id].lines, copy => { const f = fixes.find(([c]) => c.copy === copy); if (!f) return null; used[f[1]]++; return f[0].read; });
  st.corpus = W.length;
  t.op_signs = corpusSignLines(W); t.op_lined = true;
  for (const l of t.op_signs) parseSigns(l); // throws on an unknown sign
  st.lost = W.flatMap(w => w.signs).filter(s => s === LOST).length;
  // report: align Schmitt's words with the corpus words (by their signs), merging a lone neighbour when the joined signs
  // match better (paruzanānām = paruv | zanānām; dūrai̯ api = dûraiapiy)
  type Unit = { ai: number[]; wi: number[] };
  const aSigns = ario.map(w => spellNormalised(w)), units: Unit[] = align(aSigns, W.map(w => w.signs)).map(([a, k]) => ({ ai: a >= 0 ? [a] : [], wi: k >= 0 ? [k] : [] }));
  const sig = (u: Unit, side: 'a' | 'k') => (side === 'a' ? u.ai.flatMap(i => aSigns[i]) : u.wi.flatMap(i => W[i].signs));
  const cost = (u: Unit) => (u.ai.length && u.wi.length ? lev(sig(u, 'a'), sig(u, 'k')) : sig(u, 'a').length + sig(u, 'k').length);
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < units.length - 1; i++) {
      const a = units[i], b = units[i + 1], lone = (u: Unit) => (u.ai.length === 0) !== (u.wi.length === 0);
      if (!lone(a) && !lone(b)) continue;
      const m: Unit = { ai: [...a.ai, ...b.ai], wi: [...a.wi, ...b.wi] };
      if (m.ai.length && m.wi.length && cost(m) < cost(a) + cost(b) && cost(m) <= 2) { units.splice(i, 2, m); changed = true; }
    }
  }
  const rows: any[] = [];
  for (const u of units) {
    const aw = u.ai.map(i => ario[i]), ws = u.wi.map(i => W[i]), carved = ws.flatMap(w => w.signs), cmp = compare(aw, carved);
    st[cmp] += cmp === 'corpus-only' || cmp === 'ario-only' ? Math.max(ws.length, aw.length) : 1;
    const fixed = ws.filter(w => w.read !== w.copy);
    st.corrected += fixed.length;
    const row: any = { ario: aw.length ? aw.join(' ') : null, copy: ws.length ? ws.map(w => w.copy).join(' ') : null, signs: ws.length ? ws.map((w, i) => (i > 0 ? (w.divBefore ? ' : ' : ' ') : '') + signString(w.signs)).join('') : null, cmp }; // ' ' = no divider between the two
    if (fixed.length) row.read = ws.map(w => w.read).join(' ');
    if (ws.length && rows.length && !ws[0].divBefore) row.div = false; // follows the previous word without a divider
    rows.push(row);
    if (cmp !== 'same' || fixed.length) report.push(`| ${id} | ${aw.join(' ') || '—'} | ${aw.length ? aw.map(w => signString(spellNormalised(w))).join(' : ') : '—'} | ${ws.map(w => w.copy.replace(/\|/g, '')).join(' ') || '—'} | ${fixed.length ? ws.map(w => w.read.replace(/\|/g, '')).join(' ') : ''} | ${ws.length ? ws.map(w => signString(w.signs)).join(' : ') : 'not carved'} | ${cmp} |`);
  }
  t.op_words = rows;
  t.tier = { ...t.tier, op_signs: 'B (the published sign-by-sign transliteration, Kent\'s convention, data/corpus/op_translit.json; slips of the copy corrected only as listed in op_sign_decisions.json; D-177)', op_lines: 'B (the corpus lineation)' };
  delete t.tier.op_signs_old;
}
// every correction used exactly as often as it says, and meeting its evidence
corrections.forEach((c, i) => {
  if (used[i] !== c.count) problems.push(`correction ${c.id} "${c.copy}": used ${used[i]}×, listed ${c.count}×`);
  const signs = corpusWords([c.read.replace(/\|/g, '')])[0]?.signs ?? [];
  if (c.evidence === 'ario') {
    const row = (ins[c.id].op_words as any[]).find(r => r.read && String(r.read).split(' ').includes(c.read));
    const want = row?.ario ? String(row.ario).split(' ').map((w: string) => signString(spellNormalised(w))).join('-') : null;
    if (!row || want !== signString(signs)) problems.push(`correction ${c.id} "${c.copy}" → "${c.read}" (${signString(signs)}): not the rule spelling of Schmitt's word (${row?.ario}: ${want})`);
  } else if (c.evidence === 'convention') {
    const undoubled = c.copy.replace(/([bcdfghjklmnprstvxzθšç])\1/g, '$1');
    if (!/([bcdfghjklmnprstvxzθšç])\1/.test(c.copy) || undoubled !== c.read) problems.push(`correction ${c.id} "${c.copy}" → "${c.read}": not the undoubling of a doubled consonant letter`);
  } else {
    const elsewhere = Object.entries<any>(corpus).some(([k, v]) => k !== '_meta' && corpusWords(v.lines).some(w => w.copy.replace(/\|/g, '') === c.read.replace(/\|/g, '')));
    if (!elsewhere) problems.push(`correction ${c.id} "${c.copy}" → "${c.read}": the corrected word does not stand elsewhere in the corpus`);
  }
});
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
const cols = ['corpus', 'same', 'glide', 'logogram', 'reading', 'corpus-only', 'ario-only', 'corrected', 'lost', 'ario'];
const md = ['# Old Persian: the carved sign sequence (generated by tools/build_op_signs.ts; D-176, D-177)', '',
  'What is carved: the published sign-by-sign transliteration in Kent\'s convention (Kent 1953 / Lecoq 1997), data/corpus/op_translit.json',
  '(D-176), word by word and line by line; slips of the copy are corrected only as listed in data/corpus/op_sign_decisions.json, each with its',
  'evidence. Schmitt\'s edition (ARIo, CC0; the text the translation layer shows) is compared word by word: Kent\'s spelling rules on his',
  'word give the carved signs (`same`), or differ only by a written glide (`glide`), or the stone writes a logogram (`logogram`), or the two',
  'editions read differently (`reading`: Q-288); `corpus-only` words are carved, `ario-only` words are not. DPh (sealed plates) has no',
  'corpus copy and is not carved.', '',
  `Columns: corpus = corpus words carved; same/glide/logogram/reading = aligned word groups; corrected = corpus words corrected (listed);`,
  'lost = signs lost in the corpus, left uncut; ario = Schmitt\'s words.', '',
  `| Text | ${cols.join(' | ')} |`, `|---|${cols.map(() => '---').join('|')}|`,
  ...Object.entries(stats).map(([id, s]) => `| ${id} | ${cols.map(c => s[c] ?? 0).join(' | ')} |`), '',
  '## Every word where the carving is not simply Kent\'s rules on Schmitt\'s word, or where the copy was corrected', '',
  '| Text | ARIo (Schmitt) | Kent\'s rules on it | corpus | corrected to | carved | comparison |', '|---|---|---|---|---|---|---|', ...report, '',
  '## Corrections of the copy (data/corpus/op_sign_decisions.json)', '',
  '| Text | copy | read | × | evidence | why |', '|---|---|---|---|---|---|',
  ...corrections.map(c => `| ${c.id} | ${c.copy} | ${c.read} | ${c.count} | ${c.evidence} | ${c.why} |`), ''];
writeFileSync('research/OP_SIGNS.md', md.join('\n'));
if (!process.argv.includes('--report')) writeFileSync(INS, JSON.stringify(ins, null, 1));
console.log(Object.entries(stats).map(([id, s]) => `${id}: ${cols.map(c => `${c} ${s[c] ?? 0}`).join(', ')}`).join('\n'));
