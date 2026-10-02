// s17 C7 (D-610) dev probe (not shipped): the furnished rooms of one quarter or village as a cut-away (the walls to 1.2 m,
// no roofs, flat ground), lit by a sun and a sky hemisphere only: the furnishing's composition from above and through the
// doorways, crude (the world's render is the verification). Served by the tree's vite; driven by tools/dev/interior_probe.mjs.
// ?site=q_s1 (a quarter of the town) | ?terrace (the Terrace's ranges); ?webgl: the WebGL2 backend (the cloud's Chromium)
import * as THREE from 'three/webgpu';
import { loadScans } from '../../src/render/scans';
import { loadScanProps } from '../../src/render/scanProps';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { SiteHouses } from '../../src/world/settlement/houses';
import { registerSettlementSurfaces } from '../../src/world/settlement/surfaces';
import { interiorRing } from '../../src/world/interiors/ring';
import { registerTerraceInteriors } from '../../src/world/interiors/terrace';
import { terraceRooms } from '../../src/arch/terrace_rooms';
import type { RGB } from '../../src/world/settlement/geom';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = (navigator as any).gpu && !P.has('webgl') ? await (navigator as any).gpu.requestAdapter() : null;
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, ...(adapter ? {} : { forceWebGL: true }) } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = 1; r.shadowMap.enabled = true;
  await loadScans('/'); await loadScanProps('/'); registerSettlementSurfaces();
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(0.42, 0.36, 0.28), roughness: 1 })); ground.position.y = 0.09; ground.receiveShadow = true; scene.add(ground);
  const wallM = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(0.55, 0.46, 0.35), roughness: 1 });
  const site = P.get('site') ?? 'q_s1', walls: THREE.Matrix4[] = [];
  if (!P.has('terrace')) {
    const plan = buildTownPlan(), si = plan.sites.findIndex(s => s.id === site), s = plan.sites[si], n = s.plots.length;
    (window as any).__hs = new SiteHouses(s, si, () => 0, new Float32Array(n), new Uint8Array(n), Array.from({ length: n }, () => [0.5, 0.45, 0.35] as RGB), new Int32Array(n), []);
    for (const w of s.walls()) { const a = s.grid(w.u0, w.v0), b = s.grid(w.u1, w.v1), L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue;
      walls.push(new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, 0.6, -(a[1] + b[1]) / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(b[1] - a[1], b[0] - a[0])), new THREE.Vector3(L + w.thick, 1.2, w.thick))); }
    const hs = (window as any).__hs, { roomIn } = await import('../../src/world/interiors/town'); const hv = Object.assign(Object.create(hs), { life: (q: number) => hs.life(q), day: 30 });
    (window as any).__rooms = hs.rooms.map((rr: any) => { const ri = roomIn(hv, rr); return ri ? { id: ri.id, use: ri.use, c: s.grid((ri.u0 + ri.u1) / 2, (ri.v0 + ri.v1) / 2), w: ri.u1 - ri.u0, d: ri.v1 - ri.v0, theta: s.frame.theta } : null; }).filter((x: any) => x);
    (window as any).__site = { c: s.frame.c, doors: s.plots.filter(p => p.door).slice(0, 40).map(p => ({ id: p.id, out: s.grid(...s.doorPoints(p)!.out), in: s.grid(...s.doorPoints(p)!.inside) })) };
  } else {
    registerTerraceInteriors();
    for (const { room } of terraceRooms()) for (const [x0, y0, x1, y1] of [[room.x[0], room.y[0], room.x[1], room.y[0]], [room.x[0], room.y[1], room.x[1], room.y[1]], [room.x[0], room.y[0], room.x[0], room.y[1]], [room.x[1], room.y[0], room.x[1], room.y[1]]]) {
      const L = Math.hypot(x1 - x0, y1 - y0); walls.push(new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, room.fl + 0.6, -(y0 + y1) / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(y1 - y0, x1 - x0)), new THREE.Vector3(L, 1.2, 0.12))); }
    ground.visible = false;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), ground.material); fl.position.y = 0.3; scene.add(fl);
    (window as any).__site = { rooms: terraceRooms().map(({ room }) => ({ id: room.id, use: room.use, b: room.building, c: [(room.x[0] + room.x[1]) / 2, (room.y[0] + room.y[1]) / 2], fl: room.fl })) };
  }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wallM, walls.length); walls.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = im.receiveShadow = true; scene.add(im);
  scene.add(interiorRing.group);
  const sun = new THREE.DirectionalLight(0xfff1e0, 3.0), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 1.0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.near = 1; sc.far = 3000; sun.shadow.bias = -0.0003;
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 6000);
  (window as any).__shot = async (v: { e: number; n: number; y?: number; eye: number; az: number; pitch: number; fov: number; at?: [number, number] }) => {
    const x = v.e, z = -v.n; cam.position.set(x, (v.y ?? 0) + v.eye, z); cam.rotation.set(v.pitch * Math.PI / 180, -(v.az * Math.PI) / 180, 0, 'YXZ'); cam.fov = v.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const at = v.at ?? [v.e, v.n]; interiorRing.update(at[0], -at[1], 30, true);
    const look = new THREE.Vector3(at[0], 0, -at[1]); sun.position.copy(look).add(new THREE.Vector3(30, 60, 20)); sun.target.position.copy(look); sun.target.updateMatrixWorld();
    for (let i = 0; i < 2; i++) await r.renderAsync(scene, cam);
    return { ...interiorRing.info, webgpu: !!adapter };
  };
  (window as any).__ready = { walls: walls.length };
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
