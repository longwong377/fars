// Music lint (brief §11 "verify each claim and record it in SOUNDSCAPE.md"; §3.2 tiers; D-178): no music plays in the
// world without a tiered, recorded source. Fails (exit 1) when:
//  - a claim id the code cites (src/audio/musicClaims.ts) is not a row of research/SOUNDSCAPE.md §8, or the row's tier
//    column does not carry the code's tier, or a source key does not resolve in src/data/sources.json;
//  - a claim marked never-performed (the rejected ones) is citable;
//  - a tuning mode or an instrument has no tier or cites an unknown claim;
//  - the schedule (src/audio/performers.ts), swept over a year's sample of days with every kind of performer present and
//    the court resident, yields a gig without claims, a performance the runtime rules refuse, anything at an offering but
//    the chanting magus's wordless recitative (D-209: M-06, M-23),
//    or an instrument other than the court harp, the herders' reed pipe (D-200) and the women's frame drum at a wedding or a
//    festival evening (D-211), or a drum beaten by anyone but a woman singing to it, or a herd pipe played by anyone but a
//    man of 14-55 of a transhumant band;
//  - anything outside the music system and its director (the schedule's player) calls `.perform(`;
//  - an instrument's name is on the anachronism blocklist's music clichés.
// Run: npm run lint:music (part of npm run lint:all).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MUSIC_CLAIMS, NOT_PERFORMED } from '../src/audio/musicClaims';
import { MESOPOTAMIAN_MODES, GREEK_MODES } from '../src/audio/tuning';
import { INSTRUMENTS } from '../src/audio/instruments';
import { musicAt, soundingParts, type PerformerAgent, type PopPerformer } from '../src/audio/performers';
import { refusal } from '../src/audio/music';

const bad: string[] = [];
const md = readFileSync('research/SOUNDSCAPE.md', 'utf8'), sec = md.slice(md.indexOf('## 8. Music in the world'));
const rows = new Map<string, string[]>();
for (const line of sec.split('\n')) { const m = /^\| (M-\d\d) \|/.exec(line); if (m) rows.set(m[1], line.split('|').slice(1, -1).map(x => x.trim())); }
const sources = JSON.parse(readFileSync('src/data/sources.json', 'utf8'));
for (const c of Object.values(MUSIC_CLAIMS)) {
  const r = rows.get(c.id); if (!r) { bad.push(`${c.id}: cited by the code, no row in SOUNDSCAPE §8`); continue; }
  if (!r[3].includes(c.tier)) bad.push(`${c.id}: code tier ${c.tier}, SOUNDSCAPE tier column "${r[3]}"`);
  for (const k of c.src) if (!sources[k]) bad.push(`${c.id}: source key ${k} not in sources.json`);
}
for (const id of NOT_PERFORMED) { if (!rows.has(id)) bad.push(`${id}: never-performed claim has no SOUNDSCAPE row`); if (MUSIC_CLAIMS[id]) bad.push(`${id}: never-performed claim is citable`); }
for (const m of [...MESOPOTAMIAN_MODES, ...GREEK_MODES]) { if (!/[ABC]/.test(m.tier)) bad.push(`mode ${m.id}: no tier`); for (const c of m.claims) if (!MUSIC_CLAIMS[c]) bad.push(`mode ${m.id}: unknown claim ${c}`); }
for (const i of Object.values(INSTRUMENTS)) if (!/[ABC]/.test(i.tier) || !sources[i.src]) bad.push(`instrument ${i.id}: tier "${i.tier}" / source ${i.src}`);
const block = JSON.parse(readFileSync('src/data/blocklist.json', 'utf8'));
const cliches: string[] = block.entries.find((e: any) => e.id === 'music-cliche')?.terms ?? [];
if (!cliches.length) bad.push('blocklist: no music-cliche entry');
for (const i of Object.values(INSTRUMENTS)) for (const t of cliches) if (`${i.id} ${i.name}`.toLowerCase().includes(t)) bad.push(`instrument ${i.id}: blocklisted "${t}"`);

// the schedule, with every kind of performer present and the court resident
const P = (id: number, role: string, origin: string, sex: 'm' | 'f', act: string, place: string): PerformerAgent => ({ id, role, origin, sex, seed: 11 * id + 3, offmap: false, walking: false, task: { act, place }, pos: [id, id], y: 0 });
const cast = [P(0, 'grinder', 'Persian', 'f', 'grind', 'querns'), P(1, 'grinder', 'Elamite', 'f', 'grind', 'querns'), P(2, 'mason', 'Ionian', 'm', 'dress_stone', 'worksite'),
  P(3, 'mason', 'Egyptian', 'm', 'dress_stone', 'worksite'), P(4, 'magus', 'Persian', 'm', 'offer', 'offering_place'), P(5, 'guard', 'Persian', 'm', 'gamble', 'garrison'), P(6, 'herder', 'Persian', 'm', 'herd', 'plain')];
// the population's people out of doors (D-200): band men by the evening fire and at the midday halt, a band woman, an old man
// and a boy, a magus at the offering place, a village herder with the flock
const Q = (pid: number, over: Partial<PopPerformer>): PopPerformer => ({ pid, sex: 'm', age: 30, act: 'talk', why: 'by the fire with the band', place: 'camp:band1:0', e: 0, n: 0, y: 0, moving: false, seed: pid, ...over });
const popCast = [Q(100, {}), Q(101, {}), Q(102, { sex: 'f' }), Q(103, { age: 62 }), Q(104, { age: 9 }), Q(105, { act: 'rest', why: 'resting while the flock lies up at midday', place: 'route:band1:1' }),
  Q(106, { act: 'offer', why: 'the lan', place: 'offering_place' }), Q(107, { act: 'herd', why: 'minding the household’s animals', place: 'plain' }),
  // (D-211: women singing to the frame drum at a wedding's dusk and on a festival evening; a man and a girl beside them do not play)
  Q(108, { sex: 'f', age: 30, why: 'singing and beating the frame drum for the bride with the women, in the courtyard', place: 'h:12' }), Q(109, { sex: 'f', age: 45, why: 'singing and beating the frame drum for the bride with the women, in the courtyard', place: 'h:12' }),
  Q(110, { sex: 'f', age: 22, why: 'singing and clapping with the women of the lane to the frame drum, a festival evening', place: 'lane:q_1' }), Q(111, { sex: 'm', age: 30, why: 'at the wedding in the courtyard while the women sing and drum', place: 'h:12' }),
  Q(112, { sex: 'f', age: 9, why: 'singing and clapping with the women of the lane to the frame drum', place: 'lane:q_1' }),
  // D-209: a magus chanting at the fire, and one at an offering who does not chant (Q106 above), a woman "chanting" (never scheduled)
  Q(113, { act: 'chant', why: 'chanting at the fire, the mouth covered, without words', place: 'offering_place:altar' }), Q(114, { act: 'chant', sex: 'f', place: 'offering_place' })];
const chanters = new Set([113]);
const pipers = new Set([100, 101, 105]), drummers = new Set([108, 109, 110]);
let gigs = 0; const kinds = new Set<string>();
for (let d = 0; d < 360; d += 9) for (let m = 0; m < 24 * 60; m += 2) {
  const t = d * 24 + m / 60;
  for (const g of musicAt(cast, { t, seed: 1, courtToday: true, courtYesterday: true, sun: { rise: 6, set: 18.5 }, foul: false, courtHall: { cx: 0, cy: 0, sx: 20, sy: 20, fl: 0 } }, popCast)) {
    gigs++; kinds.add(g.kind);
    if (!g.claims.length) bad.push(`gig ${g.id}: no claims`);
    for (const p of soundingParts(g)) {
      const why = refusal(p.perf!, true, { x: p.pos.e, y: p.pos.y, z: -p.pos.n }); if (why) bad.push(`gig ${g.id} ${p.key}: refused (${why})`);
      if (p.perf!.context === 'offering' && (g.kind !== 'magus_chant' || p.pid == null || !chanters.has(p.pid) || p.perf!.instrument !== 'voice' || p.perf!.style !== 'recitative')) bad.push(`gig ${g.id}: music at an offering other than the magus's wordless chant`);
      if (g.kind === 'magus_chant' && p.perf!.context !== 'offering') bad.push(`gig ${g.id}: the chant outside the offering context`);
      if (p.perf!.instrument !== 'voice' && !(p.perf!.instrument === 'harp' && p.perf!.context === 'court') && !(p.perf!.instrument === 'reed_pipe' && p.perf!.context === 'herding') && !(p.perf!.instrument === 'frame_drum' && p.perf!.context === 'leisure' && g.kind === 'women_drum')) bad.push(`gig ${g.id}: ${p.perf!.instrument} (${p.perf!.context}) has no source`);
      if (p.perf!.instrument === 'reed_pipe' && (p.pid == null || !pipers.has(p.pid))) bad.push(`gig ${g.id}: a pipe played by ${p.pid ?? p.agentId} (only band men of 14-55)`);
      if (p.pid != null && !(g.kind === 'herder_pipe' ? pipers : g.kind === 'women_drum' ? drummers : g.kind === 'magus_chant' ? chanters : new Set<number>()).has(p.pid)) bad.push(`gig ${g.id}: population person ${p.pid} plays (no source)`);
      if (!p.play) bad.push(`gig ${g.id} ${p.key}: nothing shown playing (playing.ts)`);
      if (p.agentId != null && [4, 5, 6].includes(p.agentId)) bad.push(`gig ${g.id}: ${cast[p.agentId].role} plays (no source)`);
    }
  }
}
for (const k of ['quern_song', 'mason_song', 'court_supper', 'court_night', 'herder_pipe', 'magus_chant', 'women_drum']) if (!kinds.has(k)) bad.push(`schedule: ${k} never occurred in the sweep`);
// who may start a performance
const allowed = new Set(['src/audio/music.ts', 'src/audio/musicDirector.ts']); // the system itself and the schedule's player
const walk = (dir: string): string[] => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : []; });
for (const f of walk('src')) { const rel = f.split('\\').join('/'); if (/\.perform\(/.test(readFileSync(f, 'utf8')) && !allowed.has(rel)) bad.push(`${rel}: calls .perform( outside the scheduled music`); }

if (bad.length) { console.error(`lint:music FAIL — ${bad.length} problem(s):\n  ${bad.join('\n  ')}`); process.exit(1); }
console.log(`lint:music OK — ${Object.keys(MUSIC_CLAIMS).length} claims recorded and tiered (${NOT_PERFORMED.length} never performed), ${MESOPOTAMIAN_MODES.length + GREEK_MODES.length} modes, ${Object.keys(INSTRUMENTS).length} instruments; schedule sweep: ${gigs} gig-minutes (${[...kinds].join(', ')}), all sourced`);
