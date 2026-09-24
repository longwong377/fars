// Who plays or sings, when and where (brief §11 "Music: only what someone in the world is playing"; D-178). Pure: a
// function of the simulation's people, the hour and the day, so tests and the lint can run it, and the same world seed
// always gives the same schedule. Every gig cites research/SOUNDSCAPE.md §8 claims (MUSIC_CLAIMS).
//
//  - the quern song (M-07, M-09, M-13, M-15, M-17; tier C): a woman of the work camp kneeling at her quern sings,
//    without words, in a Babylonian tuning; in about three twenty-minute stretches in ten, one of the women at the querns
//    sings for three to six minutes. Greek trades had a millstone song (Athenaeus 14); here it is a reconstruction;
//  - the mason's song (M-07, M-08, M-14, M-15, M-17; C): an Ionian stonecutter dressing a block sings to himself in a Greek
//    mode, rarer still (one stretch in eight for each Ionian at work);
//  - the court at supper (M-01, M-03, M-04, M-16, M-17, M-13, M-19, M-20; B practice, C everything else): only on the days
//    the court is resident (the out-of-world setting, D-003); from half an hour to two and a half hours after sunset, in
//    the Hadish hall (C: which hall the king dined in is not known), four women sing (one leads, then all) and two play
//    vertical angular harps with the fingers (Heracleides' psallein; the harp of the Madaktu orchestra), standing (as the
//    Madaktu musicians do: C for a supper), three-minute pieces with pauses; the melody is shared (heterophony, C);
//  - the night watch (M-02; B practice, C the rest): after supper until half an hour before sunrise, now and then one
//    woman sings with a harp in the same hall;
//  - the herder's pipe (M-10, M-18, M-13, M-17; C, D-200): a man of a transhumant band (E-49), 14-55, plays a cane reed
//    pipe, sitting, in the evening by the band's fire (in two of five twenty-minute stretches, four to seven minutes) or
//    at midday while the flock lies up (one in four); the same man of his band all day; not in foul weather. The herders
//    are the population's people (popview.ts): `pop` is who the view places out of doors now.
// Not here, on purpose: nothing at an offering (Herodotus 1.132: no pipes; the chant's text is not attested and the rite
// is a living religion's: M-06, BLOCKERS B20, D-200 keeps it silent, not even a wordless contour); no soldiers', street or
// foreign music beyond the Ionians' songs (no source seen); no lyre, frame drum or double pipe (modelled and animated,
// D-200, but no source says who played them at Persepolis).
import { Rng } from '../core/rng';
import type { Performance } from './music';
import { tierOf } from './musicClaims';
import { MESOPOTAMIAN_MODES, GREEK_MODES } from './tuning';
import type { PlayKind } from '../people/playing';

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
/** a person of the population out of doors now (popview.ts ViewPerson with the person's sex and age): the herders */
export interface PopPerformer { pid: number; sex: 'm' | 'f'; age: number; act: string; why: string; place: string; e: number; n: number; y: number; moving: boolean; seed: number }
/** one voice or instrument of a gig: a simulated person (agentId), a person of the population (pid) or a court musician
 *  placed in the hall (extra). `pos`: where the sound comes from (the mouth or the instrument); an extra stands on the
 *  floor at `extra.floor`. `play`: what the performer is seen doing (playing.ts) */
export interface GigPart { key: string; agentId?: number; pid?: number; extra?: { sex: 'm' | 'f'; seed: number; /** facing, grid degrees (0 north, 90 east) */ heading: number; anim: 'sit' | 'idle'; floor: number }; pos: { e: number; n: number; y: number }; perf: Performance | null; play?: PlayKind }
export interface Gig { id: string; kind: 'quern_song' | 'mason_song' | 'court_supper' | 'court_night' | 'herder_pipe'; place: string; parts: GigPart[]; claims: string[]; tier: string;
  /** hours (sim) when this stretch of playing ends */
  until: number;
  /** what you see: PLACEHOLDER when the playing or the instrument is not shown */
  visual: { placeholder: boolean; note: string } }

/** the activities during which a person may sing at work */
export const QUERN_ACTS = new Set(['grind']);
export const MASON_ACTS = new Set(['dress_stone']);
export const BLOCK_H = 1 / 3;
export const QUERN_P = 0.3, MASON_P = 0.125;
/** the herders' pipe: the share of twenty-minute stretches with piping at a band's evening fire, and at the midday halt */
export const PIPE_EVE_P = 0.4, PIPE_NOON_P = 0.25;
/** a herder of a band who may play: a man of 14-55 by the evening fire at the band's camp, or resting by the flock at the
 *  midday halt (population.ts herderPassing's reasons; C) */
export function piperSlot(o: PopPerformer, h: number, sun: { rise: number; set: number }): 'eve' | 'noon' | null {
  if (o.moving || o.sex !== 'm' || o.age < 14 || o.age > 55) return null;
  if (h >= sun.set + 0.25 && h < sun.set + 2.5 && o.act === 'talk' && /^camp:band\d+:/.test(o.place) && /by the fire/.test(o.why)) return 'eve';
  if (h > sun.rise && h < sun.set && o.act === 'rest' && /^route:band\d+:/.test(o.place) && /flock lies up/.test(o.why)) return 'noon';
  return null;
}
const u = (seed: number, key: string) => new Rng(seed, key).next();

export function musicAt(agents: readonly PerformerAgent[], c: MusicCtx, pop: readonly PopPerformer[] = []): Gig[] {
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
        visual: { placeholder: false, note: 'she keeps grinding and sings: the jaw opens on the sung notes, the chest draws breath before each phrase (jaw only: the rig has no lips; C)' },
        parts: [{ key: `${key}:v`, agentId: s.id, play: 'sing_work', pos: { e: s.pos[0], n: s.pos[1], y: s.y + 1.0 }, perf: { id: `${key}:v`, instrument: 'voice', register: 'f', tradition: 'mesopotamian', context: 'work', modeId: mode, seed: new Rng(s.seed, `song:${block}`).int(0, 1e9), claims } }] });
    }
    for (const a of agents) {
      if (!present(a) || a.origin !== 'Ionian' || !MASON_ACTS.has(a.task!.act)) continue;
      const key = `mason:${a.id}:${block}`; if (u(c.seed, key) >= MASON_P) continue;
      const w = window(c.seed, key, block, 0.04, 0.08); if (c.t < w.from || c.t >= w.to) continue;
      const claims = ['M-07', 'M-08', 'M-14', 'M-15', 'M-17'];
      const mode = GREEK_MODES[Math.floor(u(c.seed, `mason-mode:${a.id}:${day}`) * GREEK_MODES.length)].id;
      out.push({ id: key, kind: 'mason_song', place: a.task!.place, claims, tier: tierOf(claims), until: w.to,
        visual: { placeholder: false, note: 'he keeps dressing the block and sings: the jaw opens on the sung notes, the chest draws breath before each phrase (jaw only; C)' },
        parts: [{ key: `${key}:v`, agentId: a.id, play: 'sing_work', pos: { e: a.pos[0], n: a.pos[1], y: a.y + 1.6 }, perf: { id: `${key}:v`, instrument: 'voice', register: 'm', tradition: 'greek', context: 'work', modeId: mode, seed: new Rng(a.seed, `song:${block}`).int(0, 1e9), claims } }] });
    }
  }
  // --- the herders' pipe (D-200): at a band's evening fire, or by the flock at the midday halt
  if (!c.foul && pop.length) {
    const slots = new Map<string, PopPerformer[]>();
    for (const o of pop) { const w = piperSlot(o, h, c.sun); if (!w) continue; const k = `${w}|${o.place}`; (slots.get(k) ?? slots.set(k, []).get(k)!).push(o); }
    for (const [k, os] of slots) {
      const [when, place] = [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)], key = `pipe:${place}:${block}`;
      if (u(c.seed, key) >= (when === 'eve' ? PIPE_EVE_P : PIPE_NOON_P)) continue;
      const w = window(c.seed, key, block, 0.06, 0.12); if (c.t < w.from || c.t >= w.to) continue;
      // the band's piper of the day: the same man whenever he is there
      const pu = (o: PopPerformer) => u(c.seed, `piper:${o.pid}:${day}`), s = os.reduce((b, o) => (pu(o) < pu(b) ? o : b));
      const claims = ['M-10', 'M-18', 'M-13', 'M-17'], r = new Rng(s.seed, `pipe:${block}`);
      out.push({ id: key, kind: 'herder_pipe', place, claims, tier: tierOf(claims), until: w.to,
        visual: { placeholder: false, note: 'a man of the band plays a cane reed pipe, sitting on the ground; the fingers stop the holes (the rig curls a whole hand, no single finger; C)' },
        parts: [{ key: `${key}:p`, pid: s.pid, play: 'reed_pipe', pos: { e: s.e, n: s.n, y: s.y + 0.8 },
          perf: { id: `${key}:p`, instrument: 'reed_pipe', tradition: 'mesopotamian', context: 'herding', modeId: MESOPOTAMIAN_MODES[r.int(0, 6)].id, tempo: r.range(58, 80), seed: r.int(0, 1e9), claims } }] });
    }
  }
  // --- the court (setting only)
  const hall = c.courtHall;
  if (hall) {
    const supperFrom = c.sun.set + 0.5, supperTo = c.sun.set + 2.5;
    if (c.courtToday && h >= supperFrom && h < supperTo) {
      const P = 0.075, k = Math.floor((h - supperFrom) / P), from = day * 24 + supperFrom + k * P, to = from + 0.05;
      if (c.t < to) out.push(courtGig(c, hall, 'court_supper', `court:supper:${day}:${k}`, to, 4, 2, ['M-01', 'M-03', 'M-04', 'M-13', 'M-16', 'M-17', 'M-19', 'M-20']));
    }
    // the night watch: after supper to half an hour before sunrise (the night of `day`, or of the day before after midnight)
    const night = (h >= supperTo && c.courtToday) || (h < c.sun.rise - 0.5 && c.courtYesterday);
    if (night) {
      const nb = Math.floor(c.t / 0.5), key = `court:night:${nb}`;
      if (u(c.seed, key) < 0.5) { const w = window(c.seed, key, nb, 0.05, 0.05, 0.5); if (c.t >= w.from && c.t < w.to) out.push(courtGig(c, hall, 'court_night', key, w.to, 1, 1, ['M-02', 'M-04', 'M-13', 'M-16', 'M-17', 'M-19', 'M-20'])); }
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
  // the women stand together in the north half of the hall, facing south: the harpists in front, the singers behind (C;
  // the Madaktu musicians stand and walk, M-19); the sound from the harp's strings (1.2 m) and the singers' mouths (1.5 m)
  const at = (i: number, n: number, row: number) => ({ e: hall.cx + (i - (n - 1) / 2) * 1.3, n: hall.cy + 4 + row * 1.4, y: hall.fl + (row ? 1.5 : 1.2) });
  const parts: GigPart[] = [];
  for (let i = 0; i < harps; i++) parts.push({ key: `court:harpist:${i}`, extra: { sex: 'f', seed: 7000 + i, heading: 180, anim: 'idle', floor: hall.fl }, pos: at(i, harps, 0), play: 'harp_v',
    perf: { id: `${key}:harp${i}`, instrument: 'harp', tradition: 'mesopotamian', context: 'court', modeId, pieceSeed, tonic, tempo, seed: r.int(0, 1e9), claims } });
  for (let i = 0; i < singers; i++) parts.push({ key: `court:singer:${i}`, extra: { sex: 'f', seed: 7100 + i, heading: 180, anim: 'idle', floor: hall.fl }, pos: at(i, singers, 1), play: 'sing',
    perf: i === 0 ? { id: `${key}:voices`, instrument: 'voice', register: 'f', voices: singers, tradition: 'mesopotamian', context: 'court', modeId, pieceSeed, tonic, tempo, seed: r.int(0, 1e9), claims } : null });
  return { id: key, kind, place: 'hadish', claims, tier: tierOf(claims), until, parts,
    visual: { placeholder: true, note: 'PLACEHOLDER: the court women wear the working women’s dress (court dress not modelled: BLOCKERS B20c). The harps and the playing and singing are modelled (D-200, C)' } };
}
/** the parts that sound (a chorus sings from its leader's place; the other singers only sit with her) */
export const soundingParts = (g: Gig) => g.parts.filter(p => p.perf);
