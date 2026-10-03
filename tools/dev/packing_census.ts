// D-651: how close the Terrace's drawn people stand (C5 leaves a person under ~1 m from another undrawn): people within 1 m
// of another, by the nearest Terrace place, at a moment with the court in residence. npx tsx tools/dev/packing_census.ts [seed] [day] [hour]
import { buildTraceWorld } from './people_trace';
import { drawnAt } from './life_census';
const seed = +(process.argv[2] ?? 1), day = +(process.argv[3] ?? 20), hour = +(process.argv[4] ?? 10);
const W = await buildTraceWorld(seed, true as any); const D = drawnAt(W, day, hour).filter(x => Math.abs(x.e) < 320 && Math.abs(x.n) < 320 && x.act !== 'sleep');
const H = new Map<string, typeof D>(); const k = (e: number, n: number) => `${Math.floor(e)}|${Math.floor(n)}`;
for (const x of D) { const kk = k(x.e, x.n); (H.get(kk) ?? H.set(kk, []).get(kk)!).push(x); }
let close = 0; const by: Record<string, number> = {};
for (const x of D) { let hit = false; for (let i = -1; i <= 1 && !hit; i++) for (let j = -1; j <= 1 && !hit; j++) for (const y of H.get(k(x.e + i, x.n + j)) ?? []) if (y !== x && Math.hypot(y.e - x.e, y.n - x.n) < 1) { hit = true; break; }
  if (hit) { close++; const w = x.why.split(/[,:(]/)[0].slice(0, 40); by[w] = (by[w] ?? 0) + 1; } }
console.log(`day ${day} ${hour} h: ${D.length} awake on the Terrace, ${close} within 1 m of another; ${Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([a, b]) => `${a}: ${b}`).join('; ')}`);
