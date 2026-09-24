// How many of the people drawn can actually be seen (D-143). Counting the people inside the view frustum overstates a
// crowd in a town of walled courts and roofed rooms, and on a Terrace of walls and columns: this counts, of the people
// the crowd drew in the last frame (skinned bodies and impostors), those whose chest or head is in front of the world,
// tested against the depth of the same frame rendered without the people (the same scene, camera and geometry the
// player sees; the sky counts as far). It is the number the rendered floor (≥ 300 people visible in the busiest scenes)
// is measured with. Tests and dev tools only (an extra scene render and a GPU readback).
import * as THREE from 'three/webgpu';
import { texture, vec4 } from 'three/tsl';
import type { Crowd } from './crowd';

/** distance bands (m) of the counts */
export const VIS_BANDS = [50, 200, 600, 1500, 5000] as const;
export interface VisibleCount {
  /** people drawn in the last frame; of them in the view frustum; of those not hidden by the world */
  drawn: number; inFrustum: number; visible: number;
  /** visible by kind: skinned per LOD (full, mid, far, farthest), impostors */
  skinned: number[]; impostors: number;
  /** visible per distance band (VIS_BANDS), and in the frustum per band */
  bands: number[]; frustumBands: number[];
  /** the depth readback's row order (true: row 0 is the bottom), the probe's own cost */
  flip: boolean; ms: number; note: string;
}

/** people visible in the last frame (the crowd remembers its camera); W × H must keep the canvas's aspect, W × 16 a
 *  multiple of 256 (WebGPU row alignment of the float readback) */
export async function countVisible(renderer: THREE.WebGPURenderer, crowd: Crowd, W = 960, H = 540): Promise<VisibleCount> {
  const t0 = performance.now(), camera = crowd.lastCamera as THREE.PerspectiveCamera | null;
  const res: VisibleCount = { drawn: 0, inFrustum: 0, visible: 0, skinned: [0, 0, 0, 0], impostors: 0, bands: VIS_BANDS.map(() => 0), frustumBands: VIS_BANDS.map(() => 0), flip: false, ms: 0, note: '' };
  if (!camera) { res.note = 'no frame drawn yet'; return res; }
  if (renderer.logarithmicDepthBuffer) { res.note = 'logarithmic depth (WebGL2 fallback): not supported by this probe'; return res; }
  let scene: THREE.Object3D = crowd.group; while (scene.parent) scene = scene.parent;
  const pts = crowd.drawnPoints(); res.drawn = pts.length / 5;
  const rt = new THREE.RenderTarget(W, H); rt.depthTexture = new THREE.DepthTexture(W, H); rt.depthTexture.type = THREE.FloatType;
  const out = new THREE.RenderTarget(W, H, { type: THREE.FloatType, depthBuffer: false });
  const mat = new THREE.MeshBasicNodeMaterial(); mat.colorNode = vec4(texture(rt.depthTexture).r, 0, 0, 1); const quad = new THREE.QuadMesh(mat);
  const shown = crowd.group.visible, prev = renderer.getRenderTarget(), tm = renderer.toneMapping;
  let px: Float32Array;
  try {
    crowd.group.visible = false;
    renderer.setRenderTarget(rt); renderer.render(scene as THREE.Scene, camera);
    renderer.toneMapping = THREE.NoToneMapping; renderer.setRenderTarget(out); quad.render(renderer);
    renderer.setRenderTarget(prev);
    px = await renderer.readRenderTargetPixelsAsync(out, 0, 0, W, H) as Float32Array;
  } finally { renderer.setRenderTarget(prev); renderer.toneMapping = tm; crowd.group.visible = shown; }
  rt.dispose(); out.dispose(); mat.dispose();
  const stride = px.length / (W * H); // 4 floats a texel
  // scene distance along the view axis at a texel (the clear value, reversed-Z 0, is the sky: infinitely far)
  const u = new THREE.Vector3(), clear = (renderer as any).reversedDepthBuffer ? 0 : 1;
  const depthAt = (col: number, row: number, nx: number, ny: number) => { const d = px[(row * W + col) * stride];
    if (d === clear || !Number.isFinite(d)) return Infinity; u.set(nx, ny, d).applyMatrix4(camera.projectionMatrixInverse); return -u.z; };
  // row order: the sky is at the top of the image (every scene measured looks near the horizon)
  const farRows = (r0: number, r1: number) => { let f = 0; for (let r = r0; r < r1; r++) for (let c = 0; c < W; c += 8) if (px[(r * W + c) * stride] === clear) f++; return f; };
  res.flip = farRows(H - Math.ceil(H / 20), H) > farRows(0, Math.ceil(H / 20));
  const v = new THREE.Vector3(), w4 = new THREE.Vector4(), near = camera.near, far = camera.far;
  for (let i = 0; i < pts.length; i += 5) {
    const x = pts[i], y = pts[i + 1], z = pts[i + 2], h = pts[i + 3], kind = pts[i + 4];
    let inF = false, seen = false, dist = 0;
    for (const f of [0.72, 0.93]) { // chest, head
      v.set(x, y + f * h, z).applyMatrix4(camera.matrixWorldInverse); const vd = -v.z; if (vd < near || vd > far) continue;
      w4.set(v.x, v.y, v.z, 1).applyMatrix4(camera.projectionMatrix); const nx = w4.x / w4.w, ny = w4.y / w4.w;
      if (nx < -1 || nx >= 1 || ny < -1 || ny >= 1) continue;
      inF = true; dist = Math.hypot(v.x, v.y, v.z);
      const col = Math.min(W - 1, Math.floor((nx + 1) / 2 * W)), row = Math.min(H - 1, Math.floor((res.flip ? ny + 1 : 1 - ny) / 2 * H));
      if (vd < depthAt(col, row, nx, ny) - (0.05 + 0.002 * vd)) { seen = true; break; }
    }
    if (!inF) continue;
    const b = VIS_BANDS.findIndex(r => dist < r), bi = b < 0 ? VIS_BANDS.length - 1 : b;
    res.inFrustum++; res.frustumBands[bi]++;
    if (!seen) continue;
    res.visible++; res.bands[bi]++; if (kind < 4) res.skinned[kind]++; else res.impostors++;
  }
  res.ms = performance.now() - t0; return res;
}
