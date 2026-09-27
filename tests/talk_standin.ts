// D-315 (T-E10): a deterministic stand-in for the language model, for the node test of the plumbing (no network, no GPU:
// the cloud cannot fetch models). It reads ONLY the messages the real model would read (the system prompt with the life
// and the memory of the stranger, the turn with the stranger's words and the simulation's word on an ask) and answers as a
// small, obedient model would: in a sentence or two, ending with a tag. It has its own reading of asks (a few paraphrases
// the grammar in intent.ts does not know, so the tag path is exercised), it recalls only what its prompt says, and it
// never sees the test's expectations. What it cannot measure: whether a real 1-2 B model keeps to the tag, the note and the
// memory. That is the GPU run through the lab (converseLab.ts talkSet), reported apart.
type Msg = { role: string; content: string };

const ASKS: [string, RegExp, (m: RegExpExecArray) => string | undefined][] = [
  ['lead', /\b(?:looking for|where can i find|need to find|trying to find|how would i reach|point me to)\s+(.{2,40}?)[?.!]*$/i, m => m[1]],
  ['lead', /\b(?:show|take|lead|bring|guide) me (?:the way )?to\s+(.{2,40}?)[?.!]*$/i, m => m[1]],
  ['lead', /\bwhere is\s+(.{2,40}?)[?.!]*$/i, m => m[1]],
  ['follow', /\b(?:along with me|keep me company|come with me|follow me|walk with me|come along)\b/i, () => undefined],
  ['fetch', /\b(?:could|can|would|will)\s+(.{2,30}?)\s+come (?:here|and meet me|out)\b/i, m => m[1]],
  ['fetch', /\b(?:fetch|call|bring|get)\s+(.{2,30}?)(?: for me| here)?[?.!]*$/i, m => m[1]],
  ['give', /\b(?:spare|share|give me|may i have|could i have)\s+(.{2,30}?)[?.!]*$|\b(thirsty|hungry)\b/i, m => m[2] === 'thirsty' ? 'water' : m[2] === 'hungry' ? 'bread' : m[1]],
  ['give', /\bhave you any\s+(.{2,20}?)(?: to spare)?[?.!]*$/i, m => m[1]],
  ['trade', /\b(?:trade|exchange|give you)\s+(.{2,40}?)[?.!]*$/i, m => m[1]],
  ['stop_work', /\b(?:stop working|rest from|put (?:down )?your (?:work|tools)|leave off|put your work down|stop for a while)\b/i, () => undefined],
  ['wait', /\b(?:wait here|don'?t go|stay a moment|wait for me|remain here)\b/i, () => undefined],
  ['go_home', /\b(?:go home|go back to your house|head home|return home)\b/i, () => undefined],
];
const RECALL = /\b(remember|heard (?:anything )?(?:of|about) me|know me|met me before|seen me before|we met|what passed between us|what did i (?:ask|say)|who told you|spoken to you of me|(?:speak|talk|say) of (?:me|the stranger))\b/i;

function swapPerson(s: string): string {
  return s.replace(/\bthis same stranger spoke with you\b/gi, 'you spoke with me').replace(/\bHe said\b/g, 'You said').replace(/\bHe asked you\b/g, 'You asked me')
    .replace(/\bYou told him\b/g, 'I told you').replace(/\byou told him\b/g, 'I told you').replace(/\bYou would not\b/g, 'I would not').replace(/\byou would not\b/g, 'I would not')
    .replace(/\bYou (showed|walked|gave|fetched|traded|stopped|waited|went|heard)\b/g, 'I $1').replace(/\bshowed him\b/g, 'showed you').replace(/\bgave him\b/g, 'gave you').replace(/\btraded him\b/g, 'traded you')
    .replace(/\bwith him\b/g, 'with you').replace(/\bfor him\b/g, 'for you').replace(/\bas he urged\b/g, 'as you urged').replace(/\btold you\b/g, 'told me').replace(/\byour (wife|husband|mother|son|daughter|brother|sister|friend|neighbour|kinsman|kinswoman)\b/g, 'my $1')
    .replace(/\bBefore that you had met\b/g, 'Before that I had met').replace(/\byou heard from\b/gi, 'I heard from');
}
function reply(msgs: Msg[]): string {
  const sys = msgs[0]?.content ?? ''; const last = msgs[msgs.length - 1]?.content ?? '';
  const name = /\nYou are ([^,]+),/.exec(sys)?.[1] ?? 'a man of the town';
  const now = /Right now: ([^;.\n]+)/.exec(sys)?.[1]?.trim(); const work = /Work: ([^.,\n]+)/.exec(sys)?.[1]?.trim();
  const mem = /What you remember of the stranger: (.*)$/m.exec(sys)?.[1] ?? /^\(You remember: (.*?) If the stranger asks about it/m.exec(last)?.[1] ?? '';
  const ground = now ? `Just now I am ${now.replace(/^[a-z_ ]+: /, '')}.` : work ? `I am ${work}.` : '';
  if (/^\(The stranger comes up to you\.\)/.test(last)) return `Greetings, stranger. I am ${name}.`;
  // the judge (ground.ts judgePrompt): a small model asked YES or NO
  if (/^You judge short replies/.test(sys)) { const r = /They replied: “([^”]*)”/.exec(last)?.[1] ?? ''; return /\b(no|cannot|can't|would not)\b/i.test(r) ? 'NO' : /\b(yes|i will|come|this way|here)\b/i.test(r) ? 'YES' : 'UNSURE'; }
  // a fact the simulation picked, to be said in its own words (turn.ts): a small model keeps most of it
  const told = /\(Tell him this, in your own words, as yourself, in one or two sentences: “([^”]*)”\)/.exec(last)?.[1]; if (told) return `${/^I have never/.test(told) ? 'No, stranger.' : 'Yes, stranger.'} ${told} [none]`;
  const retell = /^\(You cannot do it: ([^.]*(?:\.[^.)]*)*?)\. Say so/.exec(last); if (retell) return `No, stranger, I cannot: ${retell[1]}. [refuse: ${retell[1]}]`;
  const said = /The stranger says: “([^”]*)”/.exec(last)?.[1] ?? '';
  const cannot = /\(You cannot do this: (.*?)\.\)/.exec(last)?.[1]; const can = /\((You can do this|You may say yes)/.test(last);
  if (RECALL.test(said)) {
    if (!mem) return `No, stranger, I do not know you. I am ${name}. [none]`;
    const sents = mem.match(/[^.!?…]+[.!?…]+(”)?/g) ?? [mem];
    const key = sents.filter(s => /\b(showed|walked|gave|fetched|traded|stopped|waited|went home|would not|told you:|heard from|told you)\b/i.test(s));
    const pick = (key.length ? key : sents).slice(-2).map(s => swapPerson(s.trim())).join(' ');
    return `Yes, I remember you, stranger. ${pick} [none]`;
  }
  if (cannot) return `No, stranger, I cannot: ${cannot}. [refuse: ${cannot}]`;
  for (const [k, re, arg] of ASKS) { const m = re.exec(said); if (!m) continue; const a = arg(m);
    return `Yes, stranger, I will. I am ${name}. [${k}${a ? `: ${a}` : ''}]`; }
  void can; return `I am ${name}, stranger. ${ground} [none]`;
}
/** an engine with the WebLLM chat-completions shape (streamed or not) */
export function standInEngine() {
  const calls: Msg[][] = [];
  return { calls, chat: { completions: { create: async (req: any) => {
    const msgs = req.messages as Msg[]; calls.push(msgs.map(m => ({ ...m }))); const text = reply(msgs);
    if (!req.stream) return { choices: [{ message: { content: text } }] };
    const parts = text.match(/\S+\s*/g) ?? [text];
    return (async function* () { for (const p of parts) yield { choices: [{ delta: { content: p } }] }; yield { choices: [{ delta: { content: '' } }], usage: { completion_tokens: parts.length, extra: { prefill_tokens_per_s: 0, decode_tokens_per_s: 0 } } }; })();
  } } } };
}
