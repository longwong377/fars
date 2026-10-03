// s18 C14 (D-790): the reference head for the face-scan projection (tools/blender/face_scan.py): the reference body's head
// and neck at full detail (positions, normals, UVs, triangles) and the landmarks the scan is fitted to (the eyes' centres,
// the mouth's corners, the nose tip). Usage: npx tsx tools/humans/face_scan_src.ts <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { HB, PART } from '../../src/people/humanFormat';
import { regionFrame } from '../../src/people/bodyShape';
const HD = 'public/generated/humans', bin = readFileSync(`${HD}/humans.bin`);
const A = decodeHumanAssets(JSON.parse(readFileSync(`${HD}/humans.json`, 'utf8')), bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer);
const ref = A.byId.m03, F = regionFrame(A, ref);
const keep = (i: number) => A.part[i] === PART.head || A.part[i] === PART.neck;
const tris: number[] = []; const T = A.lods[0]; for (let t = 0; t < T.length; t += 3) if (keep(T[t]) && keep(T[t + 1]) && keep(T[t + 2])) tris.push(T[t], T[t + 1], T[t + 2]);
const used = [...new Set(tris)].sort((a, b) => a - b), loc = new Map(used.map((i, k) => [i, k]));
const J = (b: number) => [ref.joints[b * 3], ref.joints[b * 3 + 1], ref.joints[b * 3 + 2]];
const rv = (pid: number) => { for (let i = 0; i < A.NO; i++) if (A.orig[i] === pid) return i; throw new Error('lm'); };
const P = (i: number) => [ref.pos[i * 3], ref.pos[i * 3 + 1], ref.pos[i * 3 + 2]];
const [my, mz, mw] = F.mouth;
const eyeC = (sg: number) => { const c = [0, 0, 0]; let n = 0; for (let i = 0; i < A.NO; i++) if (A.part[i] === PART.eye && Math.sign(ref.pos[i * 3]) === sg) { for (let k = 0; k < 3; k++) c[k] += ref.pos[i * 3 + k]; n++; } return c.map(x => x / n); };
const lm = { eye_l: eyeC(1), eye_r: eyeC(-1), eye_joint: J(HB.eye_l), mouth_l: [mw, my, mz - 0.008], mouth_r: [-mw, my, mz - 0.008], nose: P(rv(A.meta.landmarks.nose_tip)), chin: P(rv(A.meta.landmarks.chin)) };
writeFileSync(process.argv[2], JSON.stringify({ render: used, pos: used.flatMap(P), nrm: used.flatMap(i => [ref.nrm[i * 3], ref.nrm[i * 3 + 1], ref.nrm[i * 3 + 2]]),
  uv: used.flatMap(i => [A.uv[i * 2], A.uv[i * 2 + 1]]), tris: tris.map(i => loc.get(i)!), part: used.map(i => A.part[i]), lm }));
console.log('head', used.length, 'verts', tris.length / 3, 'tris', JSON.stringify(lm));
