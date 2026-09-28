// D-320 dev probe (not shipped): the relief figures in the game's own renderer and materials, without the world: the
// Apadana and the Phase 4 palaces' architecture (buildMeshes) with every relief set built twice, once with the legacy
// vertex-painted levels and once with the carved-relief atlas (Blender-baked normal, occlusion and paint), shown one at a
// time for A/B shots under one sun and a hemisphere light. A page load of about a minute against the full world's 11-30 min.
// Driven by tools/blender/probe/relief_probe.mjs.
import * as THREE from 'three/webgpu';
import { loadScans } from '../../../src/render/scans';
import { loadModels } from '../../../src/render/models';
import { loadReliefAtlas, reliefAtlasStats, reliefAtlasMaps } from '../../../src/render/reliefAtlas';
import { attribute, texture, vec3, vec4, normalView, float } from 'three/tsl';
import { loadSculpt } from '../../../src/arch/sculpt';
import { buildTerrace } from '../../../src/arch/terrace';
import { buildMeshes } from '../../../src/arch/meshes';
import { buildReliefs, buildPhase4Reliefs, apadanaFacades } from '../../../src/arch/decor';
import { ReliefSet, setReliefAtlas, updateReliefs, settleReliefs, reliefStats, buildReliefShadow, reliefShadowData, type ReliefItem } from '../../../src/arch/reliefs';
import { setReliefShadow, refreshReliefShadow, reliefSkyNode, receiveReliefShadow } from '../../../src/render/reliefShadow';
import { positionWorld } from 'three/tsl';
import { surfaceMaterial } from '../../../src/render/materials';
(async () => {
  const P = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const adapter = await (navigator as any).gpu.requestAdapter();
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, requiredLimits: { maxSampledTexturesPerShaderStage: Math.min(48, adapter.limits.maxSampledTexturesPerShaderStage) } } as any); await r.init();
  r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = +(P.get('xp') ?? 1); r.shadowMap.enabled = true;
  const errs: string[] = []; (r.backend as any).device?.addEventListener?.('uncapturederror', (e: any) => errs.push(String(e.error?.message).slice(0, 300)));
  await loadScans('/');
  await loadModels('/');
  await loadSculpt(async p => { const x = await fetch('/' + p); if (!x.ok) throw new Error(`${p}: ${x.status}`); return x.arrayBuffer(); });
  const keep = new Set((P.get('b') ?? 'apadana,tachara,hadish,tripylon,hall100,harem').split(','));
  const { parts, manifest, doorways } = buildTerrace() as any;
  const arch = buildMeshes(parts.filter((p: any) => keep.has(p.building)) as any, undefined, {});
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.55, 0.68, 0.85);
  scene.add(arch.group);
  arch.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
  const sets = (g: THREE.Object3D) => { const out: ReliefSet[] = []; g.traverse(o => { if (o instanceof ReliefSet) out.push(o); }); return out; };
  // the relief sets, twice: legacy levels, then (atlas loaded) the atlas levels
  // the Neo-Elamite relief's five worshippers (world/plain/naqsh.ts places them on the cliff) on a wall at CALIB, off the Terrace
  const CALIB = [-60, 1.0, 150];
  const elam = (): ReliefItem[] => [0, 1, 2, 3, 4].map(i => ({ kind: 'elamite', seed: i, o: new THREE.Vector3(CALIB[0] + i * 1.35, CALIB[1], CALIB[2]), X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1), S: 1.9, D: 0.06, mirror: i >= 3 }));
  const mk = () => { const g = new THREE.Group(); const ap = buildReliefs(manifest), p4 = buildPhase4Reliefs(doorways).group; g.add(ap, p4, new ReliefSet(elam(), [], 'elamite')); return g; };
  const wall = new THREE.Mesh(new THREE.BoxGeometry(9, 3.4, 0.5), surfaceMaterial('limestone')); wall.position.set(CALIB[0] + 2.7, CALIB[1] + 1.2, CALIB[2] - 0.25); wall.castShadow = wall.receiveShadow = true;
  setReliefAtlas(false); const legacy = mk(); legacy.name = 'legacy';
  const st = await loadReliefAtlas('/', r);
  const atlas = mk(); atlas.name = 'atlas';
  scene.add(legacy, atlas, wall);
  // the relief shadows and (D-320) the walls' sky past the figures: from the atlas group's sets (the same placements)
  setReliefShadow(buildReliefShadow(sets(atlas)));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9c8a70, roughness: 1 }));
  ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground);
  const sun = new THREE.DirectionalLight(0xfff1e0, 3.4), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x8a7458, 1.0);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 400;
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.05, 6000);
  const F = Object.fromEntries(apadanaFacades(manifest).map(f => [f.id, f]));
  /** a camera `off` m in front of façade `f` at along `a` m, eye `y` m above the façade foot, looking at the wall at height `ty` (along + `da`) */
  const facadeView = (id: string, a: number, off: number, y: number, ty: number, da = 0) => { const f = F[id];
    const at = (aa: number, o: number) => [f.origin[0] + f.along[0] * aa + f.normal[0] * o, -(f.origin[1] + f.along[1] * aa + f.normal[1] * o)];
    const [ex, ez] = at(a, off), [tx, tz] = at(a + da, 0); return { eye: [ex, f.y0 + y, ez], at: [tx, f.y0 + ty, tz] }; };
  (window as any).__facadeView = facadeView;
  /** a camera `off` m square to the wall in front of the n-th figure of a kind (the atlas group's sets), eye at the figure's
   *  mid-height + dy, looking at its point at height fraction fy (and along the wall by da m) */
  (window as any).__itemView = (kind: string, n: number, off: number, fy = 0.6, dy = 0, da = 0) => {
    const its = sets(atlas).flatMap(s => s.items).filter(it => it.kind === kind); const it = its[Math.min(n, its.length - 1)]; if (!it) return null;
    const at = it.o.clone().addScaledVector(it.Y, it.S * fy).addScaledVector(it.X, da), eye = at.clone().addScaledVector(it.Z, off); eye.y += dy;
    return { eye: eye.toArray(), at: at.toArray(), count: its.length };
  };
  // debug views of the atlas group: 'paint' (the paint texture), 'cov', 'ao', 'nrm' (the baked normal as colour), 'geo' (the vertex normal); '' = the material
  const dbgMats = new Map<string, THREE.Material>(), origMat = new Map<THREE.Object3D, THREE.Material>();
  (window as any).__debug = (mode0: string) => {
    const nowall = mode0.endsWith('-nowall'), mode = mode0.replace('-nowall', ''); arch.group.visible = !nowall;
    if (mode === 'wallsky') { if (!(wall as any).__orig) (wall as any).__orig = wall.material; const b = receiveReliefShadow(new THREE.MeshBasicNodeMaterial()); b.colorNode = vec3(reliefSkyNode(positionWorld)); (wall as any).material = b; return; }
    if ((wall as any).__orig) wall.material = (wall as any).__orig;
    const M = reliefAtlasMaps()!, r = attribute('ruv', 'vec4'), at = (t: THREE.Texture) => texture(t, r.xy).depth(r.z.add(0.5).floor());
    atlas.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh && !(m as any).isBatchedMesh) return; if (!origMat.has(m)) origMat.set(m, m.material as THREE.Material);
      if (!mode) { m.material = origMat.get(m)!; return; }
      let mat = dbgMats.get(mode); if (!mat) { const b = new THREE.MeshBasicNodeMaterial();
        b.colorNode = mode === 'uv' ? vec3(r.x.mul(512).fract(), r.y.mul(512).fract(), r.z.div(5)) : mode === 'paint0' ? texture(M.paint, r.xy).depth(r.z.add(0.5).floor()).level(float(0)).rgb : mode === 'paint2' ? texture(M.paint, r.xy).depth(r.z.add(0.5).floor()).level(float(2)).rgb : mode === 'paint' ? at(M.paint).rgb : mode === 'cov' ? vec3(at(M.paint).a) : mode === 'ao' ? vec3(at(M.nao).b) : mode === 'nrm' ? vec3(at(M.nao).r, at(M.nao).g, float(1)) : normalView.mul(0.5).add(0.5);
        dbgMats.set(mode, mat = b); } m.material = mat; });
  };
  (window as any).__jambs = doorways.filter((d: any) => d.framed).map((d: any) => ({ id: d.id, c: d.c, u: d.u, n: d.n, width: d.width, y0: d.y0 }));
  (window as any).__shot = async (v: { eye: number[]; at: number[]; fov: number; sun: number[]; atlas: boolean }) => {
    legacy.visible = !v.atlas; atlas.visible = v.atlas;
    cam.fov = v.fov; cam.position.set(v.eye[0], v.eye[1], v.eye[2]); cam.lookAt(v.at[0], v.at[1], v.at[2]); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const d = new THREE.Vector3(v.sun[0], v.sun[1], v.sun[2]).normalize(), t = new THREE.Vector3(v.at[0], v.at[1], v.at[2]);
    sun.position.copy(t).addScaledVector(d, 200); sun.target.position.copy(t); sun.target.updateMatrixWorld();
    await settleReliefs(cam.position, 120000);
    for (let t = 0; t < 600 && (reliefShadowData()?.jobs.size ?? 0) > 0; t++) await new Promise(r => setTimeout(r, 100)); // the shadow atlas's fields
    refreshReliefShadow(Infinity);
    for (let i = 0; i < 3; i++) await r.renderAsync(scene, cam);
    // the shown group's own relief sets (reliefStats counts every live set, both groups)
    const ss = sets(v.atlas ? atlas : legacy), tris = ss.reduce((q, x) => q + x.stats.tris, 0), byLod = [0, 1, 2, 3, 4].map(l => ss.reduce((q, x) => q + x.stats.byLod[l], 0));
    return { errs: errs.slice(), info: { draws: (r.info as any).render?.drawCalls, tris: (r.info as any).render?.triangles }, reliefTris: tris, byLod, far: ss.reduce((q, x) => q + x.stats.farTris, 0) };
  };
  (window as any).__ready = { atlas: st, legacySets: sets(legacy).map(s => s.atlas), atlasSets: sets(atlas).map(s => s.atlas) };
})().catch(e => { (window as any).__ready = 'ERROR ' + String(e?.stack ?? e); console.error(e); });
void reliefAtlasStats; void updateReliefs; void reliefStats;
