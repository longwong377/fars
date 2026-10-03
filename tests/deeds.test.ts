// D-459 (UD-32): open deeds and minds. The stranger's words read as any deed (deeds/parse.ts), judged by the world and the
// person's mind, with consequences in feelings, trust, goods, wounds, the law, rumour and the day plans; and the town's own
// minds acting day by day with no stranger at all.
import { describe, it, expect } from 'vitest';
import { simAt } from './sim_fixture';
import { parseDeed } from '../src/people/deeds/parse';
import { fromModel, DEED_SCHEMA, deedPrompt } from '../src/people/deeds/extract';
import { approxTokens } from '../src/people/converse/prompt';
import { segAt } from '../src/people/population';
import { talkTurn } from '../src/people/converse/turn';
import { Mind } from '../src/people/converse/mind';
import { standInEngine } from './talk_standin';

const ctx = { addressee: 5, hour: 10, pointed: 9, named: (w: string) => /father|Bagadata/i.test(w) ? 7 : null };
const P = (s: string) => parseDeed(s, 'player', ctx);

describe('D-459 any words as a deed (the grammar)', () => {
  it('reads the free speech the bounded verbs could not', () => {
    expect(P('Let me help you fix your roof.')).toMatchObject({ verb: 'repair', act: 'mould_brick', target: 5 });
    expect(P("Let's go hunting tomorrow.")).toMatchObject({ verb: 'join', act: 'fowl', place: 'hills' });
    expect(P("Let's go hunting tomorrow.")!.inH).toBeGreaterThan(14);
    expect(P("I'll fight him!")).toMatchObject({ verb: 'attack', target: 9 });
    expect(P('I will beat you senseless')).toMatchObject({ verb: 'attack', target: 5, force: 0.75 });
    expect(P('Tell your father that Bagadata stole the goat.')).toMatchObject({ verb: 'tell', third: 7 });
    expect(P('Lend me two shekels of silver until the harvest.')).toMatchObject({ verb: 'borrow', good: 'silver', qty: 2 });
    expect(P('Teach me to weave.')).toMatchObject({ verb: 'teach', act: 'weave' });
    expect(P('Come and drink beer with me tonight.')).toMatchObject({ act: 'eat' });
    expect(P("I'm sorry for what I said.")).toMatchObject({ verb: 'apologize' });
    expect(P('You are a fool and a thief.')).toMatchObject({ verb: 'insult' });
    expect(P('I swear I will bring you bread tomorrow.')).toMatchObject({ verb: 'promise' });
    expect(P("I'll steal his goat.")).toMatchObject({ verb: 'steal', good: 'animal' });
    expect(P('Where is the well?')).toBeNull();
    expect(P('What is your name?')).toBeNull();
  });
  it('the model reads into the same record, held to the closed sets', () => {
    const d = fromModel({ verb: 'join', who: 'you', activity: 'fish', good: 'none', qty: 0, when: 'tomorrow', force: 'none', name: '' }, 'player', { ...ctx, said: 'x' });
    expect(d).toMatchObject({ verb: 'join', act: 'fish', target: 5 });
    expect(fromModel({ verb: 'fly', who: 'you', activity: 'none', good: 'none', qty: 0, when: 'now', force: 'none', name: '' }, 'player', { ...ctx, said: 'x' })).toBeNull();
    expect(DEED_SCHEMA.properties.verb.enum.length).toBeGreaterThan(50);
    const p = deedPrompt('Let us go fishing at dawn.'); expect(approxTokens(p.system + p.user)).toBeLessThan(450);
  });
});

describe('D-459 deeds in the world (a real town, seed 1, day 60)', () => {
  const sim = simAt(1, 60, 10, { asks: true }), day = 60, Pop = sim.pop;
  const adults = Pop.persons.filter(p => Pop.present(p.id, day) && Pop.ageOn(p.id, day) >= 20 && Pop.ageOn(p.id, day) < 50 && segAt(Pop.plan(p.id, day), 10).act !== 'sleep').map(p => p.id);
  it('help offered: judged by the mind (a reason either way); done, it lays the work into their day and leaves gratitude', () => {
    let done = 0, refused = 0;
    for (const pid of adults.slice(0, 40)) { const r = sim.strangerDeed(pid, 'Let me help you with your work.')!;
      expect(r.deed.verb).toBe('help'); expect(r.out.why.length).toBeGreaterThan(2);
      if (!r.out.ok) { refused++; continue; } const g0 = sim.deeds.minds.feelOf(pid, 'player', day).grat; sim.strangerDeedDo(r.deed); done++;
      expect(sim.deeds.minds.feelOf(pid, 'player', day).grat).toBeGreaterThan(g0); }
    expect(done).toBeGreaterThan(5); expect(refused).toBeGreaterThan(0);
  });
  it('a hunt tomorrow: the one who agrees goes to the hills with him in their plan for tomorrow', () => {
    for (const pid of adults.filter(x => Pop.persons[x].sex === 'm').slice(0, 30)) { const r = sim.strangerDeed(pid, "Let's go hunting tomorrow morning.")!; if (!r.out.ok) continue;
      sim.strangerDeedDo(r.deed); const tomorrow = Pop.plan(pid, day + 1); expect(tomorrow.some(s => s.act === 'fowl' && /^slope:/.test(s.place) && /stranger/.test(s.why))).toBe(true); return; }
    throw new Error('no one would go hunting');
  });
  it('a blow: a wound, the house distrusts him, the elder hears it and fines him; news of it travels', () => {
    const v = adults.find(x => Pop.persons[x].sex === 'm')!, hh = `h:${Pop.home(v, day)}`, E = sim.econTo(day), t0 = E.trust!.trustOf(hh, 'player', day);
    const r = sim.strangerDeed(v, 'I will beat you!')!; expect(r.deed.verb).toBe('attack'); const rec = sim.strangerDeedDo(r.deed);
    expect(rec.out.ok).toBe(true); expect(sim.deeds.injuryOf(v, day)).not.toBeNull();
    expect(E.trust!.trustOf(hh, 'player', day)).toBeLessThan(t0);
    expect(sim.deeds.minds.feelOf(v, 'player', day).anger).toBeGreaterThan(0.3);
    expect(sim.deeds.cases.some(c => c.accused === 'player' && c.crime === 'assault')).toBe(true);
    if (sim.deeds.injuryOf(v, day)!.how !== 'bruised') expect(Pop.plan(v, day + 1).some(s => s.act === 'lie_ill')).toBe(true);
  });
  it('a child: no harm and no courting; the grown-ups near step in', () => {
    const c = Pop.persons.find(p => Pop.present(p.id, day) && Pop.ageOn(p.id, day) >= 5 && Pop.ageOn(p.id, day) < 10)!.id;
    const r = sim.strangerDeed(c, 'I will hit you')!; expect(r.out.ok).toBe(false); expect(r.out.why).toMatch(/pull you away/);
    const g = Pop.persons.find(p => Pop.present(p.id, day) && Pop.ageOn(p.id, day) >= 12 && Pop.ageOn(p.id, day) < 17 && p.sex === 'f')!.id;
    expect(sim.strangerDeed(g, 'Marry me.')!.out.ok).toBe(false);
  });
  it('the town lives without him: a month of the minds\' own deeds, of many kinds, between its people', () => {
    const n0 = sim.deeds.next; sim.jumpTo((day + 30) * 24 + 10); sim.econTo(day + 30);
    const own = sim.deeds.log.filter(r => r.id >= n0 && r.deed.actor !== 'player'); // (D-461: the log is a window of the latest deeds, read by id)
    expect(own.length).toBeGreaterThan(100);
    expect(new Set(own.map(r => r.deed.verb)).size).toBeGreaterThanOrEqual(5);
    expect(own.filter(r => r.out.ok).length).toBeGreaterThan(30);
  }, 300_000); // (a month of the whole town's simulation: ~2 min alone on the 4-core box)
  it('saved and loaded, the minds and the wounds go on', () => {
    const s = JSON.parse(JSON.stringify(sim.save())), b = simAt(1, 60, 10, { asks: true }); b.load(s);
    expect(b.deeds.log.length).toBe(0); expect(b.deeds.cases.length).toBe(sim.deeds.cases.length);
    // (D-720: the ids go on from the saved count, and the last day's deeds are read back: a memory reads its own deed)
    expect(b.deeds.next).toBe(sim.deeds.next);
    const last = sim.deeds.log.filter(r => /^(attack|steal|break|curse|accuse|threaten|insult|mock|push|court|reconcile|heal|forgive|apologize|intercede|comfort)$/.test(r.deed.verb) && r.day >= sim.deeds.log[sim.deeds.log.length - 1].day - 9).slice(-1)[0];
    if (last) { expect(b.deeds.rec(last.id)?.deed.verb).toBe(last.deed.verb); expect(b.deeds.rec(last.id)?.deed.actor).toBe(last.deed.actor); }
    const v = sim.deeds.cases.find(c => c.accused === 'player')!.victim as number; expect(b.deeds.minds.feelOf(v, 'player', day + 1).anger).toBeCloseTo(sim.deeds.minds.feelOf(v, 'player', day + 1).anger, 6);
  });
});

describe('D-459 a talk turn carries the deed (stand-in model)', () => {
  it('the person is told the world\'s and their own word, and the deed is done after their answer', async () => {
    const sim = simAt(1, 60, 10, { asks: true }), day = 60, Pop = sim.pop, m = new Mind(); (m as any).engine = standInEngine(); m.model = 'stand-in';
    const pid = Pop.persons.find(p => Pop.present(p.id, day) && Pop.ageOn(p.id, day) >= 25 && Pop.ageOn(p.id, day) < 50 && segAt(Pop.plan(p.id, day), 10).act !== 'sleep')!.id;
    const o = await talkTurn(m, sim, pid, 'You are a liar and a fool.', { conv: sim.t });
    expect(o.deed?.deed.verb).toBe('insult'); expect(o.deed?.done?.out.ok).toBe(true);
    expect(sim.deeds.minds.feelOf(pid, 'player', day).anger).toBeGreaterThan(0.2);
  });
});
