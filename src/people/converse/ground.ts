// D-315 (after the GPU runs; T-E9, T-E10): what goes next to the stranger's words, where a 1-2 B model reads it.
// (1) groundFact: the ONE fact of the person's own life most relevant to what the stranger said (T-E9 run 3: 26 of gemma's 27
//     failures were replies "not grounded in the person's own life", with the whole life in the brief at the top). The
//     question's kind picks it (who they are, their house, their work, their day, the year's news, the place, the gods and the
//     king; any other question, the adversarial ones too, gets what they are doing now and someone of their house by name).
// (2) isRecallQuestion: the stranger asks about earlier meetings; the simulation then picks the one remembered fact
//     (talk.ts recallFact) and the model only puts it in its own words (turn.ts).
// (3) judgePrompt: a small judge of a reply to an ask (agrees or refuses), asked of the loaded model in two tokens, not a
//     word list (mind.ts judge). Out of world: English, the model's brief.
import type { LifeRecord } from './life';
import { ageWords } from './words';
import { hearAsPerson } from './hear';
import { toYou } from '../deeds/lately';

const cut = (s: string, n: number) => { const w = s.split(/\s+/); return w.length <= n ? s : w.slice(0, n).join(' '); };
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const now = (L: LifeRecord) => cut(L.today.now.replace(/^[a-z_ ]+: /, ''), 12);
const kinOf = (L: LifeRecord, n = 2) => L.household.slice(0, n).map(k => k.name === 'unnamed' ? `your ${k.rel.replace(/^the /, '')}` : /^kins|^the old/.test(k.rel) ? `${k.name} (${k.rel})` : `your ${k.rel} ${k.name}`).join(' and ');
/** what a person of the town cannot know: the king's own doings, the far lands' kings, the empire's numbers, the next king */
const UNKNOWN_Q = /\b(?:(?:the king|xerxes) (?:eat|eats|ate|drink|drinks|drank|say|said|think|thinks|thought|dream|dreamt|sleep|slept|do|does|did|wear|wears|wore)\b|king of the (?!gods)|kings? of (?:india|the indians|the greeks|egypt|the scythians)|how many (?:soldiers|men|people|horses|ships|cities|lands|peoples)\b.*\b(?:king|empire|lands|world)|(?:who|which) will (?:be king|rule|reign|sit on the throne)|be king after|after (?:king )?xerxes|next king)/;
/** "where do you live", "take me to your house": the place, not the family */
const WHERE_Q = /\b(?:where (?:do|does) (?:you|your (?:family|house(?:hold)?)) (?:live|stay|sleep)|where is your (?:house|home)|take me (?:to your (?:house|home)|there|home)|show me (?:your house|where you live)|lead me to your (?:house|home))\b/;
/** the one life fact for the stranger's words (a sentence to the person, second person) */
export function groundFact(L: LifeRecord, said: string): string {
  const s = said.toLowerCase(); const kin = kinOf(L); const job = cut(L.job, 10);
  // D-456 (the shipped 1.5B over 200 briefs): a question the person cannot answer (a later or foreign word, what is to come,
  // the king's own table or the far lands' kings and numbers) got the day's fact and was answered anyway ("The king ate a loaf
  // of bread", "The king will be changed, for it is written in the stars") or passed over: the fact is now that they do not
  // know, said first; and "where do you live" read as a question about the family (the place was named in 23 % of answers)
  const h = hearAsPerson(said);
  if (h.unknown.length || h.future || UNKNOWN_Q.test(s)) return `you do not know that and cannot guess it: say so plainly first, then speak of your own day: right now: ${now(L)}`;
  if (WHERE_Q.test(s)) return `you live in ${cut(L.home.replace(/ \(a household of.*\)$/, ''), 16)}; say where it is; right now: ${now(L)}`;
  const pick: [RegExp, () => string][] = [
    // (D-371/D-373: the past, the cares and the house's real debts, before the general rules)
    [/\b(where (are|were) you (from|born)|where do you come from|grow up|grew up|your (father|parents|people)|long ago|before (this|that)|in the old days|the war|remember the)\b/, () => `you are ${L.name}${L.byname ? `, ${L.byname}` : ''}, ${L.origin}; ${L.past.slice(0, 2).map(x => cut(x, 14)).join('; ') || `you live in ${cut(L.home, 10)}`}`],
    [/\b(worr(y|ied|ies)|troubl(e|es|ed)|afraid|fear|hope|wish|dream|happy|sad|how are you|how is (life|it)|what do you want)\b/, () => [...L.worries.map(w => `you are worried about ${w}`), ...L.hopes.map(h => `you hope for ${h}`)].slice(0, 2).join('; ') || `right now: ${now(L)}`],
    [/\b(can i help|need (any|some)thing|what do you need|need help|help you|anything i can do)\b/, () => L.needs.length ? `your house needs ${L.needs[0]}` : `your house wants for nothing just now; right now: ${now(L)}`],
    [/\b(rumou?rs?|gossip|what have you heard|heard anything|talk of the|what do people say)\b/, () => L.news.length ? L.news.join('; ') : `you have heard nothing worth telling; right now: ${now(L)}`],
    [/\b(debts?|owe|owed|owes|silver|loan|lend|borrow|money|price|poor|rich)\b/, () => L.debts.length ? `your house: ${L.debts.slice(0, 2).join('; ')}` : `your house owes no one; right now: ${now(L)}`],
    [/\b(who are you|your name|yourself|how old)\b/, () => `you are ${L.name}${L.byname && L.name !== `the ${L.byname}` ? `, ${L.byname}` : ''}, ${ageWords(L.age)}, ${L.origin}${kin ? `; ${kin} live${L.household.length > 1 ? '' : 's'} with you` : ''}`],
    [/\b(family|wife|husband|children|child|son|daughter|mother|father|house|live|home|sick|ill)\b/, () => kin ? `in your house: ${kinOf(L, 3)}${L.year.find(y => /sick|died|born|married/.test(y)) ? `; ${L.year.find(y => /sick|died|born|married/.test(y))}` : ''}` : `you live with your work group; your work: ${job}`],
    [/\b(work|job|paid|pay|hard|labou?r|trade|craft)\b/, () => `your work: ${job}${L.group ? ` (${cut(L.group, 6)})` : ''}; right now: ${now(L)}`],
    [/\b(doing|today|eat|eaten|evening|tonight|morning|now|later|busy)\b/, () => `right now: ${now(L)}${L.today.next ? `; after this: ${cut(L.today.next, 10)}` : ''}`],
    // (D-720: what was lately done by and to them among the neighbours, before the year's facts and the day's events)
    [/\b(news|happened|harvest|quarrel|lately|quarter|year|neighbou?rs?)\b/, () => [...(L.lately ?? []).slice(0, 1).map(toYou), ...L.year.slice(0, 1), ...L.quarrels.slice(-1), ...(L.yesterday ?? []).slice(0, 1).map(y => `yesterday: ${y}`), ...L.today.events.slice(0, 1)].filter(Boolean).slice(0, 3).map(x => cut(x, 14)).join('; ') || `right now: ${now(L)}`],
    [/\byesterday\b/, () => L.yesterday?.length ? `yesterday: ${L.yesterday.slice(0, 2).map(y => cut(y, 10)).join('; ')}` : `yesterday was like today; right now: ${now(L)}`],
    [/\b(terrace|water|well|villages?|where|far|place|river|town)\b/, () => `you live in ${cut(L.home.replace(/ \(a household of.*\)$/, ''), 14)}; right now: ${now(L)}`],
    [/\b(gods?|pray|king|festival|xerxes|offering)\b/, () => `${L.speech.find(x => /^oath/.test(x))?.replace(/^oath: /, 'you swear ') ?? 'you swear by the gods'}; ${kin ? `${kin} of your house` : `your work: ${job}`}`],
  ];
  for (const [re, f] of pick) if (re.test(s)) return lower(f());
  return `right now: ${now(L)}${kin ? `; at home: ${kin}` : ''}`;
}
export function groundLine(L: LifeRecord, said: string): string { return `(Answer from your own life: ${groundFact(L, said)}.)`; }
/** the stranger asks about earlier meetings with them (or what others said of them) */
export const RECALL_Q = /\b(remember|met (me|before|yesterday)|we met|seen me|know me|heard (anything )?(of|about) me|(speak|spoke|spoken|say|said|talk|talked)( to you)? (of|about) (me|the stranger)|what passed|did i (ask|say)|last time|anyone (speak|talk|say))/i;
export const isRecallQuestion = (said: string) => RECALL_Q.test(said);
/** the judge's messages: does the reply agree to do what was asked? (YES, NO or UNSURE: only a NO is a refusal) */
export function judgePrompt(asked: string, reply: string): { role: 'system' | 'user'; content: string }[] {
  return [{ role: 'system', content: 'You judge short replies. Answer with one word: YES, NO or UNSURE.' },
    { role: 'user', content: `Someone was asked: “${asked}”\nThey replied: “${reply}”\nDid they agree to do it? YES if they agreed, NO if they refused, UNSURE if they said neither.` }];
}
