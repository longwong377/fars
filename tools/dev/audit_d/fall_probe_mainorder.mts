import { readFileSync } from 'node:fs';
process.chdir('/home/user/fars');
const { Ring, Terrain } = await import('/home/user/fars/src/terrain/heightfield');
const { Physics } = await import('/home/user/fars/src/player/physics');
const { Player } = await import('/home/user/fars/src/player/player');
const meta: any = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: string) => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
const P = await Physics.create();
let falls = 0, total = 0;
const lines: string[] = [];
for (let k = 0; k < 24; k++) {
  const z0 = -1900 + k * 160; const x0 = 1930;
  P.updateTerrain(T, { x: x0, y: 0, z: z0 }); P.step(1e-4);
  const pl = new Player(P, x0, (P.castRayDown(x0, z0, 6000) ?? T.heightAt(x0, z0)) + 0.05, z0);
  for (let i = 0; i < 30; i++) { pl.update(1 / 30, { forward: 0, right: 0, run: false, yaw: 0, pitch: 0 }); P.updateTerrain(T, pl.position); P.step(1 / 30); }
  let minOff = 0, fellAt: any = null, blocked = false; const xs = pl.position.x;
  for (let i = 0; i < 30 * 120; i++) {
    P.updateTerrain(T, pl.position); pl.update(1 / 30, { forward: 1, right: 0, run: false, yaw: -Math.PI / 2, pitch: 0 }); P.step(1 / 30);
    const off = pl.feetY - T.heightAt(pl.position.x, pl.position.z); minOff = Math.min(minOff, off);
    if (off < -3 && !fellAt) fellAt = [pl.position.x.toFixed(0), pl.position.z.toFixed(0)];
    if (off < -50) break;
  }
  const endOff = pl.feetY - T.heightAt(pl.position.x, pl.position.z);
  total++; if (fellAt) falls++;
  lines.push(`z0 ${z0}: from x ${xs.toFixed(0)} to ${pl.position.x.toFixed(0)}; min feet-vs-terrain ${minOff.toFixed(1)} m; end ${endOff.toFixed(1)} m; ${fellAt ? 'FELL THROUGH at ' + fellAt.join(',') : 'ok'}`);
}
console.log(lines.join('\n')); console.log(`fell through the ground on ${falls} of ${total} crossings of the near-ring collider edge (x = 1984 m)`);
