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
import { spoken } from './spoken';

export interface Turn { role: 'user' | 'assistant'; content: string }
export type Knows = 'none' | 'nod' | 'recognise' | 'heard';
/** the prompt's ceiling (tokens): one read-in well under the Windows GPU watchdog's ~2 s on a 1-2 B model (B98) */
export const PROMPT_TOKENS = 450;
export { approxTokens };

export interface Remembered { lines: string[] }
export function systemPrompt(L: LifeRecord, knows: Knows, prose?: string | null, memory?: string[] | null, withIntents = true): string {
  const met = knows === 'recognise' ? 'You know this stranger’s face.' : knows === 'heard' ? 'You have not met this stranger yourself, but you have heard of him.' : knows === 'nod' ? 'You have seen this stranger about.' : 'You have never seen this stranger.';
  const mem = (memory ?? []).filter(Boolean);
  const head = 'You are a person of Parsa, the king’s seat, in the nineteenth year of King Xerxes.';
  const tail = [`A plainly dressed stranger with a foreign accent comes up to you. ${met}`, ...(mem.length ? [`What you remember of the stranger: ${mem.join(' ')}`] : []), FENCE_SHORT, ...(withIntents ? [INTENT_LINE] : [])];
  // the life brief, cut line by line (least needed first) until the whole fits the budget
  // D-451 (the census: the past reached the model in 1 brief of 200): long list lines are first cut to their first items
  // (a past, a care, the talk of the quarter kept short rather than lost), then lines are dropped least needed first, the
  // past late; whatever is still over loses the last item of its longest list line, so the budget always holds
  let life = lifeBriefShort(L, prose);
  const build = () => [head, life, ...tail].join('\n'), over = () => approxTokens(build()) > PROMPT_TOKENS;
  const listLine = (re: RegExp, keep: number) => { life = life.split('\n').map(l => { if (!re.test(l)) return l; const i = l.indexOf(': '), items = l.slice(i + 2).replace(/\.$/, '').split('; '); return items.length > keep ? `${l.slice(0, i + 2)}${items.slice(0, keep).join('; ')}.` : l; }).join('\n'); };
  for (const [re, keep] of [[/^Talk of the quarter: /, 1], [/^Your house needs: /, 1], [/^Lately: /, 1], [/^On your mind: /, 1], [/^Manner: /, 3], [/^Plain to see on you: /, 1], [/^Before this year: /, 2], [/^Manner: /, 2], [/^Before this year: /, 1]] as [RegExp, number][]) { if (!over()) break; listLine(re, keep); }
  const drop = [/^Talk of the quarter: /m, /^Memories: /m, /^You know well: /m, /^News today: /m, / Earlier: [^\n]*/, /^Friends and kin nearby: /m, /^On your mind: /m, /^Your house needs: /m, /^Lately: /m, /, (?:son|daughter|wife) of [^;\n]+(?=; you speak)/, /^Plain to see on you: /m, /^Before this year: /m];
  for (const re of drop) { if (!over()) break; life = life.split('\n').map(l => re.source.startsWith('^') ? (re.test(l) ? '' : l) : l.replace(re, '')).filter(Boolean).join('\n'); }
  // (D-372: still over with every line dropped: a large house is named to its first three)
  if (over()) life = life.replace(/^(In your house: [^,\n]+, [^,\n]+, [^,\n]+), [^\n]*$/m, '$1.');
  for (let g = 0; g < 40 && over(); g++) { const ls = life.split('\n'), i = ls.map((l, k) => [k, /; |, /.test(l.slice(l.indexOf(': ') + 2)) ? l.length : -1]).sort((a, b) => b[1] - a[1])[0];
    if (!i || i[1] < 0) break; const l = ls[i[0]], cut = Math.max(l.lastIndexOf('; '), l.lastIndexOf(', ')); ls[i[0]] = l.slice(0, cut) + '.'; life = ls.join('\n'); }
  let out = build();
  // still over (a long memory): the older of the memory lines goes
  if (approxTokens(out) > PROMPT_TOKENS && mem.length > 1) { tail[1] = `What you remember of the stranger: ${mem[mem.length - 1]}`; out = build(); }
  // (D-395: the cap is hard: the life's last lines go, never its first with the name and the work)
  for (let ls = life.split('\n'); approxTokens(out) > PROMPT_TOKENS && ls.length > 2;) { ls = ls.slice(0, -1); life = ls.join('\n'); out = build(); }
  return out;
}

/** D-395: the ceiling of one turn of the stranger's as the model reads it (tokens: the system prompt is read in once when
 *  the person is primed; each answer then reads only this turn, so prompt + turn stays under the watchdog's read-in) */
export const TURN_TOKENS = 220;
/** the stranger's turn as the model reads it (mind.ts): what goes before his words (the memory, the house's dealings), his
 *  words as the person hears them (hear.ts), the simulation's word on an ask, and the closing note with the one life fact.
 *  D-395: numbers in words; over TURN_TOKENS the parts that matter least go first (before, then the life fact) */
export function userTurn(name: string, h: { text: string; note?: string | null }, o: { userText?: string; before?: string; note?: string; ground?: string } = {}): string {
  if (o.userText) return spoken(o.userText);
  const build = (before?: string, ground?: string) => spoken(`${before ? before + '\n' : ''}The stranger says: “${h.text}”${h.note ? ` (${h.note}.)` : ''}${o.note ? ` (${o.note})` : ''} (Answer as ${name}, from your own life${ground ? `: ${ground}` : ''}.)`);
  // (a "no" said twice, before the words and in the simulation's note after them, is said once: after them)
  const lines = (o.before ?? '').split('\n').filter(l => { const m = /^\(Whatever he asks, you must say no: (.*)\.\)$/.exec(l); return l && !(m && o.note?.includes(m[1])); });
  let s = build(lines.join('\n'), o.ground); if (approxTokens(s) <= TURN_TOKENS) return s;
  // over the cap: the house's dealings and the stranger's looks go first, then why they came up, then the rest in order
  // (came, wary, facts, memory, no: the memory and the "no" last)
  const rank = (l: string) => /^\(The stranger |^\([A-Z][^)]*(?:sold|bought|gave|owes|lent)/.test(l) ? 0 : /^\(You came up/.test(l) ? 1 : 2;
  const order = lines.map((l, i) => ({ l, i, r: rank(l) })).sort((a, b) => a.r - b.r || a.i - b.i); const keep = new Set(lines.map((_, i) => i));
  for (const x of order) { if (approxTokens(s) <= TURN_TOKENS) break; keep.delete(x.i); s = build(lines.filter((_, i) => keep.has(i)).join('\n'), o.ground); }
  if (approxTokens(s) > TURN_TOKENS) s = build(undefined, undefined);
  return s;
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
