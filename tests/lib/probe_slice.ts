// dev (D-157, item 10's "orange blotches"): the probe field's ambient on a horizontal slice through a volume, for a
// fixed normal, as a CSV (x, z, E_S, E_U, weight) — run with tsx; plotted by the caller
import { readFileSync, writeFileSync } from 'node:fs';
import { decodeField, sampleField, evalSample, PROBE_STRIDE } from '../../src/render/probes/field';
const [, , volName = 'apadana', yRel = '1.5', nxs = '0', nzs = '-1', out = 'probe_slice.csv'] = process.argv;
const meta = JSON.parse(readFileSync('public/generated/probes.json', 'utf8')), b = readFileSync('public/generated/probes.f16');
const F = { volumes: meta.volumes, data: decodeField(new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2)), count: meta.count, normalBias: meta.normalBias, tier: meta.tier, note: meta.note } as any;
const v = F.volumes.find((q: any) => q.name === volName || q.building === volName) ?? F.volumes[0];
const [rx0, rx1, rz0, rz1] = v.roof, y = v.yLo[1] + +yRel, nx = +nxs, nz = +nzs;
const rows = ['x,z,ES,EU,w'];
for (let z = rz0; z <= rz1; z += 0.25) for (let x = rx0; x <= rx1; x += 0.25) {
  const s = sampleField(F, x, y, z, nx, 0, nz); if (!s) continue;
  const [ES, EU] = evalSample(s.s, nx, 0, nz); rows.push(`${x.toFixed(2)},${z.toFixed(2)},${ES.toExponential(3)},${EU.toExponential(3)},${s.w.toFixed(3)}`);
}
writeFileSync(out, rows.join('\n'));
console.log(`volume ${v.name ?? v.building} roof ${v.roof.map((q: number) => q.toFixed(1)).join(' ')} y ${y.toFixed(2)} (${rows.length - 1} samples), stride ${PROBE_STRIDE}`);
