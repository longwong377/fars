// Sound census (D-620): does every coverage area × hour band × weather (× season) have a recorded bed, every footstep surface
// a recorded set, every one-shot set and every room kind a recording? For each stratum of tests/data/coverage_points.json
// (the coverage harness's areas) the census takes the sound place it stands in (STRATUM_PLACE), and for every hour band
// (coverage_time.ts HOUR_BANDS), weather state (WEATHERS) and season asks src/audio/soundplan.ts bedPlan which beds play,
// then checks each against tools/audio/fetch_list.json (listed: the fetch knows what to get) and public/audio/manifest.json
// (fetched: in git and playing). The synthesis plays whatever is not fetched (soundscape.ts), so a gap is heard as the
// old synthesiser, not as silence.
// Usage: npx tsx tools/dev/sound_census.ts [--strict (exit 1 unless everything is fetched)] [--json out.json]
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { HOUR_BANDS, WEATHERS } from './coverage_time';
import { bedPlan, bedTime, airOf, soundPlace, footSurface, FOOT_SURFACES, ONESHOT_SETS, IR_KINDS, BED_LAYERS, SEASONS, type SoundPlace, type Where } from '../../src/audio/soundplan';

/** the sound place each coverage stratum stands in (by its prefix; the longest match wins) */
export const STRATUM_PLACE: [string, SoundPlace][] = [
  ['terrace', 'terrace'], ['terrace:stairs', 'terrace'], ['approach', 'plain'], ['rahmat', 'hillside'],
  ['town', 'town'], ['town:rooms', 'room'], ['plain', 'plain'], ['plain:villages', 'village'], ['plain:river', 'river'],
  ['far', 'plain'], ['far:kur', 'river'], ['far:villages', 'village'], ['far:quarries', 'hillside'], ['edge', 'plain'],
];
export function placeOfStratum(sub: string): SoundPlace {
  if (/^terrace:[a-z_0-9]+:roofed$/.test(sub)) return 'hall';
  let best: [string, SoundPlace] | null = null;
  for (const e of STRATUM_PLACE) if ((sub === e[0] || sub.startsWith(e[0] + ':')) && (!best || e[0].length > best[0].length)) best = e;
  return best?.[1] ?? 'plain';
}
/** a listener standing in each sound place (soundPlace of it is the place: checked below) */
export const WHERE: Record<SoundPlace, Where> = {
  terrace: { e: 50, n: 0, feetY: 13, insideSpace: 'open' },
  hall: { e: 0, n: 10, feetY: 13, insideSpace: 'apadana' },
  town: { e: -800, n: 200, insideSpace: 'open', place: { town: 1, water: 0, trees: 0.1, midden: 0.3, animals: 0.3 } },
  room: { e: -800, n: 200, insideSpace: 'open', roofed: true, place: { town: 1, water: 0, trees: 0, midden: 0, animals: 0 } },
  village: { e: -3000, n: 3000, insideSpace: 'open', place: { town: 0.5, water: 0, trees: 0.2, midden: 0.2, animals: 0.3 } },
  plain: { e: -3000, n: 1000, insideSpace: 'open', place: { town: 0, water: 0, trees: 0, midden: 0, animals: 0 } },
  river: { e: -1000, n: 3000, insideSpace: 'open', place: { town: 0, water: 0.9, trees: 0.3, midden: 0, animals: 0 } },
  orchard: { e: -1500, n: 500, insideSpace: 'open', place: { town: 0.2, water: 0.1, trees: 0.9, midden: 0, animals: 0 } },
  hillside: { e: 700, n: 0, feetY: 60, insideSpace: 'open', place: { town: 0, water: 0, trees: 0, midden: 0, animals: 0 } },
};
/** an hour inside each band (sunrise 6, sunset 18) and a month inside each season (0 = January) */
const BAND_HOUR: Record<string, number> = { 'pre-dawn': 4.5, dawn: 5.8, morning: 9, noon: 12.5, afternoon: 15.5, dusk: 18.2, 'moonlit-night': 22, 'moonless-night': 1.5 };
const SEASON_MONTH: Record<string, number> = { spring: 3, summer: 6, autumn: 9, winter: 0 };

type Status = 'fetched' | 'listed' | 'missing';
export function census() {
  const list = JSON.parse(readFileSync('tools/audio/fetch_list.json', 'utf8')) as { items: { section: string; key: string }[] };
  const mp = 'public/audio/manifest.json', man = existsSync(mp) ? JSON.parse(readFileSync(mp, 'utf8')) : { sections: {} };
  const status = (sec: string, key: string): Status => (man.sections[sec]?.[key]?.length ? 'fetched' : list.items.some(i => i.section === sec && i.key === key) ? 'listed' : 'missing');
  const pts = JSON.parse(readFileSync('tests/data/coverage_points.json', 'utf8')).points as { sub: string }[];
  const strata = [...new Set(pts.map(p => p.sub))].sort();
  const placeErr = (Object.keys(WHERE) as SoundPlace[]).filter(pl => soundPlace(WHERE[pl]) !== pl);
  // area × band × weather × season: every bed in the plan, and the plan's main bed
  const cells: { stratum: string; place: SoundPlace; band: string; weather: string; season: string; main: string; beds: Record<string, Status> }[] = [];
  for (const stratum of strata) { const place = placeOfStratum(stratum), w = WHERE[place];
    for (const band of HOUR_BANDS) for (const weather of WEATHERS) for (const season of SEASONS) {
      const plan = bedPlan(w, BAND_HOUR[band], SEASON_MONTH[season], airOf(weather), { rise: 6, set: 18 }), beds: Record<string, Status> = {};
      for (const b of plan) beds[b.layer] = status('beds', b.layer);
      cells.push({ stratum, place, band, weather, season, main: plan[0]?.layer ?? '-', beds });
    } }
  const worst = (c: typeof cells[number]) => Object.values(c.beds).includes('missing') ? 'missing' : Object.values(c.beds).includes('listed') ? 'listed' : 'fetched';
  const cellCount = (s: Status) => cells.filter(c => worst(c) === s).length;
  const layerStatus = Object.fromEntries(BED_LAYERS.map(l => [l, status('beds', l)]));
  const foot = Object.fromEntries(FOOT_SURFACES.map(s => [s, status('foot', `${s}_walk`)]));
  const shots = Object.fromEntries(ONESHOT_SETS.map(s => [s, status('oneshots', s)]));
  const irs = Object.fromEntries(IR_KINDS.map(k => [k, status('ir', k)]));
  // the footstep surfaces the refinement can reach (every one must be reachable from some world state or the walk's hook)
  const reach = new Set<string>(); for (const pl of Object.keys(WHERE) as SoundPlace[]) for (const m of [0, 3, 6, 9]) for (const wx of WEATHERS) for (const b of ['stone', 'earth', 'plaster'] as const) reach.add(footSurface(b, WHERE[pl], m, airOf(wx)));
  return { strata: strata.length, cells: cells.length, fetched: cellCount('fetched'), listed: cellCount('listed'), missing: cellCount('missing'), placeErr, layerStatus, foot, shots, irs,
    footReached: [...reach].sort(), bandsAsTimes: Object.fromEntries(HOUR_BANDS.map(b => [b, bedTime(b)])), cellsList: cells };
}

if (process.argv[1]?.endsWith('sound_census.ts')) {
  const r = census(), count = (o: Record<string, Status>, s: Status) => Object.values(o).filter(v => v === s).length;
  const line = (name: string, o: Record<string, Status>) => `${name}: ${count(o, 'fetched')} fetched, ${count(o, 'listed')} listed only, ${count(o, 'missing')} MISSING of ${Object.keys(o).length}${count(o, 'missing') ? ` (${Object.entries(o).filter(([, v]) => v === 'missing').map(([k]) => k).join(', ')})` : ''}`;
  console.log(`sound census (D-620): ${r.strata} coverage strata × ${HOUR_BANDS.length} hour bands × ${WEATHERS.length} weathers × ${SEASONS.length} seasons = ${r.cells} cells`);
  console.log(`  cells whose every bed is recorded and fetched: ${r.fetched}; listed in the fetch list but not fetched yet: ${r.listed}; with a bed nobody lists: ${r.missing}`);
  console.log('  ' + line('bed layers', r.layerStatus)); console.log('  ' + line('footstep surfaces (walk)', r.foot));
  console.log('  ' + line('one-shot sets', r.shots)); console.log('  ' + line('room impulse responses', r.irs));
  console.log(`  footstep surfaces reached by the refinement without the walk's hook: ${r.footReached.join(', ')} (wood and water need the hook)`);
  if (r.placeErr.length) console.log(`  PLACE TABLE WRONG: ${r.placeErr.join(', ')}`);
  const done = r.missing === 0 && r.listed === 0 && !r.placeErr.length && [r.foot, r.shots, r.irs].every(o => count(o, 'fetched') === Object.keys(o).length);
  const listed = r.missing === 0 && !r.placeErr.length && [r.foot, r.shots, r.irs, r.layerStatus].every(o => count(o, 'missing') === 0);
  console.log(`  DONE (every cell recorded and fetched): ${done ? 'yes' : 'no'}; every need listed for the fetch: ${listed ? 'yes' : 'no'}`);
  const j = process.argv.indexOf('--json'); if (j > 0) { const { cellsList, ...rest } = r; void cellsList; writeFileSync(process.argv[j + 1], JSON.stringify(rest, null, 1)); }
  if (process.argv.includes('--strict') && !done) process.exit(1);
}
