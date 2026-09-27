// dev (D-285): the rubric's flatness statistic (Ystd/Y of linear Y from the sRGB screenshot) on world regions of the dbg_surf
// renders (tests/e2e/dbg_surf.spec.ts writes each frame's scene camera into shots/surf-stats.json): the region's own Ystd/Y, the
// mean Ystd/Y in square windows of 0.5 m and 1.5 m on the surface (sized from the projection at the region's centre), its mean
// 8-bit luma and the mean |B − D0| difference (the D-285 switch) in 8-bit luma. Node only (a PNG decoder on zlib, no image
// library). The regions:
//  - the Terrace's W salient face (calib24_compare.py's wall_sun: e −61.45, n 2..45, 1-6.5 m below the court) in calib-24;
//    the same face above its foot at the near and lens views (from the ground at the camera up);
//  - the Gate of All Nations' W wall N and S of its door (the footprint's W edge, 1.5-15 m above the court).
// Run: npx tsx tools/dev/surf_regions_d285.ts [shots/surf-stats.json] [TAG]
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function decodePng(buf: Buffer) {
  let o = 8, w = 0, h = 0, ct = 0; const idat: Buffer[] = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); if (data[8] !== 8 || data[12] !== 0) throw new Error('8-bit non-interlaced PNG only'); ct = data[9]; }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    o += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0; if (!bpp) throw new Error('RGB/RGBA PNG only');
  const raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, out = new Uint8Array(w * h * 3), prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) out[(y * w + x) * 3 + k] = cur[x * bpp + k];
    prev.set(cur);
  }
  return { w, h, rgb: out };
}
const lin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const LUT = Float64Array.from({ length: 256 }, (_, i) => lin(i));

type Cam = { view: number[]; proj: number[]; pos: number[] };
/** world (east, north, height above the court) → pixel */
function project(c: Cam, W: number, H: number, e: number, n: number, y: number): [number, number] | null {
  const p = [e, y, -n, 1], m = (M: number[], v: number[]) => [0, 1, 2, 3].map(r => M[r] * v[0] + M[4 + r] * v[1] + M[8 + r] * v[2] + M[12 + r] * v[3]);
  const cl = m(c.proj, m(c.view, p)); if (cl[3] <= 0.05) return null;
  return [(cl[0] / cl[3] * 0.5 + 0.5) * W, (1 - (cl[1] / cl[3] * 0.5 + 0.5)) * H];
}
function polyMask(pts: [number, number][], W: number, H: number) {
  const m = new Uint8Array(W * H); let n = 0;
  const x0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p[0])))), x1 = Math.min(W - 1, Math.ceil(Math.max(...pts.map(p => p[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p[1])))), y1 = Math.min(H - 1, Math.ceil(Math.max(...pts.map(p => p[1]))));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let inside = false; const px = x + 0.5, py = y + 0.5;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) { m[y * W + x] = 1; n++; }
  }
  return { m, n };
}
/** a vertical quad on a face from (e0, n0) to (e1, n1), heights ya..yb above the court */
type Quad = { name: string; a: [number, number]; b: [number, number]; y: [number, number] | ((ground: number) => [number, number]) };
const gateW = (n: number): [number, number] => [-16.39 + ((141.33 - n) / 18.44) * 0.47, n]; // the footprint's W edge (n 122.9-141.3)
const GATE: Quad[] = [{ name: 'Gate W wall N of the door', a: gateW(128), b: gateW(140), y: [1.5, 15] }, { name: 'Gate W wall S of the door', a: gateW(109), b: gateW(121), y: [1.5, 15] }];
const REGIONS: Record<string, Quad[]> = {
  'calib-24': [{ name: 'Terrace W salient face (wall_sun)', a: [-61.45, 2], b: [-61.45, 45], y: [-6.5, -1] }],
  'terrace-wall-near': [{ name: 'Terrace W salient face, 0.3-9 m above the plain', a: [-61.45, 10], b: [-61.45, 34], y: g => [g + 0.3, g + 9] }],
  'terrace-wall-lens': [{ name: 'Terrace W salient face, 0.3-4 m above the plain', a: [-61.45, 18], b: [-61.45, 26], y: g => [g + 0.3, g + 4] }],
  'gate-w-day': GATE, 'gate-dusk': GATE,
  'gate-w-lens': [{ name: 'Gate W wall N of the door, 0.8-4 m', a: gateW(128.5), b: gateW(139), y: [0.8, 4] }],
};
function stats(img: ReturnType<typeof decodePng>, mask: Uint8Array, win: number) {
  const { w, h, rgb } = img, Y = new Float64Array(w * h), L8 = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) { Y[i] = 0.2126 * LUT[rgb[i * 3]] + 0.7152 * LUT[rgb[i * 3 + 1]] + 0.0722 * LUT[rgb[i * 3 + 2]]; L8[i] = 0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2]; }
  const sd = (a: number[]) => { const m = a.reduce((p, q) => p + q, 0) / a.length; return { m, r: Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / a.length) / m }; };
  const all: number[] = [], l8: number[] = []; for (let i = 0; i < w * h; i++) if (mask[i]) { all.push(Y[i]); l8.push(L8[i]); }
  const wins: number[] = [], s = Math.max(4, Math.round(win));
  for (let y = 0; y + s <= h; y += s >> 1) for (let x = 0; x + s <= w; x += s >> 1) {
    const a: number[] = []; let full = true;
    for (let yy = y; yy < y + s && full; yy++) for (let xx = x; xx < x + s; xx++) { if (!mask[yy * w + xx]) { full = false; break; } a.push(Y[yy * w + xx]); }
    if (full) wins.push(sd(a).r);
  }
  wins.sort((p, q) => p - q);
  return { region: sd(all).r, luma8: l8.reduce((p, q) => p + q, 0) / l8.length, win: wins.length ? wins.reduce((p, q) => p + q, 0) / wins.length : NaN, winMed: wins.length ? wins[wins.length >> 1] : NaN, nWin: wins.length, n: all.length, L8 };
}
if ((process.argv[1] ?? '').replace(/\\/g, '/').endsWith('surf_regions_d285.ts')) main();
function main() {
const statsFile = process.argv[2] ?? 'shots/surf-stats.json', TAG = process.argv[3] ?? '';
const S: Record<string, { cam: Cam | null }> = JSON.parse(readFileSync(statsFile, 'utf8'));
console.log('| view | region | variant | px | luma 8-bit | Ystd/Y region | 0.5 m windows (mean / median, n) | 1.5 m windows (mean) | mean abs B-D0 (8-bit) |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const [view, quads] of Object.entries(REGIONS)) for (const Q of quads) {
  const res: Record<string, ReturnType<typeof stats>> = {};
  for (const vn of ['B', 'D0']) {
    const k = `${view}|${vn}`, f = `shots/surf-${view}-${vn}${TAG}.png`; if (!S[k]?.cam || !existsSync(f)) continue;
    const img = decodePng(readFileSync(f)), c = S[k].cam!, ground = c.pos[1] - 1.6;
    const [ya, yb] = typeof Q.y === 'function' ? Q.y(ground) : Q.y;
    const pts = [project(c, img.w, img.h, Q.a[0], Q.a[1], ya), project(c, img.w, img.h, Q.b[0], Q.b[1], ya), project(c, img.w, img.h, Q.b[0], Q.b[1], yb), project(c, img.w, img.h, Q.a[0], Q.a[1], yb)];
    if (pts.some(p => !p)) { console.log(`| ${view} | ${Q.name} | ${vn} | behind the camera | | | | | |`); continue; }
    const { m, n } = polyMask(pts as [number, number][], img.w, img.h); if (n < 50) { console.log(`| ${view} | ${Q.name} | ${vn} | ${n} (off screen) | | | | | |`); continue; }
    // the pixel size on the surface at the region's centre: 1 m along the face projected
    const cy = (ya + yb) / 2, ce = (Q.a[0] + Q.b[0]) / 2, cn = (Q.a[1] + Q.b[1]) / 2, d = Math.hypot(Q.b[0] - Q.a[0], Q.b[1] - Q.a[1]);
    const p0 = project(c, img.w, img.h, ce, cn, cy)!, p1 = project(c, img.w, img.h, ce + (Q.b[0] - Q.a[0]) / d, cn + (Q.b[1] - Q.a[1]) / d, cy)!, p2 = project(c, img.w, img.h, ce, cn, cy + 1)!;
    const pxPerM = Math.sqrt(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * Math.hypot(p2[0] - p0[0], p2[1] - p0[1]));
    const a = stats(img, m, 0.5 * pxPerM), b = stats(img, m, 1.5 * pxPerM); res[vn] = a;
    let diff = '';
    if (vn === 'D0' && res.B) { let s = 0; for (let i = 0; i < m.length; i++) if (m[i]) s += Math.abs(res.B.L8[i] - a.L8[i]); diff = (s / n).toFixed(2); }
    console.log(`| ${view} | ${Q.name} | ${vn} | ${n} (${(1 / pxPerM * 100).toFixed(1)} cm/px) | ${a.luma8.toFixed(1)} | ${a.region.toFixed(3)} | ${a.win.toFixed(3)} / ${a.winMed.toFixed(3)} (${a.nWin}) | ${b.win.toFixed(3)} | ${diff} |`);
  }
}
}
