// s18 C15 (D-800): the Old Persian captions of the tomb of Darius I at Naqsh-e Rustam, DNc (Gobryas, the king's spear-bearer),
// DNd (Aspathines, his bow-bearer) and DNe (the thirty throne-bearers' peoples), from the published sign-by-sign edition (ORACC
// ARIo in CATF, Schmitt 2009, CC0; data/corpus/ario_dn_captions.catf, verbatim from oracc/catf ario.catf), turned into the carved
// sign lines by the same path as every Old Persian panel (src/lang/oldPersian.ts catfWords / edSignLines, D-184): restorations
// carved (C), stretches lost and not restored left blank. DNe is kept line by line: each line is one bearer's caption.
// Run: npx tsx tools/build_naqsh_captions.ts   (writes src/world/plain/naqsh_captions.json)
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
console.log(Object.entries(out).filter(([k]) => k !== '_meta').map(([k, v]: any) => `${k}: ${v.op_signs ? v.op_signs.length + ' lines' : v.lines.filter((x: any) => x).length + '/' + v.lines.length + ' captions'}`).join('; '));
