// B230 (D-350, s15): after the brides' redraw moved person ids, find the people who show what the pinned tests of
// people_days_r4 and _r5 were written to show (the same property, on the new ids; the checks unchanged), and print the old
// pins' own attributes (run in the main line's tree for those). Run: npx tsx tools/dev/repin_find_b230.ts [old]
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { segAt, type Seg } from '../../src/people/population';
import { SOAK_GATES } from '../soak';
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const sim = new PeopleSim(1, nav, env); const P: any = (sim as any).pop;
const apart = (pid: number, d: number) => { for (const s of P.plan(pid, d) as Seg[]) { if (s.with === undefined) continue; const o = segAt(P.plan(s.with, d), (s.t0 + s.t1) / 2); if (o.place !== s.place && !(o.where === 'road' && s.where === 'road')) return true; } return false; };
const nearCopyShare = (pid: number) => { const days: number[] = []; for (let d = 0; d < 354; d++) if (P.present(pid, d)) days.push(d);
  const sig = days.map(d => { const segs: Seg[] = P.plan(pid, d); return Array.from({ length: 48 }, (_, b) => { const s = segAt(segs, b * 0.5 + 0.5 - 1e-6); return `${s.place}|${s.act}`; }); });
  const lim = Math.floor(48 * (1 - SOAK_GATES.NEAR_COPY) + 1e-9); let pairs = 0, near = 0;
  for (let x = 0; x < sig.length; x++) for (let y = x + 1; y < sig.length; y++) { let diff = 0; for (let b = 0; b < 48; b++) if (sig[x][b] !== sig[y][b]) diff++; pairs++; if (diff <= lim) near++; }
  return { days: days.length, share: pairs ? near / pairs : 0 }; };
const daylightRest = (pid: number, d: number) => { const { rise, set } = P.cal.ctx(d).sun; let r = 0; for (const s of P.plan(pid, d) as Seg[]) if (s.act === 'rest' && s.where !== 'road') r += Math.max(0, Math.min(s.t1, set) - Math.max(s.t0, rise)); return r; };
const spin = (pid: number, d: number) => (P.plan(pid, d) as Seg[]).filter(s => s.act === 'spin' || s.act === 'weave').reduce((a, s) => a + s.t1 - s.t0, 0);
const sleepH = (pid: number, d: number) => (P.plan(pid, d) as Seg[]).filter(s => s.act === 'sleep').reduce((a, s) => a + s.t1 - s.t0, 0);
const CARRIED = /asleep on the mother’s back|asleep, carried on the mother’s back|asleep in the mother’s lap|asleep on a mat beside the mother/;
const desc = (pid: number, d: number) => { const p = P.persons[pid]; return `${pid} ${p.name} ${p.job} ${p.sex}${P.ageOn(pid, d)} zone ${P.households[P.home(pid, d)]?.zone} born ${p.born}`; };
if (process.argv[2] === 'old') {
  const T = P.hday(P.home(31224, 21), 21).task; console.log('31224', desc(31224, 21), 'task', T?.kind, T?.act, T?.place, 'rest', daylightRest(31224, 21).toFixed(2));
  console.log('41397', desc(41397, 0), JSON.stringify(nearCopyShare(41397)));
  console.log('22239', desc(22239, 29), 'sleep', sleepH(22239, 29).toFixed(2));
  console.log('18904', desc(18904, 254), 'spin', spin(18904, 254).toFixed(2));
  const h = P.home(42000, 123); console.log('9660 hh', h, P.membersOn(h, 123).map((x: number) => desc(x, 123)).join('; '));
  const ms: Seg[] = P.plan(42000, 123); console.log(ms.filter(s => s.t0 > 5 && s.t0 < 20).map(s => `${s.t0.toFixed(2)} ${s.act} ${s.why}`).join('\n'));
  process.exit(0);
}
const out: Record<string, unknown[]> = { tuppipi: [], girl3: [], baby: [], spinner: [], wells: [] };
const days3: Record<number, number> = {};
for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; const plain = P.households[p.hh]?.zone === 'plain';
  if (out.tuppipi.length < 3 && p.job === 'farmer' && p.sex === 'm' && P.present(pid, 21) && P.households[P.home(pid, 21)].zone === 'plain') { const T = P.hday(P.home(pid, 21), 21).task;
    if (T && T.kind === 'field' && daylightRest(pid, 21) < 3 && (P.plan(pid, 21) as Seg[]).some(s => s.place === T.place && s.act === T.act)) out.tuppipi.push([pid, p.name, T.why]); }
  if (out.girl3.length < 8 && p.sex === 'f' && p.age === 3) { let n = 0; for (let d = 0; d < 354 && n <= 60; d++) if (P.present(pid, d)) n++; if (n < 30) days3[n] = (days3[n] ?? 0) + 1; if (n <= 60 && ['town', 'plain'].includes(P.households[p.hh]?.zone)) { const r = nearCopyShare(pid); if (r.share < SOAK_GATES.MAX_NEAR_COPY_SHARE) out.girl3.push([pid, n, P.households[p.hh]?.zone, +r.share.toFixed(3)]); } }
  if (out.baby.length < 3 && plain && P.ageOn(pid, 29) === 0 && (p.born >= 0 ? 29 - p.born : 29 + 354 - p.bday) >= 50 && (p.born >= 0 ? 29 - p.born : 29 + 354 - p.bday) <= 70 && P.present(pid, 29) && sleepH(pid, 29) >= 14 && (P.plan(pid, 29) as Seg[]).some(s => s.act === 'sleep' && CARRIED.test(s.why) && s.t0 > 7 && s.t1 < 17)) out.baby.push([pid, p.born >= 0 ? 29 - p.born : 29 + 354 - p.bday]);
  if (out.spinner.length < 3 && plain && p.sex === 'f' && p.job === 'homemaker' && P.present(pid, 254) && !P.sick(pid, 254) && spin(pid, 254) >= 1) out.spinner.push([pid, p.name, P.ageOn(pid, 254), +spin(pid, 254).toFixed(2)]);
  if (out.wells.length < 3 && plain && p.sex === 'f' && P.present(pid, 123)) { const ms: Seg[] = P.plan(pid, 123); const k = ms.filter(s => s.act === 'draw_water').length >= 2 ? 0 : -1;
    if (k >= 0) { const h = P.home(pid, 123), mem: number[] = P.membersOn(h, 123); const kids = mem.filter(x => P.persons[x].mother === pid && P.ageOn(x, 123) < 8);
      if (kids.length >= 2 && kids.some(x => (P.plan(x, 123) as Seg[]).some(s => s.with === pid)) && mem.every(x => !apart(x, 123)) && ms.every(s => s.t1 - s.t0 >= 0.001)) out.wells.push([pid, h, kids]); } }
  }
console.log(JSON.stringify(out)); console.log('girls of 3 by days present (under 30):', JSON.stringify(days3));
