// D-296 (UD-08, UD-18): the baked layer of a life. Offline (tools/dev/bake_lives.ts, on the GPU machine, a larger local model
// than the one that plays the person), each person's record (life.ts: the simulation's facts) is written out as the texture
// the simulation does not hold: how they came to be here, three memories, a hope, a worry, what they think of the people
// they name, a turn of phrase. Every string is fenced (fence.ts) and must name only people of the record. The prose is keyed
// to (world seed, pid): the world's seed changes per new game, so the shipped sample serves the default world (seed 1)
// and the runtime uses the record alone elsewhere (DECISIONS D-296: why, and the plan for the full bake).
import { fenceHits } from './fence';
import { lifeBriefShort, type LifeRecord } from './life';

export interface Baked { backstory: string; memories: string[]; hope: string; worry: string; opinions: { name: string; view: string }[]; saying: string }
export interface BakedRow extends Baked { seed: number; pid: number; day: number; model: string; ms: number; check: { fence: string[]; unknownNames: string[]; ok: boolean } }

export function bakeMessages(L: LifeRecord) {
  return [
    { role: 'system' as const, content: 'You write the inner life of one ordinary person of Parsa (Persepolis) in the year 467 before our era, in the reign of King Xerxes, from the facts of their life given. Invent nothing that contradicts the facts; name no one who is not named in them; nothing after 467 and no hint of what later befell the king, the Terrace or the empire; nothing modern; no coins, paper or clocks. Plain English, as if translated. Answer only with JSON.' },
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
  const known = new Set([L.name, ...L.household.map(k => k.name), ...L.friends.map(f => f.name), ...L.kinHouses.map(k => k.split('’')[0]), ...[...L.year, ...L.quarrels, ...L.debts].flatMap(y => y.match(/\p{Lu}[\p{L}\-’]+/gu) ?? [])].map(n => n.toLowerCase()));
  const ALLOWED = /^(I|My|The|A|An|He|She|We|They|It|When|One|In|On|At|But|And|Of|To|Our|His|Her|This|That|If|After|Before|Then|Every|Now|Once|Some|May|With|For|As|Yes|No|Parsa|Persia|Persian|Persians|Terrace|King|Xerxes|Darius|Khshayarsha|Auramazda|Ahuramazda|Humban|Napiriša|Marduk|Nabû|Hadad|Ptah|Amun|Zeus|Elam|Elamite|Elamites|Susa|Babylon|Babylonian|Ecbatana|Media|Mede|Medes|Median|Sardis|Lydia|Lydian|Ionia|Ionian|Ionians|Egypt|Egyptian|Syria|Syrian|Bactria|Bactrian|Treasury|Hall|Hundred|Columns|Pulvar|Kur|Marv|Across-the-River|Nisanu|Ādukanaiša|Mišebaka|Yauna|Karapaθiya|Kārapaθiya)$/u;
  const unknownNames = [...new Set((all.match(/\p{Lu}[\p{L}\-’]+/gu) ?? []).filter(n => !ALLOWED.test(n) && !known.has(n.toLowerCase())))];
  return { fence, unknownNames, ok: fence.length === 0 && unknownNames.length === 0 };
}

/** the memories as the runtime gives them to the model (one paragraph) */
export function bakedProse(b: Baked | null | undefined): string | null {
  if (!b) return null; return [b.backstory, ...b.memories, `I hope ${b.hope.replace(/^I hope\s*/i, '')}`, `I worry ${b.worry.replace(/^I worry\s*/i, '')}`, ...b.opinions.map(o => `${o.name}: ${o.view}`), `I often say: “${b.saying}”`].filter(s => s && s.length > 3).join(' ');
}
