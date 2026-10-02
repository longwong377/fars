// D-370 (UD-25 (3), (6); the render side's hooks, kept here so the world loop calls one function each): the stranger's
// presence and ear in the running game.
//   strangerPresence: the people near the player (the audio loop's nearPeople list) and the game time: time spent beside the
//     employer's people (or the gang's, the caravan's, the household's) is reported to the sim (PeopleSim.strangerNear), which
//     makes an attended day of two hours between 6 and 18 h;
//   thinCaption: the translation layer thins as the stranger learns the tongue: each word of an overheard line's gloss is
//     shown with the chance 1 - comprehension^1.3 (keyed by the line and the word: the same line thins the same way), and the
//     overheard line is itself a little exposure to the tongue (unsimplified, not spoken back).
import type { PeopleSim } from '../sim';
import { u01, salt } from '../hash';
import { hashString } from '../../core/rng';
import { unitsFor } from '../../audio/voices';
import type { LangId } from '../../lang/lexicon';

const NEAR_M = 30, EVERY_H = 0.05;
const LANG_NAME: Record<string, string> = { op: 'Old Persian', el: 'Elamite', arc: 'Aramaic', bab: 'Babylonian', grc: 'Greek', egy: 'Egyptian' };
const S = salt('thin-gloss');
const last = new WeakMap<PeopleSim, number>();
interface Near { key: string; x: number; z: number }

/** call from the frame loop with the audio's near list (keys 'a<agent>' or 'p<pid>') and the player's position (world x, z) */
export function strangerPresence(sim: PeopleSim, near: readonly Near[], at: { x: number; z: number }) {
  const t0 = last.get(sim); if (t0 === undefined || sim.t < t0) { last.set(sim, sim.t); return; }
  const dtH = sim.t - t0; if (dtH < EVERY_H) return; last.set(sim, sim.t);
  const pids: number[] = [];
  for (const n of near) { if (Math.hypot(n.x - at.x, n.z - at.z) > NEAR_M) continue;
    const pid = n.key[0] === 'a' ? sim.agents[Number(n.key.slice(1))]?.pid : n.key[0] === 'p' ? Number(n.key.slice(1)) : undefined; if (pid !== undefined && pid >= 0) pids.push(pid); }
  sim.strangerNear(pids, Math.min(dtH, 0.5));
}
/** the caption as the stranger reads it: the gloss thinned by comprehension; the line heard. Unchanged before the economy is built */
export function thinCaption<C extends { lang: string; gloss: string; t0: number; t1: number; unit: string }>(sim: PeopleSim, c: C): C {
  const l = LANG_NAME[c.lang]; const E = sim.ledgerNow(); if (!l || !E) return c;
  const day = Math.floor(sim.t / 24), S2 = E.stranger(); S2.do({ a: 'hear', day, lang: l, hours: Math.max(0, c.t1 - c.t0) / 3600, simple: 0, spoke: false });
  // the words of this unit (a word, or a line's entries): each heard with its sense shown counts towards knowing it; a unit
  // whose every word is known is not glossed at all (the stranger understands it); otherwise the gloss thins with the tongue
  const U = unitsFor(c.lang as LangId), u = U.words.find(x => x.id === c.unit) ?? U.lines.find(x => x.id === c.unit), parts = u?.parts ?? [c.unit];
  if (parts.every(p => S2.knows(p))) return { ...c, gloss: '' };
  for (const p of parts) S2.heardWord(p);
  const comp = S2.comp(l, day), keep = 1 - Math.pow(comp, 1.3); if (keep >= 0.999) return c;
  const k = hashString(c.unit) | 0, words = c.gloss.split(/\s+/);
  const out = words.map((w, i) => u01(sim.seed, S, k, i) < keep ? w : '…').join(' ').replace(/(…\s*){2,}/g, '… ');
  return { ...c, gloss: out.trim() === '…' ? '' : out };
}
