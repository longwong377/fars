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

const cut = (s: string, n: number) => { const w = s.split(/\s+/); return w.length <= n ? s : w.slice(0, n).join(' '); };
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const now = (L: LifeRecord) => cut(L.today.now.replace(/^[a-z_ ]+: /, ''), 12);
const kinOf = (L: LifeRecord, n = 2) => L.household.slice(0, n).map(k => /^kins|^the old/.test(k.rel) ? `${k.name} (${k.rel})` : `your ${k.rel} ${k.name}`).join(' and ');
/** the one life fact for the stranger's words (a sentence to the person, second person) */
export function groundFact(L: LifeRecord, said: string): string {
  const s = said.toLowerCase(); const kin = kinOf(L); const job = cut(L.job, 10);
  const pick: [RegExp, () => string][] = [
    // (D-371/D-373: the past, the cares and the house's real debts, before the general rules)
    [/\b(where (are|were) you (from|born)|where do you come from|grow up|grew up|your (father|parents|people)|long ago|before (this|that)|in the old days|the war|remember the)\b/, () => `you are ${L.name}${L.byname ? `, ${L.byname}` : ''}, ${L.origin}; ${L.past.slice(0, 2).map(x => cut(x, 14)).join('; ') || `you live in ${cut(L.home, 10)}`}`],
    [/\b(worr(y|ied|ies)|troubl(e|es|ed)|afraid|fear|hope|wish|dream|happy|sad|how are you|how is (life|it)|what do you want)\b/, () => [...L.worries.map(w => `you are worried about ${w}`), ...L.hopes.map(h => `you hope for ${h}`)].slice(0, 2).join('; ') || `right now: ${now(L)}`],
    [/\b(debts?|owe|owed|owes|silver|loan|lend|borrow|money|price|poor|rich)\b/, () => L.debts.length ? `your house: ${L.debts.slice(0, 2).join('; ')}` : `your house owes no one; right now: ${now(L)}`],
    [/\b(who are you|your name|yourself|how old)\b/, () => `you are ${L.name}${L.byname ? `, ${L.byname}` : ''}, ${L.age}, ${L.origin}${kin ? `; ${kin} live${L.household.length > 1 ? '' : 's'} with you` : ''}`],
    [/\b(family|wife|husband|children|child|son|daughter|mother|father|house|live|home|sick|ill)\b/, () => kin ? `in your house: ${kinOf(L, 3)}${L.year.find(y => /sick|died|born|married/.test(y)) ? `; ${L.year.find(y => /sick|died|born|married/.test(y))}` : ''}` : `you live with your work group; your work: ${job}`],
    [/\b(work|job|paid|pay|hard|labou?r|trade|craft)\b/, () => `your work: ${job}${L.group ? ` (${cut(L.group, 6)})` : ''}; right now: ${now(L)}`],
    [/\b(doing|today|eat|eaten|evening|tonight|morning|now|later|busy)\b/, () => `right now: ${now(L)}${L.today.next ? `; after this: ${cut(L.today.next, 10)}` : ''}`],
    [/\b(news|happened|harvest|quarrel|lately|quarter|year)\b/, () => [...L.year.slice(0, 1), ...L.quarrels.slice(-1), ...L.today.events.slice(0, 1)].filter(Boolean).map(x => cut(x, 14)).join('; ') || `right now: ${now(L)}`],
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
