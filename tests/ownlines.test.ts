// D-720: the person's own lines (converse/ownlines.ts) answer from their own life, in the first person, and keep the
// simulation's word on an ask; the late deeds (deeds/lately.ts) are worded from each side and reach the brief.
import { describe, it, expect } from 'vitest';
import { ownReply, firstPerson, OwnMind } from '../src/people/converse/ownlines';
import { latelyOf, toYou } from '../src/people/deeds/lately';
import { fenceHits } from '../src/people/converse/fence';
import { lifeBriefShort, type LifeRecord } from '../src/people/converse/life';
import type { DeedRec } from '../src/people/deeds/types';

const L: LifeRecord = {
  pid: 513, seed: 1, day: 60, hour: 12, name: 'Appumanya', byname: 'son of Upirradda', sex: 'm', age: 49, origin: 'an Elamite', language: 'Elamite', otherLanguages: [],
  job: 'a stonecutter in the stone gang cutting and dressing column drums and blocks for the Hall of a Hundred Columns', work: 'road:terrace', group: 'the stone gang of Haggai', rank: null,
  home: 'a mud-brick house in the town north-west of the Terrace, a short walk from its stair', zone: 'town',
  household: [{ pid: 514, name: 'Amagaunā', rel: 'wife', age: 40, job: 'homemaker', alive: true }, { pid: 515, name: 'Karma', rel: 'son', age: 20, job: 'porter', alive: true }, { pid: 516, name: 'Hašina', rel: 'son', age: 6, job: 'child', alive: true }],
  kinHouses: ['Djedhor’s house (a mud-brick house in the town)'], friends: [{ name: 'Djedhor', how: 'kin, a labourer', feeling: 'close' }],
  year: ['the house of Manyabaduš son of Artavardiya gave them grain when the house ran short'], past: ['born in Šušan', 'the father died, two years ago'],
  hopes: ['to go home one day to their own country'], worries: ['an accident at the stone'], needs: [], news: ['heard of a wrong done by the house of Ušaya son of Umanna'],
  lately: ['Djedhor helped me with the work, yesterday'], quarrels: [], debts: [], temperament: 'devout, proud of the house and with a dry wit',
  speech: ['speaks low, as if someone might overhear', 'oath: “by Napiriša”', 'plain speech of the town', 'addresses the stranger as “stranger” or “friend”', 'dislikes the winter cold'],
  today: { date: 'the third day of the month Θāigarči', season: 'spring', weather: 'fair', now: 'walk: going home', place: 'road', next: 'the midday meal with the household', earlier: [], events: [] },
  knows: [], tier: 'C',
};

describe('D-720 own lines: grounded in the life', () => {
  it('answers the five questions from the life record, in the first person, fenced', () => {
    const who = ownReply(L, 'Who are you?').text, fam = ownReply(L, 'Who lives in your house?').text, work = ownReply(L, 'What work do you do?').text;
    const year = ownReply(L, 'What has happened to you this year?').text, cares = ownReply(L, 'What troubles you?').text;
    expect(who).toMatch(/I am Appumanya/); expect(fam).toMatch(/my wife Amagaunā/); expect(fam).toMatch(/my sons Karma and Hašina/);
    expect(work).toMatch(/stonecutter/); expect(year).toMatch(/Djedhor helped me|gave us grain/); expect(cares).toMatch(/I worry about an accident at the stone/);
    for (const t of [who, fam, work, year, cares]) { expect(fenceHits(t)).toEqual([]); expect(t).not.toMatch(/\d|\byour\b|\btheir\b/); }
  });
  it('keeps the simulation’s word: a refusal is said and tagged, a yes is not a refusal', () => {
    const no = ownReply(L, 'Come with me.', { note: 'You cannot do this: on watch at the gate.' });
    expect(no.intent?.kind).toBe('refuse'); expect(no.text).toMatch(/cannot/i); expect(no.text).toMatch(/I am on watch/);
    const yes = ownReply(L, 'Come with me.', { note: 'You can do this, if you are willing.' }); expect(yes.intent).toBeNull(); expect(yes.text).not.toMatch(/\b(no|cannot)\b/i);
  });
  it('tells a remembered meeting in its own words', () => {
    const r = ownReply(L, 'Do you remember me?', { userText: 'The stranger says: “Do you remember me?” (Answer as Appumanya. What you remember: Yesterday this same stranger spoke with you; he asked you for bread and you gave him bread. Tell him that, in your own words, keeping what happened.)' });
    expect(r.text).toMatch(/^Yes, I remember you/); expect(r.text).toMatch(/gave you bread/);
  });
  it('varies between people and is the same for the same person and turn', () => {
    expect(ownReply(L, 'Who are you?').text).toBe(ownReply(L, 'Who are you?').text);
    const other = { ...L, pid: 9, name: 'Gagâ', temperament: 'warm and talkative', speech: ['tells everything as a story', 'oath: “by Hera”'] };
    expect(ownReply(other, 'Who are you?').text).not.toBe(ownReply(L, 'Who are you?').text);
  });
  it('the mind stand-in answers ok and never judges', async () => {
    const M = new OwnMind(); const a = await M.answer(L, 'none', [], 'What troubles you?'); expect(a.ok).toBe(true); expect(await M.judge('x', 'y')).toBeNull();
  });
  it('turns the brief’s phrases about them into their own', () => {
    expect(firstPerson('born in Šušan')).toBe('I was born in Šušan'); expect(firstPerson('the father died, two years ago')).toBe('my father died, two years ago');
    expect(firstPerson('is asleep')).toBe('I am asleep'); expect(firstPerson('the house of X gave them grain')).toBe('the house of X gave us grain');
  });
});

describe('D-720 lately: the townsfolk’s deeds reach what a person can tell', () => {
  const recs: DeedRec[] = [
    { id: 0, day: 58, t: 58 * 24 + 9, deed: { verb: 'help', actor: 2, target: 1 }, out: { ok: true, why: '', effects: [] } },
    { id: 1, day: 59, t: 59 * 24 + 9, deed: { verb: 'attack', actor: 3, target: 4 }, out: { ok: true, why: '', effects: [] } },
    { id: 2, day: 59, t: 59 * 24 + 10, deed: { verb: 'court', actor: 1, target: 5 }, out: { ok: false, why: '', refused: true, effects: [] } },
    { id: 3, day: 20, t: 20 * 24, deed: { verb: 'give', actor: 6, target: 1 }, out: { ok: true, why: '', effects: [] } },
  ];
  const names: Record<number, string> = { 1: 'Arta', 2: 'Bagadata', 3: 'Kuraš', 4: 'Miθra', 5: 'Irdabama', 6: 'Old Uštana' };
  const W = { minds: { memory: new Map([[1, [0, 1, 2, 3]]]) }, rec: (i: number) => recs[i], name: (a: number | 'player') => typeof a === 'number' ? names[a] : 'the stranger' };
  it('words each deed from the person’s side, newest and weightiest first, within a month', () => {
    const l = latelyOf(W, 1, 60);
    expect(l).toContain('Bagadata helped me with the work, two days ago');
    expect(l).toContain('I saw Kuraš strike Miθra, yesterday');
    expect(l.some(x => /I went courting Irdabama but was turned away/.test(x))).toBe(true);
    expect(l.some(x => /Old Uštana/.test(x))).toBe(false); // (forty days ago: past the month)
    expect(toYou('Bagadata helped me with the work')).toBe('Bagadata helped you with the work');
  });
  it('the brief carries the first of them in its Lately line', () => {
    expect(lifeBriefShort(L)).toMatch(/^Lately: Djedhor helped you with the work, yesterday; the house of Manyabaduš/m);
  });
});
