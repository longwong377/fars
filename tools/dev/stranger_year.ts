// D-370: a scripted stranger's year on the bare economy (3 seeds): what the six mechanics do over a year, measured.
// The script is a plausible life, not a test path: arrive, say who you are, ask guest-right where it is given, work the
// harvest where hands are wanted, learn the tongue by living and working, ask an official for a sealed document, join a
// gang when the harvest is in, give back to the hosts, petition for wages owed. Every ask goes through judge() first, as
// the talk would. Reported: verdicts, events by kind, the chains the stranger enters, the share of the stranger's deeds that
// reach at least one other house (T-E13's second part), comprehension, the claim's reach, the stranger's standing.
//   npx tsx tools/dev/stranger_year.ts [seeds=1,7,42]
import { Population } from '../../src/people/population';
import { Economy } from '../../src/people/economy/world';
import { householdsOf, chains } from '../../src/people/economy/chains';
import { PLAYER, STR_LAG, type SAct } from '../../src/people/speech/stranger';

const SEEDS = (process.argv[2] ?? '1,7,42').split(',').map(Number);
const out: any[] = [];
for (const seed of SEEDS) {
  const hs = householdsOf(new Population(seed)), E = new Economy(seed, hs, { trust: true }), S = E.stranger();
  const tries: Record<string, [number, number]> = {}; const ask = (s: SAct) => { const v = S.judge(s); const k = s.a + (s.a === 'join' ? ':' + (s as any).kind : s.a === 'petition' ? ':' + (s as any).kind : ''); tries[k] ??= [0, 0]; tries[k][0]++; if (v.ok) { const d = S.do(s); if (d.ok) tries[k][1]++; return d.ok; } return false; };
  const H = [...E.hh.values()]; let first = '';
  for (let d = 0; d < 354; d++) {
    E.step(d);
    if (d === 20) { first = H.find(h => h.kind === 'farmer' && S.stayCheck(h.id, d).ok)?.id ?? H[0].id; ask({ a: 'claim', day: d, hh: first, role: 'pilgrim', origin: 'Babylonian' }); ask({ a: 'stay', day: d, hh: first }); }
    // the harvest: ask the host first, then the lane's farms, for work
    if (d >= 30 && d <= 80 && !S.job && d % 2 === 0) { const q = E.hh.get(first)!.q; for (const h of [E.hh.get(first)!, ...H.filter(x => x.q === q && x.kind === 'farmer')].slice(0, 12)) if (ask({ a: 'seek_work', day: d, hh: h.id })) break; }
    if (S.job || S.group) S.do({ a: 'attend', day: d });
    S.do({ a: 'hear', day: d, lang: S.langOf(first), hours: 0.5, simple: 0.5, spoke: true }); // a half hour of talk a day with the people met
    if (d === 60) ask({ a: 'petition', day: d, to: 'official', kind: 'leave', gift: 0.2 });
    if (d === 90 && S.stay) { S.do({ a: 'leave_stay', day: d }); ask({ a: 'give', day: d, hh: first, grain: Math.min(S.purse.grain, 20) }); }
    if (d === 95) { S.do({ a: 'quit', day: d }); ask({ a: 'join', day: d, kind: 'gang' }); }
    if (d > 95 && d % 30 === 0) { const owed = E.events.filter(v => v && v.kind === 'wage_owed' && v.other === PLAYER).map(v => v.actor); if (owed.length) ask({ a: 'petition', day: d, to: 'headman', kind: 'wages', against: owed[owed.length - 1], q: E.hh.get(owed[owed.length - 1])!.q }); }
    if (d === 200) { S.do({ a: 'leave_group', day: d }); const h = H.find(x => x.id !== first && x.kind === 'farmer' && S.stayCheck(x.id, d).ok); if (h) ask({ a: 'stay', day: d, hh: h.id }); }
    if (d === 210 && S.stay) S.do({ a: 'leave_stay', day: d }); // no thanks this time: ingratitude
  }
  for (let d = 354; d < 354 + STR_LAG + 31; d++) E.step(d);
  const mine = E.events.filter(v => v && (v.actor === PLAYER || v.other === PLAYER)), kinds: Record<string, number> = {}; for (const v of mine) kinds[v.kind] = (kinds[v.kind] ?? 0) + 1;
  const cs = chains(E.events).filter(c => c.actors.includes(PLAYER));
  // reach: a stranger event that is the cause of an event of another house or system (not the stranger alone)
  const child = new Map<number, string[]>(); for (const v of E.events) if (v) for (const c of v.causes) (child.get(c) ?? child.set(c, []).get(c)!).push(v.actor === PLAYER ? v.other ?? '' : v.actor);
  const reached = mine.filter(v => (child.get(v.id) ?? []).some(a => a && a !== PLAYER) || (v.actor !== PLAYER && v.actor !== 'court' && v.actor !== 'treasury')).length;
  const r = S.claimReach();
  out.push({ seed, tries, events: mine.length, kinds, chains: cs.length, shapes: [...new Set(cs.map(c => c.shape))].slice(0, 8), longest: Math.max(0, ...cs.map(c => c.path.length)),
    reachShare: +(reached / Math.max(1, mine.length)).toFixed(3), comp: Object.fromEntries([...S.lang.keys()].map(l => [l, +S.comp(l, 354).toFixed(2)])), claim: r, halmi: S.halmi, purse: { grain: +S.purse.grain.toFixed(1), cash: +S.purse.cash.toFixed(3) },
    standing: +(E.trust!.standing(PLAYER, 354)).toFixed(3), firstHostTrust: +E.trust!.trustOf(first, PLAYER, 354).toFixed(3) });
}
console.log(JSON.stringify(out, null, 1));
