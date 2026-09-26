// D-234: a CPU preview of the town's houses (no GPU, not a render: it finds geometry problems, never proves anything).
// A z-buffered rasteriser of the settlement's meshes (near tiles built round the eye, the far level beyond), vertex colours
// × (ambient · ao + sun · n·l with a shadow map of the same meshes), sky above. Writes a PNG.
// Usage: npx tsx tools/dev/house_preview.ts <out.png> <x> <z> <eyeH> <yawDeg(true, cw from N)> <pitchDeg> [fovDeg] [w h]
//        npx tsx tools/dev/house_preview.ts <out.png> lane:<site>   (a lane spot as settlement.spec picks it)
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import * as THREE from 'three/webgpu';
import { Ring, Terrain, type TerrainMeta } from '../../src/terrain/heightfield';
import { FireSystem } from '../../src/world/fire';
import { Settlement } from '../../src/world/settlement/build';

const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
const town = new Settlement(null, T, new FireSystem(0), 'high');
const a = process.argv.slice(2), out = a[0];
let cam: number[];
if (a[1].startsWith('lane:')) { // settlement.spec's lane spot
  const s = town.plan.sites.find(x => x.id === a[1].slice(5))!; const open = (i: number, j: number) => { const c = s.at(i, j); return c === -2 || c === -4; };
  let best: any = null;
  for (let j = 10; j < s.H - 10; j++) for (let i = 10; i < s.W - 10; i++) { if (![[-1, -1], [0, -1], [-1, 0], [0, 0]].every(([p, q]) => open(i + p, j + q))) continue;
    const r = Math.hypot(s.cu(i), s.cv(j)); if (r > Math.min(s.W, s.H) * 0.3) continue;
    let runU = 0; while (open(i + runU, j) && open(i + runU, j - 1) && runU < 60) runU++; let runV = 0; while (open(i, j + runV) && open(i - 1, j + runV) && runV < 60) runV++;
    const sc = Math.max(runU, runV) - r * 0.05; if (!best || sc > best.sc) best = { i, j, sc, alongU: runU >= runV }; }
  const g = s.grid(s.u0 + best.i, s.v0 + best.j), th = s.frame.theta + (best.alongU ? 0 : Math.PI / 2); const gb = 90 - th * 180 / Math.PI;
  cam = [g[0], -g[1], 1.6, ((gb + 341) % 360 + 360) % 360 - 341, +(a[2] ?? 2)]; // yaw in grid degrees below
  cam[3] = ((gb % 360) + 360) % 360; // grid bearing
} else if (a[1].startsWith('court:')) { // in house n's court, at its corner, looking across it
  const [, sid, nth] = a[1].split(':'); const s = town.plan.sites.find(x => x.id === sid)!; const hs = s.plots.filter(p => p.door && (p.kind === 'house' || p.kind === 'house_large'));
  const p = hs[+nth % hs.length]; let su = 0, sv = 0, n = 0, lo: number[] = [1e9, 1e9];
  for (let k = 0; k < s.cell.length; k++) if (s.cell[k] === p.idx && s.sub[k] === 2) { const u = s.cu(k % s.W), v = s.cv((k / s.W) | 0); su += u; sv += v; n++; if (u + v < lo[0] + lo[1]) lo = [u, v]; }
  const g = s.grid(lo[0], lo[1]), c = s.grid(su / n, sv / n); const gb = (Math.atan2(c[0] - g[0], c[1] - g[1]) * 180) / Math.PI; console.log('plot', p.id, p.kind, n, 'court cells');
  cam = [g[0], -g[1], 1.6, ((gb % 360) + 360) % 360, 8];
} else if (a[1].startsWith('door:') || a[1].startsWith('above:')) { // outside house n's street door looking in / above its court
  const [kind, sid, nth] = a[1].split(':'); const s = town.plan.sites.find(x => x.id === sid)!; const hs = s.plots.filter(p => p.door && (p.kind === 'house' || p.kind === 'house_large'));
  const p = hs[+nth % hs.length], d = s.doorPoints(p)!; const nu = d.inside[0] - d.out[0], nv = d.inside[1] - d.out[1];
  const back = kind === 'door' ? +(process.env.BACK ?? 1.2) : -2, [cu, cv] = [d.out[0] - nu * back, d.out[1] - nv * back], g = s.grid(cu, cv), dirG = s.grid(cu + nu, cv + nv);
  const gb = (Math.atan2(dirG[0] - g[0], dirG[1] - g[1]) * 180) / Math.PI; console.log('plot', p.id, p.kind, p.w, 'x', p.d);
  cam = [g[0], -g[1], kind === 'door' ? 1.6 : 7, ((gb % 360) + 360) % 360, kind === 'door' ? 4 : -35];
} else cam = [+a[1], +a[2], +a[3], ((+a[4] - 341) % 360 + 360) % 360, +a[5]];
const fov = +(a[a[1].includes(':') ? 3 : 6] ?? 60), W = +(process.env.PW ?? a[7] ?? 480), H = +(process.env.PH ?? a[8] ?? 270);
const [cx, cz, eyeH, gridYaw, pitch] = cam;
const ey = T.heightAt(cx, cz) + eyeH;
town.nearUpdate(cx, cz, 0);
// camera basis: grid bearing gridYaw (cw from grid north = −z), pitch up
const yr = (gridYaw * Math.PI) / 180, pr = (pitch * Math.PI) / 180;
const fwd = new THREE.Vector3(Math.sin(yr) * Math.cos(pr), Math.sin(pr), -Math.cos(yr) * Math.cos(pr)), right = new THREE.Vector3(Math.cos(yr), 0, Math.sin(yr)), up = new THREE.Vector3().crossVectors(right, fwd);
const eye = new THREE.Vector3(cx, ey, cz), f = 1 / Math.tan((fov * Math.PI) / 360), asp = W / H;
const sun = new THREE.Vector3(-0.45, 0.72, 0.35).normalize();
// gather triangles (visible meshes: near tiles shown; far meshes with their near tiles collapsed as the shader does)
type Tri = { p: number[]; n: number[]; c: number[]; ao: number[] };
const tris: Tri[] = []; const R = 180;
const eyeXZ = new THREE.Vector2(cx, cz);
town.group.updateMatrixWorld(true);
town.group.traverse((o: any) => {
  if (!o.isMesh || !o.visible || !o.geometry?.index || o.isInstancedMesh) return; if (/haze|water|road|canal/.test(o.name)) return;
  const g = o.geometry, P = g.getAttribute('position'), N = g.getAttribute('normal'), C = g.getAttribute('color'), AO = g.getAttribute('ao'), TL = g.getAttribute('tile'), I = g.index; if (!N || !P) return;
  for (let t = 0; t < I.count; t += 3) { const ids = [I.getX(t), I.getX(t + 1), I.getX(t + 2)];
    if (TL && ids.some(i => Math.hypot(TL.getX(i) - eyeXZ.x, TL.getY(i) - eyeXZ.y) < 72)) continue;
    const p: number[] = [], n: number[] = [], c: number[] = [], ao: number[] = []; let near = false;
    for (const i of ids) { p.push(P.getX(i), P.getY(i), P.getZ(i)); n.push(N.getX(i), N.getY(i), N.getZ(i)); c.push(C ? C.getX(i) : 0.3, C ? C.getY(i) : 0.3, C ? C.getZ(i) : 0.3); ao.push(AO ? AO.getX(i) : 1); if (Math.hypot(P.getX(i) - cx, P.getZ(i) - cz) < R) near = true; }
    if (near) tris.push({ p, n, c, ao }); } });
// the terrain as a coarse grid round the eye (ground colour)
for (let x = -R; x < R; x += 2) for (let z = -R; z < R; z += 2) { const P = (dx: number, dz: number) => [cx + dx, T.heightAt(cx + dx, cz + dz) + 0.08, cz + dz];
  const a0 = P(x, z), b0 = P(x + 2, z), c0 = P(x + 2, z + 2), d0 = P(x, z + 2), gc = [0.26, 0.2, 0.13];
  tris.push({ p: [...a0, ...c0, ...b0], n: [0, 1, 0, 0, 1, 0, 0, 1, 0], c: [...gc, ...gc, ...gc], ao: [1, 1, 1] }, { p: [...a0, ...d0, ...c0], n: [0, 1, 0, 0, 1, 0, 0, 1, 0], c: [...gc, ...gc, ...gc], ao: [1, 1, 1] }); }
console.log(`${tris.length} triangles within ${R} m; near ${town.nearInfo.tiles} tiles ${(town.nearInfo.tris / 1e3).toFixed(0)} k`);
// shadow map: orthographic along −sun over the region
const SM = 3000, sx = new THREE.Vector3().crossVectors(sun, new THREE.Vector3(0, 1, 0)).normalize(), sy = new THREE.Vector3().crossVectors(sx, sun).normalize();
const depth = new Float32Array(SM * SM).fill(-Infinity), ext = R;
const toS = (x: number, y: number, z: number) => { const v = new THREE.Vector3(x - cx, y - ey, z - cz); return [(v.dot(sx) / ext * 0.5 + 0.5) * SM, (v.dot(sy) / ext * 0.5 + 0.5) * SM, v.dot(sun)]; };
function raster(pts: number[][], w: number, h: number, cb: (x: number, y: number, b: number[]) => void) {
  const [A, B, C] = pts; const minX = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), maxX = Math.min(w - 1, Math.ceil(Math.max(A[0], B[0], C[0]))), minY = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), maxY = Math.min(h - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
  const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(d) < 1e-9) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) { const px = x + 0.5, py = y + 0.5;
    const l0 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / d, l1 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / d, l2 = 1 - l0 - l1;
    if (l0 < 0 || l1 < 0 || l2 < 0) continue; cb(x, y, [l0, l1, l2]); } }
for (const t of tris) { const s = [0, 1, 2].map(k => toS(t.p[k * 3], t.p[k * 3 + 1], t.p[k * 3 + 2])); raster(s, SM, SM, (x, y, b) => { const z = s[0][2] * b[0] + s[1][2] * b[1] + s[2][2] * b[2]; const k = y * SM + x; if (z > depth[k]) depth[k] = z; }); }
// main pass
const img = new Float32Array(W * H * 3), zb = new Float32Array(W * H).fill(Infinity);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = 1 - y / H; const k = (y * W + x) * 3; img[k] = 0.55 + 0.2 * v; img[k + 1] = 0.66 + 0.18 * v; img[k + 2] = 0.82 + 0.1 * v; }
const proj = (x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z).sub(eye); const zc = v.dot(fwd); if (zc < 0.05) return null; return [(v.dot(right) / zc * f / asp * 0.5 + 0.5) * W, (0.5 - v.dot(up) / zc * f * 0.5) * H, zc]; };
for (const t of tris) { const s = [0, 1, 2].map(k => proj(t.p[k * 3], t.p[k * 3 + 1], t.p[k * 3 + 2])); if (s.some(q => !q)) continue; const S = s as number[][];
  raster(S, W, H, (x, y, b) => { const z = 1 / (b[0] / S[0][2] + b[1] / S[1][2] + b[2] / S[2][2]); const k = y * W + x; if (z >= zb[k]) return; zb[k] = z;
    const w = [b[0] / S[0][2] * z, b[1] / S[1][2] * z, b[2] / S[2][2] * z], at = (arr: number[], i: number) => arr[i] * w[0] + arr[3 + i] * w[1] + arr[6 + i] * w[2];
    const px = at(t.p, 0), py = at(t.p, 1), pz = at(t.p, 2); const n = new THREE.Vector3(at(t.n, 0), at(t.n, 1), at(t.n, 2)).normalize();
    const ao = t.ao[0] * w[0] + t.ao[1] * w[1] + t.ao[2] * w[2]; const sp = toS(px + n.x * 0.35, py + n.y * 0.35, pz + n.z * 0.35); const si = Math.floor(sp[1]) * SM + Math.floor(sp[0]);
    const lit = si >= 0 && si < SM * SM && sp[2] < depth[si] - 0.15 ? 0 : 1; const nd = Math.max(0, n.dot(sun));
    const L = 0.28 * ao * (0.6 + 0.4 * Math.max(0, n.y)) + 1.1 * nd * lit; const q = k * 3;
    const fog = Math.min(1, z / 900); for (let i = 0; i < 3; i++) img[q + i] = at(t.c, i) * L * (1 - fog) + img[q + i] * fog; }); }
// PNG (sRGB)
const px = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) { px[y * (W * 3 + 1)] = 0; for (let x = 0; x < W; x++) for (let i = 0; i < 3; i++) { const l = Math.max(0, img[(y * W + x) * 3 + i]); const sv = l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055; px[y * (W * 3 + 1) + 1 + x * 3 + i] = Math.max(0, Math.min(255, Math.round(sv * 255))); } }
const crc = (buf: Buffer) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
const chunk = (type: string, data: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(px)), chunk('IEND', Buffer.alloc(0))]));
console.log('wrote', out, 'cam', cam.map(v => +v.toFixed(1)));
