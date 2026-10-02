// D-324 dev probe (not shipped): the town's houses and the plain's villages at their three levels (the full near level within
// NEAR0, the middle ring to NEAR_R, the far level beyond), in the game's own surface materials and scans, on the terrain, lit by
// a sun with a shadow map and a sky hemisphere only (no sky model, probes, exposure, people): a page load of a minute for
// iterating on the house kit and its LODs. Relative looks only: the full world's render is the verification. Served by the
// tree's vite; driven by tools/dev/house_lab.mjs. Views (window.__shot): { cam: 'court:q_s1:3' | 'door:q_s1:3' | 'above:q_s1:3'
// | 'far:q_s1:<dist>:<height>:<bearing>' | 'village:<vi>:<dist>:<height>:<bearing>' | [x, z, eyeH, yaw (true, cw from N), pitch], fov, sunAz, sunAlt }
import * as THREE from 'three/webgpu';
import { loadScans } from '../../src/render/scans';
import { loadScanProps } from '../../src/render/scanProps';
import { Terrain } from '../../src/terrain/heightfield';
import { TerrainMesh } from '../../src/terrain/terrainMesh';
import { bakeTerrainDetail } from '../../src/terrain/terrainDetail';
import { PlainGround } from '../../src/world/plain/terrainPlain';
import { buildZones } from '../../src/world/plain/fields';
import { loadRivers } from '../../src/world/plain/data';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../../src/world/plain/villages';
import { VillageHouses } from '../../src/world/plain/villagehouses';
import { FireSystem } from '../../src/world/fire';
import { Settlement } from '../../src/world/settlement/build';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  // (?webgl: three's WebGL2 backend, for the cloud's SwiftShader Chromium whose WebGPU lacks texture-view swizzles)
  const adapter = P.has('webgl') ? null : await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: P.has('webgl'), ...(adapter ? { requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } : {}) } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1); r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  const t0 = performance.now();
  await loadScans('/'); await loadScanProps('/');
  const terrain = await Terrain.load('/');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  const tm = new TerrainMesh(terrain, 1); scene.add(tm.group);
  const rivers = await loadRivers(), canals = buildCanals(terrain, rivers.rivers, 1), villages = placeVillages(terrain, rivers.rivers, canals, 1);
  const zones = buildZones({ terrain, rivers: rivers.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })) });
  const detail = await bakeTerrainDetail(terrain), ground = new PlainGround(zones, detail);
  tm.group.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = ground.material; });
  const fire = new FireSystem(0);
  const town = new Settlement(null, terrain, fire, 'high'); scene.add(town.group);
  // s17 C1 (?fill): the town's fill (fillPlan.ts / fill.ts) and the households' tethered animals (settlement/tethers.ts)
  let fill: any = null, teth: any = null;
  if (P.has('fill')) { const { townFill, terraceFill } = await import('../../src/world/fillPlan'); const { WorldFill } = await import('../../src/world/fill'); const { TownTethers, townTethers } = await import('../../src/world/settlement/tethers');
    const items = [...townFill(town.plan.sites, 1).items, ...terraceFill(1)], gr = (e: number, n: number) => terrain.heightAt(e, -n);
    fill = new WorldFill(items, { ground: gr }); scene.add(fill.group); teth = new TownTethers(townTethers(town.plan.sites, items), gr); scene.add(teth.group); }
  const vh = new VillageHouses(villages, villages.map(v => villageCompounds(v, terrain, 1)), terrain, null, null, 1); scene.add(vh.group);
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.2), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 0.9);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.near = 1; sc.far = 3000; sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 60000);
  const dirOf = (az: number, alt: number) => { const psi = -((az - 341) * Math.PI) / 180, c = Math.cos(alt * Math.PI / 180); return new THREE.Vector3(-Math.sin(psi) * c, Math.sin(alt * Math.PI / 180), -Math.cos(psi) * c); };
  const H = (x: number, z: number) => terrain.heightAt(x, z);
  /** a view spec -> [x, z, eye y, grid bearing (cw from grid north = -z), pitch] */
  const camOf = (spec: any): [number, number, number, number, number] => {
    if (Array.isArray(spec)) return [spec[0], spec[1], H(spec[0], spec[1]) + spec[2], ((spec[3] - 341) % 360 + 360) % 360, spec[4]];
    const a = String(spec).split(':');
    if (a[0] === 'far' || a[0] === 'village') { const c = a[0] === 'far' ? town.plan.sites.find(x => x.id === a[1])!.frame.c : [villages[+a[1]].x, villages[+a[1]].y];
      const d = +a[2], h = +a[3], br = (+a[4] * Math.PI) / 180, x = c[0] + Math.sin(br) * d, z = -(c[1] + Math.cos(br) * d), gy = H(c[0], -c[1]);
      const yaw = ((Math.atan2(c[0] - x, (-c[1]) - z) * 180) / Math.PI), pitch = (Math.atan2(gy + 3 - (H(x, z) + h), d) * 180) / Math.PI; return [x, z, H(x, z) + h, ((180 - yaw) % 360 + 360) % 360, pitch]; }
    if (a[0] === 'brick') { const H2 = town.houses.find(q => q.s.id === a[1])!, g = H2.s.frame.c; town.nearUpdate(g[0], -g[1], 0, true);
      const L = [...H2.losses.values()], q = L[+a[2] % L.length], back = +(a[3] ?? 2.2), x = q[0] + q[3] * back, z = q[2] + q[4] * back, gb = (Math.atan2(-q[3], q[4]) * 180) / Math.PI;
      return [x, z, H(x, z) + 1.3, ((gb % 360) + 360) % 360, -8]; }
    if (a[0] === 'bench') { const H2 = town.houses.find(q => q.s.id === a[1])!, bs = H2.fixtures.filter(f => f.kind === 'bench'), f = bs[+a[2] % bs.length], d = +(a[3] ?? 2.4);
      const u = f.u + Math.cos(f.rot) * (0.5 + d), v = f.v + Math.sin(f.rot) * (0.5 + d), g = H2.s.grid(u, v), c = H2.s.grid(f.u, f.v), gb = (Math.atan2(c[0] - g[0], c[1] - g[1]) * 180) / Math.PI;
      return [g[0], -g[1], H(g[0], -g[1]) + 1.5, ((gb % 360) + 360) % 360, -18]; }
    const s = town.plan.sites.find(x => x.id === a[1])!, hs = s.plots.filter(p => p.door && (p.kind === 'house' || p.kind === 'house_large')), p = hs[+a[2] % hs.length];
    if (a[0] === 'court') { let su = 0, sv = 0, n = 0, lo = [1e9, 1e9];
      for (let k = 0; k < s.cell.length; k++) if (s.cell[k] === p.idx && s.sub[k] === 2) { const u = s.cu(k % s.W), v = s.cv((k / s.W) | 0); su += u; sv += v; n++; if (u + v < lo[0] + lo[1]) lo = [u, v]; }
      const g = s.grid(lo[0], lo[1]), c = s.grid(su / n, sv / n), gb = (Math.atan2(c[0] - g[0], c[1] - g[1]) * 180) / Math.PI; return [g[0], -g[1], H(g[0], -g[1]) + 1.6, ((gb % 360) + 360) % 360, +(a[3] ?? 8)]; }
    const d = s.doorPoints(p)!, nu = d.inside[0] - d.out[0], nv = d.inside[1] - d.out[1], back = a[0] === 'door' ? +(a[3] ?? 2.5) : -2;
    const cu = d.out[0] - nu * back, cv = d.out[1] - nv * back, g = s.grid(cu, cv), dg = s.grid(cu + nu, cv + nv), gb = (Math.atan2(dg[0] - g[0], dg[1] - g[1]) * 180) / Math.PI;
    return [g[0], -g[1], H(g[0], -g[1]) + (a[0] === 'door' ? 1.6 : 7), ((gb % 360) + 360) % 360, a[0] === 'door' ? 4 : -35];
  };
  (window as any).__sites = town.plan.sites.map(s => [s.id, s.frame.c[0].toFixed(0), s.frame.c[1].toFixed(0), s.plots.length]);
  (window as any).__shot = async (v: { cam: any; fov?: number; sunAz?: number; sunAlt?: number; day?: number; near?: boolean; near0?: number; farOnly?: boolean; hour?: number }) => {
    const [x, z, y, gb, pitch] = camOf(v.cam);
    cam.position.set(x, y, z); cam.rotation.set((pitch * Math.PI) / 180, -(gb * Math.PI) / 180, 0, 'YXZ'); cam.fov = v.fov ?? 60; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const d = dirOf(v.sunAz ?? 200, v.sunAlt ?? 45); sun.position.copy(cam.position).addScaledVector(d, 1000); sun.target.position.copy(cam.position);
    const far = typeof v.cam === 'string' && (v.cam.startsWith('far') || v.cam.startsWith('village')), half = far ? 400 : 70; sc.left = sc.bottom = -half; sc.right = sc.top = half; sc.updateProjectionMatrix();
    tm.update(cam.position);
    (town as any).near0 = v.near0 ?? 40; // (D-324b: 0 = every near tile at the middle ring, 1e4 = every one full: the 40 m hand-over)
    if (v.farOnly) { town.nearUpdate(1e7, 1e7, 0, true); vh.nearUpdate(1e7, 1e7, 0, true); } else { town.nearUpdate(x, z, 0, true); vh.nearUpdate(x, z, 0, true); }
    town.doors.update(0.1, cam.position, v.day ?? 100, 40, town.nearTile); vh.doors.update(0.1, cam.position, v.day ?? 100, 40, vh.nearTile);
    for (const m of (town as any).casters as THREE.Mesh[]) m.castShadow = true;
    if (fill) { fill.update([x, -z], v.hour ?? 10, 0, true); teth.update(1000, v.hour ?? 10, cam.position); }
    for (let i = 0; i < 3; i++) await r.renderAsync(scene, cam);
    return { errs: errs.slice(), cam: [x, z, y, gb, pitch].map(q => +q.toFixed(2)), near: { ...town.nearInfo }, vnear: { ...vh.nearInfo } };
  };
  (window as any).__ready = `built in ${((performance.now() - t0) / 1000).toFixed(0)} s`;
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
