import { readFileSync } from 'node:fs';
process.chdir('/home/user/fars');
const { Ring, Terrain } = await import('/home/user/fars/src/terrain/heightfield');
const { Physics } = await import('/home/user/fars/src/player/physics');
const { Player } = await import('/home/user/fars/src/player/player');
const meta: any = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: string) => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
const P = await Physics.create();
// 1) physics ray vs rendered height, sampled per band
for (const [lo, hi] of [[0, 1900], [1984, 2040], [2100, 9900], [9984, 10200], [10300, 30000]]) {
  let worst = 0, sum = 0, n = 0;
  for (let i = 0; i < 200; i++) {
    const r = lo + (hi - lo) * ((i * 0.618) % 1), a = i * 2.39996;
    const x = r * Math.cos(a), z = r * Math.sin(a);
    P.updateTerrain(T, { x, y: 0, z }); P.step(1e-4);
    const hit = P.castRayDown(x, z, 6000); if (hit === null) { console.log('NO GROUND at', x, z); continue; }
    const d = Math.abs(hit - T.heightAt(x, z)); worst = Math.max(worst, d); sum += d; n++;
  }
  console.log(`band ${lo}-${hi} m (Chebyshev-ish radius): physics vs rendered height mean ${(sum / n).toFixed(2)} m, worst ${worst.toFixed(2)} m`);
}
// 2) walk across the near->mid collider swap (x = 1984) and the mid->far swap (x = 9984) along a few lines
for (const [x0, z0, yawDeg] of [[1940, 300, -90], [1940, -800, -90], [9940, 0, -90], [300, 1940, 180]] as [number, number, number][]) {
  P.updateTerrain(T, { x: x0, y: 0, z: z0 }); P.step(1e-4);
  const pl = new Player(P, x0, (P.castRayDown(x0, z0, 6000) ?? T.heightAt(x0, z0)) + 0.05, z0);
  for (let i = 0; i < 30; i++) { pl.update(1 / 30, { forward: 0, right: 0, run: false, yaw: 0, pitch: 0 }); P.updateTerrain(T, pl.position); P.step(1 / 30); }
  pl.maxFall = 0; let worstOff = 0, lost = false;
  for (let i = 0; i < 30 * 90; i++) {
    pl.update(1 / 30, { forward: 1, right: 0, run: false, yaw: yawDeg * Math.PI / 180, pitch: 0 }); P.updateTerrain(T, pl.position); P.step(1 / 30);
    const off = pl.feetY - T.heightAt(pl.position.x, pl.position.z); if (Math.abs(off) > Math.abs(worstOff)) worstOff = off;
    if (off < -3) { lost = true; break; }
  }
  console.log(`walk from (${x0},${z0}) yaw ${yawDeg}: now (${pl.position.x.toFixed(0)}, ${pl.position.z.toFixed(0)}), worst feet-vs-rendered ${worstOff.toFixed(2)} m, maxFall ${pl.maxFall.toFixed(2)}, fell through: ${lost}`);
}
