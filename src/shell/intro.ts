// The opening (s17 C5, D-590; UD-37): a wordless, in-engine cinematic that plays when a new visit begins: the river at first
// light, the plain, the town waking, the Terrace in the first sun, people at their work, and the last shot coming down to the
// eye where the player's walk begins. Out of world in form only (letterbox, the dips to black, one English hint "any key
// skips"); everything seen is the world itself, at its own hour. No narrator, no title card, nothing that names or hints at
// the place's fate (§1.1).
//
// It STARTS WHEN THE WORLD IS WALKABLE (main.ts calls play() from the title's Enter, after ready) and never delays it: any
// key, click or touch skips at once, and the shots cover the minute in which the rest streams in (the animals, the far
// models, the talk's model: they arrive behind the camera, D-376/D-393). The clock is not sped up (people would run): each
// cut moves the world's time FORWARD to the shot's hour (relative to that day's sunrise; never backwards: a world that
// opened later than a shot's hour keeps its own time), so the opening walks through the first two hours of the day and the
// walk begins in the morning light. Shots are grid (east, north) with heights above the terrain; tests/intro.test.ts checks
// every path's clearance against the committed terrain and the Terrace's platform.
import { sunTimes } from '../people/calendar';

/** a camera key: grid east/north (m), height above the terrain (m), grid azimuth (deg, 0 = grid north, 90 = grid east),
 *  pitch (deg, up positive), vertical field of view (deg) */
export interface IntroKey { e: number; n: number; h: number; az: number; pitch: number; fov?: number }
export interface IntroShot {
  id: string; /** for the record and the dev trace (never shown) */ what: string;
  /** seconds on screen */ dur: number;
  /** the world's hour at the cut, in hours from that day's sunrise (moved forward only) */ atRise: number;
  keys: IntroKey[];
  /** the lowest the lens may be (world y, ~ m over the court level) where it crosses the Terrace's platform; tests only
   *  (default 30: over everything) */
  overTerrace?: number;
  /** 'glide' (default): nearly constant motion, eased only a little at the cuts; 'land': eased in and out (comes to rest) */
  ease?: 'glide' | 'land';
}

/** the shots in order; the last is built at play() from where the player stands (shotToPlayer) */
export const SHOTS: IntroShot[] = [
  // the Pulvar 3.8 km N of the Terrace, from its S bank 1.5 m above the water's edge, drifting upstream (E) into the glow
  // before sunrise: the sky in the water, the far bank's reeds and willows (plain riparian), the mountains black
  { id: 'river', what: 'the river at first light', dur: 13, atRise: -0.35,
    keys: [{ e: 880, n: 3787, h: 2.4, az: 70, pitch: -2, fov: 38 }, { e: 990, n: 3790, h: 2.8, az: 80, pitch: -1.5, fov: 38 }] },
  // high over the fields S of the river, moving S toward the Terrace (3 km): the patchwork, the villages' first smoke,
  // Kuh-e Rahmat dark against the dawn on the left
  { id: 'plain', what: 'the plain at dawn', dur: 14, atRise: -0.1,
    keys: [{ e: 740, n: 3380, h: 95, az: 200, pitch: -7, fov: 42 }, { e: 680, n: 3200, h: 82, az: 196, pitch: -6, fov: 42 }] },
  // the town N of the Terrace from just over its roofs, looking S to the Terrace with the low sun raking across from the E;
  // lanes, courts, smoke from the first fires
  { id: 'town', what: 'the town waking', dur: 15, atRise: 0.35,
    keys: [{ e: -110, n: 880, h: 24, az: 166, pitch: -11, fov: 45 }, { e: -165, n: 850, h: 20, az: 172, pitch: -10, fov: 45 }, { e: -225, n: 830, h: 17, az: 180, pitch: -9, fov: 45 }] },
  // the W face of the Terrace from the plain, the camera rising past the wall's top: the Grand Stair, the Gate, the columns
  // of the Apadana in the first sun over Rahmat
  { id: 'terrace', what: 'the Terrace in the first sun', dur: 16, atRise: 1.1,
    keys: [{ e: -175, n: 40, h: 2.5, az: 62, pitch: 9, fov: 46 }, { e: -155, n: 70, h: 14, az: 72, pitch: 5, fov: 46 }, { e: -140, n: 96, h: 30, az: 84, pitch: -1, fov: 46 }] },
  // the building site of the Hall of a Hundred Columns from 9 m over its N forecourt: the gangs at work from sunrise + 0.5 h
  // (people/calendar.ts E-60), drums on the ramps, the dust (D-220); heights over the plain, the platform ~12 m above it
  { id: 'work', what: 'people at their work', dur: 12, atRise: 1.3, overTerrace: 8,
    keys: [{ e: 118, n: 60, h: 21.5, az: 158, pitch: -17, fov: 42 }, { e: 136, n: 52, h: 21, az: 172, pitch: -15, fov: 42 }] },
];
/** the last shot's length (s) */
export const LAST_SHOT_SECONDS = 15;
/** the world's hour at the last cut, from sunrise */
export const LAST_SHOT_AT_RISE = 1.45;
export const INTRO_SECONDS = SHOTS.reduce((a, s) => a + s.dur, 0) + LAST_SHOT_SECONDS;

/** the last shot: from high on the approach behind the player, coming down along the player's heading to the eye */
export function shotToPlayer(p: { e: number; n: number; eyeH: number; az: number; pitch: number; fov: number }): IntroShot {
  const r = (p.az * Math.PI) / 180, back = (d: number) => [p.e - Math.sin(r) * d, p.n - Math.cos(r) * d];
  const [e0, n0] = back(95), [e1, n1] = back(38);
  return { id: 'walk', what: 'where the walk begins', dur: LAST_SHOT_SECONDS, atRise: LAST_SHOT_AT_RISE, ease: 'land',
    keys: [{ e: e0, n: n0, h: 34, az: p.az, pitch: 4, fov: 50 }, { e: e1, n: n1, h: 9, az: p.az, pitch: 6, fov: Math.min(p.fov, 55) }, { e: p.e, n: p.n, h: p.eyeH, az: p.az, pitch: p.pitch, fov: p.fov }] };
}

const smooth = (u: number) => u * u * u * (u * (u * 6 - 15) + 10); // smootherstep: eased in and out
const cr = (a: number, b: number, c: number, d: number, t: number) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
/** the azimuths unwrapped along the keys (a turn takes the short way) */
function unwrap(az: number[]) { const o = [az[0]]; for (let i = 1; i < az.length; i++) { let a = az[i]; while (a - o[i - 1] > 180) a -= 360; while (a - o[i - 1] < -180) a += 360; o.push(a); } return o; }

export interface Pose { e: number; n: number; y: number; az: number; pitch: number; fov: number }
/** the camera at u (0..1, eased) through a shot's keys: Catmull-Rom through the keys (ends repeated); y absolute (world),
 *  each key's height taken over the terrain at the key, then kept at least `clear` m above the terrain under the camera */
export function shotPose(s: IntroShot, u: number, heightAt: (e: number, n: number) => number, clear = 1.2): Pose {
  const uc = Math.max(0, Math.min(1, u)), eased = s.ease === 'land' ? smooth(uc) : 0.75 * uc + 0.25 * smooth(uc);
  const k = s.keys, m = k.length - 1, t = eased * m, i = Math.min(m - 1, Math.floor(t)), f = t - i;
  const at = (j: number) => k[Math.max(0, Math.min(m, j))];
  const ys = k.map(q => heightAt(q.e, q.n) + q.h), azs = unwrap(k.map(q => q.az));
  const y = (j: number) => ys[Math.max(0, Math.min(m, j))], az = (j: number) => azs[Math.max(0, Math.min(m, j))];
  const P = (g: (j: number) => number) => (m === 0 ? g(0) : cr(g(i - 1), g(i), g(i + 1), g(i + 2), f));
  const e = P(j => at(j).e), n = P(j => at(j).n);
  const lin = (g: (j: number) => number) => (m === 0 ? g(0) : g(i) + (g(i + 1) - g(i)) * f); // angles and lens: no overshoot
  return { e, n, y: Math.max(P(y), heightAt(e, n) + clear), az: lin(az), pitch: lin(j => at(j).pitch), fov: lin(j => at(j).fov ?? 50) };
}

// ------------------------------------------------------------------------------------------- the player's choice (out of world)
export type IntroPreference = 'new' | 'never';
const PREF = 'parsa.intro.v1';
export function introPreference(): IntroPreference { try { return localStorage.getItem(PREF) === 'never' ? 'never' : 'new'; } catch { return 'new'; } }
export function setIntroPreference(p: IntroPreference) { try { localStorage.setItem(PREF, p); } catch { /* storage unavailable */ } }

export interface IntroDeps {
  /** the camera rig: a pose (world x, y, z; yaw, pitch in radians, as main.ts's freeCam) or null to hand back to the player */
  setCam(c: { x: number; y: number; z: number; yaw: number; pitch: number } | null): void;
  /** the terrain's height (world y) under world (x, z) */
  heightAt(x: number, z: number): number;
  camera: { fov: number; updateProjectionMatrix(): void };
  /** where the walk begins: the player's eye (world), yaw and pitch (radians, as the input holds them) */
  player(): { x: number; y: number; z: number; yaw: number; pitch: number };
  /** the world's clock */
  getTime(): { day: number; hour: number }; setTime(day: number, hour: number): void;
  /** the player's field of view (settings) */
  fov(): number;
  /** set the player's look (radians): the walk begins facing where the last shot faced, whatever the mouse did meanwhile */
  look(yaw: number, pitch: number): void;
  /** the menu is open (the pointer lock's Esc): the opening ends at once */
  paused?(): boolean;
  /** the people nearer than this to the lens are not drawn (main.ts: crowd.rigClear) */
  rigClear?(m: number): void;
  /** called when the opening is over (played out or skipped) */
  onEnd?(): void;
}

const yawOf = (azGrid: number) => -(azGrid * Math.PI) / 180;
const azOf = (yaw: number) => -(yaw * 180) / Math.PI;

export class Intro {
  playing = false; private shots: IntroShot[] = []; private shot = -1; private t = 0; private last = 0; private raf = 0; private began = 0; private ending = 0;
  private look0 = { yaw: 0, pitch: 0 };
  private bars: HTMLElement | null = null; private fade: HTMLElement | null = null; private hint: HTMLElement | null = null;
  /** what happened, for tests and the trace */
  readonly log: { shot: string; at: number; hour: number }[] = [];
  constructor(private d: IntroDeps) {}

  play() {
    if (this.playing) return;
    const p = this.d.player(), terr = this.d.heightAt(p.x, p.z);
    this.look0 = { yaw: p.yaw, pitch: p.pitch };
    this.shots = [...SHOTS, shotToPlayer({ e: p.x, n: -p.z, eyeH: p.y - terr, az: azOf(p.yaw), pitch: (p.pitch * 180) / Math.PI, fov: this.d.fov() })];
    this.playing = true; this.shot = -1; this.t = 0; this.ending = 0; this.began = performance.now(); this.last = this.began; this.log.length = 0;
    document.body.classList.add('intro');
    const mk = (cls: string) => { const e = document.createElement('div'); e.className = cls; document.body.append(e); return e; };
    this.bars = mk('intro-bars'); this.fade = mk('intro-fade'); this.hint = mk('intro-skip');
    this.hint.append('Any key skips', Object.assign(document.createElement('span'), { className: 'ring' }));
    requestAnimationFrame(() => this.bars?.classList.add('on'));
    setTimeout(() => this.hint?.classList.add('on'), 1500); setTimeout(() => this.hint?.classList.remove('on'), 7000);
    addEventListener('keydown', this.onKey, true); addEventListener('mousedown', this.onKey, true); addEventListener('touchstart', this.onKey, true);
    this.next(); this.loop();
    (globalThis as any).__intro = this;
  }
  /** any key, click or touch: a short dip to black, then the walk (the first 0.8 s are ignored: the click that began it) */
  private onKey = (e: Event) => {
    if (!this.playing) return;
    if (performance.now() - this.began < 800) return;
    e.stopPropagation(); if (e.type === 'keydown') e.preventDefault();
    if ((e as KeyboardEvent).key === 'Escape') { this.finish(); return; } // Esc: at once (the pointer lock's own Esc opens the menu)
    this.skip();
  };
  skip() { if (!this.playing || this.ending) return; this.ending = performance.now(); }

  private next() {
    this.shot++; this.t = 0;
    const s = this.shots[this.shot]; if (!s) { this.finish(); return; }
    const now = this.d.getTime(), want = sunTimes(now.day).rise + s.atRise;
    if (want > now.hour) this.d.setTime(now.day, want); // forward only
    this.log.push({ shot: s.id, at: (performance.now() - this.began) / 1000, hour: this.d.getTime().hour });
    this.d.rigClear?.(s.id === 'walk' ? 0 : 2.5);
  }
  private loop = () => {
    if (!this.playing) return;
    if (this.d.paused?.()) { this.finish(); return; }
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    this.t += dt;
    let s = this.shots[this.shot];
    if (this.t >= s.dur) { this.next(); if (!this.playing) return; s = this.shots[this.shot]; }
    const u = this.t / s.dur, P = shotPose(s, u, (e, n) => this.d.heightAt(e, -n));
    this.d.setCam({ x: P.e, y: P.y, z: -P.n, yaw: yawOf(P.az), pitch: (P.pitch * Math.PI) / 180 });
    if (Math.abs(this.d.camera.fov - P.fov) > 1e-3) { this.d.camera.fov = P.fov; this.d.camera.updateProjectionMatrix(); }
    // black: in from black at a shot's start (2.6 s for the first), out at its end (0.8 s; not before the walk), and the skip's dip
    const first = this.shot === 0, last = this.shot === this.shots.length - 1;
    const fin = Math.max(0, 1 - this.t / (first ? 2.6 : 0.9)), fout = last ? 0 : Math.max(0, 1 - (s.dur - this.t) / 0.8);
    const fskip = this.ending ? Math.min(1, (now - this.ending) / 450) : 0;
    if (this.fade) this.fade.style.opacity = String(Math.max(fin, fout, fskip));
    if (this.ending && now - this.ending >= 450) { this.finish(); return; }
    this.raf = requestAnimationFrame(this.loop);
  };
  /** hand the camera back to the player: the rig released, the lens and the look the player's, the black lifted */
  finish() {
    if (!this.playing) return;
    this.playing = false; cancelAnimationFrame(this.raf);
    removeEventListener('keydown', this.onKey, true); removeEventListener('mousedown', this.onKey, true); removeEventListener('touchstart', this.onKey, true);
    // a skip lands at the last shot's hour, as a played-out opening does
    const now = this.d.getTime(), want = sunTimes(now.day).rise + LAST_SHOT_AT_RISE; if (want > now.hour) this.d.setTime(now.day, want);
    this.d.setCam(null); this.d.rigClear?.(0); this.d.look(this.look0.yaw, this.look0.pitch);
    this.d.camera.fov = this.d.fov(); this.d.camera.updateProjectionMatrix();
    const fade = this.fade, bars = this.bars, hint = this.hint;
    if (fade) { fade.classList.add('out'); requestAnimationFrame(() => { fade.style.opacity = '0'; }); }
    bars?.classList.remove('on'); hint?.classList.remove('on');
    setTimeout(() => { fade?.remove(); bars?.remove(); hint?.remove(); document.body.classList.remove('intro'); }, 1700);
    this.bars = this.fade = this.hint = null;
    this.log.push({ shot: 'end', at: (performance.now() - this.began) / 1000, hour: this.d.getTime().hour });
    this.d.onEnd?.();
  }
}

/** the title's backdrop (D-590): the camera drifts slowly across the approach W of the Terrace, the Grand Stair, the Gate and
 *  the Apadana against the eastern sky on the right of the frame (the menu's glass covers the left), there and back, until
 *  the player enters; then the camera is the player's again. The world's clock runs as it does (the title is not paused). */
export const TITLE_DRIFT: IntroShot = { id: 'title', what: 'the title backdrop', dur: 70, atRise: -9,
  keys: [{ e: -330, n: 55, h: 4.5, az: 66, pitch: 5, fov: 44 }, { e: -315, n: 125, h: 5.5, az: 74, pitch: 5, fov: 44 }] };
export class TitleDrift {
  private raf = 0; private t0 = 0; on = false;
  constructor(private d: IntroDeps) {}
  start() {
    if (this.on) return; this.on = true; this.t0 = performance.now();
    const loop = () => { if (!this.on) return;
      const t = (performance.now() - this.t0) / 1000, ph = (t / TITLE_DRIFT.dur) % 2, u = ph < 1 ? ph : 2 - ph; // there and back
      const P = shotPose({ ...TITLE_DRIFT, ease: 'land' }, u, (e, n) => this.d.heightAt(e, -n));
      this.d.setCam({ x: P.e, y: P.y, z: -P.n, yaw: yawOf(P.az), pitch: (P.pitch * Math.PI) / 180 });
      if (Math.abs(this.d.camera.fov - P.fov) > 1e-3) { this.d.camera.fov = P.fov; this.d.camera.updateProjectionMatrix(); }
      this.raf = requestAnimationFrame(loop); };
    loop();
  }
  stop() {
    if (!this.on) return; this.on = false; cancelAnimationFrame(this.raf);
    this.d.setCam(null); this.d.camera.fov = this.d.fov(); this.d.camera.updateProjectionMatrix();
  }
}
