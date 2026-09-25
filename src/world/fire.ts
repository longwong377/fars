// Fire, light and smoke (brief §5.4). Every fire is a real object (torch, brazier, hearth, oven, lamp) with a flame
// billboard, a flickering light (nearest N fires get a real point light; colour ≈ 1800–2000 K) and optional smoke
// that drifts with the wind. Fires are lit at dusk and put out after the night (C schedule until NPCs light them, Phase 5).
import * as THREE from 'three/webgpu';
import { colourOnly } from '../render/fx';
import { surfaceMaterial } from '../render/materials';
import { uniform, uv, vec3, vec4, float, mx_noise_float, time, attribute, smoothstep, mix, length, vec2, max, positionWorld, cameraPosition, normalize, dot, pow, step } from 'three/tsl';
import { Rng } from '../core/rng';
import { fireOcc, fireOccNode, tileOf } from './fireOcc';

export type FireKind = 'torch' | 'brazier' | 'hearth' | 'oven' | 'lamp' | 'kiln' | 'altar';
/** when a fire burns (C schedules): 'night' dusk to after sunrise (default); 'home' a domestic hearth, lit as the light
 *  goes for the evening meal and banked a few hours after dark, relit before dawn; 'bake' a bread oven, before dawn into
 *  the morning; 'day' a workshop fire (kiln, forge) in working hours; 'kept' a fire that is never let go out (D-209: the
 *  precinct's altar, fed at dawn and dusk and sheltered in rain by the magi, C). Needs the local hour (update's last argument). */
export type FireSchedule = 'night' | 'home' | 'bake' | 'day' | 'kept';
export interface FireSource { id: string; kind: FireKind; pos: THREE.Vector3; lit: boolean; seed: number; tier: string; src: string; note: string; sched?: FireSchedule; group?: string;
  /** its tile in the baked fire-light occlusion atlas (D-222), −1 when not baked (the town's fires); set on first use */ occ?: number }
const SPEC: Record<FireKind, { flameH: number; flameW: number; power: number; range: number; smoke: number }> = {
  torch: { flameH: 0.45, flameW: 0.22, power: 1.2, range: 14, smoke: 0.2 },
  brazier: { flameH: 0.7, flameW: 0.55, power: 2.4, range: 22, smoke: 0.5 },
  hearth: { flameH: 0.5, flameW: 0.6, power: 1.6, range: 14, smoke: 1.0 },
  oven: { flameH: 0.25, flameW: 0.4, power: 0.8, range: 8, smoke: 1.2 },
  lamp: { flameH: 0.06, flameW: 0.03, power: 0.08, range: 3.5, smoke: 0.0 },
  kiln: { flameH: 0.35, flameW: 0.5, power: 1.4, range: 10, smoke: 1.6 },
  // D-209: the kept fire on the precinct's stepped altar: a wood fire in the open, a little larger than a hearth's (C)
  altar: { flameH: 0.6, flameW: 0.55, power: 1.9, range: 16, smoke: 1.1 },
};
/** smoke puffs come only from fires within this distance of the camera (the pool is shared; far smoke is the town haze) */
export const SMOKE_RANGE = 300;
/** a far flame is drawn no narrower than this many pixels, its brightness cut by the area ratio so that the light
 *  reaching the eye is unchanged (render pass 2: from Kuh-e Rahmat at dusk the town's 1,037 lit fires were each under
 *  a pixel wide and vanished; a real town seen from a hill at dusk shows as a scatter of points) */
export const FLAME_MIN_PX = 2;
/** the billboard's growth factor k (>= 1) and the flux factor 1 / k^2 for a flame `w` m wide at `d` m, with `pxPerRad`
 *  pixels per radian at the view centre */
export function flameFootprint(w: number, d: number, pxPerRad: number): { k: number; flux: number } {
  const px = (w / Math.max(d, 1e-3)) * pxPerRad, k = Math.max(1, FLAME_MIN_PX / Math.max(px, 1e-6));
  return { k, flux: 1 / (k * k) };
}
/** height of the flame's base above `base` (the floor, or a torch's bracket) */
const LIFT: Record<FireKind, number> = { torch: 0.35, brazier: 1.02, hearth: 0.15, oven: 0.25, lamp: 0.05, kiln: 0.6, altar: 0 };
/** renderer candela per unit of a fire's `power` (session 3, perceptual at night; D-117 addendum: a lamp's 3.2 renderer cd
 *  is ~1 cd at the night gain) */
export const FIRE_CD_PER_POWER = 40;
/** the light's mean flicker (update(): 0.8 + 0.2 × the mean of two sines) */
export const FIRE_FLICKER_MEAN = 0.8;
/** One light model for a fire (D-216): what its point light is (renderer candela at fire scale 1, physical inverse-square
 *  decay, the cut-off window's distance) and where it stands above the fire's base. FireSystem.update sets its point
 *  lights from it and localIlluminance (the eye's adaptation) sums it, so the eye adapts to the light that is actually
 *  cast (render pass 2: the eye's estimate was power · 4 / (d² + 1), a tenth of the cast I / d², so a brazier-lit floor was
 *  exposed ~8× too bright and its inverse-square falloff sat in the tone curve's shoulder). */
export function fireLight(kind: FireKind) {
  const s = SPEC[kind];
  return { candela: s.power * FIRE_CD_PER_POWER, cutoff: s.range * 2.2, decay: 2, height: LIFT[kind] + s.flameH * 0.5 };
}
/** the distance attenuation three's point light applies (LightUtils getDistanceAttenuation: 1 / max(d^decay, 0.01) times
 *  the window (1 − (d / cutoff)⁴)², Frostbite / Karis), mirrored on the CPU */
export function pointAttenuation(d: number, cutoff: number, decay = 2): number {
  const f = 1 / Math.max(Math.pow(d, decay), 0.01);
  if (!(cutoff > 0)) return f;
  const w = Math.min(1, Math.max(0, 1 - Math.pow(d / cutoff, 4)));
  return f * w * w;
}
/** irradiance a fire's own light puts on the horizontal floor it stands on, `r` m from its foot (renderer units, fire scale
 *  1, mean flicker): I · cos θ · attenuation(d) with the light `height` above the floor (D-216; tests/fire_light.test.ts) */
export function fireFloorIrradiance(kind: FireKind, r: number, scale = 1): number {
  const L = fireLight(kind), d = Math.hypot(r, L.height);
  return L.candela * FIRE_FLICKER_MEAN * scale * (L.height / d) * pointAttenuation(d, L.cutoff, L.decay);
}
/** a roofed hall's interior, world coordinates (x0 < x1, z0 < z1; floor y0 to ceiling y1) */
export interface RoomBox { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }
/** how far a fire's light reaches into the thickness of its hall's walls (m): the reveals of the doorways and windows beside
 *  a torch; the halls' walls are 1.7–5.3 m thick (SITE_SPEC), so their outer faces stay out of reach (D-216, C) */
export const ROOM_MARGIN = 0.8;
/** CPU mirror of roomMask: 1 where a light of mode `mode` confined to `r` reaches the point */
export function roomMaskAt(r: RoomBox, mode: number, x: number, y: number, z: number): number {
  const M = ROOM_MARGIN, inB = x > r.x0 - M && x < r.x1 + M && z > r.z0 - M && z < r.z1 + M && y > r.y0 - M && y < r.y1 + M ? 1 : 0;
  return mode > 0 ? inB : mode < 0 ? 1 - inB : 1;
}
/** TSL: the point lights cast no shadows, so without this a torch inside a hall lit the portico through a 5 m wall, and a
 *  brazier outside lit the hall's floor through it. The light is confined to its side of the hall's walls: a fire inside a
 *  hall lights only its interior (and ROOM_MARGIN into the walls), a fire outside lights nothing inside the nearest hall.
 *  Light through the doorways between the two is left out (C; D-216) */
function roomMask(box: any, ys: any, mode: any) {
  const p = positionWorld, M = ROOM_MARGIN;
  const inB = step(box.x.sub(M), p.x).mul(step(p.x, box.y.add(M))).mul(step(box.z.sub(M), p.z)).mul(step(p.z, box.w.add(M)))
    .mul(step(ys.x.sub(M), p.y)).mul(step(p.y, ys.y.add(M)));
  const pos = max(mode, 0), neg = max(mode.negate(), 0);
  return float(1).sub(pos).add(pos.mul(inB)).mul(float(1).sub(neg.mul(inB)));
}
// ~1900 K blackbody (Planck, sRGB-normalised) — the colour temperature of wood/oil flames (C)
const FIRE_RGB = new THREE.Color().setRGB(1.0, 0.52, 0.18);

/** the sky and sun as the smoke sees them: SkySystem (horizon radiance, hemisphere light, sun) */
export interface SmokeSky { horizon: THREE.Color; hemi?: THREE.HemisphereLight; sun: THREE.DirectionalLight; state: { sunDir: THREE.Vector3 }; fireScale?: number }
/** ground albedo under the smoke for the light it reflects up into it (C) */
const SMOKE_GROUND_ALBEDO = 0.25;
/** radiance the skylight gives an optically thin smoke by single scattering, before the albedo (D-070): the isotropic
 *  part of the phase function sees the mean radiance over the sphere, the sky above (hemisphere irradiance E / pi, the
 *  radiance the calibrated dome averages to, D-060) and the ground below (albedo x E / pi), halved. It was the horizon
 *  radiance in the view direction, the colour of whatever lies behind the smoke at a distance, so town smoke and haze
 *  vanished into the distance they stood against (measured: terrace-w-dusk with and without the town differed in < 1,000 px) */
export function smokeSkyRadiance(sky: SmokeSky, out: THREE.Color): THREE.Color {
  if (!sky.hemi) return out.copy(sky.horizon);
  return out.copy(sky.hemi.color).multiplyScalar((sky.hemi.intensity * (1 + SMOKE_GROUND_ALBEDO)) / (2 * Math.PI));
}
export class FireSystem {
  readonly group = new THREE.Group();
  readonly fires: FireSource[] = [];
  private flames!: THREE.InstancedMesh;
  private lights: THREE.PointLight[] = [];
  private smoke!: THREE.InstancedMesh;
  private smokeP: { pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; power?: number }[] = [];
  private smokeGlow!: THREE.InstancedBufferAttribute;
  // light on the smoke (session 3, D-060, D-070): the skylight scattered by the smoke (smokeSkyRadiance), the sun through a
  // forward-peaked phase function, and the fire below it; set each frame by setSkyLight (was a constant unlit grey,
  // which glowed on a moonless night)
  private uSky = uniform(new THREE.Color(0.3, 0.3, 0.3)); private uSun = uniform(new THREE.Color(0, 0, 0)); private uSunDir = uniform(new THREE.Vector3(0, 1, 0));
  setSkyLight(sky: SmokeSky | null | undefined) {
    if (!sky?.horizon || !sky.sun) return; smokeSkyRadiance(sky, this.uSky.value);
    this.lightScale = sky.fireScale ?? 1; // cast light pre-exposed for night: scaled with the sky's gain in twilight and day (D-117)
    this.uSun.value.copy(sky.sun.color).multiplyScalar(sky.sun.visible ? sky.sun.intensity : 0); this.uSunDir.value.copy(sky.state.sunDir);
  }
  private smokeAlpha!: THREE.InstancedBufferAttribute;
  private lightScale = 1;
  private rng = new Rng(1, 'fire');
  private uLit = uniform(1);
  private flux!: THREE.InstancedBufferAttribute;
  /** `shadowLights`: how many of the nearest fires' lights cast shadows (cube maps of `shadowMapSize`; 0 by default: D-216,
   *  measured cost in BLOCKERS) */
  constructor(maxLights: number, shadowLights = 0, shadowMapSize = 512) {
    this.group.name = 'fire';
    // ?fireocc=0 (diagnostic, D-222): the fire lights without the baked occlusion
    const useOcc = fireOcc() !== null && !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('fireocc') === '0');
    for (let i = 0; i < maxLights; i++) {
      const l = new THREE.PointLight(FIRE_RGB, 0, 20, 2); l.castShadow = i < shadowLights; this.lights.push(l); this.group.add(l);
      if (l.castShadow) { l.shadow.mapSize.set(shadowMapSize, shadowMapSize); l.shadow.camera.near = 0.1; l.shadow.camera.far = 50; l.shadow.bias = -0.0005; (l.shadow as any).normalBias = 0.05; }
      // the light confined to its side of a hall's walls (D-216, roomMask): the light's colour × intensity × the mask
      const c = new THREE.Color(), box = uniform(new THREE.Vector4(0, 0, 0, 0)), ys = uniform(new THREE.Vector2(0, 0)), mode = uniform(0);
      // and in the shade of the architecture for the Terrace's fixed fires (D-222, B24: the baked occlusion atlas, fireOcc.ts)
      const lp = uniform(new THREE.Vector3()), tile = uniform(-1);
      const col = uniform(c).onRenderUpdate(() => c.copy(l.color).multiplyScalar(l.intensity)).mul(roomMask(box, ys, mode));
      (l as any).colorNode = useOcc ? col.mul(fireOccNode(lp, tile)) : col;
      this.lightRoom.push({ box, ys, mode, lp, tile });
    }
  }
  /** per light: the room box its light is confined to (world x0, x1, z0, z1; y0, y1) and the mode (+1 inside it only, −1
   *  outside it only, 0 unconfined) */
  private lightRoom: { box: any; ys: any; mode: any; lp: any; tile: any }[] = [];
  /** the roofed halls' interiors (world boxes); set before build() (world.ts placeFires) */
  private rooms: RoomBox[] = [];
  setRooms(rooms: RoomBox[]) { this.rooms = rooms; }
  /** the room a fire's light is confined to (D-216): the hall whose interior holds the fire (+1), else the nearest hall
   *  interior within the light's cut-off (−1: its light stays out of it), else none */
  roomOf(f: FireSource): { room: RoomBox | null; mode: 1 | -1 | 0 } {
    const x = f.pos.x, z = f.pos.z, y = f.pos.y;
    const inside = this.rooms.find(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1 && y > r.y0 - 0.5 && y < r.y1);
    if (inside) return { room: inside, mode: 1 };
    const cut = fireLight(f.kind).cutoff; let best: RoomBox | null = null, bd = cut;
    for (const r of this.rooms) { const d = Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1)); if (d < bd) { bd = d; best = r; } }
    return best ? { room: best, mode: -1 } : { room: null, mode: 0 };
  }
  /** `base` = where the object stands (floor) or, for torches, the bracket point on the wall */
  /** `meta.body: false` = the caller draws the fire's body itself (the settlement merges its hearths and ovens) */
  add(kind: FireKind, base: THREE.Vector3, meta: { tier: string; src: string; note: string; sched?: FireSchedule; group?: string; body?: boolean }) {
    const lift = LIFT[kind];
    const { body, ...m } = meta;
    this.fires.push({ id: `${kind}-${this.fires.length}`, kind, pos: base.clone().add(new THREE.Vector3(0, lift, 0)), lit: false, seed: this.rng.next() * 100, ...m });
    if (body !== false) this.bodies.push({ kind, base: base.clone() });
  }
  private bodies: { kind: FireKind; base: THREE.Vector3 }[] = [];
  /** simple physical bodies (C forms): brazier = bronze bowl on a stand (after the incense stands on the reliefs), torch = wooden
   *  shaft in a bronze bracket, hearth = ring of stones, oven = clay dome */
  private buildBodies() {
    const mk = (g: THREE.BufferGeometry, color: number, rough: number, metal = 0) => ({ g, m: new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(color), roughness: rough, metalness: metal }) });
    const brz = new THREE.LatheGeometry([[0.02, 0], [0.18, 0.02], [0.08, 0.1], [0.05, 0.8], [0.12, 0.84], [0.32, 0.9], [0.36, 1.02], [0.3, 1.0], [0.0, 0.92]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
    const torch = new THREE.CylinderGeometry(0.03, 0.025, 0.6, 6).translate(0, 0.05, 0.1).rotateX(-0.25);
    const hearth = new THREE.TorusGeometry(0.45, 0.12, 5, 10).rotateX(Math.PI / 2).translate(0, 0.1, 0);
    const oven = new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const kinds: Record<string, { g: THREE.BufferGeometry; m: THREE.Material }> = {
      // the bronze of the braziers is the fittings' surface (materials.ts SURFACES.bronze), whose specular reads the sky
      // environment (D-157): a plain metal material here reflected nothing but the sun's highlight, and a stand in shade
      // rendered as a pure-black cut-out (session-6 rubric, apadana-enter; D-187)
      brazier: { g: brz, m: surfaceMaterial('bronze') }, torch: mk(torch, 0x5a4028, 0.8), hearth: mk(hearth, 0x7a7266, 0.9), oven: mk(oven, 0x9a7a58, 0.95),
    };
    for (const [k, v] of Object.entries(kinds)) {
      const list = this.bodies.filter(b => b.kind === k); if (!list.length) continue;
      const im = new THREE.InstancedMesh(v.g, v.m, list.length); const m4 = new THREE.Matrix4();
      list.forEach((b, i) => { m4.makeTranslation(b.base.x, b.base.y, b.base.z); im.setMatrixAt(i, m4); });
      im.castShadow = true; im.receiveShadow = true; im.name = `fire-body:${k}`; im.userData = { tier: 'C', src: 'RECON', note: `${k} (form C; brazier after the incense stands on the audience relief, B type)` };
      this.group.add(im);
    }
  }
  /** build GPU objects once all fires are registered */
  build() {
    this.buildBodies();
    const n = Math.max(1, this.fires.length);
    const plane = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const seedAttr = new THREE.InstancedBufferAttribute(new Float32Array(n), 1); this.fires.forEach((f, i) => (seedAttr.array[i] = f.seed));
    plane.setAttribute('aSeed', seedAttr);
    this.flux = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1); plane.setAttribute('aFlux', this.flux);
    const m = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    const u = uv(), seed = attribute('aSeed', 'float');
    const n1 = mx_noise_float(vec3(u.x.mul(3), u.y.mul(2.5).sub(time.mul(2.2)), seed)).mul(0.5).add(0.5);
    const shape = smoothstep(0.0, 0.5, length(vec2(u.x.sub(0.5).mul(2.0), u.y.sub(0.35).mul(1.1)))).oneMinus().mul(smoothstep(0.5, 1.0, u.y).oneMinus());
    const a = max(float(0), shape.mul(n1.mul(1.6)).sub(0.25)).mul(this.uLit);
    const hot = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.85, 0.5), smoothstep(0.2, 0.9, a));
    m.colorNode = vec4(hot.mul(a.mul(3.0)).mul(attribute('aFlux', 'float')), a); m.opacityNode = a;
    this.flames = new THREE.InstancedMesh(plane, m, n); this.flames.frustumCulled = false; this.flames.renderOrder = 5;
    this.flames.userData = { tier: 'C', src: 'RECON', note: 'flame billboards (procedural); fire placements C unless noted' };
    this.group.add(this.flames);
    // smoke puffs: soft quads, per-instance alpha
    const SMAX = 400; const sq = new THREE.PlaneGeometry(1, 1);
    this.smokeAlpha = new THREE.InstancedBufferAttribute(new Float32Array(SMAX), 1); sq.setAttribute('aAlpha', this.smokeAlpha);
    const sm = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const su = uv(); const r = length(su.sub(0.5)).mul(2);
    const puff = smoothstep(0.2, 1.0, r).oneMinus().mul(mx_noise_float(vec3(su.mul(3), time.mul(0.1))).mul(0.3).add(0.7));
    this.smokeGlow = new THREE.InstancedBufferAttribute(new Float32Array(SMAX), 1); sq.setAttribute('aGlow', this.smokeGlow);
    { const OMEGA = 0.9, G = 0.6; // single-scattering albedo and Henyey–Greenstein asymmetry of wood smoke (C)
      const cosT = dot(normalize(positionWorld.sub(cameraPosition)), this.uSunDir);
      const hg = float((1 - G * G) / (4 * Math.PI)).div(pow(float(1 + G * G).sub(cosT.mul(2 * G)), 1.5));
      sm.colorNode = (this.uSky as any).add((this.uSun as any).mul(hg)).mul(OMEGA).add(vec3(1.0, 0.55, 0.25).mul(attribute('aGlow', 'float'))); }
    sm.opacityNode = puff.mul(attribute('aAlpha', 'float'));
    this.smoke = new THREE.InstancedMesh(sq, sm, SMAX); this.smoke.frustumCulled = false; this.smoke.count = 0; this.smoke.renderOrder = 4;
    this.smoke.userData = { tier: 'C', src: 'RECON', note: 'smoke puffs (procedural), drift with the weather wind' };
    this.group.add(this.smoke);
  }
  /** lit state: fires burn from dusk (sun < 4° and falling or night) until after sunrise (C schedule) */
  update(dt: number, camera: THREE.Camera, sunAlt: number, windMs: number, windDirDeg: number, rain: number, t: number, hour?: number) {
    const lit = sunAlt < 4;
    for (const f of this.fires) f.lit = (hour === undefined || !f.sched || f.sched === 'night' ? lit : scheduleLit(f.sched, hour, sunAlt, f.seed)) && !(rain > 0.6 && (f.kind === 'brazier' || f.kind === 'hearth'));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    // flames: cylindrical billboards (yaw only) facing the camera, no narrower than FLAME_MIN_PX with their light conserved
    const viewH = typeof innerHeight === 'number' ? innerHeight : 1080, fov = (camera as THREE.PerspectiveCamera).fov ?? 70;
    const pxPerRad = viewH / 2 / Math.tan((fov * Math.PI) / 360);
    this.fires.forEach((f, i) => {
      const s = SPEC[f.kind]; const sc = f.lit ? 1 : 0;
      const flick = 0.85 + 0.15 * Math.sin(t * 13 + f.seed) * Math.sin(t * 7.3 + f.seed * 2);
      const { k, flux } = flameFootprint(s.flameW, f.pos.distanceTo(camera.position), pxPerRad); this.flux.array[i] = flux;
      e.set(0, Math.atan2(camera.position.x - f.pos.x, camera.position.z - f.pos.z), 0); q.setFromEuler(e);
      m4.compose(f.pos, q, new THREE.Vector3(s.flameW * sc * k, s.flameH * sc * flick * k, 1)); this.flames.setMatrixAt(i, m4);
    });
    this.flames.instanceMatrix.needsUpdate = true; this.flux.needsUpdate = true;
    // lights to the nearest lit fires (the fire light model, fireLight)
    const lit_ = this.lightedFires(camera.position);
    this.lights.forEach((l, i) => {
      const f = lit_[i]; if (!f) { l.intensity = 0; l.visible = false; return; }
      const L = fireLight(f.kind); l.visible = true;
      { const R = this.roomOf(f), u = this.lightRoom[i]; u.mode.value = R.mode;
        if (R.room) { u.box.value.set(R.room.x0, R.room.x1, R.room.z0, R.room.z1); u.ys.value.set(R.room.y0, R.room.y1); } }
      l.position.copy(f.pos).y += L.height - LIFT[f.kind];
      { const u = this.lightRoom[i]; if (f.occ === undefined) f.occ = tileOf(fireOcc(), l.position.x, l.position.y, l.position.z); u.tile.value = f.occ; u.lp.value.copy(l.position); }
      const flick = 0.8 + 0.2 * (Math.sin(t * 11 + f.seed) * 0.5 + Math.sin(t * 17.3 + f.seed * 3) * 0.5);
      l.intensity = L.candela * flick * this.lightScale; l.distance = L.cutoff; l.decay = L.decay;
    });
    // smoke
    const wr = ((windDirDeg + 180 - 341) * Math.PI) / 180; // wind blows FROM windDir; grid frame
    const wind = new THREE.Vector3(Math.sin(wr) * windMs, 0, -Math.cos(wr) * windMs);
    const cp = camera.position;
    for (const f of this.fires) {
      const s = SPEC[f.kind]; if (!f.lit || s.smoke <= 0) continue;
      if (f.pos.distanceToSquared(cp) > SMOKE_RANGE * SMOKE_RANGE) continue;
      if (this.rng.next() < s.smoke * dt * 3 && this.smokeP.length < 400)
        this.smokeP.push({ power: s.power, pos: f.pos.clone().add(new THREE.Vector3(0, s.flameH, 0)), vel: new THREE.Vector3((this.rng.next() - 0.5) * 0.2, 0.5 + this.rng.next() * 0.4, (this.rng.next() - 0.5) * 0.2), age: 0, life: 6 + this.rng.next() * 6, size: 0.4 });
    }
    let k = 0; const camQ = camera.quaternion;
    this.smokeP = this.smokeP.filter(p => (p.age += dt) < p.life);
    for (const p of this.smokeP) {
      p.vel.lerp(new THREE.Vector3(wind.x * 0.6, 0.35, wind.z * 0.6), Math.min(1, dt * 0.5)); p.pos.addScaledVector(p.vel, dt); p.size += dt * 0.35;
      m4.compose(p.pos, camQ, new THREE.Vector3(p.size, p.size, p.size)); this.smoke.setMatrixAt(k, m4);
      this.smokeAlpha.array[k] = 0.35 * Math.min(1, p.age * 2) * (1 - p.age / p.life);
      this.smokeGlow.array[k] = (p.power ?? 1) * 0.6 * Math.exp(-p.age * 1.5); k++; // lit by its fire as it leaves the flame (C)
    }
    this.smoke.count = k; this.smoke.instanceMatrix.needsUpdate = true; this.smokeAlpha.needsUpdate = true; this.smokeGlow.needsUpdate = true;
  }
  /** the lit fires that get a point light for an eye at `p`: the nearest `lights.length` within 90 m */
  private lightedFires(p: THREE.Vector3): FireSource[] {
    return this.fires.filter(f => f.lit).map(f => ({ f, d: f.pos.distanceTo(p) })).sort((a, b) => a.d - b.d)
      .slice(0, this.lights.length).filter(x => x.d <= 90).map(x => x.f);
  }
  /** illuminance at `p` (renderer units, on a surface facing each fire: the eye's adaptation) from the fires' cast light
   *  as the point lights cast it (fireLight: the same candela, mean flicker, decay and cut-off window; D-216) */
  localIlluminance(p: THREE.Vector3) {
    let e = 0; const q = new THREE.Vector3();
    for (const f of this.lightedFires(p)) { const L = fireLight(f.kind); q.copy(f.pos); q.y += L.height - LIFT[f.kind];
      e += L.candela * FIRE_FLICKER_MEAN * pointAttenuation(q.distanceTo(p), L.cutoff, L.decay); }
    return e * this.lightScale;
  }
  stats() { return { fires: this.fires.length, lit: this.fires.filter(f => f.lit).length, smoke: this.smokeP.length }; }
}

/** lit state of a scheduled fire (C). `seed` (0..100) staggers the fires so a town lights up over an hour, not at once. */
export function scheduleLit(sched: FireSchedule, hour: number, sunAlt: number, seed: number): boolean {
  const j = (seed % 1 + (seed * 0.137) % 1) % 1; // 0..1
  const pm = hour >= 12;
  switch (sched) {
    case 'home': return pm ? sunAlt < 6 - 10 * j && sunAlt > -(16 + 20 * j) : sunAlt > -(8 + 8 * j) && sunAlt < 6 + 10 * j;
    case 'bake': return !pm ? sunAlt > -(12 + 6 * j) && sunAlt < 10 + 18 * j : j < 0.25 && sunAlt < 3 && sunAlt > -10;
    case 'day': return hour > 6.5 + j && hour < 16 + 1.5 * j && sunAlt > -2;
    case 'kept': return true;
    default: return sunAlt < 4;
  }
}
