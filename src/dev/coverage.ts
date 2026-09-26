// Coverage pass (D-233, D-235; out-of-world, tests and tooling only). What each pixel of the current view is drawn by, and
// whether that thing is honest work or a stand-in, measured without trusting a screenshot:
//  - flagMask(): an ID render. Every visible mesh of the world (world root + terrain) is drawn once more with an override
//    material that writes the mesh's id (R, G: 16 bits) and its distance from the eye (B: 8-bit log scale, 0.1 m-20 km)
//    into a 512×288 target; the sky, clouds, stars and every transparent effect (smoke, haze, rain, dust) are left out,
//    so an empty pixel is sky. Each id maps to the mesh's F3 record (the nearest ancestor with a tier, as the dev overlay
//    reads it): its key, top group, tier, whether it is flagged `placeholder: true` (or its note says PLACEHOLDER), and
//    its geometry: triangles, surface area and density (triangles per m²). Merged meshes whose faces carry their own
//    records (userData.describe: the town) get a per-vertex flag, so a PLACEHOLDER house and an honest lane in one mesh
//    are told apart. The override keeps each source material's vertex stage (positionNode: people, trees, crops) and its
//    cut-outs (opacity with alphaTest: leaves), so the silhouettes are the frame's.
//  - with the beauty frame (a PNG of the screenshot) it also measures, per view: luminance statistics; flatness Ystd/Y
//    over non-sky pixels; black, blown and flat 16×16 blocks (flat = one colour over the block, large = ≥ 4 connected);
//    sky seen below the horizon (a hole: ray elevation < −1°); periodic texture (visible tiling: autocorrelation peaks in
//    textured 64 px blocks); and per object the high-frequency detail (mean |Laplacian| / Y over its interior pixels).
//    A pixel is LOW DETAIL (flag-independent: catches unflagged boxes) when its object has both fewer triangles per
//    steradian at that pixel's distance than K_TRI and less high-frequency shading than K_HF (thresholds C, tuned on the
//    pilot, Q-632).
//  - repetition(): identical instances (same geometry) within 30 m in the view frustum, distinct geometries vs instances,
//    and people who share a body variant in view.
//  - life(): people and animals in view, moving / active / idle / resting, and after `seconds` of world time: frozen
//    walkers, sliding non-walkers, people off the walkable grid (clipping), from the crowd's own state.
// Nothing here runs in a normal frame; the override materials and targets exist only after the first call.
import * as THREE from 'three/webgpu';
import { uniform, attribute, vec4, float, floor, mod, texture, Fn, bool, positionWorld, cameraPosition, clamp, log } from 'three/tsl';

export interface CovCtx {
  renderer: THREE.WebGPURenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; root: THREE.Object3D; terrain: THREE.Object3D;
  world: any; sunAlt: () => number; advance: (seconds: number) => void; tick: () => Promise<void>;
  /** unit vector toward the sun (world frame), for excluding the sun's disc from clipped pixels (T-A3c) */
  sunDir?: () => THREE.Vector3;
}
export interface CovEntry { id: number; key: string; top: string; label: string; ph: boolean; tier: string | null; sourced?: boolean; tris: number; area: number; density: number; geo: string; mat: string; instances: number }
export const FLAG_W = 512, FLAG_H = 288; // 16:9; W × 4 bytes is a multiple of 256 (WebGPU readback rows)
const D0 = 0.1, D1 = 20000, LN = Math.log(D1 / D0);
export const decodeDist = (b: number) => D0 * Math.exp((b / 255) * LN);
/** thresholds (C, Q-632): triangles per steradian at the pixel's distance, and relative high-frequency shading */
export const K_TRI = 1000, K_HF = 0.04;
const SKY_HOLE_DEG = -1;

type Saved = [THREE.Object3D, any, boolean];
export class CoveragePass {
  private entries: CovEntry[] = [];
  /** each mesh's id (a WeakMap, not userData: meshes may share one userData object, e.g. every terrain chunk) */
  private idOf = new WeakMap<THREE.Object3D, number>();
  private idU = uniform(0).onObjectUpdate(({ object }: any) => this.idOf.get(object) ?? 0);
  private mats = new Map<string, THREE.NodeMaterial>();
  private rt: THREE.RenderTarget | null = null;
  private flip: boolean | null = null;
  private geoStats = new Map<string, { tris: number; area: number }>();
  last: { ids: Uint16Array; dist: Float32Array; W: number; H: number; entries: CovEntry[] } | null = null;
  constructor(private c: CovCtx) {}

  // ---------------------------------------------------------------- records
  /** the F3 record of a mesh: nearest ancestor with a tier; placeholder: the nearest explicit flag, else PLACEHOLDER in the note */
  record(o: THREE.Object3D) {
    let tierNode: THREE.Object3D | null = null, ph: boolean | null = null, top = 'world', desc: ((h: any) => any) | null = null;
    for (let q: THREE.Object3D | null = o; q; q = q.parent) {
      const u = q.userData ?? {};
      if (!tierNode && u.tier) tierNode = q;
      if (ph === null && typeof u.placeholder === 'boolean') ph = u.placeholder;
      if (!desc && typeof u.describe === 'function') desc = u.describe;
      if (q.parent === this.c.root) top = q.name || 'world';
      if (q === this.c.terrain) top = 'terrain';
    }
    const u = tierNode?.userData ?? {};
    if (ph === null) ph = /PLACEHOLDER/.test(String(u.note ?? ''));
    const label = (tierNode?.name || o.name || o.parent?.name || '(unnamed)').replace(/\s+/g, ' ').slice(0, 80);
    return { key: `${top}/${label}`, top, label, ph, tier: (u.tier as string) ?? null, sourced: !!u.src, desc };
  }
  /** triangles and surface area (m², local units) of a geometry, cached */
  private geo(g: THREE.BufferGeometry) {
    const k = `${g.uuid}|${g.index ? g.index.count : g.attributes.position?.count}`; const hit = this.geoStats.get(k); if (hit) return hit;
    const P = g.attributes.position as THREE.BufferAttribute | undefined; let tris = 0, area = 0;
    if (P) { const I = g.index, n = I ? I.count : P.count; tris = Math.floor(n / 3);
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), step = Math.max(1, Math.floor(tris / 200000)); // sample big meshes
      for (let t = 0; t < tris; t += step) { const i0 = I ? I.getX(3 * t) : 3 * t, i1 = I ? I.getX(3 * t + 1) : 3 * t + 1, i2 = I ? I.getX(3 * t + 2) : 3 * t + 2;
        a.fromBufferAttribute(P, i0); b.fromBufferAttribute(P, i1); c.fromBufferAttribute(P, i2); area += b.sub(a).cross(c.sub(a)).length() / 2 * step; } }
    const r = { tris, area }; this.geoStats.set(k, r); return r;
  }
  /** per-face placeholder flags of a merged mesh (userData.describe): false / true / 'mixed' (then a covPh vertex attribute) */
  facePh(mesh: THREE.Mesh, fn: (h: any) => any, meshPh: boolean): boolean | 'mixed' {
    const g = mesh.geometry as THREE.BufferGeometry, P = g.attributes.position; if (!P) return meshPh;
    const nF = Math.floor((g.index ? g.index.count : P.count) / 3), cache = g.userData.__covPh;
    if (cache && cache.nF === nF && cache.fn === fn) return cache.res;
    const ph = new Uint8Array(nF); let any = false, all = true;
    for (let f = 0; f < nF; f++) { let d: any = null; try { d = fn({ faceIndex: f, object: mesh }); } catch { d = null; }
      const p = d && typeof d.placeholder === 'boolean' ? d.placeholder : meshPh; ph[f] = p ? 1 : 0; any ||= p; all &&= p; }
    let res: boolean | 'mixed' = any ? (all ? true : 'mixed') : false;
    if (res === 'mixed') { const a = new Float32Array(P.count);
      for (let f = 0; f < nF; f++) if (ph[f]) for (let k = 0; k < 3; k++) a[g.index ? g.index.getX(3 * f + k) : 3 * f + k] = 1;
      g.setAttribute('covPh', new THREE.BufferAttribute(a, 1)); }
    g.userData.__covPh = { nF, fn, res }; return res;
  }

  // ---------------------------------------------------------------- materials
  /** the override for a source material: its vertex stage and cut-out kept, the id and log distance written */
  matFor(src: any, withAttr: boolean): THREE.NodeMaterial {
    const cut = src && (src.alphaTest > 0 || src.alphaTestNode || src.alphaHash || (src.transparent && (src.opacityNode || src.map || src.alphaMap)));
    const custom = src && (src.positionNode || src.vertexNode || src.maskNode || cut || src.side !== THREE.FrontSide);
    const k = (custom ? src.uuid : 'plain') + (withAttr ? '+ph' : '');
    const hit = this.mats.get(k); if (hit) return hit;
    const m = new THREE.MeshBasicNodeMaterial(); m.name = 'coverage-id'; m.fog = false; m.toneMapped = false; m.transparent = false; m.depthWrite = true; m.depthTest = true;
    let op: any = null, cutV: any = null, mask: any = null;
    if (custom) {
      m.side = src.side;
      if (src.positionNode) m.positionNode = src.positionNode;
      if (src.vertexNode) m.vertexNode = src.vertexNode;
      if (src.maskNode) mask = src.maskNode;
      if (cut) { op = src.opacityNode ?? (src.alphaMap ? texture(src.alphaMap).g : src.map ? texture(src.map).a : null);
        cutV = src.alphaTestNode ?? float(src.alphaTest > 0 ? src.alphaTest : 0.5); }
    }
    const ph = withAttr ? attribute('covPh', 'float') : float(0), id = this.idU.add(ph);
    const dist = clamp(log(positionWorld.sub(cameraPosition).length().div(D0)).div(LN), 0, 1);
    m.fragmentNode = Fn(() => {
      if (mask) bool(mask).not().discard();
      if (op) float(op).lessThanEqual(cutV).discard();
      return vec4(mod(id, 256).div(255), floor(id.div(256)).div(255), dist, 1);
    })();
    this.mats.set(k, m); return m;
  }
  private isEffect(m: any) { return !m || m.visible === false || m.colorWrite === false || (m.transparent && (m.depthWrite === false || m.blending === THREE.AdditiveBlending)); }

  // ---------------------------------------------------------------- the ID render
  private async calibrate() { // readback row order differs between backends: a quad over the top half, read once
    const { renderer } = this.c, rt = this.target(), s = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); cam.position.z = 5;
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicNodeMaterial({ color: 0xffffff })); q.position.y = 0.5; s.add(q); s.background = new THREE.Color(0);
    const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping; renderer.setRenderTarget(rt); renderer.render(s, cam); renderer.setRenderTarget(null); renderer.toneMapping = tm;
    const px = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, FLAG_W, FLAG_H) as Uint8Array;
    this.flip = px[4 * (FLAG_W * 10 + 10)] < 128; q.geometry.dispose();
  }
  private target() { if (!this.rt) { this.rt = new THREE.RenderTarget(FLAG_W, FLAG_H, { type: THREE.UnsignedByteType }); } return this.rt; }

  /** the ID render of the current view; with `frame` (PNG base64 of the beauty frame) the frame metrics too */
  async flagMask(o: { frame?: string; top?: number; mask?: boolean } = {}) {
    const t0 = performance.now(), { renderer, scene, camera, root, terrain } = this.c;
    if (this.flip === null) await this.calibrate();
    this.entries = [{ id: 0, key: '(sky)', top: 'sky', label: 'sky', ph: false, tier: null, tris: 0, area: 0, density: 0, geo: '', mat: '', instances: 0 }];
    const saved: Saved[] = [], hiddenTop: string[] = [];
    const hide = (ob: THREE.Object3D) => { saved.push([ob, (ob as any).material, ob.visible]); ob.visible = false; };
    for (const ch of scene.children) if (ch !== root && ch !== terrain && ch.visible && !(ch as any).isLight) { hide(ch); hiddenTop.push(ch.name || ch.type); }
    const list: THREE.Object3D[] = []; root.traverseVisible(ob => list.push(ob)); terrain.traverseVisible(ob => list.push(ob));
    let effects = 0;
    for (const ob of list) {
      const m = ob as any;
      if (m.isPoints || m.isLine || m.isSprite) { hide(ob); effects++; continue; }
      if (!m.isMesh) continue;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      if (mats.every((x: any) => this.isEffect(x))) { hide(ob); effects++; continue; }
      const r = this.record(ob); let ph: boolean | 'mixed' = r.ph;
      if (r.desc && !m.isInstancedMesh && !m.isBatchedMesh) ph = this.facePh(m, r.desc, r.ph);
      else if (r.desc && m.isInstancedMesh) { try { const d = r.desc({ instanceId: 0, object: m }); if (d && typeof d.placeholder === 'boolean') ph = d.placeholder; } catch { /* keep */ } }
      const g = this.geo(m.geometry), inst = m.isInstancedMesh ? m.count : m.isBatchedMesh ? (m.instanceCount ?? 1) : (m.geometry as any).isInstancedBufferGeometry ? ((m.geometry as any).instanceCount ?? 1) : 1;
      const sc = new THREE.Vector3(); ob.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), sc); const s2 = Math.abs(sc.x * sc.z) || 1;
      const base = { key: r.key, top: r.top, label: r.label, tier: r.tier, sourced: r.sourced, tris: g.tris, area: g.area * s2, density: g.area > 0 ? g.tris / (g.area * s2) : 0, geo: m.geometry.uuid, mat: mats[0]?.uuid ?? '', instances: inst };
      const id = this.entries.length; this.entries.push({ id, ...base, ph: ph === true });
      if (ph === 'mixed') this.entries.push({ id: id + 1, ...base, key: r.key + ' [PLACEHOLDER faces]', ph: true });
      this.idOf.set(ob, id);
      saved.push([ob, m.material, ob.visible]);
      m.material = Array.isArray(m.material) ? mats.map((x: any) => this.matFor(x, ph === 'mixed')) : this.matFor(mats[0], ph === 'mixed');
    }
    if (this.entries.length > 65000) console.warn('[coverage] more than 65000 meshes: ids wrap');
    const rt = this.target(), prev = { tm: renderer.toneMapping, bg: scene.background, bgn: (scene as any).backgroundNode, fog: scene.fog, fogn: (scene as any).fogNode, env: scene.environment, envn: (scene as any).environmentNode, mrt: renderer.getMRT(), cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha() };
    try {
      renderer.toneMapping = THREE.NoToneMapping; scene.background = null; (scene as any).backgroundNode = null; scene.fog = null; (scene as any).fogNode = null; scene.environment = null; (scene as any).environmentNode = null;
      renderer.setMRT(null); renderer.setClearColor(0x000000, 1);
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null);
    } finally {
      for (let i = saved.length - 1; i >= 0; i--) { const [ob, mat, vis] = saved[i]; (ob as any).material = mat; ob.visible = vis; }
      renderer.toneMapping = prev.tm; scene.background = prev.bg; (scene as any).backgroundNode = prev.bgn; scene.fog = prev.fog; (scene as any).fogNode = prev.fogn; scene.environment = prev.env; (scene as any).environmentNode = prev.envn;
      renderer.setMRT(prev.mrt); renderer.setClearColor(prev.cc, prev.ca);
    }
    const px = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, FLAG_W, FLAG_H) as Uint8Array;
    const N = FLAG_W * FLAG_H, ids = new Uint16Array(N), dist = new Float32Array(N);
    for (let y = 0; y < FLAG_H; y++) { const sy = this.flip ? FLAG_H - 1 - y : y;
      for (let x = 0; x < FLAG_W; x++) { const i = 4 * (sy * FLAG_W + x), k = y * FLAG_W + x; ids[k] = px[i] + 256 * px[i + 1]; dist[k] = ids[k] ? decodeDist(px[i + 2]) : Infinity; } }
    this.last = { ids, dist, W: FLAG_W, H: FLAG_H, entries: this.entries };
    camera.updateMatrixWorld();
    const elev = elevations(camera, FLAG_W, FLAG_H); (this.last as any).elev = elev;
    const res: any = { W: FLAG_W, H: FLAG_H, ms: 0, meshes: this.entries.length - 1, effectsHidden: effects, hiddenTop, ...idShares(ids, this.entries, elev, FLAG_W, FLAG_H, o.top ?? 30) };
    if (o.frame) {
      const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + o.frame)).blob());
      { // the gate metrics at the frame's own resolution (MASTER_PLAN T-A2f, T-A3c, T-A3k, T-A3n, T-B2m/f)
        const fc = new OffscreenCanvas(img.width, img.height), fg = fc.getContext('2d')!; fg.drawImage(img, 0, 0);
        const cam = this.c.camera, sd = this.c.sunDir?.(), v = new THREE.Vector3();
        const nearSun = sd ? (x: number, y: number) => { v.set(((x + 0.5) / img.width) * 2 - 1, 1 - ((y + 0.5) / img.height) * 2, 0.5).unproject(cam).sub(cam.position).normalize(); return v.dot(sd) > Math.cos(2 * Math.PI / 180); } : () => false;
        res.gate = gateMetrics(fg.getImageData(0, 0, img.width, img.height).data, img.width, img.height, ids, FLAG_W, FLAG_H, nearSun);
        res.gate.fireLux = +(this.c.world.fire?.localIlluminance?.(cam.position) ?? 0).toPrecision(3);
      }
      const cv = new OffscreenCanvas(FLAG_W, FLAG_H), g = cv.getContext('2d')!; g.drawImage(img, 0, 0, FLAG_W, FLAG_H);
      const masks: { miss?: Uint8Array; low?: Uint8Array } = {};
      res.frame = analyseFrame(g.getImageData(0, 0, FLAG_W, FLAG_H).data, ids, dist, this.entries, elev, FLAG_W, FLAG_H, this.c.sunAlt() < -4, masks);
      if (o.mask) res.maskPng = await maskImage(ids, this.entries, masks, FLAG_W, FLAG_H);
    }
    res.ms = Math.round(performance.now() - t0);
    return res;
  }

  // ---------------------------------------------------------------- repetition
  /** identical instances within `radius` m in the view frustum, per geometry; distinct geometries vs instances in view */
  repetition(radius = 30) {
    const { camera, root } = this.c; camera.updateMatrixWorld();
    const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const cp = camera.position, M = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), sph = new THREE.Sphere();
    const counts = new Map<string, { n: number; scales: Set<number>; key: string }>(); let instances = 0; const geos = new Set<string>();
    const bump = (key: string, geo: string, sc: number) => { let c = counts.get(geo); if (!c) counts.set(geo, c = { n: 0, scales: new Set(), key }); c.n++; c.scales.add(Math.round(Math.log(Math.max(1e-3, sc)) / 0.05)); instances++; geos.add(geo); };
    root.traverseVisible(ob => { const m = ob as any; if (!m.isMesh || this.isEffect(Array.isArray(m.material) ? m.material[0] : m.material)) return;
      const g = m.geometry as THREE.BufferGeometry; if (!g.boundingSphere) g.computeBoundingSphere(); const br = g.boundingSphere?.radius ?? 1; const rec = () => this.record(ob).key;
      if (m.isInstancedMesh) { let key: string | null = null;
        for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); M.premultiply(m.matrixWorld); M.decompose(p, q, s); if (p.distanceTo(cp) > radius) continue; sph.set(p, br * Math.max(s.x, s.y, s.z)); if (!fr.intersectsSphere(sph)) continue; key ??= rec(); bump(key, g.uuid, s.x); } }
      else if (m.isBatchedMesh) { let key: string | null = null; const info = m._instanceInfo ?? [];
        for (let i = 0; i < info.length; i++) { if (!info[i]?.active || info[i].visible === false) continue; m.getMatrixAt(i, M); M.premultiply(m.matrixWorld); M.decompose(p, q, s); if (p.distanceTo(cp) > radius) continue;
          sph.set(p, 2 * Math.max(s.x, s.y, s.z)); if (!fr.intersectsSphere(sph)) continue; key ??= rec(); bump(key, `${g.uuid}#${info[i].geometryIndex}`, s.x); } }
      else if ((g as any).isInstancedBufferGeometry && g.attributes.ipos) { const P = g.attributes.ipos as THREE.BufferAttribute, n = Math.min(P.count, (g as any).instanceCount ?? P.count); let key: string | null = null;
        const S = g.attributes.iscl as THREE.BufferAttribute | undefined;
        for (let i = 0; i < n; i++) { p.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); if (p.distanceTo(cp) > radius) continue; sph.set(p, br * (S ? Math.abs(S.getY(i)) || 1 : 1)); if (!fr.intersectsSphere(sph)) continue; key ??= rec(); bump(key, g.uuid, S ? S.getY(i) : 1); } }
      else { m.matrixWorld.decompose(p, q, s); sph.copy(g.boundingSphere!).applyMatrix4(m.matrixWorld); if (sph.center.distanceTo(cp) - sph.radius > radius || !fr.intersectsSphere(sph)) return; bump(rec(), g.uuid, s.x); }
    });
    const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 10).map(c => ({ key: c.key, n: c.n, scaleVariants: c.scales.size }));
    return { radius, instances, geometries: geos.size, maxIdentical: top[0]?.n ?? 0, top };
  }

  // ---------------------------------------------------------------- life
  /** people and animals in view; after `seconds` of world time, who moved as they should (from the crowd's own state) */
  async life(seconds = 2) {
    const W = this.c.world, P = W.people; if (!P) return null;
    const crowd = P.crowd, cam = this.c.camera; cam.updateMatrixWorld();
    const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)), v = new THREE.Vector3();
    const frame = (crowd as any).frame as number;
    const IDLE = new Set(['idle']), REST = new Set(['sit', 'sleep']);
    const seen: { key: string; x: number; z: number; moving: boolean; cls: string; act: string; variant: number; d: number }[] = [];
    for (const p of crowd.persons.values()) {
      if (p.drawnFrame !== frame) continue; v.set(p.root[0], p.root[1] + 1, p.root[2]); if (!fr.containsPoint(v)) continue;
      const moving = p.agent ? !!p.agent.walking : !!p.vp?.moving, anim = String(p.anim ?? '');
      seen.push({ key: p.key, x: p.root[0], z: p.root[2], moving, act: String(p.act ?? ''), variant: p.look?.variantId ?? -1, d: v.distanceTo(cam.position),
        cls: moving ? 'moving' : IDLE.has(anim) ? 'idle' : REST.has(anim) ? 'resting' : 'active' });
    }
    const byCls: Record<string, number> = { moving: 0, active: 0, idle: 0, resting: 0 }; for (const s of seen) byCls[s.cls]++;
    const vc = new Map<number, number>(); for (const s of seen) vc.set(s.variant, (vc.get(s.variant) ?? 0) + 1);
    const twins = seen.filter(s => (vc.get(s.variant) ?? 0) > 1).length;
    const acts: Record<string, number> = {}; for (const s of seen) acts[s.act] = (acts[s.act] ?? 0) + 1;
    const an = crowd.animals?.stats?.() ?? null, imp = crowd.impPerf;
    const before = { impostors: imp.drawn, impWalking: imp.walking };
    // advance the world and look again
    this.c.advance(seconds); await this.c.tick();
    let frozen = 0, sliding = 0, gone = 0, jumped = 0, clipping = 0, clipChecked = 0; const nav = P.nav;
    for (const s of seen) { const p = crowd.persons.get(s.key); if (!p) { gone++; continue; } const dd = Math.hypot(p.root[0] - s.x, p.root[2] - s.z);
      if (s.moving && dd < 0.05) frozen++; else if (!s.moving && dd > 0.3) sliding++; if (dd > seconds * 4) jumped++;
      const e = p.root[0], n = -p.root[2]; if (e > -620 && e < 262 && n > -245 && n < 185) { clipChecked++; if (!nav.walkable(e, n) && !nav.snap(e, n, 0.4)) clipping++; } }
    return { seconds, people: seen.length, byCls, twins, variants: vc.size, acts, near10: seen.filter(s => s.d < 10).length,
      impostors: before.impostors, impWalking: before.impWalking, animals: an ? { instances: an.instances, species: an.species } : null,
      after: { frozen, sliding, gone, jumped, clipping, clipChecked }, keys: seen.map(s => s.key).slice(0, 200) };
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// pure analysis (node-testable: tests/coverage.test.ts)
const r4 = (x: number) => +x.toFixed(4);
/** ray elevation (deg) of every pixel centre of a W×H view (row 0 = top) */
export function elevations(cam: THREE.PerspectiveCamera, W: number, H: number) {
  const v = new THREE.Vector3(), cp = cam.position, elev = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { v.set(((x + 0.5) / W) * 2 - 1, 1 - ((y + 0.5) / H) * 2, 0.5).unproject(cam).sub(cp).normalize(); elev[y * W + x] = Math.asin(v.y) * 180 / Math.PI; }
  return elev;
}
/** per-view shares from an ID buffer: sky, placeholder, untiered, sky holes (sky below −1°); per object and per top group */
export function idShares(ids: Uint16Array, E: CovEntry[], elev: Float32Array, W: number, H: number, top = 30) {
  const N = W * H, count = new Float64Array(E.length); let bad = 0, hole = 0, ph = 0, untiered = 0, phU = 0, sky = 0;
  for (let k = 0; k < N; k++) { const id = ids[k]; if (id >= E.length) { bad++; continue; } count[id]++;
    if (id === 0) { sky++; if (elev[k] < SKY_HOLE_DEG) hole++; continue; }
    if (E[id].ph) ph++; if (!E[id].tier) untiered++; if (E[id].ph || !E[id].tier) phU++; }
  const objects = E.map((e, i) => ({ e, px: count[i] })).filter(q => q.px > 0 && q.e.id > 0).sort((a, b) => b.px - a.px);
  const groups: Record<string, number> = {}; for (const q of objects) groups[q.e.top] = (groups[q.e.top] ?? 0) + q.px / N;
  return { shares: { sky: r4(sky / N), placeholder: r4(ph / N), untiered: r4(untiered / N), phOrUntiered: r4(phU / N), skyHole: r4(hole / N), badId: r4(bad / N) },
    visibleMeshes: objects.length, tieredSourced: objects.length ? r4(objects.filter(q => q.e.tier && q.e.sourced).length / objects.length) : 1, untieredKeys: [...new Set(objects.filter(q => !(q.e.tier && q.e.sourced)).map(q => q.e.key))].slice(0, 8), materials: new Set(objects.map(q => q.e.mat)).size, geometries: new Set(objects.map(q => q.e.geo)).size,
    objects: objects.filter(q => q.px / N >= 0.002).slice(0, top).map(q => ({ key: q.e.key, share: r4(q.px / N), ph: q.e.ph, tier: q.e.tier, tris: q.e.tris, density: +q.e.density.toPrecision(3), inst: q.e.instances })),
    phObjects: objects.filter(q => q.e.ph && q.px / N >= 0.0002).slice(0, 20).map(q => ({ key: q.e.key, share: r4(q.px / N), tier: q.e.tier })),
    groups: Object.fromEntries(Object.entries(groups).map(([k, x]) => [k, r4(x)])) };
}
/** beauty-frame metrics on the ID grid: `d` RGBA of the frame drawn to W×H; `ids`, `dist` from the ID render */
export function analyseFrame(d: Uint8ClampedArray | Uint8Array, ids: Uint16Array, dist: Float32Array, E: CovEntry[], elev: Float32Array, W: number, H: number, night: boolean, masks?: { miss?: Uint8Array; low?: Uint8Array }) {
  const N = W * H;
  const Y = new Float32Array(N); for (let k = 0; k < N; k++) Y[k] = 0.2126 * d[4 * k] + 0.7152 * d[4 * k + 1] + 0.0722 * d[4 * k + 2];
  const geo = (k: number) => ids[k] > 0 && ids[k] < E.length;
  const sorted = Float32Array.from(Y).sort(), q = (f: number) => +sorted[Math.min(N - 1, Math.floor(f * N))].toFixed(1);
  let clip = 0, gs = 0, gs2 = 0, gn = 0; for (let k = 0; k < N; k++) { if (d[4 * k] >= 254 || d[4 * k + 1] >= 254 || d[4 * k + 2] >= 254) clip++; if (geo(k)) { gs += Y[k]; gs2 += Y[k] * Y[k]; gn++; } }
  const gMean = gn ? gs / gn : 0, gStd = gn ? Math.sqrt(Math.max(0, gs2 / gn - gMean * gMean)) : 0;
  // 16 px blocks: black, blown, flat (one colour over ≥ 90 % geometry)
  const B = 16, BW = Math.floor(W / B), BH = Math.floor(H / B), flat = new Uint8Array(BW * BH), miss = new Uint8Array(N); let blackPx = 0, blownPx = 0;
  const each = (bx: number, by: number, f: (k: number) => void) => { for (let y = by * B; y < by * B + B; y++) for (let x = bx * B; x < bx * B + B; x++) f(y * W + x); };
  for (let by = 0; by < BH; by++) for (let bx = 0; bx < BW; bx++) {
    let gN = 0, blk = 0, blw = 0; const s = [0, 0, 0], s2 = [0, 0, 0];
    each(bx, by, k => { if (!geo(k)) return; gN++; if (Y[k] < 3) blk++; if (Math.min(d[4 * k], d[4 * k + 1], d[4 * k + 2]) >= 250) blw++; for (let c = 0; c < 3; c++) { s[c] += d[4 * k + c]; s2[c] += d[4 * k + c] ** 2; } });
    if (gN < 0.9 * B * B) continue;
    const sd = s.map((v, c) => Math.sqrt(Math.max(0, s2[c] / gN - (v / gN) ** 2)));
    if (blk >= 0.95 * gN) each(bx, by, k => { if (geo(k)) { blackPx++; if (!night) miss[k] = 1; } }); // night: black is counted, not called missing
    else if (blw >= 0.95 * gN) each(bx, by, k => { if (geo(k)) { blownPx++; miss[k] = 1; } });
    else if (sd.every(v => v < 1.2)) flat[by * BW + bx] = 1;
  }
  let flatPx = 0; const seen = new Uint8Array(BW * BH); // large flat regions: ≥ 4 4-connected flat blocks
  for (let b0 = 0; b0 < BW * BH; b0++) { if (!flat[b0] || seen[b0]) continue; const comp = [b0], st = [b0]; seen[b0] = 1;
    while (st.length) { const b = st.pop()!, bx = b % BW, by = (b / BW) | 0;
      for (const [nx, ny] of [[bx + 1, by], [bx - 1, by], [bx, by + 1], [bx, by - 1]]) { if (nx < 0 || ny < 0 || nx >= BW || ny >= BH) continue; const nb = ny * BW + nx; if (flat[nb] && !seen[nb]) { seen[nb] = 1; st.push(nb); comp.push(nb); } } }
    if (comp.length >= 4) for (const b of comp) each(b % BW, (b / BW) | 0, k => { if (geo(k)) { miss[k] = 1; flatPx++; } }); }
  let holePx = 0; for (let k = 0; k < N; k++) if (ids[k] === 0 && elev[k] < SKY_HOLE_DEG) { miss[k] = 1; holePx++; }
  let missPx = 0; for (let k = 0; k < N; k++) missPx += miss[k]; if (masks) masks.miss = miss;
  const lowM = new Uint8Array(N); if (masks) masks.low = lowM;
  // per object: high-frequency shading over interior pixels (all 4 neighbours the same object)
  const lap = new Float64Array(E.length), lapN = new Float64Array(E.length), ySum = new Float64Array(E.length);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = y * W + x, id = ids[k]; if (!id || id >= E.length) continue;
    if (ids[k - 1] !== id || ids[k + 1] !== id || ids[k - W] !== id || ids[k + W] !== id) continue;
    lap[id] += Math.abs(4 * Y[k] - Y[k - 1] - Y[k + 1] - Y[k - W] - Y[k + W]); lapN[id]++; ySum[id] += Y[k]; }
  const hf = (id: number) => lapN[id] > 20 ? lap[id] / lapN[id] / (ySum[id] / lapN[id] + 5) : NaN;
  // low detail (flag-free): density × d² < K_TRI (triangles per steradian at the pixel's distance) and the object's hf < K_HF
  let lowPx = 0, nearN = 0; const nearTsr: number[] = [], lowBy = new Map<number, number>();
  for (let k = 0; k < N; k++) { const id = ids[k]; if (!id || id >= E.length) continue; const dd = Math.max(0.3, dist[k]), tsr = E[id].density * dd * dd;
    if (dd < 30) { if (nearN++ % 7 === 0) nearTsr.push(tsr); }
    const h = hf(id); if (tsr < K_TRI && !(h >= K_HF)) { lowPx++; lowM[k] = 1; lowBy.set(id, (lowBy.get(id) ?? 0) + 1); } }
  nearTsr.sort((a, b) => a - b);
  // visible tiling: textured 64 px blocks (≥ 90 % geometry, Y variance ≥ 16) whose autocorrelation has a peak ≥ 0.6 at a
  // lag of 6-38 px after a dip (heuristic, C: colonnades, merlons and courses are periodic by design; see the lag)
  const T = 64; let tileBlocks = 0, textured = 0, tileMax = 0; const tiles: { x: number; y: number; r: number; lag: number; dir: string }[] = [];
  for (let by = 0; by + T <= H; by += T) for (let bx = 0; bx + T <= W; bx += T) {
    let n = 0, s = 0, s2 = 0; for (let y = by; y < by + T; y++) for (let x = bx; x < bx + T; x++) { const k = y * W + x; if (!geo(k)) continue; n++; s += Y[k]; s2 += Y[k] * Y[k]; }
    if (n < 0.9 * T * T) continue; const m = s / n, v = s2 / n - m * m; if (v < 16) continue; textured++;
    let best = 0, bl = 0, bd = '';
    for (const dir of ['x', 'y']) { const r: number[] = [];
      for (let lag = 1; lag <= 40; lag++) { let c = 0, cn = 0;
        for (let y = by; y < by + T - (dir === 'y' ? lag : 0); y++) for (let x = bx; x < bx + T - (dir === 'x' ? lag : 0); x++) { const k = y * W + x, k2 = dir === 'x' ? k + lag : k + lag * W; c += (Y[k] - m) * (Y[k2] - m); cn++; }
        r.push(c / cn / v); }
      for (let lag = 6; lag < 39; lag++) { const rv = r[lag - 1]; if (rv > best && rv >= r[lag - 2] && rv >= r[lag] && Math.min(...r.slice(0, lag - 1)) < rv - 0.2) { best = rv; bl = lag; bd = dir; } } }
    if (best >= 0.6) { tileBlocks++; tiles.push({ x: bx, y: by, r: +best.toFixed(2), lag: bl, dir: bd }); } tileMax = Math.max(tileMax, best);
  }
  const lowObjects = [...lowBy].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ key: E[id].key, share: r4(n / N), density: +E[id].density.toPrecision(3), hf: Number.isFinite(hf(id)) ? +hf(id).toFixed(3) : null, ph: E[id].ph }));
  return {
    lum: { mean: +(Y.reduce((a, b) => a + b, 0) / N).toFixed(1), p01: q(0.01), p50: q(0.5), p99: q(0.99), clipped: r4(clip / N), geoMean: +gMean.toFixed(1) },
    flatness: gMean > 0 ? +(gStd / gMean).toFixed(3) : null,
    black: r4(blackPx / N), blown: r4(blownPx / N), flatLarge: r4(flatPx / N), skyHole: r4(holePx / N), missing: r4(missPx / N), night,
    lowDetail: r4(lowPx / N), lowObjects, nearTriPerSr: nearTsr.length ? { p10: Math.round(nearTsr[Math.floor(nearTsr.length * 0.1)]), p50: Math.round(nearTsr[Math.floor(nearTsr.length / 2)]) } : null,
    tiling: { textured, periodic: tileBlocks, maxR: +tileMax.toFixed(2), blocks: tiles.slice(0, 6) },
  };
}

/** a false-colour picture of the ID render (for the eye: screenshots find problems): sky dark blue, PLACEHOLDER red,
 *  missing magenta, low detail yellow, everything else a grey per object; PNG base64 */
export async function maskImage(ids: Uint16Array, E: CovEntry[], m: { miss?: Uint8Array; low?: Uint8Array }, W: number, H: number) {
  const c = new OffscreenCanvas(W, H), g = c.getContext('2d')!, img = g.createImageData(W, H), d = img.data;
  for (let k = 0; k < W * H; k++) { const id = ids[k]; let r: number, gg: number, b: number;
    if (id === 0) { r = 25; gg = 35; b = 70; } else if (id >= E.length) { r = 0; gg = 255; b = 0; }
    else { const v = 70 + ((id * 2654435761) >>> 24) % 120; r = gg = b = v; if (m.low?.[k]) { r = 230; gg = 200; b = 40; } if (E[id].ph) { r = 220; gg = 40; b = 40; } }
    if (m.miss?.[k]) { r = 230; gg = 40; b = 230; }
    d[4 * k] = r; d[4 * k + 1] = gg; d[4 * k + 2] = b; d[4 * k + 3] = 255; }
  g.putImageData(img, 0, 0); const u8 = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
  let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s);
}

/** the MASTER_PLAN gate metrics of one frame at its own resolution (W×H RGBA), sky from the ID buffer (iw×ih) scaled:
 *  T-A2f flat-region share (12 px blocks with Ystd/Y < 0.03, sky excluded, in 4-connected regions ≥ 2 % of the frame);
 *  T-A3c clipped share (any channel ≥ 254; the sun's disc, within 2° of the sun, excluded; flames are NOT excluded);
 *  T-A3k crush share (every channel ≤ 2; the report applies it by day); T-A3n black tiles (16 px tiles exactly 0,0,0);
 *  T-B2 the mean tone-mapped luma of the frame (0-255, Rec. 709 on the display values) */
export function gateMetrics(d: Uint8ClampedArray | Uint8Array, W: number, H: number, ids: Uint16Array, iw: number, ih: number, nearSun: (x: number, y: number) => boolean = () => false) {
  const N = W * H, sky = (x: number, y: number) => ids[Math.min(ih - 1, Math.floor((y * ih) / H)) * iw + Math.min(iw - 1, Math.floor((x * iw) / W))] === 0;
  let lum = 0, clip = 0, crush = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = 4 * (y * W + x), r = d[i], g = d[i + 1], b = d[i + 2];
    lum += 0.2126 * r + 0.7152 * g + 0.0722 * b; if (r <= 2 && g <= 2 && b <= 2) crush++;
    if ((r >= 254 || g >= 254 || b >= 254) && !(sky(x, y) && nearSun(x, y))) clip++; }
  let black = 0; for (let ty = 0; ty + 16 <= H; ty += 16) for (let tx = 0; tx + 16 <= W; tx += 16) { let all = true;
    for (let y = ty; y < ty + 16 && all; y++) for (let x = tx; x < tx + 16; x++) { const i = 4 * (y * W + x); if (d[i] || d[i + 1] || d[i + 2]) { all = false; break; } } if (all) black++; }
  const B = 12, BW = Math.floor(W / B), BH = Math.floor(H / B), flat = new Uint8Array(BW * BH), px = new Uint16Array(BW * BH);
  for (let by = 0; by < BH; by++) for (let bx = 0; bx < BW; bx++) { let n = 0, s = 0, s2 = 0;
    for (let y = by * B; y < by * B + B; y++) for (let x = bx * B; x < bx * B + B; x++) { if (sky(x, y)) continue; const i = 4 * (y * W + x), Y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; s += Y; s2 += Y * Y; }
    if (n < (B * B) / 2) continue; const m = s / n, sd = Math.sqrt(Math.max(0, s2 / n - m * m)); if (m > 0 && sd / m < 0.03) { flat[by * BW + bx] = 1; px[by * BW + bx] = n; } }
  let flatPx = 0; const seen = new Uint8Array(BW * BH);
  for (let b0 = 0; b0 < BW * BH; b0++) { if (!flat[b0] || seen[b0]) continue; const st = [b0], comp: number[] = [b0]; seen[b0] = 1;
    while (st.length) { const b = st.pop()!, bx = b % BW, by = (b / BW) | 0;
      for (const [nx, ny] of [[bx + 1, by], [bx - 1, by], [bx, by + 1], [bx, by - 1]]) { if (nx < 0 || ny < 0 || nx >= BW || ny >= BH) continue; const nb = ny * BW + nx; if (flat[nb] && !seen[nb]) { seen[nb] = 1; st.push(nb); comp.push(nb); } } }
    const a = comp.reduce((t, b) => t + px[b], 0); if (a >= 0.02 * N) flatPx += a; }
  return { W, H, flatRegion: r4(flatPx / N), clipped: r4(clip / N), crush: r4(crush / N), blackTiles: black, meanLuma: +(lum / N).toFixed(1), fireLux: 0 };
}
