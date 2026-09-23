// dev (D-156): fit the clouds' octave weight K_MS and diffusion weight K_D (src/sky/cloudLight.ts) so that a thick
// homogeneous layer (τ 20) lit at 40° reflects like albedo 0.75 toward the sunward side (mean over views from above)
// and shows its base, seen from below, at 0.25: Bohren's two-stream transmittance 2 / (2 + (1 − g) τ) for τ ≈ 40, the
// middle of cumulus optical depths (20–100). (Fitting Bohren's 0.40 for the layer's own τ 20 needs a negative octave
// weight: the local diffusion source already reflects strongly at the top, and neither term knows the layer's depth.)
// Usage: npx tsx tools/dev/cloud_calibrate.ts
import { K_MS, K_D, G_DROPLET, layerRadiance } from '../../src/sky/cloudLight';
const D = Math.PI / 180, lambert = Math.sin(40 * D) / Math.PI, R_T = 0.75, T_T = 2 / (2 + (1 - G_DROPLET) * 40);
const top = (kms: number, kd: number) => { let s = 0, n = 0; for (const e of [-30, -60, -85]) for (const phi of [180, 120]) { s += layerRadiance(0.02, 1000, 40, e, phi, true, kms, kd) / lambert; n++; } return s / n; };
const base = (kms: number, kd: number) => { let s = 0, n = 0; for (const e of [60, 85]) for (const phi of [180, 0]) { s += layerRadiance(0.02, 1000, 40, e, phi, false, kms, kd) / lambert; n++; } return s / n; };
const Ro = top(1, 0), Rd = top(0, 1), To = base(1, 0), Td = base(0, 1);
// R_T = kms Ro + kd Rd ; T_T = kms To + kd Td
const det = Ro * Td - Rd * To, kms = (R_T * Td - Rd * T_T) / det, kd = (Ro * T_T - R_T * To) / det;
console.log(`unit responses: top octaves ${Ro.toFixed(4)} diffusion ${Rd.toFixed(4)}; base octaves ${To.toFixed(4)} diffusion ${Td.toFixed(4)}`);
console.log(`fit for R ${R_T}, T ${T_T.toFixed(3)}: K_MS ${kms.toFixed(3)} K_D ${kd.toFixed(3)} (current ${K_MS}, ${K_D}: R ${top(K_MS, K_D).toFixed(3)} T ${base(K_MS, K_D).toFixed(3)})`);
for (const tau of [2, 5, 50]) console.log(`τ ${tau}: R ${(((l: number) => l)(0) + [-30, -60, -85].reduce((s, e) => s + layerRadiance(0.02, tau / 0.02, 40, e, 180, true, kms, kd) / lambert, 0) / 3).toFixed(3)} T ${([60, 85].reduce((s, e) => s + layerRadiance(0.02, tau / 0.02, 40, e, 180, false, kms, kd) / lambert, 0) / 2).toFixed(3)} (Bohren R ${(1 - 2 / (2 + (1 - G_DROPLET) * tau)).toFixed(3)} T ${(2 / (2 + (1 - G_DROPLET) * tau)).toFixed(3)})`);
