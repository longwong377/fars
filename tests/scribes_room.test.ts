// The scribes' room at work (D-221; rubric s7 pass 2 item 11): the Elamite scribe with a clay tablet in the left hand and a
// reed stylus in the right; the Aramaic secretary with pen, ink and leather; a pupil copying beside them (gap audit item
// 33); the room's things: mats, a lamp and its soot, ink, a water bowl, jars and baskets of tablets, seals, a trodden floor.
// Each at its place round the desk (site_spec treasury.scribes_room.seats). Measured in node; the browser frames are the
// scribe-at-work and scribe-room-ne moments.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { buildScribesRoom } from '../src/world/furnish';
import { performanceFor } from '../src/people/activities';
import { PROPS, propSlot } from '../src/people/props';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, deskSeat, type Env } from '../src/people/sim';
import { segAt } from '../src/people/population';
import { checkPlan } from '../src/people/planCheck';
import { buildTownPlan } from '../src/world/settlement/plan';
import { PopGeo } from '../src/people/popgeo';
import { PopView } from '../src/people/popview';
import { WeatherSystem } from '../src/weather/weatherState';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
let nav: NavGrid, sim: PeopleSim;
beforeAll(() => {
  nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  sim = new PeopleSim(1, nav, env);
}, 600_000);

describe('the scribes’ room at work (D-221)', () => {
  it('writing is performed with its things: a tablet in the left hand and a stylus in the right; the Aramaic secretary’s pen and leather', () => {
    const el = performanceFor('write_tablet', 'recording issues and payments'), ar = performanceFor('write_tablet', 'recording issues and payments, in Aramaic with a reed pen and ink on leather');
    expect([el.prop, el.prop2]).toEqual(['tablet', 'stylus']); expect([ar.prop, ar.prop2]).toEqual(['leather', 'pen']);
    expect(PROPS.stylus.hand).toBe('r'); expect(PROPS.pen.hand).toBe('r'); expect(PROPS.leather.hand).toBe('l');
    expect(propSlot('stylus')![0]).toBeLessThanOrEqual(1); // (in an everyday union: no extra draw for every writer)
  });
  it('the room holds the desk’s things, each tiered with its note, the decals casting no shadow', () => {
    const { manifest } = buildTerrace(), T = manifest.treasury as any, g = buildScribesRoom(T.scribesRoom, T.scribesShelves, 1);
    const by = (n: string) => g.getObjectByName(n) as THREE.Mesh | undefined;
    for (const n of ['scribes:mats', 'scribes:lamp', 'scribes:soot', 'scribes:ink', 'scribes:water_bowl', 'scribes:jars', 'scribes:seals', 'scribes:floor_stain', 'scribes:tablets_filed', 'scribes:tablets_fresh', 'scribes:tablet_unfinished', 'scribes:leather_scrolls']) {
      const m = by(n); expect(m, n).toBeTruthy(); expect(m!.userData.tier, n).toMatch(/^[ABC]$/); expect(String(m!.userData.note ?? m!.userData.what ?? ''), n).not.toBe(''); }
    expect((by('scribes:mats') as THREE.InstancedMesh).count).toBe(4);
    expect(by('scribes:soot')!.castShadow).toBe(false); expect(by('scribes:floor_stain')!.castShadow).toBe(false);
    expect(String(by('scribes:lamp')!.userData.note)).toMatch(/NOT LIT/); // (the lamp is never lit: flagged)
  });
  it('the Aramaic secretary writes in Aramaic at the desk; his son is his pupil there on most of the days he keeps it, with 0 plan issues over the year', () => {
    const P = sim.pop, [s1, s2] = P.treasuryScribes, ar = [s1, s2].find(s => P.persons[s].origin === 'Babylonian')!, pu = P.persons.filter(p => p.pupilOf !== undefined).map(p => p.id);
    expect(pu.length).toBe(1); expect(P.persons[pu[0]].pupilOf).toBe(ar);
    let deskDays = 0, pupilDays = 0; const issues: string[] = [];
    for (const pid of [...pu, s1, s2]) { let prev: string | null = null, prevSegs = null;
      for (let d = 0; d < 354; d++) { if (!P.present(pid, d)) { prev = null; continue; } const s = P.plan(pid, d);
        for (const x of checkPlan(P, pid, d, s, prev, prevSegs)) issues.push(`${pid} d${d} ${x.kind}: ${x.note}`); prev = s[s.length - 1].place; prevSegs = s;
        if (pid === ar && s.some(x => x.place === 'treasury_desk' && x.act === 'write_tablet')) { deskDays++; expect(s.filter(x => x.place === 'treasury_desk' && x.act === 'write_tablet').every(x => /in Aramaic/.test(x.why))).toBe(true);
          const ps = P.present(pu[0], d) ? P.plan(pu[0], d) : []; if (ps.some(x => x.place === 'treasury_desk' && x.with === ar)) pupilDays++; } } }
    console.log(`the Aramaic secretary at the desk on ${deskDays} days, his pupil beside him on ${pupilDays}`);
    expect(issues.slice(0, 10)).toEqual([]); expect(pupilDays / deskDays).toBeGreaterThan(0.5); expect(pupilDays / deskDays).toBeLessThan(0.9);
  });
  it('each sits at his place round the desk: the scribes (detailed agents) and the pupil (the population view) on day 21 at 13:00', () => {
    const d = 21, h = 13; sim.jumpTo(d * 24 + h); for (let i = 0; i < 20; i++) sim.step(3);
    for (const a of sim.agents) if (a.role === 'scribe') { const S = deskSeat(a.langs[0] === 'Aramaic' ? 'aramaic' : 'elamite'); expect(a.task?.place, a.name ?? '').toBe('treasury_desk');
      expect(Math.hypot(a.pos[0] - S.at[0], a.pos[1] - S.at[1])).toBeLessThan(0.05); expect(a.task?.heading).toBe(S.heading); }
    const view = new PopView(sim, new PopGeo({ pop: sim.pop, nav, town: buildTownPlan(), seed: 1 }), 1); view.settle(sim.t, [186, -83]);
    const pu = sim.pop.persons.find(p => p.pupilOf !== undefined)!, o = view.query([186, -83], 10).find(x => x.pid === pu.id)!, S = deskSeat('pupil');
    expect(segAt(sim.pop.plan(pu.id, d), h).place).toBe('treasury_desk'); expect(o).toBeTruthy(); expect(o.act).toBe('write_tablet');
    expect(Math.hypot(o.e - S.at[0], o.n - S.at[1])).toBeLessThan(0.05); expect(o.heading).toBe(S.heading);
  }, 600_000);
});
