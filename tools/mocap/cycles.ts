// D-333: cutting loops out of a retargeted take. Gaits: cycles from one left-foot strike to the next (the left ankle at its
// farthest ahead of the pelvis), taken from the steady middle of the take, resampled uniformly in phase and closed
// (drift spread linearly over the loop). Loops (standing, sitting, working): the pair of frames `len` apart within a
// window whose poses are closest, closed the same way. The performer's frame: gaits face the travel direction and the
// origin moves with the mean speed; loops face the mean pelvis heading and stay at the mean pelvis position.
import { loadTake, retargetFrame, fk, headingOf, type Take, type Sample } from './retarget';
import { POSE_BONES, type Pose, type E3 } from '../../src/people/anim';
import type { Posed, V3 } from './amc';

export interface Baked { frames: Pose[]; pts: Record<string, V3>[]; dur: number; stride?: number; speed?: number; strikes?: number[]; src: string; range: [number, number] }
const unwrapInto = (prev: E3 | undefined, e: E3): E3 => { if (!prev) return e; return e.map((x, i) => { let d = x - prev[i]; while (d > Math.PI) { x -= 2 * Math.PI; d -= 2 * Math.PI; } while (d < -Math.PI) { x += 2 * Math.PI; d += 2 * Math.PI; } return x; }) as E3; };
function unwrapSeq(seq: Pose[]) { for (let i = 1; i < seq.length; i++) for (const b of POSE_BONES) { const e = seq[i].rot[b]; if (e) seq[i].rot[b] = unwrapInto(seq[i - 1].rot[b], e); } }
const lerp = (a: number, b: number, w: number) => a + (b - a) * w;
function lerpPose(a: Pose, b: Pose, w: number): Pose {
  const rot: Pose['rot'] = {}; for (const k of POSE_BONES) { const x = a.rot[k], y = b.rot[k]; if (x && y) rot[k] = [lerp(x[0], y[0], w), lerp(x[1], y[1], w), lerp(x[2], y[2], w)]; }
  return { rot, hips: [lerp(a.hips[0], b.hips[0], w), lerp(a.hips[1], b.hips[1], w), lerp(a.hips[2], b.hips[2], w)] };
}
/** close a sequence whose sample n (not included) should equal sample 0: subtract the end's difference linearly */
function close(seq: Pose[], end: Pose) {
  const n = seq.length;
  for (const k of POSE_BONES) { const e0 = seq[0].rot[k], e1 = end.rot[k]; if (!e0 || !e1) continue; const d = unwrapInto(e0, e1).map((x, i) => x - e0[i]);
    for (let i = 0; i < n; i++) { const e = seq[i].rot[k]!; seq[i].rot[k] = [e[0] - d[0] * i / n, e[1] - d[1] * i / n, e[2] - d[2] * i / n]; } }
  const dh = end.hips.map((x, i) => x - seq[0].hips[i]); for (let i = 0; i < n; i++) seq[i].hips = seq[i].hips.map((x, j) => x - dh[j] * i / n) as E3;
}
const posedCache = new Map<string, Posed[]>();
function posed(T: Take): Posed[] { let p = posedCache.get(T.id); if (!p) { p = T.frames.map(f => fk(T.sk, f)); posedCache.set(T.id, p); } return p; }

/** a gait loop of `cycles` strides from the steadiest part of the take between from and to (s), `per` samples a cycle */
export function gait(takeId: string, fps: number, o: { from?: number; to?: number; cycles?: number; per?: number; strikeFoot?: 'l' | 'r'; win?: number; trail?: boolean; face?: number } = {}): Baked {
  const T = loadTake(takeId, fps), P = posed(T), n = P.length;
  const i0 = Math.max(0, Math.round((o.from ?? 0) * fps)), i1 = Math.min(n - 1, o.to !== undefined ? Math.round(o.to * fps) : n - 1);
  // strikes: the left ankle at its farthest ahead of the pelvis along the local travel direction (±0.25 s window)
  const vel = (i: number): V3 => { const a = P[Math.max(i0, i - 15)].rootT, b = P[Math.min(i1, i + 15)].rootT; return [b[0] - a[0], 0, b[2] - a[2]]; };
  const lead: number[] = []; const foot = o.strikeFoot ?? 'l';
  for (let i = i0; i <= i1; i++) { const v = vel(i), L = Math.hypot(v[0], v[2]) || 1, a = P[i].tail.get(foot + 'tibia')!, r = P[i].rootT; lead.push((o.trail ? -1 : 1) * ((a[0] - r[0]) * v[0] + (a[2] - r[2]) * v[2]) / L); }
  const w = Math.round((o.win ?? 0.25) * fps), strikes: number[] = [];
  for (let j = w; j < lead.length - w; j++) { let m = true; for (let d = -w; d <= w; d++) if (lead[j + d] > lead[j]) { m = false; break; } if (m && lead[j] > 0.1) strikes.push(i0 + j); }
  const C = o.cycles ?? 2; if (strikes.length < C + 1) throw new Error(`${takeId}: ${strikes.length} strikes`);
  // the steadiest run of C cycles: the least spread of cycle durations and speeds, preferring the middle
  let best = -1, bs = Infinity;
  for (let s = 0; s + C < strikes.length; s++) { const d: number[] = [], sp: number[] = [];
    for (let c = 0; c < C; c++) { const a = strikes[s + c], b = strikes[s + c + 1]; d.push(b - a); const A = P[a].rootT, B = P[b].rootT; sp.push(Math.hypot(B[0] - A[0], B[2] - A[2]) / ((b - a) / fps)); }
    const md = d.reduce((x, y) => x + y) / C, ms = sp.reduce((x, y) => x + y) / C;
    // walking straight ahead, facing the way: the pelvis's heading within 20° of the travel direction at every frame and
    // the path's own direction turning less than 15° over the run (captures turn, walk figures of eight, walk backwards)
    const a0 = strikes[s], b0 = strikes[s + C], A0 = P[a0].rootT, B0 = P[b0].rootT, trav = Math.atan2(B0[0] - A0[0], B0[2] - A0[2]);
    let worst = 0; for (let i = a0; i <= b0; i += 4) { let e = headingOf(P[i]) - trav; e -= Math.round(e / (2 * Math.PI)) * 2 * Math.PI; worst = Math.max(worst, Math.abs(e)); }
    const M0 = P[Math.round((a0 + b0) / 2)].rootT, t1 = Math.atan2(M0[0] - A0[0], M0[2] - A0[2]), t2 = Math.atan2(B0[0] - M0[0], B0[2] - M0[2]); let turn = t2 - t1; turn -= Math.round(turn / (2 * Math.PI)) * 2 * Math.PI;
    if (worst > (o.face ?? 0.35) || Math.abs(turn) > 0.26) continue;
    const score = d.reduce((x, y) => x + Math.abs(y - md), 0) / md + sp.reduce((x, y) => x + Math.abs(y - ms), 0) / ms + 0.02 * Math.abs(s + C / 2 - strikes.length / 2) + worst;
    if (ms > 0.2 && score < bs) { bs = score; best = s; } }
  if (best < 0) throw new Error(`${takeId}: no straight steady run of ${C} strides`);
  const a = strikes[best], b = strikes[best + C], A = P[a].rootT, B = P[b].rootT;
  const yaw = Math.atan2(B[0] - A[0], B[2] - A[2]), dist = Math.hypot(B[0] - A[0], B[2] - A[2]), dur = (b - a) / fps, v = dist / dur;
  const fwd: V3 = [Math.sin(yaw), 0, Math.cos(yaw)];
  const per = o.per ?? 32, N = C * per, frames: Pose[] = [], pts: Record<string, V3>[] = [];
  // uniform in phase within each cycle (between its strikes), linear between source frames
  const at = (fi: number) => { const i = Math.floor(fi), w = fi - i; const t = (fi - a) / fps;
    const org: V3 = [A[0] + fwd[0] * v * t, 0, A[2] + fwd[2] * v * t];
    const s0 = retargetFrame(T, P[i], yaw, org), s1 = retargetFrame(T, P[Math.min(n - 1, i + 1)], yaw, org);
    return { pose: lerpPose(s0.pose, unwrapPose(s0.pose, s1.pose), w), pts: s0.pts }; };
  for (let c = 0; c < C; c++) { const sa = strikes[best + c], sb = strikes[best + c + 1];
    for (let j = 0; j < per; j++) { const s = at(sa + (sb - sa) * j / per); frames.push(s.pose); pts.push(s.pts); } }
  unwrapSeq(frames); const end = at(b).pose; close(frames, unwrapPose(frames[0], end));
  return { frames, pts, dur, stride: dist * T.k / C, speed: v * T.k, strikes: strikes.slice(best, best + C + 1).map(s => (s - a) / fps), src: takeId, range: [a / fps, b / fps] };
}
function unwrapPose(ref: Pose, p: Pose): Pose { const rot: Pose['rot'] = {}; for (const k of POSE_BONES) { const e = p.rot[k]; if (e) rot[k] = unwrapInto(ref.rot[k], e); } return { rot, hips: p.hips }; }

/** pose distance for loop closing (rad, plus 3× hips metres) */
function dist(a: Posed, b: Posed): number {
  let d = 0; for (const [k, R] of a.R) { const S = b.R.get(k)!; d += Math.acos(Math.max(-1, Math.min(1, (R[0] * S[0] + R[1] * S[1] + R[2] * S[2] + R[3] * S[3] + R[4] * S[4] + R[5] * S[5] + R[6] * S[6] + R[7] * S[7] + R[8] * S[8] - 1) / 2))); }
  const r = a.rootR, s = b.rootR; d += 3 * Math.acos(Math.max(-1, Math.min(1, (r[0] * s[0] + r[1] * s[1] + r[2] * s[2] + r[3] * s[3] + r[4] * s[4] + r[5] * s[5] + r[6] * s[6] + r[7] * s[7] + r[8] * s[8] - 1) / 2)));
  return d + 10 * Math.hypot(a.rootT[0] - b.rootT[0], a.rootT[1] - b.rootT[1], a.rootT[2] - b.rootT[2]);
}
/** a closed loop of about `len` s (±25 %) starting within [from, to] (s), sampled at `out` fps */
export function loop(takeId: string, fps: number, o: { from?: number; to?: number; len: number; out?: number; exact?: boolean; legIK?: boolean; feet?: boolean }): Baked {
  const T = loadTake(takeId, fps), P = posed(T), n = P.length;
  const i0 = Math.max(0, Math.round((o.from ?? 0) * fps)), i1 = Math.min(n - 1, o.to !== undefined ? Math.round(o.to * fps) : n - 1);
  const L = Math.round(o.len * fps), lo = o.exact ? L : Math.round(L * 0.75), hi = o.exact ? L : Math.round(L * 1.25);
  let best: [number, number] = [i0, Math.min(i1, i0 + L)], bs = Infinity; const step = Math.max(1, Math.round(fps / 30));
  for (let a = i0; a + lo <= i1; a += step) for (let b = a + lo; b <= Math.min(i1, a + hi); b += step) { const d = dist(P[a], P[b]); if (d < bs) { bs = d; best = [a, b]; } }
  const [a, b] = best;
  // the frame: mean pelvis heading (circular) and mean position over the loop
  let sx = 0, sz = 0, px = 0, pz = 0; for (let i = a; i < b; i++) { const h = headingOf(P[i]); sx += Math.sin(h); sz += Math.cos(h); px += P[i].rootT[0]; pz += P[i].rootT[2]; }
  // the origin between the feet (the ankles' mean over the loop): the performer stands on the root
  let fx = 0, fz = 0; for (let i = a; i < b; i++) { const l = P[i].tail.get('ltibia')!, r = P[i].tail.get('rtibia')!; fx += (l[0] + r[0]) / 2; fz += (l[2] + r[2]) / 2; }
  const yaw = Math.atan2(sx, sz), org: V3 = o.feet === false ? [px / (b - a), 0, pz / (b - a)] : [fx / (b - a), 0, fz / (b - a)];
  const out = o.out ?? 30, dur = (b - a) / fps, N = Math.max(2, Math.round(dur * out)), frames: Pose[] = [], pts: Record<string, V3>[] = [];
  const at = (fi: number) => { const i = Math.floor(fi), w = fi - i; const s0 = retargetFrame(T, P[i], yaw, org, { legIK: o.legIK }), s1 = retargetFrame(T, P[Math.min(n - 1, i + 1)], yaw, org, { legIK: o.legIK }); return { pose: lerpPose(s0.pose, unwrapPose(s0.pose, s1.pose), w), pts: s0.pts }; };
  for (let j = 0; j < N; j++) { const s = at(a + (b - a) * j / N); frames.push(s.pose); pts.push(s.pts); }
  unwrapSeq(frames); close(frames, unwrapPose(frames[0], at(b).pose));
  return { frames, pts, dur, src: takeId, range: [a / fps, b / fps] };
}
/** a still pose: the frame at time t (s), in the frame of the pelvis's heading there */
export function still(takeId: string, fps: number, t: number): Sample {
  const T = loadTake(takeId, fps), P = posed(T), i = Math.min(P.length - 1, Math.round(t * fps));
  return retargetFrame(T, P[i], headingOf(P[i]), P[i].rootT);
}
export function takeInfo(takeId: string, fps: number) { const T = loadTake(takeId, fps); return { frames: T.frames.length, dur: T.frames.length / fps, k: T.k }; }
export { posed };
