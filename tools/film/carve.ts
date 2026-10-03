// Heightmaps of cut and pressed writing for the title film (D-761): the signs of a published text drawn from the project's
// own period fonts (Noto Sans Old Persian, Noto Sans Cuneiform), filled at high resolution, then given a chisel's V profile
// (the depth grows with the distance from the sign's edge, to a flat floor) or a stylus's (a wedge pressed into clay: deep
// at the head, shallowing along the tail). Written as 16-bit greyscale PNGs (1 = the surface, 0 = the deepest cut) that
// Blender displaces a dense grid by (tools/film/film.py).
//   npx tsx tools/film/carve.ts <out dir>
import opentype from 'opentype.js';
import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { carvedLines } from '../../src/lang/oldPersian';

const ROOT = resolve(import.meta.dirname, '../..');
const font = (f: string) => { const b = readFileSync(join(ROOT, 'public/fonts', f)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); };

/** fill polygons (nonzero winding) into a mask w x h */
function fill(polys: [number, number][][], w: number, h: number): Uint8Array {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const yc = y + 0.5, xs: { x: number; d: number }[] = [];
    for (const p of polys) for (let i = 0; i < p.length; i++) { const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length];
      if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push({ x: x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0), d: y1 > y0 ? 1 : -1 }); }
    xs.sort((a, b) => a.x - b.x); let wn = 0;
    for (let k = 0; k < xs.length - 1; k++) { wn += xs[k].d; if (wn !== 0) { const a = Math.max(0, Math.ceil(xs[k].x - 0.5)), b = Math.min(w - 1, Math.floor(xs[k + 1].x - 0.5)); for (let x = a; x <= b; x++) m[y * w + x] = 1; } }
  }
  return m;
}
/** the path of a glyph run as polygons (curves flattened), at a pixel scale */
function textPolys(f: opentype.Font, text: string, x: number, y: number, size: number): [number, number][][] {
  const path = f.getPath(text, x, y, size), polys: [number, number][][] = []; let cur: [number, number][] = [], px = 0, py = 0;
  for (const c of path.commands as any[]) {
    if (c.type === 'M') { if (cur.length > 2) polys.push(cur); cur = [[c.x, c.y]]; px = c.x; py = c.y; }
    else if (c.type === 'L') { cur.push([c.x, c.y]); px = c.x; py = c.y; }
    else if (c.type === 'Q') { for (let t = 0.125; t <= 1; t += 0.125) { const u = 1 - t; cur.push([u * u * px + 2 * u * t * c.x1 + t * t * c.x, u * u * py + 2 * u * t * c.y1 + t * t * c.y]); } px = c.x; py = c.y; }
    else if (c.type === 'C') { for (let t = 0.125; t <= 1; t += 0.125) { const u = 1 - t; cur.push([u * u * u * px + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * py + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y]); } px = c.x; py = c.y; }
    else if (c.type === 'Z') { if (cur.length > 2) polys.push(cur); cur = []; }
  }
  if (cur.length > 2) polys.push(cur);
  return polys;
}
/** distance (px) from each inside pixel to the nearest outside one (two-pass chamfer 3-4) */
function inside(m: Uint8Array, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h), BIG = 1e9;
  for (let i = 0; i < w * h; i++) d[i] = m[i] ? BIG : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4); }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4); }
  for (let i = 0; i < w * h; i++) d[i] /= 3;
  return d;
}
/** a box blur (separable, r px), for the softened lip of a cut */
function blur(a: Float32Array, w: number, h: number, r: number): Float32Array {
  const t = new Float32Array(w * h), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * w + Math.max(0, Math.min(w - 1, x))]; for (let x = 0; x < w; x++) { t[y * w + x] = s / (2 * r + 1); s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.max(0, Math.min(h - 1, y)) * w + x]; for (let y = 0; y < h; y++) { o[y * w + x] = s / (2 * r + 1); s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
  return o;
}
async function png16(path: string, h01: Float32Array, w: number, h: number) {
  const b = new Uint16Array(w * h); for (let i = 0; i < w * h; i++) b[i] = Math.round(Math.max(0, Math.min(1, h01[i])) * 65535);
  await sharp(b, { raw: { width: w, height: h, channels: 1 } }).toColourspace('grey16').png({ compressionLevel: 9 }).toFile(path);
}

/** carve lines of text: a V cut `vDepth` px deep at most (the chisel's flat floor beyond) */
export async function carveText(out: string, f: opentype.Font, lines: string[], o: { w: number; h: number; size: number; lead: number; margin: number; vPx: number; lip: number; justify?: boolean }) {
  const polys: [number, number][][] = [];
  // fit: the longest line within the width, all lines within the height (the lead keeps its ratio to the size)
  const widest = Math.max(...lines.map(l => f.getAdvanceWidth(l, o.size))), k = Math.min(1, (o.w - 2 * o.margin) / widest, (o.h - 2 * o.margin) / (o.size * 0.95 + (lines.length - 1) * o.lead));
  o = { ...o, size: o.size * k, lead: o.lead * k, vPx: o.vPx * Math.max(0.6, k) }; if (process.env.CARVE_DEBUG) console.log({ widest, k, size: o.size, lines: lines.length });
  lines.forEach((ln, i) => {
    const y = o.margin + o.size * 0.85 + i * o.lead; let x = o.margin;
    if (o.justify) { const adv = f.getAdvanceWidth(ln, o.size), sp = (o.w - 2 * o.margin - adv) / Math.max(1, [...ln].length - 1); for (const ch of ln) { polys.push(...textPolys(f, ch, x, y, o.size)); x += f.getAdvanceWidth(ch, o.size) + Math.max(0, sp); } }
    else polys.push(...textPolys(f, ln, x, y, o.size));
  });
  const m = fill(polys, o.w, o.h), d = inside(m, o.w, o.h), hm = new Float32Array(o.w * o.h);
  for (let i = 0; i < hm.length; i++) hm[i] = 1 - Math.min(1, d[i] / o.vPx);
  await png16(out, o.lip ? blur(hm, o.w, o.h, o.lip) : hm, o.w, o.h);
  return { signs: lines.reduce((a, l) => a + [...l].length, 0) };
}

/** one stylus wedge pressed into clay at (x, y) px, pointing `ang` rad: a triangular head (deep) and a tapering tail */
export function wedgePolys(x: number, y: number, len: number, ang: number, head = 0.42): { head: [number, number][]; tail: [number, number][]; } {
  const c = Math.cos(ang), s = Math.sin(ang), P = (u: number, v: number): [number, number] => [x + u * c - v * s, y + u * s + v * c];
  const hw = len * head * 0.55;
  return { head: [P(0, -hw), P(0, hw), P(len * head, 0)], tail: [P(0, -hw * 0.18), P(0, hw * 0.18), P(len, 0)] };
}
export async function pressWedges(out: string, wedges: { x: number; y: number; len: number; ang: number }[], w: number, h: number) {
  const hm = new Float32Array(w * h).fill(1);
  for (const q of wedges) {
    const { head, tail } = wedgePolys(q.x, q.y, q.len, q.ang), mh = fill([head], w, h), mt = fill([tail], w, h), dh = inside(mh, w, h), dt = inside(mt, w, h);
    for (let i = 0; i < hm.length; i++) {
      if (mh[i]) { const px = i % w, py = (i / w) | 0, along = ((px - q.x) * Math.cos(q.ang) + (py - q.y) * Math.sin(q.ang)) / (q.len * 0.42); hm[i] = Math.min(hm[i], 1 - Math.min(1, dh[i] / (q.len * 0.06)) * (1 - 0.55 * along)); }
      if (mt[i]) hm[i] = Math.min(hm[i], 1 - Math.min(1, dt[i] / (q.len * 0.02)) * 0.45);
    }
  }
  await png16(out, blur(hm, w, h, 2), w, h);
}

/** a band of twelve-petalled rosettes in raised relief (the border of the Apadana's stair reliefs and of the glazed friezes):
 *  1 = the relief's face, 0.25 = the ground; petals rounded (the height grows as the root of the distance from the edge) */
export async function rosettes(out: string, w: number, h: number, n: number) {
  const polys: [number, number][][] = [], r = h * 0.4, pitch = w / n;
  for (let k = 0; k < n; k++) { const cx = pitch * (k + 0.5), cy = h / 2;
    for (let p = 0; p < 12; p++) { const a = (p / 12) * Math.PI * 2, pts: [number, number][] = [];
      for (let t = 0; t < 24; t++) { const u = (t / 24) * Math.PI * 2, ex = Math.cos(u) * r * 0.42 + r * 0.55, ey = Math.sin(u) * r * 0.13; pts.push([cx + ex * Math.cos(a) - ey * Math.sin(a), cy + ex * Math.sin(a) + ey * Math.cos(a)]); }
      polys.push(pts); }
    const disc: [number, number][] = []; for (let t = 0; t < 32; t++) { const u = (-t / 32) * Math.PI * 2; disc.push([cx + Math.cos(u) * r * 0.27, cy + Math.sin(u) * r * 0.27]); } polys.push(disc);
  }
  const m = new Uint8Array(w * h); for (const p of polys) { const q = fill([p], w, h); for (let i = 0; i < m.length; i++) m[i] |= q[i]; } // each shape alone, then their union
  const d = inside(m, w, h), hm = new Float32Array(w * h);
  for (let i = 0; i < hm.length; i++) hm[i] = m[i] ? 0.25 + 0.75 * Math.sqrt(Math.min(1, d[i] / (r * 0.12))) : 0.25;
  // the band's two fillets, top and bottom
  for (let y = 0; y < h; y++) if (y < h * 0.05 || y > h * 0.95) for (let x = 0; x < w; x++) hm[y * w + x] = 1;
  await png16(out, blur(hm, w, h, 2), w, h);
}

// ------------------------------------------------------------------------------------------------------------------- main
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2] ?? join(ROOT, 'tools/film/work'); mkdirSync(out, { recursive: true });
  const ins = JSON.parse(readFileSync(join(ROOT, 'src/data/inscriptions.json'), 'utf8'));
  const op = font('NotoSansOldPersian-Regular.ttf'), cun = font('NotoSansCuneiform-Regular.ttf');
  // XPa, the Gate of All Nations (Xerxes): its first six carved lines as the stone has them (op_signs, D-184)
  const xpa = carvedLines(ins.XPa.op_signs).slice(0, 6);
  const r1 = await carveText(join(out, 'xpa.png'), op, xpa, { w: 4096, h: 1000, size: 150, lead: 205, margin: 60, vPx: 13, lip: 2, justify: true });
  // a Fortification-style tablet's lines in Elamite cuneiform (a reconstructed text of the project, writing.json)
  const w = JSON.parse(readFileSync(join(ROOT, 'src/data/writing.json'), 'utf8')), rec = Object.values(w.recon_texts)[0] as any;
  const r2 = await carveText(join(out, 'tablet.png'), cun, rec.lines_cuneiform.slice(0, 8), { w: 2048, h: 1400, size: 120, lead: 160, margin: 60, vPx: 9, lip: 2 });
  // the title: the place's name in its own script, 𐎱𐎠𐎼𐎿 (p-a-r-s, DB I 5), for the gold letters' bevel mask
  const r3 = await carveText(join(out, 'title.png'), op, ['𐎱𐎠𐎼𐎿'], { w: 2400, h: 700, size: 520, lead: 600, margin: 120, vPx: 26, lip: 1 });
  // the stylus's impressions, one map per wedge (the film reveals each as the stylus lifts)
  const wedges = [{ x: 380, y: 520, len: 300, ang: 0 }, { x: 420, y: 330, len: 220, ang: Math.PI / 2 }, { x: 760, y: 330, len: 220, ang: Math.PI / 2 }, { x: 1150, y: 520, len: 300, ang: 0.05 }, { x: 1260, y: 760, len: 200, ang: -Math.PI / 4 }];
  for (let i = 0; i < wedges.length; i++) await pressWedges(join(out, `wedge${i}.png`), [wedges[i]], 1600, 1100);
  await rosettes(join(out, 'rosettes.png'), 4096, 512, 8);
  writeFileSync(join(out, 'carve.json'), JSON.stringify({ xpa: { lines: xpa, ...r1, w: 4096, h: 1000 }, tablet: { text: rec.label ?? '', ...r2, w: 2048, h: 1400 }, title: { w: 2400, h: 700 }, wedges: { list: wedges, w: 1600, h: 1100 } }, null, 1));
  console.log('carved', r1, r2, r3);
}
