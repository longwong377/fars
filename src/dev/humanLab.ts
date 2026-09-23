// Dev page (humanlab.html, not part of the game): the human system alone under the game's sky, sun, shadows, tone
// mapping and post pipeline, on a plain limestone floor, for quick close-ups of faces, dress and poses. The judgement
// that counts is in the world (tests/e2e/humans.spec.ts renders both). Test API: window.__lab.
import * as THREE from 'three/webgpu';
import { SkySystem } from '../sky/skySystem';
import { WorldClock } from '../core/clock';
import { Pipeline } from '../render/pipeline';
import { QUALITY, type Quality } from '../core/settings';
import { installWebGPUCompat } from '../render/compat';
import { loadHumans } from '../people/humans';
import { Crowd } from '../people/crowd';
import { shadowsSeePeople } from '../people/humanGPU';
import { surfaceMaterial } from '../render/materials';
import type { AnimId } from '../people/anim';
installWebGPUCompat();

const P = new URLSearchParams(location.search);
const quality = (P.get('quality') ?? 'test') as Quality;
async function boot() {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const gpuOK = P.get('webgl') !== '1' && !!(navigator as any).gpu && !!(await (navigator as any).gpu.requestAdapter().catch(() => null));
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: !gpuOK, reversedDepthBuffer: gpuOK, logarithmicDepthBuffer: !gpuOK });
  await renderer.init();
  renderer.setPixelRatio(QUALITY[quality].pixelRatio); renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.AgXToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(+(P.get('fov') ?? 50), innerWidth / innerHeight, 0.05, 20000);
  const sky = new SkySystem(scene, QUALITY[quality].shadowMapSize, quality); await sky.loadStars('/');
  shadowsSeePeople(sky.sun);
  const clock = new WorldClock(+(P.get('day') ?? 25), +(P.get('hour') ?? 10));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), surfaceMaterial('court_fill')); floor.receiveShadow = true; scene.add(floor);
  // a wall behind the lineup (a backdrop for judging silhouettes and bounce light)
  const wall = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 1).translate(0, 3, -6), surfaceMaterial('mudbrick')); wall.receiveShadow = wall.castShadow = true; scene.add(wall);
  const t0 = performance.now();
  const humans = await loadHumans({ velocity: quality !== 'test' && quality !== 'low' });
  const crowd = new Crowd(null, 1, humans); scene.add(crowd.group);
  const pipeline = new Pipeline(renderer, scene, camera, quality, sky.hemi);
  let time = 0;
  const frame = async (dt: number) => {
    time += dt;
    sky.update(clock.jdUT, camera.position, 0, 0.1);
    const sunE = sky.sun.visible ? sky.sun.intensity * Math.max(0, Math.sin((sky.state.sunAlt * Math.PI) / 180)) : 0;
    renderer.toneMappingExposure = Math.min(6, Math.max(0.35, 2.3 / (sunE + sky.hemi.intensity * 0.8 + 0.004)));
    crowd.update(time, camera.position, null, camera);
    renderer.info.reset(); pipeline.render(scene, camera);
  };
  const api: any = {
    ready: false, loadMs: humans.ms, totalMs: 0,
    /** people in a row along +X at z = 0 facing +Z (toward the camera); spec: { dress, sex, role, seed, anim?, age? } */
    lineup: (specs: any[], spacing = 0.8, look = true) => { crowd.removeExtras(); return specs.map((sp, i) => { const x = (i - (specs.length - 1) / 2) * spacing;
      const p = crowd.addExtra(`lab${i}`, { id: -1 - i, x, y: 0, z: 0, yaw: 0, look: look ? [camera.position.x, camera.position.y, camera.position.z] : null, anim: (sp.anim ?? 'idle') as AnimId, ...sp });
      return { key: p.key, variant: p.look.variantId, stature: +p.look.stature.toFixed(3), pieces: p.look.pieces }; }); },
    /** camera at (x, y, z) looking at (tx, ty, tz) */
    view: (x: number, y: number, z: number, tx: number, ty: number, tz: number) => { camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld(); },
    /** activity performances (D-142): stations { act, why?, dress, sex, role, seed?, x, z, yaw?, variant?, n? }, each its
     *  performer(s) with tools, work objects and animals as the crowd draws them in the world. The bier has four bearers
     *  (the left pair on the left shoulder), the drum haul a rope team of n in file */
    stations: (specs: any[]) => { crowd.removeExtras(); const out: any[] = [];
      specs.forEach((sp, i) => { const bier = sp.act === 'carry_bier', n = sp.n ?? (bier ? 4 : 1), yaw = sp.yaw ?? 0, c = Math.cos(yaw), s = Math.sin(yaw);
        for (let j = 0; j < n; j++) { const lx = bier ? (j % 2 ? -0.46 : 0.46) : 0, lz = bier ? (j < 2 ? 1 : -1) : -j * 1.1;
          const p = crowd.addExtra(`st${i}_${j}`, { id: -100 - i * 8 - j, sex: sp.sex, role: sp.role, dress: sp.dress, seed: (sp.seed ?? 300 + i * 37) + j * 11, x: sp.x + c * lx + s * lz, y: 0, z: sp.z - s * lx + c * lz, yaw,
            look: null, act: sp.act, why: sp.why ?? '', group: `st${i}`, variant: bier ? (lx < 0 ? 0 : -1) : sp.variant } as any);
          out.push({ key: p.key, act: sp.act }); } });
      return out; },
    /** the crowd's clock (s): poses every performance at that moment of its cycle */
    at: (t: number) => { time = t; },
    setTime: (day: number, hour: number) => clock.set(day, hour),
    /** frame lineup person i's face from `dist` m in front (and `side` m to their left) */
    frameFace: (i: number, dist = 0.6, side = 0) => { const p = crowd.persons.get(`lab${i}`); if (!p) return null; const v = humans.A.variants[p.look.variant];
      const ey = v.eyeY * p.look.scale, x = p.extra!.x, fz = 0.1 * p.look.scale; api.view(x + side, ey + 0.01, fz + dist, x, ey - 0.03, fz); p.extra!.look = [camera.position.x, camera.position.y, camera.position.z]; return { eyeY: +ey.toFixed(3) }; },
    render: async (frames = 1, dt = 1 / 30) => { for (let i = 0; i < frames; i++) await frame(dt); },
    stats: () => ({ drawCalls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles, crowd: crowd.stats(), backend: (renderer.backend as any).isWebGPUBackend ? 'WebGPU' : 'WebGL2' }),
    crowd, humans, renderer, camera, scene,
  };
  (window as any).__lab = api;
  api.view(0, 1.6, 3, 0, 1.4, 0);
  api.lineup([{ dress: 'persian', sex: 'm', role: 'official', seed: 11 }, { dress: 'guard', sex: 'm', role: 'guard', seed: 12 }, { dress: 'median', sex: 'm', role: 'guard', seed: 13 }, { dress: 'woman', sex: 'f', role: 'grinder', seed: 14 }]);
  await frame(0);
  api.totalMs = performance.now() - t0; api.ready = true;
  if (!P.has('test')) renderer.setAnimationLoop(() => frame(1 / 60));
}
boot().catch(e => { console.error(e); (window as any).__lab = { ready: false, error: String(e?.stack ?? e) }; });
