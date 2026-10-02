// D-459 (UD-32): the stranger's words as a deed, by the model. The same record as the grammar's (deeds/parse.ts), filled by the
// talk model as JSON under a schema (WebLLM's response_format json_schema; llama.cpp's grammar in the CPU eval), so anything said
// can be read as a deed, not only the lexicon's words. The prompt is short (well under the 450-token read-in, D-296) and runs
// before the person's answer; the grammar's reading stands when the model is not loaded, and the two are compared in the eval
// (bench-reports/talk_eval_s15.md). The model reads; the simulation decides (deeds/engine.ts).
import { VERBS } from './verbs';
import type { Deed, Actor, Verb, Good } from './types';
import { ACTIVITIES, type ActivityId } from '../activities';

const VERB_IDS = Object.keys(VERBS) as Verb[];
const GOODS: Good[] = ['grain', 'bread', 'silver', 'fuel', 'goods', 'beer', 'wine', 'oil', 'cloth', 'tool', 'animal', 'food', 'water'];
/** the shared activities the model may name (the catalogue's, less the court's and the abstract ones) */
export const ACT_IDS = (Object.keys(ACTIVITIES) as ActivityId[]).filter(a => !/^(royal_|enthroned|bear_|attend_|offmap|lie_ill|sleep|queue|shelter|inspect|weigh|seal|cut_seal|write_tablet|stand_guard|patrol|train)/.test(a));

/** the JSON schema of a deed as the model writes it ("none" when the words do nothing but talk) */
export const DEED_SCHEMA = {
  type: 'object',
  properties: {
    verb: { type: 'string', enum: ['none', ...VERB_IDS] },
    who: { type: 'string', enum: ['you', 'other', 'named'], description: 'whom the deed is done to: you (the person spoken to), other (someone pointed at), named (someone named)' },
    name: { type: 'string', description: 'the name or kin word of a named person, else empty' },
    activity: { type: 'string', enum: ['none', ...ACT_IDS] },
    good: { type: 'string', enum: ['none', ...GOODS] },
    qty: { type: 'integer', minimum: 0, maximum: 100 },
    when: { type: 'string', enum: ['now', 'later', 'tonight', 'tomorrow'] },
    force: { type: 'string', enum: ['none', 'light', 'hard', 'deadly'] },
  },
  required: ['verb', 'who', 'activity', 'good', 'qty', 'when', 'force', 'name'],
} as const;

const GLOSS: Partial<Record<Verb, string>> = { join: 'do something together', help: 'help with their work', teach: 'they teach him', learn: 'he teaches them', hire: 'he pays them to work',
  ask_for: 'ask a thing for nothing', share_food: 'eat together', come_with: 'go somewhere together', send: 'send them on an errand', bring: 'bring someone to him', dismiss: 'send them away', return: 'give back' };
/** the model's brief for reading a deed (system + user): the verbs with a word each, so a 1-2 B model can choose (≈ 330 tokens) */
export function deedPrompt(said: string): { system: string; user: string } {
  // (verbs by name; a word of sense only where the name alone is unclear: the whole prompt under ~300 tokens)
  const gl = VERB_IDS.map(v => GLOSS[v] ? `${v} (${GLOSS[v]})` : v).join(', ');
  return {
    system: `Read what a stranger says to a person and write, as JSON, the one deed his words do or propose. verb "none" if the words only ask or tell about something. Verbs: ${gl}. activity: the work or pastime shared (fowl for hunting, eat for drinking or a meal, play for dancing or games, wash for swimming, chant for singing, mould_brick for a roof or a wall), else none.`,
    user: `The stranger says: “${said}”`,
  };
}

export interface ModelDeed { verb: string; who: string; name?: string; activity: string; good: string; qty: number; when: string; force: string }
/** the model's JSON as a deed (checked against the closed sets: anything outside them is dropped, never guessed) */
export function fromModel(j: ModelDeed | null, actor: Actor, c: { addressee: number; hour: number; named?: (w: string) => number | null; pointed?: number | null; said: string }): Deed | null {
  if (!j || j.verb === 'none' || !VERB_IDS.includes(j.verb as Verb)) return null;
  const d: Deed = { verb: j.verb as Verb, actor, target: c.addressee, said: c.said, sure: 0.6 };
  const who = j.who === 'named' ? c.named?.(j.name ?? '') ?? null : j.who === 'other' ? c.pointed ?? null : null;
  if (who !== null && who !== c.addressee) { if (['tell', 'lie', 'accuse', 'complain', 'intercede', 'reconcile', 'introduce', 'bring', 'warn', 'send'].includes(d.verb)) d.third = who; else d.target = who; }
  if (j.activity !== 'none' && (ACT_IDS as string[]).includes(j.activity)) d.act = j.activity as ActivityId;
  if (j.good !== 'none' && (GOODS as string[]).includes(j.good)) { d.good = j.good as Good; if (j.qty > 0) d.qty = j.qty; }
  const h = c.hour; d.inH = j.when === 'tomorrow' ? 24 - h + 8 : j.when === 'tonight' ? Math.max(0.5, 19 - h) : j.when === 'later' ? Math.max(1, 15 - h) : 0;
  if (j.force !== 'none') d.force = j.force === 'deadly' ? 1 : j.force === 'hard' ? 0.75 : 0.35;
  return d;
}
