// s18 Vagon hour: contact sheets from flycam.mjs output. The worst N frames by the metrics CSV (flat/dark/blown, no people in a
// populated place, near-empty JPEG), tiled 4x4 and labelled with the view id. Also a "review" sheet of the review views.
//   node tools/dev/sheets.mjs --in T:/fly/A,T:/fly/B --out T:/fly/sheets [--worst 200]
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import sharp from 'sharp';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const INS = arg('in', 'T:/fly/A,T:/fly/B').split(','), OUT = arg('out', 'T:/fly/sheets'), N = +arg('worst', 200), TW = 480, TH = 270;
mkdirSync(OUT, { recursive: true });
const rows = [];
for (const d of INS) { if (!existsSync(`${d}/metrics.csv`)) continue; const [h, ...ls] = readFileSync(`${d}/metrics.csv`, 'utf8').trim().split('\n'), cols = h.split(',');
  for (const l of ls) { const c = l.split(','), r = Object.fromEntries(cols.map((k, i) => [k, c[i]])); r.dir = d; rows.push(r); } }
const num = x => (x === '' || x === undefined ? NaN : +x);
// badness: dark or blown out, a flat (tiny) JPEG, and no people drawn where the place has any (town, terrace, review)
const bad = r => { const l = num(r.luma), kb = num(r.jpgKB); let s = 0;
  s += Math.max(0, 45 - l) / 45 * 3 + Math.max(0, l - 200) / 55 * 3; s += Math.max(0, 70 - kb) / 70 * 2; s += num(r.dark) * 2 + num(r.bright) * 2;
  if (/town|terrace|review|walk/.test(r.area) && !(num(r.crowdPeople) + num(r.crowdImp) > 0) && !(num(r.peopleVisible) > 0)) s += 1.5; return s; };
rows.forEach(r => r.bad = bad(r));
async function sheet(list, name) {
  const tiles = [];
  for (let s = 0; s < list.length; s += 16) {
    const grp = list.slice(s, s + 16), comp = [];
    for (let i = 0; i < grp.length; i++) { const r = grp[i], f = `${r.dir}/frames/${r.id}.jpg`; if (!existsSync(f)) continue;
      const label = `${r.id} ${r.area} d${r.day} ${(+r.hour).toFixed(1)}h L${(+r.luma).toFixed(0)} p${r.peopleVisible || 0}/${r.walking || 0}`.replace(/&/g, '');
      const img = await sharp(f).resize(TW, TH).composite([{ input: Buffer.from(`<svg width="${TW}" height="22"><rect width="${TW}" height="22" fill="black" fill-opacity=".6"/><text x="4" y="16" font-size="14" fill="white" font-family="monospace">${label}</text></svg>`), top: 0, left: 0 }]).jpeg({ quality: 80 }).toBuffer();
      comp.push({ input: img, left: (i % 4) * TW, top: Math.floor(i / 4) * TH }); }
    if (!comp.length) continue; const file = `${OUT}/${name}-${String(s / 16 + 1).padStart(2, '0')}.jpg`;
    await sharp({ create: { width: TW * 4, height: TH * 4, channels: 3, background: '#000' } }).composite(comp).jpeg({ quality: 82 }).toFile(file); tiles.push(file);
  }
  return tiles;
}
const worst = [...rows].filter(r => r.area !== 'review').sort((a, b) => b.bad - a.bad).slice(0, N);
const rev = rows.filter(r => r.area === 'review');
console.log(`${rows.length} frames; review ${rev.length}`);
console.log('review sheets', (await sheet(rev, 'review')).join(' '));
console.log('worst sheets', (await sheet(worst, 'worst')).length);
