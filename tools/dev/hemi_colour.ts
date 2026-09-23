// dev (D-156): the skylight (hemisphere light) colour through the day with the physical sky by day, against the
// session-3 fixed day colour (0.75, 0.8, 0.9); both at luminance 0.796. Usage: npx tsx tools/dev/hemi_colour.ts
import * as THREE from 'three/webgpu';
import { SkySystem } from '../../src/sky/skySystem';
import { WorldClock } from '../../src/core/clock';
const sky = new SkySystem(new THREE.Scene(), 256, 'test'), cam = new THREE.Vector3(0, 1.6, 0);
for (const [d, h] of [[0, 6.5], [0, 8], [0, 10], [0, 12], [25, 16], [90, 12], [200, 12]]) {
  const c = new WorldClock(d, h); for (let i = 0; i < 2; i++) sky.update(c.jdUT, cam, 0.05, 0.25, { ms: 2, fromDeg: 270, tSeconds: 0 }, new THREE.Vector3(1, 0, 0));
  const k = sky.hemi.color, g = sky.hemi.groundColor;
  console.log(`day ${d} ${h} h sun ${sky.state.sunAlt.toFixed(1)}°: sky ${[k.r, k.g, k.b].map(v => v.toFixed(3)).join(', ')} (b/r ${(k.b / k.r).toFixed(2)}; old 1.20) ground ${[g.r, g.g, g.b].map(v => v.toFixed(3)).join(', ')}`);
}
