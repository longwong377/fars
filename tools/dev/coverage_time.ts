// Coverage times (D-235, MASTER_PLAN §4.2 and axis B; D-242): every view gets a month, an hour band and a weather state, and
// then a real (day, hour) of the simulated year where that combination happens, so the page shows the world's own weather
// (override 'auto') whenever the climate makes it; only when the climate never makes it in that month and band is the state
// forced through the weather override (and the view is marked `forced`).
//  - The year table: every half hour of the regnal year (START_JDN …), the sun and moon (src/sky/ephemeris.ts), the Julian
//    month, the hour band and the weather state of WeatherSystem(1) (the fixed world seed test pages load with).
//  - Hour bands (8, T-B1h): pre-dawn (sun −18…−6°, morning), dawn (−6…+6°, morning), morning (≥ 6°, before 10:30), noon (≥ 6°,
//    10:30-13:30 LMT), afternoon (≥ 6°, after 13:30), dusk (−18…+6°, evening), moonlit night (sun < −18°, moon ≥ 5° up and ≥ 50 %
//    lit), moonless night (sun < −18°, moon down or < 15 % lit). Half-lit moon nights are in no band.
//  - Weather states (9, T-B1w) from the conditions: lightning; storm (rain with wind ≥ 9 m/s); rain; snow; dust (> 0.3);
//    mist (> 0.3); overcast (cloud ≥ 0.8); cloud (≥ 0.3); clear. Forced overrides: cloud has none (a cloudy half hour of the
//    nearest month is taken instead), lightning forces 'storm' (the override brings lightning).
//  - Assignment per area (T-B1m/h/w): every month, band and weather at least once in the area's views; months and bands are
//    otherwise balanced and paired to spread (month, band) pairs; weather is drawn by the climate's frequency for that month
//    and band (D-242), with the floor of one view per state. Then world-level pairs (T-B1p: band × weather, month × band,
//    area × weather) are completed by re-assigning views that carry no floor.
import { START_JDN, jdnToJulian } from '../../src/core/calendar';
import { YEAR_DAYS, WorldClock } from '../../src/core/clock';
import { sunHorizon, moonHorizon, moonPhase } from '../../src/sky/ephemeris';
import { WeatherSystem, type WeatherOverride } from '../../src/weather/weatherState';
import { Rng } from '../../src/core/rng';

export const HOUR_BANDS = ['pre-dawn', 'dawn', 'morning', 'noon', 'afternoon', 'dusk', 'moonlit-night', 'moonless-night'] as const;
export const WEATHERS = ['clear', 'cloud', 'overcast', 'rain', 'storm', 'snow', 'dust', 'mist', 'lightning'] as const;
export type Band = typeof HOUR_BANDS[number]; export type Weather = typeof WEATHERS[number];
export const FORCE: Record<Weather, WeatherOverride | null> = { clear: 'clear', cloud: null, overcast: 'overcast', rain: 'rain', storm: 'storm', snow: 'snow', dust: 'dust', mist: 'mist', lightning: 'storm' };
export const WORLD_SEED_TESTS = 1;
/** where the simulated year never makes a state at all (WeatherSystem(1) has no snow day in the year), a forced view goes to
 *  the months that state belongs to (climatology, C): snow in winter, dust in summer, mist in the cold half, storms in spring
 *  and autumn */
export const FORCE_MONTHS: Record<Weather, number[]> = { clear: [], cloud: [], overcast: [11, 12, 1, 2, 3], rain: [11, 12, 1, 2, 3, 4], storm: [3, 4, 10, 11], snow: [12, 1, 2], dust: [6, 7, 8, 5], mist: [11, 12, 1, 2], lightning: [3, 4, 10, 11] };

export interface Cell { day: number; hour: number; month: number; band: Band | null; weather: Weather; sunAlt: number; moonAlt: number; moonFrac: number }
let TABLE: Cell[] | null = null;
export function classifyWeather(c: { lightning: boolean; rain: number; windMs: number; snowFall: number; dust: number; mist: number; cloud: number }): Weather {
  if (c.lightning) return 'lightning'; if (c.rain > 0 && c.windMs >= 9) return 'storm'; if (c.rain > 0) return 'rain'; if (c.snowFall > 0) return 'snow';
  if (c.dust > 0.3) return 'dust'; if (c.mist > 0.3) return 'mist'; if (c.cloud >= 0.8) return 'overcast'; if (c.cloud >= 0.3) return 'cloud'; return 'clear';
}
export function classifyBand(sunAlt: number, hour: number, moonAlt: number, moonFrac: number): Band | null {
  if (sunAlt < -18) return moonAlt >= 5 && moonFrac >= 0.5 ? 'moonlit-night' : moonAlt < 0 || moonFrac < 0.15 ? 'moonless-night' : null;
  if (sunAlt < 6) return hour < 12 ? (sunAlt < -6 ? 'pre-dawn' : 'dawn') : 'dusk';
  return hour < 10.5 ? 'morning' : hour <= 13.5 ? 'noon' : 'afternoon';
}
/** every half hour of the year: sun, moon, month, band, weather (cached) */
export function yearTable(): Cell[] {
  if (TABLE) return TABLE;
  const W = new WeatherSystem(WORLD_SEED_TESTS), clock = new WorldClock(0, 0), out: Cell[] = [];
  for (let day = 0; day < YEAR_DAYS; day++) { const month = jdnToJulian(START_JDN + day).m;
    for (let hh = 0; hh < 48; hh++) { const hour = hh / 2 + 0.25; clock.set(day, hour); const jd = clock.jdUT;
      const s = sunHorizon(jd).altitude, m = moonHorizon(jd).altitude, f = moonPhase(jd).fraction;
      out.push({ day, hour, month, band: classifyBand(s, hour, m, f), weather: classifyWeather(W.conditions(day, hour)), sunAlt: +s.toFixed(1) || 0, moonAlt: +m.toFixed(1) || 0, moonFrac: +f.toFixed(2) || 0 }); } }
  return (TABLE = out);
}

export interface TimeRow { month: number; band: Band; weather: Weather; floor: boolean; day: number; hour: number; w: WeatherOverride; forced: boolean; sunAlt: number; moonAlt: number; moonFrac: number }
const shuffle = <T>(R: Rng, a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = R.int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** the climate's frequency of each weather state in a month and band (D-242) */
export function climate(month: number, band: Band): Record<Weather, number> {
  const r = Object.fromEntries(WEATHERS.map(w => [w, 0])) as Record<Weather, number>; let n = 0;
  for (const c of yearTable()) if (c.month === month && c.band === band) { r[c.weather]++; n++; }
  if (n) for (const w of WEATHERS) r[w] /= n; return r;
}
/** a real (day, hour) for (month, band, weather); forced through the override only if the climate never makes it */
export function realise(R: Rng, month: number, band: Band, weather: Weather): Omit<TimeRow, 'floor'> {
  const T = yearTable(); let cells = T.filter(c => c.month === month && c.band === band && c.weather === weather), forced = false;
  if (!cells.length && weather === 'cloud') { for (let d = 1; d <= 6 && !cells.length; d++) cells = T.filter(c => c.band === band && c.weather === 'cloud' && (c.month === ((month - 1 + d) % 12) + 1 || c.month === ((month - 1 - d + 12) % 12) + 1)); }
  if (!cells.length) { cells = T.filter(c => c.month === month && c.band === band); forced = true; }
  if (!cells.length) cells = T.filter(c => c.band === band); // (a band missing from a month: not expected)
  const c = cells[R.int(0, cells.length - 1)], hour = +(c.hour - 0.25 + R.range(0, 0.5)).toFixed(3);
  return { month: c.month, band, weather, day: c.day, hour, w: forced ? (FORCE[weather] ?? 'auto') : 'auto', forced, sunAlt: c.sunAlt, moonAlt: c.moonAlt, moonFrac: c.moonFrac };
}
const drawWeather = (R: Rng, month: number, band: Band): Weather => { const p = climate(month, band); let u = R.next(); for (const w of WEATHERS) { if (u < p[w]) return w; u -= p[w]; } return 'clear'; };

/** month, band and weather for n views of one area: every month, band and weather at least once (n ≥ 12), balanced, climate-drawn */
export function assignArea(R: Rng, n: number, pairsSeen: Set<string>): { month: number; band: Band; weather: Weather; floor: boolean }[] {
  const months: number[] = [], bands: Band[] = [];
  while (months.length < n) months.push(...shuffle(R, Array.from({ length: 12 }, (_, i) => i + 1)));
  while (bands.length < n) bands.push(...shuffle(R, [...HOUR_BANDS]));
  months.length = n; bands.length = n;
  // pair months with bands: prefer (month, band) pairs not yet seen anywhere
  const rows: { month: number; band: Band; weather: Weather; floor: boolean }[] = [], pool = [...bands];
  for (const m of months) { let k = pool.findIndex(b => !pairsSeen.has(`mb|${m}|${b}`)); if (k < 0) k = 0; const b = pool.splice(k, 1)[0]; pairsSeen.add(`mb|${m}|${b}`); rows.push({ month: m, band: b, weather: drawWeather(R, m, b), floor: false }); }
  // the weather floor: each state once, on the row where the climate makes it most often (and not already a floor row)
  for (const w of WEATHERS) { if (n < WEATHERS.length) break;
    let best = -1, bp = -1; for (let i = 0; i < rows.length; i++) { if (rows[i].floor) continue; const p = climate(rows[i].month, rows[i].band)[w] + (rows[i].weather === w ? 1 : 0); if (p > bp) { bp = p; best = i; } }
    if (bp <= 0) { // the climate never makes w on any free row: move a free row whose month is repeated to the month where it does
      const count = (m: number) => rows.filter(r => r.month === m).length;
      let mv: { i: number; m: number; p: number } | null = null;
      for (let i = 0; i < rows.length; i++) { if (rows[i].floor || count(rows[i].month) < 2) continue;
        for (let m = 1; m <= 12; m++) { const p = climate(m, rows[i].band)[w]; if (p > (mv?.p ?? 0)) mv = { i, m, p }; } }
      if (!mv && FORCE_MONTHS[w].length) { const i = rows.findIndex(r => !r.floor && count(r.month) >= 2); if (i >= 0) mv = { i, m: FORCE_MONTHS[w][R.int(0, FORCE_MONTHS[w].length - 1)], p: 0 }; }
      if (mv) { best = mv.i; rows[best].month = mv.m; } }
    rows[best].weather = w; rows[best].floor = true; }
  // the month and band floors hold by construction when n ≥ 12 (each appears once per shuffled block); mark one row each as floor
  for (const m of new Set(months)) { const i = rows.findIndex(r => r.month === m && !r.floor); if (i >= 0 && !rows.some(r => r.floor && r.month === m)) rows[i].floor = true; }
  for (const b of HOUR_BANDS) { const i = rows.findIndex(r => r.band === b && !r.floor); if (i >= 0 && !rows.some(r => r.floor && r.band === b)) rows[i].floor = true; }
  return rows;
}

/** world-level pairwise coverage of a set of rows: band × weather, month × band, area × weather (T-B1p) */
export function pairCoverage(rows: { area: string; month: number; band: string; weather: string }[], areas: string[]) {
  const bw = new Set(rows.map(r => `${r.band}|${r.weather}`)), mb = new Set(rows.map(r => `${r.month}|${r.band}`)), aw = new Set(rows.map(r => `${r.area}|${r.weather}`));
  const miss = { bw: [] as string[], mb: [] as string[], aw: [] as string[] };
  for (const b of HOUR_BANDS) for (const w of WEATHERS) if (!bw.has(`${b}|${w}`)) miss.bw.push(`${b}|${w}`);
  for (let m = 1; m <= 12; m++) for (const b of HOUR_BANDS) if (!mb.has(`${m}|${b}`)) miss.mb.push(`${m}|${b}`);
  for (const a of areas) for (const w of WEATHERS) if (!aw.has(`${a}|${w}`)) miss.aw.push(`${a}|${w}`);
  const total = HOUR_BANDS.length * WEATHERS.length + 12 * HOUR_BANDS.length + areas.length * WEATHERS.length;
  return { share: 1 - (miss.bw.length + miss.mb.length + miss.aw.length) / total, miss };
}
/** per-area hits within the sample (T-B1m, T-B1h, T-B1w) */
export function areaHits(rows: { area: string; month: number; band: string; weather: string }[]) {
  const by: Record<string, { months: number; bands: number; weathers: number; n: number }> = {};
  const g = new Map<string, typeof rows>(); for (const r of rows) { let a = g.get(r.area); if (!a) g.set(r.area, a = []); a.push(r); }
  for (const [a, rs] of g) by[a] = { n: rs.length, months: new Set(rs.map(r => r.month)).size, bands: new Set(rs.map(r => r.band)).size, weathers: new Set(rs.map(r => r.weather)).size };
  return by;
}
