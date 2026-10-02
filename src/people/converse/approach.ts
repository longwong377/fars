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
export interface Approach { pid: number; hh: string; /** 'ask': the house's need; 'invite': a friendly house invites the stranger to eat and stay (guest-right offered, not asked) */ kind: 'ask' | 'invite'; ask: Ask | null; trust: number; /** the line the person opens with (translation layer; the model words it in the talk) */ opening: string }
const ASK_WORDS: Record<string, string> = { grain: 'barley for the house', fuel: 'fuel for the hearth', silver: 'a little silver', labour: 'a hand with the work', healer: 'help with the sick', company: 'a word of comfort', animal: 'help with a beast', justice: 'a witness', shelter: 'a roof for a night', time: 'someone to speak for the house', petition: 'someone to speak for the house', lost_child: 'help to find a child' };
/** D-450: several ways of putting each ask (a playtest found 8 of 13 approaches opening with the same line), the phrasing
 *  keyed by a seeded draw; the generic forms serve every kind, the kind's own forms are added to them */
type Open = (w: string, o: string) => string;
const OPEN_ANY: Open[] = [
  (w, o) => `comes up to you and asks for ${w}, offering ${o}`,
  (w, o) => `stops you and says the house is in want of ${w}; for it, ${o}`,
  (w, o) => `hesitates, then asks whether you could help with ${w}, and offers ${o}`,
  (w, o) => `calls you over: the house needs ${w}, and would give ${o}`,
];
const OPEN_KIND: Record<string, Open[]> = {
  company: [(_w, o) => `comes up to you: there has been a death in the house; asks you to sit a while with the mourners, offering ${o}`, (_w, o) => `asks you, quietly, to come and grieve with the house, as strangers too are welcomed at a death; offers ${o}`],
  grain: [(_w, o) => `says the jars of the house are nearly empty, and asks for barley; offers ${o}`, (_w, o) => `asks if you have barley to spare for the children of the house, and offers ${o}`],
  labour: [(_w, o) => `looks you over and asks if you would put your hands to the work of the house; offers ${o}`, (_w, o) => `asks for a strong back for a day or two, offering ${o}`],
  healer: [(_w, o) => `asks, worried, whether you know anything of tending the sick: someone in the house is ill; offers ${o}`],
  fuel: [(_w, o) => `asks whether you could bring dung-cakes or brushwood for the hearth, offering ${o}`],
  silver: [(_w, o) => `lowers the voice and asks for a little silver, for a debt; offers ${o}`],
  lost_child: [() => 'runs up to you: a child of the house is lost; asks if you have seen a small child, and begs you to look'],
};
/** how much each kind of ask brings a person over to a stranger, beside its urgency (C): mourning company is asked of a
 *  stranger only in the first days after the death, and less readily than food or hands */
const KIND_W: Record<string, number> = { company: 0.45 };
const COMPANY_DAYS = 4;

export class Approaches {
  private last = -1e9; private byHouse = new Map<string, number>(); private invited = new Map<string, number>();
  constructor(private sim: PeopleSim, readonly everyH = 1.5, readonly houseDays = 4) {}
  /** the person who comes up to the stranger now, from those near (pids within a few tens of metres), or null */
  next(near: readonly number[], t = this.sim.t): Approach | null {
    if (t - this.last < this.everyH) return null;
    const day = Math.floor(t / 24), hour = t - day * 24, sim = this.sim, P = sim.pop; if (hour < 7 || hour > 20) return null;
    const E = sim.ledgerNow(); if (!E || !sim.asksWorld.on) return null;
    let best: Approach | null = null, bv = -1;
    for (const pid of near) {
      if (!P.present(pid, day) || P.ageOn(pid, day) < 14) continue; const hh = `h:${P.home(pid, day)}`;
      if ((this.byHouse.get(hh) ?? -1e9) > day - this.houseDays) continue;
      const seg = segAt(P.plan(pid, day), hour); if (!seg || !FREE.has(seg.act)) continue;
      const trust = E.trust ? E.trust.trustOf(hh, 'player', day) : 0.5; if (trust < 0.45) continue;
      // (D-454: no ask for silver the stranger plainly has not got: an ask he cannot meet, every few days, reads as a loop)
      const purse = E.hasStranger ? E.stranger().purse.cash : 0;
      const ask = sim.asksWorld.openAsksOf(hh).filter(a => a.voices.find(v => v.to === 'stranger')?.willing && !(a.kind === 'company' && day - a.day0 > COMPANY_DAYS) && !(a.kind === 'silver' && purse < 0.5))
        .sort((a, b) => b.urgency * (KIND_W[b.kind] ?? 1) - a.urgency * (KIND_W[a.kind] ?? 1))[0];
      // (D-375: a friendly house with stores to spare, in the evening, invites the stranger to eat and stay: guest-right offered)
      if (!ask) { const St = E.hasStranger ? E.stranger() : null;
        if (trust >= 0.7 && hour >= 16.5 && St && !St.stay && (this.invited.get(hh) ?? -1e9) <= day - 30 && St.stayCheck(hh, day).ok) { const v = (trust - 0.6) * (0.6 + 0.4 * u01(sim.seed, S, pid, day * 24 + Math.floor(hour), 1)); // (D-454: not when he has a bed; a house invites at most once a month)
          if (v + 0.3 > bv) { bv = v + 0.3; best = { pid, hh, kind: 'invite', ask: null, trust, opening: 'comes up to you and asks you to eat with the house tonight, and to stay if you need a roof' }; } }
        continue; }
      const v = ask.urgency * (KIND_W[ask.kind] ?? 1) * (0.5 + trust) * (0.6 + 0.4 * u01(sim.seed, S, pid, day * 24 + Math.floor(hour)));
      if (v > bv) { bv = v; const off = ask.voices.find(x => x.to === 'stranger')!.offers; best = { pid, hh, kind: 'ask', ask, trust, opening: openingOf(ask.kind, off, u01(sim.seed, S, pid, day, 2)) }; }
    }
    if (best && bv > 0.35) { this.last = t; this.byHouse.set(best.hh, day); if (best.kind === 'invite') this.invited.set(best.hh, day); return best; }
    return null;
  }
}

/** D-450: the opening line for an ask, one of its phrasings by a seeded draw u (0..1) */
export function openingOf(kind: string, offers: string, u: number): string {
  const forms = [...(OPEN_KIND[kind] ?? []), ...OPEN_ANY]; return forms[Math.min(forms.length - 1, Math.floor(u * forms.length))](ASK_WORDS[kind] ?? kind, offers);
}
