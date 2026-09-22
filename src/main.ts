// PĀRSA — boot, world assembly and main loop.
import * as THREE from 'three/webgpu';
import { loadSettings, saveSettings, urlParams, QUALITY, Settings } from './core/settings';
import { WorldClock, YEAR_DAYS } from './core/clock';
import { WORLD_SEED_DEFAULT } from './core/rng';
import { Input } from './core/input';
import { writeSave, readSave } from './core/save';
import { latLonToGrid, gridToLatLon } from './core/geo';
import { Terrain } from './terrain/heightfield';
import { TerrainMesh } from './terrain/terrainMesh';
import { SkySystem } from './sky/skySystem';
import { WeatherSystem, WeatherOverride } from './weather/weatherState';
import { Physics } from './player/physics';
import { Player } from './player/player';
import { makePlayerBody, animateBody } from './player/body';
import { Shell } from './ui/shell';
import { DevOverlay } from './ui/overlay';
import { buildWorld, WorldBuild } from './world/world';
import { runBench } from './world/bench';
import { installWebGPUCompat } from './render/compat';
installWebGPUCompat();

const P = urlParams();
const settings: Settings = loadSettings();
if (P.get('quality')) settings.quality = P.get('quality') as any;
if (P.get('webgl')) settings.forceWebGL = P.get('webgl') === '1';
const SEED = +(P.get('seed') ?? WORLD_SEED_DEFAULT);
const TEST = P.has('test'); // frozen world for camera rig / walkthrough tests
const Q = QUALITY[settings.quality];
document.body.classList.toggle('cb', settings.colourBlindUI);

const canvas = document.getElementById('view') as HTMLCanvasElement;
const overlay = new DevOverlay();
if (settings.devOverlay || P.has('overlay')) overlay.toggle();

// spawn: on the approach from the plain, west of the Grand Stair, facing the Terrace (grid east)
const SPAWN = { east: -175, north: 122.45, yaw: -Math.PI / 2 };

async function boot() {
  const shell = new Shell(settings, hooks());
  shell.loading('Preparing the renderer…');
  let renderer: THREE.WebGPURenderer;
  try {
    // reversed-Z on WebGPU; the WebGL2 fallback needs EXT_clip_control for that, so it uses a logarithmic depth buffer (D-007)
    const gpuOK = !settings.forceWebGL && !!(navigator as any).gpu && !!(await (navigator as any).gpu.requestAdapter().catch(() => null));
    renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: !gpuOK, reversedDepthBuffer: gpuOK && !P.has('noreverse'), logarithmicDepthBuffer: !gpuOK });
    await renderer.init();
  } catch (e) {
    console.warn('WebGPU init failed, falling back to WebGL2', e);
    renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: true, logarithmicDepthBuffer: true });
    await renderer.init();
  }
  const backend = (renderer.backend as any).isWebGPUBackend ? 'WebGPU' : 'WebGL2';
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * Q.pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xb9c3cc, 0.00002);
  const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 90000);
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false); });

  shell.loading('Loading the plain and the mountain…');
  const terrain = await Terrain.load('/');
  const tmesh = new TerrainMesh(terrain, Q.terrainLodBias); scene.add(tmesh.group);
  const sky = new SkySystem(scene, Q.shadowMapSize); await sky.loadStars('/');
  const weather = new WeatherSystem(SEED);
  if (P.get('weather')) weather.override = P.get('weather') as WeatherOverride;
  const clock = new WorldClock(+(P.get('day') ?? 0), +(P.get('hour') ?? 7.0));
  clock.scale = TEST ? 0 : settings.timeScale;

  shell.loading('Raising the Terrace…');
  const phys = await Physics.create();
  const world: WorldBuild = await buildWorld(scene, phys, terrain);
  const [sx, sz] = [SPAWN.east, -SPAWN.north];
  phys.updateTerrain(terrain, { x: sx, y: 0, z: sz }); phys.step(1 / 60);
  const player = new Player(phys, sx, terrain.heightAt(sx, sz) + 0.05, sz);
  const input = new Input(canvas, () => settings);
  input.yaw = SPAWN.yaw;
  const body = makePlayerBody(); scene.add(body);

  let lastSave: string | null = null;
  function state() {
    const p = player.position;
    return { v: 1 as const, savedAt: new Date().toISOString(), seed: SEED, clockT: clock.t, timeScale: settings.timeScale, weatherOverride: weather.override,
      player: { x: p.x, y: p.y, z: p.z, yaw: input.yaw, pitch: input.pitch }, npc: world.saveState?.() };
  }
  function restore(s: ReturnType<typeof state> | null) {
    if (!s) return false;
    clock.t = s.clockT; weather.override = s.weatherOverride as WeatherOverride; input.yaw = s.player.yaw; input.pitch = s.player.pitch;
    phys.updateTerrain(terrain, s.player); player.body.setTranslation(s.player, true); world.loadState?.(s.npc); return true;
  }

  Object.assign(hooksImpl, {
    start: () => { shell.playing(); input.lock(); world.audio?.unlock(); },
    resume: () => { shell.playing(); input.lock(); },
    save: () => writeSave(state()), load: () => restore(readSave() as any),
    applySettings: (s: Settings) => { camera.fov = s.fov; camera.updateProjectionMatrix(); clock.scale = s.timeScale; world.applySettings?.(s); saveSettings(s); },
    getTime: () => ({ day: clock.dayIndex, hour: clock.localHour, label: clock.label() }),
    setTime: (d: number, h: number) => clock.set(d, h),
    getWeather: () => weather.override, setWeather: (w: string) => { weather.override = w as WeatherOverride; },
  });
  input.onPauseRequest = () => { if (shell.mode === 'playing') shell.pause(); };
  input.onOverlayToggle = () => overlay.toggle();

  // test / tooling API (out-of-world)
  const api = {
    ready: false, backend,
    setTime: (day: number, hour: number) => clock.set(day, hour),
    setWeather: (w: WeatherOverride) => { weather.override = w; },
    /** place the camera at grid (east, north) with eye height above ground (or absolute asl), true-north azimuth + pitch in degrees */
    view: (east: number, north: number, eyeAboveGround: number, azTrueDeg: number, pitchDeg: number) => {
      const x = east, z = -north; freeCam = { x, y: terrain.heightAt(x, z) + eyeAboveGround, z, yaw: -((azTrueDeg - 341) * Math.PI) / 180, pitch: (pitchDeg * Math.PI) / 180 };
    },
    viewLatLon: (lat: number, lon: number, eye: number, az: number, pitch: number) => { const [e, n] = latLonToGrid(lat, lon); api.view(e, n, eye, az, pitch); },
    walkMode: () => { freeCam = null; },
    teleport: (east: number, north: number) => { const x = east, z = -north; phys.updateTerrain(terrain, { x, y: 0, z }); player.teleport(x, terrain.heightAt(x, z), z); },
    setInput: (i: Partial<{ forward: number; right: number; run: boolean; yawDeg: number; pitchDeg: number }>) => { botInput = { ...botInput, ...i }; },
    playerState: () => ({ ...player.position, feetY: player.feetY, grounded: player.grounded, lastFall: player.lastFall, yaw: input.yaw, ground: terrain.heightAt(player.position.x, player.position.z) }),
    stats: () => ({ backend, drawCalls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, terrain: tmesh.stats(), frameMs: lastFrameMs, heap: (performance as any).memory?.usedJSHeapSize ?? null }),
    renderOnce: async () => { await frame(0); },
    clockLabel: () => clock.label(), gridToLatLon, world,
    sky: () => ({ sunAlt: sky.state.sunAlt, moonAlt: sky.state.moonAlt, moonFraction: sky.state.moonFraction }),
    conditions: () => weather.conditions(clock.dayIndex, clock.localHour),
    errors: [] as string[],
  };
  (window as any).__parsa = api;
  addEventListener('error', e => api.errors.push(String(e.message)));
  let freeCam: null | { x: number; y: number; z: number; yaw: number; pitch: number } = null;
  let botInput: { forward: number; right: number; run: boolean; yawDeg?: number; pitchDeg?: number } = { forward: 0, right: 0, run: false };
  let lastFrameMs = 0;

  let prev = performance.now();
  async function frame(dtOverride?: number) {
    const now = performance.now();
    const dt = dtOverride ?? Math.min(0.1, (now - prev) / 1000); prev = now;
    overlay.frame(dt);
    const playing = shell.mode === 'playing' || TEST || P.has('bench');
    if (playing) clock.advance(dt);
    const cond = weather.conditions(clock.dayIndex, clock.localHour);
    if (playing && !freeCam) {
      const ax = input.locked ? input.axes() : botInput;
      if (botInput.yawDeg !== undefined) { input.yaw = -((botInput.yawDeg - 341) * Math.PI) / 180; input.pitch = ((botInput.pitchDeg ?? 0) * Math.PI) / 180; }
      phys.updateTerrain(terrain, player.position);
      player.update(dt, { ...ax, yaw: input.yaw, pitch: input.pitch });
      phys.step(Math.max(1 / 240, dt));
    }
    if (freeCam) { camera.position.set(freeCam.x, freeCam.y, freeCam.z); camera.rotation.set(freeCam.pitch, freeCam.yaw, 0, 'YXZ'); body.visible = false; }
    else {
      const e = player.eye;
      const bob = settings.headBob && player.grounded ? Math.sin(player.bobPhase * 2) * 0.025 : 0;
      camera.position.set(e.x, e.y + bob, e.z); camera.rotation.set(input.pitch, input.yaw, 0, 'YXZ');
      body.visible = true; body.position.set(e.x, player.feetY, e.z); body.rotation.y = input.yaw; animateBody(body, player.bobPhase, 1.35);
      // keep the camera ahead of the torso when looking down
      body.position.x += Math.sin(input.yaw) * 0.12; body.position.z += Math.cos(input.yaw) * 0.12;
    }
    sky.update(clock.jdUT, camera.position, cond.cloud, cond.haze);
    const fogCol = new THREE.Color().setRGB(0.62, 0.68, 0.74).multiplyScalar(0.12 + 0.88 * sky.state.daylight);
    if ((window as any).__nofog) scene.fog = null;
    if (scene.fog) (scene.fog as THREE.FogExp2).color.copy(fogCol);
    if (scene.fog) (scene.fog as THREE.FogExp2).density = 0.000012 + 0.00012 * cond.haze * cond.haze + 0.004 * cond.mist * Math.max(0, 1 - (camera.position.y - terrain.heightAt(camera.position.x, camera.position.z)) / 40);
    renderer.toneMappingExposure = exposureFor(sky.state.sunAlt, cond.cloud);
    world.update?.(dt, { clock, cond, sky: sky.state, camera, player, settings });
    tmesh.update(camera.position);
    const t0 = performance.now();
    renderer.render(scene, camera);
    lastFrameMs = performance.now() - t0;
    overlay.update(renderer, scene, camera, [
      `grid E ${camera.position.x.toFixed(1)} N ${(-camera.position.z).toFixed(1)} · ${(camera.position.y + terrain.meta.court_asl).toFixed(1)} m asl · ground ${(terrain.heightAt(camera.position.x, camera.position.z) + terrain.meta.court_asl).toFixed(1)}`,
      clock.label(),
      `sun alt ${sky.state.sunAlt.toFixed(1)}° · moon ${(sky.state.moonFraction * 100).toFixed(0)}% alt ${sky.state.moonAlt.toFixed(0)}°`,
      `weather: ${weather.override} · ${cond.tempC.toFixed(1)} °C · cloud ${(cond.cloud * 100).toFixed(0)}% · rain ${cond.rain.toFixed(2)} · wind ${cond.windMs.toFixed(1)} m/s from ${cond.windDirDeg.toFixed(0)}° · wet ${cond.wetness.toFixed(2)} · snow ${cond.snowCover.toFixed(2)}`,
      `terrain chunks ${tmesh.stats().chunks}, ${(tmesh.stats().tris / 1e6).toFixed(2)} M tris · ${world.summary?.() ?? ''}`,
    ]);
  }
  if (P.get('bench')) { api.ready = true; await runBench(P.get('bench')!, api, frame); return; }
  renderer.setAnimationLoop(() => { frame(); });
  api.ready = true;
  if (TEST) shell.playing(); else shell.title();
  void lastSave; void gridToLatLon; void YEAR_DAYS;
}

/** Simple eye-adaptation target (C): exposure rises as scene illuminance falls; capped so night stays night. Phase 3 replaces it with measured-luminance adaptation. */
function exposureFor(sunAlt: number, cloud: number) {
  const day = Math.min(1, Math.max(0, (sunAlt + 4) / 14));
  return (0.55 + 0.35 * cloud) * day + (1 - day) * 2.2;
}

const hooksImpl: any = {};
function hooks() { return new Proxy({}, { get: (_t, k) => (...a: any[]) => hooksImpl[k]?.(...a) }) as any; }
boot().catch(e => { console.error(e); const s = document.getElementById('shell')!; s.textContent = 'Failed to start: ' + e; (window as any).__parsa = { ready: false, error: String(e) }; });
