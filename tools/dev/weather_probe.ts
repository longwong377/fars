// V5 (D-521) dev probe (not shipped): the weather and the animals as a walker meets them on the plain, without the Terrace,
// the town, the people or the sky dome: the plain's ground (?lite of plain_probe), its flora and rocks, a herd and a pack
// string walking (the game's Animals class and their dust: dust.ts), the rain round the eye (weatherVfx.ts) and the wet ground
// (WEATHER uniforms), breath in the cold (breath.ts). Loads in ~30 s. Serve the tree, then:
//   node tools/dev/weather_probe.mjs <tag> [view,view]   (frames to $OUT or shots/wx-<view>-<tag>.png)
// window.__shot({ e, n, eye, az, pitch, fov, day, sunAz, sunAlt, rain, wet, wind, windDir, cloud, tempC, t, herd, sp, dust })
import * as THREE from 'three/webgpu';
import { loadScans } from '../../src/render/scans';
import { Terrain } from '../../src/terrain/heightfield';
import { TerrainMesh } from '../../src/terrain/terrainMesh';
import { SEASON, BLOOM, WEATHER } from '../../src/render/materials';
import { seasonAt } from '../../src/world/season';
import { bloomAt, doyOf, cropState } from '../../src/world/plain/seasonal';
import { GroundCover, loadCoverKit } from '../../src/world/plain/groundCover';
import { loadScanProps } from '../../src/render/scanProps';
import { loadTreeAssets } from '../../src/world/trees/assets';
import { loadLifeModels } from '../../src/world/lifeModels';
import { GroundFlora } from '../../src/world/groundFlora';
import { GroundRocks } from '../../src/world/groundRocks';
import { landUseAt, buildZones } from '../../src/world/plain/fields';
import type { CellCtx } from '../../src/world/smallLife';
import { installSunCascades } from '../../src/render/sunShadows';
import { loadRivers } from '../../src/world/plain/data';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages } from '../../src/world/plain/villages';
import { bakeTerrainDetail } from '../../src/terrain/terrainDetail';
import { PlainGround } from '../../src/world/plain/terrainPlain';
import { WeatherVfx } from '../../src/world/weatherVfx';
import { DustSystem } from '../../src/world/dust';
import { BreathFx } from '../../src/world/breath';
import { Animals, animalsFor, type Species } from '../../src/people/animals';
import { loadAnimalModels } from '../../src/people/animalModels';
const stage = (s: string) => { (window as any).__stage = s; console.log('[stage] ' + s + ' ' + Math.round(performance.now() / 1000) + ' s'); };
void cropState;
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1);
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  stage('renderer'); await loadScans('/'); stage('scans');
  const [terrain] = await Promise.all([Terrain.load('/'), loadScanProps('/'), loadTreeAssets('/'), loadLifeModels('/'), loadCoverKit('/'), loadAnimalModels('/')]); stage('assets');
  const scene = new THREE.Scene(); const sky = new THREE.Color(0.55, 0.68, 0.85); scene.background = sky; const fog = new THREE.FogExp2(0xb8c4d0, 0.00004); scene.fog = fog;
  const tm = new TerrainMesh(terrain, 1); scene.add(tm.group);
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.2), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 0.9);
  scene.add(sun, sun.target, hemi);
  r.shadowMap.enabled = true; sun.castShadow = true; installSunCascades(sun, 'high');
  const rivers = (await loadRivers()).rivers, canals = buildCanals(terrain, rivers, 1), villages = placeVillages(terrain, rivers, canals, 1);
  const zones = buildZones({ terrain, rivers: rivers.map((rv: any) => ({ x: rv.x, y: rv.y, halfCorridor: rv.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })) });
  const gm = new PlainGround(zones, await bakeTerrainDetail(terrain)); tm.group.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = gm.material; });
  const ctxAt = (e: number, n: number): CellCtx => landUseAt(zones, e, -n).use === 'natural' ? 'steppe' : 'field';
  const ground = (e: number, n: number) => terrain.surfaceAt(e, -n);
  const flora = new GroundFlora(1, { ground, ctxAt }), rocks = new GroundRocks(1, { ground, ctxAt });
  scene.add(flora.group, rocks.group);
  const cover = new GroundCover({ ground: (x, z) => terrain.surfaceAt(x, z), zones, blocked: () => false }, 1); scene.add(cover.group);
  const A = new Animals(128, 'animals:wx'); scene.add(A.group);
  const dust = new DustSystem(); scene.add(dust.group);
  const rain = new WeatherVfx(+(P.get('drops') ?? 6000)); scene.add(rain.group);
  const breath = new BreathFx(); scene.add(breath.group);
  A.onPush = (a, M) => { const e = M.elements; if (a.walk > 0.2) dust.emit(/^(sheep|goat)$/.test(a.sp) ? 'flock' : 'animal', e[12], e[13], e[14], Math.atan2(e[8], e[10]), 1.1 * a.walk, (a.coat * 997) | 0); };
  const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 60000);
  const dirOf = (az: number, alt: number) => { const psi = -((az - 341) * Math.PI) / 180, c = Math.cos(alt * Math.PI / 180); return new THREE.Vector3(-Math.sin(psi) * c, Math.sin(alt * Math.PI / 180), -Math.cos(psi) * c); };
  stage('ready');
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), S1 = new THREE.Vector3(1, 1, 1);
  (window as any).__shot = async (v: { e: number; n: number; eye: number; az: number; pitch: number; fov: number; day: number; sunAz: number; sunAlt: number; rain?: number; wet?: number; wind?: number; windDir?: number; cloud?: number; tempC?: number; t?: number; herd?: { sp: string[]; n: number; ahead: number; side?: number; kind?: string; pace?: number }[] }) => {
    const ss = seasonAt(v.day); SEASON.green.value = ss.green; SEASON.dry.value = ss.dry; const bl = bloomAt(doyOf(v.day)); BLOOM.violet.value = bl.violet; BLOOM.yellow.value = bl.yellow; BLOOM.red.value = bl.red;
    const wet = v.wet ?? 0, rn = v.rain ?? 0, cloud = v.cloud ?? (rn > 0 ? 0.95 : 0.1);
    WEATHER.wetness.value = wet; WEATHER.puddles.value = Math.max(0, wet - 0.4) / 0.6;
    // overcast: the sun dimmed behind the cloud, the sky grey and brighter relative to it, the air closing in (C, as the game's sky does)
    sun.intensity = 3.2 * (1 - 0.92 * cloud); hemi.intensity = 0.9 * (1 - 0.35 * cloud); hemi.color.setRGB(0.75 + 0.15 * cloud, 0.84 + 0.04 * cloud, 1.0 - 0.1 * cloud);
    sky.setRGB(0.55 + 0.17 * cloud, 0.68 + 0.04 * cloud, 0.85 - 0.12 * cloud).multiplyScalar(1 - 0.35 * cloud); fog.color.copy(sky).multiplyScalar(1.05); fog.density = 0.00004 + 0.0012 * rn + 0.0002 * cloud;
    const x = v.e, z = -v.n, g = terrain.surfaceAt(x, z);
    cam.position.set(x, g + v.eye, z); cam.rotation.set(v.pitch * Math.PI / 180, -((v.az - 341) * Math.PI) / 180, 0, 'YXZ'); cam.fov = v.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const d = dirOf(v.sunAz, v.sunAlt); sun.position.copy(cam.position).addScaledVector(d, 1000); sun.target.position.copy(cam.position);
    const month = new Date(Date.UTC(2001, 0, 1 + doyOf(v.day))).getUTCMonth();
    tm.update(cam.position); gm.setDay(doyOf(v.day));
    flora.update(month, [x, -z]); rocks.update([x, -z]); cover.update(cam.position, doyOf(v.day), ss, true);
    // the herds: performances' animals placed ahead of the eye along its view (closed form in time, as the game's)
    const t = v.t ?? 100; A.begin(t, cam.position); dust.begin(cam.position);
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    (v.herd ?? []).forEach((h, k) => {
      const c = cam.position.clone().addScaledVector(fwd, h.ahead).addScaledVector(right, h.side ?? 0), yaw = Math.atan2(fwd.x, fwd.z) + Math.PI / 2;
      for (const a of animalsFor({ kind: (h.kind ?? 'flock') as any, species: h.sp as Species[], n: h.n, pace: h.pace } as any, t, 11 + k)) {
        const cy = Math.cos(yaw), sy = Math.sin(yaw), wx = c.x + a.x * cy + a.z * sy, wz = c.z - a.x * sy + a.z * cy;
        Q.setFromAxisAngle(Y, yaw + a.yaw); M.compose(new THREE.Vector3(wx, terrain.surfaceAt(wx, wz) + (a.y ?? 0), wz), Q, S1); A.push(a, M); } });
    A.end();
    const windMs = v.wind ?? 3, windDir = v.windDir ?? 300;
    dust.update(t, cam, { wetness: wet, snowCover: 0, rain: rn, windMs, windDirDeg: windDir });
    rain.setLight(hemi, sun);
    for (let i = 0; i < 4; i++) rain.update(0.05, cam, { rain: rn, snowFall: 0, windMs, windDirDeg: windDir, lightning: false }, 0);
    breath.update(t, cam, [], { moving: false }, { tempC: v.tempC ?? 15, rh: 70 });
    for (let i = 0; i < 3; i++) await r.renderAsync(scene, cam);
    return { errs: errs.slice(), month, animals: A.stats(), dust: dust.stats, rain: rn };
  };
  (window as any).__ready = true;
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
