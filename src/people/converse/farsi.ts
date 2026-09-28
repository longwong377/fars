// D-336 (UD-22): the Farsi of the opt-in layer ("an option to hear farsi or english (in character)"). The person's reply is
// made and fenced in English as always (fence.ts: in character, their own life, nothing modern, nothing of the fate); the
// Farsi is that same reply put into everyday Persian, so it carries nothing the English did not. Two routes, measured
// (tools/dev/voices_eval.ts --farsi; DECISIONS D-336): the conversation model itself asked for the Persian of its reply
// (`llm`), or a translation model in a worker (`nllb`: NLLB-200 distilled 600M, CC-BY-NC-4.0, q8). Either way the Persian is
// checked before it is spoken: Persian script only, and a Farsi fence (modern things and the site's later names).
import type { Mind } from './mind';

/** modern things and the site's later names in Persian (the English fence has already run; these catch what a translation
 *  can add: "Persepolis", "Takht-e Jamshid", modern devices, Islam's words) */
const FENCE_FA: [RegExp, string][] = [
  [/تخت[\s‌]*جمشید/, 'Takht-e Jamshid'], [/پرسپولیس/, 'Persepolis'], [/اسکندر/, 'Alexander'], [/تلفن|موبایل|گوشی/, 'phone'], [/اینترنت/, 'internet'], [/کامپیوتر|رایانه/, 'computer'],
  [/ماشین|اتومبیل|خودرو/, 'car'], [/قطار/, 'train'], [/هواپیما/, 'aeroplane'], [/مسجد/, 'mosque'], [/اسلام|مسلمان|قرآن|نماز|الله/, 'Islam'], [/پول|اسکناس|سکه/, 'money'],
  [/دقیقه|ساعت\s*\d/, 'clock time'], [/میلادی|هجری|شمسی/, 'era'], [/تفنگ|باروت/, 'gun'], [/سیب[\s‌]*زمینی|گوجه/, 'New World crops'], [/ایران(?!ی)/, 'Iran (the modern state)'],
];
export function fenceFa(fa: string): string[] {
  const hits = FENCE_FA.filter(([re]) => re.test(fa)).map(([, t]) => t);
  const letters = [...fa.replace(/[\s\d.,!?؟،؛:"'«»()\-–—…‌]/g, '')]; const persian = letters.filter(c => /[؀-ۿﭐ-﷿ﹰ-﻿]/.test(c)).length;
  if (!letters.length || persian / letters.length < 0.9) hits.push('not Persian script');
  if (/\d/.test(fa)) hits.push('digits');
  return hits;
}
export type FarsiRoute = 'llm' | 'nllb';
/** the prompt of the llm route: a translator's, outside the person's talk (the person's context is primed again after it) */
export const FA_SYSTEM = 'You put a person\'s spoken words into plain, everyday spoken Persian (Farsi), as a farmer or craftsman of Fars would say them. Keep the meaning exactly and add nothing. Write only the Persian, in Persian script, with no explanation, no transliteration and no English.';
export async function llmFarsi(mind: Mind, english: string): Promise<{ fa: string; ms: number } | null> {
  const e = mind.engine; if (!e) return null; const t0 = performance.now();
  const r = await e.chat.completions.create({ messages: [{ role: 'system', content: FA_SYSTEM }, { role: 'user', content: english }], max_tokens: 120, temperature: 0.2 } as any) as any;
  mind.forget(); // (the person's talk is primed again for the next answer)
  const fa = String(r.choices?.[0]?.message?.content ?? '').replace(/^["«“]|["»”]$/g, '').trim(); return fa ? { fa, ms: performance.now() - t0 } : null;
}
/** the nllb route: the translation model in its own worker (loaded on the first Farsi reply) */
export class FarsiTranslator {
  private w: Worker | null = null; private seq = 1; private pending = new Map<number, (m: any) => void>(); ready: Promise<boolean> | null = null;
  load(device: 'webgpu' | 'wasm' = 'wasm'): Promise<boolean> {
    return (this.ready ??= new Promise(res => {
      this.w = new Worker(new URL('./farsi_worker.ts', import.meta.url), { type: 'module' });
      this.w.onmessage = e => { const m = e.data; if (m.type === 'loaded') { res(true); return; } if (m.type === 'error' && m.id === undefined) { res(false); return; } const p = this.pending.get(m.id); this.pending.delete(m.id); p?.(m); };
      this.w.postMessage({ type: 'load', device });
    }));
  }
  async translate(english: string): Promise<{ fa: string; ms: number } | null> {
    if (!(await this.load())) return null; const id = this.seq++;
    const m = await new Promise<any>(res => { this.pending.set(id, res); this.w!.postMessage({ type: 'fa', id, text: english }); });
    return m.type === 'fa' ? { fa: m.fa, ms: m.ms } : null;
  }
}
/** the Farsi of a reply by the chosen route, checked; null when it fails the check (the English is spoken instead: the
 *  layer says so) */
export async function toFarsi(english: string, o: { route: FarsiRoute; mind?: Mind; nllb?: FarsiTranslator }): Promise<{ fa: string; ms: number; route: FarsiRoute; hits: string[] } | null> {
  const r = o.route === 'llm' && o.mind ? await llmFarsi(o.mind, english) : o.nllb ? await o.nllb.translate(english) : null;
  if (!r) return null; const hits = fenceFa(r.fa); return { ...r, route: o.route, hits };
}
