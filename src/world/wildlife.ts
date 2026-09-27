// Visible wildlife, part 1: birds (brief §5.5 "birds (including seasonal migrants and raptors)"; research/SOUNDSCAPE.md
// §4 for species). Modern Fars distributions stand in for 467 BCE (C unless stated). Every bird's position is a closed-form
// function of (world seed, species, index, world time), so birds are deterministic, need no saved state and stay
// continuous across time skips and loads; only the sparrows' flight from the player is reactive (and short-lived).
//  - swallows / swifts (C: expected, not sourced): summer migrants, Mar–Sep, hawking insects 4–25 m over the courts;
//  - buzzard / golden eagle (B: raptors of the Zagros, Bamu NP extract): 1–2 birds soaring in wide circles 120–450 m above
//    the Kuh-e Rahmat slope by day, gliding with few wingbeats;
//  - house sparrows (C): on the court floors near fires and people by day; they fly 8–15 m off when someone comes within 3 m.
//  - D-210 (gap audit items 10, 15, 36): hooded crows (C: expected, not sourced) on the ground at the town's middens by day,
//    walking and pecking, now and then flying to another midden, lifting off when someone comes within 8 m; black kites
//    (C: summer migrants, Mar–Sep) circling low over the town's middens and the stockyard, 35–120 m up.
// Rendering: one InstancedMesh per species (5 draw calls; no shadows), a low-poly body + wings, flapping in the vertex
// shader from a per-instance phase. Sizes from field-guide values (C).
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, sin, float, vec3, abs, uniform } from 'three/tsl';
import { Rng } from '../core/rng';
import type { NavGrid, P2 } from '../people/navgrid';
import type { Terrain } from '../terrain/heightfield';

export interface BirdSpecies { id: string; name: string; tier: string; months: number[]; hours: [number, number]; span: number; length: number; colour: [number, number, number]; flapHz: number; count: number }
export const BIRDS: Record<'swallow' | 'raptor' | 'sparrow' | 'crow' | 'kite' | 'dove' | 'lark' | 'stork' | 'vulture' | 'crane' | 'bat' | 'chukar' | 'hoopoe' | 'beeeater' | 'heron' | 'egret' | 'jackdaw' | 'magpie' | 'sandgrouse' | 'wheatear' | 'owl' | 'bulbul' | 'roller' | 'duck' | 'starling' | 'kestrel', BirdSpecies> = {
  // (session 10, GB29: instances SWIFTS.first.. of the swallows' mesh are the swifts' screaming parties: one draw call for both)
  swallow: { id: 'swallow', name: 'barn swallow; common and pallid swifts', tier: 'C (expected, not sourced; summer migrants)', months: [2, 3, 4, 5, 6, 7, 8], hours: [4.8, 20.2], span: 0.36, length: 0.18, colour: [0.07, 0.08, 0.12], flapHz: 7, count: 60 },
  raptor: { id: 'raptor', name: 'buzzard / golden eagle', tier: 'B (Zagros raptors, extract) / C on-site', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [8.5, 17.5], span: 1.9, length: 0.85, colour: [0.28, 0.21, 0.14], flapHz: 2.2, count: 2 },
  sparrow: { id: 'sparrow', name: 'house sparrow', tier: 'C (expected, not sourced)', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [6, 18.5], span: 0.24, length: 0.15, colour: [0.42, 0.33, 0.24], flapHz: 14, count: 40 },
  crow: { id: 'crow', name: 'hooded crow', tier: 'C (crows and ravens expected, not sourced: SOUNDSCAPE.md section 4; D-210)', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [6.2, 18.3], span: 0.95, length: 0.46, colour: [0.2, 0.2, 0.21], flapHz: 3.5, count: 30 },
  kite: { id: 'kite', name: 'black kite', tier: 'C (summer migrant over towns and middens; expected, not sourced; D-210)', months: [2, 3, 4, 5, 6, 7, 8], hours: [8, 17.5], span: 1.5, length: 0.58, colour: [0.3, 0.22, 0.15], flapHz: 2.4, count: 4 },
  // session 9 (both gap hunters: the commonest birds were missing): months 0 = January (the weather's climatological month)
  dove: { id: 'dove', name: 'rock dove / collared dove', tier: 'C (expected on buildings and in courts; not sourced)', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [5.8, 18.8], span: 0.6, length: 0.32, colour: [0.52, 0.52, 0.55], flapHz: 6, count: 24 },
  lark: { id: 'lark', name: 'crested lark / skylark in song flight', tier: 'C (larks over fields and steppe: SOUNDSCAPE.md section 4 "expected")', months: [1, 2, 3, 4, 5, 6], hours: [5.5, 11], span: 0.32, length: 0.17, colour: [0.5, 0.42, 0.32], flapHz: 12, count: 10 },
  stork: { id: 'stork', name: 'white stork', tier: 'C (summer visitor of the Iranian plateau\'s wet fields; not sourced)', months: [2, 3, 4, 5, 6, 7], hours: [7, 18], span: 2.0, length: 1.0, colour: [0.86, 0.86, 0.84], flapHz: 2, count: 8 },
  vulture: { id: 'vulture', name: 'griffon vulture', tier: 'B (griffon and Egyptian vultures of the Zagros; recollection) / C place', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [9.5, 16.5], span: 2.6, length: 1.05, colour: [0.55, 0.45, 0.33], flapHz: 1.5, count: 3 },
  // session 9 (G42): pipistrelles hawking over the courts and the water at dusk, Mar-Oct; `hours` is replaced by batHours()
  bat: { id: 'bat', name: 'pipistrelle bats (Kuhl\'s pipistrelle and kin)', tier: 'C (bats at dusk expected over courts and water; species recollection, SMALL-R)', months: [2, 3, 4, 5, 6, 7, 8, 9], hours: [18, 21], span: 0.23, length: 0.08, colour: [0.16, 0.13, 0.11], flapHz: 11, count: 16 },
  // session 9 (G45, G46, G52, G55-G58): more of the birds a walker sees (C unless stated; the soundscape already calls several)
  chukar: { id: 'chukar', name: 'chukar / see-see partridge coveys', tier: 'B (partridges of the Zagros slopes: SOUNDSCAPE.md section 4) / C place', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [6, 18.5], span: 0.5, length: 0.34, colour: [0.52, 0.47, 0.42], flapHz: 9, count: 32 },
  hoopoe: { id: 'hoopoe', name: 'hoopoe', tier: 'C (summer visitor of gardens and courts; its call in the soundscape)', months: [2, 3, 4, 5, 6, 7, 8], hours: [6, 18.5], span: 0.44, length: 0.27, colour: [0.72, 0.5, 0.33], flapHz: 5, count: 6 },
  beeeater: { id: 'beeeater', name: 'European bee-eater', tier: 'B range / C (summer flocks hawking over fields and water)', months: [3, 4, 5, 6, 7, 8], hours: [7, 18], span: 0.44, length: 0.28, colour: [0.55, 0.52, 0.2], flapHz: 6, count: 14 },
  heron: { id: 'heron', name: 'grey heron', tier: 'C (at the rivers all year)', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [6, 18.5], span: 1.8, length: 0.95, colour: [0.55, 0.57, 0.6], flapHz: 2, count: 4 },
  egret: { id: 'egret', name: 'little egret', tier: 'C (at the water, spring to autumn)', months: [2, 3, 4, 5, 6, 7, 8, 9], hours: [6, 18.5], span: 0.95, length: 0.6, colour: [0.93, 0.93, 0.92], flapHz: 3, count: 6 },
  jackdaw: { id: 'jackdaw', name: 'jackdaws and choughs over the cliffs', tier: 'C (corvid flocks at cliffs and ruins)', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [7, 17.5], span: 0.68, length: 0.34, colour: [0.12, 0.12, 0.13], flapHz: 4.5, count: 18 },
  magpie: { id: 'magpie', name: 'magpie', tier: 'C (fields and village edges)', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [6.5, 18], span: 0.56, length: 0.45, colour: [0.2, 0.21, 0.24], flapHz: 5, count: 8 },
  sandgrouse: { id: 'sandgrouse', name: 'sandgrouse flights to water at dawn', tier: 'C (black-bellied and pin-tailed sandgrouse of the Iranian plateau: recollection)', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [6.2, 8.8], span: 0.62, length: 0.33, colour: [0.62, 0.53, 0.38], flapHz: 7, count: 14 },
  wheatear: { id: 'wheatear', name: 'wheatears on the stony steppe', tier: 'C (wheatears of the Iranian steppe: recollection)', months: [2, 3, 4, 5, 6, 7, 8, 9], hours: [6, 18.5], span: 0.27, length: 0.15, colour: [0.72, 0.68, 0.6], flapHz: 12, count: 10 },
  // session 9 (G47, G54, G46, G51): the little owl of open country, bulbuls in the gardens and courts, rollers over the fields in
  // summer, wintering ducks on the rivers and canals (C; the owls' and bulbul's voices are in the soundscape)
  owl: { id: 'owl', name: 'little owl', tier: 'C (resident of open country, ruins and rocks; seen by day and at dusk)', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [7, 19.5], span: 0.55, length: 0.22, colour: [0.48, 0.4, 0.3], flapHz: 6, count: 5 },
  bulbul: { id: 'bulbul', name: 'white-eared bulbul', tier: 'C (gardens of southern Iran: recollection)', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [6, 18.5], span: 0.28, length: 0.18, colour: [0.38, 0.35, 0.3], flapHz: 12, count: 8 },
  roller: { id: 'roller', name: 'European roller', tier: 'C (summer visitor of open country with posts and trees)', months: [3, 4, 5, 6, 7], hours: [7, 18], span: 0.66, length: 0.31, colour: [0.3, 0.55, 0.7], flapHz: 5, count: 4 },
  duck: { id: 'duck', name: 'wintering ducks (mallard, teal)', tier: 'B (ducks winter on the Fars wetlands: SOUNDSCAPE.md section 4) / C here', months: [10, 11, 0, 1, 2], hours: [6.5, 17.5], span: 0.85, length: 0.55, colour: [0.35, 0.33, 0.28], flapHz: 8, count: 12 },
  // session 10 (WORLD_INVENTORY GA45): common starlings wintering on the plain, gathering at dusk over the river's reeds in a
  // murmuration before they drop in to roost (Nov-Feb; hours replaced by swiftScreaming's sun: murmurationOn)
  starling: { id: 'starling', name: 'common starlings: a winter murmuration over the reeds', tier: 'C (starlings winter in huge flocks on the plains of Fars and roost in reedbeds: expected, not sourced)', months: [10, 11, 0, 1], hours: [15, 19], span: 0.38, length: 0.2, colour: [0.09, 0.09, 0.1], flapHz: 12, count: 1500 },
  // session 10 (GA44): kestrels hunting over the fields and the steppe, hovering in place into the wind, then sliding off to hover
  // again or dropping on a vole (C: common and lesser kestrels of the Iranian plateau; expected, not sourced)
  kestrel: { id: 'kestrel', name: 'kestrels hovering over the fields', tier: 'C (common kestrel resident, lesser kestrel a summer breeder on the plateau: expected, not sourced)', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [7, 17.5], span: 0.75, length: 0.34, colour: [0.55, 0.36, 0.22], flapHz: 9, count: 6 },
  crane: { id: 'crane', name: 'common crane (winter flocks)', tier: 'B (winter cranes, geese and ducks at the Fars lakes: SOUNDSCAPE.md section 4, Bakhtegan) / C passage', months: [10, 11, 0, 1, 2], hours: [7.5, 16.5], span: 2.1, length: 1.1, colour: [0.55, 0.57, 0.6], flapHz: 1.6, count: 18 },
};
/** a crow's place (closed form): three quarters of each spell on the ground at its midden, walking and pecking between
 *  spots within 6 m, the rest flying 12-25 m up to the next midden of its round; flushed (within 8 m of someone) it circles
 *  the midden 5-9 m up until they have gone (C) */
export function crowAt(middens: P2[], ground: (e: number, n: number) => number, seed: number, i: number, t: number, flushed: boolean, out: BirdPose) {
  const r = new Rng(seed, `crow:${i}`), T = r.range(70, 130), off = r.range(0, T), k = Math.floor((t + off) / T), u = (t + off) / T - k, m = middens.length;
  const at = (q: number) => middens[Math.floor(new Rng(seed, `crow:${i}:${q}`).range(0, m * 0.999)) % m], A = at(k), B = at(k + 1);
  const hop = new Rng(seed, `crowhop:${i}:${Math.floor(t / 4)}`), jx = hop.range(-6, 6), jn = hop.range(-6, 6);
  if (flushed) { const w = 0.5 + 0.2 * r.next(), R = 11 + 4 * r.next(), a = w * t + r.range(0, 6.3); out.pos.set(A[0] + R * Math.cos(a), ground(A[0], A[1]) + 5 + 4 * r.next(), -(A[1] + R * Math.sin(a))); out.heading = Math.atan2(-Math.sin(a), Math.cos(a)); out.bank = -0.3; out.flap = 1; out.visible = true; return; }
  if (u < 0.75 || Math.hypot(B[0] - A[0], B[1] - A[1]) < 1) { const e = A[0] + jx, n = A[1] + jn; out.pos.set(e, ground(e, n) + 0.02, -n); out.heading = hop.range(0, 6.28); out.bank = 0; out.flap = 0; out.visible = true; return; }
  const w = (u - 0.75) / 0.25, s = w * w * (3 - 2 * w), e = A[0] + (B[0] - A[0]) * s, n = A[1] + (B[1] - A[1]) * s, h = Math.sin(Math.PI * w) * r.range(12, 25);
  out.pos.set(e, ground(e, n) + h + 0.02, -n); out.heading = Math.atan2(B[0] - A[0], B[1] - A[1]); out.bank = 0; out.flap = Math.sin(t * 0.8 + i) > -0.3 ? 1 : 0.2; out.visible = true;
}
/** a black kite circling low over its anchor: radius 30-60 m, 35-120 m up, 8-10 m/s, twisting its tail (not modelled) */
export function kiteAt(base: P2, ground: number, seed: number, t: number, out: BirdPose) {
  const r = new Rng(seed, 'kite'), R = r.range(30, 60), v = r.range(8, 10), w = (v / R) * (r.chance(0.5) ? 1 : -1), p = r.range(0, 6.3), h = r.range(35, 120);
  const cx = base[0] + 40 * Math.sin(0.01 * t + p), cn = base[1] + 40 * Math.cos(0.013 * t + p);
  out.pos.set(cx + R * Math.cos(w * t + p), ground + h + 8 * Math.sin(0.07 * t + p), -(cn + R * Math.sin(w * t + p)));
  out.heading = Math.atan2(-R * w * Math.sin(w * t + p), R * w * Math.cos(w * t + p)); out.bank = -0.3 * Math.sign(w); out.flap = Math.sin(0.2 * t + p) > 0.85 ? 1 : 0; out.visible = true;
}

/** session 9: a lark's song flight: hanging 25-60 m over its field, drifting slowly, wings beating (C) */
export function larkAt(base: P2, ground: number, seed: number, t: number, out: BirdPose) {
  const r = new Rng(seed, 'lark'), p = r.range(0, 6.3), T = r.range(90, 180), u = ((t / T) + p) % 1, h = 25 + 35 * Math.sin(Math.PI * Math.min(1, u * 1.3));
  out.pos.set(base[0] + 20 * Math.sin(0.02 * t + p), ground + h, -(base[1] + 20 * Math.cos(0.017 * t + p))); out.heading = 0.3 * t % 6.28; out.bank = 0; out.flap = 1; out.visible = true;
}
/** a white stork: walking in the wet fields by the water most of the time, soaring over it now and then (C) */
export function storkAt(base: P2, ground: (e: number, n: number) => number, seed: number, t: number, out: BirdPose) {
  const r = new Rng(seed, 'stork'), T = r.range(900, 1500), u = ((t + r.range(0, T)) / T) % 1, p = r.range(0, 6.3);
  if (u < 0.8) { const e = base[0] + 25 * Math.sin(t / 97 + p), n = base[1] + 25 * Math.cos(t / 131 + p); out.pos.set(e, ground(e, n) + 0.05, -n); out.heading = t / 97 + p; out.bank = 0; out.flap = 0; out.visible = true; return; }
  const R = 60, w = 0.12, h = 60 + 120 * Math.sin(Math.PI * (u - 0.8) / 0.2); out.pos.set(base[0] + R * Math.cos(w * t + p), ground(base[0], base[1]) + h, -(base[1] + R * Math.sin(w * t + p)));
  out.heading = Math.atan2(-Math.sin(w * t + p), Math.cos(w * t + p)); out.bank = -0.3; out.flap = 0; out.visible = true;
}
/** local sunset by month at 30 deg N (h, to 0.1 h; C): bats hunt from 20 min after it for about two hours */
export const SUNSET_BY_MONTH = [17.5, 17.9, 18.2, 18.5, 18.9, 19.2, 19.2, 18.9, 18.4, 17.9, 17.4, 17.3];
export const batHours = (month: number): [number, number] => [SUNSET_BY_MONTH[month] + 0.33, SUNSET_BY_MONTH[month] + 2.3];
/** a bat hawking: a loop of 5-12 m round its beat 3-10 m up, jinking every half second (C) */
export function batAt(anchor: P2, ground: number, seed: number, t: number, out: BirdPose) {
  const r = new Rng(seed, 'bat'), a = r.range(5, 12), w = r.range(0.5, 0.9) * (r.chance(0.5) ? 1 : -1), p = r.range(0, 6.3), h0 = r.range(3, 10), k = Math.floor(t * 2), f = t * 2 - k;
  const jx = (j: number) => Math.sin(j * 12.9898 + p * 78.233) * 1.8, jn = (j: number) => Math.cos(j * 4.1414 + p * 11.1) * 1.8;
  const ox = jx(k) + (jx(k + 1) - jx(k)) * f, on = jn(k) + (jn(k + 1) - jn(k)) * f;
  const x = anchor[0] + a * Math.cos(w * t + p) + ox, n = anchor[1] + a * 0.8 * Math.sin(w * t + p) + on;
  out.pos.set(x, ground + h0 + 1.5 * Math.sin(1.7 * t + p), -n); out.heading = Math.atan2(-a * w * Math.sin(w * t + p) + (jx(k + 1) - jx(k)) * 2, a * 0.8 * w * Math.cos(w * t + p) + (jn(k + 1) - jn(k)) * 2);
  out.bank = 0.5 * Math.sin(3 * t + p); out.flap = 1; out.visible = true;
}
/** a crane flock crossing the plain high in a V, one passage every ~40 minutes in winter daylight (C) */
export function craneAt(i: number, seed: number, t: number, out: BirdPose) {
  const P = 2400, k = Math.floor(t / P), r = new Rng(seed, `cranes:${k}`), a = r.range(0.4, 1.2), L = 20000, v = 14, s = (t - k * P) * v - L / 2;
  if (s > L / 2) { out.visible = false; return; }
  const dx = Math.sin(a), dn = Math.cos(a), side = i % 2 ? 1 : -1, rank = Math.ceil(i / 2), c0: P2 = [r.range(-4000, -1000), r.range(-3000, 3000)];
  const e = c0[0] + dx * s - dx * rank * 6 + side * dn * rank * 5, n = c0[1] + dn * s - dn * rank * 6 - side * dx * rank * 5;
  out.pos.set(e, 300 + r.range(0, 200), -n); out.heading = Math.atan2(dx, dn); out.bank = 0; out.flap = 1; out.visible = true;
}
/** session 9: a ground bird on terrain (the chukar coveys, magpies, wheatears, hoopoes): pecking within `r` m of its spot, a new
 *  spot every ~9 s; flushed (someone within `flushR`) it flies `away` m off from them over `dur` s, low, and lands there (C).
 *  `flush` keeps the flight (the one reactive state, as the sparrows') */
export function terrainGroundBird(spot: P2, ground: (e: number, n: number) => number, seed: number, i: number, t: number, r: number, flushR: number, away: number, dur: number, player: P2 | null,
  flush: Map<number, { from: P2; to: P2; t0: number }>, out: BirdPose): P2 {
  const f = flush.get(i);
  if (f && t - f.t0 < dur) { const k = (t - f.t0) / dur, s = k * k * (3 - 2 * k), e = f.from[0] + (f.to[0] - f.from[0]) * s, n = f.from[1] + (f.to[1] - f.from[1]) * s;
    out.pos.set(e, ground(e, n) + 0.3 + Math.sin(Math.PI * k) * Math.min(12, away * 0.12), -n); out.heading = Math.atan2(f.to[0] - f.from[0], f.to[1] - f.from[1]); out.bank = 0; out.flap = k < 0.35 ? 1 : 0.1; out.visible = true; return spot; }
  if (f) { spot = f.to; flush.delete(i); }
  const q = new Rng(seed, `gb:${i}:${Math.floor(t / 9)}`), e = spot[0] + q.range(-r, r), n = spot[1] + q.range(-r, r);
  if (player && Math.hypot(player[0] - e, player[1] - n) < flushR) { const a = Math.atan2(n - player[1], e - player[0]) + q.range(-0.5, 0.5); flush.set(i, { from: [e, n], to: [e + Math.cos(a) * away, n + Math.sin(a) * away], t0: t }); }
  out.pos.set(e, ground(e, n) + 0.02, -n); out.heading = q.range(0, 6.28); out.bank = 0; out.flap = 0; out.visible = true; return spot;
}
/** session 9: a flock circling as one over a cliff (jackdaws, choughs): each bird on its own offset within the flock (C) */
export function flockAt(base: P2, ground: number, seed: number, i: number, t: number, out: BirdPose) {
  const r = new Rng(seed, 'flock'), R = r.range(35, 70), w = r.range(0.12, 0.2) * (r.chance(0.5) ? 1 : -1), p = r.range(0, 6.3), h = r.range(25, 90);
  const q = new Rng(seed, `flock:${i}`), dr = q.range(-10, 10), dh = q.range(-6, 6), dp = q.range(-0.25, 0.25), a = w * t + p + dp + 0.08 * Math.sin(0.7 * t + i);
  out.pos.set(base[0] + (R + dr) * Math.cos(a), ground + h + dh + 3 * Math.sin(0.5 * t + i), -(base[1] + (R + dr) * Math.sin(a)));
  out.heading = Math.atan2(-Math.sin(a) * Math.sign(w), Math.cos(a) * Math.sign(w)); out.bank = -0.35 * Math.sign(w); out.flap = Math.sin(1.3 * t + i) > -0.2 ? 1 : 0.1; out.visible = true;
}
/** session 9: sandgrouse flocks flying fast and low to water at dawn: a passage every ~12 min, 20-60 m up at ~18 m/s (C) */
export function sandgrouseAt(i: number, seed: number, t: number, water: P2, out: BirdPose) {
  const P = 720, k = Math.floor(t / P), r = new Rng(seed, `sandgrouse:${k}`), a = r.range(0, 6.28), L = 9000, v = 18, s = (t - k * P) * v - L;
  if (s > 300) { out.visible = false; return; }
  const dx = Math.cos(a), dn = Math.sin(a), q = new Rng(seed, `sg:${k}:${i}`), e = water[0] + dx * s + q.range(-6, 6), n = water[1] + dn * s + q.range(-6, 6);
  out.pos.set(e, 20 + r.range(0, 40) + q.range(-2, 2), -n); out.heading = Math.atan2(dx, dn); out.bank = 0; out.flap = 1; out.visible = true;
}
/** a bird mesh: body (tapered box) + two wing quads; wing vertices carry `wing` = ±1 at the tips (0 on the body) */
function birdGeometry(span: number, len: number): THREE.BufferGeometry {
  const w = span / 2, l = len / 2, b = len * 0.12;
  const P: number[] = [], W: number[] = [];
  const tri = (a: number[], c: number[], d: number[], wa: number, wc: number, wd: number) => { P.push(...a, ...c, ...d); W.push(wa, wc, wd); };
  // body: a thin diamond prism along +z (forward)
  const nose = [0, 0, l], tail = [0, 0, -l], L = [-b, 0, 0], R = [b, 0, 0], U = [0, b, 0], D = [0, -b * 0.8, 0];
  for (const [p, q] of [[L, U], [U, R], [R, D], [D, L]]) { tri(nose, p, q, 0, 0, 0); tri(tail, q, p, 0, 0, 0); }
  // wings: swept triangles from the shoulders; tips at ±w
  const s = l * 0.25;
  tri([-b, 0, s], [-w, 0, -s * 0.5], [-b, 0, -s * 1.2], 0, -1, 0); tri([-b, 0, s], [-b, 0, -s * 1.2], [-w, 0, -s * 0.5], 0, 0, -1);
  tri([b, 0, s], [b, 0, -s * 1.2], [w, 0, -s * 0.5], 0, 0, 1); tri([b, 0, s], [w, 0, -s * 0.5], [b, 0, -s * 1.2], 0, 1, 0);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('wing', new THREE.Float32BufferAttribute(W, 1)); g.computeVertexNormals();
  return g;
}

export interface BirdPose { pos: THREE.Vector3; heading: number; bank: number; flap: number /* 0 glide … 1 full */; visible: boolean }

/** closed-form swallow flight: a hawking loop around a court anchor (two incommensurate ellipses + height wobble), ~10 m/s */
export function swallowAt(anchor: P2, ground: number, seed: number, t: number, out: BirdPose) {
  const r = new Rng(seed, 'swallow'); const a1 = r.range(12, 25), a2 = r.range(4, 10), w1 = r.range(0.25, 0.4), w2 = r.range(0.5, 0.8), p1 = r.range(0, 6.3), p2 = r.range(0, 6.3), h0 = r.range(4, 18), hA = r.range(1, 5);
  const x = anchor[0] + a1 * Math.cos(w1 * t + p1) + a2 * Math.cos(w2 * t + p2), n = anchor[1] + a1 * 0.8 * Math.sin(w1 * t + p1) + a2 * Math.sin(w2 * t * 1.3 + p2);
  const dx = -a1 * w1 * Math.sin(w1 * t + p1) - a2 * w2 * Math.sin(w2 * t + p2), dn = a1 * 0.8 * w1 * Math.cos(w1 * t + p1) + a2 * w2 * 1.3 * Math.cos(w2 * t * 1.3 + p2);
  out.pos.set(x, ground + h0 + hA * Math.sin(0.7 * t + p2), -n); out.heading = Math.atan2(dx, dn); out.bank = Math.max(-0.9, Math.min(0.9, (w1 * 0.5) * Math.sign(Math.sin(w2 * t))));
  out.flap = (Math.sin(t * 0.9 + p1) > 0.2) ? 1 : 0.15; out.visible = true;
}
/** closed-form soaring: circles of radius 40–90 m around a thermal that drifts with the wind; 9–12 m/s, few wingbeats */
export function raptorAt(base: P2, ground: number, seed: number, t: number, windX: number, windN: number, out: BirdPose) {
  const r = new Rng(seed, 'raptor'); const R = r.range(40, 90), v = r.range(9, 12), w = (v / R) * (r.chance(0.5) ? 1 : -1), p = r.range(0, 6.3), h = r.range(120, 450);
  const drift = 0.3; // thermals drift slower than the wind (C)
  const cx = base[0] + ((windX * drift * t) % 1600), cn = base[1] + ((windN * drift * t) % 1600);
  out.pos.set(cx + R * Math.cos(w * t + p), ground + h + 15 * Math.sin(0.05 * t + p), -(cn + R * Math.sin(w * t + p)));
  out.heading = Math.atan2(-R * w * Math.sin(w * t + p), R * w * Math.cos(w * t + p)); out.bank = -0.35 * Math.sign(w); out.flap = Math.sin(0.11 * t + p) > 0.93 ? 1 : 0; out.visible = true;
}

/** session 10 (WORLD_INVENTORY GB29): common and pallid swifts (C: summer breeders of the Iranian plateau's towns, cliffs and
 *  ruins, April-August; expected, not sourced). By day they feed high over the plain (60-180 m, wide circles); from ~1.6 h
 *  before sunset to ~20 min after it, and briefly after sunrise, they race in screaming parties of eight low round the Terrace's
 *  halls and towers at ~22 m/s, 13-35 m over the platform (above the lower palaces' roofs), weaving (behaviour C, as every swift colony does). Instances
 *  `first`.. of the swallows' mesh; `circuits` are the halls they lap (grid centre, half-extents): the Apadana, the Hall of 100
 *  Columns, the Tachara-Hadish block (their footprints' bounds, arch/spec.ts; the laps C) */
export const SWIFTS = { first: 36, count: 24, party: 8, speed: 22, months: [3, 4, 5, 6, 7], circuits: [[[2, 2], [63, 58]], [[146, -29], [37, 37]], [[6, -119], [45, 62]]] as [P2, P2][] } as const;
/** sunrise and sunset (local solar hours) at Persepolis (29.94° N) in climatological month m (0 = January), to ~10 min (C) */
export function sunHoursOfMonth(m: number): [number, number] {
  const dec = -23.44 * Math.cos((2 * Math.PI / 365) * (m * 30.4 + 15 + 10)) * Math.PI / 180, lat = 29.94 * Math.PI / 180;
  const H = Math.acos(Math.max(-1, Math.min(1, (Math.sin(-0.0145) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec))))) * 12 / Math.PI;
  return [12 - H, 12 + H];
}
/** session 10 (GA44): a kestrel's hunt over home ground `base` (grid), ground `g`: in cycles of ~40 s it hovers 20-30 s at 10-22 m
 *  (the wingbeat fast, the body still, facing the wind), slides 30-60 m on to its next spot, and one cycle in five ends in a
 *  stoop to the ground and a climb back (C) */
export function kestrelAt(base: P2, g: (e: number, n: number) => number, seed: number, t: number, wind: { x: number; n: number }, out: BirdPose) {
  const T = 40, c = Math.floor(t / T), f = (t - c * T) / T, r0 = new Rng(seed, 'kestrel'), ph = r0.range(0, 6.3), ps = r0.range(0, 6.3), spot = (k: number): P2 => [base[0] + 150 * Math.sin(k * 0.31 + ph), base[1] + 150 * Math.cos(k * 0.23 + ps)]; // (a beat over its ground, 20-50 m from spot to spot)
  const a = spot(c), b = spot(c + 1), rr = new Rng(seed, `kestrelh:${c}`), h = rr.range(10, 22), stoop = rr.chance(0.2), into = Math.atan2(-wind.x, -wind.n);
  if (f < 0.65) { const dip = stoop && f > 0.5 ? Math.sin((f - 0.5) / 0.15 * Math.PI) : 0, e = a[0] + 0.3 * Math.sin(t * 1.3), n = a[1] + 0.3 * Math.cos(t * 1.1);
    out.pos.set(e, g(e, n) + h * (1 - 0.92 * dip) + 0.15 * Math.sin(t * 2.1), -n); out.heading = Math.abs(wind.x) + Math.abs(wind.n) > 0.3 ? into : rr.range(0, 6.28); out.bank = 0; out.flap = dip > 0.3 ? 0 : 1; }
  else { const k = (f - 0.65) / 0.35, s = k * k * (3 - 2 * k), e = a[0] + (b[0] - a[0]) * s, n = a[1] + (b[1] - a[1]) * s;
    out.pos.set(e, g(e, n) + h + 6 * Math.sin(Math.PI * k), -n); out.heading = Math.atan2(b[0] - a[0], b[1] - a[1]); out.bank = 0.2 * Math.sin(Math.PI * k); out.flap = k < 0.3 ? 1 : 0.2; }
  out.visible = true;
}
/** session 10 (GA45): the starlings' murmuration: from 50 min before sunset to 12 min after it, in the winter months (C) */
export function murmurationOn(month: number, hour: number) { if (![10, 11, 0, 1].includes(month)) return false; const set = sunHoursOfMonth(month)[1]; return hour >= set - 0.83 && hour <= set + 0.2; }
/** closed-form murmuration: bird k of n over a roost at `roost` (grid), ground height `g`. The flock's centre drifts on slow
 *  loops 150-400 m round the roost, 40-110 m up; each bird keeps a place in a flattened, turning cloud whose shape is bent by two
 *  travelling waves (the ripples that run through a murmuration) and pulses between dense and spread; in the last 12 minutes the
 *  cloud funnels down into the reeds (C: the form, not the mechanics of the flock) */
export function starlingAt(k: number, n: number, seed: number, t: number, roost: P2, g: number, dropIn: number, out: BirdPose) {
  const r = new Rng(seed, `starling:${k}`), u = r.next(), v = r.next(), w = r.next();
  const cx = roost[0] + 220 * Math.sin(t * 0.021) + 90 * Math.sin(t * 0.057 + 1.3), cn = roost[1] + 160 * Math.sin(t * 0.017 + 0.7) + 80 * Math.cos(t * 0.049);
  const cy = g + (75 + 30 * Math.sin(t * 0.031)) * (1 - dropIn) + 3;
  const pulse = 0.65 + 0.35 * Math.sin(t * 0.23 + 2 * Math.sin(t * 0.07)), R = (35 + 25 * pulse) * (1 - 0.8 * dropIn);
  // a point in an ellipsoid (cube-root radius for an even fill), flattened and turned with the flock's heading
  const rad = Math.cbrt(u), th = 2 * Math.PI * v, ph = Math.acos(2 * w - 1), lx = rad * Math.sin(ph) * Math.cos(th), ly = rad * Math.cos(ph) * 0.35, lz = rad * Math.sin(ph) * Math.sin(th) * 0.6;
  const hd = Math.atan2(Math.cos(t * 0.021) * 0.021 * 220 + Math.cos(t * 0.057 + 1.3) * 0.057 * 90, Math.cos(t * 0.017 + 0.7) * 0.017 * 160 - Math.sin(t * 0.049) * 0.049 * 80);
  const wave = 0.28 * Math.sin(lx * 3 + t * 1.1) + 0.18 * Math.sin(lz * 4 - t * 0.8), ch = Math.cos(hd), sh = Math.sin(hd);
  const ex = (lx * ch + lz * sh) * R * 1.6, en = (-lx * sh + lz * ch) * R, ey = (ly + wave) * R * 0.6;
  out.pos.set(cx + ex, cy + ey, -(cn + en)); out.heading = hd + 0.3 * Math.sin(t * 0.9 + k); out.bank = 0.4 * Math.sin(t * 0.6 + lx * 2); out.flap = Math.sin(t * 3 + k) > -0.3 ? 1 : 0.2; out.visible = true;
}
/** is it the swifts' screaming time (evening parties, and a shorter bout after sunrise)? */
export function swiftScreaming(month: number, hour: number): boolean {
  if (!SWIFTS.months.includes(month as never)) return false; const [rise, set] = sunHoursOfMonth(month);
  return (hour >= set - 1.6 && hour <= set + 0.33) || (hour >= rise + 0.1 && hour <= rise + 0.8);
}
/** closed-form swift flight: bird `k` (0..count-1). Screaming: the party (k / party) laps its circuit, a rounded rectangle
 *  round the hall, each bird trailing the leader by 0.18 s with its own lateral and vertical offset and a weave; otherwise
 *  high feeding circles. Returns the party's leader index too (for the screams) */
export function swiftAt(k: number, seed: number, t: number, screaming: boolean, platform: number, out: BirdPose) {
  const party = Math.floor(k / SWIFTS.party), j = k % SWIFTS.party, r = new Rng(seed, `swift:${k}`), pr = new Rng(seed, `swiftparty:${party}`);
  if (!screaming) { // feeding high: wide circles over the Terrace and the plain W of it
    const R = r.range(70, 220), w = r.range(0.08, 0.16) * (r.chance(0.5) ? 1 : -1), p = r.range(0, 6.3), cx = r.range(-400, 200), cn = r.range(-200, 300), h = r.range(60, 180);
    out.pos.set(cx + R * Math.cos(w * t + p), platform + h + 12 * Math.sin(0.1 * t + p), -(cn + R * Math.sin(w * t + p)));
    out.heading = Math.atan2(-R * w * Math.sin(w * t + p), R * w * Math.cos(w * t + p)); out.bank = -0.4 * Math.sign(w); out.flap = Math.sin(0.7 * t + p) > 0 ? 1 : 0.1; out.visible = true; return;
  }
  const [[cx, cn], [ax, an]] = SWIFTS.circuits[party % SWIFTS.circuits.length], pad = pr.range(6, 14), A = ax + pad, B = an + pad, rr = 18;
  const per = 2 * (2 * (A - rr) + 2 * (B - rr)) + 2 * Math.PI * rr, dir = pr.chance(0.5) ? 1 : -1;
  const lap = (s0: number): [number, number] => { // arc length -> grid (x, n) on the rounded rectangle, counter-clockwise
    let s = ((s0 % per) + per) % per; const L1 = 2 * (A - rr), L2 = 2 * (B - rr), q = Math.PI * rr / 2;
    const arc = (ox: number, on: number, a0: number, u: number): [number, number] => [ox + rr * Math.cos(a0 + u / rr), on + rr * Math.sin(a0 + u / rr)];
    const segs: [number, (u: number) => [number, number]][] = [
      [L1, u => [cx - (A - rr) + u, cn - B]], [q, u => arc(cx + (A - rr), cn - (B - rr), -Math.PI / 2, u)],
      [L2, u => [cx + A, cn - (B - rr) + u]], [q, u => arc(cx + (A - rr), cn + (B - rr), 0, u)],
      [L1, u => [cx + (A - rr) - u, cn + B]], [q, u => arc(cx - (A - rr), cn + (B - rr), Math.PI / 2, u)],
      [L2, u => [cx - A, cn + (B - rr) - u]], [q, u => arc(cx - (A - rr), cn - (B - rr), Math.PI, u)]];
    for (const [len, f] of segs) { if (s <= len) return f(s); s -= len; } return segs[0][1](0);
  };
  const sp = SWIFTS.speed * pr.range(0.9, 1.1), s = dir * (sp * (t - j * 0.18) + pr.range(0, per)), [x, n] = lap(s), [x2, n2] = lap(s + dir), hd = Math.atan2(x2 - x, n2 - n);
  const side = r.range(-3, 3) + 2.5 * Math.sin(1.7 * t + r.range(0, 6.3)), up = pr.range(18, 30) + r.range(-2, 2) + 3 * Math.sin(0.9 * t + j);
  const hx = Math.sin(hd), hn = Math.cos(hd); // heading as (east, north) for grid heading hd (0 = north)
  out.pos.set(x + hn * side, platform + up, -(n - hx * side)); out.heading = hd; out.bank = 0.5 * Math.sin(1.7 * t + j); out.flap = Math.sin(2.3 * t + j) > -0.2 ? 1 : 0.2; out.visible = true;
}
export class Birds {
  /** session 10: a screaming party of swifts close enough to be heard (grid position of its leader, m); set by the world */
  onScream?: (pos: THREE.Vector3) => void;
  /** session 10: the starlings' winter roost: the bank of the Pulvar's reach nearest the Terrace (3.4 km NNW, grid (-1658, 2919):
   *  seen from the Terrace's N edge at dusk) */
  private roost: P2 | null = null;
  private nextScream = new Map<number, number>(); private floors = new Map<number, number>();
  private swiftFloor(k: number) { const c = Math.floor(k / SWIFTS.party) % SWIFTS.circuits.length; let y = this.floors.get(c);
    if (y === undefined) { const [e, n] = SWIFTS.circuits[c][0], h = this.nav.heightAt(e, n); y = Number.isFinite(h) ? h : this.terrain.heightAt(e, -n); this.floors.set(c, y); } return y; }
  readonly group = new THREE.Group();
  private meshes = new Map<string, THREE.InstancedMesh>();
  private uTime = uniform(0);
  private anchors: P2[] = []; private sparrowSpots: P2[] = [];
  private flush = new Map<number, { from: THREE.Vector3; to: P2; t0: number }>();
  private pose: BirdPose = { pos: new THREE.Vector3(), heading: 0, bank: 0, flap: 0, visible: false };
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private middens: P2[] = []; private kiteBases: P2[] = []; private fields: P2[] = []; private waters: P2[] = []; private doveSpots: P2[] = []; private doveFlush = new Map<number, { from: THREE.Vector3; to: P2; t0: number }>();
  /** session 9: the new ground birds' spots (they move when flushed) and flights; the slope's covey spots and the steppe's */
  private gSpots = new Map<string, P2[]>(); private gFlush = new Map<string, Map<number, { from: P2; to: P2; t0: number }>>(); private slope: P2[] = []; private steppe: P2[] = []; /** the water birds' edges: beside the channels, not on their beds */ private banks: P2[] = [];
  /** `town` (D-210): the town's middens (the crows' rounds) and the places the kites circle over (middens, the stockyard) */
  constructor(private seed: number, private nav: NavGrid, private terrain: Terrain, anchors: P2[], town?: { middens: P2[]; kites: P2[] }, wild?: { fields: P2[]; waters: P2[]; slope?: P2[]; steppe?: P2[]; banks?: P2[] }) {
    this.group.name = 'wildlife-birds';
    this.anchors = anchors; if (town) { this.middens = town.middens; this.kiteBases = town.kites; } if (wild) { this.fields = wild.fields; this.waters = wild.waters; this.slope = wild.slope ?? []; this.steppe = wild.steppe ?? []; this.banks = wild.banks ?? []; }
    const rng = new Rng(seed, 'sparrow-spots');
    for (let i = 0; i < BIRDS.sparrow.count; i++) { const a = anchors[i % anchors.length]; const s = nav.snap(a[0] + rng.range(-10, 10), a[1] + rng.range(-10, 10), 6); if (s) this.sparrowSpots.push(s); }
    for (let i = 0; i < BIRDS.dove.count; i++) { const a = anchors[(i * 3) % anchors.length]; const s = nav.snap(a[0] + rng.range(-14, 14), a[1] + rng.range(-14, 14), 6); if (s) this.doveSpots.push(s); }
    for (const sp of Object.values(BIRDS)) {
      const m = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(...sp.colour, THREE.SRGBColorSpace), roughness: 0.8, side: THREE.DoubleSide });
      const wing = attribute('wing', 'float'), phase = attribute('phase', 'float'), flap = attribute('flapAmt', 'float');
      // wingbeat: tips rise and fall (±60°), scaled by the instance's flap amount; gliding birds hold a slight dihedral
      const beat = sin(this.uTime.mul(sp.flapHz * Math.PI * 2).add(phase)).mul(flap).mul(0.9).add(0.12);
      m.positionNode = positionLocal.add(vec3(0, abs(wing).mul(beat).mul(float(sp.span * 0.5)), 0));
      const g = birdGeometry(sp.span, sp.length);
      const mesh = new THREE.InstancedMesh(g, m, sp.count); mesh.count = 0; mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
      g.setAttribute('phase', new THREE.InstancedBufferAttribute(new Float32Array(sp.count).map((_, i) => new Rng(seed, `${sp.id}:${i}`).range(0, 6.28)), 1));
      g.setAttribute('flapAmt', new THREE.InstancedBufferAttribute(new Float32Array(sp.count).fill(1), 1));
      mesh.userData = { tier: sp.tier, src: 'SOUND-R', note: `${sp.name}; flight paths procedural (C)` };
      this.meshes.set(sp.id, mesh); this.group.add(mesh);
    }
  }
  /** month 0 = first month of the regnal year (spring); hour local; t world seconds; player grid position */
  update(month: number, hour: number, t: number, player: P2 | null, wind: { x: number; n: number }, rain: number) {
    this.uTime.value = t % 100000;
    for (const sp of Object.values(BIRDS)) {
      const mesh = this.meshes.get(sp.id)!, flapAttr = mesh.geometry.getAttribute('flapAmt') as THREE.InstancedBufferAttribute;
      const hrs = sp.id === 'bat' ? batHours(month) : sp.hours, active = sp.months.includes(month) && hour >= hrs[0] && hour <= hrs[1] && rain < 0.4;
      let n = 0;
      if (active) for (let i = 0; i < sp.count; i++) {
        const p = this.pose, sd = hashSeed(this.seed, sp.id, i);
        if (sp.id === 'swallow' && i >= SWIFTS.first) { const k = i - SWIFTS.first, sc = swiftScreaming(month, hour); if (!SWIFTS.months.includes(month as never)) continue;
          swiftAt(k, this.seed, t, sc, this.swiftFloor(k), p); // (heights over the platform's floor under the party's circuit)
          if (sc && k % SWIFTS.party === 0 && player && this.onScream && Math.hypot(p.pos.x - player[0], -p.pos.z - player[1]) < 90) { const due = this.nextScream.get(k) ?? 0;
            if (t >= due) { this.onScream(p.pos); this.nextScream.set(k, t + new Rng(this.seed, `scream:${k}:${Math.floor(t)}`).range(2.5, 7)); } } }
        else if (sp.id === 'swallow') { const a = this.anchors[i % this.anchors.length]; swallowAt(a, this.nav.heightAt(a[0], a[1]) || 0, sd, t, p); }
        else if (sp.id === 'raptor') { const base: P2 = [260 + i * 350, -40 - i * 220]; raptorAt(base, this.terrain.heightAt(base[0], -base[1]), sd, t, wind.x, wind.n, p); }
        else if (sp.id === 'crow') { if (!this.middens.length) continue; crowAt(this.middens, this.gh, this.seed, i, t, false, p);
          if (player && p.flap === 0 && Math.hypot(player[0] - p.pos.x, player[1] + p.pos.z) < 8) crowAt(this.middens, this.gh, this.seed, i, t, true, p); }
        else if (sp.id === 'kite') { if (!this.kiteBases.length) continue; const b = this.kiteBases[i % this.kiteBases.length]; kiteAt(b, this.terrain.heightAt(b[0], -b[1]), sd, t, p); }
        else if (sp.id === 'dove') { if (!this.groundBirdAt(this.doveSpots, this.doveFlush, 5, i, t, player, p, 'dove')) continue; }
        else if (sp.id === 'lark') { if (!this.fields.length) continue; const b = this.fields[i % this.fields.length]; larkAt(b, this.terrain.heightAt(b[0], -b[1]), sd, t, p); }
        else if (sp.id === 'stork') { const pool = this.banks.length ? this.banks : this.waters; if (!pool.length) continue; const b = pool[(i * 7) % pool.length]; storkAt(b, this.wetGround, sd, t, p); }
        else if (sp.id === 'vulture') { const base: P2 = [900 + i * 500, 300 - i * 700]; raptorAt(base, this.terrain.heightAt(base[0], -base[1]) + 200, sd, t, wind.x, wind.n, p); }
        else if (sp.id === 'crane') { craneAt(i, this.seed, t, p); if (!p.visible) continue; }
        else if (sp.id === 'chukar') { if (!this.slope.length) continue; const cv = Math.floor(i / 8), base = this.slope[(cv * 5) % this.slope.length];
          if (!this.groundBird('chukar', i, base, t, player, p, 5, 18, 90, 4.5, cv)) continue; } // coveys of 8: the whole covey flushes together (keyed by covey)
        else if (sp.id === 'hoopoe') { const a = this.anchors[(i * 3 + 1) % this.anchors.length]; if (!this.groundBird('hoopoe', i, a, t, player, p, 8, 7, 25, 2, i, true)) continue; }
        else if (sp.id === 'magpie') { if (!this.fields.length) continue; if (!this.groundBird('magpie', i, this.fields[(i * 7 + 3) % this.fields.length], t, player, p, 10, 15, 40, 2.5, i)) continue; }
        else if (sp.id === 'wheatear') { const pool = this.steppe.length ? this.steppe : this.fields; if (!pool.length) continue; if (!this.groundBird('wheatear', i, pool[(i * 11 + 2) % pool.length], t, player, p, 4, 10, 25, 1.5, i)) continue; }
        else if (sp.id === 'beeeater') { const pool = this.waters.length ? this.waters : this.fields; if (!pool.length) continue; const b = pool[(Math.floor(i / 7) * 13 + 5) % pool.length];
          swallowAt([b[0] + (i % 7) * 4, b[1]], this.terrain.heightAt(b[0], -b[1]) + 10 + (i % 3) * 5, sd, t * 0.8, p); }
        else if (sp.id === 'heron' || sp.id === 'egret') { const pool = this.banks.length ? this.banks : this.waters; if (!pool.length) continue; const b = pool[(i * (sp.id === 'heron' ? 17 : 23) + 9) % pool.length]; storkAt(b, this.wetGround, sd, t, p); }
        else if (sp.id === 'jackdaw') { const base: P2 = [330, -60]; flockAt(base, this.terrain.heightAt(base[0], -base[1]), this.seed, i, t, p); }
        else if (sp.id === 'sandgrouse') { if (!this.waters.length) continue; const w0 = this.waters[Math.floor(new Rng(this.seed, `sgw:${Math.floor(t / 720)}`).range(0, this.waters.length * 0.999))]; sandgrouseAt(i, this.seed, t, w0, p); if (!p.visible) continue; p.pos.y += this.terrain.heightAt(p.pos.x, p.pos.z); }
        else if (sp.id === 'owl') { const pool = this.slope.length ? this.slope : this.steppe; if (!pool.length) continue; if (!this.groundBird('owl', i, pool[(i * 13 + 7) % pool.length], t, player, p, 3, 14, 40, 2.5, i)) continue; }
        else if (sp.id === 'bulbul') { const a = this.anchors[(i * 5 + 2) % this.anchors.length]; if (!this.groundBird('bulbul', i, a, t, player, p, 6, 5, 18, 1.4, i, true)) continue; }
        else if (sp.id === 'roller') { if (!this.fields.length) continue; const b = this.fields[(i * 17 + 1) % this.fields.length]; kiteAt(b, this.terrain.heightAt(b[0], -b[1]) - 25, sd, t * 1.3, p); } // low hunting circles, 10-95 m
        else if (sp.id === 'duck') { const pool = this.banks.length ? this.banks : this.waters; if (!pool.length) continue; const b = pool[(Math.floor(i / 4) * 29 + 11) % pool.length]; // small parties resting at the water's edge, flushing at 25 m
          if (!this.groundBird('duck', i, b, t, player, p, 4, 25, 120, 6, Math.floor(i / 4))) continue; }
        else if (sp.id === 'starling') { const pool = this.banks.length ? this.banks : this.waters; if (!pool.length || !murmurationOn(month, hour)) continue;
          const near = (q: P2) => Math.hypot(q[0] + 1658, q[1] - 2919), roost = this.roost ??= pool.reduce((b, q) => (near(q) < near(b) ? q : b), pool[0]), set = sunHoursOfMonth(month)[1], drop = Math.max(0, Math.min(1, (hour - set) / 0.2));
          starlingAt(i, sp.count, this.seed, t, roost, this.terrain.heightAt(roost[0], -roost[1]), drop, p); }
        else if (sp.id === 'kestrel') { const pool = [...this.fields, ...this.steppe]; if (!pool.length) continue; kestrelAt(pool[(i * 37 + 11) % pool.length], this.gh, hashSeed(this.seed, 'kestrel', i), t, wind, p); }
        else if (sp.id === 'bat') { const pool = i % 2 && this.waters.length ? this.waters : this.anchors, a = pool[(i * 5) % pool.length]; batAt(a, i % 2 && this.waters.length ? this.terrain.heightAt(a[0], -a[1]) : (this.nav.heightAt(a[0], a[1]) || 0), sd, t, p); }
        else { if (!this.sparrowAt(i, t, player, p)) continue; }
        this.e.set(0, p.heading, 0); this.q.setFromEuler(this.e); if (p.bank) this.q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), p.bank));
        // (the starlings: each drawn bird stands for ~15 of a real murmuration's tens of thousands, so far off it is drawn no smaller
        // than ~1.2 mrad, the flock's darkness from the many not drawn: C)
        if (sp.id === 'starling' && player) { const d = Math.hypot(p.pos.x - player[0], -p.pos.z - player[1]), k = Math.max(1, (d * 0.0012) / sp.span); this.m4.compose(p.pos, this.q, SCL.set(k, k, k)); }
        else this.m4.compose(p.pos, this.q, ONE); mesh.setMatrixAt(n, this.m4); flapAttr.setX(n, p.flap); n++;
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = n > 0; flapAttr.needsUpdate = n > 0;
    }
  }
  private gh = (e: number, n: number) => this.terrain.heightAt(e, -n);
  /** a wader's ground: the terrain, but never the channel's bed (the birds' walking circles reach over the channel: there they
   *  stand at the bank's level, as on the shallow margin; C) */
  private wetGround = (e: number, n: number) => { let y = this.terrain.heightAt(e, -n); for (const [dx, dn] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) y = Math.max(y, this.terrain.heightAt(e + dx * 4, -(n + dn * 4)) - 0.4); return y; };
  /** a session-9 ground bird of species `id`, number `i`, whose home is `home`: `key` groups birds that flush together (a
   *  covey); `nav`: on the town's walkable ground (courts) rather than the terrain */
  private groundBird(id: string, i: number, home: P2, t: number, player: P2 | null, out: BirdPose, r: number, flushR: number, away: number, dur: number, key: number, nav = false): boolean {
    let spots = this.gSpots.get(id); if (!spots) this.gSpots.set(id, spots = []); let fl = this.gFlush.get(id); if (!fl) this.gFlush.set(id, fl = new Map());
    const spot = spots[key] ?? home; const q = new Rng(this.seed, `${id}:home:${i}`), my: P2 = [spot[0] + q.range(-r, r) * 0.6, spot[1] + q.range(-r, r) * 0.6];
    const ground = nav ? (e: number, n: number) => { const y = this.nav.heightAt(e, n); return Number.isFinite(y) ? y : this.terrain.heightAt(e, -n); } : this.gh;
    const before = fl.get(key), next = terrainGroundBird(my, ground, this.seed ^ hashSeed(this.seed, id, i), key, t, r * 0.4, flushR, away, dur, player, fl, out);
    if (before && !fl.get(key)) spots[key] = [spot[0] + (before.to[0] - before.from[0]), spot[1] + (before.to[1] - before.from[1])]; // landed: the flock's new home
    if (fl.get(key)) { const o = new Rng(this.seed, `${id}:fly:${i}`); out.pos.x += o.range(-3, 3); out.pos.y += o.range(-0.8, 0.8); out.pos.z += o.range(-3, 3); } // each bird its own place in the flushed covey
    void next; return out.visible;
  }
  /** session 9: a ground bird (the doves) pecking about its spot, flushing when someone comes within `flushR` (C) */
  private groundBirdAt(spots: P2[], flush: Map<number, { from: THREE.Vector3; to: P2; t0: number }>, flushR: number, i: number, t: number, player: P2 | null, out: BirdPose, id: string): boolean {
    const s = spots[i]; if (!s) return false; const r = new Rng(this.seed, `${id}:${i}:${Math.floor(t / 11)}`), at: P2 = [s[0] + r.range(-2, 2), s[1] + r.range(-2, 2)], f = flush.get(i);
    if (f && t - f.t0 < 2) { const k = (t - f.t0) / 2, to = f.to, y = this.nav.heightAt(to[0], to[1]) || 0; out.pos.set(f.from.x + (to[0] - f.from.x) * k, f.from.y + (y - f.from.y) * k + Math.sin(Math.PI * k) * 6, f.from.z + (-to[1] - f.from.z) * k);
      out.heading = Math.atan2(to[0] - f.from.x, to[1] + f.from.z); out.bank = 0; out.flap = 1; return true; }
    if (f) { spots[i] = f.to; flush.delete(i); }
    const y = this.nav.heightAt(at[0], at[1]); if (!Number.isFinite(y)) return false;
    if (player && Math.hypot(player[0] - at[0], player[1] - at[1]) < flushR) { const ang = Math.atan2(at[1] - player[1], at[0] - player[0]) + r.range(-0.6, 0.6), d = r.range(15, 30);
      const to = this.nav.snap(at[0] + Math.cos(ang) * d, at[1] + Math.sin(ang) * d, 6); if (to) flush.set(i, { from: new THREE.Vector3(at[0], y, -at[1]), to, t0: t }); }
    out.pos.set(at[0], y + 0.02, -at[1]); out.heading = r.range(0, 6.28); out.bank = 0; out.flap = 0; return true;
  }
  /** sparrows: hop between spots near their anchor; flush 8–15 m when someone is within 3 m, land after ~1.2 s */
  private sparrowAt(i: number, t: number, player: P2 | null, out: BirdPose): boolean {
    const s = this.sparrowSpots[i]; if (!s) return false;
    const r = new Rng(this.seed, `sparrow:${i}:${Math.floor(t / 7)}`); // a new hop every ~7 s
    const at: P2 = [s[0] + r.range(-1.5, 1.5), s[1] + r.range(-1.5, 1.5)];
    const f = this.flush.get(i);
    if (f && t - f.t0 < 1.2) { const k = (t - f.t0) / 1.2, to = f.to, y = this.nav.heightAt(to[0], to[1]) || 0;
      out.pos.set(f.from.x + (to[0] - f.from.x) * k, f.from.y + (y - f.from.y) * k + Math.sin(Math.PI * k) * 3, f.from.z + (-to[1] - f.from.z) * k); out.heading = Math.atan2(to[0] - f.from.x, to[1] + f.from.z); out.bank = 0; out.flap = 1; return true; }
    if (f && t - f.t0 >= 1.2) { this.sparrowSpots[i] = f.to; this.flush.delete(i); }
    const y = this.nav.heightAt(at[0], at[1]); if (!Number.isFinite(y)) return false;
    if (player && Math.hypot(player[0] - at[0], player[1] - at[1]) < 3) {
      const ang = Math.atan2(at[1] - player[1], at[0] - player[0]) + r.range(-0.6, 0.6), d = r.range(8, 15);
      const to = this.nav.snap(at[0] + Math.cos(ang) * d, at[1] + Math.sin(ang) * d, 5); if (to) this.flush.set(i, { from: new THREE.Vector3(at[0], y, -at[1]), to, t0: t });
    }
    out.pos.set(at[0], y + 0.02, -at[1]); out.heading = r.range(0, 6.28); out.bank = 0; out.flap = 0; return true;
  }
}
const ONE = new THREE.Vector3(1, 1, 1), SCL = new THREE.Vector3();
function hashSeed(seed: number, id: string, i: number) { let h = seed * 2654435761 >>> 0; for (const c of `${id}:${i}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; }

// ---------------------------------------------------------------------------------------------- part 2: jackals
// Golden jackal (B: confirmed in Fars, research/SOUNDSCAPE.md §5; their dusk/night chorus is in the soundscape). A pack of
// 2–4 roams the plain below the W and S Terrace walls, ~130–970 m out, from dusk to dawn (behaviour C): trotting ~2 m/s
// on slow wandering curves, pausing to sniff. Closed-form in (seed, day, time) like the birds. One InstancedMesh (1 draw
// call, no shadows); the legs swing in the vertex shader (diagonal pairs in phase, a trot).
export const JACKAL = { name: 'golden jackal', tier: 'B species (Fars) / C behaviour', hours: [18.6, 5.8] as [number, number], count: 4, length: 0.75, height: 0.45, colour: [0.52, 0.42, 0.28] as [number, number, number] };

function jackalGeometry(): THREE.BufferGeometry {
  const P: number[] = [], LEG: number[] = [];
  const box = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, leg: number) => {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    for (const [a, b, c, d] of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) for (const k of [a, b, c, a, c, d]) { P.push(...v[k]); LEG.push(leg === 0 ? 0 : leg * Math.max(0, (cy + sy / 2 - v[k][1]) / sy)); }
  };
  const L = JACKAL.length, H = JACKAL.height;
  box(0, H * 0.72, 0, 0.2, 0.22, L * 0.62, 0);            // body
  box(0, H * 0.9, L * 0.38, 0.14, 0.14, 0.2, 0);         // head
  box(0, H * 0.95, L * 0.5, 0.07, 0.07, 0.1, 0);         // muzzle
  box(0, H * 0.7, -L * 0.42, 0.07, 0.07, 0.26, 0);       // tail (brush)
  for (const [x, z, leg] of [[-0.07, 0.22, 1], [0.07, 0.22, -1], [-0.07, -0.2, -1], [0.07, -0.2, 1]]) box(x, H * 0.3, z * L, 0.05, H * 0.6, 0.05, leg); // legs: diagonal pairs share a phase
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('leg', new THREE.Float32BufferAttribute(LEG, 1)); g.computeVertexNormals();
  return g;
}

/** a jackal's place on the night's wander: closed form; `moving` false while it pauses */
export function jackalAt(seed: number, night: number, i: number, t: number, out: { e: number; n: number; heading: number; moving: boolean }) {
  const r = new Rng(seed, `jackal:${night}`);
  // loop centres 350–600 m W of the W wall or 480–750 m S of the S wall; excursions ≤ 1.35 A ≤ 216 m keep them on the plain
  const side = r.chance(0.5) ? 'W' : 'S', cx = side === 'W' ? r.range(-600, -350) : r.range(-150, 250), cn = side === 'W' ? r.range(-150, 250) : r.range(-750, -480);
  const q = new Rng(seed, `jackal:${night}:${i}`), ox = q.range(-6, 6), on = q.range(-6, 6), lag = i * 2.5;
  const T = t - lag, A = r.range(80, 160), w = 2.0 / A; // ~2 m/s along a wandering loop of scale A
  const s = w * T, ph = r.range(0, 6.3);
  // pause for ~20 % of the time (sniffing): time-warp the path parameter
  const cyc = (T % 60 + 60) % 60, moving = cyc < 48, sw = moving ? s - Math.floor(T / 60) * w * 12 : s - (cyc - 48) * w - Math.floor(T / 60) * w * 12;
  out.e = cx + A * Math.sin(sw + ph) + 0.35 * A * Math.sin(2.3 * sw) + ox; out.n = cn + A * 0.6 * Math.sin(1.7 * sw + ph) + on;
  const de = A * Math.cos(sw + ph) + 0.35 * A * 2.3 * Math.cos(2.3 * sw), dn = A * 0.6 * 1.7 * Math.cos(1.7 * sw + ph);
  out.heading = Math.atan2(de, dn); out.moving = moving;
}

export class Jackals {
  readonly mesh: THREE.InstancedMesh;
  private uTime = uniform(0); private moveAttr: THREE.InstancedBufferAttribute;
  private p = { e: 0, n: 0, heading: 0, moving: false }; private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private up = new THREE.Vector3(0, 1, 0);
  constructor(private seed: number, private terrain: Terrain) {
    const g = jackalGeometry();
    const m = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(...JACKAL.colour, THREE.SRGBColorSpace), roughness: 0.95 });
    const leg = attribute('leg', 'float'), mv = attribute('moving', 'float');
    // trot: legs swing ±25° about the hip at ~2.2 Hz, diagonal pairs opposite (sign of `leg`)
    m.positionNode = positionLocal.add(vec3(0, 0, sin(this.uTime.mul(2.2 * Math.PI * 2)).mul(leg).mul(mv).mul(0.12)));
    this.mesh = new THREE.InstancedMesh(g, m, JACKAL.count); this.mesh.count = 0; this.mesh.castShadow = false; this.mesh.frustumCulled = false;
    this.moveAttr = new THREE.InstancedBufferAttribute(new Float32Array(JACKAL.count), 1); g.setAttribute('moving', this.moveAttr);
    this.mesh.userData = { tier: JACKAL.tier, src: 'SOUND-R', note: `${JACKAL.name}; pack range and paths procedural (C)` };
    this.mesh.name = 'wildlife-jackals';
  }
  /** dayIndex/hour local; t world seconds */
  update(dayIndex: number, hour: number, t: number) {
    this.uTime.value = t % 100000;
    const on = hour >= JACKAL.hours[0] || hour <= JACKAL.hours[1]; if (!on) { this.mesh.count = 0; return; }
    const night = hour >= JACKAL.hours[0] ? dayIndex : dayIndex - 1, pack = 2 + new Rng(this.seed, `jackal-pack:${night}`).int(0, JACKAL.count - 2);
    for (let i = 0; i < pack; i++) {
      jackalAt(this.seed, night, i, t, this.p); const y = this.terrain.heightAt(this.p.e, -this.p.n);
      this.q.setFromAxisAngle(this.up, this.p.heading); this.m4.compose(new THREE.Vector3(this.p.e, y, -this.p.n), this.q, new THREE.Vector3(1, 1, 1));
      this.mesh.setMatrixAt(i, this.m4); this.moveAttr.setX(i, this.p.moving ? 1 : 0);
    }
    this.mesh.count = pack; this.mesh.instanceMatrix.needsUpdate = true; this.moveAttr.needsUpdate = true;
  }
}
