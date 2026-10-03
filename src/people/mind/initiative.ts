// D-461 (UD-32): INITIATIVE. A day of the whole town's minds, of their own accord, with or without the stranger, in slices
// (a generator the living world steps across frames, D-388): in order,
//   1. feelings and needs acted on (minds.ts deeds(): anger, gratitude, a hungry house borrowing, friends visited), except
//      where a goal of revenge or of peace pursues the pair step by step;
//   2. the day's life: a new child's mother brought food by kin, the house of the dead in grief (the comfort and the help the
//      economy's deaths, illnesses and fires call for are minds.ts observe's, D-459);
//   3. goals pursued: every goal whose next step falls today takes it (goals.ts), deeds and laid stretches of the day plans;
//   4. goals formed: a tenth of the town considered each day (each person every ten days), a goal born of their own state;
//   5. the places won: tomorrow's work with the master laid and paid;
//   6. the talk of deeds: what was done today (a wrong above all, a kindness too, the stranger's deeds as well) told by the one
//      it was done to and by a witness to a friend: a 'tell' deed, which moves the hearer's feelings about the doer and, for a
//      wrong, puts it into the rumour net (asks/rumour.ts) to travel the houses' ties; the overheard talk reads it (talkOf);
//   7. once a week, the feelings faded back to rest forgotten (the state stays small).
// Moods: from life events (a death in the house, a wound, a new child) and from what the goals came to (glad, bitter,
// relieved, grieving), fading over about two weeks; they move every decision (minds.ts decide) and the brief.
// Measured as it runs (stats): deeds by kind and source, goals by kind, chains of cause, the cost of the day and of its
// longest slice. Tier C throughout (D-461).
import type { DeedWorld } from '../deeds/engine';
import type { Deed, DeedRec, Verb } from '../deeds/types';
import { VERBS } from '../deeds/verbs';
import { u01, salt } from '../hash';
import { personaOf } from '../persona';
import { Goals, type Goal, type GoalHost } from './goals';

const S = { life: salt('init-life'), talk: salt('init-talk') };
const KIND_DEEDS = new Set<Verb>(['give', 'help', 'heal', 'reconcile', 'hire', 'repair', 'carry', 'share_food']);
const TOLD = new Set<Verb>(['tell', 'lie', 'warn', 'complain', 'accuse', 'avoid', 'praise', 'thank', 'apologize', 'promise', 'introduce', 'visit', 'meet', 'court', 'flirt']);
/** what the teller says of a deed (the translation layer's English; the engine reads the bad and good words in it) */
const SAY: Partial<Record<Verb, string>> = { steal: 'he stole from the house', attack: 'he beat a man', push: 'he struck a man', insult: 'he cursed a man to his face', mock: 'he mocked a man, the liar', curse: 'he cursed a house',
  threaten: 'he threatened to beat a man', break: 'he broke what was not his, the cheat', give: 'he was generous: he gave', help: 'he was kind: he helped', heal: 'he was kind to the sick', reconcile: 'they made peace: he was good about it',
  hire: 'he gave a man work, a good master', repair: 'he helped mend a house', carry: 'he was kind: he carried the load', share_food: 'he was generous with his bread' };
export interface MindStats { days: number; ms: number; maxSlice: number; slices: number; /** the longest slice of each part of the day (ms) */ parts: Record<string, number>; /** the whole time of each part (ms) */ tot: Record<string, number>; deeds: Record<string, number>; done: Record<string, number>; src: Record<string, number>; chains: Record<number, number>; examples: string[] }

export class Initiative implements GoalHost {
  readonly goals: Goals;
  private moods = new Map<number, [number, number, string][]>();
  private cursor = 0; private seen = 0; private deedDepth = new Map<number, number>();
  readonly stats: MindStats = { days: 0, ms: 0, maxSlice: 0, slices: 0, parts: {}, tot: {}, deeds: {}, done: {}, src: {}, chains: {}, examples: [] };
  constructor(readonly W: DeedWorld) { this.goals = new Goals(W, this); }

  // ------------------------------------------------------------------ moods
  mood(pid: number, day: number, v: number, word: string) { const l = this.moods.get(pid) ?? []; l.push([day, v, word]); if (l.length > 4) l.shift(); this.moods.set(pid, l); }
  /** the person's mood now: -1 (grief, bitterness) .. 1 (joy), the word for it and its cause (C: the heart's events fade over about two weeks) */
  moodOf(pid: number, day: number): { v: number; word: string } {
    const P = this.W.w.pop; let v = 0, word = '', top = 0;
    const add = (x: number, w: string) => { v += x; if (Math.abs(x) > top) { top = Math.abs(x); word = w; } };
    for (const [d, x, w] of this.moods.get(pid) ?? []) if (d <= day) add(x * Math.exp(-(day - d) / 12), w);
    if (P.persons[pid] && P.mourning(pid, day)) add(-0.7, 'grieving');
    const inj = this.W.injuryOf(pid, day); if (inj) add(inj.how === 'bruised' ? -0.15 : -0.4, 'in pain');
    return { v: v < -1 ? -1 : v > 1 ? 1 : v, word };
  }
  depthOfDeed(id: number) { return this.deedDepth.get(id) ?? 1; }
  private frictions(day: number) {
    const W = this.W, P = W.w.pop, M = W.minds, st = this.stats, n = (k: string) => { st.src[k] = (st.src[k] ?? 0) + 1; };
    const C = P.cal?.ctx(day);
    if (C) for (const [a, x] of C.disputes) { if (!P.persons[a] || !P.persons[x.other]) continue;
      const pe = personaOf(P, a, day); M.move(a, x.other, { anger: 0.25 + 0.35 * pe.temper + 0.1 * pe.pride, aff: -0.04 }, day); n('quarrel'); }
  }
  formed(g: Goal) { this.stats.chains[g.depth] = (this.stats.chains[g.depth] ?? 0) + 1; if (g.depth >= 3 && this.stats.examples.length < 12) this.stats.examples.push(this.chainOf(g)); }

  // ------------------------------------------------------------------ the day
  *dayParts(day: number): Generator<void> {
    const W = this.W, P = W.w.pop, st = this.stats; let t = performance.now(), k = 0;
    const slice = (part: string) => { const n = performance.now(), ms = n - t; st.ms += ms; st.slices++; if (ms > st.maxSlice) st.maxSlice = ms; if (ms > (st.parts[part] ?? 0)) st.parts[part] = ms; st.tot[part] = (st.tot[part] ?? 0) + ms; };
    const resume = () => { t = performance.now(); };
    const done = (rec: DeedRec, src: string) => { const v = rec.deed.verb; st.deeds[v] = (st.deeds[v] ?? 0) + 1; if (rec.out.ok) st.done[v] = (st.done[v] ?? 0) + 1; st.src[src] = (st.src[src] ?? 0) + 1;
      const g = rec.deed.goal !== undefined ? this.goals.depth.get(rec.deed.goal) : undefined; if (g && g > 1) this.deedDepth.set(rec.id, g); };
    // 1. feelings and needs
    const own: Deed[] = []; for (const _ of W.minds.deedParts(day, own, 300, (a, b) => this.goals.holds(a, b))) { slice('feeling'); yield; resume(); }
    for (const d of own) { done(W.own(d, day, k++), 'feeling'); if (k % 4 === 0) { slice('feeling'); yield; resume(); } }
    // 2. the day's life: a new child's mother brought food by kin; the houses of the dead in grief
    if (day > 0) { const L = P.lifeOn(day - 1);
      for (const b of L.births) { const mo = P.persons[b]?.mother ?? -1; if (mo < 0 || !P.present(mo, day)) continue; this.mood(mo, day, 0.5, 'glad of the new child');
        // (her mother, if she lives in another house, else the head of a kin house: C)
        const gm = P.persons[mo].mother, hk = P.households[P.home(mo, day)]?.kin.find(k => k !== P.home(mo, day) && P.households[k]), kin = gm >= 0 && P.present(gm, day) && P.home(gm, day) !== P.home(mo, day) ? gm : hk !== undefined ? W.minds.headOf(hk, day) ?? -1 : -1;
        if (kin >= 0 && kin !== mo) done(W.own({ verb: 'give', actor: kin, target: mo, good: 'food', qty: 2, aim: 'food for the mother of the new child' }, day, k++, 11), 'life'); }
      for (const x of L.deaths) for (const m of P.households[P.home(x, day - 1)]?.members ?? []) if (m !== x && P.present(m, day)) this.mood(m, day, -0.5, 'grieving');
      slice('life'); yield; resume(); }
    // 2b. the town's own frictions: the calendar's quarrels (E-74) move the feelings of the two who quarrel (the economy's wrongs
    // and help are felt in engine.ts dayParts: minds.observe), so anger and grudges arise without any stranger
    this.frictions(day); slice('frictions'); yield; resume();
    // 3. goals pursued (each on its own day)
    const due = [...this.goals.active.values()].filter(g => g.next <= day); let n = 0;
    for (const g of due) { if (!this.goals.active.has(g.id)) continue; const l0 = W.next; n += this.goals.pursue(g, day) + 1;
      for (let i = l0; i < W.next; i++) { const r = W.rec(i); if (r) done(r, 'goal'); }
      if (n >= 3) { n = 0; slice('pursue'); yield; resume(); } }
    // 4. goals formed: a tenth of the town
    const N = P.persons.length, per = Math.ceil(N / 10);
    for (let i = 0; i < per; i++) { const pid = (this.cursor + i) % N, l0 = W.next; const g = this.goals.consider(pid, day); if (g) this.formed(g);
      for (let j = l0; j < W.next; j++) { const r = W.rec(j); if (r) done(r, 'goal'); }
      if (i % 100 === 99) { slice('form'); yield; resume(); } }
    this.cursor = (this.cursor + per) % N;
    // 5. the places won
    this.goals.placesDay(day); slice('places'); yield; resume();
    // 6. the talk of deeds
    if (this.seen > W.next) this.seen = 0; const end = W.next; let told = 0;
    for (let i = Math.max(this.seen, end - W.log.length); i < end && told < 220; i++) { const r = W.rec(i); if (!r || !r.out.ok || TOLD.has(r.deed.verb) || r.day !== day) continue; const v = r.deed.verb, wrong = !!VERBS[v].wrong;
      if (!wrong && !KIND_DEEDS.has(v)) continue; const doer = r.deed.actor;
      const tellers = [r.deed.target, ...(r.out.witnesses ?? []).slice(0, 1)].filter((x): x is number => typeof x === 'number' && x !== doer);
      for (const tl of tellers) { if (u01(W.w.seed, S.talk, r.id, tl) >= (wrong ? 0.6 : 0.22)) continue; const f = W.minds.friendOf(tl, day); if (f === null || f === doer) continue;
        const rec = W.own({ verb: 'tell', actor: tl, target: f, third: doer, about: SAY[v] ?? 'what he did', of: r.id }, day, k++, 19 + 2 * u01(W.w.seed, S.talk, r.id, tl, 1));
        done(rec, 'talk'); this.deedDepth.set(rec.id, this.depthOfDeed(r.id) + 1); told++; }
      if (told % 20 === 19) { slice('talk'); yield; resume(); } }
    this.seen = W.next;
    // 7. a week's forgetting
    for (const _ of W.minds.pruneParts(day, day % 7, 7)) { slice('prune'); yield; resume(); } slice('prune'); yield; resume();
    if (day % 7 === 0) { for (const [p, l] of this.moods) if (l.every(x => day - x[0] > 40)) this.moods.delete(p);
      if (this.deedDepth.size > 20000) { const lo = W.next - 10000; for (const id of this.deedDepth.keys()) if (id < lo) this.deedDepth.delete(id); } }
    st.days++; slice('end');
  }

  /** a goal's chain of causes in words (for the measure's examples) */
  chainOf(g: Goal): string { const parts: string[] = [], nm = (a: number | 'player') => a === 'player' ? 'the stranger' : this.goals.name(a);
    let cur: Goal | undefined = g, guard = 0;
    while (cur && guard++ < 6) { parts.unshift(`${nm(cur.pid)} set on ${cur.kind} (${cur.why})`); const c: string = cur.cause;
      if (c.startsWith('deed:')) { const r = this.W.rec(Number(c.slice(5))); if (!r) break; parts.unshift(`${nm(r.deed.actor)} ${r.deed.verb.replace(/_/g, ' ')} ${r.deed.target !== undefined ? nm(r.deed.target) : ''}`.trim());
        cur = r.deed.goal !== undefined ? this.findGoal(r.deed.goal) : undefined; }
      else if (c.startsWith('goal:')) cur = this.findGoal(Number(c.slice(5))); else break; }
    return parts.join(' -> ');
  }
  private findGoal(id: number) { return this.goals.active.get(id) ?? this.goals.ended.find(e => e.id === id); }

  // ------------------------------------------------------------------ reading
  /** what the person is set on and how they feel, for the talk's brief (out of world) */
  briefOf(pid: number, day: number): string[] { const out: string[] = [], G = this.goals;
    const mine = G.of(pid); if (mine.length) out.push(`You are set on ${mine.map(g => G.phrase(g, day)).join(', and ')}.`);
    const pl = G.places.get(pid); if (pl) out.push(`You work for ${G.name(pl.master)} two days a week, paid by the day.`);
    for (const g of G.active.values()) if (g.who === pid && (g.kind === 'spouse' || g.kind === 'revenge' || g.kind === 'work' || g.kind === 'patron')) { out.push(g.kind === 'spouse' ? `${G.name(g.pid)}'s family has come to speak of a match with you.` : g.kind === 'revenge' ? `${G.name(g.pid)} bears you a grudge.` : g.kind === 'work' ? `${G.name(g.pid)} wants you to take him on.` : `${G.name(g.pid)} is trying to win your favour.`); break; }
    const m = this.moodOf(pid, day); if (Math.abs(m.v) > 0.25 && m.word) out.push(`You are ${m.word}.`);
    return out;
  }
  /** what two people would talk of from the deeds they saw and the goals they hold (overheard.ts): [key, topic] or null */
  talkOf(a: number, b: number, day: number): [string, string] | null {
    const W = this.W, nm = (x: number | 'player') => x === 'player' ? 'the stranger' : this.goals.name(x);
    for (const p of [a, b]) { const mem = W.minds.memory.get(p) ?? [];
      for (let i = mem.length - 1; i >= 0 && i >= mem.length - 6; i--) { const r = W.rec(mem[i]); if (!r || !r.out.ok || day - r.day > 3) continue; const v = r.deed.verb;
        if (VERBS[v].wrong) return [v === 'steal' ? 'silver' : 'deed', `${nm(r.deed.actor)}: ${VERBS[v].gloss}${r.deed.target !== undefined ? ` to ${nm(r.deed.target)}` : ''}`];
        if (v === 'promise' && /betrothal/.test(r.deed.about ?? '')) return ['wedding', r.deed.about!]; } }
    for (const p of [a, b]) { const g = this.goals.of(p)[0]; if (!g) continue;
      const key = g.kind === 'spouse' || g.kind === 'dowry' || g.kind === 'bridegift' ? 'wedding' : g.kind === 'debt' || g.kind === 'patron' ? 'silver' : g.kind === 'care' ? 'sickness' : g.kind === 'pilgrimage' ? 'festival' : g.kind === 'leave' ? 'stranger' : g.kind === 'work' || g.kind === 'teach' || g.kind === 'repair' ? 'work' : g.kind === 'kinvisit' ? 'birth' : 'deed';
      return [key, `${nm(p)}: ${this.goals.phrase(g, day)}`]; }
    return null;
  }

  save() {
    // (D-720, C1's ask: the counts of the game's own days only; the wall-clock costs (ms, slices, parts) differ between any two
    // runs and made two saves of the same world differ: they stay in the running world's stats, never in the save)
    const { days, deeds, done, src, chains, examples } = this.stats;
    return { g: this.goals.save(), m: [...this.moods], c: this.cursor, st: { days, deeds, done, src, chains, examples: examples.slice(0, 12) } }; }
  load(s: ReturnType<Initiative['save']> | undefined) { this.moods.clear(); this.deedDepth.clear(); this.cursor = 0; this.seen = 0; this.goals.load(s?.g);
    if (!s) return; for (const [k, v] of s.m) this.moods.set(k, v); this.cursor = s.c; Object.assign(this.stats, s.st); }
}
