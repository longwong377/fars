// Activity registry (brief §9.5 "every activity is performed"). Every activity the simulation can assign has a visible
// performance: an animation, the tools/props in hand, a place-side object where relevant, and a sound. The activity
// lint (tests/people.test.ts) fails the build when the simulation uses an activity missing here, an activity maps to a
// pose that does not exist, or a performance is flagged as a placeholder.
import type { AnimId } from './anim';

export type ActivityId =
  | 'walk' | 'carry_sack' | 'carry_jar' | 'carry_jar_head' | 'carry_bread'
  | 'stand_guard' | 'patrol' | 'dress_stone' | 'grind' | 'knead' | 'bake' | 'draw_water'
  | 'write_tablet' | 'eat' | 'sleep' | 'talk' | 'rest' | 'gamble' | 'inspect' | 'shelter' | 'play' | 'offmap';

export interface Performance {
  anim: AnimId; moving?: boolean;
  /** prop in hand / on body while performing */
  prop?: 'spear' | 'sack' | 'jar' | 'jar_head' | 'tablet' | 'mallet' | 'basket' | 'bread';
  /** sound the soundscape plays at the performer (none = silent activity) */
  sound?: 'chisel' | 'quern' | 'fire' | 'murmur' | 'footsteps' | 'dice' | 'water';
  tier: 'B' | 'C'; note: string; placeholder?: boolean;
}

export const ACTIVITIES: Record<ActivityId, Performance> = {
  walk: { anim: 'walk', moving: true, sound: 'footsteps', tier: 'C', note: 'walking' },
  carry_sack: { anim: 'carry_shoulder', moving: true, prop: 'sack', sound: 'footsteps', tier: 'B', note: 'sack on the shoulder (porters on the tribute reliefs carry skins and bags: B)' },
  carry_jar: { anim: 'carry_shoulder', moving: true, prop: 'jar', sound: 'footsteps', tier: 'B', note: 'jar on the shoulder (tribute reliefs: B)' },
  carry_jar_head: { anim: 'carry_head', moving: true, prop: 'jar_head', sound: 'footsteps', tier: 'C', note: 'water jar carried on the head (C)' },
  carry_bread: { anim: 'carry_front', moving: true, prop: 'basket', sound: 'footsteps', tier: 'C', note: 'basket of bread for the gang’s meal (C)' },
  stand_guard: { anim: 'guard', prop: 'spear', tier: 'B', note: 'spear upright, butt on the ground (guard files on the reliefs: B)' },
  patrol: { anim: 'guard_walk', moving: true, prop: 'spear', sound: 'footsteps', tier: 'C', note: 'guard walking a round (C)' },
  dress_stone: { anim: 'chisel', prop: 'mallet', sound: 'chisel', tier: 'B', note: 'dressing a block with mallet and chisel (tool marks on the stone: B)' },
  grind: { anim: 'grind', sound: 'quern', tier: 'B', note: 'kneeling at a saddle quern (saddle querns are the period type: B)' },
  knead: { anim: 'knead', tier: 'C', note: 'kneading dough in a trough (C)' },
  bake: { anim: 'bake', sound: 'fire', tier: 'C', note: 'slapping flat loaves into the oven (C)' },
  draw_water: { anim: 'draw_water', prop: 'jar', sound: 'water', tier: 'C', note: 'filling a jar at the water point (C)' },
  write_tablet: { anim: 'write', prop: 'tablet', tier: 'B', note: 'writing on a clay tablet with a stylus (PF/PT tablets: A; posture C)' },
  eat: { anim: 'eat', sound: 'murmur', tier: 'C', note: 'sitting and eating bread (rations: B)' },
  sleep: { anim: 'sleep', tier: 'C', note: 'lying asleep on a mat (C)' },
  talk: { anim: 'talk', sound: 'murmur', tier: 'C', note: 'talking with gestures' },
  rest: { anim: 'sit', tier: 'C', note: 'sitting and resting' },
  gamble: { anim: 'dice', sound: 'dice', tier: 'C', note: 'throwing knucklebones (astragali are common finds of the period: B object, C scene)' },
  inspect: { anim: 'inspect', tier: 'C', note: 'official looking over work, hands clasped (C)' },
  shelter: { anim: 'idle', tier: 'C', note: 'waiting out rain under a roof' },
  play: { anim: 'play', tier: 'C', note: 'children playing (C)' },
  offmap: { anim: 'idle', tier: 'C', note: 'in the town (not rendered until the settlement exists, Phase 6)' },
};
