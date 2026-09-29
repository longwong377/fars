// D-339: a small seeded stand-in for the economy (PLACEHOLDER until src/people/economy lands; it implements only the
// shared EconWorld interface, so the living world never reaches past it). Each household has stocks of food, fuel,
// water and cash that drain daily by a seeded rate; a need is a stock below its comfort level. Intents move stock
// between households (trade, loan, help, work paid in kind). Tier C: the rates are placeholders, not measured values.
import { h32, u01, salt } from '../hash';
import type { EconWorld, HouseholdNeed, Intent, NeedKind } from './types';

const S = salt('living-fake-econ');
const GOODS: NeedKind[] = ['food', 'fuel', 'water', 'cash'];
export class FakeEcon implements EconWorld {
  private stock = new Map<string, Record<string, number>>();
  private day = 0;
  constructor(readonly seed: number) {}
  private of(hh: string) { const s0 = this.stock.get(hh); if (s0) { this.drain(hh, s0); return s0; } return this.make(hh); }
  private drain(hh: string, s: Record<string, number>) { const n = this.day - s._d; if (n <= 0) return; for (const g of [...GOODS, "help", "kin", "health"]) s[g] = Math.max(0, s[g] - n * 0.04 * u01(this.seed, S, hashHH(hh), g.length)); s._d = this.day; }
  private make(hh: string) {
    let s = this.stock.get(hh); if (s) return s;
    const k = h32(this.seed, S, hashHH(hh)); s = {};
    for (let i = 0; i < GOODS.length; i++) s[GOODS[i]] = 0.3 + 0.7 * u01(this.seed, S, k, i);
    s._d = this.day; s.help = u01(this.seed, S, k, 7); s.kin = u01(this.seed, S, k, 8); s.health = 0.6 + 0.4 * u01(this.seed, S, k, 9);
    this.stock.set(hh, s); return s;
  }
  needsOf(hh: string): HouseholdNeed[] {
    const s = this.of(hh); const out: HouseholdNeed[] = [];
    for (const kind of [...GOODS, 'help', 'kin', 'health'] as NeedKind[]) { const v = this.drained(hh, s, kind); if (v < 0.5) out.push({ hh, kind, urgency: Math.min(1, (0.5 - v) * 2) }); }
    return out.sort((a, b) => b.urgency - a.urgency);
  }
  private drained(_hh: string, s: Record<string, number>, kind: string) { return s[kind]; }
  price(good: string, day: number) { return 1 + 0.2 * Math.sin(day / 30 + good.length); }
  applyIntent(i: Intent): { ok: boolean; changes: string[] } {
    const a = this.of(i.from), b = this.of(i.to); const good = String(i.payload.good ?? i.kind); const q = Number(i.payload.qty ?? 0.2);
    if (i.kind === 'news' || i.kind === 'visit') { b.kin = Math.min(1, b.kin + 0.2); return { ok: true, changes: [`${i.to}.kin+0.2`] }; }
    if (i.kind === 'help' || i.kind === 'work') { b.help = Math.min(1, b.help + 0.3); a.cash = a.cash + (i.kind === 'work' ? 0.1 : 0); return { ok: true, changes: [`${i.to}.help+0.3`] }; }
    // trade / loan / petition: the giver must have the thing
    const giver = i.kind === 'petition' ? b : a, taker = i.kind === 'petition' ? a : b;
    if ((giver[good] ?? 0) < q) return { ok: false, changes: [] };
    giver[good] -= q; taker[good] = (taker[good] ?? 0) + q; if (i.kind === 'trade') { taker.cash -= q * this.price(good, i.day) * 0.5; giver.cash += q * this.price(good, i.day) * 0.5; }
    return { ok: true, changes: [`${i.from}->${i.to}:${good}${q}`] };
  }
  step(day: number) { this.day = day; }
  snapshot(): unknown { return { day: this.day, stock: [...this.stock.entries()] }; }
}
function hashHH(hh: string) { let h = 0; for (let i = 0; i < hh.length; i++) h = (Math.imul(h, 31) + hh.charCodeAt(i)) | 0; return h; }
