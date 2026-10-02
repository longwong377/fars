// D-510 dev probe (V4, from palace_probe D-334) (not shipped): the Terrace's architecture (every palace with its mud-brick walls, roofs, ceilings, frames,
// crenellations and the arris bands) on the terrain, in the game's materials and scans, lit by a sun with a shadow map and a
// sky hemisphere; no sky model, probes, exposure or people. The camera is placed by an eye and a look point in grid
// coordinates (e, n, height). Driven by tools/dev/palace_probe.mjs
import * as THREE from 'three/webgpu';
import { loadScans, bakesLoaded } from '../../src/render/scans';
import { ADIST_OFF } from '../../src/render/blockface';
import { ArrisField } from '../../src/arch/arris';
import { Terrain } from '../../src/terrain/heightfield';
import { TerrainMesh } from '../../src/terrain/terrainMesh';
import { buildTerrace } from '../../src/arch/terrace';
import { buildMeshes } from '../../src/arch/meshes';
import { loadSculpt } from '../../src/arch/sculpt';
import { buildStairCrenellations } from '../../src/arch/decor';
import { footGeometry } from '../../src/arch/terrace_foot';
import { surfaceMaterial, setTraffic } from '../../src/render/materials';
import { loadModels } from '../../src/render/models';
import { roofEdges, wallFeet } from '../../src/arch/roofedge';
import { loadReliefAtlas } from '../../src/render/reliefAtlas';
import { buildReliefs, buildPhase4Reliefs, loadInscriptionFonts, buildInscriptions } from '../../src/arch/decor';
import { settleReliefs, buildReliefShadow, ReliefSet } from '../../src/arch/reliefs';
import { setReliefShadow, refreshReliefShadow } from '../../src/render/reliefShadow';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1);
  r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  await loadScans('/');
  try { await loadModels('/', r); } catch (e) { console.warn('models', e); }
  const terrain = await Terrain.load('/');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  const tm = new TerrainMesh(terrain, 1); scene.add(tm.group);
  await loadSculpt(async p => { const q = await fetch('/' + p); if (!q.ok) throw new Error(`${p}: ${q.status}`); return q.arrayBuffer(); });
  const { parts, doorways, manifest } = buildTerrace() as any; setTraffic(doorways);
  if (P.get('reliefs') !== '0') { await loadReliefAtlas('/', r); const rel = buildReliefs(manifest); scene.add(rel); const p4 = buildPhase4Reliefs(doorways); scene.add(p4.group);
    try { setReliefShadow(buildReliefShadow([...rel.children, ...p4.group.children].filter((c: any): c is ReliefSet => c instanceof ReliefSet))); } catch (e) { console.warn('reliefshadow', e); }
    try { await loadInscriptionFonts(async p => (await fetch('/' + p)).arrayBuffer()); scene.add(buildInscriptions(manifest, parts, p4.inscriptions)); } catch (e) { console.warn('insc', e); } }
  const built = buildMeshes(parts); scene.add(built.group);
  const arris = new ArrisField(built.arris, m => surfaceMaterial(m, { arch: true, band: true }), ADIST_OFF); scene.add(arris.group);
  const cren = buildStairCrenellations(parts); if (cren) scene.add(cren);
  const fg = footGeometry(parts, undefined, (e, n) => terrain.heightAt(e, -n));
  if (fg.geo) { const m = new THREE.Mesh(fg.geo, surfaceMaterial('terrace_foot')); m.castShadow = m.receiveShadow = true; scene.add(m); }
  scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const sun = new THREE.DirectionalLight(0xfff1e0, 3.4), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 0.8);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = sc.bottom = -90; sc.right = sc.top = 90; sc.near = 1; sc.far = 3000; sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 60000);
  const dirOf = (az: number, alt: number) => { const psi = -((az - 341) * Math.PI) / 180, c = Math.cos(alt * Math.PI / 180); return new THREE.Vector3(-Math.sin(psi) * c, Math.sin(alt * Math.PI / 180), -Math.cos(psi) * c); };
  // per building: the plan bounds and heights of its mud-brick and roof parts (to place views)
  const bb: Record<string, number[]> = {};
  for (const p of parts as any[]) {
    if (p.type !== 'box' || !(p.material?.startsWith('mudbrick') || p.kind === 'roof')) continue;
    const h = Math.hypot(p.size[0], p.size[1]) / 2, B = bb[p.building] ?? (bb[p.building] = [1e9, -1e9, 1e9, -1e9, 1e9, -1e9]);
    B[0] = Math.min(B[0], p.c[0] - h); B[1] = Math.max(B[1], p.c[0] + h); B[2] = Math.min(B[2], p.c[1] - h); B[3] = Math.max(B[3], p.c[1] + h); B[4] = Math.min(B[4], p.y0); B[5] = Math.max(B[5], p.y1);
  }
  (window as any).__bb = bb;
  // D-334: sample places of the class per building (the first dentil, spout and wall-foot run), to aim views at them
  const RE = roofEdges(parts), FT = wallFeet(parts), at: Record<string, any> = {};
  for (const p of RE.pieces) { const k = p.building + ':' + p.kind; if (!at[k]) at[k] = [p.e, p.n, p.y, p.az]; }
  for (const f of FT) { const k = f.building + ':foot:' + f.material; if (!at[k] && f.size[0] > 3) at[k] = [f.c[0], f.c[1], f.y0, (f.rot ?? 0) - Math.PI / 2]; }
  (window as any).__at = at;
  (window as any).__shot = async (v: { eye: number[]; look: number[]; fov?: number; sunAz: number; sunAlt: number; flags?: Record<string, number> }) => {
    for (const [k, x] of Object.entries(v.flags ?? {})) (globalThis as any).__parsaSurf?.[k]?.(x);
    cam.position.set(v.eye[0], v.eye[2], -v.eye[1]); cam.lookAt(v.look[0], v.look[2], -v.look[1]); cam.fov = v.fov ?? 60; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const d = dirOf(v.sunAz, v.sunAlt), look = new THREE.Vector3(v.look[0], v.look[2], -v.look[1]);
    sun.position.copy(look).addScaledVector(d, 1000); sun.target.position.copy(look); sun.target.updateMatrixWorld();
    tm.update(cam.position);
    arris.update(cam.position, 1e9); await settleReliefs(cam.position, 30000); try { refreshReliefShadow(); } catch { /* */ }
    for (let i = 0; i < 3; i++) await r.renderAsync(scene, cam);
    return errs.slice();
  };
  (window as any).__bakes = bakesLoaded(); (window as any).__ready = true;
})().catch(e => { (window as any).__ready = String(e); console.error(e); });
