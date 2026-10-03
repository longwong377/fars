// Fire, light and smoke (brief §5.4). Every fire is a real object (torch, brazier, hearth, oven, lamp) with a flame
// billboard, a flickering light (nearest N fires get a real point light; colour ≈ 1800–2000 K) and optional smoke
// that drifts with the wind. Fires are lit at dusk and put out after the night (C schedule until NPCs light them, Phase 5).
import * as THREE from 'three/webgpu';
import { colourOnly } from '../render/fx';
import { surfaceMaterial, propMaterial } from '../render/materials';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { modelParts, colourByAO } from '../render/scanProps';
import { uniform, uv, vec3, vec4, float, mx_noise_float, time, attribute, smoothstep, mix, length, vec2, max, positionWorld, cameraPosition, normalize, dot, pow, step } from 'three/tsl';
import { Rng } from '../core/rng';
import { fireOcc, fireOccNode, tileOf } from './fireOcc';
import { FIRE_GLOW, GLOW_MAX } from '../render/fireGlow';
import { SOURCE, FORGE_GH, sourceTau, windWorld } from './hearthSmoke';

export type FireKind = 'torch' | 'brazier' | 'hearth' | 'oven' | 'lamp' | 'kiln' | 'altar';
/** when a fire burns (C schedules): 'night' dusk to after sunrise (default); 'home' a domestic hearth, lit as the light
 *  goes for the evening meal and banked a few hours after dark, relit before dawn; 'bake' a bread oven, before dawn into
 *  the morning; 'day' a workshop fire (kiln, forge) in working hours; 'kept' a fire that is never let go out (D-209: the
 *  precinct's altar, fed at dawn and dusk and sheltered in rain by the magi, C). Needs the local hour (update's last argument). */
export type FireSchedule = 'night' | 'home' | 'bake' | 'day' | 'kept';
/** `plot`: the town house plot the fire belongs to (settlement build.ts): the household living there drives a 'home' hearth
 *  and a 'bake' oven (D-220, hearthSmoke.ts) */
export interface FireSource { id: string; kind: FireKind; pos: THREE.Vector3; lit: boolean; seed: number; tier: string; src: string; note: string; sched?: FireSchedule; group?: string; plot?: string;
  /** D-254: a fire whose flame, beyond SLOW_R of the eye, is redrawn one frame in SLOW_N (its flicker is not seen from there;
   *  the villages' ~8,000 hearths and lamps) */ slow?: boolean;
  /** its tile in the baked fire-light occlusion atlas (D-222), −1 when not baked (the town's fires); set on first use */ occ?: number;
  /** D-530: a fire that burns only while this says so (a court camp's hearth while its tent stands), on top of its schedule */ stands?: () => boolean }
const SPEC: Record<FireKind, { flameH: number; flameW: number; power: number; range: number; smoke: number }> = {
  torch: { flameH: 0.45, flameW: 0.22, power: 1.2, range: 14, smoke: 0.2 },
  brazier: { flameH: 0.7, flameW: 0.55, power: 2.4, range: 22, smoke: 0.5 },
  hearth: { flameH: 0.5, flameW: 0.6, power: 1.6, range: 14, smoke: 1.0 },
  oven: { flameH: 0.25, flameW: 0.4, power: 0.8, range: 8, smoke: 1.2 },
  lamp: { flameH: 0.06, flameW: 0.03, power: 0.08, range: 3.5, smoke: 0.0 }, // (D-530: a brighter lamp, unshadowed, lit the street facade behind its ledge: reverted)
  kiln: { flameH: 0.35, flameW: 0.5, power: 1.4, range: 10, smoke: 1.6 },
  // D-209: the kept fire on the precinct's stepped altar: a wood fire in the open, a little larger than a hearth's (C)
  altar: { flameH: 0.6, flameW: 0.55, power: 1.9, range: 16, smoke: 1.1 },
};
/** smoke puffs come only from fires within this distance of the camera (the pool is shared; far smoke is the town's plumes
 *  and the smoke layer over the town and villages, landSmoke.ts) */
export const SMOKE_RANGE = 300;
/** D-254: `slow` fires beyond SLOW_R (m) are redrawn one frame in SLOW_N */
export const SLOW_R = 250, SLOW_N = 8;
/** the near smoke puffs (D-220): a pool of SMOKE_MAX; each smoking fire, nearest first, gets PUFFS[kind] of them, each
 *  living PUFF_LIFE s on a cycle staggered by the fire's seed. Their places are closed-form in time (the velocity relaxes from
 *  the buoyant rise to the wind's drift at PUFF_RELAX /s), so a frozen test render (dt = 0) shows them: the old pool
 *  spawned puffs at a rate × dt and never had one in any moment render (rubric s7 pass 2: no smoke in any frame) */
export const SMOKE_MAX = 400, PUFF_LIFE = 8, PUFF_RELAX = 0.5;
export const PUFFS: Record<FireKind, number> = { torch: 3, brazier: 2, hearth: 5, oven: 6, lamp: 0, kiln: 8, altar: 6 };
/** one near puff of a fire at world time t: its offset from the fire (m), size (m), age (s) and optical depth scale */
export function puffAt(kind: FireKind, seed: number, j: number, t: number, wind: [number, number, number], out: { x: number; y: number; z: number; size: number; age: number; fade: number }) {
  const K = PUFFS[kind], cyc = t / PUFF_LIFE + j / K + seed * 0.618, ph = cyc - Math.floor(cyc), age = ph * PUFF_LIFE, n = Math.floor(cyc);
  const hsh = (a: number) => { const v = Math.sin(seed * 12.9898 + j * 78.233 + n * 37.719 + a * 4.581) * 43758.5453; return v - Math.floor(v); };
  const vx0 = (hsh(1) - 0.5) * 0.3, vz0 = (hsh(2) - 0.5) * 0.3, vy0 = 0.7 + hsh(3) * 0.4; // the buoyant rise off the fire (C)
  const vx = wind[0] * 0.6, vz = wind[2] * 0.6, vy = 0.35, e = (1 - Math.exp(-PUFF_RELAX * age)) / PUFF_RELAX;
  out.x = vx * age + (vx0 - vx) * e; out.y = vy * age + (vy0 - vy) * e; out.z = vz * age + (vz0 - vz) * e;
  out.size = Math.max(0.4, SOURCE[kind]?.w0 ?? 0.6) + 0.35 * age; out.age = age;
  out.fade = Math.min(1, age * 2) * (1 - ph); return out;
}
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
/** D-530: the coal bed's diameter (m) and its height over the fire's base (m) for the open fires; drawn within COAL_RANGE m */
const COAL_R: Partial<Record<FireKind, [number, number]>> = { hearth: [0.62, 0.07], brazier: [0.5, 0.97], altar: [0.7, 0.05] };
export const COAL_RANGE = 60;
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
export const FIRE_RGB = new THREE.Color().setRGB(1.0, 0.52, 0.18);

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
/** the forward fire lights at high before D-355 (the A/B's legacy set) */
export const LEGACY_FIRE_LIGHTS = 12;
/** D-355 A/B switch at run time (tests/e2e/dbg_perf.spec.ts): legacy = the session-13 fire lights (12 forward, no deferred term) */
export const FIRE_AB = { legacy: false };
if (typeof globalThis !== 'undefined') (globalThis as any).__parsaFire = FIRE_AB;
/** D-680: the world's day for the occasional fires (firePlaces.ts: the night watch's braziers on the court's residence
 *  nights, the banquet's lights, the palaces' doorway torches): set by FireSystem.setDay (day -1 = unknown: the watch's
 *  braziers burn every night, the banquet's never) and the hour by update */
export const FIRE_DAY = { day: -1, seed: 1, hour: 12 };
/** the day a night belongs to: before noon, the night began the evening before */
export const nightOf = (day: number, hour: number) => (hour < 12 ? day - 1 : day);
export class FireSystem {
  readonly group = new THREE.Group();
  readonly fires: FireSource[] = [];
  private flames!: THREE.InstancedMesh;
  private lights: THREE.PointLight[] = [];
  private smoke!: THREE.InstancedMesh;
  private smokeGlow!: THREE.InstancedBufferAttribute;
  // light on the smoke (session 3, D-060, D-070): the skylight scattered by the smoke (smokeSkyRadiance), the sun through a
  // forward-peaked phase function, and the fire below it; set each frame by setSkyLight (was a constant unlit grey,
  // which glowed on a moonless night)
  private uSky = uniform(new THREE.Color(0.3, 0.3, 0.3)); private uSun = uniform(new THREE.Color(0, 0, 0)); private uSunDir = uniform(new THREE.Vector3(0, 1, 0));
  setSkyLight(sky: SmokeSky | null | undefined) {
    if (!sky?.horizon || !sky.sun) return; smokeSkyRadiance(sky, this.uSky.value);
    { // D-530: the daylight outside the town's doorways (horizontal irradiance, renderer units)
      const alt = sky.state.sunDir.y; this.dayE = (sky.sun.visible ? sky.sun.intensity * Math.max(0, alt) : 0) + (sky.hemi ? sky.hemi.intensity : 0);
      if (sky.hemi) this.daySky.copy(sky.hemi.color); }
    this.lightScale = sky.fireScale ?? 1; // cast light pre-exposed for night: scaled with the sky's gain in twilight and day (D-117)
    this.uSun.value.copy(sky.sun.color).multiplyScalar(sky.sun.visible ? sky.sun.intensity : 0); this.uSunDir.value.copy(sky.state.sunDir);
  }
  private smokeAlpha!: THREE.InstancedBufferAttribute;
  /** D-530: daylight ports (townPorts: x, y, z, nx, nz) and the daylight outside them */
  private ports: Float32Array = new Float32Array(0); private dayE = 0; private daySky = new THREE.Color(1, 1, 1); private portNear: number[] = []; private portEye = new THREE.Vector3(1e9, 0, 0);
  setPorts(p: Float32Array) { this.ports = p; this.portEye.set(1e9, 0, 0);
    // each port's room fire: the nearest lamp, hearth or oven within PORT_FIRE_R m on the room's side of the doorway (-1: none)
    const n = p.length / 5, pf = this.portFire = new Int32Array(n).fill(-1), G = new Map<string, number[]>(), C = 8, key = (x: number, z: number) => `${Math.floor(x / C)},${Math.floor(z / C)}`;
    this.fires.forEach((f, i) => { if (f.kind !== 'lamp' && f.kind !== 'hearth' && f.kind !== 'oven') return; const k = key(f.pos.x, f.pos.z); (G.get(k) ?? G.set(k, []).get(k)!).push(i); });
    for (let k = 0; k < n; k++) { const x = p[k * 5], z = p[k * 5 + 2], nx = p[k * 5 + 3], nz = p[k * 5 + 4]; let best = PORT_FIRE_R * PORT_FIRE_R;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const i of G.get(`${Math.floor(x / C) + a},${Math.floor(z / C) + b}`) ?? []) {
        const f = this.fires[i], dx = f.pos.x - x, dz = f.pos.z - z, d = dx * dx + dz * dz; if (d < best && dx * nx + dz * nz > 0.3 && Math.abs(f.pos.y - p[k * 5 + 1]) < 2.5) { best = d; pf[k] = i; } } }
  }
  private portFire: Int32Array = new Int32Array(0);
  private lightScale = 1;
  private rng = new Rng(1, 'fire');
  private uLit = uniform(1);
  /** the people's fires (D-220, hearthSmoke.ts SmokeModel): per fire 1 = flame shown, 0 = out or embers, −1 = its own schedule;
   *  and its smoke emission (g/h; −1 = its kind's default while lit). Set by the world before update() */
  simLit: Int8Array | null = null; simGh: Float32Array | null = null;
  setSimState(lit: Int8Array, gh: Float32Array) { this.simLit = lit; this.simGh = gh; }
  /** smoke emission of fire i now (g/h of particles): the household day's phase where one drives it, else its kind's
   *  (a forge's charcoal for a workshop 'day' hearth) while lit */
  emission(i: number): number {
    const g = this.simGh?.[i] ?? -1; if (g >= 0) return g; const f = this.fires[i]; if (!f.lit) return 0;
    return f.kind === 'hearth' && f.sched === 'day' ? FORGE_GH : SOURCE[f.kind]?.gh ?? 0;
  }
  private smokeN = 0;
  private flux!: THREE.InstancedBufferAttribute;
  private drawnLit: Uint8Array | null = null; private frameN = 0;
  /** `shadowLights`: how many of the nearest fires' lights cast shadows (cube maps of `shadowMapSize`; 0 by default: D-216,
   *  measured cost in BLOCKERS). `glowLights` (D-355): how many of the next nearest lit fires light the scene through the post
   *  composite's deferred term (render/fireGlow.ts; high/ultra), not as forward lights */
  constructor(maxLights: number, shadowLights = 0, shadowMapSize = 512, glowLights = 0) {
    this.glowN = Math.min(glowLights, GLOW_MAX);
    // D-530: at high and ultra (the deferred term on) the nearest FIRE_SHADOW_LIGHTS fires cast soft shadows (cube maps
    // rendered when the light moves to another fire and refreshed in turn, not every frame: the fires and the walls stand
    // still), where the adapter binds enough textures (B24: 16 failed); ?fireshadows=K sets K
    const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    if (!shadowLights && glowLights > 0 && !qs?.has('fireshadows') && TEX_LIMIT.n >= 32) shadowLights = Math.min(FIRE_SHADOW_LIGHTS, maxLights);
    this.shadowN = shadowLights; this.shadowOf = new Array(shadowLights).fill(null);
    this.group.name = 'fire';
    // ?fireocc=0 (diagnostic, D-222): the fire lights without the baked occlusion
    const useOcc = this.useOcc = fireOcc() !== null && !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('fireocc') === '0');
    // D-355 A/B (dbg_perf): with the deferred term, LEGACY_FIRE_LIGHTS − maxLights more lights are made, hidden; __parsaFire.legacy = true
    // shows them and drops the deferred term (the session-13 set: 12 forward lights), for the measurement in one page load
    this.forwardN = maxLights;
    const made = this.glowN > 0 ? Math.max(maxLights, LEGACY_FIRE_LIGHTS) : maxLights;
    for (let i = 0; i < made; i++) {
      // D-355: a fixed set of lights from frame 0, always visible (intensity 0 when free): the set of visible lights is part of
      // every lit material's shader key, so a light switched on or off rebuilt and recompiled every lit pipeline (seconds to
      // minutes on the T4) each time the number of lit fires within reach changed
      const l = new THREE.PointLight(FIRE_RGB, 0, 20, 2); l.castShadow = i < shadowLights; this.lights.push(l); this.group.add(l); l.visible = i < maxLights;
      if (l.castShadow) { l.shadow.mapSize.set(shadowMapSize, shadowMapSize); l.shadow.camera.near = 0.05; l.shadow.camera.far = 50; l.shadow.bias = -0.002; (l.shadow as any).normalBias = 0.03; l.shadow.radius = FIRE_SHADOW_RADIUS; l.shadow.autoUpdate = false; l.shadow.needsUpdate = true; }
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
  /** D-530: the shadow-casting forward lights and the fire each one's cube map was last drawn for */
  private shadowN = 0; private shadowOf: (FireSource | null)[] = [];
  /** deferred fire lights (D-355; render/fireGlow.ts) */
  private glowN = 0;
  private forwardN = 0;
  private useOcc = false;
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
  add(kind: FireKind, base: THREE.Vector3, meta: { tier: string; src: string; note: string; sched?: FireSchedule; group?: string; plot?: string; body?: boolean; slow?: boolean; stands?: () => boolean }) {
    const lift = LIFT[kind];
    const { body, ...m } = meta;
    this.fires.push({ id: `${kind}-${this.fires.length}`, kind, pos: base.clone().add(new THREE.Vector3(0, lift, 0)), lit: false, seed: this.rng.next() * 100, ...m });
    if (body !== false) this.bodies.push({ kind, base: base.clone() });
  }
  private bodies: { kind: FireKind; base: THREE.Vector3 }[] = [];
  /** simple physical bodies (C forms): brazier = bronze bowl on a stand (after the incense stands on the reliefs), torch = wooden
   *  shaft in a bronze bracket, hearth = ring of stones, oven = clay dome */
  private buildBodies() {
    const brz = new THREE.LatheGeometry([[0.02, 0], [0.18, 0.02], [0.08, 0.1], [0.05, 0.8], [0.12, 0.84], [0.32, 0.9], [0.36, 1.02], [0.3, 1.0], [0.0, 0.92]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
    const torch = new THREE.CylinderGeometry(0.03, 0.025, 0.6, 6).translate(0, 0.05, 0.1).rotateX(-0.25);
    // D-301: the hearth a ring of eleven field stones of their own sizes and tilts (was a 10-sided torus), the oven's dome smooth
    const hearth = mergeGeometries(Array.from({ length: 11 }, (_, i) => { const a = (i / 11) * Math.PI * 2 + 0.2 * Math.sin(i * 7.1), h = (k: number) => 0.5 + 0.5 * Math.sin(i * 12.9898 + k * 78.233);
      const st = new THREE.IcosahedronGeometry(0.1, 1); st.deleteAttribute('uv');
      return st.scale(0.9 + 0.5 * h(1), 0.7 + 0.5 * h(2), 0.8 + 0.4 * h(3)).rotateY(a + h(4)).rotateX(0.3 * (h(5) - 0.5)).translate(Math.cos(a) * (0.45 + 0.04 * h(6)), 0.06 + 0.03 * h(7), Math.sin(a) * (0.45 + 0.04 * h(6))); }))!;
    const oven = new THREE.SphereGeometry(0.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const kinds: Record<string, { g: THREE.BufferGeometry; m: THREE.Material }[] | { g: THREE.BufferGeometry; m: THREE.Material }> = {
      // the bronze of the braziers is the fittings' surface (materials.ts SURFACES.bronze), whose specular reads the sky
      // environment (D-157): a plain metal material here reflected nothing but the sun's highlight, and a stand in shade
      // rendered as a pure-black cut-out (session-6 rubric, apadana-enter; D-187)
      // (D-301: the torch's wood, the hearth's stones and the oven's clay take their scans: materials.ts propMaterial)
      brazier: { g: brz, m: surfaceMaterial('bronze') }, torch: { g: torch, m: propMaterial('wood', { color: [0x5a / 255, 0x40 / 255, 0x28 / 255], rough: 0.8 }) },
      hearth: { g: hearth, m: propMaterial('stone', { color: [0x7a / 255, 0x72 / 255, 0x66 / 255], rough: 0.9 }) }, oven: { g: oven, m: propMaterial('mud', { color: [0x9a / 255, 0x7a / 255, 0x58 / 255], rough: 0.95 }) },
    };
    // D-325: the bodies are the project's models (tools/blender/model_props.py), each part under its own material with the
    // baked occlusion in its vertex colour: the brazier a bronze tripod on lion's paws with its bowl and charcoal; the torch a
    // shaft with a head of tow in an iron bracket and wall plate; the hearth eleven field stones round a bed of ash; the oven a
    // coil-built dome with its arched mouth. The procedural forms above stay as the stand-ins when the models are not loaded
    const lin = (c: [number, number, number]): [number, number, number] => { const t = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [t.r, t.g, t.b]; };
    const MODELLED: Record<string, { id: string; parts: Record<string, [THREE.Material, [number, number, number]]> }> = {
      brazier: { id: 'brazier', parts: { bronze: [surfaceMaterial('bronze', { vertexColors: true }), [0.62, 0.45, 0.26]], coal: [propMaterial('stone', { vertexColors: true, rough: 0.95 }), [0.09, 0.08, 0.07]] } },
      torch: { id: 'torch', parts: { wood: [propMaterial('wood', { vertexColors: true, rough: 0.8 }), [0x5a / 255, 0x40 / 255, 0x28 / 255]], head: [propMaterial('textile', { vertexColors: true, rough: 0.95 }), [0.14, 0.11, 0.08]], bracket: [propMaterial('metal', { vertexColors: true, rough: 0.6, metal: 0.4 }), [0.28, 0.27, 0.26]] } },
      hearth: { id: 'hearth', parts: { stone: [propMaterial('stone', { vertexColors: true, rough: 0.9 }), [0x7a / 255, 0x72 / 255, 0x66 / 255]], ash: [propMaterial('mud', { vertexColors: true, rough: 1 }), [0.46, 0.44, 0.41]] } },
      oven: { id: 'oven', parts: { mud: [propMaterial('mud', { vertexColors: true, rough: 0.95 }), [0x9a / 255, 0x7a / 255, 0x58 / 255]] } },
    };
    for (const [k, v0] of Object.entries(kinds)) {
      const list = this.bodies.filter(b => b.kind === k); if (!list.length) continue;
      const M = MODELLED[k], mp = M ? modelParts(M.id, 0) : null;
      const pieces = mp ? Object.entries(mp).filter(([p]) => M!.parts[p]).map(([p, g]) => ({ g: colourByAO(g, lin(M!.parts[p][1])), m: M!.parts[p][0], part: p })) : (Array.isArray(v0) ? v0 : [v0]).map(x => ({ ...x, part: '' }));
      for (const v of pieces) {
        const im = new THREE.InstancedMesh(v.g, v.m, list.length); const m4 = new THREE.Matrix4();
        list.forEach((b, i) => { m4.makeTranslation(b.base.x, b.base.y, b.base.z); im.setMatrixAt(i, m4); });
        im.castShadow = true; im.receiveShadow = true; im.name = `fire-body:${k}${v.part ? ':' + v.part : ''}`;
        im.userData = { tier: 'C', src: 'RECON', placeholder: !mp, note: `${k} (form C; brazier after the incense stands on the audience relief, B type)${mp ? ' — modelled (D-325)' : ' — procedural stand-in'}` };
        this.group.add(im);
      }
    }
  }
  private built = false;
  /** D-530: fires registered after build() (the court camps' hearths: their tents are laid out by the people's sim, which is
   *  made after the fire system builds): `add` them, then call this; the flame billboards are re-made for the larger count
   *  (the same material: no new pipeline). Bodies are the caller's (body: false) */
  extend() {
    if (!this.built || !this.flames || this.flames.count >= this.fires.length) return;
    const old = this.flames; this.group.remove(old); old.geometry.dispose(); this.makeFlames(old.material as THREE.Material);
    this.drawnLit = null;
  }
  /** build GPU objects once all fires are registered */
  build() {
    this.buildBodies(); this.built = true;
    this.makeFlames(null); this.buildSmoke(); this.buildCoals();
  }
  /** D-530: the glowing bed of coals under the open fires (hearth, brazier, altar): a flat disc of embers whose glow breathes
   *  in patches, the light's colour at ~1000-1300 K (C); the flame stands on it */
  private coals: THREE.InstancedMesh | null = null; private coalIdx: number[] = []; private coalOn = new Int8Array(0).fill(-1);
  private buildCoals() {
    this.coalIdx = this.fires.map((f, i) => (COAL_R[f.kind] ? i : -1)).filter(i => i >= 0); this.coalOn = new Int8Array(this.coalIdx.length).fill(-1);
    if (!this.coalIdx.length) return;
    const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), n = this.coalIdx.length;
    const sd = new THREE.InstancedBufferAttribute(new Float32Array(n), 1); this.coalIdx.forEach((fi, k) => (sd.array[k] = this.fires[fi].seed)); g.setAttribute('aSeed', sd);
    const m = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    const u = uv(), seed = attribute('aSeed', 'float'), rr = length(u.sub(0.5)).mul(2);
    const cell = mx_noise_float(vec3(u.mul(9), seed)).mul(0.5).add(0.5), breathe = mx_noise_float(vec3(u.mul(3.5), time.mul(0.35).add(seed))).mul(0.5).add(0.5);
    const g0 = float(1).sub(smoothstep(0.25, 1.0, rr)).mul(smoothstep(0.35, 0.8, cell.mul(0.6).add(breathe.mul(0.6))));
    const col = mix(vec3(0.55, 0.06, 0.01), vec3(1.0, 0.32, 0.05), smoothstep(0.3, 0.9, g0));
    m.colorNode = vec4(col.mul(g0.mul(1.6)).mul(this.uLit), g0); m.opacityNode = g0;
    this.coals = new THREE.InstancedMesh(g, m, n); this.coals.frustumCulled = false; this.coals.renderOrder = 4; this.coals.name = 'fire:coals';
    this.coals.userData = { tier: 'C', src: 'RECON', note: 'the bed of glowing coals under an open fire (procedural glow; D-530)' };
    const m4 = new THREE.Matrix4(); this.coalIdx.forEach((_, k) => this.coals!.setMatrixAt(k, m4.makeScale(0, 0, 0)));
    this.group.add(this.coals);
  }
  private makeFlames(mat: THREE.Material | null) {
    const n = Math.max(1, this.fires.length);
    const plane = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const seedAttr = new THREE.InstancedBufferAttribute(new Float32Array(n), 1); this.fires.forEach((f, i) => (seedAttr.array[i] = f.seed));
    plane.setAttribute('aSeed', seedAttr);
    this.flux = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1); plane.setAttribute('aFlux', this.flux);
    if (mat) { this.flames = new THREE.InstancedMesh(plane, mat, n); this.flames.frustumCulled = false; this.flames.renderOrder = 5; this.flames.userData = mat.userData.flamesUD; this.group.add(this.flames); return; }
    const m = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    // D-530: a flame of tongues (was one soft noisy blob): the column narrows as it rises and is torn sideways by two
    // octaves of turbulence that rise through it, a bright yellow-white core low in the flame cooling through orange to a
    // deep red at the tongues' tips and edges (the blackbody ramp of a wood flame, C)
    const u = uv(), seed = attribute('aSeed', 'float'), tt = time.add(seed.mul(3.7));
    const x = u.x.sub(0.5).mul(2), y = u.y;
    const n1 = mx_noise_float(vec3(x.mul(1.6), y.mul(2.2).sub(tt.mul(2.6)), seed)), n2 = mx_noise_float(vec3(x.mul(4.2), y.mul(5.5).sub(tt.mul(5.2)), seed.add(7.3)));
    const xd = x.add(n1.mul(0.38).add(n2.mul(0.14)).mul(y.mul(1.2).add(0.1)));
    const wy = pow(float(1).sub(y).max(0), 0.85).mul(0.62).mul(smoothstep(0.0, 0.12, y).mul(0.5).add(0.5));
    const r = xd.abs().div(max(wy, 0.02));
    const top = float(1).sub(smoothstep(0.45, 0.95, y.add(n1.mul(0.22)).add(n2.mul(0.08))));
    const dens = float(1).sub(smoothstep(0.5, 1.0, r)).mul(top).mul(n2.mul(0.35).add(0.85)).max(0);
    const core = float(1).sub(smoothstep(0.0, 0.55, r)).mul(float(1).sub(smoothstep(0.08, 0.5, y.add(n1.mul(0.1))))).max(0);
    const a = smoothstep(0.04, 0.4, dens).mul(this.uLit);
    const temp = dens.mul(0.75).add(core.mul(0.7)).min(1.4);
    const hot = mix(mix(vec3(0.7, 0.1, 0.015), vec3(1.0, 0.38, 0.06), smoothstep(0.1, 0.55, temp)), vec3(1.0, 0.8, 0.42), smoothstep(0.6, 1.2, temp)).add(vec3(0.25, 0.2, 0.12).mul(core));
    m.colorNode = vec4(hot.mul(a.mul(2.4).add(core.mul(2.2))).mul(attribute('aFlux', 'float')), a); m.opacityNode = a;
    this.flames = new THREE.InstancedMesh(plane, m, n); this.flames.frustumCulled = false; this.flames.renderOrder = 5;
    this.flames.userData = { tier: 'C', src: 'RECON', note: 'flame billboards (procedural); fire placements C unless noted' };
    m.userData.flamesUD = this.flames.userData;
    this.group.add(this.flames);
  }
  private buildSmoke() {
    // smoke puffs: soft quads, per-instance alpha
    const SMAX = SMOKE_MAX; const sq = new THREE.PlaneGeometry(1, 1);
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
    sm.forceSinglePass = true; // camera-facing: one pass (D-220: a double-sided transparent is drawn twice)
    this.smoke = new THREE.InstancedMesh(sq, sm, SMAX); this.smoke.name = 'fire:smoke'; this.smoke.frustumCulled = false; this.smoke.count = 0; this.smoke.renderOrder = 4;
    this.smoke.userData = { tier: 'C', src: 'RECON', note: 'smoke puffs of the fires within 300 m (D-220): opacity from the fire\'s emission (the household day\'s phase for the town\'s hearths and ovens; dung cake and brushwood fuel C; emission factors C, NOT SEEN), rising and drifting with the weather wind' };
    this.group.add(this.smoke);
  }
  /** lit state: fires burn from dusk (sun < 4° and falling or night) until after sunrise (C schedule) */
  /** D-680: the world's day and seed (the occasional fires' nights) */
  setDay(day: number, seed: number) { FIRE_DAY.day = day; FIRE_DAY.seed = seed; }
  update(dt: number, camera: THREE.Camera, sunAlt: number, windMs: number, windDirDeg: number, rain: number, t: number, hour?: number) {
    if (hour !== undefined) FIRE_DAY.hour = hour;
    const lit = sunAlt < 4;
    const SL = this.simLit;
    this.fires.forEach((f, i) => { const sl = SL ? SL[i] : -1;
      f.lit = (sl >= 0 ? sl === 1 : hour === undefined || !f.sched || f.sched === 'night' ? lit : scheduleLit(f.sched, hour, sunAlt, f.seed)) && !(rain > 0.6 && (f.kind === 'brazier' || f.kind === 'hearth')) && (!f.stands || f.stands()); });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    // flames: cylindrical billboards (yaw only) facing the camera, no narrower than FLAME_MIN_PX with their light conserved
    const viewH = typeof innerHeight === 'number' ? innerHeight : 1080, fov = (camera as THREE.PerspectiveCamera).fov ?? 70;
    const pxPerRad = viewH / 2 / Math.tan((fov * Math.PI) / 360);
    // (D-254: an unlit flame is written once, at zero size, and skipped while it stays out: the same matrices, a fraction of
    // the work with the villages' ~8,000 hearths and lamps registered)
    if (!this.drawnLit || this.drawnLit.length !== this.fires.length) this.drawnLit = new Uint8Array(this.fires.length).fill(1);
    const DL = this.drawnLit, frame = this.frameN++, cp0 = camera.position, scl0 = new THREE.Vector3();
    this.fires.forEach((f, i) => {
      if (!f.lit && !DL[i]) return;
      if (f.slow && f.lit && DL[i] && (i + frame) % SLOW_N !== 0 && f.pos.distanceToSquared(cp0) > SLOW_R * SLOW_R) return;
      DL[i] = f.lit ? 1 : 0;
      const s = SPEC[f.kind]; const sc = f.lit ? 1 : 0;
      const flick = 0.85 + 0.15 * Math.sin(t * 13 + f.seed) * Math.sin(t * 7.3 + f.seed * 2);
      const { k, flux } = flameFootprint(s.flameW, f.pos.distanceTo(camera.position), pxPerRad); this.flux.array[i] = flux;
      e.set(0, Math.atan2(camera.position.x - f.pos.x, camera.position.z - f.pos.z), 0); q.setFromEuler(e);
      m4.compose(f.pos, q, scl0.set(s.flameW * sc * k, s.flameH * sc * flick * k, 1)); this.flames.setMatrixAt(i, m4);
    });
    this.flames.instanceMatrix.needsUpdate = true; this.flux.needsUpdate = true;
    if (this.coals) { const cp = camera.position; let ch = false;
      this.coalIdx.forEach((fi, k) => { const f = this.fires[fi], on = f.lit && f.pos.distanceToSquared(cp) < COAL_RANGE * COAL_RANGE ? 1 : 0;
        if (on === this.coalOn[k]) return; this.coalOn[k] = on; ch = true; const R = COAL_R[f.kind]!;
        m4.compose(scl0.set(f.pos.x, f.pos.y - LIFT[f.kind] + R[1], f.pos.z), q.identity(), new THREE.Vector3(R[0] * on, 1, R[0] * on)); this.coals!.setMatrixAt(k, m4); });
      if (ch) this.coals.instanceMatrix.needsUpdate = true; }
    // lights to the nearest lit fires (the fire light model, fireLight)
    const legacy = FIRE_AB.legacy && this.lights.length > this.forwardN, nF = legacy ? this.lights.length : this.forwardN;
    const lit_ = this.lightedFires(camera.position);
    this.lights.forEach((l, i) => {
      if (l.visible !== i < nF) l.visible = i < nF; // (changes only on the A/B switch)
      const f = i < nF ? lit_[i] : undefined; if (!f) { l.intensity = 0; return; } // (stays visible: D-355)
      const L = fireLight(f.kind);
      { const R = this.roomOf(f), u = this.lightRoom[i]; u.mode.value = R.mode;
        if (R.room) { u.box.value.set(R.room.x0, R.room.x1, R.room.z0, R.room.z1); u.ys.value.set(R.room.y0, R.room.y1); } }
      l.position.copy(f.pos).y += L.height - LIFT[f.kind];
      { const u = this.lightRoom[i]; if (f.occ === undefined) f.occ = tileOf(fireOcc(), l.position.x, l.position.y, l.position.z); u.tile.value = f.occ; u.lp.value.copy(l.position); }
      const flick = 0.8 + 0.2 * (Math.sin(t * 11 + f.seed) * 0.5 + Math.sin(t * 17.3 + f.seed * 3) * 0.5);
      l.intensity = L.candela * flick * this.lightScale; l.distance = L.cutoff; l.decay = L.decay;
      if (i < this.shadowN) { const cam = l.shadow.camera as THREE.PerspectiveCamera, far = Math.min(L.cutoff, FIRE_SHADOW_FAR);
        // redrawn when the light takes another fire, and one light in turn every FIRE_SHADOW_REFRESH frames (people passing)
        if (this.shadowOf[i] !== f || (frame % FIRE_SHADOW_REFRESH) === i) { this.shadowOf[i] = f; if (cam.far !== far) { cam.far = far; cam.updateProjectionMatrix(); } l.shadow.needsUpdate = true; } }
    });
    // the next nearest lit fires: the composite's deferred term (D-355), the same light model without the specular
    FIRE_GLOW.n = 0;
    for (let j = 0; j < GLOW_MAX; j++) {
      const f = !legacy && j < this.glowN ? lit_[this.forwardN + j] : undefined, A = FIRE_GLOW.A[j], B = FIRE_GLOW.B[j], C = FIRE_GLOW.C[j], D = FIRE_GLOW.D[j];
      if (!f) { B.set(0, 0, 0, 0); A.w = 0; D.w = 0; continue; }
      const L = fireLight(f.kind), R = this.roomOf(f); FIRE_GLOW.n++;
      A.set(f.pos.x, f.pos.y + L.height - LIFT[f.kind], f.pos.z, L.cutoff);
      if (f.occ === undefined) f.occ = tileOf(fireOcc(), A.x, A.y, A.z);
      const flick = 0.8 + 0.2 * (Math.sin(t * 11 + f.seed) * 0.5 + Math.sin(t * 17.3 + f.seed * 3) * 0.5), I = L.candela * flick * this.lightScale;
      B.set(FIRE_RGB.r * I, FIRE_RGB.g * I, FIRE_RGB.b * I, R.mode);
      if (R.room) { C.set(R.room.x0, R.room.x1, R.room.z0, R.room.z1); D.set(R.room.y0, R.room.y1, this.useOcc ? f.occ : -1, 0); } else D.set(0, 0, this.useOcc ? f.occ : -1, 0);
    }
    this.lightPorts(camera.position, legacy);
    // smoke puffs near the camera, closed-form in time (D-220: frozen renders show them), nearest smoking fires first
    const wind = windWorld(windDirDeg, windMs), u = Math.max(1, windMs), cp = camera.position, camQ = camera.quaternion;
    const near: { i: number; d2: number; g: number }[] = [];
    this.fires.forEach((f, i) => { if (!PUFFS[f.kind]) return; const g = this.emission(i); if (g <= 0) return; const d2 = f.pos.distanceToSquared(cp); if (d2 <= SMOKE_RANGE * SMOKE_RANGE) near.push({ i, d2, g }); });
    near.sort((a, b) => a.d2 - b.d2);
    let k = 0; const P = { x: 0, y: 0, z: 0, size: 0, age: 0, fade: 0 }, v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const { i, g } of near) {
      const f = this.fires[i], K = PUFFS[f.kind]; if (k + K > SMOKE_MAX) break;
      const s = SPEC[f.kind], w0 = SOURCE[f.kind]?.w0 ?? 0.6, tau = sourceTau(f.kind, g) / u; // the wind thins the column (1 / u)
      for (let j = 0; j < K; j++) {
        puffAt(f.kind, f.seed, j, t, wind, P);
        v.set(f.pos.x + P.x, f.pos.y + s.flameH + P.y, f.pos.z + P.z); m4.compose(v, camQ, sc.set(P.size, P.size, P.size)); this.smoke.setMatrixAt(k, m4);
        // optical depth through the puff: the column's τ at the source diluted as it widens (w0 / size), ×2 for the puffs'
        // overlap along the column (C)
        this.smokeAlpha.array[k] = (1 - Math.exp(-2 * tau * (w0 / P.size))) * P.fade;
        this.smokeGlow.array[k] = f.lit ? s.power * 0.6 * Math.exp(-P.age * 1.5) : 0; k++; // lit by its fire as it leaves the flame (C)
      }
    }
    this.smokeN = k; this.smoke.count = k; this.smoke.visible = k > 0; this.smoke.instanceMatrix.needsUpdate = true; this.smokeAlpha.needsUpdate = true; this.smokeGlow.needsUpdate = true;
  }
  /** D-530: the daylight through the town's doorways into their rooms. A doorway lets in the sky and the light the sunlit
   *  ground and walls outside throw back: as seen from inside, a bright opening of ~2 m² whose radiance is ~PORT_RHO × the
   *  daylight outside / π. Each of the nearest ports within PORT_R gets one of the composite's deferred lights left free by
   *  the fires (Lambert, inverse square, cut off at PORT_CUT): the floor and walls inside the door catch it and the room's
   *  far corners fall off into a readable dark (C; the light-probe field holds no town room interiors) */
  private lightPorts(eye: THREE.Vector3, legacy: boolean) {
    const P = this.ports, np = P.length / 5; if (!np || legacy || this.glowN === 0) return;
    const I = this.dayE * PORT_RHO * PORT_AREA / Math.PI, PF = this.portFire;
    if (eye.distanceToSquared(this.portEye) > 1) { this.portEye.copy(eye); const c: { k: number; d: number }[] = [];
      for (let k = 0; k < np; k++) { const dx = P[k * 5] - eye.x, dy = P[k * 5 + 1] - eye.y, dz = P[k * 5 + 2] - eye.z, d = dx * dx + dy * dy + dz * dz; if (d < PORT_R * PORT_R) c.push({ k, d }); }
      c.sort((a, b) => a.d - b.d); this.portNear = c.slice(0, GLOW_MAX * 4).map(x => x.k); }
    // the bounce takes the ground's warm ochre, the sky part the sky's colour (C)
    const r = (0.55 * this.daySky.r + 0.45 * 1.0) * I, g = (0.55 * this.daySky.g + 0.45 * 0.78) * I, b = (0.55 * this.daySky.b + 0.45 * 0.55) * I;
    // at night a doorway whose room has its lamp or hearth lit spills that light out (the room's walls seen through the
    // opening: radiance ~ rho · I / (pi d^2) of the fire on them, times the opening's area), into the court or the lane (C)
    let k = 0, j = 0; const fs = this.lightScale;
    for (; j < GLOW_MAX && k < this.portNear.length; j++) {
      const B = FIRE_GLOW.B[j]; if (B.x + B.y + B.z > 0) continue;
      let q = -1, nI = 0;
      while (k < this.portNear.length) { const c = this.portNear[k++], fi = PF[c] ?? -1, f = fi >= 0 ? this.fires[fi] : null;
        nI = f && f.lit ? fireLight(f.kind).candela * FIRE_FLICKER_MEAN * fs * PORT_RHO * PORT_AREA / (Math.PI * Math.max(1, f.pos.distanceToSquared(new THREE.Vector3(P[c * 5], P[c * 5 + 1], P[c * 5 + 2])))) * PORT_NIGHT : 0;
        if (I > 1e-6 || nI > 0) { q = c * 5; break; } }
      if (q < 0) break;
      const A = FIRE_GLOW.A[j], C = FIRE_GLOW.C[j], D = FIRE_GLOW.D[j];
      // the daylight stands PORT_OUT m outside the opening and reaches only the room's side of the door's wall (half-space:
      // the reveals are grazed, the facade round the door untouched); a night spill from the room's fire stands inside the
      // room and lights only the open side (the ground and walls before the door)
      const night = nI > I, o = night ? PORT_OUT * 0.8 : -PORT_OUT, sg = night ? -1 : 1;
      A.set(P[q] + P[q + 3] * o, P[q + 1], P[q + 2] + P[q + 4] * o, PORT_CUT); B.set(r + FIRE_RGB.r * nI, g + FIRE_RGB.g * nI, b + FIRE_RGB.b * nI, 0);
      C.set(P[q + 3] * sg, 0, P[q + 4] * sg, PORT_OUT * (night ? 0.8 : 1) - 0.05); D.set(0, 0, -1, 1); FIRE_GLOW.n++;
    }
  }
  /** the lit fires that get a light for an eye at `p`: the nearest `lights.length` (forward) + glow (deferred, D-355) within 90 m */
  private lightedFires(p: THREE.Vector3): FireSource[] {
    return this.fires.filter(f => f.lit).map(f => ({ f, d: f.pos.distanceTo(p) })).sort((a, b) => a.d - b.d)
      .slice(0, this.forwardN + this.glowN).filter(x => x.d <= 90).map(x => x.f);
  }
  /** illuminance at `p` (renderer units, on a surface facing each fire: the eye's adaptation) from the fires' cast light
   *  as the point lights cast it (fireLight: the same candela, mean flicker, decay and cut-off window; D-216) */
  localIlluminance(p: THREE.Vector3, view?: THREE.Vector3) {
    let e = 0; const q = new THREE.Vector3(), dir = new THREE.Vector3();
    for (const f of this.lightedFires(p)) { const L = fireLight(f.kind); q.copy(f.pos); q.y += L.height - LIFT[f.kind];
      // with a view direction, the light entering the eye: a surface facing the view (cosine, D-297), plus a floor for the
      // light the fire scatters off everything round the eye; a fire behind the head no longer closes the eye (session 11:
      // the night-sky views from the Terrace rendered black with a brazier behind the camera)
      const facing = view ? FIRE_SCATTER + (1 - FIRE_SCATTER) * Math.max(0, dir.subVectors(q, p).normalize().dot(view)) : 1;
      e += facing * L.candela * FIRE_FLICKER_MEAN * pointAttenuation(q.distanceTo(p), L.cutoff, L.decay); }
    return e * this.lightScale;
  }
  stats() { return { fires: this.fires.length, lit: this.fires.filter(f => f.lit).length, smoke: this.smokeN }; }
}

/** D-530: the daylight ports: the outside's reflectance seen through a doorway (sunlit ground and walls with the sky), the
 *  opening's area (m²), the light's cut-off (m) and how far from the eye ports are lit (m) */
export const PORT_RHO = 0.8, PORT_AREA = 4.0, PORT_CUT = 9, PORT_R = 30, PORT_OUT = 1.0;
/** D-530: the room fire a port spills at night lies within PORT_FIRE_R m of it; the spill's gain over the plain estimate
 *  (the doorway sees the fire's lit walls, floor and the flame itself: C, judged in the fire lab) */
export const PORT_FIRE_R = 6, PORT_NIGHT = 0.8;
/** D-530: how many of the nearest fire lights cast shadows at high/ultra, their cube maps' reach (m), the soft filter's
 *  radius (texels; a flame a few decimetres across), and how often (frames) each is redrawn while it keeps its fire */
// s17 lead (D-530 addendum): off. The cube maps add samplers to every lit material; on the T4 (16 samplers a fragment stage)
// lit materials failed validation and were not drawn (the ground vanished: white in the final train). Was 2.
export const FIRE_SHADOW_LIGHTS = 0, FIRE_SHADOW_FAR = 30, FIRE_SHADOW_RADIUS = 6, FIRE_SHADOW_REFRESH = 24;
/** the adapter's sampled-texture limit per shader stage (read once at load; 0 until known or without WebGPU): the fire
 *  shadows' cube maps need room beyond the scanned surfaces (B24) */
export const TEX_LIMIT = { n: 0 };
if (typeof navigator !== 'undefined' && (navigator as any).gpu) (navigator as any).gpu.requestAdapter().then((a: any) => { TEX_LIMIT.n = a?.limits?.maxSampledTexturesPerShaderStage ?? 0; }).catch(() => {});

/** lit state of a scheduled fire (C). `seed` (0..100) staggers the fires so a town lights up over an hour, not at once. */
/** light a fire scatters off the surroundings into an eye facing away from it, as a share of the facing value (C: a
 *  lit ground of albedo ~0.2–0.3 round a brazier returns a few tenths of the light; D-297) */
export const FIRE_SCATTER = 0.15;

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
