// D-391 (the playtest bot: 86 of 93 "lead me to ..." asks were places nobody knew): the market, the court and a workshop by
// its craft are places a person of the town can name and lead the stranger to. The grammar reads the ask; the person's own
// talk world resolves the place (their quarter's market, the officials' building, a house whose plot is that workshop).
import { describe, it, expect } from 'vitest';
import { simAt } from './sim_fixture';
import { requestOf } from '../src/people/converse/intent';

describe('places a stranger asks to be led to (D-391)', () => {
  it('the market, the court and the workshops are known', () => {
    const d = 60, sim = simAt(1, d, 10), P = sim.pop;
    const pid = P.persons.find(p => p.zone === 'town' && P.present(p.id, d) && P.ageOn(p.id, d) >= 25)!.id, q = P.households[P.home(pid, d)].q;
    for (const [said, want] of [['Where is the market?', `market:${q}`], ['Can you show me the way to the court?', 'official_bldg'], ['Take me to the smith.', 'metal'],
      ['Where is the potter?', 'pottery'], ['Show me where the bakery is.', 'bakery'], ['Where is the well?', `well:${q}`]] as const) {
      const r = requestOf(said); expect(r?.kind, said).toBe('lead_to');
      const dest = sim.talk.resolvePlace(pid, d, r!.arg ?? ''); expect(dest, said).not.toBeNull();
      if (want.includes(':') || want === 'official_bldg') expect(dest).toBe(want); else expect(P.plotOf(Number(dest!.slice(2)))?.craft).toBe(want);
    }
  }, 600_000);
  it('a house with no work for the stranger says where there is some (D-391)', () => {
    const d = 120, sim = simAt(1, d, 10, { asks: true }), P = sim.pop, E = sim.econTo(d), S = E.stranger(); S.hear('Aramaic', 400, 1, true, d);
    let n = 0;
    for (const p of P.persons) { if (n >= 5) break; if (!P.present(p.id, d) || P.ageOn(p.id, d) < 25) continue; const hh = `h:${P.home(p.id, d)}`; if (!E.hh.has(hh) || S.wantsHand(hh, d)) continue;
      const r = sim.strangerAsk(p.id, 'Could I work for you?'); if (!r || r.verdict.ok) continue; n++;
      expect(r.verdict.why).toMatch(/needs a hand|king’s works|no one in the quarter/); }
    expect(n).toBe(5);
  }, 600_000);
});
