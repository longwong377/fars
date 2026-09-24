// Plays the music schedule in the world (D-178, D-200): what src/audio/performers.ts says is being sung or played now is
// started at the performer's position when the listener is within earshot, follows the performer, is renewed with a new
// piece (a new seed) while the stretch lasts, and fades when it ends or the performer stops. The court's musicians, whom
// the simulation does not hold, are placed as standing extras while their music lasts (PLACEHOLDER dress). Every
// performer is shown playing or singing (hooks.play: the playing performance of src/people/playing.ts, kept alive while the
// gig lasts, near or far); a singer's jaw and breath follow the notes of the piece that sounds (the lead all of them, the
// rest of a chorus the phrases they join). Browser-side glue only: the decisions are in performers.ts, the evidence rules
// in music.ts.
import { musicAt, soundingParts, type Gig, type GigPart, type MusicCtx, type PerformerAgent, type PopPerformer } from './performers';
import { compose, type MusicSystem, type Performance } from './music';
import type { AudioEngine } from './engine';
import { INSTRUMENTS } from './instruments';
import { MESOPOTAMIAN_MODES, GREEK_MODES } from './tuning';
import type { PlayKind } from '../people/playing';

/** a performer: a simulated person, a person of the population, or an extra (by key) */
export interface PerformerRef { agentId?: number; pid?: number; extra?: string }
export interface DirectorHooks {
  /** place a court musician (grid e/n, floor height, facing) or take her away */
  addExtra(key: string, spec: { sex: 'm' | 'f'; seed: number; e: number; n: number; y: number; heading: number; anim: 'sit' | 'idle' }): void;
  removeExtra(key: string): void;
  /** a performer plays or sings for `seconds` more (kept alive every update); `notes`: the sung notes of a piece starting
   *  now, as [start, end] pairs (s) */
  play(who: PerformerRef, kind: PlayKind, seconds: number, notes?: number[]): void;
}
/** beyond this distance a piece is not started (the occlusion and the panner's distance law do the rest) */
export const EARSHOT_M = 120;
/** length of each rendered piece (s); a stretch longer than this is played as several pieces */
export const PIECE_S = 40;
/** how long a keep-alive keeps a performer playing (s): longer than the gap between the director's updates */
export const PLAY_KEEP_S = 0.6;
const refOf = (p: GigPart): PerformerRef => (p.extra ? { extra: p.key } : p.agentId != null ? { agentId: p.agentId } : { pid: p.pid });
/** the sung notes of a voice part of a piece, as [start, end] pairs: the lead sings every phrase, the others of a chorus
 *  join on the odd phrases (song.ts sing) */
export function sungNotes(perf: Performance, lead: boolean, seconds = PIECE_S): number[] {
  const out: number[] = []; for (const e of compose(perf, seconds)) if (lead || (e.phrase ?? 0) % 2 === 1) out.push(e.t, e.t + e.dur); return out;
}

export class MusicDirector {
  private gigs: Gig[] = []; private since = Infinity; private seg = new Map<string, number>(); private extras = new Set<string>();
  constructor(private music: MusicSystem, private engine: AudioEngine, private hooks: DirectorHooks) {}
  /** `agents`: the simulation's detailed people; `pop`: the population's people out of doors now (the herders);
   *  `listener`: world position; call every frame (the schedule is re-read four times a second) */
  update(dt: number, agents: readonly PerformerAgent[], ctx: MusicCtx, listener: { x: number; y: number; z: number }, pop: readonly PopPerformer[] = []) {
    if ((this.since += dt) >= 0.25) { this.since = 0; this.gigs = musicAt(agents, ctx, pop); this.syncExtras(); }
    const byPid = new Map<number, PopPerformer>(); for (const o of pop) byPid.set(o.pid, o);
    const positions = new Map<string, { x: number; y: number; z: number }>();
    for (const g of this.gigs) {
      const parts = soundingParts(g);
      const where = parts.map(p => { const a = p.agentId != null ? agents[p.agentId] : null, o = p.pid != null ? byPid.get(p.pid) ?? null : null;
        // a performer is followed where they are now (at the height the schedule gave above their feet); a person of the
        // population no longer out of doors is gone (the piece stops)
        const w = a ? { x: a.pos[0], y: p.pos.y, z: -a.pos[1] } : p.pid != null ? (o ? { x: o.e, y: p.pos.y, z: -o.n } : null) : { x: p.pos.e, y: p.pos.y, z: -p.pos.n };
        return { p, w }; }).filter((x): x is { p: GigPart; w: { x: number; y: number; z: number } } => !!x.w);
      for (const x of where) positions.set(x.p.perf!.id, x.w);
      const near = where.some(x => Math.hypot(x.w.x - listener.x, x.w.y - listener.y, x.w.z - listener.z) < EARSHOT_M);
      // an ensemble starts and renews all its parts together, so they keep one melody in time (heterophony)
      let started: Performance | null = null;
      if (near && where.some(x => !this.music.isPlaying(x.p.perf!.id))) {
        const k = (this.seg.get(g.id) ?? -1) + 1; this.seg.set(g.id, k);
        for (const { p, w } of where) { const pf = p.perf!, piece: Performance = { ...pf, seed: pf.seed + 7919 * k, pieceSeed: pf.pieceSeed != null ? pf.pieceSeed + 7919 * k : undefined };
          if (this.music.perform(piece, w, PIECE_S) && pf.instrument === 'voice') started = piece; }
      }
      // everyone of the gig is seen playing or singing (near or far); the singers' faces follow the piece that started
      for (const p of g.parts) if (p.play && (p.pid == null || byPid.has(p.pid))) {
        const voice = p.play === 'sing' || p.play === 'sing_work', lead = !!p.perf && p.perf.instrument === 'voice';
        this.hooks.play(refOf(p), p.play, PLAY_KEEP_S, voice && started ? sungNotes(started, lead) : undefined);
      }
    }
    this.music.update(positions); // stops what is no longer scheduled (with a fade)
    if (this.seg.size > 500) { const live = new Set(this.gigs.map(g => g.id)); for (const id of [...this.seg.keys()]) if (!live.has(id)) this.seg.delete(id); }
  }
  private syncExtras() {
    const want = new Map<string, Gig['parts'][number]>();
    for (const g of this.gigs) for (const p of g.parts) if (p.extra) want.set(p.key, p);
    for (const k of this.extras) if (!want.has(k)) { this.hooks.removeExtra(k); this.extras.delete(k); }
    for (const [k, p] of want) if (!this.extras.has(k)) { this.hooks.addExtra(k, { sex: p.extra!.sex, seed: p.extra!.seed, e: p.pos.e, n: p.pos.n, y: p.extra!.floor, heading: p.extra!.heading, anim: p.extra!.anim }); this.extras.add(k); }
  }
  /** the gigs of the last schedule read (tests, overlay) */
  get current(): readonly Gig[] { return this.gigs; }
  /** dev overlay (F3): what is scheduled and what sounds, with tiers, claims, occlusion and placeholders */
  lines(): string[] {
    const playing = new Map(this.music.info().map(i => [i.id, i]));
    const out: string[] = [];
    for (const g of this.gigs) for (const p of soundingParts(g)) {
      const pf = p.perf!, i = playing.get(pf.id), mode = [...MESOPOTAMIAN_MODES, ...GREEK_MODES].find(m => m.id === pf.modeId);
      const occ = i ? this.engine.occlusionOf(i.panner) : null;
      const who = p.agentId != null ? `person ${p.agentId}` : p.pid != null ? `population person ${p.pid}` : 'court musician';
      out.push(`music ${i ? 'heard' : 'scheduled (out of earshot)'}: ${g.kind} · ${who} · ${INSTRUMENTS[pf.instrument].name}${pf.voices && pf.voices > 1 ? ` ×${pf.voices}` : ''}${p.play ? ` · seen: ${p.play}` : ''} · ${mode ? `${mode.name} (${mode.species}; ${mode.tier})` : ''} · tier ${g.tier} [${g.claims.join(', ')}]${occ ? ` · occlusion ${occ.gainDb.toFixed(1)} dB, ${Math.round(occ.cutoffHz)} Hz via ${occ.path}` : ''}${g.visual.placeholder ? ` · ${g.visual.note}` : ''}`);
    }
    if (!out.length) out.push('music: nobody is playing or singing now (only performers make music: SOUNDSCAPE §8); the magus’s chant is not performed (no attested text: M-06, B20a)');
    return out;
  }
}
