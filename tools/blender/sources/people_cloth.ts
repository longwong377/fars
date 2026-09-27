// Source of the people's garment drape (D-307): the procedural garment pieces of src/people/outfits.ts, fitted to a
// reference body of each group (men m03, women f02, children c01), written for Blender's cloth solver
// (tools/blender/cloth.py) with the body as the collider, and the pins and the cut that make the folds:
//  - a skirt is cut wider than the body it hangs on (the registry's `ease`: the many-folded dress 1.3, the tunics 1.15, the
//    court robe, whose pleats are the reliefs' and baked, 1.05) and gathered at the waist: the solver starts from the wide cut
//    and draws the pinned waist in to the fitted one while gravity and the legs shape the rest;
//  - an upper garment (tunic, dress, robe body) is pinned over the shoulders and under the belt and free between them: it
//    settles and blouses over the belt;
//  - sleeves, the kandys, the headcloth and the veil hang from where they are pinned (shoulders, head).
// Nothing is shaped by hand; what Blender returns (the settled vertices) becomes a displacement per vertex in the piece's
// local frame (tools/blender/sources/people_cloth_post.ts), applied to every variant of the group (outfits.ts).
// Usage: npx tsx tools/blender/sources/people_cloth.ts <srcDir> <outDir> <argsJson>
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { decodeHumanAssets, type HumanAssets } from '../../../src/people/humanAssets';
import { HB, PART, type HBone } from '../../../src/people/humanFormat';
import { buildOutfits, type Geo } from '../../../src/people/outfits';
import { writePLY } from '../lib/ply';

const [srcDir, outDir, argJson] = process.argv.slice(2);
if (!srcDir || !outDir || !argJson) { console.error('usage: people_cloth.ts <srcDir> <outDir> <argsJson>'); process.exit(2); }
const ARGS = JSON.parse(readFileSync(argJson, 'utf8'));
mkdirSync(srcDir, { recursive: true }); mkdirSync(outDir, { recursive: true });
const t0 = Date.now(); const log = (...a: unknown[]) => console.log(`[people_cloth ${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const sstep = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

const HD = 'public/generated/humans';
const bin = readFileSync(`${HD}/humans.bin`);
const A: HumanAssets = decodeHumanAssets(JSON.parse(readFileSync(`${HD}/humans.json`, 'utf8')), bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer);
const LODS: number[] = ARGS.lods ?? [0, 1];
const O = buildOutfits(A, { lods: LODS }); // the procedural pieces (no drape) on every variant
const geos = O.geos!;

interface Sim { key: string; piece: string; lod: number; group: string; variant: string; kind: string; body: string; cloth: string; target: string; pin: string; n: number; outer: number; frames: number; cloth_params: any }
const sims: Sim[] = []; const stats: Record<string, any> = {};
const bodyCache = new Map<string, string>();
/** the body as the collider: the full-detail triangles, without the arms for skirts and upper garments (the arms swing in
 *  the game: folds pressed by a hanging hand would stay when the hand moves), with them for sleeves and coats */
function bodyPLY(vid: string, arms: boolean) {
  const k = `${vid}_${arms ? 'arms' : 'noarms'}`; let f = bodyCache.get(k); if (f) return f;
  const v = A.byId[vid], T = A.lods[0], drop = new Set<number>(arms ? [] : [PART.uarm_l, PART.farm_l, PART.hand_l, PART.uarm_r, PART.farm_r, PART.hand_r]);
  const idx: number[] = []; for (let t = 0; t < T.length; t += 3) { const tri = [T[t], T[t + 1], T[t + 2]]; if (tri.some(i => A.part[i] >= PART.eye || drop.has(A.part[i]))) continue; idx.push(...tri); }
  f = `${srcDir}/body_${k}.ply`; writePLY(f, { pos: v.pos, nrm: v.nrm, idx: Uint32Array.from(idx) } as any); bodyCache.set(k, f); return f;
}
const J = (vid: string, b: HBone): [number, number, number] => { const v = A.byId[vid]; return [v.joints[HB[b] * 3], v.joints[HB[b] * 3 + 1], v.joints[HB[b] * 3 + 2]]; };

for (const [piece, P] of Object.entries(ARGS.pieces as Record<string, any>)) for (const lod of LODS) for (const group of P.groups as string[]) {
  const key = `${piece}@${lod}`, g: Geo | undefined = geos[key]; if (!g) { log('no geometry', key); continue; }
  const vid = ARGS.groups[group], v = A.byId[vid];
  const base = v.index * O.NV * 4 + O.pieceBase[key] * 4;
  const pos = new Float32Array(g.n * 3); for (let i = 0; i < g.n; i++) for (let e = 0; e < 3; e++) pos[i * 3 + e] = O.source[base + i * 4 + e];
  // outer layer only (a tube's lining, cavity 150, follows its outer vertex afterwards: people_cloth_post.ts)
  const outer = new Int32Array(g.n).fill(-1); let no = 0; for (let i = 0; i < g.n; i++) if (g.ao[i] !== 150) outer[i] = no++;
  const tri: number[] = []; for (let t = 0; t < g.index.length; t += 3) { const a = outer[g.index[t]], b = outer[g.index[t + 1]], c = outer[g.index[t + 2]]; if (a >= 0 && b >= 0 && c >= 0) tri.push(a, b, c); }
  const tgt = new Float32Array(no * 3), start = new Float32Array(no * 3), pin = new Float32Array(no);
  const waist = J(vid, 'spine_01')[1], chest = J(vid, 'spine_03')[1], neck = J(vid, 'neck_01')[1];
  // the skirt's axis for the wide cut: the body's midline at the vertex height (x 0, z of the pelvis joint)
  const zc = J(vid, 'pelvis')[2];
  for (let i = 0; i < g.n; i++) { const o = outer[i]; if (o < 0) continue; const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], t = g.uv[i * 2 + 1];
    // a gathered waist: the pinned band is drawn in along a wave of `gathers` folds round the waist whose length is the wide
    // cut's (so the cloth below buckles into folds instead of shrinking); amplitude from the ease: L ≈ 2π √(r² + N²A²/2)
    const th = Math.atan2(x, z - zc), r = Math.hypot(x, z - zc);
    // (the band under the belt, t < pinTop, is drawn in tight: the belt cinches it; the gathers start just below it, over
    // `gatherBand`: the folds come out from under the belt)
    const gBand = P.gatherBand ?? 0.04, inG = P.kind === 'skirt' && P.gathers && t >= P.pinTop && t < P.pinTop + gBand;
    const gA = inG ? r * Math.sqrt(2 * (P.ease * P.ease - 1)) / P.gathers * sstep(P.pinTop, P.pinTop + gBand * 0.5, t) : 0;
    const rg = r + gA * Math.sin(P.gathers * th + 0.7);
    tgt.set(gA ? [x / (r || 1) * rg, y, zc + (z - zc) / (r || 1) * rg] : [x, y, z], o * 3);
    let w = 0, ease = 1;
    switch (P.kind) {
      case 'skirt': w = t < P.pinTop + (P.gathers ? gBand : 0) ? 1 : 0; ease = 1 + (P.ease - 1) * sstep(0, 0.25, t); break; // the waist is gathered in; the cut is wide below
      case 'upper': w = Math.max(sstep(chest - 0.02, chest + 0.04, y), sstep(waist + 0.06, waist - 0.01, y), Math.abs(x) > P.armX ? P.armPin : 0); break;
      case 'sleeve': w = t < P.pinTop ? 1 : 0; break;
      case 'hang': w = sstep(P.pinY[0], P.pinY[1], y - neck); break; // coats and cloths hang from the shoulders or the head
    }
    pin[o] = w;
    // an upper garment is cut fuller than its fitted shell between the pins (`ease` about the torso's axis): it settles in folds
    if (P.kind === 'upper' && P.ease) ease = 1 + (P.ease - 1) * (1 - w);
    start.set(P.kind === 'skirt' || P.kind === 'upper' ? [x * ease, y, zc + (z - zc) * ease] : [x, y, z], o * 3);
  }
  // a part of the piece with nothing pinned (the kandys's hanging sleeves are tubes of their own) would fall away: such a
  // connected part is pinned whole (it keeps its procedural shape; D-307)
  { const par = Int32Array.from({ length: no }, (_, i) => i); const find = (a: number): number => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    for (let t = 0; t < tri.length; t += 3) { const a = find(tri[t]), b = find(tri[t + 1]), c = find(tri[t + 2]); par[b] = a; par[find(c)] = a; }
    const has = new Set<number>(); for (let o = 0; o < no; o++) if (pin[o] > 0.5) has.add(find(o));
    for (let o = 0; o < no; o++) if (!has.has(find(o))) pin[o] = 1; }
  const cloth = `${srcDir}/${key}_${group}.ply`, target = `${srcDir}/${key}_${group}.target.f32`, pinF = `${srcDir}/${key}_${group}.pin.f32`;
  writePLY(cloth, { pos: start, nrm: new Float32Array(no * 3), idx: Uint32Array.from(tri) } as any);
  // the fitted positions (Blender axes: x, -z, y) the pinned vertices are drawn to
  const tb = new Float32Array(no * 3); for (let o = 0; o < no; o++) { tb[o * 3] = tgt[o * 3]; tb[o * 3 + 1] = -tgt[o * 3 + 2]; tb[o * 3 + 2] = tgt[o * 3 + 1]; }
  writeFileSync(target, Buffer.from(tb.buffer)); writeFileSync(pinF, Buffer.from(pin.buffer));
  sims.push({ key, piece, lod, group, variant: vid, kind: P.kind, body: bodyPLY(vid, P.kind === 'sleeve' || P.kind === 'hang'), cloth, target, pin: pinF, n: g.n, outer: no, frames: ARGS.frames, cloth_params: { ...ARGS.cloth, ...(P.cloth ?? {}) } });
  stats[`${key}|${group}`] = { verts: g.n, outer: no, tris: tri.length / 3, pinned: +(pin.reduce((a, b) => a + (b > 0.5 ? 1 : 0), 0) / no).toFixed(3) };
}
writeFileSync(`${srcDir}/job.json`, JSON.stringify({ sims, out_dir: srcDir, seed: 0, substeps: ARGS.substeps }, null, 1));
writeFileSync(`${srcDir}/source_stats.json`, JSON.stringify(stats, null, 1));
log(`${sims.length} simulations written`);
