// dev (D-224): the colour of the light that reaches a cloud top (the D-116 model's sun at CLOUD_TOP + the clear sky's
// irradiance, weighted by USNO-C171's clear-sky lux) for a range of sun altitudes, and the overcast colour the sky system
// derives from it (the measured mean overcast CCT, 6358 K, scaled by the change from a noon sun: horizon.ts overcastChroma).
// Usage: npx tsx tools/dev/overcast_colour.ts [haze=0.25]
import { Atmosphere, aerosolTauFor, OBSERVER_ALT, xyToRenderer, daylightXY } from '../../src/sky/atmosphere';
import { extinctionK, sunNormalLux, skyLux } from '../../src/sky/illuminance';
import { CLOUD_TOP } from '../../src/sky/clouds';
import { overcastChroma, OVERCAST_CCT } from '../../src/sky/horizon';

const haze = Number(process.argv[2] ?? 0.25), k = extinctionK(haze);
const A = new Atmosphere(Math.round(aerosolTauFor(k) / 0.01) * 0.01), OVC = xyToRenderer(...daylightXY(OVERCAST_CCT));
const Y = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], n = (c: number[]) => c.map(x => (x / Y(c)).toFixed(3)).join(', ');
console.log(`haze ${haze}; ${OVERCAST_CCT} K daylight in the renderer's colour: ${n(OVC)}`);
for (const alt of [60, 40, 30, 10, 3, 0, -3, -6]) {
  const v = A.skyView(alt), t = A.sunColorAt(OBSERVER_ALT + CLOUD_TOP, alt), ty = Math.max(Y(t), 1e-30);
  const eS = sunNormalLux(alt, k) * Math.max(0, Math.sin((alt * Math.PI) / 180)), eK = skyLux(alt), irr = v.irradiance.map(x => x / v.irradianceY);
  const g = [0, 1, 2].map(i => (Math.max(0, t[i]) / ty) * eS + irr[i] * eK) as [number, number, number];
  console.log(`sun ${alt}°: light on the cloud top ${n(g)} (direct / diffuse ${(eS / eK).toFixed(2)}) → overcast ${overcastChroma(g, OVC).map(x => x.toFixed(3)).join(', ')}`);
}
