// The wild animals of the land beyond the town (session 9; the user's question "lions, cheetahs, wolves?"; MASTER_PLAN §7).
// Fars in 467 BCE held the large animals of the Iranian plateau (every species row is in src/data/fauna.json with its evidence,
// B for the species' presence from their historical range, C for place, numbers and behaviour):
//  - a wolf pack (4) on the western foot of Kuh-e Rahmat: lying up high on the slope by day, travelling the foot of the
//    mountain at night and at dusk and dawn; howling in bouts at night, most in winter;
//  - a leopard on the mountain's rocks higher up: moving at dusk, dawn and night, lying on a ledge by day; its rasping call;
//  - a lion pride (a male and two lionesses) in the thickets of a river reach far from the town and the villages: lying up in
//    the reeds by day, walking the reach at night, roaring after dusk and before dawn, heard for kilometres;
//  - striped hyenas (2) at the town's outermost midden at night; whooping;
//  - a herd of Persian onagers (12) and a pair of cheetahs on the uncultivated steppe well away from the fields.
// Every position is closed-form in (seed, time), like the birds, the jackals and the boar (D-054): never spawned where the
// player is (T-F6). The large wild animals keep their distance from a person (C); none ever comes at the player.
import { h01 } from './fauna';
export type P2 = [number, number];
export interface BeastInst { sp: 'wolf' | 'lion' | 'lioness' | 'cheetah' | 'leopard' | 'hyena' | 'onager' | 'fox' | 'hare' | 'wild_goat' | 'urial' | 'gazelle' | 'gazelle_m'; e: number; n: number; yaw: number; walk: number; graze: number; lie: number; coat: number }
export interface BeastRanges { wolfPath: P2[]; wolfDen: P2 | null; leopardPath: P2[]; lionReach: P2[]; lionDen: P2 | null; hyenaMidden: P2 | null; steppe: P2 | null;
  /** session 9 (the gap hunters): the gazelles' plain (the second-best flat natural patch), the fields' edges where foxes and hares go */
  gazellePlain: P2 | null; fieldEdges: P2[] }
export interface BeastInputs { ground: (e: number, n: number) => number; natural?: (e: number, n: number) => boolean; rivers: P2[][]; people: P2[] }
const fr = (x: number) => x - Math.floor(x);
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const dist = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** the ranges, from the terrain, the land use, the rivers and the places people live (every point in grid metres) */
export function beastRanges(I: BeastInputs): BeastRanges {
  // a contour along the mountain's W face: for each northing, the first point E of the Terrace where the ground stands H above
  // the court datum (the Terrace's own top is 0; the plain lies ~12 m below it)
  const contour = (H: number): P2[] => { const out: P2[] = [];
    // (the scan starts W of the Terrace and skips the Terrace's own box, whose top is the datum and below H anyway)
    for (let n = -2600; n <= 2600; n += 130) for (let e = -300; e < 4000; e += 20) if (I.ground(e, n) > H) { out.push([e, n]); break; }
    return out; };
  const wolfPath = contour(55), leopardPath = contour(170);
  const wolfDen: P2 | null = wolfPath.length ? (() => { const m = wolfPath[Math.floor(wolfPath.length * 0.7)]; for (let e = m[0]; e < m[0] + 1500; e += 20) if (I.ground(e, m[1]) > 220) return [e, m[1]] as P2; return null; })() : null;
  // the lions' river reach: 2 km of a river 4-14 km from the Terrace, every point at least 2.5 km from where people live
  let lionReach: P2[] = [];
  for (const R of I.rivers) { let run: P2[] = [];
    for (const p of R) { const ok = Math.hypot(p[0], p[1]) > 4000 && Math.hypot(p[0], p[1]) < 14000 && I.people.every(q => dist(p, q) > 2500);
      if (ok) run.push(p); else run = [];
      if (run.length >= 2) { let L = 0; for (let i = 1; i < run.length; i++) L += dist(run[i - 1], run[i]); if (L >= 2000) { lionReach = run.slice(); break; } } }
    if (lionReach.length) break; }
  const lionDen: P2 | null = lionReach.length ? lionReach[Math.floor(lionReach.length / 2)] : null;
  // the steppe: the plain is nearly all fields (rain-fed and irrigated, plain.json); the onagers and cheetahs take the best
  // flat uncultivated patch on its margins 5-20 km out (a 600 m circle: the most of 12 edge points on natural land, relief
  // under 60 m, 3 km from people; C)
  let steppe: P2 | null = null, bestScore = 8;
  if (I.natural) for (let r = 5000; r <= 20000; r += 1000) for (let a = 0; a < 24; a++) {
    const th = (a / 24) * 2 * Math.PI, c: P2 = [Math.cos(th) * r, Math.sin(th) * r]; if (!I.natural(c[0], c[1]) || I.people.some(q => dist(c, q) < 3000)) continue;
    let k = 0, lo = I.ground(c[0], c[1]), hi = lo; for (let i = 0; i < 12; i++) { const t = (i / 12) * 2 * Math.PI, p: P2 = [c[0] + Math.cos(t) * 600, c[1] + Math.sin(t) * 600]; if (I.natural(p[0], p[1])) k++; const g = I.ground(p[0], p[1]); lo = Math.min(lo, g); hi = Math.max(hi, g); }
    if (hi - lo < 60 && k > bestScore) { bestScore = k; steppe = c; } }
  // the gazelles' plain: the best flat natural patch 4 km or more from the onagers' steppe; the fields' edges: points on
  // natural ground next to farmed ground 600-3,000 m from a village (foxes and hares by the crops)
  let gazellePlain: P2 | null = null, gs = 8;
  if (I.natural) for (let r = 4000; r <= 20000; r += 1000) for (let a = 0; a < 24; a++) { const th = (a / 24) * 2 * Math.PI + 0.13, c: P2 = [Math.cos(th) * r, Math.sin(th) * r];
    if (!I.natural(c[0], c[1]) || (steppe && dist(c, steppe) < 4000) || I.people.some(q => dist(c, q) < 2000)) continue;
    let k = 0, lo = I.ground(c[0], c[1]), hi = lo; for (let i = 0; i < 12; i++) { const t = (i / 12) * 2 * Math.PI, p: P2 = [c[0] + Math.cos(t) * 500, c[1] + Math.sin(t) * 500]; if (I.natural(p[0], p[1])) k++; const g = I.ground(p[0], p[1]); lo = Math.min(lo, g); hi = Math.max(hi, g); }
    if (hi - lo < 50 && k > gs) { gs = k; gazellePlain = c; } }
  const fieldEdges: P2[] = [];
  if (I.natural) for (const v of I.people.slice(1)) for (let a = 0; a < 8 && fieldEdges.length < 40; a++) { const th = (a / 8) * 2 * Math.PI, r = 600 + 2400 * fr(Math.sin(v[0] * 12.9898 + v[1] * 78.233 + a) * 43758.5453);
    const p: P2 = [v[0] + Math.cos(th) * r, v[1] + Math.sin(th) * r], q: P2 = [p[0] + Math.cos(th) * 60, p[1] + Math.sin(th) * 60]; if (I.natural(p[0], p[1]) !== I.natural(q[0], q[1])) fieldEdges.push(p); }
  return { wolfPath, wolfDen, leopardPath, lionReach, lionDen, hyenaMidden: null, steppe, gazellePlain, fieldEdges };
}
/** a point s metres along a polyline, going there and back (s grows without bound) */
function alongPath(L: P2[], s: number): { p: P2; dir: number } {
  const len: number[] = [0]; for (let i = 1; i < L.length; i++) len.push(len[i - 1] + dist(L[i - 1], L[i])); const T = len[len.length - 1];
  if (T <= 0) return { p: L[0], dir: 0 };
  const q = ((s % (2 * T)) + 2 * T) % (2 * T), back = q > T, x = back ? 2 * T - q : q; let i = 1; while (i < len.length - 1 && len[i] < x) i++;
  const a = L[i - 1], b = L[i], f = (x - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]);
  return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], dir: Math.atan2(b[0] - a[0], b[1] - a[1]) + (back ? Math.PI : 0) };
}
/** active (travelling) at night and in the dusk and dawn hours */
const nocturnal = (hour: number, sun: { rise: number; set: number }) => hour > sun.set - 0.5 || hour < sun.rise + 0.7;
/** the animals at time t (s) and local hour, `seed` the world's; every one a pure function of these */
export function beastsAt(R: BeastRanges, seed: number, t: number, hour: number, sun: { rise: number; set: number }, month: number): BeastInst[] {
  const out: BeastInst[] = [], night = nocturnal(hour, sun);
  // wolves: the pack travels the mountain's foot at night (1.1 m/s, a stop now and then), lies up at the den by day
  if (R.wolfPath.length > 2) for (let j = 0; j < 4; j++) { const s0 = h01(seed, 3100 + j), stop = fr(t / 600 + h01(seed, 3101)) < 0.25;
    if (night && R.wolfPath.length) { const { p, dir } = alongPath(R.wolfPath, t * 1.1 * (stop ? 0 : 1) + (stop ? Math.floor(t / 600) * 600 * 1.1 * 0.75 : 0) - j * 6);
      out.push({ sp: 'wolf', e: p[0] + (s0 - 0.5) * 5, n: p[1] + (h01(seed, 3102 + j) - 0.5) * 5, yaw: dir, walk: stop ? 0 : 1, graze: stop && j % 2 ? 1 : 0, lie: 0, coat: s0 }); }
    else if (R.wolfDen) out.push({ sp: 'wolf', e: R.wolfDen[0] + (s0 - 0.5) * 12, n: R.wolfDen[1] + (h01(seed, 3104 + j) - 0.5) * 12, yaw: s0 * 6.28, walk: 0, graze: 0, lie: 1, coat: s0 }); }
  // the leopard: the higher contour at dusk, dawn and night (0.7 m/s); a ledge by day
  if (R.leopardPath.length > 2) { const { p, dir } = alongPath(R.leopardPath, t * 0.7 + h01(seed, 3200) * 3000), rest = alongPath(R.leopardPath, h01(seed, 3201) * 4000).p;
    out.push(night ? { sp: 'leopard', e: p[0], n: p[1], yaw: dir, walk: 1, graze: 0, lie: 0, coat: 0.5 } : { sp: 'leopard', e: rest[0], n: rest[1], yaw: h01(seed, 3202) * 6.28, walk: 0, graze: 0, lie: 1, coat: 0.5 }); }
  // the lions: the reach at night (0.6 m/s, often lying up), the den in the reeds by day
  if (R.lionReach.length > 1) for (let j = 0; j < 3; j++) { const sp = j === 0 ? 'lion' : 'lioness', s0 = h01(seed, 3300 + j);
    if (night && fr(t / 1800 + h01(seed, 3301)) < 0.6) { const { p, dir } = alongPath(R.lionReach, t * 0.6 + h01(seed, 3302) * 2000 - j * 9); out.push({ sp, e: p[0] + (s0 - 0.5) * 6, n: p[1] + (h01(seed, 3303 + j) - 0.5) * 6, yaw: dir, walk: 1, graze: 0, lie: 0, coat: s0 }); }
    else { const c = night ? alongPath(R.lionReach, Math.floor(t / 1800) * 1800 * 0.6 + h01(seed, 3302) * 2000).p : R.lionDen!; out.push({ sp, e: c[0] + (s0 - 0.5) * 10 + 15, n: c[1] + (h01(seed, 3304 + j) - 0.5) * 10, yaw: s0 * 6.28, walk: 0, graze: 0, lie: 1, coat: s0 }); } }
  // hyenas at the outermost midden at night, nosing about it
  if (R.hyenaMidden && (hour > sun.set + 0.6 || hour < sun.rise - 0.4)) for (let j = 0; j < 2; j++) { const T = 50 + 30 * h01(seed, 3400 + j), k = Math.floor(t / T), a = h01(seed, 3401 + j, k) * 6.28, r = 6 + 14 * h01(seed, 3402 + j, k), walking = fr(t / T) > 0.7;
    out.push({ sp: 'hyena', e: R.hyenaMidden[0] + Math.cos(a) * r, n: R.hyenaMidden[1] + Math.sin(a) * r, yaw: a + 1.57, walk: walking ? 1 : 0, graze: walking ? 0 : 1, lie: 0, coat: h01(seed, 3403 + j) }); }
  // the steppe: the onager herd grazing about a drifting centre, resting at midday; a pair of cheetahs 1.5 km off, moving at
  // dawn and dusk, lying up in the heat and at night
  if (R.steppe) { const cx = R.steppe[0] + 600 * Math.sin(t / 7200 + h01(seed, 3500) * 6), cn = R.steppe[1] + 600 * Math.cos(t / 9100 + h01(seed, 3501) * 6), hot = hour > 11.5 && hour < 15.5, dark = hour < sun.rise - 0.3 || hour > sun.set + 0.5;
    for (let j = 0; j < 12; j++) { const T = 40 + 25 * h01(seed, 3510 + j), k = Math.floor(t / T), a = h01(seed, 3511 + j, k) * 6.28, r = 5 + 35 * Math.sqrt(h01(seed, 3512 + j, k)), walking = fr(t / T) > 0.75;
      out.push({ sp: 'onager', e: cx + Math.cos(a) * r, n: cn + Math.sin(a) * r, yaw: h01(seed, 3513 + j, k) * 6.28, walk: walking ? 1 : 0, graze: !walking && !hot && !dark ? 1 : 0, lie: (hot || dark) && j % 3 === 0 ? 1 : 0, coat: h01(seed, 3514 + j) }); }
    const moving = !hot && !dark && (hour < sun.rise + 2.5 || hour > sun.set - 2.5);
    for (let j = 0; j < 2; j++) { const { p, dir } = alongPath([[R.steppe[0] + 1500, R.steppe[1] - 900], [R.steppe[0] + 900, R.steppe[1] + 1200], [R.steppe[0] - 600, R.steppe[1] + 1500]], (moving ? t : Math.floor(t / 3600) * 3600) * 0.9 - j * 8);
      out.push({ sp: 'cheetah', e: p[0] + j * 3, n: p[1], yaw: dir, walk: moving ? 1 : 0, graze: 0, lie: moving ? 0 : 1, coat: h01(seed, 3520 + j) }); } }
  // the wild goats on the high rocks (by day, lying up at midday), the wild sheep on the lower slopes (morning and evening; lying
  // up in the heat and at night), a herd of goitered gazelle on the open plain (by day), foxes and hares at the fields' edges
  // from dusk to dawn (C)
  const herd = (sp: BeastInst['sp'], path: P2[], s0: number, n: number, spread: number, active: boolean, grazeK: number) => { if (path.length < 2) return;
    const { p } = alongPath(path, t * 0.05 + h01(seed, s0) * 3000); for (let j = 0; j < n; j++) { const T = 35 + 20 * h01(seed, s0 + 1 + j), k = Math.floor(t / T), a = h01(seed, s0 + 2 + j, k) * 6.28, r = 3 + spread * Math.sqrt(h01(seed, s0 + 3 + j, k)), walking = active && fr(t / T) > 0.75;
      out.push({ sp, e: p[0] + Math.cos(a) * r, n: p[1] + Math.sin(a) * r, yaw: h01(seed, s0 + 4 + j, k) * 6.28, walk: walking ? 1 : 0, graze: active && !walking && fr(t / 17 + j * 0.3) < grazeK ? 1 : 0, lie: active ? 0 : 1, coat: h01(seed, s0 + 5 + j) }); } };
  const day = hour > sun.rise + 0.2 && hour < sun.set - 0.2, midday = hour > 11.5 && hour < 15;
  herd('wild_goat', R.leopardPath, 3700, 7, 25, day && !midday, 0.7);
  herd('urial', R.wolfPath, 3800, 9, 30, (hour > sun.rise && hour < sun.rise + 3.5) || (hour > sun.set - 3 && hour < sun.set), 0.75);
  if (R.gazellePlain) { const gp = R.gazellePlain, path: P2[] = [[gp[0] - 400, gp[1]], [gp[0] + 400, gp[1] + 200]];
    herd('gazelle', path, 3900, 6, 40, day && !midday, 0.7); herd('gazelle_m', path, 3950, 1, 40, day && !midday, 0.6); }
  if (R.fieldEdges.length && !day) for (let j = 0; j < 6; j++) { const fe = R.fieldEdges[Math.floor(h01(seed, 4000 + j) * R.fieldEdges.length)], T = 40 + 20 * h01(seed, 4001 + j), k = Math.floor(t / T), a = h01(seed, 4002 + j, k) * 6.28, r = 5 + 60 * h01(seed, 4003 + j, k);
    out.push({ sp: j < 2 ? 'fox' : 'hare', e: fe[0] + Math.cos(a) * r, n: fe[1] + Math.sin(a) * r, yaw: a + 1.57, walk: fr(t / T) > 0.6 ? 1 : 0, graze: fr(t / T) > 0.6 ? 0 : 1, lie: 0, coat: h01(seed, 4004 + j) }); }
  return out;
}
/** the large wild animals keep their distance from a person on foot (C): pushed out along the line from the player */
export function keepAway(b: BeastInst, player: P2 | null): BeastInst {
  if (!player) return b; const R = b.sp === 'hyena' || b.sp === 'fox' || b.sp === 'hare' ? 25 : b.sp === 'onager' || b.sp === 'gazelle' || b.sp === 'gazelle_m' ? 150 : b.sp === 'cheetah' || b.sp === 'wild_goat' || b.sp === 'urial' ? 120 : 80, dx = b.e - player[0], dn = b.n - player[1], d = Math.hypot(dx, dn);
  if (d >= R || d < 0.01) return b; const k = (R - d) / d; return { ...b, e: b.e + dx * k, n: b.n + dn * k, walk: 1, graze: 0, lie: 0, yaw: Math.atan2(dx, dn) };
}
/** the calls: which animal calls when (per second of world time, C) and how far it carries (m) */
export const BEAST_CALLS = {
  howl: { sp: 'wolf', perHourNight: 0.9, winter: 2.5, far: 3500 },
  roar: { sp: 'lion', perHourNight: 1.2, far: 6000 },
  whoop: { sp: 'hyena', perHourNight: 1.5, far: 1500 },
  saw: { sp: 'leopard', perHourNight: 0.4, far: 900 },
} as const;
/** does `kind` call in this second (a pure function of the seed and the second: the same night for everyone) */
export function callsNow(seed: number, kind: keyof typeof BEAST_CALLS, t: number, hour: number, sun: { rise: number; set: number }, month: number): boolean {
  const C = BEAST_CALLS[kind] as any, dark = hour > sun.set + 0.4 || hour < sun.rise - 0.3; if (!dark) return false;
  const winter = month === 10 || month === 11 || month === 0 ? (C.winter ?? 1) : 1, dawnBoost = kind === 'roar' && (hour < sun.rise - 0.3 && hour > sun.rise - 2) ? 2 : 1;
  return h01(seed, 3600 + Object.keys(BEAST_CALLS).indexOf(kind), Math.floor(t)) < (C.perHourNight * winter * dawnBoost) / 3600;
}
void smooth;
