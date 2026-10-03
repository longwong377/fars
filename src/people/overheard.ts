// D-377 (UD-23, UD-24; T-E12): WHAT TWO PEOPLE SAY TO EACH OTHER WHEN THE STRANGER OVERHEARS THEM. Before this the voices
// near the player picked random lexicon units for anyone "talking" (voices.ts pickUnit): a murmur, not a conversation. Here an
// exchange is chosen per pair and moment from their records: the talk the simulation itself held between their houses today
// (news, an ask, an offer, a visit: living/world.ts), else what has happened to either house this year (a death, a birth, a
// wedding, sickness), its needs and the market (dear barley), the day (a festival, the harvest), the stranger they have heard
// of, or their shared work. The exchange is voiced in a language both speak (the shared home tongue, else Aramaic, the
// lingua franca of the empire: C), from the lexicon's attested words and lines only (§10: nothing invented): a greeting, the
// topic's words (their glosses carry it: barley, silver, son, god, gate...), the other's answer, a pious word or a farewell.
// Each speaker in their own voice (voices.ts, keyed by person). Never the same exchange twice for a pair in a day. Pure: a
// function of the seed, the pair, the day and the hour block; nothing here changes the simulation (the talk itself is the
// living world's). Out of world: the topic line (English) is the translation layer's.
// D-387 (UD-24): where the shared tongue has no attested word for the topic (no word for grain in Old Persian), the topic is
// said in reconstructed period speech (lang/reconstruct.ts: attested words where they fit, else cognate or rule-built forms;
// tier C, glossed), one or two sentences of fact and answer, so the exchange carries its topic in words.
import type { PeopleSim } from './sim';
import { unitsFor, voiceLang, type Unit } from '../audio/voices';
import type { LangId } from '../lang/lexicon';
import { lifeRecord } from './converse/life';
import { h32, u01, salt } from './hash';
import { HOME_LANG } from './exchanges';
import { reconstructedUnit } from '../lang/reconstruct';

const S = salt('overheard');
export interface Exchange { a: number; b: number; day: number; block: number; lang: LangId; /** the topic's key; carried: some spoken word carries it (else the topic is in the translation layer's note only: the lexicon has no word for it in that tongue) */ key: string; carried: boolean; /** D-387: the topic is carried by reconstructed period speech (tier C), the tongue having no attested word for it */ rc?: boolean; src: 'talk' | 'deed' | 'life' | 'market' | 'day' | 'stranger' | 'work'; topic: string; turns: { who: 'a' | 'b'; unit: Unit }[] }
/** a topic's words: the glosses that carry it (C) */
const TOPIC_WORDS: Record<string, RegExp> = {
  grain: /\b(bread|grain|barley|wheat|food|provisions|meal)\b/i, silver: /\b(silver|money|wage|pay|gold)\b/i, death: /\b(god|gods|father|son|heaven)\b/i,
  birth: /\b(son|house|good|happiness|well-being)\b/i, wedding: /\b(house|son|good|happiness|wine)\b/i, sickness: /\b(god|gods|protect|well-being|peace)\b/i,
  work: /\b(work|works|stone|bricks|timber|workers|labourers|column|palace|gate)\b/i, king: /\b(king|royal|palace|gate|court)\b/i, festival: /\b(god|gods|wine|bread|meat|sheep)\b/i,
  harvest: /\b(grain|barley|earth|bread|wheat)\b/i, deed: /\b(man|bad|evil|good|truth|lie|enemy|friend|judge)\b/i, stranger: /\b(stranger|man|land|country|guest)\b/i, water: /\b(water|river)\b/i, weather: /\b(sky|heaven|earth|water)\b/i,
};
/** D-387 (UD-24): what is said of a topic when the shared tongue has no attested word for it, voiced as reconstructed period
 *  speech (lang/reconstruct.ts; tier C): [what the first says, the other's answer] (C) */
const RC_SAY: Record<string, readonly (readonly [string, string])[]> = {
  grain: [['barley is dear this month', 'may the god give a good harvest'], ['bread is dear this year', 'the king gives the rations']],
  silver: [['the house owes silver', 'I give you silver and you give me barley'], ['give me silver until the harvest', 'I give you silver']],
  death: [['the father of the house died', 'may the god keep his house'], ['the mother of the house died', 'may the god keep the children']],
  birth: [['a son was born in the house', 'may the god keep the child'], ['a daughter was born in the house', 'may the god keep the mother']],
  wedding: [['the son took a wife', 'may the god give them many sons']],
  sickness: [['the child is sick', 'may the god keep the child'], ['the father is sick', 'may the god keep the house']],
  work: [['the work is heavy this month', 'the king gives the rations'], ['the workers are many', 'the work is great']],
  king: [['the king builds a great house', 'the workers are many'], ['the king gives the rations', 'may the god keep the king']],
  festival: [['today is the feast of the god', 'there is meat and wine']],
  harvest: [['the harvest is good this year', 'the barley is in the field'], ['the barley is in the field', 'may the god give rain']],
  stranger: [['a stranger came to the town', 'may the god keep the stranger']],
  // D-461: the deeds the minds saw and the goals they hold
  deed: [['a man struck his neighbour', 'may the god judge him'], ['that man is an enemy of the house', 'may the god keep the house'], ['the two houses made peace', 'it is good']],
  water: [['the water is low this month', 'may the god give rain']],
  weather: [['the rain is good for the barley', 'may the god keep the field']],
};
/** D-720: a topic's fact as a plain sentence to say (no names: a name is the person's, not a word of the language), at most eight words */
export function factSentence(topic: string): string | null {
  let t = topic.replace(/^[^:]*: /, '').replace(/\s*\([^)]*\)/g, '').replace(/\b[A-ZĀĪŪŠČÇΘ][\p{L}’'-]*(?: (?:son|daughter|wife) of [A-ZĀĪŪŠČÇΘ][\p{L}’'-]*)?/gu, 'someone').replace(/\b(someone(?:,? )?)+/g, 'someone ').trim();
  if (/^(their work|the festival day|the rain|the king's works|barley is dear)/.test(t)) return null;
  const w = t.split(/\s+/).filter(Boolean); if (w.length < 2) return null; let o = w.slice(0, 8).join(' ').replace(/[,;:]+$/, ''); while (/\s(when|who|and|the|a|of|to|about|for|with|in)$/.test(o)) o = o.replace(/\s\S+$/, '').replace(/[,;:]+$/, ''); return o;
}
const OPEN = /\b(peace|well-being|greet|hail|rejoic|lord|master)\b/i, CLOSE = /\b(farewell|go|fare well|peace|god|gods|protect)\b/i;

export class Overheard {
  private memo = new Map<string, Exchange | null>(); private said = new Map<string, Set<string>>();
  constructor(private sim: PeopleSim) {}
  /** the language both speak: the shared home tongue with a lexicon, else Aramaic (C) */
  langOf(a: number, b: number): LangId {
    const P = this.sim.pop.persons, la = voiceLang(HOME_LANG[P[a].origin] ?? P[a].origin).lang, lb = voiceLang(HOME_LANG[P[b].origin] ?? P[b].origin).lang;
    return la && la === lb ? la : 'arc';
  }
  /** the topic of a pair at a moment: [src, topic key, the fact in words] (the first that holds, by a fixed order; C) */
  topicOf(a: number, b: number, day: number, hour: number): [Exchange['src'], string, string] {
    const sim = this.sim, P = sim.pop, ha = P.home(a, day), hb = P.home(b, day);
    // 1. the simulation's own talk between their houses today
    const T = sim.living.talks.find(t => t.day === day && ((t.a === a && t.b === b) || (t.a === b && t.b === a) || (P.home(t.a, day) === ha && P.home(t.b, day) === hb) || (P.home(t.a, day) === hb && P.home(t.b, day) === ha)));
    if (T) { const E0 = sim.ledgerNow(), src = T.news?.src ?? '', evk = /^econ:\d+$/.test(src) && E0 ? E0.events[Number(src.slice(5))]?.kind ?? '' : src;
      const pay = T.intents[0]?.payload ?? {}, asked = Number(pay.grain ?? 0) > 0 ? 'grain' : Number(pay.cash ?? 0) > 0 ? 'silver' : Number(pay.labour ?? 0) > 0 ? 'labour' : pay.tool ? `the loan of ${pay.tool}` : pay.childcare ? 'minding the children' : '';
      const what = (T.kind === 'news' ? evk : asked || T.label || evk || T.kind) || T.kind; const key = /grain|buy|food|barley|harvest/.test(what) ? 'grain' : /death|mourn|funeral/.test(what) ? 'death' : /ill|sick/.test(what) ? 'sickness' : /loan|cash|silver|debt|default/.test(what) ? 'silver' : /labour|work|hire/.test(what) ? 'work' : /theft|suit|arrest/.test(what) ? 'king' : 'grain';
      return ['talk', key, `${T.kind === 'news' ? 'passing on the news' : T.kind === 'loan' ? 'agreeing a loan' : T.kind === 'work' ? 'agreeing a day\'s work' : T.kind === 'trade' ? 'striking a trade' : T.kind === 'help' ? 'asking for help' : 'talking over a visit'} (${what.replace(/_/g, ' ')})`]; }
    // D-461 (UD-32): the deeds either saw or suffered in the last days, else what either is set on (mind/initiative.ts talkOf)
    const D = sim.deeds.agency.talkOf(a, b, day); if (D) return ['deed', D[0], D[1]];
    // 2. what has happened to either house this year (the life record's own facts)
    for (const pid of [a, b]) { const L = lifeRecord(P, sim.cal, pid, day, hour), y = L.year[0];
      if (y) { const key = /died|lost|mourning/.test(y) ? 'death' : /born|had a/.test(y) ? 'birth' : /married/.test(y) ? 'wedding' : /sick/.test(y) ? 'sickness' : /harvest/.test(y) ? 'harvest' : /debt|owe|pledge|judge|silver/.test(y) ? 'silver' : /grain|barley|bread|hungry/.test(y) ? 'grain' : 'work';
        return ['life', key, `${L.name}'s house: ${y}`]; }
      if (L.needs[0]) return ['life', /barley|bread/.test(L.needs[0]) ? 'grain' : /silver|debt/.test(L.needs[0]) ? 'silver' : 'work', `${L.name}'s house needs ${L.needs[0].split(';')[0]}`];
    }
    // 3. the market, the day, the stranger, the work
    const E = sim.ledgerNow(); if (E && E.market.dearEv >= 0 && (E.events[E.market.dearEv]?.day ?? -99) > day - 30) return ['market', 'grain', 'barley is dear this month'];
    const C = sim.cal.ctx(day); if (C.festival) return ['day', 'festival', 'the festival day'];
    if (E?.hasStranger) { const St = E.stranger(); if (St.belief.has(`h:${ha}`) || St.belief.has(`h:${hb}`)) return ['stranger', 'stranger', 'the stranger in the quarter and who he says he is']; }
    const ja = P.persons[a].job, jb = P.persons[b].job; if (ja === jb) return ['work', ja === 'farmer' ? 'harvest' : 'work', `their work (${ja})`];
    return ['day', C.wx && (C.wx as any).rainH ? 'weather' : 'king', (C.wx as any).rainH ? 'the rain' : 'the king\'s works on the Terrace'];
  }
  /** the exchange of a pair at a moment (an hour block of the day): memoized, never repeated for the pair in a day */
  exchange(a: number, b: number, t = this.sim.t): Exchange | null {
    const day = Math.floor(t / 24), hour = t - day * 24, block = Math.floor(hour / 1.5), x = Math.min(a, b), y = Math.max(a, b), k = `${x}:${y}:${day}:${block}`;
    if (this.memo.has(k)) return this.memo.get(k)!; if (this.memo.size > 4000) this.memo.clear();
    const lang = this.langOf(a, b), U = unitsFor(lang), [src, key, topic] = this.topicOf(a, b, day, hour);
    const re = TOPIC_WORDS[key] ?? TOPIC_WORDS.king, topicWords = U.words.filter(w => re.test(w.gloss ?? '')), opens = [...U.lines, ...U.words].filter(w => OPEN.test(w.gloss ?? '')), closes = [...U.lines, ...U.words].filter(w => CLOSE.test(w.gloss ?? ''));
    const said = this.said.get(`${x}:${y}:${day}`) ?? new Set<string>(); let ex: Exchange | null = null;
    for (let tr = 0; tr < 6 && !ex; tr++) {
      const r = (n: number) => u01(this.sim.seed, S, h32(x, y, day), block * 16 + tr * 4 + n), pick = (l: Unit[], n: number) => l.length ? l[Math.floor(r(n) * l.length)] : null;
      const turns: Exchange['turns'] = [], add = (who: 'a' | 'b', u: Unit | null) => { if (u) turns.push({ who, unit: u }); };
      add('a', pick(opens, 0)); add('b', pick(opens, 1));
      // D-387: no attested word for the topic in this tongue: the topic said in reconstructed period speech (C)
      // D-720 (UD-23, UD-24; the holes audit #15): the pair's own fact said in reconstructed speech (the life's, the deed's, the
      // talk's: "the harvest was poor", "a son was born"), the other's answer after it; the templated line only where the fact
      // gives no sentence to say
      const pool = RC_SAY[key] ?? RC_SAY.king, say = pool[Math.floor(r(9) * pool.length)], fact = factSentence(topic);
      if (fact || !topicWords.length) { add('a', reconstructedUnit(fact ?? say[0], lang)); if (r(10) < 0.8) add('b', reconstructedUnit(say[1], lang)); }
      add('a', pick(topicWords, 2)); add('a', pick(topicWords.filter(w => w.id !== turns[turns.length - 1]?.unit.id), 3));
      add('b', pick(topicWords, 5) ?? pick(U.lines, 6)); add(r(7) < 0.5 ? 'a' : 'b', pick(closes, 8));
      const sig = turns.map(t => t.unit.id).join('|'); if (!turns.length || said.has(sig)) continue;
      said.add(sig); this.said.set(`${x}:${y}:${day}`, said); ex = { a, b, day, block, lang, key, carried: turns.some(t => t.unit.kind === 'word' && re.test(t.unit.gloss ?? '')) || turns.some(t => t.unit.id.startsWith('rc:')), rc: turns.some(t => t.unit.id.startsWith('rc:')) || undefined, src, topic, turns: turns.map(t => ({ ...t, who: t.who === 'a' ? (a === x ? 'a' : 'b') : (a === x ? 'b' : 'a') })) as Exchange['turns'] };
    }
    if (ex) { ex.a = a; ex.b = b; } this.memo.set(k, ex); return ex;
  }
  // ---- the voices' hook (voices.ts pickUnit): the next unit a talking person says, from the exchange with the one they talk with
  private groups = new Map<string, string[]>(); private cursor = new Map<string, number>(); private topics = new Map<string, string>();
  /** what a speaker's present exchange is about (the translation layer's note, out of world), or undefined */
  topicFor(key: string): string | undefined { return this.topics.get(key); }
  /** the people near the listener by the place they are at (the audio loop's list: who talks with whom) */
  noteNear(near: readonly { key: string; group: string | null; talking: boolean }[]) {
    this.groups.clear(); for (const n of near) if (n.group && n.talking) (this.groups.get(n.group) ?? this.groups.set(n.group, []).get(n.group)!).push(n.key);
  }
  private pidOf(key: string) { return key[0] === 'a' ? this.sim.agents[Number(key.slice(1))]?.pid ?? -1 : key[0] === 'p' ? Number(key.slice(1)) : -1; }
  /** the unit this person says next in the exchange with their partner at the same place, or null (the voices pick as before) */
  next(key: string, group: string | null, lang: string | null): Unit | null {
    if (!group) return null; const g = this.groups.get(group); if (!g || g.length < 2) return null;
    const other = g.find(k => k !== key); if (!other) return null; const a = this.pidOf(key), b = this.pidOf(other); if (a < 0 || b < 0) return null;
    const ex = this.exchange(a, b); if (!ex || ex.lang !== lang) return null;
    const mine = ex.turns.filter(t => (t.who === 'a') === (ex.a === a)); if (!mine.length) return null;
    const ck = `${key}|${ex.day}|${ex.block}`, i = this.cursor.get(ck) ?? 0; this.cursor.set(ck, i + 1); if (this.cursor.size > 4000) this.cursor.clear();
    if (i < mine.length) { this.topics.set(key, ex.topic); return mine[i].unit; } return null; // (said all their part: the voices go on as before, a murmur)
  }
}
