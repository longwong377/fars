import * as THREE from 'three/webgpu';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { SkySystem } from '../../src/sky/skySystem';
import { WorldClock } from '../../src/core/clock';
import { decodeHorizonMap } from '../../src/terrain/horizonMap';
import { exposureTarget } from '../../src/sky/exposure';
import { airOptics, visibilityKm, opticalDepth } from '../../src/sky/aerial';
const root = '';
const hmeta = JSON.parse(readFileSync(root + 'public/generated/horizon_map.json', 'utf8'));
const MAP = decodeHorizonMap(hmeta, new Uint8Array(inflateSync(readFileSync(root + 'public/' + hmeta.file))));
const sky = new SkySystem(new THREE.Scene(), 256, 'test');
sky.setHorizonMap(MAP);
const Y = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const cam = new THREE.Vector3(-40.2, 1.6, -122.45);
for (const [day, hour, haze] of [[0, 5.4, 0.25], [0, 5.85, 0.25], [0, 6.2, 0.25], [0, 6.45, 0.25], [0, 7, 0.25], [0, 9, 0.25], [0, 11, 0.25], [25, 16, 0.25], [0, 19.25, 0.25], [5, 22.5, 0.25]] as const) {
  const c = new WorldClock(day, hour);
  for (let i = 0; i < 2; i++) sky.update(c.jdUT, cam, 0.05, haze, { ms: 2, fromDeg: 270, tSeconds: 0 }, new THREE.Vector3(-1, 0, 0));
  const sinA = Math.max(0, Math.sin((sky.state.sunAlt * Math.PI) / 180));
  const sunE = sky.sun.visible ? sky.sun.intensity * sinA : 0;
  const X = exposureTarget(sunE, sky.hemi.intensity * 0.8, 1, sky.moonLight.intensity * 0.3, 0);
  const Xv = exposureTarget(sunE * sky.eyeSunVisibility, sky.hemi.intensity * 0.8, 1, sky.moonLight.intensity * 0.3, 0);
  const air = sky.air, J0 = air.jAt(Math.max(0, (sky.state.sunAlt + 1) * Math.PI / 180)), J90 = air.jAt(Math.PI / 2), J180 = air.jAt(Math.PI), A = air.jAmb.value;
  console.log(`day ${day} ${hour.toFixed(2)} sun ${sky.state.sunAlt.toFixed(1)}° eyeVis ${sky.eyeSunVisibility.toFixed(2)} lux ${sky.lux.toPrecision(3)} gain ${sky.gain.toPrecision(3)} X(main) ${X.toFixed(2)} X(vis) ${Xv.toFixed(2)} | J0 ${J0.map(v => v.toPrecision(3)).join(',')} J90 ${J90.map(v => v.toPrecision(3)).join(',')} J180 ${J180.map(v => v.toPrecision(3)).join(',')} Jamb ${[A.r, A.g, A.b].map(v => v.toPrecision(3)).join(',')} | horizon ${[sky.horizon.r, sky.horizon.g, sky.horizon.b].map(v => v.toPrecision(3)).join(',')} | sunI ${sky.sun.intensity.toPrecision(3)} hemiI ${sky.hemi.intensity.toPrecision(3)}`);
}
for (const s of [{ haze: 0.15 }, { haze: 0.25 }, { haze: 0.35 }, { haze: 0.72, dust: 1 }, { haze: 0.85, mist: 1 }, { haze: 0.5, rain: 1 }]) {
  const o = airOptics(s); const t10 = opticalDepth(o, 1600, 1600, 10000);
  console.log(JSON.stringify(s), 'V', visibilityKm(o).toFixed(1), 'km; veil at 10 km (G)', (1 - Math.exp(-t10[1])).toFixed(3), 'rgb', t10.map(v => (1 - Math.exp(-v)).toFixed(3)).join(','));
}
