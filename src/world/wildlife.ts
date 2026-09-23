// Visible wildlife, part 1: birds (brief §5.5 "birds (including seasonal migrants and raptors)"; research/SOUNDSCAPE.md
// §4 for species). Modern Fars distributions stand in for 467 BCE (C unless stated). Every bird's position is a closed-form
// function of (world seed, species, index, world time), so birds are deterministic, need no saved state and stay
// continuous across time skips and loads; only the sparrows' flight from the player is reactive (and short-lived).
//  - swallows / swifts (C: expected, not sourced): summer migrants, Mar–Sep, hawking insects 4–25 m over the courts;
//  - buzzard / golden eagle (B: raptors of the Zagros, Bamu NP extract): 1–2 birds soaring in wide circles 120–450 m above
//    the Kuh-e Rahmat slope by day, gliding with few wingbeats;
//  - house sparrows (C): on the court floors near fires and people by day; they fly 8–15 m off when someone comes within 3 m.
// Rendering: one InstancedMesh per species (3 draw calls; no shadows), a low-poly body + wings, flapping in the vertex
// shader from a per-instance phase. Sizes from field-guide values (C).
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, sin, float, vec3, abs, uniform } from 'three/tsl';
import { Rng } from '../core/rng';
import type { NavGrid, P2 } from '../people/navgrid';
import type { Terrain } from '../terrain/heightfield';

export interface BirdSpecies { id: string; name: string; tier: string; months: number[]; hours: [number, number]; span: number; length: number; colour: [number, number, number]; flapHz: number; count: number }
export const BIRDS: Record<'swallow' | 'raptor' | 'sparrow', BirdSpecies> = {
  swallow: { id: 'swallow', name: 'barn swallow / common swift', tier: 'C (expected, not sourced; summer migrant)', months: [2, 3, 4, 5, 6, 7, 8], hours: [5.5, 19.5], span: 0.33, length: 0.18, colour: [0.07, 0.08, 0.12], flapHz: 7, count: 36 },
  raptor: { id: 'raptor', name: 'buzzard / golden eagle', tier: 'B (Zagros raptors, extract) / C on-site', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [8.5, 17.5], span: 1.9, length: 0.85, colour: [0.28, 0.21, 0.14], flapHz: 2.2, count: 2 },
  sparrow: { id: 'sparrow', name: 'house sparrow', tier: 'C (expected, not sourced)', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [6, 18.5], span: 0.24, length: 0.15, colour: [0.42, 0.33, 0.24], flapHz: 14, count: 40 },
};

/** a bird mesh: body (tapered box) + two wing quads; wing vertices carry `wing` = ±1 at the tips (0 on the body) */
function birdGeometry(span: number, len: number): THREE.BufferGeometry {
  const w = span / 2, l = len / 2, b = len * 0.12;
  const P: number[] = [], W: number[] = [];
  const tri = (a: number[], c: number[], d: number[], wa: number, wc: number, wd: number) => { P.push(...a, ...c, ...d); W.push(wa, wc, wd); };
  // body: a thin diamond prism along +z (forward)
  const nose = [0, 0, l], tail = [0, 0, -l], L = [-b, 0, 0], R = [b, 0, 0], U = [0, b, 0], D = [0, -b * 0.8, 0];
  for (const [p, q] of [[L, U], [U, R], [R, D], [D, L]]) { tri(nose, p, q, 0, 0, 0); tri(tail, q, p, 0, 0, 0); }
  // wings: swept triangles from the shoulders; tips at ±w
  const s = l * 0.25;
  tri([-b, 0, s], [-w, 0, -s * 0.5], [-b, 0, -s * 1.2], 0, -1, 0); tri([-b, 0, s], [-b, 0, -s * 1.2], [-w, 0, -s * 0.5], 0, 0, -1);
  tri([b, 0, s], [b, 0, -s * 1.2], [w, 0, -s * 0.5], 0, 0, 1); tri([b, 0, s], [w, 0, -s * 0.5], [b, 0, -s * 1.2], 0, 1, 0);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('wing', new THREE.Float32BufferAttribute(W, 1)); g.computeVertexNormals();
  return g;
}

export interface BirdPose { pos: THREE.Vector3; heading: number; bank: number; flap: number /* 0 glide … 1 full */; visible: boolean }

/** closed-form swallow flight: a hawking loop around a court anchor (two incommensurate ellipses + height wobble), ~10 m/s */
export function swallowAt(anchor: P2, ground: number, seed: number, t: number, out: BirdPose) {
  const r = new Rng(seed, 'swallow'); const a1 = r.range(12, 25), a2 = r.range(4, 10), w1 = r.range(0.25, 0.4), w2 = r.range(0.5, 0.8), p1 = r.range(0, 6.3), p2 = r.range(0, 6.3), h0 = r.range(4, 18), hA = r.range(1, 5);
  const x = anchor[0] + a1 * Math.cos(w1 * t + p1) + a2 * Math.cos(w2 * t + p2), n = anchor[1] + a1 * 0.8 * Math.sin(w1 * t + p1) + a2 * Math.sin(w2 * t * 1.3 + p2);
  const dx = -a1 * w1 * Math.sin(w1 * t + p1) - a2 * w2 * Math.sin(w2 * t + p2), dn = a1 * 0.8 * w1 * Math.cos(w1 * t + p1) + a2 * w2 * 1.3 * Math.cos(w2 * t * 1.3 + p2);
  out.pos.set(x, ground + h0 + hA * Math.sin(0.7 * t + p2), -n); out.heading = Math.atan2(dx, dn); out.bank = Math.max(-0.9, Math.min(0.9, (w1 * 0.5) * Math.sign(Math.sin(w2 * t))));
  out.flap = (Math.sin(t * 0.9 + p1) > 0.2) ? 1 : 0.15; out.visible = true;
}
/** closed-form soaring: circles of radius 40–90 m around a thermal that drifts with the wind; 9–12 m/s, few wingbeats */
export function raptorAt(base: P2, ground: number, seed: number, t: number, windX: number, windN: number, out: BirdPose) {
  const r = new Rng(seed, 'raptor'); const R = r.range(40, 90), v = r.range(9, 12), w = (v / R) * (r.chance(0.5) ? 1 : -1), p = r.range(0, 6.3), h = r.range(120, 450);
  const drift = 0.3; // thermals drift slower than the wind (C)
  const cx = base[0] + ((windX * drift * t) % 1600), cn = base[1] + ((windN * drift * t) % 1600);
  out.pos.set(cx + R * Math.cos(w * t + p), ground + h + 15 * Math.sin(0.05 * t + p), -(cn + R * Math.sin(w * t + p)));
  out.heading = Math.atan2(-R * w * Math.sin(w * t + p), R * w * Math.cos(w * t + p)); out.bank = -0.35 * Math.sign(w); out.flap = Math.sin(0.11 * t + p) > 0.93 ? 1 : 0; out.visible = true;
}

export class Birds {
  readonly group = new THREE.Group();
  private meshes = new Map<string, THREE.InstancedMesh>();
  private uTime = uniform(0);
  private anchors: P2[] = []; private sparrowSpots: P2[] = [];
  private flush = new Map<number, { from: THREE.Vector3; to: P2; t0: number }>();
  private pose: BirdPose = { pos: new THREE.Vector3(), heading: 0, bank: 0, flap: 0, visible: false };
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(0, 0, 0, 'YXZ');
  constructor(private seed: number, private nav: NavGrid, private terrain: Terrain, anchors: P2[]) {
    this.group.name = 'wildlife-birds';
    this.anchors = anchors;
    const rng = new Rng(seed, 'sparrow-spots');
    for (let i = 0; i < BIRDS.sparrow.count; i++) { const a = anchors[i % anchors.length]; const s = nav.snap(a[0] + rng.range(-10, 10), a[1] + rng.range(-10, 10), 6); if (s) this.sparrowSpots.push(s); }
    for (const sp of Object.values(BIRDS)) {
      const m = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(...sp.colour, THREE.SRGBColorSpace), roughness: 0.8, side: THREE.DoubleSide });
      const wing = attribute('wing', 'float'), phase = attribute('phase', 'float'), flap = attribute('flapAmt', 'float');
      // wingbeat: tips rise and fall (±60°), scaled by the instance's flap amount; gliding birds hold a slight dihedral
      const beat = sin(this.uTime.mul(sp.flapHz * Math.PI * 2).add(phase)).mul(flap).mul(0.9).add(0.12);
      m.positionNode = positionLocal.add(vec3(0, abs(wing).mul(beat).mul(float(sp.span * 0.5)), 0));
      const g = birdGeometry(sp.span, sp.length);
      const mesh = new THREE.InstancedMesh(g, m, sp.count); mesh.count = 0; mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
      g.setAttribute('phase', new THREE.InstancedBufferAttribute(new Float32Array(sp.count).map((_, i) => new Rng(seed, `${sp.id}:${i}`).range(0, 6.28)), 1));
      g.setAttribute('flapAmt', new THREE.InstancedBufferAttribute(new Float32Array(sp.count).fill(1), 1));
      mesh.userData = { tier: sp.tier, src: 'SOUND-R', note: `${sp.name}; flight paths procedural (C)` };
      this.meshes.set(sp.id, mesh); this.group.add(mesh);
    }
  }
  /** month 0 = first month of the regnal year (spring); hour local; t world seconds; player grid position */
  update(month: number, hour: number, t: number, player: P2 | null, wind: { x: number; n: number }, rain: number) {
    this.uTime.value = t % 100000;
    for (const sp of Object.values(BIRDS)) {
      const mesh = this.meshes.get(sp.id)!, flapAttr = mesh.geometry.getAttribute('flapAmt') as THREE.InstancedBufferAttribute;
      const active = sp.months.includes(month) && hour >= sp.hours[0] && hour <= sp.hours[1] && rain < 0.4;
      let n = 0;
      if (active) for (let i = 0; i < sp.count; i++) {
        const p = this.pose, sd = hashSeed(this.seed, sp.id, i);
        if (sp.id === 'swallow') { const a = this.anchors[i % this.anchors.length]; swallowAt(a, this.nav.heightAt(a[0], a[1]) || 0, sd, t, p); }
        else if (sp.id === 'raptor') { const base: P2 = [260 + i * 350, -40 - i * 220]; raptorAt(base, this.terrain.heightAt(base[0], -base[1]), sd, t, wind.x, wind.n, p); }
        else { if (!this.sparrowAt(i, t, player, p)) continue; }
        this.e.set(0, p.heading, 0); this.q.setFromEuler(this.e); if (p.bank) this.q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), p.bank));
        this.m4.compose(p.pos, this.q, ONE); mesh.setMatrixAt(n, this.m4); flapAttr.setX(n, p.flap); n++;
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = n > 0; flapAttr.needsUpdate = n > 0;
    }
  }
  /** sparrows: hop between spots near their anchor; flush 8–15 m when someone is within 3 m, land after ~1.2 s */
  private sparrowAt(i: number, t: number, player: P2 | null, out: BirdPose): boolean {
    const s = this.sparrowSpots[i]; if (!s) return false;
    const r = new Rng(this.seed, `sparrow:${i}:${Math.floor(t / 7)}`); // a new hop every ~7 s
    const at: P2 = [s[0] + r.range(-1.5, 1.5), s[1] + r.range(-1.5, 1.5)];
    const f = this.flush.get(i);
    if (f && t - f.t0 < 1.2) { const k = (t - f.t0) / 1.2, to = f.to, y = this.nav.heightAt(to[0], to[1]) || 0;
      out.pos.set(f.from.x + (to[0] - f.from.x) * k, f.from.y + (y - f.from.y) * k + Math.sin(Math.PI * k) * 3, f.from.z + (-to[1] - f.from.z) * k); out.heading = Math.atan2(to[0] - f.from.x, to[1] + f.from.z); out.bank = 0; out.flap = 1; return true; }
    if (f && t - f.t0 >= 1.2) { this.sparrowSpots[i] = f.to; this.flush.delete(i); }
    const y = this.nav.heightAt(at[0], at[1]); if (!Number.isFinite(y)) return false;
    if (player && Math.hypot(player[0] - at[0], player[1] - at[1]) < 3) {
      const ang = Math.atan2(at[1] - player[1], at[0] - player[0]) + r.range(-0.6, 0.6), d = r.range(8, 15);
      const to = this.nav.snap(at[0] + Math.cos(ang) * d, at[1] + Math.sin(ang) * d, 5); if (to) this.flush.set(i, { from: new THREE.Vector3(at[0], y, -at[1]), to, t0: t });
    }
    out.pos.set(at[0], y + 0.02, -at[1]); out.heading = r.range(0, 6.28); out.bank = 0; out.flap = 0; return true;
  }
}
const ONE = new THREE.Vector3(1, 1, 1);
function hashSeed(seed: number, id: string, i: number) { let h = seed * 2654435761 >>> 0; for (const c of `${id}:${i}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; }

// ---------------------------------------------------------------------------------------------- part 2: jackals
// Golden jackal (B: confirmed in Fars, research/SOUNDSCAPE.md §5; their dusk/night chorus is in the soundscape). A pack of
// 2–4 roams the plain below the W and S Terrace walls, ~130–970 m out, from dusk to dawn (behaviour C): trotting ~2 m/s
// on slow wandering curves, pausing to sniff. Closed-form in (seed, day, time) like the birds. One InstancedMesh (1 draw
// call, no shadows); the legs swing in the vertex shader (diagonal pairs in phase, a trot).
export const JACKAL = { name: 'golden jackal', tier: 'B species (Fars) / C behaviour', hours: [18.6, 5.8] as [number, number], count: 4, length: 0.75, height: 0.45, colour: [0.52, 0.42, 0.28] as [number, number, number] };

function jackalGeometry(): THREE.BufferGeometry {
  const P: number[] = [], LEG: number[] = [];
  const box = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, leg: number) => {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    for (const [a, b, c, d] of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) for (const k of [a, b, c, a, c, d]) { P.push(...v[k]); LEG.push(leg === 0 ? 0 : leg * Math.max(0, (cy + sy / 2 - v[k][1]) / sy)); }
  };
  const L = JACKAL.length, H = JACKAL.height;
  box(0, H * 0.72, 0, 0.2, 0.22, L * 0.62, 0);            // body
  box(0, H * 0.9, L * 0.38, 0.14, 0.14, 0.2, 0);         // head
  box(0, H * 0.95, L * 0.5, 0.07, 0.07, 0.1, 0);         // muzzle
  box(0, H * 0.7, -L * 0.42, 0.07, 0.07, 0.26, 0);       // tail (brush)
  for (const [x, z, leg] of [[-0.07, 0.22, 1], [0.07, 0.22, -1], [-0.07, -0.2, -1], [0.07, -0.2, 1]]) box(x, H * 0.3, z * L, 0.05, H * 0.6, 0.05, leg); // legs: diagonal pairs share a phase
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('leg', new THREE.Float32BufferAttribute(LEG, 1)); g.computeVertexNormals();
  return g;
}

/** a jackal's place on the night's wander: closed form; `moving` false while it pauses */
export function jackalAt(seed: number, night: number, i: number, t: number, out: { e: number; n: number; heading: number; moving: boolean }) {
  const r = new Rng(seed, `jackal:${night}`);
  // loop centres 350–600 m W of the W wall or 480–750 m S of the S wall; excursions ≤ 1.35 A ≤ 216 m keep them on the plain
  const side = r.chance(0.5) ? 'W' : 'S', cx = side === 'W' ? r.range(-600, -350) : r.range(-150, 250), cn = side === 'W' ? r.range(-150, 250) : r.range(-750, -480);
  const q = new Rng(seed, `jackal:${night}:${i}`), ox = q.range(-6, 6), on = q.range(-6, 6), lag = i * 2.5;
  const T = t - lag, A = r.range(80, 160), w = 2.0 / A; // ~2 m/s along a wandering loop of scale A
  const s = w * T, ph = r.range(0, 6.3);
  // pause for ~20 % of the time (sniffing): time-warp the path parameter
  const cyc = (T % 60 + 60) % 60, moving = cyc < 48, sw = moving ? s - Math.floor(T / 60) * w * 12 : s - (cyc - 48) * w - Math.floor(T / 60) * w * 12;
  out.e = cx + A * Math.sin(sw + ph) + 0.35 * A * Math.sin(2.3 * sw) + ox; out.n = cn + A * 0.6 * Math.sin(1.7 * sw + ph) + on;
  const de = A * Math.cos(sw + ph) + 0.35 * A * 2.3 * Math.cos(2.3 * sw), dn = A * 0.6 * 1.7 * Math.cos(1.7 * sw + ph);
  out.heading = Math.atan2(de, dn); out.moving = moving;
}

export class Jackals {
  readonly mesh: THREE.InstancedMesh;
  private uTime = uniform(0); private moveAttr: THREE.InstancedBufferAttribute;
  private p = { e: 0, n: 0, heading: 0, moving: false }; private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private up = new THREE.Vector3(0, 1, 0);
  constructor(private seed: number, private terrain: Terrain) {
    const g = jackalGeometry();
    const m = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(...JACKAL.colour, THREE.SRGBColorSpace), roughness: 0.95 });
    const leg = attribute('leg', 'float'), mv = attribute('moving', 'float');
    // trot: legs swing ±25° about the hip at ~2.2 Hz, diagonal pairs opposite (sign of `leg`)
    m.positionNode = positionLocal.add(vec3(0, 0, sin(this.uTime.mul(2.2 * Math.PI * 2)).mul(leg).mul(mv).mul(0.12)));
    this.mesh = new THREE.InstancedMesh(g, m, JACKAL.count); this.mesh.count = 0; this.mesh.castShadow = false; this.mesh.frustumCulled = false;
    this.moveAttr = new THREE.InstancedBufferAttribute(new Float32Array(JACKAL.count), 1); g.setAttribute('moving', this.moveAttr);
    this.mesh.userData = { tier: JACKAL.tier, src: 'SOUND-R', note: `${JACKAL.name}; pack range and paths procedural (C)` };
    this.mesh.name = 'wildlife-jackals';
  }
  /** dayIndex/hour local; t world seconds */
  update(dayIndex: number, hour: number, t: number) {
    this.uTime.value = t % 100000;
    const on = hour >= JACKAL.hours[0] || hour <= JACKAL.hours[1]; if (!on) { this.mesh.count = 0; return; }
    const night = hour >= JACKAL.hours[0] ? dayIndex : dayIndex - 1, pack = 2 + new Rng(this.seed, `jackal-pack:${night}`).int(0, JACKAL.count - 2);
    for (let i = 0; i < pack; i++) {
      jackalAt(this.seed, night, i, t, this.p); const y = this.terrain.heightAt(this.p.e, -this.p.n);
      this.q.setFromAxisAngle(this.up, this.p.heading); this.m4.compose(new THREE.Vector3(this.p.e, y, -this.p.n), this.q, new THREE.Vector3(1, 1, 1));
      this.mesh.setMatrixAt(i, this.m4); this.moveAttr.setX(i, this.p.moving ? 1 : 0);
    }
    this.mesh.count = pack; this.mesh.instanceMatrix.needsUpdate = true; this.moveAttr.needsUpdate = true;
  }
}
