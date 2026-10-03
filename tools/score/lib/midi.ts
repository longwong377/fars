// A Standard MIDI File writer (type 0, one track): the score's parts leave the composer as notes and controller curves in
// SECONDS (the composer owns tempo and rubato), written at a fixed 120 BPM with 480 ticks a beat (960 ticks a second) so the
// renderer plays the times exactly as composed.
export interface Note { t: number; dur: number; p: number; v: number }
/** a controller curve: [time (s), value 0..127] points; written as a dense ramp (every 20 ms between points) */
export type Curve = [number, number][];
export interface MidiPart { notes: Note[]; cc?: Record<number, Curve>; bend?: Curve /* semitones, ±2 range */; program?: number }

const TPS = 960; // ticks a second at 120 BPM, 480 tpq
const vlq = (n: number) => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };

export function midiBytes(part: MidiPart, chan = 0): Uint8Array {
  const ev: { tick: number; ord: number; data: number[] }[] = [];
  const tick = (s: number) => Math.max(0, Math.round(s * TPS));
  // controllers first at time 0 (set before the first note), then ramps
  for (const [num, curve] of Object.entries(part.cc ?? {})) {
    const c = [...curve].sort((a, b) => a[0] - b[0]); let last = -1;
    const put = (t: number, v: number) => { const q = Math.max(0, Math.min(127, Math.round(v))); if (q === last) return; last = q; ev.push({ tick: tick(t), ord: 0, data: [0xb0 | chan, +num, q] }); };
    if (c.length) put(0, c[0][1]);
    for (let i = 0; i < c.length; i++) {
      const [t0, v0] = c[i], nx = c[i + 1]; put(t0, v0);
      if (nx) for (let t = t0 + 0.02; t < nx[0]; t += 0.02) put(t, v0 + ((nx[1] - v0) * (t - t0)) / (nx[0] - t0));
    }
  }
  if (part.bend) { let last = -1; for (let i = 0; i < part.bend.length; i++) { const [t0, s0] = part.bend[i], nx = part.bend[i + 1];
    const put = (t: number, s: number) => { const v = Math.max(0, Math.min(16383, Math.round(8192 + (s / 2) * 8191))); if (v === last) return; last = v; ev.push({ tick: tick(t), ord: 0, data: [0xe0 | chan, v & 0x7f, v >> 7] }); };
    put(t0, s0); if (nx) for (let t = t0 + 0.01; t < nx[0]; t += 0.01) put(t, s0 + ((nx[1] - s0) * (t - t0)) / (nx[0] - t0)); } }
  for (const n of part.notes) {
    const p = Math.round(n.p); if (p < 0 || p > 127) continue;
    const v = Math.max(1, Math.min(127, Math.round(n.v)));
    ev.push({ tick: tick(n.t), ord: 2, data: [0x90 | chan, p, v] });
    ev.push({ tick: tick(n.t + n.dur), ord: 1, data: [0x80 | chan, p, 0] }); // offs before ons at the same tick (repeated notes)
  }
  ev.sort((a, b) => a.tick - b.tick || a.ord - b.ord);
  const trk: number[] = [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20]; // tempo 500000 us/beat
  if (part.program != null) trk.push(0, 0xc0 | chan, part.program);
  let prev = 0; for (const e of ev) { trk.push(...vlq(e.tick - prev), ...e.data); prev = e.tick; }
  trk.push(...vlq(TPS * 2), 0xff, 0x2f, 0); // 2 s tail for the release
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0];
  const len = trk.length, th = [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255];
  return Uint8Array.from([...head, ...th, ...trk]);
}
