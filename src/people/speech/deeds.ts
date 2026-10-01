// s14 simtalk (D-358; UD-21, UD-25, UD-26; T-E10, T-F9; B234, B235): what the stranger says can ENTER the world's economy.
// converse/intent.ts econAskOf reads the stranger's offer or ask (buy, sell, haggle, give, lend, speak for a house before the
// judge, be a guest, ask for help, offer work); here the SIMULATION decides it from the house's own state, and a "yes" is
// entered into the Economy as intents with the player ('player') as a party, so it changes stores, silver and debts, is read
// by the trust ledger, told along the rumour net, and joins the causal chains (economy/chains.ts, T-F9):
//   - a deal (buy, sell, haggle) is speech/haggle.ts's haggle(): the price from the market, the house's floor from its need
//     of silver and its trust in the stranger; an offer below the floor is refused with the house's counter-price;
//   - a gift, a loan, the stranger's work for the house and a word before the judge are the economy's own intents (help,
//     loan, work, petition), naming as their cause the economy event behind the want they answer (the house's cause.food /
//     fuel / cash / help, or the suit, arrears or accusation before the court);
//   - hospitality and help given to the stranger come out of the house's own stores (its barley falls) and are recorded as
//     economy events of their own ('hosted_stranger', 'helped_stranger'), caused by the stranger's earlier deeds with that
//     house when there are any (a gift returned as a meal), else by nothing: then they enter no chain, and the measure says so.
// Refusals are the house's own: no spare, no need, too little barley for itself, mourning, no matter before the judge, too
// little trust (willTalk, B234). The stranger's purse (silver and barley; C: a traveller with a few sheqel) is this module's,
// saved with the sim (PeopleSim.save 'deals'). Tier C throughout: the sizes and thresholds are reasoned, not attested.
import type { Population } from '../population';
import type { Economy } from '../economy/world';
import type { Intent } from '../economy/api';
import type { AsksWorld } from '../asks/world';
import type { EconAsk, EconDeed } from '../converse/intent';
import { haggle, type HaggleGood } from './haggle';
import { PLAYER_ID, silverWords, barWords, countWords } from './grounds';

const GRAIN_EAT = 0.55, QA = 0.55;
/** the stranger's purse at the start (C: a traveller on the king's road carries a few sheqel of silver and a little barley) */
export const PURSE0 = { silver: 4, grain: 5.5, goods: 1, fuel: 0 };
export type Purse = typeof PURSE0;
export interface DeedOut {
  kind: EconDeed; ok: boolean; reason: string; hh: string;
  /** the economy events the deed made, and the event it names as its cause (-1: none); all the causes it names */ events: number[]; cause: number; causeKind: 'need' | 'matter' | 'player' | 'none'; causes?: number[];
  intents: Intent[]; changes: string[]; price?: number; counter?: number; qty?: number;
  /** what happened, in the person's brief (out of world) */ words: string;
}
export interface DealRow { t: number; pid: number; hh: string; kind: EconDeed; ok: boolean; reason: string; events: number[]; cause: number; purse: Purse }
/** a lot of barley in the stranger's purse and the economy event it came by (a bargain, barley given for the road): what he
 *  gives on names where it came from (session 15: the provenance is a link of the chain, "bought of one house, given to another") */
export interface Lot { kg: number; ev: number }

/** the stranger's purse and the record of his dealings (saved with the sim) */
export class PlayerDeals {
  purse: Purse = { ...PURSE0 }; readonly rows: DealRow[] = []; lots: Lot[] = [];
  save() { return this.rows.length ? { purse: { ...this.purse }, rows: this.rows.map(r => ({ ...r, events: [...r.events], purse: { ...r.purse } })), ...(this.lots.length ? { lots: this.lots.map(l => ({ ...l })) } : {}) } : undefined; }
  load(s?: { purse: Purse; rows: DealRow[]; lots?: Lot[] }) { this.purse = { ...(s?.purse ?? PURSE0) }; this.rows.length = 0; for (const r of s?.rows ?? []) this.rows.push({ ...r, events: [...r.events], purse: { ...r.purse } }); this.lots = (s?.lots ?? []).map(l => ({ ...l })); }
  /** the lots that `kg` of barley given now comes out of (oldest first; the purse's first barley has no event) */
  peek(kg: number): Lot[] { const out: Lot[] = []; let left = kg; for (const l of this.lots) { if (left <= 1e-9) break; const k = Math.min(l.kg, left); out.push({ kg: k, ev: l.ev }); left -= k; } return out; }
  take(kg: number) { let left = kg; while (left > 1e-9 && this.lots.length) { const l = this.lots[0], k = Math.min(l.kg, left); l.kg -= k; left -= k; if (l.kg <= 1e-9) this.lots.shift(); } }
}
const deals = new WeakMap<object, PlayerDeals>();
/** the deals of a sim (or any owner object) */
export function dealsOf(owner: object): PlayerDeals { let d = deals.get(owner); if (!d) { d = new PlayerDeals(); deals.set(owner, d); } return d; }

export interface DeedWorld { pop: Population; econ: Economy; asks: AsksWorld | null }
const hhOf = (pop: Population, pid: number, day: number) => `h:${pop.home(pid, day)}`;
/** every live event behind a want of the house (session 15; was: the one cause.<kind>): for silver, also the debts that press
 *  it (each debt's own event: the loan, the arrears; Economy.needsOf counts them in the want); a bargain struck before is
 *  not a fresh cause (haggle.ts's rule: no deal-after-deal chains) */
function wantCauses(E: Economy, hh: string, kinds: ('food' | 'fuel' | 'cash' | 'help' | 'health')[]): number[] {
  const h = E.hh.get(hh)!, out: number[] = []; const add = (c: number | undefined) => { if (c !== undefined && c >= 0 && E.events[c] && E.events[c].kind !== 'haggle_deal' && !out.includes(c)) out.push(c); };
  for (const k of kinds) { add(h.cause[k]); if (k === 'cash') for (const d of [...h.debts].filter(d => d.amt > 0.004).sort((a, b) => a.due - b.due).slice(0, 3)) add(d.ev); }
  return out;
}
/** what the barley (or fuel) a house sells came by: the event behind its stock when that is an inflow (kin's or neighbours'
 *  gift, relief, work paid in barley, a good harvest), so a sale names where the goods came from as well as why silver is
 *  wanted */
const INFLOW = new Set(['given', 'kin_help', 'neighbours_help', 'relief', 'hired_by_neighbour', 'hired_by_stranger', 'wage_work', 'grain_brought', 'harvest_good']);
function stockCause(E: Economy, hh: string, good: HaggleGood): number {
  if (good !== 'grain' && good !== 'fuel') return -1; const c = E.hh.get(hh)!.cause[good === 'fuel' ? 'fuel' : 'food']; return c !== undefined && E.events[c] && INFLOW.has(E.events[c].kind) ? c : -1;
}
/** the matter before the judge: an open ask for time, an advocate or justice (asks.ts: the suit, arrears or theft behind it),
 *  the house's default still remembered by the lenders, else its latest suit, arrears, accusation, arrest or default of the
 *  last 120 days among the events the economy keeps whole */
function matterOf(E: Economy, hh: string, day: number, asks: AsksWorld | null): number {
  for (const a of asks?.on ? asks.openAsksOf(hh) : []) if ((a.kind === 'time' || a.kind === 'petition' || a.kind === 'justice') && a.why.ev !== undefined && E.events[a.why.ev]) return a.why.ev;
  const h = E.hh.get(hh)!; if (h.badEv >= 0 && h.badUntil > day && E.events[h.badEv]) return h.badEv;
  for (let i = E.events.length - 1; i >= 0; i--) { const e = E.events[i]; if (!e?.actor) continue; if (e.day < day - 120) break;
    if ((e.kind === 'suit' || e.kind === 'accusation' || e.kind === 'pledge_seized') && e.other === hh) return e.id;
    if ((e.kind === 'tax_arrears' || e.kind === 'levy_arrears' || e.kind === 'default' || e.kind === 'theft') && e.actor === hh) return e.id;
    if ((e.kind === 'arrest' || e.kind === 'debt_labour') && e.other === hh) return e.id; }
  return -1;
}
/** the stranger's latest deed with this house (a gift, a loan, a deal), for what the house does in return */
function playerCause(E: Economy, hh: string, day: number): number {
  for (let i = E.events.length - 1; i >= 0; i--) { const e = E.events[i]; if (!e?.actor) continue; if (e.day < day - 60) break; if (e.actor === hh && e.other === PLAYER_ID) return e.id; }
  return -1;
}
const spare = (h: { grain: number; eaters: number }) => Math.max(0, h.grain - h.eaters * GRAIN_EAT * 30);
const need = (E: Economy, hh: string, k: string) => E.needsOf(hh).find(n => n.kind === k)?.urgency ?? 0;

/** whether and how the house of person `pid` does what the stranger's words offer or ask, on `day` (pure: nothing changes;
 *  act() commits it). The economy must have been stepped to `day` (PeopleSim.econTo). */
export function considerDeed(W: DeedWorld, D: PlayerDeals, pid: number, day: number, a: EconAsk): DeedOut {
  const E = W.econ, hh = hhOf(W.pop, pid, day), h = E.hh.get(hh);
  const out = (ok: boolean, reason: string, ex: Partial<DeedOut> = {}): DeedOut => ({ kind: a.kind, ok, reason, hh, events: [], cause: -1, causeKind: 'none', intents: [], changes: [], words: reason, ...ex });
  if (!h || h.dead) return out(false, 'has no house of the town or the plain to deal from');
  const trust = E.trust ? E.trust.trustOf(hh, PLAYER_ID, day) : 0.5;
  if (E.trust && !E.trust.willTalk(hh, PLAYER_ID, day)) return out(false, 'does not deal with a stranger the house does not trust');
  const P = D.purse, eat = h.eaters * GRAIN_EAT;
  const cz = (c: number, k: DeedOut['causeKind']) => c >= 0 ? { cause: c, causeKind: k } : { cause: -1, causeKind: 'none' as const };
  const czs = (cs: number[], k: DeedOut['causeKind']) => ({ ...cz(cs[0] ?? -1, k), causes: cs });
  switch (a.kind) {
    case 'buy': case 'haggle': case 'sell': {
      const good = (a.good === 'silver' || a.good === 'labour' || !a.good ? 'grain' : a.good) as HaggleGood, qty = a.qty ?? (good === 'grain' ? 5.5 : 1);
      const sell = a.kind === 'sell'; const buyer = sell ? hh : PLAYER_ID, seller = sell ? PLAYER_ID : hh;
      if (sell && (good === 'grain' ? P.grain : good === 'fuel' ? P.fuel : P.goods) < qty) return out(false, `the stranger has no ${good === 'grain' ? 'barley' : good} to sell`);
      // the cause: the seller house's want of silver (it sells to meet it), the buyer house's want of the good
      // (session 15: and, for a sale, what the house's stock came by; for a purchase, the want of silver includes its debts)
      const cs = sell ? wantCauses(E, hh, [good === 'fuel' ? 'fuel' : 'food']) : [...wantCauses(E, hh, ['cash']), stockCause(E, hh, good)].filter((x, i, a) => x >= 0 && a.indexOf(x) === i);
      const r = haggle(E, { buyer, seller, good, qty, day, apply: false, pay: 'cash', causes: cs, urgency: sell ? undefined : { buyer: 0.3 } });
      if (!r.ok) return out(false, r.why === 'seller has no spare' ? `has no ${good === 'grain' ? 'barley' : good} to spare` : r.why === 'buyer cannot pay' ? 'the house has no silver to pay for it' : r.why === 'no overlap' ? 'the price will not meet' : r.why ?? 'will not deal');
      let price = r.price; const counter = sell ? r.price : r.floor;
      if (a.kind === 'haggle' && a.price !== undefined) {
        if (a.price < r.floor * 0.999) return out(false, `will not go so low: wants ${silverWords(Math.max(r.floor, r.price * 0.95))}`, { counter: +Math.max(r.floor, r.price * 0.95).toFixed(4), qty });
        price = Math.min(a.price, r.ceiling > 0 ? Math.max(a.price, r.floor) : a.price);
      }
      if (!sell && P.silver < price) return out(false, `the stranger has not ${silverWords(price)} to pay`, { counter, qty });
      const ints = r.intents.map(i => ({ ...i, payload: { ...i.payload, price, src: 'player', ...(i.payload.cash !== undefined ? { cash: (i.payload.cash as number) > 0 ? price : -price } : {}) } }));
      const what = good === 'grain' ? `barley (${barWords(qty)})` : `${countWords(qty)} ${good === 'fuel' ? 'loads of fuel' : 'lots of goods'}`;
      return out(true, sell ? `bought ${what} from the stranger for ${silverWords(price)}` : `sold the stranger ${what} for ${silverWords(price)}`, { intents: ints, price, counter, qty, ...czs(cs, 'need') });
    }
    case 'gift': {
      const good = a.good === 'labour' ? 'silver' : a.good ?? 'silver', qty = a.qty ?? 0.5;
      const have = good === 'silver' ? P.silver : good === 'grain' ? P.grain : good === 'fuel' ? P.fuel : P.goods; if (have < qty * 0.999) return out(false, `the stranger has no ${good === 'grain' ? 'barley' : good} to give`);
      const cw = wantCauses(E, hh, [good === 'grain' ? 'food' : good === 'fuel' ? 'fuel' : 'cash']);
      // (barley the stranger bought of another house, or was given for the road, names where it came from)
      const prov = good === 'grain' ? D.peek(qty).map(l => l.ev).filter(e => e >= 0 && E.events[e]) : []; const cs = [...cw, ...prov.filter(e => !cw.includes(e))];
      const payload: Intent['payload'] = { src: 'player', [good === 'silver' ? 'cash' : good]: qty, ...(cs.length ? { causes: cs } : {}) };
      return out(true, `took the stranger's gift of ${good === 'silver' ? silverWords(qty) : good === 'grain' ? 'barley' : good}`, { intents: [{ kind: 'help', from: PLAYER_ID, to: hh, day, payload }], qty, ...czs(cs, cw.length ? 'need' : 'player') });
    }
    case 'lend': {
      const qty = a.qty ?? 1; if (P.silver < qty) return out(false, `the stranger has not ${silverWords(qty)} to lend`);
      if (need(E, hh, 'cash') < 0.3 && !h.debts.some(d => d.amt > 0)) return out(false, 'has no need of a loan');
      const cs = wantCauses(E, hh, ['cash']);
      return out(true, `took a loan of ${silverWords(qty)} from the stranger`, { intents: [{ kind: 'loan', from: PLAYER_ID, to: hh, day, payload: { cash: qty, src: 'player', ...(cs.length ? { causes: cs } : {}) } }], qty, ...czs(cs, 'need') });
    }
    case 'petition': {
      const m = matterOf(E, hh, day, W.asks); if (m < 0) return out(false, 'has no matter before the judge');
      if ((h as { advocate?: number }).advocate !== undefined && (h as { advocate?: number }).advocate! > day) return out(false, 'someone already speaks for the house');
      return out(true, 'the stranger will speak for the house before the judge', { intents: [{ kind: 'petition', from: PLAYER_ID, to: hh, day, payload: { days: 90, src: 'player', causes: [m] } }], ...cz(m, 'matter') });
    }
    case 'host': {
      if (h.mourning > day) return out(false, 'the house is in mourning');
      if (need(E, hh, 'food') >= 0.45) return out(false, 'the house has too little barley for its own');
      if (trust < 0.42) return out(false, 'does not take a stranger into the house');
      const c = playerCause(E, hh, day);
      return out(true, 'gave the stranger a meal at the house', { intents: [{ kind: 'hosted_stranger' as Intent['kind'], from: PLAYER_ID, to: hh, day, payload: { src: 'player', grain: QA * 2, ...(c >= 0 ? { causes: [c] } : {}) } }], qty: QA * 2, ...cz(c, 'player') });
    }
    case 'ask_help': {
      const g = Math.min(spare(h), QA * 4); if (g < QA * 2) return out(false, 'has no barley to spare');
      if (trust < 0.45) return out(false, 'does not give to a stranger it does not know');
      const c = playerCause(E, hh, day);
      return out(true, 'gave the stranger barley for the road', { intents: [{ kind: 'helped_stranger' as Intent['kind'], from: PLAYER_ID, to: hh, day, payload: { src: 'player', grain: g, ...(c >= 0 ? { causes: [c] } : {}) } }], qty: g, ...cz(c, 'player') });
    }
    case 'offer_help': {
      const sick = need(E, hh, 'help'), hungry = need(E, hh, 'food');
      if (sick < 0.3 && hungry < 0.45 && h.kind !== 'farmer') return out(false, 'has no work for a stranger');
      // (the work answers the want of hands and, paid in barley, the want of bread: each want the house has names its cause)
      const cs = wantCauses(E, hh, [...(sick >= 0.3 ? ['help', 'health'] as const : []), ...(hungry >= 0.3 || sick < 0.3 ? ['food'] as const : [])]); const days = Math.min(3, a.qty ?? 2);
      return out(true, `let the stranger work ${countWords(days)} days for the house`, { intents: [{ kind: 'work', from: PLAYER_ID, to: hh, day, payload: { src: 'player', grain: days * GRAIN_EAT * 2, labour: days, ...(cs.length ? { causes: cs } : {}) } }], qty: days, ...czs(cs, 'need') });
    }
  }
  return out(false, 'does not understand what the stranger means');
}

/** commit a deed: the intents entered into the economy (the stores and the trust move at once), the purse moved, the news
 *  injected into the rumour net (when it runs), the row kept for the save */
export function actDeed(W: DeedWorld, D: PlayerDeals, pid: number, t: number, a: EconAsk, pre?: DeedOut): DeedOut {
  const day = Math.floor(t / 24); const d = pre ? { ...pre, events: [], changes: [...pre.changes] } : considerDeed(W, D, pid, day, a); const E = W.econ, P = D.purse;
  if (d.ok) {
    const h = E.hh.get(d.hh)!, n0 = E.events.length;
    for (const i of d.intents) {
      if (i.kind === ('hosted_stranger' as Intent['kind']) || i.kind === ('helped_stranger' as Intent['kind'])) { const g = Number(i.payload.grain ?? 0); h.grain = Math.max(0, h.grain - g); d.changes.push(`${d.hh}.grain-${g.toFixed(2)}`); if (i.kind === ('helped_stranger' as Intent['kind'])) { P.grain += g; D.lots.push({ kg: g, ev: E.events.length }); } }
      E.enter(i); }
    for (let k = n0; k < E.events.length; k++) d.events.push(k);
    switch (a.kind) {
      case 'buy': case 'haggle': P.silver -= d.price!; if (a.good === 'fuel') P.fuel += d.qty!; else if (a.good === 'goods') P.goods += d.qty!; else { P.grain += d.qty!; D.lots.push({ kg: d.qty!, ev: d.events.find(k => E.events[k]?.kind === 'haggle_deal') ?? -1 }); } break;
      case 'sell': P.silver += d.price!; if (a.good === 'fuel') P.fuel -= d.qty!; else if (a.good === 'goods') P.goods -= d.qty!; else P.grain -= d.qty!; break;
      case 'gift': { const g = a.good === 'labour' || !a.good ? 'silver' : a.good; P[g] -= d.qty!; if (g === 'grain') D.take(d.qty!); break; }
      case 'lend': P.silver -= d.qty!; break;
      default: break;
    }
    if (W.asks?.on) W.asks.rumours.inject(day, d.hh, 'player_deed', d.price ?? d.qty ?? 1);
  }
  D.rows.push({ t, pid, hh: d.hh, kind: a.kind, ok: d.ok, reason: d.reason, events: [...d.events], cause: d.cause, purse: { ...P } });
  return d;
}
/** the house's barley given to the stranger through a talk deed (talk.ts give/trade of bread, barley or flour: the person
 *  laid the walk; the house's stores fall here) */
export function talkGift(W: DeedWorld, D: PlayerDeals, pid: number, t: number, item: string | undefined): DeedOut | null {
  if (!item || !/^(bread|barley|flour)$/.test(item)) return null;
  const day = Math.floor(t / 24), E = W.econ, hh = hhOf(W.pop, pid, day), h = E.hh.get(hh); if (!h || h.dead) return null;
  const g = item === 'barley' ? QA * 3 : QA, c = playerCause(E, hh, day), n0 = E.events.length;
  h.grain = Math.max(0, h.grain - g); E.enter({ kind: 'helped_stranger' as Intent['kind'], from: PLAYER_ID, to: hh, day, payload: { src: 'player', grain: g, item, ...(c >= 0 ? { causes: [c] } : {}) } });
  if (item !== 'bread') { D.purse.grain += g; D.lots.push({ kg: g, ev: n0 }); }
  const d: DeedOut = { kind: 'ask_help', ok: true, reason: `gave the stranger ${item}`, hh, events: [...Array(E.events.length - n0).keys()].map(k => n0 + k), cause: c, causeKind: c >= 0 ? 'player' : 'none', intents: [], changes: [`${hh}.grain-${g.toFixed(2)}`], qty: g, words: `gave the stranger ${item}` };
  D.rows.push({ t, pid, hh, kind: 'ask_help', ok: true, reason: d.reason, events: [...d.events], cause: c, purse: { ...D.purse } });
  return d;
}
