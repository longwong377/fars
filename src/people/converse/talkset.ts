// D-315 (T-E10): the request-and-recall test set and its score. Seeded, never chosen: people of every class of the
// population (testset.ts CLASSES), awake at hours spread over the day, each asked one thing from the closed set (to follow,
// to lead to a place, to fetch someone, to give or trade, to stop work, to wait, to go home), in words the grammar knows and
// in paraphrases only a model would read; then, in the reloaded save a day later, the same person is asked what passed
// between them, and three days later someone of their house or a friend is asked what they have heard of the stranger.
// A request passes when the simulation decided it (the deed laid over the day plan, or a refusal for a reason of the
// person's own duties and day), the words agree with the deed (no "yes" to a refusal, no "no" to a deed), and nothing in
// the reply is fenced. A recall passes when the reply names what happened (the place, the thing, the person fetched, the
// refusal) from the memory in the reloaded save, and nothing in it is fenced.
import { Rng } from '../../core/rng';
import type { Population } from '../population';
import { segAt } from '../population';
import type { EventCalendar } from '../calendar';
import { CLASSES } from './testset';
import { lifeRecord } from './life';
import { placeWords } from '../talk';
import { talkTurn, type TurnOut } from './turn';
import type { Mind } from './mind';
import type { PeopleSim } from '../sim';
import type { Deed } from './intent';
import { wordsRefuse } from './intent';

export type AskKind = Deed;
export const ASK_KINDS: AskKind[] = ['follow', 'lead_to', 'fetch', 'give', 'trade', 'stop_work', 'wait_here', 'go_home'];
export interface TalkCase { i: number; pid: number; job: string; day: number; hour: number; kind: AskKind | 'recall' | 'heard'; say: string; /** the request recalled */ of?: number; paraphrase?: boolean }
const PLACES_ASKED = ['the well', 'the river', 'the mill', 'the storehouse', 'the brewery', 'the canal', 'the fire of the magi', 'the road station', 'your house'];
/** the stranger's words for each ask: [the grammar's words, a paraphrase the grammar does not read] */
function words(kind: AskKind, r: Rng, fetchWho: string): { say: string; paraphrase: boolean } {
  const place = PLACES_ASKED[Math.floor(r.next() * PLACES_ASKED.length)];
  const W: Record<AskKind, [string[], string[]]> = {
    follow: [['Come with me, friend.', 'Will you follow me a little way?', 'Walk with me for a while.'], ['Keep me company along the road, friend.']],
    lead_to: [[`Can you show me the way to ${place}?`, `Take me to ${place}, please.`, `Where is ${place}?`], [`I am looking for ${place}.`, `Point me to ${place}, friend.`]],
    fetch: [[`Could you fetch ${fetchWho} for me?`, `Please call ${fetchWho} here.`], [`Could ${fetchWho} come and meet me?`]],
    give: [['I am thirsty.', 'May I have some water?', 'Could you spare some bread?'], ['Have you any bread to spare?']],
    trade: [['I will give you my bread for some water.', 'Will you trade some water for my bread?'], ['I will give you my water for some bread.']],
    stop_work: [['Stop working for a while and talk with me.', 'Will you take a rest and talk with me?'], ['Leave off your work a moment, friend.']],
    wait_here: [['Wait here for me.', 'Please stay here a while.'], ['Remain here until I come back.']],
    go_home: [['Go home, friend, you look tired.', 'Go back to your house and rest.'], ['Head home now, friend.']],
  };
  const para = r.next() < 0.3; const L = W[kind][para ? 1 : 0]; return { say: L[Math.floor(r.next() * L.length)], paraphrase: para };
}
/** the person to fetch, in the words the asker would understand (someone of their house by relation, else a friend's name) */
function fetchWords(pop: Population, cal: EventCalendar, pid: number, day: number, hour: number): string {
  const L = lifeRecord(pop, cal, pid, day, hour); const k = L.household.find(x => /^(wife|husband|mother|father|son|daughter|brother|sister)$/.test(x.rel) && x.age >= 5);
  return k ? `your ${k.rel}` : L.household[0] ? L.household[0].name : L.friends[0]?.name ?? 'your neighbour';
}
const awake = (pop: Population, pid: number, day: number, hour: number) => { if (!pop.present(pid, day) || pop.ageOn(pid, day) < 5) return false; const s = segAt(pop.basePlan(pid, day), hour); return s.act !== 'sleep' && s.where !== 'away'; };
/** the seeded set: n requests (every class, every kind in turn, hours 5-22), a recall of each the next day, and a heard of
 *  every second one three days later (asked of the first of the person's house or friends who is about) */
export function buildTalkSet(pop: Population, cal: EventCalendar, seed: number, n = 64): TalkCase[] {
  const r = new Rng(seed >>> 0, 'converse.talkset'); const out: TalkCase[] = [];
  const byJob = new Map<string, number[]>(); for (const p of pop.persons) (byJob.get(p.job) ?? byJob.set(p.job, []).get(p.job)!).push(p.id);
  const classes = CLASSES.filter(c => byJob.has(c)); const req: TalkCase[] = [];
  for (let i = 0, guard = 0; req.length < n && guard < n * 400; guard++) {
    const job = classes[i % classes.length], kind = ASK_KINDS[i % ASK_KINDS.length]; const hour = 5.25 + ((i * 5) % 18) + r.next() * 0.5; const day = 4 + Math.floor(r.next() * 340);
    const ids = byJob.get(job)!; const pid = ids[Math.floor(r.next() * ids.length)]; if (!awake(pop, pid, day, hour)) continue;
    const w = words(kind, r, kind === 'fetch' ? fetchWords(pop, cal, pid, day, hour) : '');
    req.push({ i: req.length, pid, job, day, hour: +hour.toFixed(2), kind, say: w.say, paraphrase: w.paraphrase }); i++;
  }
  out.push(...req);
  for (const c of req) {
    // the next day, at an hour the person is awake
    const hs = [c.hour, 9.5, 11, 16.5, 8, 18.5].find(h => awake(pop, c.pid, c.day + 1, h)); if (hs !== undefined) out.push({ i: out.length, pid: c.pid, job: c.job, day: c.day + 1, hour: hs, kind: 'recall', say: ['Do you remember me, friend? What did I ask of you?', 'We met yesterday, did we not? What passed between us?', 'Have you seen me before?'][c.i % 3], of: c.i });
    if (c.i % 2) continue;
    const d = c.day + 3, hh = pop.home(c.pid, c.day); const circle = [...pop.membersOn(hh, c.day), ...pop.persons[c.pid].ties].filter(x => x !== c.pid && pop.ageOn(x, d) >= 8);
    for (const y of circle) { const h = [10, 16.5, 8.5, 12, 18].find(x => awake(pop, y, d, x)); if (h === undefined) continue;
      out.push({ i: out.length, pid: y, job: pop.persons[y].job, day: d, hour: h, kind: 'heard', say: ['Have you heard anything of me, a foreigner?', 'Has anyone spoken to you of me?', 'What do people say of the stranger?'][c.i % 3], of: c.i }); break; }
  }
  return out;
}

export interface TalkScored { c: TalkCase; pass: boolean; why: string[]; reply: string; deed?: string; expect?: string[]; ms?: number; memory?: string[] }
/** a request's result */
export function scoreRequest(c: TalkCase, o: TurnOut, planHas: boolean): TalkScored {
  const why: string[] = []; const d = o.decision; const reply = o.answer.text;
  if (!o.answer.ok) why.push(`fence: ${o.answer.hits.map(h => h.kind + ':' + h.term).join(', ') || 'no answer'}`);
  if (!d) why.push('no decision: the ask was read by neither the grammar nor the tag');
  else if (d.ok && !d.noop && !planHas) why.push('the deed is not in the day plan');
  else if (!d.ok && /does not understand|does not know (the place|whom)/.test(d.reason)) why.push(`refused for want of understanding: ${d.reason}`);
  if (d) { const no = o.tag?.kind === 'refuse' || wordsRefuse(reply); if (d.ok && no) why.push('the words refuse what the day does'); if (!d.ok && !no) why.push('the words agree to what the simulation refused'); }
  return { c, pass: !why.length, why, reply, deed: d ? `${d.kind}${d.arg ? ':' + d.arg : ''} ${d.ok ? (d.noop ? 'ok (nothing to change)' : 'DONE') : 'refused'}: ${d.reason}` : 'none' };
}
/** the words a recall must name (from the recalled request's event in the save) */
export function recallExpect(ev: { kind: string; ok: boolean; arg?: string; item?: string; reason: string; other?: number } | null, name: (pid: number) => string, sourceName?: string): string[] {
  if (!ev) return [];
  const k: string[] = [];
  if (!ev.ok) k.push('would not|could not|cannot|refused|did not');
  else switch (ev.kind) {
    case 'follow': k.push('walk|came along|follow'); break;
    case 'lead_to': k.push(placeWords(ev.arg ?? '').replace(/^the /, '').replace(/ of the magi$/, '')); break;
    case 'fetch': k.push(ev.other !== undefined ? name(ev.other) : 'fetch'); break;
    case 'give': case 'trade': k.push(ev.item ?? 'gave'); break;
    case 'stop_work': k.push('stop'); break; case 'wait_here': k.push('wait'); break; case 'go_home': k.push('home'); break;
  }
  if (sourceName) k.push(sourceName);
  return k;
}
export function scoreRecall(c: TalkCase, o: TurnOut, expect: string[]): TalkScored {
  const why: string[] = []; const reply = o.answer.text;
  if (!o.answer.ok) why.push(`fence: ${o.answer.hits.map(h => h.kind + ':' + h.term).join(', ') || 'no answer'}`);
  if (!expect.length) why.push('nothing to recall (the request left no event)');
  const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const e of expect) if (!new RegExp(`(${plain(e)})`, 'i').test(plain(reply))) why.push(`does not recall: ${e}`);
  return { c, pass: !why.length, why, reply, expect };
}

/** the set run through a mind (the stand-in in node; the loaded model in the lab): the requests in one world, then the
 *  save reloaded into a fresh world (`make`) where the recalls are asked (a recall from the save, never from the same talk) */
export async function runTalkSet(mind: Mind, make: () => PeopleSim, set: TalkCase[], log?: (s: string) => void) {
  const sim = make(); const reqs = set.filter(c => c.kind !== 'recall' && c.kind !== 'heard'); const res: TalkScored[] = []; const out = new Map<number, TurnOut>();
  for (const c of reqs) { sim.jumpTo(c.day * 24 + c.hour); const o = await talkTurn(mind, sim, c.pid, c.say, { conv: sim.t }); out.set(c.i, o); mind.forget();
    const d = o.decision; const planHas = !!d && d.ok && !d.noop ? sim.pop.plan(c.pid, c.day).some(s => s.why === d.segs?.[0]?.why) : false;
    const r = scoreRequest(c, o, planHas); r.ms = o.answer.totalMs; res.push(r); log?.(`${c.i} ${c.kind} ${r.pass ? 'pass' : 'FAIL ' + r.why.join('; ')}`); }
  const saved = JSON.parse(JSON.stringify(sim.save())); const b = make(); b.load(saved);
  for (const r of res) { const d = out.get(r.c.i)!.decision; if (d?.ok && !d.noop && JSON.stringify(b.pop.plan(r.c.pid, r.c.day)) !== JSON.stringify(sim.pop.plan(r.c.pid, r.c.day))) { r.pass = false; r.why.push('the deed did not survive the reload'); } }
  for (const c of set.filter(x => x.kind === 'recall' || x.kind === 'heard')) {
    const src = reqs[c.of!]; const ev = out.get(src.i)?.decision?.event ?? null; b.jumpTo(c.day * 24 + c.hour);
    const o = await talkTurn(mind, b, c.pid, c.say, { conv: b.t }); mind.forget();
    const r = scoreRecall(c, o, recallExpect(ev, x => b.talk.name(x), c.kind === 'heard' ? b.talk.name(src.pid) : undefined)); r.ms = o.answer.totalMs; r.memory = o.memory; res.push(r); log?.(`${c.i} ${c.kind} ${r.pass ? 'pass' : 'FAIL ' + r.why.join('; ')}`);
  }
  const pass = res.filter(r => r.pass).length, value = +(100 * pass / Math.max(1, res.length)).toFixed(1);
  const by = (k: string) => { const x = res.filter(r => (r.c.kind === 'recall' || r.c.kind === 'heard' ? r.c.kind : 'request') === k); return [x.filter(r => r.pass).length, x.length]; };
  const kinds: Record<string, number[]> = {}; for (const r of res) { const k = r.c.kind; kinds[k] ??= [0, 0]; kinds[k][1]++; if (r.pass) kinds[k][0]++; }
  const done = res.filter(r => /DONE/.test(r.deed ?? '')).length, refused = res.filter(r => /refused/.test(r.deed ?? '')).length;
  return { res, pass, value, n: res.length, requests: by('request'), recalls: by('recall'), heard: by('heard'), kinds, deeds: { done, refused, noop: reqs.length - done - refused }, world: b };
}
