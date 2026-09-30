// D-352 (UD-25 mechanic 2; UD-24, UD-26): NEEDS SURFACED AS EMERGENT ASKS, no quest UI. Node side.
//
// From the economy's own state, day by day after its step, every household that is in want has ASKS: a structured record of
// who asks, what they need, why (the need, and the economy event that caused it), how urgent, what they would say to kin, to a
// neighbour and to a stranger (each a different amount, offer and reluctance), what would satisfy it (an Intent the economy
// can take: Economy.enter), and what the world does if the ask is met or ignored. Nothing here is scripted and nothing here
// decides the outcome: an ask is OPEN while its need stands, MET when the economy's state says the need is gone (by whom is
// read off the economy's events: kin, a neighbour, a stranger or the player, the state's relief, a lender, the household's own
// work), and ESCALATED when the economy itself then does what its own rules do to a house left in that want (hunger, a theft,
// a default, a suit, bondage); the escalation names the economy event. The asks are data for the later model/voice layer
// (LivingWorld speaks from them) and for trust (onMet/onEscalate hooks; src/people/speech owns trust).
// A lost child is the one ask the economy has no state for: a seeded rare event of this layer (C), found by the quarter's
// searching, not by a script. Pure: a function of the economy, the seed and the player's deeds (Economy.enter). Tier C
// throughout: the amounts, thresholds and reluctance are reasoned, not attested (DECISIONS D-352).
import type { Economy, EconEvent } from '../economy/world';
import type { Intent, NeedKind } from '../economy/api';
import { h32, u01, salt } from '../hash';

const S = { who: salt('ask-who'), pride: salt('ask-pride'), child: salt('ask-child'), found: salt('ask-found') };
export type AskKind = 'grain' | 'fuel' | 'water' | 'silver' | 'labour' | 'healer' | 'company' | 'animal' | 'justice' | 'shelter' | 'time' | 'petition' | 'lost_child';
export type Audience = 'kin' | 'neighbour' | 'stranger';
export type By = 'player' | 'kin' | 'neighbour' | 'stranger' | 'state' | 'lender' | 'self';
export interface Voice { to: Audience; /** whether the house would ask this audience at this urgency */ willing: boolean; amount: number; /** what they offer in return */ offers: string; /** 0..1: the shame of asking */ reluctance: number }
export interface Ask {
  id: number; hh: string; /** a seeded adult of the house who does the asking (when the layer knows the members) */ speaker?: number;
  kind: AskKind; day0: number; urgency: number; peak: number;
  what: { good: string; amount: number; unit: string };
  why: { need: NeedKind | 'event'; ev?: number; evKind?: string };
  voices: Voice[]; satisfy: Intent | null;
  ifMet: string; ifIgnored: string;
  status: 'open' | 'met' | 'escalated' | 'lapsed'; metBy?: By; metDay?: number; escalation?: { ev: number; kind: string; day: number }; closed?: number;
}
export interface AsksOpts { /** kin and neighbours with a surplus answer open asks by their own deeds (the living world's own talk does so too when it runs) */ kinHelp?: boolean; members?: (hh: string) => number[]; kids?: (hh: string) => number; onMet?: (a: Ask, by: By) => void; onEscalate?: (a: Ask) => void }
const GRAIN_EAT = 0.55;
/** the economy events that answer an ask (a deed naming the house), and those that are what a house left in want comes to (C) */
const MEET_EV: Record<AskKind, string[]> = {
  grain: ['given', 'relief', 'grain_brought', 'kin_help', 'neighbours_help', 'hired_by_neighbour', 'wage_work'], fuel: ['given'], water: ['given'], silver: ['given', 'loan', 'remitted'],
  labour: ['given', 'hired_by_stranger', 'nursed_by_kin', 'neighbours_help', 'hired_by_neighbour', 'wage_work', 'kin_help'], healer: ['given', 'relief', 'nursed_by_kin'],
  company: ['given', 'relief', 'kin_help'], animal: ['animal_bought', 'given', 'loan'], justice: ['arrest', 'acquitted', 'given'], shelter: ['given', 'relief', 'loan'], time: ['time_granted', 'remitted', 'spoken_for', 'repaid'],
  petition: ['spoken_for', 'remitted', 'relief', 'acquitted', 'time_granted'], lost_child: []
};
const ESC_EV: Record<AskKind, string[]> = {
  grain: ['hunger', 'theft', 'debt_labour', 'death'], fuel: ['cold_hearth', 'illness', 'theft'], water: ['illness', 'death'], silver: ['default', 'suit', 'pledge_seized', 'bound_labour', 'debt_labour'],
  labour: ['hunger', 'default', 'death'], healer: ['death', 'hunger'], company: ['illness', 'hunger'], animal: ['hunger', 'default'], justice: ['theft', 'hunger'], shelter: ['cold_hearth', 'illness', 'death', 'hunger'],
  time: ['default', 'suit', 'pledge_seized', 'bound_labour', 'debt_labour', 'arrest'], petition: ['pledge_seized', 'bound_labour', 'arrest', 'petition_refused'], lost_child: ['death']
};
const IF_MET: Record<AskKind, string> = { grain: 'the house eats; the giver\'s stores fall and a debt of favour stands', fuel: 'the hearth is kept', water: 'the house is watered', silver: 'the debt is paid or the loan carried; the lender\'s silver falls',
  labour: 'the work is done and the house recovers', healer: 'the sick are tended', company: 'the dead are mourned with the house', animal: 'the plough or the flock is restored', justice: 'the court judges the thief', shelter: 'the house is housed and fed',
  time: 'the lender waits', petition: 'the judge is lenient', lost_child: 'the child is brought home' };
const IF_IGNORED: Record<AskKind, string> = { grain: 'hunger sickens the house and the least honest may steal', fuel: 'a cold hearth, illness', water: 'thirst in the heat, illness', silver: 'the default: a suit, a pledge seized, a member bound to work it off',
  labour: 'the work is left and the house sinks', healer: 'the sick may die', company: 'the house mourns alone', animal: 'the work of the year is short', justice: 'the thief goes free, the house hungers', shelter: 'cold, hunger, illness',
  time: 'the default, then the court', petition: 'the judge is hard: bondage or arrest', lost_child: 'the child is lost to the night and the road' };
const COOLDOWN = 10, LAPSE = 40, HIST = 60;
/** a need becomes an ask when it stands at this urgency for this many days: the house has tried its own means first (buying fuel,
 *  fetching water, selling a little) and they have not been enough; a sickness or a mourning asks at once (C) */
const GATE: Partial<Record<NeedKind, [number, number]>> = { food: [0.45, 4], fuel: [0.7, 6], water: [0.5, 3], cash: [0.5, 8], help: [0.5, 1], health: [0.45, 4], kin: [0.5, 1] };
/** the daily chance that a kin / neighbour with a surplus answers an open ask by their own hand (opts.kinHelp; C) */
const HELP_P: Record<string, number> = { kin: 0.2, neighbour: 0.1 };
/** (water is not asked for: a hot dry day is the weather's, it passes, and nobody is asked to carry a neighbour's water: D-352) */
const NEEDS: Partial<Record<NeedKind, AskKind>> = { food: 'grain', fuel: 'fuel', cash: 'silver', help: 'labour', health: 'healer', kin: 'company' };
/** audiences by reluctance: kin first, a stranger last; the proud (seeded) ask a stranger only when it is grave (C) */
const RELUCT: Record<Audience, number> = { kin: 0.15, neighbour: 0.4, stranger: 0.75 };
const OFFERS: Record<AskKind, Record<Audience, string>> = {
  grain: { kin: 'repay from the harvest', neighbour: 'a day\'s labour', stranger: 'labour or a pledge' }, fuel: { kin: 'repay in kind', neighbour: 'a day\'s labour', stranger: 'labour' },
  water: { kin: 'carry theirs', neighbour: 'carry theirs', stranger: 'thanks, a little silver' }, silver: { kin: 'repay with the year\'s interest', neighbour: 'a pledge and interest', stranger: 'a pledge and the interest of the place' },
  labour: { kin: 'the same in return', neighbour: 'a meal and grain', stranger: 'pay in grain' }, healer: { kin: 'what they have', neighbour: 'what they have', stranger: 'silver when they can' },
  company: { kin: 'their own grief', neighbour: 'a share of the funeral meal', stranger: 'a share of the funeral meal' }, animal: { kin: 'the young of the flock', neighbour: 'a share of the work', stranger: 'silver at harvest' },
  justice: { kin: 'to stand witness', neighbour: 'to stand witness', stranger: 'to be heard' }, shelter: { kin: 'work and thanks', neighbour: 'work and thanks', stranger: 'work' },
  time: { kin: 'to speak for them', neighbour: 'a pledge', stranger: 'a pledge' }, petition: { kin: 'to be spoken for', neighbour: 'to be spoken for', stranger: 'to be spoken for' }, lost_child: { kin: 'everything', neighbour: 'everything', stranger: 'everything' }
};
const bump = (r: Record<string, number>, k: string) => { r[k] = (r[k] ?? 0) + 1; };

export class AskBook {
  readonly asks: Ask[] = [];
  /** per kind: opened, met, escalated, lapsed; and met by whom (kind|by), for the measured report */
  stats = { opened: {} as Record<string, number>, met: {} as Record<string, number>, escalated: {} as Record<string, number>, lapsed: {} as Record<string, number>, by: {} as Record<string, number> };
  private evSeen = 0; private nextId = 0; private upTo = -1; private open = new Map<string, Ask>(); private cool = new Map<string, number>();
  private kinOf = new Map<string, Set<string>>(); private qOf = new Map<string, string>(); private qn = new Map<string, number>();
  /** the last HIST days' events by household (actor or other), for what answered or escalated an ask */
  private hist = new Map<string, EconEvent[]>(); private since = new Map<string, number>();
  constructor(readonly econ: Economy, readonly seed: number, readonly opts: AsksOpts = {}) {
    for (const h of econ.hh.values()) { this.qOf.set(h.id, h.q); this.kinOf.set(h.id, new Set(h.kin)); this.qn.set(h.q, (this.qn.get(h.q) ?? 0) + 1); (this.qList.get(h.q) ?? this.qList.set(h.q, []).get(h.q)!).push(h.id); }
  }
  get day() { return this.upTo; }
  private rel(a: string, b: string): By {
    if (b === 'player') return 'player'; if (b === 'treasury' || b === 'court' || b === 'self') return b === 'self' ? 'self' : 'state';
    if (this.kinOf.get(a)?.has(b) || this.kinOf.get(b)?.has(a)) return 'kin'; return this.qOf.get(a) === this.qOf.get(b) ? 'neighbour' : 'stranger';
  }
  private idOf(id: string) { return Number(id.slice(2)) || 0; }
  private voices(id: string, kind: AskKind, urgency: number, amount: number): Voice[] {
    const pride = u01(this.seed, S.pride, this.idOf(id)); // 0 humble .. 1 proud
    return (['kin', 'neighbour', 'stranger'] as Audience[]).map(to => {
      const reluctance = Math.min(1, RELUCT[to] * (0.6 + 0.8 * pride));
      return { to, willing: urgency >= reluctance * 0.9, amount: Math.max(0.05, Math.round(amount * (to === 'kin' ? 1 : to === 'neighbour' ? 0.6 : 0.3) * 100) / 100), offers: OFFERS[kind][to], reluctance };
    });
  }
  private begin(hh: string, kind: AskKind, day: number, urgency: number, amount: number, good: string, unit: string, why: Ask['why'], satisfy: Intent | null) {
    const key = hh + '|' + kind; if (this.open.has(key) || (this.cool.get(key) ?? -99) > day - COOLDOWN) return;
    const h = this.econ.hh.get(hh); if (!h || h.dead) return;
    const m = this.opts.members?.(hh), id = this.nextId++;
    const a: Ask = { id, hh, speaker: m && m.length ? m[h32(this.seed, S.who, this.idOf(hh), day, id) % m.length] : undefined, kind, day0: day, urgency, peak: urgency,
      what: { good, amount: Math.max(0.1, Math.round(amount * 100) / 100), unit }, why, voices: this.voices(hh, kind, urgency, amount), satisfy, ifMet: IF_MET[kind], ifIgnored: IF_IGNORED[kind], status: 'open' };
    this.asks.push(a); this.open.set(key, a); bump(this.stats.opened, kind);
  }
  private close(a: Ask, status: 'met' | 'lapsed', day: number, by?: By) {
    a.status = status; a.closed = day; this.open.delete(a.hh + '|' + a.kind); this.cool.set(a.hh + '|' + a.kind, day);
    if (status === 'met') { a.metBy = by ?? 'self'; a.metDay = day; bump(this.stats.met, a.kind); bump(this.stats.by, a.kind + '|' + a.metBy); this.opts.onMet?.(a, a.metBy); }
    else bump(this.stats.lapsed, a.kind);
  }
  private escalate(a: Ask, ev: number, kind: string, day: number) { a.status = 'escalated'; a.escalation = { ev, kind, day }; bump(this.stats.escalated, a.kind); this.opts.onEscalate?.(a); }

  /** derive the asks of the economy's day `day` (call after Economy.step(day), once a day, in order) */
  advance(day: number) {
    if (day <= this.upTo) return; const E = this.econ, evs = E.events; this.upTo = day;
    const fresh = evs.slice(this.evSeen).filter(e => e && e.actor); this.evSeen = evs.length;
    for (const e of fresh) for (const k of new Set([e.actor, e.other])) if (k && this.qOf.has(k)) { const l = this.hist.get(k); if (l) l.push(e); else this.hist.set(k, [e]); }
    if (day % 15 === 0) for (const [k, l] of this.hist) { const f = l.filter(e => e.day >= day - HIST); if (f.length) this.hist.set(k, f); else this.hist.delete(k); }
    // 1. the ask of each need in want
    for (const h of E.hh.values()) {
      if (h.dead) continue; const eat = h.eaters * GRAIN_EAT;
      for (const n of E.needsOf(h.id)) { const k = NEEDS[n.kind], g = GATE[n.kind]; if (!k || !g) continue; const sk = h.id + '|' + n.kind;
        if (n.urgency < g[0]) { this.since.delete(sk); continue; } const s0 = this.since.get(sk) ?? day; this.since.set(sk, s0); if (day - s0 < g[1]) continue;
        const cause = h.cause[n.kind], [good, amount, unit, sat] = this.sizing(k, h, eat, cause);
        this.begin(h.id, k, day, n.urgency, amount, good, unit, { need: n.kind, ev: cause, evKind: cause !== undefined ? evs[cause]?.kind : undefined }, sat);
      }
    }
    // 2. the crises the day's events name
    for (const e of fresh) {
      const h = E.hh.get(e.actor), mk = (kind: Intent['kind'], to: string, payload: Intent['payload']): Intent => ({ kind, from: 'player', to, day, payload: { ...payload, causes: e.id } });
      if (e.kind === 'robbed' && h) this.begin(e.actor, 'justice', day, 0.6, 1, 'hearing', 'case', { need: 'event', ev: e.id, evKind: e.kind }, mk('petition', e.actor, { days: 60 }));
      else if (e.kind === 'animal_lost' && h) this.begin(e.actor, 'animal', day, 0.7, 1, 'animal', 'head', { need: 'event', ev: e.id, evKind: e.kind }, mk('loan', e.actor, { cash: 3 }));
      else if (e.kind === 'house_fire' && h) { const g = h.eaters * GRAIN_EAT * 14; this.begin(e.actor, 'shelter', day, 0.9, g, 'grain', 'kg', { need: 'event', ev: e.id, evKind: e.kind }, mk('help', e.actor, { grain: g, fuel: 10 })); }
      else if ((e.kind === 'tax_arrears' || e.kind === 'levy_arrears') && h) this.begin(e.actor, 'time', day, 0.5, e.amt ?? 1, 'silver', 'sheqel', { need: 'event', ev: e.id, evKind: e.kind }, mk('petition', e.actor, { days: 90 }));
      else if (e.kind === 'suit' && e.other && E.hh.has(e.other)) this.begin(e.other, 'petition', day, 0.7, 1, 'advocate', 'voice', { need: 'event', ev: e.id, evKind: e.kind }, mk('petition', e.other, { days: 120 }));
    }
    // 3. a child lost (this layer's own seeded event, C: ~1 a year per 1000 houses with children)
    if (this.opts.kids) for (const h of E.hh.values()) { if (h.dead || this.opts.kids(h.id) <= 0) continue;
      if (u01(this.seed, S.child, this.idOf(h.id), day) < 0.0003) this.begin(h.id, 'lost_child', day, 1, 1, 'search', 'party', { need: 'event', evKind: 'lost_child' }, null); }
    // 4. the open asks: met, escalated, lapsed
    for (const a of [...this.open.values()]) {
      const h = E.hh.get(a.hh)!; if (!h) continue; const urg = this.urgencyOf(a, h, day); a.urgency = urg; a.peak = Math.max(a.peak, urg);
      if (a.kind === 'lost_child') { // found by the quarter's searching: more houses, more eyes; three nights and it is grave
        const eyes = (this.qn.get(h.q) ?? 1) / 40;
        if (u01(this.seed, S.found, a.id, day) < Math.min(0.9, 0.25 + 0.05 * eyes)) { this.close(a, 'met', day, 'neighbour'); continue; }
        if (day - a.day0 >= 3 && !a.escalation) this.escalate(a, -1, 'lost_three_nights', day);
        if (day - a.day0 >= 8) this.close(a, 'lapsed', day); continue;
      }
      const since = (this.hist.get(a.hh) ?? []).filter(e => e.day >= a.day0 && e.id !== a.why.ev);
      const deed = since.find(e => MEET_EV[a.kind].includes(e.kind) && (e.actor === a.hh || e.other === a.hh || e.kind === 'given' || e.kind === 'loan') && (e.actor === a.hh || e.other === a.hh));
      const by = (): By => { if (!deed) return 'self'; const g = deed.actor === a.hh ? deed.other ?? 'self' : deed.actor; const r = this.rel(a.hh, g); return deed.kind === 'loan' && r === 'stranger' ? 'lender' : r; };
      const legal = a.kind === 'justice' || a.kind === 'petition' || a.kind === 'time'; // answered by a deed alone; the need stays on the books
      if (legal ? !!deed : urg < 0.12 || (a.why.need === 'event' && !!deed)) { this.close(a, 'met', day, by()); continue; }
      if (this.opts.kinHelp && a.satisfy && day > a.day0 && a.why.need !== 'event') this.kinDeed(a, day);
      if (!a.escalation) { const esc = since.find(e => ESC_EV[a.kind].includes(e.kind) && (e.actor === a.hh || (e.other === a.hh && (e.kind === 'suit' || e.kind === 'pledge_seized'))));
        if (esc) this.escalate(a, esc.id, esc.kind, esc.day); }
      if (day - a.day0 >= LAPSE && urg < 0.4) this.close(a, 'lapsed', day);
    }
  }
  /** a kin or a lane neighbour with a surplus answers: their own stores fall, the house's rise (an Intent entered in the economy) */
  private kinDeed(a: Ask, day: number) {
    const E = this.econ, h = E.hh.get(a.hh)!; const cand: [string, Audience][] = [...h.kin.map(k => [k, 'kin'] as [string, Audience]), ...this.lane(h.id).map(x => [x, 'neighbour'] as [string, Audience])];
    for (const [gid, aud] of cand) { const g = E.hh.get(gid); if (!g || g.dead) continue; const v = a.voices.find(x => x.to === aud)!;
      if (u01(this.seed, S.found, a.id * 7 + this.idOf(gid), day) >= HELP_P[aud] * (v.willing ? 1 : 0.4)) continue;
      const pay = a.satisfy!.payload, sc = aud === 'kin' ? 1 : 0.6, grain = Number(pay.grain ?? 0) * sc, fuel = Number(pay.fuel ?? 0) * sc, cash = Number(pay.cash ?? 0) * sc;
      if (!grain && !fuel && !cash) continue; if (g.grain < g.eaters * GRAIN_EAT * 50 + grain || g.fuel < 10 + fuel || g.cash < cash + 2) continue;
      g.grain -= grain; g.fuel -= fuel; g.cash -= cash; E.enter({ kind: a.satisfy!.kind === 'loan' ? 'loan' : 'help', from: gid, to: a.hh, day, payload: { grain, fuel, cash, causes: a.why.ev ?? -1, src: 'ask' } }); return; }
  }
  /** the lane: three houses either side in the quarter's list */
  private lane(id: string): string[] { let l = this.laneOf.get(id); if (!l) { const q = this.qList.get(this.qOf.get(id)!)!, i = q.indexOf(id); l = [-1, 1, -2, 2].map(d => q[i + d]).filter(Boolean); this.laneOf.set(id, l); } return l; }
  private laneOf = new Map<string, string[]>(); private qList = new Map<string, string[]>();
  private sizing(k: AskKind, h: { id: string; debts: { amt: number }[] }, eat: number, cause: number | undefined): [string, number, string, Intent | null] {
    const d = this.econ.day, mk = (kind: Intent['kind'], payload: Intent['payload']): Intent => ({ kind, from: 'player', to: h.id, day: d, payload: { ...payload, ...(cause !== undefined ? { causes: cause } : {}) } });
    switch (k) {
      case 'grain': return ['grain', eat * 14, 'kg', mk('help', { grain: eat * 14 })];
      case 'fuel': return ['fuel', 12, 'load', mk('help', { fuel: 12 })];
      case 'water': return ['water', 2, 'day', mk('help', { labour: 1 })];
      case 'silver': { const owed = h.debts.reduce((a, x) => a + x.amt, 0), n = Math.max(0.5, owed || eat * 10 * this.econ.price('grain', d)); return ['silver', n, 'sheqel', mk('loan', { cash: n })]; }
      case 'labour': return ['labour', 3, 'day', mk('work', { grain: 3 * GRAIN_EAT * 2, labour: 3 })];
      case 'healer': return ['healer', 1, 'visit', mk('help', { grain: eat * 5 })];
      case 'company': return ['company', 1, 'visit', mk('help', { grain: eat * 5 })];
      default: return [k, 1, 'unit', null];
    }
  }
  /** the ask's urgency now: the need's own while it stands; a crisis's ask eases or rises with the state it names (C) */
  private urgencyOf(a: Ask, h: { noOx: number; grain: number; eaters: number; debts: { ev: number; amt: number }[] }, day: number): number {
    if (a.why.need !== 'event') return this.econ.needsOf(a.hh).find(n => n.kind === a.why.need)?.urgency ?? 0;
    if (a.kind === 'animal') return h.noOx >= 0 ? Math.min(1, 0.7 + 0.01 * (day - a.day0)) : 0;
    if (a.kind === 'shelter') return Math.max(0, 0.9 - 0.02 * (day - a.day0)) * (h.grain < h.eaters * GRAIN_EAT * 10 ? 1 : 0.1);
    if (a.kind === 'time') return h.debts.some(x => x.ev === a.why.ev && x.amt > 0) ? Math.min(1, 0.5 + 0.01 * (day - a.day0)) : 0;
    return Math.min(1, a.urgency + 0.005);
  }
  /** a deed by the player (or another layer) answering an ask: entered into the economy (Economy.enter, saved with it). The ask
   *  closes as met at the next advance, when the economy's own 'given'/'loan' event names the giver. `scale` sizes the gift */
  answer(a: Ask, from = 'player', scale = 1): { ok: boolean; changes: string[] } {
    if (!a.satisfy || a.status === 'met' || a.status === 'lapsed') return { ok: false, changes: [] };
    const pay = Object.fromEntries(Object.entries(a.satisfy.payload).map(([k, v]) => [k, typeof v === 'number' && k !== 'causes' && k !== 'days' ? v * scale : v]));
    const i: Intent = { ...a.satisfy, from, day: this.econ.day, payload: pay }; this.econ.enter(i); // (applied at once for a past day; the snapshot carries the state)
    return { ok: true, changes: [`${a.hh}.${a.kind}`] };
  }
  openOf(hh: string): Ask[] { return [...this.open.values()].filter(a => a.hh === hh); }
  /** the save: the book's state; the economy carries its own and the player's deeds */
  save() {
    const hist: [string, EconEvent[]][] = []; for (const [k, l] of this.hist) { const f = l.filter(e => e.day >= this.upTo - HIST); if (f.length) hist.push([k, f]); }
    return { upTo: this.upTo, evSeen: this.evSeen, nextId: this.nextId, asks: this.asks, stats: this.stats, cool: [...this.cool], since: [...this.since], hist };
  }
  load(s: ReturnType<AskBook['save']>) {
    this.asks.length = 0; this.open.clear(); this.upTo = s.upTo; this.evSeen = s.evSeen; this.nextId = s.nextId; this.stats = JSON.parse(JSON.stringify(s.stats)); this.cool = new Map(s.cool); this.since = new Map(s.since);
    this.hist = new Map(JSON.parse(JSON.stringify(s.hist)));
    for (const a of JSON.parse(JSON.stringify(s.asks)) as Ask[]) { this.asks.push(a); if (a.status === 'open' || a.status === 'escalated') this.open.set(a.hh + '|' + a.kind, a); }
  }
}
