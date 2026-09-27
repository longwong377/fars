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
import { requestOf, wordsRefuse, DEEDS, type Intent, type Deed } from './intent';

export interface TurnOut {
  pid: number; said: string; answer: Answer; knows: Knows; memory: string[];
  /** the ask in the stranger's words (grammar), the model's tag, the ask decided */
  request: Intent | null; tag: Intent | null; ask: Intent | null;
  decision: (Decision & { event: TalkEvent }) | null;
  /** the words said no (the person's own), and whether the answer was asked again to match a refusal */
  saidNo: boolean; retold: boolean;
}
/** the simulation's word on an ask, as the person is told it (the model's brief: out of world) */
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
  const knows: Knows = (sim.talk.rows.get(pid)?.length ?? 0) > 0 ? 'recognise' : agent >= 0 ? sim.memory.greeting(agent, t) : memory.length ? 'nod' : 'none';
  const request = requestOf(said);
  const pre = request ? sim.talk.consider(pid, t, request) : null;
  let answer = await mind.answer(L, knows, o.history ?? [], said, o.prose, 64, { memory, note: pre ? verdictNote(pre) : undefined });
  const tag = answer.intent ?? null;
  const ask = request ?? (tag && (DEEDS as string[]).includes(tag.kind) ? tag : null);
  const saidNo = answer.ok && (tag?.kind === 'refuse' || ((!tag || tag.kind === 'none') && wordsRefuse(answer.text)));
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
  return { pid, said, answer, knows, memory, request, tag, ask, decision, saidNo, retold };
}
