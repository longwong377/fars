// The face while speaking and listening (s18 C14, D-790): visemes, brows, saccades, nods, for everyone drawn up close.
// Before this, a talking face was a jaw on a sine and eyes on a slow sine: a game NPC at conversation distance. Now:
//   - mouth shapes (visemes) from a phone stream: the spoken text when the voice hands it over (FaceState.say), else a seeded
//     stream of syllables in the shape of the period's speech (consonant-vowel, mostly /a/: Old Persian and Elamite are
//     a-heavy; C). Each phone gives a target for the jaw, rounding (u, o, w), spreading (i, e), the lips pressed (m, b, p)
//     and the lower lip tucked under the teeth (f, v); targets are blended over neighbouring phones (coarticulation: a
//     raised-cosine window of ±COART s, stateless, so a person refreshed rarely is still right);
//   - the brows lift on stressed syllables and phrase starts, knit a little in thought, and the head beats with the stress
//     (small nods and tilts); between phrases the speaker breathes in (the jaw drops a little, the chest lifts: anim.ts);
//   - eyes: saccades as jumps (a 20-40 ms move, then a fixation of 0.3-2.5 s), between the listener's two eyes and mouth
//     when looking at someone, else about the scene; a blink follows most large saccades; the lids ride the gaze;
//   - listening: slow back-channel nods every few seconds and a slight tilt while the other speaks (UD-18, UD-21).
// The weights go to the vertex stage through the palette's fourth extra texel group (bodyShape EX.face*; humanMaterial
// mirrors faceOffset term for term). Every number is C: hand-set against the common phonetic picture of visemes (the
// Preston-Blair / MPEG-4 sets) and of conversational gaze (fixation ~0.3-1 s on the face, eyes-mouth triangle).

/** the mouth and brow controls (0..1) */
export interface FaceShape { jaw: number; round: number; wide: number; press: number; tuck: number; smile: number; browUp: number; knit: number }
export const FACE0: FaceShape = { jaw: 0, round: 0, wide: 0, press: 0, tuck: 0, smile: 0, browUp: 0, knit: 0 };
/** jaw opening (rad) for a fully open vowel (C: ~10 mm at the incisors in conversational /a/) */
export const JAW_OPEN = 0.16;
/** coarticulation half-window (s) and the length of one phone at conversational rate (s; ~12 phones a second) */
export const COART = 0.07, PHONE_S = 0.085;

type V = [jaw: number, round: number, wide: number, press: number, tuck: number];
/** viseme targets per phone class (jaw share of JAW_OPEN, round, wide, press, tuck) */
const VIS: Record<string, V> = {
  a: [1, 0, 0.15, 0, 0], e: [0.62, 0, 0.7, 0, 0], i: [0.35, 0, 1, 0, 0], o: [0.7, 0.75, 0, 0, 0], u: [0.3, 1, 0, 0, 0],
  m: [0, 0, 0, 1, 0], f: [0.12, 0, 0.1, 0, 1], w: [0.2, 0.9, 0, 0, 0], t: [0.25, 0, 0.3, 0, 0], k: [0.35, 0, 0.1, 0, 0],
  s: [0.12, 0, 0.55, 0, 0], r: [0.3, 0.25, 0, 0, 0], h: [0.5, 0, 0, 0, 0], _: [0, 0, 0, 0, 0],
};
/** a letter of a transliteration (Old Persian, Elamite, Aramaic as written in Latin letters) → its phone class */
export function phoneOf(ch: string): string {
  const c = ch.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!c || /\s|[.,;:!?…—–-]/.test(c)) return '_';
  if ('a'.includes(c)) return 'a'; if ('e'.includes(c)) return 'e'; if ('iyj'.includes(c)) return c === 'i' ? 'i' : c === 'y' ? 'i' : 't';
  if ('o'.includes(c)) return 'o'; if ('u'.includes(c)) return 'u'; if ('mbp'.includes(c)) return 'm'; if ('fv'.includes(c)) return 'f';
  if (c === 'w') return 'w'; if ('tdnlθðz'.includes(c)) return 't'; if ('kgqxc'.includes(c)) return 'k'; if ('sšʃç'.includes(c)) return 's';
  if (c === 'r') return 'r'; if ('hʔ'.includes(c)) return 'h';
  return 't';
}
/** a phone stream: classes and their start times (s from the line's start); stress marks the first vowel of every second
 *  syllable and of each phrase */
export interface Phones { cls: string[]; t: Float32Array; stress: Uint8Array; dur: number }
export function phonesOf(text: string, seconds?: number): Phones {
  const cls: string[] = []; let prev = '';
  for (const ch of text) { const p = phoneOf(ch); if (p === '_' && prev === '_') continue; cls.push(p); prev = p; }
  if (!cls.length) cls.push('_');
  const w = cls.map(c => (c === '_' ? 2.4 : 'aeiou'.includes(c) ? 1.25 : 0.85)), sum = w.reduce((a, b) => a + b, 0);
  const dur = seconds ?? sum * PHONE_S, k = dur / sum, t = new Float32Array(cls.length), stress = new Uint8Array(cls.length);
  let acc = 0, syl = 0, phraseStart = true;
  for (let i = 0; i < cls.length; i++) { t[i] = acc; acc += w[i] * k;
    if ('aeiou'.includes(cls[i])) { if (phraseStart || syl % 2 === 0) stress[i] = 1; syl++; phraseStart = false; } else if (cls[i] === '_') phraseStart = true; }
  return { cls, t, stress, dur };
}
/** a seeded hash in [0, 1) */
const hh = (a: number, b: number) => { let x = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77)) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0; x ^= x >>> 12; return (x >>> 0) / 4294967296; };
const ONSETS = ['m', 'k', 't', 's', 'r', 'h', 'f', 'w', 't', 'k', 'm', 't'], VOWELS = ['a', 'a', 'a', 'a', 'i', 'u', 'a', 'i', 'e', 'u', 'o', 'a'];
/** the phone class at syllable `n` of a seeded babble: [onset, vowel, coda or ''], and whether a pause follows */
function babble(seed: number, n: number): [string, string, string, boolean] {
  const r1 = hh(seed, n * 3), r2 = hh(seed, n * 3 + 1), r3 = hh(seed, n * 3 + 2);
  return [ONSETS[Math.floor(r1 * ONSETS.length)], VOWELS[Math.floor(r2 * VOWELS.length)], r3 < 0.3 ? (r3 < 0.12 ? 'm' : 't') : '', r3 > 0.9];
}
const SYL_S = 0.21; // one babbled syllable (s; ~4.8 syllables a second, conversational)
/** the phone class sounding at time `t` (s) of a seeded babble, its phase within the phone, and whether it is a stressed vowel */
function babbleAt(seed: number, t: number): { cls: string; stress: boolean; start: number } {
  const n = Math.floor(t / SYL_S), [on, v, co, pause] = babble(seed, n), u = t / SYL_S - n;
  if (pause && u > 0.45) return { cls: '_', stress: false, start: (n + 0.45) * SYL_S };
  const parts: [string, number][] = co ? [[on, 0.3], [v, 0.45], [co, 0.25]] : [[on, 0.35], [v, 0.65]];
  let acc = 0;
  for (let i = 0; i < parts.length; i++) { const [c, w] = parts[i]; if (u < acc + w || i === parts.length - 1) return { cls: c, stress: i === 1 && n % 2 === 0, start: (n + acc) * SYL_S }; acc += w; }
  return { cls: v, stress: false, start: n * SYL_S };
}

/** the mouth at time `t` of a phone stream (or the babble of `seed` when `ph` is null), coarticulated */
export function visemeAt(ph: Phones | null, seed: number, t: number, out: FaceShape = { ...FACE0 }): FaceShape {
  out.jaw = out.round = out.wide = out.press = out.tuck = 0; let wsum = 0;
  const add = (cls: string, w: number) => { const v = VIS[cls] ?? VIS.t; out.jaw += w * v[0]; out.round += w * v[1]; out.wide += w * v[2]; out.press += w * v[3]; out.tuck += w * v[4]; wsum += w; };
  // five samples over the window, raised-cosine weighted (the lips and jaw cannot jump: ~70 ms to reach a target)
  for (let k = -2; k <= 2; k++) { const dt = (k / 2) * COART, w = 0.5 + 0.5 * Math.cos((Math.PI * k) / 2.5), tt = t + dt;
    if (ph) { if (tt < 0 || tt > ph.dur) { add('_', w); continue; } let i = 0; for (let lo = 0, hi = ph.t.length - 1; lo <= hi;) { const m = (lo + hi) >> 1; if (ph.t[m] <= tt) { i = m; lo = m + 1; } else hi = m - 1; } add(ph.cls[i], w); }
    else add(babbleAt(seed, Math.max(0, tt)).cls, w); }
  out.jaw /= wsum; out.round /= wsum; out.wide /= wsum; out.press /= wsum; out.tuck /= wsum;
  // a pressed or tucked consonant closes the jaw over the vowel's opening (the lips need it); rounding narrows the opening
  out.jaw *= 1 - 0.7 * Math.max(out.press, out.tuck);
  return out;
}

/** the speaking person's stress beat at time t: 0..1, peaking ~60 ms after a stressed vowel starts (the brows and the
 *  head's small nod ride it) */
export function stressAt(ph: Phones | null, seed: number, t: number): number {
  let best = 0;
  if (ph) { for (let i = 0; i < ph.t.length; i++) { if (!ph.stress[i]) continue; const d = t - ph.t[i] - 0.06; if (d > 0.4) continue; if (d < -0.2) break; best = Math.max(best, Math.exp(-(d * d) / 0.012)); } return best; }
  const n = Math.floor(t / SYL_S); for (const m of [n - 1, n]) { if (m < 0 || m % 2) continue; const d = t - m * SYL_S - 0.08; best = Math.max(best, Math.exp(-(d * d) / 0.012) * (0.5 + 0.5 * hh(seed, m * 7 + 5))); }
  return best;
}

/** per-person state of the eyes and the listening head (kept on the FaceState: no allocation per frame) */
export interface GazeState { next: number; ox: number; oy: number; tx: number; ty: number; moveAt: number; nodAt: number; nodNext: number; tilt: number; blinkAt: number; talkSeen: number; talkOn: number }
export function gazeState(seed: number): GazeState { return { next: hh(seed, 1) * 0.8, ox: 0, oy: 0, tx: 0, ty: 0, moveAt: -9, nodAt: -9, nodNext: 2 + 4 * hh(seed, 2), tilt: (hh(seed, 3) - 0.5) * 0.08, blinkAt: -9, talkSeen: -9, talkOn: 0 }; }
/** a saccade's duration (s) and the fixation spread (rad) when the eyes rest on a face at conversational distance: the two
 *  eyes and the mouth subtend ~3-5 degrees at 1 m */
export const SACCADE = { move: 0.03, fixMin: 0.3, fixMax: 2.2, faceYaw: 0.035, facePitch: 0.04, sceneYaw: 0.22, scenePitch: 0.08 };

/** advance the eyes: the offset (yaw, pitch; rad) added to the gaze at time t, and whether a blink was triggered by a large
 *  saccade (the lids close during big eye moves). `onFace`: looking at a person (the triangle of eyes and mouth) */
export function saccade(G: GazeState, seed: number, t: number, onFace: boolean): [number, number, boolean] {
  let blink = false;
  if (t < G.moveAt - 5) { G.next = t; G.moveAt = -9; } // the clock went back (a restart): start over
  if (t >= G.next) {
    const n = Math.floor(G.next * 7.3), r1 = hh(seed, n), r2 = hh(seed, n + 11), r3 = hh(seed, n + 23);
    G.ox = G.tx; G.oy = G.ty; G.moveAt = t;
    if (onFace) { const pick = Math.floor(r1 * 5); // 0, 1: the left and right eye; 2: the mouth; 3, 4: back to an eye (eyes ~70 %)
      G.tx = pick === 2 ? 0 : (pick % 2 ? 1 : -1) * SACCADE.faceYaw * (0.7 + 0.6 * r2); G.ty = pick === 2 ? SACCADE.facePitch : (r2 - 0.5) * 0.01; }
    else { G.tx = (r1 - 0.5) * 2 * SACCADE.sceneYaw; G.ty = (r2 - 0.5) * 2 * SACCADE.scenePitch; }
    const big = Math.hypot(G.tx - G.ox, G.ty - G.oy) > 0.15; if (big && r3 < 0.7) blink = true;
    G.next = t + SACCADE.fixMin + (SACCADE.fixMax - SACCADE.fixMin) * (onFace ? 0.5 : 1) * Math.pow(r3, 1.5);
  }
  const u = Math.min(1, (t - G.moveAt) / SACCADE.move), e = u * u * (3 - 2 * u);
  // a fixation drifts a little (the eyes are never quite still: ~0.1 degree tremor and drift)
  const dr = 0.0025 * Math.sin(t * 2.1 + seed) + 0.0015 * Math.sin(t * 5.3 + seed * 1.7);
  return [G.ox + (G.tx - G.ox) * e + dr, G.oy + (G.ty - G.oy) * e + 0.6 * dr, blink];
}

/** the listening head: a back-channel nod (pitch, rad) every few seconds while looking at a speaker who is not oneself */
export function listenNod(G: GazeState, seed: number, t: number): number {
  if (t >= G.nodNext) { G.nodAt = t; G.nodNext = t + 2.5 + 5 * hh(seed, Math.floor(t * 3)); }
  const d = t - G.nodAt; if (d < 0 || d > 0.9) return 0;
  return 0.07 * Math.sin((Math.PI * d) / 0.45) * (d < 0.45 ? 1 : 0.35); // down, then a smaller second dip
}
