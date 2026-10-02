// QA: a stranger arrives on day 20 and lives a year through talk alone, on a cached world with the deterministic
// stand-in model (tests/talk_standin.ts). Each day at a few hours, near people found from the plans (at home or at work at
// that hour), the stranger says what a curious player would; attendance at work goes through sim.strangerNear; the sim is
// stepped day by day. Every turn is logged (who, the life record's key lines, the sandbox verdict and what was done, the
// stand-in's words, what the model was told), then the log is audited for breaks of the illusion or the simulation.
// D-462: free speech too: the stranger proposes undertakings (a hunt, fishing, a drink, a roof, a lesson, a hire, an errand,
// a meeting) and goes to them as a player would (most of the time: FORGET of them he forgets), so a year of joint deeds is
// measured: kept and missed, the catch, the roofs, the skills and what they earned him, the silver paid to the hired.
// Run: npx tsx tools/dev/playtest_year.ts [seed=1] [days=355]   (out: .cache/playtest/year-<seed>.jsonl and -audit.json)
import { mkdirSync, writeFileSync } from 'node:fs';
import { simAt } from '../../tests/sim_fixture';
import { standInEngine } from '../../tests/talk_standin';
import { Mind } from '../../src/people/converse/mind';
import { talkTurn } from '../../src/people/converse/turn';
import { lifeRecord } from '../../src/people/converse/life';
import { Approaches } from '../../src/people/converse/approach';
import { segAt } from '../../src/people/population';
import { VERBS as VERBS_ } from '../../src/people/deeds/verbs';

const seed = Number(process.argv[2] ?? 1), DAYS = Number(process.argv[3] ?? 355), D0 = 20;
const HOURS = [8, 10.5, 13, 16, 18.5];
/** D-462: the share of his undertakings the stranger forgets (the missed meetings are measured too) */
const FORGET = 0.15;
const FREE = ['Let\'s go hunting tomorrow morning.', 'Come fishing with me tomorrow at dawn.', 'Come and drink beer with me tonight.', 'Let me help you fix your roof.', 'Teach me to weave.', 'Show me how you make pots.',
  'Let me help you with your work.', 'Be my porter for a day, I will pay you.', 'Be my guide for two days, I will pay you.', 'Go and tell your friend that I thank him.', 'Bring your friend here to me.', 'Fetch me some bread.',
  'Meet me here tomorrow.', 'Let us make an offering together.', 'Let us walk together.', 'Eat with me, share my bread.', 'May I visit you at your house this evening?'] as const;
const sim = simAt(seed, D0, 7, { asks: true });
const mind = new Mind(); const eng = standInEngine(); (mind as any).engine = eng; mind.model = 'stand-in';
const appr = new Approaches(sim);
const log: any[] = [], days: any[] = [];
let rs = seed * 9973 + 17; const rnd = () => ((rs = (rs * 1103515245 + 12345) >>> 0) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const P = sim.pop;
const hhOf = (pid: number, d: number) => `h:${P.home(pid, d)}`;
const met = new Set<number>(); let lastEmployer: string | null = null; const formerEmployers = new Set<string>();
const MODERN = /\b(ok|okay|km|kilomet|metres?|meters?|percent|%|dollars?|euro|police|gun|phone|car|money|stranger's tongue|economy|simulation|verdict|player|npc|household id|h:\d+)\b/i;

const dayPick = { d: -1, plans: new Map<number, any[]>() };
function candidates(d: number, hour: number) {
  const E = sim.econTo(d), home: number[] = [], work: number[] = [], market: number[] = [];
  if (dayPick.d !== d) { dayPick.d = d; dayPick.plans.clear(); let k = 0;
    while (dayPick.plans.size < 220 && k++ < 5000) { const p = P.persons[Math.floor(rnd() * P.persons.length)];
      if (!P.present(p.id, d) || P.ageOn(p.id, d) < 14 || p.dies <= d || !E.hh.has(hhOf(p.id, d))) continue; dayPick.plans.set(p.id, P.plan(p.id, d)); }
    // the employer's and host's people are near too (the stranger lives among them)
    const S = E.stranger(); for (const h of [S.job?.employer, S.stay?.host]) if (h) for (const m of P.households[Number(h.slice(2))].members) if (P.present(m, d) && P.ageOn(m, d) >= 14) dayPick.plans.set(m, P.plan(m, d)); }
  for (const [id, plan] of dayPick.plans) { const p = P.persons[id];
    const s = segAt(plan, hour); if (!s || s.where === 'away' || s.where === 'road') continue;
    if (/^market:/.test(s.place)) market.push(p.id); // (D-455: the people on the market ground now: the stalls)
    if (/home|house|hearth|courtyard/.test(s.place) || ['rest', 'eat', 'cook', 'spin', 'grind', 'bake', 'clean', 'tend_body', 'wash'].includes(s.act)) home.push(p.id); else work.push(p.id);
  }
  return { home, work, market };
}
/** what a curious player says to this person now */
function lines(pid: number, d: number, hour: number): string[] {
  const S = sim.econTo(d).stranger(), first = !met.has(pid), job = P.persons[pid].job, out: string[] = [];
  if (first) out.push(pick(['Greetings, friend.', 'Good morning to you.', 'Peace be on your house.']));
  const r = rnd();
  if (d === D0 && log.length < 3) out.push('I am a merchant from Babylon.');
  else if (!S.job && !S.group && r < 0.25 && hour < 15) out.push(pick(['Could I work for you?', 'Do you need a hand?', 'I am looking for work.']));
  else if (!S.stay && hour >= 16 && r < 0.45) out.push(pick(['May I stay the night with you?', 'Can you put me up?']));
  else if (r < 0.50) out.push(rnd() < 0.3 ? pick(FREE) : 'Where are you from?');
  else if (r < 0.55) out.push('Sell me two measures of barley.');
  else if (r < 0.60) out.push(pick(['Take this silver.', 'Take these 2 shekels.']));
  else if (r < 0.64) out.push('He owes me my wages.');
  else if (r < 0.67) out.push('I need papers to stay.');
  else if (r < 0.72) out.push('Teach me your word for bread.');
  else if (r < 0.75) out.push('Everyone listen! I am a merchant from Babylon.');
  else if (r < 0.82) out.push(rnd() < 0.7 ? pick(FREE) : 'Can I help you?');
  else if (r < 0.92) out.push('What have you heard?');
  else if (r < 0.95 && S.stay) out.push('Thank you for your hospitality.');
  else if (r < 0.97 && (job === 'builder' || job === 'porter')) out.push('Put me on the ration list.');
  else out.push('Do you remember me?');
  return out;
}
const short = (L: any) => ({ name: L.name, job: L.job, now: L.today?.now, needs: L.needs, news: L.news, worries: L.worries?.slice(0, 2), debts: L.debts?.slice(0, 2), year: L.year?.slice(-2) });

async function turn(d: number, hour: number, pid: number, said: string, why: string) {
  const E = sim.econTo(d), S = E.stranger(), hh = hhOf(pid, d), H = E.hh.get(hh);
  const before = { cash: S.purse.cash, grain: S.purse.grain, job: S.job?.employer ?? null, stay: S.stay?.host ?? null, group: S.group ? `${S.group.kind}:${S.group.id}` : null, halmi: S.halmi, trust: E.trust ? +E.trust.trustOf(hh, 'player', d).toFixed(3) : null };
  const facts = S.factsFor(hh, d); const n0 = eng.calls.length;
  const L = lifeRecord(P, sim.cal, pid, d, hour);
  const tq = Date.now(); const o = await talkTurn(mind, sim, pid, said, { conv: sim.t }); TM.talk += Date.now() - tq;
  met.add(pid);
  const calls = eng.calls.slice(n0); const prompts = calls.map(c => c.slice(1).map(m => m.content).join('\n---\n'));
  const sys = calls[0]?.[0]?.content ?? '';
  const after = { cash: S.purse.cash, grain: S.purse.grain, job: S.job?.employer ?? null, stay: S.stay?.host ?? null, group: S.group ? `${S.group.kind}:${S.group.id}` : null, halmi: S.halmi };
  const row: any = { day: d, hour, pid, hh, hhKind: H?.kind, hhDead: !!H?.dead, alive: P.persons[pid].dies > d && P.present(pid, d), why, said, life: short(L), facts,
    sandbox: o.sandbox ? { act: o.sandbox.act, verdict: o.sandbox.verdict, done: o.sandbox.done } : null,
    request: o.request, tag: o.tag, decision: o.decision ? { kind: o.decision.kind, ok: o.decision.ok, reason: o.decision.reason, noop: (o.decision as any).noop } : null,
    sysLen: sys.length, sysHead: log.length % 40 === 0 ? sys : undefined, sysDigits: (sys.replace(/\b(?:of|aged?|\()\s?\d{1,2}\b|year \d+ of King|\d{1,2}\)/g, '').match(/[^\n]{0,30}\d[^\n]{0,20}/g) ?? []).slice(0, 3), refused: o.refused ?? null, saidNo: o.saidNo, answer: o.answer.text, before, after, prompts };
  if (o.deed) row.deed = { verb: o.deed.deed.verb, act: o.deed.deed.act, out: { ok: o.deed.out.ok, why: o.deed.out.why, say: o.deed.out.say, refused: o.deed.out.refused }, done: !!o.deed.done?.out.ok };
  log.push(row); if (S.job) lastEmployer = S.job.employer; return row;
}

const TM = { jump: 0, econ: 0, cand: 0, talk: 0 };
// D-462: time goes forward through the stranger's undertakings: before each jump he goes to those of them that fall before it
// (stands among the people of each at its middle hour), unless he forgot it
const kept = new Set<number>(), forgot = new Set<number>();
function goTo(t: number) {
  const J = sim.deeds.joint, due = J.jobs.filter(j => j.actor === 'player' && j.state === 'set' && !kept.has(j.id) && !forgot.has(j.id) && j.day * 24 + (j.h0 + j.h1) / 2 < t && j.day * 24 + (j.h0 + j.h1) / 2 > sim.t).sort((a, b) => a.h0 - b.h0);
  for (const j of due) { if (rnd() < FORGET && j.kind !== 'errand') { forgot.add(j.id); continue; } kept.add(j.id); sim.jumpTo(j.day * 24 + (j.h0 + j.h1) / 2); sim.strangerNear([j.target, ...(j.third !== undefined ? [j.third] : [])], 0.25); }
  sim.jumpTo(t);
}
const MK: Record<string, { tried: number; found: number; days: Set<number>; foundDays: Set<number>; people: number }> = {};
const end = D0 + DAYS; const t0 = Date.now();
for (let d = D0; d < end; d++) {
  for (const hour of HOURS) {
    let tt = Date.now(); goTo(d * 24 + hour); TM.jump += Date.now() - tt; tt = Date.now(); const E = sim.econTo(d), S = E.stranger();
    TM.econ += Date.now() - tt; tt = Date.now(); const { home, work, market } = candidates(d, hour); TM.cand += Date.now() - tt; tt = Date.now();
    // at work: two hours beside the employer's people (or the gang, the house joined)
    if (S.job || S.group) { const want = S.job?.employer ?? (S.group?.kind === 'household' ? S.group.id : null);
      const mates = want ? P.households[Number(want.slice(2))].members.filter(m => P.present(m, d)) : P.persons.filter(p => p.job === (S.group?.kind === 'gang' ? 'builder' : 'traveller') && P.present(p.id, d)).slice(0, 5).map(p => p.id);
      if (hour >= 8 && hour <= 13) for (let k = 0; k < 9; k++) sim.strangerNear(mates, 0.25); }
    // D-455: the stranger's living as a player would make it: a day's carrying at the market when he has no work (hours among
    // the market's people are the work), grain sold at the stalls, bread bought there when his sack is empty
    // (D-458: the market wanted at this hour, and whether anyone of the sample stood on a market ground: the bot's market days)
    { const want = hour === 8 && !S.job && !S.group && !S.dayHire?.paid ? 'daywork' : hour === 13 && S.purse.grain >= 25 ? 'sell' : hour === 10.5 && S.purse.grain < 2 && !S.stay && !S.group ? 'buy' : null;
      if (hour === 8 || hour === 10.5 || hour === 13) { const a = MK[`at ${hour}`] ??= { tried: 0, found: 0, days: new Set<number>(), foundDays: new Set<number>(), people: 0 }; a.tried++; a.days.add(d); a.people += market.length; if (market.length) { a.found++; a.foundDays.add(d); } }
      if (want) { const m = MK[want] ??= { tried: 0, found: 0, days: new Set<number>(), foundDays: new Set<number>(), people: 0 }; m.tried++; m.days.add(d); m.people += market.length; if (market.length) { m.found++; m.foundDays.add(d); } } }
    if (market.length) {
      if (hour === 8 && !S.job && !S.group && !S.dayHire?.paid) await turn(d, hour, pick(market), 'Is there work for today? I can carry loads.', 'daywork');
      if (S.dayHire?.day === d && !S.dayHire.paid && hour <= 16) for (let k = 0; k < 9; k++) sim.strangerNear(market, 0.25);
      if (hour === 13 && S.purse.grain >= 25) await turn(d, hour, pick(market), 'Will you buy my grain? I have two measures to sell.', 'sell-market');
      if (hour === 10.5 && S.purse.grain < 2 && !S.stay && !S.group) await turn(d, hour, pick(market), 'Sell me four loaves of bread.', 'buy-market');
    }
    // someone may come up to the stranger
    const near = [...home, ...work].filter(() => rnd() < 0.05);
    const ap = appr.next(near, sim.t);
    if (ap) { const r = await turn(d, hour, ap.pid, ap.kind === 'invite' ? 'Yes, I will eat with you. May I stay the night with you?' : 'Yes, I will help you. Take this silver.', `approach:${ap.kind}:${ap.ask?.kind ?? ''}`); r.approach = { kind: ap.kind, opening: ap.opening, ask: ap.ask?.kind ?? null, trust: ap.trust }; }
    // the stranger's own talk: one person at home and/or one at work
    const pool = hour < 16 ? [pick(work), rnd() < 0.5 ? pick(home) : undefined] : [pick(home)];
    for (const pid of pool) { if (pid === undefined) continue;
      for (const said of lines(pid, d, hour)) {
        if (/^Everyone listen/.test(said)) { const grp = [...home, ...work].filter(x => x !== pid).slice(0, 8).concat(pid); const g = sim.strangerAskGroup(grp, said.replace(/^Everyone listen! /, ''));
          for (const x of g) sim.strangerDo(x.act); log.push({ day: d, hour, pid, hh: hhOf(pid, d), why: 'group', said, group: g.map(x => ({ pid: x.pid, a: x.act.a, ok: x.verdict.ok, why: x.verdict.why })) }); continue; }
        await turn(d, hour, pid, said, hour < 16 ? 'at work' : 'at home');
      }
    }
    // selling: once a day, the stranger offers grain to the house nearby that is shortest of it
    if (hour === 13 && S.purse.grain >= 20) { const poor = [...home, ...work].map(p => ({ p, H: E.hh.get(hhOf(p, d)) })).filter(x => x.H).sort((a, b) => a.H!.grain / a.H!.eaters - b.H!.grain / b.H!.eaters)[0];
      if (poor) await turn(d, hour, poor.p, 'Will you buy my grain? I have two measures to sell.', 'sell'); }
    // petitions for wages: also put to an elder with the debtor named, as the game would have to (named is a sim.strangerAsk arg)
    if (hour === 13 && d % 15 === 0 && formerEmployers.size) { const elder = [...work, ...home].find(p => P.persons[p].job === 'elder' || P.persons[p].job === 'official');
      if (elder !== undefined) { const named = [...formerEmployers][0]; const r = sim.strangerAsk(elder, 'He owes me my wages.', named); log.push({ day: d, hour, pid: elder, hh: hhOf(elder, d), why: 'petition-named', said: 'He owes me my wages. (named ' + named + ')', sandbox: r ? { act: r.act, verdict: r.verdict, done: r.verdict.ok ? sim.strangerDo(r.act) : null } : null }); } }
  }
  goTo(d * 24 + 23.9);
  const E = sim.econTo(d + 1), S = E.stranger(); if (S.job) formerEmployers.add(S.job.employer);
  const owedTo = [...E.hh.values()].filter(h => h.debts.some(x => x.to === 'player' && x.amt > 0.005)).map(h => ({ hh: h.id, amt: +h.debts.filter(x => x.to === 'player').reduce((a, x) => a + x.amt, 0).toFixed(3) }));
  days.push({ day: d, skills: Object.fromEntries(sim.deeds.skills), hires: sim.deeds.joint.hiredNow(d).length, purse: { ...S.purse }, hungry: S.hungry, job: S.job ? { e: S.job.employer, worked: S.job.worked, owed: S.job.owed, missed: S.job.missed } : null, stay: S.stay ? { h: S.stay.host, n: S.stay.nights, owed: +S.stay.owed.toFixed(3) } : null, group: S.group?.kind ?? null, halmi: S.halmi, owedTo, debtors: S.debtors.length, petitions: S.petitions.length, stats: { ...S.stats }, reach: S.claimReach(), slighted: S.slighted.size });
  if ((d - D0) % 30 === 0) console.error(`day ${d} turns ${log.length} ${((Date.now() - t0) / 1000).toFixed(0)} s ${JSON.stringify(TM)} purse ${S.purse.cash.toFixed(2)}c ${S.purse.grain.toFixed(1)}g job ${S.job?.employer ?? '-'} stay ${S.stay?.host ?? '-'}`);
}

// ---------------------------------------------------------------- the audit
const A: Record<string, any[]> = {}; const add = (k: string, x: any) => (A[k] ??= []).push(x);
const T = log.filter(r => r.answer !== undefined);
for (const r of T) {
  const ex = { day: r.day, pid: r.pid, hh: r.hh, said: r.said };
  if (!r.alive || r.hhDead) add('dead_speaking', { ...ex, alive: r.alive, hhDead: r.hhDead });
  if (r.facts.some((f: string) => /guest of your house/.test(f)) && r.before.stay !== r.hh) add('guest_told_not_guest', ex);
  if (r.before.stay === r.hh && !r.facts.some((f: string) => /guest of your house/.test(f))) add('guest_not_told', ex);
  const sb = r.sandbox;
  if (sb) {
    if (sb.verdict.ok && !sb.done && !['claim', 'hear'].includes(sb.act.a)) add('verdict_ok_nothing_done', { ...ex, a: sb.act.a, why: sb.verdict.why, answer: r.answer });
    if (sb.done?.ok) {
      if (sb.act.a === 'stay' && r.after.stay !== r.hh) add('done_no_effect', { ...ex, a: 'stay' });
      if (sb.act.a === 'seek_work' && r.after.job !== r.hh) add('done_no_effect', { ...ex, a: 'seek_work' });
      if (sb.act.a === 'give' && r.after.cash >= r.before.cash && r.after.grain >= r.before.grain) add('done_no_effect', { ...ex, a: 'give' });
    }
    if (!sb.verdict.ok && /\bYes\b/.test(r.answer)) add('refused_but_yes_words', { ...ex, why: sb.verdict.why, answer: r.answer });
    if (sb.verdict.ok && /^No\b/.test(r.answer) && !['claim', 'hear'].includes(sb.act.a)) add('ok_but_no_words', { ...ex, a: sb.act.a, answer: r.answer });
  }
  if (r.decision && r.sandbox) add('both_deed_and_sandbox', ex);
  // D-462: a deed agreed in the world's words but refused in the person's, or refused with no words of their own
  if (r.deed?.out.ok && (VERBS_ as Record<string, { consent: boolean }>)[r.deed.verb]?.consent && !r.deed.done) add('deed_ok_not_done', { ...ex, verb: r.deed.verb, answer: r.answer });
  if (r.deed && !r.deed.out.ok && r.deed.out.refused && !r.deed.out.say) add('refused_without_words', { ...ex, why: r.deed.out.why });
  if (r.request && /silver|shekel|barley|wages|papers/.test(r.said)) add('grammar_deed_shadows_sandbox', { ...ex, request: r.request, decision: r.decision });
  for (const p of r.prompts) { const s = p.replace(/The stranger says: “[^”]*”/g, ''); const dg = s.match(/[^\n]{0,40}\d[^\n]{0,30}/g)?.filter((x: string) => !/^\s*$/.test(x));
    if (dg?.length) add('digits_told', { ...ex, hits: dg.slice(0, 3) }); const m = MODERN.exec(s); if (m) add('modern_word_told', { ...ex, word: m[0], ctx: s.slice(Math.max(0, m.index - 50), m.index + 40) }); }
  if (r.refused) add('trust_gate_refused', ex);
}
// guest-right refused then invited / asked again
const refusedStay = new Map<string, number>();
for (const r of T) { const sb = r.sandbox; if (sb?.act.a === 'stay' && !sb.verdict.ok) refusedStay.set(r.hh, r.day);
  if (r.approach?.kind === 'invite' && refusedStay.has(r.hh)) add('refused_then_invited', { day: r.day, pid: r.pid, hh: r.hh, refusedOn: refusedStay.get(r.hh) }); }
// per-act outcome counts (dead ends: asks that never succeed)
const acts: Record<string, { n: number; ok: number; done: number; whys: Record<string, number> }> = {};
for (const r of log) { const sb = r.sandbox; const k = sb ? sb.act.a + (sb.act.kind ? ':' + sb.act.kind : '') : r.request ? 'deed:' + r.request.kind : r.group ? 'group' : 'none';
  const x = acts[k] ??= { n: 0, ok: 0, done: 0, whys: {} }; x.n++; if (sb?.verdict.ok || r.decision?.ok) x.ok++; if (sb?.done?.ok) x.done++; const w = sb?.verdict.why ?? r.decision?.reason ?? ''; x.whys[w] = (x.whys[w] ?? 0) + 1; }
// sameness: answers' first words, the news and needs lines, approach openings
const freq = (xs: string[]) => { const m: Record<string, number> = {}; for (const x of xs) m[x] = (m[x] ?? 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6); };
const sameness = { answers: freq(T.map(r => String(r.answer).replace(/I am [^,.]+/, 'I am X').slice(0, 60))), news: freq(T.flatMap(r => r.life.news ?? [])), needs: freq(T.flatMap(r => r.life.needs ?? [])), openings: freq(log.filter(r => r.approach).map(r => r.approach.opening)), distinctNews: new Set(T.flatMap(r => r.life.news ?? [])).size, turnsWithNews: T.filter(r => r.life.news?.length).length };
// wages owed never paid; silver over the year
const owedEver = new Map<string, number>(); for (const x of days) for (const o of x.owedTo) owedEver.set(o.hh, Math.max(owedEver.get(o.hh) ?? 0, o.amt));
const last = days[days.length - 1];
const owedStill = last?.owedTo ?? [];
// D-462: what a year of joint deeds did
const JW = sim.deeds.joint, mineJ = JW.jobs.filter(j => j.actor === 'player'), byKind: Record<string, Record<string, number>> = {};
for (const j of mineJ) { const k = (byKind[j.kind] ??= {}); k[j.state] = (k[j.state] ?? 0) + 1; }
const deedRows = log.filter(r => r.deed), says: Record<string, number> = {}; for (const r of deedRows) if (r.deed.out.say) says[r.deed.out.say] = (says[r.deed.out.say] ?? 0) + 1;
const town: Record<string, number> = {}; for (const [k, v] of Object.entries(JW.stats)) if (/^(done|missed|off|set):|kg:|roofs_mended|leak_house_days|hire_|lessons|message_|brought|would_not_come/.test(k)) town[k] = +(+v).toFixed(1);
const joint = { proposed: deedRows.length, agreed: deedRows.filter(r => r.deed.out.ok).length, done: deedRows.filter(r => r.deed.done).length, byVerb: Object.fromEntries(Object.entries(deedRows.reduce((m: any, r) => { const x = (m[r.deed.verb] ??= { n: 0, ok: 0, done: 0 }); x.n++; if (r.deed.out.ok) x.ok++; if (r.deed.done) x.done++; return m; }, {}))),
  mine: byKind, kept: kept.size, forgot: forgot.size, skills: Object.fromEntries(sim.deeds.skills), hires: JW.hires.map(h => ({ role: h.role, days: h.until - h.from, paid: h.paid, ended: h.ended ?? null })), news: JW.news.slice(-12), says: Object.entries(says).sort((a, b) => b[1] - a[1]).slice(0, 12), worldStats: town,
  roofsLeakingAtEnd: P.households.filter(h => (h.zone === 'town' || h.zone === 'plain') && JW.roofOf(`h:${h.id}`, D0 + DAYS) < 0.45).length };
const report = { seed, days: DAYS, joint, turns: T.length, rows: log.length, secs: (Date.now() - t0) / 1000, counts: Object.fromEntries(Object.entries(A).map(([k, v]) => [k, v.length])), examples: Object.fromEntries(Object.entries(A).map(([k, v]) => [k, v.slice(0, 3)])),
  acts, sameness, wages: { owedEver: [...owedEver], owedAtEnd: owedStill, stats: last?.stats }, purse: days.filter((_, i) => i % 30 === 0).map(x => ({ day: x.day, cash: +x.purse.cash.toFixed(2), grain: +x.purse.grain.toFixed(1), job: x.job?.e ?? null, stay: x.stay?.h ?? null, group: x.group, halmi: x.halmi, reach: x.reach })), final: last };
(report as any).market = Object.fromEntries(Object.entries(MK).map(([k, m]) => [k, { tried: m.tried, found: m.found, days: m.days.size, foundDays: m.foundDays.size, meanPeople: +(m.people / Math.max(1, m.tried)).toFixed(2) }]));
mkdirSync('.cache/playtest', { recursive: true });
writeFileSync(`.cache/playtest/year-${seed}.jsonl`, log.map(r => JSON.stringify(r)).join('\n'));
writeFileSync(`.cache/playtest/year-${seed}-days.jsonl`, days.map(r => JSON.stringify(r)).join('\n'));
writeFileSync(`.cache/playtest/year-${seed}-audit.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ counts: report.counts, market: (report as any).market, turns: report.turns, secs: report.secs, joint }, null, 1));
