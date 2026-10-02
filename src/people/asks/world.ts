// D-352: the asks and the rumours of a running sim. Bound to the sim's CURRENT economy (it is rebuilt on a load), advanced once a
// day by the living world (LivingWorld.onDay, after the economy's and the talk's day), saved with the sim (PeopleSim.econSave).
// Off unless SimOpts.asks is true (each year of it costs ~40 s of node time on 10000 households: D-352), so nothing else moves.
import type { Population } from '../population';
import type { Economy } from '../economy/world';
import { AskBook, type Ask } from './asks';
import { RumourNet } from './rumour';

/** the stranger's dealings the town talks of (D-375), and those that are his own doing (the news is about him) */
const STRANGER_NEWS = new Set(['hosted', 'guest_sent_away', 'ingrate', 'guest_repaid', 'claim_denied', 'claim_doubted', 'hired_stranger', 'dismissed', 'ruling_for', 'ruling_against', 'joined_house', 'learned_tongue']);
const STRANGER_DOES = new Set(['ingrate', 'guest_repaid', 'claim_denied', 'claim_doubted', 'dismissed', 'learned_tongue']);
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
  day(d: number) { for (const _ of this.dayParts(d)); }
  /** D-388: the same day in its parts (the book built, once after a load; the stranger's news and the asks; the rumours; what
   *  was heard), yielding between them, for a day advanced across frames (LivingWorld.advanceSliced) */
  *dayParts(d: number): Generator<void> { if (!this.on) return; this.build(); yield; this.strangerNews(d); yield* this.book!.advanceParts(d); yield; yield* this.net!.advanceParts(d); yield; this.heard(d); }
  /** D-370/D-375: the town talks of the stranger: his notable dealings (taken on, taken in, sent away, ingratitude, thanks, a
   *  tale denied or doubted, a ruling, a house joined) become news from the house they happened at, with the stranger as the
   *  one it is about where it is his deed (so the hearers' trust moves on him, not on the house) */
  private strCursor = -1;
  private strangerNews(d: number) {
    const E = this.E!; if (!E.hasStranger) { this.strCursor = E.events.length; return; } if (this.strCursor < 0) this.strCursor = Math.max(0, E.events.length - 200);
    for (; this.strCursor < E.events.length; this.strCursor++) { const v = E.events[this.strCursor]; if (!v || (v.actor !== 'player' && v.other !== 'player')) continue;
      const house = v.actor === 'player' ? v.other : v.actor; if (!house || !E.hh.has(house) || !STRANGER_NEWS.has(v.kind)) continue;
      this.net!.inject(Math.max(0, Math.min(d, v.day)), house, v.kind, 1, house, STRANGER_DOES.has(v.kind) ? 'player' : undefined); }
  }
  /** D-375: what a house hears it believes, a little: each house that learned a rumour today moves its trust in the house the
   *  version names (the suspect of a theft, the defaulter, the one in debt) as the trust ledger's news does (trust.ts HEARD);
   *  the lenders and employers of the economy read that trust, so gossip costs a house credit and work, true or not (C) */
  private heard(d: number) {
    const T = this.E?.trust; if (!T) return;
    // (D-388: the rumours still told, not every rumour of the year: one learned today is among them)
    for (const r of this.net!.recent) { if (r.last < d) continue; for (const [hh, h] of r.holds) if (h.day === d && h.hand > 0 && h.v.certainty >= 0.3) T.hear(hh, h.v.suspect ?? h.v.about, h.v.kind, d); }
    void STRANGER_DOES;
  }
  get asks(): AskBook { this.build(); return this.book!; }
  get rumours(): RumourNet { this.build(); return this.net!; }
  openAsksOf(hh: string): Ask[] { return this.on ? this.asks.openOf(hh) : []; }
  save(): AsksSave | undefined { return this.on && this.book && this.net ? { asks: this.book.save(), rumour: this.net.save() } : this.pending ?? undefined; }
  load(s?: AsksSave) { this.book = null; this.net = null; this.E = null; this.pending = s ?? null; }
}
