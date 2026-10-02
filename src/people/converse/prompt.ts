// D-296 (UD-18): what the language model is told when the stranger speaks to a person: who they are (life.ts), the fence
// (fence.ts), how well they know the stranger (memory.ts), and the talk so far. Short on purpose: the whole prompt stays
// under ~450 tokens (life.ts lifeBriefShort: the read-in speed and the GPU watchdog).
// D-315 (UD-21): and what they remember of the stranger from earlier conversations in this save (talk.ts recall: their own
// meetings and what they heard from kin and friends), and the closed set of things they may do (intent.ts INTENT_LINE).
// The budget holds: when the memory lines and the tag line would take the prompt past PROMPT_TOKENS, the least needed lines
// of the life go first (the baked memories, what they know well, the day's news, the friends, the year), never the name,
// the work, the house, the fence or the memory of the stranger.
import { FENCE_SHORT } from './fence';
import { lifeBriefShort, type LifeRecord } from './life';
import { INTENT_LINE } from './intent';
import { approxTokens } from './tokens';

export interface Turn { role: 'user' | 'assistant'; content: string }
export type Knows = 'none' | 'nod' | 'recognise' | 'heard';
/** the prompt's ceiling (tokens): one read-in well under the Windows GPU watchdog's ~2 s on a 1-2 B model (B98) */
export const PROMPT_TOKENS = 450;
export { approxTokens };

export interface Remembered { lines: string[] }
export function systemPrompt(L: LifeRecord, knows: Knows, prose?: string | null, memory?: string[] | null, withIntents = true): string {
  const met = knows === 'recognise' ? 'You know this stranger’s face.' : knows === 'heard' ? 'You have not met this stranger yourself, but you have heard of him.' : knows === 'nod' ? 'You have seen this stranger about.' : 'You have never seen this stranger.';
  const mem = (memory ?? []).filter(Boolean);
  const head = 'You are a person of Parsa, the king’s seat, in year 19 of King Xerxes.';
  const tail = [`A plainly dressed stranger with a foreign accent comes up to you. ${met}`, ...(mem.length ? [`What you remember of the stranger: ${mem.join(' ')}`] : []), FENCE_SHORT, ...(withIntents ? [INTENT_LINE] : [])];
  // the life brief, cut line by line (least needed first) until the whole fits the budget
  let life = lifeBriefShort(L, prose); const drop = [/^Before this year: /m, /^On your mind: /m, /^Memories: /m, /^You know well: /m, /^News today: /m, /^Friends and kin nearby: /m, /^Lately: /m, / Earlier: [^\n]*/, /, (?:son|daughter|wife) of [^;\n]+(?=; you speak)/];
  const build = () => [head, life, ...tail].join('\n');
  for (const re of drop) { if (approxTokens(build()) <= PROMPT_TOKENS) break; life = life.split('\n').map(l => re.source.startsWith('^') ? (re.test(l) ? '' : l) : l.replace(re, '')).filter(Boolean).join('\n'); }
  // (D-372: still over with every line dropped: a large house is named to its first three)
  if (approxTokens(build()) > PROMPT_TOKENS) life = life.replace(/^(In your house: [^,\n]+, [^,\n]+, [^,\n]+), [^\n]*$/m, '$1.');
  let out = build();
  // still over (a long memory): the older of the memory lines goes
  if (approxTokens(out) > PROMPT_TOKENS && mem.length > 1) { tail[1] = `What you remember of the stranger: ${mem[mem.length - 1]}`; out = [head, life, ...tail].join('\n'); }
  return out;
}

/** the messages for one answer (the talk so far kept short: the last few turns) */
export function messages(L: LifeRecord, knows: Knows, history: Turn[], said: string, prose?: string | null, retryNote?: string): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const out: { role: 'system' | 'user' | 'assistant'; content: string }[] = [{ role: 'system', content: systemPrompt(L, knows, prose) }];
  for (const t of history.slice(-4)) out.push(t);
  out.push({ role: 'user', content: retryNote ? `${said}\n(${retryNote})` : said });
  return out;
}

/** the reply cut to what a person says in one breath: at most three sentences, no stage directions or quotes round it */
export function tidy(text: string): string {
  let t = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/\*[^*]*\*/g, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^\p{Lu}[\p{L}\-’' ]{1,30}:\s*/u, '').replace(/^\s*["“]|["”]\s*$/g, '').trim(); // a leading "Name:" the model sometimes writes; quotes round it
  const s = t.match(/[^.!?]+[.!?]+["”’]?/g); if (s && s.length > 3) t = s.slice(0, 3).join('').trim();
  return t;
}

/** the prompt for priming (D-296): as the stranger comes near, the model reads the person's life (the system prompt, kept
 *  under ~450 tokens: one read-in well under the GPU watchdog's ~2 s on a 1-2 B model) and the person notices the stranger
 *  (a first turn); WebLLM keeps both in its multi-round KV cache, so the question then costs only its own words. (A split
 *  into several "remember this" turns was measured and dropped: the model learnt to answer "Yes." to everything.) */
export function primeParts(L: LifeRecord, knows: Knows, prose?: string | null, memory?: string[] | null): { system: string; facts: string[] } {
  return { system: systemPrompt(L, knows, prose, memory), facts: ['(The stranger comes up to you.)'] };
}
