// The recordings (D-620): public/audio/manifest.json lists every recorded file the world can play (written by
// tools/audio/fetch.mjs for the beds, one-shots and footsteps, by tools/audio/irs.mjs for the rooms' impulse responses).
// Nothing is fetched before the world is walkable: the library starts only when the soundscape's frame loop runs with a
// running audio context (the world is up and the player has clicked), then loads what is asked for, lazily, two files at a
// time at low fetch priority, nearest need first (a bed asked for now before a one-shot set). Decoded buffers are kept
// under a byte budget (least recently used dropped first; a bed that is playing is pinned). A file that fails to load is
// marked missing and the synthesis plays in its place (soundscape.ts), so a build without recordings still sounds.
export type Section = 'beds' | 'oneshots' | 'foot' | 'ir';
export interface Rec {
  /** path under public/audio/ */
  file: string;
  /** seconds, bytes on disk, integrated loudness (LUFS; beds -23) */
  dur: number; bytes?: number; lufs?: number;
  /** where it came from and on what terms (ASSET_LEDGER.md carries the same) */
  src?: string; licence?: string; author?: string; url?: string;
}
export interface Manifest { version: number; sections: Partial<Record<Section, Record<string, Rec[]>>> }

/** the decoded budget (bytes of float PCM): ~190 MB is ~8 minutes of stereo at 48 kHz (C; C4's memory budget, D-620) */
export const DECODED_BUDGET = 192 * 2 ** 20;
/** files fetched at once */
export const CONCURRENCY = 2;

type Loader = { fetch: (url: string) => Promise<ArrayBuffer | null>; decode: (data: ArrayBuffer) => Promise<AudioBuffer> };
interface Slot { buf: AudioBuffer | null; state: 'queued' | 'loading' | 'ready' | 'missing'; bytes: number; used: number; prio: number }

export class SoundLibrary {
  manifest: Manifest | null = null;
  state: 'idle' | 'loading' | 'ready' | 'none' = 'idle';
  private slots = new Map<string, Slot>(); private queue: string[] = []; private active = 0; private clock = 0;
  /** pinned files (a bed's deck holds its variants while it plays) */
  private pins = new Map<string, number>();
  decodedBytes = 0; loaded = 0; failed = 0;
  constructor(readonly base: string, private io?: Loader) {}
  /** the world is walkable and sound is on: read the manifest (once) */
  start(ctx: BaseAudioContext) {
    if (this.state !== 'idle') return; this.state = 'loading';
    this.io ??= {
      fetch: async url => { try { const r = await fetch(url, { priority: 'low' } as RequestInit); return r.ok ? await r.arrayBuffer() : null; } catch { return null; } },
      decode: data => ctx.decodeAudioData(data),
    };
    void this.io.fetch(`${this.base}audio/manifest.json`).then(b => {
      if (!b) { this.state = 'none'; return; }
      try { this.manifest = JSON.parse(new TextDecoder().decode(b)); this.state = 'ready'; this.pump(); } catch { this.state = 'none'; }
    });
  }
  /** the manifest's entries of a set ([] when it lists none or is not read yet) */
  list(sec: Section, key: string): Rec[] { return this.manifest?.sections[sec]?.[key] ?? []; }
  has(sec: Section, key: string) { return this.list(sec, key).length > 0; }
  /** the decoded buffer of a file, or null (and its load queued: `prio` 0 first) */
  get(file: string, prio = 1): AudioBuffer | null {
    let s = this.slots.get(file); this.clock++;
    if (!s) { s = { buf: null, state: 'queued', bytes: 0, used: this.clock, prio }; this.slots.set(file, s); this.queue.push(file); this.pump(); }
    s.used = this.clock; if (s.state === 'queued' && prio < s.prio) { s.prio = prio; }
    return s.buf;
  }
  /** a set's buffers that are loaded (every variant's load is queued) */
  ready(sec: Section, key: string, prio = 1): { rec: Rec; buf: AudioBuffer }[] {
    const out: { rec: Rec; buf: AudioBuffer }[] = [];
    for (const rec of this.list(sec, key)) { const buf = this.get(rec.file, prio); if (buf) out.push({ rec, buf }); }
    return out;
  }
  missing(file: string) { return this.slots.get(file)?.state === 'missing'; }
  pin(file: string, on: boolean) { const n = (this.pins.get(file) ?? 0) + (on ? 1 : -1); if (n > 0) this.pins.set(file, n); else this.pins.delete(file); }
  private pump() {
    if (this.state !== 'ready' || !this.io) return; // nothing is fetched before the start (the world walkable) and the manifest
    while (this.active < CONCURRENCY && this.queue.length) {
      this.queue.sort((a, b) => this.slots.get(a)!.prio - this.slots.get(b)!.prio);
      const file = this.queue.shift()!, s = this.slots.get(file)!; s.state = 'loading'; this.active++;
      void this.io!.fetch(`${this.base}audio/${file}`).then(async data => {
        if (!data) throw new Error('not found');
        const buf = await this.io!.decode(data); s.buf = buf; s.state = 'ready'; s.bytes = buf.length * buf.numberOfChannels * 4; this.decodedBytes += s.bytes; this.loaded++; this.evict();
      }).catch(() => { s.state = 'missing'; this.failed++; }).finally(() => { this.active--; this.pump(); });
    }
  }
  /** drop the least recently used decoded buffers over the budget (never a pinned one) */
  private evict() {
    if (this.decodedBytes <= DECODED_BUDGET) return;
    const cand = [...this.slots].filter(([f, s]) => s.state === 'ready' && !this.pins.has(f)).sort((a, b) => a[1].used - b[1].used);
    for (const [f, s] of cand) { if (this.decodedBytes <= DECODED_BUDGET) break; this.decodedBytes -= s.bytes; this.slots.delete(f); }
  }
  /** dev overlay (F3) */
  line(): string {
    if (this.state === 'none') return 'recordings: none (public/audio/manifest.json absent): the synthesis plays every layer, PLACEHOLDER';
    if (this.state !== 'ready') return `recordings: ${this.state}`;
    const n = (s: Section) => Object.keys(this.manifest!.sections[s] ?? {}).length;
    return `recordings (D-620): ${n('beds')} beds, ${n('oneshots')} one-shot sets, ${n('foot')} footstep sets, ${n('ir')} rooms listed · ${this.loaded} loaded, ${this.failed} failed, ${(this.decodedBytes / 2 ** 20).toFixed(0)} MB decoded`;
  }
}
