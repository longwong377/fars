// D-296 (UD-18): what the language model is told when the stranger speaks to a person: who they are (life.ts), the fence
// (fence.ts), how well they know the stranger (memory.ts), and the talk so far. Short on purpose: the whole prompt stays
// under ~450 tokens (life.ts lifeBriefShort: the read-in speed and the GPU watchdog).
import { FENCE_SHORT } from './fence';
import { lifeBriefShort, type LifeRecord } from './life';

export interface Turn { role: 'user' | 'assistant'; content: string }
export type Knows = 'none' | 'nod' | 'recognise';

export function systemPrompt(L: LifeRecord, knows: Knows, prose?: string | null): string {
  const met = knows === 'recognise' ? 'You know this stranger’s face.' : knows === 'nod' ? 'You have seen this stranger about.' : 'You have never seen this stranger.';
  return [
    'You are a person of Parsa, the king’s seat, in year 19 of King Xerxes.',
    lifeBriefShort(L, prose),
    `A plainly dressed stranger with a foreign accent comes up to you. ${met}`,
    FENCE_SHORT,
  ].join('\n');
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
export function primeParts(L: LifeRecord, knows: Knows, prose?: string | null): { system: string; facts: string[] } {
  return { system: systemPrompt(L, knows, prose), facts: ['(The stranger comes up to you.)'] };
}
