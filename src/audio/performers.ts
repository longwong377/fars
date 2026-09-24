// Who plays or sings, when and where (brief §11 "Music: only what someone in the world is playing"; D-178). Pure: a
// function of the simulation's people, the hour and the day, so tests and the lint can run it, and the same world seed
// always gives the same schedule. Every gig cites research/SOUNDSCAPE.md §8 claims (MUSIC_CLAIMS).
//
//  - the quern song (M-07, M-09, M-13, M-15, M-17; tier C): a woman of the work camp kneeling at her quern sings,
//    without words, in a Babylonian tuning; in about three twenty-minute stretches in ten, one of the women at the querns
//    sings for three to six minutes. Greek trades had a millstone song (Athenaeus 14); here it is a reconstruction;
//  - the mason's song (M-07, M-08, M-14, M-15, M-17; C): an Ionian stonecutter dressing a block sings to himself in a Greek
//    mode, rarer still (one stretch in eight for each Ionian at work);
//  - the court at supper (M-01, M-03, M-04, M-16, M-17, M-13; B practice, C everything else): only on the days the court is
//    resident (the out-of-world setting, D-003); from half an hour to two and a half hours after sunset, in the Hadish
//    hall (C: which hall the king dined in is not known), four women sing (one leads, then all) and two play angular
//    harps, three-minute pieces with pauses; the melody is shared (heterophony, C);
//  - the night watch (M-02; B practice, C the rest): after supper until half an hour before sunrise, now and then one
//    woman sings with a harp in the same hall.
// Not here, on purpose: nothing at an offering (Herodotus 1.132: no pipes; the chant's text is not attested: M-06,
// BLOCKERS B20); no herders' pipes (herders are not rendered: M-10, Q-302); no soldiers', street or foreign music beyond
// the Ionians' songs (no source seen).
import { Rng } from '../core/rng';
import type { Performance } from './music';
import { tierOf } from './musicClaims';
import { MESOPOTAMIAN_MODES, GREEK_MODES } from './tuning';

export interface PerformerAgent { id: number; role: string; origin: string; sex: 'm' | 'f'; seed: number; offmap: boolean; walking: boolean;
  task: { act: string; place: string } | null; pos: [number, number]; y: number }
export interface MusicCtx {
  /** sim hours since the start of the regnal year */
  t: number; seed: number;
  /** the court resident on this day and on the day before (the night watch runs past midnight) */
  courtToday: boolean; courtYesterday: boolean;
  sun: { rise: number; set: number };
  /** heavy rain or a storm today: no singing at outdoor work (C) */
  foul: boolean;
  /** the hall where the court's women play (grid centre, size, floor): the Hadish's measured room */
  courtHall?: { cx: number; cy: number; sx: number; sy: number; fl: number } | null;
}
/** one voice or instrument of a gig: a simulated person (agentId) or a court musician placed in the hall (extra) */
/** `pos`: where the sound comes from (the mouth or the instrument); an extra is seated on the floor at `extra.floor` */
export interface GigPart { key: string; agentId?: number; extra?: { sex: 'm' | 'f'; seed: number; yaw: number; anim: 'sit' | 'idle'; floor: number }; pos: { e: number; n: number; y: number }; perf: Performance | null }
export interface Gig { id: string; kind: 'quern_song' | 'mason_song' | 'court_supper' | 'court_night'; place: string; parts: GigPart[]; claims: string[]; tier: string;
  /** hours (sim) when this stretch of playing ends */
  until: number;
  /** what you see: PLACEHOLDER when the playing or the instrument is not shown */
  visual: { placeholder: boolean; note: string } }

/** the activities during which a person may sing at work */
export const QUERN_ACTS = new Set(['grind']);
export const MASON_ACTS = new Set(['dress_stone']);
export const BLOCK_H = 1 / 3;
export const QUERN_P = 0.3, MASON_P = 0.125;
const u = (seed: number, key: string) => new Rng(seed, key).next();

export function musicAt(agents: readonly PerformerAgent[], c: MusicCtx): Gig[] {
  const out: Gig[] = [], day = Math.floor(c.t / 24), h = c.t - day * 24, block = Math.floor(c.t / BLOCK_H);
  const present = (a: PerformerAgent) => !a.offmap && !a.walking && a.task;
  // --- work songs (daylight, not in foul weather)
  if (!c.foul && h > c.sun.rise && h < c.sun.set) {
    const byPlace = new Map<string, PerformerAgent[]>();
    for (const a of agents) if (present(a) && a.sex === 'f' && QUERN_ACTS.has(a.task!.act)) (byPlace.get(a.task!.place) ?? byPlace.set(a.task!.place, []).get(a.task!.place)!).push(a);
    for (const [place, as] of byPlace) {
      const key = `quern:${place}:${block}`; if (u(c.seed, key) >= QUERN_P) continue;
      const w = window(c.seed, key, block, 0.05, 0.1); if (c.t < w.from || c.t >= w.to) continue;
      const sorted = [...as].sort((x, y) => x.id - y.id), s = sorted[Math.floor(u(c.seed, key + ':who') * sorted.length)];
      const claims = ['M-07', 'M-09', 'M-13', 'M-15', 'M-17'];
      const mode = MESOPOTAMIAN_MODES[Math.floor(u(c.seed, `quern-mode:${s.id}:${day}`) * 7)].id;
      out.push({ id: key, kind: 'quern_song', place, claims, tier: tierOf(claims), until: w.to,
        visual: { placeholder: true, note: 'PLACEHOLDER: she keeps her grinding pose; the jaw moves as in speech (no singing mouth shape)' },
        parts: [{ key: `${key}:v`, agentId: s.id, pos: { e: s.pos[0], n: s.pos[1], y: s.y + 1.0 }, perf: { id: `${key}:v`, instrument: 'voice', register: 'f', tradition: 'mesopotamian', context: 'work', modeId: mode, seed: new Rng(s.seed, `song:${block}`).int(0, 1e9), claims } }] });
    }
    for (const a of agents) {
      if (!present(a) || a.origin !== 'Ionian' || !MASON_ACTS.has(a.task!.act)) continue;
      const key = `mason:${a.id}:${block}`; if (u(c.seed, key) >= MASON_P) continue;
      const w = window(c.seed, key, block, 0.04, 0.08); if (c.t < w.from || c.t >= w.to) continue;
      const claims = ['M-07', 'M-08', 'M-14', 'M-15', 'M-17'];
      const mode = GREEK_MODES[Math.floor(u(c.seed, `mason-mode:${a.id}:${day}`) * GREEK_MODES.length)].id;
      out.push({ id: key, kind: 'mason_song', place: a.task!.place, claims, tier: tierOf(claims), until: w.to,
        visual: { placeholder: true, note: 'PLACEHOLDER: he keeps his chiselling pose; the jaw moves as in speech (no singing mouth shape)' },
        parts: [{ key: `${key}:v`, agentId: a.id, pos: { e: a.pos[0], n: a.pos[1], y: a.y + 1.6 }, perf: { id: `${key}:v`, instrument: 'voice', register: 'm', tradition: 'greek', context: 'work', modeId: mode, seed: new Rng(a.seed, `song:${block}`).int(0, 1e9), claims } }] });
    }
  }
  // --- the court (setting only)
  const hall = c.courtHall;
  if (hall) {
    const supperFrom = c.sun.set + 0.5, supperTo = c.sun.set + 2.5;
    if (c.courtToday && h >= supperFrom && h < supperTo) {
      const P = 0.075, k = Math.floor((h - supperFrom) / P), from = day * 24 + supperFrom + k * P, to = from + 0.05;
      if (c.t < to) out.push(courtGig(c, hall, 'court_supper', `court:supper:${day}:${k}`, to, 4, 2, ['M-01', 'M-03', 'M-04', 'M-13', 'M-16', 'M-17']));
    }
    // the night watch: after supper to half an hour before sunrise (the night of `day`, or of the day before after midnight)
    const night = (h >= supperTo && c.courtToday) || (h < c.sun.rise - 0.5 && c.courtYesterday);
    if (night) {
      const nb = Math.floor(c.t / 0.5), key = `court:night:${nb}`;
      if (u(c.seed, key) < 0.5) { const w = window(c.seed, key, nb, 0.05, 0.05, 0.5); if (c.t >= w.from && c.t < w.to) out.push(courtGig(c, hall, 'court_night', key, w.to, 1, 1, ['M-02', 'M-04', 'M-13', 'M-16', 'M-17'])); }
    }
  }
  return out;
}

/** a stretch of playing inside a block: starts at a seeded offset, lasts `min`..`max` hours */
function window(seed: number, key: string, block: number, min: number, max: number, blockH = BLOCK_H) {
  const len = min + (max - min) * u(seed, key + ':len'), from = block * blockH + (blockH - len) * u(seed, key + ':at');
  return { from, to: from + len };
}

function courtGig(c: MusicCtx, hall: NonNullable<MusicCtx['courtHall']>, kind: 'court_supper' | 'court_night', key: string, until: number, singers: number, harps: number, claims: string[]): Gig {
  const r = new Rng(c.seed, key), pieceSeed = r.int(0, 1e9), tonic = r.range(196, 247), modeId = MESOPOTAMIAN_MODES[r.int(0, 6)].id, tempo = r.range(66, 92);
  // the women sit together in the north half of the hall, facing south (C)
  const at = (i: number, n: number, row: number) => ({ e: hall.cx + (i - (n - 1) / 2) * 1.3, n: hall.cy + 4 + row * 1.4, y: hall.fl + 0.9 });
  const parts: GigPart[] = [];
  for (let i = 0; i < harps; i++) parts.push({ key: `court:harpist:${i}`, extra: { sex: 'f', seed: 7000 + i, yaw: Math.PI, anim: 'sit', floor: hall.fl }, pos: at(i, harps, 0),
    perf: { id: `${key}:harp${i}`, instrument: 'harp', tradition: 'mesopotamian', context: 'court', modeId, pieceSeed, tonic, tempo, seed: r.int(0, 1e9), claims } });
  for (let i = 0; i < singers; i++) parts.push({ key: `court:singer:${i}`, extra: { sex: 'f', seed: 7100 + i, yaw: Math.PI, anim: 'sit', floor: hall.fl }, pos: at(i, singers, 1),
    perf: i === 0 ? { id: `${key}:voices`, instrument: 'voice', register: 'f', voices: singers, tradition: 'mesopotamian', context: 'court', modeId, pieceSeed, tonic, tempo, seed: r.int(0, 1e9), claims } : null });
  return { id: key, kind, place: 'hadish', claims, tier: tierOf(claims), until, parts,
    visual: { placeholder: true, note: 'PLACEHOLDER: the court women sit in the working women’s dress (court dress not modelled), with no harp modelled and no playing animation' } };
}
/** the parts that sound (a chorus sings from its leader's place; the other singers only sit with her) */
export const soundingParts = (g: Gig) => g.parts.filter(p => p.perf);
