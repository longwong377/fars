// Small software rasteriser for the human asset build: UV-space texture baking and orthographic preview renders
// (verification images for the build log; screenshots find problems, measurements prove them, §3.4).

/** call fn(x, y, b0, b1, b2) for each pixel centre inside the triangle (screen coords in pixels) */
export function rasterTri(w: number, h: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, fn: (x: number, y: number, b0: number, b1: number, b2: number) => void, pad = 0) {
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - pad)), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - pad)), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy) + pad));
  const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay); if (Math.abs(d) < 1e-12) return;
  const eps = pad > 0 ? pad / Math.sqrt(Math.abs(d)) : 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const b1 = ((px - ax) * (cy - ay) - (cx - ax) * (py - ay)) / d, b2 = ((bx - ax) * (py - ay) - (px - ax) * (by - ay)) / d, b0 = 1 - b1 - b2;
    if (b0 >= -eps && b1 >= -eps && b2 >= -eps) fn(x, y, b0, b1, b2);
  }
}

export interface PreviewMesh { pos: ArrayLike<number>; index: ArrayLike<number>; color: (tri: number) => [number, number, number]; uv?: ArrayLike<number>; tex?: { w: number; h: number; data: Uint8Array }; texTri?: (tri: number) => boolean }
/** orthographic preview: view 'front' (looking −Z), 'side' (looking −X), 'back'; returns RGBA */
export function preview(meshes: PreviewMesh[], view: 'front' | 'side' | 'back' | 'face', W: number, H: number, box: { cx: number; cy: number; half: number }) {
  const img = new Uint8Array(W * H * 4).fill(255), zb = new Float32Array(W * H).fill(-1e9);
  const proj = (x: number, y: number, z: number): [number, number, number] => {
    const [u, depth] = view === 'side' ? [-z, x] : view === 'back' ? [-x, -z] : [x, z];
    return [(u - box.cx) / box.half * (W / 2) + W / 2, H / 2 - (y - box.cy) / box.half * (W / 2), depth];
  };
  const L = view === 'side' ? [0.6, 0.5, 0.62] : [0.35, 0.55, 0.75]; const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  for (const m of meshes) {
    const P = m.pos, I = m.index;
    for (let t = 0; t < I.length / 3; t++) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const lam = 0.25 + 0.75 * Math.abs(nx * L[0] + ny * L[1] + nz * L[2]);
      const col = m.color(t); const useTex = m.tex && m.uv && (!m.texTri || m.texTri(t));
      const A = proj(P[a], P[a + 1], P[a + 2]), B = proj(P[b], P[b + 1], P[b + 2]), C = proj(P[c], P[c + 1], P[c + 2]);
      rasterTri(W, H, A[0], A[1], B[0], B[1], C[0], C[1], (x, y, b0, b1, b2) => {
        const z = b0 * A[2] + b1 * B[2] + b2 * C[2], k = y * W + x; if (z <= zb[k]) return; zb[k] = z;
        let c = col;
        if (useTex) { const U = m.uv!, T = m.tex!, ia = I[t * 3], ib = I[t * 3 + 1], ic = I[t * 3 + 2];
          const u = b0 * U[ia * 2] + b1 * U[ib * 2] + b2 * U[ic * 2], v = b0 * U[ia * 2 + 1] + b1 * U[ib * 2 + 1] + b2 * U[ic * 2 + 1];
          const tx = Math.min(T.w - 1, Math.max(0, Math.floor(u * T.w))), ty = Math.min(T.h - 1, Math.max(0, Math.floor((1 - v) * T.h))), q = (ty * T.w + tx) * 4;
          c = [T.data[q], T.data[q + 1], T.data[q + 2]]; }
        img[k * 4] = Math.min(255, c[0] * lam); img[k * 4 + 1] = Math.min(255, c[1] * lam); img[k * 4 + 2] = Math.min(255, c[2] * lam);
      });
    }
  }
  return img;
}
