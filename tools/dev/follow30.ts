// D-720 (UD-07, UD-08, UD-11, UD-21..26, UD-32; CLAUDE.md "the second question"): FOLLOW THIRTY. Walk up to anyone and follow
// them for a day: thirty people drawn at random (keyed by seed) across the world's kinds of life (the town, the villages of the
// plain, the Terrace's staff, the road's folk, the court in residence, the camps and bands), each followed through the day, the
// next day and the same day a season on, and asked five things through the talk layer as a player meets it in the cloud and on
// any machine without the model (talkTurn with the deterministic answerer, converse/ownlines.ts), with the prompt path checked
// too (what the model would be told: the life fact next to each question, ground.ts). Every thin spot is logged by a stated
// rule; the table is the before/after of the bulk fixes. Renderless, node only.
//   npx tsx tools/dev/follow30.ts [day=60] [out=REVIEWS/follow30.json] [mode=own|old]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { simAt } from '../../tests/sim_fixture';
import { lifeRecord, type LifeRecord } from '../../src/people/converse/life';
import { groundFact } from '../../src/people/converse/ground';
import { messages, approxTokens } from '../../src/people/converse/prompt';
import { talkTurn } from '../../src/people/converse/turn';
import { u01, salt } from '../../src/people/hash';
import type { Seg } from '../../src/people/population';
import type { PeopleSim } from '../../src/people/sim';
import { latelyOf, toYou } from '../../src/people/deeds/lately';

const DAY = Number(process.argv[2] ?? 60), OUT = process.argv[3] ?? 'REVIEWS/follow30.json', MODE = process.argv[4] ?? 'own';
const SEEDS = [1, 7, 42], SEASON = 91;
const OPTS = { court: true, bonds: true, asks: true }; // (the world as the game builds it: world.ts)
/** the five things asked of everyone, and what a reply must touch to be grounded in the asker's life */
const QS: { q: string; key: string }[] = [
  { q: 'Who are you?', key: 'who' }, { q: 'Who lives in your house?', key: 'family' }, { q: 'What work do you do?', key: 'work' },
  { q: 'What has happened to you this year?', key: 'year' }, { q: 'What troubles you?', key: 'cares' },
];
const KINDS = ['town', 'village', 'terrace', 'road', 'court', 'camp'] as const;
type Kind = typeof KINDS[number];
const TERRACE_JOBS = new Set(['guard', 'caretaker', 'treasury', 'storekeeper', 'official', 'scribe', 'priest', 'servant']);
function kindOf(sim: PeopleSim, pid: number, day: number): Kind | null {
  const P = sim.pop, p = P.persons[pid], H = P.households[P.home(pid, day)]; if (!H) return null;
  if (P.court && pid >= P.court.first && pid < P.court.end) return 'court';
  if (p.job === 'traveller' || p.job === 'messenger' || p.job === 'groom' || H.q.startsWith('road:')) return 'road';
  if (p.job === 'herder' || p.job === 'camp' || p.job === 'builder' || H.zone === 'transient') return 'camp';
  if (TERRACE_JOBS.has(p.job) || H.zone === 'terrace') return 'terrace';
  if (H.zone === 'plain') return 'village';
  return 'town';
}
const STOP = new Set('about after again their there these those which while where would could should other being house household stranger little before every under years first today still the and with from that this have your what when them they into over some more than just been were will only like make made such each also even most'.split(' '));
const words = (s: string) => new Set((s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-zšθčçžāīū’]{4,}/g) ?? []).filter(w => !STOP.has(w)));
const names = (L: LifeRecord) => [...L.household.map(k => k.name), ...L.kinHouses.map(k => k.replace(/’s house.*/, '')), ...L.friends.map(f => f.name)].filter(n => n && n !== 'unnamed');
/** the facts a grounded reply to each question draws on (any one shared content word, or a name, counts) */
function sources(L: LifeRecord, key: string): string[] {
  switch (key) {
    case 'who': return [L.name, L.origin, L.job, L.byname ?? ''];
    case 'family': return [...names(L), ...L.household.map(k => k.rel), L.group ?? ''];
    case 'work': return [L.job, L.group ?? '', L.today.now];
    case 'year': return [...L.year, ...L.past, ...L.quarrels, ...(L.lately ?? []), ...(L.yesterday ?? []), ...L.today.events.slice(0, 2)];
    default: return [...L.worries, ...L.hopes, ...L.needs, ...L.quarrels, ...L.debts];
  }
}
function grounded(L: LifeRecord, key: string, reply: string): boolean {
  const src = sources(L, key).filter(Boolean); if (!src.length) return false;
  const r = reply.toLowerCase(); if (names(L).some(n => n.length > 2 && r.includes(n.toLowerCase())) && key !== 'who' && key !== 'work') return true;
  if (key === 'who' && !r.includes(L.name.toLowerCase())) return false;
  const rw = words(reply), sw = new Set(src.flatMap(s => [...words(s)])); for (const w of rw) if (sw.has(w)) return true; return false;
}
const DEFAULT_FACT = /^right now: /;
const msgs0 = (L: LifeRecord) => messages(L, 'none', [], 'What has happened lately?')[0].content;
const NON_WORK = new Set(['sleep', 'eat', 'rest', 'talk', 'walk', 'play', 'wash', 'tend_body']);
/** what is not the person's work, for the job check (leisure and the day's chores) */
const NOT_JOB = new Set([...NON_WORK, 'gamble', 'cook', 'queue', 'offmap', 'pray', 'visit']);

async function main() {
  const rows: any[] = [];
  for (const seed of SEEDS) {
    const t0 = Date.now(); const sim = simAt(seed, DAY - 5, 12, OPTS); sim.jumpTo(DAY * 24 + 12); // (five days run live: the minds' deeds are in the log as in a game played on) console.error(`seed ${seed}: world at day ${DAY} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    const P = sim.pop; const byKind = new Map<Kind, number[]>(KINDS.map(k => [k, []]));
    for (const p of P.persons) { if (!P.present(p.id, DAY) || P.ageOn(p.id, DAY) < 6) continue; const k = kindOf(sim, p.id, DAY); if (k) byKind.get(k)!.push(p.id); }
    // ten from each seed: the six kinds in turn, the order of the kinds rotated by the seed (thirty over three seeds, five a kind)
    const rot = SEEDS.indexOf(seed) * 4, order = Array.from({ length: 10 }, (_, i) => KINDS[(i + rot) % KINDS.length]);
    const taken = new Set<number>();
    for (const kind of order) {
      const pool = byKind.get(kind)!.filter(x => !taken.has(x)); if (!pool.length) { rows.push({ seed, kind, missing: true }); continue; }
      const pid = [...pool].sort((a, b) => u01(seed, salt('follow30'), a) - u01(seed, salt('follow30'), b))[0]; taken.add(pid);
      sim.t = DAY * 24 + 12;
      const L = lifeRecord(P, sim.cal, pid, DAY, 12), p = P.persons[pid], age = P.ageOn(pid, DAY);
      const plan: Seg[] = P.plan(pid, DAY), next: Seg[] = P.plan(pid, DAY + 1), later: Seg[] = P.plan(pid, DAY + SEASON);
      const sig = (x: Seg[]) => x.map(s => `${s.act}@${Math.round(s.t0)}`).join(',');
      const work = plan.filter(s => !NON_WORK.has(s.act)), whys = new Set(plan.map(s => s.why.replace(/\s*\([^)]*\)/g, '')));
      const day = plan.map(s => `${s.t0.toFixed(1)} ${s.act} @${s.place}: ${s.why.replace(/\s*\([^)]*\)/g, '').slice(0, 70)}`);
      const deedsOf = latelyOf({ minds: sim.deeds.minds, rec: i => sim.deeds.rec(i), name: a => typeof a === 'number' ? (P.nameOf(a) ?? 'someone').replace(/^\*/, '') : 'the stranger' }, pid, DAY, 6);
      const job = plan.filter(s => !NOT_JOB.has(s.act));
      // the five questions: the prompt path (the fact the model is told) and the reply a player meets without the model
      const talk: any[] = []; const conv = sim.t; const own = MODE === 'old' ? null : new (await import('../../src/people/converse/ownlines')).OwnMind(); // (one mind a talk, as ui.ts keeps it)
      for (const { q, key } of QS) {
        const fact = groundFact(L, q), msgs = messages(L, 'none', [], q), tokens = approxTokens(msgs[0].content); // (the system prompt's budget: prompt.ts PROMPT_TOKENS)
        const factOk = !DEFAULT_FACT.test(fact) || key === 'work';
        let reply: string;
        if (MODE === 'old') reply = talk.length === 0 ? 'Greetings, stranger.' : 'I do not understand you, stranger.'; // (ui.ts ownLine before D-720)
        else { const T = await talkTurn(own!, sim, pid, q, { conv }); reply = T.answer.ok ? T.answer.text : `(${T.answer.text})`; }
        talk.push({ q, key, fact, factOk, tokens, reply, grounded: grounded(L, key, reply) });
      }
      const thin: Record<string, string> = {};
      if (!L.home || /^(nowhere|unknown)/.test(L.home)) thin.home = 'no home';
      if (L.household.length === 0 && L.kinHouses.length === 0 && !L.group) thin.kin = 'no house, no kin, no group';
      if (age >= 14 && !['homemaker', 'elder', 'child'].includes(p.job) && job.length === 0 && !plan.some(s => s.act === 'offmap')) thin.work = `a job that is a label: no work in the day (${p.job}: ${[...new Set(plan.map(s => s.act))].join(',')})`;
      if (sig(plan) === sig(next)) thin.loop = 'tomorrow the same to the hour';
      if (sig(plan) === sig(later) && later.length) thin.season = 'the same day a season on';
      if (whys.size < Math.max(3, plan.length / 3)) thin.reasons = `${whys.size} reasons for ${plan.length} parts`;
      if (age >= 14 && L.year.length === 0 && L.past.length < 2) thin.history = 'nothing ever happened to them';
      const notTalk = talk.filter(t => !t.grounded); if (notTalk.length) thin.replies = `${notTalk.length}/5 replies ignore their life (${notTalk.map(t => t.key).join(',')})`;
      const badFact = talk.filter(t => !t.factOk); if (badFact.length) thin.prompt = `${badFact.length}/5 questions get no fact of their own (${badFact.map(t => t.key).join(',')})`;
      if (L.worries.length + L.hopes.length + L.needs.length === 0) thin.cares = 'no hope, worry or need';
      const sys = msgs0(L);
      if (deedsOf.length && !deedsOf.some(x => sys.includes(toYou(x).split(',')[0].split(' ').slice(0, 3).join(' ')))) thin.deeds = `${deedsOf.length} deeds by, to or before them lately never reach their talk (${deedsOf[0]})`;
      else if (!deedsOf.length && L.year.length === 0 && L.quarrels.length === 0) thin.deeds = 'nothing done by or to them this year that they know of';
      const odd = [...L.news, ...L.year].filter(x => /heard of [a-z_]+ the house|grain or help|^heard of [a-z]+_[a-z]+/.test(x)); if (odd.length) thin.words = `broken words in the life: ${odd[0]}`;
      if (P.court && pid >= P.court.first && pid < P.court.end && L.year.some(y => /newly sent work group/.test(y))) thin.history = (thin.history ? thin.history + '; ' : '') + 'a courtier told he came with a work group';
      if (L.friends.length === 0 && !plan.every(s => s.act === 'offmap' || s.act === 'walk' || s.act.startsWith('carry'))) thin.ties = 'no friend';
      const over = talk.filter(t => t.tokens > 450); if (over.length) thin.prompt = (thin.prompt ? thin.prompt + '; ' : '') + `prompt over budget (${over[0].tokens})`;
      rows.push({ seed, kind, pid, name: L.name, byname: L.byname, age, sex: p.sex, job: p.job, origin: L.origin, home: L.home, household: L.household.length, kinHouses: L.kinHouses.length, friends: L.friends.length,
        year: L.year, past: L.past.length, worries: L.worries, hopes: L.hopes, needs: L.needs, news: L.news, lately: deedsOf, said: (L as any).lately ?? [],
        plan: { parts: plan.length, whys: whys.size, work: work.length, places: new Set(plan.map(s => s.place)).size, sameNext: sig(plan) === sig(next), sameSeason: sig(plan) === sig(later), day },
        talk, thin });
    }
  }
  const people = rows.filter(r => !r.missing), axes = [...new Set(people.flatMap(r => Object.keys(r.thin)))].sort();
  const share = Object.fromEntries(axes.map(a => [a, +(people.filter(r => r.thin[a]).length / people.length).toFixed(3)]));
  const repliesGrounded = +(people.flatMap(r => r.talk).filter((t: any) => t.grounded).length / (people.length * 5)).toFixed(3);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ tool: 'tools/dev/follow30.ts', day: DAY, season: SEASON, mode: MODE, generated: new Date().toISOString(), repliesGrounded, thinShare: share, missing: rows.filter(r => r.missing), people }, null, 1) + '\n');
  console.log(JSON.stringify({ repliesGrounded, thinShare: share }));
  for (const r of people) console.log(`${r.seed}/${r.pid} [${r.kind}] ${r.name} ${r.age}${r.sex} ${r.job}: ${Object.entries(r.thin).map(([k, v]) => `${k}: ${v}`).join('; ') || 'ok'}`);
}
void main();
