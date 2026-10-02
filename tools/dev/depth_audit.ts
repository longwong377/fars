// D-371 (UD-07, UD-08, UD-11; CLAUDE.md "the second question"): the depth audit, renderless. Follow N people drawn at random
// (keyed by seed) for a day on each seed and ask of each: a home, a family, work, a history, reasons, a voice, a conversation
// grounded in their own life, and the day and the year changing around them. Each axis is read off the simulation's own
// state (never the prose) and scored thin / ok by a stated rule; the report lists who is thin where, and the share thin per
// axis over everyone sampled, so the thinnest SYSTEMS are fixed for everyone, not the sampled.
//   npx tsx tools/dev/depth_audit.ts [day=150] [n=20] [seeds=1,7,42] [out=REVIEWS/depth_audit.json]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { lifeRecord } from '../../src/people/converse/life';
import { HOME_LANG } from '../../src/people/exchanges';
import { u01, salt } from '../../src/people/hash';
import type { Seg } from '../../src/people/population';

const [DAY, N] = [Number(process.argv[2] ?? 150), Number(process.argv[3] ?? 20)];
const SEEDS = (process.argv[4] ?? '1,7,42').split(',').map(Number), OUT = process.argv[5] ?? 'REVIEWS/depth_audit.json';
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const AXES = ['home', 'family', 'work', 'history', 'reasons', 'voice', 'talk', 'dayChange', 'yearChange', 'economy', 'ties'] as const;
type Axis = typeof AXES[number];

const people: any[] = [];
for (const seed of SEEDS) {
  const W = new WeatherSystem(seed), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  const t0 = Date.now(); const sim = new PeopleSim(seed, nav, env); sim.jumpTo(DAY * 24 + 12); const P = sim.pop, E = sim.econTo(DAY + 1);
  const pool = P.persons.filter(p => P.present(p.id, DAY)).map(p => p.id);
  const pick = [...pool].sort((a, b) => u01(seed, salt('depth-audit'), a) - u01(seed, salt('depth-audit'), b)).slice(0, N);
  const speechSeen = new Map<string, number>();
  const rows = pick.map(pid => {
    const p = P.persons[pid], age = P.ageOn(pid, DAY), hid = P.home(pid, DAY), H = P.households[hid], L = lifeRecord(P, sim.cal, pid, DAY, 12);
    const plan: Seg[] = P.plan(pid, DAY), other: Seg[] = P.plan(pid, DAY + 177), next: Seg[] = P.plan(pid, DAY + 1);
    const acts = new Set(plan.map(s => s.act)), whys = new Set(plan.map(s => s.why.replace(/\s*\([^)]*\)/g, '')));
    const generic = plan.filter(s => /^(sleep|resting|at home|rest)$/i.test(s.why.trim())).length;
    const work = plan.filter(s => !['sleep', 'eat', 'rest', 'talk', 'walk', 'play', 'wash', 'tend_body'].includes(s.act));
    const eid = `h:${hid}`, ev = E.events.filter(v => v && (v.actor === eid || v.other === eid));
    const sig = (x: Seg[]) => x.map(s => `${s.act}@${Math.round(s.t0)}`).join(',');
    const sp = L.speech.join('|'); speechSeen.set(sp, (speechSeen.get(sp) ?? 0) + 1);
    const facts = { friends: L.friends.length, year: L.year.length, past: L.past.length, quarrels: L.quarrels.length, debts: L.debts.length, events: L.today.events.length, earlier: L.today.earlier.length };
    const r = {
      seed, pid, name: L.name, age, sex: p.sex, job: p.job, origin: p.origin, zone: H?.zone, home: L.home, household: L.household.length, kinHouses: L.kinHouses.length,
      planSegs: plan.length, acts: acts.size, whys: whys.size, generic, workSegs: work.length, workPlaces: new Set(work.map(s => s.place)).size,
      year: L.year, past: L.past, facts, language: L.language || HOME_LANG[p.origin], temperament: L.temperament, speech: L.speech,
      sameNextDay: sig(plan) === sig(next), sameOtherSeason: sig(plan) === sig(other), actsOtherSeason: new Set(other.map(s => s.act)).size,
      econEvents: ev.length, econKinds: [...new Set(ev.map(v => v.kind))].slice(0, 12), econDebts: E.hh.get(eid)?.debts.length ?? null,
      ties: p.ties.length, debtsSeeded: L.debts.length > 0 && !(E.hh.get(eid)?.debts.length),
      today: L.today.now, first: plan.slice(0, 10).map(s => `${s.t0.toFixed(1)} ${s.act} @${s.place}: ${s.why.replace(/\s*\([^)]*\)/g, '')}`),
    } as any;
    const thin: Partial<Record<Axis, string>> = {};
    if (!H || !H.home) thin.home = 'no home';
    if (r.household <= 1 && r.kinHouses === 0) thin.family = 'alone, no kin houses';
    if (age >= 14 && r.workSegs === 0 && p.job !== 'elder') thin.work = 'no work in the day';
    if (age >= 14 && r.year.length === 0 && r.past.length < 2) thin.history = r.past.length ? 'nothing this year, one thing before' : 'nothing has ever happened to them';
    if (r.whys / Math.max(1, r.planSegs) < 0.5 || r.generic > r.planSegs / 2) thin.reasons = `${r.whys} reasons for ${r.planSegs} parts`;
    if (!r.language || !r.speech.length) thin.voice = 'no language or speech';
    if (facts.friends + facts.year + facts.past + facts.quarrels + facts.events + facts.earlier < 3) thin.talk = `only ${facts.friends + facts.year + facts.past + facts.quarrels + facts.events + facts.earlier} facts to speak from`;
    if (r.sameNextDay) thin.dayChange = 'tomorrow the same to the hour';
    if (r.sameOtherSeason) thin.yearChange = 'the same day half a year on';
    if (H?.zone !== 'transient' && r.econEvents === 0) thin.economy = 'no economic event in the house this year';
    if (r.ties === 0 && facts.friends === 0) thin.ties = 'no friend or tie';
    if (r.debtsSeeded) thin.talk = (thin.talk ? thin.talk + '; ' : '') + 'debts spoken of are seeded, not the economy\'s';
    r.thin = thin; return r;
  });
  for (const r of rows) r.speechShared = speechSeen.get(r.speech.join('|'))! - 1;
  people.push(...rows); console.error(`seed ${seed}: ${rows.length} people, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
const share: Record<string, number> = {}; for (const a of AXES) share[a] = +(people.filter(r => r.thin[a]).length / people.length).toFixed(3);
const out = { tool: 'tools/dev/depth_audit.ts', day: DAY, n: N, seeds: SEEDS, generated: new Date().toISOString(), thinShare: share, people };
mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(share));
for (const r of people) console.log(`${r.seed}/${r.pid} ${r.name ?? '(unnamed)'} ${r.age}${r.sex} ${r.job} ${r.zone}: ${Object.entries(r.thin).map(([k, v]) => `${k}: ${v}`).join('; ') || 'ok'}`);
