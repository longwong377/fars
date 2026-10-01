// D-315 (UD-21, T-E10): what the person is asked to DO, and what they say they will do. The language model answers in words
// and ends with one tag from a closed set (INTENT_LINE); parseIntent reads the tag robustly (a bracket tag, a JSON tail, an
// "ACTION:" line, a tag the model forgot to close) and strips it from the words. requestOf reads the stranger's own words
// with a small grammar: it is the second detector (a 1-2 B model often forgets the tag) and never the decider. The
// SIMULATION decides whether the person does it (people/talk.ts consider): their duties, rank, hour, family and plan.
// Out of world: the tags and this file's English are the model's plumbing, never shown or heard in the world.

export type Deed = 'follow' | 'lead_to' | 'fetch' | 'give' | 'trade' | 'stop_work' | 'wait_here' | 'go_home';
export type IntentKind = Deed | 'refuse' | 'none';
export interface Intent { kind: IntentKind; arg?: string }
export const DEEDS: Deed[] = ['follow', 'lead_to', 'fetch', 'give', 'trade', 'stop_work', 'wait_here', 'go_home'];

/** the tag line of the prompt (every token is read on every answer: kept to one line) */
export const INTENT_LINE = 'If the stranger asks you to do something, end with one tag: [follow], [lead:place], [fetch:person], [give:thing], [trade:thing], [stop_work], [wait], [go_home], [refuse:why] or [none].';

const ALIAS: Record<string, IntentKind> = {
  follow: 'follow', follows: 'follow', come: 'follow', come_along: 'follow', go_with: 'follow', accompany: 'follow',
  lead: 'lead_to', lead_to: 'lead_to', leadto: 'lead_to', guide: 'lead_to', show: 'lead_to', show_way: 'lead_to', take: 'lead_to', take_to: 'lead_to', go_to: 'lead_to',
  fetch: 'fetch', call: 'fetch', bring: 'fetch', get: 'fetch', summon: 'fetch',
  give: 'give', gift: 'give', offer: 'give', share: 'give',
  trade: 'trade', exchange: 'trade', swap: 'trade', barter: 'trade',
  stop_work: 'stop_work', stopwork: 'stop_work', stop: 'stop_work', rest: 'stop_work', pause: 'stop_work', break: 'stop_work',
  wait: 'wait_here', wait_here: 'wait_here', stay: 'wait_here', stay_here: 'wait_here',
  go_home: 'go_home', gohome: 'go_home', home: 'go_home',
  refuse: 'refuse', refused: 'refuse', no: 'refuse', decline: 'refuse', cannot: 'refuse', can_not: 'refuse',
  none: 'none', nothing: 'none', null: 'none', talk: 'none', answer: 'none',
};
const kindOf = (s: string): IntentKind | null => ALIAS[s.toLowerCase().trim().replace(/[\s-]+/g, '_').replace(/[^a-z_]/g, '')] ?? null;
const cleanArg = (s: string | undefined) => { const a = (s ?? '').replace(/^[\s:=,"'“”]+|[\s"'“”.,;!]+$/g, '').replace(/^(the|a|an|to|me to)\s+/i, '').trim(); return a || undefined; };

/** the tag at the end of a raw answer (or anywhere in it), and the words without it. null: no tag */
export function parseIntent(raw: string): { intent: Intent | null; words: string } {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
  const found: { i: number; len: number; intent: Intent }[] = [];
  // a JSON tail: {"do": "lead_to", "place": "well"} / {"intent":"follow"} / {"action":"give","item":"bread"}
  for (const m of text.matchAll(/\{[^{}]*"(?:do|intent|action|act|deed|tag)"\s*:\s*"([^"]+)"[^{}]*\}/gi)) {
    const k = kindOf(m[1]); if (!k) continue; const arg = /"(?:place|to|person|who|item|thing|what|arg|why|reason)"\s*:\s*"([^"]*)"/i.exec(m[0])?.[1];
    found.push({ i: m.index!, len: m[0].length, intent: { kind: k, arg: cleanArg(arg) } }); }
  // [lead: the well] [follow] <lead:well> (fetch: Tabnea) — brackets of any kind, closed or left open at the very end
  for (const m of text.matchAll(/[[<({]\s*(?:tag|act|action|intent|do)?\s*[:=]?\s*([a-z][a-z _-]{1,20}?)\s*(?:[:=]\s*([^\]>)}\n]{0,60}))?\s*(?:[\]>)}]|$)/gi)) {
    const k = kindOf(m[1]); if (!k) continue; found.push({ i: m.index!, len: m[0].length, intent: { kind: k, arg: cleanArg(m[2]) } }); }
  // ACTION: follow / Tag - lead to the well / Intent = none (a line of its own at the end)
  for (const m of text.matchAll(/(?:^|\n|\s)(?:tag|action|intent|act|deed)\s*[:=-]\s*([a-z_ -]{2,20}?)(?:\s*[:(,-]\s*([^\n)]{0,60}))?\)?\s*$/gi)) {
    const k = kindOf(m[1]); if (!k) continue; found.push({ i: m.index!, len: m[0].length, intent: { kind: k, arg: cleanArg(m[2]) } }); }
  // (a tag of the model's own outside the set, "[stay_work]", is taken out of the words too)
  const stray = (w: string) => w.replace(/\[\s*[a-z_ -]{2,20}(?:\s*[:=][^\]\n]{0,60})?\s*\]["”']?/gi, ' ').replace(/\s+([.,!?])/g, '$1').replace(/\s+/g, ' ').replace(/\.\.(?!\.)/g, '.').trim();
  if (!found.length) return { intent: null, words: stray(text) };
  // the last tag wins (a model that corrects itself), and every tag is taken out of the words
  found.sort((a, b) => a.i - b.i); const last = found[found.length - 1].intent;
  for (const f of [...found].sort((a, b) => b.i - a.i)) text = text.slice(0, f.i) + ' ' + text.slice(f.i + f.len);
  return { intent: last, words: stray(text) };
}

// the stranger's words: a small grammar of asking (English, the translation layer's language; C)
const PLEASE = String.raw`(?:(?:please|now|friend|stranger|sir|good (?:man|woman|sir))[, ]*)?`;
const ASK = String.raw`(?:${PLEASE}(?:could|would|will|can|won't) you(?: please)? |please |i (?:want|need|would like|'d like) you to |i ask you to |)`;
const R: [IntentKind, RegExp][] = [
  ['follow', new RegExp(String.raw`\b${ASK}(?:follow me|come (?:with|along with) me|come along|walk with me|come with us|keep me company|go with me)\b`, 'i')],
  ['lead_to', new RegExp(String.raw`\b(?:${ASK}(?:lead|take|bring|guide|show|walk) me(?: the way)? (?:to|towards?|round to|over to)\s+(.{2,50}?)[?.!]*$|${ASK}show me (?:the way to|where)\s+(.{2,50}?)(?: is| are)?[?.!]*$|where is\s+(.{2,40}?)[?.!]*$|(?:which|what) is the way to\s+(.{2,40}?)[?.!]*$|how do i (?:get|go) to\s+(.{2,40}?)[?.!]*$)`, 'i')],
  ['fetch', new RegExp(String.raw`\b${ASK}(?:fetch|call|bring|get|go and get|go for|find)\s+(?!me\b)(.{2,40}?)(?: for me| here| to me)?[?.!]*$`, 'i')],
  ['trade', new RegExp(String.raw`\b(?:trade|exchange|swap|barter)\b(?: (?:you|with you))?\s*(.{0,50}?)[?.!]*$|\bi(?:'ll| will) give you\s+(.{2,40}?)\s+for\s+(.{2,40}?)[?.!]*$`, 'i')],
  ['give', new RegExp(String.raw`\b(?:${ASK}(?:give|spare|share|hand|lend)(?: me)?\s+(.{2,40}?)[?.!]*$|(?:may|can|could) i (?:have|get|take)\s+(.{2,40}?)[?.!]*$|i (?:am|'m) (?:hungry|thirsty)\b)`, 'i')],
  ['stop_work', new RegExp(String.raw`\b${ASK}(?:stop (?:working|work|your work|what you are doing|for a while)|leave (?:your|the) work|take a rest|rest a while|put (?:that|it|your work) down)\b`, 'i')],
  ['wait_here', new RegExp(String.raw`\b${ASK}(?:wait (?:here|for me|a (?:moment|while))|stay (?:here|where you are)|don't go|do not go|stand here)\b`, 'i')],
  ['go_home', new RegExp(String.raw`\b${ASK}(?:go (?:back )?home|go back to your (?:house|home|family)|return home)\b`, 'i')],
];
/** the deed the stranger's words ask for (the grammar; null: not a request) */
export function requestOf(said: string): Intent | null {
  const s = said.trim().replace(/[’]/g, "'");
  for (const [kind, re] of R) { const m = re.exec(s); if (!m) continue;
    if (kind === 'give' && /thirsty/i.test(m[0])) return { kind, arg: 'water' };
    if (kind === 'give' && /hungry/i.test(m[0])) return { kind, arg: 'bread' };
    if (kind === 'trade' && m[2] && m[3]) return { kind, arg: `${cleanArg(m[3])} for ${cleanArg(m[2])}` };
    const arg = cleanArg(m.slice(1).find(x => x));
    if (kind === 'fetch' && arg && /^(water|bread|food|beer|wine|milk|some|a drink)/i.test(arg)) return { kind: 'give', arg };
    return { kind, arg }; }
  return null;
}
/** a reply's words refuse (the person's own "no"), for words and deeds to agree (the sim never makes a "no" do it) */
export function wordsRefuse(words: string): boolean {
  words = words.replace(/[’‘]/g, "'"); // (run 3: "Can’t leave work." was missed: the model's curly apostrophe)
  // (a bare "No," / "No." never matched here before session 12's fourth GPU run: the closing \b cannot follow a comma and a
  // space; it is tested on its own now)
  if (/(^|[^a-z'])no(?=[\s,.!;:]|$)(?! one\b| doubt\b| matter\b)/i.test(words)) return true;
  return /\b(not now|i'm tied|i am tied|tied to|i am ill|i'm ill|i am sick|i'm sick|must stay|have to stay|can't leave|cannot leave|must not leave|not going to|can't just|cannot just|no time|i am busy|i'm busy|not mine to|not for strangers|sorry|i cannot|i can't|i can not|i will not|i won't|i must not|i may not|i dare not|not allowed|forbidden|go away|leave me|find someone else|ask someone else|another time|not today)\b/i.test(` ${words} `);
}

// D-315 (the first GPU run, session 12): a real 1-2 B model writes tags the stranger never asked for ("[go_home]" to "I am
// looking for the river") and misses paraphrases the grammar does not read. So a tag is taken only when the stranger's
// words carry a cue of that kind of ask (FAMILIES), and a paraphrase the grammar misses is read by its family when only
// one family is cued. The words of asking by family (C; English, the translation layer's):
const FAMILIES: [Deed, RegExp][] = [
  ['follow', /\b(with me|along|company|follow|come too|accompany|join me)\b/i],
  ['lead_to', /\b(the way|where (is|are|can|do)|looking for|find|show me|take me|lead me|guide|point me|how (do|would|can) i (get|reach|go)|reach)\b/i],
  ['fetch', /\b(fetch|call|bring|come and meet|come here|come out|summon|send for|go and get)\b/i],
  ['trade', /\b(trade|exchange|swap|barter|in return|for my)\b/i],
  ['give', /\b(give|spare|share|may i have|can i have|could i have|any \w+ to (eat|drink|spare)|thirsty|hungry|a drink|some (water|bread|beer|milk))\b/i],
  ['stop_work', /\b(stop|rest|leave off|put (down|aside)|break from|pause|set (it|your work) down)\b/i],
  ['wait_here', /\b(wait|stay|remain|don'?t go|do not go|until i (come|return))\b/i],
  ['go_home', /\b(go|head|get|run|return|hurry)\b.{0,20}\b(home|your house)\b/i],
];
/** the kinds of ask the stranger's words carry a cue of */
export function cues(said: string): Deed[] { const s = said.replace(/[’]/g, "'"); return FAMILIES.filter(([, re]) => re.test(s)).map(([k]) => k); }
/** a paraphrase the grammar does not read, taken by its family when only one is cued (its object: the words after the cue) */
export function looseRequest(said: string): Intent | null {
  if (/^\s*(who|what|when|why|which|whose|how (old|many|much|long|are|is|was))\b/i.test(said)) return null; // (a question about them, not an ask)
  const c = cues(said).filter(k => !(k === 'give' && cues(said).includes('trade'))); if (c.length !== 1) return null; const kind = c[0];
  const obj = (re: RegExp) => { const m = re.exec(said); return m ? m[1].replace(/,\s*(friend|stranger|sir|please)$/i, '').replace(/[?.!,]+$/, '').replace(/^(the|a|an|some|any)\s+/i, '').trim() || undefined : undefined; };
  if (kind === 'lead_to') return { kind, arg: obj(/\b(?:looking for|find|reach|to|for)\s+(.{2,40}?)[?.!]*$/i) };
  if (kind === 'fetch') return { kind, arg: obj(/\b(?:fetch|call|bring|summon|send for|get)\s+(.{2,30}?)(?: for me| here)?[?.!]*$/i) ?? obj(/^(?:could|can|would|will)\s+(.{2,30}?)\s+come\b/i) };
  if (kind === 'give') return { kind, arg: /thirsty|drink/i.test(said) ? 'water' : /hungry|eat/i.test(said) ? 'bread' : obj(/\b(?:any|some|spare|share|have)\s+(.{2,20}?)(?: to spare)?[?.!]*$/i) };
  return { kind };
}
/** a tag the stranger's words give no cue for is not an ask (the model's, not the stranger's) */
export function tagAsked(tag: Intent | null, said: string): boolean { return !!tag && (DEEDS as string[]).includes(tag.kind) && cues(said).includes(tag.kind as Deed); }

// D-358 (UD-25, UD-26; T-F9): what the stranger's words offer or ask that is the ECONOMY's business, not a walk: to buy, sell
// or haggle, to give or lend, to speak for a house before the judge, to be a guest, to ask for help or offer it. Read by a
// small grammar of the stranger's words BEFORE requestOf (whose 'give' would read "let me give you" as an ask); the
// simulation decides it (speech/deeds.ts: the house's stores, needs, trust and pride) and enters it as economy intents with
// the player as a party. Out of world: the translation layer's English.
export type EconDeed = 'buy' | 'sell' | 'haggle' | 'gift' | 'lend' | 'petition' | 'host' | 'ask_help' | 'offer_help';
export type EconGood = 'grain' | 'fuel' | 'goods' | 'silver' | 'labour';
export interface EconAsk { kind: EconDeed; good?: EconGood; /** kg of barley, loads of fuel, lots of goods, sheqel of silver */ qty?: number; /** sheqel offered (haggle) */ price?: number; words: string }
const GOODS: [RegExp, EconGood][] = [[/\b(barley|grain|wheat|flour|bread|food)\b/i, 'grain'], [/\b(silver|sheqels?|shekels?|money|coin)\b/i, 'silver'], [/\b(fuel|firewood|wood|dung|kindling)\b/i, 'fuel'],
  [/\b(cloth|wool|oil|pots?|jars?|goods|wares|sandals?|baskets?|cheese|linen|rope|mats?)\b/i, 'goods'], [/\b(work|labou?r|hands?)\b/i, 'labour']];
const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10, half: 0.5, third: 1 / 3, quarter: 0.25, tenth: 0.1 };
/** "half a sheqel", "a third of a sheqel", "two sheqels", "3 sheqel" */
export function silverOf(s: string): number | undefined {
  const m = /\b(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|ten|half|a third|a quarter|a tenth)\s+(?:of\s+)?(?:a\s+)?(?:sheqels?|shekels?)\b/i.exec(s); if (!m) return undefined;
  const w = m[1].toLowerCase().replace(/^a /, ''); return /^\d/.test(w) ? +w : NUM[w];
}
/** an amount of a good in the economy's units (a BAR of barley is ten qa, ~5.5 kg; C), from the words or a default */
function qtyOf(s: string, good: EconGood): number {
  const n = /\b(\d+|a|an|one|two|three|four|five|six|ten)\s+(bar|measures?|sacks?|baskets?|loads?|jars?|days?|lots?)\b/i.exec(s); const k = n ? (/^\d/.test(n[1]) ? +n[1] : NUM[n[1].toLowerCase()] ?? 1) : 1;
  if (good === 'grain') return 5.5 * k * (n && /sack/i.test(n[2]) ? 5 : 1); if (good === 'fuel') return 4 * k; if (good === 'labour') return Math.min(5, k * (n && /day/i.test(n[2]) ? 1 : 2));
  if (good === 'silver') return silverOf(s) ?? 0.5; return k;
}
const goodOf = (s: string, dflt: EconGood = 'grain'): EconGood => GOODS.find(([re]) => re.test(s))?.[1] ?? dflt;
const E_R: [EconDeed, RegExp][] = [
  ['petition', /\b(speak for (?:you|your)|plead for (?:you|your)|petition (?:the )?(?:judge|court|officials?)|go before the (?:judge|court) for|stand (?:witness|surety) for|put in a word (?:for|with))\b/i],
  ['lend', /\b(?:i (?:can|could|will|shall|would)? ?lend (?:you|your)|let me lend|i'll lend|take (?:this|it) as a loan|do you need a loan|i (?:can|will) loan)\b/i],
  ['haggle', /\b(?:i(?:'ll| will| can| could)? (?:pay|offer)|would you take|will you take|how about|i(?:'ll| will) give you)\b[^?.!]*\b(?:sheqels?|shekels?)\b/i],
  ['sell', /\b(?:will|would|do) you (?:want to )?buy\b|\bi (?:want|wish|have|would like) to sell\b|\bi(?:'ll| will) sell you\b/i],
  ['buy', /\b(?:i (?:want|wish|would like|'d like|need) to buy|can i buy|could i buy|may i buy|will you sell me|would you sell me|sell me|what would you take for|how much (?:for|is|are|do you want for))\b/i],
  ['gift', /\b(?:let me give you|i (?:want to|would like to|will|'ll|shall) give (?:you|your (?:house|family|children))|take this|accept this|a gift for (?:you|your)|this is for your (?:house|family|children))\b/i],
  ['host', /\b(?:(?:may|can|could) i (?:eat|dine|sup|stay|sleep|lodge|share (?:your|a) meal|have (?:a |my )?(?:meal|supper|bed))|a bed for the night|shelter for the night|a place to sleep|be your guest|eat with (?:you|your family))\b/i],
  ['offer_help', /\b(?:can i help|let me help|may i help|i (?:can|could|will) (?:help|work for|work with)|i'll help|i will work|do you need (?:help|a hand|hands))\b/i],
  ['ask_help', /\b(?:i have nothing|i have no (?:money|silver|food|bread)|i am (?:poor|starving|destitute|penniless)|help me,? (?:i|please)|i need (?:food|silver|help) for the road|have pity)\b/i],
];
/** the economy's business in the stranger's words (null: none) */
export function econAskOf(said: string): EconAsk | null {
  const s = said.trim().replace(/[’]/g, "'");
  for (const [kind, re] of E_R) { if (!re.test(s)) continue;
    switch (kind) {
      case 'haggle': { const good = goodOf(s.replace(/\b(sheqels?|shekels?|silver)\b/gi, ''), 'grain'); return { kind, good, qty: qtyOf(s, good), price: silverOf(s), words: s }; }
      case 'buy': case 'sell': { const good = goodOf(s, 'grain'); return { kind, good: good === 'silver' ? 'grain' : good, qty: qtyOf(s, good === 'silver' ? 'grain' : good), words: s }; }
      case 'gift': { const good = goodOf(s, 'silver'); return { kind, good, qty: qtyOf(s, good), words: s }; }
      case 'lend': return { kind, good: 'silver', qty: silverOf(s) ?? 1, words: s };
      case 'offer_help': return { kind, good: 'labour', qty: qtyOf(s, 'labour'), words: s };
      case 'ask_help': return { kind, good: 'grain', qty: 1.1, words: s };
      default: return { kind, words: s };
    }
  }
  return null;
}
