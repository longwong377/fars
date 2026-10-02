// D-370 (UD-25 mechanics 3, 6, 7, 8, 9, 10; UD-24, UD-26, T-F9, T-E13): THE STRANGER IN THE SIMULATION. Node side.
//
// The player is a person of the economy, not a camera: 'player' is an actor of the event graph like any household. What the
// stranger asks for in talk is PROPOSED (by the grammar of speech/verbs.ts or the model's tag) and DECIDED here, by the
// households' own state (their stores, their season, their trust in the stranger, what they believe of who the stranger is,
// how well the stranger speaks their tongue) and keyed draws of (seed, salt, household, day). Six mechanics, one state:
//   (3) work and livelihood: hired by a real household when it wants hands (its harvest, its orders, a sick member, a rich
//       house's service), paid in barley or silver from its own stores on the payday, OWED when it cannot pay (a debt in the
//       economy's own ledger, which its own defaults and suits then follow), dismissed for days missed, let go when the need ends;
//   (6) learning the language: comprehension per language grows with hours heard (more when speech is simplified for the
//       learner, more again when spoken), spills a little to a related tongue, fades unused; people simplify and gesture by
//       their patience (trust) and the learner's level (register()); the translation layer thins (gloss share);
//   (7) identity: who the stranger claims to be (a role and an origin) spreads from the first hearer along kin and the lane,
//       believed by each hearer by their trust in the teller and the claim's own plausibility, and re-weighed day by day
//       against the stranger's deeds (a "merchant" carrying sacks for a farmer, a "Persian" with no Persian); a claim found
//       false is an event (doubted, or denied by the house it named) and costs trust; a claim believed changes treatment
//       (hiring, hospitality, an official's hearing);
//   (8) petitions and authority: the quarter's headman, an official or the court hears the stranger: wages owed, a plea for a
//       house, relief for a house, leave to stay (a sealed travel document, halmi, of the Fortification texts: A in kind), with
//       a delay and a ruling drawn from the evidence, the stranger's standing, the authority's belief, a gift and the tongue;
//       the ruling is carried out in the economy (wages paid or worked off, relief grain, the document);
//   (9) hospitality: guest-right asked of a house, decided by its stores, its trust and belief; the guest eats from its grain
//       (a poor host can go short: a chain into hunger and asks), the custom of three nights (C) and the obligation it leaves,
//       repaid by work or a gift, or turned to a name for ingratitude that the host's kin and lane hear;
//   (10) groups: a work gang of the treasury (rations, the gang's tongue, ties to the gang's houses), a caravan in town (drover's
//       pay while it stays, the news it brings), a household (joined as a hand: its workers and eaters, kin-like trust).
// Every action is a recorded step on a day (do()), applied on that day, saved with the economy and replayed from it: the same
// seed and the same steps give the same world. The model never decides: judge() is the simulation's answer before the words.
// Tier C throughout: the wages, odds, rates and custom lengths are reasoned (by analogy with the Fortification texts' rations
// and travel documents, Neo-Babylonian hire contracts, and the guest-custom of the region), not attested (DECISIONS D-370).
import type { Economy, EconEvent } from '../economy/world';
import { h32, u01, salt } from '../hash';
import { hashString } from '../../core/rng';
import { haggle } from './haggle';
import { dateOf } from '../calendar';

export const PLAYER = 'player';
/** D-370: the stranger's own deeds as the chronicle tells them (the translation layer's journal, key J: out of world) */
export function chronicleLine(kind: string, house: string): string | null {
  const T: Record<string, string> = { hired_stranger: `You were taken on as a hand by ${house}.`, wage_paid: `${house} paid you your wages.`, wage_owed: `${house} could not pay what it owes you.`,
    dismissed: `${house} dismissed you for the days you did not come.`, let_go: `${house} let you go: the work is done.`, left_work: `You left the work at ${house}.`, hand_hired: `Your work kept ${house} going while one of them lay sick.`,
    hosted: `${house} took you in as a guest.`, guest_left: `You left ${house}.`, guest_sent_away: `${house} sent you away: you had given nothing back.`, ingrate: `${house} speaks of you as one who ate their bread and left without thanks.`,
    guest_repaid: `${house} thanks you for your gift.`, stranger_claim: `You told ${house} who you are.`, claim_doubted: `${house} does not believe what you say of yourself.`, claim_denied: `${house} says you are no kin of theirs.`,
    learned_tongue: `${house} notices you now speak their tongue.`, stranger_petition: `Your petition was heard by ${house}.`, ruling_for: `The ruling went for you.`, ruling_against: `The ruling went against you.`,
    halmi_sealed: 'You were given a sealed document: leave to stay and to draw rations.', joined_gang: 'You joined a work gang of the king\'s stores.', left_gang: 'You left the work gang.',
    joined_caravan: 'You hired on as a drover with a caravan in town.', left_caravan: 'The caravan left without you.', joined_house: `${house} took you in as one of the house.`, left_house: `You left ${house}.`,
    stranger_hungry: 'You have not eaten for days.', stranger_chilled: 'Nights in the open have chilled you to the bone.', questioned_by_watch: 'The night watch found you sleeping in the open and questioned you.', held_by_watch: 'The night watch held you till morning: you have no sealed document.', gang_ration_cut: 'The gang\'s rations were cut.', haggle_deal: `You struck a bargain with ${house}.` };
  return T[kind] ?? null;
}
const ROLE_WORDS: Record<string, string> = { labourer: 'a labourer', craftsman: 'a craftsman', merchant: 'a merchant', scribe: 'a scribe', pilgrim: 'a pilgrim', envoy: 'an envoy of the king', soldier: 'a soldier', healer: 'a healer', kin: 'kin of a house here' };
const S = { hire: salt('str-hire'), tell: salt('str-tell'), pet: salt('str-pet'), host: salt('str-host'), lang: salt('str-lang'), head: salt('str-head'), car: salt('str-car'), nb: salt('str-nb') };
const GRAIN_EAT = 0.55;
/** a hired hand's day: ~1 kg barley (a man's ration of 30 qa a month, Fortification texts: A in kind, C in kg) or its silver */
export const WAGE_GRAIN = 1.0;
/** the stranger's days are settled this many days behind the economy's (Stranger.step) */
export const STR_LAG = 4;
/** hearings of a word, its sense shown, before the stranger knows it (C: a handful of meetings in context) */
export const KNOW_AFTER = 6;
/** the comprehension a complex ask needs to be followed (C) */
export const TONGUE_MIN = 0.15;
const PAYDAY = 6, MISS_FIRE = 2, CUSTOM_NIGHTS = 3, SENT_AWAY = 7, GRATITUDE_DAYS = 30;
const DROVER_CASH = 0.05, GANG_GRAIN = 0.9;
/** the languages, by family (a related tongue is learned a third as fast from the other: C) */
export const LANGS = ['Old Persian', 'Elamite', 'Aramaic', 'Babylonian', 'Greek', 'Egyptian'] as const;
const FAMILY: Record<string, string> = { 'Old Persian': 'ir', Median: 'ir', Elamite: 'el', Aramaic: 'sem', Babylonian: 'sem', Greek: 'gr', Egyptian: 'eg', Lydian: 'an' };
/** hours of comprehensible hearing for comprehension 1 - 1/e (C: ~300 h of immersion to follow everyday talk) */
const LANG_K = 200, LANG_HALF = 180;

export type Role = 'labourer' | 'craftsman' | 'merchant' | 'scribe' | 'pilgrim' | 'envoy' | 'soldier' | 'healer' | 'kin';
/** a claim's rank (how it is treated when believed) and its prior (how readily a grand claim is believed: C) */
const ROLE: Record<Role, { rank: number; prior: number }> = {
  labourer: { rank: 0.1, prior: 0.85 }, craftsman: { rank: 0.35, prior: 0.7 }, merchant: { rank: 0.5, prior: 0.6 }, scribe: { rank: 0.6, prior: 0.5 },
  pilgrim: { rank: 0.3, prior: 0.75 }, envoy: { rank: 0.9, prior: 0.35 }, soldier: { rank: 0.45, prior: 0.6 }, healer: { rank: 0.45, prior: 0.55 }, kin: { rank: 0.5, prior: 0.5 } };
/** the home tongue of a claimed origin (exchanges.ts HOME_LANG) */
const ORIGIN_LANG: Record<string, string> = { Persian: 'Old Persian', Median: 'Old Persian', Elamite: 'Elamite', Babylonian: 'Babylonian', Syrian: 'Aramaic', Ionian: 'Greek', Egyptian: 'Egyptian' };

export type Authority = 'headman' | 'official' | 'court';
export type PetitionKind = 'wages' | 'plea' | 'relief' | 'leave';
export type GroupKind = 'gang' | 'caravan' | 'household';
/** what the stranger does (recorded, replayed on its day) */
export type SAct =
  | { a: 'seek_work'; day: number; hh: string }
  | { a: 'quit'; day: number }
  | { a: 'attend'; day: number }
  | { a: 'hear'; day: number; lang: string; hours: number; simple?: number; spoke?: boolean; /** a word taught (lexicon id) */ word?: string }
  | { a: 'claim'; day: number; hh: string; role: Role; origin?: string; kinOf?: string }
  | { a: 'petition'; day: number; to: Authority; kind: PetitionKind; q?: string; against?: string; for?: string; gift?: number }
  | { a: 'stay'; day: number; hh: string }
  | { a: 'leave_stay'; day: number }
  | { a: 'give'; day: number; hh: string; grain?: number; cash?: number }
  | { a: 'join'; day: number; kind: GroupKind; q?: string; hh?: string }
  | { a: 'leave_group'; day: number }
  | { a: 'buy' | 'sell'; day: number; hh: string; good: 'grain' | 'fuel' | 'goods'; qty: number };
export interface Verdict { ok: boolean; why: string; /** the economy events it made (when applied) */ ev?: number[] }

interface Job { employer: string; from: number; wage: 'grain' | 'cash'; worked: number; missed: number; run: number; owed: number; lastPay: number; ev: number; need: string; host?: boolean }
interface Stay { host: string; from: number; nights: number; owed: number; ev: number; warned?: boolean }
interface Debtor { host: string; owed: number; due: number; ev: number; given: number }
interface Petition { n: number; act: Extract<SAct, { a: 'petition' }>; due: number; ev: number }
interface Group { kind: GroupKind; id: string; from: number; ev: number; until?: number }
interface Belief { b: number; day: number; hand: number; doubted?: boolean }

export interface StrangerOpts {
  /** the tongue spoken in a household (the head's origin; default: keyed by the seed, the town's own mix) */
  langOf?: (hh: string) => string;
}

export class Stranger {
  /** the stranger's own stores: wages, rations, drover's pay (what a gift is taken from) */
  purse = { grain: 0, cash: 1, fuel: 0, goods: 0 };
  job: Job | null = null; stay: Stay | null = null; group: Group | null = null;
  /** hours of comprehensible hearing per language, and the day each was last used */
  readonly lang = new Map<string, { x: number; d: number }>();
  claim: { role: Role; origin?: string; kinOf?: string; day: number; ev: number; to: string } | null = null;
  readonly belief = new Map<string, Belief>();
  /** sealed travel document until this day (petition 'leave') */
  halmi = -1;
  readonly debtors: Debtor[] = []; readonly petitions: Petition[] = [];
  /** deeds the claim is weighed against (C) */
  readonly deeds = { labour: 0, craftWork: 0, trades: 0, gifts: 0, tended: 0, gang: 0 };
  /** the steps still to come (by day), and what each verb did: the measured report */
  private acts = new Map<number, SAct[]>(); private petN = 0; private tongueMet = new Set<string>();
  /** D-370 (UD-25 (6)): the words of each tongue the stranger has heard with their sense shown, and how often; a word heard
   *  KNOW_AFTER times (or taught: 'hear' with simple 1) is known: the translation layer stops glossing it (presence.ts) */
  readonly vocab = new Map<string, number>();
  /** D-370: days in a row the stranger has gone without bread (fed by a host, a house joined, a gang's ration, else his own stores) */
  hungry = 0;
  heardWord(id: string, n = 1) { this.vocab.set(id, (this.vocab.get(id) ?? 0) + n); }
  knows(id: string) { return (this.vocab.get(id) ?? 0) >= KNOW_AFTER; }
  /** the hosts the stranger left without thanks: they do not take the stranger in again */
  readonly slighted = new Set<string>();
  readonly stats: Record<string, number> = {};
  /** the days the stranger was at work (the game reports them; settled STR_LAG days later) */
  private attended = new Set<number>(); private qs: Map<string, string[]> | null = null; private heads = new Map<string, string>();
  constructor(readonly E: Economy, readonly opts: StrangerOpts = {}) {}

  // ---------------------------------------------------------------- the steps
  /** record a step; applied at once when its day has come (live play), else on its day (a replay) */
  do(s: SAct): Verdict {
    if (s.day > this.E.day) { const l = this.acts.get(s.day); if (l) l.push(s); else this.acts.set(s.day, [s]); return { ok: true, why: 'later' }; }
    return this.apply(s);
  }
  /** the simulation's answer to a proposed step, without doing it (the words the person says are told this first) */
  /** D-370: can the house follow a complex ask in the stranger's words (a petition, a tale of who he is, a bargain, joining a
   *  house): his comprehension of their tongue, or of Aramaic before an official or the court (the empire's lingua franca: B),
   *  at least TONGUE_MIN; simple asks (bread, a bed, work, a gift) go with gestures (C) */
  understood(s: SAct, day: number): boolean {
    const hh = 'hh' in s ? s.hh : 'q' in s && s.q ? this.headOf(s.q) : undefined;
    const own = hh ? this.comp(this.langOf(hh), day) : 0, ara = this.comp('Aramaic', day);
    if (s.a === 'petition') return Math.max(s.to === 'headman' ? own : 0, ara, s.to === 'headman' ? 0 : this.comp('Elamite', day)) >= TONGUE_MIN;
    return Math.max(own, ara * 0.6) >= TONGUE_MIN;
  }
  judge(s: SAct): Verdict {
    const complex = s.a === 'petition' || (s.a === 'claim' && !!(s as any).origin) || s.a === 'buy' || s.a === 'sell' || (s.a === 'join' && s.kind === 'household');
    if (complex && !this.understood(s, Math.min(s.day, this.E.day))) return { ok: false, why: 'they cannot follow what you ask: you have too few of their words' };
    switch (s.a) {
      case 'seek_work': return this.hireCheck(s.hh, s.day);
      case 'stay': return this.stayCheck(s.hh, s.day);
      case 'join': return this.joinCheck(s, s.day);
      case 'petition': return this.petitionCheck(s);
      case 'give': { const g = s.grain ?? 0, c = s.cash ?? 0; return g > this.purse.grain + 1e-9 || c > this.purse.cash + 1e-9 ? { ok: false, why: 'the stranger has not got it' } : { ok: true, why: 'a gift' }; }
      case 'claim': return { ok: true, why: 'said' };
      case 'buy': case 'sell': return this.deal(s, false);
      default: return { ok: true, why: '' };
    }
  }
  private bump(k: string) { this.stats[k] = (this.stats[k] ?? 0) + 1; }
  private ev(kind: string, causes: (number | undefined)[], actor: string, other?: string, amt?: number) { this.bump(kind); return this.E.record(this.E.day, actor, kind, causes, other, amt); }
  private H(id: string) { return this.E.hh.get(id); }
  private trust(hh: string) { return this.E.trust ? this.E.trust.trustOf(hh, PLAYER, this.E.day) : 0.5; }

  private apply(s: SAct): Verdict {
    // (judged on the step's own day, the day the person was told the verdict: the living world runs the economy a few days
    // ahead of the present for the day plans, so E.day may already be later; the events are dated by the economy)
    const day = Math.min(s.day, this.E.day);
    const complex = s.a === 'petition' || (s.a === 'claim' && !!s.origin) || s.a === 'buy' || s.a === 'sell' || (s.a === 'join' && s.kind === 'household');
    if (complex && !this.understood(s, day)) { this.bump('not_understood'); return { ok: false, why: 'they cannot follow what you ask: you have too few of their words' }; }
    switch (s.a) {
      case 'attend': this.attended.add(s.day); return { ok: true, why: 'at work' };
      case 'hear': this.hear(s.lang, s.hours, s.simple ?? 0, !!s.spoke, day); if (s.word) this.heardWord(s.word, Math.ceil(KNOW_AFTER / 2)); return { ok: true, why: 'heard' };
      case 'seek_work': { const v = this.hireCheck(s.hh, day); if (!v.ok) { this.bump('hire_refused'); return v; }
        this.endJob('quit', day); const H = this.H(s.hh)!;
        const e = this.ev('hired_stranger', [H.cause.help, H.cause.food], s.hh, PLAYER);
        this.job = { employer: s.hh, from: day, wage: H.grain > H.eaters * GRAIN_EAT * 30 ? 'grain' : 'cash', worked: 0, missed: 0, run: 0, owed: 0, lastPay: day, ev: e, need: v.why };
        return { ok: true, why: v.why, ev: [e] }; }
      case 'quit': this.endJob('quit', day); return { ok: true, why: 'left the work' };
      case 'claim': return this.makeClaim(s, day);
      case 'petition': { const v = this.petitionCheck(s); if (!v.ok) return v;
        const delay = s.to === 'headman' ? 1 + (h32(this.E.seed, S.pet, this.petN, day) % 2) : s.to === 'official' ? 3 + (h32(this.E.seed, S.pet, this.petN, day) % 6) : 6 + (h32(this.E.seed, S.pet, this.petN, day) % 10);
        const cz = s.kind === 'wages' ? this.owedEvents(s.against) : s.for ? [this.H(s.for)?.cause.food, this.H(s.for)?.cause.cash] : [];
        const e = this.ev('stranger_petition', cz, PLAYER, s.to === 'headman' ? this.headOf(s.q ?? this.homeQ() ?? '') ?? 'court' : 'court');
        if (s.gift) { const g = Math.min(s.gift, this.purse.cash); this.purse.cash -= g; }
        this.petitions.push({ n: this.petN++, act: s, due: day + delay, ev: e }); return { ok: true, why: 'heard; the ruling in a few days', ev: [e] }; }
      case 'stay': { const v = this.stayCheck(s.hh, day); if (!v.ok) { this.bump('stay_refused'); return v; }
        this.endStay(day); const H = this.H(s.hh)!; const e = this.ev('hosted', [this.claim?.ev], s.hh, PLAYER);
        this.stay = { host: s.hh, from: day, nights: 0, owed: 0, ev: e }; void H; return { ok: true, why: v.why, ev: [e] }; }
      case 'leave_stay': this.endStay(day); return { ok: true, why: 'left' };
      case 'give': return this.give(s.hh, s.grain ?? 0, s.cash ?? 0, day);
      case 'join': { const v = this.joinCheck(s, day); if (!v.ok) { this.bump('join_refused'); return v; }
        this.leaveGroup(day); return this.joinGroup(s, day, v.why); }
      case 'leave_group': this.leaveGroup(day); return { ok: true, why: 'left' };
      case 'buy': case 'sell': return this.deal(s, true);
    }
  }

  // ---------------------------------------------------------------- (3) work and livelihood
  /** why a house wants a hand today, or '' (C: the harvest's three weeks, a craft's orders, a sick member, a rich house) */
  wantsHand(hh: string, day: number): string {
    const H = this.H(hh); if (!H || H.dead) return '';
    if ((H.kind === 'farmer' || H.kind === 'rich') && day >= H.harvestDay - 8 && day <= H.harvestDay + 14) return 'the harvest';
    if (H.sickUntil > day && H.workers <= 2 && H.kind !== 'ration') return 'a hand while one of the house is sick';
    if (H.kind === 'craft' && this.E.market.goodsDemand >= 0.9) return 'orders to fill';
    if (H.kind === 'herder' && day % 354 < 60) return 'the lambing';
    if (H.kind === 'rich') return 'the service of a great house';
    if (H.workers === 0 && H.kind !== 'ration') return 'no one left to work';
    return '';
  }
  private canPay(hh: string) { const H = this.H(hh)!; return H.grain > H.eaters * GRAIN_EAT * 20 + WAGE_GRAIN * PAYDAY || H.cash > this.E.price('grain', this.E.day) * WAGE_GRAIN * PAYDAY; }
  hireCheck(hh: string, day: number): Verdict {
    const H = this.H(hh); if (!H || H.dead) return { ok: false, why: 'no such house' };
    if (this.job?.employer === hh) return { ok: false, why: 'already working for them' };
    if (this.group?.kind === 'household' && this.group.id === hh) return { ok: false, why: 'the stranger is one of the house' };
    const need = this.wantsHand(hh, day); if (!need) return { ok: false, why: 'they need no hands now' };
    if (!this.canPay(hh) && !this.stay) return { ok: false, why: 'they cannot pay a hand' };
    const t = this.trust(hh), r = this.regard(hh, day), b = this.belief.get(hh);
    if (b?.doubted) return { ok: false, why: 'they think the stranger a liar' };
    // a believed grand claim is not hired to carry sacks (a scribe is, by the rich and the crafts; C)
    if (r.rank >= 0.85 && r.belief > 0.5) return { ok: false, why: 'not work for one of rank' };
    const tongue = this.comp(this.langOf(hh), day);
    const p = 0.35 + 0.6 * (t - 0.5) + 0.25 * tongue + (this.stay?.host === hh ? 0.25 : 0) + (r.belief > 0.5 && (this.claim?.role === 'craftsman' && H.kind === 'craft' || this.claim?.role === 'scribe' && H.kind === 'rich') ? 0.2 : 0) + (this.halmi >= day ? 0.1 : 0);
    if (t < 0.3) return { ok: false, why: 'they do not trust the stranger' };
    return u01(this.E.seed, S.hire, hashString(hh) | 0, day) < p ? { ok: true, why: need } : { ok: false, why: 'they will not take on a stranger' };
  }
  private workDay(day: number) {
    const J = this.job; if (!J) return; const H = this.H(J.employer);
    if (!H || H.dead) { this.endJob('let_go', day); return; }
    if (this.attended.has(day)) {
      J.worked++; J.run = 0; this.deeds.labour++; if (H.kind === 'craft') this.deeds.craftWork++;
      // what the hand's day is worth to the house (C): the crop got in, goods made, a sick member's work done
      if (J.need === 'the harvest') H.grain += 3; else if (H.kind === 'craft') H.goods += 0.15; else if (H.kind === 'herder') H.goods += 0.1;
      if (J.worked === 3 && H.cause.help !== undefined && H.sickUntil > day) H.cause.help = this.ev('hand_hired', [H.cause.help, J.ev], J.employer, PLAYER);
      this.hear(this.langOf(J.employer), 6, 0.5, true, day);
      if (!J.host) J.owed += 1;
    } else if (++J.run >= MISS_FIRE) { this.endJob('dismissed', day); return; }
    if (day - J.lastPay >= PAYDAY) this.payday(day);
    if (!this.wantsHand(J.employer, day) && day - J.from > 2) this.endJob('let_go', day);
  }
  private payday(day: number) {
    const J = this.job!, H = this.H(J.employer)!; J.lastPay = day; if (J.owed <= 0) return;
    const pG = this.E.price('grain', day), due = J.owed * WAGE_GRAIN;
    const g = Math.min(due, Math.max(0, H.grain - H.eaters * GRAIN_EAT * 15)), rest = (due - g) * pG, c = Math.min(rest, H.cash);
    H.grain -= g; H.cash -= c; this.purse.grain += g; this.purse.cash += c; const paid = g + c / pG;
    J.owed = Math.max(0, J.owed - paid / WAGE_GRAIN);
    if (paid > 0.01) this.ev('wage_paid', [J.ev], J.employer, PLAYER, +paid.toFixed(2));
    if (J.owed > 0.5) { const e = this.ev('wage_owed', [J.ev, H.cause.food, H.cause.cash], J.employer, PLAYER, +(J.owed * WAGE_GRAIN).toFixed(2)); H.cause.cash = H.cause.cash ?? e; }
  }
  private endJob(how: 'quit' | 'dismissed' | 'let_go', day: number) {
    const J = this.job; if (!J) return; this.job = null; const H = this.H(J.employer);
    if (H && !H.dead && J.owed > 0.5 && !J.host) { // what is owed stands as a debt in the economy's own ledger (its dues, defaults, suits)
      const pG = this.E.price('grain', day), amt = +(J.owed * WAGE_GRAIN * pG).toFixed(4);
      const e = this.ev('wage_owed', [J.ev], J.employer, PLAYER, amt); this.E.owe(J.employer, PLAYER, amt, day + 20, e); }
    this.ev(how === 'quit' ? 'left_work' : how, [J.ev], J.employer, PLAYER, J.worked);
    // walking off in the harvest is remembered (C)
    if (how === 'quit' && J.need === 'the harvest' && this.E.trust) this.E.trust.note(J.employer, PLAYER, -0.1, day);
  }
  /** wages the economy repaid to the stranger (Economy.due, a debt to 'player') */
  repaid(amt: number) { this.purse.cash += amt; }
  /** wages a house owes the stranger now: a debt in its ledger, or the job's unpaid days */
  owesNow(hh: string) { return (this.H(hh)?.debts.some(d => d.to === PLAYER && d.amt > 0.005) ?? false) || (this.job?.employer === hh && this.job.owed > 0.5); }
  /** the matters judged (kind|against|for -> the day of the ruling): not heard again for 90 days (C) */
  readonly judged = new Map<string, number>();
  private owedEvents(against?: string) { return this.E.events.filter(e => e && e.kind === 'wage_owed' && e.other === PLAYER && (!against || e.actor === against)).slice(-3).map(e => e.id); }

  // ---------------------------------------------------------------- (4) haggling, the stranger's side (D-370)
  /** buy from a house or sell to it, haggled by speech/haggle.ts (the house's need, trust and skill against the stranger's: the
   *  stranger haggles at a middling skill, worse while the tongue is poor), paid from and into the stranger's own stores */
  private deal(s: Extract<SAct, { a: 'buy' | 'sell' }>, apply: boolean): Verdict {
    const day = Math.min(s.day, this.E.day), H = this.H(s.hh); if (!H || H.dead) return { ok: false, why: 'no such house' };
    const have = (g: string) => (this.purse as any)[g] ?? 0, skill = 0.35 + 0.3 * this.comp(this.langOf(s.hh), day);
    if (s.a === 'sell' && have(s.good) < s.qty) return { ok: false, why: 'the stranger has not got it' };
    const r = haggle(this.E, s.a === 'buy' ? { buyer: PLAYER, seller: s.hh, good: s.good, qty: s.qty, day, pay: 'cash', skill: { buyer: skill }, apply: false } : { buyer: s.hh, seller: PLAYER, good: s.good, qty: s.qty, day, pay: 'cash', skill: { seller: skill }, apply: false });
    if (!r.ok) return { ok: false, why: r.why === 'seller has no spare' ? 'they have none to spare' : r.why === 'no overlap' ? 'they will not come to a price' : r.why === 'buyer cannot pay' ? 'they cannot pay for it' : r.why ?? 'no deal' };
    if (s.a === 'buy' && this.purse.cash < r.price) return { ok: false, why: 'the stranger has not the silver for it' };
    if (!apply) return { ok: true, why: `a deal at about ${r.price.toFixed(2)} of silver` };
    for (const i of r.intents) this.E.enter(i);
    const sign = s.a === 'buy' ? 1 : -1; this.purse.cash -= sign * r.price; (this.purse as any)[s.good] = have(s.good) + sign * s.qty; this.deeds.trades++;
    return { ok: true, why: 'a deal', ev: [this.E.events.length - 1] };
  }

  /** the stranger's bread for the day (a man's ration of ~0.8 kg, C): the host's table, the house he belongs to, the gang's
   *  ration day, a day worked for a house that feeds its hands; else his own stores; else hunger, which people see */
  private fedOn = -1;
  private eat(day: number) {
    if (this.fedOn >= day || !this.active) return; this.fedOn = day; this.night(day);
    const fed = !!this.stay || this.group?.kind === 'household' || (this.group?.kind === 'gang' && this.attended.has(day)) || (!!this.job && this.attended.has(day));
    if (fed) { this.hungry = 0; return; }
    if (this.purse.grain >= 0.8) { this.purse.grain -= 0.8; this.hungry = 0; return; }
    const cost = 0.8 * this.E.price('grain', day); if (this.purse.cash >= cost) { this.purse.cash -= cost; this.hungry = 0; return; }
    if (++this.hungry === 3) this.ev('stranger_hungry', [], PLAYER);
  }
  /** D-370: where the stranger sleeps: a host's or his house's roof, the gang's camp, the caravan's lines; else in the open, where a
   *  winter night chills him (seen, pitied) and the night watch, finding a stranger without a sealed document, questions him and
   *  now and then holds him till morning (C; the Fortification texts' travel documents, A in kind) */
  chilled = -1;
  private night(day: number) {
    if (this.stay || this.group) return; const m = dateOf(day).month, winter = m >= 10 || m <= 0;
    if (winter && u01(this.E.seed, S.host, 77, day) < 0.35) { if (this.chilled < day - 3) this.ev('stranger_chilled', [], PLAYER); this.chilled = day; }
    if (this.halmi < day && u01(this.E.seed, S.pet, 78, day) < 0.12) { const held = u01(this.E.seed, S.pet, 79, day) < 0.3;
      this.ev(held ? 'held_by_watch' : 'questioned_by_watch', [], 'court', PLAYER); if (held && this.E.trust) this.E.trust.note('court', PLAYER, -0.02, day); }
  }

  // ---------------------------------------------------------------- (6) learning the language
  langOf(hh: string): string {
    if (this.opts.langOf) return this.opts.langOf(hh);
    const u = u01(this.E.seed, S.lang, hashString(hh) | 0); return u < 0.4 ? 'Elamite' : u < 0.7 ? 'Old Persian' : u < 0.9 ? 'Aramaic' : 'Babylonian';
  }
  private xOf(l: string, day: number) { const r = this.lang.get(l); return !r ? 0 : day > r.d ? r.x * Math.pow(0.5, (day - r.d) / LANG_HALF) : r.x; }
  /** comprehension of a tongue, 0..1 (its own hours, and a third of a related tongue's) */
  comp(l: string, day: number): number {
    let x = this.xOf(l, day); for (const o of this.lang.keys()) if (o !== l && FAMILY[o] && FAMILY[o] === FAMILY[l]) x += this.xOf(o, day) / 3;
    return 1 - Math.exp(-x / LANG_K);
  }
  /** hours heard: simplified speech teaches more to a beginner (comprehensible input), speaking back more again (C) */
  hear(l: string, hours: number, simple: number, spoke: boolean, day: number) {
    const c = this.comp(l, day), gain = hours * (0.5 + 0.5 * simple * (1 - c) + 0.5 * c) * (spoke ? 1.4 : 1);
    const r = this.lang.get(l); this.lang.set(l, { x: this.xOf(l, day) + gain, d: Math.max(day, r?.d ?? day) });
  }
  /** how a person speaks to the stranger: simplify (slower, fewer words), gesture, and the translation layer's share (C) */
  register(l: string, day: number, trust = 0.5, busy = false) {
    const c = this.comp(l, day), patience = (0.4 + 0.6 * trust) * (busy ? 0.5 : 1);
    return { comp: +c.toFixed(3), simplify: +Math.min(1, (1 - c) * patience * 1.2).toFixed(3), gesture: +Math.max(0, Math.min(1, ((1 - c) * 1.2 - 0.1) * patience)).toFixed(3), gloss: +(1 - Math.pow(c, 1.3)).toFixed(3) };
  }
  /** a house the stranger has lived or worked with notices when the stranger first speaks its tongue (C: at comprehension 0.5) */
  private tongueDay(day: number) {
    for (const hh of [this.job?.employer, this.stay?.host, this.group?.kind === 'household' ? this.group.id : undefined]) {
      if (!hh || this.tongueMet.has(hh)) continue; const l = this.langOf(hh);
      if (this.comp(l, day) >= 0.5) { this.tongueMet.add(hh); this.ev('learned_tongue', [this.job?.ev, this.stay?.ev], PLAYER, hh); }
    }
  }

  // ---------------------------------------------------------------- (7) identity
  private makeClaim(s: Extract<SAct, { a: 'claim' }>, day: number): Verdict {
    const changed = !this.claim || this.claim.role !== s.role || this.claim.origin !== s.origin;
    if (changed && this.claim) { // a second, different story: those who heard the first doubt both (C)
      for (const [hh, b] of this.belief) { b.b *= 0.5; if (b.b < 0.25 && !b.doubted) this.doubt(hh, 'claim_doubted', day); } }
    // the same story told again to a house that has it already: nothing new is said (D-391: not a fresh claim each greeting)
    const had = this.belief.get(s.hh); if (!changed && had && s.role !== 'kin') return { ok: true, why: had.doubted || had.b < 0.5 ? 'doubted' : 'believed', ev: [] };
    const e = this.ev('stranger_claim', [], PLAYER, s.hh);
    if (changed) this.claim = { role: s.role, origin: s.origin, kinOf: s.kinOf, day, ev: e, to: s.hh };
    // the house told hears it from the stranger's own mouth
    const prev = this.belief.get(s.hh);
    if (s.role === 'kin' && s.kinOf) { // a house named as kin knows at once; its kin very soon (C)
      const K = this.H(s.kinOf); const truly = this.group?.kind === 'household' && this.group.id === s.kinOf;
      if (K && !truly && (s.hh === s.kinOf || K.kin.includes(s.hh))) { this.belief.set(s.hh, { b: 0, day, hand: 0, doubted: false }); this.doubt(s.hh, 'claim_denied', day); return { ok: false, why: 'they know it is not so', ev: [e] }; }
    }
    const b0 = this.plausible(s.hh, day);
    this.belief.set(s.hh, { b: prev ? (prev.b + b0) / 2 : b0, day, hand: 0, doubted: prev?.doubted });
    return { ok: true, why: b0 >= 0.5 ? 'believed' : 'doubted', ev: [e] };
  }
  /** how believable the claim is to a house on a day: the role's prior, its trust, and the deeds against it (C) */
  plausible(hh: string, day: number): number {
    const C = this.claim; if (!C) return 0; const R = ROLE[C.role];
    let x = R.prior + 0.4 * (this.trust(hh) - 0.5) + 0.35 * this.consistency(day);
    if (C.origin && ORIGIN_LANG[C.origin]) x += this.comp(ORIGIN_LANG[C.origin], day) < 0.3 ? -0.3 : 0.1; // a "Persian" without Persian
    return Math.max(0, Math.min(1, x));
  }
  /** the stranger's deeds weighed against the claim, -1..1 (C) */
  consistency(day: number): number {
    const C = this.claim; if (!C) return 0; const d = this.deeds, lab = Math.min(1, d.labour / 10);
    switch (C.role) {
      case 'labourer': return 0.3 + 0.5 * lab;
      case 'craftsman': return Math.min(1, d.craftWork / 5) - 0.3 * Math.max(0, lab - Math.min(1, d.craftWork / 5));
      case 'merchant': return Math.min(1, d.trades / 3 + this.purse.cash / 10) - 0.8 * lab;
      case 'scribe': return (this.comp('Aramaic', day) >= 0.6 ? 0.5 : -0.4) - 0.5 * lab;
      case 'envoy': return (this.halmi >= day ? 0.6 : day - C.day > 10 ? -0.6 : 0) - lab;
      case 'healer': return Math.min(1, d.tended / 2) - 0.2;
      case 'pilgrim': return 0.2 - 0.3 * Math.min(1, d.gang / 20);
      case 'soldier': return 0.1;
      case 'kin': return this.group?.kind === 'household' && this.group.id === C.kinOf ? 1 : 0;
    }
  }
  private doubt(hh: string, kind: 'claim_doubted' | 'claim_denied', day: number) {
    const b = this.belief.get(hh); if (b) b.doubted = true; this.ev(kind, [this.claim?.ev], hh, PLAYER);
    // the house's kin hear it at once (the trust ledger's news)
    const H = this.H(hh); if (H && this.E.trust) for (const k of H.kin) this.E.trust.hear(k, PLAYER, kind === 'claim_denied' ? 'claim_denied' : 'claim_doubted', day);
  }
  /** what a house makes of the stranger: its belief in the claim, the claim's rank, its trust */
  regard(hh: string, day: number) { const b = this.belief.get(hh); return { belief: b && !b.doubted ? b.b : 0, rank: this.claim ? ROLE[this.claim.role].rank : 0, trust: this.trust(hh), doubted: !!b?.doubted }; }
  private quarters() { if (!this.qs) { this.qs = new Map(); for (const h of this.E.hh.values()) { const l = this.qs.get(h.q); if (l) l.push(h.id); else this.qs.set(h.q, [h.id]); } } return this.qs; }
  /** the claim moves on: each holder tells kin and two of the lane, believed by the hearer's trust and the claim's sense (C) */
  private spread(day: number) {
    if (!this.claim) return; const qs = this.quarters(), add: [string, Belief][] = [];
    for (const [hh, B] of this.belief) {
      // the holder weighs it again: fast if they see the stranger daily, slowly from afar
      const close = hh === this.job?.employer || hh === this.stay?.host || (this.group?.kind === 'household' && this.group.id === hh);
      const target = this.plausible(hh, day); B.b += (target - B.b) * (close ? 0.2 : 0.03);
      if (!B.doubted && B.b < 0.25 && (close || B.hand === 0) && day - this.claim.day >= 3) this.doubt(hh, 'claim_doubted', day);
      if (day - B.day > 20 || B.hand >= 5) continue;
      const H = this.H(hh); if (!H) continue; const lane = qs.get(H.q) ?? [];
      const ties = [...H.kin, ...[0, 1].map(i => lane[h32(this.E.seed, S.nb, hashString(hh) | 0, i) % lane.length])];
      for (const [i, t] of ties.entries()) {
        if (!t || t === hh || this.belief.has(t) || add.some(x => x[0] === t)) continue;
        if (u01(this.E.seed, S.tell, hashString(hh) | 0, day * 8 + i) >= 0.15) continue;
        const tt = this.E.trust ? this.E.trust.trustOf(t, hh, day) : 0.5, sense = this.plausible(t, day);
        add.push([t, { b: Math.max(0, Math.min(1, (B.doubted ? 0.1 : B.b) * (0.5 + 0.5 * tt) * 0.6 + sense * 0.4)), day, hand: B.hand + 1 }]);
      }
    }
    for (const [k, v] of add) this.belief.set(k, v);
  }
  /** the share of households that have heard the claim, and the share of those who believe it */
  claimReach() { let n = 0, yes = 0; for (const b of this.belief.values()) { n++; if (!b.doubted && b.b >= 0.5) yes++; } return { heard: n, believed: yes }; }

  // ---------------------------------------------------------------- (8) petitions and authority
  /** the headman of a quarter: a house of standing there, fixed by the seed (C: the town's elders, by analogy) */
  headOf(q: string): string | undefined {
    if (this.heads.has(q)) return this.heads.get(q);
    const l = (this.quarters().get(q) ?? []).filter(id => { const H = this.H(id)!; return H.kind !== 'ration'; });
    let best: string | undefined, bv = Infinity; for (const id of l) { const H = this.H(id)!; const v = (H.kind === 'rich' ? 0 : 1) * 1e10 + h32(this.E.seed, S.head, hashString(id) | 0); if (v < bv) { bv = v; best = id; } }
    this.heads.set(q, best!); return best;
  }
  private homeQ() { const h = this.stay?.host ?? (this.group?.kind === 'household' ? this.group.id : this.job?.employer); return h ? this.H(h)?.q : undefined; }
  petitionCheck(s: Extract<SAct, { a: 'petition' }>): Verdict {
    if (this.petitions.some(p => p.act.kind === s.kind && p.act.against === s.against && p.act.for === s.for)) return { ok: false, why: 'already before them' };
    if (s.kind === 'leave' && s.to !== 'official') return { ok: false, why: 'only an official seals a document' };
    if (s.kind === 'wages' && (!s.against || !this.owesNow(s.against))) return { ok: false, why: 'nothing owed by them' };
    const k = `${s.kind}|${s.against ?? ''}|${s.for ?? ''}`, last = this.judged.get(k);
    if (last !== undefined && this.E.day - last < 90) return { ok: false, why: 'the matter was judged already' };
    if ((s.kind === 'plea' || s.kind === 'relief') && !this.H(s.for ?? '')) return { ok: false, why: 'for no house' };
    if (s.to === 'headman' && !this.headOf(s.q ?? this.homeQ() ?? '')) return { ok: false, why: 'no headman found' };
    return { ok: true, why: 'they will hear it' };
  }
  private rule(P: Petition, day: number) {
    const s = P.act, T = this.E.trust, judge = s.to === 'headman' ? this.headOf(s.q ?? this.homeQ() ?? '') : undefined;
    const stand = T ? T.standing(PLAYER, day) : 0, against = s.against && T ? T.standing(s.against, day) : 0;
    const R = judge ? this.regard(judge, day) : (() => { const r = this.claimReach(); return { belief: r.heard ? r.believed / r.heard : 0, rank: this.claim ? ROLE[this.claim.role].rank : 0 }; })();
    const tongue = this.comp(judge ? this.langOf(judge) : 'Elamite', day); // (the officials' tongue at Persepolis: Elamite, the tablets' language: A)
    const base = { wages: 0.6, plea: 0.5, relief: 0.4, leave: 0.35 }[s.kind];
    const p = base + 0.5 * stand - 0.3 * against + 0.25 * R.belief * R.rank + Math.min(0.2, (s.gift ?? 0) * 0.5) + (tongue < 0.3 ? -0.15 : 0) + (this.halmi >= day ? 0.1 : 0) + (s.to === 'court' ? -0.05 : 0);
    const ok = u01(this.E.seed, S.pet, P.n, day) < p;
    this.judged.set(`${s.kind}|${s.against ?? ''}|${s.for ?? ''}`, day);
    const out = this.ev(ok ? 'ruling_for' : 'ruling_against', [P.ev], s.to === 'headman' ? judge ?? 'court' : 'court', PLAYER);
    if (!ok) { if (s.against && T) T.note(s.against, PLAYER, -0.1, day); return; }
    if (s.kind === 'wages' && s.against) { // the debtor pays what it can now; the rest is worked off in the economy's own way
      const H = this.H(s.against)!, debt = H.debts.find(d => d.to === PLAYER), amt = debt?.amt ?? (this.job?.employer === s.against ? this.job.owed * WAGE_GRAIN * this.E.price('grain', day) : 0);
      if (amt <= 0) return; const c = Math.min(amt, H.cash); H.cash -= c; this.purse.cash += c;
      if (debt) debt.amt -= c; else if (this.job) this.job.owed = Math.max(0, this.job.owed - c / (WAGE_GRAIN * this.E.price('grain', day)));
      if (c > 0) this.ev('wage_paid', [out], s.against, PLAYER, +c.toFixed(3));
      if (amt - c > 0.05) { if (debt) debt.amt = 0; if (this.job?.employer === s.against) this.job.owed = 0; this.E.bindFor(s.against, PLAYER, amt - c, day, out); }
    } else if (s.kind === 'plea' && s.for) this.E.enter({ kind: 'petition', from: PLAYER, to: s.for, day, payload: { days: 60, causes: [out] } });
    else if (s.kind === 'relief' && s.for) { const H = this.H(s.for)!, g = H.eaters * GRAIN_EAT * 20; if (this.E.treasury.grain > g) { this.E.treasury.grain -= g; H.grain += g; H.cause.food = this.ev('relief', [out], 'treasury', s.for, g); } }
    else if (s.kind === 'leave') { this.halmi = day + 180; this.ev('halmi_sealed', [out], 'treasury', PLAYER); }
  }

  // ---------------------------------------------------------------- (9) hospitality
  stayCheck(hh: string, day: number): Verdict {
    const H = this.H(hh); if (!H || H.dead) return { ok: false, why: 'no such house' };
    if (this.stay?.host === hh) return { ok: false, why: 'already their guest' };
    const r = this.regard(hh, day); if (r.doubted) return { ok: false, why: 'they think the stranger a liar' };
    if (this.slighted.has(hh)) return { ok: false, why: 'the stranger left without thanks before' };
    const spare = H.grain - H.eaters * GRAIN_EAT * 15;
    if (spare < GRAIN_EAT * 4 && !(this.claim?.role === 'pilgrim' && r.belief > 0.5)) return { ok: false, why: 'they have barely bread for their own' };
    if (H.mourning > day) return { ok: false, why: 'a house in mourning' };
    const p = 0.55 + 0.8 * (r.trust - 0.5) + 0.25 * r.belief * r.rank + (this.hungry >= 2 || this.chilled >= day - 3 ? 0.15 : 0) /* (pity for a hungry or chilled stranger: C) */ + (this.claim?.role === 'pilgrim' && r.belief > 0.5 ? 0.15 : 0) + (this.tongueMet.has(hh) ? 0.1 : 0) + (H.kind === 'rich' ? 0.1 : 0) - (H.kind === 'ration' ? 0.1 : 0);
    return u01(this.E.seed, S.host, hashString(hh) | 0, day) < p ? { ok: true, why: 'guest-right' } : { ok: false, why: 'they will not take a stranger in' };
  }
  private stayNight(day: number) {
    const St = this.stay!; const H = this.H(St.host);
    if (!H || H.dead) { this.endStay(day); return; }
    St.nights++; const meal = GRAIN_EAT * 1.2; H.grain = Math.max(0, H.grain - meal); // (a guest is fed better than the house: C)
    const working = this.job?.employer === St.host;
    if (working) this.job!.host = true; else St.owed += meal * this.E.price('grain', day);
    this.hear(this.langOf(St.host), 3, 0.6, true, day);
    if (H.grain < H.eaters * GRAIN_EAT * 8 && H.cause.food === undefined) H.cause.food = this.ev('guest_strain', [St.ev], St.host, PLAYER); // a poor host goes short
    if (!working && St.nights > CUSTOM_NIGHTS && St.owed > 0.01) { // (a guest who works or gives keeps the welcome)
      if (this.E.trust) this.E.trust.note(St.host, PLAYER, -0.03, day); // patience thins after the custom's three nights (C)
      if (St.nights >= SENT_AWAY) { this.ev('guest_sent_away', [St.ev], St.host, PLAYER); this.endStay(day); }
    }
  }
  private endStay(day: number) {
    const St = this.stay; if (!St) return; this.stay = null; if (this.job?.employer === St.host) this.job.host = false;
    const e = this.ev('guest_left', [St.ev], PLAYER, St.host, St.nights);
    if (St.owed > 0.005) this.debtors.push({ host: St.host, owed: St.owed, due: day + GRATITUDE_DAYS, ev: e, given: 0 });
  }
  private give(hh: string, g: number, c: number, day: number): Verdict {
    const v = this.judge({ a: 'give', day, hh, grain: g, cash: c }); if (!v.ok) return v; const H = this.H(hh); if (!H) return { ok: false, why: 'no such house' };
    this.purse.grain -= g; this.purse.cash -= c; this.deeds.gifts++;
    const worth = c + g * this.E.price('grain', day);
    for (const d of this.debtors) if (d.host === hh) d.given += worth; if (this.stay?.host === hh) this.stay.owed = Math.max(0, this.stay.owed - worth);
    const cz = [H.cause.food, H.cause.cash].filter((x): x is number => x !== undefined);
    if (H.sickUntil > day) this.deeds.tended++;
    this.E.enter({ kind: 'help', from: PLAYER, to: hh, day, payload: { grain: g, cash: c, causes: cz } });
    return { ok: true, why: 'given' };
  }
  private gratitude(day: number) {
    for (let i = this.debtors.length - 1; i >= 0; i--) { const d = this.debtors[i]; if (day < d.due && d.given < d.owed) continue;
      this.debtors.splice(i, 1);
      if (d.given >= d.owed * 0.5) this.ev('guest_repaid', [d.ev], PLAYER, d.host);
      // a guest with nothing to give owes thanks, not bread: the host thinks less of him, the lane hears nothing (D-391, C)
      else if (this.purse.cash + this.purse.grain * this.E.price('grain', day) < (d.owed - d.given) * 0.5) { if (this.E.trust) this.E.trust.note(d.host, PLAYER, -0.04, day); }
      else { this.slighted.add(d.host); this.ev('ingrate', [d.ev], PLAYER, d.host); const H = this.H(d.host); if (H && this.E.trust) for (const k of [...H.kin, ...(this.quarters().get(H.q) ?? []).slice(0, 6)]) this.E.trust.hear(k, PLAYER, 'ingrate', day); } }
  }

  // ---------------------------------------------------------------- (10) groups
  /** a caravan in town: one came in the last six days (the economy's grain caravans) */
  caravanIn(day: number): EconEvent | undefined { for (let i = this.E.events.length - 1; i >= 0; i--) { const e = this.E.events[i]; if (!e) continue; if (e.day < day - 6) break; if (e.kind === 'grain_brought') return e; } return undefined; }
  joinCheck(s: Extract<SAct, { a: 'join' }>, day: number): Verdict {
    if (s.kind === 'gang') { if (this.group?.kind === 'gang') return { ok: false, why: 'already in a gang' }; return this.E.treasury.grain > 100 ? { ok: true, why: this.halmi >= day ? 'on the rolls, full rations' : 'taken on, half rations without a sealed document' } : { ok: false, why: 'the stores take on no one' }; }
    if (s.kind === 'caravan') { const c = this.caravanIn(day); if (!c) return { ok: false, why: 'no caravan in town' }; const st = this.E.trust ? this.E.trust.standing(PLAYER, day) : 0;
      return st > -0.15 || this.halmi >= day ? { ok: true, why: 'a drover while it stays' } : { ok: false, why: 'the caravan master will not have one of bad name' }; }
    const hh = s.hh ?? ''; const H = this.H(hh); if (!H || H.dead) return { ok: false, why: 'no such house' };
    if (this.group?.kind === 'household' && this.group.id === hh) return { ok: false, why: 'already of the house' };
    const t = this.trust(hh), known = (this.stay?.host === hh ? this.stay.nights : 0) + (this.job?.employer === hh ? this.job.worked : 0);
    if (known < 5) return { ok: false, why: 'they hardly know the stranger' };
    if (t < 0.6) return { ok: false, why: 'they do not trust the stranger enough' };
    if (!(H.workers < 2 || H.sickUntil > day || H.kind === 'farmer' || H.kind === 'herder')) return { ok: false, why: 'they need no more mouths' };
    return { ok: true, why: 'a hand of the house' };
  }
  private joinGroup(s: Extract<SAct, { a: 'join' }>, day: number, why: string): Verdict {
    if (s.kind === 'gang') { const q = s.q ?? this.homeQ() ?? [...this.quarters().keys()][0]; const e = this.ev('joined_gang', [], PLAYER, 'treasury'); this.group = { kind: 'gang', id: q, from: day, ev: e }; return { ok: true, why, ev: [e] }; }
    if (s.kind === 'caravan') { const c = this.caravanIn(day)!; const e = this.ev('joined_caravan', [c.id], PLAYER, 'caravan'); this.group = { kind: 'caravan', id: 'caravan', from: day, ev: e, until: c.day + 7 }; return { ok: true, why, ev: [e] }; }
    const H = this.H(s.hh!)!; const e = this.ev('joined_house', [this.stay?.ev, this.job?.ev, H.cause.help], s.hh!, PLAYER);
    if (this.job && this.job.employer === s.hh) this.job = null; if (this.stay && this.stay.host === s.hh) this.stay = null; // (the house's own: no wage, no guest's debt)
    H.workers++; H.eaters++; if (H.cause.help !== undefined && H.sickUntil > day) H.cause.help = e;
    this.group = { kind: 'household', id: s.hh!, from: day, ev: e }; return { ok: true, why, ev: [e] };
  }
  private leaveGroup(day: number) {
    const G = this.group; if (!G) return; this.group = null;
    if (G.kind === 'household') { const H = this.H(G.id); if (H) { H.workers = Math.max(0, H.workers - 1); H.eaters = Math.max(1, H.eaters - 1); } this.ev('left_house', [G.ev], G.id, PLAYER); }
    else this.ev(G.kind === 'gang' ? 'left_gang' : 'left_caravan', [G.ev], PLAYER, G.kind === 'gang' ? 'treasury' : 'caravan');
  }
  private groupDay(day: number) {
    const G = this.group; if (!G) return;
    if (G.kind === 'gang') { if (!this.attended.has(day)) return; this.deeds.gang++; this.deeds.labour++;
      const full = this.halmi >= day, cut = this.E.treasury.shortEv >= 0 && (this.E.events[this.E.treasury.shortEv]?.day ?? -99) > day - 30;
      const g = GANG_GRAIN * (full ? 1 : 0.5) * (cut ? 0.6 : 1); this.E.treasury.grain -= g; this.purse.grain += g;
      if (cut && !(G as any).cutSeen) { (G as any).cutSeen = 1; this.ev('gang_ration_cut', [this.E.treasury.shortEv, G.ev], PLAYER, 'treasury'); }
      this.hear('Elamite', 4, 0.4, true, day);
      // the gang's houses come to know the stranger (C: a few ration houses of the quarter work beside them)
      const mates = (this.quarters().get(G.id) ?? []).filter(id => this.H(id)?.kind === 'ration').slice(0, 6);
      if (this.E.trust) for (const m of mates) this.E.trust.note(m, PLAYER, 0.01, day);
      return; }
    if (G.kind === 'caravan') { if (day > (G.until ?? day)) { this.leaveGroup(day); return; } if (this.attended.has(day)) { this.purse.cash += DROVER_CASH; this.deeds.trades += 0.2; this.hear('Aramaic', 5, 0.3, true, day); } return; }
    const H = this.H(G.id); if (!H || H.dead) { this.leaveGroup(day); return; }
    if (this.attended.has(day)) { this.deeds.labour++; if (H.kind === 'farmer' && Math.abs(day - H.harvestDay) < 14) H.grain += 3; }
    this.hear(this.langOf(G.id), 5, 0.5, true, day);
    if (this.E.trust && day % 10 === 0) this.E.trust.note(G.id, PLAYER, 0.02, day);
  }

  /** D-370: what a house knows of its own dealings with the stranger, and how to speak to them, as the person is told it
   *  (second person, the model's brief: out of world). Empty when the house has none */
  factsFor(hh: string, day: number, roleWords: Record<string, string> = ROLE_WORDS): string[] {
    const out: string[] = [], b = this.belief.get(hh), C = this.claim;
    if (this.stay?.host === hh) out.push(`the stranger is a guest of your house these ${this.stay.nights || 'first'} nights${this.stay.nights > CUSTOM_NIGHTS && this.stay.owed > 0.01 ? ', and gives nothing back' : ''}`);
    if (this.job?.employer === hh) out.push(`the stranger works for your house as a hand (${this.job.need})${this.owesNow(hh) ? '; your house owes him wages' : ''}`);
    else if (this.owesNow(hh)) out.push('your house owes the stranger wages from his work');
    if (this.group?.kind === 'household' && this.group.id === hh) out.push('the stranger lives in your house now, as one of it');
    if (this.slighted.has(hh)) out.push('the stranger once ate your bread and went off without a word of thanks');
    if (C && b) out.push(b.doubted || b.b < 0.35 ? `the stranger says he is ${roleWords[C.role] ?? C.role}${C.origin ? ` from ${C.origin}` : ''}, but you do not believe it` : `you have heard the stranger is ${roleWords[C.role] ?? C.role}${C.origin ? ` from ${C.origin}` : ''}`);
    if (this.hungry >= 2) out.push('the stranger looks hungry and worn, as if he has not eaten for days');
    if (this.chilled >= day - 3) out.push('the stranger is coughing and shivering from nights in the open');
    const c = this.comp(this.langOf(hh), day);
    out.push(c < 0.2 ? 'the stranger hardly knows your tongue: use very few, simple words and point and gesture' : c < 0.5 ? 'the stranger knows a little of your tongue: speak simply and slowly' : 'the stranger speaks your tongue well enough');
    return out;
  }
  // ---------------------------------------------------------------- the day (Economy.step, after the households)
  step(day: number) {
    for (const s of this.acts.get(day) ?? []) this.apply(s); this.acts.delete(day);
    for (const P of [...this.petitions]) if (P.due === day) { this.petitions.splice(this.petitions.indexOf(P), 1); this.rule(P, day); }
    // the stranger's days are settled STR_LAG days behind (work, nights, a group's day): the living world steps the economy
    // up to three days ahead of the present for the day plans, and the player has not yet lived those days (as LIFE_LAG)
    const x = day - STR_LAG;
    if (x >= 0) { if (this.job && x >= this.job.from) this.workDay(x); if (this.stay && x >= this.stay.from) this.stayNight(x); if (this.group && x >= this.group.from) this.groupDay(x); this.eat(x);
      for (const a of this.attended) if (a <= x) this.attended.delete(a); }
    this.gratitude(day); this.spread(day); this.tongueDay(day);
  }
  /** the events a snapshot must keep (the state names them) */
  refs(): number[] { return [this.job?.ev, this.stay?.ev, this.group?.ev, this.claim?.ev, ...this.debtors.map(d => d.ev), ...this.petitions.map(p => p.ev)].filter((x): x is number => x !== undefined); }
  /** live: is there anything to save */
  get active() { return !!(this.job || this.stay || this.group || this.claim || this.lang.size || this.acts.size || this.debtors.length || this.petitions.length || this.halmi >= 0); }

  // ---------------------------------------------------------------- save
  snapshot() {
    return { purse: { ...this.purse }, job: this.job, stay: this.stay, group: this.group, lang: [...this.lang], claim: this.claim, belief: [...this.belief], halmi: this.halmi,
      debtors: this.debtors, petitions: this.petitions, deeds: { ...this.deeds }, acts: [...this.acts].sort((a, b) => a[0] - b[0]).flatMap(x => x[1]), petN: this.petN, tongueMet: [...this.tongueMet], hungry: this.hungry, fedOn: this.fedOn, chilled: this.chilled, slighted: [...this.slighted], judged: [...this.judged], vocab: [...this.vocab], stats: { ...this.stats }, attended: [...this.attended].sort((a, b) => a - b) };
  }
  static restore(s: any, E: Economy, opts: StrangerOpts = {}): Stranger {
    const X = new Stranger(E, opts); const c = JSON.parse(JSON.stringify(s));
    X.purse = c.purse; X.job = c.job; X.stay = c.stay; X.group = c.group; X.claim = c.claim; X.halmi = c.halmi; X.petN = c.petN; for (const a of c.attended ?? []) X.attended.add(a);
    for (const [k, v] of c.lang) X.lang.set(k, v); for (const [k, v] of c.belief) X.belief.set(k, v);
    X.debtors.push(...c.debtors); X.petitions.push(...c.petitions); Object.assign(X.deeds, c.deeds); Object.assign(X.stats, c.stats);
    for (const a of c.acts) X.do(a); for (const t of c.tongueMet) X.tongueMet.add(t); for (const t of c.slighted ?? []) X.slighted.add(t); for (const [k, v] of c.judged ?? []) X.judged.set(k, v); for (const [k, v] of c.vocab ?? []) X.vocab.set(k, v); X.hungry = c.hungry ?? 0; X.chilled = c.chilled ?? -1; X.fedOn = c.fedOn ?? -1; return X;
  }
}
