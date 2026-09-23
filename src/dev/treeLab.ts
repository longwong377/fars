// Dev page (treelab.html, not part of the game): the tree kit alone (src/world/trees) under the game's sky, sun,
// shadows, tone mapping and post pipeline, on bare ground, for quick judgement of species, seasons, levels of detail and
// the near/far switch. The judgement that counts is in the world (tests/e2e/plain.spec.ts). Test API: window.__lab.
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { SkySystem } from '../sky/skySystem';
import { WorldClock } from '../core/clock';
import { Pipeline } from '../render/pipeline';
import { QUALITY, type Quality } from '../core/settings';
import { installWebGPUCompat } from '../render/compat';
import { surfaceMaterial } from '../render/materials';
import { TreeKit, NearTreeSet, ImpostorSet, treeInst, speciesSize, impostorPx, type TreeInst } from '../world/trees/render';
import { doyOf } from '../world/plain/seasonal';
installWebGPUCompat();

const P = new URLSearchParams(location.search);
const quality = (P.get('quality') ?? 'test') as Quality;
async function boot() {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const gpuOK = P.get('webgl') !== '1' && !!(navigator as any).gpu && !!(await (navigator as any).gpu.requestAdapter().catch(() => null));
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: !gpuOK, reversedDepthBuffer: gpuOK, logarithmicDepthBuffer: !gpuOK });
  await renderer.init();
  renderer.setPixelRatio(QUALITY[quality].pixelRatio); renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.AgXToneMapping; renderer.shadowMap.enabled = true;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(+(P.get('fov') ?? 70), innerWidth / innerHeight, 0.05, 20000);
  const sky = new SkySystem(scene, QUALITY[quality].shadowMapSize, quality); await sky.loadStars('/');
  const clock = new WorldClock(+(P.get('day') ?? 80), +(P.get('hour') ?? 10));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), surfaceMaterial('earth')); ground.receiveShadow = true; scene.add(ground);
  const t0 = performance.now();
  const kit = TreeKit.get({ impostorPx: impostorPx(quality) });
  const cutC = uniform(new THREE.Vector3(1e9, 0, 1e9)), cutR = uniform(0);
  const sets = { lod0: new NearTreeSet(kit, 0, 64, true, 'lab'), lod1: new NearTreeSet(kit, 1, 64, true, 'lab'), imp: new ImpostorSet(kit, 64, { c: cutC, r: cutR }, 1e6, 'lab-imp') };
  for (const m of [sets.lod0.wood, sets.lod0.leaves, sets.lod1.wood, sets.lod1.leaves, sets.imp.mesh]) scene.add(m);
  const pipeline = new Pipeline(renderer, scene, camera, quality, sky.hemi);
  const frame = async () => {
    kit.setDay(doyOf(clock.dayIndex)); kit.wind.value = 1;
    sky.update(clock.jdUT, camera.position, 0, 0.1);
    const sunE = sky.sun.visible ? sky.sun.intensity * Math.max(0, Math.sin((sky.state.sunAlt * Math.PI) / 180)) : 0;
    renderer.toneMappingExposure = Math.min(6, Math.max(0.35, 2.3 / (sunE + sky.hemi.intensity * 0.8 + 0.004)));
    renderer.info.reset();
    // frames outside the animation loop advance the node frame themselves (as main.ts does), or the scene pass is skipped
    const nf = (renderer as any)._nodes?.nodeFrame; if (nf) { nf.update(); (renderer.info as any).frame = nf.frameId; }
    pipeline.render(scene, camera);
  };
  const api: any = {
    ready: false, kitMs: kit.buildMs, totalMs: 0,
    /** trees: { sp, x, z, lod: 0 | 1 | 'imp', h?, w?, seed? } (heights and widths default to the species' mean) */
    place: (trees: any[]) => {
      const by: Record<string, TreeInst[]> = { lod0: [], lod1: [], imp: [] };
      for (const t of trees) { const sz = speciesSize(t.sp, 0.5, 0.5); by[t.lod === 'imp' ? 'imp' : t.lod === 1 ? 'lod1' : 'lod0'].push(treeInst(t.sp, t.x, 0, t.z, t.h ?? sz.h, t.w ?? sz.w, t.seed ?? 8, 'lab')); }
      sets.lod0.set(by.lod0); sets.lod1.set(by.lod1); sets.imp.set(by.imp);
      return { lod0: by.lod0.length, lod1: by.lod1.length, imp: by.imp.length };
    },
    /** screen pixel box (CSS px) of a world box: [xmin, ymin, xmax, ymax] */
    project: (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => { const b = [1e9, 1e9, -1e9, -1e9], v = new THREE.Vector3();
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) { v.set(x, y, z).project(camera); const px = (v.x * 0.5 + 0.5) * innerWidth, py = (0.5 - v.y * 0.5) * innerHeight; b[0] = Math.min(b[0], px); b[1] = Math.min(b[1], py); b[2] = Math.max(b[2], px); b[3] = Math.max(b[3], py); }
      return b.map(Math.round); },
    /** model reference size of a species (m): height, crown width */
    size: (sp: string) => speciesSize(sp, 0.5, 0.5),
    view: (x: number, y: number, z: number, tx: number, ty: number, tz: number) => { camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld(); },
    setTime: (day: number, hour: number) => clock.set(day, hour),
    render: async (frames = 1) => { for (let i = 0; i < frames; i++) await frame(); },
    stats: () => ({ drawCalls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles, kitMs: Math.round(kit.buildMs), bakeMs: Math.round(kit.bakeMs), bakes: kit.bakes, backend: (renderer.backend as any).isWebGPUBackend ? 'WebGPU' : 'WebGL2' }),
    kit, renderer, camera, scene,
  };
  (window as any).__lab = api;
  api.view(0, 1.6, 30, 0, 5, 0); api.place([{ sp: 'plane', x: 0, z: 0, lod: 0 }]);
  await frame();
  api.totalMs = performance.now() - t0; api.ready = true;
  if (!P.has('test')) renderer.setAnimationLoop(() => frame());
}
boot().catch(e => { console.error(e); (window as any).__lab = { ready: false, error: String(e?.stack ?? e) }; });
