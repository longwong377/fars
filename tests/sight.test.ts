// D-385: people react to the stranger on sight (src/people/converse/sight.ts; PeopleSim.strangerSeen)
import { describe, it, expect } from 'vitest';
import { simAt } from './sim_fixture';
import { reactions, type Near } from '../src/people/converse/sight';
import { segAt } from '../src/people/population';
import type { PeopleSim } from '../src/people/sim';

const D = 60, H = 10;
/** awake adults of households the economy knows, out and about at (D, H) in the given setting, placed around the stranger */
function crowd(sim: PeopleSim, where: 'town' | 'plain', n: number): Near[] {
  const P = sim.pop, E = sim.econTo(D), out: Near[] = [];
  for (let pid = 0; pid < P.persons.length && out.length < n; pid++) {
    if (!P.present(pid, D) || P.ageOn(pid, D) < 14 || !E.hh.has(`h:${P.home(pid, D)}`)) continue;
    const s = segAt(P.plan(pid, D), H); if (s.where !== where || s.act === 'sleep') continue;
    const k = out.length; out.push({ pid, e: 3 + (k % 5) * 1.5, n: Math.floor(k / 5) * 1.5 });
  }
  return out;
}
const at = { e: 0, n: 0 };

describe('people react to the stranger on sight (D-385)', () => {
  const sim = simAt(1, D, H, { asks: true }); const t = D * 24 + H;

  it('is deterministic, and a busy town street mostly nods or ignores', () => {
    const near = crowd(sim, 'town', 60); expect(near.length).toBeGreaterThan(30);
    const a = reactions(sim, near, at, t), b = reactions(simAt(1, D, H, { asks: true }), near, at, t); // (a world loaded again: the same draws)
    expect(b).toEqual(a); expect(reactions(sim, near, at, t)).toEqual(a);
    const calm = a.filter(r => r.kind === 'nod' || r.kind === 'ignore').length;
    expect(calm / a.length).toBeGreaterThan(0.8);
    // people beyond sight are not reported
    expect(reactions(sim, [{ ...near[0], e: 40 }], at, t)).toEqual([]);
  });

  it('a house whose trust in him was lowered avoids him', () => {
    const near = crowd(sim, 'town', 60), x = reactions(sim, near, at, t).find(r => r.kind === 'nod' || r.kind === 'ignore')!;
    const E = sim.econTo(D), hh = `h:${sim.pop.home(x.pid, D)}`;
    E.trust!.note(hh, 'player', -0.9, D); E.trust!.note(hh, 'player', -0.9, D);
    const r = reactions(sim, near, at, t).find(y => y.pid === x.pid)!;
    expect(r.kind).toBe('avoid'); expect(r.why).toMatch(/distrust/);
  });

  it('a house told an envoy claim, and believing it, bows', () => {
    const near = crowd(sim, 'town', 60), rs = reactions(sim, near, at, t);
    const x = rs.find(r => r.kind === 'nod' || r.kind === 'ignore' || r.kind === 'stare')!; const hh = `h:${sim.pop.home(x.pid, D)}`;
    const E = sim.econTo(D), S = E.stranger(); S.halmi = D + 30; // (a sealed travel document: the envoy's tale holds together)
    S.do({ a: 'hear', day: E.day, lang: S.langOf(hh), hours: 600, spoke: true }); S.do({ a: 'hear', day: E.day, lang: 'Aramaic', hours: 600, spoke: true }); // (he speaks their tongue by now)
    expect(S.do({ a: 'claim', day: E.day, hh, role: 'envoy', origin: 'Persian' }).ok).toBe(true);
    const reg = S.regard(hh, D);
    expect(reg.belief * reg.rank).toBeGreaterThanOrEqual(0.5); // (believed on its own merits: the document, his Persian)
    const r = reactions(sim, near, at, t).find(y => y.pid === x.pid)!;
    expect(r.kind).toBe('bow');
    // a house that did not hear the tale does not bow
    const other = reactions(sim, near, at, t).filter(y => `h:${sim.pop.home(y.pid, D)}` !== hh);
    expect(other.every(y => y.kind !== 'bow')).toBe(true);
  });

  it('someone who has talked with the stranger greets him by name', () => {
    const near = crowd(sim, 'town', 60), x = reactions(sim, near, at, t).find(r => r.kind === 'nod' || r.kind === 'ignore' || r.kind === 'stare')!;
    sim.talk.remember(x.pid, t - 20, t - 20, 'where is the well?', 'by the gate');
    const r = reactions(sim, near, at, t).find(y => y.pid === x.pid)!;
    expect(r.kind).toBe('greet'); expect(r.byName).toBe(true); expect(r.name).toBeTruthy();
  });

  it('a village stares at the foreigner more than the town does; a staring child may tag along', () => {
    const v = simAt(1, D, H, { asks: true }), near = crowd(v, 'plain', 60);
    const kids: Near[] = []; const P = v.pop;
    for (let pid = 0; pid < P.persons.length && kids.length < 40; pid++) { const a = P.ageOn(pid, D); if (!P.present(pid, D) || a < 5 || a > 11) continue;
      const s = segAt(P.plan(pid, D), H); if (s.where === 'plain' && s.act !== 'sleep') kids.push({ pid, e: 2, n: kids.length * 0.2 }); }
    const rv = reactions(v, [...near, ...kids], at, t), rt = reactions(v, crowd(v, 'town', 60), at, t);
    const share = (rs: typeof rv) => rs.filter(r => r.kind === 'stare').length / Math.max(1, rs.length);
    expect(share(rv)).toBeGreaterThan(share(rt));
    const seen = v.strangerSeen(kids, at), f = seen.filter(r => r.follow);
    if (kids.length >= 10) expect(f.length).toBeGreaterThan(0);
    for (const r of f) expect(v.talk.events.some(e => e.pid === r.pid && e.kind === 'follow' && e.ok)).toBe(true);
    // polled again, no second deed is laid
    const n0 = v.talk.events.length; v.strangerSeen(kids, at); expect(v.talk.events.length).toBe(n0);
  });
});
