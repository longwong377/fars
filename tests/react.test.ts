// D-395: the render side of the reactions to the stranger (src/people/react.ts): the sim's sightings (PeopleSim.strangerSeen,
// D-385) and a shout's lookers (converse/earshot.ts, D-379) become pose layers on the people (head, neck, chest; a hand).
import { describe, it, expect } from 'vitest';
import { simAt } from './sim_fixture';
import { Reactions, reactPose, REACT_S, REACT_AGAIN_S } from '../src/people/react';
import { segAt } from '../src/people/population';
import { earshot, type Listener } from '../src/people/converse/earshot';
import type { Near } from '../src/people/converse/sight';
import type { Pose } from '../src/people/anim';

const still = (): Pose => ({ rot: { head: [0, 0, 0], neck: [0, 0, 0], chest: [0, 0, 0] }, hips: [0, 0, 0] });
/** the stranger 3 m away, to the person's side (+x) and a little ahead */
const L = [2, 1.6, 2], EYE = 1.55;

describe('reactions played on the people (D-395)', () => {
  it('each kind turns the head its own way; avoid looks away, the others look at him', () => {
    const R = new Reactions(); const at: [number, number, number] = [0, 0, 0];
    const head: Record<string, number[]> = {}; const eyes: Record<string, boolean> = {};
    for (const k of ['greet', 'bow', 'nod', 'stare', 'avoid', 'turn'] as const) {
      R.play(k, k, 0, at, { byName: true }); const r = R.active(k, 1)!; const po = still();
      eyes[k] = reactPose(r, 1, po, L, EYE, true); head[k] = po.rot.head as number[]; if (k === 'bow') expect(po.rot.chest![0], 'a bow from the chest').toBeGreaterThan(0.2);
      if (k === 'greet') expect(po.rot.r_upper![0], 'a greeting by name raises the hand').toBeLessThan(-0.5);
    }
    for (const k of ['greet', 'nod', 'stare', 'turn']) { expect(head[k][1], k).toBeGreaterThan(0.4); expect(eyes[k], k).toBe(true); }
    expect(head.avoid[1], 'the head turned away').toBeLessThan(-0.3); expect(head.avoid[0], 'the eyes down').toBeGreaterThan(0.2); expect(eyes.avoid).toBe(false);
    expect(head.stare[1]).toBeGreaterThan(head.nod[1] - 1e-9);
  });
  it('a reaction ends, is not restarted by every poll, and returns after a while', () => {
    const R = new Reactions(); const at: [number, number, number] = [0, 0, 0];
    expect(R.fromSights([{ pid: 7, kind: 'nod', why: '', d: 3 }, { pid: 8, kind: 'ignore', why: '', d: 3 }], 0, at)).toBe(1);
    expect(R.fromSights([{ pid: 7, kind: 'nod', why: '', d: 3 }], 1, at), 'the next poll: still playing').toBe(0);
    expect(R.active(7, REACT_S.nod + 0.01)).toBeNull(); expect(R.active(8, 0)).toBeNull();
    expect(R.fromSights([{ pid: 7, kind: 'nod', why: '', d: 3 }], 5, at), 'not again so soon').toBe(0);
    expect(R.fromSights([{ pid: 7, kind: 'nod', why: '', d: 3 }], REACT_AGAIN_S + 1, at)).toBe(1);
    const po = still(); const r = R.active(7, REACT_AGAIN_S + 1)!; reactPose(r, REACT_AGAIN_S + 1, po, L, EYE); expect(Math.abs(po.rot.head![1]), 'eased in from the pose').toBeLessThan(0.05);
  });
  it('the sim’s sightings in a village become stares and nods on the people, and a child may tag along', () => {
    const D = 60, H = 10, sim = simAt(1, D, H, { asks: true }), P = sim.pop, E = sim.econTo(D), near: Near[] = [];
    for (let pid = 0; pid < P.persons.length && near.length < 40; pid++) { if (!P.present(pid, D) || P.ageOn(pid, D) < 4 || !E.hh.has(`h:${P.home(pid, D)}`)) continue;
      const s = segAt(P.plan(pid, D), H); if (s.where !== 'plain' || s.act === 'sleep') continue; const k = near.length; near.push({ pid, e: 2 + (k % 5) * 1.5, n: Math.floor(k / 5) * 1.2 }); }
    const S = sim.strangerSeen(near, { e: 0, n: 0 }); const R = new Reactions(); const n = R.fromSights(S, 100, [0, 1.7, 0]);
    expect(n).toBe(S.filter(s => s.kind !== 'ignore').length); expect(n).toBeGreaterThan(5);
    const kinds = new Set(R.played.map(p => p.kind)); expect(kinds.has('stare') || kinds.has('nod')).toBe(true);
    for (const s of S.filter(s => s.kind !== 'ignore')) expect(R.active(s.pid, 100.5)?.kind).toBe(s.kind);
  });
  it('a shout turns the heads of those in earshot toward the speaker; plain words turn none', () => {
    const people: Listener[] = [{ pid: 1, e: 4, n: 0, facing: 0 }, { pid: 2, e: -6, n: 3, facing: 180 }, { pid: 3, e: 0, n: 200, facing: 0 }];
    const quiet = earshot(people, { e: 0, n: 0, yawDeg: 90 }, 'good day', () => null), loud = earshot(people, { e: 0, n: 0, yawDeg: 90 }, 'HELP! HELP!!', () => null);
    const R = new Reactions(); R.clock = 10;
    expect(R.fromHeard(quiet.look, [0, 1.7, 0])).toBe(0);
    expect(R.fromHeard(loud.look, [0, 1.7, 0])).toBeGreaterThan(0);
    for (const l of loud.look) expect(R.active(l.pid, 10.3)?.kind).toBe('turn');
    expect(R.active(3, 10.3), 'too far to hear').toBeNull();
  });
});
