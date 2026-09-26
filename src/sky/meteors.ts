// Meteors (session 9, MASTER_PLAN §6 programme "meteors"; T-J5, a surprise the world holds). Sporadic meteors only (no shower
// is modelled for 467: C would be a guess about radiants 2,500 years back). Every meteor is a pure function of (world seed,
// time): the same sky whoever looks, never spawned for the player (T-F6).
//   rate: sporadic hourly rate for a naked-eye observer under a dark sky, lowest at 18:00 and highest at 06:00 local time
//   (the Earth's apex): ~5 → ~15 per hour to limiting magnitude 6.5 (the observers' long-run sporadic rates; RECOLLECTION of
//   the International Meteor Organization's published values, NOT SEEN: B at best, labelled C here);
//   magnitudes: the population index r = 3 (N(≤ m) ∝ r^m; typical sporadic value, B), so a meteor as bright as Vega (m ≤ 0)
//   comes about once in 6-18 hours of dark sky; angular speed 5-35 °/s, 0.2-1.2 s, paths 3-25°, above 15° altitude (C).
// Drawn as a head and a fading train (the eye's persistence, ~0.12 s of the path) on the sky dome, behind the clouds.
import * as THREE from 'three/webgpu';
import { uniform, vec4, attribute, float } from 'three/tsl';
import { u01, salt } from '../people/hash';
import { azAltToWorld } from './ephemeris';
import { LONGITUDE_E } from '../core/calendar';

export const METEOR_R = 3, METEOR_LIMIT_MAG = 6.5, METEOR_DRAWN_MAG = 5.0; // fainter ones are not drawn (below the render's reach)
const S = salt('meteors');
export interface Meteor { start: number; dur: number; mag: number; s: [number, number, number]; n: [number, number, number]; w: number }
/** the sporadic hourly rate (to limiting magnitude 6.5) at local solar hour h */
export const meteorRate = (h: number) => 10 + 5 * Math.cos(((h - 6) / 24) * 2 * Math.PI);
/** the meteors whose flight covers second t of day `day` (local mean time), drawn (m ≤ METEOR_DRAWN_MAG) */
export function meteorsAt(seed: number, day: number, t: number): Meteor[] {
  const out: Meteor[] = [];
  for (let k = Math.floor(t) - 2; k <= Math.floor(t); k++) {
    const kd = ((k % 86400) + 86400) % 86400, dd = day + Math.floor(k / 86400);
    const p = meteorRate(kd / 3600) / 3600; if (u01(seed, S, dd, kd, 0) >= p) continue;
    const mag = METEOR_LIMIT_MAG + Math.log(Math.max(1e-9, u01(seed, S, dd, kd, 1))) / Math.log(METEOR_R); if (mag > METEOR_DRAWN_MAG) continue;
    const start = k + u01(seed, S, dd, kd, 2), dur = 0.2 + 1.0 * u01(seed, S, dd, kd, 3); if (t < start || t > start + dur) continue;
    // start point: uniform over the sky above 15° (area-uniform in sin alt), travel direction uniform
    const az = 360 * u01(seed, S, dd, kd, 4), alt = (Math.asin(Math.sin((15 * Math.PI) / 180) + (1 - Math.sin((15 * Math.PI) / 180)) * u01(seed, S, dd, kd, 5)) * 180) / Math.PI;
    const s = azAltToWorld(az, alt), up: [number, number, number] = Math.abs(s[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
    let e = cross(s, up); e = norm(e); const f = cross(s, e); const th = 2 * Math.PI * u01(seed, S, dd, kd, 6);
    const tan: [number, number, number] = [e[0] * Math.cos(th) + f[0] * Math.sin(th), e[1] * Math.cos(th) + f[1] * Math.sin(th), e[2] * Math.cos(th) + f[2] * Math.sin(th)];
    const n = norm(cross(s, tan)), w = ((5 + 30 * u01(seed, S, dd, kd, 7)) * Math.PI) / 180;
    out.push({ start, dur, mag, s, n, w });
  }
  return out;
}
const cross = (a: number[], b: number[]): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: number[]): [number, number, number] => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** the meteor's direction at time τ after its start (the start point turned about the path's axis n by w·τ) */
export function meteorDir(m: Meteor, tau: number): [number, number, number] {
  const a = m.w * tau, c = Math.cos(a), sn = Math.sin(a), s = m.s, n = m.n, k = n[0] * s[0] + n[1] * s[1] + n[2] * s[2], x = cross(n, s);
  return [s[0] * c + x[0] * sn + n[0] * k * (1 - c), s[1] * c + x[1] * sn + n[1] * k * (1 - c), s[2] * c + x[2] * sn + n[2] * k * (1 - c)];
}
/** brightness on the stars' scale (skySystem: min(1.5, 10^(−0.4 (m − 1))) · 0.9 + 0.05), a meteor flaring and fading over its flight */
export const meteorBright = (mag: number, phase: number) => Math.min(3, Math.pow(10, -0.4 * (mag - 1))) * 0.9 * Math.sin(Math.PI * Math.min(1, Math.max(0, phase)));

const MAX = 4, SEG = 12, TRAIN_S = 0.12;
export class Meteors {
  readonly group = new THREE.Group();
  private lines: THREE.LineSegments; private pos: Float32Array; private col: Float32Array;
  readonly night = uniform(0);
  seed = 1; active: Meteor[] = [];
  constructor(private radius: number) {
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(MAX * SEG * 2 * 3); this.col = new Float32Array(MAX * SEG * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('mcol', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.LineBasicNodeMaterial({ transparent: false, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false });
    m.colorNode = vec4(attribute('mcol', 'vec3').mul(this.night), float(1));
    this.lines = new THREE.LineSegments(g, m); this.lines.frustumCulled = false; this.lines.renderOrder = -8.5;
    this.lines.userData = { tier: 'C', src: 'IMO-RATES (RECOLLECTION);RECON', note: 'sporadic meteors: rates and magnitudes from observers\' long-run values (not seen), deterministic in world time' };
    this.group.add(this.lines); this.group.name = 'meteors';
  }
  /** jdUT: the world's time; camPos: the dome's centre; night: 0 by day … 1 in full darkness (the stars' uniform) */
  update(jdUT: number, camPos: THREE.Vector3, night: number) {
    this.night.value = night; this.group.position.copy(camPos);
    const lmt = jdUT + 0.5 + LONGITUDE_E / 360, day = Math.floor(lmt), t = (lmt - day) * 86400;
    this.active = night > 0.05 ? meteorsAt(this.seed, day, t).slice(0, MAX) : [];
    this.pos.fill(0); this.col.fill(0);
    this.active.forEach((m, i) => { const tau = t - m.start, b = meteorBright(m.mag, tau / m.dur);
      for (let j = 0; j < SEG; j++) for (let e = 0; e < 2; e++) { const q = (j + e) / SEG, tt = Math.max(0, tau - q * TRAIN_S), d = meteorDir(m, tt), o = ((i * SEG + j) * 2 + e) * 3;
        const f = b * (1 - q) * (1 - q); // the train fades behind the head
        this.pos[o] = d[0] * this.radius; this.pos[o + 1] = d[1] * this.radius; this.pos[o + 2] = d[2] * this.radius;
        this.col[o] = f * 0.95; this.col[o + 1] = f * 1.0; this.col[o + 2] = f * 0.9; } });
    (this.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (this.lines.geometry.attributes.mcol as THREE.BufferAttribute).needsUpdate = true;
    this.lines.visible = this.active.length > 0;
  }
}
