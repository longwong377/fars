// D-232: a node-side preview of the retaining wall's joint layout on the Apadana salient's W face (grid e = -61.45, the face
// photo #24 sees best), before (D-218 HAIRLINE coursing) and after (masonry.ts retainingAt, the CPU mirror of the shader's
// retainingCells): the per-block tone (1σ 13 %, triangular, as blockToneFactor) and the joints drawn 1 px dark (a layout
// diagram at 5 cm per pixel, not a render). Writes shots/masonry_preview_{before,after}.f32 (RGB float32, W x H) for
// tools/dev/masonry_compare_d232.py, which sets them under the rectified photograph.
// Run: npx tsx tools/dev/masonry_preview_d232.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { retainingAt, hash12, courseTexels } from '../../src/render/masonry';
import { mxNoise3 } from '../../tests/lib/mx_noise_cpu';

const RES = 0.05, S0 = 0, S1 = 115, Z0 = -11.8, Z1 = 0.65, W = Math.round((S1 - S0) / RES), H = Math.round((Z1 - Z0) / RES);
const E = -61.45, N0 = 59.71; // face A: outward normal -x (world), t = world z = s - 59.71
const tone = (blk: number, c: number) => 1 + (hash12(blk + 0.37, c + 11.3) + hash12(blk * 0.71 + 19.1, c + 3.3) - 1) * 0.13 * Math.sqrt(6);
/** the D-157/D-218 varied coursing (materials.ts ashlarCells with HAIRLINE) */
function hairline(t: number, y: number) {
  const Hh = 2.1, k = Math.floor(y / Hh), f = y - k * Hh, split = hash12(k, 7.13) * 0.5 + 0.8, c = 2 * k + (f >= split ? 1 : 0);
  const L = 2.3, u = (t - hash12(c, 3.71) * L) / L, j0 = Math.floor(u);
  const u0 = j0 + (hash12(c, j0) - 0.5) * 0.5, u1 = j0 + 1 + (hash12(c, j0 + 1) - 0.5) * 0.5;
  const blk = j0 - 1 + (u >= u0 ? 1 : 0) + (u >= u1 ? 1 : 0);
  const dBed = Math.min(f - (f >= split ? split : 0), (f >= split ? Hh : split) - f), dHead = Math.min(Math.abs(u - u0), Math.abs(u - u1)) * L;
  return { blk, c, d: Math.min(dBed, dHead) };
}
mkdirSync('shots', { recursive: true });
const tex = courseTexels();
for (const which of ['before', 'after'] as const) {
  const out = new Float32Array(W * H * 3);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const s = S0 + (i + 0.5) * RES, y = Z1 - (j + 0.5) * RES, n = N0 - s, x = E, z = -n, t = z;
    let k = 1, d = 1;
    if (which === 'before') { const r = hairline(t, y); k = tone(r.blk, r.c); d = r.d; }
    else {
      const r = retainingAt(t, x, y, z, -1, 0, mxNoise3, tex); d = r.dJoint;
      const m = /^f(-?[\d.]+),(-?[\d.]+)$/.exec(r.key); const [c, b] = m ? [+m[2] + 7000, +m[1]] : r.key.split(',').map(Number);
      k = tone(b, c) * (r.inFoot ? 0.97 : 1);
    }
    const v = 0.42 * k * (d < RES * 0.6 ? 0.45 : 1), o = (j * W + i) * 3; out[o] = v * 1.02; out[o + 1] = v; out[o + 2] = v * 0.96;
  }
  writeFileSync(`shots/masonry_preview_${which}.f32`, Buffer.from(out.buffer));
}
console.log(`wrote shots/masonry_preview_{before,after}.f32 (${W} x ${H})`);
