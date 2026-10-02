// s15/ship (D-368) probe (not shipped): src/render/progressive.ts on the GPU, on a scene of the game's own materials (the
// Terrace's parts and carved members, the terrain, sun shadows: as tools/dev/terrace_probe.ts) without the full world.
// ?mode=sync (three's default: the first frame compiles everything) | progressive (&budget=<ms>). Reports, from the moment the
// scene is built: the first frame's wall time, frames drawn, the longest frame, and the time until every draw is built and
// every pipeline compiled (the draw count then equals a synchronous frame's).
import * as THREE from 'three/webgpu';
import { loadScans } from '../../src/render/scans';
import { Terrain } from '../../src/terrain/heightfield';
import { TerrainMesh } from '../../src/terrain/terrainMesh';
import { buildTerrace } from '../../src/arch/terrace';
import { buildMeshes } from '../../src/arch/meshes';
import { loadSculpt } from '../../src/arch/sculpt';
import { buildStairCrenellations } from '../../src/arch/decor';
import { setTraffic } from '../../src/render/materials';
import { installProgressiveCompile } from '../../src/render/progressive';
(async () => {
  const P = new URLSearchParams(location.search), mode = P.get('mode') ?? 'progressive', budget = +(P.get('budget') ?? 40);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.shadowMap.enabled = true; r.info.autoReset = false;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  await loadScans('/');
  const terrain = await Terrain.load('/');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  const tm = new TerrainMesh(terrain, 1); scene.add(tm.group);
  await loadSculpt(async p => { const q = await fetch('/' + p); if (!q.ok) throw new Error(`${p}: ${q.status}`); return q.arrayBuffer(); });
  const { parts, doorways } = buildTerrace(); setTraffic(doorways);
  scene.add(buildMeshes(parts).group);
  const cren = buildStairCrenellations(parts); if (cren) scene.add(cren);
  scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const sun = new THREE.DirectionalLight(0xfff1e0, 3.4), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 0.8);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = sc.bottom = -120; sc.right = sc.top = 120; sc.near = 1; sc.far = 3000;
  sun.position.set(-300, 600, 200); scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 60000); cam.position.set(-120, terrain.heightAt(-120, -60) + 30, -60); cam.lookAt(40, 10, 0); cam.updateMatrixWorld();
  tm.update(cam.position);
  const pc = mode === 'progressive' ? installProgressiveCompile(r, budget) : null;
  const res: any = { mode, budget: pc ? budget : null, frames: 0, firstMs: 0, maxMs: 0, settledMs: null, draws: [] as number[], errs };
  const t0 = performance.now(); let quiet = 0, lastDraws = -1;
  const step = async () => {
    const t = performance.now(); r.info.reset(); pc?.drawStart(); r.render(scene, cam); pc?.drawEnd();
    if (!pc) await (r.backend as any).device.queue.onSubmittedWorkDone(); // (sync: the frame's compiles are its wall time)
    const ms = performance.now() - t; res.frames++; if (res.frames === 1) res.firstMs = Math.round(performance.now() - t0); res.maxMs = Math.max(res.maxMs, Math.round(ms));
    const s = pc?.stats() ?? { live: 0, deferred: 0 }, d = r.info.render.drawCalls; res.draws.push(d);
    quiet = s.live === 0 && s.deferred === 0 && d === lastDraws ? quiet + 1 : 0; lastDraws = d;
    if (quiet >= 5 || performance.now() - t0 > 600000) { res.settledMs = Math.round(performance.now() - t0); res.finalDraws = d; res.draws = res.draws.filter((_: number, i: number) => i < 8 || i % 20 === 0).slice(0, 60); (window as any).__result = res; return; }
    requestAnimationFrame(() => void step());
  };
  requestAnimationFrame(() => void step());
})().catch(e => { (window as any).__result = { error: String(e) }; console.error(e); });
