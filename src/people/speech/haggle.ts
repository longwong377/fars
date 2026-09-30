// Haggling and barter (s13, UD-25 (4), UD-26; D-351). A structured exchange between two parties (the player, or any two
// households) for goods or labour, resolved by the simulation, never by a model (the talk layer will only PROPOSE a
// HaggleReq later; what comes back is the simulation's answer and its record). The price starts from the economy's own
// (Economy.price; labour at the bound-labour wage), then each side's room is set by
//   the buyer's ceiling  = ref * (1 + 0.35 * urgency_buyer + 0.10 * (trust_buyer_in_seller - 0.5))
//   the seller's floor   = ref * (0.90 - 0.25 * urgency_seller + 0.30 * (0.5 - trust_seller_in_buyer))
// (need pushes both towards a worse deal; a seller who distrusts the buyer wants a premium, one who trusts gives a
// discount; C throughout: reasoned, no Achaemenid price tablet gives a bargaining rule). Between floor and ceiling the
// price falls where the haggler's skill puts it (a fixed per-house skill 0.3..0.8, C, plus a keyed draw of +-0.08, so the
// same seed and day replay the same deal). No overlap, no deal: the failure leaves a small mark on both sides' trust.
// Payment is cash, or barter at the market's value less a tenth (the receiver must sell it on; C). A deal enters the
// economy as TWO intents (kind 'trade', payload.deal) that name the events the buyer's need answers, so the haggle joins
// the causal chains (chains.ts) and the trust ledger reads it as a 'haggle_deal'. haggleRound() is the driver: every day a
// few households short of bread or fuel seek a neighbour or kin with a surplus, trusted sellers first.
import type { Economy } from '../economy/world';
import type { Intent } from '../economy/api';
import { hashString } from '../../core/rng';
import { h32, u01, salt } from '../hash';

export type HaggleGood = 'grain' | 'fuel' | 'goods' | 'labour';
export interface HaggleReq {
  buyer: string; seller: string; good: HaggleGood; qty: number; day: number;
  pay?: 'cash' | 'barter' | 'auto'; barter?: Exclude<HaggleGood, 'labour'>;
  /** urgency 0..1 of each side (default: read from the economy's needs) */
  urgency?: { buyer?: number; seller?: number }; skill?: { buyer?: number; seller?: number };
  /** the economy events the deal answers (default: the buyer's own need cause) */
  causes?: number[]; apply?: boolean;
}
export interface HaggleResult {
  ok: boolean; why?: string; ref: number; price: number; ceiling: number; floor: number;
  rounds: { who: 'buyer' | 'seller'; offer: number }[]; trust: { buyerInSeller: number; sellerInBuyer: number };
  pay?: { kind: 'cash' | 'barter'; good?: string; qty?: number }; intents: Intent[];
}
/** a day's labour, in silver (the bound man's wage of Economy; C) */
export const LABOUR_WAGE = 0.02;
const S = { skill: salt('haggle-skill'), noise: salt('haggle-noise'), pick: salt('haggle-pick') };
const GRAIN_EAT = 0.55;
const idn = (id: string) => /^h:\d+$/.test(id) ? +id.slice(2) : hashString(id) | 0;

export function refPrice(E: Economy, good: HaggleGood, day: number) { return good === 'labour' ? LABOUR_WAGE : E.price(good, day); }
/** a house's haggling skill, 0.3..0.8 (fixed by the seed; the trades that live on dealing are better: C) */
export function skillOf(E: Economy, id: string): number {
  const H = E.hh.get(id); return Math.min(0.9, 0.3 + 0.5 * u01(E.seed, S.skill, idn(id)) + (H?.kind === 'craft' || H?.kind === 'rich' ? 0.1 : 0));
}
/** what of a good a house can spare (grain beyond 30 days' bread, fuel beyond 10, goods all, labour: a healthy worker) */
function spare(E: Economy, id: string, good: HaggleGood, day: number): number {
  const H = E.hh.get(id); if (!H || H.dead) return 0;
  switch (good) {
    case 'grain': return Math.max(0, H.grain - H.eaters * GRAIN_EAT * 30);
    case 'fuel': return Math.max(0, H.fuel - 10); case 'goods': return H.goods;
    case 'labour': return H.workers > 0 && day >= H.sickUntil ? 1 : 0;
  }
}
const urgencyOf = (E: Economy, id: string, kind: 'food' | 'fuel' | 'cash') => E.needsOf(id).find(n => n.kind === kind)?.urgency ?? 0;

/** resolve one haggle. Unknown parties (the player, a stranger) have no stores to check and no household to change: the
 *  household side alone is changed. */
export function haggle(E: Economy, r: HaggleReq): HaggleResult {
  const day = r.day, B = E.hh.get(r.buyer), Sl = E.hh.get(r.seller), T = E.trust;
  const tS = T ? T.trustOf(r.seller, r.buyer, day) : 0.5, tB = T ? T.trustOf(r.buyer, r.seller, day) : 0.5;
  const ref = refPrice(E, r.good, day), p0 = ref * r.qty;
  const fail = (why: string, ex: Partial<HaggleResult> = {}): HaggleResult => {
    if (T && why === 'no overlap') T.note(r.buyer, r.seller, -0.02, day);
    return { ok: false, why, ref, price: 0, ceiling: 0, floor: 0, rounds: [], trust: { buyerInSeller: tS, sellerInBuyer: tB }, intents: [], ...ex };
  };
  if (r.qty <= 0 || r.buyer === r.seller) return fail('bad request');
  if (Sl && spare(E, r.seller, r.good, day) < r.qty) return fail('seller has no spare');
  const uB = r.urgency?.buyer ?? (B ? urgencyOf(E, r.buyer, r.good === 'fuel' ? 'fuel' : r.good === 'grain' ? 'food' : 'cash') : 0.3);
  const uS = r.urgency?.seller ?? (Sl ? urgencyOf(E, r.seller, 'cash') : 0.3);
  const ceiling = p0 * (1 + 0.35 * uB + 0.10 * (tB - 0.5)), floor = p0 * (0.90 - 0.25 * uS + 0.30 * (0.5 - tS));
  if (ceiling < floor) return fail('no overlap', { ceiling, floor });
  const skB = r.skill?.buyer ?? skillOf(E, r.buyer), skS = r.skill?.seller ?? skillOf(E, r.seller);
  const share = Math.max(0.05, Math.min(0.95, 0.5 + 0.35 * (skB - skS) + (u01(E.seed, S.noise, idn(r.buyer), idn(r.seller), day) - 0.5) * 0.16));
  const price = +(ceiling - (ceiling - floor) * share).toFixed(4);
  // the to-and-fro that arrives there: each side opens far from it and gives half the distance each round
  const rounds: HaggleResult['rounds'] = []; let b = Math.min(price, floor * 0.7), s = Math.max(price, ceiling * 1.25);
  for (let k = 0; k < 4; k++) { rounds.push({ who: 'seller', offer: +s.toFixed(4) }); rounds.push({ who: 'buyer', offer: +b.toFixed(4) }); s = price + (s - price) / 2; b = price - (price - b) / 2; }
  rounds.push({ who: 'seller', offer: price });
  // payment: cash if the buyer has it, else (or when asked) barter, valued at the market less a tenth
  let pay: NonNullable<HaggleResult['pay']> = { kind: 'cash' };
  const wantBarter = r.pay === 'barter' || (r.pay !== 'cash' && B && B.cash < price);
  if (wantBarter) {
    const bg = r.barter ?? (B && B.goods > 0 ? 'goods' : 'fuel'), bref = refPrice(E, bg, day) * 0.9, n = Math.ceil(price / bref - 1e-9), have = B ? (bg === 'goods' ? B.goods : bg === 'fuel' ? B.fuel - 10 : B.grain - B.eaters * GRAIN_EAT * 30) : n;
    if (bg === r.good || have < n) return fail(B && B.cash < price ? 'buyer cannot pay' : 'buyer has nothing to barter', { ceiling, floor, price });
    pay = { kind: 'barter', good: bg, qty: n };
  } else if (B && B.cash < price) return fail('buyer cannot pay', { ceiling, floor, price });
  const cz = r.causes ?? [B?.cause[r.good === 'fuel' ? 'fuel' : r.good === 'grain' ? 'food' : 'cash']].filter((x): x is number => x !== undefined);
  const gp = (x: number, key: 'grain' | 'fuel' | 'goods') => ({ [key]: x });
  const common = { deal: 1, src: 'haggle', good: r.good, price, ...(cz.length ? { causes: cz } : {}) };
  const toB: Record<string, number | string | number[]> = { ...common, ...(r.good !== 'labour' ? gp(r.qty, r.good) : {}) };
  const toS: Record<string, number | string | number[]> = { ...common, ...(r.good !== 'labour' ? gp(-r.qty, r.good) : {}) };
  if (pay.kind === 'cash') { toB.cash = -price; toS.cash = price; }
  else { const k = pay.good as 'grain' | 'fuel' | 'goods'; toB[k] = ((toB[k] as number) ?? 0) - pay.qty!; toS[k] = ((toS[k] as number) ?? 0) + pay.qty!; }
  const intents: Intent[] = [];
  if (B) intents.push({ kind: 'trade', from: r.seller, to: r.buyer, day, payload: toB });
  if (Sl) intents.push({ kind: 'trade', from: r.buyer, to: r.seller, day, payload: toS });
  if (r.apply !== false) for (const i of intents) E.enter(i);
  return { ok: true, ref, price, ceiling, floor, rounds, trust: { buyerInSeller: tS, sellerInBuyer: tB }, pay, intents };
}

/** one haggle of the driver, for the records (tests and the dev overlay) */
export interface HaggleRecord { day: number; buyer: string; seller: string; good: HaggleGood; qty: number; res: HaggleResult }
const COOL = 3;
const coolOf = new WeakMap<Economy, Map<string, number>>();
/** the simulation's own haggles for a day: households short of bread or fuel seek a neighbour or kin with a surplus, the
 *  seller they trust most first (up to three tried); at most `max` a day across the town. Returns what was tried. */
export function haggleRound(E: Economy, day: number, max = 40): HaggleRecord[] {
  const out: HaggleRecord[] = []; if (E.day < day) return out;
  const cool = E.trust?.cool ?? (coolOf.get(E) ?? coolOf.set(E, new Map()).get(E)!);
  const byQ = new Map<string, string[]>(); for (const h of E.hh.values()) { if (!byQ.has(h.q)) byQ.set(h.q, []); byQ.get(h.q)!.push(h.id); }
  for (const B of E.hh.values()) {
    if (out.length >= max) break; if (B.dead || day - (cool.get(B.id) ?? -99) < COOL) continue;
    const needs = E.needsOf(B.id), food = needs.find(n => n.kind === 'food')!.urgency, fuel = needs.find(n => n.kind === 'fuel')!.urgency;
    const good: HaggleGood | null = food >= 0.35 ? 'grain' : fuel >= 0.6 ? 'fuel' : null; if (!good) continue;
    const want = good === 'grain' ? B.eaters * GRAIN_EAT * 10 : 10;
    if (B.cash < 0.25 * want * refPrice(E, good, day) && B.goods < 1) continue; // nothing to pay with
    cool.set(B.id, day);
    const pool = [...new Set([...(byQ.get(B.q) ?? []), ...B.kin])].filter(id => id !== B.id && spare(E, id, good, day) >= Math.min(want, 4));
    const T = E.trust;
    const ranked = pool.map(id => ({ id, t: T ? T.trustOf(B.id, id, day) : 0.5, k: h32(E.seed, S.pick, idn(B.id), idn(id), day) })).sort((a, b) => b.t - a.t || a.k - b.k).slice(0, 3);
    for (const c of ranked) {
      const qty = +Math.min(want, spare(E, c.id, good, day) * 0.5).toFixed(1); if (qty <= 0) continue;
      const res = haggle(E, { buyer: B.id, seller: c.id, good, qty, day }); out.push({ day, buyer: B.id, seller: c.id, good, qty, res });
      if (res.ok) break;
    }
  }
  return out;
}
