// Probe (node, D-198): bake the writing atlas with the fonts and report, per reconstructed tablet text, the sign height the
// layout chose, whether any line wrapped, the relief RMS of the written band and of the blank area below it, and write a
// greyscale PGM of the three obverses for a look (shots/, not committed). Run: npx tsx tools/dev/tablet_layout_probe.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadWritingFonts, rebakeWritingAtlas, REGIONS, ATLAS, reliefRms, WRITING } from '../../src/world/writing';

const t0 = Date.now();
await loadWritingFonts(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; });
const a = rebakeWritingAtlas();
console.log(`bake ${Date.now() - t0} ms; texts ${a.baked.texts.join(', ')}; signs drawn ${[...a.baked.signs].length}`);
for (const [obj, reg] of [['pt_letter', 'obv_full'], ['pt_letter_fresh', 'obv_fresh'], ['pt_letter_unfinished', 'obv_part']] as const) {
  const T = WRITING.recon_texts[WRITING.objects[obj].recon as string], r = REGIONS[reg];
  // rows of the region with any relief below −0.1 mm: the written lines
  const rows: number[] = [];
  for (let y = 0; y < r.h; y++) { let m = 0; for (let x = 0; x < r.w; x++) m = Math.min(m, a.height[(r.y + y) * ATLAS + r.x + x]); if (m < -0.1) rows.push(y); }
  const bands: [number, number][] = []; for (const y of rows) { const b = bands[bands.length - 1]; if (b && y - b[1] <= 2) b[1] = y; else bands.push([y, y]); }
  let xmax = 0; for (let y = 0; y < r.h; y++) for (let x = r.w - 1; x > xmax; x--) if (a.height[(r.y + y) * ATLAS + r.x + x] < -0.1) { xmax = x; break; }
  const lastMm = bands.length ? (bands[bands.length - 1][1] + 1) * r.mm : 0;
  console.log(`${obj} ${reg}: ${T.lines_cuneiform.length} data lines; ${bands.length} impressed bands (mm) ${bands.map(([p, q]) => `${(p * r.mm).toFixed(1)}–${((q + 1) * r.mm).toFixed(1)}`).join(', ')}; rightmost sign ${(xmax * r.mm).toFixed(1)} of ${(r.w * r.mm).toFixed(0)} mm; RMS written ${reliefRms(reg, [4, 3, 86, lastMm]).toFixed(3)} mm, below ${reliefRms(reg, [4, lastMm + 2, 86, 62]).toFixed(3)} mm`);
}
mkdirSync('shots/tablet_probe', { recursive: true });
for (const reg of ['obv_full', 'obv_fresh', 'obv_part'] as const) {
  const r = REGIONS[reg], px = new Uint8Array(r.w * r.h);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const h = a.height[(r.y + y) * ATLAS + r.x + x]; px[y * r.w + x] = Math.max(0, Math.min(255, 180 + h * 200)); }
  writeFileSync(`shots/tablet_probe/${reg}.pgm`, Buffer.concat([Buffer.from(`P5 ${r.w} ${r.h} 255\n`), Buffer.from(px)]));
}
