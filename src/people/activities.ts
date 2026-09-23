// Activity registry (brief §9.5 "every activity is performed"). Every activity the simulation can assign has a visible
// performance: an animation, the tools/props in hand, a place-side object where relevant, and a sound. The activity
// lint (tests/people.test.ts) fails the build when the detailed (rendered) simulation uses an activity missing here, an
// activity maps to a pose that does not exist, or a performance is flagged as a placeholder.
//
// PLACEHOLDERS (Phase 5, D-021): the abstract population (the town and the plain, and the part of the Terrace workforce
// that is not yet materialised as full agents) does work that no animation here can perform: ploughing, reaping,
// herding, weaving, brewing, hauling drums, laying brick, polishing metal, the magi's offerings. Those activities are
// registered below with `placeholder: true, abstractOnly: true`: they are simulated (they have a place, hours and
// consequences) but there is NO performance for them yet. The lint enforces that no rendered agent ever does one, and
// tests list them by name so a new one cannot slip in. They must get real performances before the town (Phase 6) and
// the plain (Phase 7) are rendered.
import type { AnimId } from './anim';

export type ActivityId =
  | 'walk' | 'carry_sack' | 'carry_jar' | 'carry_jar_head' | 'carry_bread'
  | 'stand_guard' | 'patrol' | 'dress_stone' | 'grind' | 'knead' | 'bake' | 'draw_water'
  | 'write_tablet' | 'eat' | 'sleep' | 'talk' | 'rest' | 'gamble' | 'inspect' | 'shelter' | 'play' | 'offmap'
  | 'queue' | 'exchange' | 'lie_ill'
  // abstract-tier only, no performance yet (placeholders)
  | 'haul' | 'mould_brick' | 'lay_brick' | 'polish_metal' | 'work_wood' | 'weave' | 'brew' | 'tend_animals' | 'herd' | 'shear' | 'slaughter'
  | 'offer' | 'clean' | 'garden_work' | 'field_work' | 'irrigate' | 'plough' | 'reap' | 'thresh' | 'dig_canal' | 'pick_fruit' | 'craft' | 'carry_bier' | 'wash' | 'train';

export interface Performance {
  anim: AnimId; moving?: boolean;
  /** prop in hand / on body while performing */
  prop?: 'spear' | 'sack' | 'jar' | 'jar_head' | 'tablet' | 'mallet' | 'basket' | 'bread';
  /** sound the soundscape plays at the performer (none = silent activity) */
  sound?: 'chisel' | 'quern' | 'fire' | 'murmur' | 'footsteps' | 'dice' | 'water';
  tier: 'B' | 'C'; note: string; placeholder?: boolean;
  /** simulated only in the abstract tier (never by a rendered agent); every one of these is also a placeholder */
  abstractOnly?: boolean;
}

const PH = (note: string): Performance => ({ anim: 'idle', tier: 'C', note: `PLACEHOLDER, NO PERFORMANCE: ${note}`, placeholder: true, abstractOnly: true });

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
  // Phase 5 (D-021): performed with existing poses
  queue: { anim: 'idle', tier: 'C', note: 'standing in the queue at a ration issue (E-01: the group queues and receives its grain; standing C)' },
  exchange: { anim: 'talk', prop: 'basket', sound: 'murmur', tier: 'C', note: 'exchanging goods in kind with a basket in hand (no coins: blocklist coins-everyday; C)' },
  lie_ill: { anim: 'sleep', tier: 'C', note: 'lying ill on a mat at home (E-72 sickness; C)' },
  // abstract tier only: simulated, NOT performed (see the header)
  haul: PH('hauling column drums up an earth ramp and carrying earth (builders of the labour gang; no hauling pose)'),
  mould_brick: PH('moulding mud brick in wooden frames by the water (E-63)'),
  lay_brick: PH('laying mud brick on the walls of the Hall of a Hundred Columns'),
  polish_metal: PH('gold-and-silver shiners of the treasury (LIVIUS-TREAS, B)'),
  work_wood: PH('handlers of wood and carpentry supplies in the treasury workshops (HENK2023, B)'),
  weave: PH('textile work: spinning and weaving in the women’s work groups (C)'),
  brew: PH('brewing beer from tarmu (PF 40: "he made beer", A)'),
  tend_animals: PH('feeding and watering horses, donkeys, the household’s ox and sheep'),
  herd: PH('grazing a flock; shepherds and village boys'),
  shear: PH('shearing sheep in the folds (E-47, season C)'),
  slaughter: PH('slaughter of small cattle at the stockyard (PF 58-60, A); shown, if ever, as evidence and without spectacle'),
  offer: PH('the lan and other offerings of the magi (HENK2008, B): the performance is NOT attested; no invented liturgy (HDT 1.132 is a Greek claim)'),
  clean: PH('cleaning the closed palaces'),
  garden_work: PH('working garden and orchard beds'),
  field_work: PH('hoeing, weeding and minding a field'),
  irrigate: PH('opening and closing a channel on the household’s turn of water'),
  plough: PH('ploughing with draught animals and sowing (E-40, E-44)'),
  reap: PH('reaping barley and wheat with sickles; binding sheaves (E-41, E-42)'),
  thresh: PH('threshing and winnowing on the village floor (E-43)'),
  dig_canal: PH('clearing canals and channels (E-50)'),
  pick_fruit: PH('the vintage and the fig and fruit harvest (E-45, E-46)'),
  craft: PH('kiln firing, pigment making and bone working in the Persepolis West craft zone (PW2017, B)'),
  carry_bier: PH('carrying the dead out of the settlement (E-71; HDT 1.140). Exposure is never shown'),
  wash: PH('washing and dyeing wool and cloth at the water (C)'),
  train: PH('Persian boys learning to ride and to shoot with the bow (HDT 1.136, a Greek claim: B)'),
};
/** the abstract-only placeholders, by name (tests pin this list) */
export const ABSTRACT_PLACEHOLDERS = (Object.keys(ACTIVITIES) as ActivityId[]).filter(k => ACTIVITIES[k].abstractOnly);
