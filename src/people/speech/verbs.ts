// D-370 (UD-25): the stranger's words as a step of the sandbox. A small grammar of the translation layer's English (the
// player's words; never heard in the world) that PROPOSES a step of speech/stranger.ts from what was said to whom: asking for
// work, guest-right, a place in a gang, a caravan or a house; saying who one is; petitioning; giving; leaving; asking to be
// taught. It never decides: the simulation's judge() does, and the person's answer is told that verdict first (converse/turn.ts).
// The grammar is the second detector and the cheap one; a model's tag can propose the same steps.
import type { SAct, Role, Authority } from './stranger';

export interface VerbCtx {
  day: number; /** the addressee's household (economy id) */ hh: string | null; q: string | null;
  /** the addressee's work (Population Job) */ job: string;
  /** a household named in the words (resolved by the caller from a name), for petitions and gifts */ named?: string | null;
}
const ROLE_WORDS: [Role, RegExp][] = [
  ['merchant', /\b(merchant|trader|dealer)\b/], ['scribe', /\b(scribe|clerk|writer)\b/], ['pilgrim', /\b(pilgrim|wanderer|traveller|traveler)\b/],
  ['envoy', /\b(envoy|ambassador|messenger of the king|emissary|courier)\b/], ['soldier', /\b(soldier|spearman|archer|guard)\b/], ['healer', /\b(healer|physician|doctor)\b/],
  ['craftsman', /\b(craftsman|potter|smith|carpenter|weaver|mason|builder)\b/], ['labourer', /\b(labou?rer|worker|workman|farmhand|hand)\b/],
];
const ORIGINS: [string, RegExp][] = [['Persian', /\bpersi(a|an)\b/], ['Median', /\bmed(ia|e|ian)\b/], ['Elamite', /\b(elam|elamite|susa)\b/], ['Babylonian', /\bbabylon(ian)?\b/],
  ['Syrian', /\b(syria|syrian|damascus|aram)\b/], ['Ionian', /\b(ionia|ionian|greek|greece|miletus|sardis)\b/], ['Egyptian', /\b(egypt|egyptian|memphis)\b/]];
/** the addressee's work as an authority for a petition */
export function authorityOf(job: string): Authority | null { return job === 'official' || job === 'steward' || job === 'scribe' ? 'official' : job === 'elder' ? 'headman' : null; }

/** the step the words propose, or null */
export function strangerAsk(words: string, c: VerbCtx): SAct | null {
  const w = words.toLowerCase().replace(/[’']/g, "'"), day = c.day, hh = c.hh;
  // asking to be taught the tongue (a quarter hour of slow, simplified speech, spoken back)
  if (/\b(teach me|how do (you|i) say|what is (the|your) word for|say (it|that) (again|slowly)|speak slowly)\b/.test(w)) return { a: 'hear', day, lang: '', hours: 0.25, simple: 1, spoke: true };
  // groups
  if (/\b(join|travel with|go with|come with) (your|the) caravan\b|\b(can|may) i (join|travel with) (you|your people)\b.*\bcaravan|\bdo you need (a )?drovers?\b/.test(w)) return { a: 'join', day, kind: 'caravan' };
  if (/\b(join|work in|be (one )?of) (your|the|a) (gang|crew|work ?gang|workmen|labou?r gang)\b|\bput me on the (rolls|ration list)\b/.test(w)) return { a: 'join', day, kind: 'gang', q: c.q ?? undefined };
  if (hh && /\b(become|be|join) (one of|part of|a member of|a son of|a daughter of)? ?(your|this) (family|household|house)\b|\btake me into your (house|household|family)\b/.test(w)) return { a: 'join', day, kind: 'household', hh };
  if (/\b(leave|quit) (the|your)? ?(gang|caravan|crew)\b/.test(w)) return { a: 'leave_group', day };
  // D-455: a day's hire (porterage at the market, loads carried): paid at evening in silver, no house's season needed
  if (/\b(loads? to carry|need (a )?porters?|carry (your |the |any )?loads?|day'?s (work|wage|hire)|day labou?r)\b/.test(w) || (/\b(hire|work|carry|labou?r)\b/.test(w) && /\b(for (the|a|one) day|for today|today)\b/.test(w))) return { a: 'daywork', day };
  // work
  if (hh && /\b(hire me|give me (some )?work|take me on|i('m| am) looking for work|(can|may|could) i work for you|do you need (a |an extra |more )?(hand|hands|help|workers?|labou?rers?)|i (can|will) work for (you|food|bread|grain))\b/.test(w)) return { a: 'seek_work', day, hh };
  if (/\b(i quit|i('ll| will) not work for you|i('m| am) leaving (your|this) (work|service)|i will work no more)\b/.test(w)) return { a: 'quit', day };
  // hospitality
  if (hh && /\b((can|may|could) i (stay|sleep|rest|spend the night|lodge)( here| with you| in your house| tonight)?|do you have (a place|room|a corner) (for me )?to sleep|(can|could) you (put me up|take me in)|guest[- ]right|i ask (your )?hospitality|shelter for the night)\b/.test(w)) return { a: 'stay', day, hh };
  if (/\b(thank you for (your )?(hospitality|the bed|the meals?)|i must (go|leave|be on my way)|i('ll| will) (leave|go) (now|tomorrow))\b/.test(w)) return { a: 'leave_stay', day };
  // D-720 (4-12): a meal bought and eaten here: bread, beer, a meal, for silver or barley (from the house spoken to, else the
  // market's sellers); asked for without paying, it is a gift asked (the talk's own grammar)
  { const m = /\b(bread|loaf|loaves|beer|a meal|meal|something to eat|food|stew|porridge)\b/.exec(w);
    if (m && /\b(buy|sell me|pay|paying|for (silver|barley|grain|a shekel)|how much|what do you want for|trade|give you (silver|barley|grain))\b/.test(w) && !/\b(measures?|sacks?|loads?)\b|\b(\d+|two|three|four|five|ten)\s+(loa(f|ves)|jars?)\b/.test(w))
      return { a: 'meal', day, hh: hh ?? 'market', what: /beer/.test(m[1]) ? 'beer' : /bread|loa/.test(m[1]) ? 'bread' : 'meal', barter: /\b(barley|grain)\b/.test(w) }; }
  // buying and selling (haggled by the simulation: speech/haggle.ts)
  // (D-455: a loaf is half a kilo of the grain's worth, bread with no count a day's two loaves, C; a measure 10 kg, a sack or load 30)
  const qtyOf = (w: string) => { const m = /\b(\d+|a|one|two|three|four|five|ten)\s+(measures?|sacks?|loads?|jars?|loaves?|loaf)\b/.exec(w); const n = m ? ({ a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10 } as Record<string, number>)[m[1]] ?? Number(m[1]) : 1;
    if (m && /loa(f|ves)/.test(m[2])) return Math.min(30, n) * 0.5; if (!m && /\b(bread|loaf|loaves)\b/.test(w)) return 1; return Math.min(30, n) * (m && /sack|load/.test(m[2]) ? 30 : 10); };
  const goodOf = (w: string) => /\b(barley|grain|bread|flour|wheat)\b/.test(w) ? 'grain' as const : /\b(fuel|firewood|wood|dung|brushwood)\b/.test(w) ? 'fuel' as const : /\b(cloth|jar|pot|goods|wares|basket|tools?)\b/.test(w) ? 'goods' as const : null;
  if (hh && /\b(sell me|i('d| would)? (want|like) to buy|can i buy|could i buy|how much (for|is)|what do you want for|i('ll| will) buy)\b/.test(w)) { const g = goodOf(w); if (g) return { a: 'buy', day, hh, good: g, qty: g === 'goods' ? 1 : qtyOf(w) }; }
  if (hh && /\b(i('ll| will) sell you|will you buy|do you want to buy|buy (my|this|these)|i have .{1,20} to sell)\b/.test(w)) { const g = goodOf(w); if (g) return { a: 'sell', day, hh, good: g, qty: g === 'goods' ? 1 : qtyOf(w) }; }
  // D-720 (D-358's port): a loan of silver offered ("I can lend you half a shekel"), and the stranger asking a house for help
  const lend = /\b(lend|loan) (you|your house|them)\b(?:[^.?!]*?\b(\d+(?:\.\d+)?|a|one|half a|a third of a|a tenth of a)\s*(shekels?|silver))?/.exec(w);
  if (lend && (c.named ?? hh)) { const q = lend[3] ?? 'a', n = /\d/.test(q) ? Number(q) : q === 'half a' ? 0.5 : q === 'a third of a' ? 1 / 3 : q === 'a tenth of a' ? 0.1 : 1;
    return { a: 'lend', day, hh: (c.named ?? hh)!, cash: Math.min(5, n) }; }
  if (hh && /\b(help me|i have no (food|bread|barley)|i am starving|i have nothing to eat|i have not eaten)\b/.test(w) && !/\b(can|may|could) i help\b/.test(w)) return { a: 'ask_help', day, hh };
  // gifts (amounts in the translation layer's words: a shekel of silver, a measure of grain; C)
  const gift = /\b(take|accept|here is|have) (this|these|a|some|my)? ?(\d+(?:\.\d+)?|a|one|some)? ?(shekels?|silver|coins?|grain|barley|bread|measures?)\b/.exec(w);
  if (gift && (c.named ?? hh)) { const n = gift[3] && /\d/.test(gift[3]) ? Number(gift[3]) : 1, silver = /shekel|silver|coin/.test(gift[4]);
    return { a: 'give', day, hh: (c.named ?? hh)!, ...(silver ? { cash: Math.min(n, 5) * (/shekel/.test(gift[4]) ? 1 : 0.1) } : { grain: Math.min(n, 30) * (/measure/.test(gift[4]) ? 10 : 2) }) }; }
  // petitions (to the one addressed, when they are an authority)
  const auth = authorityOf(c.job);
  if (/\b(petition|complain|justice|judge between|hear my (case|complaint)|a ruling)\b|\bowes? me\b|\b(did not|didn't|never) pay me\b|\b(papers|a document|a seal(ed)?( document)?|permission to (stay|work|travel)|leave to stay)\b|\bspeak for\b|\b(give|send) (them|that family|this family|the house) (grain|bread|food)\b/.test(w)) {
    const to: Authority = auth ?? 'headman';
    if (/\b(papers|document|seal|permission to|leave to stay)\b/.test(w)) return { a: 'petition', day, to: auth === 'official' ? 'official' : to, kind: 'leave' };
    if (/\bowes? me\b|\b(did not|didn't|never) pay me\b|\bwages?\b/.test(w)) return { a: 'petition', day, to, kind: 'wages', against: c.named ?? undefined, q: c.q ?? undefined };
    if (/\b(give|send) (them|that family|this family|the house) (grain|bread|food)\b|\brelief\b|\bthey are starving|hungry\b/.test(w)) return { a: 'petition', day, to, kind: 'relief', for: c.named ?? hh ?? undefined, q: c.q ?? undefined };
    return { a: 'petition', day, to, kind: 'plea', for: c.named ?? hh ?? undefined, q: c.q ?? undefined };
  }
  // who one is (a claim): "I am a merchant from Babylon", "I come from Egypt", "I am your kinsman"
  if (/\bi('m| am) (your|a) (kinsman|cousin|kin|nephew|niece|brother|sister|relative)\b|\bwe are (kin|related|family)\b/.test(w) && hh) return { a: 'claim', day, hh, role: 'kin', kinOf: c.named ?? hh };
  const am = /\bi('m| am)( a| an)? ([a-z ]{2,40})|\bi come from ([a-z ]{2,30})|\bmy (work|trade|craft) is ([a-z ]{2,30})/.exec(w);
  if (am && hh) {
    const role = ROLE_WORDS.find(([, re]) => re.test(w))?.[0]; const origin = ORIGINS.find(([, re]) => re.test(w))?.[0];
    if (role || origin) return { a: 'claim', day, hh, role: role ?? 'pilgrim', ...(origin ? { origin } : {}) };
  }
  return null;
}
