// D-329 dev probe (not shipped): the Blender-built monuments in the game's renderer and materials without the world. The
// Tol-e Ajori gate is built twice: the procedural stand-in (before the monuments load) at its plan position shifted 400 m
// east, and the modelled gate (after) at its plan position; views are shot before/after by moving the camera. Driven by
// tools/blender/probe/monument_probe.mjs.
import * as THREE from 'three/webgpu';
import { loadScans } from '../../../src/render/scans';
import { loadMonuments, monumentStats } from '../../../src/render/monuments';
import { buildAjori } from '../../../src/world/settlement/ajori';
import { buildTownPlan } from '../../../src/world/settlement/plan';
import { buildNaqsh } from '../../../src/world/plain/naqsh';
import { Terrain, curvatureDrop } from '../../../src/terrain/heightfield';
import { loadInscriptionFonts } from '../../../src/arch/decor';
import { loadReliefAtlas } from '../../../src/render/reliefAtlas';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1); r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  await loadScans('/');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  const { gate } = buildTownPlan(); const NAQSH = P.get('site') === 'naqsh';
  let T: Terrain | null = null, foot = 0;
  if (NAQSH) { T = await Terrain.load('/'); foot = (await (await fetch('/generated/rivers.json')).json()).naqsh_e_rustam.ancient_foot_asl;
    await loadInscriptionFonts(async p => (await fetch('/' + p)).arrayBuffer()); await loadReliefAtlas('/', r); }
  const build = () => NAQSH ? buildNaqsh(T!, foot).group : buildAjori(gate, () => 0).group;
  const before = build(); before.position.x = NAQSH ? 1000 : 400; scene.add(before);
  before.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.matrixAutoUpdate = true; m.updateMatrix(); } }); before.updateMatrixWorld(true);
  const stats = await loadMonuments('/');
  const after = build(); scene.add(after);
  const gy = NAQSH ? foot - T!.meta.court_asl - curvatureDrop(600, -6100) - 0.05 : -0.01;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9c8a70, roughness: 1 }));
  ground.position.set(NAQSH ? 600 : gate.c[0], gy, NAQSH ? -6000 : -gate.c[1]); ground.receiveShadow = true; scene.add(ground);
  const sun = new THREE.DirectionalLight(0xfff1e0, 3.4), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 1.0);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 600;
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.05, 6000);
  // gate frame helpers: (u, v, y) in the gate's frame -> world
  const G = (u: number, v: number, y: number, dx = 0) => { if (NAQSH) return new THREE.Vector3(u + dx, gy + y, v); const c = Math.cos(gate.theta), s = Math.sin(gate.theta); return new THREE.Vector3(gate.c[0] + u * c - v * s + dx, y, -(gate.c[1] + u * s + v * c)); };
  (window as any).__shot = async (v: { eye: number[]; at: number[]; fov: number; sun: number[]; before: boolean }) => {
    const dx = v.before ? (NAQSH ? 1000 : 400) : 0;
    cam.fov = v.fov; cam.position.copy(G(v.eye[0], v.eye[1], v.eye[2], dx)); cam.lookAt(G(v.at[0], v.at[1], v.at[2], dx)); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const d = new THREE.Vector3(v.sun[0], v.sun[1], v.sun[2]).normalize(), t = G(v.at[0], v.at[1], v.at[2], dx);
    sun.position.copy(t).addScaledVector(d, 300); sun.target.position.copy(t); sun.target.updateMatrixWorld();
    for (let i = 0; i < 3; i++) await r.renderAsync(scene, cam);
    return { errs: errs.slice(), info: { draws: (r.info as any).render?.drawCalls, tris: (r.info as any).render?.triangles } };
  };
  const bb = new THREE.Box3().setFromObject(after);
  (window as any).__ready = { stats, mon: monumentStats(), gy, foot, bb: [bb.min.toArray().map(Math.round), bb.max.toArray().map(Math.round)], meshes: after.children.length };
})().catch(e => { (window as any).__ready = 'ERROR ' + String(e?.stack ?? e); console.error(e); });
