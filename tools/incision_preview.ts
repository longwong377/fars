// Raking-light preview of the incised signs (D-177), rendered in node without a browser: the first lines of a carved text,
// laid out as the world lays them out (carving.ts layoutText) and cut as the shader cuts them (src/render/incision.ts,
// mirrored here: the view ray marched 16 steps into the depth field with a linear refinement, the wall normal from the
// depth gradient, skylight occluded with depth, the uncut face where the entry point is uncut). Lambert under a low sun +
// sky; no cast shadows (the shader has none at this scale either). For judging the carving quickly: screenshots find
// problems, they never prove correctness (brief §3.4).
//   npx tsx tools/incision_preview.ts [id[:ver]] [--lines 4] [--glyph 0.075] [--px 1400] [--view 25,15] [--sun 235,20] [--out shots/incision]
//   --view: the eye's direction off the face normal (deg: along the face, up); --sun: azimuth on the face (0 = +x, 90 = up)
//   and altitude above the face (deg)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import opentype from 'opentype.js';
import { buildAtlas, layoutText, atlasDepthEm, type Atlas } from '../src/arch/carving';
import { panelText, type Version } from '../src/arch/inscription_text';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const NL = +opt('--lines', '4'), GLYPH = +opt('--glyph', '0.075'), PX = +opt('--px', '1400'), OUT = opt('--out', 'shots/incision');
const [VA, VU] = opt('--view', '25,15').split(',').map(Number), [SAZ, SALT] = opt('--sun', '235,20').split(',').map(Number);
const [id, ver] = (args[0] ?? 'XPa:op').split(':') as [string, Version];
mkdirSync(OUT, { recursive: true });
const d2r = Math.PI / 180, norm = (v: number[]) => { const l = Math.hypot(...v); return v.map(x => x / l); };

const text = panelText(id, ver ?? 'op'); if (!text) throw new Error(`no text ${id} ${ver}`);
const buf = readFileSync(`public/fonts/${text.font === 'op' ? 'NotoSansOldPersian-Regular.ttf' : 'NotoSansCuneiform-Regular.ttf'}`);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const lines = text.lines.slice(0, NL), A: Atlas = buildAtlas(font, lines.join(''), text.font === 'op' ? 96 : 64);
const L = layoutText(font, lines, GLYPH, GLYPH * 0.5, 2.4, text.lined);
// sign cells on a grid for lookup (x, y in metres on the face; a cell = the sign's atlas cell)
const cells = L.signs.map(s => { const c = A.cells.get(s.ch)!; return { s, c, x0: s.x + c.ox * L.em, y0: s.y + c.oy * L.em, x1: s.x + (c.ox + c.w / A.tpe) * L.em, y1: s.y + (c.oy + c.h / A.tpe) * L.em }; }).filter(q => q.c?.w);
/** the cut's depth (m) at a face point: the deepest of the signs whose cell covers it (cells overlap only in their margins) */
const depthAt = (x: number, y: number) => { let d = 0; for (const q of cells) if (x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1) d = Math.max(d, atlasDepthEm(A, q.s.ch, (x - q.s.x) / L.em, (y - q.s.y) / L.em) * L.em); return d; };

const V = norm([Math.sin(VA * d2r), Math.sin(VU * d2r), Math.cos(VA * d2r) * Math.cos(VU * d2r)]); // face frame: x along, y up, z out
const S = [Math.cos(SALT * d2r) * Math.cos(SAZ * d2r), Math.cos(SALT * d2r) * Math.sin(SAZ * d2r), Math.sin(SALT * d2r)];
const vz = Math.max(V[2], 0.2), du = [-V[0] / vz, -V[1] / vz], zMax = A.maxDepthEm * L.em, dz = zMax / 16, e = L.em / A.tpe;
const W = PX, H = Math.round((PX * L.height) / Math.max(L.width, 1e-3)) + 2, sx = L.width / W;
const img = new Uint8Array(W * H * 3), stone = [0.62, 0.57, 0.5], l2s = (c: number) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)));
let cutPx = 0;
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const x = (i + 0.5) * sx, y = -(j + 0.5) * sx;
  let n = [0, 0, 1], ao = 1;
  if (depthAt(x, y) > 0.0002 * L.em) { // inside the outline at the entry point: march the view ray into the cut (incision.ts)
    let z = 0, px = x, py = y, hPrev = depthAt(x, y);
    for (let k = 0; k < 16; k++) {
      const zn = z + dz, pxn = x + du[0] * zn, pyn = y + du[1] * zn, hn = depthAt(pxn, pyn);
      if (hn < zn) { const a = hPrev - z, b = hn - zn, t = Math.min(1, Math.max(0, a / Math.max(a - b, 1e-9))); z += dz * t; px = x + du[0] * z; py = y + du[1] * z; break; }
      z = zn; px = pxn; py = pyn; hPrev = hn;
    }
    const gx = (depthAt(px + e, py) - depthAt(px - e, py)) / (2 * e), gy = (depthAt(px, py + e) - depthAt(px, py - e)) / (2 * e);
    n = norm([gx, gy, 1]); const d = depthAt(px, py); ao = 1 - 0.3 * Math.min(1, Math.max(0, d / (0.05 * L.em))); cutPx++;
  }
  const sun = Math.max(0, n[0] * S[0] + n[1] * S[1] + n[2] * S[2]) * 2.2, sky = 0.35 * ao * (0.6 + 0.4 * n[2]);
  for (let c = 0; c < 3; c++) img[(j * W + i) * 3 + c] = l2s(stone[c] * (sun + sky) * 0.55);
}
function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const crcT = new Uint32Array(256).map((_, k) => { let c = k; for (let q = 0; q < 8; q++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let i = 0; i < w * 3; i++) raw[y * (w * 3 + 1) + 1 + i] = rgb[y * w * 3 + i]; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const name = `${OUT}/${id}_${ver ?? 'op'}_v${VA},${VU}_s${SAZ},${SALT}.png`;
writeFileSync(name, png(W, H, img));
console.log(`${name}: ${L.signs.length} signs in ${lines.length} lines, sign ${(GLYPH * 100).toFixed(1)} cm, deepest cut ${(zMax * 1000).toFixed(1)} mm, ${(sx * 1000).toFixed(2)} mm/px, ${((100 * cutPx) / (W * H)).toFixed(1)} % of the face inside a cut`);
