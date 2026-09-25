// dev (D-226): false self-shadows on a relief's DRAWN surface. The sun's march starts at the fragment, which lies on the
// figure's LOD mesh, not on the field: at L2 the RTIN error bound is 0.12 of the depth (7 mm on a 6 cm panel), so a mesh
// point can lie well under the atlas's surface and the march finds the carving "above" it (the first render's dark blotches
// over the lion-and-bull). Here: the LOD mesh rasterised on a 3 mm lattice (its heights and normals as the GPU interpolates
// them), the atlas march from those points (reliefShadowAt), against the exact march of the L0 field from the true surface.
//   npx tsx tools/dev/relief_shadow_lod.ts [kind] [lod]
import { planReliefShadow, stampField, reliefShadowAt } from '../../src/arch/relief_shadow';
import { rasterize } from '../../src/arch/relief_field';
import { figureDef, defBounds } from '../../src/arch/relief_figures';
import { reliefLodMesh, lodGrid } from '../../src/arch/reliefs';
export function lodFalseShadow(kind: string, S: number, depth: number, lod: number, L: [number, number, number]) {
  const b = defBounds(figureDef(kind, 0)), ext = Math.max(b[2] - b[0], b[3] - b[1]) * S, m = reliefLodMesh(kind, 0, lodGrid(ext, lod), lod);
  const D = planReliefShadow([{ kind, seed: 0, o: [0, 0, 0], X: [1, 0], Z: [0, 1], S, D: depth, mirror: false, embed: 0.001 }]);
  for (const [k, j] of [...D.jobs]) stampField(D, k, rasterize(figureDef(j.kind, j.seed), j.n, true));
  const f = rasterize(figureDef(kind, 0), 1025, false);
  const hx = (x: number, y: number) => { const gi = Math.round((x / S - f.x0) / f.cell), gj = Math.round((y / S - f.y0) / f.cell); return gi < 0 || gj < 0 || gi >= f.n || gj >= f.n ? 0 : Math.max(0, f.h[gj * f.n + gi] * depth - 0.001); };
  const lit = (x: number, y: number, z0: number) => { for (let t = 0.001; t < 0.6; t += 0.001) { const z = z0 + L[2] * t; if (z > depth) return 1; if (hx(x + L[0] * t, y + L[1] * t) > z + 0.0002) return 0; } return 1; };
  // rasterise the mesh on a 3 mm lattice (figure frame, metres)
  const step = 0.003, x0 = b[0] * S, y0 = b[1] * S, W = Math.ceil(((b[2] - b[0]) * S) / step), H = Math.ceil(((b[3] - b[1]) * S) / step);
  const zb = new Float32Array(W * H).fill(-1), nz = new Float32Array(W * H * 3);
  for (let t = 0; t < m.index.length; t += 3) {
    const q = [m.index[t], m.index[t + 1], m.index[t + 2]], X = q.map(k => (m.pos[k * 3] * S - x0) / step), Y = q.map(k => (m.pos[k * 3 + 1] * S - y0) / step);
    const den = (Y[1] - Y[2]) * (X[0] - X[2]) + (X[2] - X[1]) * (Y[0] - Y[2]); if (Math.abs(den) < 1e-12) continue;
    for (let j = Math.max(0, Math.ceil(Math.min(...Y))); j <= Math.min(H - 1, Math.floor(Math.max(...Y))); j++) for (let i = Math.max(0, Math.ceil(Math.min(...X))); i <= Math.min(W - 1, Math.floor(Math.max(...X))); i++) {
      const w1 = ((Y[1] - Y[2]) * (i - X[2]) + (X[2] - X[1]) * (j - Y[2])) / den, w2 = ((Y[2] - Y[0]) * (i - X[2]) + (X[0] - X[2]) * (j - Y[2])) / den, w3 = 1 - w1 - w2;
      if (w1 < -1e-7 || w2 < -1e-7 || w3 < -1e-7) continue;
      const z = (w1 * m.pos[q[0] * 3 + 2] + w2 * m.pos[q[1] * 3 + 2] + w3 * m.pos[q[2] * 3 + 2]) * depth - 0.001, g = j * W + i; if (z <= zb[g]) continue; zb[g] = z;
      const gx = w1 * m.grad[q[0] * 2] + w2 * m.grad[q[1] * 2] + w3 * m.grad[q[2] * 2], gy = w1 * m.grad[q[0] * 2 + 1] + w2 * m.grad[q[1] * 2 + 1] + w3 * m.grad[q[2] * 2 + 1];
      nz[g * 3] = (-gx * depth) / S; nz[g * 3 + 1] = (-gy * depth) / S; nz[g * 3 + 2] = 1;
    }
  }
  let on = 0, falseSh = 0, missed = 0, exSh = 0;
  for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) { const g = j * W + i; if (zb[g] <= 0.002) continue;
    const nl = (nz[g * 3] * L[0] + nz[g * 3 + 1] * L[1] + L[2]) / Math.hypot(nz[g * 3], nz[g * 3 + 1], 1); if (nl < 0.1) continue;
    const x = x0 + (i + 0.5) * step, y = y0 + (j + 0.5) * step, a = reliefShadowAt(D, [x, y, zb[g]], L) < 0.5, e = !lit(x, y, Math.max(zb[g], hx(x, y))); on++;
    if (e) exSh++; if (a && !e) falseSh++; if (!a && e) missed++; }
  return { on, falseSh: falseSh / on, missed: missed / on, exSh: exSh / on };
}
if (process.argv[1]?.includes('relief_shadow_lod')) {
  const kind = process.argv[2] ?? 'lion_bull', lods = process.argv[3] ? [+process.argv[3]] : [0, 1, 2, 3, 4];
  const e = (22 * Math.PI) / 180, ph = (70 * Math.PI) / 180, L: [number, number, number] = [-Math.cos(e) * Math.cos(ph), Math.cos(e) * Math.sin(ph), Math.sin(e)];
  for (const lod of lods) { const r = lodFalseShadow(kind, kind === 'lion_bull' ? 2 : 0.741, kind === 'lion_bull' ? 0.06 : 0.045, lod, L);
    console.log(`${kind} L${lod}, sun 22° off the wall: sunward mesh points ${r.on}; exact shadow ${(100 * r.exSh).toFixed(1)} %; atlas falsely shaded ${(100 * r.falseSh).toFixed(2)} %, missed ${(100 * r.missed).toFixed(2)} %`); }
}
