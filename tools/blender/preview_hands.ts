// The hands' contact sheet (D-323; iteration evidence, not the game's look): the right hand and wrist of a body variant at
// the full-detail LOD as the game draws it (the simplified hand, its normals from the full hand: humanAssets) beside the full
// MakeHuman hand, open (the bind pose) and with the fingers curled (a grip: each finger joint turned about its curl axis,
// humans.json curlAxes, skinned with the body's own weights). Blender renders them (tools/blender/preview_hands.py) with the
// skin atlas's crease channel as a bump, so the baked relief (skin.ts handRelief) shows on the simplified hand.
// Usage: npx tsx tools/blender/preview_hands.ts <outDir> [variant=m03] [curl=1.1]
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { decodeHumanAssets, handNormalSource, smoothNormals } from '../../src/people/humanAssets';
import { PART, HB, HBONES, HPARENT, FINGERS, type HBone } from '../../src/people/humanFormat';

const [out, vid = 'm03', curlS = '1.1'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const HD = 'public/generated/humans', bin = readFileSync(`${HD}/humans.bin`), meta = JSON.parse(readFileSync(`${HD}/humans.json`, 'utf8'));
const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer;
const A = decodeHumanAssets(meta, buf), v = A.byId[vid];
const L = meta.layout.hand_hi; if (!L) throw new Error('humans.bin has no hand_hi (build_humans.ts D-323)');
const handHi = new Uint16Array(buf.slice(L.offset, L.offset + L.count * 3 * 2));
const isH = (i: number) => A.part[i] === PART.hand_r, near = (i: number) => A.part[i] === PART.hand_r || A.part[i] === PART.farm_r;
type V3 = [number, number, number];
// the grip: every finger joint of the right hand turned by `curl` rad (the thumb's by half) about its curl axis
const qAx = (ax: number[], a: number) => { const s = Math.sin(a / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(a / 2)]; };
const qMul = (a: number[], b: number[]) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qRot = (q: number[], p: number[]): V3 => { const r = qMul(qMul(q, [p[0], p[1], p[2], 0]), [-q[0], -q[1], -q[2], q[3]]); return [r[0], r[1], r[2]]; };
function posed(curl: number) {
  const nb = HBONES.length, wq: number[][] = [], wp: V3[] = [], J = (i: number): V3 => [v.joints[i * 3], v.joints[i * 3 + 1], v.joints[i * 3 + 2]];
  HBONES.forEach((b, i) => { const ax = A.meta.curlAxes[b]; const loc = ax && b.endsWith('_r') && FINGERS.some(f => b.startsWith(f)) ? qAx(ax, curl * (b.startsWith('thumb') ? 0.5 : 1)) : [0, 0, 0, 1];
    const p = HPARENT[b as HBone]; if (!p) { wq[i] = loc; wp[i] = J(i); return; } const pi = HB[p]; wq[i] = qMul(wq[pi], loc); const d = qRot(wq[pi], [J(i)[0] - J(pi)[0], J(i)[1] - J(pi)[1], J(i)[2] - J(pi)[2]]); wp[i] = [wp[pi][0] + d[0], wp[pi][1] + d[1], wp[pi][2] + d[2]]; });
  void nb;
  const pos = new Float32Array(A.NO * 3);
  for (let i = 0; i < A.NO; i++) { const acc = [0, 0, 0]; for (let k = 0; k < 4; k++) { const w = A.skinWeight[i * 4 + k] / 255; if (!w) continue; const b = A.skinIndex[i * 4 + k];
    const r = qRot(wq[b], [v.pos[i * 3] - v.joints[b * 3], v.pos[i * 3 + 1] - v.joints[b * 3 + 1], v.pos[i * 3 + 2] - v.joints[b * 3 + 2]]); for (let e = 0; e < 3; e++) acc[e] += w * (wp[b][e] + r[e]); }
    pos.set(acc, i * 3); }
  return pos;
}
const lod0 = A.lods[0];
const rest: number[] = []; for (let t = 0; t < lod0.length; t += 3) { const tri = [lod0[t], lod0[t + 1], lod0[t + 2]]; if (tri.every(near) && !tri.every(isH)) rest.push(...tri); }
const lo: number[] = []; for (let t = 0; t < lod0.length; t += 3) { const tri = [lod0[t], lod0[t + 1], lod0[t + 2]]; if (tri.every(isH)) lo.push(...tri); }
const hi: number[] = []; for (let t = 0; t < handHi.length; t += 3) { const tri = [handHi[t], handHi[t + 1], handHi[t + 2]]; if (tri.every(isH)) hi.push(...tri); }
const items: any[] = [];
for (const curl of [0, +curlS]) {
  const pos = curl ? posed(curl) : v.pos;
  const nrmNew = smoothNormals(pos, A.orig, A.NP, [handNormalSource(lod0, handHi, A.part)]);
  // the old full hand's own normals (all of it at full detail) are the same source: the full triangles
  for (const [name, tris] of [['game', lo], ['full', hi]] as const) {
    const all = [...rest, ...tris], map = new Map<number, number>(), lines: string[] = [`# ${vid} ${name} curl ${curl}`, 'o hand'];
    for (const i of all) if (!map.has(i)) map.set(i, map.size);
    for (const [i] of map) lines.push(`v ${pos[i * 3].toFixed(5)} ${(-pos[i * 3 + 2]).toFixed(5)} ${pos[i * 3 + 1].toFixed(5)}`);
    for (const [i] of map) lines.push(`vt ${A.uv[i * 2].toFixed(6)} ${A.uv[i * 2 + 1].toFixed(6)}`);
    for (const [i] of map) lines.push(`vn ${nrmNew[i * 3].toFixed(5)} ${(-nrmNew[i * 3 + 2]).toFixed(5)} ${nrmNew[i * 3 + 1].toFixed(5)}`);
    for (let t = 0; t < all.length; t += 3) lines.push(`f ${[0, 1, 2].map(k => { const n = map.get(all[t + k])! + 1; return `${n}/${n}/${n}`; }).join(' ')}`);
    const f = `${out}/hand_${name}_${curl ? 'grip' : 'open'}.obj`; writeFileSync(f, lines.join('\n'));
    const hj = HB.hand_r; items.push({ obj: f, name, curl, tris: tris.length / 3, wrist: [v.joints[hj * 3], -v.joints[hj * 3 + 2], v.joints[hj * 3 + 1]] });
  }
}
writeFileSync(`${out}/hands_job.json`, JSON.stringify({ items, skin: `${process.cwd()}/${HD}/skin.png`, out_png: `${out}/hands_sheet.png`, res: 560 }, null, 1));
console.log('[preview_hands]', items.map(i => `${i.name}/${i.curl}: ${i.tris} tris`).join(', '));
