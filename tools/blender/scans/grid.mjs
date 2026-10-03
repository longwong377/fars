// PARSA s14 (D-365): a photograph with a labelled pixel grid, to read silhouettes off it (node, sharp)
//   node tools/blender/scans/grid.mjs <in.jpg> <out.png> <x0> <y0> <x1> <y1> [step=50]
import sharp from 'sharp';
const [src, out, ...r] = process.argv.slice(2); const [x0, y0, x1, y1, st = 50] = r.map(Number);
const W = x1 - x0, H = y1 - y0; let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
for (let x = Math.ceil(x0 / st) * st; x < x1; x += st) svg += `<line x1="${x - x0}" y1="0" x2="${x - x0}" y2="${H}" stroke="${x % (st * 2) ? '#f0f' : '#f00'}" stroke-width="1" opacity="0.6"/><text x="${x - x0 + 2}" y="12" font-size="11" fill="#f00">${x}</text>`;
for (let y = Math.ceil(y0 / st) * st; y < y1; y += st) svg += `<line x1="0" y1="${y - y0}" x2="${W}" y2="${y - y0}" stroke="${y % (st * 2) ? '#0ff' : '#00f'}" stroke-width="1" opacity="0.6"/><text x="2" y="${y - y0 - 2}" font-size="11" fill="#00f">${y}</text>`;
svg += '</svg>';
await sharp(src).extract({ left: x0, top: y0, width: W, height: H }).composite([{ input: Buffer.from(svg) }]).png().toFile(out);
