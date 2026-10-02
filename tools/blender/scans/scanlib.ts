// PARSA s14 (D-365): licensed 3D scans as the monuments' source (BLENDER_PLAN rows 1-2, B118).
// Node-only helpers, light on memory (the box has 16 GB for ~9 agents; Blender ran out at 450 MB importing a 2.5 M-triangle
// GLB): read a GLB's triangles with its node transforms applied (glTF axes, y up), weld the chunk seams, transform, cut by
// planes, simplify (meshoptimizer), smooth vertex normals, and an orthographic z-buffer preview (PNG via sharp) for node-side
// checks before any Blender or browser run.
import { readFileSync, existsSync, mkdirSync, writeFileSync, openSync, readSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';

export type Mesh = { pos: Float32Array; idx: Uint32Array };
export type NMesh = Mesh & { nrm: Float32Array };

/** the scans' registry (tools/blender/scans/scans.json): where each file comes from, its licence and its sha256 */
export const SCANS_DIR = process.env.FARS_SCANS ?? 'C:/Users/Administrator/fars-assets/scans_s14';
export function scanFile(id: string): string {
  const R = JSON.parse(readFileSync('tools/blender/scans/scans.json', 'utf8')).scans[id];
  if (!R) throw new Error(`scan ${id} not in tools/blender/scans/scans.json`);
  const f = `${SCANS_DIR}/${R.file}`;
  if (!existsSync(f)) { mkdirSync(dirname(f), { recursive: true }); execFileSync('curl', ['-sL', '-o', f, R.url]); }
  // hashed in 4 MB chunks (the box's memory is shared: one 79 MB buffer less at the peak)
  const H = createHash('sha256'), fd = openSync(f, 'r'), buf = Buffer.allocUnsafe(1 << 22); let n: number;
  while ((n = readSync(fd, buf, 0, buf.length, null)) > 0) H.update(buf.subarray(0, n));
  closeSync(fd); const h = H.digest('hex');
  if (h !== R.sha256) throw new Error(`scan ${id}: sha256 ${h} differs from the registry's ${R.sha256}`);
  return f;
}

const mul = (a: number[], b: number[]) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function trs(n: any): number[] {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1], [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}

/** every triangle primitive of a GLB, world-space (node transforms applied), as one indexed mesh (not welded) */
export function readGLB(path: string): Mesh {
  const b = readFileSync(path), jl = b.readUInt32LE(12), J = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'));
  const bin = b.subarray(20 + jl + 8);
  const acc = (i: number) => {
    const a = J.accessors[i], v = J.bufferViews[a.bufferView], off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type as string]!, C = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType as number]!;
    const stride = v.byteStride ? v.byteStride / C.BYTES_PER_ELEMENT : n, out = new (C as any)(a.count * n);
    const src = new (C as any)(bin.buffer, bin.byteOffset + off, (a.count - 1) * stride + n);
    for (let k = 0; k < a.count; k++) for (let j = 0; j < n; j++) out[k * n + j] = src[k * stride + j];
    return out;
  };
  const P: Float32Array[] = [], X: Uint32Array[] = []; let nv = 0;
  const walk = (ni: number, M: number[]) => {
    const n = J.nodes[ni], W = mul(M, trs(n));
    if (n.mesh !== undefined) for (const pr of J.meshes[n.mesh].primitives) {
      if ((pr.mode ?? 4) !== 4) continue;
      const p = acc(pr.attributes.POSITION) as Float32Array, q = new Float32Array(p.length);
      for (let k = 0; k < p.length; k += 3) for (let r = 0; r < 3; r++) q[k + r] = W[r] * p[k] + W[4 + r] * p[k + 1] + W[8 + r] * p[k + 2] + W[12 + r];
      const ix = pr.indices !== undefined ? Uint32Array.from(acc(pr.indices)) : Uint32Array.from({ length: p.length / 3 }, (_, i) => i);
      for (let k = 0; k < ix.length; k++) ix[k] += nv;
      P.push(q); X.push(ix); nv += p.length / 3;
    }
    for (const c of n.children ?? []) walk(c, W);
  };
  for (const r of J.scenes[J.scene ?? 0].nodes) walk(r, I4);
  const pos = new Float32Array(nv * 3), idx = new Uint32Array(X.reduce((s, x) => s + x.length, 0));
  let o = 0; for (const p of P) { pos.set(p, o); o += p.length; } o = 0; for (const x of X) { idx.set(x, o); o += x.length; }
  return { pos, idx };
}

/** merge vertices closer than eps (the 65 k-vertex chunks of an exported scan share their seam vertices); drop degenerate faces */
export function weld(m: Mesh, eps = 1e-5): Mesh {
  // typed arrays only (a string-keyed map of 1.5 M vertices ran the box out of memory): sort by quantised x, y, z
  const nv = m.pos.length / 3, q = new Float64Array(nv * 3);
  for (let k = 0; k < nv * 3; k++) q[k] = Math.round(m.pos[k] / eps);
  const ord = new Uint32Array(nv).map((_, i) => i).sort((a, b) => q[a * 3] - q[b * 3] || q[a * 3 + 1] - q[b * 3 + 1] || q[a * 3 + 2] - q[b * 3 + 2]);
  const map = new Uint32Array(nv), out = new Float32Array(nv * 3); let n = 0;
  for (let i = 0; i < nv; i++) {
    const v = ord[i], p = i ? ord[i - 1] : -1;
    if (p < 0 || q[v * 3] !== q[p * 3] || q[v * 3 + 1] !== q[p * 3 + 1] || q[v * 3 + 2] !== q[p * 3 + 2]) { out[n * 3] = m.pos[v * 3]; out[n * 3 + 1] = m.pos[v * 3 + 1]; out[n * 3 + 2] = m.pos[v * 3 + 2]; n++; }
    map[v] = n - 1;
  }
  const idx = new Uint32Array(m.idx.length); let o = 0;
  for (let t = 0; t < m.idx.length; t += 3) { const a = map[m.idx[t]], b = map[m.idx[t + 1]], c = map[m.idx[t + 2]]; if (a !== b && b !== c && a !== c) { idx[o++] = a; idx[o++] = b; idx[o++] = c; } }
  return { pos: out.slice(0, n * 3), idx: idx.slice(0, o) };
}

export function bbox(pos: Float32Array): [number[], number[]] {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < pos.length; k += 3) for (let r = 0; r < 3; r++) { lo[r] = Math.min(lo[r], pos[k + r]); hi[r] = Math.max(hi[r], pos[k + r]); }
  return [lo, hi];
}

/** keep the faces whose centroid passes keep(x, y, z); compact the vertices */
export function filterFaces(m: Mesh, keep: (x: number, y: number, z: number) => boolean): Mesh {
  const P = m.pos, I = m.idx, idx: number[] = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    if (keep((P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3)) idx.push(I[t], I[t + 1], I[t + 2]);
  }
  return compact({ pos: P, idx: Uint32Array.from(idx) });
}
export function compact(m: Mesh): Mesh {
  const nv = m.pos.length / 3, map = new Int32Array(nv).fill(-1), pos: number[] = [], idx = new Uint32Array(m.idx.length);
  for (let k = 0; k < m.idx.length; k++) { const v = m.idx[k]; if (map[v] < 0) { map[v] = pos.length / 3; pos.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]); } idx[k] = map[v]; }
  return { pos: Float32Array.from(pos), idx };
}
export function transform(m: Mesh, f: (x: number, y: number, z: number) => [number, number, number], flip = false): Mesh {
  const pos = new Float32Array(m.pos.length);
  for (let k = 0; k < pos.length; k += 3) { const q = f(m.pos[k], m.pos[k + 1], m.pos[k + 2]); pos[k] = q[0]; pos[k + 1] = q[1]; pos[k + 2] = q[2]; }
  const idx = Uint32Array.from(m.idx); if (flip) for (let t = 0; t < idx.length; t += 3) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }
  return { pos, idx };
}
export function merge(ms: Mesh[]): Mesh {
  const pos = new Float32Array(ms.reduce((s, m) => s + m.pos.length, 0)), idx = new Uint32Array(ms.reduce((s, m) => s + m.idx.length, 0));
  let po = 0, io = 0; for (const m of ms) { pos.set(m.pos, po); for (let k = 0; k < m.idx.length; k++) idx[io + k] = m.idx[k] + po / 3; po += m.pos.length; io += m.idx.length; }
  return { pos, idx };
}

/** area-weighted smooth vertex normals */
export function normals(m: Mesh): NMesh {
  const P = m.pos, I = m.idx, N = new Float32Array(P.length);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { N[v] += nx; N[v + 1] += ny; N[v + 2] += nz; }
  }
  for (let k = 0; k < N.length; k += 3) { const l = Math.hypot(N[k], N[k + 1], N[k + 2]) || 1; N[k] /= l; N[k + 1] /= l; N[k + 2] /= l; }
  return { ...m, nrm: N };
}

/** meshoptimizer simplification to ~targetTris (topology-respecting; borders locked when lockBorder) */
export async function simplifyTo(m: Mesh, targetTris: number, opts: { lockBorder?: boolean; error?: number } = {}): Promise<Mesh> {
  const { MeshoptSimplifier: S } = await import('meshoptimizer'); await S.ready;
  if (m.idx.length / 3 <= targetTris) return m;
  let [ix] = S.simplify(m.idx, m.pos, 3, targetTris * 3, opts.error ?? 1, opts.lockBorder ? ['LockBorder'] : []);
  // D-510: a joined, non-manifold source (the W bull: a grafted head, pressed folds) can stall the edge collapses above the target;
  // then the sloppy (vertex-clustering) simplifier takes the result the rest of the way (the far level only, in practice)
  if (ix.length > targetTris * 3 * 1.15) [ix] = S.simplifySloppy(ix, m.pos, 3, null, targetTris * 3, 1);
  return compact({ pos: m.pos, idx: ix });
}

/** orthographic preview: eye direction d (unit, from the eye toward the object), up hint; Lambert + a rim of depth shading */
export async function preview(path: string, m: Mesh, d: [number, number, number], W = 900, H = 900, opts: { up?: [number, number, number]; box?: [number[], number[]]; light?: [number, number, number] } = {}) {
  const sharp = (await import('sharp')).default;
  const up = opts.up ?? [0, 1, 0], [lo, hi] = opts.box ?? bbox(m.pos);
  const n = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l); };
  const f = n(d), r = n([f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]]), u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const c = [0, 1, 2].map(i => (lo[i] + hi[i]) / 2), ext = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 0.52, s = Math.min(W, H) / (2 * ext);
  const L = n(opts.light ?? [-f[0] + 0.5 * u[0] - 0.4 * r[0], -f[1] + 0.5 * u[1] - 0.4 * r[1], -f[2] + 0.5 * u[2] - 0.4 * r[2]]);
  const zb = new Float32Array(W * H).fill(Infinity), img = new Uint8Array(W * H * 3).fill(30);
  const P = m.pos, I = m.idx, sx = new Float32Array(P.length / 3), sy = new Float32Array(P.length / 3), sz = new Float32Array(P.length / 3);
  for (let v = 0; v < P.length / 3; v++) {
    const x = P[v * 3] - c[0], y = P[v * 3 + 1] - c[1], z = P[v * 3 + 2] - c[2];
    sx[v] = W / 2 + (x * r[0] + y * r[1] + z * r[2]) * s; sy[v] = H / 2 - (x * u[0] + y * u[1] + z * u[2]) * s; sz[v] = x * f[0] + y * f[1] + z * f[2];
  }
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], cc = I[t + 2];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[cc * 3] - P[a * 3], vy = P[cc * 3 + 1] - P[a * 3 + 1], vz = P[cc * 3 + 2] - P[a * 3 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (nx * f[0] + ny * f[1] + nz * f[2] > 0) { nx = -nx; ny = -ny; nz = -nz; } // two-sided
    const sh = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]) * 0.8 + 0.18, col = Math.min(255, sh * 230);
    const x0 = Math.max(0, Math.floor(Math.min(sx[a], sx[b], sx[cc]))), x1 = Math.min(W - 1, Math.ceil(Math.max(sx[a], sx[b], sx[cc])));
    const y0 = Math.max(0, Math.floor(Math.min(sy[a], sy[b], sy[cc]))), y1 = Math.min(H - 1, Math.ceil(Math.max(sy[a], sy[b], sy[cc])));
    const d0 = (sx[b] - sx[a]) * (sy[cc] - sy[a]) - (sx[cc] - sx[a]) * (sy[b] - sy[a]); if (Math.abs(d0) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w1 = ((sx[cc] - px) * (sy[a] - py) - (sx[a] - px) * (sy[cc] - py)) / d0, w2 = ((sx[a] - px) * (sy[b] - py) - (sx[b] - px) * (sy[a] - py)) / d0, w0 = 1 - w1 - w2;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * sz[a] + w1 * sz[b] + w2 * sz[cc], k = y * W + x;
      if (z < zb[k]) { zb[k] = z; img[k * 3] = col; img[k * 3 + 1] = col * 0.95; img[k * 3 + 2] = col * 0.88; }
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  await sharp(Buffer.from(img), { raw: { width: W, height: H, channels: 3 } }).png().toFile(path);
}
export const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
export { writeFileSync };
