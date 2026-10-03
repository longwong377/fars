// Source of the people's garments (D-307, re-cut D-322): each garment piece of src/people/outfits.ts is cut as a pattern
// on a reference body of each group (men m03, women f02, children c01) and written for Blender's cloth solver
// (tools/blender/cloth.py), refined to the resolution cloth folds at (Loop subdivision to a 1.5-2.6 cm mesh: the game's
// pieces, 3-8 cm, cannot fold), with the body (and, for the outer layers, the garments already settled under them) as
// the collider, and the pins and the cut that make the folds:
//  - a skirt is cut wider than the body it hangs on (the registry's `ease`: the many-folded dress 1.3, the tunics 1.15, the
//    court robe, whose pleats are the reliefs' and pressed into its rest shape, 1.06) and gathered at the waist: the solver
//    starts from the wide cut and draws the pinned waist in to the fitted one while gravity and the legs shape the rest;
//  - an upper garment (tunic, dress, robe body) is pinned over the shoulders and under the belt and free between them, cut
//    fuller than the fitted shell (`ease`): it settles in folds and blouses over the belt;
//  - trousers are pinned at the waist and fall over the legs in their own ease (they bunch at the knee and the boot);
//  - sleeves, the kandys, the headcloth and the veil hang from where they are pinned (shoulders, head);
//  - stage 2 (the registry's `over`): the belt's sash, the headcloth, the veil and the kandys settle over the stage-1
//    garments of their group as Blender settled them (D-313's see-through headcloth settled on the body alone, inside the
//    dress).
// One simulation per piece and group, from the piece's full-detail cut; the post-step (people_cloth_post.ts) samples the
// settled cloth at every level of detail's vertices, low-passed to what each can carry, as a displacement per vertex in the
// piece's local frame, applied to every variant of the group (outfits.ts). Nothing is shaped by hand.
// Usage: npx tsx tools/blender/sources/people_cloth.ts <srcDir> <outDir> <argsJson>
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { decodeHumanAssets, type HumanAssets } from '../../../src/people/humanAssets';
import { HB, PART, type HBone } from '../../../src/people/humanFormat';
import { buildOutfits, type Geo } from '../../../src/people/outfits';
import { writePLY } from '../lib/ply';
import { loopSubdivide } from '../lib/subdiv';

const [srcDir, outDir, argJson] = process.argv.slice(2);
if (!srcDir || !outDir || !argJson) { console.error('usage: people_cloth.ts <srcDir> <outDir> <argsJson>'); process.exit(2); }
const ARGS = JSON.parse(readFileSync(argJson, 'utf8'));
mkdirSync(srcDir, { recursive: true }); mkdirSync(outDir, { recursive: true });
const t0 = Date.now(); const log = (...a: unknown[]) => console.log(`[people_cloth ${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const sstep = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

const HD = 'public/generated/humans';
const bin = readFileSync(`${HD}/humans.bin`);
const A: HumanAssets = decodeHumanAssets(JSON.parse(readFileSync(`${HD}/humans.json`, 'utf8')), bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer);
const O = buildOutfits(A, { lods: [0] }); // the procedural pieces (no drape) at full detail on every variant: the cut
const geos = O.geos!;

interface Sim { seed: number; name: string; key: string; piece: string; group: string; variant: string; kind: string; stage: number; over: string[]; body: string; cloth: string; target: string; pin: string; fitted: string; outer: number; levels: number; frames: number; cloth_params: any }
const sims: Sim[] = []; const stats: Record<string, any> = {};
const bodyCache = new Map<string, string>();
/** the body as the collider: the full-detail triangles, without the arms for skirts, upper garments and trousers (the arms
 *  swing in the game: folds pressed by a hanging hand would stay when the hand moves), with them for sleeves and coats */
function bodyPLY(vid: string, arms: boolean) {
  const k = `${vid}_${arms ? 'arms' : 'noarms'}`; let f = bodyCache.get(k); if (f) return f;
  const v = A.byId[vid], T = A.lods[0], drop = new Set<number>(arms ? [] : [PART.uarm_l, PART.farm_l, PART.hand_l, PART.uarm_r, PART.farm_r, PART.hand_r]);
  const idx: number[] = []; for (let t = 0; t < T.length; t += 3) { const tri = [T[t], T[t + 1], T[t + 2]]; if (tri.some(i => A.part[i] >= PART.eye || drop.has(A.part[i]))) continue; idx.push(...tri); }
  f = `${srcDir}/body_${k}.ply`; writePLY(f, { pos: v.pos, nrm: v.nrm, idx: Uint32Array.from(idx) } as any); bodyCache.set(k, f); return f;
}
const J = (vid: string, b: HBone): [number, number, number] => { const v = A.byId[vid]; return [v.joints[HB[b] * 3], v.joints[HB[b] * 3 + 1], v.joints[HB[b] * 3 + 2]]; };

/** the torso's support at a height (the farthest body point in direction θ about the axis (0, zc), from the torso's vertices
 *  within 1.2 cm of y): what a belt cinches the cloth to */
const supCache = new Map<string, Float32Array>();
function torsoSupport(vid: string, y: number, zc: number): Float32Array {
  const k = `${vid}|${Math.round(y * 1000)}`; let r = supCache.get(k); if (r) return r; r = new Float32Array(64); const v = A.byId[vid];
  for (let i = 0; i < A.NO; i++) { const pt = A.part[i]; if (pt !== PART.belly && pt !== PART.pelvis && pt !== PART.chest) continue; const vy = v.pos[i * 3 + 1]; if (Math.abs(vy - y) > 0.012) continue;
    const x = v.pos[i * 3], z = v.pos[i * 3 + 2] - zc; for (let b = 0; b < 64; b++) { const th = (b / 64) * 2 * Math.PI, h = x * Math.sin(th) + z * Math.cos(th); if (h > r[b]) r[b] = h; } }
  supCache.set(k, r); return r;
}
/** a vertex skinned mostly to an arm (upper arm, forearm, hand, fingers): a sleeve, never drawn in by the belt (it hangs
 *  beside the waist: drawing it in tore the cuffs open in the second render) */
const ARM_BONES = new Set(Object.entries(HB).filter(([b]) => /^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)_/.test(b)).map(([, i]) => i));
const onArm = (g: Geo, i: number) => ARM_BONES.has(g.si[i * 4]) && g.sw[i * 4] > 127;
const supAt = (r: Float32Array, th: number) => { const f = ((((th / (2 * Math.PI)) % 1) + 1) % 1) * 64, b0 = Math.floor(f) % 64, a = f - Math.floor(f); return r[b0] * (1 - a) + r[(b0 + 1) % 64] * a; };
/** how far down the arm (0 the shoulder joint, 1 the elbow, 2 the wrist) a point on the arm's side x lies */
function alongArm(vid: string, x: number, y: number, z: number) { const s = x >= 0 ? 'l' : 'r', a = J(vid, `upperarm_${s}` as HBone), b = J(vid, `lowerarm_${s}` as HBone), c = J(vid, `hand_${s}` as HBone);
  const t = (p: number[], q: number[]) => { const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], L2 = u[0] ** 2 + u[1] ** 2 + u[2] ** 2; return ((x - p[0]) * u[0] + (y - p[1]) * u[1] + (z - p[2]) * u[2]) / L2; };
  const tu = t(a, b); return tu <= 1 ? Math.max(0, tu) : 1 + Math.max(0, t(b, c)); }
const toBlender = (p: Float32Array) => { const o = new Float32Array(p.length); for (let i = 0; i < p.length; i += 3) { o[i] = p[i]; o[i + 1] = -p[i + 2]; o[i + 2] = p[i + 1]; } return o; };

const EDGE = ARGS.edge ?? 0.026; // the simulation's mesh: refined until the mean edge is at most this (m)
// D-322 rev 2: `seeds` cuts of each piece per group (the seed turns the gathers' phase, varies the ease and the blouse by a
// quarter either way and ripples the cut by a few millimetres), so the bodies of a group do not all wear the same folds
// (outfits.ts gives body variant v the seed v mod seeds)
const SEEDS: number = ARGS.seeds ?? 1, EVAR = [0, 1, -1, 0.5, -0.5];
for (const [piece, P] of Object.entries(ARGS.pieces as Record<string, any>)) for (const group of P.groups as string[]) for (let seed = 0; seed < (P.seeds ?? SEEDS); seed++) { // (s18 C14: a piece may keep fewer cuts: P.seeds)
  const key = `${piece}@0`, g: Geo | undefined = geos[key]; if (!g) { log('no geometry', key); continue; }
  const vid = ARGS.groups[group], v = A.byId[vid];
  const base = v.index * O.NV * 4 + O.pieceBase[key] * 4;
  // the outer layer (a tube's lining, cavity 150, is not simulated: it follows its outer layer, people_cloth_post.ts)
  const outer = new Int32Array(g.n).fill(-1); let no = 0; for (let i = 0; i < g.n; i++) if (P.kind === 'upper' || P.kind === 'legs' || g.ao[i] !== 150) outer[i] = no++; // (a shell has no lining: its cavity byte can be 150 by chance)
  const tri: number[] = []; for (let t = 0; t < g.index.length; t += 3) { const a = outer[g.index[t]], b = outer[g.index[t + 1]], c = outer[g.index[t + 2]]; if (a >= 0 && b >= 0 && c >= 0) tri.push(a, b, c); }
  const p0 = new Float32Array(no * 3), t0v = new Float32Array(no), arm0 = new Float32Array(no);
  for (let i = 0; i < g.n; i++) { const o = outer[i]; if (o < 0) continue; for (let e = 0; e < 3; e++) p0[o * 3 + e] = O.source[base + i * 4 + e]; t0v[o] = g.uv[i * 2 + 1]; arm0[o] = onArm(g, i) ? 1 : 0; }
  // refine to the simulation's resolution (Loop: smooth, the rims kept)
  let se = 0, ne = 0; for (let t = 0; t < tri.length; t += 3) for (let e = 0; e < 3; e++) { const a = tri[t + e], b = tri[t + (e + 1) % 3]; se += Math.hypot(p0[a * 3] - p0[b * 3], p0[a * 3 + 1] - p0[b * 3 + 1], p0[a * 3 + 2] - p0[b * 3 + 2]); ne++; }
  const edge0 = se / ne, levels = P.levels ?? Math.max(0, Math.ceil(Math.log2(edge0 / EDGE) - 1e-9));
  const S = loopSubdivide({ pos: p0, idx: Uint32Array.from(tri), attrs: { t: t0v, arm: arm0 } }, levels);
  const n = S.pos.length / 3, pos = S.pos, idx = S.idx;
  const tgt = new Float32Array(n * 3), start = new Float32Array(n * 3), pin = new Float32Array(n);
  const waist = J(vid, 'spine_01')[1], chest = J(vid, 'spine_03')[1], neck = J(vid, 'neck_01')[1];
  const zc = J(vid, 'pelvis')[2]; // the skirt's axis for the wide cut: the body's midline (x 0, z of the pelvis joint)
  for (let o = 0; o < n; o++) { const x = pos[o * 3], y = pos[o * 3 + 1], z = pos[o * 3 + 2], t = S.attrs.t[o], armV = S.attrs.arm[o] > 0.5;
    // a gathered waist: the pinned band is drawn in along a wave of `gathers` folds round the waist whose length is the wide
    // cut's (so the cloth below buckles into folds instead of shrinking); amplitude from the ease: L ≈ 2π √(r² + N²A²/2)
    const th = Math.atan2(x, z - zc), r = Math.hypot(x, z - zc);
    // (the band under the belt, t < pinTop, is drawn in tight: the belt cinches it; the gathers start just below it, over
    // `gatherBand`: the folds come out from under the belt)
    const gBand = P.gatherBand ?? 0.04, inG = P.kind === 'skirt' && P.gathers && t >= P.pinTop && t < P.pinTop + gBand;
    const gA = inG ? r * Math.sqrt(2 * (P.ease * P.ease - 1)) / P.gathers * sstep(P.pinTop, P.pinTop + gBand * 0.5, t) : 0;
    // the belt cinches: under it (a skirt's top band, an upper garment's band at the waist) the cloth is drawn in to the
    // torso's support + `cinch` (the layers: upper garment, skirt, belt, each a few mm over the one below)
    let rc = r;
    if (P.cinch != null) { const sup0 = supAt(torsoSupport(vid, y, zc), th), sup = sup0 + P.cinch;
      const k = P.kind === 'skirt' ? 1 - sstep(P.pinTop, P.pinTop + gBand, t) : sstep(waist - 0.05, waist - 0.02, y) * (1 - sstep(waist + 0.02, waist + 0.04, y));
      rc = r + (Math.min(r, sup) - r) * k * (r < sup0 + 0.035 && !armV ? 1 : 0); } // (the torso's cloth only: a sleeve hanging beside the waist is not drawn in)
    const rg = rc + (gA ? gA * Math.sin(P.gathers * th + 0.7 + 2.1 * seed) : 0);
    tgt.set(gA || rc !== r ? [x / (r || 1) * rg, y, zc + (z - zc) / (r || 1) * rg] : [x, y, z], o * 3);
    let w = 0, ease = 1; const eK = 1 + 0.25 * EVAR[seed % EVAR.length], PE = P.ease ? 1 + (P.ease - 1) * eK : 0, PB = (P.blouse ?? 0) * eK;
    // (the seed's ripple of the cut: smooth, radial, a few mm, 0 on the first cut)
    const rip = seed ? 0.005 * Math.sin(11 * y + 1.7 * seed + 3 * th) * Math.sin(7 * th + 2.3 * seed) : 0;
    switch (P.kind) {
      case 'skirt': w = t < P.pinTop + (P.gathers ? gBand : 0) ? 1 : 0; ease = 1 + (PE - 1) * sstep(0, 0.25, t); break; // the waist is gathered in; the cut is wide below
      // D-322: an upper garment hangs from its shoulder seams (above the shoulder joints) and is held under the belt and at the
      // cuffs; the chest, back, sides and sleeves are free (they fold over the body and the arms; D-307 pinned all but a band
      // above the belt, and the tunics read as shrink-wrapped)
      case 'upper': { const sh = J(vid, 'upperarm_l')[1], cuff = armV ? sstep(P.cuff[0], P.cuff[1], alongArm(vid, x, y, z)) : 0;
        w = Math.max(sstep(sh - (P.shoulderPin ?? 0.005), sh + 0.035, y), sstep(waist + 0.05, waist + 0.01, y), cuff); break; } // (D-804: `shoulderPin` lowers the pinned cap over the shoulder: the robe's crumpled there)
      case 'legs': w = sstep(waist - 0.12, waist - 0.06, y); break; // D-322: trousers hang from the waist band
      case 'sleeve': w = t < P.pinTop ? 1 : 0; break;
      case 'hang': w = sstep(P.pinY[0], P.pinY[1], y - neck); break; // coats and cloths hang from the shoulders or the head
      case 'sash': w = sstep(P.pinY[0], P.pinY[1], y - (waist + P.dy)); break; // D-313: the belt's band and knot pinned, the ends free below the knot
    }
    // D-322 rev 2: a veil also rests on the tops of the shoulders (hung from the crown alone it drew in to a narrow band)
    if (P.pinShoulder) { const sh = J(vid, 'upperarm_l')[1]; w = Math.max(w, sstep(sh - 0.03, sh + 0.01, y)); }
    pin[o] = w;
    // an upper garment is cut fuller than its fitted shell between the pins (`ease` about the torso's axis): it settles in folds;
    // trousers fuller about each leg's axis below the pinned band
    if (P.kind === 'upper' && P.ease) ease = 1 + (PE - 1) * (1 - w);
    if (P.kind === 'hang' && P.ease) ease = 1 + (PE - 1) * (1 - w); // D-322 rev 2: a veil or mantle cut fuller than the body it falls over
    if (P.kind === 'legs' && P.ease) { const s = x >= 0 ? 'l' : 'r', a = J(vid, `thigh_${s}` as HBone), b = J(vid, `calf_${s}` as HBone), c = J(vid, `foot_${s}` as HBone);
      const up = y > b[1], f = up ? Math.min(1, Math.max(0, (a[1] - y) / (a[1] - b[1]))) : Math.min(1, Math.max(0, (b[1] - y) / (b[1] - c[1])));
      const ax = up ? a[0] + (b[0] - a[0]) * f : b[0] + (c[0] - b[0]) * f, az = up ? a[2] + (b[2] - a[2]) * f : b[2] + (c[2] - b[2]) * f;
      const e = 1 + (PE - 1) * (1 - w) + rip * 10; start.set([ax + (x - ax) * e, y, az + (z - az) * e], o * 3); continue; }
    // D-804: a sleeve is cut fuller than the arm it hangs from (`ease` about the arm's own axis, below the pinned top): the
    // solver draws nothing in, so the spare cloth falls into folds round and under the arm instead of hanging as a smooth tube
    if (P.kind === 'sleeve' && P.ease) { const s = x >= 0 ? 'l' : 'r', a = J(vid, `upperarm_${s}` as HBone), b = J(vid, `lowerarm_${s}` as HBone), c = J(vid, `hand_${s}` as HBone), u = alongArm(vid, x, y, z);
      const ax = u <= 1 ? [0, 1, 2].map(e => a[e] + (b[e] - a[e]) * u) : [0, 1, 2].map(e => b[e] + (c[e] - b[e]) * Math.min(1, u - 1));
      const e = 1 + (PE - 1) * sstep(P.pinTop, P.pinTop + 0.12, t) + rip * 10; start.set([ax[0] + (x - ax[0]) * e, ax[1] + (y - ax[1]) * e, ax[2] + (z - ax[2]) * e], o * 3); continue; }
    // D-322: an upper garment is also cut longer than the body from the shoulder seam to the belt (`blouse`): the pinned
    // waist band is drawn up to its fitted place over the first frames and the extra length falls over the belt in folds
    const shY = J(vid, 'upperarm_l')[1], yb = P.kind === 'upper' && PB && !armV && y < shY ? shY - (shY - y) * (1 + PB) : y;
    ease += rip * (1 - w) / Math.max(0.05, r);
    start.set(P.kind === 'skirt' || P.kind === 'upper' || P.kind === 'hang' || P.kind === 'sleeve' ? [x * ease, yb, zc + (z - zc) * ease] : [x, y, z], o * 3);
  }
  // a part of the piece with nothing pinned (the kandys's hanging sleeves are tubes of their own) would fall away: such a
  // connected part is pinned whole (it keeps its procedural shape; D-307)
  { const par = Int32Array.from({ length: n }, (_, i) => i); const find = (a: number): number => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]); par[b] = a; par[find(c)] = a; }
    const has = new Set<number>(); for (let o = 0; o < n; o++) if (pin[o] > 0.5) has.add(find(o));
    for (let o = 0; o < n; o++) if (!has.has(find(o))) pin[o] = 1; }
  const name = `${piece}_${group}${seed ? `_s${seed}` : ''}`, cloth = `${srcDir}/${name}.ply`, target = `${srcDir}/${name}.target.f32`, pinF = `${srcDir}/${name}.pin.f32`, fitted = `${srcDir}/${name}.fitted.f32`;
  writePLY(cloth, { pos: start, nrm: new Float32Array(n * 3), idx } as any);
  // the fitted positions (Blender axes) the pinned vertices are drawn to; and the fitted refinement itself (game axes) for
  // the post-step, which measures the settled cloth against it
  writeFileSync(target, Buffer.from(toBlender(tgt).buffer)); writeFileSync(pinF, Buffer.from(pin.buffer)); writeFileSync(fitted, Buffer.from(pos.buffer));
  const over = (P.over?.[group] ?? []).map((p: string) => `${p}_${group}${seed && seed < ((ARGS.pieces[p]?.seeds ?? SEEDS)) ? `_s${seed}` : ''}`);
  const arms = P.kind === 'sleeve' || P.kind === 'hang' || P.kind === 'sash' || P.kind === 'upper'; // (D-322: the sleeves of an upper garment rest on the arms)
  sims.push({ name, key, piece, group, variant: vid, kind: P.kind, seed, stage: 1, over, body: bodyPLY(vid, arms), cloth, target, pin: pinF, fitted, outer: n, levels,
    frames: P.frames ?? ARGS.frames, cloth_params: { ...ARGS.cloth, ...(P.cloth ?? {}) } });
  stats[name] = { verts: n, tris: idx.length / 3, levels, edge0_cm: +(edge0 * 100).toFixed(2), edge_cm: +(edge0 * 100 / 2 ** levels).toFixed(2), pinned: +(pin.reduce((a, b) => a + (b > 0.5 ? 1 : 0), 0) / n).toFixed(3), over };
}
for (const s of sims) for (const o of s.over) if (!sims.find(x => x.name === o)) throw new Error(`${s.name}: collider ${o} is not simulated`);
// stages: a piece settles after everything it lies over (the veil over the sleeves over the robe's body: 3)
for (let it = 0; it < 8; it++) for (const s of sims) s.stage = 1 + Math.max(0, ...s.over.map(o => sims.find(x => x.name === o)!.stage));
writeFileSync(`${srcDir}/job.json`, JSON.stringify({ sims, out_dir: srcDir, seed: 0, parallel: ARGS.parallel ?? 8, threads: ARGS.threads ?? 2 }, null, 1));
writeFileSync(`${srcDir}/source_stats.json`, JSON.stringify(stats, null, 1));
log(`${sims.length} simulations written (${sims.filter(s => s.stage > 1).length} over settled garments, ${Math.max(...sims.map(s => s.stage))} stages)`);
