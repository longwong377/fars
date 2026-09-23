// Crowd renderer (D-090, D-093): renders the simulation's people with the MakeHuman-derived bodies in period dress.
//
// Pooling: the pool is fed by the simulation's `visibleAgents(centre, ATTACH_R, POOL_MAX)` (the detailed agents on the
// Terrace, nearest first, capped; D-024): people are attached when they come into that set and detached beyond DETACH_R
// or when they leave for the town. Attaching gives a person a palette slot and writes their
// look (looks.ts; deterministic from their seed, so a person looks the same every time). The simulation's roster can
// therefore grow to thousands (Phase 5) without one rig per agent: cost scales with the people near the camera.
// `attach()`/`detach()` are public so a future dynamic roster can drive the pool itself (autoPool = false).
//
// LOD per frame: full detail (the 30k-triangle close-up body with fingers, eyes, mouth, lashes) within LOD_DIST[0]
// for up to MAX_FULL people, nearest first; the mid body to LOD_DIST[1]; the far body to LOD_DIST[2]; the far body
// simplified to a fifth (meshoptimizer) to LOD_DIST[3] (when the simplifier ran; otherwise the far body). Impostors beyond
// are not built. Each costume × LOD is one instanced draw (humanGPU.ts). Poses are refreshed every frame near the
// camera and less often further away; root motion is per frame for everyone (instanced root attribute).
// Face: blinks, the jaw while speaking or eating, eyes and head turned to a nearby stranger.
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, float, abs, min } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pose, type Pose } from './anim';
import { ACTIVITIES } from './activities';
import { PeopleSim, PLACES, type Agent } from './sim';
import type { HumanSystem } from './humans';
import { RigSolver, PALETTE_STRIDE, PLANTED, type RigInput, type FaceState } from './humanRig';
import { lookFor, type PersonLook, type LookInput } from './looks';
import { HB } from './humanFormat';
import { PERSON_TEXELS, FLAG_HIDE_HEAD } from './humanMaterial';
import { nearCascadesOnly } from './humanGPU';
import { propGeometry, propUnionGeometry, paintedBox, PROP_KINDS, PROP_NOTES } from './props';
import { PIECES, pieceBit, COSTUME_OF, type Dress } from './outfits';
/** poses in which people sit, kneel or lie (coats and back-carried weapons are laid aside) */
const SEATED = new Set<AnimId>(['sit', 'write', 'eat', 'dice', 'sleep', 'grind', 'knead', 'bake']);
import type { AnimId } from './anim';

const gw = (e: number, n: number, y: number) => new THREE.Vector3(e, y, -n);
const rad = (deg: number) => (deg * Math.PI) / 180;
/** world yaw for a grid heading (deg clockwise from grid north); the rig faces +Z in bind pose */
export const yawOf = (headingDeg: number) => Math.PI - rad(headingDeg);
/** LOD distances (m): full detail, mid, far (nothing beyond: impostors not built) */
export const LOD_DIST = [25, 90, 200, 600] as const;
/** full detail for at most the nearest MAX_FULL (brief: ≥ 50), mid detail for at most the next MAX_MID; beyond, the far
 *  body even within 90 m. Measured at high quality, 300 people within 20 m: 64 + all-mid cost 3.55 M view triangles
 *  (15.7 M frame); 50 + 160 cost 2.88 M (12.33 M frame, budget 12 M); hence 50 + 100 (D-093) */
export const MAX_FULL = 50, MAX_MID = 100;
export const ATTACH_R = 620, DETACH_R = 660;
/** the most simulated people attached at once (the cap passed to sim.visibleAgents) */
export const POOL_MAX = 400;
/** people cast shadows within this distance (m) only. An instanced caster is drawn whole in every cascade its bounds
 *  touch, so each caster costs its triangles × cascades; at 90 m a person's shadow is a few pixels (D-093) */
export const SHADOW_DIST = LOD_DIST[1];
/** carried props drawn per frame (one instanced mesh) */
export const CARRIED_MAX = 256;

export interface Person {
  key: string; agent: Agent | null; look: PersonLook; slot: number; rig: RigInput; face: FaceState;
  root: [number, number, number, number]; prevRoot: [number, number, number, number];
  shown: boolean; drawnFrame: number; poseFrame: number; frameMod: number; lastHit: boolean;
  blinkAt: number; speakUntil: number; prop: string | null; propM: THREE.Matrix4; anim: AnimId; t0: number; dist: number;
  /** piece mask in effect (the look's mask minus what is laid aside while seated or asleep) */
  mask: number;
  /** gaze target in character space (the rig's space: the root is applied per instance on the GPU) */
  lookC: [number, number, number];
  /** the activity performed now, and whether it is a PLACEHOLDER (abstract-only activities have no performance; if one
   *  ever reaches a rendered person the dev overlay says so instead of showing a made-up loop) */
  act: string; actPlaceholder: boolean;
  /** when the greeting nod started (−1: not greeted on this approach) */
  nodAt: number;
  /** extras (lineups, tests): fixed animation and place */
  extra?: { anim: AnimId; x: number; y: number; z: number; yaw: number; look?: [number, number, number] | null };
}

export class Crowd {
  readonly group = new THREE.Group();
  readonly persons = new Map<string, Person>();
  autoPool = true;
  onHit?: (kind: string, pos: THREE.Vector3) => void;
  /** pop-in log: a person appearing within 50 m in view (§13.8 fails the walkthrough on these) */
  onPopIn?: (what: string, d: number) => void;
  private rigS: RigSolver;
  private freeSlots: number[] = []; private nextSlot = 0;
  private frame = 0; private sacks: THREE.InstancedMesh;
  /** every carried prop: one instanced mesh (the union geometry; 'ik' picks the kind per instance) */
  private carried!: THREE.InstancedMesh; private carriedKind!: THREE.InstancedBufferAttribute;
  private frustum = new THREE.Frustum(); private wide = new THREE.Frustum(); private pm = new THREE.Matrix4();
  private lastStock = { depot: -1, store: -1 };
  /** last frame's CPU cost (ms) of pooling, posing and instance filling; people drawn per LOD */
  readonly perf = { ms: 0, poseMs: 0, posed: 0, drawn: [0, 0, 0, 0], attached: 0 };
  private hitProxy: THREE.Mesh; private list: Person[] = [];
  /** `sim` null: a crowd of extras only (the human lab page, tests) */
  constructor(readonly sim: PeopleSim | null, readonly seed: number, readonly humans: HumanSystem) {
    this.group.name = 'people';
    this.group.add(humans.gpu.group);
    this.rigS = new RigSolver(humans.A.meta.curlAxes);
    this.buildPropMeshes();
    if (sim) this.buildWorkObjects(); else this.autoPool = false;
    // both sack piles (depot, store) are one instanced mesh: one draw
    const sk = new THREE.InstancedMesh(propGeometry('sack')!, this.propMaterial(), 600); sk.castShadow = true; sk.receiveShadow = true; sk.count = 0; sk.visible = false; sk.frustumCulled = false;
    sk.name = 'goods:sacks'; sk.userData = { tier: 'C', src: 'RECON', note: 'sacks counted by the simulation (stocks)' }; this.group.add(sk); this.sacks = sk; nearCascadesOnly(sk);
    // ray hits on people (dev overlay, pick): a proxy mesh whose raycast tests each shown person's standing capsule
    this.hitProxy = new THREE.Mesh(); this.hitProxy.name = 'people:hit'; this.hitProxy.visible = false; // never drawn; raycasters still call it
    (this.hitProxy as any).raycast = (rc: THREE.Raycaster, out: THREE.Intersection[]) => this.raycast(rc, out); // (was inside the comment: picking people found nothing)
    this.group.add(this.hitProxy);
  }
  // ------------------------------------------------------------------------------------------------ props
  private propMat?: THREE.MeshStandardNodeMaterial;
  /** props: vertex colour (linear) and metalness/roughness per vertex (props.ts) */
  private propMaterial() {
    if (this.propMat) return this.propMat;
    const m = new THREE.MeshStandardNodeMaterial(); const mr = attribute('mr', 'vec2');
    m.colorNode = attribute('color', 'vec3'); m.metalnessNode = mr.x; m.roughnessNode = mr.y;
    this.propMat = m; return m;
  }
  private buildPropMeshes() {
    const g = propUnionGeometry(); const ik = new THREE.InstancedBufferAttribute(new Float32Array(CARRIED_MAX), 1); ik.setUsage(THREE.DynamicDrawUsage); g.setAttribute('ik', ik);
    const m = new THREE.MeshStandardNodeMaterial(); const mr = attribute('mr', 'vec2');
    m.colorNode = attribute('color', 'vec3'); m.metalnessNode = mr.x; m.roughnessNode = mr.y;
    // the instance's own kind only: other kinds' vertices collapse to a point (arithmetic mask, no select: D-012)
    m.positionNode = positionLocal.mul(float(1).sub(min(abs(attribute('pk', 'float').sub(attribute('ik', 'float'))), 1)));
    const im = new THREE.InstancedMesh(g, m, CARRIED_MAX); im.count = 0; im.visible = false; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.name = 'props:carried'; im.raycast = () => {}; // all kinds are in every instance on the CPU side
    im.userData = { tier: 'C', src: 'RECON', note: 'carried: ' + PROP_KINDS.map(k => `${k} (${PROP_NOTES[k].tier}): ${PROP_NOTES[k].note}`).join('; ') };
    this.group.add(im); this.carried = im; this.carriedKind = ik; nearCascadesOnly(im);
  }
  /** blocks at the masons' places, querns, mats, the trough (C forms): static, merged into one mesh (one draw) */
  private buildWorkObjects() {
    const stone: [number, number, number] = [0.553, 0.541, 0.518], clay: [number, number, number] = [0.486, 0.416, 0.333], reed: [number, number, number] = [0.627, 0.557, 0.384];
    const parts: THREE.BufferGeometry[] = []; const q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), M = new THREE.Matrix4();
    const put = (g: THREE.BufferGeometry, items: [THREE.Vector3, number][]) => { for (const [p, yaw] of items) { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw); parts.push(g.clone().applyMatrix4(M.compose(p, q, one))); } };
    const sim = this.sim!, nav = sim.nav;
    const masons = sim.agents.filter(a => a.role === 'mason');
    put(paintedBox(1.4, 0.75, 0.9, stone, 0.9), masons.map(a => { const e = a.slot[0], n = a.slot[1] + 0.95; return [gw(e, n, nav.heightAt(e, n) || 0), 0.1 * Math.sin(a.id)]; }));
    const grind = sim.agents.filter(a => a.role === 'grinder' || a.role === 'baker');
    put(paintedBox(0.4, 0.14, 0.7, stone, 0.9), grind.map(a => { const e = a.slot[0] + 0.62, n = a.slot[1]; return [gw(e, n, nav.heightAt(e, n) || 0), Math.PI / 2]; }));
    const guards = sim.agents.filter(a => a.role === 'guard');
    put(paintedBox(0.8, 0.03, 1.9, reed, 0.95), guards.map(a => [gw(a.slot[0], a.slot[1] + 0.2, (nav.heightAt(a.slot[0], a.slot[1]) || 0)), Math.PI]));
    const o = PLACES.oven.at; put(paintedBox(0.9, 0.2, 0.5, clay, 0.95), [[gw(o[0] - 1.5, o[1] - 0.6, nav.heightAt(o[0], o[1] - 0.6) || 0), 0.2]]);
    if (!parts.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(parts)!, this.propMaterial()); mesh.castShadow = mesh.receiveShadow = true; mesh.name = 'work:objects';
    mesh.userData = { tier: 'C', src: 'RECON', note: 'work objects: limestone blocks being dressed (C); saddle querns (period type B, placement C); reed sleeping mats (C); kneading trough (C)' };
    this.group.add(mesh); nearCascadesOnly(mesh);
  }
  /** lay out `count` sacks of a pile from instance `from` (at most `max`); returns how many were placed */
  private pileLayout(from: number, max: number, centre: [number, number], count: number) {
    const im = this.sacks, n = Math.max(0, Math.min(count, max)); const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    const g0 = this.sim!.nav.heightAt(centre[0], centre[1]) || 0; const per = 5 * 4;
    for (let i = 0; i < n; i++) { const layer = Math.floor(i / per), k = i % per, row = Math.floor(k / 5), col = k % 5;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 0.37) % 0.4 - 0.2); im.setMatrixAt(from + i, M.compose(gw(centre[0] + (col - 2) * 0.5 + layer * 0.1, centre[1] + (row - 1.5) * 0.4, g0 + 0.12 + layer * 0.26), q, s)); }
    return n;
  }
  // ------------------------------------------------------------------------------------------------ pool
  allocSlot(): number {
    const s = this.freeSlots.length ? this.freeSlots.pop()! : this.nextSlot++;
    if (s >= this.humans.gpu.capacity) this.humans.gpu.grow(Math.max(s + 1, this.humans.gpu.capacity * 2));
    return s;
  }
  freeSlot(s: number) { this.freeSlots.push(s); }
  /** write a person's look into their row of the person texture */
  writePerson(slot: number, look: PersonLook, flags = 0) {
    const D = this.humans.gpu.person, o = slot * PERSON_TEXELS * 4, c = look.col;
    D.set([look.variant, look.mask, look.pattern, look.grime], o);
    D.set([...c.skin, look.stubble], o + 4); D.set([...c.main, 0], o + 8); D.set([...c.second, 0], o + 12); D.set([...c.trim, 0], o + 16);
    D.set([...c.hair, 0], o + 20); D.set([...c.leather, 0], o + 24); D.set([look.grimeLevel, look.scale, 0, flags], o + 28); D.set([...c.felt, 0], o + 32);
    this.humans.gpu.markPersonDirty();
  }
  private newPerson(key: string, agent: Agent | null, look: PersonLook, seed: number): Person {
    const slot = this.allocSlot(); this.writePerson(slot, look);
    const v = this.humans.A.variants[look.variant];
    const face: FaceState = { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 };
    const p: Person = { key, agent, look, slot, face, rig: { joints: v.joints, pose: { rot: {}, hips: [0, 0, 0] }, face, grip: [0, 0], x: 0, y: 0, z: 0, yaw: 0, scale: 1 },
      root: [0, 0, 0, 0], prevRoot: [0, 0, 0, 0], shown: false, drawnFrame: -10, poseFrame: -10, frameMod: seed % 8, lastHit: false,
      blinkAt: (seed % 997) / 997 * 4, speakUntil: -1, prop: null, propM: new THREE.Matrix4(), anim: 'idle', t0: (seed % 100), dist: 0, mask: look.mask, lookC: [0, 0, 0], act: '', actPlaceholder: false, nodAt: -1 };
    this.persons.set(key, p); if (agent) this.byAgent.set(agent.id, p); return p;
  }
  /** attached people by agent id (no string keys in the per-frame pool scan) */
  private byAgent = new Map<number, Person>();
  /** attach a simulation agent (gives it a slot and a look); idempotent */
  attach(a: Agent): Person {
    const hit = this.byAgent.get(a.id); if (hit) return hit; const key = `a${a.id}`;
    const look = lookFor(this.humans.A, { id: a.id, sex: a.sex, role: a.role, dress: a.dress as Dress, origin: a.origin, seed: a.seed } as LookInput, this.seed);
    return this.newPerson(key, a, look, a.seed);
  }
  detach(a: Agent | string) { const p = typeof a === 'string' ? this.persons.get(a) : this.byAgent.get(a.id); if (!p) return; this.freeSlot(p.slot); this.persons.delete(p.key); if (p.agent) this.byAgent.delete(p.agent.id); }
  /** an extra person not driven by the simulation (test lineups): fixed place, yaw and animation */
  addExtra(key: string, spec: LookInput & { x: number; y: number; z: number; yaw: number; anim?: AnimId; look?: [number, number, number] | null }) {
    const old = this.persons.get(key); if (old) { this.freeSlot(old.slot); this.persons.delete(key); }
    const look = lookFor(this.humans.A, spec, this.seed);
    const p = this.newPerson(key, null, look, spec.seed); p.extra = { anim: spec.anim ?? 'idle', x: spec.x, y: spec.y, z: spec.z, yaw: spec.yaw, look: spec.look ?? null }; return p;
  }
  removeExtras() { for (const [k, p] of this.persons) if (!p.agent) { this.freeSlot(p.slot); this.persons.delete(k); } }
  /** a person is speaking (address → speech line): the jaw moves for `seconds` */
  speaking(agentId: number, seconds: number, now: number) { const p = this.byAgent.get(agentId); if (p) p.speakUntil = now + seconds; }
  private now = 0;
  /** agents that were off the map (in the town) at the last update: coming on the map within 50 m in view is a pop-in
   *  (§13.8), as in the Phase 3 crowd; attaching or changing LOD at a distance is not */
  private visPrev = new Set<number>(); private visNow = new Set<number>(); private poolPrimed = false;
  /** the pool, fed by the simulation's visible set: attach newcomers, detach the pooled who left (offmap, or beyond
   *  DETACH_R). A newcomer within 50 m in view is a pop-in (it came on the map there: ATTACH_R ≫ 50 m) */
  private autoPoolStep(cam: THREE.Vector3, camera?: THREE.Camera) {
    const vis = this.sim!.visibleAgents([cam.x, -cam.z], ATTACH_R, POOL_MAX), now = this.visNow; now.clear();
    for (const a of vis) {
      now.add(a.id); if (!this.byAgent.has(a.id)) this.attach(a);
      if (this.poolPrimed && camera && !this.visPrev.has(a.id)) { const d = Math.hypot(a.pos[0] - cam.x, a.y + 1 - cam.y, -a.pos[1] - cam.z);
        if (d < 50 && this.frustum.containsPoint(_v.set(a.pos[0], a.y + 1, -a.pos[1]))) this.onPopIn?.(`person ${a.id} (${a.role})`, d); }
    }
    for (const p of this.persons.values()) { const a = p.agent; if (!a || now.has(a.id)) continue;
      const dx = a.pos[0] - cam.x, dz = -a.pos[1] - cam.z; if (a.offmap || dx * dx + dz * dz > DETACH_R * DETACH_R) this.detach(a); }
    this.visNow = this.visPrev; this.visPrev = now; this.poolPrimed = true;
  }
  // ------------------------------------------------------------------------------------------------ per frame
  update(time: number, cam: THREE.Vector3, playerPos: THREE.Vector3 | null, camera?: THREE.Camera) {
    const t0 = performance.now(); this.now = time;
    if (camera) { camera.updateMatrixWorld(); this.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.pm); this.wide.copy(this.frustum); for (const pl of this.wide.planes) pl.constant += 3; }
    this.frame++;
    const S = this.sim?.stock;
    if (S && (S.depot !== this.lastStock.depot || S.store !== this.lastStock.store)) {
      const nd = this.pileLayout(0, 200, [PLACES.stair_foot.at[0] - 3, PLACES.stair_foot.at[1] - 2.5], S.depot);
      const ns = this.pileLayout(nd, 400, [PLACES.treasury_store.at[0] - 4, PLACES.treasury_store.at[1] - 3], S.store);
      this.sacks.count = nd + ns; this.sacks.visible = nd + ns > 0; this.sacks.instanceMatrix.needsUpdate = true; this.lastStock.depot = S.depot; this.lastStock.store = S.store;
    }
    if (this.autoPool) this.autoPoolStep(cam, camera);
    const gpu = this.humans.gpu; gpu.begin();
    this.carried.count = 0;
    // order by distance for the full-detail cap
    const list = this.list; list.length = 0;
    for (const p of this.persons.values()) {
      const a = p.agent; let x: number, y: number, z: number, yaw: number;
      if (a) { if (a.offmap) { p.shown = false; continue; } x = a.pos[0]; y = a.y; z = -a.pos[1]; yaw = yawOf(a.heading); }
      else { const e = p.extra!; x = e.x; y = e.y; z = e.z; yaw = e.yaw; }
      const pr = p.prevRoot, r = p.root;
      if (p.drawnFrame === this.frame - 1) { pr[0] = r[0]; pr[1] = r[1]; pr[2] = r[2]; pr[3] = r[3]; } else { pr[0] = x; pr[1] = y; pr[2] = z; pr[3] = yaw; }
      r[0] = x; r[1] = y; r[2] = z; r[3] = yaw;
      const d = Math.hypot(x - cam.x, y + 0.9 - cam.y, z - cam.z);
      p.shown = d < LOD_DIST[3];
      if (!p.shown) continue;
      if (camera && !this.wide.intersectsSphere(_s.set(_v.set(x, y + 0.9, z), 1.3 * p.look.scale))) { if (a) this.soundsOnly(p, d, time); continue; }
      p.dist = d; list.push(p);
    }
    list.sort((a, b) => a.dist - b.dist);
    const tp = performance.now(); let posed = 0; const drawn = [0, 0, 0, 0]; const has3 = this.humans.gpu.costumes.has('worker@3');
    for (let i = 0; i < list.length; i++) {
      const p = list[i], d = p.dist;
      const lod = d < LOD_DIST[0] && drawn[0] < MAX_FULL ? 0 : d < LOD_DIST[1] && drawn[1] < MAX_MID ? 1 : d < LOD_DIST[2] || !has3 ? 2 : 3; drawn[lod]++;
      const every = d < 30 ? 1 : d < 90 ? 2 : d < 200 ? 4 : 8;
      if (p.poseFrame < 0 || (this.frame + p.frameMod) % every === 0 || this.frame - p.poseFrame > every) { this.posePerson(p, time, d, playerPos, cam, lod); posed++; }
      else if (p.poseFrame === this.frame - 1) this.copyPrev(p); // no bone change this frame: previous = current
      const c = gpu.costumes.get(`${COSTUME_OF[p.look.dress]}@${lod}`)!;
      gpu.push(c, p.slot, p.root[0], p.root[1], p.root[2], p.root[3], p.prevRoot[0], p.prevRoot[1], p.prevRoot[2], p.prevRoot[3], lod === 0 ? 1 : d < SHADOW_DIST ? 2 : 0);
      p.drawnFrame = this.frame;
      if (p.prop) this.placeProp(p);
    }
    gpu.end(true);
    { const im = this.carried; im.visible = im.count > 0; if (im.count) { im.instanceMatrix.needsUpdate = true; im.instanceMatrix.clearUpdateRanges(); im.instanceMatrix.addUpdateRange(0, im.count * 16);
      this.carriedKind.needsUpdate = true; this.carriedKind.clearUpdateRanges(); this.carriedKind.addUpdateRange(0, im.count); } }
    this.perf.ms = performance.now() - t0; this.perf.poseMs = performance.now() - tp; this.perf.posed = posed; this.perf.drawn = drawn; this.perf.attached = this.persons.size;
  }
  private copyPrev(p: Person) { const o = p.slot * PALETTE_STRIDE; const g = this.humans.gpu; g.prevPalette.set(g.palette.subarray(o, o + PALETTE_STRIDE), o); }
  /** activity, pose, face and hands → skin palette (character space); props and tool sounds */
  private posePerson(p: Person, time: number, d: number, playerPos: THREE.Vector3 | null, cam: THREE.Vector3, lod: number) {
    const a = p.agent; const g = this.humans.gpu;
    let po: Pose; let propKind: string | null = null; let anim: AnimId;
    if (a) {
      const perf = this.sim!.performance(a); const P = ACTIVITIES[perf.act]; anim = P.anim;
      p.act = perf.act; p.actPlaceholder = !!P.placeholder;
      po = pose(anim, time + a.seed % 100, a.gait, (a.seed % 1000) / 159);
      const want = P.prop ?? (a.carry === 'sack' ? 'sack' : a.carry === 'jar_head' ? 'jar_head' : a.carry === 'basket' ? 'basket' : undefined);
      propKind = want ? (want === 'bread' ? 'basket' : want) : null;
      if (po.hit && !p.lastHit && d < 60) this.onHit?.(P.sound ?? 'chisel', _v.set(p.root[0], p.root[1], p.root[2]).clone());
      p.lastHit = !!po.hit;
    } else { anim = p.extra!.anim; po = pose(anim, time + p.t0, time * 4.2, 0.3); }
    p.anim = anim;
    // coats, weapons on the back and hats are laid aside while seated or asleep (they would pass through the ground; C)
    const mask = SEATED.has(anim) ? p.look.mask & ~this.asideBits(p.look.dress, anim) : p.look.mask;
    if (mask !== p.mask) { p.mask = mask; this.humans.gpu.person[p.slot * PERSON_TEXELS * 4 + 1] = mask; this.humans.gpu.markPersonDirty(); }
    // glance: the player within 7 m turns heads (clamped) and eyes. How much follows the simulation's memory of the
    // player (sim.greeting: none → a stranger's glance; nod / recognise → the head turns fully and nods once, within 4 m)
    const f = p.face; f.look = null; f.eyeYaw = 0; f.eyePitch = 0; f.jaw = 0;
    const lookAt = p.extra?.look ?? null;
    if (lookAt) f.look = this.toChar(p, lookAt);
    else if (playerPos && d < 7 && anim !== 'sleep') {
      const dx = cam.x - p.root[0], dz = cam.z - p.root[2]; const cy = Math.cos(p.root[3]), sy = Math.sin(p.root[3]);
      const lx = cy * dx - sy * dz, lz = sy * dx + cy * dz; const yaw = Math.atan2(lx, lz);
      const greet = a ? (this.sim?.greeting?.(a.id) ?? 'none') : 'none';
      if (Math.abs(yaw) < 1.9) { const h = po.rot.head ?? [0, 0, 0]; let pitch = h[0];
        if (greet !== 'none' && d < 4) { if (p.nodAt < 0) p.nodAt = time; const tn = time - p.nodAt; if (tn < 0.8) pitch += 0.18 * Math.sin((Math.PI * tn) / 0.8); } // a nod (C)
        po.rot.head = [pitch, Math.max(-1, Math.min(1, yaw)) * (greet === 'none' ? 0.8 : 1), h[2]]; f.look = this.toChar(p, [cam.x, cam.y, cam.z]); }
    }
    if (d > 6) p.nodAt = -1;
    if (lod < 2) { // face detail only where it can be seen
      // blinks every 2–6 s (150 ms), saccades
      const bt = time - p.blinkAt; if (bt > 0.15) { const r = ((p.slot * 7919 + Math.floor(time * 3)) % 97) / 97; p.blinkAt = time + 2 + 4 * r; }
      f.blink = bt >= 0 && bt < 0.15 ? Math.sin((bt / 0.15) * Math.PI) : anim === 'sleep' ? 1 : 0;
      if (!f.look) { f.eyeYaw = 0.12 * Math.sin(time * 0.7 + p.slot) * (Math.sin(time * 0.23 + p.slot * 3) > 0.3 ? 1 : 0); f.eyePitch = 0.05 * Math.sin(time * 0.5 + p.slot * 1.7); }
      // jaw: speaking (addressed), talking, eating
      const talking = time < p.speakUntil || anim === 'talk';
      if (talking) f.jaw = Math.max(0, 0.15 * Math.abs(Math.sin(time * 10.5 + p.slot)) * (0.6 + 0.4 * Math.sin(time * 3.1 + p.slot)) - (anim === 'talk' && Math.sin(time * 0.8 + p.slot) < 0 ? 0.1 : 0));
      if (anim === 'eat') f.jaw = 0.06 * (0.5 + 0.5 * Math.sin(time * 9 + p.slot));
    } else f.blink = anim === 'sleep' ? 1 : 0;
    // hands: grip what they hold
    p.rig.grip = propKind === 'spear' || propKind === 'mallet' || propKind === 'jar' ? [0.15, 1] : propKind === 'basket' ? [0.8, 0.8] : propKind === 'tablet' ? [0.6, 0.3] : propKind === 'sack' ? [0.1, 0.7] : anim === 'guard' || anim === 'guard_walk' ? [0.5, 1] : [0, 0];
    p.rig.pose = po; p.rig.plant = PLANTED.has(anim); p.rig.seat = SEATED.has(anim);
    const o = p.slot * PALETTE_STRIDE;
    g.prevPalette.set(g.palette.subarray(o, o + PALETTE_STRIDE), o);
    this.rigS.setPose(p.rig); this.rigS.solve(p.rig, g.palette, o);
    if (p.poseFrame < 0) g.prevPalette.set(g.palette.subarray(o, o + PALETTE_STRIDE), o);
    p.poseFrame = this.frame;
    p.prop = propKind; if (propKind) this.propLocal(p, propKind);
  }
  /** a world point in the person's character space (inverse of the instance root: translate, yaw about +Y, scale).
   *  The rig solves in character space, so gaze targets must be given there (world targets aimed the eyes wrongly). */
  private toChar(p: Person, w: ArrayLike<number>) {
    const dx = w[0] - p.root[0], dy = w[1] - p.root[1], dz = w[2] - p.root[2], c = Math.cos(p.root[3]), s = Math.sin(p.root[3]), k = 1 / p.look.scale, o = p.lookC;
    o[0] = (c * dx - s * dz) * k; o[1] = dy * k; o[2] = (s * dx + c * dz) * k; return o;
  }
  private asideCache = new Map<string, number>();
  private asideBits(dress: Dress, anim: AnimId) {
    const k = dress + (anim === 'sleep' ? ':s' : ''); let b = this.asideCache.get(k);
    if (b === undefined) { b = 0; for (const id of ['kandys', 'quiver', 'bow', 'gorytos', 'akinaka', ...(anim === 'sleep' ? ['hat_fluted', 'fillet', 'cap_soft', 'headband'] : [])]) { const bit = pieceBit(dress, id); if (bit) b |= 1 << bit; } this.asideCache.set(k, b); }
    return b;
  }
  /** people culled from view still make their tool sounds */
  private soundsOnly(p: Person, d: number, time: number) {
    const a = p.agent!; if (d > 60) return; const perf = this.sim!.performance(a); const P = ACTIVITIES[perf.act]; if (!P.sound) return;
    const po = pose(P.anim, time + a.seed % 100, a.gait, (a.seed % 1000) / 159);
    if (po.hit && !p.lastHit) this.onHit?.(P.sound, new THREE.Vector3(p.root[0], p.root[1], p.root[2])); p.lastHit = !!po.hit;
  }
  /** prop transform in character space (from the solved bones; composed with the root when drawn) */
  private propLocal(p: Person, k: string) {
    const R = this.rigS, J = (b: number) => new THREE.Vector3(R.wt[b * 3], R.wt[b * 3 + 1], R.wt[b * 3 + 2]);
    const palm = (s: 'l' | 'r') => J(HB[`hand_${s}`]).lerp(J(HB[`middle_01_${s}`]), 0.75);
    const M = p.propM; const s = p.look.scale;
    const rotOf = (b: number) => { const w = R.wr, o = b * 9; return new THREE.Matrix4().set(w[o], w[o + 1], w[o + 2], 0, w[o + 3], w[o + 4], w[o + 5], 0, w[o + 6], w[o + 7], w[o + 8], 0, 0, 0, 0, 1); };
    let pos: THREE.Vector3, rot = new THREE.Matrix4(), sc = 1;
    switch (k) {
      case 'spear': { const h = palm('r'); pos = new THREE.Vector3(h.x, 0, h.z).multiplyScalar(s); pos.y = 0; break; } // upright, butt on the ground by the right hand
      case 'sack': { const h = J(HB.upperarm_r); pos = h.multiplyScalar(s).add(new THREE.Vector3(0.02, 0.13, -0.02)); rot.makeRotationZ(0.3); break; }
      case 'jar': { const h = palm('r'); pos = h.multiplyScalar(s).add(new THREE.Vector3(0, -0.45, 0.08)); break; }
      case 'jar_head': { const h = J(HB.head); pos = h.multiplyScalar(s).add(new THREE.Vector3(0, 0.25, 0.02)); sc = 0.8; break; }
      case 'tablet': { const h = palm('l'); pos = h.multiplyScalar(s).add(new THREE.Vector3(0, 0.02, 0.03)); break; }
      case 'mallet': { pos = palm('r').multiplyScalar(s); rot = rotOf(HB.hand_r); break; }
      case 'basket': default: { const h = palm('l').add(palm('r')).multiplyScalar(0.5 * s); pos = h.add(new THREE.Vector3(0, 0.05, 0)); break; }
    }
    M.compose(pos, new THREE.Quaternion().setFromRotationMatrix(rot), new THREE.Vector3(sc, sc, sc));
  }
  private placeProp(p: Person) {
    const k = (p.prop === 'jar_head' ? 'jar' : p.prop!) as typeof PROP_KINDS[number]; const ki = PROP_KINDS.indexOf(k); const im = this.carried;
    if (ki < 0 || im.count >= CARRIED_MAX) return;
    _m.makeRotationY(p.root[3]).setPosition(p.root[0], p.root[1], p.root[2]).multiply(p.propM);
    this.carriedKind.array[im.count] = ki; im.setMatrixAt(im.count++, _m);
  }
  // ------------------------------------------------------------------------------------------------ hits (overlay, pick)
  private raycast(rc: THREE.Raycaster, out: THREE.Intersection[]) {
    const ray = rc.ray;
    for (const p of this.persons.values()) {
      if (!p.shown || p.drawnFrame !== this.frame) continue;
      const h = p.look.stature, r = 0.28 * p.look.scale; const base = _v.set(p.root[0], p.root[1], p.root[2]);
      // vertical capsule as a stack of spheres (cheap and good enough for picking)
      let best = Infinity;
      for (let y = r; y <= h - r + 1e-6; y += r) { const c = _v2.copy(base).setY(base.y + y); const t = ray.intersectSphere(_s.set(c, r), _v3); if (t) best = Math.min(best, ray.origin.distanceTo(t)); }
      if (best < rc.far && best > rc.near) {
        const proxy = new THREE.Mesh(); proxy.name = `person:${p.agent ? p.agent.id : p.key}`;
        const who = p.agent ? `${p.agent.name ?? 'unnamed'} (${p.agent.role}, ${p.agent.origin})` : `extra ${p.key}`;
        const act = p.act ? `; doing ${p.act}${p.actPlaceholder ? ' — PLACEHOLDER: no performance for this activity (abstract-only), a standing pose is shown' : ''}` : '';
        proxy.userData = { tier: 'C', src: 'RECON', placeholder: p.actPlaceholder, note: `${who}; ${p.look.dress} dress${act}; ${p.look.note}` };
        out.push({ distance: best, point: ray.at(best, new THREE.Vector3()), object: proxy } as THREE.Intersection);
      }
    }
  }
  /** draw calls and triangles the crowd submits this frame (main pass; shadow passes repeat some of them) */
  stats() { const s = this.humans.gpu.stats(); const propDraws = this.carried.count ? 1 : 0;
    let placeholderActs = 0; for (const p of this.persons.values()) if (p.actPlaceholder && p.drawnFrame === this.frame) placeholderActs++;
    return { ...s, propDraws, props: this.carried.count, placeholderActs, perf: { ...this.perf } }; }
  /** evidence notes for the pieces a person wears (tests, overlay) */
  static pieceNotes(look: PersonLook) { return look.pieces.map(id => ({ ...PIECES[id], id })); }
}
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _s = new THREE.Sphere(), _m = new THREE.Matrix4();
