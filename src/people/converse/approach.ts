// D-375 (UD-25 (2): needs surfaced in talk as emergent quests, no quest UI): SOMEONE COMES UP TO THE STRANGER. A person near the
// stranger whose house has an open need it would put even to a stranger (the asks layer: Ask.voices 'stranger' willing),
// who trusts the stranger enough to ask, and who is free (not asleep, not at work under someone's eye, not already in a talk),
// walks up and asks. Chosen by the need's urgency, the person's trust and a keyed draw; at most one approach in a while, and
// never the same house twice in a few days. The simulation decides who and what; the person's own words are the model's,
// told the need (the brief's "Your house needs" line) and that they came to ask. Pure: no draw changes the simulation.
import type { PeopleSim } from '../sim';
import type { Ask } from '../asks/asks';
import { segAt } from '../population';
import { u01, salt } from '../hash';

const S = salt('approach');
/** activities from which a person may step over to the stranger (C) */
const FREE = new Set(['rest', 'talk', 'play', 'queue', 'exchange', 'spin', 'walk', 'gather', 'tend_body', 'wash', 'clean']);
export interface Approach { pid: number; hh: string; ask: Ask; trust: number; /** the line the person opens with (translation layer; the model words it in the talk) */ opening: string }
const ASK_WORDS: Record<string, string> = { grain: 'barley for the house', fuel: 'fuel for the hearth', silver: 'a little silver', labour: 'a hand with the work', healer: 'help with the sick', company: 'a word of comfort', animal: 'help with a beast', justice: 'a witness', shelter: 'a roof for a night', time: 'someone to speak for the house', petition: 'someone to speak for the house', lost_child: 'help to find a child' };

export class Approaches {
  private last = -1e9; private byHouse = new Map<string, number>();
  constructor(private sim: PeopleSim, readonly everyH = 1.5, readonly houseDays = 4) {}
  /** the person who comes up to the stranger now, from those near (pids within a few tens of metres), or null */
  next(near: readonly number[], t = this.sim.t): Approach | null {
    if (t - this.last < this.everyH) return null;
    const day = Math.floor(t / 24), hour = t - day * 24, sim = this.sim, P = sim.pop; if (hour < 7 || hour > 19) return null;
    const E = sim.ledgerNow(); if (!E || !sim.asksWorld.on) return null;
    let best: Approach | null = null, bv = -1;
    for (const pid of near) {
      if (!P.present(pid, day) || P.ageOn(pid, day) < 14) continue; const hh = `h:${P.home(pid, day)}`;
      if ((this.byHouse.get(hh) ?? -1e9) > day - this.houseDays) continue;
      const seg = segAt(P.plan(pid, day), hour); if (!seg || !FREE.has(seg.act)) continue;
      const trust = E.trust ? E.trust.trustOf(hh, 'player', day) : 0.5; if (trust < 0.45) continue;
      const ask = sim.asksWorld.openAsksOf(hh).filter(a => a.voices.find(v => v.to === 'stranger')?.willing).sort((a, b) => b.urgency - a.urgency)[0]; if (!ask) continue;
      const v = ask.urgency * (0.5 + trust) * (0.6 + 0.4 * u01(sim.seed, S, pid, day * 24 + Math.floor(hour)));
      if (v > bv) { bv = v; const off = ask.voices.find(x => x.to === 'stranger')!.offers; best = { pid, hh, ask, trust, opening: `comes up to you and asks for ${ASK_WORDS[ask.kind] ?? ask.kind}, offering ${off}` }; }
    }
    if (best && bv > 0.35) { this.last = t; this.byHouse.set(best.hh, day); return best; }
    return null;
  }
}
