// D-780 (s18 C13): the court's events over a year: each type, how often, where, and who (from the people's own plans on
// sample days: a day of the peoples' gifts, a banquet night, a hunt, a ride, an ordinary audience). Node only, no render.
// `npx tsx tools/dev/court_census.ts [seed] [--days N]`  (the plans of every court person on the sample days)
import { readFileSync } from 'node:fs';
import { PeopleSim, type Env } from '../../src/people/sim';
import { NavGrid } from '../../src/people/navgrid';
import { WeatherSystem } from '../../src/weather/weatherState';
import { courtProgramme, courtSetDays, isRideDay, FEAST_SEATS, type CeremonyKind } from '../../src/people/ceremony';
import { courtYear } from '../../src/people/courtYear';

const seed = Number(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 1);
const Y = courtYear(seed), SD = courtSetDays(seed);
const lines: string[] = [];
const out = (s = '') => { lines.push(s); console.log(s); };
out(`# The court's year, seed ${seed} (D-780; node census, tools/dev/court_census.ts)`);
out(`\nThe court arrives on day ${Y.arrive} at ${Y.kingHour.toFixed(2)} h and leaves on day ${Y.leave} (${Y.leave - Y.arrive} days).`);
out(`Days of the peoples' gifts: ${SD.gift.join(', ')}; hunts: ${SD.hunt.join(', ')}; the king's gifts: ${SD.kingGifts}; his birthday (tukta): ${SD.birthday}; great banquets: ${SD.banquet.size} nights.`);
// the programme over the year
const by = new Map<CeremonyKind, { n: number; days: Set<number>; places: Set<string>; hours: number }>();
for (let d = 0; d < 354; d++) for (const e of courtProgramme(seed, d)) { const r = by.get(e.kind) ?? { n: 0, days: new Set(), places: new Set(), hours: 0 }; r.n++; r.days.add(d); r.places.add(e.place); r.hours += e.t1 - e.t0; by.set(e.kind, r); }
out('\n## Each kind of event over the year (the programme: ceremony.ts)\n');
out('| event | times | days | mean hours | where |'); out('|---|---|---|---|---|');
for (const [k, r] of [...by].sort((a, b) => b[1].n - a[1].n)) out(`| ${k} | ${r.n} | ${r.days.size} | ${(r.hours / r.n).toFixed(2)} | ${[...r.places].join(', ')} |`);
out(`\nBanquet seats in the Apadana: ${FEAST_SEATS.length} round ${new Set(FEAST_SEATS.map(s => s.table.join())).size} low tables.`);

// who: the people's plans on sample days
const W = new WeatherSystem(seed);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const t0 = Date.now(), sim = new PeopleSim(seed, nav, env, { court: true } as any), pop = (sim as any).pop, K = pop.court;
out(`\n(population built in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${K.end - K.first} people of the court, ${K.parties.length} parties, ${K.couriers.length} couriers)`);
const ordinary = (() => { for (let d = Y.arrive + 2; d < Y.leave; d++) if (K.audienceDay(d) && !SD.gift.includes(d) && !SD.banquet.has(d)) return d; return -1; })();
const ride = (() => { for (let d = Y.arrive + 2; d < Y.leave; d++) if (isRideDay(seed, d) && K.kingOut(d) === 'ride') return d; return -1; })();
const samples: [string, number][] = [['the first day of the peoples’ gifts', SD.gift[0]], ['the king’s gifts (and a banquet)', SD.kingGifts], ['a hunt', SD.hunt[1] ?? SD.hunt[0]], ['a ride', ride], ['an ordinary audience', ordinary]];
const RX: [string, RegExp][] = [
  ['delegates going up the stair in file', /up the Apadana’s stair in file|leading the gift animals/], ['bowing before the king (proskynesis)', /bowing low before the king/], ['the chiliarch before the throne', /chiliarch standing before the throne/],
  ['the king enthroned', /^enthroned|^presiding/], ['ushers leading parties', /usher leading/], ['Persians of rank lining the portico on a gift day', /standing in the Apadana’s N portico/],
  ['receiving the king’s gift', /receive (the king’s gift|his gift)/], ['diners at the banquet', /at the king’s banquet/], ['servers and wine-bearers crossing the Terrace', /over the Terrace (from the king’s kitchens )?to the (king’s )?banquet/],
  ['lamp tenders', /filling the lamps|by the lamp stands|lamp oil/], ['riders with the king (ride or hunt)', /on horseback.*(ride|hunt|king|game)|riding (out|back) on horseback/], ['beaters', /beating the reeds/], ['grooms with the king’s horses', /king’s horses|spare horses/],
  ['grooms exercising horses', /exercising a horse/], ['couriers riding in', /courier riding/], ['the king before the fire at dawn', /before the fire with the magi/]];
for (const [label, d] of samples) { if (d < 0) continue;
  const counts = new Map<string, Set<number>>(), peak = new Map<string, number>();
  for (let pid = K.first; pid < K.end; pid++) { if (!pop.present(pid, d)) continue; const segs = pop.plan(pid, d);
    for (const s of segs) for (const [k, rx] of RX) if (rx.test(s.why)) (counts.get(k) ?? counts.set(k, new Set()).get(k)!).add(pid); }
  out(`\n## ${label}: day ${d}\n`); out(courtProgramme(seed, d).filter(e => !['guard_change', 'exercise', 'courier'].includes(e.kind)).map(e => `- ${e.kind} ${e.t0.toFixed(2)}–${e.t1.toFixed(2)} at ${e.place}`).join('\n'));
  out('\n| who | people |'); out('|---|---|'); for (const [k] of RX) if (counts.get(k)?.size) out(`| ${k} | ${counts.get(k)!.size} |`); void peak;
}
if (process.argv.includes('--write')) { const { writeFileSync } = await import('node:fs'); writeFileSync('handoff/s18/c13_court_census.md', lines.join('\n') + '\n'); }
