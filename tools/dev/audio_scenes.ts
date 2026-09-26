// The population scenes of tools/dev/audio_render.ts (D-245): the real people sim and population view (as
// tools/dev/court_popin.ts builds them), settled at a place and hour; the people out of doors within 60 m of the listener
// become NearPersons exactly as the crowd makes them (people/talkers.ts), without the renderer. The listener is put where
// the most talkers are within 15 m among the candidate centres of the scene (the town's quarters and squares, the Terrace's
// forecourt, a village), so the measurement is taken where voices matter most, not at a quiet spot.
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { buildTownPlan, QUARTERS } from '../../src/world/settlement/plan';
import { PopGeo } from '../../src/people/popgeo';
import { PopView } from '../../src/people/popview';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../../src/world/plain/villages';
import { loadTerrain, loadRiversFile } from '../../tests/plainLib';
import { voiceIdentity, nearPerson } from '../../src/people/talkers';
import type { NearPerson } from '../../src/audio/voices';
import type { WaterLine } from '../../src/audio/water';
import type { SceneSpec } from './audio_render';

export function populationScenes(o: { seed: number; day: number; hour: number; scene: string }) {
  const W = new WeatherSystem(o.seed), env = (x: number): Env => { const dd = Math.floor(x / 24), c = W.conditions(dd, x - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const sim = new PeopleSim(o.seed, nav, env, { court: true }), plan = buildTownPlan(), terrain = loadTerrain(), rivers = loadRiversFile(), canals = buildCanals(terrain, rivers.rivers, o.seed), villages = placeVillages(terrain, rivers.rivers, canals, o.seed);
  const ground = (e: number, n: number) => (nav.walkable(e, n) ? nav.heightAt(e, n) : terrain.heightAt(e, -n));
  const geo = new PopGeo({ pop: sim.pop, nav, town: plan, ground: (e, n) => terrain.heightAt(e, -n), villages, compounds: vi => villageCompounds(villages[vi], terrain, o.seed), canals: canals.map(c => c.pts), seed: o.seed });
  const view = new PopView(sim, geo, o.seed), t = o.day * 24 + o.hour; sim.jumpTo(t);
  const water: WaterLine[] = [...rivers.rivers.map(r => ({ pts: Array.from(r.x, (x, i) => [x, r.y[i]] as [number, number]), half: r.topWidth / 2, kind: 'river' as const })), ...canals.map(c => ({ pts: c.pts, half: c.width / 2, kind: 'canal' as const }))];
  const c = W.conditions(o.day, o.hour), month = c.day?.climMonth ?? Math.floor((o.day % 365) / 30.5);
  const people = (e: number, n: number): NearPerson[] => {
    view.settle(t, [e, n]); const out: NearPerson[] = [], day = Math.floor(t / 24);
    for (const vp of view.query([e, n], 60)) { const a = vp.agent >= 0 ? sim.agents[vp.agent] : null; if (a && !a.offmap) continue;
      out.push(nearPerson(a ? `a${a.id}` : `p${vp.pid}`, voiceIdentity(a, vp.pid, sim.pop, day, o.seed), vp.act, vp.moving, vp.e, vp.y, -vp.n, vp.place || null)); }
    for (const a of sim.visibleAgents([e, n], 60)) { const p = sim.performance(a); out.push(nearPerson(`a${a.id}`, voiceIdentity(a, -1, null, day, o.seed), p.act, p.moving, a.pos[0], a.y, -a.pos[1], a.task?.place ?? null)); }
    return out;
  };
  /** the candidate centre with the most talkers within 15 m, the listener standing there */
  const best = (name: string, cands: [number, number][], place: SceneSpec['place']): SceneSpec | null => {
    let top: { n: number; e: number; nn: number; ps: NearPerson[] } | null = null;
    for (const [e, n] of cands) { const ps = people(e, n); // the densest talker spot near this centre: stand at a talker's side
      for (const q of ps.filter(p => p.talking)) { const k = ps.filter(p => p.talking && Math.hypot(p.x - q.x, p.z - q.z) <= 15).length; if (!top || k > top.n) top = { n: k, e: q.x + 1.2, nn: -q.z, ps }; } }
    if (!top) return null;
    const ps = people(top.e, top.nn), y = ground(top.e, top.nn) + 1.6;
    return { name: `${name} (${top.n} talkers within 15 m at e ${top.e.toFixed(0)}, n ${top.nn.toFixed(0)})`, listener: { x: top.e, y, z: -top.nn }, people: ps, place, wind: c.windMs, rain: c.rain, tempC: c.tempC, month, hour: o.hour, water, ground, walk: false };
  };
  const scenes: SceneSpec[] = [];
  const want = (s: string) => o.scene === 'all' || o.scene === s;
  if (want('town')) { const s = best('town', QUARTERS.filter(q => q.popZone === 'town').map(q => q.c as [number, number]), { town: 1, water: 0, trees: 0.2, midden: 0.3, animals: 0.3 }); if (s) scenes.push(s); }
  if (want('terrace')) { const s = best('terrace', [[0, 100], [-52, 118], [30, 30], [100, 40]], { town: 0, water: 0, trees: 0, midden: 0, animals: 0 }); if (s) scenes.push(s); }
  if (want('village')) { const vs = [...villages].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)).slice(0, 4); const s = best('village', vs.map(v => [v.x, v.y] as [number, number]), { town: 0.9, water: 0.4, trees: 0.4, midden: 0.4, animals: 0.5 }); if (s) scenes.push(s); }
  return { scenes, water, ground };
}
/** where the water is probed: the Pulvar near the town's river place and a canal near the town */
export function waterProbe(lines: WaterLine[]): { river: [number, number]; canal?: [number, number] } {
  const r = lines.find(l => l.kind === 'river')!, mid = r.pts[Math.floor(r.pts.length / 2)];
  const cn = lines.filter(l => l.kind === 'canal').sort((a, b) => Math.hypot(a.pts[0][0], a.pts[0][1]) - Math.hypot(b.pts[0][0], b.pts[0][1]))[0];
  return { river: [mid[0], mid[1]], canal: cn ? [cn.pts[Math.floor(cn.pts.length / 2)][0], cn.pts[Math.floor(cn.pts.length / 2)][1]] : undefined };
}
