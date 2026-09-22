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
import { Pipeline } from './render/pipeline';
import { WEATHER } from './render/materials';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
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

  // cascaded shadows (high/ultra): 4 cascades to 600 m; lower qualities keep the single follow-the-player map
  if (settings.quality === 'high' || settings.quality === 'ultra') {
    const csm = new CSMShadowNode(sky.sun, { cascades: 4, maxFar: 600, mode: 'practical', lightMargin: 200 });
    (sky.sun.shadow as any).shadowNode = csm; sky.sun.shadow.mapSize.set(Q.shadowMapSize / 2, Q.shadowMapSize / 2);
  }
  const pipeline = new Pipeline(renderer, scene, camera, settings.quality);
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
    if (s.seed !== SEED) { // the seed defines the whole world (weather, people): reload with the saved seed, then load
      const q = new URLSearchParams(location.search); q.set('seed', String(s.seed)); q.set('loadsave', '1'); location.search = q.toString(); return false;
    }
    settings.timeScale = s.timeScale; clock.scale = TEST ? 0 : s.timeScale;
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
      const x = east, z = -north; phys.updateTerrain(terrain, { x, y: 0, z }); phys.step(1e-4); const g = phys.castRayDown(x, z, 400) ?? terrain.heightAt(x, z); freeCam = { x, y: g + eyeAboveGround, z, yaw: -((azTrueDeg - 341) * Math.PI) / 180, pitch: (pitchDeg * Math.PI) / 180 };
    },
    viewLatLon: (lat: number, lon: number, eye: number, az: number, pitch: number) => { const [e, n] = latLonToGrid(lat, lon); api.view(e, n, eye, az, pitch); },
    walkMode: () => { freeCam = null; },
    teleport: (east: number, north: number) => { const x = east, z = -north; phys.updateTerrain(terrain, { x, y: 0, z }); phys.step(1e-4); player.teleport(x, phys.castRayDown(x, z, 400) ?? terrain.heightAt(x, z), z); },
    setInput: (i: Partial<{ forward: number; right: number; run: boolean; yawDeg: number; pitchDeg: number }>) => { botInput = { ...botInput, ...i }; },
    playerState: () => ({ ...player.position, feetY: player.feetY, grounded: player.grounded, lastFall: player.lastFall, yaw: input.yaw, ground: phys.castRayDown(player.position.x, player.position.z, player.position.y + 0.5, player.collider) ?? terrain.heightAt(player.position.x, player.position.z) }),
    stats: () => ({ backend, drawCalls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, terrain: tmesh.stats(), frameMs: lastFrameMs, heap: (performance as any).memory?.usedJSHeapSize ?? null }),
    renderOnce: async () => { await frame(0); },
    /** deterministic fixed-step simulation without rendering (walkthrough bots, soak); returns max frame sim time */
    simulate: (seconds: number, dt = 1 / 30) => { const steps = Math.round(seconds / dt); for (let i = 0; i < steps; i++) simStep(dt); },
    /** walkthrough bot: steer toward grid (east, north) at walking pace; returns {reached, stuck, t, state} (fixed-step, deterministic) */
    walkTo: (east: number, north: number, maxSeconds = 120, tol = 0.6, dt = 1 / 60) => {
      let t = 0, lastProgress = 0, best = Infinity;
      while (t < maxSeconds) {
        const p = player.position, de = east - p.x, dn = north + p.z, d = Math.hypot(de, dn);
        if (d < tol) return { reached: true, stuck: false, t, state: api.playerState() };
        if (d < best - 0.05) { best = d; lastProgress = t; }
        if (t - lastProgress > 4) return { reached: false, stuck: true, t, state: api.playerState() };
        const azGrid = Math.atan2(de, dn); // from grid north, clockwise
        botInput = { forward: 1, right: 0, run: false, yawDeg: (azGrid * 180) / Math.PI + 341, pitchDeg: 0 };
        simStep(dt, false); t += dt;
      }
      botInput = { forward: 0, right: 0, run: false };
      return { reached: false, stuck: false, t, state: api.playerState() };
    },
    clockLabel: () => clock.label(), gridToLatLon, world,
    sky: () => ({ sunAlt: sky.state.sunAlt, moonAlt: sky.state.moonAlt, moonFraction: sky.state.moonFraction }),
    conditions: () => weather.conditions(clock.dayIndex, clock.localHour),
    errors: [] as string[],
    save: () => writeSave(state()), load: () => restore(readSave() as any), saveState: () => state(),
    /** §13.2 rendered plan overlay: renders the given building's parts (filtered by kind) top-down, orthographic,
     *  0.25 m/px over grid x∈[-80,272], y∈[-250,250]; returns a row-major 0/1 mask (row 0 = north). */
    planMask: async (building: string, kinds: string[] | null) => {
      const { buildTerrace } = await import('./arch/terrace'); const { buildMeshes, useFlatMaterials } = await import('./arch/meshes'); useFlatMaterials(true);
      const parts: any[] = building === '__marker'
        ? [{ type: 'box', building: 'm', kind: 'm', material: 'plaster', tier: 'C', src: 'RECON', c: [200, 200], size: [20, 20], y0: 0, y1: 1 }]
        : buildTerrace().parts.filter(p => (building === '*' || p.building === building) && (!kinds || kinds.includes(p.kind)) && p.type !== 'column');
      const tmp = new THREE.Scene(); const arch = buildMeshes(parts); tmp.add(arch.group);
      const white = new THREE.MeshBasicNodeMaterial({ color: 0xffffff }); arch.group.traverse(o => { if ((o as any).isMesh) (o as THREE.Mesh).material = white; });
      const W = 1408, H = 2000; const cam = new THREE.OrthographicCamera(-80, 272, 250, -250, 1, 2000); // W×4 bytes is a multiple of 256 (WebGPU row alignment)
      cam.position.set(0, 500, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); // looking down, grid north up
      const rt = new THREE.RenderTarget(W, H); const prevTM = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
      tmp.background = new THREE.Color(0x000000);
      renderer.setRenderTarget(rt); renderer.render(tmp, cam); renderer.setRenderTarget(null); renderer.toneMapping = prevTM;
      const px = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, W, H) as Uint8Array;
      const mask = new Uint8Array(W * H);
      // readback row order differs between backends: calibrate once with a marker square at grid (200, 200) — i.e. NE, near the top
      if (building !== '__marker' && planFlip === null) { const m = await api.planMask('__marker', null); let top = 0, n = 0; for (let i = 0; i < m.bits.length; i++) if (m.bits[i] === '1') { top += Math.floor(i / m.W); n++; } planFlip = (top / n) > m.H / 2; }
      const flip = building === '__marker' ? false : !!planFlip;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const sy = flip ? H - 1 - y : y; mask[y * W + x] = px[(sy * W + x) * 4] > 127 ? 1 : 0; }
      rt.dispose(); arch.group.traverse(o => (o as any).geometry?.dispose?.()); useFlatMaterials(false);
      return { W, H, x0: -80, y1: 250, res: 0.25, bits: Array.from(mask).join('') };
    },
  };
  let planFlip: boolean | null = null;
  (window as any).__parsa = api;
  addEventListener('error', e => api.errors.push(String(e.message)));
  let freeCam: null | { x: number; y: number; z: number; yaw: number; pitch: number } = null;
  let botInput: { forward: number; right: number; run: boolean; yawDeg?: number; pitchDeg?: number } = { forward: 0, right: 0, run: false };
  let lastFrameMs = 0;

  function simStep(dt: number, advanceClock = true) {
    if (advanceClock) clock.advance(dt);
    if (freeCam) return;
    const ax = input.locked ? input.axes() : botInput;
    if (botInput.yawDeg !== undefined) { input.yaw = -((botInput.yawDeg - 341) * Math.PI) / 180; input.pitch = ((botInput.pitchDeg ?? 0) * Math.PI) / 180; }
    phys.updateTerrain(terrain, player.position);
    player.update(dt, { ...ax, yaw: input.yaw, pitch: input.pitch });
    phys.step(Math.max(1 / 240, dt));
    world.simulate?.(dt, clock);
  }
  let prev = performance.now();
  async function frame(dtOverride?: number) {
    const now = performance.now();
    const dt = dtOverride ?? Math.min(0.1, (now - prev) / 1000); prev = now;
    overlay.frame(dt);
    const playing = shell.mode === 'playing' || TEST || P.has('bench');
    if (playing) simStep(dt, !TEST);
    const cond = weather.conditions(clock.dayIndex, clock.localHour);
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
    if (scene.fog) (scene.fog as THREE.FogExp2).color.copy(fogCol);
    if (scene.fog) (scene.fog as THREE.FogExp2).density = 0.000012 + 0.00012 * cond.haze * cond.haze + 0.004 * cond.mist * Math.max(0, 1 - (camera.position.y - terrain.heightAt(camera.position.x, camera.position.z)) / 40);
    renderer.toneMappingExposure = exposureFor(sky.state.sunAlt, cond.cloud);
    world.update?.(dt, { clock, cond, sky: sky.state, camera, player, settings });
    tmesh.update(camera.position);
    const t0 = performance.now();
    WEATHER.wetness.value = cond.wetness; WEATHER.snow.value = cond.snowCover; WEATHER.puddles.value = Math.max(0, cond.wetness - 0.4) / 0.6;
    pipeline.flash.value = 0;
    pipeline.render(scene, camera);
    lastFrameMs = performance.now() - t0;
    overlay.update(renderer, scene, camera, [
      `grid E ${camera.position.x.toFixed(1)} N ${(-camera.position.z).toFixed(1)} · ${(camera.position.y + terrain.meta.court_asl).toFixed(1)} m asl · ground ${(terrain.heightAt(camera.position.x, camera.position.z) + terrain.meta.court_asl).toFixed(1)}`,
      clock.label(),
      `sun alt ${sky.state.sunAlt.toFixed(1)}° · moon ${(sky.state.moonFraction * 100).toFixed(0)}% alt ${sky.state.moonAlt.toFixed(0)}°`,
      `weather: ${weather.override} · ${cond.tempC.toFixed(1)} °C · cloud ${(cond.cloud * 100).toFixed(0)}% · rain ${cond.rain.toFixed(2)} · wind ${cond.windMs.toFixed(1)} m/s from ${cond.windDirDeg.toFixed(0)}° · wet ${cond.wetness.toFixed(2)} · snow ${cond.snowCover.toFixed(2)}`,
      `terrain chunks ${tmesh.stats().chunks}, ${(tmesh.stats().tris / 1e6).toFixed(2)} M tris · ${world.summary?.() ?? ''}`,
    ]);
  }
  if (P.get('loadsave')) restore(readSave() as any);
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
