// dev: CPU panoramas of the calibrated sky dome and an 18 % grey ground, through the real SkySystem.update() and three's
// AgX curve at the camera exposure of main.ts (skyVis 1, no fire). One band per hour: azimuth −180…180° about the sun
// (the sun in the middle, the antisolar point at both ends), elevation +50° … −8° (below 0: the lit ground).
// Usage: npx tsx tools/dev/sky_panorama.ts <day> <hour,hour,…> [out.png] [cloud] [haze]
import * as THREE from 'three/webgpu';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { SkySystem } from '../../src/sky/skySystem';
import { WorldClock } from '../../src/core/clock';
import { domeRadiance } from '../../src/sky/horizon';
import { exposureTarget } from '../../src/sky/exposure';
const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');

const [dayS, hoursS, out = 'shots/sky-panorama.png', cloudS = '0.05', hazeS = '0.25'] = process.argv.slice(2);
const day = +dayS, hours = hoursS.split(',').map(Number), cloud = +cloudS, haze = +hazeS;
const W = 720, H = 180;
const png = new PNG({ width: W, height: H * hours.length });
const sky = new SkySystem(new THREE.Scene(), 256, 'test');
const agx = agxFn();
for (let b = 0; b < hours.length; b++) {
  const c = new WorldClock(day, hours[b]);
  const cam = new THREE.Vector3(0, 0, 0);
  sky.update(c.jdUT, cam, cloud, haze, { ms: 2, fromDeg: 270, tSeconds: 0 }, new THREE.Vector3(1, 0, 0));
  const s = sky.state.sunDir, sun: [number, number, number] = [s.x, s.y, s.z];
  const P = { turbidity: sky.sky.turbidity.value as number, rayleigh: sky.sky.rayleigh.value as number, mieCoefficient: sky.sky.mieCoefficient.value as number, mieDirectionalG: sky.sky.mieDirectionalG.value as number };
  const kP = (sky as any).uKP.value as number, kTraw = (sky as any).uKT.value as number, view = (sky as any).view;
  const kT = view && kTraw > 0 ? kTraw / view.irradianceY : 0;
  const sinA = Math.max(0, Math.sin((sky.state.sunAlt * Math.PI) / 180));
  const sunE = sky.sun.visible ? sky.sun.intensity * sinA : 0;
  const X = exposureTarget(sunE, sky.hemi.intensity * 0.8, 1, sky.moonLight.intensity * 0.3, 0);
  const az0 = Math.atan2(s.z, s.x);
  // ground: an 18 % grey, horizontal, lit by the sun and the skylight (sky colour from above; three's hemisphere light)
  const hc = sky.hemi.color, sc = sky.sun.color;
  const g = [0, 1, 2].map(i => (0.18 * ((sky.sun.visible ? sky.sun.intensity * sinA : 0) * [sc.r, sc.g, sc.b][i] + sky.hemi.intensity * [hc.r, hc.g, hc.b][i])) / Math.PI);
  for (let y = 0; y < H; y++) {
    const el = (50 - (58 * y) / (H - 1)) * (Math.PI / 180);
    for (let x = 0; x < W; x++) {
      const az = az0 + ((x / (W - 1)) * 2 - 1) * Math.PI;
      let L: number[];
      if (el < 0) L = g;
      else L = domeRadiance([Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)], sun, P, kP, kT, view);
      const o = ((b * H + y) * W + x) * 4, t = agx(L.map(v => v * X));
      png.data[o] = t[0]; png.data[o + 1] = t[1]; png.data[o + 2] = t[2]; png.data[o + 3] = 255;
    }
  }
  const gl = agx(g.map(v => v * X));
  console.log(`h ${hours[b].toFixed(2)} sun ${sky.state.sunAlt.toFixed(2)}° | lux ${sky.lux.toPrecision(3)} gain ${sky.gain.toPrecision(3)} X ${X.toFixed(2)} | sunI ${sky.sun.intensity.toPrecision(3)} hemiI ${sky.hemi.intensity.toPrecision(3)} moonI ${sky.moonLight.intensity.toPrecision(3)} | kP ${kP.toPrecision(3)} kT ${kT.toPrecision(3)} | ground sRGB ${gl.join(',')} | hemi rgb ${[hc.r, hc.g, hc.b].map(v => v.toFixed(2)).join(',')} sun rgb ${[sc.r, sc.g, sc.b].map(v => v.toFixed(2)).join(',')}`);
}
writeFileSync(out, PNG.sync.write(png));
console.log('wrote', out);

/** three r186 agxToneMapping + sRGB encode (mat3(a, b, c) is column-major: M·v = a·v.x + b·v.y + c·v.z) */
function agxFn() {
  const mul = (m: number[][], v: number[]) => [0, 1, 2].map(i => m[0][i] * v[0] + m[1][i] * v[1] + m[2][i] * v[2]);
  const S2R = [[0.6274, 0.0691, 0.0164], [0.3293, 0.9195, 0.0880], [0.0433, 0.0113, 0.8956]];
  const R2S = [[1.6605, -0.1246, -0.0182], [-0.5876, 1.1329, -0.1006], [-0.0728, -0.0083, 1.1187]];
  const IN = [[0.856627153315983, 0.137318972929847, 0.11189821299995], [0.0951212405381588, 0.761241990602591, 0.0767994186031903], [0.0482516061458583, 0.101439036467562, 0.811302368396859]];
  const OUT = [[1.1271005818144368, -0.1413297634984383, -0.14132976349843826], [-0.11060664309660323, 1.157823702216272, -0.11060664309660294], [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405]];
  const lo = -12.47393, hi = 4.026069;
  const con = (x: number) => { const x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; };
  const enc = (v: number) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)));
  return (c: number[]) => {
    let v = mul(IN, mul(S2R, c)).map(x => Math.min(1, Math.max(0, (Math.log2(Math.max(x, 1e-10)) - lo) / (hi - lo))));
    v = mul(OUT, v.map(con)).map(x => Math.pow(Math.max(0, x), 2.2));
    return mul(R2S, v).map(x => enc(Math.min(1, Math.max(0, x))));
  };
}
