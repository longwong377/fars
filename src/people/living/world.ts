// D-339 (UD-24, UD-21; T-E13): talk that changes the world.
//
// Each day, people whose day plans put them at the same place at the same time (co-location read from the base plans:
// Population.basePlan, never the overlaid plan, so there is no loop) may talk. What they talk about comes from both
// households' needs (EconWorld.needsOf): the one in want asks, the other offers — food, fuel or water traded or lent,
// a hand with the work, a visit to kin — and anyone who carries news (of a stranger's doings, or of an arrangement made)
// passes it on. Each talk resolves to a structured Intent that is LAID INTO THE DOER'S PLAN on a free stretch of one of
// the next three days (the walk to the other house, the errand, the walk back), exactly as the stranger's deeds are laid
// (talk.ts splice); the economy applies the Intent on that day. A talk whose doer has no free stretch in three days, is
// sick, away or dead, or whose Intent the economy refuses, has no consequence, and is counted so (report()).
// Player-caused changes (TalkWorld events) make news: the person who did the deed tells whom they meet.
//
// Everything is a pure function of (seed, the talk events, the day): recomputed identically after a reload, so the save
// needs nothing new. Tier C throughout (DECISIONS D-339): who talks and what they arrange is this module's reading of
// neighbourly custom, not evidence.
import { h32, u01, salt } from '../hash';
import type { Population, Seg, Where } from '../population';
import type { ActivityId } from '../activities';
import { splice } from '../talk';
import { checkPlan } from '../planCheck';
import type { EconWorld, Intent, NeedKind } from './types';

const S = salt('living-talk');
const BLOCK = 8;
const FREE = new Set<ActivityId>(['rest', 'eat', 'talk', 'play', 'gamble', 'tend_body', 'queue', 'exchange', 'spin']);
const MEET_ACTS = new Set<ActivityId>(['rest', 'eat', 'talk', 'queue', 'exchange', 'draw_water', 'wash', 'gamble', 'spin', 'field_work', 'garden_work', 'reap', 'thresh', 'tend_animals', 'herd', 'craft', 'weave', 'grind', 'bake']);
/** a talk event: who spoke with whom, where, and what was arranged */
export interface LivingTalk {
  id: number; day: number; h: number; place: string; a: number; b: number;
  intent: Intent; doer: number; target: string;
  /** news: the source (a player event index, or a talk id) and how many hands it has passed */
  news?: { src: string; hand: number };
  /** the consequence: the day and plan window it was carried out, and the economy's changes (none: it came to nothing) */
  done?: { day: number; h0: number; h1: number; changes: string[] }; why?: string;
}
export interface LivingOpts { /** share of present people whose plans are scanned for meetings each day */ sample?: number; /** most talks per day */ maxTalks?: number }

export class LivingWorld {
  readonly talks: LivingTalk[] = [];
  private laid = new Map<string, { h0: number; h1: number; segs: Seg[] }[]>();
  private overlaid = new Map<string, Seg[]>();
  /** news each person carries: pid → [{src, hand, from day}] */
  private news = new Map<number, { src: string; hand: number; day: number }[]>();
  private blocks = new Set<number>(); private seenEvents = 0; private nToday = 0;
  private busy = new Set<string>();
  constructor(readonly pop: Population, readonly seed: number, private makeEcon: () => EconWorld,
    private playerEvents: () => readonly { i: number; pid: number; day: number; ok: boolean; kind: string }[] = () => [], readonly opts: LivingOpts = {}) { this.econ = makeEcon(); }
  econ: EconWorld;

  // ---------------------------------------------------------------- the plan hook (talk.ts TalkWorld asks)
  /** the days the world lives around (the sim's present, set by PeopleSim): a plan asked for a day far from it (a year-long tool,
   *  a test walking the calendar) is the base plan; the talk runs where the player is. null: every day */
  now: (() => number) | null = null; private forced = false;
  touches(pid: number, day: number) { if (!this.forced && this.now && Math.abs(day - this.now()) > BLOCK) return false; this.ensure(day); return this.laid.has(`${pid}:${day}`); }
  overlay(pid: number, day: number, base: Seg[]): Seg[] {
    const k = `${pid}:${day}`; const c = this.overlaid.get(k); if (c) return c;
    let segs = base; for (const L of this.laid.get(k) ?? []) segs = splice(segs, L.h0, L.h1, L.segs);
    this.overlaid.set(k, segs); return segs;
  }

  // ---------------------------------------------------------------- the days
  /** simulate the talk of the block holding `day`, once (blocks are independent of each other) */
  ensure(day: number) {
    const ev = this.playerEvents();
    if (ev.length !== this.seenEvents) { const minDay = Math.min(...ev.slice(this.seenEvents).map(e => e.day)); this.seenEvents = ev.length; if ([...this.blocks].some(b => b + BLOCK > minDay)) this.reset(); }
    // replay-pure: the talk runs in blocks of BLOCK days, each starting afresh (news, economy, arrangements: an arrangement
    // is carried out inside its own block). Each block is simulated whole, so a day's talk is the same whatever day was asked first.
    const b = Math.floor(day / BLOCK) * BLOCK; if (this.blocks.has(b)) return; this.blocks.add(b);
    for (let d = b; d < b + BLOCK; d++) this.simulate(d);
  }
  private reset() { this.talks.length = 0; this.laid.clear(); this.overlaid.clear(); this.news.clear(); this.busy.clear(); this.blocks.clear(); this.econ = this.makeEcon(); }

  private simulate(day: number) {
    if (day < 0) return;
    if (day % BLOCK === 0) { this.news.clear(); this.busy.clear(); this.econ = this.makeEcon(); for (const e of this.playerEvents()) if (e.ok && e.kind !== 'hold' && e.day < day && e.day >= day - 3) this.carry(e.pid, { src: `player:${e.i}`, hand: 0, day: e.day }); }
    for (const [pid, l] of this.news) { const k = l.filter(x => day - x.day <= 3); if (k.length) this.news.set(pid, k); else this.news.delete(pid); }
    this.econ.step(day); this.nToday = 0;
    // the arrangements due today are carried out (they were laid when made; the economy applies them now)
    for (const T of this.talks) if (T.done && T.done.day === day && T.done.changes.length === 0) { const r = this.econ.applyIntent({ ...T.intent, day }); if (r.ok) T.done.changes = r.changes; else { T.why = 'the economy refused it'; this.unlay(T); } }
    // player-caused changes become news their doer carries from that day
    for (const e of this.playerEvents()) if (e.ok && e.day === day - 0 && e.kind !== 'hold') this.carry(e.pid, { src: `player:${e.i}`, hand: 0, day });
    const P = this.pop, samp = this.opts.sample ?? 0.015, maxT = this.opts.maxTalks ?? 120;
    // who is scanned: a seeded share of the present, plus everyone carrying news
    const who: number[] = [];
    for (let i = 0; i < P.persons.length; i++) { if (!this.eligible(i, day)) continue; if (u01(this.seed, S, i, day) < samp || this.news.has(i)) who.push(i); }
    // news goes where friends and kin are: the carriers' ties and their kin households come into the scan
    const inWho = new Set(who);
    for (const pid of [...this.news.keys()]) { const p = P.persons[pid]; const H = P.households[P.home(pid, day)];
      const more = [...(p.ties ?? []), ...(H?.kin ?? []).flatMap(h => P.households[h]?.members ?? [])];
      for (const q of more) if (q >= 0 && !inWho.has(q) && P.persons[q] && this.eligible(q, day)) { inWho.add(q); who.push(q); } }
    const byPlace = new Map<string, { pid: number; t0: number; t1: number }[]>();
    for (const pid of who) for (const s of P.basePlan(pid, day)) {
      if (s.where === 'road' || s.where === 'away' || s.place.startsWith('@') || !MEET_ACTS.has(s.act) || s.t1 - s.t0 < 0.25) continue;
      (byPlace.get(s.place) ?? byPlace.set(s.place, []).get(s.place)!).push({ pid, t0: s.t0, t1: s.t1 });
    }
    const pairs: { a: number; b: number; h: number; place: string; k: number }[] = []; const met = new Set<string>();
    for (const [place, xs] of byPlace) for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) {
      const x = xs[i], y = xs[j]; if (x.pid === y.pid) continue; const lo = Math.max(x.t0, y.t0), hi = Math.min(x.t1, y.t1); if (hi - lo < 0.25) continue;
      if (P.home(x.pid, day) === P.home(y.pid, day)) continue; const key = x.pid < y.pid ? `${x.pid}:${y.pid}` : `${y.pid}:${x.pid}`; if (met.has(key)) continue; met.add(key);
      pairs.push({ a: x.pid, b: y.pid, h: lo, place, k: h32(this.seed, S, x.pid, y.pid, day) });
    }
    // news-carriers talk first (a stranger's doings are the talk of the lane), then a seeded order
    const hot = (x: number) => +(this.news.get(x) ?? []).some(y => y.src.startsWith('player:'));
    pairs.sort((p, q) => (hot(q.a) + hot(q.b)) - (hot(p.a) + hot(p.b)) || p.k - q.k);
    let n = 0; for (const p of pairs) { if (n >= maxT) break; if (this.talk(p.a, p.b, p.h, p.place, day)) n++; }
  }

  /** who talks and arranges here: people of the town's and the plain's households, 12 and over (the court, the garrison's
   *  and the transient households keep their own orders) */
  private eligible(i: number, day: number) { const P = this.pop, p = P.persons[i]; if (!P.present(i, day) || P.ageOn(i, day) < 12 || p.sub.startsWith('court')) return false; const z = P.households[P.home(i, day)]?.zone; return z === 'town' || z === 'plain'; }
  private carry(pid: number, x: { src: string; hand: number; day: number }) { const l = this.news.get(pid) ?? this.news.set(pid, []).get(pid)!; if (!l.some(y => y.src === x.src)) l.push(x); }

  /** one conversation: what the two arrange (or the news passed), and its consequence laid into the doer's coming days */
  private talk(a: number, b: number, h: number, place: string, day: number): boolean {
    const P = this.pop, ha = P.home(a, day), hb = P.home(b, day);
    // news first: passed to the one who has not heard it (within 3 days of hearing it; the rest is stale)
    for (const [from, to] of [[a, b], [b, a]] as const) {
      const fresh = (this.news.get(from) ?? []).find(x => day - x.day <= 3 && x.hand < (x.src.startsWith('player:') ? 3 : 1) && !(this.news.get(to) ?? []).some(y => y.src === x.src));
      if (fresh) {
        const T: LivingTalk = { id: day * 10000 + this.nToday++, day, h, place, a: from, b: to, doer: to, target: `h:${P.home(to, day)}`, news: { src: fresh.src, hand: fresh.hand + 1 },
          intent: { kind: 'news', from: String(P.home(from, day)), to: String(P.home(to, day)), day, payload: { src: fresh.src } } };
        this.carry(to, { src: fresh.src, hand: fresh.hand + 1, day });
        // the consequence of news: the hearer carries it home and tells the household (a visit home is already in the day;
        // the measurable consequence is its passing on, found in report())
        this.talks.push(T); return true;
      }
    }
    // needs: the one in the greater want asks; the other gives what they have to spare
    const na = this.econ.needsOf(String(ha)), nb = this.econ.needsOf(String(hb));
    const top = (na[0]?.urgency ?? 0) >= (nb[0]?.urgency ?? 0) ? { asker: a, giver: b, need: na[0], hG: hb } : { asker: b, giver: a, need: nb[0], hG: ha };
    if (!top.need || top.need.urgency < 0.1) return false;
    const giverNeeds = top.giver === a ? na : nb; if (giverNeeds.some(x => x.kind === top.need.kind)) return false;
    const kind = KIND_OF[top.need.kind]; const hAsk = P.home(top.asker, day);
    // the doer: goods and help go to the asker's house (the giver walks there); a visit to kin: the asker goes to the giver
    const doer = kind === 'visit' ? top.asker : top.giver; const target = kind === 'visit' ? `h:${top.hG}` : `h:${hAsk}`;
    const intent: Intent = { kind, from: String(P.home(doer, day)), to: String(kind === 'visit' ? top.hG : hAsk), day, payload: { good: top.need.kind, qty: +(0.1 + 0.3 * top.need.urgency).toFixed(2), asker: top.asker, giver: top.giver } };
    const T: LivingTalk = { id: day * 10000 + this.nToday++, day, h, place, a, b, intent, doer, target };
    this.talks.push(T); // (an ordinary arrangement is not news: telling it on changed nothing measurable, D-339)
    this.arrange(T); return true;
  }

  /** lay the Intent into the doer's plan on a free stretch of the next three days */
  private arrange(T: LivingTalk) {
    const P = this.pop;
    // within the talk's own block only (replay purity: a block depends on nothing before it)
    const end = Math.floor(T.day / BLOCK) * BLOCK + BLOCK - 1;
    for (let d = T.day + 1; d <= Math.min(end, T.day + 3); d++) {
      if (!P.present(T.doer, d) || P.sick(T.doer, d) || P.mourning(T.doer, d)) continue;
      const base = P.basePlan(T.doer, d); const tgtWhere = this.whereOf(T.target);
      for (const s of base) {
        if (!FREE.has(s.act) || s.where === 'road' || s.where === 'away' || s.place.startsWith('@') || s.t0 < 7 || s.t1 > 20.5) continue;
        if (this.busy.has(`${T.doer}:${d}:${s.t0}`)) continue;
        const w = s.place === T.target ? 0 : P.walkH(s.place, T.target, d, s.where, tgtWhere); const dur = STAY[T.intent.kind];
        if (s.t1 - s.t0 < 2 * w + dur) continue;
        const h0 = s.t0, h1 = h0 + 2 * w + dur; const why = WHY[T.intent.kind](String(T.intent.payload.good));
        const segs: Seg[] = [];
        if (w > 0.01) segs.push(sg(h0, h0 + w, `road:${tgtWhere}`, 'walk', `${why}: on the way`, 'road'));
        const act = T.intent.payload.good === 'water' && T.intent.kind === 'help' ? 'carry_jar' : ACT[T.intent.kind];
        segs.push({ ...sg(h0 + w, h0 + w + dur, T.target, act, why, tgtWhere), ev: `living:${T.id}` });
        if (w > 0.01) segs.push(sg(h0 + w + dur, h1, `road:${s.where}`, 'walk', 'walking back', 'road'));
        for (const x of segs) if (s.wear) x.wear = s.wear;
        // the day must stay well formed (planCheck): an errand that would break it is not laid here
        const before = new Set(checkPlan(P, T.doer, d, base, null).map(x => x.kind)); if (checkPlan(P, T.doer, d, splice(base, h0, h1, segs), null).some(x => !before.has(x.kind))) continue;
        const k = `${T.doer}:${d}`; (this.laid.get(k) ?? this.laid.set(k, []).get(k)!).push({ h0, h1, segs }); this.overlaid.delete(k); this.busy.add(`${T.doer}:${d}:${s.t0}`);
        T.done = { day: d, h0, h1, changes: [] }; return;
      }
    }
    T.why = 'no free stretch in the doer’s next three days';
  }
  private unlay(T: LivingTalk) { if (!T.done) return; const k = `${T.doer}:${T.done.day}`; const l = this.laid.get(k); if (l) { const i = l.findIndex(x => x.h0 === T.done!.h0); if (i >= 0) l.splice(i, 1); if (!l.length) this.laid.delete(k); } this.overlaid.delete(k); T.done = undefined; }
  private whereOf(place: string): Where { if (place.startsWith('h:')) { const H = this.pop.households[+place.slice(2)]; return H?.zone === 'plain' ? 'plain' : H?.zone === 'terrace' ? 'terrace' : 'town'; } return 'town'; }

  // ---------------------------------------------------------------- the measure (T-E13)
  /** over talks made in days [d0, d1]: the share with a consequence in the sim within 3 days — an arrangement carried out
   *  (laid in the doer's executed plan AND applied by the economy), or news passed on to someone else within 3 days —
   *  and the share of player events whose news reached at least one other person within 3 days */
  report(d0: number, d1: number) {
    for (let d = d0; d <= d1 + 3; d++) this.ensure(d);
    this.forced = true; try { return this.measure(d0, d1); } finally { this.forced = false; }
  }
  private measure(d0: number, d1: number) {
    const ts = this.talks.filter(t => t.day >= d0 && t.day <= d1); let withC = 0; const byKind: Record<string, [number, number]> = {};
    for (const t of ts) {
      let ok = false;
      if (t.news) ok = this.talks.some(u => u.news?.src === t.news!.src && u.a === t.b && u.day > t.day - 1 && u.day <= t.day + 3 && u.id > t.id);
      else if (t.done && t.done.changes.length) { const plan = this.pop.plan(t.doer, t.done.day); ok = plan.some(s => s.ev === `living:${t.id}`); }
      if (ok) withC++; const k = byKind[t.intent.kind] ?? (byKind[t.intent.kind] = [0, 0]); k[1]++; if (ok) k[0]++;
    }
    const pe = this.playerEvents().filter(e => e.ok && e.kind !== 'hold' && e.day >= d0 && e.day <= d1);
    const reached = pe.filter(e => this.talks.some(u => u.news?.src === `player:${e.i}` && u.day <= e.day + 3)).length;
    return { talks: ts.length, withConsequence: withC, share: ts.length ? withC / ts.length : 0, byKind, playerEvents: pe.length, playerPropagated: reached, playerShare: pe.length ? reached / pe.length : 0 };
  }
}

const KIND_OF: Record<NeedKind, Intent['kind']> = { food: 'trade', fuel: 'trade', water: 'help', cash: 'work', help: 'help', health: 'help', kin: 'visit' };
const STAY: Record<Intent['kind'], number> = { trade: 0.4, work: 1.5, help: 1, visit: 1, news: 0.25, loan: 0.3, petition: 0.5 };
const ACT: Record<Intent['kind'], ActivityId> = { trade: 'exchange', work: 'craft', help: 'clean', visit: 'talk', news: 'talk', loan: 'exchange', petition: 'talk' };
const WHY: Record<Intent['kind'], (g: string) => string> = {
  trade: g => `bringing the ${g === 'fuel' ? 'dung cakes and brushwood' : 'barley'} promised to a neighbour in exchange`, work: () => 'a day’s hand at a neighbour’s work, for payment in kind',
  help: g => g === 'water' ? 'carrying water for a neighbour’s household, as promised' : g === 'health' ? 'sitting with the sick of a neighbour’s house, as promised' : 'lending a hand at a neighbour’s house, as promised',
  visit: () => 'visiting kin, as arranged', news: () => 'passing on the news', loan: () => 'bringing a loan of barley, to be repaid at the harvest', petition: () => 'asking a favour, as arranged',
};
function sg(t0: number, t1: number, place: string, act: ActivityId, why: string, where: Where): Seg { return { t0: Math.min(24, t0), t1: Math.min(24, t1), place, act, why, where }; }
