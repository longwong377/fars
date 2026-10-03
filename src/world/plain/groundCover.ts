// The ground cover at a walker's feet between the fields (session 12, D-335; the land agent, brief item 4). The terrain
// shader draws the plain's herbs, stubble and trodden earth as texture (terrainPlain.ts: the herb layer's cover and its scans,
// the plots' straw, the trample): from 1.6 m it read flat, a printed carpet. Here, within COVER.R of the viewer, the same
// cover stands up as geometry, placed by the same rules the shader paints by:
//  - bunch grasses and fine tufts (CC0 scans: Poly Haven grass_medium_02, grass_medium_01) on the uncultivated ground, the
//    fallow and the orchard floors, at the shader's own herb density (its two noise octaves mirrored) and the season's amount,
//    their colour the season's green to straw; a short sward (grass_bermuda_01) on the plot bunds;
//  - cereal stubble (modelled in Blender, tools/blender/land_cover.py: the sickle's cut stalks in their sown rows, fallen
//    straw) on every rain-fed and irrigated plot between its harvest and the autumn ploughing (seasonal.ts cropState: height 0,
//    straw), greying as it is grazed;
//  - dung (modelled: cattle pats, donkey and horse droppings, sheep and goat pellets) on the trodden ground of the town's foot,
//    the paths, the camps and the tether lines (townGround.ts trample), and a little on the steppe (the herds graze it).
// All C (the rules and densities); the grasses' species by the scans' forms (C). Positions are a hash of (seed, 2 m cell);
// three levels by distance, drawn from one atlas (one material): one InstancedMesh per piece and level.
import { SEASON_PALETTE } from '../season';
import * as THREE from 'three/webgpu';
import { sharedDraco } from '../../render/loaders';
import { texture, uv, vec3, dot, attribute, max, smoothstep } from 'three/tsl';
import { mxNoise2 } from '../../render/mx_noise_cpu';
import { landUseAt, type ZoneMap } from './fields';
import { cropState } from './seasonal';
import { BASE } from '../../core/base';
import { vergeZone } from './verge';

export type CoverKind = 'tuft' | 'sward' | 'stubble' | 'dung';
/** reach (m), level distances (m), cell (m), rebuild step (m moved) */
export const COVER = { R: 34, lod: [5.5, 16], cell: 2, moveM: 3 } as const;
/** per kind: the pieces drawn (ids in public/models/land/cover.json), the size range (m, largest extent), the most instances per piece */
export const COVER_KINDS: Record<CoverKind, { ids: string[]; size: [number, number]; cap: number }> = {
  tuft: { ids: ['tuft_m2b', 'tuft_m2c', 'tuft_m2d', 'tuft_m2e', 'tuft_m1a', 'tuft_m1c'], size: [0.22, 0.5], cap: 1800 }, // (s17: 1800, was 1100: the verges) // D-356: six pieces (was 4), the steppe twice as dense
  sward: { ids: ['sward_bmj', 'sward_bmk', 'sward_bmm'], size: [0.12, 0.22], cap: 1200 },
  stubble: { ids: ['stubble_a', 'stubble_c'], size: [0.6, 0.8], cap: 900 },
  dung: { ids: ['dung_pat', 'dung_horse', 'dung_sheep'], size: [0.16, 0.3], cap: 250 },
};
/** the herb layer's colours (terrainPlain.ts veg: straw and green, sRGB), the stubble's straw fresh and grazed-grey, the dung */
const COL = { ...SEASON_PALETTE, dung: [0.30, 0.25, 0.18] } as const; // (V5 D-522: the season's palette lives in season.ts)
function h32(...v: number[]) { let h = 2166136261 >>> 0; for (const x of v) { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; } return h >>> 0; }
const u01 = (...v: number[]) => h32(...v) / 4294967296;
const lin = (c: readonly number[], k = 1) => { const q = new THREE.Color().setRGB(c[0] * k, c[1] * k, c[2] * k, THREE.SRGBColorSpace); return [q.r, q.g, q.b] as [number, number, number]; };
const mixC = (a: readonly number[], b: readonly number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export interface CoverEnv { ground(x: number, z: number): number; zones: ZoneMap; /** trodden 0..1 (townGround B) */ trodden?(x: number, z: number): number; /** no cover here (built, paved, water) */ blocked?(x: number, z: number): boolean }
export interface CoverItem { kind: CoverKind; v: number; x: number; y: number; z: number; yaw: number; s: number; c: [number, number, number] }
/** the shader's herb density at world (x, z) (terrainPlain.ts `dens`) */
export const herbDensity = (x: number, z: number) => Math.min(1, Math.max(0, 0.5 + mxNoise2(x * 0.04, z * 0.04) * 0.3 + mxNoise2(x * 0.15 + 5.1, z * 0.15 + 5.1) * 0.18));

/** the cover of one 2 m cell (ix, iz: world x, z / cell) on day-of-year `doy` with the season's herb state */
export function coverCell(env: CoverEnv, ix: number, iz: number, seed: number, doy: number, season: { green: number; dry: number }): CoverItem[] {
  const C = COVER.cell, cx = (ix + 0.5) * C, cz = (iz + 0.5) * C, out: CoverItem[] = [];
  if (env.blocked?.(cx, cz)) return out;
  const u = landUseAt(env.zones, cx, cz), tr = Math.min(1, env.trodden?.(cx, cz) ?? 0);
  const amount = Math.min(1, season.green + season.dry), gs = season.green / Math.max(0.001, season.green + season.dry);
  const put = (kind: CoverKind, i: number, sMul = 1, col?: readonly number[], yaw?: number) => {
    const K = COVER_KINDS[kind], x = (ix + u01(seed, ix, iz, i, 1)) * C, z = (iz + u01(seed, ix, iz, i, 2)) * C, y = env.ground(x, z);
    if (!Number.isFinite(y)) return;
    const s = (K.size[0] + (K.size[1] - K.size[0]) * u01(seed, ix, iz, i, 3)) * sMul, v = h32(seed, ix, iz, i, 4) % K.ids.length;
    const f = 0.88 + 0.24 * u01(seed, ix, iz, i, 5);
    const c = col ?? (kind === 'dung' ? COL.dung : mixC(COL.straw, COL.green, Math.min(1, gs * (0.85 + 0.3 * u01(seed, ix, iz, i, 6)))));
    out.push({ kind, v, x, y: y - 0.01, z, yaw: yaw ?? u01(seed, ix, iz, i, 7) * Math.PI * 2, s, c: lin(c, f) });
  };
  // s17 (D-560, verge.ts): the paths: the tread worn bare but for dung (and the tracks' sward strip between the ruts), the verge
  // the rankest ground of the plain (dense grasses, standing dry after June), whatever the plot beside it holds
  const vz = vergeZone(cx, -cz);
  if (vz) {
    const K = vz.hit.kind, dungP = K === 'road' ? 0.2 : K === 'track' ? 0.12 : 0.06;
    const keep = (i: number, want: 'median' | 'verge') => { const x = (ix + u01(seed, ix, iz, i, 1)) * C, z = (iz + u01(seed, ix, iz, i, 2)) * C, q = vergeZone(x, -z);
      return want === 'verge' ? !q || q.zone === 'verge' : q?.zone === want; };
    const vgs = Math.min(1, gs * 1.1), vcol = (i: number) => mixC(COL.straw, COL.green, Math.min(1, vgs * (0.8 + 0.35 * u01(seed, ix, iz, i, 6))));
    if (vz.zone === 'verge') {
      const n = 6 + (h32(seed, ix, iz, 60) % 5); // (6-10 a 2 m cell, larger than the steppe's: a rank strip, never cut or grazed bare)
      for (let i = 0; i < n; i++) if (keep(60 + i, 'verge')) put(u01(seed, ix, iz, i, 61) < 0.2 ? 'sward' : 'tuft', 60 + i, 1.2 + 0.6 * u01(seed, ix, iz, i, 62), vcol(60 + i));
    } else if (vz.zone === 'median') { const n = 1 + (h32(seed, ix, iz, 63) % 2); for (let i = 0; i < n; i++) if (keep(64 + i, 'median')) put('sward', 64 + i, 0.8, vcol(64 + i)); }
    if (u01(seed, ix, iz, 12) < (vz.zone === 'verge' ? 0.04 : dungP)) put('dung', 40, 1.1);
    return out;
  }
  const crop = u.use === 'irrigated' || u.use === 'rainfed';
  const st = crop ? cropState(u.row, doy + u.offsetDays) : null;
  const wild = !crop || u.row === 'fallow';
  // the plot's bund (its edge ~1 m wide): a short sward and a few tufts, whatever the plot holds
  if (crop && u.plot.edge < 0.9) { const n = 1 + (h32(seed, ix, iz, 8) % 3); for (let i = 0; i < n; i++) put(i ? 'sward' : 'tuft', 10 + i, i ? 1 : 0.8); }
  else if (st && st.height < 0.05 && st.straw > 0.2) {
    // stubble: the cut stalks cover the plot; grazed down and greying as the months pass (its straw cover 0.75 -> 0.25)
    const n = st.straw > 0.45 ? 2 : 1, age = Math.min(1, Math.max(0, (0.75 - st.straw) / 0.5));
    for (let i = 0; i < n; i++) put('stubble', 20 + i, 1, mixC(COL.stubble, COL.stubbleOld, age), -u.plot.angle + (u01(seed, ix, iz, i, 13) - 0.5) * 0.12); // (its rows along the plot's strip: the sowing ran with the plough)
  } else if (wild && u.use !== 'orchard' || u.row === 'orchard_floor') {
    // the herb layer: tufts at the shader's density and the season's amount, fewer on trodden ground
    const dens = herbDensity(cx, cz), trT = Math.min(1, Math.max(0, (tr - 0.2) / 0.3)), n = Math.floor(dens * amount * 7 * (1 - trT) + u01(seed, ix, iz, 9) * (1 - trT)); // (none on the roads, the approach and the foot: trodden over ~0.5)
    for (let i = 0; i < n; i++) put(u01(seed, ix, iz, i, 11) < 0.25 ? 'sward' : 'tuft', 30 + i);
  }
  // dung on the trodden ground (the herds and the pack animals), a little on the grazed steppe and the stubble
  const pd = tr * 0.22 + (wild ? 0.012 : st && st.straw > 0.2 ? 0.02 : 0);
  if (u01(seed, ix, iz, 12) < pd) put('dung', 40, 1 + 0.3 * tr);
  return out;
}

// ------------------------------------------------------------------------------------------------ the kit and the drawn cover
export interface CoverPiece { id: string; kind: CoverKind; size: [number, number, number]; lods: THREE.BufferGeometry[] }
export interface CoverKit { pieces: CoverPiece[]; map: THREE.Texture; normal: THREE.Texture; arm: THREE.Texture; mean: [number, number, number] }
let KIT: CoverKit | null = null;
export const coverKit = () => KIT;
export function _setCoverKit(k: CoverKit | null) { KIT = k; }
export async function loadCoverKit(base = BASE): Promise<CoverKit | null> {
  try {
    const man = await (await fetch(base + 'models/land/manifest.json')).json(); const C = man.classes?.cover; if (!C) throw new Error('no cover class');
    const [{ GLTFLoader }, draco] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), sharedDraco(base)]); // (D-392: the page's decoders)
    const loader = new GLTFLoader().setDRACOLoader(draco), tl = new THREE.TextureLoader();
    const [g, map, normal, arm] = await Promise.all([loader.loadAsync(`${base}models/land/cover.glb`), tl.loadAsync(`${base}models/land/cover_diff.jpg`), tl.loadAsync(`${base}models/land/cover_nor.jpg`), tl.loadAsync(`${base}models/land/cover_arm.jpg`)]);
    map.colorSpace = THREE.SRGBColorSpace; for (const t of [map, normal, arm]) { t.flipY = false; t.anisotropy = 4; t.needsUpdate = true; }
    const want = new Set(Object.values(COVER_KINDS).flatMap(k => k.ids)), pieces: CoverPiece[] = [];
    for (const pc of C.pieces as { id: string; kind: CoverKind }[]) { if (!want.has(pc.id)) continue;
      const lods = [0, 1, 2].map(l => { const m = g.scene.getObjectByName(`${pc.id}__lod${l}`) as THREE.Mesh; if (!m?.isMesh) throw new Error(`${pc.id} lod${l} missing`);
        m.updateMatrixWorld(true); const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld); for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
        if (!geo.getAttribute('normal')) geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere(); return geo; });
      const b = lods[0].boundingBox!; pieces.push({ id: pc.id, kind: pc.kind, size: [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z], lods }); }
    // (D-392: the shared decoder stays up)
    let mean: [number, number, number] = [0.25, 0.25, 0.2];
    // (s17: the mean of the drawn pixels only, the atlas's black ground left out: it is cut away, D-560)
    try { const im = map.image as HTMLImageElement, cv = new OffscreenCanvas(128, 128), c2 = cv.getContext('2d')!; c2.drawImage(im, 0, 0, 128, 128); const d = c2.getImageData(0, 0, 128, 128).data; let r = 0, gg = 0, bb = 0, k = 0;
      const L = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; for (let i = 0; i < d.length; i += 4) { if (Math.max(d[i], d[i + 1], d[i + 2]) < 12) continue; r += L(d[i]); gg += L(d[i + 1]); bb += L(d[i + 2]); k++; } if (k) mean = [r / k, gg / k, bb / k]; } catch { /* default */ }
    KIT = { pieces, map, normal, arm, mean };
  } catch (e) { console.warn('[cover] no ground cover kit:', (e as Error).message); KIT = null; }
  return KIT;
}

interface Set_ { kind: CoverKind; v: number; lod: number; mesh: THREE.InstancedMesh; tint: THREE.InstancedBufferAttribute; cap: number }
export class GroundCover {
  readonly group = new THREE.Group(); readonly sets: Set_[] = []; readonly active: boolean;
  private cells = new Map<number, CoverItem[]>(); private last = { x: 1e9, z: 1e9, doy: -1 };
  stats = { items: 0, tris: 0, drawn: 0, ms: 0 };
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private s = new THREE.Vector3(); private up = new THREE.Vector3(0, 1, 0);
  constructor(private env: CoverEnv, private seed: number, kit: CoverKit | null = coverKit()) {
    this.group.name = 'ground-cover'; this.active = !!kit && kit.pieces.length > 0;
    this.group.userData = { tier: 'C', src: 'RECON;POLYHAVEN-CC0', placeholder: !this.active, note: this.active ? 'the ground cover at the feet (D-335): bunch grasses and tufts (CC0 scans), stubble and dung (modelled in Blender), by the shader\'s herb, plot and trample rules; all C' : 'PLACEHOLDER: the ground cover kit did not load; the herbs, stubble and dung are texture only' };
    if (!kit) return;
    const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    const t = texture(kit.map, uv()).rgb, meanY = Math.max(0.02, 0.2126 * kit.mean[0] + 0.7152 * kit.mean[1] + 0.0722 * kit.mean[2]);
    mat.colorNode = attribute('ctint', 'vec3').mul(dot(t, vec3(0.2126, 0.7152, 0.0722)).div(meanY).clamp(0, 2.5)); mat.normalMap = kit.normal; mat.normalScale.set(1, -1);
    // s17 (D-560): the atlas is the scans' blades on black (a JPEG: no alpha), and the tufts are the scans' alpha cards: without
    // a cut-out every card drew its black ground round the blades (black flames at the walker's feet, in every render since
    // s12). The cut-out is the albedo's own brightness (the black is 0; the stubble and dung cell is opaque)
    const rawT = texture(kit.map, uv()); mat.opacityNode = smoothstep(0.012, 0.045, max(rawT.r, max(rawT.g, rawT.b))); mat.alphaTest = 0.5;
    const a = texture(kit.arm, uv()); mat.roughnessNode = a.g.mul(0.3).add(0.65); mat.aoNode = a.r.mul(0.5).add(0.5); mat.name = 'ground-cover';
    for (const [kind, K] of Object.entries(COVER_KINDS) as [CoverKind, typeof COVER_KINDS[CoverKind]][]) K.ids.forEach((id, v) => {
      const p = kit.pieces.find(q => q.id === id); if (!p) return;
      for (let lod = 0; lod < 3; lod++) { const g = p.lods[lod].clone(), cap = Math.ceil(K.cap * (lod === 0 ? 0.25 : lod === 1 ? 0.5 : 1)), tint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); g.setAttribute('ctint', tint);
        const m = new THREE.InstancedMesh(g, mat, cap); m.count = 0; m.visible = false; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; m.name = `cover-${kind}:${id}:lod${lod}`; m.userData = this.group.userData;
        this.sets.push({ kind, v, lod, mesh: m, tint, cap }); this.group.add(m); }
    });
  }
  /** the viewer (world position) and the day (day-of-year and the herb layer's season state) */
  update(cam: THREE.Vector3, doy: number, season: { green: number; dry: number }, force = false): boolean {
    if (!this.active) return false;
    if (!force && doy === this.last.doy && Math.hypot(cam.x - this.last.x, cam.z - this.last.z) < COVER.moveM) return false;
    const t0 = performance.now(); if (doy !== this.last.doy) this.cells.clear(); this.last = { x: cam.x, z: cam.z, doy };
    const C = COVER.cell, R = COVER.R, counts = this.sets.map(() => 0), idx = new Map<string, number>(); this.sets.forEach((s, i) => idx.set(`${s.kind}:${s.v}:${s.lod}`, i));
    let items = 0;
    for (let ix = Math.floor((cam.x - R) / C); ix <= Math.floor((cam.x + R) / C); ix++) for (let iz = Math.floor((cam.z - R) / C); iz <= Math.floor((cam.z + R) / C); iz++) {
      const dc = Math.hypot((ix + 0.5) * C - cam.x, (iz + 0.5) * C - cam.z); if (dc > R + C) continue;
      const key = (ix + 32768) * 65536 + (iz + 32768); let cell = this.cells.get(key);
      if (!cell) { if (this.cells.size > 40000) this.cells.clear(); cell = coverCell(this.env, ix, iz, this.seed, doy, season); this.cells.set(key, cell); }
      for (const it of cell) {
        const d = Math.hypot(it.x - cam.x, it.z - cam.z); if (d > R) continue;
        const lod = d < COVER.lod[0] ? 0 : d < COVER.lod[1] ? 1 : 2, si = idx.get(`${it.kind}:${it.v}:${lod}`); if (si === undefined) continue;
        const S = this.sets[si]; if (counts[si] >= S.cap) continue;
        const grow = 1 - Math.min(1, Math.max(0, (d - R * 0.8) / (R * 0.2))); // grown in over the last 20 % of the reach
        this.q.setFromAxisAngle(this.up, it.yaw); const p = this.kitSize(it), sc = (it.s / p) * grow;
        this.m4.compose(this.v.set(it.x, it.y, it.z), this.q, this.s.set(sc, sc, sc)); const c = counts[si]++; S.mesh.setMatrixAt(c, this.m4); S.tint.setXYZ(c, it.c[0], it.c[1], it.c[2]); items++;
      }
    }
    let tris = 0;
    this.sets.forEach((S, i) => { S.mesh.count = counts[i]; S.mesh.visible = counts[i] > 0; S.mesh.instanceMatrix.needsUpdate = true; S.tint.needsUpdate = true; tris += counts[i] * (S.mesh.geometry.index ? S.mesh.geometry.index.count / 3 : S.mesh.geometry.getAttribute('position').count / 3); });
    this.stats = { items, tris, drawn: this.sets.filter(s => s.mesh.visible).length, ms: Math.round(performance.now() - t0) };
    return true;
  }
  private sizeCache = new Map<string, number>();
  /** the piece's largest horizontal extent (its sizes are scaled to the item's size) */
  private kitSize(it: CoverItem): number { const k = `${it.kind}:${it.v}`; let s = this.sizeCache.get(k);
    if (s === undefined) { const S = this.sets.find(q => q.kind === it.kind && q.v === it.v); const b = S ? (S.mesh.geometry.boundingBox ?? (S.mesh.geometry.computeBoundingBox(), S.mesh.geometry.boundingBox!)) : null; s = b ? Math.max(1e-3, b.max.x - b.min.x, b.max.z - b.min.z) : 1; this.sizeCache.set(k, s); }
    return s; }
}
