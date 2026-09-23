// Raking-light preview of the carved relief figures (D-019, D-151), rendered in node from a LOD mesh of the heightfield
// without a browser: Lambert + heightfield shadows from a low sun + sky, and the paint as the relief material lays it (a
// matte film of the pigment over the stone, its coverage per vertex, opacity from the film row of polychromy.json; gilding
// as gold metal lit by the sun's glint and the sky). For judging the modelling and the paint quickly; screenshots find
// problems, they never prove correctness (brief §3.4).
//   npx tsx tools/relief_preview.ts [kind[:seed] …] [--n 513] [--lod 0..3] [--sun az,alt] [--out dir] [--sheet]
//        [--crop x0,y0,x1,y1] [--px 420] [--dist m] [--bare] [--height 0.78] [--depth 0.045]
//   --crop: a window in figure units (x along the figure, y up; default the whole grid)
//   --dist: also write the figure as it covers the screen from that distance (1080 px, 70° vertical field of view), so the
//           balance of paint and carving can be judged at register distance (`_d<m>` files, shown 4× enlarged)
//   --bare: stone only (no paint), to judge the carving alone
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import PC from '../src/data/polychromy.json';
import { FIGURE_KINDS, figureDef } from '../src/arch/relief_figures';
import { rasterize, rtinErrors, extractLod, Field, LodMesh, STONE_SRGB } from '../src/arch/relief_field';
import { RELIEF_LODS } from '../src/arch/reliefs';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const flag = (k: string) => { const i = args.indexOf(k); if (i >= 0) { args.splice(i, 1); return true; } return false; };
const N = +opt('--n', '513'), LOD = +opt('--lod', '0'), OUT = opt('--out', 'shots/relief_kinds'), [SAZ, SALT] = opt('--sun', '150,22').split(',').map(Number);
const DEPTH = +opt('--depth', '0.045'), H = +opt('--height', '0.78'), PX = +opt('--px', '420'), SHEET = flag('--sheet'), CROP = opt('--crop', ''), DIST = +opt('--dist', '0'), BARE = flag('--bare');
const kinds = args.length ? args : Object.keys(FIGURE_KINDS);
mkdirSync(OUT, { recursive: true });
const FILM = (PC as any).paint.film.v;

function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let i = 0; i < w * 3; i++) raw[y * (w * 3 + 1) + 1 + i] = rgb[y * w * 3 + i]; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const s2l = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const l2s = (c: number) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)));

/** the LOD mesh rasterised back onto the field grid (barycentric): heights (m), normals, pigment (linear), coverage, gilding */
function rasteriseLod(f: Field, lod: LodMesh) {
  const n = f.n, hm = new Float32Array(n * n), nm = new Float32Array(n * n * 3), cm = new Float32Array(n * n * 3), pm = new Float32Array(n * n), gm = new Float32Array(n * n), on = new Uint8Array(n * n);
  const P = lod.pos, G = lod.grad, C = lod.col, PA = lod.paint, GI = lod.gilt, gi = (x: number) => (x - f.x0) / f.cell, gj = (y: number) => (y - f.y0) / f.cell;
  for (let t = 0; t < lod.index.length; t += 3) {
    const [a, b, c] = [lod.index[t], lod.index[t + 1], lod.index[t + 2]];
    const ax = gi(P[a * 3]), ay = gj(P[a * 3 + 1]), bx = gi(P[b * 3]), by = gj(P[b * 3 + 1]), cx = gi(P[c * 3]), cy = gj(P[c * 3 + 1]);
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-9) continue;
    for (let j = Math.floor(Math.min(ay, by, cy)); j <= Math.ceil(Math.max(ay, by, cy)); j++) for (let i = Math.floor(Math.min(ax, bx, cx)); i <= Math.ceil(Math.max(ax, bx, cx)); i++) {
      const w1 = ((by - cy) * (i - cx) + (cx - bx) * (j - cy)) / den, w2 = ((cy - ay) * (i - cx) + (ax - cx) * (j - cy)) / den, w3 = 1 - w1 - w2;
      if (w1 < -1e-6 || w2 < -1e-6 || w3 < -1e-6 || i < 0 || j < 0 || i >= n || j >= n) continue;
      const g = j * n + i; on[g] = 1; hm[g] = (w1 * P[a * 3 + 2] + w2 * P[b * 3 + 2] + w3 * P[c * 3 + 2]) * DEPTH;
      const gx = w1 * G[a * 2] + w2 * G[b * 2] + w3 * G[c * 2], gy = w1 * G[a * 2 + 1] + w2 * G[b * 2 + 1] + w3 * G[c * 2 + 1];
      nm[g * 3] = (-gx * DEPTH) / H; nm[g * 3 + 1] = (-gy * DEPTH) / H; nm[g * 3 + 2] = 1;
      for (let k = 0; k < 3; k++) cm[g * 3 + k] = w1 * C[a * 3 + k] + w2 * C[b * 3 + k] + w3 * C[c * 3 + k];
      pm[g] = w1 * PA[a] + w2 * PA[b] + w3 * PA[c]; gm[g] = GI ? w1 * GI[a] + w2 * GI[b] + w3 * GI[c] : 0;
    }
  }
  return { hm, nm, cm, pm, gm, on };
}

function render(kind: string, seed: number) {
  const def = figureDef(kind, seed); const t0 = performance.now();
  const f = rasterize(def, N); const t1 = performance.now();
  const err = rtinErrors(f); const t2 = performance.now();
  // the error bounds and normal smoothing the game uses (reliefs.ts RELIEF_LODS), so the preview shows what is drawn
  const lod = extractLod(f, err, RELIEF_LODS[LOD].err, RELIEF_LODS[LOD].grad);
  const lods = RELIEF_LODS.map(l => extractLod(f, err, l.err, l.grad).tris);
  const n = f.n, cellM = f.cell * H, R = rasteriseLod(f, lod);
  const [cx0, cy0, cx1, cy1] = CROP ? CROP.split(',').map(Number) : [f.x0, f.y0, f.x0 + (n - 1) * f.cell, f.y0 + (n - 1) * f.cell];
  const az = (SAZ * Math.PI) / 180, alt = (SALT * Math.PI) / 180, L = [Math.cos(alt) * Math.cos(az), Math.cos(alt) * Math.sin(az), Math.sin(alt)];
  const stone = STONE_SRGB.map(s2l), goldF0 = [1.0, 0.71, 0.29];
  const aspect = (cy1 - cy0) / (cx1 - cx0), W = PX, Hh = Math.max(8, Math.round(PX * aspect)), lin = new Float32Array(W * Hh * 3);
  for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) {
    const fx = cx0 + ((px + 0.5) / W) * (cx1 - cx0), fy = cy1 - ((py + 0.5) / Hh) * (cy1 - cy0);
    const i = Math.min(n - 1, Math.max(0, Math.round((fx - f.x0) / f.cell))), j = Math.min(n - 1, Math.max(0, Math.round((fy - f.y0) / f.cell))), g = j * n + i;
    let nx = 0, ny = 0, nz = 1;
    if (R.on[g]) { nx = R.nm[g * 3]; ny = R.nm[g * 3 + 1]; }
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    // heightfield shadow: march toward the sun
    let lit = 1; const hz = Math.hypot(L[0], L[1]), dz = (L[2] / hz) * cellM;
    let x = i, y = j, z = R.hm[g] + 0.0002;
    for (let s = 0; s < 400; s++) { x += L[0] / hz; y += L[1] / hz; z += dz; if (x < 0 || y < 0 || x >= n - 1 || y >= n - 1 || z > DEPTH * 1.05) break; if (R.hm[Math.round(y) * n + Math.round(x)] > z) { lit = 0; break; } }
    const ndl = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]), sky = 0.25 * (0.5 + 0.5 * nz);
    // the paint film over the stone (the relief material's model, without its brush-scale noise): opacity at the mean film
    // thickness, times the vertex coverage
    const cov = BARE || !R.on[g] ? 0 : R.pm[g], opacity = 1 - Math.exp(-FILM.hiding * (1 + FILM.thickness_min) / 2), film = cov * opacity;
    const gilt = BARE || !R.on[g] ? 0 : R.gm[g];
    for (let k = 0; k < 3; k++) {
      const alb = stone[k] * (1 - film) + (R.on[g] ? R.cm[g * 3 + k] : stone[k]) * film;
      let c = alb * (2.6 * ndl * lit + sky);
      if (gilt > 0) { // gold leaf: no diffuse; the sun's glint (a broad lobe for rubbed leaf on carved stone) and the sky's reflection
        const hdx = L[0], hdy = L[1], hdz = L[2] + 1, hl = Math.hypot(hdx, hdy, hdz), ndh = Math.max(0, (nx * hdx + ny * hdy + nz * hdz) / hl);
        const spec = Math.pow(ndh, 24) * 6 * lit, env = 0.35 * (0.5 + 0.5 * ny) + 0.12;
        c = c * (1 - gilt) + goldF0[k] * (spec + env) * gilt;
      }
      lin[(py * W + px) * 3 + k] = c;
    }
  }
  const enc = (a: Float32Array) => { const o = new Uint8Array(a.length); for (let q = 0; q < a.length; q++) o[q] = l2s(a[q]); return o; };
  const name = `${OUT}/${kind}_${seed}${LOD ? '_lod' + LOD : ''}${BARE ? '_bare' : ''}.png`;
  writeFileSync(name, png(W, Hh, enc(lin)));
  if (DIST > 0) { // the figure as it covers the screen from DIST metres (1080 px over a 70° vertical field of view), box-filtered, shown 4× enlarged
    const pxPerM = 1080 / (2 * DIST * Math.tan((35 * Math.PI) / 180)), w2 = Math.max(4, Math.round((cx1 - cx0) * H * pxPerM)), h2 = Math.max(4, Math.round((cy1 - cy0) * H * pxPerM)), small = new Float32Array(w2 * h2 * 3), cnt = new Float32Array(w2 * h2);
    for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) { const q = Math.min(h2 - 1, Math.floor((py / Hh) * h2)) * w2 + Math.min(w2 - 1, Math.floor((px / W) * w2)); cnt[q]++; for (let k = 0; k < 3; k++) small[q * 3 + k] += lin[(py * W + px) * 3 + k]; }
    const up = new Float32Array(w2 * 4 * h2 * 4 * 3);
    for (let y2 = 0; y2 < h2 * 4; y2++) for (let x2 = 0; x2 < w2 * 4; x2++) { const q = Math.floor(y2 / 4) * w2 + Math.floor(x2 / 4); for (let k = 0; k < 3; k++) up[(y2 * w2 * 4 + x2) * 3 + k] = small[q * 3 + k] / Math.max(1, cnt[q]); }
    writeFileSync(name.replace('.png', `_d${DIST}.png`), png(w2 * 4, h2 * 4, enc(up)));
  }
  console.log(`${name}  field ${(t1 - t0).toFixed(1)} ms, rtin ${(t2 - t1).toFixed(1)} ms, tris L0..L3 ${lods.join(' / ')} (shown L${LOD}: ${lod.tris})`);
  return { rgb: enc(lin), W, Hh };
}

const tiles: { rgb: Uint8Array; W: number; Hh: number }[] = [];
for (const k of kinds) { const [kind, s] = k.split(':'); if (!FIGURE_KINDS[kind.replace('~rough', '')]) { console.error('unknown kind ' + kind); continue; } tiles.push(render(kind, +(s ?? 1))); }
if (SHEET && tiles.length > 1) { // contact sheet (tiles of the first tile's size)
  const TW = tiles[0].W, TH = Math.max(...tiles.map(t => t.Hh)), cols = Math.min(6, tiles.length), rows = Math.ceil(tiles.length / cols), W = TW * cols, Hh = TH * rows, rgb = new Uint8Array(W * Hh * 3);
  tiles.forEach((t, k) => { const ox = (k % cols) * TW, oy = Math.floor(k / cols) * TH; for (let y = 0; y < Math.min(t.Hh, TH); y++) for (let x = 0; x < Math.min(t.W, TW); x++) for (let c = 0; c < 3; c++) rgb[((oy + y) * W + ox + x) * 3 + c] = t.rgb[(y * t.W + x) * 3 + c]; });
  writeFileSync(`${OUT}/_sheet.png`, png(W, Hh, rgb)); console.log(`${OUT}/_sheet.png`);
}
