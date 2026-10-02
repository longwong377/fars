// D-459 (UD-32): the stranger's words as a deed, by grammar. The cheap reader, always there (node, tests, before the model has
// loaded, and as the check on the model's own reading: deeds/extract.ts). It reads the translation layer's English for a verb of
// the lexicon (deeds/verbs.ts), the shared activity, the goods, the people named and the hour; anything else said is talk.
import type { Deed, Actor, Verb } from './types';
import { LEXICON, ACT_WORDS, GOOD_WORDS, VERBS } from './verbs';

export interface ParseCtx {
  /** the person spoken to */ addressee: number;
  /** the hour now (0-24) */ hour: number;
  /** a person named in the words (by name, or "your father", "the smith"), resolved by the caller */ named?: (words: string) => number | null;
  /** the person pointed at: "him", "her", "that man" (the nearest other the stranger faces, from the world) */ pointed?: number | null;
  /** a place named in the words (talk.ts resolvePlace) */ place?: (words: string) => string | null;
}

/** words that are only talk: a question with no deed in it (answered by the person's own life, not a deed) */
const QUESTION = /^(who|what|where|when|why|how|which|whose|is|are|do|does|did|have|has|was|were|can you tell|tell me (about|of|how|why|what|where|who))\b/;
/** verbs whose deed is done ABOUT a third person (the addressee hears it) */
const ABOUT: Set<Verb> = new Set(['tell', 'lie', 'accuse', 'complain', 'intercede', 'reconcile', 'introduce', 'bring', 'warn', 'send', 'fetch']);
/** verbs of the body that land on whoever is pointed at when the words say him/her/them */
const BODY: Set<Verb> = new Set(['attack', 'push', 'steal', 'break', 'threaten', 'insult', 'mock', 'curse', 'embrace', 'heal', 'guard', 'carry']);
const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10, some: 1, few: 3 };

export function parseDeed(said: string, actor: Actor, c: ParseCtx): Deed | null {
  const w = ' ' + said.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim() + ' ';
  let verb: Verb | null = null;
  for (const [v, re] of LEXICON) if (re.test(w)) { verb = v; break; }
  const actHit = ACT_WORDS.find(([, re]) => re.test(w));
  // a question with no deed verb is talk ("where do you fish?" is a question, "let's fish" is a deed)
  if (!verb && (QUESTION.test(w.trim()) || /\?\s*$/.test(said))) return null;
  // an activity said as an invitation with no verb of the lexicon: "fishing tomorrow?", "to the river, to swim" (C)
  if (!verb && actHit && /\b(we|us|together|tomorrow|tonight|come|go)\b/.test(w)) verb = 'join';
  if (!verb) return null;
  // ("let's go hunting": going somewhere to do a thing is doing it together)
  if (verb === 'come_with' && actHit && actHit[0] !== 'walk') verb = 'join';
  const d: Deed = { verb, actor, target: c.addressee, said, sure: 0.7 };
  // the activity: shared work and pastimes; help/join/teach/repair/build take it
  if (actHit && ['join', 'help', 'teach', 'learn', 'repair', 'build', 'come_with', 'hire', 'share_food', 'pray', 'offer', 'meet'].includes(verb)) { d.act = actHit[0]; if (actHit[2]) d.place = actHit[2]; }
  if (verb === 'repair' && !d.act) d.act = 'mould_brick';
  if (verb === 'share_food') d.act = 'eat';
  // goods and how many
  const g = GOOD_WORDS.find(([, re]) => re.test(w)); if (g && ['give', 'lend', 'borrow', 'ask_for', 'steal', 'return', 'fetch', 'carry', 'share_food', 'hire'].includes(verb)) { d.good = g[0];
    const m = /\b(\d+|a|an|one|two|three|four|five|six|ten|some|few)\s+(?:\w+\s)?(shekels?|measures?|loaves|loaf|jars?|sacks?|cloths?|goats?|sheep)\b/.exec(w); if (m) d.qty = NUM[m[1]] ?? Number(m[1]); }
  // people: a third named; "him/her/them" is the one pointed at
  const named = c.named?.(said) ?? null;
  const pron = /\b(him|her|them|that (man|woman|boy|girl|one)|this (man|woman|one))\b/.test(w);
  if (ABOUT.has(verb)) { if (named !== null && named !== c.addressee) d.third = named; else if (pron && c.pointed != null) d.third = c.pointed; }
  else if (BODY.has(verb) && !/\byou\b/.test(w) && pron && c.pointed != null) d.target = c.pointed;
  else if (named !== null && named !== c.addressee && ['join', 'help', 'heal', 'visit', 'come_with', 'meet', 'embrace', 'court', 'flirt', 'give', 'attack', 'push', 'insult'].includes(verb) && !/\byou\b/.test(w)) d.target = named;
  // where and when
  const pl = c.place?.(said) ?? null; if (pl) d.place = pl;
  const h = c.hour; d.inH = /\btomorrow\b/.test(w) ? 24 - h + (/\b(evening|night)\b/.test(w) ? 19 : 8) : /\b(tonight|this evening)\b/.test(w) ? Math.max(0.5, 19 - h) : /\b(later|this afternoon|after (noon|work))\b/.test(w) ? Math.max(1, 15 - h) : /\b(at dawn|in the morning)\b/.test(w) && h > 9 ? 24 - h + 6.5 : 0;
  // how hard
  if (verb === 'attack') d.force = /\b(kill|murder|stab)\b/.test(w) ? 1 : /\b(beat|thrash|fight|wrestle|kick|wound|hurt)\b/.test(w) ? 0.75 : /\b(slap|smack)\b/.test(w) ? 0.3 : 0.5;
  else if (verb === 'push') d.force = 0.3; else if (VERBS[verb].wrong) d.force = 0.6;
  // what is told, promised or lied about: the words after "that", else the whole
  if (['tell', 'lie', 'promise', 'warn', 'confide', 'accuse', 'complain', 'threaten', 'send'].includes(verb)) { const m = /\bthat\b (.+)$/.exec(said); d.about = (m ? m[1] : said).trim().replace(/[.!?]+$/, ''); }
  return d;
}
