// Post-step of the people's garment drape (D-307): reads what Blender's cloth solver settled (tools/blender/cloth.py:
// <key>_<group>.settled.f32, Blender axes) and writes the displacement of every vertex of each piece from its procedural
// placement on the group's reference body, in the piece's own local frame (peopleModels.drapeFrame: the vertex normal, a
// horizontal tangent, their cross product), so the game adds it to the procedural placement on every body of the group
// (outfits.ts). A tube's lining (cavity 150) takes the displacement of the nearest outer vertex (it is not simulated).
// Writes people_cloth.json / .bin (Int16, 0.1 mm) and post_stats.json.
// Usage: npx tsx tools/blender/sources/people_cloth_post.ts <srcDir> <outDir> <argsJson>
import { writeFileSync, readFileSync } from 'node:fs';
import { decodeHumanAssets, type HumanAssets } from '../../../src/people/humanAssets';
import { buildOutfits } from '../../../src/people/outfits';
import { BinWriter, drapeFrames, DRAPE_UNIT, type DrapeMeta, type DrapeSetMeta } from '../../../src/people/peopleModels';

const [srcDir, outDir, argJson] = process.argv.slice(2);
const ARGS = JSON.parse(readFileSync(argJson, 'utf8'));
const job = JSON.parse(readFileSync(`${srcDir}/job.json`, 'utf8'));
const HD = 'public/generated/humans', bin = readFileSync(`${HD}/humans.bin`);
const A: HumanAssets = decodeHumanAssets(JSON.parse(readFileSync(`${HD}/humans.json`, 'utf8')), bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer);
const O = buildOutfits(A, { lods: ARGS.lods ?? [0, 1] }); const geos = O.geos!;
const W = new BinWriter(); const sets: Record<string, DrapeSetMeta> = {}; const stats: Record<string, any> = {};
for (const S of job.sims) {
  const g = geos[S.key], v = A.byId[S.variant], base = v.index * O.NV * 4 + O.pieceBase[S.key] * 4;
  const pos = new Float32Array(g.n * 3); for (let i = 0; i < g.n; i++) for (let e = 0; e < 3; e++) pos[i * 3 + e] = O.source[base + i * 4 + e];
  const sb = readFileSync(S.cloth.replace('.ply', '.settled.f32')), settled = new Float32Array(sb.buffer.slice(sb.byteOffset, sb.byteOffset + sb.byteLength));
  // world displacement of the outer vertices (Blender axes back to the game's: (x, -z, y) -> (x, y, z))
  // (a pinned vertex takes its target exactly, a partly pinned one in proportion: the solver's pins are springs, and a few
  // millimetres of drift at the sleeves' pinned cuffs tore them open in the first render)
  const rd = (p: string) => { const b = readFileSync(p); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
  const pin = rd(S.pin), tgt = rd(S.target);
  const dw = new Float32Array(g.n * 3), isOuter = new Uint8Array(g.n); let o = 0;
  for (let i = 0; i < g.n; i++) { if (S.kind !== 'upper' && g.ao[i] === 150) continue; isOuter[i] = 1; // (a shell has no lining)
    const w = Math.min(1, Math.max(0, pin[o])), bl = (k: number) => settled[o * 3 + k] * (1 - w) + tgt[o * 3 + k] * w;
    const x = bl(0), y = bl(2), z = -bl(1); dw[i * 3] = x - pos[i * 3]; dw[i * 3 + 1] = y - pos[i * 3 + 1]; dw[i * 3 + 2] = z - pos[i * 3 + 2]; o++; }
  for (const q of settled) if (!Number.isFinite(q)) throw new Error(`${S.key}|${S.group}: the solver returned a non-finite position`);
  if (o !== S.outer) throw new Error(`${S.key}|${S.group}: ${o} outer vertices, the solver had ${S.outer}`);
  // linings: the nearest outer vertex's displacement
  for (let i = 0; i < g.n; i++) { if (isOuter[i]) continue; let best = -1, bd = 1e9;
    for (let k = 0; k < g.n; k++) { if (!isOuter[k]) continue; const d = (pos[k * 3] - pos[i * 3]) ** 2 + (pos[k * 3 + 1] - pos[i * 3 + 1]) ** 2 + (pos[k * 3 + 2] - pos[i * 3 + 2]) ** 2; if (d < bd) { bd = d; best = k; } }
    if (best >= 0) for (let e = 0; e < 3; e++) dw[i * 3 + e] = dw[best * 3 + e]; }
  // into the local frames of the procedural placement
  const F = drapeFrames(pos, g.index, g.n); const d = new Int16Array(g.n * 3); let ss = 0, mx = 0;
  for (let i = 0; i < g.n; i++) { const w = [dw[i * 3], dw[i * 3 + 1], dw[i * 3 + 2]]; const m = Math.hypot(w[0], w[1], w[2]); ss += m * m; mx = Math.max(mx, m);
    for (let a = 0; a < 3; a++) { const f = F.subarray(i * 9 + a * 3, i * 9 + a * 3 + 3); const c = w[0] * f[0] + w[1] * f[1] + w[2] * f[2]; d[i * 3 + a] = Math.max(-32767, Math.min(32767, Math.round(c / DRAPE_UNIT))); } }
  const rms = Math.sqrt(ss / g.n);
  sets[`${S.key}|${S.group}`] = { n: g.n, group: S.group, frame: 'shell', d: W.add(d), rms: +rms.toFixed(5), max: +mx.toFixed(5), note: `${S.kind}: settled by Blender's cloth solver on ${S.variant}` };
  stats[`${S.key}|${S.group}`] = { rms_mm: +(rms * 1000).toFixed(1), max_mm: +(mx * 1000).toFixed(1) };
}
const meta: DrapeMeta = { version: 1, groups: ARGS.groups, sets };
writeFileSync(`${outDir}/people_cloth.bin`, W.bytes());
writeFileSync(`${outDir}/people_cloth.json`, JSON.stringify(meta, null, 1) + '\n');
writeFileSync(`${outDir}/post_stats.json`, JSON.stringify(stats, null, 1));
console.log('[people_cloth_post]', Object.keys(sets).length, 'sets', JSON.stringify(stats));
