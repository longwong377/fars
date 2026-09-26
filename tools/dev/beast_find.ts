// dev (session 9): where the wild animals are (src/world/beasts.ts) at a day and hour, with a camera suggestion for each group
// (70 m off, looking at it). Usage: npx tsx tools/dev/beast_find.ts <day> <hour> [seed=1]
import { loadTerrain, loadRiversFile } from '../../tests/plainLib';
import { buildZones, landUseAt } from '../../src/world/plain/fields';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages } from '../../src/world/plain/villages';
import { beastRanges, beastsAt, type P2 } from '../../src/world/beasts';
import { WorldClock } from '../../src/core/clock';
import { sunHorizon } from '../../src/sky/ephemeris';
import townData from '../../src/data/town.json';
const [day = 12, hour = 9, seed = 1] = process.argv.slice(2).map(Number);
const T = loadTerrain(), R = loadRiversFile(), canals = buildCanals(T, R.rivers, 1), villages = placeVillages(T, R.rivers, canals, 1);
const Z = buildZones({ terrain: T, rivers: R.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })) });
const people: P2[] = [[0, 0], ...(townData as any).facilities.map((f: any) => f.at as P2), ...villages.map(v => [v.x, v.y] as P2)];
const B = beastRanges({ ground: (e, n) => T.heightAt(e, -n), natural: (e, n) => landUseAt(Z, e, -n).use === 'natural', rivers: R.rivers.map(r => Array.from(r.x, (x, i) => [x, r.y[i]] as P2)), people });
// sunrise/sunset of the day (the sun crossing −0.83°)
const alt = (h: number) => sunHorizon(new WorldClock(day, h).jdUT).altitude; let rise = 6, set = 18; for (let h = 3; h < 12; h += 0.02) if (alt(h) > -0.83) { rise = h; break; } for (let h = 21; h > 12; h -= 0.02) if (alt(h) > -0.83) { set = h; break; }
const all = beastsAt(B, seed, (day + hour / 24) * 86400, hour, { rise, set }, 3);
const groups = new Map<string, typeof all>(); for (const b of all) { const k = b.sp === 'lioness' ? 'lion' : b.sp; groups.set(k, [...(groups.get(k) ?? []), b]); }
for (const [k, g] of groups) { const e = g.reduce((a, b) => a + b.e, 0) / g.length, n = g.reduce((a, b) => a + b.n, 0) / g.length, ce = e - 60, cn = n - 35, az = ((Math.atan2(e - ce, n - cn) * 180) / Math.PI - 19 + 360) % 360; // true azimuth = grid heading − 19° (grid north is 341° true)
  console.log(JSON.stringify({ sp: k, n: g.length, at: [+e.toFixed(1), +n.toFixed(1)], lie: g.filter(b => b.lie).length, walk: g.filter(b => b.walk).length, camera: [+ce.toFixed(1), +cn.toFixed(1), 1.6, +az.toFixed(1), -3] })); }
