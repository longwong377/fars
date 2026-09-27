// D-325 dev probe (not shipped): the modelled props in the game's own renderer and materials, without the world. Every class
// laid out on a ground plane twice: at x >= 0 as the game draws it now (the models), at x <= -200 with the models off (the
// procedural stand-ins), so each view is shot before/after by moving the camera 200 m. Rows (z): palace furnishings (0),
// work objects (8 .. 20), held props (-6), fire bodies and doors (-12), the Treasury's goods and the rooms' fittings (-18),
// the town's fittings (-24). Driven by tools/blender/probe/props_probe.mjs.
import * as THREE from 'three/webgpu';
import { attribute } from 'three/tsl';
import { loadScans } from '../../../src/render/scans';
import { loadScanProps, setModelsOff, modelParts } from '../../../src/render/scanProps';
import { itemGeometry, furnishingMaterial, type FurnItem, type FurnKind } from '../../../src/world/furnish_palaces';
import { workGeometry, WORK_NOTES, type WorkKind } from '../../../src/people/workObjects';
import { propGeometry, MODELLED_TOOLS } from '../../../src/people/props';
import { buildTreasuryGoods, buildRoomFittings } from '../../../src/world/furnish';
import { fittingGeom } from '../../../src/world/settlement/build';
import { Batch } from '../../../src/world/settlement/geom';
import { FireSystem } from '../../../src/world/fire';
import { surfaceMaterial, propScanNodes } from '../../../src/render/materials';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1); r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  await loadScans('/');
  const stats = await loadScanProps('/');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  // (the crowd's prop material: each vertex under the scan of what it is made of, crowd.ts propMaterial; ?noscan=1 without)
  const propMat = new THREE.MeshStandardNodeMaterial(); { const mr = attribute('mr', 'vec2'); const S = P.get('noscan') ? { color: attribute('color', 'vec3'), rough: mr.y, normal: null } : propScanNodes(attribute('color', 'vec3'), mr.y);
    propMat.colorNode = S.color; propMat.metalnessNode = mr.x; propMat.roughnessNode = S.rough; if (S.normal) propMat.normalNode = S.normal; propMat.side = THREE.DoubleSide; }
  const vcMat = new THREE.MeshStandardNodeMaterial(); vcMat.colorNode = attribute('color', 'vec3'); vcMat.roughness = 0.85;
  const add = (o: THREE.Object3D) => { o.traverse(m => { if ((m as THREE.Mesh).isMesh) { m.castShadow = m.receiveShadow = true; } }); scene.add(o); };
  const layout = (ox: number) => {
    // palace furnishings: one of each kind at the SITE_SPEC sizes (the builder's own geometry per material)
    const kinds: [FurnKind, number, number, number][] = [['couch', 2.0, 0.85, 0.9], ['couch_covered', 2.0, 0.85, 0.9], ['table', 0.9, 0.55, 0.6], ['stool', 0.45, 0.45, 0.45], ['stool_stack', 0.45, 0.45, 1.35], ['footstool', 0.55, 0.35, 0.12],
      ['incense_burner', 0.36, 0.36, 0.95], ['lamp_stand', 0.32, 0.32, 1.3], ['chest', 1.0, 0.55, 0.55], ['jar', 0.56, 0.56, 0.9], ['carpet', 2.0, 1.83, 0.012], ['carpet_rolls', 2.0, 0.83, 0.65], ['hanging_rolls', 2.2, 0.54, 0.32], ['mat', 2.0, 1.2, 0.01], ['hanging', 2.0, 0.1, 3.8], ['canopy', 4.12, 4.52, 3.4]];
    let x = ox;
    for (const [k, L, W, H] of kinds) { const it: FurnItem = { kind: k, building: 'probe', room: 'probe', state: 'use', e: 0, n: 0, y: 0, theta: 0, hu: L / 2, hv: W / 2, h: H, solid: true, metal: 'gilt', count: k.endsWith('rolls') ? 6 : 3, variant: 1, note: '' };
      const Pm = itemGeometry(it), g = new THREE.Group(); for (const [mat, list] of Object.entries(Pm)) for (const geo of list as THREE.BufferGeometry[]) g.add(new THREE.Mesh(geo, furnishingMaterial(mat)));
      g.position.set(x + L / 2, 0, 0); add(g); x += L + 0.8; }
    // work objects, in rows by size
    let wx = ox, wz = 8, rowH = 0;
    for (const k of Object.keys(WORK_NOTES) as WorkKind[]) { const g = workGeometry(k); g.computeBoundingBox(); const b = g.boundingBox!, s = b.getSize(new THREE.Vector3());
      if (wx - ox + s.x > 60) { wx = ox; wz += rowH + 1.2; rowH = 0; } const m = new THREE.Mesh(g, propMat); m.position.set(wx - b.min.x, 0, wz - b.min.z); add(m); wx += s.x + 0.8; rowH = Math.max(rowH, s.z); }
    // held props lying on the ground, their long axis along x
    let tx = ox; for (const k of [...MODELLED_TOOLS, 'jar', 'sack', 'basket', 'bowl']) { const g = propGeometry(k)!.clone(); g.computeBoundingBox(); let b = g.boundingBox!, s = b.getSize(new THREE.Vector3());
      if (s.y > s.x && s.y >= s.z) g.rotateZ(-Math.PI / 2); else if (s.z > s.x) g.rotateY(Math.PI / 2);
      g.computeBoundingBox(); b = g.boundingBox!; s = b.getSize(new THREE.Vector3()); const m = new THREE.Mesh(g, propMat); m.position.set(tx - b.min.x, -b.min.y, -6 - (b.min.z + b.max.z) / 2); add(m); tx += s.x + 0.35; }
    // fire bodies and a door leaf with its bands and bosses
    const fire = new FireSystem(0); let fx = ox;
    for (const k of ['brazier', 'hearth', 'oven', 'torch'] as const) { fire.add(k, new THREE.Vector3(fx, k === 'torch' ? 1.8 : 0, -12), { tier: 'C', src: 'RECON', note: '' }); fx += 2.2; }
    fire.build(); add(fire.group);
    const timber = surfaceMaterial('timber'), bronze = surfaceMaterial('bronze');
    const unit = (id: string, part: string, alt: THREE.BufferGeometry) => modelParts(id, 0)?.[part] ?? alt;
    const leaf = new THREE.Mesh(unit('door_leaf', 'leaf', new THREE.BoxGeometry(1, 1, 1)), timber); leaf.scale.set(1.3, 3.2, 0.12); leaf.position.set(fx + 1, 1.6, -12); add(leaf);
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(unit('door_band', 'band', new THREE.BoxGeometry(1, 1, 1)), bronze); b.scale.set(1.3, 0.08, 0.132); b.position.set(fx + 1, 3.2 * (k + 1) / 5, -12); add(b);
      for (let j = 0; j < 6; j++) { const s = new THREE.Mesh(unit('door_boss', 'boss', new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2)), bronze); s.scale.setScalar(0.022); s.position.set(fx + 0.45 + j * 0.2, 3.2 * (k + 1) / 5, -12 + 0.066); add(s); } }
    const post = new THREE.Mesh(unit('door_post', 'post', new THREE.CylinderGeometry(1, 1, 1, 12)), timber); post.scale.set(0.07, 3.2, 0.07); post.position.set(fx + 0.3, 1.6, -12); add(post);
    // the Treasury's goods on a bench, the rooms' fittings
    const bench = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 0.8).translate(0, 0.4, 0), surfaceMaterial('limestone')); bench.position.set(ox + 4, 0, 18 + 0); bench.position.z = -18; add(bench);
    const goods = buildTreasuryGoods([[ox + 4, 18, 8, 0.8, 0.8]], 1); add(goods);
    add(buildRoomFittings('probe', { mats: [[ox + 10, 18, 0.9, 2, 0, 0]], jars: [[ox + 12, 18, 0]], querns: [[ox + 13, 18, 0]], lamps: [[ox + 14, 18, 0.6]] }));
    // the town's fittings in one batch
    const B = new Batch(), site: any = { id: 'probe', grid: (u: number, v: number) => [u, v], frame: { theta: 0 } }; let fu = ox;
    for (const kind of ['hearth', 'forge', 'kiln', 'quern', 'grind_slab', 'loom', 'timber', 'anvil', 'bench', 'knucklebones', 'toys', 'trough', 'manger', 'jar', 'jar_big', 'vat']) {
      const w = kind === 'kiln' ? 3 : kind === 'timber' ? 3.6 : 2; fittingGeom(site, { kind, u: fu + w / 2, v: 24, rot: 0, size: 1, len: 3 } as any, B, () => 0, 1); fu += w; }
    add(new THREE.Mesh(B.toGeometry(), vcMat));
  };
  setModelsOff(false); layout(0);
  setModelsOff(true); layout(-200);
  setModelsOff(false);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9c8a70, roughness: 1 }));
  ground.position.y = -0.002; ground.receiveShadow = true; scene.add(ground);
  const sun = new THREE.DirectionalLight(0xfff1e0, 3.4), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 1.0);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 400;
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.05, 6000);
  (window as any).__shot = async (v: { eye: number[]; at: number[]; fov: number; sun: number[]; before: boolean }) => {
    const dx = v.before ? -200 : 0;
    cam.fov = v.fov; cam.position.set(v.eye[0] + dx, v.eye[1], v.eye[2]); cam.lookAt(v.at[0] + dx, v.at[1], v.at[2]); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const d = new THREE.Vector3(v.sun[0], v.sun[1], v.sun[2]).normalize(), t = new THREE.Vector3(v.at[0] + dx, v.at[1], v.at[2]);
    sun.position.copy(t).addScaledVector(d, 200); sun.target.position.copy(t); sun.target.updateMatrixWorld();
    for (let i = 0; i < 3; i++) await r.renderAsync(scene, cam);
    return { errs: errs.slice(), info: { draws: (r.info as any).render?.drawCalls, tris: (r.info as any).render?.triangles } };
  };
  (window as any).__ready = { stats };
})().catch(e => { (window as any).__ready = 'ERROR ' + String(e?.stack ?? e); console.error(e); });
