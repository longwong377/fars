// The carved Old Persian sign sequence (D-165). For every inscription in src/data/inscriptions.json with an Old Persian
// version this writes `op_signs` (the carved lines sign by sign, "ba-ga : va-za-ra-ka : …", ":" = word divider) and
// `op_words` (one row per word or word group of the edition: the ARIo word, the carved signs, Kent's word and the basis).
//
// Sources and rules (research/OP_SIGNS.md is the generated report):
//  - Words and readings: ARIo (Schmitt 2009, CC0), `op_translit`.
//  - Each word is spelled by Kent's orthographic rules (src/lang/oldPersian.ts spellNormalised).
//  - The graphemic witness is Kent's transliteration as printed by Livius (data/corpus/livius_op.json), aligned word by
//    word. Agreement: the signs are B (two witnesses; the sign-by-sign edition itself is not reachable, BLOCKERS B16).
//  - A difference is classed:
//     LOGO   Kent writes a logogram (XŠ, DH …): ARIo's transcription never writes one → Kent's signs;
//     GLIDE  the signs differ only by an i before y, a y after i or a v after u (ahiyāyā/ahyāyā, paruvzanānām, hauvciy,
//            -āhy/-āhiy): a written glide the normalised transcription does not carry → Kent's signs, unless the copy
//            writes this spelling only here and spells the same ARIo word by the rule elsewhere (then a slip of the copy);
//     READ   anything else (another consonant, a vowel sign a more or less, another word): Schmitt's reading → the rule
//            spelling of the ARIo word.
//    Word division follows Kent's copy (it prints every divider; ARIo's spaces are its lemmatisation), as does the
//    lineation: a word Kent breaks across two lines is broken at the same sign.
//  - data/corpus/op_sign_decisions.json overrides a class decision (each with its reason); every override must be used.
// Run: npx tsx tools/build_op_signs.ts [--report]   (after tools/build_inscriptions.py; writes src/data/inscriptions.json and
// research/OP_SIGNS.md; --report writes only the report)
import { readFileSync, writeFileSync } from 'node:fs';
import { spellKentParts, spellNormalised, signString, parseSigns, LOST } from '../src/lang/oldPersian';

const INS = 'src/data/inscriptions.json', KENT = 'data/corpus/livius_op.json', DEC = 'data/corpus/op_sign_decisions.json';
const ins = JSON.parse(readFileSync(INS, 'utf8')), kent = JSON.parse(readFileSync(KENT, 'utf8'));
const overrides: { id: string; ario: string; kent: string; carve: 'kent' | 'rule'; why: string }[] = JSON.parse(readFileSync(DEC, 'utf8')).decisions;

interface KWord { text: string; signs: string[]; line: number; breaks: number[]; divBefore: boolean; divAtEnd: boolean }
/** Kent's lines → words. "\" is a divider; a word runs on across a line end unless a divider stands there (XPa also marks the
 *  run-on with a hyphen); two words separated by a space only have no divider between them on the stone ("Aurahya Mazdâha");
 *  DPa is printed sign by sign. `divAtEnd`: the divider before the word stands at the end of the previous line (not at the
 *  start of the word's own); `trailing`: the text ends with a divider */
function kentWords(lines: string[]): KWord[] & { trailing?: boolean } {
  const out: KWord[] & { trailing?: boolean } = []; let pieces: string[] = [], line0 = 0, div = false, pendingDiv = false, divEnd = false, atEnd = false;
  const toks = lines.join(' ').split(/[\s\\]+/).filter(Boolean), signText = toks.filter(p => /^([a-zθšç]+-)+/.test(p)).length > toks.length / 2;
  const close = () => {
    if (!pieces.length) return;
    if (signText) { // printed sign by sign (DPa): the pieces are sign groups
      const groups = pieces.map(p => p.split('-').filter(Boolean).map(s => (s === 'tha' ? 'θa' : s))), breaks: number[] = [];
      groups.slice(0, -1).reduce((n, g) => { breaks.push(n + g.length); return n + g.length; }, 0);
      out.push({ text: pieces.join('|'), signs: groups.flat(), line: line0, breaks, divBefore: div, divAtEnd: atEnd });
    } else { const r = spellKentParts(pieces); out.push({ text: pieces.join('|'), signs: r.signs, line: line0, breaks: r.breaks, divBefore: div, divAtEnd: atEnd }); }
    pieces = [];
  };
  lines.forEach((raw, li) => {
    const line = raw.trim().replace(/-$/, ''); // the run-on hyphen (XPa, and DPa's sign groups)
    line.split('\\').forEach((seg, si) => {
      if (si > 0) { close(); pendingDiv = true; divEnd = false; }
      seg.trim().split(/\s+/).filter(Boolean).forEach((p, pi) => {
        if (pi > 0) { close(); pendingDiv = false; divEnd = false; } // a space without a divider
        if (!pieces.length) { line0 = li; div = pendingDiv; atEnd = divEnd && li > 0; pendingDiv = true; divEnd = false; }
        pieces.push(p);
      });
    });
    if (/\\\s*$/.test(line)) { close(); pendingDiv = true; divEnd = true; }
  });
  close();
  out.trailing = pendingDiv && divEnd;
  return out;
}
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
  const ok = (i: number, j: number): boolean => { // can r[i..] become k[j..] by inserting or leaving out glide signs only?
    if (i === r.length && j === k.length) return true;
    const key = i * 1000 + j; if (memo.has(key)) return memo.get(key)!;
    const v = (i < r.length && j < k.length && r[i] === k[j] && ok(i + 1, j + 1)) || (i < r.length && glide(r, i) && ok(i + 1, j)) || (j < k.length && glide(k, j) && ok(i, j + 1));
    memo.set(key, v); return v;
  };
  return r.join('-') !== k.join('-') && ok(0, 0);
}

interface Unit { ario: string[]; ai: number[]; kw: KWord[]; rule: string[][] }
type Row = { ario: string; signs: string; kent: string | null; basis: string; class?: string; why?: string; groups: { signs: string[]; divBefore: boolean; divAtEnd: boolean; line: number; breaks: number[] }[] };
const texts = Object.entries<any>(ins).filter(([id, t]) => id !== '_meta' && t.op_translit);
// pass 1: units per text (aligned ARIo word groups and Kent word groups)
const unitsOf: Record<string, Unit[]> = {}, kentOf: Record<string, ReturnType<typeof kentWords>> = {};
for (const [id, t] of texts) {
  const words: string[] = String(t.op_translit).split(/\s+/).filter(Boolean), rule = words.map(w => spellNormalised(w));
  const K = kent[id] ? kentWords(kent[id].lines) : null, units: Unit[] = []; if (K) kentOf[id] = K;
  if (!K) { words.forEach((w, i) => units.push({ ario: [w], ai: [i], kw: [], rule: [rule[i]] })); unitsOf[id] = units; continue; }
  for (const [ai, ki] of align(rule, K.map(k => k.signs))) units.push({ ario: ai >= 0 ? [words[ai]] : [], ai: ai >= 0 ? [ai] : [], kw: ki >= 0 ? [K[ki]] : [], rule: ai >= 0 ? [rule[ai]] : [] });
  // merge a one-sided neighbour when the joined signs match better (paruzanānām = paruv | zanānām; dūrai̯ api = dûraiapiy)
  const sig = (u: Unit, side: 'r' | 'k') => (side === 'r' ? u.rule.flat() : u.kw.flatMap(k => k.signs));
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < units.length - 1; i++) {
      const a = units[i], b = units[i + 1];
      const lone = (u: Unit) => (u.ario.length === 0) !== (u.kw.length === 0);
      if (!lone(a) && !lone(b)) continue;
      const m: Unit = { ario: [...a.ario, ...b.ario], ai: [...a.ai, ...b.ai], kw: [...a.kw, ...b.kw], rule: [...a.rule, ...b.rule] };
      const cost = (u: Unit) => (u.ario.length && u.kw.length ? lev(sig(u, 'r'), sig(u, 'k')) : sig(u, 'r').length + sig(u, 'k').length);
      if (m.ario.length && m.kw.length && cost(m) < cost(a) + cost(b) && cost(m) <= 2) { units.splice(i, 2, m); changed = true; }
    }
  }
  unitsOf[id] = units;
}
// how the copies spell each ARIo word (for the slip test)
const spelled = new Map<string, Map<string, number>>();
for (const units of Object.values(unitsOf)) for (const u of units) if (u.ario.length === 1 && u.kw.length) {
  const k = u.kw.flatMap(q => q.signs).join('-'), m = spelled.get(u.ario[0]) ?? new Map(); m.set(k, (m.get(k) ?? 0) + 1); spelled.set(u.ario[0], m);
}
const used = new Set<number>(), undecided: string[] = [], report: string[] = [];
const stats: Record<string, Record<string, number>> = {};
for (const [id, t] of texts) {
  const st: Record<string, number> = stats[id] = { words: String(t.op_translit).split(/\s+/).filter(Boolean).length, agree: 0, LOGO: 0, GLIDE: 0, 'GLIDE-slip': 0, READ: 0, ruleOnly: 0, kentOnly: 0, override: 0, lost: 0 };
  const rows: Row[] = [];
  for (const u of unitsOf[id]) {
    const R = u.rule.flat(), Kx = u.kw.flatMap(k => k.signs), ario = u.ario.join(' '), ktext = u.kw.map(k => k.text.replace(/\|/g, /^[a-zθšç]+-/.test(k.text) ? '-' : '')).join(' '); // a sign-by-sign copy (DPa) keeps its hyphens
    const kentGroups = () => u.kw.map(k => ({ signs: k.signs, divBefore: k.divBefore, divAtEnd: k.divAtEnd, line: k.line, breaks: k.breaks }));
    const ruleGroups = () => u.rule.map((r, i) => { const k = u.kw[Math.min(i, u.kw.length - 1)]; const line = k ? k.line : rows.length ? rows[rows.length - 1].groups.at(-1)!.line : 0;
      return { signs: r, divBefore: i === 0 ? (u.kw[0]?.divBefore ?? true) : true, divAtEnd: i === 0 ? (u.kw[0]?.divAtEnd ?? false) : false, line, breaks: k && u.rule.length === 1 ? k.breaks.map(b => Math.max(1, Math.min(r.length - 1, b))).filter(b => r.length > 1) : [] }; });
    if (!u.kw.length) { if (!kent[id]) st.ruleOnly++; else st.READ++; rows.push({ ario, signs: signString(R), kent: null, basis: kent[id] ? 'rule' : 'rule (no Kent copy)', class: kent[id] ? 'READ' : undefined, groups: ruleGroups() }); if (kent[id]) report.push(`| ${id} | ${ario} | ${signString(R)} | — | — | READ | rule | Kent's copy has no word here |`); continue; }
    if (!u.ario.length) { st.kentOnly++; report.push(`| ${id} | — | — | ${ktext} | ${signString(Kx)} | READ | not carved | Schmitt does not read this word |`); continue; }
    if (signString(R) === signString(Kx) && u.kw.length === u.rule.length) { st.agree++; rows.push({ ario, signs: signString(R), kent: ktext, basis: 'rule=kent', groups: kentGroups() }); continue; }
    let cls = Kx.some(s => /^[A-Z]/.test(s)) ? 'LOGO' : glideOnly(R, Kx) || (signString(R) === signString(Kx)) ? 'GLIDE' : 'READ';
    let carve: 'kent' | 'rule' = cls === 'READ' ? 'rule' : 'kent', why = cls === 'LOGO' ? 'a logogram in Kent (ARIo writes the word out)' : cls === 'GLIDE' ? (signString(R) === signString(Kx) ? 'the same signs, divided as in Kent' : 'a written glide (i/y/v) the normalised transcription does not carry') : 'Schmitt\'s reading';
    if (cls === 'GLIDE' && u.ario.length === 1 && signString(R) !== signString(Kx)) { // the slip test (not for a difference of division only)
      const m = spelled.get(u.ario[0]), k = Kx.join('-'), r = R.join('-');
      if (m && (m.get(k) ?? 0) === 1 && (m.get(r) ?? 0) >= 1) { cls = 'GLIDE-slip'; carve = 'rule'; why = `the copy spells ${u.ario[0]} so only here and by the rule ${m.get(r)}× elsewhere: a slip of the copy`; }
    }
    const oi = overrides.findIndex(o => o.id === id && o.ario === ario && o.kent === ktext);
    if (oi >= 0) { used.add(oi); carve = overrides[oi].carve; why = 'override: ' + overrides[oi].why; st.override++; } else st[cls]++;
    const groups = carve === 'kent' ? kentGroups() : ruleGroups(), signs = groups.map(g => signString(g.signs)).join(' : ');
    rows.push({ ario, signs, kent: ktext, basis: carve, class: cls, why, groups });
    report.push(`| ${id} | ${ario} | ${signString(R)} | ${ktext} | ${signString(Kx)} | ${cls} | **${carve}** | ${why} |`);
  }
  // lines: groups in order, a divider before each group that has one; a group broken across lines is split at its break
  const lines: string[][] = [[]]; let cur = rows.length ? rows[0].groups[0]?.line ?? 0 : 0;
  rows.forEach((r, ri) => r.groups.forEach((g, gi) => {
    const div = (ri > 0 || gi > 0) && g.divBefore;
    if (div && g.divAtEnd && cur < g.line) lines[lines.length - 1].push(':'); // Kent: the divider ends the previous line
    while (cur < g.line) { lines.push([]); cur++; }
    if (div && !(g.divAtEnd && lines[lines.length - 1].length === 0 && lines.length > 1 && lines[lines.length - 2].at(-1) === ':')) lines[lines.length - 1].push(':');
    let from = 0;
    for (const b of g.breaks) { if (b > from && b < g.signs.length) { lines[lines.length - 1].push(g.signs.slice(from, b).join('-')); lines.push([]); cur++; from = b; } }
    lines[lines.length - 1].push(g.signs.slice(from).join('-'));
  }));
  if (kent[id] && kentOf[id]?.trailing) lines[lines.length - 1].push(':'); // the text ends with a divider (XPe, DPb …)
  t.op_signs = lines.map(l => l.join(' ')).filter(Boolean); t.op_lined = !!kent[id]; // the inscription's own lines (Kent), else one run of text for the panel to flow
  for (const l of t.op_signs) parseSigns(l); // throws on an unknown sign
  st.lost = t.op_signs.join(' ').split(/[\s-]+/).filter((s: string) => s === LOST).length;
  t.op_words = rows.map((r, i) => ({ ario: r.ario, signs: r.signs, kent: r.kent, basis: r.basis, ...(i > 0 && !r.groups[0]?.divBefore ? { div: false } : {}), ...(r.class ? { class: r.class } : {}), ...(r.why ? { why: r.why } : {}) }));
  t.tier = { ...t.tier, op_signs: kent[id] ? 'B where the rule spelling of the ARIo word and Kent\'s transliteration agree, else as op_words.basis (D-165)' : 'C (Kent\'s rules on the ARIo word; no graphemic witness read, D-165)', op_lines: kent[id] ? 'B (Kent\'s lineation via the Livius copy)' : 'C (no lineation read)' };
  delete t.tier.op_signs_old;
}
overrides.forEach((o, i) => { if (!used.has(i)) undecided.push(`unused override: ${o.id} ${o.ario} / ${o.kent}`); });
if (undecided.length) { console.error(undecided.join('\n')); process.exit(1); }
const cols = ['words', 'agree', 'LOGO', 'GLIDE', 'GLIDE-slip', 'READ', 'override', 'kentOnly', 'ruleOnly', 'lost'];
const md = ['# Old Persian: the carved sign sequence (generated by tools/build_op_signs.ts; D-165)', '',
  'Words and readings: ARIo (Schmitt 2009, CC0). Signs: Kent\'s orthographic rules on each ARIo word (src/lang/oldPersian.ts), checked',
  'word by word against Kent\'s transliteration as printed by Livius (scraped copy, data/corpus/livius_op.json). Where both agree the signs',
  'are tier B. The table lists every word where they differ, its class and what is carved (rules in the tool header; overrides in',
  'data/corpus/op_sign_decisions.json). Kent\'s print and Schmitt\'s sign-by-sign edition could not be read (BLOCKERS B16, Q-280).', '',
  'Columns: agree = rule spelling equals Kent; LOGO / GLIDE = Kent carved; GLIDE-slip, READ = rule carved; kentOnly = a word of Kent\'s',
  'that Schmitt does not read (not carved); ruleOnly = no Kent copy (DPc, DPh: rule only, tier C); lost = signs lost in the edition,',
  'left uncut (blank).', '',
  `| Text | ${cols.join(' | ')} |`, `|---|${cols.map(() => '---').join('|')}|`,
  ...Object.entries(stats).map(([id, s]) => `| ${id} | ${cols.map(c => s[c] ?? 0).join(' | ')} |`), '',
  '| Text | ARIo | rule signs | Kent (Livius) | Kent signs | class | carved | why |', '|---|---|---|---|---|---|---|---|', ...report, ''];
writeFileSync('research/OP_SIGNS.md', md.join('\n'));
if (!process.argv.includes('--report')) writeFileSync(INS, JSON.stringify(ins, null, 1));
console.log(Object.entries(stats).map(([id, s]) => `${id}: ${cols.map(c => `${c} ${s[c] ?? 0}`).join(', ')}`).join('\n'));
