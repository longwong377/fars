// dev: node previews of the activity performances (D-142) through the real crowd path: an extra per activity (and per
// variant), posed by crowd.update at several phases of the cycle, with its carried props, work objects and animals,
// rasterised orthographically from a 3/4 view and from the side. Writes shots/perf_preview_<name>.png (a contact sheet:
// rows = performances, columns = phases). Screenshots find problems; tests/performances.test.ts measures.
// Run: npx tsx tools/dev/perf_preview.ts [act[:variant],…|all] [phases=4] [--far] [--top]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { decodeHumanAssets, meshoptSimplify } from '../../src/people/humanAssets';
import { buildOutfits, COSTUME_OF, type Dress } from '../../src/people/outfits';
import { HumanGPU } from '../../src/people/humanGPU';
import { Crowd } from '../../src/people/crowd';
import { skinPoint, PALETTE_STRIDE } from '../../src/people/humanRig';
import { ACTIVITIES, type ActivityId } from '../../src/people/activities';
import { MAT } from '../../src/people/humanFormat';
import { PROP_CLASSES } from '../../src/people/props';
import { workGeometry } from '../../src/people/workObjects';
import { animalGeometry, deformAnimal, type Species } from '../../src/people/animals';
import { rasterTri } from '../humans/raster';
import { encodePNG } from '../humans/png';

const D = 'public/generated/humans';
const b = readFileSync(`${D}/humans.bin`);
const A = decodeHumanAssets(JSON.parse(readFileSync(`${D}/humans.json`, 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
const O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) });
const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
const humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 64 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const FAR = process.argv.includes('--far'), TOP = process.argv.includes('--top');
const opt = (k: string, d: number) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? +a.split('=')[1] : d; };
const HALF = opt('half', 1.3), ZY = opt('zy', 0.85);
const NPH = +(args[1] ?? 4), PH_STEP = +(args[2] ?? 1.37);
/** stations: [label, act, why, dress, sex, role, group size] */
type Station = { label: string; act: ActivityId; why: string; dress: Dress; sex: 'm' | 'f'; role: string; n?: number };
const WHY: Record<string, string[]> = {
  haul: ['hauling a drum up the ramp', 'building up the earth ramp', 'carrying dried bricks from the stacks to the wall'],
  gather: ['gathering dung and brushwood for the fire', 'shaping dung cakes and setting them on the wall to dry'],
  tend_animals: ['seeing to the household’s animals', 'tending the relay horses', 'with the ewes at lambing'],
  offer: ['the lan'], garden_work: ['hoeing and weeding the beds', 'pruning the trees'],
  field_work: ['hoeing and weeding the growing crop', 'driving the animals round the threshing floor with a stick', 'gleaning behind the reapers', 'gathering the straw on the threshing floor', 'following the plough, dropping the seed'],
  reap: ['reaping the barley', 'binding sheaves at the harvest'], thresh: ['winnowing on the village floor', 'threshing: driving the animals round over the sheaves'],
  dig_canal: ['clearing the village canal', 'filling the silt baskets and carrying them out'], pick_fruit: ['the vintage: picking grapes', 'treading the picked grapes in the press'],
  craft: ['mending tools and baskets', 'firing the kiln', 'making pigments', 'digging clay by the river'],
};
const FEMALE = new Set(['weave', 'spin', 'wash', 'cook', 'gather']);
const all: Station[] = [];
for (const act of Object.keys(ACTIVITIES) as ActivityId[]) {
  if (!ACTIVITIES[act].note || ['walk', 'carry_sack', 'carry_jar', 'carry_jar_head', 'carry_bread', 'stand_guard', 'patrol', 'dress_stone', 'grind', 'knead', 'bake', 'draw_water', 'write_tablet', 'eat', 'sleep', 'talk', 'rest', 'gamble', 'inspect', 'shelter', 'play', 'offmap', 'queue', 'exchange', 'lie_ill'].includes(act)) continue;
  const f = FEMALE.has(act);
  for (const why of WHY[act] ?? ['']) all.push({ label: `${act}${why ? ':' + why.split(' ').slice(0, 2).join('_') : ''}`, act, why, dress: act === 'offer' ? 'median' : act === 'train' ? 'child' : f ? 'woman' : 'worker', sex: f ? 'f' : 'm', role: act === 'train' ? 'child' : 'mason', n: act === 'carry_bier' ? 4 : act === 'haul' && !why.includes('ramp') && !why.includes('brick') ? 3 : undefined });
}
const want = args[0] && args[0] !== 'all' ? args[0].split(',') : null;
const stations = want ? all.filter(s => want.some(w => s.label.startsWith(w))) : all;

type Tri = { p: Float32Array; c: Float32Array }; // flat list: 9 floats per triangle, 3 per colour
function collect(crowd: Crowd): Tri {
  const P: number[] = [], Cc: number[] = [];
  const tri = (a: number[], b2: number[], c: number[], col: number[]) => { P.push(...a, ...b2, ...c); Cc.push(...col); };
  const COLS: Record<number, number[]> = { [MAT.skin]: [0.72, 0.53, 0.42], [MAT.cloth_main]: [0.62, 0.3, 0.22], [MAT.cloth_second]: [0.3, 0.36, 0.55], [MAT.cloth_trim]: [0.75, 0.62, 0.3], [MAT.eye]: [0.9, 0.9, 0.9], [MAT.hair]: [0.16, 0.12, 0.1],
    [MAT.teeth]: [0.9, 0.9, 0.85], [MAT.mouth]: [0.5, 0.2, 0.2], [MAT.leather]: [0.4, 0.28, 0.18], [MAT.felt]: [0.5, 0.44, 0.35], [MAT.metal]: [0.8, 0.7, 0.35], [MAT.lash]: [0.1, 0.1, 0.1], [MAT.wood]: [0.45, 0.33, 0.21], [MAT.wicker]: [0.6, 0.52, 0.32] };
  const gpu = humans.gpu;
  for (const p of crowd.persons.values()) {
    if (!p.shown) continue;
    const C = O.costumes[COSTUME_OF[p.look.dress]][1]; const v = A.variants[p.look.variant]; const base = v.index * O.NV * 4, src = O.source; const off = p.slot * PALETTE_STRIDE;
    const pos = new Float32Array(C.tid.length * 3); const o = [0, 0, 0];
    for (let k = 0; k < C.tid.length; k++) { const t = C.tid[k]; skinPoint(gpu.palette, off, C.skinIndex.subarray(k * 4, k * 4 + 4), Array.from(C.skinWeight.subarray(k * 4, k * 4 + 4), x => x / 255), [src[base + t * 4], src[base + t * 4 + 1], src[base + t * 4 + 2]], o);
      // character space → world (root yaw, position; the palette already has the scale)
      const cy = Math.cos(p.root[3]), sy = Math.sin(p.root[3]); pos[k * 3] = cy * o[0] + sy * o[2] + p.root[0]; pos[k * 3 + 1] = o[1] + p.root[1]; pos[k * 3 + 2] = -sy * o[0] + cy * o[2] + p.root[2]; }
    for (let t = 0; t < C.index.length / 3; t++) { const i0 = C.index[t * 3]; const bit = C.hmat[i0 * 4 + 2]; if (((p.mask >> bit) & 1) !== 1) continue;
      const m = C.hmat[i0 * 4]; tri([...pos.subarray(C.index[t * 3] * 3, C.index[t * 3] * 3 + 3)], [...pos.subarray(C.index[t * 3 + 1] * 3, C.index[t * 3 + 1] * 3 + 3)], [...pos.subarray(C.index[t * 3 + 2] * 3, C.index[t * 3 + 2] * 3 + 3)], COLS[m] ?? [1, 0, 1]); }
  }
  // meshes of the crowd's group: carried props (union, per instance kind), work objects, animals
  const M = new THREE.Matrix4(), v3 = new THREE.Vector3();
  crowd.group.traverse(obj => {
    const im = obj as THREE.InstancedMesh; if (!im.isInstancedMesh || !im.count || !im.visible) return; const g = im.geometry; const name = im.name;
    if (name === 'goods:sacks') return;
    const pos = g.getAttribute('position'), col = g.getAttribute('color'), idx = g.index;
    const triCount = idx ? idx.count / 3 : pos.count / 3; const vi = (t: number, j: number) => (idx ? idx.getX(t * 3 + j) : t * 3 + j);
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, M);
      let vert: (k: number) => number[];
      if (name.startsWith('props:')) { const ik = (g.getAttribute('ik') as THREE.BufferAttribute).getX(i), ip = (g.getAttribute('ip') as THREE.BufferAttribute).getX(i), pk = g.getAttribute('pk'), sv = g.getAttribute('sv');
        vert = k => (pk.getX(k) === ik ? v3.set(pos.getX(k) + sv.getX(k) * ip, pos.getY(k) + sv.getY(k) * ip, pos.getZ(k) + sv.getZ(k) * ip).applyMatrix4(M).toArray() : [NaN, NaN, NaN]); }
      else if (name.startsWith('animals:')) { const sp = name.split(':')[1] as Species; const st = g.getAttribute('aState') as THREE.BufferAttribute; const L = g.getAttribute('aLeg'), Pv = g.getAttribute('aPiv'), H = g.getAttribute('aHT');
        const s = { phase: st.getX(i), walk: st.getY(i), graze: st.getZ(i), lie: st.getW(i) }; const out = [0, 0, 0];
        vert = k => { deformAnimal(sp, [pos.getX(k), pos.getY(k), pos.getZ(k)], [L.getX(k), L.getY(k), L.getZ(k), L.getW(k)], [Pv.getX(k), Pv.getY(k), Pv.getZ(k), Pv.getW(k)], [H.getX(k), H.getY(k), H.getZ(k), H.getW(k)], s, 1.3, out); return v3.set(out[0], out[1], out[2]).applyMatrix4(M).toArray(); }; }
      else vert = k => v3.set(pos.getX(k), pos.getY(k), pos.getZ(k)).applyMatrix4(M).toArray();
      const ic = name.startsWith('animals:') && im.instanceColor ? [im.instanceColor.getX(i), im.instanceColor.getY(i), im.instanceColor.getZ(i)] : [1, 1, 1];
      for (let t = 0; t < triCount; t++) { const a = vert(vi(t, 0)); if (!Number.isFinite(a[0])) continue; const b2 = vert(vi(t, 1)), c = vert(vi(t, 2)); const k0 = vi(t, 0);
        const cc = col ? [col.getX(k0) * ic[0], col.getY(k0) * ic[1], col.getZ(k0) * ic[2]] : [0.5, 0.5, 0.5]; tri(a, b2, c, cc.map(x => Math.pow(Math.min(1, x), 1 / 2.2))); }
    }
  });
  return { p: Float32Array.from(P), c: Float32Array.from(Cc) };
}
/** orthographic render: view direction `dir` (from the camera toward the scene), `up`; box centre and half-width (m) */
function render(T: Tri, W: number, H: number, centre: number[], half: number, dir: number[], up = [0, 1, 0]) {
  const img = new Uint8Array(W * H * 4); for (let i = 0; i < W * H; i++) img.set([236, 232, 222, 255], i * 4);
  const zb = new Float32Array(W * H).fill(-1e9);
  const f = new THREE.Vector3(...dir).normalize(), r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(...up)).normalize(), u = new THREE.Vector3().crossVectors(r, f);
  const Lg = new THREE.Vector3(0.4, 0.8, 0.45).normalize();
  const pr = (x: number, y: number, z: number) => { const dx = x - centre[0], dy = y - centre[1], dz = z - centre[2]; return [(dx * r.x + dy * r.y + dz * r.z) / half * (W / 2) + W / 2, H / 2 - (dx * u.x + dy * u.y + dz * u.z) / half * (W / 2), -(dx * f.x + dy * f.y + dz * f.z)]; };
  // ground grid (1 m) for scale
  const n = T.p.length / 9;
  for (let t = 0; t < n; t++) {
    const o = t * 9, P = T.p;
    const ux = P[o + 3] - P[o], uy = P[o + 4] - P[o + 1], uz = P[o + 5] - P[o + 2], vx = P[o + 6] - P[o], vy = P[o + 7] - P[o + 1], vz = P[o + 8] - P[o + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const lam = 0.35 + 0.65 * Math.abs(nx * Lg.x + ny * Lg.y + nz * Lg.z);
    const a = pr(P[o], P[o + 1], P[o + 2]), bb = pr(P[o + 3], P[o + 4], P[o + 5]), c = pr(P[o + 6], P[o + 7], P[o + 8]);
    const col = [T.c[t * 3] * 255 * lam, T.c[t * 3 + 1] * 255 * lam, T.c[t * 3 + 2] * 255 * lam];
    rasterTri(W, H, a[0], a[1], bb[0], bb[1], c[0], c[1], (x, y, b0, b1, b2) => { const z = b0 * a[2] + b1 * bb[2] + b2 * c[2], k = y * W + x; if (z <= zb[k]) return; zb[k] = z; img[k * 4] = Math.min(255, col[0]); img[k * 4 + 1] = Math.min(255, col[1]); img[k * 4 + 2] = Math.min(255, col[2]); });
  }
  // ground line / grid dots
  for (let gx = -12; gx <= 12; gx++) for (let gz = -12; gz <= 26; gz++) { const q = pr(gx, 0, gz); const x = Math.round(q[0]), y = Math.round(q[1]); if (x >= 0 && y >= 0 && x < W && y < H && zb[y * W + x] < q[2]) img.set([150, 140, 120, 255], (y * W + x) * 4); }
  return img;
}
function blit(dst: Uint8Array, DW: number, src: Uint8Array, W: number, H: number, ox: number, oy: number) { for (let y = 0; y < H; y++) dst.set(src.subarray(y * W * 4, (y + 1) * W * 4), ((oy + y) * DW + ox) * 4); }

mkdirSync('shots', { recursive: true });
const CW = 250, CH = 300, PER = 6;
for (let s0 = 0; s0 < stations.length; s0 += PER) {
  const batch = stations.slice(s0, s0 + PER);
  const cols = NPH * 2 + 2, sheet = new Uint8Array(cols * CW * batch.length * CH * 4);
  for (let i = 0; i < sheet.length; i += 4) sheet.set([255, 255, 255, 255], i);
  batch.forEach((st, row) => {
    const crowd = new Crowd(null, 1, humans);
    const n = st.n ?? 1;
    for (let i = 0; i < n; i++) {
      const x = st.act === 'carry_bier' ? (i % 2 ? -0.46 : 0.46) : 0, z = st.act === 'carry_bier' ? (i < 2 ? 1.0 : -1.0) : st.act === 'haul' ? -i * 1.1 : 0;
      crowd.addExtra(`s${i}`, { id: i, sex: st.sex, role: st.role, dress: st.dress, seed: 300 + i * 37, x, y: 0, z, yaw: 0, act: st.act, why: st.why, group: 'g', look: null, variant: st.act === 'carry_bier' && x < 0 ? 0 : undefined } as any);
    }
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000); cam.position.set(4, 3, 8); cam.lookAt(0, 0.8, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const P0 = crowd.persons.get('s0')!;
    for (let k = 0; k <= NPH; k++) {
      const t = 3 + k * PH_STEP + (st.act === 'plough' ? k * 9 : 0);
      crowd.update(t - 0.1, cam.position, null, undefined); crowd.update(t, cam.position, null, undefined);
      const T = collect(crowd);
      if (k < NPH) {
        const r = P0.root, ctr = [r[0], ZY, r[2] + 0.25];
        const a = render(T, CW, CH, ctr, HALF, TOP ? [0, -1, 0.001] : [-0.55, -0.3, -0.78], TOP ? [0, 0, -1] : [0, 1, 0]);
        const s2 = render(T, CW, CH, ctr, HALF, [-1, -0.08, 0.02]);
        blit(sheet, cols * CW, a, CW, CH, k * 2 * CW, row * CH); blit(sheet, cols * CW, s2, CW, CH, (k * 2 + 1) * CW, row * CH);
      } else { // one wide view for the things and animals, and one from above
        const far = st.act === 'train' ? [0, 1, 10] : [0, 0.8, 1.5], half = st.act === 'train' ? 13 : st.act === 'plough' ? 9 : 4.6;
        const w = render(T, CW, CH, far, half, [-0.5, -0.45, -0.75]); blit(sheet, cols * CW, w, CW, CH, NPH * 2 * CW, row * CH);
        const w2 = render(T, CW, CH, far, half, [0, -1, 0.001], [0, 0, -1]); blit(sheet, cols * CW, w2, CW, CH, (NPH * 2 + 1) * CW, row * CH);
      }
    }
    const S = crowd.stats(); console.log(st.label, JSON.stringify(S.things.kinds), JSON.stringify(S.animals.species), 'props', S.props);
  });
  const name = `shots/perf_preview_${s0 / PER}${TOP ? '_top' : ''}.png`;
  writeFileSync(name, encodePNG(cols * CW, batch.length * CH, sheet, 4)); console.log('wrote', name, batch.map(s => s.label).join(' | '));
}
void workGeometry; void animalGeometry; void PROP_CLASSES; void FAR;
