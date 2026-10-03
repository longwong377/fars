// D-315 (UD-21, T-E10): one turn of a conversation with a person, words and deeds together. Used alike by the world
// (ui.ts, ?converse), the lab (dev/converseLab.ts) and the node test (tests/talk_world.test.ts, with a stand-in model):
//   1. the person stops and turns to the stranger (talk.ts: a pause, an event);
//   2. what they remember of the stranger in this save (their own meetings and what kin and friends told them) goes into
//      their prompt (prompt.ts, within the ~450-token budget);
//   3. when the stranger's words ask for something (intent.ts requestOf), the SIMULATION's word on it goes with the words
//      ("You can do it" / "You cannot: on watch ..."): the person answers in their own words and ends with a tag;
//   4. the ask (the grammar's, else the model's tag) is decided by the simulation and, when done, laid over the day plan
//      (sim.talkAct); a "no" in the person's own words is honoured (sim.talkDecline); a "yes" the simulation refuses is
//      asked again once, told why, so the words never promise what the day will not do;
//   5. the conversation's memory row is written (talk.ts remember), and gossip follows from it over the next days.
import type { PeopleSim } from '../sim';
import type { Decision, TalkEvent } from '../talk';
import type { Mind, Answer } from './mind';
import type { Turn, Knows } from './prompt';
import { lifeRecord } from './life';
import { groundFact, isRecallQuestion } from './ground';
import { hearAsPerson } from './hear';
import { requestOf, looseRequest, tagAsked, wordsRefuse, type Intent, type Deed } from './intent';
import type { SAct, Verdict } from '../speech/stranger';
import type { Deed as OpenDeed, DeedRec, Outcome } from '../deeds/types';
import { VERBS } from '../deeds/verbs';

export interface TurnOut {
  pid: number; said: string; answer: Answer; knows: Knows; memory: string[];
  /** the ask in the stranger's words (grammar), the model's tag, the ask decided */
  request: Intent | null; tag: Intent | null; ask: Intent | null;
  decision: (Decision & { event: TalkEvent }) | null;
  /** the words said no (the person's own), and whether the answer was asked again to match a refusal */
  saidNo: boolean; retold: boolean;
  /** a question about earlier meetings: the fact the simulation picked (the model only rephrased it) */ fact?: string; judged?: boolean | null;
  /** D-370: a step of the sandbox the words proposed (work, guest-right, a group, a claim, a petition, a gift), the
   *  simulation's verdict told to the person first, and what was done after their answer */
  sandbox?: { act: SAct; verdict: Verdict; done: Verdict | null };
  /** D-459 (UD-32): any other deed the words do or propose (deeds/parse.ts or the model's reading), the world's and the person's
   *  word on it told to them first, and what was done */
  deed?: { deed: OpenDeed; out: Outcome; done: DeedRec | null };
  /** D-370 (B234): the person would not talk at all ('distrust') */
  refused?: string;
}
/** the simulation's word on an ask, as the person is told it (the model's brief: out of world) */
/** D-315 (the GPU runs): where the memory of the stranger goes. 'near' (the default after run 2): in the turn, just before
 *  the stranger's words, framed "You remember:", every time there is one; 'top': in the system brief, and with the words only on
 *  a talk's first turn or when asked about earlier meetings (run 1's layout) */
export const talkOpts = { memory: 'near' as 'near' | 'top', /** D-315 run 4: the picked recall fact, the life fact, the judge */ pick: true };
const KNOWS = new WeakMap<PeopleSim, Map<string, Knows>>();
export function verdictNote(d: Decision): string {
  if (d.noop) return `You may say yes: ${d.reason}.`;
  return d.ok ? 'You can do this, if you are willing.' : `You cannot do this: ${d.reason}.`;
}
/** D-720: what plays the person in a turn: the loaded model (mind.ts Mind) or, where it is not there, their own lines (ownlines.ts OwnMind) */
export type TalkMind = Pick<Mind, 'answer' | 'judge'>;
/** one turn: the stranger says `said` to person `pid` now (sim.t); conv: the conversation's id (its first turn's time) */
export async function talkTurn(mind: TalkMind, sim: PeopleSim, pid: number, said: string, o: { conv: number; history?: Turn[]; prose?: string | null; /** D-375: why this person came up to the stranger (approach.ts opening) */ approached?: string; /** D-459: the model's reading of the words as a deed (deeds/extract.ts), when it made one */ deed?: OpenDeed | null } = { conv: sim.t }): Promise<TurnOut> {
  const t = sim.t, day = Math.floor(t / 24), hour = t - day * 24;
  // D-370 (B234): the trust gate. A house that distrusts the stranger (a guest who left without thanks, a claim found false,
  // wages left unpaid by him, rumours) will not talk: the person turns away without a word from the model; a wary one is curt
  const E0 = sim.ledgerNow(), hh0 = `h:${sim.pop.home(pid, day)}`, trust0 = E0?.trust && E0.hh.has(hh0) ? E0.trust.trustOf(hh0, 'player', day) : 0.5;
  if (E0?.trust && !E0.trust.willTalk(hh0, 'player', day)) {
    sim.talkAddressed(pid); const text = 'turns away and will not speak with you';
    const answer: Answer = { text, raw: text, ok: false, hits: [], tries: 0, ttftMs: 0, totalMs: 0, primeMs: 0, tokens: 0, prefillTps: 0, decodeTps: 0, intent: null };
    sim.talk.remember(pid, t, o.conv, said, '', undefined);
    return { pid, said, answer, knows: 'recognise', memory: [], request: null, tag: null, ask: null, decision: null, saidNo: true, retold: false, refused: 'distrust' } as TurnOut;
  }
  sim.talkAddressed(pid);
  const L = lifeRecord(sim.pop, sim.cal, pid, day, hour);
  const memory = sim.talk.recall(pid, t, 2);
  const agent = sim.pop.persons[pid]?.agent ?? -1;
  // (run 2: one who had only heard of the stranger was told "You have never seen this stranger" and denied all of it)
  const g0: Knows = agent >= 0 ? sim.memory.greeting(agent, t) : 'none';
  // (D-456: how well they know the stranger is fixed at the talk's first turn: counted from this talk's own rows, the second
  // turn said "You know this stranger's face", the prime changed and the model was primed afresh, the talk so far forgotten)
  const kk = `${pid}:${o.conv}`, seen = KNOWS.get(sim) ?? new Map<string, Knows>(); KNOWS.set(sim, seen);
  const knows: Knows = seen.get(kk) ?? ((sim.talk.rows.get(pid) ?? []).some(r => r.conv !== o.conv) ? 'recognise' : g0 !== 'none' ? g0 : memory.length ? 'heard' : 'none'); seen.set(kk, knows);
  // the ask: the grammar's, else a paraphrase by its one cued family (the simulation's word goes with the words either way)
  // D-370: no deed asked in the grammar's words: a step of the sandbox (work, guest-right, a group, who the stranger is, a
  // petition, a gift), read before the loose paraphrases (which take "may I stay the night" for "wait here"); the simulation
  // decides it now and the person is told its verdict, as with a deed
  const strict = requestOf(said), sb = strict ? null : sim.strangerAsk(pid, said);
  // D-459 (UD-32): anything else the words do or propose (help with the roof, a hunt tomorrow, a blow, a lie about a neighbour):
  // an open deed, judged by the world and this person's mind before they answer (o.deed: the model's reading, when it made one)
  const dj = strict || sb ? null : sim.strangerDeed(pid, said, o.deed);
  const dSense = dj ? VERBS[dj.deed.verb] : null;
  const dNote = !dj || !dSense ? '' : dSense.consent ? (dj.out.ok ? `You are willing: ${dj.out.why}.` : `You will not: ${dj.out.why}.${dj.out.say ? ` (In your words: “${dj.out.say}”)` : ''}`) : dj.out.ok ? `(What he does: ${dSense.gloss}${dj.out.why && dj.out.why !== dSense.gloss ? `; you feel: ${dj.out.why}` : ''}.)` : `(${dj.out.why}.)`;
  const request = strict ?? (sb ? null : looseRequest(said));
  const pre = request ? sim.talk.consider(pid, t, request) : null;
  const sbNote = sb && sb.act.a !== 'hear' && sb.act.a !== 'claim' ? (sb.verdict.ok ? `You may say yes: ${sb.verdict.why}.` : `You cannot do this: ${sb.verdict.why}.`) : '';
  // (the first GPU run: a 2 B model ignores the memory at the head of a long brief: on the first turn of a talk, or asked
  // about earlier meetings, the memory that matters most goes with the stranger's words too)
  const near = talkOpts.memory === 'near';
  const first = !(sim.talk.rows.get(pid) ?? []).some(r => r.conv === o.conv); const top = sim.talk.recall(pid, t, 1)[0];
  const remind = !near && top && (first || /\b(remember|before|met|heard|know me|say of|spoken)\b/i.test(said)) ? `What you remember of the stranger: ${top}` : '';
  const note = [pre ? verdictNote(pre) : '', sbNote, dNote, remind].filter(Boolean).join(' ') || undefined;
  // (run 2: the simulation's "no" after the stranger's words was often not kept; said first, plainly, it goes with the memory)
  // D-370: the house's own dealings with the stranger and how much of their tongue he has (the sim's state, not the model's)
  const sFacts = E0 && E0.hasStranger ? E0.stranger().factsFor(hh0, day) : [];
  const dBrief = sim.deeds.briefOf(pid, day);
  const came = o.approached ? `(You came up to the stranger yourself: you ${o.approached.replace(/^comes up to you and /, '').replace(/\basks\b/, 'want to ask')}. Say so in your own words.)` : '';
  // (D-720, W15: struck coins were rare in Persis (darics and sigloi from c. 500): silver is weighed; the person says so)
  const coin = /\bcoins?\b|\bdarics?\b|\bsigl(oi|os)\b/i.test(said) ? '(The stranger speaks of coins: struck pieces of silver you seldom see here; silver is weighed on the scales. Say so, puzzled.)' : '';
  const wary = trust0 < 0.4 ? '(You do not trust this stranger: be short with him and give nothing away.)' : '';
  const before = [came, coin, wary, dBrief.length ? `(${dBrief.join(' ')})` : '', sFacts.length ? `(${sFacts.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join('. ')}.)` : '', near && memory.length ? `(You remember: ${memory.join(' ')} If the stranger asks about it, tell him what you remember, in your own words.)` : '',
    near && pre && !pre.ok && !pre.noop ? `(Whatever he asks, you must say no: ${pre.reason}.)` : ''].filter(Boolean).join('\n') || undefined;
  // (after run 3: asked about earlier meetings, the simulation picks the ONE remembered fact and the model only says it in
  // its own words; otherwise the one life fact most relevant to the words goes next to them: ground.ts)
  const recallQ = talkOpts.pick && isRecallQuestion(said) && !request; const fact = recallQ ? sim.talk.recallFact(pid, t).fact : undefined;
  // (run 4: the fact BEFORE the stranger's words took T-E9 from 62.5 % to 52.8 %: run 5 puts it in the closing note, last)
  const ground = talkOpts.pick && !recallQ ? groundFact(L, said) : undefined;
  let answer = fact ? await mind.answer(L, knows, o.history ?? [], said, o.prose, 64, { memory: [], userText: `The stranger says: “${hearAsPerson(said).text}” (Answer as ${L.name}. What you remember: ${fact} Tell him that, in your own words, keeping what happened and who it was.)` })
    : await mind.answer(L, knows, o.history ?? [], said, o.prose, 64, { memory: near ? [] : memory, note, before, ground });
  const tag = answer.intent ?? null;
  const ask = request ?? (!sb?.act && tagAsked(tag, said) ? tag : null); // (a tag the stranger’s words give no cue for is the model’s, not an ask; D-391: nor one that overrides a sandbox ask)
  // (a "no" in the words: the refuse tag; else, when something was asked, the judge (the loaded model: YES or NO), and the
  // word list only when the judge gives no clear answer)
  let judged: boolean | null = null;
  if (talkOpts.pick && ask && answer.ok && tag?.kind !== 'refuse' && !(tag && tag.kind === ask.kind)) judged = await mind.judge(said, answer.text);
  const saidNo = answer.ok && (tag?.kind === 'refuse' || (judged === false) || (judged === null && (!tag || tag.kind === 'none') && wordsRefuse(answer.text)));
  let decision: TurnOut['decision'] = null, retold = false;
  if (ask) {
    if (saidNo && !(pre && !pre.ok)) decision = sim.talkDecline(pid, ask, tag?.kind === 'refuse' ? tag.arg ?? '' : 'said no', t);
    else {
      decision = sim.talkAct(pid, ask, t);
      // a yes (or a tag) the simulation does not allow: the person is told why and says so (once; D-456: in the same primed
      // talk: the memory went into the prime key here and the talk was primed afresh, twice)
      if (!decision.ok && answer.ok && !saidNo) {
        const again = await mind.answer(L, knows, [], said, o.prose, 64, { memory: near ? [] : memory, userText: `(You cannot do it: ${decision.reason}. Say so to the stranger, in your own words, and end with [refuse].)` });
        if (again.ok) { answer = { ...again, totalMs: answer.totalMs + again.totalMs, tries: answer.tries + again.tries }; retold = true; }
      }
    }
  }
  const deed = decision ? { kind: decision.kind as Deed, arg: decision.arg ?? decision.event.arg, ok: decision.ok, reason: decision.reason, item: decision.item } : undefined;
  sim.talk.remember(pid, t, o.conv, said, answer.ok ? answer.text : '', deed);
  // D-370: the sandbox step is done when the simulation allowed it and the person did not say no in their own words; every
  // turn is also a minute of the person's tongue in the stranger's ear (simplified by their patience)
  let sandbox: TurnOut['sandbox'];
  if (sb) { const no = answer.ok && (tag?.kind === 'refuse' || wordsRefuse(answer.text)); sandbox = { ...sb, done: sb.verdict.ok && (!no || sb.act.a === 'claim' || sb.act.a === 'hear') ? sim.strangerDo(sb.act) : null }; }
  // D-459: the deed is done when the world allows it and, where it needs the person's will, they did not say no in their words;
  // a deed done TO them (a blow, an insult, a theft) is done by the stranger whatever they answer
  let deedOut: TurnOut['deed'];
  if (dj) { const no = answer.ok && (tag?.kind === 'refuse' || wordsRefuse(answer.text)); const done = dj.out.ok && (!dSense!.consent || !no) ? sim.strangerDeedDo(dj.deed) : null; deedOut = { ...dj, done }; }
  sim.strangerHeard(pid, 1);
  return { pid, said, answer, knows, memory, request, tag, ask, decision, saidNo, retold, fact, judged, ...(sandbox ? { sandbox } : {}), ...(deedOut ? { deed: deedOut } : {}) };
}
