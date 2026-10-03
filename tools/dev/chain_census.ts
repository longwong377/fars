// D-720 (UD-24..26, UD-32: "a bad harvest, dearer bread, hunger, a petition, a theft, a punishment, with or without the player"):
// THE CONSEQUENCE CHAINS, counted. A world run live for 30 days with nobody in it but its own people (no stranger), and what the
// days did to each other read off the simulation's own records:
//   - the economy's causal chains (economy/chains.ts: >= 3 events over >= 2 actors, deduplicated by shape), by family: want
//     (a harvest or a dear market into hunger, then a petition, relief, help, a sale or a theft), justice (a theft into an arrest,
//     a suit, a judgement), debt (a loan into default, a pledge, debt labour, repayment), care (illness into nursing, death,
//     mourning), and the rest;
//   - each link of the famine chain: is hunger caused by the harvest or the price; theft by hunger; petition or relief by hunger;
//     punishment by theft;
//   - the deeds' own chains: law cases opened and ruled, goals pursued step by step (initiative stats chains by depth), and
//     favours repaid (a gift or help whose doer had been helped by the other: minds' gratitude acted on);
//   - rumours: born, told, carried past the first hand, changed in the carrying (a version unlike the truth);
//   - debts called in (defaults, pledges, suits, debt labour, repayments) and the living world's talk between houses by kind
//     (news, loans, work, trade, help, visits: a house taking another in).
//   npx tsx tools/dev/chain_census.ts [day0=150] [days=30] [seed=1] [out]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { simAt } from '../../tests/sim_fixture';
import { chains } from '../../src/people/economy/chains';

const D0 = Number(process.argv[2] ?? 150), N = Number(process.argv[3] ?? 30), SEED = Number(process.argv[4] ?? 1), OUT = process.argv[5];
const t0 = Date.now(); const sim = simAt(SEED, D0, 12, { asks: true, bonds: true }); console.error(`world at day ${D0} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const deeds0 = sim.deeds.next, agency0 = JSON.parse(JSON.stringify(sim.deeds.agency.stats.chains)), cases0 = sim.deeds.cases.length;
const R = sim.asksWorld.rumours, rum0 = R ? R.rumours.length : 0, tell0 = R ? R.stats.tellings : 0;
const t1 = Date.now(); sim.jumpTo((D0 + N) * 24 + 12); console.error(`${N} days live in ${((Date.now() - t1) / 1000).toFixed(0)} s`);
const E = sim.econTo(D0 + N), evs = E.events.filter(e => e && e.day >= D0 && e.day < D0 + N);
const byId = new Map(E.events.filter(Boolean).map(e => [e.id, e]));
const kinds: Record<string, number> = {}; for (const e of evs) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
// the economy's chains whose leaf falls in the window
const C = chains(E.events).filter(c => { const l = byId.get(c.leaf); return !!l && l.day >= D0 && l.day < D0 + N; });
const fam = (shape: string) => /theft|robbed|arrest|suit|beaten|fined|acquitted/.test(shape) ? 'justice' : /hunger|relief|petition|harvest_poor|grain_dear|blight|kin_help|neighbours_help/.test(shape) ? 'want'
  : /loan|default|pledge|debt_labour|repaid|bound_labour|land_sold/.test(shape) ? 'debt' : /illness|death|mourning|nursed/.test(shape) ? 'care' : 'other';
const families: Record<string, number> = {}; for (const c of C) families[fam(c.shape)] = (families[fam(c.shape)] ?? 0) + 1;
const longest = [...C].sort((a, b) => b.path.length - a.path.length).slice(0, 6).map(c => c.shape);
// the famine chain's links: an event of kind B with a cause (directly) of kind A
const link = (a: RegExp, b: RegExp) => evs.filter(e => b.test(e.kind) && e.causes.some(c => a.test(byId.get(c)?.kind ?? ''))).length;
const links = {
  'harvest/price -> hunger': link(/harvest_poor|blight|grain_dear|tithe_short|ration_cut/, /^hunger$/), 'hunger -> petition/relief': link(/^hunger$/, /petition|relief/),
  'hunger -> theft': link(/^hunger$/, /^theft$/), 'hunger -> help (kin, neighbours)': link(/^hunger$/, /kin_help|neighbours_help|given|food/),
  'hunger -> sale/loan': link(/^hunger$/, /^sell$|loan|land_sold/), 'theft -> arrest/suit': link(/^theft$|robbed/, /arrest|suit/) + evs.filter(e => /arrest|suit/.test(e.kind) && e.causes.some(c => { const a = byId.get(c); return !!a && a.kind === 'accusation' && a.causes.some(x => /^theft$|robbed/.test(byId.get(x)?.kind ?? '')); })).length, // (by way of the accusation) 'arrest/suit -> punishment': link(/arrest|suit/, /beaten|fined|debt_labour|acquitted|time_granted/),
  'loan -> default/pledge/repaid': link(/^loan$/, /default|pledge_seized|repaid|debt_labour/), 'illness -> nursing/death': link(/illness/, /nursed_by_kin|death/),
};
// the deeds' own chains
const recs = sim.deeds.log.filter(r => r.id >= deeds0), dv: Record<string, number> = {}; for (const r of recs) dv[r.deed.verb] = (dv[r.deed.verb] ?? 0) + 1;
const ag = sim.deeds.agency.stats.chains as Record<number, number>, goalsDeep = Object.entries(ag).reduce((s, [k, v]) => s + (Number(k) >= 2 ? v - (agency0[k] ?? 0) : 0), 0);
const cases = sim.deeds.cases.slice(cases0), ruled = cases.filter(c => (c as any).ruled).length;
// favours repaid: a kindness whose doer had a kindness from the other earlier in the window
const KIND = new Set(['give', 'help', 'lend', 'share_food', 'repair', 'heal', 'carry']), gotFrom = new Set<string>(); let repaid = 0;
for (const r of recs) { if (!r.out.ok || !KIND.has(r.deed.verb) || typeof r.deed.actor !== 'number' || typeof r.deed.target !== 'number') continue;
  if (gotFrom.has(`${r.deed.actor}<${r.deed.target}`)) repaid++; gotFrom.add(`${r.deed.target}<${r.deed.actor}`); }
// rumours
let carried = 0, changed = 0, rumN = 0;
if (R) for (const r of R.rumours.slice(rum0)) { rumN++; let far = false, ch = false; for (const h of r.holds.values()) { if (h.hand >= 2) far = true; if (h.v.kind !== r.truth.kind || h.v.about !== r.truth.about || Math.abs(h.v.amount - r.truth.amount) > 0.25 * Math.max(0.01, Math.abs(r.truth.amount))) ch = true; } if (far) carried++; if (ch) changed++; }
// the living world's talk between houses
const talks = sim.living.talks.filter(t => t.day >= D0 && t.day < D0 + N), tk: Record<string, number> = {}; for (const t of talks) tk[`${t.kind}${t.done ? '' : ' (not done)'}`] = (tk[`${t.kind}${t.done ? '' : ' (not done)'}`] ?? 0) + 1;
const debts = ['loan', 'default', 'pledge_seized', 'suit', 'debt_labour', 'repaid', 'time_granted', 'bound_labour', 'redeemed'].reduce((o, k) => ({ ...o, [k]: kinds[k] ?? 0 }), {} as Record<string, number>);
const out = { tool: 'tools/dev/chain_census.ts', seed: SEED, day0: D0, days: N, econChains: C.length, families, longest, links, events: kinds,
  deeds: { n: recs.length, byVerb: dv, lawCases: cases.length, ruled, goalsDeep, favoursRepaid: repaid }, rumours: { born: rumN, tellings: R ? R.stats.tellings - tell0 : 0, carriedPastFirstHand: carried, changedInTheCarrying: changed },
  debtsCalled: debts, houseTalk: tk, visits: (tk['visit'] ?? 0), guestsHosted: kinds['hosted_guest'] ?? 0 };
const chainCount = C.length + cases.length + goalsDeep + repaid + carried; (out as any).chainCount = chainCount;
if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n'); }
console.log(JSON.stringify(out, null, 1));
