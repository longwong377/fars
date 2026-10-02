// D-379 (UD-25): the proximity mic, the simulation's side (src/people/converse/earshot.ts): words carry by loudness and
// distance, the one spoken to is named, faced or nearest, the bystanders overhear (a memory row that survives a save and is
// told on), and a shout turns every head in earshot.
import { describe, it, expect } from 'vitest';
import { simAt, nav, envOf } from './sim_fixture';
import { PeopleSim } from '../src/people/sim';
import { hearers, addressee, loudnessOf, lookers, earshot, noteOverheard, rmsDbOf, ambientFor, SPEECH_DB, AMBIENT_DB, type Listener } from '../src/people/converse/earshot';

const S0 = { e: 0, n: 0, yawDeg: 0 }; // the stranger at the origin, facing north (+n)
const at = (pid: number, e: number, n: number, facing?: number): Listener => ({ pid, e, n, facing });

describe('earshot: who hears, and how clearly', () => {
  it('a normal voice in the town is understood to ~3 m in front, heard as a voice to ~20 m, not at all beyond', () => {
    const H = hearers([at(1, 0, 2), at(2, 0, 5), at(3, 0, 15), at(4, 0, 25)], S0, 'normal', AMBIENT_DB.town);
    const by = new Map(H.map(h => [h.pid, h]));
    expect(by.get(1)!.clear).toBe(true); expect(by.get(1)!.db).toBeCloseTo(SPEECH_DB.normal - 20 * Math.log10(2), 6);
    expect(by.get(2)!.clear).toBe(false); expect(by.get(2)!.clarity).toBeGreaterThan(0.3);
    expect(by.get(3)!.clear).toBe(false); expect(by.has(4)).toBe(false);
    expect(H.map(h => h.pid)).toEqual([1, 2, 3]); // nearest first
  });
  it('-6 dB per doubling; louder carries further; the night carries further than the day, the market less', () => {
    const [a, b] = hearers([at(1, 0, 4), at(2, 0, 8)], S0, 'normal', 0); expect(a.db - b.db).toBeCloseTo(6.02, 1);
    const clearTo = (l: 'whisper' | 'normal' | 'raised' | 'shout', amb: number) => { let r = 0; for (let d = 0.5; d <= 120; d += 0.5) if (hearers([at(1, 0, d)], S0, l, amb)[0]?.clear) r = d; return r; };
    expect(clearTo('normal', AMBIENT_DB.town)).toBe(3); expect(clearTo('raised', AMBIENT_DB.town)).toBe(10); expect(clearTo('shout', AMBIENT_DB.town)).toBeGreaterThan(50);
    expect(clearTo('normal', AMBIENT_DB.night)).toBe(10); expect(clearTo('normal', AMBIENT_DB.market)).toBe(0.5);
    expect(ambientFor(23)).toBe(AMBIENT_DB.night); expect(ambientFor(10)).toBe(AMBIENT_DB.town); expect(ambientFor(10, true)).toBe(AMBIENT_DB.market);
  });
  it('the voice is weaker behind the speaker', () => {
    const [f] = hearers([at(1, 0, 3)], S0, 'normal'), [s] = hearers([at(1, 3, 0)], S0, 'normal'), [b] = hearers([at(1, 0, -3)], S0, 'normal');
    expect(f.db - s.db).toBeCloseTo(3, 6); expect(f.db - b.db).toBeCloseTo(6, 6); expect(f.clear).toBe(true); expect(b.clear).toBe(false);
  });
  it('a whisper reaches only the nearest (into their ear), and nobody out of reach', () => {
    const H = hearers([at(1, 0.4, 0.8), at(2, -1.5, 0.5), at(3, 0, 3)], S0, 'whisper', AMBIENT_DB.town);
    expect(H.map(h => h.pid)).toEqual([1]); expect(H[0].clear).toBe(true);
    expect(hearers([at(2, -1.5, 0.5)], S0, 'whisper')).toEqual([]);
    expect(hearers([at(1, 0, 1)], S0, 'whisper', AMBIENT_DB.market)[0]?.clear ?? false).toBe(false); // the mill drowns a whisper
  });
});

describe('the one spoken to', () => {
  const names: Record<number, string> = { 1: '*Bakezza', 2: 'Irdabama', 3: '*Kuraš son of Ummanana' };
  const nameOf = (p: number) => names[p] ?? null;
  it('a name said beats facing; facing beats distance; else the nearest who hears clearly', () => {
    const H = hearers([at(1, 0, 2.5), at(2, 1.2, 0), at(3, -2, -1)], S0, 'normal');
    expect(addressee(H, 'Irdabama, where is the well?', nameOf)!.pid).toBe(2); // named, though to the side
    expect(addressee(H, 'kuras, come here', nameOf)!.pid).toBe(3); // the first name, without the mark or the accent
    expect(addressee(H, 'Where is the well?', nameOf)!.pid).toBe(1); // in front (within 30°), though 2 is nearer
    const side = hearers([at(2, 1.2, 0.3), at(3, -2, -1)], S0, 'normal'); // nobody in front: the nearest who hears clearly
    expect(addressee(side, 'Where is the well?', nameOf)!.pid).toBe(2);
    expect(addressee([], 'hello', nameOf)).toBe(null);
    expect(addressee(hearers([at(1, 0, 8)], { ...S0, yawDeg: 180 }, 'normal'), 'hello', nameOf)).toBe(null); // a voice, not words
  });
  it('loudness from the mic level, else from the words', () => {
    expect(loudnessOf('Where is the well?')).toBe('normal'); expect(loudnessOf('Wait!')).toBe('raised'); expect(loudnessOf('Wait!!')).toBe('shout');
    expect(loudnessOf('STOP THIEF')).toBe('shout'); expect(loudnessOf('(come closer)')).toBe('whisper'); expect(loudnessOf('psst, over here')).toBe('whisper');
    expect(loudnessOf(-50)).toBe('whisper'); expect(loudnessOf(-28)).toBe('normal'); expect(loudnessOf(-18)).toBe('raised'); expect(loudnessOf(-6)).toBe('shout');
    const tone = (amp: number) => Float32Array.from({ length: 16000 }, (_, i) => amp * Math.sin(i / 5));
    expect(rmsDbOf(tone(0.05))).toBeCloseTo(20 * Math.log10(0.05 / Math.SQRT2), 0); expect(loudnessOf(rmsDbOf(tone(0.9)))).toBe('shout');
  });
  it('a shout turns every head in earshot that is not already turned; a normal voice none', () => {
    const P = [at(1, 0, 5, 0), at(2, 20, 20, 225), at(3, -30, 0, 0)];
    const H = hearers(P, S0, 'shout'); expect(H.length).toBe(3);
    const L = lookers(H, 'shout', P); expect(L.map(l => l.pid).sort()).toEqual([1, 3]); // 2 already faces the stranger
    expect(L.find(l => l.pid === 1)!.toSpeaker).toBeCloseTo(180, 6); expect(L.find(l => l.pid === 3)!.toSpeaker).toBeCloseTo(90, 6);
    expect(lookers(hearers(P, S0, 'normal'), 'normal', P)).toEqual([]);
  });
});

describe('bystanders overhear (talk memory, gossip, the save)', () => {
  it('everyone who hears clearly but is not addressed gets a row; it survives save/load and is told on', () => {
    const S = simAt(1, 3, 10), day = 3, P = S.pop;
    // a house with three people present: the addressee and two bystanders of it, and a kinsman away who hears of it later
    let hh = -1; for (let h = 0; h < P.households.length && hh < 0; h++) { const m = P.membersOn(h, day).filter(x => P.present(x, day) && P.ageOn(x, day) >= 14); if (m.length >= 4) hh = h; }
    expect(hh).toBeGreaterThanOrEqual(0);
    const [a, b, c, k] = P.membersOn(hh, day).filter(x => P.present(x, day) && P.ageOn(x, day) >= 14);
    const people = [at(a, 0, 1.5), at(b, 1.5, 1), at(c, -1.5, 0.5), at(k, 0, 40)];
    const words = 'Where can I find water for my mule?';
    const H = earshot(people, S0, words, x => P.nameOf(x));
    expect(H.to!.pid).toBe(a); expect(H.bystanders.map(h => h.pid).sort()).toEqual([b, c].sort()); expect(H.heard.some(h => h.pid === k)).toBe(false); expect(H.look).toEqual([]);
    const t = S.t; noteOverheard(S.talk, H, t, t, words);
    expect(S.talk.rows.get(b)).toBeUndefined(); // not a conversation of their own
    const mem = S.talk.recall(b, t, 2).join(' '); expect(mem).toMatch(/overheard this same stranger say to .+: “Where can I find water/);
    expect(S.talk.recallFact(c, t).fact).toMatch(/I heard you say to .+ “Where can I find water/);
    const save = JSON.parse(JSON.stringify(S.save()));
    const S2 = new PeopleSim(1, nav(), envOf(1)); S2.load(save); S2.t = t;
    expect(S2.talk.recall(b, t, 2)).toEqual(S.talk.recall(b, t, 2)); expect(S2.talk.over.get(c)!.length).toBe(1);
    // told on: the kinsman of the house hears of it within two days, in the bystanders' telling
    const later = t + 60, told = S2.talk.heard(k, later).map(x => x.text).join(' ');
    expect(told).toMatch(/said “Where can I find water.*” in (his|her) hearing/);
    // a whisper to one is overheard by nobody
    const W = earshot(people, S0, '(where is the well)', x => P.nameOf(x)); expect(W.heard.map(h => h.pid)).toEqual([]); // a is 1.5 m away: out of reach
    const W2 = earshot([at(a, 0, 0.9), at(b, 1.5, 1)], S0, '(where is the well)', x => P.nameOf(x)); expect(W2.to!.pid).toBe(a); expect(W2.bystanders).toEqual([]);
  }, 300_000);
});
