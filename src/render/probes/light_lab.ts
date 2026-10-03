// D-480 dev probe (not shipped): the light lab. The town's houses, the villages and the terrain in the game's own materials,
// lit by the game's own light: SkySystem (sun, sky, moon, stars, clouds, the air), the post pipeline at `high` (SSGI, contact
// shadows, SSR, bloom, the tone look), the light probes and the outdoor field, and main.ts's exposure law with the frame meter.
// No Terrace, people, trees or fires: a page load of a few minutes against a full world's 11-30, for judging the light and the
// tone at every time band. Driven by src/render/probes/light_lab.mjs. Views (window.__shot): { cam (house_lab's specs: 'court:q_s1:3'
// | 'door:q_s1:3' | 'far:q_s1:<dist>:<height>:<bearing>' | [x, z, eyeH, bearing, pitch]), fov, day, hour, weather, vis }.
import * as THREE from 'three/webgpu';
import { loadScans } from '../scans';
import { loadScanProps } from '../scanProps';
import { Terrain } from '../../terrain/heightfield';
import { TerrainMesh } from '../../terrain/terrainMesh';
import { bakeTerrainDetail } from '../../terrain/terrainDetail';
import { PlainGround } from '../../world/plain/terrainPlain';
import { buildZones } from '../../world/plain/fields';
import { loadRivers } from '../../world/plain/data';
import { buildCanals } from '../../world/plain/canals';
import { placeVillages, villageCompounds } from '../../world/plain/villages';
import { VillageHouses } from '../../world/plain/villagehouses';
import { FireSystem } from '../../world/fire';
import { Settlement } from '../../world/settlement/build';
import { SkySystem } from '../../sky/skySystem';
import { Pipeline } from '../pipeline';
import { loadProbes, probeEyeVisibility } from './runtime';
import { WorldClock } from '../../core/clock';
import { WeatherSystem, type WeatherOverride } from '../../weather/weatherState';
import { exposureTarget, interiorExposureTarget, KEY, X_MAX } from '../../sky/exposure';
import { meterEVFrame, meterTexels, METER_W, METER_H } from '../meter';
import { SEASON, BLOOM, WEATHER } from '../materials';
import { seasonAt } from '../../world/season';
import { bloomAt, doyOf } from '../../world/plain/seasonal';
import { TONE_U } from '../toneLook';
import { installSunCascades } from '../sunShadows';
import { snowLineASL } from '../../weather/climate';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: false, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = 1; r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  const t0 = performance.now();
  await loadScans('/'); await loadScanProps('/');
  const terrain = await Terrain.load('/');
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xb9c3cc, 0.00002);
  const tm = new TerrainMesh(terrain, 1); scene.add(tm.group);
  const rivers = await loadRivers(), canals = buildCanals(terrain, rivers.rivers, 1), villages = placeVillages(terrain, rivers.rivers, canals, 1);
  const zones = buildZones({ terrain, rivers: rivers.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })) });
  const detail = await bakeTerrainDetail(terrain), ground = new PlainGround(zones, detail);
  tm.group.traverse(o => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).material = ground.material; o.receiveShadow = true; } });
  const fire = new FireSystem(0);
  const town = new Settlement(null, terrain, fire, 'high'); scene.add(town.group);
  const vh = new VillageHouses(villages, villages.map(v => villageCompounds(v, terrain, 1)), terrain, null, null, 1); scene.add(vh.group);
  await loadProbes('/');
  const sky = new SkySystem(scene, 4096, 'high'); await sky.loadStars('/');
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 60000);
  installSunCascades(sky.sun, (P.get('q') as any) ?? 'high');
  const pipeline = new Pipeline(r, scene, cam, (P.get('q') as any) ?? 'high', sky.hemi);
  const clock = new WorldClock(20, 12), weather = new WeatherSystem(1);
  const H = (x: number, z: number) => terrain.heightAt(x, z);
  /** a view spec -> [x, z, eye y, grid bearing (cw from grid north = -z), pitch] (house_lab's) */
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
    const d = s.doorPoints(p)!, nu = d.inside[0] - d.out[0], nv = d.inside[1] - d.out[1], back = a[0] === 'door' ? +(a[3] ?? 2.5) : -2;
    const cu = d.out[0] - nu * back, cv = d.out[1] - nv * back, g = s.grid(cu, cv), dg = s.grid(cu + nu, cv + nv), gb = (Math.atan2(dg[0] - g[0], dg[1] - g[1]) * 180) / Math.PI;
    return [g[0], -g[1], H(g[0], -g[1]) + (a[0] === 'door' ? 1.6 : 7), ((gb % 360) + 360) % 360 + (+(a[4] ?? 0)), a[0] === 'door' ? 4 : -35];
  };
  let meterTex: Float32Array | null = null, exposure = 1, curPost = '', hemiMul = 1, xpOver = 0; let postUpd: ((s: any) => void) | null = null;
  const viewDir = new THREE.Vector3();
  const frame = async (vis: number, cond: any) => {
    sky.update(clock.jdUT, cam.position, cond.cloud, cond.haze, { ms: cond.windMs, fromDeg: cond.windDirDeg, tSeconds: 3600 }, viewDir.set(0, 0, -1).applyEuler(cam.rotation));
    sky.hemi.intensity *= hemiMul; if (postUpd) postUpd(sky);
    (scene.fog as THREE.FogExp2).color.copy(sky.horizon);
    sky.air.setWeather({ haze: cond.haze, dust: cond.dust, mist: cond.mist, rain: cond.rain, snow: cond.snowFall });
    sky.air.setInterior(1, 0);
    const sunE = sky.sun.visible ? sky.sun.intensity * Math.max(0, Math.sin((sky.state.sunAlt * Math.PI) / 180)) * sky.eyeSunVisibility : 0;
    const pv = probeEyeVisibility(cam.position);
    const outside = exposureTarget(sunE, sky.hemi.intensity * 0.8, vis, sky.moonLight.intensity * 0.3, 0, sky.fireScale);
    const target = pv.w > 0 ? Math.exp(pv.w * Math.log(interiorExposureTarget(sunE, sky.hemi.intensity * 0.8, sky.moonLight.intensity * 0.3, 0, pv.eye, sky.lux, sky.skyLux)) + (1 - pv.w) * Math.log(outside)) : outside;
    const lawE = KEY / target, lawSum = sunE + sky.hemi.intensity * 0.8 + sky.moonLight.intensity * 0.3;
    const openX = exposureTarget(sunE, sky.hemi.intensity * 0.8, 1, sky.moonLight.intensity * 0.3, 0, sky.fireScale);
    const m = meterEVFrame(meterTex, target, KEY, sky.lux * Math.min(1, lawE / Math.max(lawSum, 1e-12)), openX);
    exposure = target * Math.pow(2, m.ev);
    if (P.get('xp')) exposure = +P.get('xp')!; if (xpOver) exposure = xpOver;
    r.toneMappingExposure = exposure; pipeline.setExposure(exposure / X_MAX, exposure);
    const nf = (r as any)._nodes?.nodeFrame; if (nf) { nf.update(); (r.info as any).frame = nf.frameId; }
    pipeline.render(scene, cam);
    if (pipeline.meterTarget) { try { meterTex = meterTexels(await r.readRenderTargetPixelsAsync(pipeline.meterTarget, 0, 0, METER_W, METER_H) as any); } catch { /* */ } }
    return { exposure, target, ev: m.ev, sunAlt: sky.state.sunAlt, lux: sky.lux, gain: sky.gain, sunI: sky.sun.intensity, hemiI: sky.hemi.intensity, pvw: pv.w };
  };
  (window as any).__tone = TONE_U; (window as any).__sky = sky; (window as any).__pipe = pipeline;
  (window as any).__shot = async (v: { cam: any; fov?: number; day?: number; hour?: number; weather?: WeatherOverride; vis?: number; frames?: number; tone?: Record<string, number>; ab?: Record<string, number>; post?: string; hemi?: number }) => {
    const S = (globalThis as any).__parsaSurf; for (const k in (v.ab ?? {})) S[k].value = v.ab![k];
    if ((v.post ?? '') !== curPost) { curPost = v.post ?? ''; pipeline.setDebugView(curPost); }
    hemiMul = v.hemi ?? 1; xpOver = (v as any).xp ?? 0; postUpd = (v as any).js ? new Function('sky', (v as any).js) as any : null; // dev: a statement run after each sky.update (A/B of sky uniforms)
    const [x, z, y, gb, pitch] = camOf(v.cam);
    cam.position.set(x, y, z); cam.rotation.set((pitch * Math.PI) / 180, -(gb * Math.PI) / 180, 0, 'YXZ'); cam.fov = v.fov ?? 60; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    clock.set(v.day ?? 20, v.hour ?? 12); weather.override = v.weather ?? 'clear';
    (globalThis as any).__toneHold = !!v.tone; if (v.tone) for (const k in v.tone) (TONE_U as any)[k].value = v.tone[k];
    const cond = weather.conditions(clock.dayIndex, clock.localHour);
    const ss = seasonAt(clock.dayIndex); SEASON.green.value = ss.green; SEASON.dry.value = ss.dry; const bl = bloomAt(doyOf(clock.dayIndex)); BLOOM.violet.value = bl.violet; BLOOM.yellow.value = bl.yellow; BLOOM.red.value = bl.red;
    WEATHER.wetness.value = cond.wetness; WEATHER.snowLine.value = snowLineASL(cond.day.climMonth) - terrain.meta.court_asl; WEATHER.snow.value = cond.snowCover; WEATHER.puddles.value = Math.max(0, cond.wetness - 0.4) / 0.6;
    tm.update(cam.position);
    town.nearUpdate(x, z, 0, true); vh.nearUpdate(x, z, 0, true);
    town.doors.update(0.1, cam.position, v.day ?? 20, 40, town.nearTile); vh.doors.update(0.1, cam.position, v.day ?? 20, 40, vh.nearTile);
    for (const m of (town as any).casters as THREE.Mesh[]) m.castShadow = true;
    let info: any = null; for (let i = 0; i < (v.frames ?? 10); i++) info = await frame(v.vis ?? 1, cond);
    return { errs: errs.slice(), cam: [x, z, y, gb, pitch].map(q => +q.toFixed(2)), cond: { haze: cond.haze, dust: cond.dust, cloud: cond.cloud, mist: cond.mist }, ...info };
  };
  (window as any).__ready = `built in ${((performance.now() - t0) / 1000).toFixed(0)} s`;
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
