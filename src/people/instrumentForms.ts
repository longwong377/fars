// The forms of the instruments people are seen playing (D-200): numbers only, shared by the geometry (props.ts) and the
// playing cycles (workAnims.ts), so a hand plucks where a string is. Every instrument is authored in its own frame: +Z its
// main axis (the vertical harp's string rod, the horizontal harp's soundbox, the lyre's arms, the pipes from the mouth,
// the frame drum's struck face), +Y its up or face reference, +X = Y × Z (props.ts `frame`). Metres.
//
// Evidence (research/SOUNDSCAPE.md §8; everything about size and build is C):
//  - vertical angular harp (M-19, M-20): seven are played by the Elamite royal orchestra at Madaktu (Ashurbanipal's relief,
//    Nineveh SW Palace room XXXIII, BM 124802, 653 BCE; Alvarez-Mon 2017 via search extracts: B for the type in Elam). The
//    soundbox is upright against the player or leaning forward, the strings roughly vertical, the string rod projecting
//    forward at its foot; 15-25 strings, usually 21; the harp reaches from the player's navel to about a head's length above
//    the head (search extracts of harp-history summaries; NOT SEEN: no image of the relief could be opened, B6);
//  - horizontal angular harp (M-19, M-21): one at Madaktu; the Assyrian horizontal harp has 7-9 strings, is held with the
//    soundbox level under the left arm and is struck with a plectrum (Cheng 2012 via search extracts). Its string arm's form
//    here (a plain rising arm, the strings fanned from the soundbox to it) is C; the Assyrian forearm finial is not given to
//    an Elamite or Persian harp;
//  - lyre: the 'round-bodied lyre' of the instrument list (SOUND-R extract, source not seen): body, arms and yoke C;
//  - frame drum (M-19): 'a drum' at Madaktu; a hand-held frame drum is the Mesopotamian standard (SOUND-R): C;
//  - double pipe (M-19): two at Madaktu (B type); cane pipes diverging from the mouth, C;
//  - the herder's single reed pipe (M-10, M-18): a cane pipe with an idioglot reed (C: the pastoral pipe is attested for
//    Greek herdsmen, Iliad 18.525-526, and by a maker's site for Mesopotamia; the form is not attested for Fars).
export type V3 = [number, number, number];

/** vertical angular harp: the rod along +Z at the soundbox's foot (the origin), the soundbox rising along +Y and leaning
 *  toward +Z by `lean`; 21 strings rise vertically from the rod to the soundbox's front face */
export const HARP_V = { lean: 0.26, boxLen: 0.95, boxW: 0.085, boxD: 0.11, rodR: 0.018, rodBack: 0.05, rodLen: 0.5, strings: 21, z0: 0.085, z1: 0.285 };
/** string i of the vertical harp: its foot on the rod and its head at the soundbox (local frame) */
export function harpVString(i: number): { foot: V3; head: V3 } {
  const H = HARP_V, z = H.z0 + (H.z1 - H.z0) * i / (H.strings - 1), c = Math.cos(H.lean), s = Math.sin(H.lean), hd = H.boxD / 2;
  const sAlong = (z - hd * c) / s; // along the soundbox's axis to its front face above this string
  return { foot: [0, H.rodR, z], head: [0, sAlong * c - hd * s, z] };
}
/** horizontal angular harp: the soundbox along +Z from the origin (its rear end under the left arm), the string arm rising
 *  from its front end; 9 strings fanned from the soundbox's top to the arm */
export const HARP_H = { boxLen: 0.72, boxW: 0.085, boxH: 0.1, armFoot: [0, 0.05, 0.68] as V3, armTop: [0, 0.4, 0.6] as V3, armR: 0.016, strings: 9 };
export function harpHString(i: number): { foot: V3; head: V3 } {
  const H = HARP_H, n = H.strings - 1, z = 0.24 + 0.045 * i, f = 0.95 - 0.8 * i / n; // near the player: the longest string
  const a = H.armFoot, b = H.armTop;
  return { foot: [0, H.boxH / 2, z], head: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f] };
}
/** lyre: the origin at the foot of the round soundbox, +Z up the arms, +Y out of the face (the strings' side) */
export const LYRE = { r: 0.15, thick: 0.07, arm: [[0.1, 0.24], [0.13, 0.54]] as [number, number][], yokeZ: 0.54, strings: 9, bridgeZ: 0.1, face: 0.045, span: 0.06 };
export function lyreString(i: number): { foot: V3; head: V3 } {
  const L = LYRE, x = -L.span + 2 * L.span * i / (L.strings - 1);
  return { foot: [x, L.face, L.bridgeZ], head: [x * 1.25, L.face, L.yokeZ - 0.02] };
}
/** frame drum: the origin at the membrane's centre, +Z out of the struck face */
export const FRAME_DRUM = { r: 0.18, depth: 0.06 };
/** pipes: the origin at the lips, +Z along the pipe(s). Double pipe: two canes diverging by ±`splay` (rad) */
export const DOUBLE_PIPE = { len: 0.34, r: 0.008, splay: 0.42 };
export const REED_PIPE = { len: 0.3, r: 0.0085, holes: 5, hole0: 0.13, holeStep: 0.028 };
/** where the lips hold a pipe, from the head bone in the head's frame (m; measured on the reference body m03: lips' front
 *  at 0.168 m forward, 1.530 m up; the head bone at 0.046, 1.538; tests/instruments.test.ts checks it on three bodies) */
export const MOUTH: V3 = [0, -0.022, 0.118];
