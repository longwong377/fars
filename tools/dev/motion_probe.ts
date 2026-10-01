// D-362 dev probe (not shipped): the animals' secondary motion and the birds' take-off morph and lit wingbeat, through the
// game's own Animals class and birdFlapNode, on a plain ground under a sun. window.__anim(v) renders animals in a row;
// window.__bird(v) one bird (stand amount k, time t); window.__bench(n, frames, secondary) times n animals' frames.
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { Animals, ANIMAL_BUILD, type Species, type AnimalInst } from '../../src/people/animals';
import { loadAnimalModels } from '../../src/people/animalModels';
import { loadLifeModels, lifeModel, lifeMaterial } from '../../src/world/lifeModels';
import { birdFlapNode, BIRDS } from '../../src/world/wildlife';
(async () => {
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const r = new THREE.WebGPURenderer({ canvas, antialias: true }); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  (window as any).__models = { animals: await loadAnimalModels('/'), life: await loadLifeModels('/') };
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.62, 0.72, 0.86);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(0.46, 0.4, 0.31), roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);
  const sun = new THREE.DirectionalLight(0xfff1dd, 3.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.position.set(30, 50, 40);
  const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.near = 1; sc.far = 200;
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xbcd4ff, 0x7a6448, 1.1));
  const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 2000);
  const look = (T: number[], az: number, el: number, dist: number) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; cam.position.set(T[0] + dist * Math.cos(e) * Math.sin(a), T[1] + dist * Math.sin(e), T[2] + dist * Math.cos(e) * Math.cos(a)); cam.lookAt(T[0], T[1], T[2]); };
  const sets = new Map<boolean, Animals>();
  const animals = (sec: boolean) => { let A = sets.get(sec); if (!A) { Animals.secondary = sec; A = new Animals(256, `probe:${sec}`); sets.set(sec, A); scene.add(A.group); } for (const [k, a] of sets) a.group.visible = k === sec; return A; };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S1 = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  // one bird: the fly0 level with its standing twin, as Birds builds it
  const uT = uniform(0), id = new URLSearchParams(location.search).get('bird') ?? 'crow', lm = lifeModel(id)!, sp = Object.values(BIRDS).find(b => b.id === id) ?? BIRDS.crow;
  const g = lm.levels.fly0.clone(), data = new THREE.InstancedInterleavedBuffer(new Float32Array(12), 12);
  for (const [nm, sz, off] of [['phase', 1, 0], ['flapAmt', 1, 1], ['standAmt', 1, 2], ['bRx', 3, 3], ['bRy', 3, 6], ['bRz', 3, 9]] as const) g.setAttribute(nm, new THREE.InterleavedBufferAttribute(data, sz, off));
  const tw = lm.levels.stand0;
  if (tw) { const P = tw.getAttribute('position'), N = tw.getAttribute('normal'), a = new Float32Array(P.count * 6); for (let k = 0; k < P.count; k++) a.set([P.getX(k), P.getY(k), P.getZ(k), N.getX(k), N.getY(k), N.getZ(k)], k * 6);
    const ib = new THREE.InterleavedBuffer(a, 6); g.setAttribute('standPos', new THREE.InterleavedBufferAttribute(ib, 3, 0)); g.setAttribute('standNrm', new THREE.InterleavedBufferAttribute(ib, 3, 3)); }
  const mat = lifeMaterial(lm, { fallback: sp.colour }); mat.positionNode = birdFlapNode(uT, sp.flapHz, (lm.entry.sx as number) ?? sp.span * 0.05, !!tw);
  const birdMesh = new THREE.InstancedMesh(g, mat, 1); birdMesh.castShadow = true; birdMesh.frustumCulled = false; birdMesh.visible = false; scene.add(birdMesh);
  (window as any).__anim = async (v: { sp: Species[]; t: number; walk: number; graze?: number; az: number; el: number; dist: number; target: number[]; sec?: boolean }) => {
    const A = animals(v.sec ?? true); A.begin(v.t, null); let x = 0;
    v.sp.forEach((s, i) => { const a: AnimalInst = { sp: s, x: 0, z: 0, yaw: 0, phase: (v.t * 2.6) / ANIMAL_BUILD[s].stride, walk: v.walk, graze: v.graze ?? 0, lie: 0, coat: (i * 0.37) % 1 };
      Q.setFromAxisAngle(up, Math.PI / 2); M.compose(new THREE.Vector3(x, 0, 0), Q, S1); A.push(a, M); x += ANIMAL_BUILD[s].len + 0.8; });
    A.end(); birdMesh.visible = false; look(v.target, v.az, v.el, v.dist); await r.renderAsync(scene, cam); await r.renderAsync(scene, cam); return { errs: errs.slice(), stats: A.stats() };
  };
  (window as any).__bird = async (v: { k: number; t: number; flap?: number; yaw?: number; pos?: number[]; az: number; el: number; dist: number }) => {
    for (const A of sets.values()) A.group.visible = false; birdMesh.visible = true; uT.value = v.t;
    Q.setFromAxisAngle(up, v.yaw ?? 0); M.compose(new THREE.Vector3(...((v.pos ?? [200, 1, 0]) as [number, number, number])), Q, S1); birdMesh.setMatrixAt(0, M); birdMesh.instanceMatrix.needsUpdate = true;
    const e = M.elements, D = data.array as Float32Array; D.set([0, v.flap ?? 1, v.k, e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]]); data.needsUpdate = true;
    look(v.pos ?? [200, 1, 0], v.az, v.el, v.dist); await r.renderAsync(scene, cam); await r.renderAsync(scene, cam); return { errs: errs.slice() };
  };
  (window as any).__bench = async (n: number, frames: number, sec: boolean) => {
    const A = animals(sec), list: Species[] = ['donkey', 'ox', 'sheep', 'goat', 'dog', 'horse', 'camel_pack', 'donkey_pack'];
    birdMesh.visible = false; look([20, 0.5, 20], 40, 25, 45);
    const dev = (r.backend as any).device; const times: number[] = [];
    for (let f = 0; f < frames + 5; f++) { A.begin(f * 0.033, null);
      for (let i = 0; i < n; i++) { const s = list[i % list.length]; Q.setFromAxisAngle(up, i); M.compose(new THREE.Vector3((i % 20) * 2.2, 0, Math.floor(i / 20) * 4), Q, S1); A.push({ sp: s, x: 0, z: 0, yaw: 0, phase: f * 0.1 + i, walk: i % 2, graze: 0, lie: 0, coat: (i * 0.13) % 1 }, M); }
      A.end(); const t0 = performance.now(); await r.renderAsync(scene, cam); await dev.queue.onSubmittedWorkDone(); if (f >= 5) times.push(performance.now() - t0); }
    times.sort((a, b) => a - b); return { median: times[times.length >> 1], min: times[0], stats: A.stats(), errs: errs.slice() };
  };
  (window as any).__ready = true;
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
