// D-379 (UD-25): the proximity mic, the simulation's side. The stranger's words carry by loudness and distance: everyone in
// earshot hears them, as clearly as the level over the place's noise allows; the one spoken to is the one named, else the one
// the stranger faces, else the nearest who hears clearly; the others overhear (a memory row each: talk.ts overheard) and on a
// shout everyone in earshot turns to look. Pure functions: the render side (microphone capture, the room's acoustics) calls
// them with the mic's level and the people around the eye, and draws the turning heads from `lookers`.
//
// Tier C throughout (the constants are textbook acoustics read for a game, DECISIONS D-379):
//   speech level at 1 m, A-weighted: whisper 30 dB, normal 60, raised 70, shout 85 (ANSI S3.5 / Pearsons et al. 1977 ranges);
//   spherical spreading: -6 dB per doubling of distance (20·log10 d), no walls (the render side's acoustics may lower it);
//   the voice is directional: about -3 dB to the side, -6 dB behind (human speech directivity, mid frequencies);
//   the place's noise: 30 dB at night, 40 in the town by day, 55 in a market or at the mill;
//   heard at all (the words are a voice) from -6 dB below the noise; understood (clear) from +10 dB above it; clarity between
//   them is the Speech Intelligibility Index band-audibility line (SNR + 15) / 30, clamped to 0..1;
//   a whisper is said into the ear of the one within reach (≤ 1.2 m; the mouth ~0.1 m from the ear): only they can hear it.
export type Loudness = 'whisper' | 'normal' | 'raised' | 'shout';
export const SPEECH_DB: Record<Loudness, number> = { whisper: 30, normal: 60, raised: 70, shout: 85 };
export const AMBIENT_DB = { night: 30, town: 40, market: 55 } as const;
export const EARSHOT = {
  /** heard at all from this SNR (dB) */ audibleSnr: -6,
  /** understood from this SNR (dB) */ clearSnr: 10,
  /** the closest a mouth is to an ear (m): the level does not climb without end */ minM: 0.1,
  /** a whisper goes into the ear of the nearest within this reach (m) */ whisperReachM: 1.2,
  /** the voice behind the speaker (dB below the front) */ behindDb: 6,
  /** the addressee by facing: within this angle of the speaker's facing (deg) */ faceDeg: 30,
  /** nobody beyond this hears anything (m): the town's walls and lanes block a shout long before spreading alone would */ maxM: 120,
} as const;

export interface Listener { pid: number; e: number; n: number; /** the way they face, compass degrees (0 = north, +n; 90 = east, +e) */ facing?: number }
export interface Speaker { e: number; n: number; /** the way the stranger faces, compass degrees (0 = north, +n; 90 = east, +e) */ yawDeg: number }
export interface Hearer {
  pid: number; d: number;
  /** the angle between the speaker's facing and the way to the hearer (deg, 0..180) */ off: number;
  /** the level at the hearer (dB), and its margin over the place's noise */ db: number; snr: number;
  /** how much of the words they make out (0..1) */ clarity: number;
  /** understood (SNR ≥ +10 dB) */ clear: boolean;
  /** the bearing from the hearer to the speaker (compass deg): where they turn to look */ toSpeaker: number;
}

const bearing = (de: number, dn: number) => ((Math.atan2(de, dn) * 180 / Math.PI) + 360) % 360;
const angDiff = (a: number, b: number) => { const x = Math.abs(((a - b) % 360 + 360) % 360); return x > 180 ? 360 - x : x; };

/** the place's noise (dB): night, the town by day, or a market or mill (the caller knows where the stranger stands) */
export function ambientFor(hour: number, busy = false): number {
  if (hour < 5 || hour >= 21) return AMBIENT_DB.night; return busy ? AMBIENT_DB.market : AMBIENT_DB.town;
}

/** who hears the stranger's words and how clearly, nearest first (only those who hear at all) */
export function hearers(people: readonly Listener[], speaker: Speaker, loudness: Loudness, ambientDb: number = AMBIENT_DB.town): Hearer[] {
  const L1 = SPEECH_DB[loudness]; const out: Hearer[] = [];
  let ear = -1; // the whisper's ear: the nearest within reach
  if (loudness === 'whisper') { let best = Infinity; for (let i = 0; i < people.length; i++) { const p = people[i], d = Math.hypot(p.e - speaker.e, p.n - speaker.n); if (d <= EARSHOT.whisperReachM && d < best) { best = d; ear = i; } } }
  for (let i = 0; i < people.length; i++) {
    const p = people[i], de = p.e - speaker.e, dn = p.n - speaker.n, d = Math.hypot(de, dn); if (d > EARSHOT.maxM) continue;
    const off = d < 1e-6 ? 0 : angDiff(bearing(de, dn), speaker.yawDeg);
    const dir = -EARSHOT.behindDb * (1 - Math.cos(off * Math.PI / 180)) / 2; // 0 in front, -3 to the side, -6 behind
    const r = i === ear ? EARSHOT.minM : Math.max(EARSHOT.minM, d);
    const db = L1 - 20 * Math.log10(r) + (i === ear ? 0 : dir), snr = db - ambientDb;
    if (snr < EARSHOT.audibleSnr) continue;
    out.push({ pid: p.pid, d, off, db, snr, clarity: Math.max(0, Math.min(1, (snr + 15) / 30)), clear: snr >= EARSHOT.clearSnr - 1e-9, toSpeaker: bearing(-de, -dn) });
  }
  return out.sort((a, b) => a.d - b.d || a.pid - b.pid);
}

const plain = (s: string) => s.replace(/^\*/, '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '');
/** the one spoken to: a name said in the words (among those who hear; their spoken name, without the reconstruction mark),
 *  else the one most in front of the stranger within ~30° (nearest of them), else the nearest who hears clearly; null if nobody */
export function addressee(heard: readonly Hearer[], words: string, nameOf: (pid: number) => string | null | undefined): Hearer | null {
  if (!heard.length) return null;
  const w = ` ${plain(words).replace(/[^a-z0-9]+/g, ' ')} `;
  for (const h of heard) { const n = plain(nameOf(h.pid) ?? '').replace(/[^a-z0-9 ]+/g, ' ').trim(); if (!n) continue;
    const first = n.split(/\s+/)[0]; if ((n.length >= 3 && w.includes(` ${n} `)) || (first.length >= 3 && w.includes(` ${first} `))) return h; }
  const faced = heard.filter(h => h.off <= EARSHOT.faceDeg && h.clarity > 0.5).sort((a, b) => a.d - b.d)[0]; if (faced) return faced;
  return heard.find(h => h.clear) ?? null;
}

/** how loud the stranger spoke: from the mic's level (RMS, dBFS) when given, else from the words ("!" raised; "!!" or all
 *  capitals shouted; "(…)" or "psst" whispered). C: a headset mic at a normal voice reads about -30..-20 dBFS */
export function loudnessOf(x: number | string): Loudness {
  if (typeof x === 'number') return x < -42 ? 'whisper' : x < -22 ? 'normal' : x < -12 ? 'raised' : 'shout';
  const s = x.trim(); if (/^\(.*\)$/.test(s) || /^psst\b/i.test(s)) return 'whisper';
  const letters = s.replace(/[^\p{L}]/gu, ''), upper = s.replace(/[^\p{Lu}]/gu, '');
  if (/!{2,}/.test(s) || (letters.length >= 4 && upper.length / letters.length >= 0.8)) return 'shout';
  return s.includes('!') ? 'raised' : 'normal';
}

/** who turns to look: on a shout everyone in earshot; otherwise nobody but the addressee (the render side turns heads to
 *  `toSpeaker`; one already facing within 20° does not need to turn) */
export function lookers(heard: readonly Hearer[], loudness: Loudness, people?: readonly Listener[]): { pid: number; toSpeaker: number }[] {
  if (loudness !== 'shout') return [];
  const face = new Map((people ?? []).map(p => [p.pid, p.facing]));
  return heard.filter(h => { const f = face.get(h.pid); return f === undefined || angDiff(f, h.toSpeaker) > 20; }).map(h => ({ pid: h.pid, toSpeaker: h.toSpeaker }));
}

/** one utterance heard in the world: who hears, the one spoken to, the bystanders who overhear it clearly, who turns */
export interface Heard { loudness: Loudness; ambientDb: number; heard: Hearer[]; to: Hearer | null; bystanders: Hearer[]; look: { pid: number; toSpeaker: number }[] }
export function earshot(people: readonly Listener[], speaker: Speaker, words: string, nameOf: (pid: number) => string | null | undefined, o: { rmsDb?: number; ambientDb?: number } = {}): Heard {
  const loudness = loudnessOf(o.rmsDb ?? words), ambientDb = o.ambientDb ?? AMBIENT_DB.town;
  const heard = hearers(people, speaker, loudness, ambientDb), to = addressee(heard, words, nameOf);
  return { loudness, ambientDb, heard, to, bystanders: heard.filter(h => h.clear && h !== to), look: lookers(heard, loudness, people) };
}
/** a bystander's memory of it (the sim's talk memory; it carries into their gossip and later talk) */
export function noteOverheard(talk: { overheard(pid: number, t: number, conv: number, said: string, by: number): unknown }, H: Heard, t: number, conv: number, words: string) {
  for (const b of H.bystanders) talk.overheard(b.pid, t, conv, words, H.to?.pid ?? -1);
}
/** the mic's level of an utterance (RMS, dBFS) for loudnessOf: the voiced part only (the loudest half of 20 ms frames) */
export function rmsDbOf(samples: ArrayLike<number>, frame = 320): number {
  const f: number[] = []; for (let i = 0; i + frame <= samples.length; i += frame) { let s = 0; for (let j = i; j < i + frame; j++) s += samples[j] * samples[j]; f.push(s / frame); }
  if (!f.length) return -120; f.sort((a, b) => b - a); const top = f.slice(0, Math.max(1, Math.ceil(f.length / 2))); const m = top.reduce((a, b) => a + b, 0) / top.length;
  return 10 * Math.log10(Math.max(1e-12, m));
}
