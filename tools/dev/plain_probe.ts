// D-356 dev probe (not shipped): the plain as a walker meets it, without the Terrace, the town, the people or the sky: the
// terrain with the plain's ground material, buildPlain (rivers, canals, trees, crops, villages), the ground cover, the ground
// flora, the loose rocks. A page load of ~30 s against the game's 11-30 min. Serve the tree on its port, then:
// node tools/dev/plain_probe.mjs <tag> [view,view] [?query]  (frames to $OUT or shots/pp-<view>-<tag>.png)
import * as THREE from 'three/webgpu';
import { loadScans } from '../../src/render/scans';
import { Terrain } from '../../src/terrain/heightfield';
import { TerrainMesh } from '../../src/terrain/terrainMesh';
import { buildPlain } from '../../src/world/plain';
import { SEASON, BLOOM, WEATHER } from '../../src/render/materials';
import { seasonAt } from '../../src/world/season';
import { bloomAt, doyOf } from '../../src/world/plain/seasonal';
import { GroundCover, loadCoverKit } from '../../src/world/plain/groundCover';
import { loadScanProps } from '../../src/render/scanProps';
import { loadTreeAssets } from '../../src/world/trees/assets';
import { loadLifeModels } from '../../src/world/lifeModels';
import { GroundFlora } from '../../src/world/groundFlora';
import { GroundRocks } from '../../src/world/groundRocks';
import { landUseAt } from '../../src/world/plain/fields';
import type { CellCtx } from '../../src/world/smallLife';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1);
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  await loadScans('/');
  const [terrain] = await Promise.all([Terrain.load('/'), loadScanProps('/'), loadTreeAssets('/'), loadLifeModels('/'), loadCoverKit('/')]);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85); scene.fog = new THREE.FogExp2(0xb8c4d0, 0.00004);
  const tm = new TerrainMesh(terrain, 1); scene.add(tm.group);
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.2), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 0.9);
  scene.add(sun, sun.target, hemi);
  const quality = (P.get('q') ?? 'high') as any;
  const plain = await buildPlain(scene, terrain, null, { quality, seed: 1 }); scene.add(plain.group);
  const zones = plain.data.zones;
  // the small world's context as world.ts builds it (no town, no middens): water by the rivers' and canals' lines, rock by slope
  const wet: { pts: [number, number][]; hw: number }[] = [...plain.data.rivers.rivers.map(rv => ({ pts: Array.from(rv.x, (x, i) => [x, rv.y[i]] as [number, number]), hw: rv.topWidth / 2 })), ...plain.data.canals.map(c => ({ pts: c.pts as [number, number][], hw: 1.5 }))];
  const nearWet = (e: number, n: number) => { let best = 1e9, hw = 0; for (const w of wet) for (let i = 0; i < w.pts.length; i += 1) { const d = Math.hypot(w.pts[i][0] - e, w.pts[i][1] - n); if (d < best) { best = d; hw = w.hw; } } return [best, hw]; };
  const ctxAt = (e: number, n: number): CellCtx => {
    const [d, hw] = nearWet(e, n); if (d < 60) { if (d > hw - 4 && d < hw + 8) return 'water'; if (d <= hw - 4) return 'none'; }
    const h = (a: number, b: number) => terrain.heightAt(a, -b), sl = Math.hypot(h(e + 4, n) - h(e - 4, n), h(e, n + 4) - h(e, n - 4)) / 8;
    if (sl > 0.3) return 'rock';
    return landUseAt(zones, e, -n).use === 'natural' ? 'steppe' : 'field';
  };
  const groundMode = P.get('ground') ?? 'surface';
  const ground = (e: number, n: number) => groundMode === 'surface' ? terrain.surfaceAt(e, -n) : terrain.heightAt(e, -n);
  const flora = new GroundFlora(1, { ground, ctxAt }), rocks = new GroundRocks(1, { ground, ctxAt });
  scene.add(flora.group, rocks.group);
  const cover = new GroundCover({ ground: (x, z) => terrain.surfaceAt(x, z), zones, blocked: (x, z) => { const c = ctxAt(x, -z); return c === 'none' || c === 'water'; } }, 1); scene.add(cover.group);
  if (P.has('shadows')) { r.shadowMap.enabled = true; sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = sc.bottom = -+(P.get('shadows') || 120); sc.right = sc.top = +(P.get('shadows') || 120); sc.near = 1; sc.far = 3000; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.35; }
  const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 60000);
  const dirOf = (az: number, alt: number) => { const psi = -((az - 341) * Math.PI) / 180, c = Math.cos(alt * Math.PI / 180); return new THREE.Vector3(-Math.sin(psi) * c, Math.sin(alt * Math.PI / 180), -Math.cos(psi) * c); };
  (window as any).__info = () => ({ plain: plain.stats(), flora: flora.stats, rocks: rocks.stats, cover: (cover as any).stats,
    rockBoxes: rocks.slots.stone.concat(rocks.slots.boulder).filter(s => s.lod === 0).map(s => [s.prop.id, ...(s.prop.lods[0].boundingBox!.min.toArray().map(v => +v.toFixed(3))), +s.prop.size[1].toFixed(3)]) });
  (window as any).__shot = async (v: { e: number; n: number; eye: number; az: number; pitch: number; fov: number; day: number; sunAz: number; sunAlt: number; wet?: number; y?: number; hide?: string }) => {
    const ss = seasonAt(v.day); SEASON.green.value = ss.green; SEASON.dry.value = ss.dry; const bl = bloomAt(doyOf(v.day)); BLOOM.violet.value = bl.violet; BLOOM.yellow.value = bl.yellow; BLOOM.red.value = bl.red;
    WEATHER.wetness.value = v.wet ?? 0; WEATHER.puddles.value = Math.max(0, (v.wet ?? 0) - 0.4) / 0.6;
    const x = v.e, z = -v.n, g = v.y ?? terrain.surfaceAt(x, z);
    cam.position.set(x, g + v.eye, z); cam.rotation.set(v.pitch * Math.PI / 180, -((v.az - 341) * Math.PI) / 180, 0, 'YXZ'); cam.fov = v.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const d = dirOf(v.sunAz, v.sunAlt); sun.position.copy(cam.position).addScaledVector(d, 1000); sun.target.position.copy(cam.position);
    const month = new Date(Date.UTC(2001, 0, 1 + doyOf(v.day))).getUTCMonth(); // (doy 0 = 1 January)
    tm.update(cam.position);
    plain.update(0, { clock: { dayIndex: v.day }, cond: { windMs: 2 }, camera: cam, sky: { sunAlt: v.sunAlt } });
    flora.update(month, [x, -z]); rocks.update([x, -z]); cover.update(cam.position, doyOf(v.day), ss, true);
    const hide = new Set((v.hide ?? '').split(',').filter(Boolean)); flora.group.visible = !hide.has('flora'); rocks.group.visible = !hide.has('rocks'); cover.group.visible = !hide.has('cover'); plain.group.visible = !hide.has('plain');
    for (let i = 0; i < 3; i++) await r.renderAsync(scene, cam);
    const t0 = performance.now(); for (let i = 0; i < 5; i++) await r.renderAsync(scene, cam); const ms = (performance.now() - t0) / 5;
    return { errs: errs.slice(), ms: +ms.toFixed(1), month };
  };
  (window as any).__ready = true;
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
