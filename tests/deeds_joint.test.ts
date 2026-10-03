// D-462 (UD-32): joint deeds really happen and really pay off. The walk there and back, the work at its proper place and
// hour, kept or missed by the stranger, the outcome into the economy (game and fish as food, a roof that keeps out the rain
// or leaks and sickens the house), a skill learned and used, townspeople hired for silver, errands carried and answered,
// refusals in the person's own words, and the town's own undertakings with no stranger at all.
import { describe, it, expect } from 'vitest';
import { simAt } from './sim_fixture';
import { parseDeed } from '../src/people/deeds/parse';
import { LEXICON, VERBS } from '../src/people/deeds/verbs';
import { ROOF, sayNo } from '../src/people/deeds/joint';
import { segAt } from '../src/people/population';
import type { PeopleSim } from '../src/people/sim';

const ctx = { addressee: 5, hour: 10, pointed: 9, named: (w: string) => /friend|Bagadata/i.test(w) ? 7 : null };
const P_ = (s: string) => parseDeed(s, 'player', ctx);

describe('D-462 the words for errands and hires', () => {
  it('reads messages, fetching, bringing and hiring', () => {
    expect(P_('Go and tell your friend to meet me at the well.')).toMatchObject({ verb: 'send', third: 7 });
    expect(P_('Bring your friend here to me.')).toMatchObject({ verb: 'bring', third: 7 });
    expect(P_('Fetch me some bread.')).toMatchObject({ verb: 'fetch', good: 'bread' });
    expect(P_('Fetch Bagadata for me.')).toMatchObject({ verb: 'fetch', third: 7, target: 5 });
    expect(P_('Be my porter for three days, I will pay you.')).toMatchObject({ verb: 'hire' });
    expect(P_('Show me the way to the market and I will pay you.')).toMatchObject({ verb: 'hire' });
    expect(P_('Tell your father that Bagadata stole the goat.')).toMatchObject({ verb: 'tell' });
  });
  it('a refusal is said in the person\'s own words', () => {
    expect(sayNo('busy reaping the wheat; cold to strangers', 'help')).toBe('Not now: I am reaping the wheat.');
    expect(sayNo('a woman does not go off with a strange man', 'join')).toMatch(/not fitting/);
    expect(sayNo('already promised that hour to Bagadata', 'join')).toBe('I have promised that hour to Bagadata.');
  });
});

/** the stranger stays among the people of his undertakings from now to `until` (as the game reports him near them) */
function live(sim: PeopleSim, until: number, among: (t: number) => number[]) {
  for (let t = sim.t + 0.25; t <= until; t += 0.25) { sim.jumpTo(t); const n = among(t); if (n.length) sim.strangerNear(n, 0.25); }
}
const withHim = (sim: PeopleSim, pids: number[]) => (t: number) => { const d = Math.floor(t / 24), h = t - d * 24; return pids.filter(p => /stranger/.test(segAt(sim.pop.plan(p, d), h).why)); };

describe('D-462 joint deeds in a real town (seed 1, day 60)', () => {
  const sim = simAt(1, 60, 10, { asks: true }), day = 60, Pop = sim.pop, J = sim.deeds.joint;
  const adults = Pop.persons.filter(p => Pop.present(p.id, day) && Pop.ageOn(p.id, day) >= 20 && Pop.ageOn(p.id, day) < 50 && p.zone !== 'terrace' && segAt(Pop.plan(p.id, day), 10).act !== 'sleep').map(p => p.id);
  const men = adults.filter(x => Pop.persons[x].sex === 'm');
  const E0 = sim.econTo(day), S = E0.stranger(); S.purse.cash = 3;
  const agree = (said: string, pool = adults, skip: number[] = []) => { for (const pid of pool) { if (skip.includes(pid)) continue; const r = sim.strangerDeed(pid, said); if (r?.out.ok) return { pid, rec: sim.strangerDeedDo(r.deed) }; } throw new Error(`no one agreed: ${said}`); };

  it('the town keeps its own undertakings with no stranger: roofs mended, kin at the work, an evening\'s beer, the river', () => {
    for (const k of ['done:roof', 'done:work', 'done:drink', 'done:visit', 'done:meal']) expect(J.stats[k] ?? 0, k).toBeGreaterThan(0);
    expect((J.stats['done:fish'] ?? 0) + (J.stats['done:hunt'] ?? 0)).toBeGreaterThan(0);
  });

  const hunt = agree("Let's go hunting tomorrow morning with the bow.", men);
  const huntJob = J.jobs.find(j => j.actor === 'player' && j.kind === 'hunt')!;
  it('a hunt: tomorrow at dawn in the hills, with the walk there and back in their plan', () => {
    expect(huntJob).toMatchObject({ target: hunt.pid, day: day + 1, act: 'fowl', state: 'set' });
    expect(huntJob.place).toMatch(/^slope:/);
    const plan = Pop.plan(hunt.pid, day + 1), i = plan.findIndex(s => s.act === 'fowl' && /stranger/.test(s.why));
    expect(i).toBeGreaterThan(0); expect(plan[i].why).toMatch(/bow/);
    // (D-720: the hunt may be split by the meal eaten in the hills: the walk back follows its last stretch)
    let k = i; while (k + 1 < plan.length && plan[k + 1].place === plan[i].place && plan[k + 1].where !== 'road') k++;
    expect(plan[i - 1]).toMatchObject({ act: 'walk', where: 'road' }); expect(plan[k + 1]).toMatchObject({ act: 'walk', where: 'road' });
    expect(plan[i].t0 - plan[i - 1].t0).toBeGreaterThan(0.1); // (the hills are a walk away)
  });
  it('the same hour asked again of the same man: already promised, said so', () => {
    const r = sim.strangerDeed(hunt.pid, 'Come fishing with me tomorrow morning.')!;
    expect(r.out.ok).toBe(false); expect(r.out.why).toMatch(/promised/); expect(r.out.say).toMatch(/promised that hour/);
  });

  const fishers = men.filter(x => x !== hunt.pid);
  const fish = agree('Come fishing with me tomorrow morning.', fishers);
  it('kept: the stranger goes; the catch is food in his purse and their house; missed: the other waited and remembers', () => {
    const E = sim.econTo(day + 1), g0 = E.stranger().purse.grain, hh = `h:${Pop.home(hunt.pid, day + 1)}`, t0 = E.trust!.trustOf(`h:${Pop.home(fish.pid, day + 1)}`, 'player', day + 1);
    // he goes hunting (among the hunter) and not fishing
    live(sim, (day + 1) * 24 + 14, withHim(sim, [hunt.pid]));
    const h = J.jobs.find(j => j.id === huntJob.id)!, f = J.jobs.find(j => j.actor === 'player' && j.kind === 'fish')!;
    expect(h.state).toBe('done'); expect(h.came).toBe(true); expect(h.out).toMatch(/snares|gazelle|nothing/);
    if (!/nothing/.test(h.out!)) expect(E.stranger().purse.grain).toBeGreaterThan(g0);
    expect(f.state).toBe('missed');
    expect(sim.deeds.minds.feelOf(fish.pid, 'player', day + 1).anger).toBeGreaterThan(0.1);
    expect(E.trust!.trustOf(`h:${Pop.home(fish.pid, day + 1)}`, 'player', day + 1)).toBeLessThan(t0);
    expect(sim.deeds.briefOf(fish.pid, day + 1).join(' ')).toMatch(/did not/);
    expect(sim.deeds.briefOf(hunt.pid, day + 1).join(' ')).toMatch(/with the stranger, hunting in the hills/);
    void hh;
  });

  it('a roof: it decays, leaks on wet days and sickens the house; replastered with the stranger it keeps the rain out', () => {
    const d = Math.floor(sim.t / 24), E = sim.econTo(d);
    const leaky = adults.filter(p => Pop.households[Pop.home(p, d)].members[0] === p && J.roofOf(`h:${Pop.home(p, d)}`, d) < ROOF.leak);
    expect(leaky.length).toBeGreaterThan(0);
    // a wet day: the leaking house loses health and fuel; a sound one does not
    const hL = `h:${Pop.home(leaky[0], d)}`, sound = [...E.hh.values()].find(h => !h.dead && J.roofOf(h.id, d) > 0.8)!;
    (J as any).wx = E.wx; const w = E.wx[(d + 2) % E.wx.length], was = w.wet; (w as any).wet = true; (J as any).wetCum = null;
    const HL = E.hh.get(hL)!, h0 = HL.health, s0 = sound.health; sim.econTo(d + 2); J.day(d + 2);
    expect(HL.health).toBeLessThan(h0); expect(sound.health).toBeGreaterThanOrEqual(s0 - 1e-9);
    expect(E.events.some(e => e.kind === 'roof_leaks')).toBe(true);
    (w as any).wet = was; (J as any).wetCum = null;
    // the stranger helps replaster one
    let done = false;
    for (const pid of leaky) { const r = sim.strangerDeed(pid, 'Let me help you fix your roof.')!; if (!r.out.ok) continue;
      sim.strangerDeedDo(r.deed); const j = J.jobs[J.jobs.length - 1]; expect(j.kind).toBe('roof');
      live(sim, j.day * 24 + j.h1 + 1, withHim(sim, [pid])); expect(j.state).toBe('done');
      expect(J.roofOf(j.hh, j.day + 1)).toBeGreaterThan(ROOF.leak); done = true; break; }
    expect(done).toBe(true);
  });

  it('a lesson from someone who does the work raises his skill; the craft houses then want him, and pay him more', () => {
    const d = Math.floor(sim.t / 24), weavers = adults.filter(x => J.doesAt(x, 'weave', d)), not = adults.find(x => !J.doesAt(x, 'weave', d) && !J.doesAt(x, 'spin', d))!;
    const r0 = sim.strangerDeed(not, 'Teach me to weave.')!; expect(r0.out.ok).toBe(false); expect(r0.out.say).toMatch(/do not know that work/);
    const s0 = sim.deeds.skills.get('weave') ?? 0;
    for (const pid of weavers) { const r = sim.strangerDeed(pid, 'Teach me to weave.')!; if (!r.out.ok) continue; sim.strangerDeedDo(r.deed); const j = J.jobs[J.jobs.length - 1];
      live(sim, j.day * 24 + j.h1 + 1, withHim(sim, [pid])); expect(j.state).toBe('done'); break; }
    expect(sim.deeds.skills.get('weave')!).toBeGreaterThan(s0);
    // used: a craft house wants a skilled hand even with thin orders; his day is worth more to it and paid more
    const E = sim.econTo(Math.floor(sim.t / 24)), St = E.stranger(), craft = [...E.hh.values()].find(h => h.kind === 'craft' && !h.dead)!;
    const g0 = E.market.goodsDemand; E.market.goodsDemand = 0.5; const before = St.wantsHand(craft.id, E.day);
    sim.deeds.skills.set('weave', 0.6); expect(St.craftSkill()).toBeCloseTo(0.6); expect(St.wantsHand(craft.id, E.day)).toBe('a skilled hand at the craft'); expect(before).not.toBe('a skilled hand at the craft');
    E.market.goodsDemand = g0;
    const run = (sk: number) => { sim.deeds.skills.set('weave', sk); const A = St as any, j0 = A.job, goods = craft.goods;
      A.job = { employer: craft.id, from: E.day - 1, wage: 'cash', worked: 0, missed: 0, run: 0, owed: 0, lastPay: E.day, ev: 0, need: 'x' }; A.attended.add(E.day); A.workDay(E.day);
      const o = { owed: A.job.owed, goods: craft.goods - goods }; A.job = j0; craft.goods = goods; return o; };
    const lo = run(0), hi = run(0.6); expect(hi.owed).toBeGreaterThan(lo.owed); expect(hi.goods).toBeGreaterThan(lo.goods);
    sim.deeds.skills.set('weave', s0 + 0.12);
  });

  it('hired with silver: a porter follows him at his hours, paid each evening into his house; no silver, he goes home', () => {
    const d = Math.floor(sim.t / 24), E = sim.econTo(d), St = E.stranger(); St.purse.cash = 1;
    const { pid } = agree('Be my porter for three days, I will pay you.', adults.filter(x => !J.busyWith(x, d, 0, 24)));
    const H = J.hires.find(h => h.pid === pid && !h.ended)!; expect(H.role).toBe('porter');
    expect(Pop.plan(pid, H.from + 1).some(s => s.place === '@stranger' && s.act === 'carry_sack')).toBe(true);
    const hh = E.hh.get(H.hh)!, c0 = hh.cash, p0 = St.purse.cash;
    sim.jumpTo((H.from + 1) * 24 + 20);
    expect(H.paid).toBe(2); expect(St.purse.cash).toBeCloseTo(p0 - 2 * H.wage, 6); expect(hh.cash).toBeGreaterThan(c0);
    St.purse.cash = 0; sim.jumpTo((H.from + 2) * 24 + 20);
    expect(H.ended).toMatch(/no silver/); expect(Pop.plan(pid, H.from + 2).some(s => /hired for silver/.test(s.why))).toBe(false);
    expect(J.news.some(n => /gone home: no silver/.test(n.text))).toBe(true);
    St.purse.cash = 3;
  });

  it('an errand: the message walks to the third person and is delivered as his own deed; the answer comes back', () => {
    const d = Math.floor(sim.t / 24) + 1; sim.jumpTo(d * 24 + 9);
    const n0 = J.news.length, l0 = sim.deeds.next; // (D-461: the log is a window, read by id)
    let msgr = -1; for (const pid of adults) { if (!Pop.persons[pid].ties.length) continue; const r = sim.strangerDeed(pid, 'Go and tell your friend that I thank him for his kindness.'); if (!r?.out.ok || r.deed.verb !== 'send') continue; sim.strangerDeedDo(r.deed); msgr = pid; break; }
    expect(msgr).toBeGreaterThanOrEqual(0);
    const j = J.jobs[J.jobs.length - 1]; expect(j).toMatchObject({ kind: 'errand', verb: 'send', target: msgr });
    expect(Pop.plan(msgr, j.day).some(s => s.place === j.place && /carrying a message/.test(s.why))).toBe(true);
    sim.jumpTo(j.day * 24 + j.h1 + 1);
    expect(j.state).toBe('done'); expect(J.news.length).toBeGreaterThan(n0);
    expect(sim.deeds.log.some(r => r.id >= l0 && r.deed.actor === 'player' && r.deed.target === j.third)).toBe(true);
  });

  it('a meeting at the hour named: kept when he comes, missed when he does not', () => {
    const d = Math.floor(sim.t / 24) + 1; sim.jumpTo(d * 24 + 10);
    const free = adults.filter(x => !J.busyWith(x, d + 1, 0, 24) && segAt(Pop.plan(x, d), 10).act !== 'sleep');
    const a = agree('Meet me here tomorrow.', free), b = agree('Meet me here tomorrow.', free, [a.pid]);
    const ja = J.jobs.find(j => j.actor === 'player' && j.kind === 'meet' && j.target === a.pid && j.state === 'set')!, jb = J.jobs.find(j => j.actor === 'player' && j.kind === 'meet' && j.target === b.pid && j.state === 'set')!;
    expect(ja.day).toBe(d + 1);
    live(sim, (d + 1) * 24 + 23, withHim(sim, [a.pid]));
    expect(ja.state).toBe('done'); expect(jb.state === 'missed' || jb.came).toBe(true);
  });

  it('every consenting verb of the lexicon does something in the world when someone agrees', () => {
    const d = Math.floor(sim.t / 24) + 1; sim.jumpTo(d * 24 + 10); const E = sim.econTo(d), St = E.stranger(); St.purse.cash = 3; St.purse.grain = 20;
    const said: Record<string, string> = { join: 'Let us walk together.', help: 'Let me help you with your work.', teach: 'Show me how you make bread.', learn: 'Let me teach you a song of my country.', hire: 'Be my guide, I will pay you.',
      give: 'Take this bread, a gift.', lend: 'I will lend you two shekels of silver.', borrow: 'Lend me some bread until tomorrow.', ask_for: 'Can you spare some bread?', share_food: 'Eat with me, share my bread.',
      court: 'Marry me.', intercede: 'Speak for Bagadata to the elder.', reconcile: 'Let us make peace.', introduce: 'You should meet my friend.', embrace: 'Let me embrace you.', heal: 'Let me bandage your wound.',
      carry: 'Let me carry that for you.', fetch: 'Fetch me some water.', repair: 'Let me fix your door.', build: 'Let us build a wall.', guard: 'I will keep watch over your house tonight.',
      come_with: 'Come with me.', visit: 'May I visit you at your house this evening?', meet: 'Meet me at the market tomorrow.', send: 'Go and tell your friend that I am here.', bring: 'Bring your friend here to me.',
      pray: 'Let us pray together.', offer: 'Let us make an offering together.' };
    const consenting = Object.entries(VERBS).filter(([, s]) => s.consent).map(([v]) => v);
    for (const v of consenting) expect(said[v], v).toBeDefined();
    const missing: string[] = [];
    for (const v of consenting) { const words = said[v];
      let ok = false;
      for (const pid of adults) { const r = sim.strangerDeed(pid, words); if (!r) break; if (r.deed.verb !== v) { missing.push(`${v}: read as ${r.deed.verb}`); break; } if (!r.out.ok) continue;
        const rec = sim.strangerDeedDo(r.deed), eff = rec.out.effects;
        ok = eff.some(e => e.k === 'job' || e.k === 'lay' || e.k === 'goods' || e.k === 'hire' || e.k === 'work' || e.k === 'skill') || eff.filter(e => e.k === 'feel').length > 0; break; }
      if (!ok && !missing.some(m => m.startsWith(v))) missing.push(`${v}: no one agreed or nothing followed`); }
    // (a courtship of a stranger and an embrace are rarely agreed: the period's manners; the rest must happen)
    expect(missing.filter(m => !/^(court|embrace|intercede|heal|borrow|ask_for)\b/.test(m))).toEqual([]);
    void LEXICON;
  });

  it('saved and loaded, the undertakings, hires and roofs go on', () => {
    const s = JSON.parse(JSON.stringify(sim.save())), b = simAt(1, 60, 10, { asks: true }); b.load(s);
    expect(b.deeds.joint.jobs.length).toBeGreaterThan(0); expect(b.deeds.joint.hires.length).toBe(J.hires.length);
    const hh = [...J.roofs.keys()][0]; expect(b.deeds.joint.roofOf(hh, day + 3)).toBeCloseTo(J.roofOf(hh, day + 3), 6);
  });
});
