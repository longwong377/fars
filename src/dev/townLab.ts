// Dev page (townlab.html, not part of the game; D-303): one quarter of the town's houses at full detail (the town's own plan
// and house generator, src/world/settlement) on flat ground, under the game's sky, sun, shadows, tone mapping and post
// pipeline, with the scanned surfaces: a page load of ~1 min instead of the world's ~11-30, for judging the surfaces of the
// walls, footings, roofs, lanes and courts at arm's length. No people, fires, terrain or far level: the judgement that counts
// is in the world (tests/e2e/town_real.spec.ts). Test API: window.__lab. ?site=q_s1 (a quarter), ?day, ?hour, ?quality
import * as THREE from 'three/webgpu';
import { attribute } from 'three/tsl';
import { SkySystem } from '../sky/skySystem';
import { WorldClock } from '../core/clock';
import { Pipeline } from '../render/pipeline';
import { QUALITY, type Quality } from '../core/settings';
import { installWebGPUCompat } from '../render/compat';
import { surfaceMaterial } from '../render/materials';
import { loadScans } from '../render/scans';
import { registerSettlementSurfaces } from '../world/settlement/surfaces';
import { buildTownPlan } from '../world/settlement/plan';
import { SiteHouses, newHB, type HB } from '../world/settlement/houses';
import { siteGround, fittingGeom, SKIP_FITTINGS, litterMaterial } from '../world/settlement/build';
import { Batch, lin, type RGB } from '../world/settlement/geom';
import { hashString, Rng } from '../core/rng';
installWebGPUCompat();

const P = new URLSearchParams(location.search);
const quality = (P.get('quality') ?? 'high') as Quality;
const MUD: RGB = [0.56, 0.47, 0.36];
async function boot() {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu?.requestAdapter().catch(() => null);
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, reversedDepthBuffer: true,
    requiredLimits: adapter ? { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } : undefined } as any);
  await renderer.init();
  renderer.setPixelRatio(QUALITY[quality].pixelRatio); renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.AgXToneMapping; renderer.shadowMap.enabled = true; renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(+(P.get('fov') ?? 70), innerWidth / innerHeight, 0.05, 20000);
  const sky = new SkySystem(scene, QUALITY[quality].shadowMapSize, quality); await sky.loadStars('/');
  const clock = new WorldClock(+(P.get('day') ?? 25), +(P.get('hour') ?? 10.5));
  const t0 = performance.now();
  await loadScans('/');
  registerSettlementSurfaces();
  const plan = buildTownPlan(), siteId = P.get('site') ?? 'q_s1', si = plan.sites.findIndex(x => x.id === siteId), s = plan.sites[si];
  const H = () => 0;
  const n = s.plots.length, base = new Float32Array(n), local = new Uint8Array(n), pdesc = new Int32Array(n), pcol: RGB[] = [];
  for (const p of s.plots) { const rng = new Rng(hashString(p.id), 'colour'), k = rng.range(0.88, 1.07), warm = rng.range(-0.012, 0.012); // (build.ts buildSite)
    pcol[p.idx] = lin(p.kind === 'official' ? [0.58, 0.57, 0.45] : [MUD[0] * k + warm, MUD[1] * k, MUD[2] * k - warm]); }
  const hs = new SiteHouses(s, si, H, base, local, pcol, pdesc, []);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), surfaceMaterial('earth')); ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground);
  { const gb = new Batch(); siteGround(s, H, gb); const gm = surfaceMaterial('road', { vertexColors: true }) as any; gm.polygonOffset = true; gm.polygonOffsetFactor = -4; gm.polygonOffsetUnits = -8;
    const m = new THREE.Mesh(gb.toGeometry(), gm); m.receiveShadow = true; m.name = 'lab:ground'; scene.add(m); }
  const mats: Record<keyof HB, THREE.Material> = {
    plaster: Object.assign(surfaceMaterial('house_plaster', { vertexColors: true, arch: true }), { aoNode: attribute('ao', 'float') }),
    stone: Object.assign(surfaceMaterial('house_socle', { vertexColors: true }), { aoNode: attribute('ao', 'float') }),
    timber: Object.assign(surfaceMaterial('house_timber', { vertexColors: true }), { aoNode: attribute('ao', 'float') }),
    brick: Object.assign(surfaceMaterial('house_brick', { vertexColors: true }), { aoNode: attribute('ao', 'float') }),
    items: null as any, props: null as any, litter: litterMaterial() };
  mats.items = mats.plaster; mats.props = mats.timber;
  const built = new Set<number>(), group = new THREE.Group(); scene.add(group);
  /** the tiles within r of grid (e, n) at full detail */
  const buildAround = (e: number, nn: number, r = 80) => {
    for (const [t, info] of hs.tiles) { if (built.has(t) || Math.hypot(info.c[0] - e, info.c[1] - nn) > r) continue; built.add(t);
      const B = newHB(); hs.buildTile(t, B, clock.dayIndex); B.items.set('y0', -1000).set('ytop', 1e4).set('ao', 1);
      for (const f of s.fittings) if (!SKIP_FITTINGS.has(f.kind) && hs.tileOfPlotEl(f.plot, f.u, f.v) === t) fittingGeom(s, f, B.items, H, 0);
      for (const k of Object.keys(B) as (keyof HB)[]) { const b = B[k]; if (!b.tris) continue; const m = new THREE.Mesh(b.toGeometry(), mats[k]); m.castShadow = m.receiveShadow = true; m.name = `lab:${k}`; group.add(m); } }
  };
  const pipeline = new Pipeline(renderer, scene, camera, quality, sky.hemi);
  const frame = async () => {
    sky.update(clock.jdUT, camera.position, 0, 0.1);
    const sunE = sky.sun.visible ? sky.sun.intensity * Math.max(0, Math.sin((sky.state.sunAlt * Math.PI) / 180)) : 0;
    renderer.toneMappingExposure = Math.min(6, Math.max(0.35, 2.3 / (sunE + sky.hemi.intensity * 0.8 + 0.004)));
    renderer.info.reset();
    const nf = (renderer as any)._nodes?.nodeFrame; if (nf) { nf.update(); (renderer.info as any).frame = nf.frameId; }
    pipeline.render(scene, camera);
  };
  const api: any = {
    ready: false, plan, site: s, hs,
    /** grid east, north, eye height, true... (here: grid) bearing and pitch in degrees, as __parsa.view */
    view: (e: number, nn: number, eye: number, bearing: number, pitch: number, fov?: number) => { buildAround(e, nn);
      if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
      camera.position.set(e, eye, -nn); const b = bearing * Math.PI / 180, pt = pitch * Math.PI / 180;
      camera.lookAt(e + Math.sin(b) * Math.cos(pt), eye + Math.sin(pt), -(nn + Math.cos(b) * Math.cos(pt))); camera.updateMatrixWorld(); },
    setTime: (day: number, hour: number) => clock.set(day, hour),
    render: async (frames = 1) => { for (let i = 0; i < frames; i++) await frame(); },
    stats: () => ({ drawCalls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles, tiles: built.size, ms: Math.round(api.totalMs) }),
    renderer, camera, scene,
  };
  (window as any).__lab = api;
  await frame();
  api.totalMs = performance.now() - t0; api.ready = true;
  if (!P.has('test')) renderer.setAnimationLoop(() => frame());
}
boot().catch(e => { console.error(e); (window as any).__lab = { ready: false, error: String(e?.stack ?? e) }; });
