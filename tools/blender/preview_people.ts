// Node side of the people's contact sheet (D-307): writes, per body variant, an OBJ of the head and shoulders (the full-detail
// body, vertex colours: skin, the scalp and beard roots darkened as the game's shells do) and the hair cards placed exactly as
// the game places them (src/people/peopleModels.ts placeCards), their UVs in the strand atlas for a hair style; then
// tools/blender/preview_people.py renders a sheet in Cycles. Iteration only (seconds), not evidence of the game's look.
// Usage: npx tsx tools/blender/preview_people.ts <outDir> <variant:set+set:style> ...   e.g. m03:hair+bun+beard_long+brows:1
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { PART } from '../../src/people/humanFormat';
import { beardMask } from '../../src/people/outfits';
import { HB } from '../../src/people/humanFormat';
import { readPeopleModels, placeCards, headHeight } from '../../src/people/peopleModels';

const [out, ...specs] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const HD = 'public/generated/humans', bin = readFileSync(`${HD}/humans.bin`);
const A = decodeHumanAssets(JSON.parse(readFileSync(`${HD}/humans.json`, 'utf8')), bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer);
const M = readPeopleModels(f => { try { return readFileSync(`public/${f}`); } catch { return null; } });
if (!M.cards) throw new Error('no cards: build people_hair first');
const C = M.cards; const rv = (pid: number) => { for (let i = 0; i < A.NO; i++) if (A.orig[i] === pid) return i; return 0; };
const topRV = rv(A.meta.landmarks.head_top), chinRV = rv(A.meta.landmarks.chin);
const ref = A.byId[C.meta.ref]; const J = (b: string) => [ref.joints[(HB as any)[b] * 3], ref.joints[(HB as any)[b] * 3 + 1], ref.joints[(HB as any)[b] * 3 + 2]] as [number, number, number];
const beard = beardMask({ A, ref, J: J as any });
const list: any[] = [];
for (const spec of specs) {
  const [vid, setsS, styleS] = spec.split(':'); const v = A.byId[vid]; const style = +(styleS ?? 0); const sets = setsS ? setsS.split('+') : [];
  const lines: string[] = [`# ${spec}`]; let vo = 1, to = 1;
  // body: head, neck, chest, upper arms (full detail), y-up metres -> Blender z-up
  const keep = new Set<number>([PART.head, PART.neck, PART.chest, PART.uarm_l, PART.uarm_r, PART.eye]);
  const T = A.lods[0]; const map = new Map<number, number>(); const bodyF: number[][] = [];
  const hasBeard = sets.some(s => s.startsWith('beard')), hasHair = sets.some(s => s === 'hair' || s === 'hair_bob' || s === 'bun');
  for (let t = 0; t < T.length; t += 3) { const tri = [T[t], T[t + 1], T[t + 2]]; if (!tri.every(i => keep.has(A.part[i]))) continue; if (tri.some(i => A.part[i] === PART.eye && A.uv[i * 2] > 0.85 && A.uv[i * 2 + 1] < 0.16)) continue;
    bodyF.push(tri.map(i => { let k = map.get(i); if (k === undefined) { k = map.size; map.set(i, k); } return k; })); }
  lines.push('o body');
  for (const [i] of map) { const x = v.pos[i * 3], y = v.pos[i * 3 + 1], z = v.pos[i * 3 + 2];
    let r = 0.62, g = 0.42, b = 0.32; if (A.part[i] === PART.eye) { r = 0.55; g = 0.52; b = 0.5; }
    const dk = Math.max(hasHair ? A.scalp[i] : 0, hasBeard ? beard[i] : 0); r = r + (0.08 - r) * dk * 0.9; g = g + (0.05 - g) * dk * 0.9; b = b + (0.035 - b) * dk * 0.9;
    lines.push(`v ${x.toFixed(5)} ${(-z).toFixed(5)} ${y.toFixed(5)} ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`); }
  lines.push('vt 0 0'); for (const f of bodyF) lines.push(`f ${f.map(k => `${k + vo}/1`).join(' ')}`); vo += map.size; to += 1;
  const s = headHeight(v.pos, topRV, chinRV) / C.meta.headH;
  const cols = C.meta.atlas.cols, rows = C.meta.atlas.rows.length;
  for (const id of sets) { const S = C.sets[id]; if (!S) continue; const P = placeCards(S, v.pos, s);
    lines.push(`o cards_${id}`);
    for (let k = 0; k < S.meta.n; k++) lines.push(`v ${P[k * 3].toFixed(5)} ${(-P[k * 3 + 2]).toFixed(5)} ${P[k * 3 + 1].toFixed(5)} ${(S.ao[k] / 255).toFixed(3)} 0 0`);
    for (let k = 0; k < S.meta.n; k++) { const cls = S.cell[k] >> 3, col = S.cell[k] & 7, row = C.meta.classRows[cls][style];
      const u = (col + S.uv[k * 2]) / cols, vv = (row + S.uv[k * 2 + 1]) / rows; lines.push(`vt ${u.toFixed(5)} ${(1 - vv).toFixed(5)}`); }
    for (let t = 0; t < S.index.length; t += 3) lines.push(`f ${[0, 1, 2].map(e => `${S.index[t + e] + vo}/${S.index[t + e] + to}`).join(' ')}`);
    vo += S.meta.n; to += S.meta.n; }
  const file = `${out}/${spec.replace(/[:+]/g, '_')}.obj`; writeFileSync(file, lines.join('\n') + '\n');
  list.push({ obj: file, label: spec, eyeY: v.eyeY, hz: v.joints[HB.head * 3 + 2] });
}
writeFileSync(`${out}/preview_job.json`, JSON.stringify({ items: list, atlas: 'T:/fars-blender/people2/people_hair/out/people_hair_atlas.png', out_png: `${out}/sheet.png` }, null, 1));
console.log('wrote', list.length, 'previews');
