// D-332 dev probe (not shipped): the modelled small life in the game's own renderer and materials, without the world. Every
// model of public/models/life/manifest.json laid out on a ground plane: the birds standing in a row along x at z = 0 (the
// ground birds' stand0) and in flight 2.5 m up at z = -3 (fly0, wings beating), the small creatures at z = 4, the flora at
// z = 8 (lod0) and z = 11 (lod1). Driven by tools/blender/probe/life_probe.mjs; ?cls=birds|small|flora limits the layout.
import * as THREE from 'three/webgpu';
import { uniform, attribute, positionLocal } from 'three/tsl';
import { loadLifeModels, lifeModel, lifeIds, lifeMaterial } from '../../../src/world/lifeModels';
import { birdFlapNode } from '../../../src/world/wildlife';
(async () => {
  const P = new URLSearchParams(location.search), CLS = P.get('cls');
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const r = new THREE.WebGPURenderer({ canvas, antialias: true }); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1); r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  const stats = await loadLifeModels('/');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  const uTime = uniform(0), layout: Record<string, [number, number, number]> = {};
  const inst = (g: THREE.BufferGeometry, m: THREE.Material, pos: THREE.Vector3, yaw: number, shadow = true) => {
    const gg = g.clone(); gg.setAttribute('bA', new THREE.InstancedBufferAttribute(new Float32Array([Math.random() * 6, 1, 0, 1]), 4)); gg.setAttribute('bB', new THREE.InstancedBufferAttribute(new Float32Array([0, 0, 0, 1]), 4)); gg.setAttribute('bC', new THREE.InstancedBufferAttribute(new Float32Array([0, 0, 0, 1]), 4)); // (phase, flap, stand and the identity axes: wildlife.ts birdIn, D-570)
    const im = new THREE.InstancedMesh(gg, m, 1); im.setMatrixAt(0, new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(1, 1, 1))); im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
  };
  let bx = 0, sx = 0, fx = 0, sbx = 0;
  for (const id of lifeIds().sort()) {
    const m = lifeModel(id)!, e = m.entry; if (CLS && e.class !== CLS) continue;
    if (e.class === 'birds') {
      const w = Math.max(0.3, (e.S ?? 0.5) * 1.1), fly = lifeMaterial(m, { fallback: [1, 0, 1] }); fly.positionNode = birdFlapNode(uTime, 3, e.sx ?? 0.01);
      const st = lifeMaterial(m, { fallback: [1, 0, 1] });
      if (m.levels.stand0) { const ws = Math.max(0.25, (e.L ?? 0.3) * 1.3); inst(m.levels.stand0, st, new THREE.Vector3(sbx + ws / 2, 0, 0), 2.2); sbx += ws; }
      inst(m.levels.fly0, fly, new THREE.Vector3(bx + w / 2, 2.5, -3), 0.3);
      layout[id] = [bx + w / 2, 0, 0]; bx += w;
    } else if (e.class === 'small') {
      const g = m.levels.lod0, mt = lifeMaterial(m, { fallback: [1, 0, 1], side: THREE.DoubleSide }); g.computeBoundingBox(); const s = g.boundingBox!.getSize(new THREE.Vector3()), w = Math.max(0.25, s.x * 1.4, s.z * 1.4);
      inst(g, mt, new THREE.Vector3(sx + w / 2, 0, 4), 0.6); layout[id] = [sx + w / 2, 0, 4]; sx += w;
    } else {
      const mt = lifeMaterial(m, { fallback: [1, 0, 1], side: THREE.DoubleSide }), g = m.levels.lod0; g.computeBoundingBox(); const w = Math.max(0.6, g.boundingBox!.getSize(new THREE.Vector3()).x * 1.3);
      inst(g, mt, new THREE.Vector3(fx + w / 2, 0, 8), 0.4); if (m.levels.lod1) inst(m.levels.lod1, mt, new THREE.Vector3(fx + w / 2, 0, 11), 0.4); layout[id] = [fx + w / 2, 0, 8]; fx += w;
    }
  }
  void attribute; void positionLocal;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9c8a70, roughness: 1 }));
  ground.position.y = -0.002; ground.receiveShadow = true; scene.add(ground);
  const sun = new THREE.DirectionalLight(0xfff1e0, 3.4), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 1.0);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 400;
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.02, 6000);
  (window as any).__shot = async (v: { eye: number[]; at: number[]; fov: number; sun: number[]; t: number }) => {
    uTime.value = v.t ?? 0; cam.fov = v.fov; cam.position.set(v.eye[0], v.eye[1], v.eye[2]); cam.lookAt(v.at[0], v.at[1], v.at[2]); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const d = new THREE.Vector3(v.sun[0], v.sun[1], v.sun[2]).normalize(), t = new THREE.Vector3(v.at[0], v.at[1], v.at[2]);
    sun.position.copy(t).addScaledVector(d, 200); sun.target.position.copy(t); sun.target.updateMatrixWorld();
    for (let i = 0; i < 3; i++) await r.renderAsync(scene, cam);
    return { errs: errs.slice(), info: { draws: (r.info as any).render?.drawCalls, tris: (r.info as any).render?.triangles } };
  };
  (window as any).__ready = { stats, layout, extent: { birds: bx, stand: sbx, small: sx, flora: fx } };
})().catch(e => { (window as any).__ready = 'ERROR ' + String(e?.stack ?? e); console.error(e); });
