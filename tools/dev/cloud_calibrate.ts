// dev (D-156): the clouds' octave calibration K_MS (src/sky/cloudLight.ts): the reflectance of a thick homogeneous layer
// (τ 20) lit at 40°, seen from the sunward side, against a Lambertian surface; prints the K_MS for albedo 0.75.
// Usage: npx tsx tools/dev/cloud_calibrate.ts
import { K_MS, layerRadiance } from '../../src/sky/cloudLight';
const D = Math.PI / 180, lambert = Math.sin(40 * D) / Math.PI; let sum = 0, n = 0; const rows: string[] = [];
for (const e of [-30, -60, -85]) for (const phi of [180, 120]) { const r = layerRadiance(0.02, 1000, 40, e, phi) / lambert; rows.push(`e ${e} φ ${phi}: ${r.toFixed(3)}`); sum += r; n++; }
const mean = sum / n;
console.log(rows.join('\n'), `\nmean albedo-equivalent ${mean.toFixed(3)} at K_MS ${K_MS}; K_MS for 0.75: ${((0.75 / mean) * K_MS).toFixed(2)}`);
for (const [tau, label] of [[5, 'τ 5'], [2, 'τ 2']] as const) { let s = 0; for (const e of [-30, -60, -85]) s += layerRadiance(0.02, tau / 0.02, 40, e, 180) / lambert; console.log(`${label}: ${(s / 3).toFixed(3)}`); }
console.log('base seen from below (τ 20):', (layerRadiance(0.02, 1000, 40, 60, 180, false) / lambert).toFixed(3));
