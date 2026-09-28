// D-321 dev probe (not shipped): tools/dev/terrace_probe.ts with the Blender-carved block faces toggled per shot (v.bf) and the
// camera placed at a set distance from the first surface along the view (v.dist: arm's-length views of the block faces).
// Driven by tools/dev/blockface_probe.mjs
import * as THREE from 'three/webgpu';
import { loadScans } from '../../src/render/scans';
import { blockFaceStats, blockFaceLoaded, ADIST_OFF } from '../../src/render/blockface';
import { ArrisField } from '../../src/arch/arris';
import '../../src/world/plain/naqsh'; // (kaba_white)
import { registerSettlementSurfaces } from '../../src/world/settlement/surfaces';
import { Terrain } from '../../src/terrain/heightfield';
import { TerrainMesh } from '../../src/terrain/terrainMesh';
import { buildTerrace } from '../../src/arch/terrace';
import { buildMeshes } from '../../src/arch/meshes';
import { loadSculpt } from '../../src/arch/sculpt';
import { buildStairCrenellations, crenellationGeometry } from '../../src/arch/decor';
import { footGeometry } from '../../src/arch/terrace_foot';
import { surfaceMaterial, setTraffic, NOW_GROUND } from '../../src/render/materials';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1);
  r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  await loadScans('/');
  const terrain = await Terrain.load('/');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  const tm = new TerrainMesh(terrain, 1); scene.add(tm.group);
  await loadSculpt(async p => { const q = await fetch('/' + p); if (!q.ok) throw new Error(`${p}: ${q.status}`); return q.arrayBuffer(); });
  const { parts, doorways } = buildTerrace(); setTraffic(doorways);
  // D-321 rev 2: a free-standing dressed block on the court (grid e -12, n 100: 2.4 x 1.2 x 1.1 m) for the arrises at arm's length
  parts.push({ type: 'box', building: 'probe', kind: 'wall', material: 'limestone', tier: 'C', src: 'RECON', c: [-12, 100], size: [2.4, 1.2], y0: 0, y1: 1.1, rot: 0 } as any);
  const built = buildMeshes(parts); scene.add(built.group);
  const arris = new ArrisField(built.arris, m => P.has('arrisdbg') ? new THREE.MeshBasicNodeMaterial({ color: 0xff0000 }) : surfaceMaterial(m, { arch: true, band: true }), ADIST_OFF); scene.add(arris.group); // D-321 rev 2 (?arrisdbg: the bands red)
  const cren = buildStairCrenellations(parts); if (cren) scene.add(cren);
  const fg = footGeometry(parts, undefined, (e, n) => terrain.heightAt(e, -n)); arris.add(fg.arris); // rev 4: the foot blocks' arrises
  if (fg.geo) { const m = new THREE.Mesh(fg.geo, surfaceMaterial('terrace_foot', { arch: true })); m.castShadow = m.receiveShadow = true; scene.add(m); }
  scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !m.userData?.tier?.startsWith?.('B') ) { m.castShadow = true; m.receiveShadow = true; } });
  const sun = new THREE.DirectionalLight(0xfff1e0, 3.4), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 0.8);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = sc.bottom = -60; sc.right = sc.top = 60; sc.near = 1; sc.far = 3000; sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 60000);
  const dirOf = (az: number, alt: number) => { const psi = -((az - 341) * Math.PI) / 180, c = Math.cos(alt * Math.PI / 180); return new THREE.Vector3(-Math.sin(psi) * c, Math.sin(alt * Math.PI / 180), -Math.cos(psi) * c); };
  const ray = new THREE.Raycaster();
  (window as any).__shot = async (v: { e: number; n: number; eye: number; az: number; pitch: number; fov: number; sunAz: number; sunAlt: number; now?: number; court?: boolean; dist?: number; bf?: number; ar?: number }) => {
    (globalThis as any).__parsaSurf?.blockface?.(v.bf ?? 1);
    NOW_GROUND.value = v.now ?? 0;
    const x = v.e, z = -v.n, g = v.court ? 0 : terrain.heightAt(x, z); // (court: on the Terrace's top, the court datum)
    cam.position.set(x, g + v.eye, z); cam.rotation.set(v.pitch * Math.PI / 180, -((v.az - 341) * Math.PI) / 180, 0, 'YXZ'); cam.fov = v.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    if (v.dist) { // move along the view until the first surface is v.dist away
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); ray.set(cam.position, dir); ray.far = 400;
      const hit = ray.intersectObjects(scene.children, true).find(h => (h.object as THREE.Mesh).isMesh && !(h.object as any).isInstancedMesh);
      if (hit) { cam.position.addScaledVector(dir, hit.distance - v.dist); cam.updateMatrixWorld(); (window as any).__hit = { d: hit.distance, name: hit.object.name, p: hit.point.toArray() }; }
    }
    const d = dirOf(v.sunAz, v.sunAlt), look = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).multiplyScalar(25).add(cam.position);
    sun.position.copy(look).addScaledVector(d, 1000); sun.target.position.copy(look); sun.target.updateMatrixWorld();
    tm.update(cam.position);
    arris.update(v.ar === 0 ? null : cam.position, 1e9); (window as any).__arris = arris.stats;
    for (let i = 0; i < 3; i++) await r.renderAsync(scene, cam);
    return errs.slice();
  };
  // D-321: a row of sample blocks on the court (e −30…−18, n 100) in the class's other surfaces, so their shaders compile and show
  // here: the Ka'ba's and Takht-e Rustam's hairline ashlar, the town's kerb stone, the masons' rough blocks, a merlon (instanced)
  registerSettlementSurfaces();
  ['kaba_white', 'takht_stone', 'stone_plain', 'stone_rough', 'limestone'].forEach((k, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 1.2), surfaceMaterial(k)); m.position.set(-30 + i * 3, 1.1, -100); m.castShadow = m.receiveShadow = true; scene.add(m); });
  { const im = new THREE.InstancedMesh(crenellationGeometry(0.9, 0.9, 4, 1), surfaceMaterial('limestone_merlon'), 1); im.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-15, 0, -100).multiply(new THREE.Matrix4().makeScale(1, 1, 0.45))); scene.add(im); }
  (window as any).__bf = { ...blockFaceStats, loaded: blockFaceLoaded() }; (window as any).__ready = true;
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
