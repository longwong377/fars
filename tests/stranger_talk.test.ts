// D-370: the stranger's words reach the sandbox: the grammar (speech/verbs.ts) proposes, the simulation decides, the person is
// told the verdict before answering, and the step is done after a yes (converse/turn.ts). Stand-in model (tests/talk_standin.ts):
// this measures the plumbing, not whether a real model keeps to the verdict.
import { describe, it, expect, beforeAll } from 'vitest';
import { simAt } from './sim_fixture';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { Mind } from '../src/people/converse/mind';
import { talkTurn } from '../src/people/converse/turn';
import { strangerAsk } from '../src/people/speech/verbs';
import { standInEngine } from './talk_standin';

const c = { day: 50, hh: 'h:7', q: 'q1', job: 'farmer' };
describe('the grammar of the stranger\'s asks (verbs.ts)', () => {
  const cases: [string, string | null, string?][] = [
    ['Could I work for you? I am strong.', 'seek_work'], ['Do you need a hand with the harvest?', 'seek_work'], ['May I stay the night with you?', 'stay'],
    ['Can you put me up?', 'stay'], ['I am a merchant from Babylon.', 'claim', 'merchant'], ['I come from Egypt.', 'claim', 'pilgrim'], ['I am your kinsman.', 'claim', 'kin'],
    ['Can I join the caravan?', 'join', 'caravan'], ['Put me on the ration list.', 'join', 'gang'], ['Take me into your household.', 'join', 'household'],
    ['Take these 2 shekels.', 'give'], ['He owes me my wages.', 'petition', 'wages'], ['I need papers to stay.', 'petition', 'leave'], ['Speak for that family.', 'petition', 'plea'],
    ['Sell me two measures of barley.', 'buy'], ['How much for your firewood?', 'buy'], ['Will you buy my grain?', 'sell'],
    ['Teach me your word for bread.', 'hear'], ['Thank you for your hospitality.', 'leave_stay'], ['I quit.', 'quit'], ['Where is the well?', null], ['Nice weather.', null],
  ];
  for (const [w, a, x] of cases) it(w, () => { const s = strangerAsk(w, c) as any; expect(s?.a ?? null).toBe(a); if (x) expect(s.role ?? s.kind).toBe(x); });
  it('an official is asked for a document; a farmer for a petition sends it to the headman', () => {
    expect((strangerAsk('I need a sealed document.', { ...c, job: 'official' }) as any).to).toBe('official');
    expect((strangerAsk('Speak for that family.', c) as any).to).toBe('headman');
  });
});

let nav: NavGrid;
const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), x = W.conditions(dd, t - dd * 24); return { rain: x.rain, lightning: x.lightning, windMs: x.windMs, tempC: x.tempC, dust: x.dust }; };
beforeAll(() => { nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8'))); }, 120_000);
describe('a talk turn reaches the sandbox (turn.ts)', () => {
  it('asked for guest-right, the person is told the verdict, and the stay is in the economy and the save', async () => {
    const d = 60, sim = simAt(1, d, 17), m = new Mind(); (m as any).engine = standInEngine(); m.model = 'stand-in';
    const E = sim.econTo(d), S = E.stranger();
    // a farmer at home whose house would take a guest today
    const pid = sim.pop.persons.find(p => p.job === 'farmer' && p.age >= 25 && sim.pop.present(p.id, d) && S.stayCheck(`h:${sim.pop.home(p.id, d)}`, d).ok)!.id;
    const o = await talkTurn(m, sim, pid, 'May I stay the night with you?', { conv: sim.t });
    expect(o.sandbox?.act.a).toBe('stay'); expect(o.sandbox?.verdict.ok).toBe(true);
    expect(o.sandbox?.done?.ok).toBe(true); expect(S.stay?.host).toBe(`h:${sim.pop.home(pid, d)}`);
    expect(S.comp(S.langOf(S.stay!.host), d)).toBeGreaterThan(0); // the turn was heard
    const snap = JSON.parse(JSON.stringify(E.snapshot(d - 2))); expect(snap.stranger.stay.host).toBe(S.stay!.host);
    // a house that cannot: the person is told no and nothing is done
    const poorPid = sim.pop.persons.find(p => p.age >= 25 && sim.pop.present(p.id, d) && !S.stayCheck(`h:${sim.pop.home(p.id, d)}`, d).ok && `h:${sim.pop.home(p.id, d)}` !== S.stay!.host && E.hh.has(`h:${sim.pop.home(p.id, d)}`))!.id;
    const o2 = await talkTurn(m, sim, poorPid, 'May I stay the night with you?', { conv: sim.t });
    expect(o2.sandbox?.verdict.ok).toBe(false); expect(o2.sandbox?.done).toBeNull(); expect(o2.answer.text.toLowerCase()).toMatch(/no|cannot/);
  }, 600_000);
  it('presence: two hours beside the employer\'s people make an attended day (the game\'s strangerNear hook)', () => {
    const d = 45, sim = simAt(1, d, 9);
    const E = sim.econTo(d), S = E.stranger();
    const boss = [...E.hh.values()].find(h => h.kind === 'farmer' && S.hireCheck(h.id, d).ok)!.id; S.do({ a: 'seek_work', day: d, hh: boss });
    const mates = sim.pop.households[Number(boss.slice(2))].members;
    for (let k = 0; k < 9; k++) { sim.t += 0.25; sim.strangerNear(mates, 0.25); }
    expect((S as any).attended.has(d)).toBe(true);
  }, 300_000);
});
describe('the stranger in the people\'s own days (economy/plans.ts)', () => {
  it('the host cooks more and makes up a bed the evening the stranger is taken in', () => {
    const d = 70, sim = simAt(1, d, 10);
    const E = sim.econTo(d), S = E.stranger();
    const host = [...E.hh.values()].find(h => h.kind === 'farmer' && S.stayCheck(h.id, d).ok && sim.pop.households[Number(h.id.slice(2))].members.some(m => sim.pop.persons[m].sex === 'f' && sim.pop.ageOn(m, d) >= 16))!;
    const v = S.do({ a: 'stay', day: d, hh: host.id }); expect(v.ok).toBe(true);
    const ev = E.events[v.ev![0]]; const day = ev.day;
    const members = sim.pop.households[Number(host.id.slice(2))].members;
    (sim.pop as any).planCache?.clear?.(); (sim.econPlans as any).cache?.clear?.();
    const segs = members.flatMap(m => sim.pop.plan(m, day)).filter(s => /guest/.test(s.why));
    expect(segs.length).toBeGreaterThan(0);
  }, 300_000);
});
describe('the render side\'s hooks (speech/presence.ts)', () => {
  it('overheard lines thin as the stranger learns; time near the employer\'s people makes an attended day', async () => {
    const { strangerPresence, thinCaption } = await import('../src/people/speech/presence');
    const d = 45, sim = simAt(1, d, 9); const E = sim.econTo(d), S = E.stranger();
    const c = { key: 'p1', unit: 'el-greet-1', lang: 'el', translit: 'x', gloss: 'may the god keep you well this day friend', tier: 'C', t0: 0, t1: 2 };
    expect(thinCaption(sim, c).gloss).toBe(c.gloss); // a beginner reads it all
    S.hear('Elamite', 600, 1, true, d); const thin = thinCaption(sim, c).gloss; expect(thin.split(' ').filter(w => w !== '…').length).toBeLessThan(c.gloss.split(' ').length);
    const boss = [...E.hh.values()].find(h => h.kind === 'farmer' && S.hireCheck(h.id, d).ok)!.id; S.do({ a: 'seek_work', day: d, hh: boss });
    const mates = sim.pop.households[Number(boss.slice(2))].members.map(m => ({ key: `p${m}`, x: 3, z: 4 }));
    strangerPresence(sim, mates, { x: 0, z: 0 }); for (let k = 0; k < 12; k++) { sim.t += 0.2; strangerPresence(sim, mates, { x: 0, z: 0 }); }
    expect((S as any).attended.has(d)).toBe(true);
  }, 300_000);
});
describe('the house knows its dealings with the stranger (factsFor, in the turn)', () => {
  it('the host is told the stranger is their guest, what is believed of him, and to speak simply', async () => {
    const d = 60, sim = simAt(1, d, 17), m = new Mind(); (m as any).engine = standInEngine(); m.model = 'stand-in';
    const E = sim.econTo(d), S = E.stranger();
    const pid = sim.pop.persons.find(p => p.job === 'farmer' && p.age >= 25 && sim.pop.present(p.id, d) && S.stayCheck(`h:${sim.pop.home(p.id, d)}`, d).ok)!.id, hh = `h:${sim.pop.home(pid, d)}`;
    S.do({ a: 'claim', day: d, hh, role: 'merchant', origin: 'Babylon' }); S.do({ a: 'stay', day: d, hh });
    const f = S.factsFor(hh, d); expect(f.some(x => /guest of your house/.test(x))).toBe(true); expect(f.some(x => /merchant from Babylon/.test(x))).toBe(true); expect(f.some(x => /simple words|simply/.test(x))).toBe(true);
    const seen: string[] = []; const ans = m.answer.bind(m); (m as any).answer = async (...a: any[]) => { seen.push(String(a[6]?.before ?? '')); return ans(...(a as [any, any, any, any, any, any, any])); };
    await talkTurn(m, sim, pid, 'Good evening to you.', { conv: sim.t });
    expect(seen.join(' ')).toMatch(/guest of your house/);
  }, 300_000);
});
describe('addressing a group (UD-25 (10))', () => {
  it('a claim to a group is heard by every house present; an ask finds the first house that says yes', () => {
    const d = 45, sim = simAt(1, d, 9); const E = sim.econTo(d), S = E.stranger();
    const farmers = sim.pop.persons.filter(p => p.job === 'farmer' && p.age >= 20 && sim.pop.present(p.id, d)).slice(0, 12).map(p => p.id);
    const c = sim.strangerAskGroup(farmers, 'I am a merchant from Babylon.'); expect(c.length).toBeGreaterThan(3);
    for (const x of c) sim.strangerDo(x.act); expect(S.belief.size).toBeGreaterThanOrEqual(c.length);
    const w = sim.strangerAskGroup(farmers, 'Do you need hands for the harvest?'); expect(w.length).toBe(1);
    if (w[0].verdict.ok) { sim.strangerDo(w[0].act); expect(S.job?.employer).toBe(`h:${sim.pop.home(w[0].pid, d)}`); }
  }, 300_000);
});
describe('the trust gate (B234)', () => {
  it('a house that distrusts the stranger will not talk; the model is never asked', async () => {
    const d = 60, sim = simAt(1, d, 11), m = new Mind(); (m as any).engine = standInEngine(); m.model = 'stand-in';
    const E = sim.econTo(d); const pid = sim.pop.persons.find(p => p.job === 'farmer' && p.age >= 25 && sim.pop.present(p.id, d))!.id, hh = `h:${sim.pop.home(pid, d)}`;
    E.trust!.note(hh, 'player', -0.9, d); E.trust!.note(hh, 'player', -0.9, d);
    let asked = 0; const ans = m.answer.bind(m); (m as any).answer = async (...a: any[]) => { asked++; return ans(...(a as [any, any, any, any, any, any, any])); };
    const o = await talkTurn(m, sim, pid, 'Good morning, friend.', { conv: sim.t });
    expect(o.refused).toBe('distrust'); expect(asked).toBe(0); expect(o.answer.text).toMatch(/turns away/);
  }, 300_000);
});
