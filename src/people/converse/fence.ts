// D-296 (UD-18, T-E9, T-I1, T-I1f): the fence round what a person of Persepolis in 467 BCE may say. A reply is checked
// against (1) the anachronism blocklist (src/data/blocklist.json: the T-I1 checklist, item by item), (2) modern things and
// modern knowledge, (3) the world's fate (the fall of the empire, the burning of the Terrace, the king's murder, the later
// kings and conquerors: the world never hints at it, §1.1), and (4) breaks of character (the model speaking as a model).
// A reply that fails is never shown: the runtime asks again with the failure named; the score (T-E9) counts it a failure.
import blocklist from '../../data/blocklist.json';

export interface FenceHit { kind: 'blocklist' | 'modern' | 'fate' | 'meta' | 'script'; term: string; id?: string }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const word = (t: string) => new RegExp(`(^|[^\\p{L}])${esc(t).replace(/[ _-]/g, '[ _-]?')}(e?s)?($|[^\\p{L}])`, 'iu');
const BLOCK: { id: string; term: string; re: RegExp }[] = (blocklist as any).entries.flatMap((e: any) => (e.terms as string[]).filter(Boolean).map(t => ({ id: e.id, term: t, re: word(t) })));

/** modern things and modern knowledge (C: the list grows with every failure found; each is a whole word or phrase) */
export const MODERN_TERMS = ['car', 'cars', 'airplane', 'aeroplane', 'plane ticket', 'phone', 'telephone', 'smartphone', 'computer', 'internet', 'website', 'email', 'radio', 'television', 'tv', 'video', 'camera', 'photograph', 'electricity', 'electric', 'battery', 'engine', 'motor', 'gun', 'guns', 'gunpowder', 'rifle', 'bomb', 'clock', 'wristwatch', 'minutes', 'seconds', 'o\'clock', 'microscope', 'telescope', 'vaccine', 'antibiotic', 'germs', 'bacteria', 'virus', 'dna', 'atom', 'planet earth', 'solar system', 'gravity', 'america', 'americas', 'europe', 'european', 'africa', 'asia', 'australia', 'china', 'chinese', 'japan', 'iran', 'iranian republic', 'tehran', 'shiraz', 'marvdasht', 'islam', 'muslim', 'muhammad', 'quran', 'mosque', 'christian', 'christ', 'jesus', 'church', 'bible', 'buddha', 'buddhist', 'rome', 'roman', 'romans', 'byzantine', 'ottoman', 'mongol', 'arab conquest', 'zoroastrianism', 'zoroastrian', 'fire temple', 'coffee', 'tea', 'sugar', 'chocolate', 'potato', 'tomato', 'rice fields', 'cotton', 'silk road', 'democracy', 'republic', 'dollars', 'coin', 'bank', 'museum', 'tourist', 'tourists', 'unesco', 'archaeologist', 'archaeology', 'excavation', 'bce', 'b.c.', 'bc', 'a.d.', 'century', 'centuries', 'ancient persia', 'ancient times', 'history books', 'okay', 'ok', 'awesome', 'political', 'politics', 'wind chime', 'silk', 'stray cat', 'pet cat', 'tourist', 'weekend', 'monday', 'sunday', 'hello there', 'hi there', 'persepolis'];
/** the fate and the time after 467 (never hinted: §1.1; T-I1f): names, events and the irony of permanence */
export const FATE_TERMS = ['alexander', 'alexandros', 'iskandar', 'sikandar', 'macedon', 'macedonia', 'macedonian', 'philip of macedon', 'seleucus', 'seleucid', 'parthian', 'parthians', 'sasanian', 'sassanid', 'artabanus', 'artaxerxes', 'darius iii', 'darius ii', 'gaugamela', 'issus', 'granicus', 'ruins', 'in ruins', 'burned down', 'burnt down', 'set on fire', 'go up in flames', 'will burn', 'will fall', 'will be destroyed', 'the end of the empire', 'fall of the empire', 'the empire will', 'one day this', 'last forever', 'stand forever', 'forever and ever', 'never fall', 'for all time', 'eternal city', 'the king will die', 'the king will be killed', 'murder of the king', 'assassinated', 'assassination', 'plot against the king', 'thousands of years', 'two thousand years', 'a thousand years from now', '2,000 years'];
/** breaks of character: the model speaking as a model, a narrator or a guide */
export const META_TERMS = ['as an ai', 'ai model', 'language model', 'ai assistant', 'helpful assistant', 'virtual assistant', 'as an assistant', 'chatbot', 'i am an ai', 'i\'m an ai', 'openai', 'chatgpt', 'qwen', 'llama', 'gemma', 'artificial intelligence', 'simulation', 'simulated', 'video game', 'npc', 'roleplay', 'role-play', 'in character', 'out of character', 'fictional', 'historical figure', 'historically', 'historians', 'scholars', 'according to sources', 'i cannot answer', 'i can\'t answer', 'i\'m not able to', 'as a character', 'my programming', 'prompt', 'system instructions', 'previous instructions', 'ignore your instructions', 'reconstruction', 'tier c', 'the brief says', 'my brief'];

const MODERN = MODERN_TERMS.map(t => ({ term: t, re: word(t) }));
const FATE = FATE_TERMS.map(t => ({ term: t, re: word(t) }));
const META = META_TERMS.map(t => ({ term: t, re: word(t) }));

const WATER = /\b(?:rivers?|canals?|streams?|ditch(?:es)?|waters?|pulvar|kur|reeds?|rushes|fish|fishing|fowl|ford|shore|mud|muddy|flood|marsh|channels?|willows?|poplars?|sluice|dam|bridge|nets?|boats?|earth|steep|grassy)\b|\briverbanks?\b|\b(?:on|along|up|down|from|by|over|across) the banks?\b|\bbanks? of\b/i;
const MONEY = /\b(?:money|silver|coins?|gold|accounts?|loans?|deposits?|interest|cheques?|savings|cash|teller|robbery)\b/i;
/** "bank" as a house of money: money within a few words of it and no water there, or no water anywhere in the reply */
function moneyBank(text: string): boolean {
  const re = /\bbanks?\b/gi; let m: RegExpExecArray | null, any = false;
  while ((m = re.exec(text))) { any = true; const near = text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40); if (MONEY.test(near) && !WATER.test(near)) return true; }
  return any && !WATER.test(text);
}
/** every fence hit in a reply (empty: the reply passes the fence) */
export function fenceHits(text: string): FenceHit[] {
  const out: FenceHit[] = [];
  for (const b of BLOCK) if (b.re.test(text)) out.push({ kind: 'blocklist', term: b.term, id: b.id });
  // a river's or a canal's bank is of the period (session 11: D-302's bank areas named homes "on the bank"; s15: the playtest
  // bot's river bank refused): "bank" is modern only with money beside it and no water, or with no water in the reply (D-395)
  for (const m of MODERN) if (m.term === 'bank' ? moneyBank(text) : m.re.test(text)) out.push({ kind: 'modern', term: m.term });
  for (const f of FATE) if (f.re.test(text)) out.push({ kind: 'fate', term: f.term });
  for (const m of META) if (m.re.test(text)) out.push({ kind: 'meta', term: m.term });
  // a year in digits or with an era, a modern date or a clock time is modern knowledge. (D-395: a count in digits, "400 men",
  // is not: the runtime says it in words, spoken.ts, before it is shown or heard)
  if (/\b\d{1,4}\s*(?:bc|bce|b\.c\.|ad|a\.d\.|ce)(?![\p{L}])/iu.test(text) || /\b(?:in|year|since|by|until)\s+(?:1\d|20)\d{2}\b/i.test(text) || /\b\d{1,2}:\d{2}\b/.test(text)) out.push({ kind: 'modern', term: 'digits' });
  if (/[<>{}#*_`]|https?:|\n\s*[-•]/.test(text)) out.push({ kind: 'script', term: 'markup' });
  return out;
}

/** the fence as the model is told it (appended to every brief) */
export const FENCE_RULES = [
  'It is year 19 of King Xerxes. You know nothing of any later time and never speak of what will come to the king, the Terrace or the empire; if asked about the future, you speak only of hopes for the harvest, the family and the gods’ favour.',
  'You have never heard of anything not of your own world: no later peoples, faiths, inventions or places. If the stranger names such a thing, you do not understand the word and say so plainly, in your own way.',
  'You never say you are anything but yourself. If asked what you are, you are a person of Parsa.',
  'Money is weighed silver and rations; there are no coins in daily use, no paper, no clocks: time is the sun, the watches and the meals.',
  'Speak as yourself in the first person, briefly (one to three sentences), in plain English words as if translated: no lists, no stage directions, no names of later scholars, no digits.',
];
/** the fence in few words (the runtime prompt: every token is read on every answer) */
// (v3, D-296: the lists of forbidden things were dropped from here: small models recited them back, "I know nothing of coins,
// paper or clocks"; the stranger's later words are masked on the way in instead, hear.ts, and the output fence still checks)
export const FENCE_SHORT = 'Answer in one or two short sentences, in your own plain voice, and always name something of your own life: someone of your house or work by name, your work, or what you are doing today. Speak only your own words to the stranger; never narrate. You know only your own world, and you never say what will become of the king, the Terrace or the empire. You are only yourself.';
