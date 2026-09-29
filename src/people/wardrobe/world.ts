// D-345 (ROADMAP 3d): wardrobes and the daily change of clothes (node side).
//
// Each household owns garments (garments.ts): a few for the poor, many for the rich, each with an owner (or the house's, a
// shared cloak or face wrap), a quality, a dye, dirt and wear. Each day at rising each member chooses from what they own, by
// the day plan (Population.plan): the best clothes for a festival or a wedding, the plainest and unchanged in mourning
// (B: Herodotus on Persian mourning; C in detail), otherwise the cleanest work garment. At night they sleep in the shift;
// people undress only in the ordinary course (to sleep; to wash clothes they keep their other garment on). The plans' own
// wear words are kept: "dressed against the cold" adds a cloak (the Median kandys where owned), "the face wrapped against the
// dust" adds the wrap. Dirt builds by the hour with the day's activities (garments.ts rates) and goes when the garment is
// washed: the plans' existing laundering trips ("washing the household's clothes at the water", "washing his clothes at the
// river") wash every garment of the household (or his own) that nobody wears that day. Wear builds per day worn and per wash.
//
// PURE: a household's state on day d is stepped from a fixed anchor (the start of the 14-day window before d's), with seeded
// dirt and wear at the anchor, so any day's answer is the same whatever was asked first; replay needs no save except the
// ledger (make / buy / mend / hand down: the interface the economy will call), which save() / load() carry.
//
// FOR THE GPU PASS (outfitAt): per person per hour, { state: 'dressed' | 'sleeping', set: 'work' | 'best' | 'mourning' |
// 'sleep', garments: [{ id, kind, slot, dye, quality, dirt 0..1, wear 0..1, tier }] }. slot tells the renderer which piece
// of the dress it is (body, legs, over, head, sleep); dye is a looks.ts DYES key; dirt maps to looks.ts Wear.soil and wear to
// Wear.fade (and fraying/fit at > 0.7). Swap the dress pieces when the ids change (at rising, at sleep, when a cloak or wrap
// is put on or off); the set 'sleep' is the shift only.
import type { Population, Seg } from '../population';
import { h32, u01, salt } from '../hash';
import { GARMENTS, BODY_COUNT, DYE_BY_WEALTH, DIRT_HEAVY, DIRT_MEDIUM, DIRT_LIGHT, DIRT_SLEEP, DIRT_DUST, WEAR_DAY, WEAR_WASH, HEAVY, MEDIUM,
  type GarmentKind, type Quality, type Slot, type Wealth } from './garments';

const S = salt('wardrobe');
const WINDOW = 14;
/** how much dirtier yesterday's garment must be than the cleanest other before it is changed (C) */
const CHANGE_AT = 0.06;
const LAUNDRY_HOUSE = /washing (the household’s clothes|clothes) at the water/, LAUNDRY_OWN = /washing his clothes/;
export interface Garment { id: string; hh: number; owner: number; kind: GarmentKind; slot: Slot; quality: Quality; dye: string; from: number; to: number }
export interface GarmentState { id: string; kind: GarmentKind; slot: Slot; dye: string; quality: Quality; dirt: number; wear: number; tier: 'A' | 'B' | 'C' }
export type SetKind = 'work' | 'best' | 'mourning' | 'sleep';
export interface OutfitAt { pid: number; day: number; hour: number; state: 'dressed' | 'sleeping'; set: SetKind; garments: GarmentState[] }
/** the economy's hand on the wardrobe (to be called by src/people/economy later): each call is a dated ledger event */
export type LedgerEvent =
  | { kind: 'make' | 'buy'; day: number; hh: number; owner: number; garment: GarmentKind; quality: Quality; dye?: string }
  | { kind: 'mend'; day: number; id: string }
  | { kind: 'handdown'; day: number; id: string; to: number }
  | { kind: 'discard'; day: number; id: string };
type St = Map<string, { dirt: number; wear: number }>;
interface DayRec { start: St; end: St; sets: Map<number, { set: SetKind; ids: string[] }> }

export class Wardrobes {
  private base = new Map<number, Garment[]>();
  private days = new Map<string, DayRec>();
  readonly ledger: LedgerEvent[] = [];
  constructor(readonly pop: Population, readonly seed: number, private plan: (pid: number, day: number) => Seg[]) {}

  // ---------------------------------------------------------------- the economy's interface
  make(hh: number, owner: number, garment: GarmentKind, quality: Quality, day: number, dye?: string) { this.add({ kind: 'make', day, hh, owner, garment, quality, dye }); }
  buy(hh: number, owner: number, garment: GarmentKind, quality: Quality, day: number, dye?: string) { this.add({ kind: 'buy', day, hh, owner, garment, quality, dye }); }
  mend(id: string, day: number) { this.add({ kind: 'mend', day, id }); }
  handDown(id: string, to: number, day: number) { this.add({ kind: 'handdown', day, id, to }); }
  discard(id: string, day: number) { this.add({ kind: 'discard', day, id }); }
  private add(e: LedgerEvent) { this.ledger.push(e); this.days.clear(); }
  save() { return { ledger: this.ledger.map(e => ({ ...e })) }; }
  load(s: { ledger?: LedgerEvent[] } | undefined) { this.ledger.length = 0; for (const e of s?.ledger ?? []) this.ledger.push({ ...e }); this.days.clear(); }

  // ---------------------------------------------------------------- the garments
  wealth(hh: number): Wealth {
    const H = this.pop.households[hh]; const jobs = H.members.map(m => this.pop.persons[m].job as string);
    if (jobs.some(j => j === 'official' || j === 'steward')) return 'rich';
    if (H.persian || jobs.some(j => ['craftsman', 'scribe', 'treasury', 'storekeeper', 'messenger', 'gardener', 'priest', 'weaver', 'brewer'].includes(j))) return 'middle';
    return 'poor';
  }
  /** the dress a person wears (mirrors popview.ts dressOf, kept here to keep the renderer's modules out of node) */
  private dress(pid: number): 'child' | 'woman' | 'persian' | 'median' | 'worker' {
    const p = this.pop.persons[pid]; if (p.age < 12) return 'child'; if (p.sex === 'f') return 'woman';
    const j = p.job as string; if (j === 'official' || j === 'steward') return 'persian';
    if (j === 'guard' ? !p.persian : ['priest', 'scribe', 'messenger', 'traveller'].includes(j) || (j === 'treasury' && p.age >= 20)) return 'median';
    return 'worker';
  }
  private makeFor(hh: number, pid: number, from: number, out: Garment[]) {
    const w = this.wealth(hh), dyes = DYE_BY_WEALTH[w], n = BODY_COUNT[w], dr = this.dress(pid);
    const q = (i: number): Quality => i === 0 ? (w === 'rich' ? 'fine' : w === 'middle' ? 'good' : 'plain') : w === 'poor' ? 'coarse' : 'plain';
    const g = (kind: GarmentKind, i: number, owner = pid) => out.push({ id: `${hh}:${owner}:${kind}:${i}`, hh, owner, kind, slot: GARMENTS[kind].slot, quality: q(i), dye: dyes[h32(this.seed, S, pid, i, kind.length) % dyes.length], from, to: 1e9 });
    const body: GarmentKind = dr === 'child' ? 'child_tunic' : dr === 'woman' ? 'dress' : dr === 'persian' ? 'robe' : 'tunic';
    for (let i = 0; i < (dr === 'child' ? Math.max(2, n - 1) : n); i++) g(i === n - 1 && dr === 'persian' ? 'tunic' : body, i);
    g('shift', 0);
    if (dr === 'woman') { g('mantle', 0); if (w !== 'poor') g('mantle', 1); }
    if (dr === 'median') { g('trousers', 0); g('trousers', 1); g('cap', 0); if (w !== 'poor') g('kandys', 0); }
    if (dr === 'persian' || (w === 'rich' && dr !== 'child')) g('cloak', 0);
  }
  /** the household's garments on a day (the seeded base, the members who came later, and the ledger) */
  garments(hh: number, day: number): Garment[] {
    let b = this.base.get(hh);
    if (!b) { b = []; const H = this.pop.households[hh]; for (const m of new Set([...H.members, ...H.joins])) this.makeFor(hh, m, -1e9, b);
      // the house's shared cloaks and face wraps (one per two members; C)
      const k = Math.max(1, Math.ceil(H.members.length / 2)); for (let i = 0; i < k; i++) { b.push({ id: `${hh}:-1:cloak:${i}`, hh, owner: -1, kind: 'cloak', slot: 'over', quality: 'coarse', dye: 'wool', from: -1e9, to: 1e9 }); b.push({ id: `${hh}:-1:wrap:${i}`, hh, owner: -1, kind: 'wrap', slot: 'head', quality: 'coarse', dye: 'linen', from: -1e9, to: 1e9 }); }
      this.base.set(hh, b); }
    let out = b.filter(x => x.from <= day && x.to > day);
    for (const e of this.ledger) {
      if (e.day > day) continue;
      if ((e.kind === 'make' || e.kind === 'buy') && e.hh === hh) out.push({ id: `${hh}:${e.owner}:${e.garment}:L${this.ledger.indexOf(e)}`, hh, owner: e.owner, kind: e.garment, slot: GARMENTS[e.garment].slot, quality: e.quality, dye: e.dye ?? 'wool', from: e.day, to: 1e9 });
      else if (e.kind === 'handdown') out = out.map(x => x.id === e.id ? { ...x, owner: e.to } : x);
      else if (e.kind === 'discard') out = out.filter(x => x.id !== e.id);
    }
    // people who came to the house later than the year's start (births, marriages, fostering) own clothes of their own too
    for (const m of this.pop.membersOn(hh, day)) if (!out.some(g => g.owner === m && g.slot === 'body')) this.makeFor(hh, m, -1e9, out);
    return out;
  }

  // ---------------------------------------------------------------- the days
  private seedState(hh: number, day: number, gs: Garment[]): St {
    const st: St = new Map(); for (const g of gs) { const k = h32(this.seed, S, hh, day, g.id.length + g.id.charCodeAt(g.id.length - 1)); st.set(g.id, { dirt: 0.1 * u01(this.seed, S, k, 1), wear: g.from > -1e9 ? 0 : 0.1 + 0.5 * u01(this.seed, S, k, 2) }); } return st;
  }
  private dayRec(hh: number, day: number): DayRec {
    const key = `${hh}:${day}`; const c = this.days.get(key); if (c) return c;
    const anchor = Math.max(0, Math.floor(day / WINDOW) * WINDOW - WINDOW);
    let st: St | null = null;
    for (let d = anchor; d <= day; d++) {
      const k = `${hh}:${d}`; const have = this.days.get(k); if (have) { st = have.end; continue; }
      const gs = this.garments(hh, d); const start: St = new Map(st ?? this.seedState(hh, d, gs));
      for (const g of gs) if (!start.has(g.id)) start.set(g.id, { dirt: 0, wear: 0 });
      for (const e of this.ledger) if (e.kind === 'mend' && e.day === d && start.has(e.id)) start.get(e.id)!.wear = Math.max(0.05, start.get(e.id)!.wear - 0.3);
      const rec = this.step(hh, d, gs, start); if (this.days.size > 20000) this.days.clear(); this.days.set(k, rec); st = rec.end;
    }
    return this.days.get(key)!;
  }
  private occasion(pid: number, d: number): SetKind { const P = this.pop; if (P.weddingOf(pid, d) || P.festDay(pid, d)) return 'best'; if (P.mourning(pid, d)) return 'mourning'; return 'work'; }
  private streak(hh: number, pid: number, id: string, d: number) { let n = 0; for (let x = d - 1; x >= d - 7; x--) { const s = this.days.get(`${hh}:${x}`)?.sets.get(pid); if (!s || !s.ids.includes(id)) break; n++; } return n; }
  private choose(hh: number, pid: number, d: number, gs: Garment[], st: St, prev: string[] | null): { set: SetKind; ids: string[] } {
    const set = this.occasion(pid, d); const own = gs.filter(g => g.owner === pid); const ids: string[] = [];
    for (const slot of ['body', 'legs', 'head'] as Slot[]) {
      const c = own.filter(g => g.slot === slot && g.kind !== 'wrap'); if (!c.length) continue;
      const rank = (g: Garment) => ['coarse', 'plain', 'good', 'fine'].indexOf(g.quality);
      let pick: Garment;
      if (set === 'best') pick = [...c].sort((a, b) => rank(b) - rank(a) || (st.get(a.id)!.dirt - st.get(b.id)!.dirt))[0];
      else if (set === 'mourning' && prev && c.some(g => prev.includes(g.id))) pick = c.find(g => prev.includes(g.id)) ?? c[0]; // (in mourning the garment is not changed)
      else { // work: every garment but the one best kept back (only when there are three or more); yesterday's is kept on until
        // it is clearly dirtier than the cleanest other (C: a change every few days, sooner after dirty work)
        const top = Math.max(...c.map(rank)); const work = c.length >= 3 ? c.filter(g => !(rank(g) === top && c.filter(x => rank(x) === top)[0] === g)) : c;
        const byDirt = [...work].sort((a, b) => st.get(a.id)!.dirt - st.get(b.id)!.dirt || (a.id < b.id ? -1 : 1)); const y = prev ? work.find(g => prev.includes(g.id)) : undefined;
        // and changed after a few days in any case, to air it (C: 3-5 days, the person's own habit)
        const tired = y ? this.streak(hh, pid, y.id, d) >= 3 + h32(this.seed, S, pid, 7) % 3 : false;
        pick = y && !tired && st.get(y.id)!.dirt <= st.get(byDirt[0].id)!.dirt + CHANGE_AT ? y : y && tired ? (byDirt.find(g => g !== y) ?? y) : byDirt[0]; }
      ids.push(pick.id);
    }
    return { set, ids };
  }
  private step(hh: number, d: number, gs: Garment[], start: St): DayRec {
    const P = this.pop; const end: St = new Map([...start].map(([k, v]) => [k, { ...v }])); const sets = new Map<number, { set: SetKind; ids: string[] }>();
    const prevRec = this.days.get(`${hh}:${d - 1}`);
    const members = P.membersOn(hh, d).filter(m => P.present(m, d));
    const dayIds = new Set<string>(); let laundryHouse = false; const laundryOwn: number[] = [];
    for (const m of members) {
      const ch = this.choose(hh, m, d, gs, start, prevRec?.sets.get(m)?.ids ?? null); sets.set(m, ch); for (const id of ch.ids) dayIds.add(id);
      for (const s of this.plan(m, d)) {
        if (LAUNDRY_HOUSE.test(s.why)) laundryHouse = true; if (LAUNDRY_OWN.test(s.why)) laundryOwn.push(m);
        const worn = this.worn(m, s, gs, ch, dayIds); const h = s.t1 - s.t0;
        const r = s.act === 'sleep' ? DIRT_SLEEP : HEAVY.has(s.act) ? DIRT_HEAVY : MEDIUM.has(s.act) ? DIRT_MEDIUM : DIRT_LIGHT;
        for (const id of worn) { const x = end.get(id); if (x) x.dirt = Math.min(1, x.dirt + h * (r + (/dust/.test(s.wear ?? '') ? DIRT_DUST : 0))); }
      }
      for (const id of ch.ids) { const x = end.get(id); if (x) x.wear = Math.min(1, x.wear + WEAR_DAY); }
    }
    // the laundering trip: what nobody wears today is washed (the house's, or his own)
    for (const g of gs) { if (dayIds.has(g.id)) continue; if (laundryHouse || laundryOwn.includes(g.owner)) { const x = end.get(g.id)!; x.dirt = 0; x.wear = Math.min(1, x.wear + WEAR_WASH); } }
    return { start, end, sets };
  }
  /** the garments worn during one stretch of the plan */
  private worn(pid: number, s: Seg, gs: Garment[], ch: { ids: string[] }, taken: Set<string>): string[] {
    if (s.act === 'sleep') { const sh = gs.find(g => g.owner === pid && g.kind === 'shift'); return sh ? [sh.id] : []; }
    const ids = [...ch.ids];
    if (/cold/.test(s.wear ?? '')) { const own = gs.find(g => g.owner === pid && g.slot === 'over') ?? gs.find(g => g.owner === -1 && g.kind === 'cloak' && !taken.has(`${g.id}@${pid}`) && ![...taken].some(t => t.startsWith(g.id + '@') && t !== `${g.id}@${pid}`)); if (own) { ids.push(own.id); taken.add(`${own.id}@${pid}`); } }
    if (/dust/.test(s.wear ?? '')) { const wr = gs.find(g => g.owner === -1 && g.kind === 'wrap' && ![...taken].some(t => t.startsWith(g.id + '@') && t !== `${g.id}@${pid}`)); if (wr) { ids.push(wr.id); taken.add(`${wr.id}@${pid}`); } }
    return ids;
  }

  // ---------------------------------------------------------------- the output
  /** what a person wears at an hour of a day, with each garment's dirt and wear at that hour (see the header) */
  outfitAt(pid: number, day: number, hour: number): OutfitAt {
    const P = this.pop, hh = P.home(pid, day); const rec = this.dayRec(hh, day); const gs = this.garments(hh, day);
    const ch = rec.sets.get(pid) ?? { set: 'work' as SetKind, ids: [] };
    const st: St = new Map([...rec.start].map(([k, v]) => [k, { ...v }]));
    let cur: Seg | null = null; const taken = new Set<string>();
    for (const s of this.plan(pid, day)) {
      if (s.t0 > hour) break; const worn = this.worn(pid, s, gs, ch, taken); const h = Math.min(hour, s.t1) - s.t0;
      const r = s.act === 'sleep' ? DIRT_SLEEP : HEAVY.has(s.act) ? DIRT_HEAVY : MEDIUM.has(s.act) ? DIRT_MEDIUM : DIRT_LIGHT;
      for (const id of worn) { const x = st.get(id); if (x) x.dirt = Math.min(1, x.dirt + h * (r + (/dust/.test(s.wear ?? '') ? DIRT_DUST : 0))); }
      if (hour < s.t1) cur = s;
    }
    cur ??= this.plan(pid, day).at(-1)!;
    const ids = this.worn(pid, cur, gs, ch, new Set());
    const byId = new Map(gs.map(g => [g.id, g]));
    const garments = ids.map(id => { const g = byId.get(id)!; const x = st.get(id) ?? { dirt: 0, wear: 0 }; return { id, kind: g.kind, slot: g.slot, dye: g.dye, quality: g.quality, dirt: +x.dirt.toFixed(3), wear: +x.wear.toFixed(3), tier: GARMENTS[g.kind].tier }; });
    return { pid, day, hour, state: cur.act === 'sleep' ? 'sleeping' : 'dressed', set: cur.act === 'sleep' ? 'sleep' : ch.set, garments };
  }
  /** a garment's dirt and wear at the end of a day (for tests and the overlay) */
  stateAtEnd(hh: number, day: number, id: string) { return this.dayRec(hh, day).end.get(id); }
  /** the day's chosen set of a person (their garments at rising) */
  daySet(pid: number, day: number) { return this.dayRec(this.pop.home(pid, day), day).sets.get(pid); }
}
