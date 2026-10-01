// s14 simtalk (D-358; UD-18, UD-21, UD-24, UD-25, UD-26; T-E9, T-E10, T-F9; B234): talking to people reaches the real
// simulation. On a day-300 save of seed 1 (tests/simtalk_world.ts: built once, cached by the content of src/people):
//   1. every conversation's grounding facts of means and standing come from the simulation (the economy's stores, prices,
//      debts and events; needs and open asks; relations; rumours; trust), and none is seeded (the D-296 seeded debts are gone);
//   2. a scripted set of 30 player interventions (buy, haggle, give, lend, petition, host, ask for help, offer work), spoken
//      to a person through talkTurn with the stand-in model, each decided by the house's own state, each changing the
//      simulation's state and joining a causal chain of >= 3 events across >= 2 households or systems (T-F9's definition);
//   3. T-E10 on those interventions (the deed, the recall the next day in the reloaded save, the hearsay of kin) and T-E9 on the
//      seeded set at day 300, with the stand-in (the plumbing: whether the simulation's facts reach the words; not a model).
// How this could pass while the intent fails (clause 1): (a) facts in the record that never reach the prompt (the short
// brief drops them) -> measured: the facts in the prompt and in the ground line, per case; (b) a deed that records an event
// but moves no state -> measured: the household's numbers before and after; (c) a chain joined by naming an arbitrary cause
// -> measured: the cause's kind (the want it answers, the matter before the judge, the stranger's own earlier deed), and a
// deed with no cause is reported as not in a chain; (d) the stand-in echoes the note -> the T-E9/T-E10 numbers are labelled
// plumbing, and the reply must name a fact of the person's own life (testset.ts groundedIn), not the note's words.
import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { Rng } from '../src/core/rng';
import { PeopleSim } from '../src/people/sim';
import { segAt } from '../src/people/population';
import type { Economy, EconEvent } from '../src/people/economy/world';
import { Mind } from '../src/people/converse/mind';
import { talkTurn, simView, type TurnOut } from '../src/people/converse/turn';
import { lifeRecord, lifeBriefShort, type LifeRecord } from '../src/people/converse/life';
import { systemPrompt, approxTokens, PROMPT_TOKENS } from '../src/people/converse/prompt';
import { econAskOf, requestOf, type EconDeed } from '../src/people/converse/intent';
import { buildTestSet, score } from '../src/people/converse/testset';
import { buildTalkSet } from '../src/people/converse/talkset';
import { fenceHits } from '../src/people/converse/fence';
import { dealsOf, considerDeed, actDeed, PlayerDeals } from '../src/people/speech/deeds';
import { standing, standingLines, PLAYER_ID } from '../src/people/speech/grounds';
import { standInEngine } from './talk_standin';
import { day300, navGrid, env, OPTS, DAY } from './simtalk_world';

/** the stand-in of tests/talk_standin.ts, reading also the closing note's one life fact (as run 5's real models were asked to:
 *  "Answer as X, from your own life: FACT"): a small obedient model says the fact in the first person */
function reader() {
  const e = standInEngine(); const inner = e.chat.completions.create;
  e.chat.completions.create = async (req: any) => {
    const r: any = await inner(req); if (req.stream) return r; const text: string = r.choices[0].message.content;
    const last: string = req.messages[req.messages.length - 1]?.content ?? ''; const f = /from your own life: (.*?)\.\)\s*$/.exec(last)?.[1];
    if (!f || !/^I am [^,]+, stranger\./.test(text)) return r;
    const first = f.replace(/\byour house\b/g, 'my house').replace(/\byour own house\b/g, 'my own house').replace(/\byour\b/g, 'my').replace(/\byou are\b/g, 'I am').replace(/\byou\b/g, 'I');
    return { choices: [{ message: { content: text.replace(/(stranger\.)\s.*?(\s*\[none\])$/, `$1 ${first.charAt(0).toUpperCase() + first.slice(1)}.$2`) } }] };
  };
  return e;
}
const mind = () => { const m = new Mind(); (m as any).engine = reader(); m.model = 'stand-in'; return m; };
/** the causal chains over a full event list indexed by id (economy/chains.ts's rule: the longest causal path into each leaf,
 *  >= 3 events, >= 2 actors; deduplicated by shape and leaf actor) */
function chainsById(events: EconEvent[]) {
  const byId = new Map<number, EconEvent>(); for (const e of events) if (e?.actor) byId.set(e.id, e);
  const hasChild = new Set<number>(); for (const e of byId.values()) for (const c of e.causes) hasChild.add(c);
  const best = new Map<number, number[]>(); const ids = [...byId.keys()].sort((a, b) => a - b);
  for (const id of ids) { const e = byId.get(id)!; let p: number[] = []; for (const c of e.causes) { const q = best.get(c); if (q && q.length > p.length) p = q; } best.set(id, [...p, id]); }
  const out: { leaf: number; path: number[]; shape: string; actors: string[] }[] = [], seen = new Set<string>();
  for (const id of ids) { if (hasChild.has(id)) continue; const path = best.get(id)!; if (path.length < 3) continue;
    const actors = [...new Set(path.flatMap(i => [byId.get(i)!.actor, ...(byId.get(i)!.other ? [byId.get(i)!.other!] : [])]))]; if (actors.length < 2) continue;
    const shape = path.map(i => byId.get(i)!.kind).join('>'); const key = `${shape}@${byId.get(id)!.actor}`; if (seen.has(key)) continue; seen.add(key); out.push({ leaf: id, path, shape, actors }); }
  return { chains: out, byId, best };
}
let commit = ''; try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* no git */ }
const EVID = 'REVIEWS/evidence/s14-simtalk'; mkdirSync(EVID, { recursive: true });

describe('the economy in the stranger\'s words (intent.ts econAskOf)', () => {
  it('reads buying, haggling, giving, lending, speaking for a house, being a guest, asking and offering help', () => {
    const T: [string, EconDeed | null, Partial<{ good: string; price: number }>?][] = [
      ['I want to buy a BAR of barley.', 'buy', { good: 'grain' }], ['Will you sell me some fuel?', 'buy', { good: 'fuel' }], ['How much for that cloth?', 'buy', { good: 'goods' }],
      ['I will pay a tenth of a sheqel for a BAR of barley.', 'haggle', { good: 'grain', price: 0.1 }], ['Would you take half a sheqel for it?', 'haggle', { price: 0.5 }],
      ['Let me give you a tenth of a sheqel for your children.', 'gift', { good: 'silver' }], ['Take this barley for your house.', 'gift', { good: 'grain' }],
      ['I can lend you half a sheqel.', 'lend'], ['I will speak for you before the judge.', 'petition'], ['May I eat with your family tonight?', 'host'],
      ['I have no food, help me please.', 'ask_help'], ['Can I help you? I will work for your house.', 'offer_help'], ['Will you buy my barley?', 'sell'],
      // the talk set's own asks stay the talk's (requestOf): trades of things, asks to give, the way, the work
      ['I will give you my bread for some water.', null], ['May I have some water?', null], ['I am thirsty.', null], ['Where is the well?', null], ['Could you spare some bread?', null], ['Who are you, friend?', null],
    ];
    for (const [s, k, x] of T) { const a = econAskOf(s); expect(a?.kind ?? null, s).toBe(k); if (x?.good) expect(a?.good, s).toBe(x.good); if (x?.price) expect(a?.price, s).toBeCloseTo(x.price, 3); }
  });
  it('none of the T-E10 talk set\'s phrasings is taken for the economy\'s business', () => {
    const S = new PeopleSim(1, navGrid(), env, { economy: false }); const set = buildTalkSet(S.pop, S.cal, 1, 64);
    for (const c of set) expect(econAskOf(c.say), c.say).toBeNull();
    expect(set.filter(c => c.kind === 'trade').every(c => requestOf(c.say)?.kind === 'trade')).toBe(true);
  }, 300_000);
});

describe('a day-300 save: talking reaches the real simulation', () => {
  let sim: PeopleSim; let E: Economy; let full: () => EconEvent[]; let nEv0 = 0; let built = false; let loadMs = 0;
  const pickAdults = (n: number, seed: string, ok: (pid: number) => boolean = () => true) => { const r = new Rng(7, seed); const out: number[] = []; const P = sim.pop;
    for (let g = 0; out.length < n && g < n * 400; g++) { const pid = Math.floor(r.next() * P.persons.length); if (out.includes(pid) || !P.present(pid, DAY) || P.ageOn(pid, DAY) < 16) continue;
      const H = P.households[P.home(pid, DAY)]; if (H.zone === 'transient' || H.zone === 'terrace') continue; if (!ok(pid)) continue; out.push(pid); } return out; };
  beforeAll(() => { const W = day300(); sim = W.sim; built = W.built; loadMs = W.ms; full = W.events; E = sim.econTo(DAY); nEv0 = E.events.length; }, 3_600_000);

  it('every grounding fact of means and standing is the simulation\'s; none is seeded; the facts reach the prompt within budget', () => {
    const V = { ...simView(sim, DAY), bonds: sim.bonds }; sim.bonds.advance(DAY);
    const ids = pickAdults(300, 'simtalk.ground'); const rows: any[] = []; let fakes = 0, inPrompt = 0, withFacts = 0; const maxTok: number[] = [];
    for (const pid of ids) {
      const L = lifeRecord(sim.pop, sim.cal, pid, DAY, 10, V), bare = lifeRecord(sim.pop, sim.cal, pid, DAY, 10);
      if (bare.debts.length) fakes++; // without the simulation there are no debts at all: nothing invented
      const hh = `h:${sim.pop.home(pid, DAY)}`, h = E.hh.get(hh);
      // the debts are exactly the economy's (owed by the house, and owed to it), named by the other house's head
      const owes = h ? h.debts.filter(d => d.amt > 0.004).length : 0; let owed = 0; for (const o of E.hh.values()) if (o !== h) for (const d of o.debts) if (d.to === hh && d.amt > 0.004) owed++;
      expect(L.debts.length, `${pid}`).toBe(Math.min(4, owes + owed));
      if (h) { expect(L.means.length).toBe(2); expect(L.means[0]).toMatch(/barley|no barley/); }
      const S = standing(V, pid, DAY); for (const l of standingLines(S)) expect(fenceHits(l), l).toEqual([]);
      const facts = [...L.means, ...L.debts, ...L.needs, ...L.dealings, ...L.rumours, ...L.bonds]; if (facts.length) withFacts++;
      const sp = systemPrompt(L, 'none', null, ['Yesterday in the morning this same stranger spoke with you. He said: “Can you show me the way to the well?”. You showed him the way to the well.']); maxTok.push(approxTokens(sp));
      if (facts.some(f => sp.includes(f.split(/[;(]/)[0].trim().slice(0, 30)))) inPrompt++;
      rows.push({ pid, job: sim.pop.persons[pid].job, debts: L.debts.length, means: L.means.length, needs: L.needs.length, rumours: L.rumours.length, bonds: L.bonds.length, dealings: L.dealings.length, trust: +L.trust.toFixed(3) });
    }
    const n = rows.length, share = (k: string) => +(100 * rows.filter(r => r[k] > 0).length / n).toFixed(1);
    const ev = { id: 'simtalk-grounding', commit, tool: 'tests/simtalk.test.ts', day: DAY, seed: 1, n, seededFakes: fakes, withSimFacts: withFacts, factsInPrompt: inPrompt, maxPromptTokens: Math.max(...maxTok),
      share: { debts: share('debts'), means: share('means'), needs: share('needs'), rumours: share('rumours'), bonds: share('bonds'), dealings: share('dealings') }, cache: { built, loadMs: Math.round(loadMs) },
      sample: rows.slice(0, 10), briefSample: lifeBriefShort(lifeRecord(sim.pop, sim.cal, ids.find(p => lifeRecord(sim.pop, sim.cal, p, DAY, 10, V).debts.length) ?? ids[0], DAY, 10, V)) };
    writeFileSync(`${EVID}/grounding.json`, JSON.stringify(ev, null, 1)); console.log(JSON.stringify({ ...ev, sample: undefined }));
    expect(fakes).toBe(0); expect(Math.max(...maxTok)).toBeLessThanOrEqual(PROMPT_TOKENS); expect(withFacts).toBe(n); expect(inPrompt / n).toBeGreaterThan(0.9);
  }, 600_000);

  // ---------------------------------------------------------------------------------------------- the 30 interventions
  type Case = { i: number; kind: EconDeed; pid: number; say: string; t: number };
  const res: { c: Case; o: TurnOut; before: Record<string, number>; after: Record<string, number>; events: number[] }[] = [];
  it('30 scripted interventions each change the simulation\'s state and join a causal chain (T-F9)', async () => {
    const P = sim.pop, hhOf = (pid: number) => `h:${P.home(pid, DAY)}`, H = (pid: number) => E.hh.get(hhOf(pid))!;
    const need = (pid: number, k: string) => E.needsOf(hhOf(pid)).find(n => n.kind === k)?.urgency ?? 0;
    const spare = (pid: number) => { const h = H(pid); return h ? h.grain - h.eaters * 0.55 * 30 : 0; };
    const awake = (pid: number, h: number) => { const s = segAt(P.plan(pid, DAY), h); return s.act !== 'sleep' && s.where !== 'away'; };
    const has = (pid: number) => !!H(pid) && !H(pid).dead && awake(pid, 11);
    const DW = { pop: P, econ: E, asks: sim.asksWorld }; const matter = (pid: number) => considerDeed(DW, new PlayerDeals(), pid, DAY, { kind: 'petition', words: '' }).ok;
    const cashCause = (pid: number) => H(pid).cause.cash !== undefined;
    // the haggler's offer: the smallest of the words for silver at or above nine tenths of the market's price of a BAR
    const ref = E.price('grain', DAY) * 5.5; const offer = ([[0.1, 'a tenth of a sheqel'], [0.25, 'a quarter of a sheqel'], [1 / 3, 'a third of a sheqel'], [0.5, 'half a sheqel'], [1, 'a sheqel']] as [number, string][]).find(([v]) => v >= 0.92 * ref)?.[1] ?? '2 sheqel';
    // the targets: people a stranger would approach for each (a house with barley to sell, one in want, one before the judge),
    // drawn in a seeded order, one per house (never chosen by hand)
    const used = new Set<string>(); const take = (n: number, seed: string, ok: (pid: number) => boolean) => { const out = pickAdults(n, seed, p => has(p) && !used.has(hhOf(p)) && ok(p)); out.forEach(p => used.add(hhOf(p))); return out; };
    const plan: [EconDeed, number, (p: number) => boolean, (p: number) => string][] = [
      ['buy', 5, p => spare(p) > 12 && cashCause(p), () => 'I want to buy a BAR of barley.'],
      ['haggle', 4, p => spare(p) > 12 && cashCause(p), () => `I will pay ${offer} for a BAR of barley.`],
      ['gift', 5, p => need(p, 'food') >= 0.3 || need(p, 'cash') >= 0.4, p => need(p, 'food') >= 0.3 ? 'Take this barley for your house.' : 'Let me give you a tenth of a sheqel for your children.'],
      ['lend', 4, p => need(p, 'cash') >= 0.4 && E.hh.get(hhOf(p))!.cause.cash !== undefined, () => 'I can lend you a third of a sheqel.'],
      ['petition', 4, p => matter(p), () => 'I will speak for you before the judge.'],
      ['offer_help', 2, p => need(p, 'help') >= 0.3 || need(p, 'food') >= 0.45, () => 'Can I help you? I will work for your house.'],
    ];
    const cases: Case[] = []; let t = DAY * 24 + 10.5;
    for (const [kind, n, ok, say] of plan) for (const pid of take(n, `simtalk.${kind}`, ok)) cases.push({ i: cases.length, kind, pid, say: say(pid), t: (t += 0.08) });
    // (hospitality and help for the road are asked later of houses the stranger has dealt with: the meal a bargain or a gift
    // is returned with; the same person, an hour on)
    t += 1; for (const c of cases.filter(c => c.kind === 'buy').slice(0, 4)) cases.push({ i: cases.length, kind: 'host', pid: c.pid, say: 'May I eat with your family tonight?', t: (t += 0.08) });
    for (const c of cases.filter(c => c.kind === 'haggle').slice(0, 2)) cases.push({ i: cases.length, kind: 'ask_help', pid: c.pid, say: 'I have no food, help me please.', t: (t += 0.08) });
    expect(cases.length).toBe(30);
    const m = mind(); const snap = (pid: number) => { const h = H(pid) as any; return { grain: +h.grain.toFixed(3), cash: +h.cash.toFixed(4), fuel: +h.fuel.toFixed(2), goods: h.goods, advocate: h.advocate ?? -1, debts: h.debts.reduce((a: number, d: any) => a + d.amt, 0), trust: +(E.trust!.trustOf(hhOf(pid), PLAYER_ID, DAY)).toFixed(4) }; };
    for (const c of cases) { sim.jumpTo(c.t); const before = snap(c.pid), n0 = E.events.length; const o = await talkTurn(m, sim, c.pid, c.say, { conv: sim.t }); m.forget();
      const events: number[] = []; for (let k = n0; k < E.events.length; k++) if (E.events[k]?.actor) events.push(k); res.push({ c, o, before, after: snap(c.pid), events }); }
    // the economy goes on 20 days: what the deeds changed runs on in its own rules
    sim.econTo(DAY + 20);
    const all = [...full().slice(0, nEv0), ...E.events.slice(nEv0)]; const { chains, best, byId } = chainsById(all);
    const onPath = new Set<number>(); for (const ch of chains) for (const id of ch.path) onPath.add(id);
    // a deed is in a chain when one of its events is on a counted chain's path (the deed is itself a leaf, or a later event
    // of the economy names it as a cause)
    const rows = res.map(r => { const d = r.o.econ?.deed; const changed = Object.keys(r.before).filter(k => k !== 'trust' && (r.before as any)[k] !== (r.after as any)[k]);
      const inChain = r.events.some(id => onPath.has(id)); const depth = Math.max(0, ...r.events.map(id => best.get(id)?.length ?? 0));
      const later = all.filter(e => e && e.id >= nEv0 && e.causes.some(c => r.events.includes(c))).map(e => e.kind);
      return { i: r.c.i, kind: r.c.kind, pid: r.c.pid, job: sim.pop.persons[r.c.pid].job, say: r.c.say, ok: !!d?.ok, reason: d?.reason ?? 'no economy ask read', cause: d?.cause ?? -1, causeKind: d?.causeKind ?? 'none',
        causeEv: d && d.cause >= 0 ? byId.get(d.cause)?.kind : null, changed, trust: [r.before.trust, r.after.trust], events: r.events.map(id => byId.get(id)?.kind), inChain, depth, later, reply: r.o.answer.text,
        shape: r.events.map(id => best.get(id)).filter(Boolean).map(p => p!.map(i => byId.get(i)!.kind).join('>'))[0] ?? '' }; });
    const okN = rows.filter(r => r.ok).length, changedN = rows.filter(r => r.ok && r.changed.length).length, chainN = rows.filter(r => r.inChain).length;
    const purse = dealsOf(sim).purse;
    const ev = { id: 'simtalk-interventions', commit, tool: 'tests/simtalk.test.ts', day: DAY, seed: 1, n: rows.length, done: okN, stateChanged: changedN, inChain: chainN, enterableShare: +(100 * chainN / rows.length).toFixed(1),
      causeKinds: rows.reduce((a: any, r) => { a[r.causeKind] = (a[r.causeKind] ?? 0) + 1; return a; }, {}), chainsAfter20Days: chains.filter(c => c.leaf >= nEv0).length, purse, rows,
      note: 'Each intervention is said to a person (talkTurn, stand-in model); the house decides from its own state (speech/deeds.ts) and a yes enters the economy with the player as a party. In a chain: an event of the deed lies on a counted T-F9 chain (>= 3 causally linked events, >= 2 actors) over the full event graph after 20 more days. The targets are drawn in a seeded order among houses a stranger would approach for that deed (a house with barley to spare for a purchase, one in want for a gift), never chosen by hand.' };
    writeFileSync(`${EVID}/interventions.json`, JSON.stringify(ev, null, 1)); console.log(JSON.stringify({ ...ev, rows: undefined })); for (const r of rows.filter(r => !r.ok || !r.inChain)) console.log(JSON.stringify(r));
    expect(okN).toBeGreaterThanOrEqual(27); expect(changedN).toBe(okN); expect(chainN).toBeGreaterThanOrEqual(27);
  }, 900_000);

  it('T-E10 (stand-in): the deeds, recalled the next day from the reloaded save and heard of by kin; T-E9 (stand-in) at day 300', async () => {
    expect(res.length).toBe(30);
    const saved = JSON.parse(JSON.stringify(sim.save())); const b = new PeopleSim(1, navGrid(), env, OPTS); b.load(saved);
    expect(dealsOf(b).purse).toEqual(dealsOf(sim).purse); expect(dealsOf(b).rows.length).toBe(dealsOf(sim).rows.length);
    const Eb = b.econTo(DAY + 20); for (const r of res) { const hh = `h:${sim.pop.home(r.c.pid, DAY)}`; expect(Eb.hh.get(hh)!.grain).toBeCloseTo(E.hh.get(hh)!.grain, 3); expect(Eb.hh.get(hh)!.cash).toBeCloseTo(E.hh.get(hh)!.cash, 4); }
    const m = mind(); const W: Record<EconDeed, RegExp> = { buy: /barley|bargain|sold|silver/i, haggle: /barley|bargain|sold|silver/i, sell: /barley|bought/i, gift: /gave|gift|barley|silver/i, lend: /lent|loan|silver/i,
      petition: /judge|spoke for|speak for|court/i, host: /meal|eat|ate|supper/i, ask_help: /barley|gave|road/i, offer_help: /work|worked/i };
    const scored: { kind: string; deed: string; pass: boolean; why: string[]; reply: string }[] = [];
    // the requests: done through the simulation (or refused for the house's own reason) and the words agree
    for (const r of res) { const d = r.o.econ?.deed; const why: string[] = []; if (!d) why.push('not read'); if (!r.o.answer.ok) why.push('fenced');
      const no = /\b(no|cannot|can't|will not|won't)\b/i.test(r.o.answer.text); if (d?.ok && no) why.push('words refuse the deed'); if (d && !d.ok && !no) why.push('words agree to a refusal');
      scored.push({ kind: 'request', deed: r.c.kind, pass: !why.length, why, reply: r.o.answer.text }); }
    // the recall: the next day, the same person, in the reloaded save
    for (const r of res) { const hs = [10, 11.5, 16.5, 9, 18].find(h => { const s = segAt(b.pop.plan(r.c.pid, DAY + 1), h); return s.act !== 'sleep' && s.where !== 'away'; }); if (hs === undefined) continue;
      b.jumpTo((DAY + 1) * 24 + hs); const o = await talkTurn(m, b, r.c.pid, 'Do you remember me, friend? What did I ask of you?', { conv: b.t }); m.forget();
      const why: string[] = []; if (!o.answer.ok) why.push('fenced'); if (!W[r.c.kind].test(o.answer.text) && !(r.o.econ?.deed && !r.o.econ.deed.ok && /would not|could not|refused|no/i.test(o.answer.text))) why.push('does not recall it'); if (/never met|do not know you|don't know you/i.test(o.answer.text)) why.push('denies');
      scored.push({ kind: 'recall', deed: r.c.kind, pass: !why.length, why, reply: o.answer.text }); }
    // hearsay: someone of the house three days later
    for (const r of res.filter((_, k) => k % 2 === 0)) { const hh = b.pop.home(r.c.pid, DAY); const y = b.pop.membersOn(hh, DAY + 3).find(x => x !== r.c.pid && b.pop.ageOn(x, DAY + 3) >= 10 && b.pop.present(x, DAY + 3)); if (y === undefined) continue;
      const hs = [10, 16.5, 8.5, 12, 18].find(h => { const s = segAt(b.pop.plan(y, DAY + 3), h); return s.act !== 'sleep' && s.where !== 'away'; }); if (hs === undefined) continue;
      b.jumpTo((DAY + 3) * 24 + hs); const o = await talkTurn(m, b, y, 'Have you heard anything of me, a foreigner?', { conv: b.t }); m.forget();
      const why: string[] = []; if (!o.answer.ok) why.push('fenced'); if (!W[r.c.kind].test(o.answer.text) && !/told me|heard/i.test(o.answer.text)) why.push('has not heard'); if (/nobody has spoken|never met you/i.test(o.answer.text) && !W[r.c.kind].test(o.answer.text)) why.push('denies');
      scored.push({ kind: 'heard', deed: r.c.kind, pass: !why.length, why, reply: o.answer.text }); }
    const pass = scored.filter(s => s.pass).length, te10 = +(100 * pass / scored.length).toFixed(1);
    // T-E9: the seeded set, asked at day 300 (each case's person and hour; a person asleep or away then is skipped)
    const T = buildTestSet(b.pop, 1, 72); const t9: any[] = []; let hourT = (DAY + 4) * 24 + 5;
    const cases = T.map(c => ({ ...c, day: DAY + 4 })).filter(c => { if (!b.pop.present(c.pid, c.day)) return false; const s = segAt(b.pop.plan(c.pid, c.day), c.hour); return s.act !== 'sleep' && s.where !== 'away'; }).sort((a, z) => a.hour - z.hour);
    for (const c of cases) { hourT = Math.max(hourT, c.day * 24 + c.hour); b.jumpTo(hourT); const o = await talkTurn(m, b, c.pid, c.prompt, { conv: b.t }); m.forget();
      const L = lifeRecord(b.pop, b.cal, c.pid, c.day, b.t - c.day * 24, simView(b, c.day)); const s = score(c, L, o.answer.text, o.answer.totalMs, o.answer.ttftMs, o.answer.tries, o.answer.ok); t9.push({ ...s, means: /owe|silver|barley|BAR|house/.test(o.answer.text) }); }
    // the means questions: the house's debts, prices, wants and hearsay asked of the same people (grounded in the sim's facts)
    const MQ = ['Do you owe anyone?', 'Is barley dear at the market?', 'Does your house need anything?', 'What have you heard lately?'];
    const mq: any[] = []; for (const [k, c] of cases.slice(0, 32).entries()) { b.jumpTo(Math.max(b.t + 0.02, c.day * 24 + c.hour)); const q = MQ[k % MQ.length]; const o = await talkTurn(m, b, c.pid, q, { conv: b.t }); m.forget();
      const L = lifeRecord(b.pop, b.cal, c.pid, c.day, b.t - c.day * 24, simView(b, c.day)); const facts = [...L.debts, ...L.means, ...L.needs, ...L.rumours, ...L.dealings];
      const named = facts.some(f => { const w = f.toLowerCase().split(/[^a-z’]+/).filter(x => x.length >= 5 && !['house', 'which', 'there'].includes(x)); return w.filter(x => o.answer.text.toLowerCase().includes(x)).length >= 2; });
      mq.push({ q, pid: c.pid, reply: o.answer.text, pass: o.answer.ok && named && !fenceHits(o.answer.text).length }); }
    const t9pass = t9.filter(s => s.pass).length, te9 = +(100 * t9pass / t9.length).toFixed(1), mqv = +(100 * mq.filter(x => x.pass).length / mq.length).toFixed(1);
    const ev10 = { id: 'T-E10', scope: 'simtalk: economy deeds at day 300', value: te10, n: scored.length, commit, tool: 'tests/simtalk.test.ts', status: 'PLUMBING (stand-in model; the real model unmeasured)', model: 'stand-in (tests/talk_standin.ts + the closing note read)',
      by: ['request', 'recall', 'heard'].map(k => [k, scored.filter(s => s.kind === k && s.pass).length, scored.filter(s => s.kind === k).length]), fails: scored.filter(s => !s.pass) };
    const ev9 = { id: 'T-E9', scope: 'simtalk: the seeded set at day 300 with the simulation\'s means', value: te9, n: t9.length, commit, tool: 'tests/simtalk.test.ts', status: 'PLUMBING (stand-in model; the real model unmeasured)',
      meansQuestions: { value: mqv, n: mq.length, fails: mq.filter(x => !x.pass).slice(0, 8) }, fails: t9.filter(s => !s.pass).map(s => ({ kind: s.kind, job: s.job, prompt: s.prompt, reply: s.reply, why: s.why })).slice(0, 20) };
    writeFileSync(`${EVID}/T-E10.json`, JSON.stringify(ev10, null, 1)); writeFileSync(`${EVID}/T-E9.json`, JSON.stringify(ev9, null, 1));
    console.log(JSON.stringify({ te10, n10: scored.length, by: ev10.by, te9, n9: t9.length, means: mqv }));
    for (const f of ev10.fails.slice(0, 10)) console.log('E10', JSON.stringify(f)); for (const f of ev9.fails.slice(0, 10)) console.log('E9', JSON.stringify(f));
    expect(te10).toBeGreaterThanOrEqual(90); expect(te9).toBeGreaterThanOrEqual(95); expect(mqv).toBeGreaterThanOrEqual(90);
  }, 1_800_000);
});
