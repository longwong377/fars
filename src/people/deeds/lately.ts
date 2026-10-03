// D-720 (UD-24, UD-26, UD-32: "deeds that change nothing"): what a person has lately done and had done to them among the
// townsfolk, in their own words. The minds act on their own every day (initiative.ts: ~440 deeds a day in a world of 81,000:
// visits, help, gifts, blows, insults, courting, peace made), each remembered by the doer, the one it was done to, the one it
// was about and those who saw it (minds.ts memory) and moving their feelings; but nothing of it reached what the person could
// SAY (life.ts lifeRecord: births, deaths, the economy and the calendar only; deeds/engine.ts briefOf: the stranger's deeds
// only). A neighbour who struck your son yesterday, a friend who helped mend your roof, the man who came courting your
// daughter: none of it was in the talk. latelyOf reads the memories back (the deeds' own record: who, to whom, what, when)
// and words them from the person's side, newest first, the wrongs and kindnesses before the small change. Out of world (the
// translation layer's and the model's brief); tier C as the deeds themselves.
import type { DeedRec, Verb } from './types';

/** the deed from each side: [the doer's words, the words of the one it was done to]; O is the other's name, T the third's */
const SIDE: Partial<Record<Verb, [string, string]>> = {
  join: ['did something with O', 'did something with O'], help: ['helped O with the work', 'O helped me with the work'],
  teach: ['learned from O', 'taught O'], learn: ['taught O', 'O taught me'], hire: ['hired O for a day’s work', 'O hired me for a day’s work'],
  give: ['gave O a gift', 'O gave me a gift'], lend: ['lent O what was needed', 'O lent me what we needed'], borrow: ['borrowed from O', 'O borrowed from me'],
  ask_for: ['asked O for help', 'O came asking for help'], steal: ['', 'something of ours was stolen'], return: ['gave O back what was owed', 'O gave back what was ours'],
  share_food: ['ate with O', 'ate with O'], tell: ['told O news', 'O told me'], lie: ['', 'O told me'], promise: ['made O a promise', 'O made me a promise'],
  threaten: ['threatened O', 'O threatened me'], warn: ['warned O', 'O warned me'], apologize: ['asked O’s pardon', 'O came to ask my pardon'],
  thank: ['thanked O', 'O thanked me'], praise: ['praised O', 'O praised me before others'], insult: ['insulted O', 'O insulted me'], mock: ['made fun of O', 'O made fun of me'],
  curse: ['cursed O', 'O cursed me to my face'], comfort: ['comforted O', 'O came to comfort me'], confide: ['confided in O', 'O confided in me'],
  flirt: ['smiled at O', 'O made eyes at me'], court: ['went courting O', 'O came courting me'], bless: ['blessed O', 'O blessed me'], forgive: ['forgave O', 'O forgave me'],
  accuse: ['accused O before the neighbours', 'O accused me before the neighbours'], complain: ['complained to O', 'O complained to me'],
  intercede: ['pleaded with O for T', 'O pleaded with me for T'], reconcile: ['made peace with O', 'made peace with O'], introduce: ['brought O to meet T', 'O brought me to meet T'],
  attack: ['struck O', 'O struck me'], push: ['shoved O', 'O shoved me'], embrace: ['embraced O', 'O embraced me'], heal: ['tended O', 'O tended me'],
  carry: ['carried a load for O', 'O carried a load for me'], fetch: ['fetched T for O', 'O fetched T for me'], repair: ['mended something for O', 'O mended something of ours'],
  build: ['built with O', 'O built with me'], break: ['broke something of O’s', 'O broke something of ours'], guard: ['kept watch for O', 'O kept watch for us'],
  come_with: ['went along with O', 'O went along with me'], visit: ['visited O', 'O came to visit us'], meet: ['met O', 'met O'], send: ['sent O on an errand', 'O sent me on an errand'],
  bring: ['brought O something', 'O brought me something'], dismiss: ['sent O away', 'O sent me away'], avoid: ['kept away from O', 'O keeps away from me'],
};
const JOIN: Record<string, [string, string]> = { eat: ['ate and drank with O', 'ate and drank with O'], play: ['passed the time with O', 'passed the time with O'], pray: ['prayed with O', 'prayed with O'], work: ['worked alongside O', 'O came and worked alongside me'] };
/** what a deed looks like to one who saw it, neither doer nor done-to: "I saw O strike T" */
const SEEN: Partial<Record<Verb, string>> = { attack: 'strike', push: 'shove', insult: 'insult', mock: 'make fun of', curse: 'curse', embrace: 'embrace', flirt: 'make eyes at', court: 'come courting', steal: 'steal from', break: 'break something of', accuse: 'accuse', threaten: 'threaten', reconcile: 'make peace with', praise: 'praise', give: 'give a gift to', help: 'help' };
/** the weight of a deed in a life (what a person would tell first): wrongs and bonds before courtesies */
const WEIGHT: Partial<Record<Verb, number>> = { attack: 5, steal: 5, break: 4, curse: 4, accuse: 4, threaten: 4, court: 4, reconcile: 4, heal: 4, insult: 3, mock: 3, push: 3, help: 3, give: 3, lend: 3, borrow: 3, hire: 3, repair: 3, comfort: 3, intercede: 3, forgive: 3, apologize: 3, return: 3, embrace: 3, visit: 2, share_food: 2, teach: 2, learn: 2, tell: 2, lie: 2, praise: 2, warn: 2, promise: 2, flirt: 2 };
const when = (k: number) => k <= 0 ? 'today' : k === 1 ? 'yesterday' : k < 7 ? `${['', '', 'two', 'three', 'four', 'five', 'six'][k]} days ago` : k < 12 ? `${['', '', '', '', '', '', '', 'seven', 'eight', 'nine', 'ten', 'eleven'][k]} days ago` : k < 22 ? 'half a month ago' : 'about a month ago'; // (D-720, W5: no weeks in Persis)
const CONSENT_FAIL: Partial<Record<Verb, string>> = { court: 'but was turned away', help: 'but was not wanted', lend: 'but was refused', borrow: 'but was refused', ask_for: 'but got nothing', reconcile: 'but O would not', visit: 'but was not let in', hire: 'but O would not', come_with: 'but O would not', apologize: 'but O would not hear it' };

export interface LatelyPort { minds: { memory: Map<number, number[]> }; rec(id: number): DeedRec | undefined; name(a: number | 'player'): string }
/** up to n things done lately by, to, about or before person `pid`, in their words (first person, newest and weightiest first) */
export function latelyOf(W: LatelyPort, pid: number, day: number, n = 3, within = 30): string[] {
  const ids = W.minds.memory.get(pid) ?? []; const seen = new Set<string>(); const out: { w: number; d: number; s: string }[] = [];
  for (let i = ids.length - 1; i >= 0; i--) {
    const r = W.rec(ids[i]); if (!r || r.day > day || day - r.day > within) continue; const d = r.deed;
    if (d.actor === 'player' || d.target === 'player') continue; // (the stranger's deeds are the brief's own: engine.ts briefOf)
    const nm = (a: unknown) => typeof a === 'number' ? W.name(a) : 'someone';
    const sub = (s: string, o: unknown) => s.replace(/\bO\b/g, nm(o)).replace(/\bT\b/g, nm(d.third));
    // (a joining is as its activity: a drink, a game, the work: "drank with Arta", not "worked alongside Arta" over a jug of beer)
    const side = d.verb === 'join' ? JOIN[d.act === 'eat' ? 'eat' : d.act === 'play' || d.act === 'gamble' ? 'play' : (d.act as string) === 'offer' ? 'pray' : 'work'] : SIDE[d.verb]; let s = '';
    if (d.actor === pid) { if (!side?.[0]) continue; s = `I ${sub(side[0], d.target)}`; if (!r.out.ok) { const f = CONSENT_FAIL[d.verb]; if (!f) continue; s += ` ${f.replace(/\bO\b/g, nm(d.target))}`; } }
    else if (!r.out.ok) continue;
    else if (d.target === pid) { if (!side) continue; s = (d.verb === 'tell' || d.verb === 'lie') && d.about ? `${nm(d.actor)} told me of ${nm(d.third)}: ${d.about}` : sub(side[1], d.actor); if (/^(made peace|ate|met|taught|passed|prayed|did)/.test(s)) s = `I ${s}`; }
    else if (d.third === pid && (d.verb === 'intercede' || d.verb === 'fetch' || d.verb === 'introduce')) s = `${nm(d.actor)} ${d.verb === 'intercede' ? `pleaded for me with ${nm(d.target)}` : d.verb === 'fetch' ? `fetched me for ${nm(d.target)}` : `brought me to meet ${nm(d.target)}`}`;
    else if (d.third === pid && (d.verb === 'tell' || d.verb === 'lie' || d.verb === 'accuse' || d.verb === 'complain')) s = `${nm(d.actor)} has been talking of me to ${nm(d.target)}`;
    else if (SEEN[d.verb] && typeof d.target === 'number') s = `I saw ${nm(d.actor)} ${SEEN[d.verb]} ${nm(d.target)}`;
    else continue;
    s = `${s.replace(/\.$/, '')}, ${when(day - r.day)}`; const k = s.replace(/, [a-z ]+$/, ''); if (seen.has(k)) continue; seen.add(k);
    out.push({ w: (WEIGHT[d.verb] ?? 1) + (d.actor === pid || d.target === pid ? 1 : 0), d: r.day, s });
  }
  return out.sort((a, b) => b.w - a.w || b.d - a.d).slice(0, n).map(x => x.s);
}
/** a late deed in the brief's second person ("I helped Arta" → "you helped Arta"; "Arta struck me" → "Arta struck you") */
export function toYou(s: string): string {
  return s.replace(/^I saw\b/, 'you saw').replace(/^I\b/, 'you').replace(/\bme\b/g, 'you').replace(/\bmy\b/g, 'your').replace(/\bours\b/g, 'your house’s').replace(/\bus\b/g, 'your house');
}
