// s14 simtalk (D-358): a day-300 world for the talk tests, built once and cached (a day-300 economy, living world and asks
// take ~10 min of node time to step from day 0; the save loads in seconds). The cache is keyed by the content of the files
// that decide the world's state, so a change to the simulation rebuilds it; it lives in the OS temp dir, never in git.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env, type SimOpts } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import type { EconEvent } from '../src/people/economy/world';

export const DAY = 300, HOUR = 10;
const W = new WeatherSystem(1);
export const env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
let nav: NavGrid | null = null;
export function navGrid() { return nav ??= new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8'))); }
export const OPTS: SimOpts = { asks: true };
function srcKey(): string {
  const h = createHash('sha1'); const walk = (d: string) => { for (const f of readdirSync(d).sort()) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.ts$/.test(f) && !/[\\/]converse[\\/]|[\\/]speech[\\/](deeds|grounds)\.ts$/.test(p)) h.update(p).update(readFileSync(p)); } };
  walk('src/people'); h.update(readFileSync('src/weather/weatherState.ts')); return h.digest('hex').slice(0, 12);
}
/** a fresh sim of seed 1 loaded with the day-300 save (built and cached on first use) */
export function day300(seed = 1): { sim: PeopleSim; built: boolean; ms: number; events: () => EconEvent[] } {
  const dir = join(tmpdir(), 'fars-simtalk'); mkdirSync(dir, { recursive: true }); const f = join(dir, `d${DAY}-s${seed}-${srcKey()}.json`);
  const t0 = performance.now(); const sim = new PeopleSim(seed, navGrid(), env, OPTS);
  // (the save keeps the economy's older events as day and kind only, D-347: the full event graph of the year so far is kept
  // beside it, for measuring the causal chains a deed joins; the state itself is the save's)
  const fe = f.replace(/.json$/, '.events.json');
  if (existsSync(f) && existsSync(fe)) { sim.load(JSON.parse(readFileSync(f, 'utf8'))); return { sim, built: false, ms: performance.now() - t0, events: () => JSON.parse(readFileSync(fe, 'utf8')) }; }
  sim.jumpTo(DAY * 24 + HOUR); const E = sim.econTo(DAY);
  writeFileSync(fe, JSON.stringify(E.events)); writeFileSync(f, JSON.stringify(sim.save()));
  return { sim, built: true, ms: performance.now() - t0, events: () => JSON.parse(readFileSync(fe, 'utf8')) };
}
