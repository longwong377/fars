// D-296 (UD-08, UD-18): the baked layer of a life. Offline (tools/dev/bake_lives.ts, on the GPU machine, a larger local model
// than the one that plays the person), each person's record (life.ts: the simulation's facts) is written out as the texture
// the simulation does not hold: how they came to be here, three memories, a hope, a worry, what they think of the people
// they name, a turn of phrase. Every string is fenced (fence.ts) and must name only people of the record. The prose is keyed
// to (world seed, pid): the world's seed changes per new game, so the shipped sample serves the default world (seed 1)
// and the runtime uses the record alone elsewhere (DECISIONS D-296: why, and the plan for the full bake).
import { fenceHits } from './fence';
import { MONTHS } from '../calendar';
import { lifeBriefShort, type LifeRecord } from './life';

export interface Baked { backstory: string; memories: string[]; hope: string; worry: string; opinions: { name: string; view: string }[]; saying: string }
export interface BakedRow extends Baked { seed: number; pid: number; day: number; model: string; ms: number; check: { fence: string[]; unknownNames: string[]; ok: boolean } }

export function bakeMessages(L: LifeRecord) {
  return [
    { role: 'system' as const, content: 'You write the inner life of one ordinary person of Parsa (Persepolis) in the year 467 before our era, in the reign of King Xerxes, from the facts of their life given. Invent nothing that contradicts the facts; name no one who is not named in them; nothing after 467 and no hint of what later befell the king, the Terrace or the empire; nothing modern; no coins, paper or clocks. Plain English, as if translated. Answer only with one JSON object, nothing before or after it.' },
    { role: 'user' as const, content: `${lifeBriefShort(L)}\n\nWrite JSON with these keys: "backstory" (2-3 sentences: how this person came to live and work where they do, from the facts), "memories" (3 short first-person memories, each specific: a person, a day, a place of their own life), "hope" (one sentence), "worry" (one sentence), "opinions" (up to 3 objects {"name", "view"} about people named above), "saying" (a turn of phrase this person often uses, in English).` },
  ];
}

export function parseBake(raw: string): Baked | null {
  try { const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    const s = (x: any) => (typeof x === 'string' ? x.trim() : '');
    return { backstory: s(j.backstory), memories: Array.isArray(j.memories) ? j.memories.map(s).filter(Boolean).slice(0, 3) : [], hope: s(j.hope), worry: s(j.worry),
      opinions: Array.isArray(j.opinions) ? j.opinions.filter((o: any) => o && typeof o === 'object').map((o: any) => ({ name: s(o.name), view: s(o.view) })).slice(0, 3) : [], saying: s(j.saying) }; }
  catch { return null; }
}

/** the checks of a baked life: the fence over every string, and every capitalised name it uses must be a name of the record */
export function checkBake(b: Baked, L: LifeRecord): { fence: string[]; unknownNames: string[]; ok: boolean } {
  const all = [b.backstory, ...b.memories, b.hope, b.worry, ...b.opinions.map(o => `${o.name}: ${o.view}`), b.saying].join(' \n ');
  const fence = fenceHits(all).map(h => `${h.kind}:${h.term}`);
  const unknown = unknownNames(all, L);
  return { fence, unknownNames: unknown, ok: fence.length === 0 && unknown.length === 0 };
}

/** names the model made up: capitalised words that are neither a name of the person's record (their own, their house's,
 *  kin, friends, the year's events) nor a god, people, place or month of their world, nor an ordinary word opening a sentence
 *  (a made-up kinsman contradicts the life the simulation gave them; a later name, e.g. Bahram, is an anachronism) */
const WORLD_NAMES = new Set(['i', 'parsa', 'persia', 'persian', 'persians', 'terrace', 'king', 'xerxes', 'darius', 'khshayarsha', 'auramazda', 'ahuramazda', 'humban', 'napiriša', 'napirisa', 'marduk', 'nabû', 'nabu', 'hadad', 'ptah', 'amun', 'zeus', 'mithra', 'anahita', 'elam', 'elamite', 'elamites', 'susa', 'babylon', 'babylonian', 'babylonians', 'ecbatana', 'media', 'mede', 'medes', 'median', 'sardis', 'lydia', 'lydian', 'ionia', 'ionian', 'ionians', 'yauna', 'egypt', 'egyptian', 'syria', 'syrian', 'bactria', 'bactrian', 'sogdian', 'lycian', 'carian', 'cappadocian', 'thracian', 'treasury', 'hall', 'hundred', 'columns', 'pulvar', 'kur', 'across-the-river', 'mišebaka', 'greeks', 'greek', 'stranger', 'gods', 'god']);
for (const m of MONTHS) for (const n of [m.op, m.bab, m.elam]) WORLD_NAMES.add(n.replace(/\s*\(\?\)/, '').toLowerCase());
export function unknownNames(text: string, L: LifeRecord): string[] {
  const known = new Set([L.name, ...L.household.map(k => k.name), ...L.friends.map(f => f.name), ...L.kinHouses.map(k => k.split('’')[0]), ...[...L.year, ...L.quarrels, ...L.debts, ...L.today.earlier, L.today.now, L.today.next ?? ''].flatMap(y => y.match(/\p{Lu}[\p{L}\-’]+/gu) ?? [])].map(n => n.toLowerCase().replace(/^\*/, '')));
  const out: string[] = [];
  for (const m of text.matchAll(/(^|[.!?:;“"\n…]\s*|\s)(\p{Lu}[\p{L}\-’']*)/gu)) {
    const sentenceStart = m.index === 0 || /[.!?:;“"\n…]/.test(m[1]); const w = m[2].replace(/[’']s$/, ''); const lw = w.toLowerCase();
    if (known.has(lw) || WORLD_NAMES.has(lw)) continue;
    if (sentenceStart && /^[A-Za-z’'-]+$/.test(w)) continue; // an ordinary word opening a sentence ("Hard, yes.")
    out.push(w);
  }
  return [...new Set(out)];
}

/** the memories as the runtime gives them to the model (one paragraph) */
export function bakedProse(b: Baked | null | undefined): string | null {
  if (!b) return null; return [b.backstory, ...b.memories, `I hope ${b.hope.replace(/^I hope\s*/i, '')}`, `I worry ${b.worry.replace(/^I worry\s*/i, '')}`, ...b.opinions.map(o => `${o.name}: ${o.view}`), `I often say: “${b.saying}”`].filter(s => s && s.length > 3).join(' ');
}
