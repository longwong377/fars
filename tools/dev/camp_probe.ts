// s17 C3 (D-570) dev probe (not shipped): the court's camp with the things before its tents, and the Hall of 100 Columns' site
// with its earth ramp, on the terrain, lit by a sun and a sky hemisphere only (crude: the world's render is the verification).
// Served by the tree's vite; driven by tools/dev/camp_probe.mjs. ?site: the Terrace and the construction view (day ?day=60);
// ?webgl: the WebGL2 backend (the cloud's headless Chromium: its WebGPU fails on texture views)
import * as THREE from 'three/webgpu';
import { loadScans } from '../../src/render/scans';
import { Terrain } from '../../src/terrain/heightfield';
import { TerrainMesh } from '../../src/terrain/terrainMesh';
import { loadDecorAssets } from '../../src/render/decorAssets';
import { loadModels } from '../../src/render/models';
import { loadScanProps } from '../../src/render/scanProps';
import { CourtCampTents } from '../../src/world/courtCamps';
import { Population } from '../../src/people/population';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = (navigator as any).gpu && !P.has('webgl') ? await (navigator as any).gpu.requestAdapter() : null;
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, ...(adapter ? { requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } : { forceWebGL: true }) } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = 1; r.shadowMap.enabled = true;
  await loadScans('/'); await loadDecorAssets('/'); await loadModels('/'); await loadScanProps('/');
  const terrain = await Terrain.load('/');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  const tm = new TerrainMesh(terrain, 1); scene.add(tm.group);
  const T = (new Population(1, { court: true }) as any).court.tents.filter((t: any) => t.camp === (P.get('camp') ?? 'court'));
  const tents = new CourtCampTents(T, (e, n) => terrain.heightAt(e, -n)); scene.add(tents.group); tents.setTime(NaN);
  let site: any = null;
  if (P.has('site')) {
    const [{ loadSculpt }, { buildTerrace }, { buildMeshes }, { Construction }, { ConstructionView }] = await Promise.all([import('../../src/arch/sculpt'), import('../../src/arch/terrace'), import('../../src/arch/meshes'), import('../../src/people/construction'), import('../../src/world/construction')]);
    await loadSculpt(async p => { const q = await fetch('/' + p); if (!q.ok) throw new Error(`${p}: ${q.status}`); return q.arrayBuffer(); });
    const { parts } = buildTerrace(); const arch = buildMeshes(parts); scene.add(arch.group);
    const C = new Construction(1); for (let d = 0; d < +(P.get('day') ?? 60); d++) C.step(d, { stone: 60, labour: 80, brick: 20, frost: false, wet: false, storm: false });
    site = new ConstructionView(arch.group, () => C); site.sync(); scene.add(site.group);
  }
  const sun = new THREE.DirectionalLight(0xfff1e0, 3.4), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 0.8);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = sc.bottom = -40; sc.right = sc.top = 40; sc.near = 1; sc.far = 3000; sun.shadow.bias = -0.0003;
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 60000);
  const dirOf = (az: number, alt: number) => { const psi = -((az - 341) * Math.PI) / 180, c = Math.cos(alt * Math.PI / 180); return new THREE.Vector3(-Math.sin(psi) * c, Math.sin(alt * Math.PI / 180), -Math.cos(psi) * c); };
  (window as any).__shot = async (v: { e: number; n: number; y?: number; eye: number; az: number; pitch: number; fov: number; sunAz: number; sunAlt: number }) => {
    const x = v.e, z = -v.n, g = v.y ?? terrain.heightAt(x, z);
    cam.position.set(x, g + v.eye, z); cam.rotation.set(v.pitch * Math.PI / 180, -((v.az - 341) * Math.PI) / 180, 0, 'YXZ'); cam.fov = v.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const d = dirOf(v.sunAz, v.sunAlt), look = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).multiplyScalar(12).add(cam.position);
    sun.position.copy(look).addScaledVector(d, 1000); sun.target.position.copy(look); sun.target.updateMatrixWorld();
    tm.update(cam.position); tents.update(x, z, 0);
    for (let i = 0; i < 2; i++) await r.renderAsync(scene, cam);
    return { tents: { ...tents.info }, drawn: tents.dressing?.drawn ?? 0, missing: tents.dressing?.missing ?? [], ramp: site?.ramp ?? null, webgpu: !!adapter };
  };
  (window as any).__ready = { tents: T.length };
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
