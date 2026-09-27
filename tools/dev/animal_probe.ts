// D-326 dev probe (not shipped): every animal species through the game's own Animals class (src/people/animals.ts), the
// modelled bodies (public/models/animals/) or, with ?animals=0, the procedural stand-ins, on a plain ground under a sun, in
// rows: standing, walking, grazing, lying. window.__shot({ az, el, dist, target, t, state, only }) renders one frame.
import * as THREE from 'three/webgpu';
import { Animals, SPECIES, ANIMAL_BUILD, type Species, type AnimalInst } from '../../src/people/animals';
import { loadAnimalModels } from '../../src/people/animalModels';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const r = new THREE.WebGPURenderer({ canvas, antialias: true }); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1); r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  const st = await loadAnimalModels('/'); (window as any).__models = st;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.62, 0.72, 0.86);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(0.46, 0.4, 0.31), roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);
  const sun = new THREE.DirectionalLight(0xfff1dd, 3.4); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.near = 1; sc.far = 200;
  const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x7a6448, 1.1); scene.add(sun, sun.target, hemi);
  const A = new Animals(64, 'animals:probe'); scene.add(A.group);
  const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 2000);
  const list: Species[] = (P.get('sp')?.split(',') as Species[]) ?? SPECIES;
  // the layout: species along x (spaced by their length), states along z
  const xs: number[] = []; { let x = 0; for (const sp of list) { const L = ANIMAL_BUILD[sp].len; xs.push(x + L * 0.5); x += Math.max(L, 0.9) * 0.9 + 0.6; } }
  (window as any).__layout = list.map((sp, i) => ({ sp, x: xs[i] })); (window as any).__len = (sp: Species) => ANIMAL_BUILD[sp].len;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S1 = new THREE.Vector3(1, 1, 1);
  (window as any).__shot = async (v: { az: number; el: number; dist: number; target: [number, number, number]; t: number; states?: string[]; yaw?: number; only?: string[]; fov?: number; sunAz?: number; sunEl?: number }) => {
    const states = v.states ?? ['stand', 'walk', 'graze', 'lie'];
    A.begin(v.t, null);
    list.forEach((sp, i) => { if (v.only && !v.only.includes(sp)) return; states.forEach((s, j) => {
      const a: AnimalInst = { sp, x: 0, z: 0, yaw: 0, phase: v.t * 2.4 + i, walk: s === 'walk' ? 1 : 0, graze: s === 'graze' ? 1 : 0, lie: s === 'lie' ? 1 : 0, coat: ((i * 7 + j * 3) % 10) / 10 };
      Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), v.yaw ?? Math.PI / 2); M.compose(new THREE.Vector3(xs[i], 0, j * 3.2), Q, S1); A.push(a, M); }); });
    A.end();
    cam.fov = v.fov ?? 40; cam.updateProjectionMatrix();
    const T = new THREE.Vector3(...v.target), az = v.az * Math.PI / 180, el = v.el * Math.PI / 180;
    cam.position.set(T.x + v.dist * Math.cos(el) * Math.sin(az), T.y + v.dist * Math.sin(el), T.z + v.dist * Math.cos(el) * Math.cos(az)); cam.lookAt(T);
    const sa = (v.sunAz ?? 140) * Math.PI / 180, se = (v.sunEl ?? 40) * Math.PI / 180;
    sun.position.set(T.x + 80 * Math.cos(se) * Math.sin(sa), 80 * Math.sin(se), T.z + 80 * Math.cos(se) * Math.cos(sa)); sun.target.position.copy(T); sun.target.updateMatrixWorld();
    for (let i = 0; i < 3; i++) await r.renderAsync(scene, cam);
    return { errs: errs.slice(), stats: A.stats() };
  };
  (window as any).__ready = true;
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
