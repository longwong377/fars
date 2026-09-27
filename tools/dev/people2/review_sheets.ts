// dev (D-307): anonymised review items for a blind reviewer: every portrait of the given runs (before and after), shuffled
// under neutral names, each as the full frame (the player's lens) and a 2x crop of the person (head to knees); the key
// (which run each item is) goes to a separate file the reviewer is not given.
// usage: npx tsx tools/dev/people2/review_sheets.ts <outDir> <keyFile> <seed> <tagPrefix>... (e.g. shots/portraits/run1-nomodels-)
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { decodePNG, encodePNG } from '../../humans/png';
const [out, keyFile, seedS, ...prefixes] = process.argv.slice(2); mkdirSync(out, { recursive: true });
let s = +seedS >>> 0; const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const items: { src: string; tag: string }[] = [];
for (const p of prefixes) { const dir = p.slice(0, p.lastIndexOf('/')), pre = p.slice(p.lastIndexOf('/') + 1);
  for (const f of readdirSync(dir)) if (f.startsWith(pre) && f.endsWith('.png') && /-(day|fire)-\d\d-/.test(f)) items.push({ src: `${dir}/${f}`, tag: pre }); }
for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
const key: Record<string, string> = {};
items.forEach((it, i) => { const name = `P${String(i + 1).padStart(2, '0')}`; key[name] = it.src;
  copyFileSync(it.src, `${out}/${name}-frame.png`);
  const im = decodePNG(readFileSync(it.src)); const x0 = 760, y0 = 380, w = 400, h = 700, k = 2, W = w * k, H = h * k, o = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const si = ((y0 + (y >> 1)) * im.width + x0 + (x >> 1)) * 4, di = (y * W + x) * 4; for (let c = 0; c < 3; c++) o[di + c] = im.data[si + c]; o[di + 3] = 255; }
  writeFileSync(`${out}/${name}-crop.png`, encodePNG(W, H, o)); });
writeFileSync(keyFile, JSON.stringify(key, null, 1));
console.log(items.length, 'items');
