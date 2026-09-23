// Re-bake skin.png and hair.png from the committed humans.bin/json (no MakeHuman download needed), with the current
// tools/humans/skin.ts. Used after the mouth-line fix (D-090): the first bake found the mentolabial sulcus instead of
// the lips' parting and painted the lower lip on the chin. Finger-tip bone tails (nails) are not stored in humans.json;
// they are extrapolated from the last two finger joints.
// Run: npx tsx tools/humans/rebake_skin.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { bakeSkin } from './skin';
import { encodePNG } from './png';
import { HBONES, HB, HPARENT, PART, type HumanAssetsMeta } from '../../src/people/humanFormat';

const OUT = 'public/generated/humans';
const meta: HumanAssetsMeta = JSON.parse(readFileSync(`${OUT}/humans.json`, 'utf8'));
const buf = readFileSync(`${OUT}/humans.bin`); const bin = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const SZ = { u8: 1, u16: 2, i16: 2, u32: 4, f32: 4 } as const;
const view = (k: string) => { const l = meta.layout[k]; const b = bin.slice(l.offset, l.offset + l.count * l.itemSize * SZ[l.type]);
  return l.type === 'u8' ? new Uint8Array(b) : l.type === 'u16' ? new Uint16Array(b) : l.type === 'i16' ? new Int16Array(b) : l.type === 'u32' ? new Uint32Array(b) : new Float32Array(b); };
const REF = meta.variants.find(v => v.id === 'm03')!;
const orig = Array.from(view('orig') as Uint16Array), uv = Array.from(view('uv') as Uint16Array, x => x / 65535);
const skinIndex = view('skinIndex') as Uint8Array, skinWeight = view('skinWeight') as Uint8Array, part = view('part') as Uint8Array;
const ao = Float32Array.from(view('ao') as Uint8Array, x => x / 255);
const NP = meta.layout.skinIndex.count;
const q = new Int16Array(bin.slice(REF.posOffset, REF.posOffset + NP * 6)); const pos = Float64Array.from(q, x => x * meta.posScale);
const lod0 = view('lod0') as Uint16Array; const tris: number[] = [];
for (let t = 0; t < lod0.length; t += 3) { const a = lod0[t], b = lod0[t + 1], c = lod0[t + 2]; if (part[orig[a]] < PART.eye && part[orig[b]] < PART.eye && part[orig[c]] < PART.eye) tris.push(a, b, c); }
const joints = REF.joints;
const tails = HBONES.map((b, i) => { const p = HPARENT[b]; const j = joints[i]; if (!p) return [j[0], j[1] + 0.1, j[2]];
  const pj = joints[HB[p]]; return [j[0] + (j[0] - pj[0]) * 0.8, j[1] + (j[1] - pj[1]) * 0.8, j[2] + (j[2] - pj[2]) * 0.8]; });
const t0 = Date.now();
const baked = bakeSkin({ W: 1024, H: 1024, pos, orig, uv, tris, part, joints, tails, landmarks: meta.landmarks, bone: HB, ao, skinIndex, skinWeight });
writeFileSync(`${OUT}/skin.png`, encodePNG(1024, 1024, baked.skin, 4));
writeFileSync(`${OUT}/hair.png`, encodePNG(512, 512, baked.hair, 4));
console.log(`re-baked skin.png and hair.png in ${((Date.now() - t0) / 1000).toFixed(1)} s; mouth line y ${baked.frame.mouth[1].toFixed(4)} (lip z ${baked.frame.lipZ.toFixed(4)})`);
