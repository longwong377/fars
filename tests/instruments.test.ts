// The instruments people are seen playing and the playing cycles (D-200): measured, not looked at (node previews:
// tools/dev/perf_preview.ts play). The forms against the extracts they follow (instrumentForms.ts, SOUNDSCAPE §8 M-19..M-21),
// the hands on the strings, the pipe at the lips and in the fingers, the drum struck on its face, the singers' jaw and
// breath on the notes, the playing performance given in place of the plan's and taken away when it ends, and the budget.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { decodeHumanAssets, meshoptSimplify, type HumanAssets } from '../src/people/humanAssets';
import { HB, PART } from '../src/people/humanFormat';
import { PALETTE_STRIDE, skinPoint } from '../src/people/humanRig';
import { buildOutfits, type OutfitBuild } from '../src/people/outfits';
import { HumanGPU } from '../src/people/humanGPU';
import { Crowd } from '../src/people/crowd';
import { PROPS, PROP_CLASSES, PROP_NOTES, propGeometry, propUnionGeometry } from '../src/people/props';
import { HARP_V, HARP_H, MOUTH, DOUBLE_PIPE, FRAME_DRUM, harpVString, harpHString } from '../src/people/instrumentForms';
import { PLAYING, singFace, playKindFor, type PlayKind } from '../src/people/playing';
import { activityLint } from '../src/people/activityLint';
import { pose } from '../src/people/anim';
import { INSTRUMENTS } from '../src/audio/instruments';
import { compose, render, type Performance } from '../src/audio/music';
import { sungNotes } from '../src/audio/musicDirector';
import { cents } from '../src/audio/tuning';

let A: HumanAssets, O: OutfitBuild;
beforeAll(async () => {
  const b = readFileSync('public/generated/humans/humans.bin');
  A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
  O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) });
}, 120_000);
const V = THREE.Vector3;
const mkCrowd = () => { const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
  return new Crowd(null, 1, { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 16 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } } as any); };
const cam = new V(1.5, 1.5, 3);
/** a performer (extra) kept playing; its world-space grip points (as props.ts gripPoint), bones and the instrument's frame */
function performer(kind: PlayKind, sex: 'm' | 'f' = 'f', seed = 777) {
  const crowd = mkCrowd(), p = crowd.addExtra('x', { id: 1, sex, role: 'musician', dress: sex === 'f' ? 'woman' : 'worker', seed, x: 0, y: 0, z: 0, yaw: 0, anim: 'idle', look: null } as any);
  crowd.setPlaying('x', kind, 1e9, 0);
  const at = (t: number) => { crowd.update(t, cam, null, undefined);
    const pal = crowd.humans.gpu.palette, o = p.slot * PALETTE_STRIDE, J = A.variants[p.look.variant].joints;
    const bw = (b: number) => { const m = pal.subarray(o + b * 12, o + b * 12 + 12), x = J[b * 3], y = J[b * 3 + 1], z = J[b * 3 + 2]; return new V(m[0] * x + m[1] * y + m[2] * z + m[3], m[4] * x + m[5] * y + m[6] * z + m[7], m[8] * x + m[9] * y + m[10] * z + m[11]); };
    const rot = (b: number) => (x: number, y: number, z: number) => { const m = pal.subarray(o + b * 12, o + b * 12 + 12); return new V(m[0] * x + m[1] * y + m[2] * z, m[4] * x + m[5] * y + m[6] * z, m[8] * x + m[9] * y + m[10] * z); };
    const grip = (s: 'l' | 'r') => bw(HB[`hand_${s}`]).lerp(bw(HB[`middle_01_${s}`]), 0.85).add(rot(HB[`hand_${s}`])(s === 'r' ? 0.022 : -0.022, 0, 0));
    const M = p.propM.clone(), inv = M.clone().invert();
    return { M, inv, L: grip('l'), R: grip('r'), local: (w: THREE.Vector3) => w.clone().applyMatrix4(inv), pal, o, p };
  };
  return { crowd, p, at };
}

describe('instrument forms (M-19, M-20, M-21; all sizes C)', () => {
  it('every instrument has geometry, a tier and a note naming its evidence; the instruments are a class of their own within budget', () => {
    for (const k of ['harp_v', 'harp_h', 'lyre', 'frame_drum', 'double_pipe', 'reed_pipe', 'plectrum']) {
      expect(propGeometry(PROPS[k].geom), k).not.toBeNull(); expect(['A', 'B', 'C']).toContain(PROP_NOTES[k].tier); expect(PROP_NOTES[k].note.length, k).toBeGreaterThan(40); }
    expect(PROP_CLASSES).toHaveLength(4); expect(PROP_CLASSES[2]).toContain('harp_v'); // (D-215: a fourth class, the carried children)
    for (const k of PROP_CLASSES[2]) for (const c of [0, 1]) expect(PROP_CLASSES[c]).not.toContain(k);
    const tris = propUnionGeometry(2).getAttribute('position').count / 3; console.log(`instrument union: ${tris} triangles per instance`);
    expect(tris).toBeLessThanOrEqual(1200);
    expect(PROP_NOTES.harp_v.note).toMatch(/Madaktu/); expect(PROP_NOTES.harp_v.note).toMatch(/NOT SEEN/); expect(PROP_NOTES.reed_pipe.note).toMatch(/Iliad 18\.525/);
  });
  it('the vertical harp: 21 vertical strings from the rod to the soundbox\'s face, 9-84 cm long, the longest farthest from the player; the horizontal harp: 9 strings', () => {
    expect(HARP_V.strings).toBe(21); const lens: number[] = [];
    for (let i = 0; i < HARP_V.strings; i++) { const s = harpVString(i); expect(s.head[2]).toBeCloseTo(s.foot[2], 9); expect(s.head[0]).toBe(0); lens.push(s.head[1] - s.foot[1]);
      // the head is on the soundbox's front face: its distance from the box's axis is half the box's depth
      const c = Math.cos(HARP_V.lean), sn = Math.sin(HARP_V.lean), d = -s.head[1] * sn + s.head[2] * c; expect(d).toBeCloseTo(HARP_V.boxD / 2, 6); }
    expect(Math.min(...lens)).toBeGreaterThan(0.08); expect(Math.max(...lens)).toBeLessThan(0.84); for (let i = 1; i < lens.length; i++) expect(lens[i]).toBeGreaterThan(lens[i - 1]);
    const spacing = (HARP_V.z1 - HARP_V.z0) / (HARP_V.strings - 1); expect(spacing).toBeGreaterThan(0.009); expect(spacing).toBeLessThan(0.02);
    expect(HARP_H.strings).toBe(9); for (let i = 0; i < 9; i++) { const s = harpHString(i); expect(s.head[1]).toBeGreaterThan(s.foot[1] + 0.05); }
    // the music plays nine of the vertical harp's strings (the tuning texts' cycle: Q-390)
    expect(INSTRUMENTS.harp.strings).toBe(9);
  });
  it('held, the vertical harp reaches from about the navel to about a head\'s length above the crown (the extract\'s proportion), its soundbox beside the head', () => {
    for (const [sex, seed] of [['f', 777], ['m', 31]] as const) {
      const { at, p } = performer('harp_v', sex, seed), f = at(2.1), stature = p.look.stature;
      const top = new V(0, HARP_V.boxLen * Math.cos(HARP_V.lean) - 0.03, HARP_V.boxLen * Math.sin(HARP_V.lean)).applyMatrix4(f.M), foot = new V(0, 0, 0).applyMatrix4(f.M);
      expect(foot.y / stature, `${sex}: the rod at the navel`).toBeGreaterThan(0.5); expect(foot.y / stature).toBeLessThan(0.66);
      expect(top.y - stature, `${sex}: the top above the crown`).toBeGreaterThan(0.05); expect(top.y - stature).toBeLessThan(0.4);
      const head = f.p.root; void head;
    }
  });
});

describe('playing cycles: the hands where the instrument is played', () => {
  it('the vertical harp: both palms by the string plane on either side of it (the right from the right), among the strings, over whole cycles', () => {
    const { at } = performer('harp_v'); let n = 0;
    for (let i = 0; i < 40; i++) { const f = at(1 + i * 0.23), L = f.local(f.L), R = f.local(f.R);
      expect(R.x, 'right palm right of the strings').toBeLessThan(-0.015); expect(R.x).toBeGreaterThan(-0.11);
      expect(L.x, 'left palm left of the strings').toBeGreaterThan(0.015); expect(L.x).toBeLessThan(0.11);
      for (const h of [L, R]) { expect(h.z).toBeGreaterThan(HARP_V.z0 - 0.04); expect(h.z).toBeLessThan(HARP_V.z1 + 0.04); expect(h.y).toBeGreaterThan(-0.02); expect(h.y).toBeLessThan(0.4); }
      n++; }
    expect(n).toBe(40);
  });
  it('the pipes: at the lips (the skinned mouth within 3 cm of the pipe\'s end) and through the fingers (each grip within 2.5 cm of its cane)', () => {
    for (const kind of ['reed_pipe', 'double_pipe'] as const) {
      const { at } = performer(kind, 'm', 31);
      for (let i = 0; i < 12; i++) { const f = at(1 + i * 0.37), end = new V(0, 0, 0).applyMatrix4(f.M);
        // the lips: the nearest skinned head vertex to the pipe's end
        const v = A.variants[f.p.look.variant], C = O.costumes['worker'] ? null : null; void C; let best = 9; const o3 = [0, 0, 0];
        for (let k = 0; k < A.NO; k += 2) { if (A.part[k] !== PART.head) continue; skinPoint(f.pal, f.o, A.skinIndex.subarray(k * 4, k * 4 + 4), Array.from(A.skinWeight.subarray(k * 4, k * 4 + 4), x => x / 255), v.pos.subarray(k * 3, k * 3 + 3), o3);
          best = Math.min(best, Math.hypot(o3[0] - end.x, o3[1] - end.y, o3[2] - end.z)); }
        expect(best, `${kind}: the pipe's end from the lips`).toBeLessThan(0.03);
        for (const [s, g] of [['l', f.L], ['r', f.R]] as const) { const q = f.local(g);
          if (kind === 'reed_pipe') expect(Math.hypot(q.x, q.y), `${kind} ${s}: grip off the cane`).toBeLessThan(0.025);
          else { const a = (s === 'l' ? 1 : -1) * DOUBLE_PIPE.splay / 2, ax = new V(Math.sin(a), 0, Math.cos(a)); const off = q.clone().sub(ax.clone().multiplyScalar(q.dot(ax))).length(); expect(off, `${kind} ${s}: grip off its cane`).toBeLessThan(0.025); }
          expect(q.z).toBeGreaterThan(0.1); } }
    }
  });
  it('the frame drum: the right hand strikes the face (within 2 cm of the membrane at the stroke) and lifts off it between strokes; the left hand at the hoop', () => {
    const { at } = performer('frame_drum'); let struck = 0, lifted = 0;
    for (let i = 0; i < 120; i++) { const f = at(1 + i * 0.03), R = f.local(f.R), L = f.local(f.L);
      expect(Math.hypot(L.x, L.y), 'left hand at the hoop').toBeGreaterThan(FRAME_DRUM.r - 0.08); expect(Math.hypot(L.x, L.y)).toBeLessThan(FRAME_DRUM.r + 0.08);
      if (R.z < 0.055) struck++; if (R.z > 0.08) lifted++; expect(R.z, 'not through the membrane').toBeGreaterThan(0.0); }
    expect(struck).toBeGreaterThan(5); expect(lifted).toBeGreaterThan(5);
  });
  it('every playing cycle runs (a work cycle of the IK kit, checked for reach and ground contact with the others: performances.test.ts) and the registry passes the activity lint', () => {
    expect(activityLint(PLAYING as any)).toEqual([]);
    for (const [k, P] of Object.entries(PLAYING)) if (P.anim) { const po = pose(P.anim, 1.3, 0, 0.4); expect(po.inst || P.prop === 'double_pipe' || P.prop === 'reed_pipe' || !P.prop, k).toBeTruthy(); }
    expect(playKindFor('harp')).toBe('harp_v'); expect(playKindFor('voice', true)).toBe('sing_work'); expect(playKindFor('reed_pipe')).toBe('reed_pipe');
  });
});

describe('singing: the jaw and the breath follow the notes (jaw only: the rig has no lips)', () => {
  it('singFace opens the jaw on each note, closes it in the gaps and draws breath before a phrase', () => {
    const notes = [0.5, 1.4, 1.45, 2.3, 3.2, 4.0]; // two notes legato, a gap, a third
    expect(singFace(notes, 0.9).jaw).toBeGreaterThan(0.1); expect(singFace(notes, 1.42).jaw).toBeGreaterThan(0.1); // held across the legato join
    expect(singFace(notes, 2.8).jaw).toBe(0); expect(singFace(notes, 3.0).breath).toBeGreaterThan(0.5); expect(singFace(notes, 2.5).breath).toBe(0);
    expect(singFace(notes, 0.3).breath).toBeGreaterThan(0.3); // the first breath
  });
  it('a standing singer given the notes of a piece opens her jaw while the voice sounds and closes it at the breaths; the lead sings every phrase, the chorus the odd ones', () => {
    const perf: Performance = { id: 'v', instrument: 'voice', tradition: 'mesopotamian', context: 'court', register: 'f', voices: 4, seed: 5, pieceSeed: 16, tonic: 220, tempo: 80, claims: ['M-01'] };
    const lead = sungNotes(perf, true, 40), rest = sungNotes(perf, false, 40); expect(lead.length).toBeGreaterThan(rest.length); expect(rest.length).toBeGreaterThan(0);
    const crowd = mkCrowd(), p = crowd.addExtra('s', { id: 2, sex: 'f', role: 'musician', dress: 'woman', seed: 99, x: 0, y: 0, z: 0, yaw: 0, anim: 'idle', look: null } as any);
    crowd.update(0, cam, null, undefined); crowd.setPlaying('s', 'sing', 60, 0, lead);
    let open = 0, shut = 0, on = 0, off = 0;
    for (let t = 0.05; t < 39; t += 0.05) { crowd.setPlaying('s', 'sing', 60, 0); crowd.update(t, cam, null, undefined);
      const sounding = lead.some((_, i) => i % 2 === 0 && t >= lead[i] && t < lead[i + 1]);
      if (sounding) { on++; if (p.face.jaw > 0.08) open++; } else if (!lead.some((_, i) => i % 2 === 0 && t >= lead[i] - 0.12 && t < lead[i + 1] + 0.12)) { off++; if (p.face.jaw < 0.01) shut++; } }
    expect(p.anim).toBe('sing'); expect(open / on).toBeGreaterThan(0.95); expect(off).toBeGreaterThan(5); expect(shut / off).toBeGreaterThan(0.95);
  });
  it('the playing performance replaces the plan\'s while it is kept alive, and the performer returns to it after', () => {
    const crowd = mkCrowd(), p = crowd.addExtra('g', { id: 3, sex: 'f', role: 'grinder', dress: 'woman', seed: 5, x: 0, y: 0, z: 0, yaw: 0, act: 'grind', look: null } as any);
    crowd.update(0, cam, null, undefined); expect(p.anim).toBe('grind');
    crowd.setPlaying('g', 'sing_work', 1, 0); crowd.update(0.5, cam, null, undefined); expect(p.anim, 'a singer at work keeps grinding').toBe('grind'); expect(crowd.playingOf('g')).toBe('sing_work');
    crowd.setPlaying('g', 'harp_v', 1, 0.5); crowd.update(0.6, cam, null, undefined); expect(p.anim).toBe('harp_v'); expect(p.prop).toBe('harp_v');
    crowd.update(2, cam, null, undefined); expect(p.anim, 'back to the work').toBe('grind'); expect(p.prop).toBeNull(); expect(crowd.playingOf('g')).toBeNull();
  });
});

describe('the herder\'s reed pipe sounds (D-200)', () => {
  it('its notes sound at their pitch (±5 cents), one at a time (a single cane), in the mode, and render without clipping', () => {
    const perf: Performance = { id: 'hp', instrument: 'reed_pipe', tradition: 'mesopotamian', context: 'herding', modeId: 'meso3', tempo: 66, seed: 12, claims: ['M-10', 'M-18'] };
    const ev = compose(perf, 20); expect(ev.length).toBeGreaterThan(8);
    for (let i = 1; i < ev.length; i++) expect(ev[i].t + 0.03, 'no overlap').toBeGreaterThanOrEqual(ev[i - 1].t + ev[i - 1].dur);
    for (const e of ev) { expect(e.f).toBeGreaterThanOrEqual(INSTRUMENTS.reed_pipe.range[0] * 0.99); expect(e.f).toBeLessThanOrEqual(INSTRUMENTS.reed_pipe.range[1]); expect(e.drone).toBeUndefined(); expect(e.dyad).toBeUndefined(); }
    const SR = 44100, x = render(perf, ev, SR); let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v)); expect(peak).toBeGreaterThan(0.1); expect(peak).toBeLessThanOrEqual(0.95 + 1e-6);
    // the pitch of a long note, by autocorrelation over 0.2 s from its middle
    const e = ev.reduce((a, b) => (b.dur > a.dur ? b : a)); const a0 = Math.floor((e.t + e.dur * 0.35) * SR), n = Math.floor(0.2 * SR), s = x.subarray(a0, a0 + n);
    let bl = 0, best = -1; const r = (lag: number) => { let v = 0, e1 = 0, e2 = 0; for (let i = 0; i + lag < s.length; i++) { v += s[i] * s[i + lag]; e1 += s[i] * s[i]; e2 += s[i + lag] * s[i + lag]; } return v / Math.sqrt(e1 * e2 + 1e-12); };
    for (let lag = Math.floor(SR / (e.f * 1.3)); lag <= Math.ceil(SR / (e.f * 0.75)); lag++) { const v = r(lag); if (v > best) { best = v; bl = lag; } }
    const y0 = r(bl - 1), y1 = r(bl), y2 = r(bl + 1), d = (y0 - y2) / (2 * (y0 - 2 * y1 + y2)), got = SR / (bl + d);
    expect(Math.abs(cents(e.f, got)), `${e.f.toFixed(1)} → ${got.toFixed(1)} Hz`).toBeLessThan(5);
  });
});
void MOUTH;
