// Source of the people's hair (D-307, D-323): what the project's own data knows about the head the hair is groomed on, for
// Blender to groom it (tools/blender/hair_groom.py: hair curves grown over the head, converted to cards; the strand and
// normal atlases rendered from hair curves, tools/blender/hair_atlas.py). Nothing is placed by hand: the regions are the
// body's own masks (the scalp mask of tools/build_humans.ts, outfits.ts beardMask, the brow density of skin.png), the
// landmarks are measured here on the reference body, and every number of the styles is the registry's (C: after the
// reliefs' hair gathered in a bunch at the nape and bound by the fillet, the square-cut beard in rows of curls to the upper
// chest, the elite woman's bob to the jaw; research/MATERIAL_CULTURE.md "Hair and beards").
//
// Writes <srcDir>/head.json: the reference head, neck and chest surface at full detail (positions, smooth normals,
// triangles over local vertices, each local vertex's render vertex, the four region masks) and the landmarks; and the job
// for Blender (<srcDir>/job.json: the styles, the atlas). The post-step (people_hair_post.ts) binds Blender's cards back to
// the render vertices (anchor triangle and barycentrics per card vertex), so every body variant wears them.
// Usage: npx tsx tools/blender/sources/people_hair.ts <srcDir> <outDir> <argsJson>
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { decodeHumanAssets, type HumanAssets, type HumanVariant } from '../../../src/people/humanAssets';
import { HB, PART, type HBone } from '../../../src/people/humanFormat';
import { beardMask } from '../../../src/people/outfits';
import { decodePNG } from '../../humans/png';

const [srcDir, outDir, argJson] = process.argv.slice(2);
if (!srcDir || !outDir || !argJson) { console.error('usage: people_hair.ts <srcDir> <outDir> <argsJson>'); process.exit(2); }
const ARGS = JSON.parse(readFileSync(argJson, 'utf8'));
mkdirSync(srcDir, { recursive: true }); mkdirSync(outDir, { recursive: true });
const t0 = Date.now(); const log = (...a: unknown[]) => console.log(`[people_hair ${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

type V3 = [number, number, number];
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sstep = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const r5 = (x: number) => Math.round(x * 1e5) / 1e5;

// ---------------------------------------------------------------- the reference body
const HD = 'public/generated/humans';
const bin = readFileSync(`${HD}/humans.bin`);
const A: HumanAssets = decodeHumanAssets(JSON.parse(readFileSync(`${HD}/humans.json`, 'utf8')), bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer);
const ref: HumanVariant = A.byId[ARGS.ref ?? 'm03'];
const J = (b: HBone): V3 => [ref.joints[HB[b] * 3], ref.joints[HB[b] * 3 + 1], ref.joints[HB[b] * 3 + 2]];
const P = (i: number): V3 => [ref.pos[i * 3], ref.pos[i * 3 + 1], ref.pos[i * 3 + 2]];
const rv = (pid: number) => { for (let i = 0; i < A.NO; i++) if (A.orig[i] === pid) return i; throw new Error('landmark ' + pid); };
const headTop = P(rv(A.meta.landmarks.head_top)), chin = P(rv(A.meta.landmarks.chin)), nose = P(rv(A.meta.landmarks.nose_tip));
const headH = headTop[1] - chin[1], eyeY = ref.eyeY, hz = J('head')[2];
log(`reference ${ref.meta.id}: head ${headH.toFixed(3)} m (top ${headTop[1].toFixed(3)}, chin ${chin[1].toFixed(3)}), eye ${eyeY.toFixed(3)}`);

// the surface the hair lies on and collides with: the full-detail body's head, neck and chest (the eyes, lashes and mouth
// helpers are not part of it: a card must not anchor on an eyeball)
const SURF = new Set<number>([PART.head, PART.neck, PART.chest]);
const tris: number[] = []; { const T = A.lods[0]; for (let t = 0; t < T.length; t += 3) { const a = T[t], b = T[t + 1], c = T[t + 2]; if ([a, b, c].every(i => SURF.has(A.part[i]))) tris.push(a, b, c); } }

// ---------------------------------------------------------------- regions (per render vertex of the reference, 0..1)
const scalpR = new Float32Array(A.NO), beardR = beardMask({ A, ref, J }), browR = new Float32Array(A.NO), napeR = new Float32Array(A.NO);
{ const skin = decodePNG(readFileSync(`${HD}/skin.png`)); const hw = skin.width / 2;
  for (let i = 0; i < A.NO; i++) { const pt = A.part[i]; if (pt !== PART.head && pt !== PART.neck) continue; const p = P(i);
    // the scalp: the body's baked scalp mask and the sideburns in front of and behind the ears (as outfits.ts hairShell)
    const side = Math.max(Math.min(Math.abs(p[0]) - 0.058, hz + 0.068 - p[2], p[2] - (hz + 0.022), p[1] - (eyeY - 0.035)), Math.min(Math.abs(p[0]) - 0.045, hz - 0.036 - p[2], p[1] - (eyeY - 0.045)));
    scalpR[i] = Math.max(sstep(0.45, 0.6, A.scalp[i]), sstep(0, 0.006, side));
    const x = Math.min(hw - 1, Math.floor(A.uv[i * 2] * hw)), y = Math.min(skin.height - 1, Math.floor((1 - A.uv[i * 2 + 1]) * skin.height));
    browR[i] = pt === PART.head && p[2] > hz + 0.05 ? skin.data[(y * skin.width + x) * 4 + 3] / 255 : 0;
    // the nape and the back of the skull below the crown (the bunch of hair at the back of the neck, the reliefs)
    napeR[i] = p[2] < hz - 0.02 && p[1] < J('head')[1] + 0.05 && p[1] > J('neck_01')[1] - 0.005 ? Math.max(sstep(0.35, 0.6, A.scalp[i]), pt === PART.neck && p[2] < J('neck_01')[2] - 0.02 && p[1] > J('neck_01')[1] ? 1 : 0) : 0; }
}
// the lips' parting (the moustache ends there): where the midline front vertices change from head- to jaw-weighted
const mouthY = (() => { let upLow = Infinity, loHigh = -Infinity; for (let i = 0; i < A.NO; i++) { if (A.part[i] !== PART.head) continue; const p = P(i); if (Math.abs(p[0]) > 0.0025 || p[1] < chin[1] || p[1] > nose[1] - 0.01 || p[2] < nose[2] - 0.03) continue;
  let w = 0; for (let k = 0; k < 4; k++) if (A.skinIndex[i * 4 + k] === HB.jaw) w = A.skinWeight[i * 4 + k] / 255; if (w < 0.3) upLow = Math.min(upLow, p[1]); else if (w > 0.5) loHigh = Math.max(loHigh, p[1]); } return (upLow + loHigh) / 2; })();
// the bunch at the nape: outfits.ts bunGeo's ellipsoid on the reference (the game draws it as the core under the cards)
const bun = (() => { const h = J('head'), nk = J('neck_01'); const y = lerp(nk[1], h[1], 0.35); let zb = 1; for (let i = 0; i < A.NO; i++) { const pt = A.part[i]; if (pt !== PART.head && pt !== PART.neck) continue; if (Math.abs(ref.pos[i * 3 + 1] - y) > 0.012 || Math.abs(ref.pos[i * 3]) > 0.03) continue; zb = Math.min(zb, ref.pos[i * 3 + 2]); } return { c: [0, y + 0.005, zb + 0.012] as V3, r: [0.068, 0.05, 0.036] as V3 }; })();
// the chest's front below the chin (z of the body's midline front, per 5 mm of height): the long beard hangs clear of it
const chest: [number, number][] = [];
for (let y = chin[1]; y > chin[1] - 0.3; y -= 0.005) { let z = -1; for (let i = 0; i < A.NO; i++) { if (A.part[i] !== PART.chest && A.part[i] !== PART.neck) continue; if (Math.abs(ref.pos[i * 3 + 1] - y) > 0.01 || Math.abs(ref.pos[i * 3]) > 0.06) continue; z = Math.max(z, ref.pos[i * 3 + 2]); } chest.push([r5(y), r5(z)]); }
// the ears' extent (the head's vertices beyond 6.8 cm of the midline)
let earTop = -1, earBot = 9, earZ0 = 9, earZ1 = -9;
for (let i = 0; i < A.NO; i++) { if (A.part[i] !== PART.head) continue; const p = P(i); if (Math.abs(p[0]) < 0.068) continue; earTop = Math.max(earTop, p[1]); earBot = Math.min(earBot, p[1]); earZ0 = Math.min(earZ0, p[2]); earZ1 = Math.max(earZ1, p[2]); }

// ---------------------------------------------------------------- the head for Blender
const local = new Map<number, number>(), renderOf: number[] = [];
const lt = tris.map(i => { let k = local.get(i); if (k === undefined) { k = renderOf.length; local.set(i, k); renderOf.push(i); } return k; });
const pos: number[] = [], nrm: number[] = [], masks: Record<string, number[]> = { scalp: [], beard: [], brow: [], nape: [] };
for (const i of renderOf) { pos.push(...P(i).map(r5)); nrm.push(ref.nrm[i * 3], ref.nrm[i * 3 + 1], ref.nrm[i * 3 + 2]); masks.scalp.push(+scalpR[i].toFixed(3)); masks.beard.push(+beardR[i].toFixed(3)); masks.brow.push(+browR[i].toFixed(3)); masks.nape.push(+napeR[i].toFixed(3)); }
const lm = { headTop: headTop.map(r5), chin: chin.map(r5), nose: nose.map(r5), eyeY: r5(eyeY), hz: r5(hz), head: J('head').map(r5), jaw: J('jaw').map(r5), neck: J('neck_01').map(r5),
  mouthY: r5(mouthY), headH: r5(headH), bun: { c: bun.c.map(r5), r: bun.r }, chest, ear: { top: r5(earTop), bot: r5(earBot), z0: r5(earZ0), z1: r5(earZ1) },
  // the hat line (outfits.ts headRingFrame: eye height + 4.5 cm, 0.1 rad lower at the back): cards rooted above it are the
  // crown's (hair_crown), worn bareheaded only (looks.ts)
  hatY: r5(eyeY + 0.042), hatSlope: 0.1 };
writeFileSync(`${srcDir}/head.json`, JSON.stringify({ ref: ref.meta.id, pos, nrm: nrm.map(x => +x.toFixed(4)), tris: lt, renderOf, masks, lm }));
log(`head: ${renderOf.length} vertices, ${lt.length / 3} triangles; mouth ${mouthY.toFixed(3)}, ears ${earBot.toFixed(3)}..${earTop.toFixed(3)} m`);

// ---------------------------------------------------------------- the job
const MH = process.env.FARS_MAKEHUMAN ?? ARGS.makehuman; // (s18 C14: the cloud reads the CC0 hair images from branch s18-face-assets' assets-raw/faces, its hair/makehuman/ linked as hair/)
const atlas = { ...ARGS.atlas, out_png: `${outDir}/people_hair_atlas.png`, out_normal: `${outDir}/people_hair_normal.png`, seed: ARGS.seed ?? 7,
  rows: ARGS.atlas.rows.map((r: any) => ({ ...r, src: { ...r.src, image: `${MH}/${r.src.image}` } })) };
writeFileSync(`${srcDir}/job.json`, JSON.stringify({ head: `${srcDir}/head.json`, out_cards: `${outDir}/cards.json`, out_blend: `${srcDir}/groom.blend`, seed: ARGS.seed ?? 7,
  styles: ARGS.styles, atlas }, null, 1));
writeFileSync(`${srcDir}/source_stats.json`, JSON.stringify({ head: { vertices: renderOf.length, triangles: lt.length / 3 } }, null, 1));
log('done');
