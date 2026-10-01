// s14 simtalk (D-358; UD-18, UD-24, UD-25, UD-26; T-E9, T-E10; B234): what a person can say of their own means and standing,
// read from the RUNNING simulation, never seeded. lifeRecord (converse/life.ts) used to draw a person's debts from their seed
// (a 45 % chance of "owes a jar of oil to a neighbour": tier C texture, no state behind it). Now every fact of means comes
// from the state the person lives in:
//   - the house's stores (Economy: barley in days of bread, silver, fuel, goods) and the market's price of barley today;
//   - its debts and its debtors (Economy debts, named by the head of the other house, with the amount and the day due);
//   - what happened to the house lately (the economy's event graph naming it: a poor harvest, a loan, a theft, a default, a
//     suit, kin's help, the stranger's own deeds), newest first;
//   - its needs (Economy.needsOf) and its open asks (asks/asks.ts: what it would say to a stranger, or the shame of asking);
//   - spouse, betrothal, courting and scandal (relations/world.ts, only when that layer is running: it costs ~0.3 s a week
//     to build, B228, so a conversation never builds it);
//   - what the house has heard (asks/rumour.ts: the version told to it, how many hands on, how sure);
//   - its trust in the stranger (speech/trust.ts TrustLedger, the player as 'player') and willTalk (B234's gate).
// Out of world: English, the model's brief. Measures are a person's: barley in days of bread and the BAR (ten qa, the ration
// tablets' unit), silver in sheqel; never a modern unit. Tier C: the words; the facts are the simulation's.
import type { Population } from '../population';
import type { Economy, EconEvent } from '../economy/world';
import type { Relations } from '../relations/world';
import type { AsksWorld } from '../asks/world';

/** the simulation as a conversation reads it (PeopleSim satisfies it through simView) */
export interface SimView { pop: Population; econ: Economy | null; bonds: Relations | null; asks: AsksWorld | null }
export interface Standing {
  hh: string | null;
  /** stores and prices, as the person would say them */ means: string[];
  /** owed and owing, named (sim debts only) */ debts: string[];
  /** the house's economy events of the last 60 days, newest first */ events: string[];
  /** wants: needs and open asks */ needs: string[];
  /** marriage, betrothal, courting, scandal (relations layer) */ bonds: string[];
  /** what the house has heard (rumour net and the relations' news) */ rumours: string[];
  /** the house's dealings with the stranger, from the economy's events */ stranger: string[];
  /** the house's trust in the stranger (0..1; 0.5 no record) and whether it will talk at all (B234) */ trust: number; willTalk: boolean;
  /** the open asks of the house (for the talk hooks: turn.ts, deeds.ts) */ asks: { id: number; kind: string; good: string; amount: number; unit: string; willing: boolean; offers: string }[];
}
export const PLAYER_ID = 'player';
const GRAIN_EAT = 0.55, QA = 0.55, BAR = 10 * QA; // a qa of barley is a day's ration (A in kind); kg only inside the economy
const hid = (pop: Population, pid: number, day: number) => `h:${pop.home(pid, day)}`;
/** the head of a house by name (the eldest man of working age, else the eldest member), for "X's house" */
export function headName(pop: Population, id: string, day: number): string | null {
  if (!/^h:\d+$/.test(id)) return null; const H = pop.households[+id.slice(2)]; if (!H) return null;
  const m = pop.membersOn(H.id, day).filter(x => pop.persons[x].dies > day);
  const men = m.filter(x => pop.persons[x].sex === 'm' && pop.ageOn(x, day) >= 16).sort((a, b) => pop.ageOn(b, day) - pop.ageOn(a, day));
  const x = men[0] ?? m.sort((a, b) => pop.ageOn(b, day) - pop.ageOn(a, day))[0]; const n = x === undefined ? null : pop.nameOf(x);
  return n ? n.replace(/^\*/, '') : null;
}
const SYS: Record<string, string> = { treasury: 'the Treasury', court: 'the court', market: 'the market', weather: 'the weather', caravan: 'a caravan', player: 'the stranger' };
export function houseWords(pop: Population, id: string, day: number, me?: string): string {
  if (id === me) return 'your own house'; if (SYS[id]) return SYS[id]; const n = headName(pop, id, day); return n ? `the house of ${n}` : 'another house';
}
/** a count as a person says it, in words (session 15: "138 BAR" in a brief put modern digits in the person's mouth; the brief
 *  and the reply are speech, so every number is a word; above twenty a round number, "about" when it was rounded) */
const ONES = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function exactWords(n: number): string {
  if (n < 20) return ONES[n]; if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) { const h = Math.floor(n / 100), r = n % 100; return (h === 1 ? 'a hundred' : ONES[h] + ' hundred') + (r ? ' and ' + exactWords(r) : ''); }
  const t = Math.floor(n / 1000), r = n % 1000; return (t === 1 ? 'a thousand' : exactWords(t) + ' thousand') + (r ? (r < 100 ? ' and ' : ' ') + exactWords(r) : '');
}
export function countWords(x: number): string {
  const n = Math.max(0, Math.round(x)); if (n <= 20) return ONES[n] ?? exactWords(n);
  const step = n < 100 ? 5 : n < 1000 ? 10 : 100, r = Math.round(n / step) * step; return (r === n ? '' : 'about ') + exactWords(r);
}
/** every run of digits in a text said as words (for lines composed by layers that still write digits: talk.ts's "3 days ago") */
export const spellDigits = (s: string) => s.replace(/\b\d+(?:\.\d+)?\b/g, m => countWords(Number(m)));
/** silver as a person weighs it (sheqel and its fractions; C) */
export function silverWords(s: number): string {
  if (s <= 0.004) return 'no silver'; if (s >= 1.75) return `${countWords(s)} sheqel of silver`; if (s >= 0.9) return 'a sheqel of silver';
  const f = [[0.5, 'half a sheqel'], [1 / 3, 'a third of a sheqel'], [0.25, 'a quarter of a sheqel'], [0.1, 'a tenth of a sheqel'], [0.05, 'a twentieth of a sheqel']] as [number, string][];
  for (const [v, w] of f) if (s >= v * 0.8) return `${w} of silver`; return 'a few grains of silver';
}
/** barley by the BAR, in words */
export const barWords = (kg: number) => { const n = Math.max(1, Math.round(kg / BAR)); return n === 1 ? 'a BAR' : `${countWords(n)} BAR`; };
export function grainWords(kg: number, eaters: number): string {
  const days = kg / Math.max(1, eaters * GRAIN_EAT); if (kg < QA) return 'no barley';
  return `${days >= 60 ? `barley for ${countWords(days / 30)} months` : days >= 2 ? `barley for ${countWords(days)} days` : 'barley for a day or less'} of bread`;
}
/** an economy event as the house would tell it ("you", "your house"; the other party named) */
const EV: Record<string, (o: string, amt: string) => string> = {
  harvest_poor: () => 'the harvest was poor', harvest_good: () => 'the harvest was good', blight: () => 'blight in the fields of the quarter',
  hunger: () => 'the house went hungry', cold_hearth: () => 'the hearth went cold for want of fuel', illness: () => 'sickness in the house', death: () => 'a death in the house', mourning: () => 'the house was in mourning',
  loan: (o, a) => `borrowed ${a} from ${o}`, loan_refused: (o) => `asked ${o} for a loan and was refused`, repaid: (o) => `paid back what was owed to ${o}`, default: (o) => `could not pay ${o} when the debt fell due`,
  suit: (o) => `${o} took the house to the court over a debt`, pledge_seized: (o) => `${o} seized the pledge for a debt`, debt_labour: () => 'the court bound a member of the house to work off a debt', bound_labour: (o) => `a member of the house was bound to work for ${o}`,
  released: () => 'the bound member came home', redeemed: () => 'redeemed the member bound for debt', theft: (o) => `was caught taking grain from ${o}`, robbed: (o) => `was robbed of grain (they say by ${o})`, accusation: (o) => `was accused before the court by ${o}`,
  arrest: () => 'a member of the house was arrested', acquitted: () => 'the court acquitted the house', petition: () => 'petitioned the court', petition_refused: () => 'the court refused the house’s petition', relief: () => 'the Treasury gave the house grain', remitted: () => 'the debt was remitted by the court', time_granted: () => 'the court gave the house time to pay',
  tax_arrears: () => 'could not pay the Treasury’s due', levy_arrears: () => 'could not meet the levy', levy: () => 'paid the levy', kin_help: (o) => `kin at ${o} gave the house barley`, nursed_by_kin: (o) => `kin at ${o} nursed the sick`, neighbours_help: (o) => `neighbours (${o}) helped`,
  hired_by_neighbour: (o) => `worked for ${o} for grain`, wage_work: () => 'took wage work', sell: () => 'sold goods at the market', buy_fuel: () => 'bought fuel', land_sold: () => 'sold land', animal_lost: () => 'lost the ox (or the flock’s ewes)', animal_bought: () => 'bought an animal to replace the lost one',
  house_fire: () => 'the house caught fire', beaten: (o) => `was beaten by ${o}`, given: (o, a) => `${o} gave the house ${a}`, grain_brought: () => 'grain was brought in', haggle_deal: (o) => `struck a bargain with ${o}`,
  lent_by_stranger: (_o, a) => `the stranger lent the house ${a}`, hired_by_stranger: () => 'the stranger worked for the house', spoken_for: () => 'the stranger spoke for the house before the judge',
  hosted_stranger: () => 'the house gave the stranger a meal', helped_stranger: (_o, a) => `the house gave the stranger ${a}`,
  stores_low: () => 'the house’s barley ran low', fuel_low: () => 'the fuel ran low', silver_short: () => 'the house ran short of silver',
};
function when(d: number, day: number) { const k = day - d; return k <= 0 ? 'today' : k === 1 ? 'yesterday' : k < 8 ? `${countWords(k)} days ago` : k < 45 ? `about ${countWords(k / 7)} weeks ago` : 'some months ago'; }
function evWords(pop: Population, e: EconEvent, me: string, day: number): string | null {
  const f = EV[e.kind]; if (!f) return null; const other = e.actor === me ? e.other : e.actor; const o = other ? houseWords(pop, other, day, me) : 'someone';
  const a = e.amt === undefined ? 'something' : /loan|lent|repaid|default/.test(e.kind) ? silverWords(e.amt) : e.amt >= QA ? `barley (${barWords(e.amt)})` : silverWords(e.amt);
  if (e.actor !== me && e.other === me) { // the event is the other house's, about this one (a suit brought by a creditor, a theft from this house)
    if (e.kind === 'theft') return `${o} took grain from your house`; if (e.kind === 'suit') return `you took ${o} to the court over a debt`; if (e.kind === 'pledge_seized') return `you seized ${o}’s pledge for a debt`;
    if (e.kind === 'default') return `${o} could not pay what it owed you`; if (e.kind === 'repaid') return `${o} paid back what it owed you`; if (e.kind === 'loan') return `you lent ${o} ${a}`;
    if (e.kind === 'kin_help') return `your house gave kin at ${o} barley`; if (e.kind === 'given' || e.kind === 'haggle_deal') return `your house dealt with ${o}`;
    return null;
  }
  return f(o, a);
}
const NEED_WORDS: Record<string, string> = { food: 'short of barley', fuel: 'short of fuel', water: 'short of water in the heat', cash: 'pressed for silver', help: 'short of hands (someone sick)', health: 'weak and poorly fed', kin: 'in mourning' };
const ASK_WORDS: Record<string, string> = { grain: 'barley', fuel: 'fuel', water: 'water', silver: 'silver', labour: 'a few days of work', healer: 'someone to tend the sick', company: 'company in mourning', animal: 'an ox', justice: 'justice for a theft', shelter: 'shelter after the fire', time: 'more time to pay', petition: 'someone to speak for the house before the judge', lost_child: 'help to find a lost child' };
const RUMOUR_KIND: Record<string, string> = { death: 'a death', illness: 'sickness', theft: 'a theft', default: 'a debt not paid', house_fire: 'a fire', hunger: 'hunger', suit: 'a suit at the court', arrest: 'an arrest', pledge_seized: 'a pledge seized', debt_labour: 'a member bound for debt', animal_lost: 'an ox lost', loan: 'a loan', acquitted: 'an acquittal', scandal: 'a scandal', player_deed: 'something the stranger did' };
const TIE_WORDS: Record<string, string> = { kin: 'kin', neighbour: 'a neighbour', work: 'someone of the same trade', trade: 'someone they deal with', origin: 'those who saw it' };

/** the market's price of barley as anyone of the town would say it (the economy's price of the day) */
export function marketLine(E: Economy, d: number): string {
  const pr = E.price('grain', d) * BAR, base = 0.02 * BAR, rel = pr / base;
  return `barley at the market: ${silverWords(pr).replace(/ of silver$/, '')} the BAR${rel > 2 ? ', very dear' : rel > 1.3 ? ', dear' : rel < 0.75 ? ', cheap' : ''}`;
}
/** the person's means and standing from the running simulation on `day` (nothing seeded) */
export function standing(V: SimView, pid: number, day: number): Standing {
  const pop = V.pop, me = hid(pop, pid, day), E = V.econ, h = E?.hh.get(me);
  const S: Standing = { hh: h ? me : null, means: [], debts: [], events: [], needs: [], bonds: [], rumours: [], stranger: [], trust: 0.5, willTalk: true, asks: [] };
  // (the state is the economy's of its own day: a record asked of an earlier day, a test jumping back, gets only the events)
  const live = !!E && E.day <= day + 1;
  if (E && h && !h.dead) {
    const d = Math.min(day, E.day);
    if (live) {
    S.means.push(`your house has ${grainWords(h.grain, h.eaters)}, ${silverWords(h.cash)}${h.goods >= 1 ? `, ${Math.round(h.goods) === 1 ? 'a lot' : countWords(h.goods) + ' lots'} of goods to sell` : ''}${h.fuel < 5 ? ', little fuel' : ''}`);
    S.means.push(marketLine(E, d));
    for (const x of h.debts) if (x.amt > 0.004) S.debts.push(`your house owes ${silverWords(x.amt)} to ${houseWords(pop, x.to, day, me)}${x.due >= day ? `, due ${x.due - day <= 1 ? 'tomorrow' : `in ${countWords(x.due - day)} days`}` : ', past due'}`);
    for (const o of E.hh.values()) if (o !== h) for (const x of o.debts) if (x.to === me && x.amt > 0.004) S.debts.push(`${houseWords(pop, o.id, day, me)} owes your house ${silverWords(x.amt)}`);
    S.debts.splice(4); }
    const seen = new Set<string>();
    for (let i = E.events.length - 1; i >= 0 && S.events.length < 5; i--) { const e = E.events[i]; if (!e || !e.actor) continue; if (e.day < day - 60) break; if (e.day > day) continue;
      if (e.actor !== me && e.other !== me) continue; const w = evWords(pop, e, me, day); if (!w || seen.has(w)) continue; seen.add(w); S.events.push(`${w} (${when(e.day, day)})`);
      if (e.other === PLAYER_ID || e.actor === PLAYER_ID) S.stranger.push(`${w} (${when(e.day, day)})`); }
    if (live) for (const n of E.needsOf(me)) if (n.urgency >= 0.45 && n.kind !== 'water') S.needs.push(`the house is ${NEED_WORDS[n.kind]}`);
    if (E.trust && live) { S.trust = E.trust.trustOf(me, PLAYER_ID, d); S.willTalk = E.trust.willTalk(me, PLAYER_ID, d); }
  } else if (E && live) S.means.push(marketLine(E, Math.min(day, E.day))); // (session 15: a house outside the economy, the work groups', still knows the market's price)
  if (V.asks?.on && live) {
    for (const a of V.asks.openAsksOf(me)) { const v = a.voices.find(x => x.to === 'stranger'); if (!v) continue;
      S.asks.push({ id: a.id, kind: a.kind, good: a.what.good, amount: v.amount, unit: a.what.unit, willing: v.willing, offers: v.offers });
      S.needs.push(v.willing ? `the house needs ${ASK_WORDS[a.kind] ?? a.kind}; to a stranger you would ask it, offering ${v.offers}` : `the house needs ${ASK_WORDS[a.kind] ?? a.kind}, but you are ashamed to ask a stranger`); }
    for (const k of V.asks.rumours.knownBy(me, day).filter(k => k.since >= day - 30 && k.version.about !== me).sort((a, b) => b.since - a.since).slice(0, 2)) {
      const v = k.version; const about = houseWords(pop, v.about, day, me);
      S.rumours.push(`heard from ${TIE_WORDS[k.tie] ?? 'someone'} ${when(k.since, day)} of ${RUMOUR_KIND[v.kind] ?? v.kind.replace(/_/g, ' ')} at ${about}${v.suspect ? ` (they say ${houseWords(pop, v.suspect, day, me)} did it)` : ''}${v.certainty < 0.5 ? '; not sure it is true' : ''}`);
    }
  }
  if (V.bonds) {
    const R = V.bonds, sp = R.spouseOn(pid, day), nm = (x: number) => (pop.nameOf(x) ?? '').replace(/^\*/, '') || 'someone';
    if (sp >= 0) S.bonds.push(`married to ${nm(sp)}`);
    for (const e of R.events) { if (e.day > day || (e.a !== pid && e.b !== pid)) continue; const o = e.a === pid ? e.b : e.a; if (o < 0) continue;
      if (e.kind === 'betroth' && sp < 0) S.bonds.push(`betrothed to ${nm(o)} (${when(e.day, day)})`);
      if (e.kind === 'court' && day - e.day < 60 && sp < 0) S.bonds.push(`courting ${nm(o)}`);
      if (e.kind === 'widowed') S.bonds.push(`widowed (${when(e.day, day)})`); if (e.kind === 'divorce') S.bonds.push(`divorced from ${nm(o)}`); }
    for (const n of R.news) if (n.day <= day && day - n.day < 60 && n.knows.has(pid)) S.rumours.push(n.about.includes(pid) ? `people whisper of you: ${n.what}` : `heard the whisper about ${n.about.filter(x => x >= 0).map(nm).join(' and ')}: ${n.what}`);
    S.bonds = [...new Set(S.bonds)].slice(-3); S.rumours = S.rumours.slice(0, 3);
  }
  return S;
}
/** every line of a standing (for the tests: each is the simulation's) */
export const standingLines = (S: Standing) => [...S.means, ...S.debts, ...S.events, ...S.needs, ...S.bonds, ...S.rumours];
