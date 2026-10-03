// D-530 dev probe (not shipped): the fire lab. V1's light lab (src/render/probes/light_lab.ts: SkySystem, the post pipeline at
// `high`, the light probes and the outdoor field, main.ts's exposure law and frame meter) plus what the light lab leaves out:
// the fires (FireSystem with its forward lights and the composite's deferred term, the eye's adaptation to the fires'
// light), and the Terrace's architecture with its room ranges, fittings and palace furnishings (?terrace=0 leaves it out).
// For judging the rooms' daylight, the hearths, lamps and torches and the town at night in a few minutes of page load.
// Driven by tools/dev/fire_lab.mjs. Views (window.__shot): { cam, fov, day, hour, weather } where cam is the light lab's
// ('court:q_s1:3' | 'door:q_s1:3[:back[:yaw]]' (back < 0: inside the house) | [x, z, eyeH, bearing, pitch]) or
// { eye: [e, n, h], look: [e, n, h] } in grid coordinates (h above the court datum).
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
import { FORWARD_FIRE_LIGHTS, GLOW_MAX } from '../../src/render/fireGlow';
import { loadFireOcc } from '../../src/world/fireOcc';
import { placeFires, townPorts } from '../../src/world/firePlaces';
import { Settlement } from '../../src/world/settlement/build';
import { SkySystem } from '../../src/sky/skySystem';
import { Pipeline } from '../../src/render/pipeline';
import { loadProbes, probeEyeVisibility } from '../../src/render/probes/runtime';
import { WorldClock } from '../../src/core/clock';
import { WeatherSystem, type WeatherOverride } from '../../src/weather/weatherState';
import { exposureTarget, interiorExposureTarget, KEY, X_MAX } from '../../src/sky/exposure';
import { meterEVFrame, meterTexels, METER_W, METER_H } from '../../src/render/meter';
import { SEASON, BLOOM, WEATHER, surfaceMaterial, setTraffic } from '../../src/render/materials';
import { seasonAt } from '../../src/world/season';
import { bloomAt, doyOf } from '../../src/world/plain/seasonal';
import { TONE_U } from '../../src/render/toneLook';
import { installSunCascades } from '../../src/render/sunShadows';
import { snowLineASL } from '../../src/weather/climate';
import { buildTerrace } from '../../src/arch/terrace';
import { buildMeshes } from '../../src/arch/meshes';
import { loadSculpt } from '../../src/arch/sculpt';
import { loadModels } from '../../src/render/models';
import { ArrisField } from '../../src/arch/arris';
import { ADIST_OFF } from '../../src/render/blockface';
import { buildRoomFittings } from '../../src/world/furnish';
import { PalaceFurnishings } from '../../src/world/furnish_palaces';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: false, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = 1; r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  const t0 = performance.now(), marks: string[] = [], mark = (s: string) => marks.push(`${s} ${((performance.now() - t0) / 1000).toFixed(0)}`);
  await loadScans('/'); await loadScanProps('/');
  try { await loadModels('/', r); } catch (e) { console.warn('models', e); }
  const terrain = await Terrain.load('/');
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xb9c3cc, 0.00002);
  const tm = new TerrainMesh(terrain, 1); scene.add(tm.group);
  const rivers = await loadRivers(), canals = buildCanals(terrain, rivers.rivers, 1), villages = placeVillages(terrain, rivers.rivers, canals, 1);
  const zones = buildZones({ terrain, rivers: rivers.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })) });
  const detail = await bakeTerrainDetail(terrain), ground = new PlainGround(zones, detail);
  tm.group.traverse(o => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).material = ground.material; o.receiveShadow = true; } });
  mark('terrain');
  await loadFireOcc('/');
  const fire = new FireSystem(FORWARD_FIRE_LIGHTS.high, 0, 512, GLOW_MAX);
  // the Terrace (?terrace=0: the town only)
  let arris: ArrisField | null = null;
  if (P.get('terrace') !== '0') {
    await loadSculpt(async p => { const q = await fetch('/' + p); if (!q.ok) throw new Error(`${p}: ${q.status}`); return q.arrayBuffer(); });
    const { parts, doorways, manifest } = buildTerrace() as any; setTraffic(doorways);
    const built = buildMeshes(parts, undefined, { dynamicDoors: false } as any); scene.add(built.group);
    arris = new ArrisField(built.arris, m => surfaceMaterial(m, { arch: true, band: true }), ADIST_OFF); scene.add(arris.group);
    for (const b of ['treasury', 'harem', 'garrison', 'terrace']) { const R = (manifest[b] as any)?.ranges; if (R) scene.add(buildRoomFittings(b, R)); }
    try { const pal = new PalaceFurnishings(parts, manifest, doorways, { court: true }); scene.add(pal.group); } catch (e) { console.warn('palace furnishings', e); }
    scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    placeFires(fire, manifest, parts, doorways);
    fire.setRooms([...Object.values(manifest).map((m: any) => m?.room), ...Object.values(manifest).flatMap((m: any) => m?.ranges?.rooms ?? [])].filter((r: any) => Array.isArray(r))
      .map(([cx, cy, sx, sy, fl, h]: number[]) => ({ x0: cx - sx / 2, x1: cx + sx / 2, z0: -cy - sy / 2, z1: -cy + sy / 2, y0: fl, y1: fl + h })));
    (window as any).__manifest = Object.fromEntries(Object.entries(manifest).map(([k, m]: any) => [k, { room: m?.room, ranges: m?.ranges ? { rooms: m.ranges.rooms, hearths: m.ranges.hearths, lamps: m.ranges.lamps } : undefined }]));
    mark('terrace');
  }
  const town = new Settlement(null, terrain, fire, 'high'); scene.add(town.group);
  const vh = new VillageHouses(villages, villages.map(v => villageCompounds(v, terrain, 1)), terrain, null, fire, 1); scene.add(vh.group);
  fire.build(); scene.add(fire.group);
  const PTS = townPorts(town.plan.sites, (e, n) => terrain.heightAt(e, -n)); let portsOn = P.get('ports') !== '0'; if (portsOn) fire.setPorts(PTS); marks.push('ports ' + PTS.length / 5);
  mark('town');
  await loadProbes('/');
  const sky = new SkySystem(scene, 4096, 'high'); await sky.loadStars('/');
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 60000);
  installSunCascades(sky.sun, (P.get('q') as any) ?? 'high');
  const pipeline = new Pipeline(r, scene, cam, (P.get('q') as any) ?? 'high', sky.hemi);
  const clock = new WorldClock(20, 12), weather = new WeatherSystem(1);
  const H = (x: number, z: number) => terrain.heightAt(x, z);
  /** a view spec -> [x, z, eye y, grid bearing (cw from grid north = -z), pitch] (house_lab's), or null for an eye/look spec */
  const camOf = (spec: any): [number, number, number, number, number] => {
    if (Array.isArray(spec)) return [spec[0], spec[1], H(spec[0], spec[1]) + spec[2], ((spec[3] - 341) % 360 + 360) % 360, spec[4]];
    const a = String(spec).split(':');
    if (a[0] === 'far' || a[0] === 'village') { const c = a[0] === 'far' ? town.plan.sites.find(x => x.id === a[1])!.frame.c : [villages[+a[1]].x, villages[+a[1]].y];
      const d = +a[2], h = +a[3], br = (+a[4] * Math.PI) / 180, x = c[0] + Math.sin(br) * d, z = -(c[1] + Math.cos(br) * d), gy = H(c[0], -c[1]);
      const yaw = ((Math.atan2(c[0] - x, (-c[1]) - z) * 180) / Math.PI), pitch = (Math.atan2(gy + 3 - (H(x, z) + h), d) * 180) / Math.PI; return [x, z, H(x, z) + h, ((180 - yaw) % 360 + 360) % 360, pitch + (+(a[5] ?? 0))]; }
    const s = town.plan.sites.find(x => x.id === a[1])!, hs = s.plots.filter(p => p.door && (p.kind === 'house' || p.kind === 'house_large')), p = hs[+a[2] % hs.length];
    if (a[0] === 'court') { let su = 0, sv = 0, n = 0, lo = [1e9, 1e9];
      for (let k = 0; k < s.cell.length; k++) if (s.cell[k] === p.idx && s.sub[k] === 2) { const u = s.cu(k % s.W), v = s.cv((k / s.W) | 0); su += u; sv += v; n++; if (u + v < lo[0] + lo[1]) lo = [u, v]; }
      const g = s.grid(lo[0], lo[1]), c = s.grid(su / n, sv / n), gb = (Math.atan2(c[0] - g[0], c[1] - g[1]) * 180) / Math.PI; return [g[0], -g[1], H(g[0], -g[1]) + 1.6, ((gb % 360) + 360) % 360, +(a[3] ?? 8)]; }
    if (a[0] === 'lamp') { // a house's living room, looking at its lamp from across the room (the lamp's ledge: houses.lampSpot)
      const L = ((town as any).houses as any[]).find(h => h.s === s)?.lampSpot(p.idx) as number[] | undefined; if (!L) throw new Error('no lamp');
      const back = +(a[3] ?? 2.5), br = (+(a[4] ?? 0) * Math.PI) / 180, x = L[0] + Math.sin(br) * back, n = L[1] + Math.cos(br) * back;
      const gb = (Math.atan2(L[0] - x, L[1] - n) * 180) / Math.PI; return [x, -n, L[2] + 0.1 + 1.0, ((gb % 360) + 360) % 360, -8]; }
    const d = s.doorPoints(p)!, nu = d.inside[0] - d.out[0], nv = d.inside[1] - d.out[1], back = a[0] === 'door' ? +(a[3] ?? 2.5) : -2;
    const cu = d.out[0] - nu * back, cv = d.out[1] - nv * back, g = s.grid(cu, cv), dg = s.grid(cu + nu, cv + nv), gb = (Math.atan2(dg[0] - g[0], dg[1] - g[1]) * 180) / Math.PI;
    return [g[0], -g[1], H(g[0], -g[1]) + (a[0] === 'door' ? 1.6 : 7), ((gb % 360) + 360) % 360 + (+(a[4] ?? 0)), a[0] === 'door' ? +(a[5] ?? 4) : -35];
  };
  let meterTex: Float32Array | null = null, exposure = 1, curPost = '', xpOver = 0, tSim = 0;
  const viewDir = new THREE.Vector3();
  const frame = async (vis: number, cond: any, hour: number) => {
    cam.getWorldDirection(viewDir);
    sky.update(clock.jdUT, cam.position, cond.cloud, cond.haze, { ms: cond.windMs, fromDeg: cond.windDirDeg, tSeconds: 3600 }, viewDir);
    (scene.fog as THREE.FogExp2).color.copy(sky.horizon);
    sky.air.setWeather({ haze: cond.haze, dust: cond.dust, mist: cond.mist, rain: cond.rain, snow: cond.snowFall });
    const pv = probeEyeVisibility(cam.position);
    sky.air.setInterior(pv.w > 0 ? pv.w * Math.min(1, pv.eye) + (1 - pv.w) : 1, 0);
    tSim += 1 / 30;
    fire.setSkyLight(sky as any);
    fire.update(1 / 30, cam, sky.state.sunAlt, cond.windMs, cond.windDirDeg, cond.rain, tSim, hour);
    const sunE = sky.sun.visible ? sky.sun.intensity * Math.max(0, Math.sin((sky.state.sunAlt * Math.PI) / 180)) * sky.eyeSunVisibility : 0;
    const fireE = fire.localIlluminance(cam.position, viewDir);
    const outside = exposureTarget(sunE, sky.hemi.intensity * 0.8, vis, sky.moonLight.intensity * 0.3, fireE, sky.fireScale);
    const target = pv.w > 0 ? Math.exp(pv.w * Math.log(interiorExposureTarget(sunE, sky.hemi.intensity * 0.8, sky.moonLight.intensity * 0.3, fireE, pv.eye, sky.lux, sky.skyLux)) + (1 - pv.w) * Math.log(outside)) : outside;
    const lawE = KEY / target, lawSum = sunE + sky.hemi.intensity * 0.8 + sky.moonLight.intensity * 0.3;
    const openX = exposureTarget(sunE, sky.hemi.intensity * 0.8, 1, sky.moonLight.intensity * 0.3, fireE, sky.fireScale);
    const m = meterEVFrame(meterTex, target, KEY, sky.lux * Math.min(1, lawE / Math.max(lawSum, 1e-12)), openX);
    exposure = target * Math.pow(2, m.ev);
    if (P.get('xp')) exposure = +P.get('xp')!; if (xpOver) exposure = xpOver;
    r.toneMappingExposure = exposure; pipeline.setExposure(exposure / X_MAX, exposure);
    const nf = (r as any)._nodes?.nodeFrame; if (nf) { nf.update(); (r.info as any).frame = nf.frameId; }
    pipeline.render(scene, cam);
    if (pipeline.meterTarget) { try { meterTex = meterTexels(await r.readRenderTargetPixelsAsync(pipeline.meterTarget, 0, 0, METER_W, METER_H) as any); } catch { /* */ } }
    return { exposure, target, ev: m.ev, sunAlt: sky.state.sunAlt, lux: sky.lux, fireE, pvw: pv.w, pve: pv.eye, fires: fire.stats() };
  };
  (window as any).__tone = TONE_U; (window as any).__sky = sky; (window as any).__pipe = pipeline; (window as any).__fire = fire; (window as any).__town = town;
  (window as any).__shot = async (v: { cam?: any; eye?: number[]; look?: number[]; fov?: number; day?: number; hour?: number; weather?: WeatherOverride; vis?: number; frames?: number; post?: string; xp?: number }) => {
    if ((v.post ?? '') !== curPost) { curPost = v.post ?? ''; pipeline.setDebugView(curPost); }
    xpOver = v.xp ?? 0;
    const wantPorts = (v as any).ports !== 0; if (wantPorts !== portsOn) { portsOn = wantPorts; fire.setPorts(portsOn ? PTS : new Float32Array(0)); }
    let x: number, y: number, z: number, info0: any;
    if (v.eye && v.look) { x = v.eye[0]; z = -v.eye[1]; y = v.eye[2]; cam.position.set(x, y, z); cam.up.set(0, 1, 0); cam.lookAt(v.look[0], v.look[2], -v.look[1]); info0 = [...v.eye, ...v.look]; }
    else { const [cx, cz, cy, gb, pitch] = camOf(v.cam); x = cx; z = cz; y = cy; cam.position.set(x, y, z); cam.rotation.set((pitch * Math.PI) / 180, -(gb * Math.PI) / 180, 0, 'YXZ'); info0 = [x, z, y, gb, pitch]; }
    cam.fov = v.fov ?? 60; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const hour = v.hour ?? 12;
    clock.set(v.day ?? 20, hour); weather.override = v.weather ?? 'clear';
    const cond = weather.conditions(clock.dayIndex, clock.localHour);
    const ss = seasonAt(clock.dayIndex); SEASON.green.value = ss.green; SEASON.dry.value = ss.dry; const bl = bloomAt(doyOf(clock.dayIndex)); BLOOM.violet.value = bl.violet; BLOOM.yellow.value = bl.yellow; BLOOM.red.value = bl.red;
    WEATHER.wetness.value = cond.wetness; WEATHER.snowLine.value = snowLineASL(cond.day.climMonth) - terrain.meta.court_asl; WEATHER.snow.value = cond.snowCover; WEATHER.puddles.value = Math.max(0, cond.wetness - 0.4) / 0.6;
    tm.update(cam.position); arris?.update(cam.position, 1e9);
    town.nearUpdate(x, z, 0, true); vh.nearUpdate(x, z, 0, true);
    town.doors.update(0.1, cam.position, v.day ?? 20, 40, town.nearTile); vh.doors.update(0.1, cam.position, v.day ?? 20, 40, vh.nearTile);
    for (const m of (town as any).casters as THREE.Mesh[]) m.castShadow = true;
    let info: any = null; for (let i = 0; i < (v.frames ?? 10); i++) info = await frame(v.vis ?? 1, cond, hour);
    return { errs: errs.slice(), cam: info0.map((q: number) => +q.toFixed(2)), ...info };
  };
  mark('ready');
  (window as any).__ready = `built: ${marks.join(', ')}`;
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
