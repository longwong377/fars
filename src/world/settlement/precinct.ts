// The open-air sacred precinct and the town's burial ground (D-209, session 7; D-207 "fill the gaps with the most probable
// reconstruction"). Data only (no three.js, no terrain): the town plan (plan.ts) takes the props, graves and the kept fire
// from here, the builder (build.ts) sets them on the ground, and the population's places (popgeo.ts) stand people round
// them. Every value's tier and basis is in its note (the dev overlay F3 prints it):
//  - WHAT IS NOT BUILT, on the evidence: no fire temple, no roofed shrine, no statue. Herodotus 1.131 (read, FT): the
//    Persians do not "make and set up statues and temples and altars"; no fire temple of the period is excavated at
//    Persepolis; temple cults are dated from Artaxerxes II (c. 400) and the Sasanians. What the evidence does show is
//    open-air: the two stone plinths of the sacred precinct at Pasargadae and the stepped fire altar the king faces on
//    the tomb reliefs at Naqsh-e Rustam.
//  - the plinths (B for the form: PAS-PRECINCT, search extracts): two white limestone plinths about 2 m high rising from
//    low black limestone borders, one 2.8 x 2.8 m, the other 2.5 x 2.5 m fronted by a monolithic flight of steps (eight in
//    one extract, nine in another: Q-420), "some nine metres apart" (read here as centre to centre, C). Stronach's
//    reading: the stepped plinth a platform for the king, the other for the fire in a portable holder. With the court
//    away (D-003) the fire-plinth stands bare (C);
//  - the altar (B for the form: NR-ALTAR, search extracts; the relief itself NOT SEEN): a stepped altar (a three-stepped
//    foot, a square shaft, a three-stepped top) as on the tomb façades; its size and stone C. It stands on the ground,
//    east of the plinths, and the fire kept on it is fed by the magi at dawn and at dusk (C: a kept fire is a
//    reconstruction from Herodotus 3.16 "the Persians hold fire to be a god", read, and the later Iranian practice; no
//    Achaemenid text says a fire was kept at Persepolis);
//  - the place (C): the bench of level ground (slope ~5 %) at the foot of Kuh-e Rahmat 180 m S of the Terrace, 10 m above
//    the plain: open, above the irrigated land, clear of the town's quarters (the lower town begins 350 m W), the roads
//    (the road south 330 m W), the canal, the court's camps and the Terrace's walkable approach; overlooked by the
//    mountain, where the offerings "to a mountain" (E-31) go up the slope (Herodotus 1.131: sacrifice on the peaks). The
//    one excavated precinct (Pasargadae) also lies on open ground below a rise at the plain's edge. Measured on the
//    terrain (tools, D-209): -3 m relative to the Terrace court, the plain W at -12 m;
//  - the burial ground (C): the dead are "buried in earth" after the body is coated in wax (Herodotus 1.140, read, a
//    Greek claim: B); no burial ground in use near Persepolis in 467 is located (SETTLEMENT.md §6; the Spring Cemetery is
//    later, Akhor Rostam disputed). Placed where burial grounds of the region lie: on dry ground outside the settlement,
//    not tilled, at the mountain's foot: 1.1 km S of the Terrace, 250 m E of the lower town, 560 m E of the road south.
//    Low earth mounds over single graves, some with a few field stones (C). No exposure is shown anywhere (E-71).
import { toGrid, type Frame, type P2 } from './site';
import type { Prop, Midden } from './plan';
import { Rng } from '../../core/rng';

const deg = Math.PI / 180;
/** grid north is 341° true (D-002): the frame whose +u is true north and +v true west */
const TRUE_NORTH_THETA = (90 - ((0 - 341 + 360) % 360)) * deg;
/** the precinct: centre (grid m), axis (+u true north, +v true west) */
export const PRECINCT = {
  c: [255, -415] as P2, theta: TRUE_NORTH_THETA,
  /** the plinths (PAS-PRECINCT, B form): half the side, the height above the border, centre along the N-S axis (m) */
  fireP: { half: 1.4, h: 2.0, u: 4.5 }, kingP: { half: 1.25, h: 2.0, u: -4.5 },
  border: { out: 0.3, h: 0.25 }, stair: { steps: 8, rise: 0.25, tread: 0.3, half: 0.6 },
  /** the stepped altar east of the plinths (NR-ALTAR, B form; C size): steps' half-sides and heights, shaft, top */
  altar: { u: 0, e: 9, foot: [[0.45, 0.12], [0.37, 0.12], [0.29, 0.12]] as [number, number][], shaft: [0.22, 0.5] as [number, number], top: [[0.29, 0.1], [0.37, 0.1], [0.45, 0.12]] as [number, number][] },
} as const;
/** a point of the precinct: `north`, `east` metres from the centre (true) */
export const precinctAt = (north: number, east: number): P2 => toGrid({ c: PRECINCT.c, theta: PRECINCT.theta }, north, -east);
/** the altar's height to the fire (m above its base) */
export const ALTAR_H = PRECINCT.altar.foot.reduce((a, s) => a + s[1], 0) + PRECINCT.altar.shaft[1] + PRECINCT.altar.top.reduce((a, s) => a + s[1], 0);
/** where the magus tending the fire stands: 1.3 m W of the altar, facing it (east) */
export const ALTAR_SPOT = { at: precinctAt(PRECINCT.altar.u, PRECINCT.altar.e - 1.3), faceTo: precinctAt(PRECINCT.altar.u, PRECINCT.altar.e) };
/** the burial ground (C): centre and half-extent (grid m, axis-aligned), graves in loose rows */
export const BURIAL = { c: [60, -1350] as P2, half: [34, 24] as P2, graves: 140 };

const WHITE: [number, number, number] = [0.8, 0.77, 0.69], BLACK: [number, number, number] = [0.19, 0.19, 0.2], ALTAR_STONE: [number, number, number] = [0.74, 0.7, 0.62];
const PL = 'plinth after the sacred precinct at Pasargadae (PAS-PRECINCT, search extracts: B form)';
const AL = 'stepped fire altar after the tomb reliefs at Naqsh-e Rustam (NR-ALTAR: a three-stepped foot, a shaft, a three-stepped top; B form, relief NOT SEEN; size and stone C)';

/** the precinct's props and their groups (each plinth, the stair and the altar its own group: its base the lowest ground
 *  under it, so nothing is buried on the slope) */
export function precinctProps(props: Prop[], groups: Map<string, P2[]>) {
  const P = PRECINCT, th = P.theta, row = 'precinct_plinths', feature = 'sacred_precinct';
  const sq = (g: string, n: number, e: number, half: number) => groups.set(g, [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => precinctAt(n + a * half, e + b * half)));
  const box = (g: string, n: number, e: number, hn: number, he: number, y0: number, y1: number, colour: [number, number, number], note: string, r = row) =>
    props.push({ shape: 'box', mat: 'stone', c: precinctAt(n, e), theta: th, hu: hn, hv: he, y0, y1, group: g, collide: true, row: r, feature, note, colour });
  for (const [g, pl, label] of [['precinct_fire', P.fireP, 'the N plinth, 2.8 x 2.8 m, 2 m high: for the fire in a portable holder when the king worships (Stronach\'s reading, via extract); bare while the court is away (C)'],
    ['precinct_king', P.kingP, 'the S plinth, 2.5 x 2.5 m, 2 m high, with its stair: the platform the king worships from (Stronach\'s reading, via extract); nobody climbs it while the court is away (C)']] as const) {
    if (g === 'precinct_fire') sq(g, pl.u, 0, pl.half + P.border.out + 0.2);
    box(g, pl.u, 0, pl.half + P.border.out, pl.half + P.border.out, -0.4, P.border.h, BLACK, `${PL}: its low border of black limestone (B); the course's height and width C`);
    box(g, pl.u, 0, pl.half, pl.half, P.border.h, P.border.h + pl.h, WHITE, `${PL}: ${label}; white limestone (B); the plain top and the joints not modelled (C)`);
  }
  // the stair against the S face of the S plinth: a monolithic flight of eight steps (Q-420: eight or nine), rise and tread
  // C; in the S plinth's group (one base for the plinth and its stair)
  const S = P.stair, south = P.kingP.u - P.kingP.half, run0 = S.steps * S.tread, top = P.kingP.u + P.kingP.half + P.border.out, bot = south - run0;
  groups.set('precinct_king', [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => precinctAt((top + bot) / 2 + a * ((top - bot) / 2 + 0.2), b * (P.kingP.half + P.border.out + 0.2))));
  for (let k = 0; k < S.steps; k++) { const run = (S.steps - k) * S.tread; // step k (from the bottom) runs from the face out to its own front
    box('precinct_king', south - run / 2, 0, run / 2, S.half, k === 0 ? -0.3 : P.border.h + k * S.rise - 0.02, P.border.h + (k + 1) * S.rise, WHITE, `${PL}: the stair, one monolithic flight (eight steps: one extract says nine, Q-420; B); rise ${S.rise} m and tread ${S.tread} m C`); }
  // the altar: a three-stepped foot (the lowest set 0.25 m into the ground), the shaft, a three-stepped top
  const A = P.altar, g = 'precinct_altar'; sq(g, A.u, A.e, 0.7); let y = 0;
  const step = (half: number, h: number, what: string) => { box(g, A.u, A.e, half, half, y === 0 ? -0.25 : y, y + h, ALTAR_STONE, `${AL}: ${what}`, 'precinct_altar'); y += h; };
  for (const [hh, h] of A.foot) step(hh, h, 'a step of the foot'); step(A.shaft[0], A.shaft[1], 'the square shaft'); for (const [hh, h] of A.top) step(hh, h, 'a step of the top, the fire kept on it');
  props.push({ shape: 'cyl', mat: 'stone', c: precinctAt(A.u, A.e), theta: th, hu: 0.34, hv: 0.34, y0: y - 0.01, y1: y + 0.04, group: g, collide: false, row: 'precinct_altar', feature, colour: [0.16, 0.15, 0.14],
    note: 'the embers and ash of the kept fire on the altar\'s top (C: the fire fed by the magi at dawn and at dusk; Herodotus 3.16 "the Persians hold fire to be a god", read, FT: B claim)' });
  // the wood for the fire, stacked by the altar (C: brushwood and split wood, the fuel of the plain)
  const wg = 'precinct_wood'; sq(wg, 2.6, A.e + 1.4, 1.2);
  for (let k = 0; k < 5; k++) props.push({ shape: 'box', mat: 'timber', c: precinctAt(2.6 - 0.35 + (k % 3) * 0.35, A.e + 1.4), theta: th + 0.04 * (k - 2), hu: 0.12, hv: 0.8, y0: k > 2 ? 0.24 : 0, y1: k > 2 ? 0.46 : 0.24, group: wg, collide: false, row: 'precinct_altar', feature,
    note: 'wood for the kept fire, stacked by the altar (C)' });
}
/** the ash of the kept fire, raked out and heaped east of the altar (C) */
export function precinctMiddens(middens: Midden[]) {
  middens.push({ c: precinctAt(-2.5, PRECINCT.altar.e + 3.5), r: 1.3, h: 0.25, kind: 'ash', row: 'precinct_altar', feature: 'sacred_precinct' });
}
/** the graves of the burial ground: low earth mounds in loose rows, older ones lower (C) */
export function burialGraves(middens: Midden[], props: Prop[]) {
  const rng = new Rng(467, 'burial-ground'), [hx, hy] = BURIAL.half, cols = Math.floor((2 * hx) / 3.6), rows = Math.floor((2 * hy) / 3.2), spots: P2[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) spots.push([BURIAL.c[0] - hx + 1.8 + i * 3.6 + rng.range(-0.6, 0.6), BURIAL.c[1] - hy + 1.6 + j * 3.2 + rng.range(-0.5, 0.5)]);
  for (let k = spots.length - 1; k > 0; k--) { const m = rng.int(0, k); [spots[k], spots[m]] = [spots[m], spots[k]]; }
  for (const c of spots.slice(0, BURIAL.graves)) {
    const age = rng.next(); middens.push({ c, r: rng.range(0.85, 1.15), h: 0.42 - 0.26 * age, kind: 'grave', row: 'burial_graves', feature: 'burial_ground_town' });
    if (rng.chance(0.4)) { const th = rng.range(0, Math.PI); for (let s = 0; s < 3; s++) { const a = th + s * 2.1, q: P2 = [c[0] + Math.cos(a) * 0.95, c[1] + Math.sin(a) * 0.95];
      props.push({ shape: 'box', mat: 'stone', c: q, theta: a, hu: rng.range(0.12, 0.22), hv: rng.range(0.1, 0.16), y0: -0.1, y1: rng.range(0.1, 0.22), group: `grave_stone`, collide: false, row: 'burial_graves', feature: 'burial_ground_town', colour: [0.55, 0.52, 0.47],
        note: 'field stones laid round a grave mound (C)' }); } }
  }
}
/** the kept fire on the altar: where it burns (grid) and the group whose base its height is measured from */
export const PRECINCT_FIRE = { c: precinctAt(PRECINCT.altar.u, PRECINCT.altar.e), group: 'precinct_altar', y: ALTAR_H + 0.03,
  note: 'the kept fire on the stepped altar of the open-air precinct (D-209): fed by the magi at dawn and at dusk, burning day and night (C; fire honoured: Herodotus 3.16, read, B claim; no temple: Herodotus 1.131)' };
export type { Frame };
