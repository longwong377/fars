// dev (D-156, triage item 12): sunlit cumulus against the sky and the sunlit ground, old lighting (session 3: single
// scattering × 6, powder floor, irradiance ambient, 32 steps over the span) against the new (cloudLight.ts), on the real
// cloud density (cloudCover.ts density, the shader's) at a moment's geometry. Renderer radiance units before exposure.
// Usage: npx tsx tools/dev/cloud_compare.ts [day] [hour] [viewAzTrue] [cover]
import * as THREE from 'three/webgpu';
import { SkySystem } from '../../src/sky/skySystem';
import { WorldClock } from '../../src/core/clock';
import { density, CLOUD, localCoverageUniform, localWeatherFactor } from '../../src/sky/cloudCover';
import { sunScatter, ambientAt, lightSamples, CLOUD_MARCH, EMPTY_STRIDE, cloudPhase, hg } from '../../src/sky/cloudLight';
import { domeRadiance } from '../../src/sky/horizon';
import table from '../../src/data/cloud_cover_table.json';
const [dayS = '25', hourS = '8.5', azS = '341', covS = '0.3'] = process.argv.slice(2);
const sky = new SkySystem(new THREE.Scene(), 256, 'high'); const cam = new THREE.Vector3(-43.9, 1.6, -128);
const c = new WorldClock(+dayS, +hourS); for (let i = 0; i < 2; i++) sky.update(c.jdUT, cam, +covS, 0.25, { ms: 2, fromDeg: 270, tSeconds: 0 }, new THREE.Vector3(0, 0, -1));
const Y = (v: number[]) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
const sd = sky.state.sunDir, sunI = sky.sun.intensity, sunC = [sky.sun.color.r, sky.sun.color.g, sky.sun.color.b].map(v => v * sunI);
const hc = sky.hemi.color, hI = sky.hemi.intensity, gc = sky.hemi.groundColor;
const skyL = [hc.r, hc.g, hc.b].map(v => (v * hI) / Math.PI), grL = [gc.r, gc.g, gc.b].map(v => (v * hI) / Math.PI), oldAmb = [hc.r, hc.g, hc.b].map(v => v * hI * 0.55);
const u = localCoverageUniform(+covS, (table as any).dome, localWeatherFactor(0, 0));
const P = { turbidity: (sky.sky.turbidity as any).value, rayleigh: (sky.sky.rayleigh as any).value, mieCoefficient: (sky.sky.mieCoefficient as any).value, mieDirectionalG: (sky.sky.mieDirectionalG as any).value };
const view = (sky as any).view, kP = (sky as any).uKP.value, kT = view ? (sky as any).uKT.value / view.irradianceY : 0;
const ground = Y([0, 1, 2].map(i => (0.25 * (sunC[i] * Math.max(0, sd.y) + [hc.r, hc.g, hc.b][i] * hI * 0.8)) / Math.PI));
const D = Math.PI / 180, az0 = ((+azS - 341) * Math.PI) / 180;
const rows: { e: number; a: number; oldY: number; newY: number; skyY: number; alpha: number }[] = [];
for (let e = 4; e <= 40; e += 3) for (let da = -40; da <= 40; da += 4) {
  const a = az0 + da * D, dir = [Math.sin(a) * Math.cos(e * D), Math.sin(e * D), -Math.cos(a) * Math.cos(e * D)];
  const t0 = CLOUD.base / dir[1], t1 = Math.min(CLOUD.top / dir[1], t0 + 22000), cosT = dir[0] * sd.x + dir[1] * sd.y + dir[2] * sd.z;
  const dens = (t: number, s = 0) => density(cam.x + dir[0] * t + sd.x * s, dir[1] * t + sd.y * s, cam.z + dir[2] * t + sd.z * s, u);
  // new (shader mirror): steps from the base, octaves, radiance ambient
  const [N, dt, NL] = CLOUD_MARCH.high, L = lightSamples(NL); let T = 1, col = [0, 0, 0], t = t0 + dt * 0.5, empty = 0;
  for (let i = 0; i < N && t <= t1; i++) { const d = dens(t); if (d > 1e-5) { let tau = 0; for (let j = 0; j < NL; j++) tau += dens(t, L.at[j]) * L.w[j]; const h = Math.min(1, Math.max(0, (dir[1] * t - CLOUD.base) / (CLOUD.top - CLOUD.base))); const ms = sunScatter(cosT, tau); const aa = Math.exp(-d * dt); col = col.map((v, k) => v + T * (sunC[k] * ms + ambientAt(h, skyL[k], grL[k])) * (1 - aa)); T *= aa; empty = 0; } else empty++; if (T < 0.02) break; t += empty > 1 ? dt * EMPTY_STRIDE : dt; }
  // old (session 3)
  const No = 32, dto = (t1 - t0) / No; let To = 1, co = [0, 0, 0]; const phase = cloudPhase(cosT, 0);
  for (let i = 0; i < No; i++) { const tt = t0 + dto * (i + 0.5), d = dens(tt); if (d > 1e-5) { let od = 0; for (let j = 0; j < 4; j++) od += dens(tt, (j + 0.5) * 180); const lt = Math.exp(-od * 180), pw = 1 - Math.exp(-d * 360), h = Math.min(1, Math.max(0, (dir[1] * tt - CLOUD.base) / (CLOUD.top - CLOUD.base))); const aa = Math.exp(-d * dto); co = co.map((v, k) => v + To * (sunC[k] * lt * phase * (pw * 0.8 + 0.2) * 6 + oldAmb[k] * (h * 0.6 + 0.4) * 0.9) * (1 - aa)); To *= aa; } if (To < 0.02) break; }
  const skyv = domeRadiance(dir as any, [sd.x, sd.y, sd.z], P, kP, kT, view);
  if (T < 0.5) rows.push({ e, a: da, oldY: Y(co) / (1 - To) , newY: Y(col) / (1 - T), skyY: Y(skyv), alpha: 1 - T });
}
rows.sort((p, q) => q.newY - p.newY); void hg;
const pct = (arr: number[], p: number) => arr.slice().sort((a, b) => a - b)[Math.floor(p * (arr.length - 1))];
console.log(`day ${dayS} ${hourS} h: sun ${sky.state.sunAlt.toFixed(1)}°, view az ${azS}°, cover ${covS} (uniform ${u.toFixed(3)}); sunlit ground (albedo 0.25) Y ${ground.toFixed(3)}; ${rows.length} rays in cloud`);
if (rows.length) {
  const nw = rows.map(r => r.newY), od = rows.map(r => r.oldY), sk = rows.map(r => r.skyY);
  console.log(`cloud radiance / sunlit ground: new p50 ${(pct(nw, 0.5) / ground).toFixed(2)} p90 ${(pct(nw, 0.9) / ground).toFixed(2)} max ${(pct(nw, 1) / ground).toFixed(2)} | old p50 ${(pct(od, 0.5) / ground).toFixed(2)} p90 ${(pct(od, 0.9) / ground).toFixed(2)} max ${(pct(od, 1) / ground).toFixed(2)}`);
  console.log(`cloud / sky behind it: new p50 ${pct(rows.map(r => r.newY / r.skyY), 0.5).toFixed(2)} | old p50 ${pct(rows.map(r => r.oldY / r.skyY), 0.5).toFixed(2)}; sky at those rays p50 Y ${pct(sk, 0.5).toFixed(3)}`);
}
