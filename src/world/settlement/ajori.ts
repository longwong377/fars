// Tol-e Ajori gate (Bagh-e Firuzi), 467 BCE: standing, 50-70 years old, unrepaired (C; Q-051).
// Plan (TOLAJORI2017 abstract via search extract, B): rectangle 39.07 m (NW-SE) x 29.05 m (NE-SW), long axis WNW-ESE
// "with a 20° shift to N from the E-W axis"; a massive wall 10.47 m thick encloses an inner room 8.00 x 14.36 m with low
// benches along its walls, reached by two corridors on the NW and SE short sides (so the passage runs along the long
// axis). Materials (AJORI-BRICK2018, B): mud brick with baked and glazed brick. Decoration (WP-ISHTAR and TOLAJORI2017
// search extracts, B): glazed relief bricks with the aurochs and the mušḫuššu copied from the Babylonian panels, on an
// originally blue ground. C: height 12 m (press), corridor width 4.2 m and height 7.5 m, room height 9 m, flat roofs,
// stepped crenellations, bench size, the rows' number and placement, the figures' drawing (from the type, not traced
// from the fragments) and the glaze colours.
import * as THREE from 'three/webgpu';
import { texture, uv, attribute, vec3, float } from 'three/tsl';
import { surfaceMaterial } from '../../render/materials';
import { Batch, lin, RGB } from './geom';
import { AJORI } from './plan';
import type { P2 } from './site';
import { toGrid } from './site';

const TIER_NOTE = 'Tol-e Ajori gate: plan and size B (TOLAJORI2017, search extract: 39.07 x 29.05 m, 10.47 m walls round an 8.00 x 14.36 m room with benches, corridors on the short sides); baked-brick facing over mud brick B (AJORI-BRICK2018); height 12 m C (press); corridor size, roofs, crenellations C; standing and unrepaired in 467 C (Q-051)';
const PANEL_NOTE = 'glazed relief panels: aurochs and mušḫuššu copied from Babylon on a blue ground (motifs B: TOLAJORI2017, WP-ISHTAR search extracts); figures drawn from the type (not traced), rows and colours C; glaze weathered (C)';

/** silhouettes on a 512 x 256 tile, animal facing +x (right) */
function bull(c: CanvasRenderingContext2D) {
  c.beginPath(); c.moveTo(120, 118); c.bezierCurveTo(130, 80, 220, 72, 300, 78); c.bezierCurveTo(330, 70, 360, 64, 392, 70); // back to neck
  c.bezierCurveTo(410, 62, 432, 66, 446, 84); c.lineTo(462, 116); c.bezierCurveTo(466, 128, 452, 134, 440, 128); // head, muzzle
  c.bezierCurveTo(424, 136, 404, 138, 388, 150); c.bezierCurveTo(372, 160, 362, 166, 356, 172); // dewlap, chest
  c.lineTo(360, 226); c.lineTo(346, 226); c.lineTo(338, 176); c.lineTo(326, 226); c.lineTo(312, 226); c.lineTo(314, 170); // forelegs
  c.bezierCurveTo(270, 172, 220, 172, 190, 166); c.lineTo(196, 226); c.lineTo(182, 226); c.lineTo(168, 172); c.lineTo(156, 226); c.lineTo(142, 226); c.lineTo(140, 160); // belly, hind legs
  c.bezierCurveTo(126, 150, 118, 136, 120, 118); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(122, 110); c.bezierCurveTo(104, 130, 100, 170, 108, 196); c.lineTo(116, 196); c.bezierCurveTo(110, 170, 114, 136, 128, 118); c.fill(); // tail
  c.beginPath(); c.moveTo(418, 72); c.bezierCurveTo(430, 50, 452, 36, 472, 34); c.bezierCurveTo(456, 44, 440, 58, 430, 76); c.fill(); // horn
}
function dragon(c: CanvasRenderingContext2D) {
  c.beginPath(); c.moveTo(140, 142); c.bezierCurveTo(200, 128, 290, 128, 340, 132); c.bezierCurveTo(360, 118, 372, 96, 380, 72); // body, neck
  c.bezierCurveTo(390, 58, 412, 54, 428, 60); c.lineTo(466, 70); c.lineTo(430, 78); c.bezierCurveTo(418, 84, 404, 92, 398, 108); // head, snout
  c.bezierCurveTo(392, 128, 380, 146, 364, 156); c.lineTo(372, 226); c.lineTo(356, 226); c.lineTo(350, 166); c.lineTo(338, 226); c.lineTo(322, 226); c.lineTo(324, 160); // lion forelegs
  c.bezierCurveTo(270, 164, 220, 166, 190, 162); c.lineTo(198, 214); c.lineTo(214, 226); c.lineTo(180, 226); c.lineTo(172, 166); c.lineTo(164, 214); c.lineTo(176, 226); c.lineTo(146, 226); c.lineTo(150, 160); // eagle hind legs
  c.bezierCurveTo(132, 158, 126, 150, 140, 142); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(142, 146); c.bezierCurveTo(100, 140, 88, 100, 100, 64); c.bezierCurveTo(104, 52, 118, 50, 118, 62); c.bezierCurveTo(108, 92, 118, 128, 150, 136); c.fill(); // tail with sting
  c.beginPath(); c.moveTo(100, 64); c.lineTo(114, 44); c.lineTo(112, 64); c.fill();
  c.beginPath(); c.moveTo(404, 58); c.bezierCurveTo(404, 36, 420, 24, 436, 22); c.bezierCurveTo(424, 34, 416, 46, 414, 60); c.fill(); // horn
}
/** colour + normal textures of the two friezes (top half mušḫuššu, bottom half aurochs); null outside a browser */
function friezeTextures(): { map: THREE.Texture; normal: THREE.Texture } | null {
  if (typeof document === 'undefined') return null;
  const W = 512, H = 512;
  const col = document.createElement('canvas'); col.width = W; col.height = H; const c = col.getContext('2d')!;
  const hgt = document.createElement('canvas'); hgt.width = W; hgt.height = H; const h = hgt.getContext('2d')!;
  // blue glazed ground with brick joints (courses ~1/12 of a row)
  c.fillStyle = 'rgb(38,82,150)'; c.fillRect(0, 0, W, H);
  h.fillStyle = 'rgb(40,40,40)'; h.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(20,40,70,0.55)'; c.lineWidth = 2; h.strokeStyle = 'rgb(20,20,20)'; h.lineWidth = 2;
  for (let y = 0; y <= H; y += 21.33) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); h.beginPath(); h.moveTo(0, y); h.lineTo(W, y); h.stroke();
    for (let x = (Math.round(y / 21.33) % 2) * 32; x < W; x += 64) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 21.33); c.stroke(); h.beginPath(); h.moveTo(x, y); h.lineTo(x, y + 21.33); h.stroke(); } }
  // figures: dragon (white, yellow details) in the top half, aurochs (yellow, blue-green details) in the bottom half
  const draw = (ctx: CanvasRenderingContext2D, fill: string, dy: number, f: (c: CanvasRenderingContext2D) => void, outline?: string) => {
    ctx.save(); ctx.translate(0, dy); ctx.fillStyle = fill; if (outline) { ctx.shadowColor = outline; ctx.shadowBlur = 0; } f(ctx); ctx.restore(); };
  draw(c, 'rgb(96,76,44)', 2, dragon); draw(c, 'rgb(226,222,204)', 0, dragon);
  draw(c, 'rgb(96,70,34)', 258, bull); draw(c, 'rgb(214,166,72)', 256, bull);
  // details: dragon scales dots, bull hair tufts
  c.fillStyle = 'rgba(200,160,70,0.8)'; for (let x = 170; x < 340; x += 14) for (let y = 138; y < 158; y += 9) { c.beginPath(); c.arc(x + (y % 2) * 7, y, 2.2, 0, 6.28); c.fill(); }
  c.fillStyle = 'rgba(70,130,120,0.9)'; for (let x = 170; x < 330; x += 18) { c.beginPath(); c.arc(x, 256 + 170, 4, 0, 6.28); c.fill(); }
  h.filter = 'blur(3px)'; draw(h, 'rgb(230,230,230)', 0, dragon); draw(h, 'rgb(230,230,230)', 256, bull); h.filter = 'none';
  // normal map from the height canvas (Sobel)
  const img = h.getImageData(0, 0, W, H).data, nimg = h.createImageData(W, H), k = 3.0 / 255;
  const at = (x: number, y: number) => img[(((y + H) % H) * W + ((x + W) % W)) * 4];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k, L = Math.hypot(dx, dy, 1), o = (y * W + x) * 4;
    nimg.data[o] = (-dx / L * 0.5 + 0.5) * 255; nimg.data[o + 1] = (dy / L * 0.5 + 0.5) * 255; nimg.data[o + 2] = (1 / L * 0.5 + 0.5) * 255; nimg.data[o + 3] = 255; }
  const ncv = document.createElement('canvas'); ncv.width = W; ncv.height = H; ncv.getContext('2d')!.putImageData(nimg, 0, 0);
  const map = new THREE.CanvasTexture(col); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = THREE.RepeatWrapping; map.anisotropy = 4;
  const normal = new THREE.CanvasTexture(ncv); normal.wrapS = THREE.RepeatWrapping;
  return { map, normal };
}

export function buildAjori(g: { c: P2; theta: number }, H: (e: number, n: number) => number) {
  const group = new THREE.Group(); group.name = 'settlement:tol_ajori';
  const f = { c: g.c, theta: g.theta }, A = AJORI;
  const L = A.long / 2, W = A.short / 2, rw = A.room[1] / 2, rl = A.room[0] / 2, cw = A.corridorW / 2, top = A.height;
  // base: the lowest ground under the footprint (the gate stands on a levelled platform, C)
  const corners = [[-L, -W], [L, -W], [L, W], [-L, W]].map(([u, v]) => toGrid(f, u, v)); const y0 = Math.min(...corners.map(p => H(p[0], p[1])));
  const brick = new Batch(), colliders: { x: number; y: number; z: number; hx: number; hy: number; hz: number; rot: number }[] = [];
  const cB: RGB = lin([0.62, 0.5, 0.36]);
  const box = (u0: number, u1: number, v0: number, v1: number, ya: number, yb: number, collide = true, c: RGB = cB) => {
    const cc = toGrid(f, (u0 + u1) / 2, (v0 + v1) / 2); brick.box(cc[0], cc[1], f.theta, (u1 - u0) / 2, (v1 - v0) / 2, y0 + ya, y0 + yb, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8], c, 0);
    if (collide) colliders.push({ x: cc[0], y: y0 + (ya + yb) / 2, z: -cc[1], hx: (u1 - u0) / 2, hy: (yb - ya) / 2, hz: (v1 - v0) / 2, rot: f.theta });
  };
  box(-L, L, rw, W, -0.6, top); box(-L, L, -W, -rw, -0.6, top); // the two long wall masses (NE, SW)
  for (const s of [-1, 1]) { box(s > 0 ? rl : -L, s > 0 ? L : -rl, cw, rw, -0.6, top); box(s > 0 ? rl : -L, s > 0 ? L : -rl, -rw, -cw, -0.6, top); // end walls beside the corridors
    box(s > 0 ? rl : -L, s > 0 ? L : -rl, -cw, cw, 7.5, top, false); } // over the corridors
  box(-rl, rl, -rw, rw, 9.0, top, false); // roof mass over the room
  // benches along the room walls (B existence; 0.45 x 0.6 m C)
  const bc: RGB = lin([0.58, 0.48, 0.36]);
  box(-rl, rl, rw - 0.6, rw, 0, 0.45, true, bc); box(-rl, rl, -rw, -rw + 0.6, 0, 0.45, true, bc);
  for (const s of [-1, 1]) { box(s * rl - (s > 0 ? 0.6 : 0), s * rl + (s < 0 ? 0.6 : 0), cw, rw - 0.6, 0, 0.45, true, bc); box(s * rl - (s > 0 ? 0.6 : 0), s * rl + (s < 0 ? 0.6 : 0), -rw + 0.6, -cw, 0, 0.45, true, bc); }
  // stepped crenellations along the top (C)
  for (let u = -L + 0.6; u < L - 0.5; u += 2.2) for (const s of [-1, 1]) { box(u, u + 1.1, s * W - (s > 0 ? 0.9 : 0), s * W + (s < 0 ? 0.9 : 0), top, top + 0.7, false); box(u + 0.25, u + 0.85, s * W - (s > 0 ? 0.9 : 0), s * W + (s < 0 ? 0.9 : 0), top + 0.7, top + 1.2, false); }
  for (let v = -W + 2.8; v < W - 2.2; v += 2.2) for (const s of [-1, 1]) { if (Math.abs(v) < cw + 1) continue; box(s * L - (s > 0 ? 0.9 : 0), s * L + (s < 0 ? 0.9 : 0), v, v + 1.1, top, top + 0.7, false); box(s * L - (s > 0 ? 0.9 : 0), s * L + (s < 0 ? 0.9 : 0), v + 0.25, v + 0.85, top + 0.7, top + 1.2, false); }
  const bg = brick.toGeometry(); const bm = new THREE.Mesh(bg, surfaceMaterial('baked_brick')); bm.name = 'settlement:tol_ajori:body'; bm.castShadow = bm.receiveShadow = true; bm.matrixAutoUpdate = false;
  bm.userData = { tier: 'B/C', src: 'TOLAJORI2017;AJORI-BRICK2018;AJORI2013', note: TIER_NOTE }; group.add(bm);
  // glazed panels: quads 4 cm proud of the façades (short sides, flanking the corridor mouths) and along the corridor
  // walls; uv.x repeats every 2.2 m (one animal), uv.y 0-0.5 dragon, 0.5-1 aurochs; animals face the passage
  const pos: number[] = [], nor: number[] = [], uvs: number[] = [], col: number[] = [], idx: number[] = [];
  const wv = (u: number, v: number, y: number) => { const p = toGrid(f, u, v); return [p[0], y0 + y, -p[1]]; };
  const quad = (a: number[], b: number[], cc: number[], d: number[], n: number[], u0: number, u1: number, v0: number, v1: number, fade: number) => {
    const o = pos.length / 3; for (const p of [a, b, cc, d]) pos.push(...p); for (let i = 0; i < 4; i++) { nor.push(...n); col.push(fade, fade, fade); }
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v1); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  const nW = (u: number, v: number) => { const a = toGrid(f, 0, 0), b = toGrid(f, u, v); return [b[0] - a[0], 0, -(b[1] - a[1])]; };
  let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const rows: [number, number, number][] = [[1.4, 2.5, 0], [3.3, 4.4, 0.5], [5.2, 6.3, 0]]; // y0, y1, atlas row (0 aurochs? see uv) — alternate
  for (const s of [-1, 1]) { // façades at u = ±L; the face normal points outward along ±u
    const n = nW(s, 0); const uf = s * (L + 0.04);
    for (const side of [-1, 1]) { const va = side * (cw + 0.5), vb = side * (W - 1.0);
      for (const [ya, yb, row] of rows) { const len = Math.abs(vb - va), reps = len / 2.2, flip = side * s > 0;
        const a = wv(uf, va, ya), b = wv(uf, vb, ya), c2 = wv(uf, vb, yb), d = wv(uf, va, yb); const fade = 0.72 + 0.28 * rnd();
        const [u0, u1] = flip ? [reps, 0] : [0, reps]; quad(a, b, c2, d, n, u0, u1, row + 0.5 - 0.5, row + 0.5 - 0.5 + 0.5, fade); } } }
  for (const s of [-1, 1]) for (const side of [-1, 1]) { // corridor walls, two rows each
    const n = nW(0, -side); const vf = side * (cw - 0.04), ua = s * rl, ub = s * (L - 0.5);
    for (const [ya, yb, row] of [[1.4, 2.5, 0.5], [3.3, 4.4, 0]] as [number, number, number][]) { const reps = Math.abs(ub - ua) / 2.2, flip = s > 0;
      const a = wv(ua, vf, ya), b = wv(ub, vf, ya), c2 = wv(ub, vf, yb), d = wv(ua, vf, yb); const fade = 0.72 + 0.28 * rnd();
      const [u0, u1] = flip ? [0, reps] : [reps, 0]; quad(a, b, c2, d, n, u0, u1, row, row + 0.5, fade); } }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  pg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); pg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); pg.setIndex(idx); pg.computeBoundingSphere();
  const tex = friezeTextures();
  const pm = new THREE.MeshStandardNodeMaterial({ roughness: 0.3, metalness: 0, side: THREE.DoubleSide });
  if (tex) { pm.colorNode = texture(tex.map, uv()).rgb.mul(attribute('color', 'vec3')); pm.normalMap = tex.normal; }
  else pm.colorNode = vec3(0.12, 0.28, 0.55).mul(float(1));
  const panels = new THREE.Mesh(pg, pm); panels.name = 'settlement:tol_ajori:glaze'; panels.receiveShadow = true; panels.matrixAutoUpdate = false;
  panels.userData = { tier: 'B/C', src: 'TOLAJORI2017;WP-ISHTAR', note: PANEL_NOTE }; group.add(panels);
  return { group, tris: bg.index!.count / 3 + idx.length / 3, meshes: 2, colliders };
}
