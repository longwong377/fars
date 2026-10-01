// D-366 dev probe (not shipped): the world's surface materials on a synthetic block (a town lane between plastered houses with a
// hearth room and a street door, a 12 m retaining wall of the Terrace with its court on top, a long palace wall, open ground) with
// the grime map built from the block's own fires, doors and lane: a page load of seconds against the game's 11-30 min.
// ?nogrime: the layer's uniform at 0 (A/B in one load: __shot({ ..., grime: 0 }))
import * as THREE from 'three/webgpu';
import { loadScans } from '../../src/render/scans';
import { surfaceMaterial, SEASON } from '../../src/render/materials';
import { registerSettlementSurfaces } from '../../src/world/settlement/surfaces';
import { GrimeRaster, uploadGrime, GRIME_ON, SOOT_OF } from '../../src/render/grime';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1);
  r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  registerSettlementSurfaces(); await loadScans('/');
  SEASON.green.value = 0.2; SEASON.dry.value = 0.6;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  // a box (world centre x, z, size sx, sz, y0..y1) with the architecture's vertex attributes (the part's base and top, no floor box)
  const box = (mat: string, x: number, z: number, sx: number, sz: number, y0: number, y1: number, arch = true) => {
    const g = new THREE.BoxGeometry(sx, y1 - y0, sz).translate(x, (y0 + y1) / 2, z), n = g.attributes.position.count;
    const set = (a: string, k: number, v: number[]) => { const d = new Float32Array(n * k); for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) d[i * k + j] = v[j]; g.setAttribute(a, new THREE.BufferAttribute(d, k)); };
    set('y0', 1, [y0]); set('ytop', 1, [y1]); set('pbox', 4, [x, -z, -1, -1]); set('stair', 4, [0, 0, 0, 0]); set('adist', 4, [100, 100, 100, 100]); set('aseed', 4, [0, 0, 0, 0]); set('inner', 1, [0]); set('mzd', 2, [1, 1]);
    set('color', 3, [0.31, 0.22, 0.13]); set('ao', 1, [1]);
    const m = new THREE.Mesh(g, surfaceMaterial(mat, { arch, vertexColors: mat.startsWith('house') || mat === 'road' })); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
  };
  // the ground: open earth round, a lane of trodden 'road' (x 0..60, z −2..2)
  box('earth', 0, 0, 600, 600, -0.5, 0, false);
  box('road', 30, 0, 80, 12, 0, 0.02, false);
  // the lane's houses: plastered walls either side (z ±2.2), 2.6-3.4 m high; a room (x 10..14, z −2.2..−6.2) with its hearth, its
  // street door at x 12 (an opening: two wall pieces and a lintel)
  for (const [x0, x1, h] of [[0, 11.5, 3.0], [12.5, 30, 3.3], [30, 60, 2.7]] as const) box('house_plaster', (x0 + x1) / 2, -2.4, x1 - x0, 0.4, 0, h);
  box('house_plaster', 12, -2.4, 1, 0.4, 2.0, 3.3);
  for (const [x0, x1, h] of [[0, 25, 3.2], [25, 60, 2.9]] as const) box('house_plaster', (x0 + x1) / 2, 2.4, x1 - x0, 0.4, 0, h);
  box('house_plaster', 8, -4.4, 0.4, 4.4, 0, 3.0); box('house_plaster', 16, -4.4, 0.4, 4.4, 0, 3.3); box('house_plaster', 12, -6.4, 8.4, 0.4, 0, 3.3);
  box('house_roof', 12, -4.4, 8.4, 4.4, 3.0, 3.3, false);
  // the Terrace: a 12 m retaining wall facing W (x −40), its court on top; a palace wall of mud plaster 80 m long on it
  box('terrace', -70, 0, 60, 160, 0, 12);
  box('mudbrick', -75, -30, 40, 2, 12, 20);
  const R = new GrimeRaster(), hearth = { x: 12, y: 0.15, z: -4.4 }, torch = { x: -39.6, y: 3, z: 20 };
  for (const [k, f] of [['hearth', hearth], ['torch', torch], ['lamp', { x: 15.7, y: 1.4, z: -3.2 }]] as const) { const s = SOOT_OF[k]; R.disc(f.x, -f.z, s.r, { soot: s.soot, y: f.y }); if (s.ash) R.disc(f.x, -f.z, s.ashR, { stain: s.ash, y: f.y }); }
  R.disc(12, 2.4, 1.15, { soot: 0.55, y: 1.9 }); // the street door's lintel
  R.band([[0, 0], [60, 0]], 2.0, 0.8); R.disc(12, 2.2, 1.3, { wear: 0.85 }); R.disc(40, 0, 2.6, { stain: 0.55, y: 0 }); // the lane, its threshold, a well's damp
  const up = uploadGrime(R);
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.2), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 0.9);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = sc.bottom = -120; sc.right = sc.top = 120; sc.near = 1; sc.far = 3000; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 20000);
  const dirOf = (az: number, alt: number) => { const psi = -((az - 341) * Math.PI) / 180, c = Math.cos(alt * Math.PI / 180); return new THREE.Vector3(-Math.sin(psi) * c, Math.sin(alt * Math.PI / 180), -Math.cos(psi) * c); };
  (window as any).__shot = async (v: { x: number; y: number; z: number; tx: number; ty: number; tz: number; fov?: number; sunAz?: number; sunAlt?: number; grime?: number }) => {
    GRIME_ON.value = v.grime ?? (P.has('nogrime') ? 0 : 1);
    cam.position.set(v.x, v.y, v.z); cam.lookAt(v.tx, v.ty, v.tz); cam.fov = v.fov ?? 60; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const d = dirOf(v.sunAz ?? 160, v.sunAlt ?? 40); sun.position.copy(cam.position).addScaledVector(d, 1000); sun.target.position.copy(cam.position);
    for (let i = 0; i < 3; i++) await r.renderAsync(scene, cam);
    return errs.slice();
  };
  (window as any).__ready = { tiles: up.tiles };
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
