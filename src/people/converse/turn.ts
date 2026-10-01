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
import { requestOf, looseRequest, tagAsked, wordsRefuse, econAskOf, type Intent, type Deed, type EconAsk } from './intent';
import type { SimView } from '../speech/grounds';
import { considerDeed, actDeed, talkGift, dealsOf, type DeedOut, type DeedWorld } from '../speech/deeds';
import type { LifeRecord } from './life';

/** D-358: the running simulation as a conversation reads it: the economy stepped to the day (already paid for by the day plans
 *  when the economy is on), the relations when the world runs them (opts.bonds: never built here, B228), the asks and rumours
 *  when on */
export function simView(sim: PeopleSim, day: number): SimView {
  return { pop: sim.pop, econ: sim.opts.economy === false ? null : sim.econTo(day), bonds: sim.opts.bonds ? sim.bonds : null, asks: sim.asksWorld.on ? sim.asksWorld : null };
}
/** a person's life record with the simulation's means, debts, wants, bonds, rumours and trust (D-358) */
export function lifeOf(sim: PeopleSim, pid: number, day: number, hour: number): LifeRecord { return lifeRecord(sim.pop, sim.cal, pid, day, hour, simView(sim, day)); }
/** the simulation's word on an economy ask (D-358), as the person is told it (out of world) */
export function deedNote(d: DeedOut): string { return d.ok ? `You can do this, if you are willing: you would have ${d.reason}.` : `You cannot do this: ${d.reason}.`; }

export interface TurnOut {
  pid: number; said: string; answer: Answer; knows: Knows; memory: string[];
  /** the ask in the stranger's words (grammar), the model's tag, the ask decided */
  request: Intent | null; tag: Intent | null; ask: Intent | null;
  decision: (Decision & { event: TalkEvent }) | null;
  /** the words said no (the person's own), and whether the answer was asked again to match a refusal */
  saidNo: boolean; retold: boolean;
  /** a question about earlier meetings: the fact the simulation picked (the model only rephrased it) */ fact?: string; judged?: boolean | null;
  /** D-358: the economy's business in the words (buy, haggle, give, lend, petition, host, help) and what the simulation did
   *  with it; the house's trust in the stranger and whether it talks to him freely (B234) */
  econ: { ask: EconAsk; deed: DeedOut; saidNo: boolean } | null; trust: number; willTalk: boolean;
  /** a talk deed that took bread or barley from the house's stores */ gift?: DeedOut | null;
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
  const V = simView(sim, day); const L = lifeRecord(sim.pop, sim.cal, pid, day, hour, V);
  const W: DeedWorld | null = V.econ ? { pop: sim.pop, econ: V.econ, asks: V.asks } : null; const D = dealsOf(sim);
  const memory = sim.talk.recall(pid, t, 2);
  const agent = sim.pop.persons[pid]?.agent ?? -1;
  // (run 2: one who had only heard of the stranger was told "You have never seen this stranger" and denied all of it)
  const g0: Knows = agent >= 0 ? sim.memory.greeting(agent, t) : 'none';
  const knows: Knows = (sim.talk.rows.get(pid)?.length ?? 0) > 0 ? 'recognise' : g0 !== 'none' ? g0 : memory.length ? 'heard' : 'none';
  // the ask: the grammar's, else a paraphrase by its one cued family (the simulation's word goes with the words either way)
  // D-358: the economy's business first (its grammar reads "let me give you" before requestOf's give); the house decides it
  const eAsk = W ? econAskOf(said) : null; const ePre = eAsk && W ? considerDeed(W, D, pid, day, eAsk) : null;
  const request = eAsk ? null : requestOf(said) ?? looseRequest(said);
  // B234: a house that does not trust the stranger (TrustLedger.willTalk) answers him short and does nothing he asks
  const distrust = !L.willTalk ? 'does not trust the stranger' : null;
  const pre0 = request ? sim.talk.consider(pid, t, request) : null;
  const pre = pre0 && distrust && pre0.ok && !pre0.noop ? { ...pre0, ok: false, reason: distrust } : pre0;
  // (the first GPU run: a 2 B model ignores the memory at the head of a long brief: on the first turn of a talk, or asked
  // about earlier meetings, the memory that matters most goes with the stranger's words too)
  const near = talkOpts.memory === 'near';
  const first = !(sim.talk.rows.get(pid) ?? []).some(r => r.conv === o.conv); const top = sim.talk.recall(pid, t, 1)[0];
  const remind = !near && top && (first || /\b(remember|before|met|heard|know me|say of|spoken)\b/i.test(said)) ? `What you remember of the stranger: ${top}` : '';
  const note = [pre ? verdictNote(pre) : '', ePre ? deedNote(ePre) : '', remind].filter(Boolean).join(' ') || undefined;
  // (run 2: the simulation's "no" after the stranger's words was often not kept; said first, plainly, it goes with the memory)
  const before = [near && memory.length ? `(You remember: ${memory.join(' ')} If the stranger asks about it, tell him what you remember, in your own words.)` : '',
    near && pre && !pre.ok && !pre.noop ? `(Whatever he asks, you must say no: ${pre.reason}.)` : '', ePre && !ePre.ok ? `(Whatever he asks, you must say no: ${ePre.reason}.)` : '',
    distrust ? '(You do not trust this stranger: answer him short and do nothing he asks.)' : ''].filter(Boolean).join('\n') || undefined;
  // (after run 3: asked about earlier meetings, the simulation picks the ONE remembered fact and the model only says it in
  // its own words; otherwise the one life fact most relevant to the words goes next to them: ground.ts)
  const recallQ = talkOpts.pick && isRecallQuestion(said) && !request && !eAsk; const rf = recallQ ? sim.talk.recallFact(pid, t) : null;
  // (D-358: what the house did with the stranger through the economy, a bargain, a gift, a meal, is part of what they remember)
  const fact = rf ? (L.stranger.length && !(rf.kind === 'own' && rf.row?.deed) ? `${rf.kind === 'none' ? '' : rf.fact + ' '}At my house: ${L.stranger[0].replace(/\bthe stranger\b/g, 'you')}.`.trim() : rf.fact) : undefined;
  // (run 4: the fact BEFORE the stranger's words took T-E9 from 62.5 % to 52.8 %: run 5 puts it in the closing note, last)
  const ground = talkOpts.pick && !recallQ ? groundFact(L, said) : undefined;
  let answer = fact ? await mind.answer(L, knows, o.history ?? [], said, o.prose, 64, { memory: [], userText: `The stranger says: “${hearAsPerson(said).text}” (Answer as ${L.name}. What you remember: ${fact} Tell him that, in your own words, keeping what happened and who it was.)` })
    : await mind.answer(L, knows, o.history ?? [], said, o.prose, 64, { memory: near ? [] : memory, note, before, ground });
  const tag = answer.intent ?? null;
  const ask = eAsk ? null : request ?? (tagAsked(tag, said) ? tag : null); // (a tag the stranger's words give no cue for is the model's, not an ask)
  // (a "no" in the words: the refuse tag; else, when something was asked, the judge (the loaded model: YES or NO), and the
  // word list only when the judge gives no clear answer)
  let judged: boolean | null = null;
  if (talkOpts.pick && ask && answer.ok && tag?.kind !== 'refuse' && !(tag && tag.kind === ask.kind)) judged = await mind.judge(said, answer.text);
  const saidNo = answer.ok && (tag?.kind === 'refuse' || (judged === false) || (judged === null && (!tag || tag.kind === 'none') && wordsRefuse(answer.text)));
  let decision: TurnOut['decision'] = null, retold = false;
  if (ask) {
    if (saidNo && !(pre && !pre.ok)) decision = sim.talkDecline(pid, ask, tag?.kind === 'refuse' ? tag.arg ?? '' : 'said no', t);
    else if (distrust && !(pre0?.noop)) decision = sim.talkDecline(pid, ask, distrust, t);
    else {
      decision = sim.talkAct(pid, ask, t);
      // a yes (or a tag) the simulation does not allow: the person is told why and says so (once)
      if (!decision.ok && answer.ok && !saidNo) {
        const again = await mind.answer(L, knows, [], said, o.prose, 64, { memory, userText: `(You cannot do it: ${decision.reason}. Say so to the stranger, in your own words, and end with [refuse].)` });
        if (again.ok) { answer = { ...again, totalMs: answer.totalMs + again.totalMs, tries: answer.tries + again.tries }; retold = true; }
      }
    }
  }
  // D-358: the economy's business: the person's own "no" is kept; a "yes" the house can give is entered into the economy
  let econ: TurnOut['econ'] = null;
  if (eAsk && ePre && W) {
    let ej: boolean | null = null; if (talkOpts.pick && answer.ok && ePre.ok && tag?.kind !== 'refuse') ej = await mind.judge(said, answer.text);
    const no = answer.ok && (tag?.kind === 'refuse' || ej === false || (ej === null && wordsRefuse(answer.text)));
    if (ePre.ok && !no) econ = { ask: eAsk, deed: actDeed(W, D, pid, t, eAsk, ePre), saidNo: false };
    else {
      econ = { ask: eAsk, deed: ePre.ok ? { ...ePre, ok: false, reason: 'said no', intents: [] } : ePre, saidNo: no };
      D.rows.push({ t, pid, hh: ePre.hh, kind: eAsk.kind, ok: false, reason: econ.deed.reason, events: [], cause: -1, purse: { ...D.purse } });
      if (!ePre.ok && answer.ok && !no) { // a "yes" the house cannot give: told why, said again (once)
        const again = await mind.answer(L, knows, [], said, o.prose, 64, { memory, userText: `(You cannot do it: ${ePre.reason}. Say so to the stranger, in your own words, and end with [refuse].)` });
        if (again.ok) { answer = { ...again, totalMs: answer.totalMs + again.totalMs, tries: answer.tries + again.tries }; retold = true; } }
    }
  }
  // a talk deed that gives the stranger bread or barley takes it from the house's stores
  const gift = W && decision?.ok && !decision.noop && (decision.kind === 'give' || decision.kind === 'trade') ? talkGift(W, D, pid, t, decision.item) : null;
  const deed = decision ? { kind: decision.kind as Deed, arg: decision.arg ?? decision.event.arg, ok: decision.ok, reason: decision.reason, item: decision.item } : undefined;
  sim.talk.remember(pid, t, o.conv, said, answer.ok ? answer.text : '', deed);
  return { pid, said, answer, knows, memory, request, tag, ask, decision, saidNo, retold, fact, judged, econ, trust: L.trust, willTalk: L.willTalk, gift };
}
