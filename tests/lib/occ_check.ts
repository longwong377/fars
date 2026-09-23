// dev (D-157): the sky specular's occlusion on the CPU at floor points of a view (the shader's lookup: the probe field's
// L1 sky irradiance for the reflection direction r at q = p + r·normalBias, over the open sky's (1 + r_y)/2 = the
// visibility; then envmap.specularOcclusion's cone fit for the red floor's roughness). usage: npx tsx tests/lib/occ_check.ts
import { readFileSync } from 'node:fs';
import { decodeField, sampleField, evalSample } from '../../src/render/probes/field';
const meta = JSON.parse(readFileSync('public/generated/probes.json', 'utf8')), b = readFileSync('public/generated/probes.f16');
const F = { volumes: meta.volumes, data: decodeField(new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2)), count: meta.count, normalBias: meta.normalBias } as any;
const so = (vis: number, nv: number, r: number) => Math.min(1, Math.max(0, Math.pow(Math.min(1, Math.max(0, nv)) + vis, 2 ** (-16 * r - 1)) - 1 + vis));
// views as in tests/e2e/dbg_surf.spec.ts: grid east, north, floor height (m), eye 1.6 m, true azimuth (deg)
const views: [string, number, number, number, number][] = [['apadana-hall-in', 10.55, 12.4, 3.0, 170], ['hadish-hall', 22, -150, 6.0, 161]];
for (const [name, e, nth, floor, az] of views) {
  const yaw = -((az - 341) * Math.PI) / 180, fwd = [-Math.sin(yaw), 0, -Math.cos(yaw)], cam = [e, floor + 1.6, -nth];
  for (const d of [3, 5, 10, 20, 30]) {
    const p = [cam[0] + fwd[0] * d, floor + 0.01, cam[2] + fwd[2] * d];
    const v = [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]], l = Math.hypot(...v), vd = v.map(x => x / l);
    const r = [vd[0], -vd[1], vd[2]], nv = -vd[1]; // reflect about +y; n·v with v toward the eye
    const s = sampleField(F, p[0], p[1], p[2], r[0], r[1], r[2]);
    const open = Math.max(0.05, (1 + r[1]) / 2);
    if (!s) { console.log(`${name} floor ${d} m: no volume`); continue; }
    const [eS] = evalSample(s.s, r[0], r[1], r[2]);
    const vis = Math.min(1, (s.w * eS + (1 - s.w) * open) / open);
    console.log(`${name} floor ${d} m: n·v ${nv.toFixed(3)} w ${s.w.toFixed(2)} vis ${vis.toFixed(4)} occlusion (rough 0.35) ${so(vis, nv, 0.35).toFixed(4)} (rough 0.55) ${so(vis, nv, 0.55).toFixed(4)}`);
  }
}
// the fit itself: open (vis 1), a portico (0.3–0.5), a hall (0.003–0.03), for the polished frames (0.18), the red floor (0.35), carved limestone (0.55)
for (const vis of [1, 0.5, 0.3, 0.1, 0.03, 0.003]) console.log(`vis ${vis}: ` + [0.18, 0.35, 0.55].map(r => `r ${r}: n·v 0.1 → ${so(vis, 0.1, r).toFixed(3)}, 0.5 → ${so(vis, 0.5, r).toFixed(3)}, 0.9 → ${so(vis, 0.9, r).toFixed(3)}`).join(' | '));
