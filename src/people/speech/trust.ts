// Reputation and trust (s13, UD-25 (1), UD-26; D-351). Trust is not a stored trait: it is read off what the economy's event
// graph records people DID (debts repaid or defaulted, help given, thefts, arrests and acquittals, kin's help, work given),
// plus news heard (the living world calls hear()) and the stranger's own deeds. Three layers, all decaying (half-life
// HALF_LIFE days, so a default is remembered for a year and a deed of help is half gone in five months; C):
//   personal[id]  how the person or household is spoken of (its own deeds);
//   dyad[a>b]     what a itself has seen of b (repaid a's loan, helped a, robbed a), and what a has heard of b;
//   group[key]    a quarter ('q:..'), a trade ('k:..') and a kin name ('kin:..', the deeds of one house stain or raise
//                 its kin): the prior for a person one does not know.
// trustOf(a, b) blends them: the public standing counts fully inside a's quarter and kin, half outside (news travels
// less far); the group priors weigh 0.25; direct experience 0.9; kin +0.08. Output 0..1, 0.5 = a stranger of no record.
// Deterministic (a pure function of the event sequence), saved with the economy (snapshot/restore), and read by the
// lenders (Economy.creditOk / lender), by kin and neighbours deciding to help or hire, and by haggling (haggle.ts).
// Tiers: every weight here is C (reasoned: a village's reputation economy, by analogy with Achaemenid-period Babylonian
// creditor practice; B for the direction of each deed's effect, C for the sizes).
import type { EconEvent } from '../economy/world';
import { Cols, ColsReader } from '../savepack';

export const HALF_LIFE = 150;
export const SYSTEM_IDS = new Set(['court', 'treasury', 'market', 'weather', 'caravan']);
interface Rec { v: number; d: number }
/** what a deed does: `who` is the one it is about; pub: to their public standing; dyad: to the other party's own trust in them */
interface Deed { who: 'actor' | 'other'; pub: number; dyad: number; thank?: boolean }
const DEEDS: Record<string, Deed> = {
  repaid: { who: 'actor', pub: 0.10, dyad: 0.25 },
  default: { who: 'actor', pub: -0.35, dyad: -0.6 },
  theft: { who: 'actor', pub: -0.40, dyad: -0.7 },
  tax_arrears: { who: 'actor', pub: -0.08, dyad: 0 },
  levy_arrears: { who: 'actor', pub: -0.08, dyad: 0 },
  bound_labour: { who: 'actor', pub: -0.10, dyad: 0 },
  redeemed: { who: 'actor', pub: 0.10, dyad: 0.1 },
  kin_help: { who: 'other', pub: 0.05, dyad: 0.30 },
  nursed_by_kin: { who: 'other', pub: 0.05, dyad: 0.30 },
  hired_by_neighbour: { who: 'other', pub: 0.04, dyad: 0.20 },
  given: { who: 'other', pub: 0.06, dyad: 0.30 },
  lent_by_stranger: { who: 'other', pub: 0.05, dyad: 0.25 }, lent_by_neighbour: { who: 'other', pub: 0.05, dyad: 0.25 },
  hired_by_stranger: { who: 'other', pub: 0.04, dyad: 0.20 },
  loan: { who: 'other', pub: 0.03, dyad: 0.10 },
  spoken_for: { who: 'actor', pub: 0.10, dyad: 0, thank: true }, // speaking for a house: its standing rises; the speaker is thanked
  haggle_deal: { who: 'other', pub: 0.02, dyad: 0.06 },
  // the court's judgements are about the one judged (`other`); the judge is a system, never a person
  acquitted: { who: 'other', pub: 0.15, dyad: 0 }, arrest: { who: 'other', pub: -0.15, dyad: 0 },
  debt_labour: { who: 'other', pub: -0.10, dyad: 0 }, time_granted: { who: 'other', pub: 0.03, dyad: 0 },
  // D-370: the stranger's deeds (speech/stranger.ts); `other` is the stranger when a house acts on them
  wage_paid: { who: 'other', pub: 0.01, dyad: 0.06 }, wage_owed: { who: 'actor', pub: -0.03, dyad: 0 }, dismissed: { who: 'other', pub: -0.05, dyad: -0.3 },
  hand_hired: { who: 'other', pub: 0.03, dyad: 0.15 }, hosted: { who: 'actor', pub: 0.02, dyad: 0.05 }, guest_repaid: { who: 'actor', pub: 0.05, dyad: 0.25 },
  ingrate: { who: 'actor', pub: -0.15, dyad: -0.45 }, guest_sent_away: { who: 'other', pub: -0.03, dyad: -0.15 }, claim_doubted: { who: 'other', pub: 0, dyad: -0.3 },
  claim_denied: { who: 'other', pub: -0.10, dyad: -0.5 }, learned_tongue: { who: 'actor', pub: 0.03, dyad: 0.12 }, joined_house: { who: 'other', pub: 0.03, dyad: 0.3 },
  ruling_for: { who: 'other', pub: 0.04, dyad: 0 }, ruling_against: { who: 'other', pub: -0.03, dyad: 0 }, halmi_sealed: { who: 'other', pub: 0.06, dyad: 0 },
};
/** what hearing of a deed does to the hearer's own view of the one it is about (hear()) */
const HEARD: Record<string, number> = { ingrate: -0.2, claim_denied: -0.15, claim_doubted: -0.06, guest_repaid: 0.05, theft: -0.25, default: -0.2, repaid: 0.08, acquitted: 0.08, loan: 0.03, debt_labour: -0.05, tax_arrears: -0.04, suit: -0.04 };
const clamp = (x: number, a = -1, b = 1) => Math.max(a, Math.min(b, x));
/** D-378: a record's value is kept on a 1e-4 grid (each bump rounds), so a save writes it as a whole number, losslessly */
const Q = 1e4, q4 = (x: number) => Math.round(x * Q) / Q;
const decay = (r: Rec | undefined, day: number) => !r ? 0 : day > r.d ? r.v * Math.pow(0.5, (day - r.d) / HALF_LIFE) : r.v;

/** the economy as the ledger reads it (structural: Economy satisfies it) */
export interface TrustSource { readonly events: EconEvent[]; readonly hh: Map<string, { q: string; kind: string; kin: string[] }> }

export class TrustLedger {
  readonly personal = new Map<string, Rec>(); readonly dyad = new Map<string, Rec>(); readonly group = new Map<string, Rec>();
  /** the last day a house haggled (the driver's rate limit, saved) */
  readonly cool = new Map<string, number>();
  cursor = 0; readonly counts: Record<string, number> = {};
  constructor(private src: TrustSource) {}

  private bump(m: Map<string, Rec>, k: string, dv: number, day: number) { m.set(k, { v: q4(clamp(decay(m.get(k), day) + dv)), d: day }); }
  /** read the events since the last read (idempotent; called by every reader, so the state is always a function of the
   *  events so far, whoever asks first) */
  sync() {
    const ev = this.src.events;
    for (; this.cursor < ev.length; this.cursor++) { const e = ev[this.cursor]; if (!e?.actor) continue; const D = DEEDS[e.kind]; if (D) this.deed(e, D); }
  }
  private deed(e: EconEvent, D: Deed) {
    const doer = D.who === 'actor' ? e.actor : e.other, other = D.who === 'actor' ? e.other : e.actor;
    if (!doer || SYSTEM_IDS.has(doer)) return; this.counts[e.kind] = (this.counts[e.kind] ?? 0) + 1;
    const day = Math.max(0, e.day), bump = (m: Map<string, Rec>, k: string, dv: number) => this.bump(m, k, dv, day);
    bump(this.personal, doer, D.pub);
    const H = this.src.hh.get(doer);
    if (H) { bump(this.group, 'q:' + H.q, D.pub * 0.25); bump(this.group, 'k:' + H.kind, D.pub * 0.1); for (const k of H.kin) bump(this.group, 'kin:' + k, D.pub * 0.15); }
    if (D.thank && other && !SYSTEM_IDS.has(other)) bump(this.personal, other, 0.03);
    if (other && D.dyad && !SYSTEM_IDS.has(other)) bump(this.dyad, `${other}>${doer}`, D.dyad);
  }
  /** news heard: `hearer` (a household) heard of a deed of kind `what` by `about`; its own view of them moves (the living world's tell()) */
  hear(hearer: string, about: string, what: string, day: number) {
    this.sync(); const v = HEARD[what]; if (!v || hearer === about || SYSTEM_IDS.has(about)) return;
    this.bump(this.dyad, `${hearer}>${about}`, v, day); this.counts['heard'] = (this.counts['heard'] ?? 0) + 1;
  }
  /** a mark made directly (a haggle that failed leaves no economy event but does leave a mark on both sides) */
  note(a: string, b: string, dv: number, day: number) { this.sync(); this.bump(this.dyad, `${a}>${b}`, dv, day); this.bump(this.dyad, `${b}>${a}`, dv, day); }

  standing(id: string, day: number): number { this.sync(); return decay(this.personal.get(id), day); }
  groupOf(id: string, day: number): number {
    this.sync(); const H = this.src.hh.get(id); if (!H) return 0;
    return 0.6 * decay(this.group.get('q:' + H.q), day) + 0.25 * decay(this.group.get('k:' + H.kind), day) + 0.15 * decay(this.group.get('kin:' + id), day);
  }
  /** a's trust in b, 0..1 (0.5: no record) */
  trustOf(a: string, b: string, day: number): number {
    this.sync(); const A = this.src.hh.get(a), B = this.src.hh.get(b);
    const kin = !!A && !!B && (A.kin.includes(b) || B.kin.includes(a)), near = kin || (!!A && !!B && A.q === B.q);
    const x = (near ? 1 : 0.5) * decay(this.personal.get(b), day) * 0.9 + 0.25 * this.groupOf(b, day) + 0.9 * decay(this.dyad.get(`${a}>${b}`), day) + (kin ? 0.08 : 0);
    return clamp(0.5 + 0.5 * clamp(x), 0, 1);
  }
  /** a lender's view of a would-be borrower */
  credit(lender: string, borrower: string, day: number) { return this.trustOf(lender, borrower, day); }
  /** whether `a` will help `b` (kin and neighbours deciding) */
  willHelp(a: string, b: string, day: number, min = 0.3) { return this.trustOf(a, b, day) >= min; }
  /** whether a household will give the stranger (the player) the time of day: the living layer's gate for who talks to them */
  willTalk(hh: string, stranger: string, day: number) { return this.trustOf(hh, stranger, day) >= 0.3; }
  /** the per-household summary for the dev overlay */
  summary(id: string, day: number) { return { standing: +this.standing(id, day).toFixed(3), group: +this.groupOf(id, day).toFixed(3) }; }

  // ---- save (lossless: a loaded ledger replays the same) ----
  /** D-378 (B400): the records as varint columns, each deflated (savepack.ts). A key is a prefix (from a string table) and a
   *  household number ('h:N'), or a whole string; a dyad is two such keys; values (on the 1e-4 grid) as integers, days as
   *  integers. A ledger with a record off the grid (one restored from an older save) is written in the older, plain form. */
  snapshot() { this.sync(); return this.packed() ?? this.plain(); }
  private plain() {
    const r = (m: Map<string, Rec>) => [...m].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, x]) => [k, x.v, x.d]);
    return { cursor: this.cursor, personal: r(this.personal), dyad: r(this.dyad), group: r(this.group), cool: [...this.cool], counts: { ...this.counts } };
  }
  private packed() {
    const ok = (x: Rec) => Number.isInteger(x.d) && x.d >= 0 && Math.abs(x.v) <= 1 && q4(x.v) === x.v;
    for (const m of [this.personal, this.dyad, this.group]) for (const x of m.values()) if (!ok(x)) return null;
    for (const d of this.cool.values()) if (!Number.isInteger(d) || d < 0) return null;
    for (const k of this.dyad.keys()) if (!k.includes('>')) return null;
    const strs: string[] = [], si = new Map<string, number>(), str = (x: string) => { let i = si.get(x); if (i === undefined) { i = strs.length; strs.push(x); si.set(x, i); } return i; };
    const split = (k: string): [number, number] => { const m = /^(.*?)h:(0|[1-9]\d{0,14})$/.exec(k); return m ? [str(m[1]), +m[2] + 1] : [str(k), 0]; };
    const C = new Cols();
    // a map of single keys, sorted by [prefix, number], the number delta-coded within a prefix (columns base .. base+3)
    const one = (base: number, l: [string, number, number][]) => {
      const r = l.map(([k, v, d]) => [...split(k), v, d]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      C.u(0, r.length); let pp = -1, pn = 0;
      for (const [p, n, v, d] of r) { C.u(base, p); if (p !== pp) { pn = 0; pp = p; } C.s(base + 1, n - pn); pn = n; C.s(base + 2, v); C.u(base + 3, d); }
    };
    const recs = (m: Map<string, Rec>) => [...m].map(([k, x]): [string, number, number] => [k, Math.round(x.v * Q), x.d]);
    one(1, recs(this.personal)); one(5, recs(this.group)); one(9, [...this.cool].map(([k, d]): [string, number, number] => [k, 0, d]));
    // dyads 'a>b', sorted by a then b: a's number delta-coded, b's delta-coded within one a
    const dy = [...this.dyad].map(([k, x]) => { const i = k.indexOf('>'); return [...split(k.slice(0, i)), ...split(k.slice(i + 1)), Math.round(x.v * Q), x.d]; })
      .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
    C.u(0, dy.length); let pa = 0, pb = 0, pp = -1;
    for (const [ap, an, bp, bn, v, d] of dy) {
      C.u(13, ap); C.s(14, an - pa); const same = an === pa && ap === pp; pa = an; pp = ap;
      C.u(15, bp); C.s(16, same ? bn - pb : bn); pb = bn; C.s(17, v); C.u(18, d);
    }
    return { v: 2, cursor: this.cursor, counts: { ...this.counts }, strs, z: C.pack() };
  }
  /** a snapshot back into a ledger: the packed form (D-378) or the older plain one */
  static restore(s: any, src: TrustSource): TrustLedger {
    const L = new TrustLedger(src); L.cursor = s.cursor; Object.assign(L.counts, s.counts);
    if (s.v === 2) {
      const R = new ColsReader(s.z), key = (p: number, n: number) => s.strs[p] + (n ? 'h:' + (n - 1) : '');
      const one = (base: number, set: (k: string, v: number, d: number) => void) => {
        const len = R.u(0); let pp = -1, pn = 0;
        for (let i = 0; i < len; i++) { const p = R.u(base); if (p !== pp) { pn = 0; pp = p; } pn += R.s(base + 1); set(key(p, pn), R.s(base + 2) / Q, R.u(base + 3)); }
      };
      one(1, (k, v, d) => L.personal.set(k, { v, d })); one(5, (k, v, d) => L.group.set(k, { v, d })); one(9, (k, _v, d) => L.cool.set(k, d));
      const len = R.u(0); let pa = 0, pb = 0, pp = -1;
      for (let i = 0; i < len; i++) {
        const ap = R.u(13), an = pa + R.s(14), same = an === pa && ap === pp; pa = an; pp = ap;
        const bp = R.u(15), bn = (same ? pb : 0) + R.s(16); pb = bn;
        L.dyad.set(key(ap, an) + '>' + key(bp, bn), { v: R.s(17) / Q, d: R.u(18) });
      }
      return L;
    }
    for (const [m, l] of [[L.personal, s.personal], [L.dyad, s.dyad], [L.group, s.group]] as const) for (const [k, v, d] of l) m.set(k, { v, d });
    for (const [k, d] of s.cool) L.cool.set(k, d);
    return L;
  }
}
