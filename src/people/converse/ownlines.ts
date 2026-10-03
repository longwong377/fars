// D-720 (UD-07, UD-08, UD-21, UD-24, UD-32; CLAUDE.md "the second question"): THE PERSON'S OWN LINES, grounded. Where the
// language model is not there (loading for minutes on a first visit, a graphics card that cannot hold it, a browser without
// WebGPU, the cloud), the people answered every question with one of three glosses: "Greetings, stranger.", "I do not
// understand you, stranger.", "Go well, stranger." (ui.ts ownLine, D-376). Thirty people followed for a day (tools/dev/
// follow30.ts) answered 0 of 150 questions from their own lives, and nothing the stranger asked of them reached the world.
//
// OwnMind stands in the model's place in the SAME turn (turn.ts talkTurn): the trust gate, the simulation's word on an ask, a
// deed, a step of the sandbox, the memory of the stranger and the gossip after are all the simulation's, as with the model;
// only the words are made here, deterministically, from the person's life record (life.ts: the simulation's own facts) and
// from what the turn tells them (the note, the brief, the picked fact), in the first person, in their manner (temperament,
// habits of speech, oath, age), varied by a draw keyed to the person and the turn. Out of world (the translation layer's
// English); the person is heard in their own language and voice (voice.ts heardReply), tier C as before.
import type { LifeRecord } from './life';
import type { Answer, AskOpts } from './mind';
import type { Knows, Turn } from './prompt';
import type { Intent } from './intent';
import { fenceHits } from './fence';
import { spoken } from './spoken';
import { hearAsPerson } from './hear';

const PAREN = /\s*\([^)]*\)/g;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const end = (s: string) => /[.!?…”]$/.test(s) ? s : `${s}.`;
const TAIL = /\s+(?:for|of|the|and|in|on|to|with|a|an|at|by|from|its|their|his|her|then|or)$/;
const cut = (s: string, n: number) => { const w = s.replace(PAREN, '').split(/\s+/); if (w.length <= n) return w.join(' '); let t = w.slice(0, n).join(' ').replace(/[,;:]$/, ''); while (TAIL.test(t)) t = t.replace(TAIL, ''); return t; };
/** a draw in [0,1) keyed to the person, the turn and a slot (FNV-1a over the key: pure, no Math.random) */
function draw(L: LifeRecord, said: string, slot: number): number {
  let h = 2166136261 ^ slot; for (const ch of `${L.seed}|${L.pid}|${L.day}|${Math.floor(L.hour)}|${said}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296;
}
const pick = <T>(L: LifeRecord, said: string, slot: number, xs: T[]): T => xs[Math.floor(draw(L, said, slot) * xs.length)];

/** a phrase of the life record (third person, the brief's words) said by the person themself */
export function firstPerson(s: string): string {
  let t = s.replace(PAREN, '').trim();
  t = t.replace(/^born in /, 'I was born in ').replace(/^the (father|mother|husband|wife)\b/, 'my $1')
    .replace(/^a (brother|sister|son|daughter|kinsman) (was born|did not come back)/, 'a $1 of mine $2')
    .replace(/^(the death of|the rising|the risings|the army|the king)/, 'I remember $1')
    .replace(/^is to be married/, 'I am to be married').replace(/^is sick/, 'I am sick').replace(/^is owed/, 'we are owed').replace(/^owes /, 'we owe ')
    .replace(/^(came|lost|married|was|marched|lived|began|had|moved|must|could not|borrowed|paid|worked|went|fell|broke)\b/, 'I $1')
    .replace(/^is (asleep|busy|sick|ill|hurt|away|working|on |at |in |too |not |minding|watching|with )/, 'I am $1').replace(/^has /, 'I have ').replace(/^(asleep|busy|sick|ill|hurt|away|on watch|on duty|at work|too young|too old|too tired|in mourning|minding|watching)\b/, 'I am $1')
    .replace(/^the house\b(?! of)/, 'our house').replace(/^the group’s\b/, 'our group’s').replace(/^one of the house\b/, 'one of our house')
    .replace(/^there was a fire in the house/, 'there was a fire in our house').replace(/^the harvest\b/, 'our harvest').replace(/^the ox\b/, 'our ox')
    .replace(/^they were\b/, 'we were').replace(/^the judge\b/, 'the judge');
  return t.replace(/\bgave them\b/g, 'gave us').replace(/\bhelped them\b/g, 'helped us').replace(/\blent them\b/g, 'lent us').replace(/\bfor them\b/g, 'for us')
    .replace(/\bfound for them\b/g, 'found for us').replace(/\bof theirs\b/g, 'of ours').replace(/\btheir own\b/g, 'my own').replace(/\btheir\b/g, 'our').replace(/\bthemselves\b/g, 'ourselves')
    .replace(/\byour\b/g, 'my').replace(/ or help\b/, '');
}

interface Manner { addr: string; oath: string | null; terse: boolean; warm: boolean; child: boolean; old: boolean; curious: boolean; pious: boolean; wit: boolean; wary: boolean }
function mannerOf(L: LifeRecord): Manner {
  const t = `${L.temperament}; ${L.speech.join('; ')}`.toLowerCase();
  const oath = /oath: “([^”]+)”/.exec(L.speech.join('; '))?.[1] ?? null;
  const child = L.age < 13, old = L.age > 55;
  const addr = /calls the stranger “child”/.test(t) ? 'child' : /formal, uses titles/.test(t) ? 'my lord' : child ? 'stranger' : draw(L, 'addr', 1) < 0.5 ? 'friend' : 'stranger';
  return { addr, oath, child, old, terse: /wary|guarded|shy|sparing|few words|brusque|blunt|short-tempered|says little/.test(t), warm: /warm|open-hearted|friendly|cheerful|light-hearted|good-humoured|talks fast|tells everything/.test(t),
    curious: /curious|eager for news|inquisitive|asks the stranger questions/.test(t), pious: /pious|devout|careful of the gods|swears by the gods/.test(t), wit: /dry wit|\bdry\b|teasing|merry/.test(t), wary: /wary|guarded|shy and slow/.test(t) };
}
/** the people of the house as the person names them: "my wife Amagaunā, my sons Karma and Hašina" */
function houseWords(L: LifeRecord, n = 4): string {
  const by = new Map<string, string[]>(); let unnamed = 0;
  for (const k of L.household) { if (k.name === 'unnamed') { unnamed++; continue; } const rel = k.rel.replace(/^the /, ''); if (/^kins/.test(rel)) continue; by.set(rel, [...(by.get(rel) ?? []), k.name]); }
  const plural = (r: string) => /^(wife|husband|mother|father)$/.test(r) ? r : r === 'child' ? 'children' : /(man|woman)$/.test(r) ? r.replace(/man$/, 'men') : `${r}s`;
  const and = (xs: string[]) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
  const parts = [...by].slice(0, n).map(([rel, ns]) => /^old /.test(rel) ? `${and(ns)}, the ${rel}` : `my ${ns.length > 1 ? plural(rel) : rel} ${and(ns)}`);
  const kins = L.household.filter(k => /^kins/.test(k.rel) && k.name !== 'unnamed').map(k => k.name);
  if (kins.length) parts.push(kins.length > 3 ? `${kins.slice(0, 2).join(', ')} and others of the house` : kins.length > 1 ? `${and(kins)}, of my kin` : `${kins[0]}, of my kin`);
  if (unnamed) parts.push(unnamed > 1 ? 'the little ones' : 'the baby');
  return and(parts);
}
const jobShort = (L: LifeRecord) => cut(L.job.replace(/^keeper of the household: /, 'I keep the house: '), 14);
/** a plan reason as the person says it: their own (his, her, the mother: mine), the first clause (", then home out of the heat" goes) */
const ownWords = (w: string, n = 12) => cut(w.replace(/^[a-z_ ]+: /, '').replace(/,? then .*$/, '').replace(/\b(his|her)\b/g, 'my').replace(/\bthe (mother|father|husband|wife|children|baby|household)\b/g, 'my $1'), n);
const nowWords = (L: LifeRecord) => ownWords(L.today.now);
/** "just now I am going home" / "just now it is the midday meal" (the plan's reason is a doing or a thing) */
const nowSay = (L: LifeRecord) => { const n = nowWords(L); return /^[a-z]+ing\b/.test(n) ? `just now I am ${n}` : /^(at|in|on|with|away)\b/.test(n) ? `just now I am ${n}` : `just now it is ${n}`; };
const iAm = (L: LifeRecord) => /^I keep/.test(jobShort(L)) ? jobShort(L) : `I am ${jobShort(L)}`;

/** the life's answer to a question (no ask, no deed): by its kind, as ground.ts picks the model's fact */
function lifeAnswer(L: LifeRecord, said: string, M: Manner): string[] {
  const s = said.toLowerCase(), out: string[] = [], h = hearAsPerson(said), has = (re: RegExp) => re.test(s);
  const kin = houseWords(L, 3);
  const home = cut(L.home.replace(/ \(a household of.*\)$/, ''), 16);
  if (h.unknown.length || h.future || has(/\b(king (eat|eats|ate|think|thinks|dream)|how many (soldiers|men|people|horses|ships|cities|lands)|next king|be king after|after (king )?xerxes|who will (be king|rule|reign))\b/))
    return [pick(L, said, 3, ['I do not know that', 'How would I know such a thing', 'That I cannot tell you', 'Nobody has told me that']) + (M.wit ? '; ask the scribes, they know everything' : ''), `I know ${M.child ? 'my house and the lane' : 'my own work'}: ${nowSay(L)}`];
  if (has(/\b(where (do|does) (you|your (family|house(hold)?)) (live|stay|sleep)|where is your (house|home))\b/)) return [`I live in ${home}`, kin ? `with ${kin}` : ''];
  if (has(/\b(where (are|were) you (from|born)|where do you come from|grow up|grew up|your (father|parents|people)|long ago|in the old days|the war)\b/)) {
    const past = L.past.slice(0, 2).map(firstPerson); return [`I am ${L.origin}${L.byname ? `, ${L.byname}` : ''}`, ...(past.length ? past : [`I live in ${home}`])]; }
  if (has(/\b(worr(y|ied|ies)|troubl(e|es|ed)|afraid|fear|hope|wish|dream|happy|sad|how are you|how is (life|it)|what do you want)\b/)) {
    const w = L.worries.map(x => `I worry about ${firstPerson(x)}`), hp = L.hopes.map(x => /^to /.test(x) ? `I hope ${firstPerson(x)}` : `I hope for ${firstPerson(x)}`);
    const nd = L.needs.map(x => `my house needs ${cut(x.split(';')[0], 10)}`), q = L.quarrels.map(x => `I ${firstPerson(x)}`);
    const all = [...w.slice(0, 1), ...nd.slice(0, 1), ...q.slice(-1), ...hp.slice(0, 1)];
    return all.length ? all.slice(0, M.terse ? 1 : 2) : [`Nothing troubles me today; ${nowSay(L)}`]; }
  if (has(/\b(can i help|need (any|some)thing|what do you need|need help|help you|anything i can do)\b/)) return L.needs.length ? [`My house needs ${cut(L.needs[0].split(';')[0], 10)}`, /would ask even a stranger, offering (.*)$/.exec(L.needs[0]) ? `we would give ${/offering (.*)$/.exec(L.needs[0])![1]} for it` : ''] : [`We want for nothing just now, ${M.pious ? 'thanks be to the gods' : 'thank you'}`];
  if (has(/\b(neighbou?rs?|friends?)\b/) && (L.lately?.length || L.friends.length)) return [...(L.lately ?? []).slice(0, 1), L.friends[0] ? `${L.friends[0].name} is ${/^kin/.test(L.friends[0].how) ? 'kin of mine' : /same group/.test(L.friends[0].how) ? 'one I work with' : 'a neighbour'}${L.friends[0].feeling === 'close' ? ', and close to me' : /bad terms/.test(L.friends[0].feeling) ? ', and we do not speak since a quarrel' : ''}` : ''];
  if (has(/\b(rumou?rs?|gossip|what have you heard|heard anything|talk of the|what do people say|news)\b/)) return L.news.length ? L.news.slice(0, 2).map(x => `I ${x.replace(/\s*\(not sure it is true\)/, ', if it is true')}`) : ['I have heard nothing worth telling'];
  if (has(/\b(debts?|owe|owed|owes|silver|loan|lend|borrow|money|poor|rich)\b/)) return L.debts.length ? L.debts.slice(0, 2).map(firstPerson) : ['We owe no one, and no one owes us'];
  if (has(/\b(who are you|your name|yourself|how old)\b/)) {
    const by = L.byname && L.name !== `the ${L.byname}` ? `, ${L.byname}` : '';
    return [`I am ${L.name}${by}${M.child ? `, and I am ${ageNum(L.age)}` : ''}`, M.child ? (kin ? `I live with ${kin}` : '') : iAm(L), !M.terse && L.origin && !/Persian/.test(L.origin) ? `I am ${L.origin}${L.past[0] && /^born in/.test(L.past[0]) ? `, ${L.past[0]}` : ''}` : ''];
  }
  if (has(/\b(family|wife|husband|children|child|son|daughter|mother|father|house|live|home|sick|ill|kin)\b/)) {
    const ev = L.year.find(y => /sick|died|born|married|mourning/.test(y));
    if (kin) return [`In my house: ${kin}`, ev ? firstPerson(ev) : L.kinHouses[0] ? `my kin keep ${cut(L.kinHouses[0], 4)}${L.kinHouses.length > 1 ? ' and others nearby' : ''}` : ''];
    return [L.group ? `I live with the others of ${L.group}` : 'I have no house of my own here', L.kinHouses[0] ? `my kin keep ${cut(L.kinHouses[0], 4)}` : L.past.find(x => /died|widowed|lost/.test(x)) ? firstPerson(L.past.find(x => /died|widowed|lost/.test(x))!) : ''];
  }
  if (has(/\b(work|job|paid|pay|hard|labou?r|trade|craft|do you do)\b/) && M.child && /child/.test(L.job)) return [L.age < 7 ? 'I am too little for work' : `I help ${L.household.some(k => k.rel === 'mother') ? 'my mother' : 'at home'}${L.zone === 'plain' ? ' and mind the goats' : ''}`, nowSay(L)];
  if (has(/\b(work|job|paid|pay|hard|labou?r|trade|craft|do you do)\b/)) return [iAm(L) + (L.group && !L.job.includes(L.group.split(' ').slice(-2).join(' ')) ? `, with ${L.group}` : ''), L.rank ? `I am ${L.rank}` : '', nowSay(L)];
  if (has(/\byesterday\b/)) return L.yesterday?.length ? L.yesterday.slice(0, 2).map(yesterdaySay) : ['Yesterday was a day like this one', nowSay(L)];
  if (has(/\b(doing|today|eat|eaten|evening|tonight|morning|now|later|busy)\b/)) return [nowSay(L), L.today.next ? `after this, ${cut(L.today.next, 10)}` : ''];
  if (has(/\b(happened|harvest|quarrel|lately|quarter|year|new)\b/)) {
    const y = [...(L.lately ?? []).slice(0, 1), ...L.year.slice(0, 2).map(firstPerson), ...(L.lately ?? []).slice(1, 2), ...L.quarrels.slice(-1).map(x => `I ${firstPerson(x)}`)];
    const yd = (L.yesterday ?? []).slice(0, 1).map(yesterdaySay);
    if (y.length) return [...y, ...yd].slice(0, M.terse ? 1 : 2);
    if (yd.length) return [pick(L, said, 4, ['Nothing much this year', 'A quiet year for us so far']), yd[0]];
    return [pick(L, said, 4, ['A quiet year for us so far', 'Nothing much this year', 'This year has been quiet']), L.past[1] ? firstPerson(L.past[1]) : L.today.events[0] ? `today: ${cut(L.today.events[0], 12)}` : ''];
  }
  if (has(/\b(terrace|water|well|villages?|where|far|place|river|town)\b/)) return [`I live in ${home}`, nowSay(L)];
  // (D-720, W14: the king is named as his people named him, his father and his year; what he does is not theirs to know)
  if (has(/\b(king|xerxes|xšayaršā|khshayarsha)\b/)) return [M.child ? 'The king is Xšayaršā, the great king' : 'Xšayaršā is king, son of Dārayavauš, in the nineteenth year of his reign', /\b(what|how|does|did|will|where)\b/.test(s) ? 'what the king does is not for me to know' : M.pious && M.oath ? `may the gods keep him; ${M.oath}` : ''];
  if (has(/\b(gods?|pray|festival|offering)\b/)) return [M.oath ? `I swear ${M.oath}` : 'I swear by the gods', L.today.events.find(e => /festival|offering/.test(e)) ? `today: ${cut(L.today.events.find(e => /festival|offering/.test(e))!, 10)}` : 'we make the offerings on the right days'];
  return [nowSay(L), kin && !M.terse ? `at home are ${kin}` : ''];
}
/** a reason of yesterday's plan said as a memory: "yesterday I was helping kin with their harvest", "yesterday: a night turn of water" */
const yesterdaySay = (y: string) => { const t = firstPerson(ownWords(y.replace(/^[^:]*: /, ''))); return /^[a-z]+ing\b|^(at|in|on|with)\b/.test(t) ? `yesterday I was ${t}` : `yesterday, ${t}`; };
const ageNum = (a: number) => ['nothing', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][a] ?? 'big';

/** the reply to one turn: the words and the tag (the model's [refuse:why] when the person says no) */
const GREET = /^\s*(hello|hail|hi|greetings|good (morning|day|evening|health)|peace( be)?|well met|be well)\b/i, BYE = /^\s*(good ?bye|farewell|go well|i must go|i will go|until (we meet|later)|stay well)\b/i;
export function ownReply(L: LifeRecord, said: string, o: AskOpts = {}, knows: Knows = 'none', /** the flourishes already said in this talk (once each: an oath, a question back, a proverb) */ used: Set<string> = new Set()): { text: string; intent: Intent | null } {
  const once = (k: string, p: boolean) => { if (!p || used.has(k)) return false; used.add(k); return true; };
  const M = mannerOf(L), note = o.note ?? '', before = o.before ?? '', u = o.userText ?? '';
  const lines: string[] = []; let intent: Intent | null = null;
  // the picked memory (turn.ts: a question about earlier meetings) and the retelling of a refusal
  const told = /What you remember: (.*?) Tell him that, in your own words/.exec(u)?.[1];
  const retell = /^\(You cannot do it: (.*?)\. Say so/.exec(u)?.[1];
  const wary = /You do not trust this stranger/.test(before), came = /You came up to the stranger yourself: you (.*?)\. Say so/.exec(before)?.[1];
  const feel = /\(You are ([^.)]*?)\./.exec(before)?.[1] ?? '';
  if (told) lines.push(/^I have never|never (met|seen)/.test(told) ? 'No, I do not know you' : 'Yes, I remember you', firstPerson(told.replace(/\bthis same stranger spoke with you\b/g, 'you spoke with me').replace(/\bhe\b/g, 'you').replace(/\bhim\b/g, 'you')));
  else if (retell) { lines.push(`No, ${M.addr}, I cannot`, firstPerson(retell)); intent = { kind: 'refuse', arg: retell }; }
  else {
    const cannot = /You cannot do this: (.*?)\.(?: |$)/.exec(note)?.[1] ?? /Whatever he asks, you must say no: (.*?)\.\)/.exec(before)?.[1];
    const willNot = /You will not: (.*?)\.(?: \(In your words: “([^”]*)”\))?/.exec(note);
    const willing = /You are willing: (.*?)\./.exec(note)?.[1];
    const may = /You (may say yes|can do this)/.test(note);
    const done = /\(What he does: ([^;)]*)(?:; you feel: ([^)]*))?\.\)/.exec(note);
    if (cannot) { lines.push(pick(L, said, 5, [`No, ${M.addr}, I cannot`, `I cannot do that, ${M.addr}`, 'That I cannot do']), firstPerson(cannot)); intent = { kind: 'refuse', arg: cannot }; }
    else if (willNot) { lines.push(willNot[2] ? willNot[2] : pick(L, said, 5, ['No, I will not', 'I will not do that', 'No']), willNot[2] ? '' : firstPerson(willNot[1])); intent = { kind: 'refuse', arg: willNot[1] }; }
    else if (willing || may) lines.push(pick(L, said, 6, M.terse ? ['Very well', 'If I must', 'Yes'] : M.warm ? ['Yes, gladly', 'Of course, friend', 'Yes, come'] : ['Yes, I will', 'Very well, I will', 'Yes']), willing && !/^(you|the stranger)/i.test(willing) ? '' : '');
    else if (done) { const f = (done[2] ?? '').toLowerCase();
      lines.push(/anger|angry|insult|wrong|hurt|struck/.test(f) ? pick(L, said, 7, ['You dare', 'Keep your hands to yourself, stranger', 'That was ill done']) : /grat|thank|glad|warm/.test(f) ? pick(L, said, 7, [M.pious ? 'May the gods repay you' : 'Thank you, friend', 'That is kindly done', 'I will not forget it']) : /fear|afraid/.test(f) ? 'Leave me be' : pick(L, said, 7, ['So', 'I see', 'Well'])); }
    if (!lines.length && GREET.test(said)) lines.push(knows === 'none' || knows === 'heard' ? pick(L, said, 17, [`Greetings, ${M.addr}`, `Peace to you, ${M.addr}`, `Be well, ${M.addr}`]) : pick(L, said, 17, [`You again, ${M.addr}`, `Greetings again, ${M.addr}`]), knows === 'none' && !M.wary ? `I am ${L.name}${M.child ? '' : `, ${jobShort(L).replace(/^I keep the house: .*/, 'of this house')}`}` : nowSay(L));
    else if (!lines.length && BYE.test(said)) lines.push(pick(L, said, 18, [`Go well, ${M.addr}`, 'Go in peace', `Safe roads, ${M.addr}`]), M.oath && M.pious ? `${M.oath.replace(/^by /, 'May ')} keep you` : '');
    if (!lines.length || (!intent && /\?\s*$/.test(said) && !may && !willing)) lines.push(...lifeAnswer(L, said, M));
  }
  if (came && !told) lines.unshift(`I came to ${came.replace(/^want to /, '')}`);
  if (/The stranger speaks of coins/.test(before)) lines.unshift(pick(L, said, 19, ['Coins? Silver is weighed here, on the scales', 'Struck pieces? We weigh our silver here', 'Those I seldom see; silver is weighed']));
  if (/angry with him/.test(feel) && !intent) lines.unshift('I have not forgotten what you did');
  else if (/grateful to him|fond of him/.test(feel) && !intent && draw(L, said, 8) < 0.6) lines.unshift(pick(L, said, 9, ['Ah, it is you again', 'Welcome back, friend', 'You again, and welcome']));
  // the manner: a wary or distrusting person gives one thing; a warm one adds a word; a pious one swears; a curious one asks back
  let ls = lines.map(x => x.trim()).filter(Boolean); if (wary || M.terse) ls = ls.slice(0, wary ? 1 : 2);
  if (!ls.length) ls = ['…'];
  ls[0] = cap(ls[0]); for (let i = 1; i < ls.length; i++) ls[i] = cap(ls[i]);
  if (once('oath', !wary && M.pious && !!M.oath && !intent && draw(L, said, 10) < 0.5)) ls.push(`${cap(M.oath!)}, it is so`);
  if (once('ask', !wary && M.curious && !M.child && draw(L, said, 11) < 0.6)) ls.push(pick(L, said, 12, ['And you, where are you from?', 'And what brings you here?', 'Have you news from the road?']));
  if (once('old', !wary && M.old && draw(L, said, 13) < 0.5)) ls.push(pick(L, said, 14, ['It was different under the king’s father', 'So it goes', 'The gods know the rest']));
  if (once('warm', !wary && M.warm && !intent && draw(L, said, 15) < 0.5 && !M.child)) ls.unshift(pick(L, said, 16, [`Ah, ${M.addr}`, `Well now, ${M.addr}`, `Listen, ${M.addr}`]));
  // the fence: a sentence with a word they cannot know is left out (the life's words are the simulation's; this guards the joins)
  const said1 = ls.map(x => end(x.replace(/\s+,/g, ',').replace(/\s{2,}/g, ' '))).filter(x => !fenceHits(x).length);
  return { text: spoken(said1.join(' ') || '…'), intent };
}

/** the person's mind without the model: the same interface as mind.ts Mind for talkTurn (answer, judge) */
export class OwnMind {
  readonly engine = null; readonly model = 'own lines'; answers = 0; private used = new Map<number, { t: number; s: Set<string> }>();
  async answer(L: LifeRecord, _knows: Knows, _history: Turn[], said: string, _prose?: string | null, _max = 64, opts: AskOpts = {}): Promise<Answer> {
    this.answers++; const k = L.pid, u = this.used.get(k); const used = u && L.day * 24 + L.hour - u.t < 1 ? u.s : new Set<string>(); this.used.set(k, { t: L.day * 24 + L.hour, s: used }); if (this.used.size > 200) this.used.delete(this.used.keys().next().value!);
    const r = ownReply(L, said, opts, _knows, used); const hits = fenceHits(r.text);
    return { intent: r.intent, heard: hearAsPerson(said).text, text: r.text, raw: r.text, ok: !hits.length && r.text.length > 1, hits, tries: 1, ttftMs: 0, totalMs: 0, primeMs: 0, tokens: 0, prefillTps: 0, decodeTps: 0 };
  }
  /** no judge without the model: the words and the tag decide (turn.ts falls back to wordsRefuse) */
  async judge(_asked: string, _reply: string): Promise<boolean | null> { return null; }
  async readDeed(_said: string) { return null; }
  forget() {}
}
