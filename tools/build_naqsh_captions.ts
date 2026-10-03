// s18 C15 (D-800): the Old Persian captions of the tomb of Darius I at Naqsh-e Rustam, DNc (Gobryas, the king's spear-bearer),
// DNd (Aspathines, his bow-bearer) and DNe (the thirty throne-bearers' peoples), from the published sign-by-sign edition (ORACC
// ARIo in CATF, Schmitt 2009, CC0; data/corpus/ario_dn_captions.catf, verbatim from oracc/catf ario.catf), turned into the carved
// sign lines by the same path as every Old Persian panel (src/lang/oldPersian.ts catfWords / edSignLines, D-184): restorations
// carved (C), stretches lost and not restored left blank. DNe is kept line by line: each line is one bearer's caption.
// Run: npx tsx tools/build_naqsh_captions.ts   (writes src/world/plain/naqsh_captions.json, and the three texts' entries in
// src/data/inscriptions.json: op_signs (DNe: its 18 surviving lines, each one bearer's caption), op_translit from the ARIo
// running text (data/corpus/ario.jsonl), no Elamite or Babylonian (not in ARIo); the lead's go, s18)
import { readFileSync, writeFileSync } from 'node:fs';
import { catfWords, edSignLines, parseSigns } from '../src/lang/oldPersian';

const SRC = 'data/corpus/ario_dn_captions.catf', OUT = 'src/world/plain/naqsh_captions.json';
const texts: Record<string, string[]> = {}; let cur = '';
for (const l of readFileSync(SRC, 'utf8').split('\n')) {
  const q = l.match(/^&(Q\d+)/); if (q) { cur = q[1]; texts[cur] = []; continue; }
  if (cur && /^\d+\.\s/.test(l)) texts[cur].push(l.trim());
}
const ID: Record<string, string> = { DNc: 'Q007154', DNd: 'Q007155', DNe: 'Q007156' };
const lineSigns = (lines: string[]) => { const s = edSignLines(catfWords(lines)); for (const x of s) parseSigns(x); return s; };
const out: Record<string, any> = { _meta: { src: 'ORACC ARIo (Schmitt 2009), CC0, via oracc/catf ario.catf; ' + SRC, tool: 'tools/build_naqsh_captions.ts', tier: 'A (the edition) / C (restorations carved, the captions\' places on the façade)' } };
for (const [id, q] of Object.entries(ID)) {
  const L = texts[q]; if (!L?.length) throw new Error(`${id}: no lines`);
  if (id === 'DNe') out[id] = { ario: q, lines: L.map(l => { const lost = /^\d+\.\s*\[\.\.\.\]\s*$/.test(l); return lost ? null : lineSigns([l.replace(/^\d+\./, '1.')]); }) };
  else out[id] = { ario: q, op_signs: lineSigns(L) };
}
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
// the inscription data (the one path every carving reads: src/arch/inscription_text.ts panelText)
const INS = 'src/data/inscriptions.json', ins = JSON.parse(readFileSync(INS, 'utf8'));
const raw: Record<string, string> = {}; for (const l of readFileSync('data/corpus/ario.jsonl', 'utf8').split('\n')) { if (!l.trim()) continue; const d = JSON.parse(l); raw[d.id_text] = d.raw_text; }
for (const [id, q] of Object.entries(ID)) { const o = out[id], signs: string[] = o.op_signs ?? (o.lines as (string[] | null)[]).filter(Boolean).map(x => x!.join(' '));
  ins[id] = { ario: q, op_translit: raw[q], el_atf: '', el_cuneiform: '', el_unmapped: [], bab_atf: '', bab_cuneiform: '', bab_unmapped: [],
    tier: { text: 'A (standard edition, via CC0 mirror)', op_signs: `A (the published sign-by-sign edition, ARIo in CATF, CC0; ${SRC}; s18 C15 D-800)${id === 'DNe' ? '; the 12 lines lost in the edition not carved' : ''}; restorations C`, el_bab: 'not in ARIo (Q-1730)' },
    op_signs: signs, op_lined: true, op_words: [] }; }
writeFileSync(INS, JSON.stringify(ins, null, 1) + '\n');
console.log(Object.entries(out).filter(([k]) => k !== '_meta').map(([k, v]: any) => `${k}: ${v.op_signs ? v.op_signs.length + ' lines' : v.lines.filter((x: any) => x).length + '/' + v.lines.length + ' captions'}`).join('; '));
