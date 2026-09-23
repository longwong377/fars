// dev (D-156): what a camera view should show of the terrain horizon's shadow and the air, from the CPU models alone
// (Terrain rings, the horizon map, aerial.ts), to measure a render against. For image columns across the frame it casts
// the view rays onto the terrain rings and prints, per column, the rows where the terrain turns from the mountain's shadow
// to sunlight (or back), with the distance and the air's transmittance there.
// Usage: npx tsx tools/dev/view_predict.ts east north eyeAboveGround azTrue pitch day hour [fov=40] [W=960] [H=540] [haze=0.25] [eye world y]
import * as THREE from 'three/webgpu';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { Ring, Terrain, TerrainMeta } from '../../src/terrain/heightfield';
import { decodeHorizonMap, curvatureDropOrigin } from '../../src/terrain/horizonMap';
import { SkySystem } from '../../src/sky/skySystem';
import { WorldClock } from '../../src/core/clock';
import { airOptics, opticalDepth } from '../../src/sky/aerial';

const a = process.argv.slice(2).map(Number);
const [E, N, eyeH, az, pitch, day, hour] = a, fov = a[7] || 40, W = a[8] || 960, H = a[9] || 540, haze = a[10] || 0.25, yAbs = a[11]; // yAbs: the eye's world y where architecture (not the DEM) is underfoot
const tmeta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: 'near' | 'mid' | 'far') => new Ring(tmeta.rings[k], new Uint16Array(readFileSync(`public/${tmeta.rings[k].file}`).buffer.slice(0)), tmeta.court_asl);
const T = new Terrain(tmeta, ring('near'), ring('mid'), ring('far'));
const hmeta = JSON.parse(readFileSync('public/generated/horizon_map.json', 'utf8'));
const MAP = decodeHorizonMap(hmeta, new Uint8Array(inflateSync(readFileSync(`public/${hmeta.file}`))));
const sky = new SkySystem(new THREE.Scene(), 256, 'test'); sky.setHorizonMap(MAP);
const x0 = E, z0 = -N, y0 = Number.isFinite(yAbs) ? yAbs : T.heightAt(x0, z0) + eyeH, cam = new THREE.Vector3(x0, y0, z0);
const c = new WorldClock(day, hour); for (let i = 0; i < 2; i++) sky.update(c.jdUT, cam, 0.05, haze, { ms: 2, fromDeg: 270, tSeconds: 0 }, new THREE.Vector3(-1, 0, 0));
const sd = sky.state.sunDir, o = airOptics({ haze });
console.log(`day ${day} ${hour} h: sun alt ${sky.state.sunAlt.toFixed(2)}°; eye (${x0}, ${y0.toFixed(1)}, ${z0}) asl ${(y0 + tmeta.court_asl).toFixed(1)}; eye sun visibility ${sky.eyeSunVisibility.toFixed(2)}`);
// camera basis as main.ts's view(): yaw = −(az − 341)°, pitch
const yaw = (-(az - 341) * Math.PI) / 180, pt = (pitch * Math.PI) / 180;
const fwd = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pt), Math.sin(pt), -Math.cos(yaw) * Math.cos(pt));
const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), up = new THREE.Vector3().crossVectors(right, fwd);
const th = Math.tan((fov * Math.PI) / 360), asp = W / H;
function hit(dir: THREE.Vector3): { t: number; p: THREE.Vector3 } | null {
  let t = 1, prev = 0;
  while (t < 140000) {
    const p = cam.clone().addScaledVector(dir, t);
    if (Math.abs(p.x) > 71000 || Math.abs(p.z) > 71000) return null;
    if (p.y <= T.heightAt(p.x, p.z)) { // refine
      let lo = prev, hi = t; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2, q = cam.clone().addScaledVector(dir, m); if (q.y <= T.heightAt(q.x, q.z)) hi = m; else lo = m; }
      return { t: hi, p: cam.clone().addScaledVector(dir, hi) };
    }
    prev = t; t += Math.max(0.5, t * 0.004);
  }
  return null;
}
if (process.env.PROFILE) { // the centre column: distance and the air's transmittance (G) per row band
  const px = W / 2, out: string[] = [];
  for (let py = 0; py < H; py += 6) {
    const sx = ((px + 0.5) / W) * 2 - 1, sy = 1 - ((py + 0.5) / H) * 2;
    const dir = fwd.clone().addScaledVector(right, sx * th * asp).addScaledVector(up, sy * th).normalize();
    const h = hit(dir); if (!h) continue;
    const zc = y0 + tmeta.court_asl + curvatureDropOrigin(x0, z0), zp = h.p.y + tmeta.court_asl + curvatureDropOrigin(h.p.x, h.p.z);
    out.push(`${py}:${(h.t / 1000).toFixed(1)}km/T${Math.exp(-opticalDepth(o, zc, zp, h.t)[1]).toFixed(2)}`);
  }
  console.log(`centre column (row: distance / transmittance G): ${out.join(' ')}`);
}
for (let px = 40; px < W; px += 110) {
  const rows: string[] = []; let last = -1;
  for (let py = 0; py < H; py += 1) {
    const sx = ((px + 0.5) / W) * 2 - 1, sy = 1 - ((py + 0.5) / H) * 2;
    const dir = fwd.clone().addScaledVector(right, sx * th * asp).addScaledVector(up, sy * th).normalize();
    const h = hit(dir); if (!h) continue;
    const v = sky.sunVisibilityAt(h.p.x, h.p.y + 0.3, h.p.z), s = v > 0.5 ? 1 : 0;
    if (s !== last) {
      const zc = y0 + tmeta.court_asl + curvatureDropOrigin(x0, z0), zp = h.p.y + tmeta.court_asl + curvatureDropOrigin(h.p.x, h.p.z);
      const tau = opticalDepth(o, zc, zp, h.t), Tg = Math.exp(-tau[1]);
      rows.push(`row ${py}: ${s ? 'SUN' : 'shade'} from ${(h.t / 1000).toFixed(2)} km (vis ${v.toFixed(2)}, T ${Tg.toFixed(2)})`);
      last = s;
    }
  }
  console.log(`column ${px}: ${rows.join(' | ')}`);
}
void sd;
