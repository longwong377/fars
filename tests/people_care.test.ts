// D-292 (gap hunter C, C-D04..C-D07, C-D46; WORLD_INVENTORY GC6, GC20, GB50): the body's care laid over the day plans
// (population.ts care): the morning wash at the house's jar, a child's hair gone through for lice on the doorstep, the
// quarter's barbers in the lane; and the Persians' washing on the bank from a jar, never in the stream (Herodotus 1.138).
// How this could pass while the intent fails (said before building): care spells that exist in the plans but move the
// morning's work (so the morning's timings change), pairs whose two halves are at different places or hours (a woman
// picking lice from nobody; a man shaved by no barber), spells the crowd draws with a pose that is not theirs, a washing
// rule that renames the reason while the performance still kneels in the stream. Each is measured below.
import { describe, it, expect, beforeAll } from 'vitest';
import { buildPop, sampleDays, bodyTrace, WASH_FACE } from '../tools/dev/body_trace';
import { segAt, wakeIndex, type Population, type Seg } from '../src/people/population';
import { checkPlan, checkDay } from '../src/people/planCheck';
import { performanceFor } from '../src/people/activities';
import { PAIR_FOLLOW } from '../src/people/popview';

let P: Population; const days = sampleDays(1, 3);
beforeAll(() => { P = buildPop(1); }, 240_000);
const base = (pid: number, d: number): Seg[] => (P as any).relabel(pid, d, P.rawPlan(pid, d));

describe('the body\'s care (D-292)', () => {
  it('everyone of three and over in the town and the plain washes at rising, and no morning work moves for it', () => {
    let n = 0, washed = 0, moved = 0;
    for (const d of days) for (let pid = 0; pid < P.persons.length; pid += 7) { const p = P.persons[pid]; if (!P.present(pid, d) || p.agent >= 0 || P.ageOn(pid, d) < 3) continue;
      const H = P.households[P.home(pid, d)]; if (H.zone !== 'town' && H.zone !== 'plain') continue; const b = base(pid, d), wi = wakeIndex(b, H.home); if (wi < 0 || P.sick(pid, d)) continue; n++;
      const s = P.plan(pid, d), w = s.findIndex(x => WASH_FACE.test(x.why)); if (w < 0) continue; washed++;
      // (the wash ends where the night's sleep ended; what follows is the planner's day)
      if (Math.abs(s[w].t1 - b[wi].t1) > 1e-6 || s[w + 1].act !== b[wi + 1].act || Math.abs(s[w + 1].t0 - b[wi + 1].t0) > 1e-6) moved++; }
    expect(n).toBeGreaterThan(500); expect(washed / n).toBeGreaterThan(0.97); expect(moved).toBe(0);
  }, 240_000);
  it('the pairs are together: the woman and the child on the doorstep, the barber and the man in the lane, at the same hours', () => {
    let combs = 0, shaves = 0, bad: string[] = [];
    for (const d of days) {
      for (let h = 0; h < P.households.length; h += 2) { const c = P.combOf(h, d); if (!c) continue; combs++; const [w, k, a, b] = c, m = (a + b) / 2, sw = segAt(P.plan(w, d), m), sk = segAt(P.plan(k, d), m);
        if (sw.act !== 'tend_body' || sk.act !== 'tend_body' || sw.place !== sk.place || sk.with !== w || !PAIR_FOLLOW.test(sk.why)) bad.push(`comb d${d} h${h}: ${sw.act} ${sw.place} / ${sk.act} ${sk.place} ${sk.why}`); }
      for (const q of ['q_pw_n', 'q_pw_s', 'q_lt_e', 'q_lt_w', 'q_north', 'q_firuzi', 'q_gohar']) for (const [B, x, a, b] of P.shavesOn(q, d)) { shaves++; const m = (a + b) / 2, sb = segAt(P.plan(B, d), m), sx = segAt(P.plan(x, d), m);
        if (sb.act !== 'tend_body' || sx.act !== 'tend_body' || sb.place !== `lane:${q}` || sx.place !== sb.place || sx.with !== B || !PAIR_FOLLOW.test(sx.why)) bad.push(`shave d${d} ${q}: ${sb.act} ${sb.place} / ${sx.act} ${sx.place}`); } }
    expect(bad.slice(0, 5)).toEqual([]); expect(combs).toBeGreaterThan(100); expect(shaves).toBeGreaterThan(60);
  }, 240_000);
  it('the care spells add no fault to the plans (checkPlan) and none to the day (checkDay: with, alone, minding)', () => {
    const d = days[1]; let added = 0, checked = 0; const notes: string[] = [];
    for (let pid = 0; pid < P.persons.length; pid += 3) { if (!P.present(pid, d)) continue; const s = P.plan(pid, d); if (!s.some(x => x.ev === 'D-292' && !WASH_FACE.test(x.why))) continue; checked++;
      const prev = P.present(pid, d - 1) ? P.plan(pid, d - 1).slice(-1)[0].place : null, k0 = new Set(checkPlan(P, pid, d, base(pid, d), prev).map(x => x.kind));
      for (const i of checkPlan(P, pid, d, s, prev)) if (!k0.has(i.kind)) { added++; if (notes.length < 5) notes.push(`${pid}: ${i.kind} ${i.note}`); } }
    expect(checked).toBeGreaterThan(50); expect(notes).toEqual([]); expect(added).toBe(0);
    const care = checkDay(P, d, pid => P.plan(pid, d)).filter(x => P.plan(x.pid, d).some(s => s.ev === 'D-292' && !WASH_FACE.test(s.why)));
    expect(care.slice(0, 5)).toEqual([]);
  }, 600_000);
  it('the crowd draws each spell with its own pose: the wash over the basin, the woman at the child\'s head, the barber\'s razor, the sitters', () => {
    const pf = (why: string) => performanceFor('tend_body', why);
    expect(pf('washing her face and hands at the water jar in the courtyard at rising, the water poured into a basin').anim).toBe('wash_face');
    expect(pf('picking the lice from Irdabama’s hair on the doorstep, parting it with her fingers').anim).toBe('delouse');
    expect(pf('having his hair gone through for lice on the doorstep, sitting still in front of her').anim).toBe('sit');
    const b = pf('shaving men of the quarter in the lane: a beard trimmed or the cheeks shaved with a bronze razor, water from a jar'); expect(b.anim).toBe('shave'); expect(b.prop).toBe('knife');
    expect(pf('being shaved by the barber in the lane, sitting on the ground: his beard trimmed or his cheeks shaved').anim).toBe('sit');
    const w = performanceFor('wash', 'washing his clothes on the bank, with water drawn up in a jar, away from the stream (the Persians\' rule: HDT 1.138)'); expect(w.work?.some(x => x.kind === 'jar')).toBe(true);
  });
  it('no Persian and no guard washes in the stream: at the river and the canals it is done on the bank from a jar (Herodotus 1.138)', () => {
    const r = bodyTrace(P, 1, days, 5); expect(r.persianLaundry).toBeGreaterThan(20); expect(r.persianInStream).toBe(0);
  }, 240_000);
});
