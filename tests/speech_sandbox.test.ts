// T-E14 (UD-25): the speech sandbox measured. A seeded set of the stranger's utterances across the ten mechanics (trust, needs,
// work, haggling, rumour, language, identity, petitions, hospitality, groups), each said at whisper, normal and shout level
// (synthetic audio buffers through the mic's own level path: earshot.rmsDbOf -> loudnessOf; the browser's microphone itself
// is the render side's), to one person and to a group, among listeners placed around the stranger. An utterance counts when
// (a) the listeners are chosen by loudness, distance, facing and name (whisper: the nearest only; a name picks its bearer;
// a shout reaches further than a normal voice), (b) the response is the simulation's own (the verdict before the words
// equals what doing it does), (c) the consequence is in the saved state (the snapshot round trip carries it) and (d) the
// whole sequence replays identically from the same world. Measured and printed; the threshold is T-E14's (90 %).
// What this cannot tell: whether the in-browser model's words agree with the verdicts (the GPU talk set).
import { describe, it, expect } from 'vitest';
import { simAt } from './sim_fixture';
import { earshot, rmsDbOf, type Listener } from '../src/people/converse/earshot';
import { Economy } from '../src/people/economy/world';
import { householdsOf } from '../src/people/economy/chains';
import { u01, salt } from '../src/people/hash';
import type { PeopleSim } from '../src/people/sim';
import type { SAct } from '../src/people/speech/stranger';

const LINES: [string, string][] = [
  ['trust', 'Take these 2 shekels.'], ['needs', 'Take this barley, friend.'], ['work', 'Could I work for you?'], ['haggling', 'Sell me two measures of barley.'],
  ['rumour', 'I am a merchant from Babylon.'], ['language', 'What is your word for bread?'], ['identity', 'I am a scribe from Babylon.'],
  ['petition', 'Speak for that family.'], ['hospitality', 'May I stay the night with you?'], ['groups', 'Put me on the ration list.'],
];
const AMP = { whisper: 0.004, normal: 0.05, shout: 0.6 } as const;
const tone = (amp: number) => { const n = 16000, x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = amp * Math.sin(i * 0.12) * (0.8 + 0.2 * Math.sin(i * 0.0013)); return x; };

function run(sim: PeopleSim, day: number) {
  const E = sim.econTo(day), S = E.stranger(); S.purse.cash = 20; S.purse.grain = 40; S.hear('Aramaic', 600, 1, true, day);
  const P = sim.pop, adults = P.persons.filter(p => P.present(p.id, day) && P.ageOn(p.id, day) >= 18 && E.hh.has(`h:${P.home(p.id, day)}`))
    .sort((a, b) => u01(1, salt('te14'), a.id) - u01(1, salt('te14'), b.id));
  const rows: any[] = []; let k = 0;
  for (const [mech, line] of LINES) for (const lvl of ['whisper', 'normal', 'shout'] as const) for (const group of [false, true]) {
    // the listeners: one in front at 1 m, one behind at 2 m, one in front at 6 m, one at 18 m to the side, one at 45 m
    const cast = adults.slice(k * 5, k * 5 + 5); k++; if (cast.length < 5) break;
    const at: [number, number, number][] = [[0, 1, 180], [0, -2, 0], [1, 6, 180], [18, 0, 270], [0, 45, 180]];
    const people: Listener[] = cast.map((p, i) => ({ pid: p.id, e: at[i][0], n: at[i][1], facing: at[i][2] }));
    const named = mech === 'trust' && group ? P.nameOf(cast[2].id)?.replace(/^\*/, '') : null;
    const words = named ? `${named}, ${line}` : group ? `Everyone, ${line}` : line;
    const db = rmsDbOf(tone(AMP[lvl])), H = earshot(people, { e: 0, n: 0, yawDeg: 0 }, words, pid => P.nameOf(pid)?.replace(/^\*/, ''), { rmsDb: db });
    // (a) listeners
    const clear = H.heard.filter(h => h.clear).map(h => h.pid);
    let listenersOk = H.loudness === lvl || (lvl === 'normal' && H.loudness === 'raised');
    if (lvl === 'whisper') listenersOk &&= clear.length <= 1 && (H.to?.pid ?? cast[0].id) === cast[0].id;
    if (named) listenersOk &&= H.to?.pid === cast[2].id || !clear.includes(cast[2].id);
    if (lvl === 'shout') listenersOk &&= clear.length >= (earshot(people, { e: 0, n: 0, yawDeg: 0 }, line, () => null, { rmsDb: rmsDbOf(tone(AMP.normal)) }).heard.filter(h => h.clear).length);
    // (b) the simulation decides: the verdict told before the words equals what doing it does
    const to = H.to?.pid ?? null, targets = group ? clear : to !== null ? [to] : [];
    const before = JSON.stringify(E.snapshot(day - 2).stranger ?? null);
    const asks = group ? sim.strangerAskGroup(targets, words) : targets.length ? [{ pid: targets[0], ...sim.strangerAsk(targets[0], words)! }] : [];
    let simOk = true, effect = false;
    for (const a of asks) { if (!a?.act) continue; const v = a.verdict, d = sim.strangerDo(a.act as SAct); if (v.ok !== d.ok && d.why !== 'later') simOk = false; if (d.ok) effect = true; }
    const after = JSON.stringify(E.snapshot(day - 2).stranger ?? null);
    if (effect && before === after) simOk = false; // (a yes that changed nothing in the state)
    rows.push({ mech, lvl, group, listenersOk, simOk, heard: clear.length, asked: asks.length, effect });
  }
  return rows;
}

describe('T-E14 the speech sandbox (UD-25)', () => {
  it('a seeded set of utterances: listeners by loudness, distance, facing and name; the simulation decides; saved and replayed', () => {
    const day = 60, a = simAt(1, day, 10, { asks: true }), rows = run(a, day);
    // (c) saved: the economy's snapshot (with the stranger) restored is the same state
    const E = a.econTo(day), snap = JSON.parse(JSON.stringify(E.snapshot(day - 2))), r = Economy.restore(snap, householdsOf(a.pop), { trust: true });
    const savedOk = JSON.stringify(r.stranger().snapshot()) === JSON.stringify(E.stranger().snapshot());
    // (d) replayed: the same utterances on the same world give the same state
    const b = simAt(1, day, 10, { asks: true }); run(b, day); const replayOk = JSON.stringify(b.econTo(day).stranger().snapshot()) === JSON.stringify(E.stranger().snapshot());
    const ok = rows.filter(x => x.listenersOk && x.simOk && savedOk && replayOk).length / rows.length;
    const byMech: Record<string, string> = {}; for (const m of LINES.map(l => l[0])) { const xs = rows.filter(x => x.mech === m); byMech[m] = `${xs.filter(x => x.listenersOk && x.simOk).length}/${xs.length}, effect ${xs.filter(x => x.effect).length}`; }
    console.log('[T-E14]', JSON.stringify({ n: rows.length, share: +(ok * 100).toFixed(1), savedOk, replayOk, listenersBad: rows.filter(x => !x.listenersOk).length, simBad: rows.filter(x => !x.simOk).length, byMech }));
    expect(rows.length).toBeGreaterThanOrEqual(60); expect(savedOk).toBe(true); expect(replayOk).toBe(true); expect(ok).toBeGreaterThanOrEqual(0.9);
  }, 1_800_000);
});
