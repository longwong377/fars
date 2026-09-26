import { readFileSync } from 'node:fs';
process.chdir('/home/user/fars');
const { Ring, Terrain } = await import('/home/user/fars/src/terrain/heightfield');
const { Physics } = await import('/home/user/fars/src/player/physics');
const { Player } = await import('/home/user/fars/src/player/player');
const meta: any = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: string) => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
const P = await Physics.create();
// yaw convention measured: -PI/2 -> +x; so +PI/2 -> -x; 0 -> -z; PI -> +z
const cases: [string, (s: number) => [number, number], number][] = [
  ['W edge outward (east -1984)', s => [-1930, s], Math.PI / 2],
  ['N edge outward (north +1984, z -1984)', s => [s, -1930], 0],
  ['S edge outward (north -1984)', s => [s, 1930], Math.PI],
  ['E edge inward (from east 2040)', s => [2040, s], Math.PI / 2],
  ['mid->far outward (east +9984)', s => [9930, s], -Math.PI / 2],
];
for (const [name, start, yaw] of cases) {
  let falls = 0, n = 0, blockedN = 0; const at: string[] = [];
  for (let k = 0; k < 16; k++) {
    const s = -1800 + k * 240; const [x0, z0] = start(s);
    P.updateTerrain(T, { x: x0, y: 0, z: z0 }); P.step(1e-4);
    const pl = new Player(P, x0, (P.castRayDown(x0, z0, 6000) ?? T.heightAt(x0, z0)) + 0.05, z0);
    for (let i = 0; i < 30; i++) { pl.update(1 / 30, { forward: 0, right: 0, run: false, yaw: 0, pitch: 0 }); P.updateTerrain(T, pl.position); P.step(1 / 30); }
    const p0 = { ...pl.position }; let fell = false;
    for (let i = 0; i < 30 * 80; i++) {
      pl.update(1 / 30, { forward: 1, right: 0, run: false, yaw, pitch: 0 }); P.updateTerrain(T, pl.position); P.step(1 / 30);
      if (pl.feetY - T.heightAt(pl.position.x, pl.position.z) < -5) { fell = true; break; }
    }
    const moved = Math.hypot(pl.position.x - p0.x, pl.position.z - p0.z);
    n++; if (fell) { falls++; at.push(`${pl.position.x.toFixed(0)},${pl.position.z.toFixed(0)}`); } else if (moved < 60) blockedN++;
  }
  console.log(`${name}: fell through ${falls}/${n}; stopped (< 60 m in 80 s, slope/obstacle) ${blockedN}/${n}; e.g. ${at.slice(0, 3).join(' ')}`);
}
