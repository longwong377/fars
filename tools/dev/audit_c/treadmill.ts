import { readFileSync } from 'node:fs';
import { NavGrid } from '../../../src/people/navgrid';
import { PeopleSim, type Env } from '../../../src/people/sim';
import { WeatherSystem } from '../../../src/weather/weatherState';
import { ACTIVITIES } from '../../../src/people/activities';
import { WORK_META } from '../../../src/people/workAnims';
import { performanceFor } from '../../../src/people/activities';
import { frameOf, FRAMES } from '../../../src/people/impostors';
process.chdir('/home/user/fars');
const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const sim = new PeopleSim(1, nav, env); const P: any = sim.pop;
const days = process.argv.slice(2).map(Number);
const PATHED = new Set(Object.keys(WORK_META).filter(k => (WORK_META as any)[k].path));
for (const day of days) { sim.cal.ctx(day);
  const tread: Record<string, number> = {}; const stand: Record<string, number> = {}; let awake = 0, standFall = 0, treadN = 0; const idle: Record<string, number> = {};
  for (let h of [10, 15]) for (const p of P.persons) { if (!P.present(p.id, day)) continue; const segs = P.plan(p.id, day); const s = segs.find((x: any) => x.t0 <= h && h < x.t1); if (!s) continue;
    if (s.act === 'sleep' || s.act === 'offmap' || s.where === 'away') continue; awake++;
    const A: any = (ACTIVITIES as any)[s.act]; const perf: any = performanceFor ? performanceFor(s.act, s.why ?? '', p.id) : A; const anim = perf?.anim ?? A.anim;
    if (A.moving && s.act !== 'walk' && s.where !== 'road' && !PATHED.has(anim)) { treadN++; const k = `${s.act} | ${(s.why ?? '').slice(0, 60)}`; tread[k] = (tread[k] ?? 0) + 1; }
    const fr = FRAMES[frameOf(anim, 0)].id; if (fr === 'stand' && !['idle', 'talk', 'inspect', 'guard'].includes(anim)) { standFall++; stand[anim] = (stand[anim] ?? 0) + 1; }
    if (anim === 'idle') { idle[s.act] = (idle[s.act] ?? 0) + 1; }
  }
  console.log(`day ${day} (10:00 + 15:00): awake, not away ${awake}; moving acts performed at a standing spot (walk in place) ${treadN}; work drawn as the impostor's 'stand' frame ${standFall}`);
  console.log(' treadmill top:', JSON.stringify(Object.entries(tread).sort((a, b) => b[1] - a[1]).slice(0, 12)));
  console.log(' stand-fallback anims:', JSON.stringify(Object.entries(stand).sort((a, b) => b[1] - a[1]).slice(0, 20)));
  console.log(' idle-anim acts:', JSON.stringify(idle));
}
