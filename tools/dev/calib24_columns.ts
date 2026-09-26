// §8.1 calibration (D-230): which Apadana columns stand in photograph #24? Each column shaft seen above the Terrace wall in
// the photo gives an azimuth (its pixel column through the solved camera) and, from its top's elevation, a distance if the
// shaft stands to full height; this lists the model's column positions near each ray and says which the Now view keeps
// standing (src/data/now_view.json apadana_columns_standing, D-201 RECOLLECTION). Run: npx tsx tools/dev/calib24_columns.ts
import { buildTerrace } from '../../src/arch/terrace';
import now from '../../src/data/now_view.json';

const CAM = { e: -166.644, n: 108.873, zAboveCourt: -11.895 + 1.6, az: 117.006, pitch: 7.473, f: 1461.47, cx: 750, cy: 452.5 };
// shaft tops read on the photo (x, top y), left to right; the first two carry capital fragments (animal protomes)
const PHOTO = [[336, 398, 'capital fragment'], [421, 420, 'capital fragment'], [494, 360, 'shaft'], [574, 392, 'shaft'], [733, 403, 'shaft'], [782, 420, 'shaft']] as const;
const { parts } = buildTerrace() as any;
const cols = parts.filter((p: any) => p.type === 'column' && p.building === 'apadana');
const standing: number[][] = (now as any).rules.find((r: any) => r.id === 'apadana_columns_standing').select.at;
const frag: number[][] = (now as any).rules.find((r: any) => r.id === 'apadana_columns_fragment').select.at;
const tag = (c: number[]) => standing.some(s => Math.hypot(s[0] - c[0], s[1] - c[1]) < 0.5) ? 'NOW standing' : frag.some(s => Math.hypot(s[0] - c[0], s[1] - c[1]) < 0.5) ? 'NOW fragment' : '';
console.log(`${cols.length} Apadana columns in the model; Now view: ${standing.length} standing, ${frag.length} fragments`);
for (const [x, y, what] of PHOTO) {
  const azTrue = CAM.az + (Math.atan((x - CAM.cx) / CAM.f) * 180) / Math.PI, elev = CAM.pitch + (Math.atan((CAM.cy - y) / CAM.f) * 180) / Math.PI;
  const g = ((azTrue - 341) * Math.PI) / 180, ux = Math.sin(g), uy = Math.cos(g);
  const near = cols.map((p: any) => { const dx = p.c[0] - CAM.e, dy = p.c[1] - CAM.n, along = dx * ux + dy * uy, off = dx * uy - dy * ux; return { c: p.c, along, off, top: p.y0 + p.order.height - p.order.capitalH }; }) // the capital's seat (the Now view draws shafts to it)
    .filter((q: any) => Math.abs(q.off) < 2.5).sort((a: any, b: any) => a.along - b.along);
  console.log(`photo x ${x} (${what}): azimuth ${azTrue.toFixed(1)}° true, top at ${elev.toFixed(2)}° up` +
    ` → full-height distance ${near[0] ? ((near[0].top - CAM.zAboveCourt) / Math.tan((elev * Math.PI) / 180)).toFixed(0) : '?'} m; on the ray (±2.5 m): ` +
    (near.map((q: any) => `(${q.c[0].toFixed(1)}, ${q.c[1].toFixed(1)}) at ${q.along.toFixed(0)} m off ${q.off.toFixed(1)}, top ${(Math.atan((q.top - CAM.zAboveCourt) / q.along) * 180 / Math.PI).toFixed(2)}° ${tag(q.c)}`).join('; ') || 'none'));
}
