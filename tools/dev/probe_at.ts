// dev (D-276): which baked probe volume answers at the halls' centres, its weight and validity (npx tsx tools/dev/probe_at.ts)
import { readFileSync } from 'node:fs';
import { decodeField, sampleField, volumeAt, gridExtent } from '../../src/render/probes/field';
import { terraceBuilt } from '../../src/arch/built';
const M = JSON.parse(readFileSync('public/generated/probes.json', 'utf8'));
const data = decodeField(new Uint16Array(readFileSync('public/generated/probes.f16').buffer.slice(0)));
const F: any = { volumes: M.volumes, data, count: M.count, normalBias: M.normalBias };
const man = terraceBuilt().manifest as any;
for (const b of ['hadish', 'treasury', 'harem', 'tachara', 'apadana']) {
  const r = man[b].room as number[]; const [x, y, z] = [r[0], r[4] + 1.6, -r[1]];
  const v = volumeAt(F, x, y, z), s = sampleField(F, x, y, z); console.log(b, [x, y, z].map(q => q.toFixed(1)).join(','), '->', v?.building, 'w', s?.w, 'valid', s?.s[11]);
  for (const q of M.volumes) { const g = gridExtent(q); if (x >= g.x0 && x <= g.x1 && z >= g.z0 && z <= g.z1) console.log('   xz in', q.building, 'y', g.y0.toFixed(2), g.y1.toFixed(2)); }
}
