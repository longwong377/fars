// Plays the music schedule in the world (D-178): what src/audio/performers.ts says is being sung or played now is started
// at the performer's position when the listener is within earshot, follows the performer, is renewed with a new piece
// (a new seed) while the stretch lasts, and fades when it ends or the performer stops. The court's musicians, whom the
// simulation does not hold, are placed as seated extras while their music lasts (PLACEHOLDER dress, no instrument).
// A singer's jaw moves while she sings (the speech jaw; PLACEHOLDER: no singing mouth shape). Browser-side glue only:
// the decisions are in performers.ts, the evidence rules in music.ts.
import { musicAt, soundingParts, type Gig, type MusicCtx, type PerformerAgent } from './performers';
import type { MusicSystem } from './music';
import type { AudioEngine } from './engine';
import { INSTRUMENTS } from './instruments';
import { MESOPOTAMIAN_MODES, GREEK_MODES } from './tuning';

export interface DirectorHooks {
  /** place a court musician (grid e/n, floor height, facing) or take her away */
  addExtra(key: string, spec: { sex: 'm' | 'f'; seed: number; e: number; n: number; y: number; heading: number; anim: 'sit' | 'idle' }): void;
  removeExtra(key: string): void;
  /** a simulated person is singing: move the jaw for `seconds` */
  singing(agentId: number, seconds: number): void;
}
/** beyond this distance a piece is not started (the occlusion and the panner's distance law do the rest) */
export const EARSHOT_M = 120;
/** length of each rendered piece (s); a stretch longer than this is played as several pieces */
export const PIECE_S = 40;

export class MusicDirector {
  private gigs: Gig[] = []; private since = Infinity; private seg = new Map<string, number>(); private extras = new Set<string>();
  constructor(private music: MusicSystem, private engine: AudioEngine, private hooks: DirectorHooks) {}
  /** `agents`: the simulation's detailed people; `listener`: world position; call every frame (the schedule is
   *  re-read four times a second) */
  update(dt: number, agents: readonly PerformerAgent[], ctx: MusicCtx, listener: { x: number; y: number; z: number }) {
    if ((this.since += dt) >= 0.25) { this.since = 0; this.gigs = musicAt(agents, ctx); this.syncExtras(); }
    const positions = new Map<string, { x: number; y: number; z: number }>();
    for (const g of this.gigs) {
      const parts = soundingParts(g);
      const where = parts.map(p => { const a = p.agentId != null ? agents[p.agentId] : null;
        // a simulated performer is followed where they are now (at the mouth height the schedule gave)
        return { p, a, w: a ? { x: a.pos[0], y: p.pos.y, z: -a.pos[1] } : { x: p.pos.e, y: p.pos.y, z: -p.pos.n } }; });
      for (const x of where) positions.set(x.p.perf!.id, x.w);
      const near = where.some(x => Math.hypot(x.w.x - listener.x, x.w.y - listener.y, x.w.z - listener.z) < EARSHOT_M);
      // an ensemble starts and renews all its parts together, so they keep one melody in time (heterophony)
      if (near && where.some(x => !this.music.isPlaying(x.p.perf!.id))) {
        const k = (this.seg.get(g.id) ?? -1) + 1; this.seg.set(g.id, k);
        for (const { p, w } of where) { const pf = p.perf!; this.music.perform({ ...pf, seed: pf.seed + 7919 * k, pieceSeed: pf.pieceSeed != null ? pf.pieceSeed + 7919 * k : undefined }, w, PIECE_S); }
      }
      for (const { p, a } of where) if (a && p.perf!.instrument === 'voice' && this.music.isPlaying(p.perf!.id)) this.hooks.singing(a.id, 0.5);
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
  /** dev overlay (F3): what is scheduled and what sounds, with tiers, claims, occlusion and placeholders */
  lines(): string[] {
    const playing = new Map(this.music.info().map(i => [i.id, i]));
    const out: string[] = [];
    for (const g of this.gigs) for (const p of soundingParts(g)) {
      const pf = p.perf!, i = playing.get(pf.id), mode = [...MESOPOTAMIAN_MODES, ...GREEK_MODES].find(m => m.id === pf.modeId);
      const occ = i ? this.engine.occlusionOf(i.panner) : null;
      out.push(`music ${i ? 'heard' : 'scheduled (out of earshot)'}: ${g.kind} · ${p.agentId != null ? `person ${p.agentId}` : 'court musician'} · ${INSTRUMENTS[pf.instrument].name}${pf.voices && pf.voices > 1 ? ` ×${pf.voices}` : ''} · ${mode ? `${mode.name} (${mode.species}; ${mode.tier})` : ''} · tier ${g.tier} [${g.claims.join(', ')}]${occ ? ` · occlusion ${occ.gainDb.toFixed(1)} dB, ${Math.round(occ.cutoffHz)} Hz via ${occ.path}` : ''}${g.visual.placeholder ? ` · ${g.visual.note}` : ''}`);
    }
    if (!out.length) out.push('music: nobody is playing or singing now (only performers make music: SOUNDSCAPE §8)');
    return out;
  }
}
