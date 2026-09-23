import { createRequire } from 'node:module'; const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle'); import { readFileSync } from 'node:fs';
const [,, file, ...pts] = process.argv; const im = PNG.sync.read(readFileSync(file));
for (const p of pts) { const [x, y, ...l] = p.split(','); let s = [0,0,0], n = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const i = ((+y + dy) * im.width + (+x + dx)) * 4; s[0] += im.data[i]; s[1] += im.data[i+1]; s[2] += im.data[i+2]; n++; }
  console.log(l.join(' ').padEnd(18), s.map(v => Math.round(v / n)).join(','));
}
