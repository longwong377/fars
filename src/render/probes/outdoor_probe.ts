// D-357 dev probe (not shipped): one town site as the light bake sees it (walls, lintels, roofs, ground as boxes in the game's
// own surface materials), lit by a sun and the hemisphere light through the probe lookup with and without the outdoor field
// (?outdoor=0). Seconds a load; driven by src/render/probes/outdoor_probe.mjs. Relative looks only: the world render is the
// verification. ?site=<id> (default q_n1).
import * as THREE from 'three/webgpu';
import { loadScans } from '../scans';
import { Terrain } from '../../terrain/heightfield';
import { surfaceMaterial } from '../materials';
import { registerSettlementSurfaces } from '../../world/settlement/surfaces';
import { buildTownPlan } from '../../world/settlement/plan';
import { siteLight } from './outdoor_town';
import { installProbeLight, updateProbeLights } from './runtime';
import { loadOutdoor } from './outdoor_runtime';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1); r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  installProbeLight(r);
  await loadOutdoor(P.get('lm') ?? '/');
  await loadScans('/'); registerSettlementSurfaces();
  const terrain = await Terrain.load('/'), H = (e: number, n: number) => terrain.heightAt(e, -n);
  const site = buildTownPlan().sites.find(s => s.id === (P.get('site') ?? 'q_n1'))!;
  const L = siteLight(site, H)!;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  const mats: Record<string, THREE.Material> = {};
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (const p of L.parts as any[]) {
    const m = (mats[p.material] ??= surfaceMaterial(p.material));
    const mesh = new THREE.Mesh(geo, m); mesh.scale.set(p.size[0], p.y1 - p.y0, p.size[1]); mesh.position.set(p.c[0], (p.y0 + p.y1) / 2, -p.c[1]); mesh.rotation.y = p.rot ?? 0;
    mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
  }
  const sun = new THREE.DirectionalLight(0xfff1e0, 3.4), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 0.8);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = sc.bottom = -60; sc.right = sc.top = 60; sc.near = 1; sc.far = 3000; sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 6000);
  const dirOf = (az: number, alt: number) => { const psi = -((az - 341) * Math.PI) / 180, c = Math.cos(alt * Math.PI / 180); return new THREE.Vector3(-Math.sin(psi) * c, Math.sin(alt * Math.PI / 180), -Math.cos(psi) * c); };
  // a view: (u, v) in the site's frame (cell centres at integer + 0.5), the eye 1.6 m over that cell's ground, facing local yaw
  (window as any).__site = { W: site.W, H: site.H, cells: Array.from(site.cell) };
  (window as any).__shot = async (v: { u: number; v: number; yawLocal: number; pitch: number; fov: number; sunAz: number; sunAlt: number; eye?: number }) => {
    const g = site.grid(v.u, v.v), i = Math.floor(v.u - site.u0), j = Math.floor(v.v - site.v0), y = L.ground[j * site.W + i];
    const yaw = site.frame.theta + v.yawLocal * Math.PI / 180; // local direction → world (x = e, z = -n)
    cam.position.set(g[0], y + (v.eye ?? 1.6), -g[1]);
    const look = new THREE.Vector3(Math.cos(yaw), Math.tan(v.pitch * Math.PI / 180), -Math.sin(yaw)).add(cam.position); cam.lookAt(look);
    cam.fov = v.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const d = dirOf(v.sunAz, v.sunAlt); sun.position.copy(cam.position).addScaledVector(d, 1000); sun.target.position.copy(cam.position); sun.target.updateMatrixWorld();
    sun.intensity = v.sunAlt > 0 ? 3.4 : 0; updateProbeLights(hemi, sun);
    for (let k = 0; k < 3; k++) await r.renderAsync(scene, cam);
    return errs.slice();
  };
  (window as any).__ready = true;
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
