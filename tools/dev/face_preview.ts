// dev: node-side close-up renders of the humans with a CPU mirror of the human material (tools/dev/human_cpu.ts, D-155):
// perspective camera, z-buffer with the material's alpha test, per-pixel shading with screen-space derivatives (bump,
// band-limiting), the sun with a shadow map from the same coarse shadow casters the game uses, the hemisphere light,
// the lab's exposure law and AgX. Iterating on faces, hair and dress without the shared browser queue; the browser
// (tests/e2e/humanlab.spec.ts) is the judgement. Screenshots find problems; tests/humans*.test.ts measure.
// Run: npx tsx tools/dev/face_preview.ts <view> [--lineup men|mixed|extra|scribe] [--drop kandys,…] [--lod 0|1|2] [--light room] [--out shots/fp_<view>.png] [--w 960 --h 540]
//   views: face-<i> (0.95 m in front of lineup person i, as the lab's face-* shots), macro-<i> (0.5 m), full, back, side,
//          or cam=x,y,z:tx,ty,tz
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { buildOutfits, COSTUME_OF, pieceBit, type CostumeLOD } from '../../src/people/outfits';
import { lookFor, type PersonLook } from '../../src/people/looks';
import { RigSolver, PALETTE_STRIDE, PLANTED } from '../../src/people/humanRig';
import { pose, type AnimId } from '../../src/people/anim';
import { MAT } from '../../src/people/humanFormat';
import { unpackNormal } from '../../src/people/outfits';
import { SkySystem } from '../../src/sky/skySystem';
import { WorldClock } from '../../src/core/clock';
import { decodePNG, encodePNG } from '../humans/png';
import { surface, shade, agx, toSRGB8, makeTex, dot3, norm3, cross3, SAG_MAX, skirtFold, type V3, type Frag, type Env, type Tex } from './human_cpu';
import { wearTexel } from '../../src/people/looks';
import { DRAPE } from '../../src/people/humanMaterial';
import { BEARD } from '../../src/people/drape';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const view = process.argv[2] ?? 'macro-0';
const LINEUPS: Record<string, any[]> = {
  men: [{ dress: 'persian', sex: 'm', role: 'official', seed: 11 }, { dress: 'guard', sex: 'm', role: 'guard', seed: 12 }, { dress: 'median', sex: 'm', role: 'guard', seed: 13 }, { dress: 'worker', sex: 'm', role: 'mason', seed: 14 }],
  mixed: [{ dress: 'woman', sex: 'f', role: 'grinder', seed: 21 }, { dress: 'woman', sex: 'f', role: 'baker', seed: 22 }, { dress: 'child', sex: 'm', role: 'child', seed: 23 }, { dress: 'worker', sex: 'm', role: 'porter', seed: 24 }],
  // walking (D-189: the skirts' hem folds, fit and joint wrinkles in motion)
  walk: [{ dress: 'persian', sex: 'm', role: 'official', seed: 41, anim: 'walk' }, { dress: 'woman', sex: 'f', role: 'baker', seed: 42, anim: 'walk' }, { dress: 'worker', sex: 'm', role: 'porter', seed: 43, anim: 'walk' }, { dress: 'guard', sex: 'm', role: 'guard', seed: 44, anim: 'walk' }],
  // D-206: the scribe of the scribe-at-work moment (agent 120, Babylonian, Median dress), writing and standing, and a
  // working man and a woman standing (the tunic, the dress and the undyed cloth against skin)
  scribe: [{ dress: 'median', sex: 'm', role: 'scribe', origin: 'Babylonian', seed: 525735469, anim: 'write' }, { dress: 'median', sex: 'm', role: 'scribe', origin: 'Babylonian', seed: 525735469 },
    { dress: 'worker', sex: 'm', role: 'mason', origin: 'Persian', seed: 34 }, { dress: 'woman', sex: 'f', role: 'grinder', origin: 'Elamite', seed: 21 }],
  extra: [{ dress: 'median', sex: 'm', role: 'official', seed: 31 }, { dress: 'persian', sex: 'm', role: 'official', seed: 36 }, { dress: 'worker', sex: 'm', role: 'porter', seed: 34, anim: 'sit' }, { dress: 'worker', sex: 'm', role: 'mason', seed: 31 }],
};
const lineup = LINEUPS[arg('lineup', 'men')], W = +arg('w', '960'), H = +arg('h', '540'), SS = +arg('ss', '1'), hour = +arg('hour', '10'), day = +arg('day', '25');
const out = arg('out', `shots/fp_${arg('lineup', 'men')}_${view}.png`);
const t0 = Date.now(); const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// ---------------------------------------------------------------- assets and people
const D = 'public/generated/humans';
const b = readFileSync(`${D}/humans.bin`);
const A = decodeHumanAssets(JSON.parse(readFileSync(`${D}/humans.json`, 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const O = buildOutfits(A); log(`outfits built (NV ${O.NV})`);
const skinPng = decodePNG(readFileSync(`${D}/skin.png`));
const skinTex: Tex | null = skinPng.width === 2 * skinPng.height ? makeTex(skinPng.width, skinPng.height, skinPng.data) : null;
if (!skinTex) log('skin.png is not the 2:1 atlas yet: skin drawn with a flat reference albedo');
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

interface Person { look: PersonLook; x: number; anim: AnimId; pal: Float32Array; C: CostumeLOD; Cs: CostumeLOD; pos: Float32Array; nrm: Float32Array; posS: Float32Array; vis: Uint8Array; visS: Uint8Array; bend: Float32Array }
// camera first (the eyes look at it)
function camFor(): { eye: V3; target: V3 } {
  if (view.startsWith('cam=')) { const [e, t] = view.slice(4).split(':').map(s => s.split(',').map(Number) as V3); return { eye: e, target: t }; }
  const n = lineup.length, xs = lineup.map((_, i) => (i - (n - 1) / 2) * 0.8);
  if (view === 'full') return { eye: [0, 1.4, 4.2], target: [0, 0.95, 0] };
  if (view === 'back') return { eye: [0.3, 1.5, -3.4], target: [0, 1.0, 0] };
  if (view === 'side') return { eye: [3.4, 1.3, 1.2], target: [0, 0.9, 0] };
  const [kind, si] = view.split('-'); const i = +si, L = lookFor(A, { id: -1 - i, ...lineup[i] }, 1), v = A.variants[L.variant];
  const ey = v.eyeY * L.scale, fz = 0.1 * L.scale;
  if (kind === 'macro') return { eye: [xs[i], ey + 0.01, fz + 0.5], target: [xs[i], ey - 0.03, fz] };
  return { eye: [xs[i], ey + 0.04, 0.95], target: [xs[i], ey - 0.03, 0] }; // face: like the lab's face-* shots
}
const cam = camFor();
const people: Person[] = lineup.map((sp, i) => {
  const look = lookFor(A, { id: -1 - i, ...sp }, 1); const x = (i - (lineup.length - 1) / 2) * 0.8, anim = (sp.anim ?? 'idle') as AnimId;
  const v = A.variants[look.variant], rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE);
  const s = look.scale, lookC: [number, number, number] = [(cam.eye[0] - x) / s, cam.eye[1] / s, cam.eye[2] / s];
  const inp = { joints: v.joints, pose: pose(anim, 1.3, 0.2, 0.3), face: { jaw: 0, blink: 0, look: lookC, eyeYaw: 0, eyePitch: 0 }, grip: [0, 0] as [number, number], x: 0, y: 0, z: 0, yaw: 0, scale: 1, plant: PLANTED.has(anim), seat: !PLANTED.has(anim) };
  rig.setPose(inp); rig.solve(inp, pal, 0);
  const lodC = +arg('lod', '0'), C = O.costumes[COSTUME_OF[look.dress]][lodC], Cs = O.costumes[COSTUME_OF[look.dress]][2];
  // --drop kandys,…: pieces laid aside (the seated scribe's coat, crowd.ts ASIDE)
  const mask = arg('drop', '').split(',').filter(Boolean).reduce((m, id) => m & ~(pieceBit(look.dress, id) ? 1 << pieceBit(look.dress, id) : 0), look.mask);
  const skin = (Cc: CostumeLOD) => {
    const n = Cc.tid.length, pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), vis = new Uint8Array(n), bend = new Float32Array(n); const base = look.variant * O.NV * 4;
    const wt = wearTexel(look.wear), camD = Math.hypot(cam.eye[0] - x, cam.eye[1], cam.eye[2]);
    for (let k = 0; k < n; k++) {
      const t = Cc.tid[k], nb = unpackNormal(O.source[base + t * 4 + 3]); let bx = O.source[base + t * 4], by = O.source[base + t * 4 + 1], bz = O.source[base + t * 4 + 2];
      const clsK = Cc.hmat[k * 4], clothK = clsK >= 1 && clsK <= 3;
      // the skirt's hem folds and fit (the material's vertex stage, D-189)
      if (clothK && Cc.hext[k * 4 + 2] > 127) { const d = skirtFold(Cc.uv[k * 2 + 1], Math.atan2(bx, bz - 0.02), wt[2], wt[1], camD), rl = Math.hypot(bx, bz - 0.02) || 1; bx += bx / rl * d; bz += (bz - 0.02) / rl * d; }
      if (clsK === MAT.felt && Cc.hmat[k * 4 + 3] === 1) by += Cc.uv[k * 2 + 1] * DRAPE.hatH * look.wear.hat; // the fluted hat's height (D-189)
      if (clsK === MAT.hair && Cc.hmat[k * 4 + 3] === 3 && Math.floor(look.pattern / 2) % 4 === 1) { const d = (Cc.hext[k * 4 + 2] / 255 - 0.6) * BEARD.rowAmp; bx += nb[0] * d; by += nb[1] * d; bz += nb[2] * d; } // the court beard's rows (D-225)
      if (clothK && Cc.hext[k * 4 + 2] <= 127) { const oa = Cc.skinIndex[k * 4] * 12, ob = Cc.skinIndex[k * 4 + 1] * 12, ya = norm3([pal[oa + 1], pal[oa + 5], pal[oa + 9]]), yb = norm3([pal[ob + 1], pal[ob + 5], pal[ob + 9]]);
        const mixW = Math.min(1, 4 * (Cc.skinWeight[k * 4] / 255) * (Cc.skinWeight[k * 4 + 1] / 255)); bend[k] = Math.min(1, Math.max(0, (1 - dot3(ya, yb)) * 2)) * mixW; }
      let px = 0, py = 0, pz = 0, nx = 0, ny = 0, nz = 0;
      for (let j = 0; j < 4; j++) { const w = Cc.skinWeight[k * 4 + j] / 255; if (!w) continue; const o = Cc.skinIndex[k * 4 + j] * 12;
        px += w * (pal[o] * bx + pal[o + 1] * by + pal[o + 2] * bz + pal[o + 3]); py += w * (pal[o + 4] * bx + pal[o + 5] * by + pal[o + 6] * bz + pal[o + 7]); pz += w * (pal[o + 8] * bx + pal[o + 9] * by + pal[o + 10] * bz + pal[o + 11]);
        nx += w * (pal[o] * nb[0] + pal[o + 1] * nb[1] + pal[o + 2] * nb[2]); ny += w * (pal[o + 4] * nb[0] + pal[o + 5] * nb[1] + pal[o + 6] * nb[2]); nz += w * (pal[o + 8] * nb[0] + pal[o + 9] * nb[1] + pal[o + 10] * nb[2]); }
      // drape sag (cloth only), as the material's vertex stage
      const cls = Cc.hmat[k * 4]; if (cls >= 1 && cls <= 3 && Cc.hext[k * 4 + 1]) { const o = Cc.skinIndex[k * 4] * 12; const c1 = norm3([pal[o + 1], pal[o + 5], pal[o + 9]]); py -= (Cc.hext[k * 4 + 1] / 255) * SAG_MAX * (1 - Math.abs(c1[1])); }
      const l = Math.hypot(nx, ny, nz) || 1;
      pos[k * 3] = x + px * s; pos[k * 3 + 1] = py * s; pos[k * 3 + 2] = pz * s; nrm[k * 3] = nx / l; nrm[k * 3 + 1] = ny / l; nrm[k * 3 + 2] = nz / l;
      vis[k] = (Math.floor(mask / 2 ** Cc.hmat[k * 4 + 2]) % 2) ? 1 : 0;
    }
    return { pos, nrm, vis, bend };
  };
  const a = skin(C), sh = skin(Cs);
  return { look, x, anim, pal, C, Cs, pos: a.pos, nrm: a.nrm, posS: sh.pos, visS: sh.vis, vis: a.vis, bend: a.bend };
});
log(`people posed: ${people.map(p => `${p.look.variantId} ${p.look.dress} [${p.look.pieces.join(' ')}]`).join('; ')}`);

// ---------------------------------------------------------------- sky and sun (the lab's clock, sky and exposure law)
const sky = new SkySystem(new THREE.Scene(), 1024, 'test' as any); const clock = new WorldClock(day, hour);
sky.update(clock.jdUT, new THREE.Vector3(...cam.eye), 0, 0.1);
const sunDir = norm3(sky.sun.position.clone().sub(sky.sun.target.position).toArray() as V3);
// --light room (D-206, C): the scribe-at-work room's warm light as a stand-in — the sun's colour × CIE A's (a warm key)
// and a red painted floor bouncing into the hemisphere's ground colour, the floor drawn red; not the renderer's lighting
const ROOM = arg('light', '') === 'room', FLOOR: V3 = ROOM ? [0.42, 0.1, 0.06] : [0.36, 0.31, 0.25];
const sunC = sky.sun.color.toArray().map((c, i) => c * sky.sun.intensity * (ROOM ? [1, 0.62, 0.3][i] : 1)) as V3, hemiI = sky.hemi.intensity;
const skyC = (ROOM ? [0.55, 0.36, 0.26] : sky.hemi.color.toArray()) as V3, grC = (ROOM ? [0.75, 0.22, 0.12] : sky.hemi.groundColor.toArray()) as V3;
const sunE = sky.sun.visible ? sky.sun.intensity * Math.max(0, Math.sin((sky.state.sunAlt * Math.PI) / 180)) : 0;
const exposure = Math.min(6, Math.max(0.35, 2.3 / (sunE + hemiI * 0.8 + 0.004)));
log(`sun alt ${sky.state.sunAlt.toFixed(1)}°, dir ${sunDir.map(x => x.toFixed(2))}, exposure ${exposure.toFixed(3)}`);

// ---------------------------------------------------------------- shadow map (orthographic along the sun; the game's casters: far-body geometry)
const SM = 1024, texel = 0.012; // m per shadow texel (the first cascade's order of magnitude, C)
const lz = norm3([-sunDir[0], -sunDir[1], -sunDir[2]]), lx = norm3(cross3([0, 1, 0], lz)), ly = cross3(lz, lx);
const smCentre: V3 = [0, 0.9, 0];
const smDepth = new Float32Array(SM * SM).fill(1e9);
const toLight = (p: ArrayLike<number>, o = 0): V3 => { const d: V3 = [p[o] - smCentre[0], p[o + 1] - smCentre[1], p[o + 2] - smCentre[2]]; return [dot3(d, lx) / texel + SM / 2, dot3(d, ly) / texel + SM / 2, dot3(d, lz)]; };
function rasterDepth(P: V3[], idx: ArrayLike<number>, keep: (k: number) => boolean) {
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], bb = idx[t + 1], c = idx[t + 2]; if (!keep(a) || !keep(bb) || !keep(c)) continue;
    const A0 = P[a], B0 = P[bb], C0 = P[c]; const d = (B0[0] - A0[0]) * (C0[1] - A0[1]) - (C0[0] - A0[0]) * (B0[1] - A0[1]); if (Math.abs(d) < 1e-12) continue;
    const x0 = Math.max(0, Math.floor(Math.min(A0[0], B0[0], C0[0]))), x1 = Math.min(SM - 1, Math.ceil(Math.max(A0[0], B0[0], C0[0]))), y0 = Math.max(0, Math.floor(Math.min(A0[1], B0[1], C0[1]))), y1 = Math.min(SM - 1, Math.ceil(Math.max(A0[1], B0[1], C0[1])));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const px = x + 0.5, py = y + 0.5; const w1 = ((px - A0[0]) * (C0[1] - A0[1]) - (C0[0] - A0[0]) * (py - A0[1])) / d, w2 = ((B0[0] - A0[0]) * (py - A0[1]) - (px - A0[0]) * (B0[1] - A0[1])) / d, w0 = 1 - w1 - w2;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue; const z = w0 * A0[2] + w1 * B0[2] + w2 * C0[2], k = y * SM + x; if (z < smDepth[k]) smDepth[k] = z; } }
}
for (const p of people) { const n = p.Cs.tid.length, L: V3[] = []; for (let k = 0; k < n; k++) L.push(toLight(p.posS, k * 3)); rasterDepth(L, p.Cs.index, k => p.visS[k] === 1); }
const shadowAt = (w: V3) => { const q = toLight(w); let lit = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = Math.floor(q[0]) + dx, y = Math.floor(q[1]) + dy; if (x < 0 || y < 0 || x >= SM || y >= SM) { lit++; continue; } lit += q[2] - 0.12 <= smDepth[y * SM + x] ? 1 : 0; } return lit / 9; };

// ---------------------------------------------------------------- camera
const RW = W * SS, RH = H * SS, fov = +arg("fov", "50") * Math.PI / 180, fy = 1 / Math.tan(fov / 2), fx = fy * RH / RW;
const cz = norm3([cam.eye[0] - cam.target[0], cam.eye[1] - cam.target[1], cam.eye[2] - cam.target[2]]), cx = norm3(cross3([0, 1, 0], cz)), cy = cross3(cz, cx);
const toView = (p: ArrayLike<number>, o = 0): V3 => { const d: V3 = [p[o] - cam.eye[0], p[o + 1] - cam.eye[1], p[o + 2] - cam.eye[2]]; return [dot3(d, cx), dot3(d, cy), dot3(d, cz)]; };
const dirView = (d: V3): V3 => [dot3(d, cx), dot3(d, cy), dot3(d, cz)];
const upV = dirView([0, 1, 0]), sunV = dirView(sunDir);
const proj = (v: V3): [number, number, number] => { const iz = -1 / v[2]; return [(v[0] * fx * iz * 0.5 + 0.5) * RW, (0.5 - v[1] * fy * iz * 0.5) * RH, iz]; };

// ---------------------------------------------------------------- G-buffer raster (perspective-correct, alpha-tested)
const depth = new Float32Array(RW * RH).fill(0), gP = new Int16Array(RW * RH).fill(-1), gT = new Int32Array(RW * RH), gB = new Float32Array(RW * RH * 2);
interface Tri { p: number; t: number }
function vary(p: Person, k: number, out: Frag) {
  const C = p.C, L = p.look, cls = C.hmat[k * 4], slot = C.hmat[k * 4 + 1];
  const col = [null, L.col.skin, L.col.main, L.col.second, L.col.trim, L.col.hair, L.col.leather, null, L.col.felt][slot] as V3 | null;
  out.color = col ? [...col] as V3 : [0, 0, 0]; out.hair = (cls >= 1 && cls <= 3 ? [...L.col.trim] : [...L.col.hair]) as V3;
  out.mat = [cls, C.hmat[k * 4 + 3], L.pattern, L.grime]; out.aux = [C.hext[k * 4] / 255, C.hext[k * 4 + 2] / 255, L.stubble, L.grimeLevel];
  const base = L.variant * O.NV * 4, t = C.tid[k], clothK = cls >= 1 && cls <= 3, kF = clothK ? L.wear.k[slot === 2 ? 0 : slot === 3 ? 1 : 2] : 0;
  out.ext = [C.hext[k * 4 + 1] / 255, C.hext[k * 4 + 3] / 255, unpackNormal(O.source[base + t * 4 + 3])[1], slot >= 2 && slot <= 4 ? kF : 0];
  const wt = wearTexel(L.wear); out.wear = [wt[0], p.bend[k], wt[2], wt[3]]; out.bind = [O.source[base + t * 4], O.source[base + t * 4 + 1], O.source[base + t * 4 + 2]]; out.uv = [C.uv[k * 2], C.uv[k * 2 + 1]];
  out.posV = toView(p.pos, k * 3); out.nrmV = dirView([p.nrm[k * 3], p.nrm[k * 3 + 1], p.nrm[k * 3 + 2]]); return out;
}
const blank = (): Frag => ({ color: [0, 0, 0], hair: [0, 0, 0], mat: [0, 0, 0, 0], bind: [0, 0, 0], aux: [0, 0, 0, 0], ext: [0, 0, 0, 0], wear: [0, 0, 0, 0], uv: [0, 0], posV: [0, 0, 0], nrmV: [0, 0, 1] });
const lerpFrag = (F: Frag[], w: [number, number, number], out: Frag) => {
  const L = (a: number, b: number, c: number) => a * w[0] + b * w[1] + c * w[2];
  for (const key of ['color', 'hair', 'mat', 'bind', 'aux', 'ext', 'wear', 'uv', 'posV', 'nrmV'] as const) { const o = out[key] as number[]; for (let i = 0; i < o.length; i++) o[i] = L((F[0][key] as number[])[i], (F[1][key] as number[])[i], (F[2][key] as number[])[i]); }
  out.mat[0] = F[0].mat[0]; out.mat[1] = F[0].mat[1]; out.mat[2] = F[0].mat[2]; out.wear![2] = F[0].wear![2]; return out;
};
// projected vertices per person
const PV = people.map(p => { const n = p.C.tid.length, a = new Float32Array(n * 3); for (let k = 0; k < n; k++) { const v = toView(p.pos, k * 3); const q = v[2] < -0.01 ? proj(v) : [NaN, NaN, NaN]; a[k * 3] = q[0]; a[k * 3 + 1] = q[1]; a[k * 3 + 2] = q[2]; } return a; });
/** perspective-correct barycentrics of pixel (px, py) in triangle (a, b, c) of person pi (may lie outside: extrapolated) */
function bary(pi: number, a: number, b: number, c: number, px: number, py: number): [number, number, number] {
  const V = PV[pi]; const ax = V[a * 3], ay = V[a * 3 + 1], bx = V[b * 3], by = V[b * 3 + 1], cx2 = V[c * 3], cy2 = V[c * 3 + 1];
  const d = (bx - ax) * (cy2 - ay) - (cx2 - ax) * (by - ay); const w1 = ((px - ax) * (cy2 - ay) - (cx2 - ax) * (py - ay)) / d, w2 = ((bx - ax) * (py - ay) - (px - ax) * (by - ay)) / d, w0 = 1 - w1 - w2;
  const q0 = w0 * V[a * 3 + 2], q1 = w1 * V[b * 3 + 2], q2 = w2 * V[c * 3 + 2], s = q0 + q1 + q2; return [q0 / s, q1 / s, q2 / s];
}
const fragCache = new Map<number, Frag>();
const vfrag = (pi: number, k: number) => { const key = pi * 1e6 + k; let f = fragCache.get(key); if (!f) { f = vary(people[pi], k, blank()); fragCache.set(key, f); } return f; };
let alphaTested = 0;
people.forEach((p, pi) => {
  const V = PV[pi], I = p.C.index;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b2 = I[t + 1], c = I[t + 2]; if (!p.vis[a] || !p.vis[b2] || !p.vis[c]) continue;
    const ax = V[a * 3], ay = V[a * 3 + 1], bx = V[b2 * 3], by = V[b2 * 3 + 1], cx2 = V[c * 3], cy2 = V[c * 3 + 1]; if (!(ax === ax && bx === bx && cx2 === cx2)) continue;
    const d = (bx - ax) * (cy2 - ay) - (cx2 - ax) * (by - ay); if (d >= 0) continue; // front faces are counter-clockwise in view (screen y down)
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx2))), x1 = Math.min(RW - 1, Math.ceil(Math.max(ax, bx, cx2))), y0 = Math.max(0, Math.floor(Math.min(ay, by, cy2))), y1 = Math.min(RH - 1, Math.ceil(Math.max(ay, by, cy2)));
    const cls = p.C.hmat[a * 4], alpha = cls === MAT.hair || cls === MAT.lash;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5; const w1 = ((px - ax) * (cy2 - ay) - (cx2 - ax) * (py - ay)) / d, w2 = ((bx - ax) * (py - ay) - (px - ax) * (by - ay)) / d, w0 = 1 - w1 - w2;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const iz = w0 * V[a * 3 + 2] + w1 * V[b2 * 3 + 2] + w2 * V[c * 3 + 2], k = y * RW + x; if (iz <= depth[k]) continue;
      if (alpha) { // the material's alpha test
        const B = bary(pi, a, b2, c, px, py), f = lerpFrag([vfrag(pi, a), vfrag(pi, b2), vfrag(pi, c)], B, blank());
        const Bx = bary(pi, a, b2, c, px + 1, py), By = bary(pi, a, b2, c, px, py + 1);
        const fX = lerpFrag([vfrag(pi, a), vfrag(pi, b2), vfrag(pi, c)], Bx, blank()), fY = lerpFrag([vfrag(pi, a), vfrag(pi, b2), vfrag(pi, c)], By, blank());
        const fw = Math.hypot(Math.abs(fX.bind[0] - f.bind[0]) + Math.abs(fY.bind[0] - f.bind[0]), Math.abs(fX.bind[1] - f.bind[1]) + Math.abs(fY.bind[1] - f.bind[1]), Math.abs(fX.bind[2] - f.bind[2]) + Math.abs(fY.bind[2] - f.bind[2]));
        const ng = norm3(f.nrmV), vv = norm3([-f.posV[0], -f.posV[1], -f.posV[2]]);
        const s = surface(f, fw, [0, 0, 1], 1 - Math.abs(dot3(ng, vv)), skinTex); alphaTested++; if (!s.keep) continue;
      }
      depth[k] = iz; gP[k] = pi; gT[k] = t; }
  }
});
log(`rasterised (${alphaTested} alpha-tested fragments)`);

// ---------------------------------------------------------------- shading
const img = new Float32Array(RW * RH * 3);
const env: Env = { upV, lights: [], irradiance: (nV: V3) => { const nWy = dot3(nV, upV), wgt = 0.5 * nWy + 0.5; return [0, 1, 2].map(i => (grC[i] + (skyC[i] - grC[i]) * wgt) * hemiI) as V3; } };
const viewToWorld = (v: V3): V3 => [cam.eye[0] + cx[0] * v[0] + cy[0] * v[1] + cz[0] * v[2], cam.eye[1] + cx[1] * v[0] + cy[1] * v[1] + cz[1] * v[2], cam.eye[2] + cx[2] * v[0] + cy[2] * v[1] + cz[2] * v[2]];
const backdrop = (x: number, y: number): V3 => { // floor (court fill) and the mud-brick wall at z = −6, Lambert
  const dv = norm3([((x + 0.5) / RW - 0.5) * 2 / fx, -((y + 0.5) / RH - 0.5) * 2 / fy, -1]); const dw: V3 = [cx[0] * dv[0] + cy[0] * dv[1] + cz[0] * dv[2], cx[1] * dv[0] + cy[1] * dv[1] + cz[1] * dv[2], cx[2] * dv[0] + cy[2] * dv[1] + cz[2] * dv[2]];
  const tf = dw[1] < -1e-4 ? -cam.eye[1] / dw[1] : 1e9, tw = dw[2] < -1e-4 ? (-5.5 - cam.eye[2]) / dw[2] : 1e9;
  const floorHit = tf < tw, t = Math.min(tf, tw); if (t > 1e8) return [0.45, 0.55, 0.75].map(c => c * hemiI) as V3;
  const p: V3 = [cam.eye[0] + dw[0] * t, cam.eye[1] + dw[1] * t, cam.eye[2] + dw[2] * t], n: V3 = floorHit ? [0, 1, 0] : [0, 0, 1], alb = floorHit ? FLOOR : [0.3, 0.27, 0.2];
  const sh = shadowAt(p), nl = Math.max(0, dot3(n, sunDir)), wgt = 0.5 * n[1] + 0.5;
  return [0, 1, 2].map(i => alb[i] / Math.PI * (sunC[i] * nl * sh + (grC[i] + (skyC[i] - grC[i]) * wgt) * hemiI)) as V3;
};
for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
  const k = y * RW + x, pi = gP[k]; let c: V3;
  if (pi < 0) c = backdrop(x, y);
  else {
    const p = people[pi], t = gT[k], I = p.C.index, a = I[t], b2 = I[t + 1], cc = I[t + 2]; const Fv = [vfrag(pi, a), vfrag(pi, b2), vfrag(pi, cc)];
    const f = lerpFrag(Fv, bary(pi, a, b2, cc, x + 0.5, y + 0.5), blank()), fX = lerpFrag(Fv, bary(pi, a, b2, cc, x + 1.5, y + 0.5), blank()), fY = lerpFrag(Fv, bary(pi, a, b2, cc, x + 0.5, y + 1.5), blank());
    const dPx: V3 = [fX.bind[0] - f.bind[0], fX.bind[1] - f.bind[1], fX.bind[2] - f.bind[2]], dPy: V3 = [fY.bind[0] - f.bind[0], fY.bind[1] - f.bind[1], fY.bind[2] - f.bind[2]];
    const fw = Math.hypot(Math.abs(dPx[0]) + Math.abs(dPy[0]), Math.abs(dPx[1]) + Math.abs(dPy[1]), Math.abs(dPx[2]) + Math.abs(dPy[2]));
    const nb = norm3(cross3(dPx, dPy));
    const n = norm3(f.nrmV), v = norm3([-f.posV[0], -f.posV[1], -f.posV[2]]);
    const fwU = Math.abs(fX.uv[0] - f.uv[0]) + Math.abs(fY.uv[0] - f.uv[0]); // (fwidth of uv.x: the robe's seam mask, D-225)
    const s = surface(f, fw, nb, 1 - Math.abs(dot3(n, v)), skinTex, fwU), sx = surface(fX, fw, nb, 0, skinTex, fwU), sy = surface(fY, fw, nb, 0, skinTex, fwU);
    // bumped(): surface gradient from the screen-space derivatives of the height and the view-space position
    const dpdx: V3 = [fX.posV[0] - f.posV[0], fX.posV[1] - f.posV[1], fX.posV[2] - f.posV[2]], dpdy: V3 = [fY.posV[0] - f.posV[0], fY.posV[1] - f.posV[1], fY.posV[2] - f.posV[2]];
    const r1 = cross3(dpdy, n), r2 = cross3(n, dpdx), det = dot3(dpdx, r1), dhx = sx.h - s.h, dhy = sy.h - s.h, sg = Math.sign(det);
    const N = norm3([Math.abs(det) * n[0] - sg * (dhx * r1[0] + dhy * r2[0]), Math.abs(det) * n[1] - sg * (dhx * r1[1] + dhy * r2[1]), Math.abs(det) * n[2] - sg * (dhx * r1[2] + dhy * r2[2])]);
    env.lights = [{ dirV: sunV, color: sunC, shadow: shadowAt(viewToWorld(f.posV)) }];
    c = shade(s, N, v, env);
  }
  img[k * 3] = c[0]; img[k * 3 + 1] = c[1]; img[k * 3 + 2] = c[2];
}
log('shaded');
// ---------------------------------------------------------------- tone map, downsample, write
const px = new Uint8Array(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const acc = [0, 0, 0];
  for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) { const k = (y * SS + j) * RW + x * SS + i; const t = agx([img[k * 3], img[k * 3 + 1], img[k * 3 + 2]], exposure); acc[0] += t[0]; acc[1] += t[1]; acc[2] += t[2]; }
  const o = (y * W + x) * 4; px[o] = toSRGB8(acc[0] / (SS * SS)); px[o + 1] = toSRGB8(acc[1] / (SS * SS)); px[o + 2] = toSRGB8(acc[2] / (SS * SS)); px[o + 3] = 255; }
mkdirSync('shots', { recursive: true }); writeFileSync(out, encodePNG(W, H, px, 4)); log(`wrote ${out}`);
void lin; void MAT;
