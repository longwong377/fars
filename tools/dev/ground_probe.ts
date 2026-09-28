// D-302 dev probe (not shipped): the terrain with the plain's ground material and the rivers' banks, no Terrace, town, people or sky
import * as THREE from 'three/webgpu';
import { loadScans } from '../../src/render/scans';
import { Terrain } from '../../src/terrain/heightfield';
import { TerrainMesh } from '../../src/terrain/terrainMesh';
import { bakeTerrainDetail } from '../../src/terrain/terrainDetail';
import { PlainGround } from '../../src/world/plain/terrainPlain';
import { buildZones } from '../../src/world/plain/fields';
import { loadRivers } from '../../src/world/plain/data';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages } from '../../src/world/plain/villages';
import { buildRivers } from '../../src/world/plain/rivers';
import { canalBanks } from '../../src/world/plain/ribbons';
import { SEASON, BLOOM, WEATHER } from '../../src/render/materials';
import { seasonAt } from '../../src/world/season';
import { bloomAt, doyOf } from '../../src/world/plain/seasonal';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { buildTownGround } from '../../src/world/plain/townGround';
import { Bedrock, loadRockKit } from '../../src/world/hills/bedrock';
import { Ledges, loadLedgeFace } from '../../src/world/hills/ledges';
import { CURV_SCALE } from '../../src/terrain/terrainDetail';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1);
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  await loadScans('/');
  const terrain = await Terrain.load('/');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  const tm = new TerrainMesh(terrain, 1); scene.add(tm.group);
  const rivers = await loadRivers(), canals = buildCanals(terrain, rivers.rivers, 1), villages = placeVillages(terrain, rivers.rivers, canals, 1);
  const town = P.has('town') ? buildTownPlan() : null, townGround = town ? buildTownGround(town, [], []) : null;
  const zones = buildZones({ terrain, rivers: rivers.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })), ground: townGround,
    sites: town?.sites.map(s => ({ c: s.frame.c as [number, number], theta: s.frame.theta, W: s.W, H: s.H })) });
  const detail = await bakeTerrainDetail(terrain);
  const ground = new PlainGround(zones, detail);
  tm.group.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = ground.material; });
  const rv = buildRivers(terrain, rivers.rivers, canals); scene.add(rv.group); scene.add(canalBanks(canals, terrain));
  // D-335: ?bedrock: the hills' rock pieces (src/world/hills/bedrock.ts) and sun shadows (one 300 m map round the camera)
  let bedrock: Bedrock | null = null, ledges: Ledges | null = null;
  if (P.has('bedrock')) { await loadRockKit('/'); await loadLedgeFace('/');
    const dmap = (m: any, ch: number, x: number, z: number) => { const fx = (x + m.half) / m.cell, fy = (z + m.half) / m.cell; if (fx < 0 || fy < 0 || fx > m.n - 1 || fy > m.n - 1) return null; const c = Math.floor(fx), rr = Math.floor(fy); return m.data[(rr * m.n + c) * 4 + ch] / 255; };
    const both = (ch: number, x: number, z: number) => dmap(detail.near, ch, x, z) ?? dmap(detail.mid, ch, x, z) ?? (ch === 1 ? 128 / 255 : 0);
    const env = { ground: (x: number, z: number) => terrain.surfaceAt(x, z), gully: (x: number, z: number) => both(0, x, z), curv: (x: number, z: number) => (both(1, x, z) * 255 - 128) / CURV_SCALE };
    bedrock = new Bedrock(env, 1); scene.add(bedrock.group); ledges = new Ledges(env, 1); scene.add(ledges.group); }
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.2), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 0.9);
  if (P.has('shadows')) { r.shadowMap.enabled = true; sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = sc.bottom = -+(P.get('shadows') || 150); sc.right = sc.top = +(P.get('shadows') || 150); sc.near = 1; sc.far = 3000; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.35; }
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 60000);
  const dirOf = (az: number, alt: number) => { const psi = -((az - 341) * Math.PI) / 180, c = Math.cos(alt * Math.PI / 180); return new THREE.Vector3(-Math.sin(psi) * c, Math.sin(alt * Math.PI / 180), -Math.cos(psi) * c); };
  (window as any).__shot = async (v: { e: number; n: number; eye: number; az: number; pitch: number; fov: number; day: number; sunAz: number; sunAlt: number; wet?: number }) => {
    const ss = seasonAt(v.day); SEASON.green.value = ss.green; SEASON.dry.value = ss.dry; const bl = bloomAt(doyOf(v.day)); BLOOM.violet.value = bl.violet; BLOOM.yellow.value = bl.yellow; BLOOM.red.value = bl.red;
    WEATHER.wetness.value = v.wet ?? 0; WEATHER.puddles.value = Math.max(0, (v.wet ?? 0) - 0.4) / 0.6; ground.setDay(doyOf(v.day));
    const x = v.e, z = -v.n, g = terrain.heightAt(x, z);
    cam.position.set(x, g + v.eye, z); cam.rotation.set(v.pitch * Math.PI / 180, -((v.az - 341) * Math.PI) / 180, 0, 'YXZ'); cam.fov = v.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const d = dirOf(v.sunAz, v.sunAlt); sun.position.copy(cam.position).addScaledVector(d, 1000); sun.target.position.copy(cam.position);
    tm.update(cam.position); if (bedrock) { bedrock.update(cam.position, cam.getWorldDirection(new THREE.Vector3()), true); ledges!.update(cam.position, true); (window as any).__bedrock = { ...bedrock.stats, ledges: ledges!.stats }; }
    for (let i = 0; i < 3; i++) await r.renderAsync(scene, cam);
    return errs.slice();
  };
  (window as any).__ready = true;
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
