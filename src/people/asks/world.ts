// D-352: the asks and the rumours of a running sim. Bound to the sim's CURRENT economy (it is rebuilt on a load), advanced once a
// day by the living world (LivingWorld.onDay, after the economy's and the talk's day), saved with the sim (PeopleSim.econSave).
// Off unless SimOpts.asks is true (each year of it costs ~40 s of node time on 10000 households: D-352), so nothing else moves.
import type { Population } from '../population';
import type { Economy } from '../economy/world';
import { AskBook, type Ask } from './asks';
import { RumourNet } from './rumour';

export interface AsksSave { asks: ReturnType<AskBook['save']>; rumour: ReturnType<RumourNet['save']> }
export class AsksWorld {
  private book: AskBook | null = null; private net: RumourNet | null = null; private E: Economy | null = null; private pending: AsksSave | null = null;
  constructor(private pop: Population, private seed: number, private econ: () => Economy, readonly on = true) {}
  private build() {
    const E = this.econ(); if (this.E === E && this.book && this.net) return;
    this.E = E; const hid = (id: string) => Number(id.slice(2)), pop = this.pop;
    this.book = new AskBook(E, this.seed, { kinHelp: false,
      members: id => pop.membersOn(hid(id), Math.max(0, E.day)).filter(m => pop.ageOn(m, Math.max(0, E.day)) >= 14),
      kids: id => pop.membersOn(hid(id), Math.max(0, E.day)).filter(m => pop.ageOn(m, Math.max(0, E.day)) < 12).length });
    this.net = new RumourNet(E, this.seed, { sink: i => { const g = E.hh.get(i.from); if (g && g.grain > g.eaters * 0.55 * 45 + Number(i.payload.grain ?? 0)) { g.grain -= Number(i.payload.grain ?? 0); E.enter(i); } } });
    if (this.pending) { this.book.load(this.pending.asks); this.net.load(this.pending.rumour); this.pending = null; }
  }
  /** the living world's hook: after the economy's day `d` */
  day(d: number) { if (!this.on) return; this.build(); this.book!.advance(d); this.net!.advance(d); this.heard(d); }
  /** D-375: what a house hears it believes, a little: each house that learned a rumour today moves its trust in the house the
   *  version names (the suspect of a theft, the defaulter, the one in debt) as the trust ledger's news does (trust.ts HEARD);
   *  the lenders and employers of the economy read that trust, so gossip costs a house credit and work, true or not (C) */
  private heard(d: number) {
    const T = this.E?.trust; if (!T) return;
    for (const r of this.net!.rumours) { if (r.last < d) continue; for (const [hh, h] of r.holds) if (h.day === d && h.hand > 0 && h.v.certainty >= 0.3) T.hear(hh, h.v.suspect ?? h.v.about, h.v.kind, d); }
  }
  get asks(): AskBook { this.build(); return this.book!; }
  get rumours(): RumourNet { this.build(); return this.net!; }
  openAsksOf(hh: string): Ask[] { return this.on ? this.asks.openOf(hh) : []; }
  save(): AsksSave | undefined { return this.on && this.book && this.net ? { asks: this.book.save(), rumour: this.net.save() } : this.pending ?? undefined; }
  load(s?: AsksSave) { this.book = null; this.net = null; this.E = null; this.pending = s ?? null; }
}
