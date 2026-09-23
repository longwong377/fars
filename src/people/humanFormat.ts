// Shared definitions for the human assets (D-016): the skeleton every body is skinned to, the per-vertex part and
// material ids, and the file layout written by tools/build_humans.ts and read by src/people/humans.ts.
// The skeleton is MakeHuman's "game engine" rig (CC0, MPFB2 rig.game_engine.json) without its ground bone, plus seven
// face bones taken from MakeHuman's default rig (jaw, eyes, eyelids) so faces can talk, blink and look. Bones have
// identity orientation in the bind pose (world axes), so a local rotation is expressed in parent-aligned world axes:
// the body faces +Z, its left side is +X, Y is up (same conventions as src/people/anim.ts).

export const HBONES = [
  'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head', 'jaw', 'eye_l', 'eye_r', 'lid_ul', 'lid_ll', 'lid_ur', 'lid_lr',
  'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l',
  'thumb_01_l', 'thumb_02_l', 'thumb_03_l', 'index_01_l', 'index_02_l', 'index_03_l', 'middle_01_l', 'middle_02_l', 'middle_03_l',
  'ring_01_l', 'ring_02_l', 'ring_03_l', 'pinky_01_l', 'pinky_02_l', 'pinky_03_l',
  'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r',
  'thumb_01_r', 'thumb_02_r', 'thumb_03_r', 'index_01_r', 'index_02_r', 'index_03_r', 'middle_01_r', 'middle_02_r', 'middle_03_r',
  'ring_01_r', 'ring_02_r', 'ring_03_r', 'pinky_01_r', 'pinky_02_r', 'pinky_03_r',
  'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r',
] as const;
export type HBone = typeof HBONES[number];
export const HB = Object.fromEntries(HBONES.map((b, i) => [b, i])) as Record<HBone, number>;
/** parent of each bone (null = root) */
export const HPARENT: Record<HBone, HBone | null> = (() => {
  const p: Partial<Record<HBone, HBone | null>> = { pelvis: null, spine_01: 'pelvis', spine_02: 'spine_01', spine_03: 'spine_02', neck_01: 'spine_03', head: 'neck_01',
    jaw: 'head', eye_l: 'head', eye_r: 'head', lid_ul: 'head', lid_ll: 'head', lid_ur: 'head', lid_lr: 'head',
    thigh_l: 'pelvis', calf_l: 'thigh_l', foot_l: 'calf_l', ball_l: 'foot_l', thigh_r: 'pelvis', calf_r: 'thigh_r', foot_r: 'calf_r', ball_r: 'foot_r' };
  for (const s of ['l', 'r'] as const) {
    p[`clavicle_${s}`] = 'spine_03'; p[`upperarm_${s}`] = `clavicle_${s}`; p[`lowerarm_${s}`] = `upperarm_${s}`; p[`hand_${s}`] = `lowerarm_${s}`;
    for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) { p[`${f}_01_${s}` as HBone] = `hand_${s}`; p[`${f}_02_${s}` as HBone] = `${f}_01_${s}` as HBone; p[`${f}_03_${s}` as HBone] = `${f}_02_${s}` as HBone; }
  }
  return p as Record<HBone, HBone | null>;
})();
export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;

/** body segment of a vertex (dominant bone group); garments and hair are defined on these */
export const PART = { head: 0, neck: 1, chest: 2, belly: 3, pelvis: 4, uarm_l: 5, farm_l: 6, hand_l: 7, uarm_r: 8, farm_r: 9, hand_r: 10,
  thigh_l: 11, calf_l: 12, foot_l: 13, thigh_r: 14, calf_r: 15, foot_r: 16, eye: 17, teeth: 18, tongue: 19, lash: 20 } as const;
export type PartId = typeof PART[keyof typeof PART];

/** shading class of a vertex (the human material branches on it; stored ×1/255 in the `hmat` attribute's x) */
export const MAT = { skin: 0, cloth_main: 1, cloth_second: 2, cloth_trim: 3, eye: 4, hair: 5, teeth: 6, mouth: 7, leather: 8, felt: 9, metal: 10, lash: 11, wood: 12, wicker: 13 } as const;
export type MatId = typeof MAT[keyof typeof MAT];

export interface HumanVariantMeta {
  id: string; label: string; sex: 'm' | 'f'; ageYears: number; group: 'adult' | 'elder' | 'child';
  /** MakeHuman macro values used (0..1) and the population-morph blend, labelled neutrally (tier C) */
  macro: { gender: number; age: number; muscle: number; weight: number; height: number; proportions: number; blend: [number, number, number] };
  face: Record<string, number>;
  /** standing height of the morphed mesh (m), before the runtime stature scale */
  height: number;
  /** bind-pose bone head positions (m), HBONES order */
  joints: number[][];
  /** byte offset of this variant's Int16 positions (0.1 mm units) in humans.bin */
  posOffset: number;
  tier: 'C'; note: string;
}
export interface HumanAssetsMeta {
  version: number; generated: string; units: 'm'; posScale: number;
  source: { name: string; url: string; licence: string; credit: string }[];
  bones: string[]; parents: number[];
  vertexCount: number; bodyVertexCount: number;
  /** byte offsets / counts in humans.bin */
  layout: Record<string, { offset: number; count: number; type: 'u8' | 'u16' | 'u32' | 'i16' | 'f32'; itemSize: number }>;
  /** index ranges: LOD triangle lists over the shared vertex set (body + eyes + mouth + lashes) */
  lods: { name: string; indexKey: string; triangles: number }[];
  /** named vertex indices (reference topology) for fitting garments, hair and hats */
  landmarks: Record<string, number>;
  /** finger curl axes per finger bone in the bind pose (unit vectors, HBONES index → axis) */
  curlAxes: Record<string, number[]>;
  variants: HumanVariantMeta[];
  textures: Record<string, { file: string; width: number; height: number; note: string }>;
}
