// Memory of the player (brief §9.5: "People remember the player: a guard who stopped you yesterday recognises you
// today; a baker you watched nods"). Each encounter adds to a person's familiarity with the stranger; familiarity
// fades with a half-life of days (lives.json familiarity, tier C). The renderer and speech read `greeting()`:
// 'none' (a stranger), 'nod' (seen before), 'recognise' (knows the player: turns, greets, replies rather than greets).
import livesData from '../data/lives.json';
const F = (livesData as any).familiarity as { met: number; addressed: number; stopped: number; watched: number; half_life_days: number; recognise: number; nod: number };

export type Encounter = 'met' | 'addressed' | 'stopped' | 'watched';
export interface Familiarity { level: number; t: number; first: number; last: Encounter; counts: Record<Encounter, number> }

export class PlayerMemory {
  private m = new Map<number, Familiarity>();
  /** decayed level at sim time t (hours) */
  level(id: number, t: number) { const f = this.m.get(id); if (!f) return 0; return f.level * Math.pow(0.5, Math.max(0, t - f.t) / 24 / F.half_life_days); }
  note(id: number, kind: Encounter, t: number) {
    const f = this.m.get(id) ?? { level: 0, t, first: t, last: kind, counts: { met: 0, addressed: 0, stopped: 0, watched: 0 } };
    f.level = Math.min(1, this.level(id, t) + F[kind]); f.t = t; f.last = kind; f.counts[kind]++; this.m.set(id, f);
  }
  greeting(id: number, t: number): 'none' | 'nod' | 'recognise' { const l = this.level(id, t); return l >= F.recognise ? 'recognise' : l >= F.nod ? 'nod' : 'none'; }
  get(id: number) { return this.m.get(id) ?? null; }
  snapshot() { return [...this.m.entries()].map(([k, v]) => [k, { ...v, counts: { ...v.counts } }] as [number, Familiarity]); }
  restore(s: [number, Familiarity][] | undefined) { this.m.clear(); for (const [k, v] of s ?? []) this.m.set(k, { ...v, counts: { ...v.counts } }); }
}
