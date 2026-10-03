// The score (D-760; UD-38, UD-39): an original orchestral score, out of world (the user's words add non-diegetic music to
// the out-of-world layer; the world's own sound and its players lead, src/audio/music.ts). Two uses:
//  - the opening: the title film carries the main theme (src/shell/film.ts); the in-engine opening plays "First Light"
//    (src/shell/intro.ts), which starts the director when it ends (src/ui/shell.ts starts it on visits without an opening);
//  - in the world, a director that now and then plays one cue fitting the hour, the place and the weather, never one heard
//    lately, never the same twice running, with long silences between (minutes, not seconds), fading in and out.
// Every cue streams (Opus in WebM; the opening's cue also in AAC) (an <audio> element: nothing is fetched until it plays; the catalogue is a few KB). Volume: the
// settings' master x the score's own volume; the player can turn the score off (Settings › Sound › Score, D-760).
// Built offline by tools/score/build.ts from recorded instruments (tools/score/orchestra.ts); the catalogue is
// public/audio/score/manifest.json.
import { sunTimes } from '../people/calendar';
import { loadSettings } from '../core/settings';

// ------------------------------------------------------------------------------------------------------- the preference
export type ScorePreference = 'on' | 'off';
const PREF = 'parsa.score.v1';
const listeners = new Set<(p: ScorePreference) => void>();
export function scorePreference(): ScorePreference { try { return localStorage.getItem(PREF) === 'off' ? 'off' : 'on'; } catch { return 'on'; } }
export function setScorePreference(p: ScorePreference) { try { localStorage.setItem(PREF, p); } catch { /* storage unavailable */ } for (const f of listeners) f(p); }
/** the score's own volume (0..1; the settings' "Music in the world" is the people's playing, not this) */
const VOL = 'parsa.scoreVolume.v1';
export function scoreVolume(): number { try { const v = parseFloat(localStorage.getItem(VOL) ?? ''); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8; } catch { return 0.8; } }
export function setScoreVolume(v: number) { try { localStorage.setItem(VOL, String(Math.max(0, Math.min(1, v)))); } catch { /* storage unavailable */ } }

// ------------------------------------------------------------------------------------------------------------ catalogue
export interface CueInfo { title: string; tags: string[]; seconds: number; marks?: Record<string, number>; bytes?: { webm?: number; m4a?: number } }
export interface Catalogue { cues: Record<string, CueInfo> }
const BASE = `${(import.meta as any).env?.BASE_URL ?? '/'}audio/score/`;
let catalogue: Promise<Catalogue | null> | null = null;
export function loadCatalogue(): Promise<Catalogue | null> {
  catalogue ??= fetch(`${BASE}manifest.json`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  return catalogue;
}
/** Opus (WebM) where the browser plays it; else AAC, which only the opening's cue has (a browser with neither hears no score) */
export function opusOK(): boolean { try { return new Audio().canPlayType('audio/webm; codecs="opus"') !== ''; } catch { return true; } }
function ext(): 'webm' | 'm4a' { return opusOK() ? 'webm' : 'm4a'; }
/** what the score sounds at: the master volume x the score's own, nothing when it is off */
export const scoreLevel = () => scorePreference() === 'off' ? 0 : Math.max(0, Math.min(1, loadSettings().volume.master * scoreVolume()));
const level = scoreLevel;

/** the score's level under a conversation (-10 dB) */
export const DUCK = 0.316;

// ---------------------------------------------------------------------------------------------------------------- a track
/** one cue playing: an <audio> element whose volume follows the settings and its own fade */
export class ScoreTrack {
  readonly el: HTMLAudioElement; private fade = 0; private target = 1; private rate = 0; private timer = 0; ended = false;
  constructor(readonly id: string, private gain = 1, preload: 'auto' | 'none' = 'auto') {
    this.el = new Audio(`${BASE}${id}.${ext()}`); this.el.preload = preload; this.el.crossOrigin = 'anonymous';
    this.el.addEventListener('ended', () => { this.ended = true; this.stop(); });
    this.timer = window.setInterval(() => this.tick(), 50);
  }
  private duck = 1;
  private tick() {
    // under speech: while a conversation is open (src/people/converse/ui.ts's panel) the score sits 10 dB lower, gliding
    // there in ~0.5 s and back in ~2 s, so the person's voice stays clear over it
    const talking = typeof document !== 'undefined' && (document.getElementById('converse')?.style.display ?? 'none') !== 'none';
    const want = talking ? DUCK : 1; this.duck += (want - this.duck) * (want < this.duck ? 0.1 : 0.025);
    if (this.rate) { this.fade += this.rate * 0.05; if ((this.rate > 0 && this.fade >= this.target) || (this.rate < 0 && this.fade <= this.target)) { this.fade = this.target; this.rate = 0; if (this.fade <= 0) this.stop(); } }
    this.el.volume = Math.max(0, Math.min(1, this.fade * this.gain * this.duck * level()));
  }
  /** start (fading in over `seconds`; 0: at once) */
  play(seconds = 0, from = 0): Promise<void> {
    this.fade = seconds ? 0 : 1; this.target = 1; this.rate = seconds ? 1 / seconds : 0; this.tick();
    if (from) this.el.currentTime = from;
    return this.el.play().catch(() => { /* autoplay refused: the cue simply does not sound */ });
  }
  /** fade out over `seconds`, then stop */
  fadeOut(seconds = 4) { this.target = 0; this.rate = -1 / Math.max(0.05, seconds); }
  get time() { return this.el.currentTime; }
  get playing() { return !this.el.paused && !this.ended; }
  stop() { window.clearInterval(this.timer); this.el.pause(); this.el.removeAttribute('src'); try { this.el.load(); } catch { /* */ } this.ended = true; }
}


// ------------------------------------------------------------------------------------------------------------ choosing
export interface ScoreContext { hour: number; rise: number; set: number; place: 'terrace' | 'town' | 'plain' | 'road'; rain: boolean }
export type Phase = 'dawn' | 'day' | 'dusk' | 'night';
export function phaseOf(c: Pick<ScoreContext, 'hour' | 'rise' | 'set'>): Phase {
  if (c.hour >= c.rise - 1 && c.hour < c.rise + 1.5) return 'dawn';
  if (c.hour >= c.set - 1.5 && c.hour < c.set + 1) return 'dusk';
  return c.hour >= c.rise && c.hour < c.set ? 'day' : 'night';
}
/** the rules of the score in the world (D-760): */
export const DIRECTOR = {
  /** silence after the opening before the first cue (s) */ firstAfter: [240, 420] as [number, number],
  /** silence between cues (s): long; the world's own sound leads */ gap: [300, 720] as [number, number],
  /** a cue is not heard again within this many cues, nor within this many seconds */ notWithinCues: 8, notWithinSeconds: 3600,
  /** fade in / out (s) */ fadeIn: 6, fadeOut: 8,
  /** the in-world level under the opening's (the theme sits a little higher) */ gain: 0.7,
};
/** a cue's fit to the moment: its time-of-day tag must match (or it has none), place and weather tags add weight */
export function fitness(info: CueInfo, c: ScoreContext): number {
  if (info.tags.includes('film')) return 0; // the opening's own
  const ph = phaseOf(c), phases = info.tags.filter(t => t === 'dawn' || t === 'day' || t === 'dusk' || t === 'night');
  if (phases.length && !phases.includes(ph)) return 0;
  if (info.tags.includes('rain') && !c.rain) return 0;
  let w = 1;
  if (info.tags.includes(c.place)) w += 2;
  else if (info.tags.some(t => t === 'terrace' || t === 'road' || t === 'town')) w *= 0.35;
  if (c.rain && info.tags.includes('rain')) w += 3;
  if (info.tags.includes('court') && c.place !== 'terrace') w *= 0.3;
  return w;
}
/** the next cue: the fittest of those not heard lately (weighted at random by `r` 0..1); null when none fits */
export function chooseCue(cat: Catalogue, c: ScoreContext, history: { id: string; at: number }[], now: number, r: number): string | null {
  const recent = new Set(history.slice(-DIRECTOR.notWithinCues).map(h => h.id));
  for (const h of history) if (now - h.at < DIRECTOR.notWithinSeconds) recent.add(h.id);
  const last = history[history.length - 1]?.id;
  // two alike never back to back: a cue sharing the last one's place or court tag weighs a third as much (the road twice,
  // the court twice); the hour's tags are shared by design
  const lastTags = new Set((last ? cat.cues[last]?.tags ?? [] : []).filter(t => !['dawn', 'day', 'dusk', 'night', 'opening'].includes(t)));
  let pool = Object.entries(cat.cues).map(([id, info]) => [id, fitness(info, c) * (info.tags.some(t => lastTags.has(t)) ? 0.33 : 1)] as [string, number]).filter(([id, w]) => w > 0 && id !== last);
  const fresh = pool.filter(([id]) => !recent.has(id));
  if (fresh.length) pool = fresh; else { // everything fitting was heard lately: the least recent of them (never the last)
    const lastAt = new Map(history.map(h => [h.id, h.at])); pool.sort((a, b) => (lastAt.get(a[0]) ?? 0) - (lastAt.get(b[0]) ?? 0)); pool = pool.slice(0, 1); }
  const sum = pool.reduce((a, [, w]) => a + w, 0); if (!sum) return null;
  let x = r * sum; for (const [id, w] of pool) { x -= w; if (x <= 0) return id; } return pool[pool.length - 1][0];
}

// ------------------------------------------------------------------------------------------------------------ director
export interface ScoreDeps {
  /** the world's day and local hour */ getTime(): { day: number; hour: number };
  /** the player's eye (world x, y, z); without it the score takes the town */ player?(): { x: number; y: number; z: number };
  /** raining now (optional) */ raining?(): boolean;
  /** the world is being walked (not the title, not the menu): cues start only then */ active?(): boolean;
}
/** grid (east, north) -> the kind of place for the score (C: the Terrace's footprint, the town round it, the plain) */
export function placeOf(e: number, n: number): ScoreContext['place'] {
  if (e > -66 && e < 262 && n > -244 && n < 240) return 'terrace'; // the platform's box (FOOTPRINTS.terrace: e -61..256, n -239..235)
  const d = Math.hypot(e - 80, n - 30);
  return d < 900 ? 'town' : d < 2600 ? 'road' : 'plain';
}

export class ScoreDirector {
  private track: ScoreTrack | null = null; private history: { id: string; at: number }[] = []; private nextAt = 0; private timer = 0;
  private seed = (Math.random() * 2 ** 31) | 0;
  constructor(private d: ScoreDeps) {}
  private r() { this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff; return this.seed / 0x7fffffff; }
  private wait([a, b]: [number, number]) { return a + (b - a) * this.r(); }
  start(firstDelay?: number) {
    if (this.timer) return;
    this.nextAt = performance.now() / 1000 + (firstDelay ?? this.wait(DIRECTOR.firstAfter));
    this.timer = window.setInterval(() => void this.tick(), 5000);
    listeners.add(this.onPref);
  }
  stop() { window.clearInterval(this.timer); this.timer = 0; this.track?.fadeOut(3); this.track = null; listeners.delete(this.onPref); }
  private onPref = (p: ScorePreference) => { if (p === 'off') { this.track?.fadeOut(2); this.track = null; } };
  private async tick() {
    const now = performance.now() / 1000;
    if (this.track && !this.track.ended) return;
    if (this.track?.ended) { this.track = null; this.nextAt = now + this.wait(DIRECTOR.gap); return; }
    if (now < this.nextAt || scorePreference() === 'off' || level() === 0 || (this.d.active && !this.d.active())) return;
    const cat = await loadCatalogue(); if (!cat || !opusOK()) return;
    const t = this.d.getTime(), st = sunTimes(t.day), p = this.d.player?.();
    const ctx: ScoreContext = { hour: t.hour, rise: st.rise, set: st.set, place: p ? placeOf(p.x, -p.z) : 'town', rain: this.d.raining?.() ?? false };
    const id = chooseCue(cat, ctx, this.history, now, this.r());
    if (!id) { this.nextAt = now + 60; return; }
    this.history.push({ id, at: now });
    this.track = new ScoreTrack(id, DIRECTOR.gain, 'auto'); void this.track.play(DIRECTOR.fadeIn);
  }
  /** for the trace and tests */
  get state() { return { playing: this.track?.id ?? null, nextIn: Math.max(0, this.nextAt - performance.now() / 1000), history: [...this.history] }; }
}

let director: ScoreDirector | null = null;
/** start the score in the world (idempotent): called when the walk begins (main.ts's start, and the opening's end) */
export function startScore(d: ScoreDeps, firstDelay?: number): ScoreDirector {
  director ??= new ScoreDirector(d); director.start(firstDelay); (globalThis as any).__score = director; return director;
}
