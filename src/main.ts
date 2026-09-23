// PĀRSA — boot, world assembly and main loop.
import * as THREE from 'three/webgpu';
import { loadSettings, saveSettings, urlParams, QUALITY, Settings } from './core/settings';
import { WorldClock, YEAR_DAYS } from './core/clock';
import { WORLD_SEED_DEFAULT } from './core/rng';
import { Input } from './core/input';
import { writeSave, readSave } from './core/save';
import { latLonToGrid, gridToLatLon } from './core/geo';
import { Terrain, curvatureDrop } from './terrain/heightfield';
import { TerrainMesh } from './terrain/terrainMesh';
import { SkySystem } from './sky/skySystem';
import { WeatherSystem, WeatherOverride } from './weather/weatherState';
import { Physics } from './player/physics';
import { Player } from './player/player';
import { makePlayerBody, animateBody } from './player/body';
import { shadowsSeePeople } from './people/humanGPU';
import { Shell } from './ui/shell';
import { DevOverlay } from './ui/overlay';
import { TranslationLayer } from './ui/translation';
import { PLACES } from './people/sim';
import { buildWorld, WorldBuild } from './world/world';
import { reliefStats } from './arch/reliefs';
import { runBench } from './world/bench';
import { installWebGPUCompat } from './render/compat';
import { Pipeline } from './render/pipeline';
import { WEATHER, SEASON } from './render/materials';
import { seasonAt } from './world/season';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
installWebGPUCompat();

const P = urlParams();
const settings: Settings = loadSettings();
if (P.get('quality')) settings.quality = P.get('quality') as any;
if (P.get('webgl')) settings.forceWebGL = P.get('webgl') === '1';
if (P.has('tl')) settings.translation = true; // tests: translation layer on
if (P.get('court')) settings.courtCalendar = P.get('court') === 'seasonal' ? 'seasonal' : 'evidence'; // tests: ?court=seasonal (C) for the court-resident scenes
const SEED = +(P.get('seed') ?? WORLD_SEED_DEFAULT);
const TEST = P.has('test'); // frozen world for camera rig / walkthrough tests
const Q = QUALITY[settings.quality];
document.body.classList.toggle('cb', settings.colourBlindUI);

const canvas = document.getElementById('view') as HTMLCanvasElement;
const overlay = new DevOverlay();
if (settings.devOverlay || P.has('overlay')) overlay.toggle();

// spawn: on the approach from the plain, west of the Grand Stair, facing the Terrace (grid east)
const SPAWN = { east: -175, north: 122.45, yaw: -Math.PI / 2 };

const TRACE = P.has('trace') ? (stage: string) => console.info('[boot]', stage, performance.now().toFixed(0), 'ms') : (_: string) => {};
async function boot() {
  const shell = new Shell(settings, hooks());
  shell.loading('Preparing the renderer…');
  let renderer: THREE.WebGPURenderer;
  try {
    // reversed-Z on WebGPU; the WebGL2 fallback needs EXT_clip_control for that, so it uses a logarithmic depth buffer (D-007)
    const gpuOK = !settings.forceWebGL && !!(navigator as any).gpu && !!(await (navigator as any).gpu.requestAdapter().catch(() => null));
    renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: !gpuOK, reversedDepthBuffer: gpuOK && !P.has('noreverse'), logarithmicDepthBuffer: !gpuOK, trackTimestamp: P.has('bench') });
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
  renderer.info.autoReset = false; // the post pipeline renders several passes per frame: count per frame (reset in frame())
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xb9c3cc, 0.00002);
  const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 110000); // far ring corners lie 101 km out
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false); });

  shell.loading('Loading the plain and the mountain…');
  const terrain = await Terrain.load('/');
  const tmesh = new TerrainMesh(terrain, Q.terrainLodBias); scene.add(tmesh.group);
  const sky = new SkySystem(scene, Q.shadowMapSize, settings.quality); await sky.loadStars('/');
  shadowsSeePeople(sky.sun); // the people's shadow-only casters live on their own layer (D-093)
  const weather = new WeatherSystem(SEED);
  if (P.get('weather')) weather.override = P.get('weather') as WeatherOverride;
  const clock = new WorldClock(+(P.get('day') ?? 0), +(P.get('hour') ?? 7.0));
  clock.scale = TEST ? 0 : settings.timeScale;

  // cascaded shadows (high/ultra): 4 cascades to 600 m; lower qualities keep the single follow-the-player map
  if (settings.quality === 'high' || settings.quality === 'ultra') {
    const csm = new CSMShadowNode(sky.sun, { cascades: 4, maxFar: 600, mode: 'practical', lightMargin: 200 });
    (sky.sun.shadow as any).shadowNode = csm; sky.sun.shadow.mapSize.set(Q.shadowMapSize / 2, Q.shadowMapSize / 2);
  }
  TRACE('before pipeline');
  const pipeline = new Pipeline(renderer, scene, camera, settings.quality, sky.hemi);
  TRACE('pipeline built');
  shell.loading('Raising the Terrace…');
  const phys = await Physics.create();
  TRACE('physics ready');
  const world: WorldBuild = await buildWorld(scene, phys, terrain, settings, weather, SEED);
  const [sx, sz] = [SPAWN.east, -SPAWN.north];
  phys.updateTerrain(terrain, { x: sx, y: 0, z: sz }); phys.step(1 / 60);
  const player = new Player(phys, sx, terrain.heightAt(sx, sz) + 0.05, sz);
  const input = new Input(canvas, () => settings);
  input.yaw = SPAWN.yaw;
  input.onInteract = () => { const r = world.address?.(camera); if (r) console.info('[translation layer]', JSON.stringify(r)); };
  const tl = new TranslationLayer(() => settings); input.onAction = a => tl.toggle(a);
  let lastSub: any = null, lastSubAt = -1e9; const inscGroup = [world.root.getObjectByName('inscriptions') ?? null, world.root.getObjectByName('nr-inscriptions') ?? null];
  const body = makePlayerBody((world as any).people?.crowd); scene.add(body);

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
    phys.updateTerrain(terrain, s.player); player.body.setTranslation(s.player, true); world.loadState?.(s.npc);
    // the world kept running while the visitor was away (§9.5): advance the clock by the real time elapsed × the time scale
    // and catch the simulation up (frozen test worlds excepted)
    const away = TEST ? 0 : Math.max(0, (Date.now() - Date.parse(s.savedAt)) / 1000) * s.timeScale;
    if (away > 1) { clock.t += away / 86400; const r = world.catchUp?.(clock.t * 24); if (r) console.info(`[persistence] caught up ${r.hours.toFixed(2)} h of world time in ${r.ms.toFixed(0)} ms`); }
    return true;
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
  /** floor under grid (east, north) for test cameras and teleports: where the walkable grid knows the floor, cast down from
   *  just above it (a cast from high up would land on a roof, lintel or colossus top: every part is a collider) */
  const groundAt = (east: number, north: number) => {
    const x = east, z = -north; phys.updateTerrain(terrain, { x, y: 0, z }); phys.step(1e-4);
    const nh = (world as any).people?.nav?.heightAt(east, north);
    return (Number.isFinite(nh) ? phys.castRayDown(x, z, nh + 1.2) : null) ?? phys.castRayDown(x, z, 400) ?? terrain.heightAt(x, z);
  };
  const api = {
    ready: false, backend,
    setTime: (day: number, hour: number) => clock.set(day, hour),
    setWeather: (w: WeatherOverride) => { weather.override = w; },
    /** place the camera at grid (east, north) with eye height above ground (or absolute asl), true-north azimuth + pitch in degrees */
    view: (east: number, north: number, eyeAboveGround: number, azTrueDeg: number, pitchDeg: number) => {
      const x = east, z = -north; const g = groundAt(east, north); freeCam = { x, y: g + eyeAboveGround, z, yaw: -((azTrueDeg - 341) * Math.PI) / 180, pitch: (pitchDeg * Math.PI) / 180 };
    },
    viewLatLon: (lat: number, lon: number, eye: number, az: number, pitch: number) => { const [e, n] = latLonToGrid(lat, lon); api.view(e, n, eye, az, pitch); },
    walkMode: () => { freeCam = null; },
    teleport: (east: number, north: number) => { const x = east, z = -north; player.teleport(x, groundAt(east, north), z); player.maxFall = 0; player.fallStartY = null; },
    setInput: (i: Partial<{ forward: number; right: number; run: boolean; yawDeg: number; pitchDeg: number }>) => { botInput = { ...botInput, ...i }; },
    playerState: () => ({ ...player.position, feetY: player.feetY, grounded: player.grounded, lastFall: player.lastFall, maxFall: player.maxFall, yaw: input.yaw, ground: phys.castRayDown(player.position.x, player.position.z, player.position.y + 0.5, player.collider) ?? terrain.heightAt(player.position.x, player.position.z) }),
    stats: () => ({ reliefs: reliefStats(), backend, drawCalls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, terrain: tmesh.stats(), frameMs: lastFrameMs, heap: (performance as any).memory?.usedJSHeapSize ?? null }),
    renderOnce: async () => { await frame(0, { render: false }); await world.settle?.(camera); await frame(0); },
    /** deterministic fixed-step simulation without rendering (walkthrough bots, soak); returns max frame sim time */
    simulate: (seconds: number, dt = 1 / 30) => { const steps = Math.round(seconds / dt); for (let i = 0; i < steps; i++) simStep(dt); },
    /** advance world time (and everything simulated) by game seconds in fixed steps, regardless of clock.scale (tests) */
    advanceWorld: (seconds: number, dt = 1) => { const steps = Math.round(seconds / dt); for (let i = 0; i < steps; i++) { clock.t += dt / 86400; simStep(dt, false); } },
    /** walkable-grid path for bots, avoiding people who are standing still (grid coords) */
    navPath: (from: [number, number], to: [number, number]) => { const P = (world as any).people; if (!P) return null;
      const still = P.sim.agents.filter((a: any) => !a.offmap && !a.walking).map((a: any) => a.pos); return P.nav.findPathAvoiding(from, to, still, 0.9); },
    address: () => world.address?.(camera) ?? null,
    /** people rendering: crowd stats (draws, triangles, people per LOD, CPU ms of posing) */
    humans: () => { const P = (world as any).people; return P ? { ...P.crowd.stats(), load: P.humans.ms, NV: P.humans.O.NV, sourceMB: +(P.humans.O.source.byteLength / 1e6).toFixed(1), capacity: P.humans.gpu.capacity } : null; },
    /** test lineup: extra people (not simulated) standing at grid (east, north) spaced along grid east, facing a heading
     *  (deg from grid north); each spec: { dress, sex, role, seed, anim?, age? }; returns their looks */
    humanLineup: (east: number, north: number, headingDeg: number, specs: any[], spacing = 0.9, lookAtCamera = true) => {
      const P = (world as any).people; if (!P) return null; P.crowd.removeExtras();
      return specs.map((sp, i) => { const e = east + i * spacing, n = north; const x = e, z = -n; const y = groundAt(e, n);
        const p = P.crowd.addExtra(`lineup${i}`, { id: -100 - i, x, y, z, yaw: Math.PI - (headingDeg * Math.PI) / 180, look: lookAtCamera ? (freeCam ? [freeCam.x, freeCam.y, freeCam.z] : [camera.position.x, camera.position.y, camera.position.z]) : null, ...sp });
        return { key: p.key, variant: p.look.variantId, stature: +p.look.stature.toFixed(3), pieces: p.look.pieces, note: p.look.note }; }); },
    clearLineup: () => (world as any).people?.crowd.removeExtras(),
    /** load test: n extra people (mixed dress and activity) scattered over a disc of `radius` m around grid (east, north) */
    humanCrowd: (n: number, east: number, north: number, radius: number) => {
      const P = (world as any).people; if (!P) return null; P.crowd.removeExtras();
      const dress = ['guard', 'median', 'persian', 'worker', 'woman', 'child', 'worker', 'median'], anims = ['walk', 'idle', 'talk', 'guard', 'carry_shoulder', 'sit', 'chisel', 'inspect'];
      for (let i = 0; i < n; i++) { const r = radius * Math.sqrt((i + 0.5) / n), a = i * 2.39996; const e = east + r * Math.cos(a), no = north + r * Math.sin(a); const d = dress[i % dress.length];
        P.crowd.addExtra(`load${i}`, { id: -1000 - i, dress: d, sex: d === 'woman' ? 'f' : 'm', role: d === 'guard' ? 'guard' : d === 'child' ? 'child' : 'porter', seed: 7000 + i, x: e, y: groundAt(e, no), z: -no, yaw: a * 3, anim: anims[i % anims.length] }); }
      return n; },
    resetFalls: () => { player.maxFall = 0; },
    exposureInfo: () => ({ exposure: renderer.toneMappingExposure, skyVis, sunAlt: sky.state.sunAlt, sunI: sky.sun.intensity, hemiI: sky.hemi.intensity, toneMapping: renderer.toneMapping }),
    popins: [] as { what: string; d: number; t: number }[],
    /** people: summary rows (out-of-world; for tests and the dev overlay) */
    people: () => { const P = (world as any).people; if (!P) return null; return { t: P.sim.t, stock: P.sim.stock, events: P.sim.events.slice(-20),
      agents: P.sim.agents.map((a: any) => ({ id: a.id, name: a.name, role: a.role, origin: a.origin, act: P.sim.performance(a).act, walking: a.walking, offmap: a.offmap, e: +a.pos[0].toFixed(2), n: +a.pos[1].toFixed(2), y: +a.y.toFixed(2), why: a.task?.why, met: a.metPlayer })) }; },
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
        // pop-in probe (§13.8): update view-dependent state (people, terrain LOD) as a real frame would, without rendering
        if ((probeT += dt) >= 0.25) { probeT = 0; camera.updateMatrixWorld(); frame(0, { sim: false, render: false }); }
      }
      botInput = { forward: 0, right: 0, run: false };
      return { reached: false, stuck: false, t, state: api.playerState() };
    },
    clockLabel: () => clock.label(), gridToLatLon, world, renderer, // renderer: tests and debugging only
    sky: () => ({ sunAlt: sky.state.sunAlt, moonAlt: sky.state.moonAlt, moonFraction: sky.state.moonFraction }),
    conditions: () => weather.conditions(clock.dayIndex, clock.localHour),
    errors: [] as string[],
    audioUnlock: () => world.audio?.unlock(), audioState: () => (world.audio as any)?.state?.(),
    /** debug: what is under NDC (x, y)? */
    pick: (x: number, y: number, group?: string) => { const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(x, y), camera); rc.far = 20000;
      const g = group ? scene.getObjectByName(group) : null; if (group && !g) return { error: `no object named ${group}` };
      const h = (g ? rc.intersectObject(g, true) : rc.intersectObjects(scene.children, true)).filter(i => (i.object as any).isMesh && i.object.visible)[0];
      return h ? { name: h.object.name || h.object.parent?.name, parent: h.object.parent?.name, d: h.distance, p: [h.point.x, h.point.y, h.point.z], mat: (h.object as any).material?.type } : null; },
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
  { const P = (world as any).people; if (P) P.crowd.onPopIn = (what: string, d: number) => api.popins.push({ what, d: +d.toFixed(1), t: clock.t }); }
  addEventListener('error', e => api.errors.push(String(e.message)));
  let freeCam: null | { x: number; y: number; z: number; yaw: number; pitch: number } = null;
  let botInput: { forward: number; right: number; run: boolean; yawDeg?: number; pitchDeg?: number } = { forward: 0, right: 0, run: false };
  let lastFrameMs = 0; let probeT = 0;

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
  let exposure = 1, adaptT = 0, skyVis = -1;
  const upRay = new THREE.Raycaster(); const archGroup = world.root.getObjectByName('architecture');
  function skyVisibility() {
    if (!archGroup) return 1; let open = 0; const dirs = [[0, 1, 0], [0.5, 0.85, 0], [-0.5, 0.85, 0], [0, 0.85, 0.5], [0, 0.85, -0.5], [0.35, 0.6, 0.35], [-0.35, 0.6, -0.35], [0.35, 0.6, -0.35], [-0.35, 0.6, 0.35]];
    for (const d of dirs) { upRay.set(camera.position, new THREE.Vector3(d[0], d[1], d[2]).normalize()); upRay.far = 60; if (upRay.intersectObject(archGroup, true).length === 0) open++; }
    return open / dirs.length;
  }
  let prev = performance.now();
  let inAnimationLoop = false; // set while three's animation loop (which advances the node frame) calls frame()
  const viewDir = new THREE.Vector3();
  async function frame(dtOverride?: number, opts: { sim?: boolean; render?: boolean } = {}) {
    const now = performance.now();
    const dt = dtOverride ?? Math.min(0.1, (now - prev) / 1000); prev = now;
    overlay.frame(dt);
    const playing = shell.mode === 'playing' || TEST || P.has('bench');
    if (playing && opts.sim !== false) simStep(dt, !TEST);
    const cond = weather.conditions(clock.dayIndex, clock.localHour);
    if (freeCam) { camera.position.set(freeCam.x, freeCam.y, freeCam.z); camera.rotation.set(freeCam.pitch, freeCam.yaw, 0, 'YXZ'); body.visible = false; }
    else {
      const e = player.eye;
      const bob = settings.headBob && player.grounded ? Math.sin(player.bobPhase * 2) * 0.025 : 0;
      camera.position.set(e.x, e.y + bob, e.z); camera.rotation.set(input.pitch, input.yaw, 0, 'YXZ');
      body.visible = true; body.position.set(e.x, player.feetY, e.z); body.rotation.y = input.yaw; animateBody(body, player.bobPhase, 1.35, dt);
      // keep the camera ahead of the torso when looking down
      body.position.x += Math.sin(input.yaw) * 0.12; body.position.z += Math.cos(input.yaw) * 0.12;
    }
    sky.update(clock.jdUT, camera.position, cond.cloud, cond.haze, { ms: cond.windMs, fromDeg: cond.windDirDeg, tSeconds: (clock.t % 7) * 86400 }, viewDir.set(0, 0, -1).applyEuler(camera.rotation));
    if (P.get('hemi')) sky.hemi.intensity *= +P.get('hemi')!; if (P.has('noshadow')) sky.sun.castShadow = false;
    if (scene.fog) (scene.fog as THREE.FogExp2).color.copy(sky.horizon); // the distance converges to the sky at the horizon (D-060)
    if (scene.fog) (scene.fog as THREE.FogExp2).density = 0.000012 + 0.00012 * cond.haze * cond.haze + 0.004 * cond.mist * Math.max(0, 1 - (camera.position.y - terrain.heightAt(camera.position.x, camera.position.z)) / 40);
    // eye adaptation (C): exposure follows an estimate of the illuminance at the eye — sun + skylight scaled by the visible
    // sky fraction (upward rays against the architecture, every 0.25 s) + moon + nearby fires — with asymmetric time constants
    adaptT += dt;
    if (adaptT > 0.25 || skyVis < 0) { adaptT = 0; skyVis = skyVisibility(); }
    const sunE = sky.sun.visible ? sky.sun.intensity * Math.max(0, Math.sin((sky.state.sunAlt * Math.PI) / 180)) : 0;
    const fireE = world.fire ? world.fire.localIlluminance(camera.position) : 0;
    const E = (sunE + sky.hemi.intensity * 0.8) * (0.15 + 0.85 * skyVis) + sky.moonLight.intensity * 0.3 + fireE + 0.004;
    const target = Math.min(6, Math.max(0.35, 2.3 / E));
    const k = target > exposure ? 1 - Math.exp(-dt / 2.5) : 1 - Math.exp(-dt / 0.6); // dark adaptation is slower than light adaptation
    exposure = TEST ? target : exposure + (target - exposure) * k;
    renderer.toneMappingExposure = exposure;
    world.update?.(dt, { clock, cond, sky: sky.state, skyLight: sky, camera, player, settings }); // skyLight: horizon radiance and sun light (D-060)
    tmesh.update(camera.position);
    const t0 = performance.now(); if (opts.render !== false) renderer.info.reset();
    { const ss = seasonAt(clock.dayIndex); SEASON.green.value = ss.green; SEASON.dry.value = ss.dry; }
    WEATHER.wetness.value = cond.wetness; WEATHER.snow.value = cond.snowCover; WEATHER.puddles.value = Math.max(0, cond.wetness - 0.4) / 0.6;
    pipeline.flash.value = world.flash?.() ?? 0;
    if (opts.render === false) return;
    // a frame rendered outside the renderer's animation loop (renderOnce, bench, bots) must advance the node frame itself:
    // passes update once per node frame, so otherwise the scene pass is skipped and only the final quad is drawn (the
    // session 2 bench and every renderOnce-based count measured that: 1 draw call, sub-millisecond "frames")
    if (!inAnimationLoop) { const nf = (renderer as any)._nodes?.nodeFrame; if (nf) { nf.update(); (renderer.info as any).frame = nf.frameId; } }
    pipeline.render(scene, camera);
    lastFrameMs = performance.now() - t0;
    { const sub = (world as any).lastSubtitle ?? null; if (sub && sub !== lastSub) { lastSub = sub; lastSubAt = now / 1000; }
      const P = (world as any).people; const hm = (t: number) => { const d = Math.floor(t / 24), h = t - d * 24; return `day ${d + 1}, ${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; };
      tl.update({ camera, inscriptions: inscGroup, subtitle: sub, subtitleAt: lastSubAt, now: now / 1000, player: { e: camera.position.x, n: -camera.position.z, yawDeg: -(input.yaw * 180) / Math.PI },
        events: P?.sim.events ?? [], timeLabel: hm, places: PLACES as any, mapLayers: (world as any).mapLayers }); }
    overlay.update(renderer, scene, camera, [
      `grid E ${camera.position.x.toFixed(1)} N ${(-camera.position.z).toFixed(1)} · ${(camera.position.y + curvatureDrop(camera.position.x, camera.position.z) + terrain.meta.court_asl).toFixed(1)} m asl · ground ${terrain.aslAt(camera.position.x, camera.position.z).toFixed(1)}`,
      clock.label(),
      `sun alt ${sky.state.sunAlt.toFixed(1)}° · moon ${(sky.state.moonFraction * 100).toFixed(0)}% alt ${sky.state.moonAlt.toFixed(0)}°`,
      `weather: ${weather.override} · ${cond.tempC.toFixed(1)} °C · cloud ${(cond.cloud * 100).toFixed(0)}% · rain ${cond.rain.toFixed(2)} · wind ${cond.windMs.toFixed(1)} m/s from ${cond.windDirDeg.toFixed(0)}° · wet ${cond.wetness.toFixed(2)} · snow ${cond.snowCover.toFixed(2)}`,
      `terrain chunks ${tmesh.stats().chunks}, ${(tmesh.stats().tris / 1e6).toFixed(2)} M tris · ${world.summary?.() ?? ''}`,
    ]);
  }
  if (P.get('loadsave')) restore(readSave() as any);
  if (P.get('bench')) {
    // the bench must time the GPU's work, not just command submission (WebGPU renders asynchronously): wait for the queue
    // (WebGPU) or read one pixel back (WebGL2) after each frame; GPU pass time from timestamp queries where supported
    const b: any = (renderer as any).backend, px = new Uint8Array(4);
    const gpuSync = async () => { if (b?.device) await b.device.queue.onSubmittedWorkDone(); else if (b?.gl) b.gl.readPixels(0, 0, 1, 1, b.gl.RGBA, b.gl.UNSIGNED_BYTE, px); };
    const gpuMs = async () => { try { if (!b?.trackTimestamp) return null; await renderer.resolveTimestampsAsync('render'); const t = (renderer.info.render as any).timestamp; return Number.isFinite(t) && t > 0 ? t : null; } catch { return null; } };
    api.ready = true; await runBench(P.get('bench')!, api, frame, gpuSync, gpuMs); return;
  }
  TRACE('world built');
  renderer.setAnimationLoop(() => { inAnimationLoop = true; try { void frame(); } finally { inAnimationLoop = false; } });
  api.ready = true;
  if (TEST) shell.playing(); else shell.title();
  void lastSave; void gridToLatLon; void YEAR_DAYS;
}


const hooksImpl: any = {};
function hooks() { return new Proxy({}, { get: (_t, k) => (...a: any[]) => hooksImpl[k]?.(...a) }) as any; }
boot().catch(e => { console.error(e); const s = document.getElementById('shell')!; s.textContent = 'Failed to start: ' + e; (window as any).__parsa = { ready: false, error: String(e) }; });
