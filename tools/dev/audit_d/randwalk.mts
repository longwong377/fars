import { readFileSync } from 'node:fs';
process.chdir('/home/user/fars');
const { Ring, Terrain } = await import('/home/user/fars/src/terrain/heightfield');
const { Physics } = await import('/home/user/fars/src/player/physics');
const { Player } = await import('/home/user/fars/src/player/player');
const { buildTerrace } = await import('/home/user/fars/src/arch/terrace');
const { buildMeshes } = await import('/home/user/fars/src/arch/meshes');
const { NavGrid, NAV } = await import('/home/user/fars/src/people/navgrid');
const meta: any = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: string) => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
const P = await Physics.create(); P.updateTerrain(T, { x: 0, y: 0, z: 0 });
buildMeshes((buildTerrace() as any).parts, P); P.step(1 / 60);
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const { w, h, cell, e0, n0 } = NAV;
let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const N = +(process.argv[2] ?? 60); const res: any[] = []; let ok = 0, stuck = 0, fell = 0, nopath = 0;
const x0 = 0.1, z0 = -80; // forecourt
const pl = new Player(P, x0, P.castRayDown(x0, z0, 400) ?? 0, z0);
const step = (yawDeg: number, fwd: number, dt: number) => { P.updateTerrain(T, pl.position); pl.update(dt, { forward: fwd, right: 0, run: false, yaw: -((yawDeg - 341) * Math.PI) / 180, pitch: 0 }); P.step(Math.max(1 / 240, dt)); };
for (let i = 0; i < 30; i++) step(0, 0, 1 / 30);
const walkTo = (east: number, north: number, tol: number) => { let t = 0, lp = 0, best = Infinity; while (t < 240) { const p = pl.position, de = east - p.x, dn = north + p.z, d = Math.hypot(de, dn); if (d < tol) return true; if (d < best - 0.05) { best = d; lp = t; } if (t - lp > 4) return false; step(Math.atan2(de, dn) * 180 / Math.PI + 341, 1, 1 / 30); t += 1 / 30; } return false; };
let tries = 0;
while (res.length < N && tries < N * 50) {
  tries++; const k = Math.floor(rnd() * w * h); if (nav.hcm[k] === -32768) continue; const hh = nav.hcm[k] / 100; const e = e0 + ((k % w) + .5) * cell, n = n0 + (Math.floor(k / w) + .5) * cell; if (!(hh > -2 && e > -45 && e < 225 && n > -215 && n < 160)) continue; // Terrace top only
  const pos: [number, number] = [pl.position.x, -pl.position.z]; const path = nav.findPath(pos, [e, n]);
  if (!path) { nopath++; res.push({ e, n, r: 'nopath' }); continue; }
  pl.maxFall = 0; let good = true;
  for (const [q, [we, wn]] of path.slice(1).entries()) { if (!walkTo(we, wn, q === path.length - 2 ? 0.5 : 0.2)) { good = false; break; } }
  if (!good) { stuck++; res.push({ e: +e.toFixed(1), n: +n.toFixed(1), r: 'stuck', at: [+pl.position.x.toFixed(1), +(-pl.position.z).toFixed(1)], y: +pl.feetY.toFixed(2) });
    // recover: teleport back to forecourt
    pl.teleport(x0, P.castRayDown(x0, z0, 400) ?? 0, z0); for (let i = 0; i < 10; i++) step(0, 0, 1 / 30); continue; }
  if (pl.maxFall >= 0.6) { fell++; res.push({ e, n, r: 'fall', f: pl.maxFall }); } else ok++;
}
console.log(`random Terrace targets: ${res.length}; reached ${ok}; stuck ${stuck}; fall>0.6 m ${fell}; no path ${nopath}`);
for (const r of res.slice(0,0).filter(r => r.r !== undefined && r.r !== 'ok')) console.log(JSON.stringify(r));
const st = res.filter(r => r.r === 'stuck'); const byAt: Record<string, number> = {}; for (const r of st) { const k = `${Math.round(r.at[0] / 5) * 5},${Math.round(r.at[1] / 5) * 5}`; byAt[k] = (byAt[k] ?? 0) + 1; }
console.log('stuck at (5 m cells):', JSON.stringify(byAt)); console.log('targets stuck:', JSON.stringify(st.map(r => [r.e, r.n, r.y])));
