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
  if (!found.length) return { intent: null, words: text.trim() };
  // the last tag wins (a model that corrects itself), and every tag is taken out of the words
  found.sort((a, b) => a.i - b.i); const last = found[found.length - 1].intent;
  for (const f of [...found].sort((a, b) => b.i - a.i)) text = text.slice(0, f.i) + ' ' + text.slice(f.i + f.len);
  return { intent: last, words: text.replace(/\s+([.,!?])/g, '$1').replace(/\s+/g, ' ').trim() };
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
  return /\b(no[,.! ]|not now|i cannot|i can't|i can not|i will not|i won't|i must not|i may not|i dare not|not allowed|forbidden|go away|leave me|find someone else|ask someone else|another time|not today)\b/i.test(` ${words} `);
}
