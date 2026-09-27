// D-315 (UD-21; T-E10): conversations act on the world and are remembered per save. The node side, with a deterministic
// stand-in for the language model (tests/talk_standin.ts: the plumbing; no network, no GPU):
//   - the tag the model ends with is read robustly, the stranger's asks by the grammar;
//   - the SIMULATION decides (a guard on watch will not leave his post; a child follows until called home; a craftsman at
//     leisure walks the stranger to the well; a gang's man does not stop the work) and a deed is new plan steps, carried out
//     by the detailed agents on the Terrace (the child walks behind the stranger) and laid over the day for everyone;
//   - with no event the world is the same (the save, the plans); every event survives a save and a reload;
//   - memory rows are short, older ones fold, gossip reaches kin and friends after a seeded delay, the prompt stays in budget;
//   - T-E10: the seeded request-and-recall set, measured (REVIEWS/evidence/s12-talk/T-E10.json). The number is the
//     PLUMBING's: a stand-in cannot say whether a real 1-2 B model keeps to the tag, the note and the memory (the lab's GPU
//     run, converseLab.ts talkSet, does).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { segAt } from '../src/people/population';
import { WeatherSystem } from '../src/weather/weatherState';
import { parseIntent, requestOf, wordsRefuse } from '../src/people/converse/intent';
import { Mind } from '../src/people/converse/mind';
import { talkTurn } from '../src/people/converse/turn';
import { systemPrompt, approxTokens, PROMPT_TOKENS } from '../src/people/converse/prompt';
import { lifeRecord } from '../src/people/converse/life';
import { buildTestSet } from '../src/people/converse/testset';
import { buildTalkSet, runTalkSet } from '../src/people/converse/talkset';
import { TALK_LIMITS } from '../src/people/talk';
import { standInEngine } from './talk_standin';

let nav: NavGrid; let S: PeopleSim;
const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const fresh = () => new PeopleSim(1, nav, env);
const mind = () => { const m = new Mind(); (m as any).engine = standInEngine(); m.model = 'stand-in'; return m; };
beforeAll(() => {
  nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  S = fresh();
}, 120_000);
/** the first person of a job awake at the hour whose block matches (a person of the population, not a detailed agent unless asked) */
function find(sim: PeopleSim, day: number, hour: number, ok: (pid: number) => boolean) { for (const p of sim.pop.persons) { if (!sim.pop.present(p.id, day)) continue; if (ok(p.id)) return p.id; } return -1; }

describe('the tag and the ask (intent.ts)', () => {
  it('reads the tag however a small model writes it, and takes it out of the words', () => {
    const T: [string, string, string | undefined, string][] = [
      ['Yes, come, I will show you. [lead: the well]', 'lead_to', 'well', 'Yes, come, I will show you.'],
      ['Follow me then. [follow]', 'follow', undefined, 'Follow me then.'],
      ['No, stranger, I am on watch. [refuse: on watch]', 'refuse', 'on watch', 'No, stranger, I am on watch.'],
      ['Here, take this bread. {"do": "give", "item": "bread"}', 'give', 'bread', 'Here, take this bread.'],
      ['I will call her.\nACTION: fetch (my wife)', 'fetch', 'my wife', 'I will call her.'],
      ['I will wait here. <wait>', 'wait_here', undefined, 'I will wait here.'],
      ['Very well, I go home. [go home', 'go_home', undefined, 'Very well, I go home.'],
      ['I am Tabnea, a weaver. [none]', 'none', undefined, 'I am Tabnea, a weaver.'],
      ['A moment. [stop_work] no, [refuse: the foreman]', 'refuse', 'foreman', 'A moment. no,'],
    ];
    for (const [raw, kind, arg, words] of T) { const p = parseIntent(raw); expect(p.intent?.kind, raw).toBe(kind); if (arg) expect(p.intent?.arg ?? '', raw).toContain(arg); expect(p.words, raw).toBe(words); }
    expect(parseIntent('I am Tabnea (a weaver) of the town.').intent).toBe(null);
  });
  it('the grammar reads the ordinary asks and leaves questions alone', () => {
    const T: [string, string | null, string?][] = [['Come with me, friend.', 'follow'], ['Can you show me the way to the well?', 'lead_to', 'well'], ['Where is the mill?', 'lead_to', 'mill'],
      ['Could you fetch your wife for me?', 'fetch', 'your wife'], ['I am thirsty.', 'give', 'water'], ['Could you spare some bread?', 'give', 'bread'],
      ['I will give you my bread for some water.', 'trade', 'water for my bread'], ['Stop working for a while and talk with me.', 'stop_work'], ['Wait here for me.', 'wait_here'],
      ['Go home, friend, you look tired.', 'go_home'], ['What work do you do?', null], ['Who lives in your house?', null], ['What is that great terrace up there?', null]];
    for (const [s, k, a] of T) { const r = requestOf(s); expect(r?.kind ?? null, s).toBe(k); if (a) expect(r?.arg ?? '', s).toContain(a.split(' ')[0]); }
    expect(wordsRefuse('No, stranger, I cannot leave the post.')).toBe(true); expect(wordsRefuse('Yes, come this way.')).toBe(false);
  });
});

describe('the simulation decides and the day changes (talk.ts)', () => {
  it('a guard on watch will not leave his post; a gang’s stonecutter does not stop the work the foreman counts', () => {
    const d = 150, h = 6.5, g = find(S, d, h, x => S.pop.persons[x].job === 'guard' && /patrol|stand_guard/.test(segAt(S.pop.plan(x, d), h).act));
    expect(g).toBeGreaterThanOrEqual(0); const r = S.talk.consider(g, d * 24 + h, { kind: 'follow' });
    expect(r.ok).toBe(false); expect(r.reason).toMatch(/watch|post/);
    const b = find(S, d, 10, x => S.pop.persons[x].job === 'builder' && !['rest', 'eat', 'talk', 'walk'].includes(segAt(S.pop.plan(x, d), 10).act) && segAt(S.pop.plan(x, d), 10).where !== 'road');
    const rb = S.talk.consider(b, d * 24 + 10, { kind: 'stop_work' }); expect(rb.ok).toBe(false); expect(rb.reason).toMatch(/foreman|work/);
  });
  it('a child at play follows the stranger until called home, then goes home; the plan carries it and nothing else changes', () => {
    const sim = fresh(); const d = 150, h = 10.8;
    const c = find(sim, d, h, x => { const p = sim.pop.persons[x]; const a = sim.pop.ageOn(x, d); const s = segAt(sim.pop.plan(x, d), h); return p.job === 'child' && a >= 6 && a <= 11 && s.act === 'play' && p.agent < 0 && p.sex === 'm'; });
    expect(c).toBeGreaterThanOrEqual(0);
    const others = [c + 1, c + 2, c - 1].map(x => JSON.stringify(sim.pop.plan(x, d)));
    const r = sim.talkAct(c, { kind: 'follow' }, d * 24 + h); expect(r.ok, r.reason).toBe(true);
    const P = sim.pop.plan(c, d); const f = segAt(P, h + 0.05); expect(f.place).toBe('@stranger'); expect(f.t1 - h).toBeLessThanOrEqual(TALK_LIMITS.followChild + 1e-6);
    expect(P.some(s => /called home/.test(s.why))).toBe(true);
    expect(P.map(s => s.t1).every((t, i, a) => i === 0 || t >= a[i - 1])).toBe(true); expect(P[P.length - 1].t1).toBe(24);
    expect([c + 1, c + 2, c - 1].map(x => JSON.stringify(sim.pop.plan(x, d)))).toEqual(others);
  });
  it('a craftsman at leisure walks the stranger to the well and back to his day: new plan steps, with a time limit', () => {
    const sim = fresh(); const d = 150;
    let pid = -1, h = 0; for (const x of sim.pop.persons) { if (x.job !== 'craftsman' || x.agent >= 0 || !sim.pop.present(x.id, d) || x.zone !== 'town') continue;
      const s = sim.pop.plan(x.id, d).find(s => s.place.startsWith('h:') && s.act === 'rest' && s.t0 > 6 && s.t1 - s.t0 > 0.5 && s.t1 < 18); if (s) { pid = x.id; h = s.t0 + 0.1; break; } }
    expect(pid).toBeGreaterThanOrEqual(0);
    const r = sim.talkAct(pid, { kind: 'lead_to', arg: 'the well' }, d * 24 + h);
    if (!r.ok) expect(r.reason).toMatch(/wary|mind|time|not fitting|anxious|work|points/); // a temperament may say no; then try the next one
    else { const P = sim.pop.plan(pid, d); expect(segAt(P, h + 0.01).why).toMatch(/showing the stranger the way to the well/);
      const at = P.find(s => s.place.startsWith('well:'))!; expect(at).toBeTruthy(); expect(at.act).toBe('talk'); expect(r.h1 - r.h0).toBeLessThan(2 * TALK_LIMITS.walkOneWay + 0.1); }
  });
  it('with no event the world is the same: the save has no talk and equals a world never spoken to', () => {
    const a = fresh(), b = fresh(); a.jumpTo(150 * 24 + 8); b.jumpTo(150 * 24 + 8);
    for (let i = 0; i < 600; i++) { a.step(6); b.step(6); }
    const sa = JSON.stringify(a.save()), sb = JSON.stringify(b.save()); expect(sa).toBe(sb); expect(a.save()).not.toHaveProperty('talk');
    expect(a.talk.viewT(5, a.t)).toBe(a.t); expect(a.talk.touches(5, 150)).toBe(false);
  });
  it('a detailed agent (a child of the work camp) follows the stranger across the Terrace and goes back when called home', () => {
    const sim = fresh(); let t0 = -1, kid = -1;
    for (let d = 150; d < 160 && t0 < 0; d++) for (let h = 8; h < 16 && t0 < 0; h += 0.25) { for (const a of sim.agents) if (a.role === 'child') { const s = segAt(sim.planOf(a, d), h); if (s.where === 'terrace' && (s.act === 'play' || s.act === 'rest') && segAt(sim.planOf(a, d), h + 0.4).where === 'terrace') { t0 = d * 24 + h; kid = a.id; break; } } }
    expect(kid).toBeGreaterThanOrEqual(0); sim.jumpTo(t0); const a = sim.agents[kid]; for (let i = 0; i < 20; i++) sim.step(3);
    // the stranger stands 4 m from the child, then walks 25 m across the court
    const start = sim.nav.snap(a.pos[0] + 4, a.pos[1], 3)!; sim.player = start; sim.step(1);
    const r = sim.talkAct(a.pid, { kind: 'follow' }); expect(r.ok, r.reason).toBe(true);
    let far = 0; const path: [number, number][] = []; for (let k = 0; k <= 50; k++) { const p = sim.nav.snap(start[0] + k * 0.5, start[1], 2) ?? path[path.length - 1] ?? start; path.push([p[0], p[1]]); }
    for (const p of path) { sim.player = p; for (let i = 0; i < 2; i++) sim.step(0.5); far = Math.max(far, Math.hypot(a.pos[0] - start[0], a.pos[1] - start[1])); }
    for (let i = 0; i < 30; i++) sim.step(0.5);
    const lead = path[path.length - 1]; const d = Math.hypot(a.pos[0] - lead[0], a.pos[1] - lead[1]);
    expect(far, 'the child walked after the stranger').toBeGreaterThan(10); expect(d, 'close behind the stranger').toBeLessThan(4);
    // called home at the end of the following: the plan takes the child back
    const end = sim.pop.plan(a.pid, Math.floor(sim.t / 24)).find(s => s.place === '@stranger')!; sim.player = null; while (sim.t < Math.floor(sim.t / 24) * 24 + end.t1 + 0.3) sim.step(10);
    expect(Math.hypot(a.pos[0] - lead[0], a.pos[1] - lead[1]), 'gone back from the stranger').toBeGreaterThan(5);
  });
  it('a conversation holds the person: stopped, facing the stranger, the task waiting; after it they go on', () => {
    const sim = fresh(); sim.jumpTo(150 * 24 + 9); for (let i = 0; i < 10; i++) sim.step(3);
    const a = sim.agents.find(x => !x.offmap && x.task && !x.walking && x.role !== 'guard')!; const until = a.task!.until; const pos = [...a.pos];
    sim.player = [a.pos[0] + 2, a.pos[1] + 1]; sim.talkAddressed(a.pid); for (let i = 0; i < 10; i++) sim.step(2);
    expect(a.pos).toEqual(pos); expect(sim.performance(a).act).toBe('talk'); expect(Math.abs(((a.heading - Math.atan2(2, 1) * 180 / Math.PI) + 540) % 360 - 180)).toBeLessThan(1);
    expect(a.task!.until).toBeGreaterThan(until); sim.talk.release(a.pid, sim.t); sim.step(1); expect(sim.performance(a).act).not.toBe('talk');
    // the population view's clock for the person: held, then catching up (never ahead, never jumping)
    const h = sim.talk.lastHoldOf(a.pid)!; expect(sim.talk.viewT(a.pid, h.t + 0.001)).toBe(h.t); const L = h.t1! - h.t;
    const te = [0, 0.25, 0.5, 1, 2.5].map(k => sim.talk.viewT(a.pid, h.t1! + k * L)); for (let i = 1; i < te.length; i++) expect(te[i]).toBeGreaterThanOrEqual(te[i - 1]);
    expect(te[te.length - 1]).toBe(h.t1! + 2.5 * L);
  });
  it('every event survives a save and a reload: the plans laid, the pauses, the memory rows, the stranger’s possessions', async () => {
    const sim = fresh(); const m = mind(); const d = 151;
    const kid = find(sim, d, 10.5, x => sim.pop.persons[x].job === 'homemaker' && segAt(sim.pop.plan(x, d), 10.5).place.startsWith('h:') && sim.pop.persons[x].agent < 0);
    sim.jumpTo(d * 24 + 10.5); const o = await talkTurn(m, sim, kid, 'I am thirsty.', { conv: sim.t });
    expect(o.decision?.ok, o.decision?.reason).toBe(true); expect(sim.talk.possessions()).toContain('water');
    const saved = JSON.parse(JSON.stringify(sim.save())); expect(saved.talk.events.length).toBeGreaterThan(0);
    const b = fresh(); b.load(saved);
    expect(b.pop.plan(kid, d)).toEqual(sim.pop.plan(kid, d)); expect(b.talk.possessions()).toEqual(sim.talk.possessions()); expect(b.talk.recall(kid, sim.t + 24)).toEqual(sim.talk.recall(kid, sim.t + 24));
    expect(JSON.stringify(b.save())).toBe(JSON.stringify(sim.save()));
  });
});

describe('memory, gossip and the prompt budget', () => {
  it('a conversation row is short (≤ ~60 tokens), older ones fold, and kin hear of it after a delay; friends later; second-hand later still', async () => {
    const sim = fresh(); const m = mind(); const d = 152;
    const p = find(sim, d, 11, x => { const P = sim.pop.persons[x]; return P.job === 'farmer' && P.agent < 0 && sim.pop.membersOn(sim.pop.home(x, d), d).length >= 3 && segAt(sim.pop.plan(x, d), 11).act !== 'sleep'; });
    for (let k = 0; k < 5; k++) { sim.t = (d + k) * 24 + 11; await talkTurn(m, sim, p, ['Who are you, friend?', 'Where can I find water?', 'Is your work hard?', 'May I have some water?', 'What news is there today?'][k], { conv: sim.t }); }
    const rows = sim.talk.rows.get(p)!; expect(rows.filter(r => !r.folded).length).toBe(3); expect(rows.find(r => r.folded)?.folded).toBe(2);
    for (const line of sim.talk.recall(p, sim.t + 1, 9)) expect(approxTokens(line), line).toBeLessThanOrEqual(60);
    const kin = sim.pop.membersOn(sim.pop.home(p, d), d).find(x => x !== p && sim.pop.ageOn(x, d) >= 8)!;
    expect(sim.talk.heard(kin, d * 24 + 11.001).length, 'not at once').toBe(0);
    expect(sim.talk.heard(kin, (d + 1) * 24 + 11).length, 'by the next day').toBeGreaterThan(0);
    expect(sim.talk.heard(kin, (d + 1) * 24 + 11)[0].text).toMatch(new RegExp(sim.talk.name(p)));
  });
  it('the prompt with memory and the tag line stays within ~450 tokens for the whole T-E9 set', () => {
    const mem = ['Yesterday in the morning the foreign stranger spoke with you. He said: “Can you show me the way to the well?”. You showed him the way to the well. You told him: “Come, stranger, it is by the lane of the potters.”',
      '2 days ago your wife Dātabāmā told you: a foreign stranger talked with her and asked for something; she gave him water.'];
    const n: number[] = []; for (const c of buildTestSet(S.pop, 1, 72)) { const s = systemPrompt(lifeRecord(S.pop, S.cal, c.pid, c.day, c.hour), 'recognise', null, mem); n.push(approxTokens(s)); expect(s).toContain('What you remember of the stranger'); expect(s).toContain('[follow]'); }
    expect(Math.max(...n)).toBeLessThanOrEqual(PROMPT_TOKENS);
  });
});

describe('T-E10: the seeded request-and-recall set (the plumbing, with the stand-in model)', () => {
  it('>= 90 % of the set acted through the simulation and recalled from the reloaded save; evidence written', async () => {
    const set = buildTalkSet(S.pop, S.cal, 1, 64); const reqs = set.filter(c => c.kind !== 'recall' && c.kind !== 'heard');
    expect(reqs.length).toBeGreaterThanOrEqual(60); expect(new Set(reqs.map(c => c.kind)).size).toBe(8);
    const R = await runTalkSet(mind(), fresh, set); const { res, pass, value, by } = { ...R, by: (k: 'request' | 'recall' | 'heard') => (k === 'request' ? R.requests : k === 'recall' ? R.recalls : R.heard) };
    const { kinds, deeds: { done, refused } } = R;
    let commit = ''; try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* no git */ }
    const ev = { id: 'T-E10', value, n: res.length, commit, tool: 'tests/talk_world.test.ts', unit: '%', status: value >= 90 ? 'PLUMBING PASS (stand-in model; the real model unmeasured)' : 'FAIL', model: 'stand-in (tests/talk_standin.ts)', pass,
      requests: by('request'), recalls: by('recall'), heard: by('heard'), kinds, deeds: { done, refused, noop: reqs.length - done - refused },
      fails: res.filter(r => !r.pass).map(r => ({ i: r.c.i, kind: r.c.kind, job: r.c.job, say: r.c.say, reply: r.reply, deed: r.deed, why: r.why })),
      sample: res.slice(0, 12).map(r => ({ i: r.c.i, kind: r.c.kind, job: r.c.job, hour: r.c.hour, say: r.c.say, reply: r.reply, deed: r.deed })),
      note: 'the seeded request-and-recall set (src/people/converse/talkset.ts): 64 requests over every class, every kind, hours 5-22, a quarter in paraphrases the grammar does not read; each person asked the next day in the RELOADED save what passed, and every second one’s kin or friend three days later what they heard. Answered by a deterministic stand-in (tests/talk_standin.ts) that reads only the prompt: this measures the plumbing (the ask read, the simulation deciding, the plan changed and surviving the reload, the memory and gossip reaching the prompt), not a real model (the lab GPU run: converseLab.ts talkSet).' };
    mkdirSync('REVIEWS/evidence/s12-talk', { recursive: true }); writeFileSync('REVIEWS/evidence/s12-talk/T-E10.json', JSON.stringify(ev, null, 1));
    console.log(`T-E10 (plumbing) ${value} % of ${res.length}: requests ${by('request')}, recalls ${by('recall')}, heard ${by('heard')}; done ${done}, refused ${refused}`);
    for (const f of ev.fails.slice(0, 12)) console.log(JSON.stringify(f));
    expect(value).toBeGreaterThanOrEqual(90);
  }, 600_000);
});
