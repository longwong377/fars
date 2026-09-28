// A crowd heard from afar (session 10, WORLD_INVENTORY GB56: "a court assembly heard from afar"). The population's voices
// (voices.ts, D-245) are individual within 20 m and a bed of grains to 60 m; beyond that nobody was heard, so a court assembly
// of hundreds in the Apadana's court fell silent 61 m away. Here the talkers from 60 m to FAR_R are heard as what a crowd is
// at a distance: an unintelligible murmur, its words lost (no lexicon is sampled: nothing to read as language), its level the
// incoherent sum of the voices (√n), its top end lost with distance, fluttering at the pace of syllables as voices rise and
// fall. The listener's surroundings are split into 8 sectors; each sector with talkers is one NoiseStream (never a loop,
// beds.ts) through a speech-band filter, placed at its talkers' centroid (so walls between occlude it: engine.route) and
// attenuated by the panner's distance law. All C (a procedural design; the levels calibrated against the bed grains).
import type { AudioEngine } from './engine';
import { NoiseStream } from './beds';
import type { NearPerson } from './voices';
import { Rng } from '../core/rng';
import type { Vec3 } from './speech';
import { unitsFor, voiceLang } from './voices';
import { neuralVoice, type NeuralVoice } from './neural/identity';
import type { NeuralVoices } from './neural/client';

export const FAR_R = 400, FAR_SECTORS = 8;
/** the gain of one talker's share of the murmur before the distance law (√n talkers), calibrated so that n talkers at 60 m
 *  sit ~6 dB under the same n in the grain bed there (the bed's grains are clearer speech; C) */
export const FAR_GAIN = 0.12;
interface Sector { /** D-336: the next grain of a far talker's own voice */ nextGrain?: number; s: NoiseStream; bp: BiquadFilterNode; lp: BiquadFilterNode; flutter: GainNode; g: GainNode; pan: PannerNode; nextFlutter: number; live: boolean }
export class FarCrowd {
  private sectors: (Sector | null)[] = new Array(FAR_SECTORS).fill(null); private rng = new Rng(1, 'farcrowd');
  /** the last update (tests, dev overlay): talkers per sector and their mean distance */
  readonly stats = { talkers: 0, sectors: [] as { n: number; d: number; gain: number }[] };
  constructor(readonly e: AudioEngine, readonly nearR = 60) {}
  /** D-336 (UD-22): the far talkers' own voices: now and then a grain of one of them (a unit of theirs already rendered by the
   *  neural voices, else its render queued at the lowest priority), through the sector's distance filter, over the murmur */
  neural: NeuralVoices | null = null; private nv = new Map<string, NeuralVoice>(); grains = 0;
  /** the sector index (0 = N, clockwise) of a point seen from the listener */
  static sectorOf(dx: number, dz: number) { const a = Math.atan2(dx, -dz); return ((Math.round(a / (2 * Math.PI / FAR_SECTORS)) % FAR_SECTORS) + FAR_SECTORS) % FAR_SECTORS; }
  /** the talkers' share per sector (pure: tests): count, centroid, mean distance of the talkers from nearR to FAR_R */
  static bins(people: readonly NearPerson[], L: Vec3, nearR = 60) {
    const B = Array.from({ length: FAR_SECTORS }, () => ({ n: 0, x: 0, y: 0, z: 0, d: 0, who: [] as NearPerson[] }));
    for (const p of people) { if (!p.talking) continue; const dx = p.x - L.x, dz = p.z - L.z, d = Math.hypot(dx, dz); if (d <= nearR || d > FAR_R) continue;
      const b = B[FarCrowd.sectorOf(dx, dz)]; b.n++; if (b.who.length < 6) b.who.push(p); else if (((b.n * 2654435761) >>> 0) % b.n < 6) b.who[b.n % 6] = p; b.x += p.x; b.y += p.y; b.z += p.z; b.d += d; }
    for (const b of B) if (b.n) { b.x /= b.n; b.y /= b.n; b.z /= b.n; b.d /= b.n; }
    return B;
  }
  update(people: readonly NearPerson[], L: Vec3) {
    const e = this.e, c = e.ctx; if (!c || c.state !== 'running') return; const now = c.currentTime;
    const B = FarCrowd.bins(people, L, this.nearR); this.stats.talkers = 0; this.stats.sectors = [];
    B.forEach((b, i) => {
      let S = this.sectors[i]; const gain = b.n ? FAR_GAIN * Math.sqrt(b.n) : 0; this.stats.talkers += b.n; this.stats.sectors.push({ n: b.n, d: b.d, gain });
      if (!b.n) { if (S?.live) { S.g.gain.setTargetAtTime(0, now, 0.8); S.live = false; } return; }
      if (!S) { const s = new NoiseStream(e, 'pink', { seg: 6, fade: 0.8, sampleRate: 16000 }), bp = c.createBiquadFilter(), lp = c.createBiquadFilter(), flutter = c.createGain(), g = c.createGain();
        bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.7; lp.type = 'lowpass'; lp.Q.value = 0.5; g.gain.value = 0; flutter.gain.value = 1;
        const pan = e.panner(b.x, b.y + 1.5, b.z, 2, 2000); pan.panningModel = 'equalpower';
        s.out.connect(bp); bp.connect(lp); lp.connect(flutter); flutter.connect(g); g.connect(pan); e.route(pan, 'voices');
        S = this.sectors[i] = { s, bp, lp, flutter, g, pan, nextFlutter: 0, live: false }; }
      S.s.tick(); S.live = true;
      S.pan.positionX.setTargetAtTime(b.x, now, 0.5); S.pan.positionY.setTargetAtTime(b.y + 1.5, now, 0.5); S.pan.positionZ.setTargetAtTime(b.z, now, 0.5);
      S.lp.frequency.setTargetAtTime(Math.max(450, 2200 - 4 * b.d), now, 0.5); S.g.gain.setTargetAtTime(gain, now, 0.6);
      if (this.neural?.stats.ready && b.who.length && now >= (S.nextGrain ?? 0)) {
        const p = b.who[Math.floor(this.rng.next() * b.who.length)], L = voiceLang(p.lang, p.langs).lang, U = L ? unitsFor(L) : null;
        let v = this.nv.get(p.key); if (!v) { v = neuralVoice({ seed: p.seed, sex: p.sex, age: p.age, lang: p.lang }); if (this.nv.size > 4000) this.nv.clear(); this.nv.set(p.key, v); }
        const pool = U ? [...U.lines, ...U.words] : [], u = pool.length ? pool[Math.floor(this.rng.next() * pool.length)] : null;
        const pcm = u ? this.neural.get(v, u.id, u.ipa, u.intonation, 4) : null;
        if (pcm) { const buf = c.createBuffer(1, pcm.length, 24000); buf.getChannelData(0).set(pcm); const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = 0.97 + 0.06 * this.rng.next();
          const gg = c.createGain(); gg.gain.value = 0.9 + 0.6 * this.rng.next(); src.connect(gg); gg.connect(S.lp); src.start(now + 0.02); src.stop(now + 0.05 + buf.duration * 1.05); this.grains++;
          S.nextGrain = now + buf.duration * (0.5 + 0.7 * this.rng.next()) / Math.min(3, Math.max(1, Math.sqrt(b.n) / 2)); }
        else S.nextGrain = now + 0.4 + 0.6 * this.rng.next(); }
      // the syllabic flutter: a few voices rising and falling over the rest (fewer voices, deeper flutter; C)
      if (now >= S.nextFlutter) { const depth = Math.min(0.6, 1.2 / Math.sqrt(b.n + 1)); S.flutter.gain.setTargetAtTime(1 - depth * this.rng.next(), now, 0.05); S.nextFlutter = now + 0.1 + 0.2 * this.rng.next(); }
    });
  }
  lines(): string[] { const s = this.stats; return s.talkers ? [`far crowd (session 10, C): ${s.talkers} talkers 60-${FAR_R} m in ${s.sectors.filter(x => x.n).length} sectors (unintelligible murmur${this.neural?.stats.ready ? `, ${this.grains} grains of their own voices` : ''})`] : []; }
}
