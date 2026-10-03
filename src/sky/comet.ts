// D-680 (C12's ledger: "the comet of 467/466 BC"): a great comet in the evening sky of the late summer of 467 BCE. The record:
// Plutarch (Lysander 12, citing Daimachus) tells of "a fiery body of vast size seen in the heavens for seventy-five days"
// before the stone fell at Aegospotami, which Pliny (NH 2.149) dates to the second year of the 78th Olympiad (467/466); the
// body is often read as a comet (some identify Halley's return of 466). Its dates, place in the sky and brightness are not
// known: here a 75-day apparition from mid-July 467 (game days COMET.day0 .. + 75), east of the sun in the evening twilight,
// brightest (about magnitude 0) at mid-window, its tail pointing away from the sun (tier C, reasoning in F3).
// Drawn in the world frame from the sun's direction and the ecliptic's pole (its J2000 pole moves <0.5 deg in 2,500 years),
// so the precession of the equator does not enter: a coma sprite and a tail strip along the great circle away from the sun.
import * as THREE from 'three/webgpu';
import { vec4, vec3, float, attribute, uniform, exp, pow, pointUV, dot } from 'three/tsl';
import { starAzAlt, azAltToWorld } from './ephemeris';
import { LONGITUDE_E, START_JDN } from '../core/calendar';

export const COMET = { day0: 88, days: 75, peakMag: 0.2, faintMag: 4.5, elong: [35, 62, 40] as [number, number, number], lat: 18, tailDeg: [6, 24] as [number, number] } as const;
/** the comet's state on (fractional) game day `d`: its share of the apparition (0..1, null outside), magnitude, elongation
 *  from the sun (deg, east), ecliptic latitude (deg) and tail length (deg) */
export function cometAt(d: number): { s: number; mag: number; elong: number; lat: number; tail: number } | null {
  const s = (d - COMET.day0) / COMET.days; if (s < 0 || s > 1) return null;
  const peak = Math.sin(Math.PI * s), mag = COMET.faintMag + (COMET.peakMag - COMET.faintMag) * peak;
  const E = s < 0.5 ? COMET.elong[0] + (COMET.elong[1] - COMET.elong[0]) * s * 2 : COMET.elong[1] + (COMET.elong[2] - COMET.elong[1]) * (s - 0.5) * 2;
  return { s, mag, elong: E, lat: COMET.lat * (1 - 0.4 * s), tail: COMET.tailDeg[0] + (COMET.tailDeg[1] - COMET.tailDeg[0]) * peak };
}
/** the game day (fractional) at jdUT, as the meteors key it (local mean time) */
export const gameDay = (jdUT: number) => jdUT + 0.5 + LONGITUDE_E / 360 - START_JDN;
/** the head's world direction and the tail's direction on the sky (unit, tangent at the head, away from the sun) */
export function cometDirs(jdUT: number, sun: THREE.Vector3, c: { elong: number; lat: number }) {
  const p = starAzAlt(270, 66.56, 0, 0, jdUT), P = new THREE.Vector3(...azAltToWorld(p.azimuth, p.altitude)).normalize();
  const S = sun.clone().normalize(), e = (c.elong * Math.PI) / 180, b = (c.lat * Math.PI) / 180;
  const R = S.clone().applyAxisAngle(P, e); // eastward along the ecliptic (counter-clockwise about its north pole)
  const Pp = P.clone().addScaledVector(R, -P.dot(R)).normalize();
  const H = R.multiplyScalar(Math.cos(b)).addScaledVector(Pp, Math.sin(b)).normalize();
  const T = H.clone().multiplyScalar(H.dot(S)).sub(S).normalize();
  return { H, T };
}
const SEG = 28;
export class Comet {
  readonly group = new THREE.Group();
  private tail: THREE.Mesh; private coma: THREE.Points;
  private tpos = new Float32Array((SEG + 1) * 2 * 3); private tuv = new Float32Array((SEG + 1) * 2 * 2);
  readonly bright = uniform(0); readonly comaBright = uniform(0);
  state: ReturnType<typeof cometAt> = null;
  constructor(private radius: number) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.tpos, 3)); g.setAttribute('tuv', new THREE.BufferAttribute(this.tuv, 2));
    const idx: number[] = []; for (let k = 0; k < SEG; k++) { const a = 2 * k; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent: false, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false });
    const uv: any = attribute('tuv', 'vec2'), u = uv.x, v = uv.y;
    // the tail: the dust's yellow-white near the head, the gas's blue farther out; fading along it and across it (C)
    const col = vec3(1.0, 0.94, 0.8).mul(float(1).sub(u)).add(vec3(0.62, 0.78, 1.0).mul(u));
    // (soft across: a Gaussian whose edge is the strip's; along: rising out of the coma, then a long fade: a diffuse fan, not a streak)
    m.colorNode = vec4(col.mul(pow(float(1).sub(u), 2.2)).mul(float(1).sub(exp(u.mul(-18)))).mul(exp(v.mul(v).mul(-2.2))).mul(this.bright), 1);
    this.tail = new THREE.Mesh(g, m); this.tail.frustumCulled = false;
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    const pm = new THREE.PointsNodeMaterial({ transparent: false, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, sizeAttenuation: false });
    const pr = (pointUV as any).sub(0.5), r2 = dot(pr, pr);
    pm.colorNode = vec4(vec3(1.0, 0.97, 0.9).mul(exp(r2.mul(-26)).add(exp(r2.mul(-6)).mul(0.25))).mul(this.comaBright), 1); pm.sizeNode = float(14);
    this.coma = new THREE.Points(pg, pm); this.coma.frustumCulled = false;
    this.tail.renderOrder = -8.7; this.coma.renderOrder = -8.6; // (with the stars and planets: before the clouds, which hide it)
    this.group.add(this.tail, this.coma); this.group.name = 'comet'; this.group.visible = false;
    this.group.userData = { tier: 'C', src: 'PLUTARCH-LYS12;PLINY-NH2.149;RECON', note: 'the "fiery body seen for 75 days" before the Aegospotami stone (467/466 BCE), drawn as a great comet in the evening sky of late summer 467: its dates, place and brightness reconstructed (C)' };
  }
  /** jdUT; the camera (the dome's centre); the sun's world direction and altitude; the stars' limiting magnitude now (skySystem
   *  starLimitMag with the moon) and the cloud factor (1 clear) */
  update(jdUT: number, camPos: THREE.Vector3, sunDir: THREE.Vector3, limMag: number, clear: number) {
    const c = (this.state = cometAt(gameDay(jdUT)));
    const show = c ? Math.min(1, Math.max(0, (limMag - c.mag) / 1.5)) * clear : 0;
    this.group.visible = show > 0.002; if (!this.group.visible || !c) return;
    this.group.position.copy(camPos);
    const { H, T } = cometDirs(jdUT, sunDir, c), R = this.radius, L = (c.tail * Math.PI) / 180;
    const fl = Math.pow(10, -0.4 * (c.mag - 1));
    this.comaBright.value = Math.min(2.2, fl) * show; this.bright.value = Math.min(0.16, 0.06 * fl) * show;
    const q = new THREE.Vector3(), t = new THREE.Vector3(), side = new THREE.Vector3();
    for (let k = 0; k <= SEG; k++) { const a = (k / SEG) * L, w = (0.4 + 4.6 * Math.pow(k / SEG, 0.8)) * Math.PI / 180;
      q.copy(H).multiplyScalar(Math.cos(a)).addScaledVector(T, Math.sin(a)).normalize(); // along the great circle away from the sun
      t.copy(T).multiplyScalar(Math.cos(a)).addScaledVector(H, -Math.sin(a)); side.crossVectors(q, t).normalize();
      for (const [j, sgn] of [[0, -1], [1, 1]] as const) { const o = (k * 2 + j) * 3, v = q.clone().addScaledVector(side, sgn * w).normalize().multiplyScalar(R);
        this.tpos[o] = v.x; this.tpos[o + 1] = v.y; this.tpos[o + 2] = v.z; this.tuv.set([k / SEG, sgn], (k * 2 + j) * 2); } }
    (this.tail.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (this.tail.geometry.attributes.tuv as THREE.BufferAttribute).needsUpdate = true;
    const cp = this.coma.geometry.attributes.position as THREE.BufferAttribute; cp.setXYZ(0, H.x * R, H.y * R, H.z * R); cp.needsUpdate = true;
  }
}
