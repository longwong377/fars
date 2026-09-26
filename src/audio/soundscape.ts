// Procedural soundscape (brief §11; research/SOUNDSCAPE.md). Every layer is synthesised in Web Audio:
//  wind (filtered noise ∝ wind speed, column whistle inside colonnades), rain on stone, thunder, fire crackle at each lit
//  fire, birds by season/time (see-see partridge & chukar on the slope, hoopoe, bee-eater Apr–Sep, swallows, sparrows,
//  jackals at dusk/night), masons' chisels at the Hall of 100 Columns site during working hours, footsteps by surface.
// D-210 (gap audit items 5, 10, 11, 15): the animals of a pre-modern town: dogs barking (at night, and at a stranger close
// by), donkeys braying, the cocks at first light, hens clucking, frogs at the water on spring and early-summer evenings,
// cicadas in the summer heat among trees, owls at night, crows and kites by day, a boar's grunt in the reeds, flies
// buzzing at dung and middens; scheduled by season, hour and place (the listener's surroundings from world/fauna.ts:
// town, water, trees, middens and animals near). All synthesised (no samples, nothing added to ASSET_LEDGER); every
// design C; species tiers in src/data/fauna.json and research/SOUNDSCAPE.md section 9.
// No music here: music plays only where someone in the world is playing (src/audio/performers.ts, D-178). Every point
// source (work strikes, fires, the generic chisels) goes through the engine's occlusion (engine.route; D-178); birds
// (in the air about the listener), wind and rain are not point sources and are not occluded. Tiers: species B/C
// (SOUND-R), sound designs C.
import { AudioEngine, Space } from './engine';
import { NoiseStream } from './beds';
import { Rng } from '../core/rng';

export const SPACES: Record<string, Space> = {
  open: { id: 'open', volume: 2e6, surface: 1e6, alpha: 0.9 },
  portico: { id: 'portico', volume: 60 * 18 * 19, surface: 60 * 18 * 2 + 60 * 19, alpha: 0.5 },
  /** D-245 (audit D: "acoustics stop at the Terrace"): a lane of the town or a village between house walls (C): a 30 m
   *  stretch 4 m wide between 3.5 m mud-brick walls, open above and at the ends (earth floor 0.3, plastered walls 0.05,
   *  the openings 1): RT60 ≈ 0.35 s, the short slap of a street */
  street: { id: 'street', volume: 30 * 4 * 3.5, surface: 120 + 210 + 120 + 28, alpha: (0.3 * 120 + 0.05 * 210 + 148) / 478 },
};
/** mean absorption per roofed hall (C): plaster walls, lime-plaster floor, timber ceiling; halls in use are assumed to
 *  carry hangings/furnishings (0.14), the Gate is bare (0.1) */
export const ROOM_ALPHA: Record<string, number> = { apadana: 0.14, gate_nations: 0.1, tachara: 0.14, hadish: 0.14, harem: 0.18, treasury: 0.16 };
/** register a roofed room's acoustic space from its measured box (the generator's manifest `room` entries) */
export function registerRoom(id: string, sx: number, sy: number, h: number) {
  SPACES[id] = { id, volume: sx * sy * h, surface: 2 * sx * sy + 2 * (sx + sy) * h, alpha: ROOM_ALPHA[id] ?? 0.14 };
}

/** the listener's surroundings (0 far … 1 in it; world/fauna.ts placeAt): the town's or a village's houses, water (river
 *  or canal), trees (gardens, orchards, the paradise), middens and dung, animals within a few metres */
export interface Place { town: number; water: number; trees: number; midden: number; animals: number }
/** an ambient call: species, months (0 = January), hours (local; relative to sunrise with `rel: 'rise'`), calls a second
 *  where it is heard at all; D-210: `where` scales the rate by the listener's surroundings, `minTemp` (°C) gates the
 *  cicadas' heat, `far` = the distance range (m) the call is placed at (default 15-95) */
type Bird = { id: string; months: number[]; hours: [number, number][]; call: (e: AudioEngine, out: AudioNode, t: number, r: Rng) => void; rate: number; tier: string;
  rel?: 'rise'; where?: keyof Place; minTemp?: number; far?: [number, number] };
const chirp = (e: AudioEngine, out: AudioNode, t: number, f0: number, f1: number, dur: number, gain: number) => {
  const c = e.ctx!, o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
};
const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
/** a voiced call: a sawtooth (buzzy) or triangle source with a pitch contour through one or two formant band-passes */
function voice(e: AudioEngine, out: AudioNode, t: number, dur: number, f0: number, f1: number, form: [number, number][], gain: number, wave: OscillatorType = 'sawtooth', vib = 0) {
  const c = e.ctx!, o = c.createOscillator(), g = c.createGain(), mix = c.createGain(); o.type = wave;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  if (vib) { const v = c.createOscillator(), vg = c.createGain(); v.frequency.value = vib; vg.gain.value = f0 * 0.05; v.connect(vg); vg.connect(o.frequency); v.start(t); v.stop(t + dur + 0.02); }
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(0.03, dur * 0.2)); g.gain.setValueAtTime(gain * 0.85, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); mix.gain.value = 1; for (const [fq, q] of form) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = q; g.connect(f); f.connect(mix); }
  mix.connect(out); o.start(t); o.stop(t + dur + 0.02);
}
/** a noise burst through a band-pass (breath, rasp) */
function hiss(e: AudioEngine, out: AudioNode, t: number, dur: number, fq: number, q: number, gain: number, colour: 'white' | 'pink' | 'brown' = 'white') {
  const c = e.ctx!, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = e.noiseBuffer(dur + 0.02, colour); f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02);
}
/** a donkey's bray: the in-breath's high rasping "hee" and the out-breath's low buzzing "haw", four to seven times (C) */
export function bray(e: AudioEngine, out: AudioNode, t: number, r: Rng, gain = 1) {
  const n = 4 + r.int(0, 3), f = 0.9 + 0.2 * r.next(); let at = t;
  for (let i = 0; i < n; i++) { const hi = 0.22 + 0.06 * i / n, lo = 0.34 + 0.1 * i / n;
    voice(e, out, at, hi, 820 * f, 1050 * f, [[1400, 3], [2600, 4]], 0.045 * gain, 'sawtooth'); hiss(e, out, at, hi, 2400, 1.5, 0.012 * gain);
    voice(e, out, at + hi + 0.03, lo, 240 * f, 180 * f, [[520, 2.5], [1100, 3]], 0.055 * gain, 'sawtooth'); at += hi + lo + 0.06; }
}
/** a dog's bark: a short falling buzzy burst with a breath of noise (C) */
export function bark(e: AudioEngine, out: AudioNode, t: number, r: Rng, gain = 1) {
  const f0 = 380 + 200 * r.next(), d = 0.1 + 0.06 * r.next();
  voice(e, out, t, d, f0 * 1.25, f0 * 0.8, [[900, 2], [1800, 3]], 0.06 * gain, 'sawtooth'); hiss(e, out, t, d * 0.8, 1300, 1.2, 0.02 * gain);
}
/** the cock's crow: four notes, the last long and falling (C) */
export function cockcrow(e: AudioEngine, out: AudioNode, t: number, r: Rng, gain = 1) {
  const f = 1 + 0.15 * (r.next() - 0.5), notes: [number, number, number][] = [[0.14, 560, 620], [0.16, 650, 700], [0.2, 700, 740], [0.7, 760, 520]]; let at = t;
  for (const [d, a, b] of notes) { voice(e, out, at, d, a * f, b * f, [[1300, 3], [2700, 4]], 0.04 * gain, 'sawtooth', 7); at += d + 0.035; }
}
/** a hen's clucks (C) */
export function cluck(e: AudioEngine, out: AudioNode, t: number, r: Rng, gain = 1) {
  const n = 2 + r.int(0, 3); for (let i = 0; i < n; i++) voice(e, out, t + i * (0.18 + 0.08 * r.next()), 0.06, 420 + 80 * r.next(), 330, [[900, 2]], 0.03 * gain, 'triangle');
}
/** a crow's caw: a harsh falling "kraa" (C) */
function caw(e: AudioEngine, out: AudioNode, t: number, r: Rng) { const f = 620 + 120 * r.next(); voice(e, out, t, 0.28, f, f * 0.82, [[1200, 2], [2400, 3]], 0.022, 'sawtooth'); hiss(e, out, t, 0.25, 1600, 1, 0.006); }
/** a kite's whinnying whistle: a falling trill (C) */
function trill(e: AudioEngine, out: AudioNode, t: number, f0: number, f1: number, dur: number, rate: number, gain: number) { voice(e, out, t, dur, f0, f1, [[f0, 1.2]], gain, 'sine', rate); }
/** a marsh frog's croak: a rattle of short pulses (C) */
function croak(e: AudioEngine, out: AudioNode, t: number, r: Rng) { const n = 6 + r.int(0, 6), fq = 900 + 500 * r.next(); for (let i = 0; i < n; i++) hiss(e, out, t + i * 0.035, 0.022, fq, 6, 0.012); }
/** a cicada's buzz: a few seconds of fast-pulsed high noise, swelling and fading (C) */
function cicada(e: AudioEngine, out: AudioNode, t: number, r: Rng) {
  const c = e.ctx!, d = 2.5 + 3 * r.next(), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), am = c.createOscillator(), ag = c.createGain();
  s.buffer = e.noiseBuffer(d + 0.05, 'white'); f.type = 'bandpass'; f.frequency.value = 4800 + 1200 * r.next(); f.Q.value = 3; am.frequency.value = 45 + 30 * r.next(); ag.gain.value = 0.004;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.008, t + d * 0.3); g.gain.setValueAtTime(0.008, t + d * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + d);
  am.connect(ag); ag.connect(g.gain); s.connect(f); f.connect(g); g.connect(out); s.start(t); am.start(t); s.stop(t + d + 0.05); am.stop(t + d + 0.05);
}
/** a boar's grunts: low noisy pulses (C) */
export function grunt(e: AudioEngine, out: AudioNode, t: number, r: Rng, gain = 1) { const n = 2 + r.int(0, 4); for (let i = 0; i < n; i++) { voice(e, out, t + i * 0.32, 0.14, 130 + 30 * r.next(), 95, [[320, 1.5]], 0.05 * gain, 'sawtooth'); hiss(e, out, t + i * 0.32, 0.12, 400, 1, 0.02 * gain, 'brown'); } }
export const BIRDS: Bird[] = [
  { id: 'see-see partridge', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [[5, 8.5], [17, 19.5]], rate: 0.12, tier: 'B species / C call',
    call: (e, o, t, r) => { for (let i = 0; i < 4 + r.int(0, 3); i++) chirp(e, o, t + i * 0.28, 1500, 1900, 0.12, 0.05); } },
  { id: 'chukar', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [[5.5, 9], [16.5, 19]], rate: 0.08, tier: 'B/C',
    call: (e, o, t, r) => { for (let i = 0; i < 5 + r.int(0, 4); i++) chirp(e, o, t + i * 0.18, 700 + i * 30, 900 + i * 30, 0.1, 0.05); } },
  { id: 'hoopoe', months: [2, 3, 4, 5, 6, 7], hours: [[6, 11], [15, 18]], rate: 0.06, tier: 'C',
    call: (e, o, t) => { for (let i = 0; i < 3; i++) chirp(e, o, t + i * 0.22, 480, 450, 0.12, 0.06); } },
  { id: 'bee-eater', months: [3, 4, 5, 6, 7, 8], hours: [[7, 18]], rate: 0.1, tier: 'B range / C call',
    call: (e, o, t, r) => { for (let i = 0; i < 2 + r.int(0, 3); i++) chirp(e, o, t + i * 0.35 + r.next() * 0.1, 2400, 2000, 0.09, 0.03); } },
  { id: 'swallow', months: [2, 3, 4, 5, 6, 7, 8], hours: [[6, 19]], rate: 0.25, tier: 'C',
    call: (e, o, t, r) => { for (let i = 0; i < 6; i++) chirp(e, o, t + i * 0.07, 3500 + r.next() * 1500, 4200 + r.next() * 800, 0.04, 0.015); } },
  { id: 'house sparrow', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [[5.5, 19]], rate: 0.3, tier: 'C',
    call: (e, o, t, r) => { for (let i = 0; i < 2 + r.int(0, 4); i++) chirp(e, o, t + i * 0.2, 3000, 2600, 0.08, 0.02); } },
  { id: 'golden jackal', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [[19.5, 24], [0, 4.5]], rate: 0.015, tier: 'B species / C call',
    call: (e, o, t, r) => { for (let i = 0; i < 5; i++) chirp(e, o, t + i * 0.45 + r.next() * 0.2, 700 + r.next() * 300, 1300 + r.next() * 200, 0.4, 0.03); } },
  { id: 'crickets', months: [3, 4, 5, 6, 7, 8, 9], hours: [[20, 24], [0, 4]], rate: 1.5, tier: 'C',
    call: (e, o, t, r) => { chirp(e, o, t + r.next() * 0.1, 4500, 4500, 0.05, 0.004); } },
  // D-210: the town's and the villages' animals heard from further off (the near ones sound from the animals themselves)
  { id: 'cocks at first light', months: ALL, hours: [[-1.3, 1.2]], rel: 'rise', where: 'town', rate: 0.1, tier: 'B fowl (PF 2034) / C call', far: [60, 260],
    call: (e, o, t, r) => cockcrow(e, o, t, r, 0.35) },
  { id: 'dogs barking in the night', months: ALL, hours: [[20.5, 24], [0, 5]], where: 'town', rate: 0.035, tier: 'C (dogs: HDT 1.140 claim, population.json dog)', far: [80, 400],
    call: (e, o, t, r) => { const n = 2 + r.int(0, 5); for (let i = 0; i < n; i++) bark(e, o, t + i * (0.5 + r.next() * 0.5), r, 0.4); } },
  { id: 'a donkey braying', months: ALL, hours: [[6, 19.5]], where: 'town', rate: 0.012, tier: 'B donkeys (POTTS2023) / C call', far: [120, 500],
    call: (e, o, t, r) => bray(e, o, t, r, 0.45) },
  { id: 'hooded crows', months: ALL, hours: [[6, 18.5]], rate: 0.05, tier: 'C (crows expected, not sourced: SOUNDSCAPE.md section 4)',
    call: (e, o, t, r) => { for (let i = 0; i < 2 + r.int(0, 3); i++) caw(e, o, t + i * (0.45 + r.next() * 0.2), r); } },
  { id: 'black kite', months: [2, 3, 4, 5, 6, 7, 8], hours: [[8, 17.5]], where: 'town', rate: 0.018, tier: 'C (summer migrant over towns and middens; expected, not sourced)',
    call: (e, o, t, r) => { const d = 1.1 + r.next() * 0.4; trill(e, o, t, 2100, 1250, d, 13, 0.018); } },
  { id: 'scops owl', months: [3, 4, 5, 6, 7, 8], hours: [[20.5, 24], [0, 4.5]], where: 'trees', rate: 0.03, tier: 'C (expected, not sourced)',
    call: (e, o, t, r) => { const n = 4 + r.int(0, 5), f = 1150 + r.next() * 150; for (let i = 0; i < n; i++) chirp(e, o, t + i * (2.4 + r.next() * 0.3), f, f * 0.98, 0.16, 0.02); } },
  { id: 'little owl', months: ALL, hours: [[18.5, 23], [4, 6]], rate: 0.015, tier: 'C (resident of open country with ruins and trees; expected, not sourced)',
    call: (e, o, t, r) => { const n = 1 + r.int(0, 3); for (let i = 0; i < n; i++) { chirp(e, o, t + i * 1.2, 1050, 1500, 0.12, 0.018); chirp(e, o, t + i * 1.2 + 0.12, 1500, 1100, 0.16, 0.014); } } },
  { id: 'marsh frogs', months: [2, 3, 4, 5], hours: [[18.5, 24], [0, 1.5]], where: 'water', rate: 1.2, tier: 'C (frogs at the canals and rivers in spring; expected, not sourced)', far: [8, 120],
    call: (e, o, t, r) => croak(e, o, t, r) },
  { id: 'cicadas', months: [5, 6, 7], hours: [[10, 17.5]], where: 'trees', minTemp: 26, rate: 0.35, tier: 'C (summer daytime drone in trees: SOUNDSCAPE.md section 6, no Fars source)', far: [6, 60],
    call: (e, o, t, r) => cicada(e, o, t, r) },
  { id: 'wild boar grunting', months: ALL, hours: [[19, 24], [0, 5.5]], where: 'water', rate: 0.02, tier: 'B species (Fars) / C place and call', far: [30, 200],
    call: (e, o, t, r) => grunt(e, o, t, r, 0.5) },
];

/** every one-shot kind `strike` plays (the activity lint checks each performance's sound against this list; 'murmur',
 *  'footsteps' and 'fire' are the soundscape's continuous layers) */
export const STRIKE_KINDS = ['chisel', 'quern', 'dice', 'hoe', 'sickle', 'loom', 'trowel', 'adze', 'mould', 'wash', 'broom', 'bow', 'bleat', 'water',
  // D-210: the animals' voices at the animal (crowd performances, world/fauna.ts)
  'bray', 'bark', 'cluck', 'cockcrow', 'grunt'] as const;
export const LAYER_SOUNDS = ['murmur', 'footsteps', 'fire'] as const;
/** a lit fire's crackle bed level (C). D-245: 0.08 was −49 dBFS at 8 m (tools/dev/audio_render.ts), below the −40 dB a
 *  visible fire within 10 m must reach (MASTER_PLAN T-G3e) */
export const FIRE_BED = 0.3;
/** a short noise burst through a filter (work sounds) */
function burst(e: AudioEngine, out: AudioNode, t: number, dur: number, colour: 'white' | 'pink' | 'brown', type: BiquadFilterType, f0: number, f1: number, q: number, gain: number) {
  const c = e.ctx!, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = e.noiseBuffer(dur + 0.02, colour);
  f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(0.01, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02);
}
/** a decaying tone (thuds, taps, the bowstring) */
function tone(e: AudioEngine, out: AudioNode, t: number, dur: number, type: OscillatorType, f0: number, f1: number, gain: number) {
  const c = e.ctx!, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
}
/** the work sounds of the activity performances (D-142; all procedural, C). Returns false for other kinds */
export function workStrike(e: AudioEngine, kind: string, pos: { x: number; y: number; z: number }, rng: Rng): boolean {
  const c = e.ctx; if (!c) return false; const t = c.currentTime, j = rng.next();
  const at = (h: number, ref: number, max: number) => { const p = e.panner(pos.x, pos.y + h, pos.z, ref, max); e.route(p, 'effects', t + 1.5); return p; };
  switch (kind) {
    case 'hoe': { const p = at(0.1, 3, 120); burst(e, p, t, 0.12, 'brown', 'lowpass', 420, 200, 0.7, 0.07); tone(e, p, t, 0.08, 'sine', 95 + 20 * j, 60, 0.05); return true; } // blade into soil
    case 'sickle': { const p = at(0.4, 2, 50); burst(e, p, t, 0.16, 'white', 'bandpass', 3200, 1600, 1.2, 0.02); return true; } // cutting stalks
    case 'loom': { const p = at(0.2, 2, 60); tone(e, p, t, 0.07, 'triangle', 170 + 30 * j, 110, 0.05); tone(e, p, t, 0.012, 'square', 900, 700, 0.01); return true; } // the sword beater's thump
    case 'trowel': { const p = at(0.2, 2, 60); tone(e, p, t, 0.03, 'triangle', 1400 + 400 * j, 1200, 0.03); burst(e, p, t + 0.01, 0.07, 'white', 'bandpass', 2600, 2200, 2, 0.01); return true; }
    case 'adze': { const p = at(0.5, 3, 150); burst(e, p, t, 0.05, 'white', 'bandpass', 950, 700, 1.5, 0.05); tone(e, p, t, 0.07, 'triangle', 330 + 60 * j, 240, 0.05); return true; } // iron biting timber
    case 'mould': { const p = at(0.2, 2, 60); burst(e, p, t, 0.1, 'brown', 'lowpass', 750, 300, 0.8, 0.06); tone(e, p, t, 0.05, 'sine', 125, 80, 0.03); return true; } // wet mud slapped in
    case 'wash': { const p = at(0.2, 2, 80); burst(e, p, t, 0.08, 'white', 'lowpass', 1800, 900, 0.8, 0.05); burst(e, p, t + 0.02, 0.3, 'white', 'highpass', 1500, 2500, 0.7, 0.015); return true; } // wet cloth on stone, a splash
    case 'broom': { const p = at(0.1, 2, 40); burst(e, p, t, 0.25, 'pink', 'bandpass', 2600, 1800, 0.7, 0.015); return true; }
    case 'bow': { const p = at(1.5, 3, 120); burst(e, p, t, 0.02, 'white', 'highpass', 2000, 2000, 0.7, 0.02); tone(e, p, t, 0.25, 'sine', 190 + 30 * j, 150, 0.04); return true; } // the string released
    case 'water': { const p = at(0.3, 2, 60); burst(e, p, t, 0.25, 'white', 'highpass', 1200, 2400, 0.7, 0.03); return true; }
    case 'bray': { const p = at(1.1, 6, 600); bray(e, p, t, rng); return true; }
    case 'bark': { const p = at(0.5, 5, 400); const n = 1 + (j < 0.5 ? 0 : j < 0.85 ? 1 : 2); for (let i = 0; i < n; i++) bark(e, p, t + i * (0.28 + 0.1 * rng.next()), rng); return true; }
    case 'cluck': { const p = at(0.25, 1.5, 40); cluck(e, p, t, rng); return true; }
    case 'cockcrow': { const p = at(0.4, 5, 500); cockcrow(e, p, t, rng); return true; }
    case 'grunt': { const p = at(0.4, 3, 150); grunt(e, p, t, rng); return true; }
    case 'bleat': { // a sheep's or goat's bleat: a buzzy tone with vibrato through a vocal formant (C)
      const p = at(0.6, 4, 250), o = c.createOscillator(), v = c.createOscillator(), vg = c.createGain(), f = c.createBiquadFilter(), g = c.createGain(), f0 = 330 + 190 * j, d = 0.45 + 0.35 * rng.next();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 0.9, t + d);
      v.frequency.value = 6 + 2 * j; vg.gain.value = f0 * 0.06; v.connect(vg); vg.connect(o.frequency);
      f.type = 'bandpass'; f.frequency.value = 950; f.Q.value = 2.2;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.025, t + 0.05); g.gain.setValueAtTime(0.022, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(f); f.connect(g); g.connect(p); o.start(t); v.start(t); o.stop(t + d + 0.02); v.stop(t + d + 0.02); return true; }
  }
  return false;
}

/** how often an ambient species calls here and now, relative to its rate (0: not at all): its months, its hours (relative
 *  to sunrise for `rel: 'rise'`), the heat it needs, and the listener's surroundings it calls from (D-210) */
export function ambientWeight(b: Bird, ctx: { hour: number; month: number; place?: Place; sun?: { rise: number; set: number }; tempC?: number }): number {
  if (!b.months.includes(ctx.month)) return 0;
  const h = b.rel === 'rise' ? ctx.hour - (ctx.sun?.rise ?? 6) : ctx.hour; if (!b.hours.some(([a, z]) => h >= a && h < z)) return 0;
  if (b.minTemp !== undefined && (ctx.tempC ?? 20) < b.minTemp) return 0;
  return b.where ? (ctx.place ? ctx.place[b.where] : 0) : 1;
}
/** the tier of an ambient species or layer heard (dev overlay) */
export const AMBIENT_TIER = (id: string) => id === 'flies' ? 'C (expected at dung and middens: brief section 5.5; not sourced)' : BIRDS.find(b => b.id === id)?.tier ?? '?';
export class Soundscape {
  // D-245: the beds are NoiseStreams (src/audio/beds.ts): fresh noise segments crossfaded, never a loop (they were 4–6 s loops)
  private windSrc?: NoiseStream; private windGain?: GainNode; private windFilter?: BiquadFilterNode; private whistle?: BiquadFilterNode; private whistleGain?: GainNode;
  private rainSrc?: NoiseStream; private rainGain?: GainNode; private birdBus?: GainNode; private fliesSrc?: NoiseStream;
  /** D-210: the flies' buzz at dung, middens and animals (a stream, D-245; C) */
  private fliesGain?: GainNode;
  /** D-210: the ambient species heard lately (dev overlay F3: what and its tier) */
  readonly heard = new Map<string, number>();
  /** the flies' level (0-1) set by the last update (tests, overlay) */
  fliesLevel = 0;
  private fireNodes = new Map<string, { gain: GainNode; pan: PannerNode; bed: NoiseStream }>();
  /** D-245: the rain's and the flies' streams run until a few seconds after their level falls to nothing (the gain's decay) */
  private rainTail = -1; private fliesTail = -1;
  private rng = new Rng(1, 'soundscape'); private nextStep = 0; private nextChisel = 0; private started = false;
  lastSpace = 'open';
  constructor(readonly e: AudioEngine) {}
  private start() {
    const e = this.e, c = e.ctx!; this.started = true;
    // wind (≤ ~2 kHz after its low-pass) and the whistle from one pink stream at 16 kHz; rain (high-passed at 900 Hz) white at 32 kHz
    this.windSrc = new NoiseStream(e, 'pink', { seg: 6, fade: 0.6, sampleRate: 16000 }); this.windFilter = c.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windGain = c.createGain(); this.windGain.gain.value = 0;
    this.windSrc.out.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(e.ch.ambience);
    this.whistle = c.createBiquadFilter(); this.whistle.type = 'bandpass'; this.whistle.Q.value = 18; this.whistle.frequency.value = 520; this.whistleGain = c.createGain(); this.whistleGain.gain.value = 0;
    this.windSrc.out.connect(this.whistle); this.whistle.connect(this.whistleGain); this.whistleGain.connect(e.ch.ambience);
    this.rainSrc = new NoiseStream(e, 'white', { seg: 5, fade: 0.5, sampleRate: 32000 }); const rf = c.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 900; this.rainGain = c.createGain(); this.rainGain.gain.value = 0;
    this.rainSrc.out.connect(rf); rf.connect(this.rainGain); this.rainGain.connect(e.ch.ambience);
    this.birdBus = c.createGain(); this.birdBus.gain.value = 1; this.birdBus.connect(e.ch.ambience);
    { // flies: pink noise through a narrow band at the wingbeat (~200 Hz), its pitch and loudness wandering (C)
      this.fliesSrc = new NoiseStream(e, 'pink', { seg: 5, fade: 0.5, sampleRate: 8000 }); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 215; f.Q.value = 6;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.7; lg.gain.value = 35; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      this.fliesGain = c.createGain(); this.fliesGain.gain.value = 0; this.fliesSrc.out.connect(f); f.connect(this.fliesGain); this.fliesGain.connect(e.ch.ambience); }
  }
  thunder(delay: number, strength: number) {
    const e = this.e; if (!e.ctx) return; const c = e.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = e.noiseBuffer(6, 'brown'); const g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180 + 400 * strength;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(Math.min(1, 0.6 * strength + 0.2), t + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + 5.5);
    s.connect(f); f.connect(g); g.connect(e.ch.effects); s.start(t); s.stop(t + 6);
  }
  /** a one-shot from a person's work at a world position (driven by the animation, so what you hear is what is done).
   *  Kinds: STRIKE_KINDS (the work sounds of D-142 are procedural designs, C: a hoe's thud in soil, a sickle's swish, the
   *  weaving sword's thump, a trowel's tap, an adze biting wood, wet mud slapped into the mould, wet cloth beaten on
   *  stone, a twig broom, a bowstring, a sheep's or goat's bleat, a splash) */
  strike(kind: string, pos: { x: number; y: number; z: number }) {
    const e = this.e, c = e.ctx; if (!c) return; const t = c.currentTime;
    if (workStrike(e, kind, pos, this.rng)) return;
    if (kind === 'chisel') { // iron/bronze chisel on limestone (C)
      const p = e.panner(pos.x, pos.y + 1, pos.z, 3, 300), o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = 2200 + this.rng.next() * 900;
      g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.06); o.connect(g); g.connect(p); e.route(p, 'effects', t + 0.6); o.start(t); o.stop(t + 0.08);
    } else if (kind === 'quern') { // stone rubbing on stone: band-passed brown noise swell
      const p = e.panner(pos.x, pos.y + 0.4, pos.z, 2, 60), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = e.noiseBuffer(0.7, 'brown'); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.8;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.25); g.gain.linearRampToValueAtTime(0.0001, t + 0.65); s.connect(f); f.connect(g); g.connect(p); e.route(p, 'effects', t + 1.2); s.start(t);
    } else if (kind === 'dice') { // knucklebones on a hard floor: two or three clicks
      const p = e.panner(pos.x, pos.y + 0.2, pos.z, 1.5, 40);
      for (let i = 0; i < 3; i++) { const o = c.createOscillator(), g = c.createGain(), tt = t + i * (0.06 + this.rng.next() * 0.05); o.type = 'square'; o.frequency.value = 1400 + this.rng.next() * 600;
        g.gain.setValueAtTime(0.03, tt); g.gain.exponentialRampToValueAtTime(0.0003, tt + 0.02); o.connect(g); g.connect(p); o.start(tt); o.stop(tt + 0.03); }
      e.route(p, 'effects', t + 0.8);
    }
  }
  /** dev overlay (F3): the animal and insect voices heard in the last minute, with their tiers (D-210) */
  heardLines(): string[] { const now = this.e.ctx?.currentTime ?? 0; return [...this.heard].filter(([, t]) => now - t < 60).map(([id]) => `${id} [${AMBIENT_TIER(id)}]`); }
  footstep(surface: 'stone' | 'earth' | 'plaster', run: boolean) {
    const e = this.e; if (!e.ctx) return; const c = e.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = e.noiseBuffer(0.12, surface === 'earth' ? 'brown' : 'white');
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = surface === 'stone' ? 1800 : surface === 'plaster' ? 1200 : 400; f.Q.value = 1.2;
    const g = c.createGain(); g.gain.setValueAtTime((run ? 0.12 : 0.07) * (surface === 'earth' ? 1.6 : 1), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    s.connect(f); f.connect(g); g.connect(e.ch.effects); s.start(t);
  }
  update(dt: number, ctx: { hour: number; month: number; windMs: number; rain: number; insideSpace: string; nearColumns: boolean; stepPhase: number; running: boolean; surface: 'stone' | 'earth' | 'plaster';
    fires: { id: string; lit: boolean; pos: { x: number; y: number; z: number } }[]; listener: { x: number; y: number; z: number }; worksite: { x: number; y: number; z: number } | null; workHours: boolean;
    /** D-210: the listener's surroundings (world/fauna.ts placeAt), the day's sunrise and sunset (h), the air temperature (°C) */
    place?: Place; sun?: { rise: number; set: number }; tempC?: number }) {
    const e = this.e; if (!e.ctx || e.ctx.state !== 'running') return; if (!this.started) this.start();
    const c = e.ctx, t = c.currentTime;
    // D-245: in the lanes of the town and the villages the open air has the walls' short slap (SPACES.street, C)
    const street = ctx.insideSpace === 'open' && (ctx.place?.town ?? 0) > 0.75; this.lastSpace = street ? 'street' : ctx.insideSpace;
    const sp = street ? SPACES.street : SPACES[ctx.insideSpace] ?? SPACES.open; e.setSpace(sp, street ? 0.12 : ctx.insideSpace === 'open' ? 0.05 : 0.35);
    const inside = ctx.insideSpace !== 'open' && ctx.insideSpace !== 'portico';
    this.windGain!.gain.setTargetAtTime(Math.min(0.5, 0.03 + ctx.windMs * 0.04) * (inside ? 0.25 : 1), t, 0.5);
    this.windFilter!.frequency.setTargetAtTime(250 + ctx.windMs * 120, t, 0.5);
    this.whistleGain!.gain.setTargetAtTime(ctx.nearColumns ? Math.min(0.08, Math.max(0, ctx.windMs - 3) * 0.015) : 0, t, 0.8);
    this.rainGain!.gain.setTargetAtTime(ctx.rain * (inside ? 0.12 : 0.35), t, 0.4);
    // the beds' streams run while they can be heard (a silent bed schedules nothing)
    this.windSrc!.tick(); if (ctx.rain > 0.002) this.rainTail = t + 3; if (t < this.rainTail) this.rainSrc!.tick();
    // birds: Poisson calls by species season/time; muffled inside
    this.birdBus!.gain.setTargetAtTime((inside ? 0.25 : 1) * (1 - ctx.rain * 0.8), t, 0.5);
    for (const b of BIRDS) {
      const w = ambientWeight(b, ctx); if (w <= 0) continue;
      if (this.rng.next() < b.rate * w * dt) {
        const [d0, d1] = b.far ?? [15, 95], ang = this.rng.next() * Math.PI * 2, dist = d0 + this.rng.next() * (d1 - d0);
        const p = e.panner(ctx.listener.x + Math.cos(ang) * dist, ctx.listener.y + (b.where === 'water' || b.where === 'town' ? 0.5 : 3 + this.rng.next() * 15), ctx.listener.z + Math.sin(ang) * dist, 6, Math.max(400, d1 * 1.5));
        p.connect(this.birdBus!); b.call(e, p, t + 0.02, this.rng); this.heard.set(b.id, t);
      }
    }
    // flies (D-210): by day in the warm months where dung, middens or animals are close (C)
    const pl = ctx.place, warm = (ctx.tempC ?? 20) > 14 && ctx.month >= 3 && ctx.month <= 9 && ctx.hour > 7 && ctx.hour < 19.5;
    this.fliesLevel = pl && warm ? Math.min(1, pl.midden * 0.9 + pl.animals * 0.6) * (1 - ctx.rain) : 0;
    this.fliesGain!.gain.setTargetAtTime(0.03 * this.fliesLevel * (inside ? 0.3 : 1), t, 0.6); if (this.fliesLevel > 0.05) this.heard.set('flies', t);
    if (this.fliesLevel > 0.001) this.fliesTail = t + 4; if (t < this.fliesTail) this.fliesSrc!.tick();
    // fires: crackle source per lit fire within 40 m
    for (const f of ctx.fires) {
      const d = Math.hypot(f.pos.x - ctx.listener.x, f.pos.y - ctx.listener.y, f.pos.z - ctx.listener.z);
      let n = this.fireNodes.get(f.id);
      if (f.lit && d < 40 && !n) { const bed = new NoiseStream(e, 'pink', { seg: 4, fade: 0.4, sampleRate: 8000 }); const lf = c.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 900;
        const g = c.createGain(); g.gain.value = 0; const pan = e.panner(f.pos.x, f.pos.y, f.pos.z, 1.5, 60); bed.out.connect(lf); lf.connect(g); g.connect(pan); e.route(pan, 'effects'); n = { gain: g, pan, bed }; this.fireNodes.set(f.id, n); }
      if (n) { if (f.lit && d < 40) n.bed.tick(); // D-245: each fire's own stream, never a shared loop (audit D: two fires played one 3 s loop)
        n.gain.gain.setTargetAtTime(f.lit && d < 40 ? FIRE_BED * (0.7 + 0.3 * this.rng.next()) : 0, t, 0.05); if (this.rng.next() < dt * 6 && f.lit && d < 25) { // crackle pops
          const s = c.createBufferSource(); s.buffer = e.noiseBuffer(0.02, 'white'); const g = c.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03); s.connect(g); g.connect(n.pan); s.start(t); } }
    }
    // generic worksite chisels only when no simulated masons drive `strike` (kept for audio tests without people)
    if (ctx.worksite && ctx.workHours && (this.nextChisel -= dt) <= 0) {
      this.nextChisel = 0.35 + this.rng.next() * 0.6;
      const p = e.panner(ctx.worksite.x + (this.rng.next() - 0.5) * 30, ctx.worksite.y + 1, ctx.worksite.z + (this.rng.next() - 0.5) * 30, 3, 300);
      const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = 2200 + this.rng.next() * 900;
      g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.06); o.connect(g); g.connect(p); e.route(p, 'effects', t + 0.6); o.start(t); o.stop(t + 0.08);
    }
    // footsteps from the player's gait phase (two per stride)
    const stepIdx = Math.floor(ctx.stepPhase / Math.PI); if (stepIdx !== this.nextStep) { if (this.nextStep !== 0) this.footstep(ctx.surface, ctx.running); this.nextStep = stepIdx; }
  }
}
