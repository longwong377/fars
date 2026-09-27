// D-306 dev probe (not shipped): the carved pieces of the Blender pipeline in the game's own renderer and materials, without
// the world (no terrain, town, people, sky model or weather): the Gate of All Nations, the Apadana, the Tachara and the
// Harem as buildMeshes draws them (the columns with their capitals, the colossi), under one sun and a hemisphere light.
// A page load of about a minute against the full world's 11-30 min; the before/after is window.__models.ab (D-305).
// Driven by tools/blender/probe/carving_probe.mjs.
import * as THREE from 'three/webgpu';
import { loadScans } from '../../../src/render/scans';
import { loadModels, modelStats, ab, model, fitLevel, bakedMaterial, registerSwap } from '../../../src/render/models';
import { protomeBox, protomeMesh, voluteBox, voluteMesh, toGeometry } from '../../../src/arch/sculpt';
import { order } from '../../../src/arch/orders';
import { carvedMaterial } from '../../../src/arch/meshes';
import { loadSculpt } from '../../../src/arch/sculpt';
import { buildTerrace } from '../../../src/arch/terrace';
import { buildMeshes } from '../../../src/arch/meshes';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1); r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  await loadScans('/');
  await loadModels('/');
  await loadSculpt(async p => { const x = await fetch('/' + p); if (!x.ok) throw new Error(`${p}: ${x.status}`); return x.arrayBuffer(); });
  const keep = new Set((P.get('b') ?? 'gate_nations,apadana,tachara,harem').split(','));
  const { parts } = buildTerrace();
  const arch = buildMeshes(parts.filter((p: any) => keep.has(p.building)) as any, undefined, { colossusFront: undefined });
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  scene.add(arch.group);
  arch.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
  // calibration pieces (not in the game): an Apadana-size bull protome and a composite volute member lying on the ground
  // at CALIB, off the Terrace, to pair with the photographs of the fallen capitals at their own lens
  const CALIB = [-60, 0, 150];
  for (const [id, boxOf, meshOf, dx] of [['capital_protome', protomeBox, protomeMesh, 0], ['capital_volute', voluteBox, voluteMesh, -7]] as const) {
    const o = order('apadana', { capital: id === 'capital_protome' ? 'bull' : 'composite' }), [lo, hi] = (boxOf as any)(o)!, M = model(id);
    if (!M) continue;
    const g = fitLevel(M.lods[0], lo, hi), m = new THREE.Mesh(g, bakedMaterial('limestone_carved', M.maps[0], `${id}:0`));
    m.position.set(CALIB[0] + dx, CALIB[1] - lo[1], CALIB[2]); m.castShadow = m.receiveShadow = true; scene.add(m);
    registerSwap(m, [toGeometry((meshOf as any)(o, 0)!), carvedMaterial('limestone')]);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9c8a70, roughness: 1 }));
  ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground);
  const sun = new THREE.DirectionalLight(0xfff1e0, 3.4), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 1.0);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 400;
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.1, 6000);
  const lods: any[] = []; arch.group.traverse(o => { if ((o as any).isLOD || typeof (o as any).update === 'function' && (o as any).levels) lods.push(o); });
  (window as any).__models_stats = modelStats;
  (window as any).__shot = async (v: { eye: number[]; at: number[]; fov: number; sun: number[]; models: boolean; w?: number; h?: number }) => {
    ab(v.models);
    cam.fov = v.fov; cam.position.set(v.eye[0], v.eye[1], v.eye[2]); cam.lookAt(v.at[0], v.at[1], v.at[2]); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const d = new THREE.Vector3(v.sun[0], v.sun[1], v.sun[2]).normalize(), t = new THREE.Vector3(v.at[0], v.at[1], v.at[2]);
    sun.position.copy(t).addScaledVector(d, 200); sun.target.position.copy(t); sun.target.updateMatrixWorld();
    for (const l of lods) l.update?.(cam);
    for (let i = 0; i < 3; i++) await r.renderAsync(scene, cam);
    return { errs: errs.slice(), info: { draws: (r.info as any).render?.drawCalls, tris: (r.info as any).render?.triangles } };
  };
  (window as any).__ready = { models: modelStats(), tris: arch.triangles };
})().catch(e => { (window as any).__ready = 'ERROR ' + String(e?.stack ?? e); console.error(e); });
