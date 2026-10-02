// D-330: the Blender-built decor and tents (tools/blender/decor.mjs; src/data/decor_assets.json records each build):
//  - the stone frames' trim texture (public/models/decor/frame_trim.ktx2: RGB tangent-space normal, A AO; src/arch/frames.ts
//    maps every frame face onto it),
//  - the four-stepped merlon (public/models/decor/merlon.glb: the game's merlon with baked normal + AO),
//  - the court camps' tents (public/models/decor/tent_<kind>.glb: cloth-simulated shells on poles with ropes and pegs, three
//    levels, baked fold maps).
// Loaded before the architecture and the camps are built (world.ts). Never throws: what fails to load is drawn by the
// procedural stand-in it replaces (the frame boxes, crenellationGeometry, the tent shells), and decorStats says so.
// `?nodecor` switches all of it off (A/B). In node (tests) nothing loads.
import * as THREE from 'three/webgpu';
import { texture, uv, normalMap, normalView, vec3, float } from 'three/tsl';
import { surfaceMaterial } from './materials';
import META from '../data/decor_assets.json';
import { BASE } from '../core/base';

export interface DecorModel { lods: THREE.BufferGeometry[]; maps: THREE.Texture[]; names: string[] }
const S = { trim: null as THREE.Texture | null, merlon: null as DecorModel | null, tents: {} as Record<string, DecorModel>, off: false };
export const decorStats = { ms: 0, loaded: [] as string[], failed: [] as string[], off: false };
export const frameTrim = () => S.trim;
export const merlonModel = () => S.merlon;
export const tentModel = (kind: string): DecorModel | null => S.tents[kind] ?? null;
/** tests: stand-ins so the builders take the modelled path in node (a 4x4 texture; geometry given) */
export function setDecorForTest(v: { trim?: boolean; merlon?: DecorModel | null; tents?: Record<string, DecorModel> } | null) {
  if (!v) { S.trim = null; S.merlon = null; S.tents = {}; return; }
  if (v.trim) { const t = new THREE.DataTexture(new Uint8Array(64).fill(128), 4, 4); t.needsUpdate = true; S.trim = t; }
  if (v.merlon !== undefined) S.merlon = v.merlon; if (v.tents) S.tents = v.tents;
}

export async function loadDecorAssets(base = BASE): Promise<typeof decorStats> {
  if (typeof document === 'undefined') return decorStats;
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('nodecor')) { decorStats.off = S.off = true; return decorStats; }
  const t0 = performance.now();
  const man: any = META;
  const [{ GLTFLoader }, { DRACOLoader }, { KTX2Loader }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js'), import('three/addons/loaders/KTX2Loader.js')]);
  const ad = await (globalThis as any).navigator?.gpu?.requestAdapter?.().catch(() => null);
  const k2 = new KTX2Loader().setTranscoderPath(base + 'models/lib/basis/'); k2.detectSupport({ isWebGPURenderer: true, hasFeature: (f: string) => !!ad?.features?.has(f) } as any);
  const draco = new DRACOLoader().setDecoderPath(base + 'models/lib/draco/'), gl = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(k2);
  const glb = async (file: string): Promise<DecorModel> => {
    const g = await gl.loadAsync(base + file), lods: THREE.BufferGeometry[] = [], maps: THREE.Texture[] = [], names: string[] = [];
    g.scene.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const map = (m.material as THREE.MeshStandardMaterial).normalMap; if (!map) throw new Error(`${file}: ${m.name} has no map`);
      map.colorSpace = THREE.NoColorSpace; map.anisotropy = 8; map.needsUpdate = true; lods.push(m.geometry); maps.push(map); names.push(m.name); });
    const order = names.map((n, i) => i).sort((a, b) => names[a].localeCompare(names[b]));
    return { lods: order.map(i => lods[i]), maps: order.map(i => maps[i]), names: order.map(i => names[i]) };
  };
  const jobs: Promise<void>[] = [];
  const A = man.assets ?? {};
  if (A.trim) jobs.push(k2.loadAsync(base + 'models/decor/frame_trim.ktx2').then((t: THREE.Texture) => {
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; S.trim = t; decorStats.loaded.push('trim'); }).catch(e => { decorStats.failed.push(`trim: ${e?.message ?? e}`); }));
  if (A.merlon) jobs.push(glb('models/decor/merlon.glb').then(m => { S.merlon = m; decorStats.loaded.push('merlon'); }).catch(e => { decorStats.failed.push(`merlon: ${e?.message ?? e}`); }));
  if (A.tents) for (const f of Object.keys(A.tents.files ?? {})) { const kind = /tent_(\w+)\.glb$/.exec(f)?.[1]; if (!kind) continue;
    jobs.push(glb(f).then(m => { S.tents[kind] = m; decorStats.loaded.push(`tent_${kind}`); }).catch(e => { decorStats.failed.push(`tent_${kind}: ${e?.message ?? e}`); })); }
  await Promise.all(jobs); draco.dispose(); k2.dispose();
  for (const f of decorStats.failed) console.warn(`[decor] ${f}: its procedural stand-in is drawn`);
  decorStats.ms = Math.round(performance.now() - t0);
  if (typeof window !== 'undefined') (window as any).__decor = { stats: decorStats };
  return decorStats;
}

const MATS = new Map<string, THREE.Material>();
/** a surface (materials.ts) with a baked packed map (RGB normal under the surface's own relief, A AO on the indirect light),
 *  read through the geometry's uv; `arch`: the architecture variant (the parts' attributes, meshes.ts) */
export function withBakedMap(surface: string, map: THREE.Texture, key: string, opts: { arch?: boolean; vertexColors?: boolean; /** the geometry has no tangents and its uv's v runs against the map's (the frames: the tangent frame from the uv's screen derivatives, D-330) */ flipG?: boolean } = {}): THREE.MeshStandardNodeMaterial {
  const k = `${surface}|${key}|${opts.arch ? 1 : 0}${opts.vertexColors ? 1 : 0}${opts.flipG ? 1 : 0}`, hit = MATS.get(k); if (hit) return hit as THREE.MeshStandardNodeMaterial;
  const m = surfaceMaterial(surface, { arch: opts.arch, vertexColors: opts.vertexColors, variant: `decor:${key}` }), t = texture(map, uv());
  const nMap = normalMap(opts.flipG ? vec3(t.r, float(1).sub(t.g), t.b) : t.rgb) as any, fine = m.normalNode as any;
  m.normalNode = fine ? nMap.add(fine.sub(normalView)).normalize() : nMap;
  m.aoNode = m.aoNode ? (m.aoNode as any).mul(t.a) : t.a;
  m.name = `decor:${key}:${surface}`; MATS.set(k, m); return m;
}
/** the stone frames' material: the architecture variant of their stone with the trim (null: the trim is not loaded) */
export function frameMaterial(surface: string): THREE.MeshStandardNodeMaterial | null { return S.trim ? withBakedMap(surface, S.trim, 'frame_trim', { arch: true, flipG: true }) : null; }
