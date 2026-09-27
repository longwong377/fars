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
import { groundLine, isRecallQuestion } from './ground';
import { hearAsPerson } from './hear';
import { requestOf, looseRequest, tagAsked, wordsRefuse, type Intent, type Deed } from './intent';

export interface TurnOut {
  pid: number; said: string; answer: Answer; knows: Knows; memory: string[];
  /** the ask in the stranger's words (grammar), the model's tag, the ask decided */
  request: Intent | null; tag: Intent | null; ask: Intent | null;
  decision: (Decision & { event: TalkEvent }) | null;
  /** the words said no (the person's own), and whether the answer was asked again to match a refusal */
  saidNo: boolean; retold: boolean;
  /** a question about earlier meetings: the fact the simulation picked (the model only rephrased it) */ fact?: string; judged?: boolean | null;
}
/** the simulation's word on an ask, as the person is told it (the model's brief: out of world) */
/** D-315 (the GPU runs): where the memory of the stranger goes. 'near' (the default after run 2): in the turn, just before
 *  the stranger's words, framed "You remember:", every time there is one; 'top': in the system brief, and with the words only on
 *  a talk's first turn or when asked about earlier meetings (run 1's layout) */
export const talkOpts = { memory: 'near' as 'near' | 'top', /** D-315 run 4: the picked recall fact, the life fact, the judge */ pick: true };
export function verdictNote(d: Decision): string {
  if (d.noop) return `You may say yes: ${d.reason}.`;
  return d.ok ? 'You can do this, if you are willing.' : `You cannot do this: ${d.reason}.`;
}
/** one turn: the stranger says `said` to person `pid` now (sim.t); conv: the conversation's id (its first turn's time) */
export async function talkTurn(mind: Mind, sim: PeopleSim, pid: number, said: string, o: { conv: number; history?: Turn[]; prose?: string | null } = { conv: sim.t }): Promise<TurnOut> {
  const t = sim.t, day = Math.floor(t / 24), hour = t - day * 24;
  sim.talkAddressed(pid);
  const L = lifeRecord(sim.pop, sim.cal, pid, day, hour);
  const memory = sim.talk.recall(pid, t, 2);
  const agent = sim.pop.persons[pid]?.agent ?? -1;
  // (run 2: one who had only heard of the stranger was told "You have never seen this stranger" and denied all of it)
  const g0: Knows = agent >= 0 ? sim.memory.greeting(agent, t) : 'none';
  const knows: Knows = (sim.talk.rows.get(pid)?.length ?? 0) > 0 ? 'recognise' : g0 !== 'none' ? g0 : memory.length ? 'heard' : 'none';
  // the ask: the grammar's, else a paraphrase by its one cued family (the simulation's word goes with the words either way)
  const request = requestOf(said) ?? looseRequest(said);
  const pre = request ? sim.talk.consider(pid, t, request) : null;
  // (the first GPU run: a 2 B model ignores the memory at the head of a long brief: on the first turn of a talk, or asked
  // about earlier meetings, the memory that matters most goes with the stranger's words too)
  const near = talkOpts.memory === 'near';
  const first = !(sim.talk.rows.get(pid) ?? []).some(r => r.conv === o.conv); const top = sim.talk.recall(pid, t, 1)[0];
  const remind = !near && top && (first || /\b(remember|before|met|heard|know me|say of|spoken)\b/i.test(said)) ? `What you remember of the stranger: ${top}` : '';
  const note = [pre ? verdictNote(pre) : '', remind].filter(Boolean).join(' ') || undefined;
  // (run 2: the simulation's "no" after the stranger's words was often not kept; said first, plainly, it goes with the memory)
  const before = [near && memory.length ? `(You remember: ${memory.join(' ')} If the stranger asks about it, tell him what you remember, in your own words.)` : '',
    near && pre && !pre.ok && !pre.noop ? `(Whatever he asks, you must say no: ${pre.reason}.)` : ''].filter(Boolean).join('\n') || undefined;
  // (after run 3: asked about earlier meetings, the simulation picks the ONE remembered fact and the model only says it in
  // its own words; otherwise the one life fact most relevant to the words goes next to them: ground.ts)
  const recallQ = talkOpts.pick && isRecallQuestion(said) && !request; const fact = recallQ ? sim.talk.recallFact(pid, t).fact : undefined;
  const ground = talkOpts.pick && !recallQ ? groundLine(L, said) : '';
  let answer = fact ? await mind.answer(L, knows, o.history ?? [], said, o.prose, 64, { memory: [], userText: `The stranger says: “${hearAsPerson(said).text}”\n(Tell him this, in your own words, as yourself, in one or two sentences: “${fact}”)` })
    : await mind.answer(L, knows, o.history ?? [], said, o.prose, 64, { memory: near ? [] : memory, note, before: [before, ground].filter(Boolean).join('\n') || undefined });
  const tag = answer.intent ?? null;
  const ask = request ?? (tagAsked(tag, said) ? tag : null); // (a tag the stranger's words give no cue for is the model's, not an ask)
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
      // a yes (or a tag) the simulation does not allow: the person is told why and says so (once)
      if (!decision.ok && answer.ok && !saidNo) {
        const again = await mind.answer(L, knows, [], said, o.prose, 64, { memory, userText: `(You cannot do it: ${decision.reason}. Say so to the stranger, in your own words, and end with [refuse].)` });
        if (again.ok) { answer = { ...again, totalMs: answer.totalMs + again.totalMs, tries: answer.tries + again.tries }; retold = true; }
      }
    }
  }
  const deed = decision ? { kind: decision.kind as Deed, arg: decision.arg ?? decision.event.arg, ok: decision.ok, reason: decision.reason, item: decision.item } : undefined;
  sim.talk.remember(pid, t, o.conv, said, answer.ok ? answer.text : '', deed);
  return { pid, said, answer, knows, memory, request, tag, ask, decision, saidNo, retold, fact, judged };
}
