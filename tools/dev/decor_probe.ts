// D-330 dev probe (not shipped): the decor and tents classes without the world: the Terrace's parts with their carved stone
// frames and merlons, and the court camps' tents on the terrain, in the game's surface materials and scans, lit by a sun and a
// sky hemisphere only. A page load of seconds for iterating; the full world's render is the verification.
// Served by the tree's vite; driven by tools/dev/decor_probe.mjs. ?nodecor: the procedural stand-ins (A/B)
import * as THREE from 'three/webgpu';
import { loadScans } from '../../src/render/scans';
import { Terrain } from '../../src/terrain/heightfield';
import { TerrainMesh } from '../../src/terrain/terrainMesh';
import { buildTerrace } from '../../src/arch/terrace';
import { buildMeshes } from '../../src/arch/meshes';
import { loadSculpt } from '../../src/arch/sculpt';
import { buildStairCrenellations, buildReliefs } from '../../src/arch/decor';
import { setTraffic } from '../../src/render/materials';
import { loadDecorAssets, decorStats, withBakedMap, frameTrim } from '../../src/render/decorAssets';
import { loadModels } from '../../src/render/models';
import { CourtCampTents } from '../../src/world/courtCamps';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1); r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  await loadScans('/'); await loadDecorAssets('/'); await loadModels('/');
  const terrain = await Terrain.load('/');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  const tm = new TerrainMesh(terrain, 1); scene.add(tm.group);
  let tents: CourtCampTents | null = null;
  if (P.has('tents')) { // the tents of a camp file (the simulation's court tents, dumped by tools/dev/decor_probe.mjs), else none
    const T = await (await fetch('/tools/dev/decor_probe_tents.json')).json(); tents = new CourtCampTents(T, (e, n) => terrain.heightAt(e, -n)); scene.add(tents.group); tents.setTime(NaN);
  }
  if (!P.has('noarch')) {
    await loadSculpt(async p => { const q = await fetch('/' + p); if (!q.ok) throw new Error(`${p}: ${q.status}`); return q.arrayBuffer(); });
    const { parts, doorways, manifest } = buildTerrace(); setTraffic(doorways);
    const arch = buildMeshes(parts); scene.add(arch.group); (window as any).__frames = arch.frames;
    // ?framelight: the frames in the light limestone (to see the trim's relief; the game's frames are the dark polished stone);
    // ?noroof: the roofs hidden (the sun on the frames inside the halls)
    arch.group.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return;
      if (P.has('framelight') && m.name.endsWith(':frame') && frameTrim()) m.material = withBakedMap('limestone', frameTrim()!, 'frame_trim_light', { arch: true });
      if (P.has('noroof') && /: roof$/.test(String(m.userData?.note ?? ''))) m.visible = false; });
    const cren = buildStairCrenellations(parts); if (cren) scene.add(cren);
    if (P.has('reliefs')) scene.add(buildReliefs(manifest));
  }
  scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const sun = new THREE.DirectionalLight(0xfff1e0, 3.4), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 0.8);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = sc.bottom = -40; sc.right = sc.top = 40; sc.near = 1; sc.far = 3000; sun.shadow.bias = -0.0003;
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 60000);
  const dirOf = (az: number, alt: number) => { const psi = -((az - 341) * Math.PI) / 180, c = Math.cos(alt * Math.PI / 180); return new THREE.Vector3(-Math.sin(psi) * c, Math.sin(alt * Math.PI / 180), -Math.cos(psi) * c); };
  (window as any).__shot = async (v: { e: number; n: number; y?: number; eye: number; az: number; pitch: number; fov: number; sunAz: number; sunAlt: number }) => {
    const x = v.e, z = -v.n, g = v.y ?? terrain.heightAt(x, z);
    cam.position.set(x, g + v.eye, z); cam.rotation.set(v.pitch * Math.PI / 180, -((v.az - 341) * Math.PI) / 180, 0, 'YXZ'); cam.fov = v.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const d = dirOf(v.sunAz, v.sunAlt), look = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).multiplyScalar(12).add(cam.position);
    sun.position.copy(look).addScaledVector(d, 1000); sun.target.position.copy(look); sun.target.updateMatrixWorld();
    tm.update(cam.position); tents?.update(x, z, 0);
    for (let i = 0; i < 3; i++) await r.renderAsync(scene, cam);
    return { errs: errs.slice(), tents: tents ? { ...tents.info } : null };
  };
  (window as any).__ready = { decor: decorStats };
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
