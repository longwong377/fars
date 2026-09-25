// Crowd renderer (D-090, D-093): renders the simulation's people with the MakeHuman-derived bodies in period dress.
//
// Pooling: without a population view the pool is fed by the simulation's `visibleAgents(centre, ATTACH_R, POOL_MAX)` (the
// detailed agents on the Terrace, nearest first, capped; D-024). With one (popview.ts, D-143) the candidates are every
// detailed agent on the map and everyone of the population out of doors within IMP_R (and the detailed agents off the
// Terrace, where the view places them): the nearest POOL_MAX are attached (people out of view ranked OUT_OF_VIEW farther;
// a margin before anyone is dropped), the rest are drawn as impostors (impostors.ts), in the same place, colours and
// activity. Attaching gives a person a palette slot and writes
// their look (looks.ts; deterministic from their seed, so a person looks the same every time). Cost scales with the
// people near the camera, not with the population.
// `attach()`/`detach()` are public so a future dynamic roster can drive the pool itself (autoPool = false).
//
// LOD per frame: full detail (the 30k-triangle close-up body with fingers, eyes, mouth, lashes) within LOD_DIST[0]
// for up to MAX_FULL people, nearest first; the mid body to LOD_DIST[1]; the far body to LOD_DIST[2] (and for those
// within it beyond the caps); the far body simplified to a fifth (meshoptimizer) to LOD_DIST[3] (when the simplifier ran; otherwise the far body); impostors beyond
// it and beyond the pool (one instanced draw, impostors.ts). Each costume × LOD is one instanced draw (humanGPU.ts). Poses are refreshed every frame near the
// camera and less often further away; root motion is per frame for everyone (instanced root attribute).
// Face: blinks, the jaw while speaking, eating or singing, eyes and head turned to a nearby stranger.
// Playing (D-200): the music director has a performer play or sing (setPlaying): the playing performance (playing.ts) is
// given in place of the plan's for as long as it is kept alive, and a singer's jaw and breath follow the piece's notes.
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, float, abs, min, max, mix, step } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { surfaceMaterial } from '../render/materials';
import { pose, type Pose } from './anim';
import { ACTIVITIES, performanceFor, type ActivityId, type Performance, type WorkSpec, type Performer } from './activities';
import { PeopleSim, PLACES, type Agent } from './sim';
import type { HumanSystem } from './humans';
import { RigSolver, PALETTE_STRIDE, PLANTED, type RigInput, type FaceState } from './humanRig';
import { lookFor, wearTexel, type PersonLook, type LookInput } from './looks';
import { HB } from './humanFormat';
import { PERSON_TEXELS, FLAG_HIDE_HEAD } from './humanMaterial';
import { nearCascadesOnly } from './humanGPU';
import { propGeometry, propUnionGeometry, paintedBox, PROP_NOTES, PROPS, PROP_CLASSES, propSlot, placeProp, interleave, BABE_CLASS } from './props';
import { babeKind, babeLength, holdBabe, holdHand, placeBabe, tintFor, BABE_NOTES, type BabeMode } from './babes';
import { h32, salt } from './hash';
import { PLAYING, singFace, type PlayKind } from './playing';
import { PIECES, pieceBit, COSTUME_OF, weatherMask, type Dress } from './outfits';
import { WORK_META, workRoot, ploughPath, THRESH_TURN_S, type WorkAnim } from './workAnims';
import { IK_Q } from './poseKit';
import { WorkObjects, WORK_NOTES, type WorkKind } from './workObjects';
import { Animals, animalsFor, ANIMAL_BUILD, grazeReach, mountSeat, riderLift, type Species } from './animals';
import type { PopView, ViewPerson } from './popview';
import { CrowdImpostors, rowOf, frameOf } from './impostors';
import type { AnimId } from './anim';
/** poses in which people sit, kneel or lie (the seat pass rests them on the ground; coats and back-carried weapons are
 *  laid aside) */
const SEATED = new Set<AnimId>(['sit', 'write', 'eat', 'dice', 'sleep', 'grind', 'knead', 'bake', ...(Object.keys(WORK_META) as WorkAnim[]).filter(k => WORK_META[k].ground === 'seat')]);
/** crouched work (squatting at the mould, the hearth, the kiln): feet planted, but coats and weapons laid aside too */
const ASIDE = new Set<AnimId>([...SEATED, ...(Object.keys(WORK_META) as WorkAnim[]).filter(k => WORK_META[k].aside)]);
/** cycles that move the performer's root along a path of their own (the furrow, turning with the threshing team) */
const PATHED = new Set<AnimId>((Object.keys(WORK_META) as WorkAnim[]).filter(k => WORK_META[k].path));
/** an activity's performances: the base and its variants (a variant's unset fields are the base's) */
const perfsOf = (P: Performance): Partial<Performance>[] => [P, ...(P.variants ?? []).map(v => ({ ...P, ...v }))];
/** activities some performance of which has a work object shared by the performers of a place or a group (the threshing
 *  floor, the drum on its sledge, the bier), has work objects or animals, or moves the performer along a path of its own */
const SHARED_ACTS = new Set<string>(Object.entries(ACTIVITIES).filter(([, P]) => perfsOf(P).some(v => v.work?.some(w => w.shared))).map(([k]) => k));
const THINGS_ACTS = new Set<string>(Object.entries(ACTIVITIES).filter(([, P]) => perfsOf(P).some(v => v.work?.length || v.animals)).map(([k]) => k));
const PATH_ACTS = new Set<string>(Object.entries(ACTIVITIES).filter(([, P]) => perfsOf(P).some(v => v.anim && PATHED.has(v.anim))).map(([k]) => k));
/** the gait phase (rad/s) of a moving performance given at a standing spot of the plan: the bearers' 1.5 h at the burial
 *  ground, a guard's round at his post (the plans do not route them yet: Q-196). They walk in place at the pace the
 *  performance sheet's extras use (time × 4.2, about 0.96 m/s), not frozen mid-stride */
export const IN_PLACE_RATE = 4.2;
/** the farthest a cycle's own path takes the performer from the view's spot (m): the ploughman at the furrow's end
 *  (workAnims FURROW: 8 m + the headland turn), for the population's collision capsules (world.ts) */
export const PATH_REACH = 9;

const gw = (e: number, n: number, y: number) => new THREE.Vector3(e, y, -n);
/** |(x, y, z)|: Math.hypot costs ~100 ns a call in node 22 against ~20 ns for this, and the pool and the impostors take
 *  one per candidate each frame (~7,000 in the busiest views; session 6) */
const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);
const rad = (deg: number) => (deg * Math.PI) / 180;
/** world yaw for a grid heading (deg clockwise from grid north); the rig faces +Z in bind pose */
export const yawOf = (headingDeg: number) => Math.PI - rad(headingDeg);
/** LOD distances (m): full detail, mid, far, farthest (impostors beyond, D-143). The farthest body (0.5k triangles, a fifth
 *  of the far body) from 90 m, where a person is under 15 px tall at 1080p: with the whole population drawn, the far body
 *  (2.5k) to 200 m cost 1.1 M triangles in a hillside view of the Terrace (444 people at 90-200 m), 0.2 M this way (D-143) */
export const LOD_DIST = [25, 90, 90, 600] as const;
/** impostors are drawn to this distance (m): the Terrace, the town and the nearer villages from anywhere on them */
export const IMP_R = 5000;
/** an attached person is kept until their rank by distance passes POOL_MAX + POOL_HYST (no attach/detach flicker) */
export const POOL_HYST = 48;
/** looks computed per frame for people first seen as impostors (lookFor is ~10-40 µs) */
export const LOOKS_PER_FRAME = 300;
/** a person out of view ranks this much farther for the pool (m) */
export const OUT_OF_VIEW = 400;
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
/** carried props drawn per frame (per prop class: one instanced mesh each). Two slots for everyone the pool can hold
 *  (POOL_MAX + POOL_HYST since D-143; 256 dropped the farthest people's props once the population was drawn) and room
 *  for extras; a prop over the cap is counted (stats().propsDropped), never silently dropped */
export const CARRIED_MAX = 2 * (POOL_MAX + POOL_HYST) + 128;
/** work objects and animals are placed for performers within this distance (m); beyond, a person is a speck */
export const THINGS_DIST = 400;
/** a flock bleats about once every BLEAT_S seconds when the listener is within 60 m (C) */
const BLEAT_S = 7;
/** D-210: the working animals' voices (C): a donkey or mule of a performance brays about once every BRAY_S seconds within
 *  150 m; a flock's dog barks about once every BARK_S seconds within 90 m, and every few seconds at a stranger (the listener)
 *  within 20 m; hens cluck within 40 m */
const BRAY_S = 75, BARK_S = 45, BRAYERS = new Set<Species>(['donkey', 'donkey_pack', 'mule', 'mule_pack']);

export interface Person {
  key: string; agent: Agent | null; look: PersonLook; slot: number; rig: RigInput; face: FaceState;
  root: [number, number, number, number]; prevRoot: [number, number, number, number];
  shown: boolean; drawnFrame: number; poseFrame: number; frameMod: number; lastHit: boolean;
  blinkAt: number; speakUntil: number; prop: string | null; propM: THREE.Matrix4; anim: AnimId; t0: number; dist: number;
  /** the second prop (the other hand's thing) and the props' instance parameters (bow draw, spindle drop) */
  prop2: string | null; propM2: THREE.Matrix4; ip: [number, number];
  /** the performance being given (activities.ts performanceFor), the time and seed its cycle runs on */
  perf: Performance | null; why: string; animT: number; animK: number;
  /** the simulation's spot (root before the cycle's own path) and the path offset in effect [dx, dz, dyaw] */
  base: [number, number, number, number]; path: [number, number, number] | null;
  /** piece mask in effect (the look's mask minus what is laid aside while seated or asleep) */
  mask: number;
  /** gaze target in character space (the rig's space: the root is applied per instance on the GPU) */
  lookC: [number, number, number];
  /** the activity performed now, and whether it is a PLACEHOLDER (abstract-only activities have no performance; if one
   *  ever reaches a rendered person the dev overlay says so instead of showing a made-up loop) */
  act: string; actPlaceholder: boolean;
  /** when the greeting nod started (−1: not greeted on this approach) */
  nodAt: number;
  /** extras (lineups, tests): fixed animation and place, or an activity performed (with its props, work objects and
   *  animals); `group` joins extras sharing an object (the bearers of one bier) */
  extra?: { anim: AnimId; x: number; y: number; z: number; yaw: number; look?: [number, number, number] | null; act?: ActivityId; why?: string; group?: string; variant?: number };
  /** the population person (D-143; -1 for extras), the view's data for them this frame (population people, and detailed
   *  agents off the Terrace), and their walking phase */
  pid: number; vp: ViewPerson | null; vpFrame: number; gaitPh: number;
  /** the LOD drawn with in the last frame */
  lod?: number;
  /** D-215: the children carried or put down beside this person now (prop kind, transform in character space, skin tint) */
  babeProps?: { kind: string; M: THREE.Matrix4; tint: number; mode: string }[];
}
/** a person drawn as an impostor: their cached look (packed colours, dress row, stature scale) */
interface ImpLook { packed: Float32Array; dress: Dress; scale: number; seed: number }

/** a block of limestone being dressed (D-217, C): 1.4 × 0.75 × 0.9 m on the ground; the sides and ends quarry-rough (each
 *  face bulged out by up to 3 cm and uneven by ~1 cm, the arrises knocked back), the top dressed flat. Position and normal only */
export function masonBlock(seed: number): THREE.BufferGeometry {
  const W = 1.4, H = 0.75, D = 0.9, g = new THREE.BoxGeometry(W, H, D, 6, 4, 4).translate(0, H / 2, 0), p = g.getAttribute('position') as THREE.BufferAttribute;
  const h = (x: number, y: number, z: number) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 0.618) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ux = x / (W / 2), uz = z / (D / 2), uy = y / H, top = uy > 0.999, edge = Math.max(Math.abs(ux), Math.abs(uz)) > 0.999;
    if (top) continue; // the dressed top
    const bulge = 0.03 * (1 - Math.max(Math.abs(ux) > 0.999 ? 0 : ux * ux, Math.abs(uz) > 0.999 ? 0 : uz * uz)) * (1 - (2 * uy - 1) ** 2) + 0.01 * (h(x, y, z) - 0.5);
    const out = edge ? bulge : 0; if (Math.abs(ux) > 0.999) p.setX(i, x + Math.sign(x) * out); if (Math.abs(uz) > 0.999) p.setZ(i, z + Math.sign(z) * out); }
  g.deleteAttribute('uv'); g.computeVertexNormals(); return mergeGeometries([g.toNonIndexed()])!;
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
  /** carried props: one instanced mesh per prop class (props.ts PROP_CLASSES: small things, long tools), each over the
   *  class's union geometry; 'ik' picks the kind per instance, 'ip' is the kind's parameter (bow draw, spindle drop) */
  private carried: { mesh: THREE.InstancedMesh; data: THREE.InterleavedBuffer; kind: THREE.InterleavedBufferAttribute; param: THREE.InterleavedBufferAttribute; axes: THREE.InterleavedBufferAttribute[] }[] = [];
  /** the things at the place of work and the animals the work needs (D-142), placed from the performers every frame */
  readonly things: WorkObjects; readonly animals: Animals;
  private frustum = new THREE.Frustum(); private wide = new THREE.Frustum(); private pm = new THREE.Matrix4();
  private lastStock = { depot: -1, store: -1 };
  /** last frame's CPU cost (ms) of pooling, posing and instance filling; people drawn per LOD */
  readonly perf = { ms: 0, poseMs: 0, posed: 0, drawn: [0, 0, 0, 0], attached: 0 };
  private hitProxy: THREE.Mesh; private list: Person[] = [];
  /** the population view (world.ts sets it, D-143): with it the pool draws the population, not only the detailed agents */
  view: PopView | null = null;
  /** impostors beyond the pool (set when the atlas is baked) */
  imp: CrowdImpostors | null = null;
  private byPid = new Map<number, Person>(); private impLooks = new Map<number, ImpLook>();
  private impList: { vp: ViewPerson | null; a: Agent | null; d: number; x: number; y: number; z: number; yaw: number }[] = []; private nImp = 0;
  /** impostors and the pool feeding this frame (stats) */
  readonly impPerf = { drawn: 0, candidates: 0, looksPending: 0, poolCands: 0, popins: 0, doorEntries: 0, walking: 0, placeholders: 0, walled: 0, bands: [0, 0, 0, 0] as number[], feedMs: 0, impMs: 0 };
  /** the walled plot the camera is in (PopGeo.plotAt; 0 none) */
  private camPlot = 0;
  /** camera rig only (__parsa.view): people within this distance of the lens are not drawn (0 = off, the player's camera) */
  rigClear = 0;
  /** D-220: dust from the people drawn this frame (world/dust.ts): called for a walker (kind 'walk'), a mason dressing stone
   *  ('mason') and a hauling gang's man ('haul') with the world position, yaw, speed (m/s) and a stable seed */
  dustTap: ((kind: 'walk' | 'mason' | 'haul', x: number, y: number, z: number, yaw: number, speed: number, seed: number) => void) | null = null;
  private tapDust(act: string, moving: boolean, x: number, y: number, z: number, yaw: number, speed: number, seed: number, mounted: boolean) {
    const T = this.dustTap; if (!T) return;
    if (act === 'dress_stone') T('mason', x, y, z, yaw, 0, seed);
    else if (act === 'haul') { if (seed % 3 === 0) T('haul', x, y, z, yaw, 0, seed); } // (one in three of the gang: the sledge is shared)
    else if (moving && !mounted) T('walk', x, y, z, yaw, speed, seed); // (a rider's dust is the mount's: Animals.onPush)
  }
  /** hidden behind the walls of the court or yard they stand in, from a camera outside it and below the wall tops */
  private walledOff(vp: ViewPerson, camY: number) { return vp.wall > 0 && vp.plot !== this.camPlot && camY < vp.y + vp.wall - 0.3; }
  private camAt = new THREE.Vector3();
  /** `sim` null: a crowd of extras only (the human lab page, tests) */
  constructor(readonly sim: PeopleSim | null, readonly seed: number, readonly humans: HumanSystem) {
    this.group.name = 'people';
    this.group.add(humans.gpu.group);
    this.rigS = new RigSolver(humans.A.meta.curlAxes);
    this.buildPropMeshes();
    if (sim) this.buildWorkObjects(); else this.autoPool = false;
    const wm = this.propMaterial().clone(); wm.side = THREE.DoubleSide; // open baskets and tubs are seen from above
    this.things = new WorkObjects(wm); this.group.add(this.things.group);
    this.animals = new Animals(); this.group.add(this.animals.group);
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
    PROP_CLASSES.forEach((kinds, c) => {
      const g = propUnionGeometry(c);
      // per instance, in one interleaved buffer (WebGPU's 8 vertex buffers): the kind 'ik', its parameter 'ip', and the
      // instance's axes (its matrix's rotation columns). three.js applies the instance matrix to positionLocal before the
      // positionNode, so the per-vertex displacement (stated in the prop's own frame) is turned by these axes first
      const data = interleave(g, ['ik', 'ip', 'aRx', 'aRy', 'aRz'], { count: CARRIED_MAX, sizes: [1, 1, 3, 3, 3] }); data.setUsage(THREE.DynamicDrawUsage);
      const at = (n: string) => g.getAttribute(n) as THREE.InterleavedBufferAttribute, ik = at('ik'), ip = at('ip'), ax = [at('aRx'), at('aRy'), at('aRz')];
      const m = new THREE.MeshStandardNodeMaterial(); const mr = attribute('mr', 'vec2');
      m.colorNode = attribute('color', 'vec3'); m.metalnessNode = mr.x; m.roughnessNode = mr.y;
      // D-215: the carried children's skin (metalness −1 in the geometry) tinted by the instance parameter (the carer's tone)
      if (c === BABE_CLASS) { m.colorNode = attribute('color', 'vec3').mul(mix(float(1), attribute('ip', 'float'), float(1).sub(step(-0.5, mr.x)))); m.metalnessNode = max(mr.x, 0); }
      // the instance's own kind only: other kinds' vertices collapse to a point (arithmetic mask, no select: D-012); the
      // instance parameter moves the vertices that carry a displacement (the bowstring's middle, the spindle on its yarn)
      const sv = attribute('sv', 'vec3').mul(attribute('ip', 'float'));
      m.positionNode = positionLocal.add(attribute('aRx', 'vec3').mul(sv.x)).add(attribute('aRy', 'vec3').mul(sv.y)).add(attribute('aRz', 'vec3').mul(sv.z)).mul(float(1).sub(min(abs(attribute('pk', 'float').sub(attribute('ik', 'float'))), 1)));
      const im = new THREE.InstancedMesh(g, m, CARRIED_MAX); im.count = 0; im.visible = false; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.name = c === 0 ? 'props:carried' : c === BABE_CLASS ? 'props:children' : 'props:tools'; im.raycast = () => {}; // all kinds are in every instance on the CPU side
      im.userData = { tier: 'C', src: 'RECON', note: 'carried: ' + kinds.map(k => `${k} (${PROP_NOTES[k].tier}): ${PROP_NOTES[k].note}`).join('; ') };
      this.group.add(im); this.carried.push({ mesh: im, data, kind: ik, param: ip, axes: ax }); nearCascadesOnly(im);
    });
  }
  /** blocks at the masons' places, querns, mats, the trough (C forms): static, merged into one mesh (one draw) */
  private buildWorkObjects() {
    const stone: [number, number, number] = [0.553, 0.541, 0.518], clay: [number, number, number] = [0.486, 0.416, 0.333], reed: [number, number, number] = [0.627, 0.557, 0.384];
    const parts: THREE.BufferGeometry[] = []; const q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), M = new THREE.Matrix4();
    const put = (g: THREE.BufferGeometry, items: [THREE.Vector3, number][]) => { for (const [p, yaw] of items) { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw); parts.push(g.clone().applyMatrix4(M.compose(p, q, one))); } };
    const sim = this.sim!, nav = sim.nav;
    // the masons' blocks (D-217; rubric s7 pass 2, R8: "two dark grey boxes" in hall100-site): drawn as flat vertex-coloured
    // boxes in the props' material, they read as untextured placeholders. Now a block of the Terrace limestone as it comes
    // from the quarry and is being worked (the stone of the yard's rough drums, construction.ts): its faces bulged and
    // uneven by a few cm, the top being dressed flat; its own mesh (one draw)
    const masons = sim.agents.filter(a => a.role === 'mason'), blocks: THREE.BufferGeometry[] = [];
    for (const a of masons) { const e = a.slot[0], n = a.slot[1] + 0.95; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.1 * Math.sin(a.id)); blocks.push(masonBlock(a.id).applyMatrix4(M.compose(gw(e, n, nav.heightAt(e, n) || 0), q, one))); }
    if (blocks.length) { const bm = new THREE.Mesh(mergeGeometries(blocks)!, surfaceMaterial('rubble')); bm.castShadow = bm.receiveShadow = true; bm.name = 'work:blocks';
      bm.userData = { tier: 'C', src: 'RECON', placeholder: false, note: 'limestone blocks being dressed at the masons\' places, 1.4 × 0.75 × 0.9 m, quarry-rough with the top dressed (construction in 467 B; block size and working C; D-217)' };
      this.group.add(bm); nearCascadesOnly(bm); }
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
    const w = look.wear; // D-189: each garment's fading susceptibility in its colour texel's w; texel 9 the wear
    D.set([...c.skin, look.stubble], o + 4); D.set([...c.main, w?.k[0] ?? 0], o + 8); D.set([...c.second, w?.k[1] ?? 0], o + 12); D.set([...c.trim, w?.k[2] ?? 0], o + 16);
    D.set([...c.hair, 0], o + 20); D.set([...c.leather, 0], o + 24); D.set([look.grimeLevel, look.scale, w?.hat ?? 0, flags], o + 28); D.set([...c.felt, 0], o + 32);
    D.set(w ? wearTexel(w) : [0, 0, 0, 0], o + 36);
    this.humans.gpu.markPersonDirty();
  }
  private newPerson(key: string, agent: Agent | null, look: PersonLook, seed: number): Person {
    const slot = this.allocSlot(); this.writePerson(slot, look);
    const v = this.humans.A.variants[look.variant];
    const face: FaceState = { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 };
    const p: Person = { key, agent, look, slot, face, rig: { joints: v.joints, pose: { rot: {}, hips: [0, 0, 0] }, face, grip: [0, 0], x: 0, y: 0, z: 0, yaw: 0, scale: 1 },
      root: [0, 0, 0, 0], prevRoot: [0, 0, 0, 0], shown: false, drawnFrame: -10, poseFrame: -10, frameMod: seed % 8, lastHit: false,
      blinkAt: (seed % 997) / 997 * 4, speakUntil: -1, prop: null, propM: new THREE.Matrix4(), anim: 'idle', t0: (seed % 100), dist: 0, mask: look.mask, lookC: [0, 0, 0], act: '', actPlaceholder: false, nodAt: -1,
      prop2: null, propM2: new THREE.Matrix4(), ip: [0, 0], perf: null, why: '', animT: seed % 100, animK: (seed % 1000) / 159, base: [0, 0, 0, 0], path: null,
      pid: agent ? agent.pid : -1, vp: null, vpFrame: -10, gaitPh: (seed % 628) / 100 };
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
  detach(a: Agent | string) { const p = typeof a === 'string' ? this.persons.get(a) : this.byAgent.get(a.id); if (!p) return; this.freeSlot(p.slot); this.persons.delete(p.key); if (p.agent) this.byAgent.delete(p.agent.id); else if (p.pid >= 0) this.byPid.delete(p.pid); }
  /** attach a person of the population (D-143): their look from the view (a detailed agent keeps its own); idempotent */
  attachPop(pid: number): Person {
    const hit = this.byPid.get(pid); if (hit) return hit;
    const inp = this.view!.lookInput(pid), look = lookFor(this.humans.A, inp, this.seed), h = this.view!.childStature(pid);
    if (h) { const v = this.humans.A.variants[look.variant]; look.scale = h / v.height; look.stature = h; } // a child's size by age (C)
    const p = this.newPerson(`p${pid}`, null, look, inp.seed); p.pid = pid; this.byPid.set(pid, p); return p;
  }
  /** an extra person not driven by the simulation (test lineups, the performance sheet): fixed place, yaw and animation,
   *  or an activity (`act`, with the plan's reason `why`) performed with its props, work objects and animals */
  addExtra(key: string, spec: LookInput & { x: number; y: number; z: number; yaw: number; anim?: AnimId; look?: [number, number, number] | null; act?: ActivityId; why?: string; group?: string; variant?: number }) {
    const old = this.persons.get(key); if (old) { this.freeSlot(old.slot); this.persons.delete(key); }
    const look = lookFor(this.humans.A, spec, this.seed);
    const p = this.newPerson(key, null, look, spec.seed); p.extra = { anim: spec.anim ?? 'idle', x: spec.x, y: spec.y, z: spec.z, yaw: spec.yaw, look: spec.look ?? null, act: spec.act, why: spec.why, group: spec.group, variant: spec.variant };
    if (!spec.act) p.animK = 0.3; // the Phase 3 lineups' fixed seed
    return p;
  }
  /** D-210: move an extra (a driver or a rider of world/traffic.ts) and change what it does, keeping its look; false when
   *  there is no such extra */
  moveExtra(key: string, x: number, y: number, z: number, yaw: number, act?: ActivityId, why?: string): boolean {
    const p = this.persons.get(key); if (!p?.extra) return false; const e = p.extra; e.x = x; e.y = y; e.z = z; e.yaw = yaw; if (act) e.act = act; if (why !== undefined) e.why = why; return true; }
  /** remove the extras only (the pool's population people, attached by feedPool and indexed by pid, stay: D-143) */
  removeExtras() { for (const [k, p] of this.persons) if (p.extra) { this.freeSlot(p.slot); this.persons.delete(k); } }
  /** a person is speaking (address → speech line): the jaw moves for `seconds` */
  speaking(agentId: number, seconds: number, now: number) { const p = this.byAgent.get(agentId); if (p) p.speakUntil = now + seconds; }
  /** who plays or sings now (D-200), by person key (a detailed agent `a<id>`, a person of the population `p<pid>`, an
   *  extra by its own key): kept by the key, so a performer attached while the piece plays is shown playing at once */
  private plays = new Map<string, { kind: PlayKind; until: number; song: Float32Array | null; t0: number; open: number }>();
  /** the key of a performer (the music director names them by agent, population id or extra key) */
  static keyOf(who: { agentId?: number; pid?: number; extra?: string }) { return who.extra ?? (who.agentId != null ? `a${who.agentId}` : `p${who.pid}`); }
  /** a performer plays or sings for `seconds` from `now` (kept alive by calling again). `notes`: the sung notes of a piece
   *  starting now, as [start, end] pairs (s): the jaw and the breath follow them (playing.ts singFace) */
  setPlaying(key: string, kind: PlayKind, seconds: number, now: number, notes?: ArrayLike<number>) {
    let pl = this.plays.get(key); if (!pl || pl.kind !== kind) { pl = { kind, until: 0, song: null, t0: now, open: 0.14 }; this.plays.set(key, pl); }
    pl.until = now + seconds;
    if (notes) { pl.song = Float32Array.from(notes); pl.t0 = now; let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0; pl.open = 0.11 + 0.05 * (((h >>> 0) % 97) / 97); }
  }
  /** what a person is playing now (dev overlay, tests), or null */
  playingOf(key: string): PlayKind | null { const pl = this.plays.get(key); return pl && this.now < pl.until ? pl.kind : null; }
  private now = 0;
  /** agents that were off the map (in the town) at the last update: coming on the map within 50 m in view is a pop-in
   *  (§13.8), as in the Phase 3 crowd; attaching or changing LOD at a distance is not */
  private visPrev = new Set<number>(); private visNow = new Set<number>(); private poolPrimed = false;
  /** the pool fed by the detailed agents and the population view (D-143): everyone out of doors within IMP_R is a
   *  candidate; the nearest POOL_MAX are attached (an attached person stays until their rank passes POOL_MAX + POOL_HYST
   *  or they are beyond DETACH_R or gone indoors), the rest are drawn as impostors. Pop-in probe (§13.8): a person who is
   *  a candidate within 50 m in view and was none in the last frame, unless they came out through a door (entry 1). */
  private seenPrev = new Set<number>(); private seenNow = new Set<number>(); private cands: { d: number; a: Agent | null; vp: ViewPerson | null; id: number; rank: number }[] = []; private vpBuf: ViewPerson[] = [];
  private feedPool(cam: THREE.Vector3, camera?: THREE.Camera) {
    const sim = this.sim!, view = this.view!, cx = cam.x, cn = -cam.z; let nc = 0;
    if (view.jumps !== this.viewJumps) { this.viewJumps = view.jumps; this.resetPopinProbe(); } // a jump in time
    const cand = (d: number, a: Agent | null, vp: ViewPerson | null, id: number) => { let c = this.cands[nc]; if (!c) this.cands[nc] = c = { d, a, vp, id, rank: d }; else { c.d = d; c.a = a; c.vp = vp; c.id = id; c.rank = d; } nc++; };
    // every detailed agent on the map within the impostor range (beyond ATTACH_R they are impostors: the Terrace seen
    // from the town)
    for (const a of sim.visibleAgents([cx, cn], IMP_R)) cand(len3(a.pos[0] - cx, a.y + 1 - cam.y, a.pos[1] - cn), a, null, a.id);
    for (const o of view.query([cx, cn], IMP_R, this.vpBuf)) { const a = o.agent >= 0 ? sim.agents[o.agent] : null; if (a && !a.offmap) continue; cand(len3(o.e - cx, o.y + 1 - cam.y, o.n - cn), a, o, a ? a.id : 1e7 + o.pid); }
    const C = this.cands; C.length = Math.max(C.length, nc); const order = this.orderBuf.length >= nc ? this.orderBuf : (this.orderBuf = new Int32Array(Math.max(1024, nc * 2)));
    // rank: distance, people out of view counted OUT_OF_VIEW m farther (the pool's bodies go to the people seen; the
    // nearest behind the camera keep theirs, so turning round finds them drawn)
    let np = 0; for (let i = 0; i < nc; i++) { const c = C[i]; if (c.d >= DETACH_R) continue; order[np++] = i;
      const x = c.vp ? c.vp.e : c.a!.pos[0], y = c.vp ? c.vp.y : c.a!.y, z = c.vp ? -c.vp.n : -c.a!.pos[1];
      c.rank = (!camera || this.wide.intersectsSphere(_s.set(_v.set(x, y + 0.9, z), 1.3))) && !(c.vp && this.walledOff(c.vp, cam.y)) ? c.d : c.d + OUT_OF_VIEW; }
    const ix = Array.from(order.subarray(0, np)).sort((x, y) => C[x].rank - C[y].rank); this.impPerf.poolCands = np;
    // attach the nearest POOL_MAX; keep the attached to POOL_MAX + POOL_HYST
    const keep = this.keepBuf; keep.clear(); let attached = 0;
    for (let r = 0; r < ix.length; r++) { const c = C[ix[r]]; const p = c.a ? this.byAgent.get(c.a.id) : this.byPid.get(c.vp!.pid);
      if (p && r < POOL_MAX + POOL_HYST) { keep.add(p); attached++; if (c.vp) { p.vp = c.vp; p.vpFrame = this.frame; } } }
    for (let r = 0; r < Math.min(ix.length, POOL_MAX) && attached < POOL_MAX + POOL_HYST; r++) { const c = C[ix[r]]; if (c.d > ATTACH_R) continue;
      let p = c.a ? this.byAgent.get(c.a.id) : this.byPid.get(c.vp!.pid); if (p) continue;
      p = c.a ? this.attach(c.a) : this.attachPop(c.vp!.pid); keep.add(p); attached++; if (c.vp) { p.vp = c.vp; p.vpFrame = this.frame; } }
    for (const p of [...this.persons.values()]) if ((p.agent || p.pid >= 0) && !p.extra && !keep.has(p)) this.detach(p.key);
    // impostors: every candidate not attached (in view: update() culls)
    this.nImp = 0;
    for (let i = 0; i < nc; i++) { const c = C[i]; const p = c.a ? this.byAgent.get(c.a.id) : this.byPid.get(c.vp!.pid); if (p && keep.has(p)) continue;
      let e = this.impList[this.nImp]; if (!e) this.impList[this.nImp] = e = { vp: null, a: null, d: 0, x: 0, y: 0, z: 0, yaw: 0 }; this.nImp++;
      e.vp = c.vp; e.a = c.a; e.d = c.d;
      if (c.vp) { e.x = c.vp.e; e.y = c.vp.y; e.z = -c.vp.n; e.yaw = yawOf(c.vp.heading); } else { const a = c.a!; e.x = a.pos[0]; e.y = a.y; e.z = -a.pos[1]; e.yaw = yawOf(a.heading); } }
    this.impPerf.candidates = this.nImp;
    // pop-in probe (§13.8)
    const now = this.seenNow; now.clear();
    for (let i = 0; i < nc; i++) { const c = C[i]; if (c.d > 60) continue; now.add(c.id);
      if (!this.poolPrimed || !camera || this.seenPrev.has(c.id) || c.d >= 50) continue;
      if (c.vp && c.vp.entry === 1) { this.impPerf.doorEntries++; continue; }
      const x = c.vp ? c.vp.e : c.a!.pos[0], y = c.vp ? c.vp.y : c.a!.y, z = c.vp ? -c.vp.n : -c.a!.pos[1];
      if (this.frustum.containsPoint(_v.set(x, y + 1, z))) { this.impPerf.popins++; this.onPopIn?.(c.a ? `person ${c.a.id} (${c.a.role})` : `person p${c.vp!.pid} (${c.vp!.act}; ${c.vp!.what})`, c.d); } }
    this.seenNow = this.seenPrev; this.seenPrev = now; this.poolPrimed = true;
  }
  private orderBuf = new Int32Array(1024); private keepBuf = new Set<Person>(); private viewJumps = 0;
  /** the camera jumped (a test view, a teleport, a time jump): the pop-in probe starts afresh at the next frame */
  resetPopinProbe() { this.poolPrimed = false; this.seenPrev.clear(); this.visPrev.clear(); }
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
  /** the performance a person gives now (activities.ts: the plan's activity and reason resolve the variant): a detailed
   *  agent's from the simulation; a person of the population's from the view (D-143: their plan's act and reason, `vp.act`
   *  and `vp.why`; stepping aside on arriving at a place is a walk); an extra's from its spec */
  private resolve(p: Person) {
    const a = p.agent, e = p.extra, vp = !a && !e ? p.vp : null;
    // playing or singing (D-200): the playing performance in place of the plan's, while it is kept alive and the performer
    // is not on the move (a singer at work keeps the work: no cycle of its own)
    const pl = this.plays.get(p.key);
    if (pl && this.now < pl.until && PLAYING[pl.kind].anim && !(vp && vp.moving) && !(a && a.walking)) {
      const k = `play:${pl.kind}`; if (p.act !== k) { p.act = k; p.why = ''; p.perf = { ...PLAYING[pl.kind], variant: -1 } as Performance & { variant: number }; p.actPlaceholder = false; }
      p.anim = p.perf!.anim; return;
    }
    let act: ActivityId | undefined, why: string;
    if (a) { act = this.sim!.performance(a).act; why = a.task?.why ?? ''; }
    else if (vp) { act = vp.moving && !ACTIVITIES[vp.act].moving ? 'walk' : vp.act; why = vp.why; }
    else { act = e!.act; why = e!.why ?? ''; }
    if (act !== p.act || why !== p.why) { // the performance changes only with the activity or the plan's reason
      p.act = act ?? ''; p.why = why; p.perf = act ? performanceFor(act, why, a ? a.seed : Math.round(p.animK * 159), e?.variant, vp ? this.who(p.pid) : undefined) : null; p.actPlaceholder = !!p.perf?.placeholder;
      // D-215 (gap audit item 37): the lame walk with a staff, the blind feel their way with one
      if (vp?.impair && p.perf && act === 'walk' && !p.perf.animals) p.perf = { ...p.perf, anim: vp.impair === 1 ? 'limp' : 'feel', prop: 'staff', note: vp.impair === 1 ? 'a lame man walking with a staff (gap audit item 37: injuries of the building sites and the fields are to be expected; C)' : 'a blind elder feeling the way with a staff, led by a child of the house when one walks with them (gap audit item 37; C)' }; }
    p.anim = p.perf ? p.perf.anim : e?.anim ?? 'idle';
  }
  private lastTime = 0;
  /** shared work objects this frame: one per place (the threshing floor) or one per group (the bier, at its bearers' centre) */
  private shared = new Map<string, { kind: string; x: number; y: number; z: number; yaw: number; n: number; rank: number; one: THREE.Matrix4 }>();
  /** the population's shared work objects this frame (D-142 × D-143): the threshing floor and the drum on its sledge once
   *  per place of the plan, the bier once per place and household (one funeral: the men of the household in mourning carry
   *  it). Each stands at the performer with the lowest population id among everyone the view places there this frame, in
   *  view or not, skinned or an impostor, near or far, so it stays where it is when the camera turns, the field of view
   *  changes or the pool changes (the anchor is the view's, not the drawing's). It is drawn when any of its performers is
   *  drawn within THINGS_DIST (placeThings marks it); the objects' own bounding spheres cull it */
  //  Session 6: the anchor is also kept from frame to frame while the object's key is in the view (the object's place still
  //  has a performer), so it does not jump when the anchor's performer leaves or a performer with a lower id arrives or
  //  steps aside on arriving (the WIP anchor moved up to 28 m then). A place's object (the floor, the drum) stays where it
  //  was first anchored until nobody performs there; a group's object (the bier, carried: `follow`) goes with its anchor
  //  bearer and passes to the lowest id remaining only when he leaves. A jump in time anchors afresh. It is drawn when any
  //  performer of its key is within THINGS_DIST of the camera (by distance, not the frustum: turning the camera neither
  //  moves nor hides it; the instanced mesh's bounding sphere culls it).
  private anchors = new Map<string, { kind: WorkKind; pid: number; b: [number, number, number, number]; at: [number, number, number]; drawn: boolean; group: boolean; seen: number }>();
  private anchorSrc: ViewPerson[] = []; private anchorJumps = -1;
  /** per key this frame: the lowest id performing there, the anchor's own frame if he still performs there, anyone near */
  private anchorScan = new Map<string, { pid: number; b: [number, number, number, number]; at: [number, number, number]; kind: WorkKind; group: boolean; own: [number, number, number, number] | null; near: boolean }>();
  private anchorPass(fed: boolean, cam: THREE.Vector3) {
    const A = this.anchors; if (!this.view) { A.clear(); return; }
    if (this.view.jumps !== this.anchorJumps) { this.anchorJumps = this.view.jumps; A.clear(); } // a jump in time: anchored afresh
    let src: readonly ViewPerson[] = this.vpBuf;
    if (!fed) { const L = this.anchorSrc; L.length = 0; for (const p of this.persons.values()) if (!p.agent && !p.extra && p.vp && p.vpFrame === this.frame) L.push(p.vp); // no pool feed (tests): the attached and the impostors given
      for (let i = 0; i < this.nImp; i++) { const v = this.impList[i].vp; if (v) L.push(v); } src = L; }
    const S = this.anchorScan; S.clear();
    for (const o of src) {
      if (o.agent >= 0 || !o.place || !SHARED_ACTS.has(o.act) || (o.moving && !ACTIVITIES[o.act].moving)) continue; // stepping aside is a walk
      const P = this.popPerf(o.pid, o.act, o.why); if (!P.work) continue;
      const near = len3(o.e - cam.x, o.y + 0.9 - cam.y, -o.n - cam.z) < THINGS_DIST;
      for (const w of P.work) { if (!w.shared) continue; const key = this.popKey(w, o), g = S.get(key), a = A.get(key);
        const fr: [number, number, number, number] = [o.e, o.y, -o.n, yawOf(o.heading)];
        if (!g) S.set(key, { pid: o.pid, b: fr, at: w.at, kind: w.kind, group: w.shared === 'group', own: a && a.pid === o.pid ? fr : null, near });
        else { if (o.pid < g.pid) { g.pid = o.pid; g.b = fr; g.at = w.at; } if (a && a.pid === o.pid) g.own = fr; if (near) g.near = true; } } }
    for (const [key, a] of A) if (!S.has(key)) A.delete(key); // nobody performs there now
    for (const [key, g] of S) { const a = A.get(key);
      if (!a || (g.group && !g.own)) A.set(key, { kind: g.kind, pid: g.pid, b: g.b, at: g.at, drawn: g.near, group: g.group, seen: this.frame });
      else { a.drawn = g.near; a.seen = this.frame; if (g.group && g.own) a.b = g.own; } } // the bier goes with its bearer
  }
  /** the key of a population person's shared work object: its kind and the plan's place (a group object: and the household) */
  private popKey(w: WorkSpec, o: ViewPerson) { return w.shared === 'group' ? `${w.kind}|pop:${o.place}|hh${o.hh}` : `${w.kind}|pop:${o.place}`; }
  /** the performance a person of the population gives for an act and reason (cached per person): the one resolve() gives
   *  them when attached (the same variant seed), for the anchors and the impostors' things */
  private popPerfs = new Map<number, { act: string; why: string; perf: Performance }>();
  /** D-215: who a person of the population is (the play variants for boys or small children: activities.ts) */
  private who(pid: number): Performer | undefined { const V = this.view; if (!V || pid < 0 || !V.pop.persons[pid]) return undefined; return { sex: V.pop.persons[pid].sex, age: V.pop.ageOn(pid, Math.floor(Math.max(0, V.lastT) / 24)) }; }
  private popPerf(pid: number, act: ActivityId, why: string, lookSeed?: number): Performance {
    const c = this.popPerfs.get(pid); if (c && c.act === act && c.why === why) return c.perf;
    const p = this.byPid.get(pid), s = p ? 0 : lookSeed ?? this.impLooks.get(pid)?.seed ?? this.view!.lookInput(pid).seed;
    const perf = performanceFor(act, why, p ? Math.round(p.animK * 159) : Math.round(((s % 1000) / 159) * 159), undefined, this.who(pid)); // newPerson's animK, resolve()'s seed
    if (c) { c.act = act; c.why = why; c.perf = perf; } else { if (this.popPerfs.size > 60_000) this.popPerfs.clear(); this.popPerfs.set(pid, { act, why, perf }); }
    return perf;
  }
  /** a thing at (x, y, z) in a frame [x, y, z, yaw] (world), turned by yaw */
  private placeAt(fr: ArrayLike<number>, x: number, y: number, z: number, yaw: number, out: THREE.Matrix4) { const c = Math.cos(fr[3]), s = Math.sin(fr[3]);
    _q.setFromAxisAngle(_up, fr[3] + yaw); return out.compose(_v.set(fr[0] + c * x + s * z, fr[1] + y, fr[2] - s * x + c * z), _q, _one); }
  /** where a person of the population is drawn this frame (world x, y, z, yaw: the view's spot and the cycle's own path, the
   *  ploughman on his furrow), or null when they are not in the pool (world.ts puts the collision capsules there) */
  rootOf(pid: number): readonly [number, number, number, number] | null { const p = this.byPid.get(pid); return p && p.vpFrame === this.frame ? p.root : null; }
  update(time: number, cam: THREE.Vector3, playerPos: THREE.Vector3 | null, camera?: THREE.Camera) {
    const t0 = performance.now(); this.now = time; const dt = Math.max(0, Math.min(0.5, time - this.lastTime)); this.lastTime = time;
    if (camera) { this.lastCamera = camera; camera.updateMatrixWorld(); this.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.pm); this.wide.copy(this.frustum); for (const pl of this.wide.planes) pl.constant += 3; }
    this.frame++;
    // the air's temperature now (the sim's weather; once a frame), for the dress of the cold
    if (this.sim && (this.frame & 31) === 1) { try { this.airC = this.sim.env(this.sim.t).tempC; } catch { this.airC = 20; } }
    const S = this.sim?.stock;
    if (S && (S.depot !== this.lastStock.depot || S.store !== this.lastStock.store)) {
      const nd = this.pileLayout(0, 200, [PLACES.stair_foot.at[0] - 3, PLACES.stair_foot.at[1] - 2.5], S.depot);
      const ns = this.pileLayout(nd, 400, [PLACES.treasury_store.at[0] - 4, PLACES.treasury_store.at[1] - 3], S.store);
      this.sacks.count = nd + ns; this.sacks.visible = nd + ns > 0; this.sacks.instanceMatrix.needsUpdate = true; this.lastStock.depot = S.depot; this.lastStock.store = S.store;
    }
    if (this.frame > 1 && this.camAt.distanceTo(cam) > 30) this.resetPopinProbe(); // the camera was moved, not walked (a teleport)
    this.camPlot = this.view ? this.view.geo.plotAt(cam.x, -cam.z) : 0;
    this.camAt.copy(cam); const tf = performance.now(); this.drawnKeys?.clear();
    const fed = this.autoPool && !!this.view && !!this.sim;
    if (this.autoPool) { if (fed) this.feedPool(cam, camera); else this.autoPoolStep(cam, camera); }
    this.anchorPass(fed, cam);
    this.impPerf.feedMs = performance.now() - tf;
    const gpu = this.humans.gpu; gpu.begin();
    for (const c of this.carried) c.mesh.count = 0; this.propsDropped = 0;
    if ((this.frame & 63) === 0) for (const [k, pl] of this.plays) if (time > pl.until + 5) this.plays.delete(k);
    this.things.begin(); this.animals.begin(time); this.shared.clear();
    // order by distance for the full-detail cap
    const list = this.list; list.length = 0;
    for (const p of this.persons.values()) {
      const a = p.agent; let x: number, y: number, z: number, yaw: number;
      const vp = p.vpFrame === this.frame ? p.vp : null; // the view's place for a population person or an agent off the Terrace
      if (a && !a.offmap) { x = a.pos[0]; y = a.y; z = -a.pos[1]; yaw = yawOf(a.heading); }
      else if (vp) { x = vp.e; y = vp.y; z = -vp.n; yaw = yawOf(vp.heading); }
      else if (p.extra) { const e = p.extra; x = e.x; y = e.y; z = e.z; yaw = e.yaw; }
      else { p.shown = false; continue; }
      const b = p.base; b[0] = x; b[1] = y; b[2] = z; b[3] = yaw;
      this.resolve(p);
      // the walking phase of a person of the population: at their pace on the way; in place at a standing spot where the
      // performance is a moving one (the bearers, a guard's round: IN_PLACE_RATE). Advanced for the culled too, so the
      // footsteps they sound (soundsOnly) and the pose on turning back keep time
      if (!a && vp && !p.extra) { if (vp.moving) p.gaitPh += (vp.speed || 1.2) * dt / 0.72 * Math.PI; else if (ACTIVITIES[p.act as ActivityId]?.moving) p.gaitPh += IN_PLACE_RATE * dt; }
      // a cycle with a path of its own (the ploughman on the furrow, the thresher turning with his team, the archer
      // side-on): the root follows it every frame, between pose refreshes too
      p.path = PATHED.has(p.anim) ? workRoot(p.anim as WorkAnim, this.cycleT(p, time), p.animK) : null;
      if (p.path) { const c = Math.cos(yaw), sn = Math.sin(yaw), o = p.path; x += c * o[0] + sn * o[1]; z += -sn * o[0] + c * o[1]; yaw += o[2]; }
      // D-210: a rider sits on the mount's back (the mount stands on the ground at the base)
      if (p.perf?.animals?.kind === 'mount') y += riderLift(p.perf.animals.species[0], p.look.stature || 1.65);
      const pr = p.prevRoot, r = p.root;
      if (p.drawnFrame === this.frame - 1) { pr[0] = r[0]; pr[1] = r[1]; pr[2] = r[2]; pr[3] = r[3]; } else { pr[0] = x; pr[1] = y; pr[2] = z; pr[3] = yaw; }
      r[0] = x; r[1] = y; r[2] = z; r[3] = yaw;
      const d = len3(x - cam.x, y + 0.9 - cam.y, z - cam.z); p.dist = d;
      p.shown = d < LOD_DIST[3] && !(d < this.rigClear);
      if (!p.shown) continue;
      const reach = p.perf?.animals || p.perf?.work?.length ? 4 : 1.3; // a performance's things and animals spread a few metres
      if (camera && !this.wide.intersectsSphere(_s.set(_v.set(x, y + 0.9, z), reach * p.look.scale))) { if (a || !p.extra) this.soundsOnly(p, d, time); continue; }
      p.dist = d; list.push(p);
    }
    list.sort((a, b) => a.dist - b.dist);
    const tp = performance.now(); let posed = 0, walled = 0; const drawn = [0, 0, 0, 0]; const has3 = this.humans.gpu.costumes.has('worker@3');
    for (let i = 0; i < list.length; i++) {
      const p = list[i], d = p.dist;
      // a person in a walled court or yard the camera is outside of and below the walls of is hidden (but through the street
      // door): the farthest body, no shadow, not counted against the full and mid caps (they go to the people seen)
      const hid = !p.agent && p.vpFrame === this.frame && !!p.vp && this.walledOff(p.vp, cam.y); if (hid) walled++;
      const K = this.caps, lod = hid ? (has3 ? 3 : 2) : d < LOD_DIST[0] && drawn[0] < K.full ? 0 : d < LOD_DIST[1] && drawn[1] < K.mid ? 1 : d < K.far || !has3 ? 2 : 3; drawn[lod]++;
      const every = d < 30 ? 1 : d < 90 ? 2 : d < 200 ? 4 : 8;
      if (p.poseFrame < 0 || (this.frame + p.frameMod) % every === 0 || this.frame - p.poseFrame > every) { IK_Q.passes = lod === 0 ? 4 : lod === 1 ? 2 : 1; this.posePerson(p, time, d, playerPos, cam, lod); posed++; }
      else if (p.poseFrame === this.frame - 1) this.copyPrev(p); // no bone change this frame: previous = current
      const c = gpu.costumes.get(`${COSTUME_OF[p.look.dress]}@${lod}`)!;
      gpu.push(c, p.slot, p.root[0], p.root[1], p.root[2], p.root[3], p.prevRoot[0], p.prevRoot[1], p.prevRoot[2], p.prevRoot[3], lod === 0 ? 1 : d < K.shadow && !hid ? 2 : 0);
      p.drawnFrame = this.frame; p.lod = lod; if (this.drawnKeys) this.drawnKeys.add(p.agent ? -1 - p.agent.id : p.pid);
      if (this.dustTap && !hid) this.tapDust(p.act, p.agent ? p.agent.walking : !!(p.vp?.moving), p.root[0], p.root[1], p.root[2], p.root[3], p.vp?.speed || 1.25, p.agent ? p.agent.seed : p.pid, p.perf?.animals?.kind === 'mount');
      if (p.prop) this.placeProp(p, p.prop, p.propM, p.ip[0]);
      if (p.prop2) this.placeProp(p, p.prop2, p.propM2, p.ip[1]);
      if (p.babeProps) for (const b of p.babeProps) this.placeProp(p, b.kind, b.M, b.tint); // D-215
      if (p.perf && d < THINGS_DIST && (p.perf.work?.length || p.perf.animals)) this.placeThings(p, time, d, dt);
    }
    IK_Q.passes = 4; gpu.end(true);
    { const ti = performance.now(); this.drawImpostors(time); this.impPerf.impMs = performance.now() - ti; }
    for (const [, g] of this.shared) { if (g.n > 1) { _q.setFromAxisAngle(_up, g.yaw); _m.compose(_v.set(g.x / g.n, g.y / g.n, g.z / g.n), _q, _one); this.things.push(g.kind as any, _m); } else this.things.push(g.kind as any, g.one); }
    for (const g of this.anchors.values()) if (g.drawn) this.things.push(g.kind, this.placeAt(g.b, g.at[0], g.at[1], g.at[2], 0, _m));
    this.things.end(); this.animals.end();
    for (const c of this.carried) { const im = c.mesh; im.visible = im.count > 0; if (!im.count) continue;
      im.instanceMatrix.needsUpdate = true; im.instanceMatrix.clearUpdateRanges(); im.instanceMatrix.addUpdateRange(0, im.count * 16);
      c.data.needsUpdate = true; c.data.clearUpdateRanges(); c.data.addUpdateRange(0, im.count * c.data.stride); }
    this.perf.ms = performance.now() - t0; this.perf.poseMs = performance.now() - tp; this.perf.posed = posed; this.perf.drawn = drawn; this.perf.attached = this.persons.size; this.impPerf.walled = walled;
  }
  /** the impostors of this frame: the pool's candidates not attached, and the attached beyond the farthest LOD, in the
   *  widened frustum; a person's look is computed once (LOOKS_PER_FRAME new ones a frame) */
  private lastT = 0;
  private drawImpostors(time: number) {
    const imp = this.imp; if (!imp) return; imp.begin(); const dt = Math.max(0, Math.min(0.5, time - this.lastT)); this.lastT = time;
    let made = 0, pending = 0, walkers = 0, placeholders = 0; const bands = [0, 0, 0, 0], cam = this.camAt;
    const cap = this.lookBurst ? Infinity : this.looksPerFrame; this.lookBurst = false;
    // `own`: a candidate of the pool not attached, at the view's spot (the attached beyond the farthest LOD come at their
    // root, on their cycle's path already, and beyond THINGS_DIST)
    const one = (pid: number, a: Agent | null, vp: ViewPerson | null, x: number, y: number, z: number, yaw: number, own: boolean) => {
      // a person of the population whose performance moves them along a path of its own (the ploughman on his furrow) or
      // brings work objects and animals: performed as resolve() and placeThings do for the skinned, so the things are there
      // within THINGS_DIST whether the pool draws the person skinned or as an impostor, and nobody jumps between the two
      const pf = own && !a && vp && !(vp.moving && !ACTIVITIES[vp.act].moving) ? (PATH_ACTS.has(vp.act) ? 2 : THINGS_ACTS.has(vp.act) ? 1 : 0) : 0;
      let lift = 0, vAnim: AnimId | null = null; // D-210: a rider's impostor (the seated frame) on the mount's back
      if (!this.wide.intersectsSphere(_s.set(_v.set(x, y + 0.9, z), pf === 2 ? PATH_REACH + 4 : pf ? 4 : 1.3))) return;
      const key = a ? -1 - a.id : pid; let L = this.impLooks.get(key);
      if (!L) { if (made >= cap) { pending++; return; } made++;
        const inp = a ? { id: a.id, sex: a.sex, role: a.role, dress: a.dress as Dress, origin: a.origin, seed: a.seed } : this.view!.lookInput(pid); const look = lookFor(this.humans.A, inp as LookInput, this.seed);
        const ch = a ? null : this.view!.childStature(pid); L = { packed: imp.packLook(look), dress: look.far ?? look.dress /* D-199 */, scale: (ch ?? look.stature) / (imp.atlas.refStature[look.far ?? look.dress] || 1.65), seed: inp.seed }; this.impLooks.set(key, L); }
      if (pf) { const d3 = len3(x - cam.x, y + 0.9 - cam.y, z - cam.z), P = pf === 2 || d3 < THINGS_DIST ? this.popPerf(pid, vp!.act, vp!.why, L.seed) : null;
        if (P) { const q = this.impP, k = L.seed, b = q.base, r = q.root; b[0] = x; b[1] = y; b[2] = z; b[3] = yaw;
          if (PATHED.has(P.anim)) { const o = workRoot(P.anim as WorkAnim, time + k % 100, (k % 1000) / 159); if (o) { const c = Math.cos(yaw), sn = Math.sin(yaw); x += c * o[0] + sn * o[1]; z += -sn * o[0] + c * o[1]; yaw += o[2]; } }
          r[0] = x; r[1] = y; r[2] = z; r[3] = yaw;
          if (P.animals?.kind === 'mount' && d3 < THINGS_DIST) { lift = mountSeat(P.animals.species[0]).y; vAnim = P.anim; }
          if (d3 < THINGS_DIST && (P.work?.length || P.animals)) { q.perf = P; q.anim = P.anim; q.animK = (k % 1000) / 159; q.animT = k % 100; q.vp = vp; q.pid = pid; q.key = `p${pid}`; this.placeThings(q, time, d3, dt); } }
        if (!this.wide.intersectsSphere(_s.set(_v.set(x, y + 0.9, z), 1.3))) return; } // the body out of view (its things in it)
      const act = a ? this.sim!.performance(a).act : vp!.act, anim = vAnim ?? ACTIVITIES[act].anim, moving = a ? a.walking : vp!.moving;
      if (ACTIVITIES[act].placeholder && !moving) placeholders++; // shown standing (idle), counted as the skinned are
      const ph = a ? a.gait : ((this.impPhase.get(key) ?? (pid % 628) / 100) + (moving ? (vp!.speed || 1.2) * dt / 0.72 * Math.PI : ACTIVITIES[act].moving ? IN_PLACE_RATE * dt : 0)); if (!a) this.impPhase.set(key, ph);
      imp.push(x, y + lift, z, yaw, rowOf(L.dress, frameOf(moving && !ACTIVITIES[act].moving && !vAnim ? 'walk' : anim, ph)), L.scale, null, L.packed); this.drawnKeys?.add(key);
      if (this.dustTap) this.tapDust(act, moving, x, y, z, yaw, vp?.speed || 1.25, a ? a.seed : pid, !!vAnim);
      const dd = Math.sqrt((x - cam.x) ** 2 + (z - cam.z) ** 2); bands[dd < 600 ? 0 : dd < 1500 ? 1 : dd < 3000 ? 2 : 3]++; if (moving) walkers++;
    };
    for (let i = 0; i < this.nImp; i++) { const e = this.impList[i]; one(e.vp ? e.vp.pid : -1, e.a, e.vp, e.x, e.y, e.z, e.yaw, true); }
    for (const p of this.persons.values()) if (!p.shown && (p.agent || p.pid >= 0) && p.dist >= LOD_DIST[3] && p.drawnFrame !== this.frame) { const r = p.root; if (r[0] || r[2]) one(p.pid, p.agent, p.vp, r[0], r[1], r[2], r[3], false); }
    imp.end(); this.impPerf.drawn = imp.count; this.impPerf.looksPending = pending; this.impPerf.bands = bands; this.impPerf.walking = walkers; this.impPerf.placeholders = placeholders;
    if (this.impLooks.size > 60_000) this.impLooks.clear(); if (this.impPhase.size > 60_000) this.impPhase.clear();
  }
  private impPhase = new Map<number, number>();
  /** an impostor performing with things (drawImpostors → placeThings): the fields placeThings reads */
  private impP = { perf: null, base: [0, 0, 0, 0], root: [0, 0, 0, 0], anim: 'idle', animK: 0, animT: 0, agent: null, extra: undefined, vp: null, pid: -1, key: '' } as unknown as Person;
  /** the next update computes every impostor look it needs, not LOOKS_PER_FRAME (a settled test render: world.settle) */
  settleLooks() { this.lookBurst = true; }
  private lookBurst = false;
  /** the LOD caps in force: full-detail and mid-detail counts, the far body's reach and the shadow casters' (m). The
   *  constants by default; tests vary them to measure the triangle budget (D-143). The brief's floor: full ≥ 50 */
  caps = { full: MAX_FULL as number, mid: MAX_MID as number, far: LOD_DIST[2] as number, shadow: SHADOW_DIST as number };
  /** tests: when set, filled each frame with everyone drawn (population id; a detailed agent as -1 - agent id) */
  drawnKeys: Set<number> | null = null;
  /** the camera of the last update (crowdprobe.ts counts the people visible from it) */
  lastCamera: THREE.Camera | null = null;
  /** the people drawn in the last frame (occlusion counts, crowdprobe.ts): feet x, y, z, body height (m) and kind (0-3 the
   *  skinned LOD, 4 an impostor) per person */
  drawnPoints(): Float32Array {
    const a: number[] = [];
    for (const p of this.persons.values()) if (p.drawnFrame === this.frame) a.push(p.root[0], p.root[1], p.root[2], p.look.stature || 1.65, p.lod ?? 2);
    const imp = this.imp; if (imp) for (let i = 0; i < imp.count; i++) { const o = imp.at(i); a.push(o[0], o[1], o[2], o[3] * 1.65, 4); }
    return Float32Array.from(a);
  }
  /** looks computed per frame for people first seen as impostors (tests set it high to fill a frozen frame at once) */
  looksPerFrame = LOOKS_PER_FRAME;
  private copyPrev(p: Person) { const o = p.slot * PALETTE_STRIDE; const g = this.humans.gpu; g.prevPalette.set(g.palette.subarray(o, o + PALETTE_STRIDE), o); }
  /** the time a person's cycle runs on (the same for the pose and the path) */
  private cycleT(p: Person, time: number) { return time + p.animT; }
  /** activity, pose, face and hands → skin palette (character space); props and tool sounds */
  private posePerson(p: Person, time: number, d: number, playerPos: THREE.Vector3 | null, cam: THREE.Vector3, lod: number) {
    const a = p.agent; const g = this.humans.gpu;
    let po: Pose; let prop1: string | null = null, prop2: string | null = null; const anim = p.anim; const P = p.perf;
    if (P) {
      // the walking phase: a detailed agent's own, a person of the population's advanced by their pace (D-143)
      po = pose(anim, this.cycleT(p, time), a ? a.gait : p.pid >= 0 && !p.extra ? p.gaitPh : time * 4.2, p.animK);
      // what is carried besides the performance's own props: a detailed agent's load, or a person of the population's goods
      // in the plan's words (popview propOf, D-143) where the activity performed has no prop of its own (a variant that
      // leaves the activity's prop out, prop: undefined, keeps the hands free; stepping aside on arriving is a walk, and the
      // walker carries the tool or goods of the act arrived for)
      const vp = !a && !p.extra ? p.vp : null;
      const load = a ? (a.carry === 'sack' ? 'sack' : a.carry === 'jar_head' ? 'jar_head' : a.carry === 'basket' ? 'basket' : undefined)
        : vp && !ACTIVITIES[p.act as ActivityId]?.prop ? vp.prop ?? undefined : undefined;
      const want = P.prop ?? load;
      prop1 = want ? (want === 'bread' ? 'basket' : want) : null; prop2 = P.prop2 ?? null;
      if (prop1 === 'spear') prop1 = this.spearOf(p, vp);
      if (po.hit && !p.lastHit && d < 60) this.onHit?.(P.sound ?? 'chisel', _v.set(p.root[0], p.root[1], p.root[2]).clone());
      p.lastHit = !!po.hit;
    } else po = pose(anim, time + p.t0, time * 4.2, p.animK);
    // coats, weapons on the back and hats are laid aside while seated, crouched or asleep (they would pass through the ground; C)
    // dressed for the cold (outfits.weatherMask: S5 of shadow review r6), then coats, weapons and hats laid aside
    // D-215: a shield-bearer at his post holds the shield at his side by its grip (the left arm down); the children carried
    // on the arms or the hip, a small child's hand held
    const vpC = !a && !p.extra ? p.vp : null;
    if (anim === 'guard' && this.shieldBit(p.look.dress) & p.look.mask) { po.rot.l_upper = [0.04, 0, 0.1]; po.rot.l_fore = [-0.18, 0, 0]; po.grip = [1, po.grip?.[1] ?? 1]; }
    if (vpC?.babes?.length) holdBabe(po, vpC.babes[0].mode, anim);
    if (vpC?.hand) holdHand(po, vpC.hand, vpC.handSide ?? 'l', vpC.handUp ?? 0);
    // (D-209: the magus's mouth-cover at the fire; drawn over the beard, which it hides)
    const w0 = weatherMask(p.look.dress, p.look.mask, this.airC), wb = P?.wear ? this.wearBits(p.look.dress, P.wear) : null, m0 = wb ? (w0 | wb[0]) & ~wb[1] : w0;
    const mask = ASIDE.has(anim) ? m0 & ~this.asideBits(p.look.dress, anim) : m0;
    if (mask !== p.mask) { p.mask = mask; this.humans.gpu.person[p.slot * PERSON_TEXELS * 4 + 1] = mask; this.humans.gpu.markPersonDirty(); }
    // glance: the player within 7 m turns heads (clamped) and eyes. How much follows the simulation's memory of the
    // player (sim.greeting: none → a stranger's glance; nod / recognise → the head turns fully and nods once, within 4 m)
    const f = p.face; f.look = null; f.eyeYaw = 0; f.eyePitch = 0; f.jaw = 0;
    const lookAt = p.extra?.look ?? null;
    if (lookAt) f.look = this.toChar(p, lookAt);
    else if (playerPos && d < 7 && anim !== 'sleep' && !(p.pid >= 0 && p.pid === this.view?.pop.court?.king)) { // (D-199: the king does not turn to the visitor: brief §1.1)
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
    // singing (D-200): the jaw opens on the sung notes, the chest draws breath before each phrase; a piper's lips close on
    // the reed
    const pl = this.plays.get(p.key);
    if (pl && time < pl.until) {
      if (pl.song) { const sf = singFace(pl.song, time - pl.t0, pl.open); if (lod < 2) f.jaw = sf.jaw; const c = po.rot.chest ?? [0, 0, 0]; po.rot.chest = [c[0] - 0.05 * sf.breath, c[1], c[2]]; }
      else if (pl.kind === 'reed_pipe' || pl.kind === 'double_pipe') f.jaw = 0.02;
    }
    // hands: the cycle's grip, else what they hold
    p.rig.grip = po.grip ?? (prop1 ? PROPS[prop1]?.grip : undefined) ?? (anim === 'guard' || anim === 'guard_walk' ? [0.5, 1] : [0, 0]);
    p.rig.pose = po; p.rig.plant = PLANTED.has(anim); p.rig.seat = SEATED.has(anim);
    const o = p.slot * PALETTE_STRIDE;
    g.prevPalette.set(g.palette.subarray(o, o + PALETTE_STRIDE), o);
    this.rigS.setPose(p.rig); this.rigS.solve(p.rig, g.palette, o);
    if (p.poseFrame < 0) g.prevPalette.set(g.palette.subarray(o, o + PALETTE_STRIDE), o);
    p.poseFrame = this.frame;
    const par = { v: 0 }, sc = p.look.scale;
    p.prop = prop1 && placeProp(prop1, this.rigS, po, sc, time, 0, p.propM, par) ? prop1 : null; p.ip[0] = par.v;
    p.prop2 = prop2 && placeProp(prop2, this.rigS, po, sc, time, 1, p.propM2, par) ? prop2 : null; p.ip[1] = par.v;
    // D-215: the children held or put down beside (babes.ts: their kind by age and way of holding, their size by age)
    const B = vpC?.babes; if (B?.length) { const L = p.babeProps ?? (p.babeProps = []); L.length = B.length;
      for (let i = 0; i < B.length; i++) { const b = B[i], k = babeKind(b.mode, b.months), q = L[i] ?? (L[i] = { kind: '', M: new THREE.Matrix4(), tint: 1, mode: '' });
        q.kind = k.kind; q.mode = b.mode; q.tint = tintFor(p.look.col.skin); placeBabe(b.mode, this.rigS, sc, babeLength(b.months), k.ref, q.M, THREE.Vector3); } }
    else if (p.babeProps) p.babeProps.length = 0;
  }
  /** the spear a guard carries (D-215): the king's spearmen an apple of gold at the butt (the plan's words: court.ts), one
   *  Persian-dress guard in ten a golden pomegranate, the others silver (Herodotus 7.41: B; the one in ten C) */
  private spearOf(p: Person, vp: ViewPerson | null): string {
    if (vp?.carryNote && /apple-shaped butt/.test(vp.carryNote)) return 'spear_apple';
    if ((p.look.dress === 'guard') && h32(this.seed, SALT_SPEAR, p.agent ? p.agent.id : 1e6 + p.pid) % 10 === 0) return 'spear_gpom';
    return 'spear';
  }
  /** D-209: the bits of the pieces a performance puts on (activities.ts `wear`) and takes off (the beard under the mouth-cover); a piece the dress lacks sets nothing */
  private wearCache = new Map<string[], Map<Dress, [number, number]>>();
  /** [bits put on, bits taken off] for a performance's worn pieces (cached by the registry's own array: no allocation a frame) */
  private wearBits(dress: Dress, ids: string[]): [number, number] { let m = this.wearCache.get(ids); if (!m) this.wearCache.set(ids, m = new Map()); let b = m.get(dress);
    if (!b) { const bits = (l: string[]) => { let x = 0; for (const id of l) { const k = pieceBit(dress, id); if (k) x |= 1 << k; } return x; }; b = [bits(ids), ids.includes('mouth_cover') ? bits(['beard_long', 'beard_short']) : 0]; m.set(dress, b); } return b; }
  private shieldBits = new Map<string, number>();
  private shieldBit(dress: Dress) { let b = this.shieldBits.get(dress); if (b === undefined) { const k = pieceBit(dress, 'shield'); b = k ? 1 << k : 0; this.shieldBits.set(dress, b); } return b; }
  /** a world point in the person's character space (inverse of the instance root: translate, yaw about +Y, scale).
   *  The rig solves in character space, so gaze targets must be given there (world targets aimed the eyes wrongly). */
  private toChar(p: Person, w: ArrayLike<number>) {
    const dx = w[0] - p.root[0], dy = w[1] - p.root[1], dz = w[2] - p.root[2], c = Math.cos(p.root[3]), s = Math.sin(p.root[3]), k = 1 / p.look.scale, o = p.lookC;
    o[0] = (c * dx - s * dz) * k; o[1] = dy * k; o[2] = (s * dx + c * dz) * k; return o;
  }
  /** the air's temperature (°C) the crowd dresses for */
  airC = 20;
  private asideCache = new Map<string, number>();
  private asideBits(dress: Dress, anim: AnimId) {
    const k = dress + (anim === 'sleep' ? ':s' : ''); let b = this.asideCache.get(k);
    if (b === undefined) { b = 0; for (const id of ['kandys', 'quiver', 'bow', 'gorytos', 'akinaka', 'shield', ...(anim === 'sleep' ? ['hat_fluted', 'fillet', 'cap_soft', 'headband', 'cap_pointed', 'cap_low', 'crown', 'crown_w'] : [])]) { const bit = pieceBit(dress, id); if (bit) b |= 1 << bit; } this.asideCache.set(k, b); }
    return b;
  }
  /** people culled from view still make their tool sounds (detailed agents and the population's people, D-143) */
  private soundsOnly(p: Person, d: number, time: number) {
    if (d > 60 || !p.perf?.sound) return; const a = p.agent;
    const po = pose(p.anim, this.cycleT(p, time), a ? a.gait : p.gaitPh, p.animK);
    if (po.hit && !p.lastHit) this.onHit?.(p.perf.sound, new THREE.Vector3(p.root[0], p.root[1], p.root[2])); p.lastHit = !!po.hit;
  }
  /** props not drawn this frame because their class was full (stats) */
  private propsDropped = 0;
  /** a prop instance: its class mesh, kind index and parameter; the character-space transform composed with the root */
  private placeProp(p: Person, kind: string, M: THREE.Matrix4, param: number) {
    const sl = propSlot(kind === 'jar_head' ? 'jar' : kind); if (!sl) return; const c = this.carried[sl[0]], im = c.mesh;
    if (im.count >= CARRIED_MAX) { this.propsDropped++; return; }
    _m.makeRotationY(p.root[3]).setPosition(p.root[0], p.root[1], p.root[2]).multiply(M);
    const e = _m.elements, i = im.count; c.axes[0].setXYZ(i, e[0], e[1], e[2]); c.axes[1].setXYZ(i, e[4], e[5], e[6]); c.axes[2].setXYZ(i, e[8], e[9], e[10]);
    c.kind.setX(i, sl[1]); c.param.setX(i, param); im.setMatrixAt(im.count++, _m);
  }
  /** the performer's work objects and animals (activities.ts `work`, `animals`), placed from the simulation's spot (base)
   *  or the performer's own path (`follow`); shared objects once per place or group; a flock bleats now and then */
  private placeThings(p: Person, time: number, d: number, dt: number) {
    const P = p.perf!, b = p.base, r = p.root;
    const place = (fr: number[], x: number, y: number, z: number, yaw: number, out: THREE.Matrix4) => this.placeAt(fr, x, y, z, yaw, out);
    const A0 = P.animals?.kind === 'beside' ? animalsFor(P.animals, 0, 0)[0] : null;
    for (const w of P.work ?? []) {
      const fr = w.follow ? r : b;
      if (w.kind === 'fodder' && A0) { const mz = grazeReach(A0.sp); this.things.push('fodder', place(fr, A0.x + Math.sin(A0.yaw) * mz, 0, A0.z + Math.cos(A0.yaw) * mz, 0, _m)); continue; } // under the muzzle
      // a person of the population (D-143): the view places each performer of a place on a spot of their own, not in a
      // formation, so a shared object (the threshing floor, the drum, the bier) is keyed by the plan's place (the bier: and
      // the household) and drawn once, at the anchor the view's people give it this frame (anchorPass: the lowest
      // population id among everyone placed there, drawn or not; not the performers' centroid: popgeo puts a funeral's
      // bearers within 40 m of the town's burial ground, or 90-220 m out of a village each in a direction of their own; not
      // a performer drawn this frame, which changes as the camera turns). Q-196: the bearers do not walk together
      const pop = w.shared && !p.agent && !p.extra && p.vp?.place ? p.vp : null;
      if (pop) { const key = this.popKey(w, pop), g = this.anchors.get(key);
        if (g) g.drawn = true; else this.anchors.set(key, { kind: w.kind, pid: p.pid, b: [b[0], b[1], b[2], b[3]], at: w.at, drawn: true, group: w.shared === 'group', seen: this.frame }); // not among the view's people this frame: at this performer
        continue; }
      if (w.shared) { const key = `${w.kind}|${w.shared === 'place' ? (p.agent?.task?.place ?? p.extra?.group ?? p.key) : (p.extra?.group ?? `${p.agent?.task?.place ?? p.key}`)}`;
        const g = this.shared.get(key);
        if (w.shared === 'place') { if (!g) this.shared.set(key, { kind: w.kind, x: 0, y: 0, z: 0, yaw: 0, n: 1, rank: -1, one: place(fr, w.at[0], w.at[1], w.at[2], 0, new THREE.Matrix4()) }); continue; }
        // a group object (the bier) at the centre of its bearers
        if (g) { g.x += fr[0]; g.y += fr[1]; g.z += fr[2]; g.n++; } else this.shared.set(key, { kind: w.kind, x: fr[0], y: fr[1], z: fr[2], yaw: fr[3], n: 1, rank: -1, one: place(fr, w.at[0], w.at[1], w.at[2], 0, new THREE.Matrix4()) });
        continue; }
      this.things.push(w.kind, place(fr, w.at[0], w.at[1], w.at[2], 0, _m));
    }
    const A = P.animals; if (!A) return;
    const t = this.cycleT(p, time), anim = p.anim;
    const path = anim === 'plough' ? { s: ploughPath(t, p.animK).s } : anim === 'drive' ? { yaw: -2 * Math.PI * ((t / THRESH_TURN_S + p.animK * 0.05) % 1) } : undefined;
    const list = animalsFor(A, t, Math.round(p.animK * 159) + (p.agent?.id ?? 0), path);
    for (const an of list) {
      const fr = an.follow ? r : b;
      if (an.roll) { // lying on its side: the body centre is put on the ground at half its width, then rolled
        const B = ANIMAL_BUILD[an.sp], bodyY = B.h - B.girth * 0.5, c = Math.cos(fr[3]), s = Math.sin(fr[3]);
        _q.setFromAxisAngle(_up, fr[3] + an.yaw); _m.compose(_v.set(fr[0] + c * an.x + s * an.z, fr[1] + B.girth * 0.45, fr[2] - s * an.x + c * an.z), _q, _one);
        _m.multiply(_m2.makeRotationZ(an.roll)).multiply(_m3.makeTranslation(0, -bodyY, 0));
      } else place(fr, an.x, an.y ?? 0, an.z, an.yaw, _m);
      this.animals.push(an, _m);
    }
    if (A.kind === 'flock' && d < 60 && list.length && Math.random() < dt / BLEAT_S) { const an = list[Math.floor(Math.random() * list.length)]; const c = Math.cos(b[3]), s = Math.sin(b[3]);
      this.onHit?.('bleat', new THREE.Vector3(b[0] + c * an.x + s * an.z, b[1] + 0.5, b[2] - s * an.x + c * an.z)); }
    if (d < 150 && list.length && this.onHit) { const at = (an: { x: number; z: number }, h: number) => { const c = Math.cos(b[3]), s = Math.sin(b[3]); return new THREE.Vector3(b[0] + c * an.x + s * an.z, b[1] + h, b[2] - s * an.x + c * an.z); };
      const br = list.find(an => BRAYERS.has(an.sp)); if (br && Math.random() < dt / BRAY_S) this.onHit('bray', at(br, 1.1));
      const dog = d < 90 ? list.find(an => an.sp === 'dog') : undefined; if (dog && Math.random() < dt / (d < 20 ? 3.5 : BARK_S)) this.onHit('bark', at(dog, 0.5));
      if (d < 40 && Math.random() < dt / 6) { const hen = list.find(an => an.sp === 'hen' || an.sp === 'cock'); if (hen) this.onHit('cluck', at(hen, 0.25)); } }
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
        const pp = !p.agent && p.pid >= 0 && this.view ? this.view.pop.persons[p.pid] : null;
        const court = pp ? this.view!.pop.court : null, courtRole = court?.roleOf(p.pid) ?? null; // D-182: the court's people say who they are
        const who = p.agent ? `${p.agent.name ?? 'unnamed'} (${p.agent.role}, ${p.agent.origin})` : pp ? `${this.view!.pop.nameOf(p.pid) ?? 'unnamed'} (${courtRole ?? pp.job}, ${pp.origin}; population person ${p.pid}: ${p.vp?.what ?? ''})` : `extra ${p.key}`;
        const act = p.act ? `; doing ${p.act}${p.actPlaceholder ? ' — PLACEHOLDER: no performance for this activity (abstract-only), a standing pose is shown' : p.perf ? ` (${p.perf.tier}: ${p.perf.note})` : ''}` : '';
        const kids = p.babeProps?.length ? `; with a small child: ${p.babeProps.map(b => BABE_NOTES[b.mode as BabeMode]).join('; ')} (D-215)` : '', hand = p.vp?.hand ? `; hand in hand with p${p.vp.handWith} (D-215, C)` : '';
        proxy.userData = { tier: 'C', src: 'RECON', placeholder: p.actPlaceholder || !!court?.placeholder(p.pid), note: `${who}; ${p.look.dress} dress${act}${kids}${hand}; ${p.look.note}` };
        out.push({ distance: best, point: ray.at(best, new THREE.Vector3()), object: proxy } as THREE.Intersection);
      }
    }
  }
  /** draw calls and triangles the crowd submits this frame (main pass; shadow passes repeat some of them) */
  stats() { const s = this.humans.gpu.stats(); let propDraws = 0, props = 0, propTriangles = 0;
    // every prop instance submits its class's whole union (the other kinds' vertices collapse to a point)
    for (const c of this.carried) if (c.mesh.count) { propDraws++; props += c.mesh.count; const g = c.mesh.geometry; propTriangles += c.mesh.count * (g.index ? g.index.count : g.getAttribute('position').count) / 3; }
    let placeholderActs = 0; for (const p of this.persons.values()) if (p.actPlaceholder && p.drawnFrame === this.frame) placeholderActs++;
    const imp = this.imp ? { impostors: this.imp.count, impostorDraws: this.imp.count ? 1 : 0, impostorTriangles: this.imp.count * 2 } : { impostors: 0, impostorDraws: 0, impostorTriangles: 0 };
    return { ...s, propDraws, props, propTriangles, propsDropped: this.propsDropped, placeholderActs, things: this.things.stats(), animals: this.animals.stats(), perf: { ...this.perf }, ...imp, impPerf: { ...this.impPerf }, view: this.view ? { ...this.view.stats } : null }; }
  /** evidence notes for the pieces a person wears (tests, overlay) */
  static pieceNotes(look: PersonLook) { return look.pieces.map(id => ({ ...PIECES[id], id })); }
}
const SALT_SPEAR = salt('crowd-spear');
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _s = new THREE.Sphere(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _one = new THREE.Vector3(1, 1, 1);
