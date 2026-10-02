// The recorded sound plan (D-620, UD-33: recordings are the sound, the synthesis in soundscape.ts the fallback). Pure, so the
// census (tools/dev/sound_census.ts), the fetch list (tools/audio/fetch_list.json) and the runtime (sampler.ts) agree on one
// catalogue: which bed layers exist, which one-shot sets and footstep surfaces, which room impulse responses, and which beds
// play at a place, hour, season and weather.
//  - Places (SoundPlace): what the listener's surroundings sound like: the Terrace's open stone, its roofed halls, the town's
//    lanes, a village's edge, the plain (by season), the river bank, orchards and gardens, Kuh-e Rahmat's slopes; a town room
//    (when the walk's hook says the body is under a roof in the town). Classified from what world.ts already gives the
//    soundscape (fauna.placeAt, the Terrace rooms' space, the listener's position and height), C.
//  - Times: the coverage hour bands (tools/dev/coverage_time.ts) fold to four bed times: dawn (pre-dawn's last hour and dawn),
//    day, dusk, night; a place without a dawn or dusk bed plays its day bed (BED_FALLBACK).
//  - Seasons (the plain's beds): spring Mar-May (larks, insects in the green crop), summer Jun-Aug (cicadas, grasshoppers,
//    dry wind), autumn Sep-Nov (stubble, crows), winter Dec-Feb (wind, little else); warm nights (Apr-Oct) have crickets.
//  - Weather layers over the place bed: light and heavy rain, rain on a roof (inside), drips after rain and in mist, gusts
//    (storm), dust wind, the hush of snow; thunder is a one-shot set.
// Every level is C (a mix by ear, set against the synthesised beds' measured levels, tools/dev/audio_render.ts).

export const BED_TIMES = ['dawn', 'day', 'dusk', 'night'] as const;
export type BedTime = typeof BED_TIMES[number];
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = typeof SEASONS[number];
export const SOUND_PLACES = ['terrace', 'hall', 'town', 'room', 'village', 'plain', 'river', 'orchard', 'hillside'] as const;
export type SoundPlace = typeof SOUND_PLACES[number];

/** every bed layer the world plays (the recordings tools/audio/fetch_list.json must supply; ids are file stems) */
export const BED_LAYERS = [
  // the town's lanes: distant work, doors, animals, no intelligible voices (the people's voices are the voices system's)
  'town_dawn', 'town_day', 'town_dusk', 'town_night',
  'village_dawn', 'village_day', 'village_night',
  // the plain by season and time
  'plain_spring_day', 'plain_summer_day', 'plain_autumn_day', 'plain_winter_day', 'plain_dawn', 'plain_dusk', 'plain_night_warm', 'plain_night_cold',
  'orchard_day', 'orchard_night',
  'river_day', 'river_night', 'canal',
  // the Terrace: wind over stone, high and open; the halls' still air
  'terrace_day', 'terrace_night', 'hall_tone',
  'hillside_day', 'hillside_night',
  // interiors in the town and villages: a small room's tone, the hearth
  'room_tone', 'hearth',
  // the Hall of 100 Columns' building site (masons at work, heard from the Terrace)
  'worksite',
  // weather
  'rain_light', 'rain_heavy', 'rain_roof', 'drips', 'wind_gusts', 'dust_wind', 'snow_hush',
] as const;
export type BedLayer = typeof BED_LAYERS[number];

/** a bed time a place has no recording for falls back to these, in order */
export const BED_FALLBACK: Record<BedTime, BedTime[]> = { dawn: ['dawn', 'day'], day: ['day'], dusk: ['dusk', 'day'], night: ['night'] };

/** the footstep surfaces (the walk's ground kinds); each has a walking set, the ones marked in FOOT_RUN a running set */
export const FOOT_SURFACES = ['stone', 'plaster', 'earth', 'dust', 'gravel', 'grass', 'leaves', 'mud', 'snow', 'wood', 'rug', 'water'] as const;
export type FootSurface = typeof FOOT_SURFACES[number];
export const FOOT_RUN: FootSurface[] = ['stone', 'earth', 'gravel', 'grass', 'dust'];

/** the rooms' measured impulse responses (OpenAIR, CC BY 4.0; tools/audio/irs.mjs), by the kind of space they stand for */
export const IR_KINDS = ['hall_large', 'hall_medium', 'room_small', 'court', 'gorge', 'open', 'wood', 'chamber'] as const;
export type IrKind = typeof IR_KINDS[number];

/** the hour band of the coverage harness folded to a bed time */
export function bedTime(band: string): BedTime {
  if (band === 'dawn') return 'dawn';
  if (band === 'dusk') return 'dusk';
  if (band === 'morning' || band === 'noon' || band === 'afternoon') return 'day';
  return 'night'; // pre-dawn, moonlit-night, moonless-night
}
/** the bed time at a local hour, from the day's sunrise and sunset (h) */
export function bedTimeAt(hour: number, sun: { rise: number; set: number } = { rise: 6, set: 18 }): BedTime {
  if (hour >= sun.rise - 0.75 && hour < sun.rise + 1.25) return 'dawn';
  if (hour >= sun.set - 1 && hour < sun.set + 0.75) return 'dusk';
  return hour >= sun.rise && hour < sun.set ? 'day' : 'night';
}
/** month 0-11 (January = 0) to season */
export function seasonOf(month0: number): Season {
  const m = ((month0 % 12) + 12) % 12;
  return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
}
const warmNight = (month0: number) => month0 >= 3 && month0 <= 9;

/** the listener's surroundings (soundscape.ts Place; world/fauna.ts placeAt) */
export interface PlaceMix { town: number; water: number; trees: number; midden: number; animals: number }
export interface Where {
  /** world position (east, north) and the feet's height over the court datum (m) */
  e: number; n: number; feetY?: number;
  /** the Terrace room the listener is in ('open', 'portico' or a room id: soundscape SPACES) */
  insideSpace: string;
  place?: PlaceMix;
  /** the walk's hook (C9): under a roof in the town or a village */
  roofed?: boolean;
}
/** the Terrace's platform (E, N bounds of its walkable top; coverage_points' terrace strata) and the Kuh-e Rahmat slopes */
const TERRACE = { e0: -70, e1: 240, n0: -225, n1: 165 };
const onTerrace = (w: Where) => w.e > TERRACE.e0 && w.e < TERRACE.e1 && w.n > TERRACE.n0 && w.n < TERRACE.n1 && (w.feetY ?? 0) > -1;
const onRahmat = (w: Where) => !onTerrace(w) && w.e > 200 && w.e < 1700 && w.n > -1200 && w.n < 800 && (w.feetY ?? 0) > 3;
/** the Hall of 100 Columns' building site (D-142's masons; the hall's centre, C) */
export const WORKSITE = { e: 150, n: -15, reach: 140 };

/** where the listener is, as the beds hear it */
export function soundPlace(w: Where): SoundPlace {
  if (w.insideSpace !== 'open' && w.insideSpace !== 'portico') return 'hall';
  if (onTerrace(w)) return 'terrace';
  if (w.roofed) return 'room';
  if (onRahmat(w)) return 'hillside';
  const p = w.place;
  if (p && p.town > 0.75) return 'town';
  if (p && p.water > 0.7) return 'river';
  if (p && p.town > 0.35) return 'village';
  if (p && p.trees > 0.6) return 'orchard';
  return 'plain';
}

/** the place's bed layer at a time and season (before the fallback); null when the place has none of its own */
function placeBed(pl: SoundPlace, t: BedTime, s: Season, month0: number): BedLayer | null {
  switch (pl) {
    case 'town': return `town_${t}` as BedLayer;
    case 'village': return t === 'dusk' ? null : (`village_${t}` as BedLayer);
    case 'plain': return t === 'night' ? (warmNight(month0) ? 'plain_night_warm' : 'plain_night_cold') : t === 'day' ? (`plain_${s}_day` as BedLayer) : (`plain_${t}` as BedLayer);
    case 'river': return t === 'night' ? 'river_night' : t === 'day' ? 'river_day' : null;
    case 'orchard': return t === 'night' ? 'orchard_night' : t === 'day' ? 'orchard_day' : null;
    case 'terrace': return t === 'night' ? 'terrace_night' : t === 'day' ? 'terrace_day' : null;
    case 'hillside': return t === 'night' ? 'hillside_night' : t === 'day' ? 'hillside_day' : null;
    case 'hall': return 'hall_tone';
    case 'room': return 'room_tone';
  }
}
/** the place's bed with the time fallback (dawn → day): never null */
export function bedFor(pl: SoundPlace, t: BedTime, s: Season, month0: number): BedLayer {
  for (const tt of BED_FALLBACK[t]) { const b = placeBed(pl, tt, s, month0); if (b) return b; }
  // a place with no bed at this time at all (none today): its day bed
  return placeBed(pl, 'day', s, month0) ?? 'plain_spring_day';
}

export interface Air {
  /** 0-1 intensities (weather/weatherState.ts Conditions) */
  rain: number; windMs: number; dust?: number; snowFall?: number; snowCover?: number; mist?: number; wetness?: number; lightning?: boolean;
}
/** the coverage harness's weather state (coverage_time.ts WEATHERS) as conditions (C: a typical state of each) */
export function airOf(weather: string): Air {
  switch (weather) {
    case 'rain': return { rain: 0.5, windMs: 4, wetness: 0.8 };
    case 'storm': case 'lightning': return { rain: 0.9, windMs: 13, wetness: 1, lightning: true };
    case 'dust': return { rain: 0, windMs: 11, dust: 0.8 };
    case 'snow': return { rain: 0, windMs: 2, snowFall: 0.6, snowCover: 0.7 };
    case 'mist': return { rain: 0, windMs: 1, mist: 0.8, wetness: 0.4 };
    case 'overcast': return { rain: 0, windMs: 4 };
    case 'cloud': return { rain: 0, windMs: 3.5 };
    default: return { rain: 0, windMs: 3 };
  }
}

export interface BedMix { layer: BedLayer; gain: number; why: string }
const INDOOR = (pl: SoundPlace) => pl === 'hall' || pl === 'room';
/** the beds to play now and their gains (0-1, before the ambience channel): the place's bed, the neighbouring place's bed
 *  where the listener stands between two (a village edge, a river bank in the town), the worksite, then the weather */
export function bedPlan(w: Where, hour: number, month0: number, air: Air, sun?: { rise: number; set: number }): BedMix[] {
  const pl = soundPlace(w), t = bedTimeAt(hour, sun), s = seasonOf(month0), out: BedMix[] = [];
  const add = (layer: BedLayer, gain: number, why: string) => { if (gain <= 0.01) return; const o = out.find(b => b.layer === layer); if (o) o.gain = Math.max(o.gain, gain); else out.push({ layer, gain: Math.min(1, gain), why }); };
  const quiet = 1 - 0.5 * Math.min(1, air.rain + (air.snowFall ?? 0)); // rain and snow cover the place's small sounds
  add(bedFor(pl, t, s, month0), quiet, `${pl} ${t} ${s}`);
  const p = w.place;
  if (p && !INDOOR(pl)) {
    if (pl !== 'river' && p.water > 0.3) add(bedFor('river', t, s, month0), 0.8 * (p.water - 0.3) / 0.4 * quiet, 'water near');
    if (pl === 'village' || (pl === 'plain' && p.town > 0.15)) add(bedFor('town', t, s, month0), 0.6 * Math.min(1, p.town / 0.75) * quiet, 'houses near');
    if (pl === 'village' || pl === 'town' || pl === 'orchard' || pl === 'river') add(bedFor('plain', t, s, month0), 0.35 * quiet, 'the plain beyond');
    if (pl !== 'orchard' && p.trees > 0.45) add(bedFor('orchard', t, s, month0), 0.5 * (p.trees - 0.45) / 0.55 * quiet, 'trees near');
  }
  if (pl === 'room') add('hearth', 0.6, 'a hearth in the room');
  // the masons at the Hall of 100 Columns by day (C: the site's working hours 6.5-17.5)
  const dw = Math.hypot(w.e - WORKSITE.e, w.n - WORKSITE.n);
  if (hour > 6.5 && hour < 17.5 && dw < WORKSITE.reach && pl !== 'hall') add('worksite', (1 - dw / WORKSITE.reach) * quiet, 'the building site');
  // weather
  if (air.rain > 0.02) {
    if (INDOOR(pl)) add('rain_roof', Math.min(1, 0.4 + air.rain), 'rain on the roof');
    else { add(air.rain > 0.55 ? 'rain_heavy' : 'rain_light', Math.min(1, 0.35 + air.rain), 'rain'); }
  }
  if (((air.wetness ?? 0) > 0.5 && air.rain < 0.05) || (air.mist ?? 0) > 0.4) add('drips', INDOOR(pl) ? 0.3 : 0.6, 'drips after rain, mist');
  const gust = Math.max(0, Math.min(1, (air.windMs - 8) / 8));
  if ((air.dust ?? 0) > 0.3) add('dust_wind', (INDOOR(pl) ? 0.3 : 1) * Math.max(gust, air.dust ?? 0), 'dust wind');
  else if (gust > 0) add('wind_gusts', (INDOOR(pl) ? 0.3 : 1) * gust, 'gusts');
  if ((air.snowFall ?? 0) > 0.1 || (air.snowCover ?? 0) > 0.4) add('snow_hush', INDOOR(pl) ? 0.2 : 0.8, 'snow');
  return out;
}

/** the footstep surface under the walker: the walk's own ground kind when its hook gives one (C9), else refined from what the
 *  soundscape knows (the stone/earth the world reports, the place, the season, the ground's wetness and snow) */
export function footSurface(base: 'stone' | 'earth' | 'plaster' | FootSurface, w: Where, month0: number, air: Air): FootSurface {
  if (base !== 'stone' && base !== 'earth' && base !== 'plaster') return base; // the hook's own kind
  const indoor = w.insideSpace !== 'open' && w.insideSpace !== 'portico';
  if (!indoor && !w.roofed && (air.snowCover ?? 0) > 0.3) return 'snow';
  if (base === 'plaster') return 'plaster';
  if (base === 'stone') return indoor ? 'plaster' : 'stone'; // the halls' floors were lime plaster over the stone (C)
  if (w.roofed) return 'rug';
  if ((air.wetness ?? 0) > 0.55) return 'mud';
  const pl = soundPlace(w), p = w.place, s = seasonOf(month0);
  if (pl === 'hillside') return 'gravel';
  if (pl === 'town' || pl === 'village') return s === 'summer' || s === 'autumn' ? 'dust' : 'earth';
  if (p && p.water > 0.85) return 'gravel';
  if (pl === 'orchard') return s === 'autumn' ? 'leaves' : 'grass';
  // the plain: green underfoot in spring, stubble and dust after the harvest (C)
  return s === 'spring' || s === 'winter' ? 'grass' : 'dust';
}

/** the impulse response for a Terrace space or the open air (by its size and where it is; C) */
export function irKindFor(space: { id: string; volume: number }, pl: SoundPlace): IrKind {
  if (space.id === 'street' || space.id === 'portico') return 'court';
  if (space.id === 'open') return pl === 'hillside' ? 'gorge' : pl === 'orchard' ? 'wood' : pl === 'terrace' || pl === 'town' || pl === 'village' ? 'court' : 'open';
  if (space.id === 'room') return 'room_small';
  return space.volume > 30000 ? 'hall_large' : space.volume > 2500 ? 'hall_medium' : 'room_small';
}

/** the one-shot sets: the work and animal sounds of soundscape.ts STRIKE_KINDS, the ambient species of BIRDS (as slugs,
 *  speciesSlug), thunder and the hearth's pops; the rock-cut tombs' chamber is the IR 'chamber' */
export const ONESHOT_SETS = [
  'chisel', 'quern', 'dice', 'hoe', 'sickle', 'loom', 'trowel', 'adze', 'mould', 'wash', 'broom', 'bow', 'bleat', 'water',
  'bray', 'bark', 'cluck', 'cockcrow', 'grunt', 'howl', 'roar', 'whoop', 'saw',
  'hammer', 'bellows', 'quench', 'chase', 'clink', 'drill', 'scrape', 'pound', 'low', 'buzz', 'swifts',
  'hoof', 'snort', 'whinny', 'camel', 'wheel', 'door', 'door_shut', 'door_bar',
  'see_see_partridge', 'chukar', 'hoopoe', 'bee_eater', 'swallow', 'house_sparrow', 'golden_jackal', 'crickets', 'cocks_at_first_light',
  'dogs_barking_in_the_night', 'a_donkey_braying', 'hooded_crows', 'black_kite', 'scops_owl', 'little_owl', 'marsh_frogs', 'cicadas',
  'common_quail', 'nightjar', 'reed_warbler', 'wild_boar_grunting',
  'thunder', 'fire_pop', 'child_laugh', 'pot_clink', 'herd_bells', 'skylark',
] as const;
export type OneShotSet = typeof ONESHOT_SETS[number];
/** an ambient species' id (soundscape BIRDS) as its one-shot set */
export const speciesSlug = (id: string) => id.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
