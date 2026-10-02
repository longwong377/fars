// D-374: a cached world for the tests. A PeopleSim jumped to day 150 takes ~80 s of CPU (the plans, the living world, the
// economy, day by day); the same world loaded from its save takes ~1.4 s. simAt(seed, day, hour) jumps once and keeps the save
// under .cache/sims/, keyed by the seed, the day, the hour, the options and a hash of the sources the sim is built from
// (src/people, src/data, src/weather, public/generated/nav*): any change to them makes a fresh world. Use it where a test needs
// the world AT a day; a test that measures the walk from day 0 (determinism, replay, cost) must still build its own.
// Off with SIM_FIXTURE=0 (then simAt simply builds and jumps).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env, type SimOpts } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';

let navG: NavGrid | null = null;
export const nav = () => navG ??= new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
export const envOf = (seed: number) => { const W = new WeatherSystem(seed); return (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; }; };

let srcHash: string | null = null;
function hashSources(): string {
  if (srcHash) return srcHash; const h = createHash('sha1');
  const walk = (d: string) => { for (const f of readdirSync(d).sort()) { const p = join(d, f), s = statSync(p); if (s.isDirectory()) walk(p); else if (/\.(ts|json)$/.test(f)) h.update(p).update(readFileSync(p)); } };
  for (const d of ['src/people', 'src/data', 'src/weather']) if (existsSync(d)) walk(d);
  for (const f of ['public/generated/nav.i16', 'public/generated/nav_edges.u8']) h.update(f).update(String(statSync(f).size));
  return srcHash = h.digest('hex').slice(0, 12);
}
/** a world at (day, hour): loaded from the cache when it is there, else built, jumped and cached */
export function simAt(seed: number, day: number, hour = 10, opts: SimOpts = {}): PeopleSim {
  const make = () => new PeopleSim(seed, nav(), envOf(seed), opts);
  if (process.env.SIM_FIXTURE === '0') { const s = make(); s.jumpTo(day * 24 + hour); return s; }
  const dir = '.cache/sims', file = join(dir, `${seed}-${day}-${hour}-${createHash('sha1').update(JSON.stringify(opts)).digest('hex').slice(0, 6)}-${hashSources()}.json`);
  if (existsSync(file)) { const s = make(); s.load(JSON.parse(readFileSync(file, 'utf8'))); s.t = day * 24 + hour; return s; }
  const s = make(); s.jumpTo(day * 24 + hour); mkdirSync(dir, { recursive: true }); writeFileSync(file, JSON.stringify(s.save())); return s;
}
