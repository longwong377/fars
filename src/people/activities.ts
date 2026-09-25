// Activity registry (brief §9.5 "every activity is performed"). Every activity the simulation can assign has a visible
// performance: an animation, the tools/props in hand, a place-side object where relevant, animals where the work needs
// them, and a sound. The activity lint (tests/people.test.ts, tests/performances.test.ts) fails the build when an
// activity the simulation can emit is missing here, maps to a pose that does not exist, names a prop, work object or
// animal that does not exist, or is flagged as a placeholder: there are NO placeholders (D-142 gave the 28 activities
// that had none, the abstract population's work, a performance each).
//
// A performance can have variants chosen by the plan's reason (`why`, population.ts) or the person's seed: 'threshing:
// driving the animals round' is performed by the driver at the post with the animals circling, 'winnowing' with the fork.
// `performanceFor(act, why, seed)` resolves them; the crowd (crowd.ts) uses it for every rendered person.
// Tiers: B where the activity and the thing shown are attested or directly evidenced, C for reconstructed forms and
// motions (all the motions are C). Notes say what is and is not attested; the dev overlay (F3) prints them.
import type { AnimId } from './anim';
import type { WorkKind } from './workObjects';
import type { Species } from './animals';

export type ActivityId =
  | 'walk' | 'carry_sack' | 'carry_jar' | 'carry_jar_head' | 'carry_bread'
  | 'stand_guard' | 'patrol' | 'dress_stone' | 'grind' | 'knead' | 'bake' | 'draw_water'
  | 'write_tablet' | 'eat' | 'sleep' | 'talk' | 'rest' | 'gamble' | 'inspect' | 'shelter' | 'play' | 'offmap'
  | 'queue' | 'exchange' | 'lie_ill'
  // the abstract population's work (performed since D-142)
  | 'haul' | 'mould_brick' | 'lay_brick' | 'polish_metal' | 'work_wood' | 'weave' | 'spin' | 'gather' | 'brew' | 'tend_animals' | 'herd' | 'shear' | 'slaughter'
  | 'offer' | 'clean' | 'garden_work' | 'field_work' | 'irrigate' | 'plough' | 'reap' | 'thresh' | 'dig_canal' | 'pick_fruit' | 'craft' | 'carry_bier' | 'wash' | 'train' | 'cook'
  // the king and his attendants (court setting only, D-199)
  | 'royal_walk' | 'enthroned' | 'bear_parasol' | 'attend_parasol' | 'bear_whisk' | 'attend_whisk'
  // the magi's fire, the households' sacrifices and the funerals (D-209)
  | 'tend_fire' | 'chant' | 'sacrifice' | 'cut_offering' | 'bury' | 'mourn';

/** props an activity can put in the hands (props.ts PROPS) */
export type PropKind = 'spear' | 'sack' | 'jar' | 'jar_head' | 'tablet' | 'mallet' | 'basket' | 'bread'
  | 'hoe' | 'sickle' | 'fork' | 'goad' | 'staff' | 'broom' | 'spindle' | 'distaff' | 'trowel' | 'mould' | 'brick' | 'brick_l' | 'rope' | 'adze' | 'bow' | 'arrow'
  | 'knife' | 'beater' | 'paddle' | 'cloth' | 'wisp' | 'bowl' | 'rag' | 'awl' | 'ladle' | 'stick' | 'lead' | 'jar_both' | 'sack_both' | 'basket_hip' | 'basket_both' | 'basket_lap'
  // instruments (D-200: played only in a playing performance, playing.ts)
  | 'harp_v' | 'harp_h' | 'plectrum' | 'lyre' | 'frame_drum' | 'double_pipe' | 'reed_pipe'
  | 'sceptre' | 'lotus' | 'parasol' | 'whisk' | 'towel'
  // D-215: the gilded spear butts (court) and children's toys
  | 'spear_apple' | 'spear_gpom' | 'ball' | 'toy_bow' | 'rattle'
  // D-209: the magus's barsom
  | 'barsom';
/** sounds a performance makes (soundscape.ts strike kinds; 'murmur' and 'footsteps' are layers, 'fire' the fire's own) */
export type SoundKind = 'chisel' | 'quern' | 'fire' | 'murmur' | 'footsteps' | 'dice' | 'water' | 'hoe' | 'sickle' | 'loom' | 'trowel' | 'adze' | 'mould' | 'wash' | 'broom' | 'bow' | 'bleat';
/** a thing at the place (workObjects.ts), in the performer's frame (m: right −x / left +x, ahead +z; yaw rad). `follow`:
 *  moves with the performer's own path (the ard behind the team); `shared`: one for everyone doing it at the same place
 *  (the threshing floor, the drum on its sledge) or in the same group (the bier) */
export interface WorkSpec { kind: WorkKind; at: [number, number, number]; follow?: boolean; shared?: 'place' | 'group' }
/** animals the work needs (animals.ts): a flock grazing about the herder, the yoked pair ahead of the ploughman, the
 *  animals treading the threshing floor, one standing to be groomed, a sheep lying to be shorn, stock tethered by the
 *  butcher, a sheep on a lead */
export interface AnimalSpec { kind: 'flock' | 'team' | 'circle' | 'beside' | 'lying' | 'tethered' | 'lead' | 'string' | 'mount' | 'draught'; species: Species[]; n?: number;
  /** D-210: a flock's dogs; a string's, a mount's or a draught pair's walking pace (m/s; 0 standing), the lead rope between
   *  the animals of a string (m), the first animal's distance behind the driver (m) and its side offset (m) */
  dogs?: number; pace?: number; gap?: number; lead?: number; side?: number }

export interface Performance {
  anim: AnimId; moving?: boolean;
  /** props in hand / on body while performing (prop2: the other hand's thing, or a second tool used in turn) */
  prop?: PropKind; prop2?: PropKind;
  /** sound the soundscape plays at the performer (none = a silent activity) */
  sound?: SoundKind;
  work?: WorkSpec[]; animals?: AnimalSpec;
  tier: 'B' | 'C'; note: string; placeholder?: boolean;
  /** D-209: pieces of the performer's dress put on while performing (outfits.ts PIECES ids: the magus's mouth-cover at the
   *  fire and the offerings); a dress without the piece shows nothing */
  wear?: string[];
  /** simulated only in the abstract tier (never by a rendered agent); every one of these is also a placeholder */
  abstractOnly?: boolean;
  /** alternatives: the first whose `when` matches the plan's reason (a RegExp) or, for a number, a share of people (by
   *  seed) is performed instead; unset fields are taken from the base performance */
  variants?: (Partial<Performance> & { when: RegExp | number; note: string;
    /** D-215: only for a performer of this sex or age range (years, inclusive); a variant that does not fit is passed over
     *  (its share falls to the base). Without a performer given (extras, the lint) every variant fits */
    sex?: 'm' | 'f'; ages?: [number, number] })[];
}
/** who performs (D-215: a variant may be only for boys, or only for small children) */
export interface Performer { sex: 'm' | 'f'; age: number }

const SHEEP: Species[] = ['sheep', 'sheep', 'goat'];
export const ACTIVITIES: Record<ActivityId, Performance> = {
  walk: { anim: 'walk', moving: true, sound: 'footsteps', tier: 'C', note: 'walking',
    // D-210 (gap audit item 6): the animals that travel with the people who lead them (world/traffic.ts, the court's parties)
    variants: [
      // D-209: a man of the town leading the beast for his sacrifice to the precinct (Herodotus 1.132: B claim; C)
      { when: /leading a sheep/, animals: { kind: 'string', species: ['sheep'], n: 1, pace: 1.0 }, note: 'leading a sheep on a rope to the precinct for a sacrifice (Herodotus 1.132, a Greek claim: B; C)' },
      { when: /leading a goat/, animals: { kind: 'string', species: ['goat'], n: 1, pace: 1.0 }, note: 'leading a goat on a rope to the precinct for a sacrifice (C)' },
      { when: /string of pack|pack train/, animals: { kind: 'string', species: ['donkey_pack', 'donkey_pack', 'mule_pack', 'donkey_pack', 'donkey_pack'], n: 5, pace: 1.0 },
        note: 'a driver leading a string of five pack animals nose to tail, donkeys and a mule with panniers and sacks (pack donkeys: POTTS2023, B; mules: population.json, C; strings of five, the loads and the pace C)' },
      { when: /unloaded string/, animals: { kind: 'string', species: ['donkey', 'donkey', 'mule', 'donkey', 'donkey'], n: 5, pace: 1.0 }, note: 'a driver leading his string back unladen (C)' },
      { when: /string of Bactrian camels/, animals: { kind: 'string', species: ['camel_pack'], n: 4, pace: 1.0, gap: 1.2, lead: 1.4 },
        note: 'a camel driver leading four Bactrian camels roped nose to tail, sacks slung each side (camels: the Apadana reliefs, B imagery; population.json camel 0-20 “caravans from outside Fars”, C; the string C)' },
      { when: /unladen camels/, animals: { kind: 'string', species: ['camel'], n: 4, pace: 1.0, gap: 1.2, lead: 1.4 }, note: 'a camel driver leading his string back unladen (C)' },
      { when: /courier riding/, anim: 'ride', sound: undefined, animals: { kind: 'mount', species: ['horse_saddle'], pace: 1.8 },
        note: 'a royal courier riding a relay horse at a walk into or out of the road station (the relay: HDT 8.98, a claim, B; horse rations POTTS2023, B; riding HDT 1.136, B); a saddle cloth, no stirrups (blocklist); walking the horse near the station and its pace C' },
      { when: /ox cart/, animals: { kind: 'draught', species: ['ox', 'ox'], pace: 0.9 }, work: [{ kind: 'cart', at: [0, 0, -4.7] }],
        note: 'a carter walking ahead of his yoked oxen and their cart of grain sacks on the road (carts silent at Persepolis, Assyrian reliefs B analogy; draught cattle Q-193; C)' }] },
  carry_sack: { anim: 'carry_shoulder', moving: true, prop: 'sack', sound: 'footsteps', tier: 'B', note: 'sack on the shoulder (porters on the tribute reliefs carry skins and bags: B)',
    variants: [{ when: /loading the donkeys|unloading the donkeys|pitching the tents|loading the animals|unloading the party/, animals: { kind: 'beside', species: ['donkey_pack'] },
      note: 'loading or unloading the pack donkeys by the tents, a loaded donkey standing by (E-49 “herders, dogs and donkeys”; C)' }] },
  carry_jar: { anim: 'carry_shoulder', moving: true, prop: 'jar', sound: 'footsteps', tier: 'B', note: 'jar on the shoulder (tribute reliefs: B)' },
  carry_jar_head: { anim: 'carry_head', moving: true, prop: 'jar_head', sound: 'footsteps', tier: 'C', note: 'water jar carried on the head (C)' },
  carry_bread: { anim: 'carry_front', moving: true, prop: 'basket', sound: 'footsteps', tier: 'C', note: 'basket of bread for the gang’s meal (C)',
    variants: [{ when: /meat of the offering/, note: 'carrying the boiled meat of a sacrifice home in a basket (Herodotus 1.132 "the sacrificer carries away the flesh and uses it as he pleases", read, a Greek claim: B; C: D-209)' }] },
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
  shelter: { anim: 'idle', tier: 'C', note: 'waiting out rain under a roof (the Gate’s, a hut’s); in the open only a passing shower, the cloak drawn over the head: a longer rain sends people home (S1 of shadow review r5)' },
  play: { anim: 'play', tier: 'C', note: 'children playing: hopping and skipping about (C)',
    // D-215 (gap audit item 26; D-207): the kinds of play, by share and age (all C: no Persepolis evidence either way)
    variants: [
      // D-211: the games the plan names come first, drawn with D-215's pieces where one exists
      { when: /knucklebones/, anim: 'dice', sound: 'dice', work: [{ kind: 'knucklebones', at: [0, 0, 0.38] }], note: 'knucklebones on the ground of the lane (astragali are common finds of the period: B object; the game C)' },
      { when: /ball/, anim: 'ball', prop: 'ball', note: 'playing ball (a ball of leather or rag: C)' },
      { when: /\btop\b/, note: 'a whipped top (tops are known in the Greek and Egyptian worlds: C here). No top drawn' },
      { when: /clay animal on wheels/, anim: 'pull_toy', work: [{ kind: 'toy_wheeled', at: [0.12, 0, -0.62], follow: true }], note: 'pulling a clay animal on wheels round by its cord (wheeled animal toys are known from Susa: C)' },
      { when: 0.2, anim: 'ball', prop: 'ball', ages: [3, 13], note: 'tossing a leather ball up and catching it (balls known from Egypt and the Greek world: RECOLLECTION, NOT SEEN; C)' },
      { when: 0.2, anim: 'chase', ages: [3, 12], note: 'running round after the other children (C)' },
      { when: 0.2, anim: 'dice', sound: 'dice', work: [{ kind: 'knucklebones', at: [0, 0, 0.38] }], ages: [4, 13], note: 'knucklebones in the dust, sitting on the ground: astragali thrown and gathered (astragali are common finds: B object; the children’s game C)' },
      { when: 0.15, anim: 'pull_toy', work: [{ kind: 'toy_wheeled', at: [0.12, 0, -0.62], follow: true }], ages: [1, 7], note: 'pulling a clay animal on wheels round by its cord (wheeled clay animals from Susa and Mesopotamia: RECOLLECTION, NOT SEEN; C)' },
      { when: 0.15, anim: 'archery', prop: 'toy_bow', prop2: 'arrow', sound: 'bow', sex: 'm', ages: [5, 12], note: 'a boy shooting a small bow at nothing much (boys taught to shoot: HDT 1.136, a Greek claim, B; the toy bow C)' },
      { when: 0.1, anim: 'rattle', prop: 'rattle', ages: [0, 3], note: 'a small child sitting on the ground shaking a clay rattle (clay rattles: RECOLLECTION, NOT SEEN; C)' }] },
  offmap: { anim: 'idle', tier: 'C', note: 'in the town (not rendered until the settlement exists, Phase 6)' },
  // Phase 5 (D-021): performed with existing poses
  queue: { anim: 'idle', tier: 'C', note: 'standing in the queue at a ration issue (E-01: the group queues and receives its grain; standing C)' },
  exchange: { anim: 'talk', prop: 'basket', sound: 'murmur', tier: 'C', note: 'exchanging goods in kind with a basket in hand (no coins: blocklist coins-everyday; C)',
    variants: [{ when: /from a tray/, anim: 'sit', prop: 'basket_lap', note: 'a woman selling her wares from a tray at her door in the lane, for barley or oil in kind (D-211; lanes as working space: analogy, C)' }] },
  lie_ill: { anim: 'sleep', tier: 'C', note: 'lying ill on a mat at home (E-72 sickness; C)' },
  // ============================================ the abstract population's work (D-142; every motion C)
  haul: { anim: 'haul', prop: 'rope', tier: 'C', work: [{ kind: 'drum_sledge', at: [0, 0, 6.2], shared: 'place' }],
    note: 'the labour gang hauling a column drum on a sledge with ropes, heaving in time (construction by ramp and sledge: C; the gangs are attested, PT-WAGE: B)',
    variants: [
      { when: /earth/, anim: 'pass', prop: 'basket_both', work: [], note: 'building up the earth ramp: baskets of earth passed along a chain of men (C)' },
      { when: /brick/, anim: 'pass', prop: 'brick', work: [{ kind: 'brick_stack', at: [-0.9, 0, 0.3] }], note: 'carrying dried bricks to the wall: passed hand to hand along a chain (C)' }] },
  mould_brick: { anim: 'mould', prop: 'mould', sound: 'mould', tier: 'C', work: [{ kind: 'mud_heap', at: [-0.62, 0, 0.36] }, { kind: 'brick_field', at: [1.35, 0, 0.1] }, { kind: 'jar', at: [-0.7, 0, -0.35] }],
    note: 'moulding mud brick by the water (E-63: brick-mould season B for Babylonia, C here): the wooden mould filled from the mud heap, smoothed by hand, lifted off the brick on the drying floor; the bricks dry in rows' },
  lay_brick: { anim: 'lay', prop: 'trowel', prop2: 'brick_l', sound: 'trowel', tier: 'C', work: [{ kind: 'brick_stack', at: [0.62, 0, 0.3] }, { kind: 'mortar_tub', at: [-0.55, 0, 0.32] }, { kind: 'brick_course', at: [0, 0, 0.62] }],
    note: 'laying mud brick in mud mortar on the walls of the Hall of a Hundred Columns: mortar from the tub spread with a trowel, bricks from the stack, tapped down (walls of mud brick: B; the work C)' },
  polish_metal: { anim: 'polish', prop: 'bowl', prop2: 'rag', tier: 'B', note: 'the gold-and-silver shiners of the Treasury (LIVIUS-TREAS: B): a silver phiale on the left hand rubbed with a rag, seated (posture C)' },
  work_wood: { anim: 'adze', prop: 'adze', sound: 'adze', tier: 'C', work: [{ kind: 'beam', at: [0, 0, 0.55] }],
    note: 'Treasury wood handlers (HENK2023: B): dressing a timber with an adze on two blocks (tool and work C)' },
  weave: { anim: 'weave', prop: 'beater', sound: 'loom', tier: 'C', work: [{ kind: 'loom', at: [0, 0, 0.44] }],
    note: 'weaving on a ground loom: the weft passed, the heddle rod lifted, the weft beaten in with the sword beater. Women weavers are attested (PF 0999 “rations for female weavers”, AZZONI2019: B); the loom type is not: the horizontal ground loom is chosen (D-142, Q-190; C)' },
  spin: { anim: 'spin', prop: 'distaff', prop2: 'spindle', tier: 'C',
    note: 'spinning wool with a drop spindle, standing: distaff in the left hand, the spindle turning on the yarn (spindle whorls are common finds: B object; scene C). Silent' },
  gather: { anim: 'gather', prop: 'basket_hip', tier: 'C', note: 'gathering dung and brushwood into a basket held on the hip (C)',
    variants: [{ when: /shaping|cakes/, anim: 'pat', prop: undefined, work: [{ kind: 'dung_cakes', at: [0.5, 0, 0.35] }], note: 'shaping dung cakes for the fire and setting them out to dry (C)' }] },
  brew: { anim: 'stir', prop: 'paddle', tier: 'C', work: [{ kind: 'vat', at: [0, 0, 0.72] }], note: 'brewing beer from tarmu (PF 40 “he made beer”: A for the work): stirring the mash in a vat with a paddle (C)' },
  tend_animals: { anim: 'groom', prop: 'wisp', tier: 'C', animals: { kind: 'beside', species: ['donkey'] }, work: [{ kind: 'fodder', at: [0.95, 0, 1.55] }],
    note: 'seeing to the household’s animals: rubbing down and feeding (donkeys and horses are attested with rations, POTTS2023: B; the work C)',
    variants: [
      // D-210 (gap audit item 6): a driver holding his string or his cart while the loads come off (world/traffic.ts)
      { when: /holding the string/, anim: 'hold_lead', prop: 'lead', work: [], animals: { kind: 'string', species: ['donkey_pack', 'donkey_pack', 'mule_pack', 'donkey_pack', 'donkey_pack'], n: 5, pace: 0, side: -0.9, lead: -1.2 },
        note: 'a driver holding his string of pack animals while the loads are taken off (C)' },
      { when: /holding the camels/, anim: 'hold_lead', prop: 'lead', work: [], animals: { kind: 'string', species: ['camel_pack'], n: 4, pace: 0, gap: 1.2, side: -1.1, lead: -1.5 },
        note: 'a camel driver holding his string while the loads are taken off (C)' },
      { when: /holding the ox cart/, anim: 'idle', prop: 'goad', work: [{ kind: 'cart', at: [0, 0, -4.7] }], animals: { kind: 'draught', species: ['ox', 'ox'], pace: 0 },
        note: 'a carter standing by his oxen while the grain is taken off the cart (C)' },
      // D-210 (gap audit item 17, court setting): a delegation's gift animal at the court's camp (the Apadana reliefs: B imagery; C)
      { when: /Bactrian camel/, animals: { kind: 'beside', species: ['camel'] }, note: 'seeing to the party’s Bactrian camel, a gift of the Apadana reliefs (APA-RELIEF, B imagery; at the camp C)' },
      { when: /dromedary/, animals: { kind: 'beside', species: ['dromedary'] }, note: 'seeing to the Arab party’s dromedary, a gift of the Apadana reliefs (B imagery; C)' },
      { when: /humped bull/, animals: { kind: 'beside', species: ['zebu'] }, note: 'seeing to the party’s humped bull, a gift of the Apadana reliefs (B imagery; C)' },
      { when: /fat-tailed rams/, anim: 'fodder', prop: 'basket_hip', animals: { kind: 'tethered', species: ['sheep', 'sheep'] }, work: [], note: 'feeding the party’s two fat-tailed rams, a gift of the Apadana reliefs (B imagery; C)' },
      { when: /wild ass/, animals: { kind: 'beside', species: ['donkey'] }, note: 'seeing to the party’s wild ass, a gift of the Apadana reliefs (RECOLLECTION, C), drawn with the donkey’s form (no onager rig: C)' },
      { when: /party’s animals.*the horses/, animals: { kind: 'beside', species: ['horse'] }, note: 'seeing to the party’s horses, the gift the Apadana reliefs show seven delegations leading (APA-RELIEF, MATCULT-R: B imagery; C)' },
      { when: /pack mules?/, animals: { kind: 'beside', species: ['mule'] }, note: 'seeing to a pack mule (C)' },
      { when: /the pack animals/, animals: { kind: 'beside', species: ['donkey_pack'] }, note: 'seeing to the party’s pack donkeys, their loads still on or stacked by (a travelling party’s animals: E-21, E-49; C)' },
      { when: /horse/, animals: { kind: 'beside', species: ['horse'] }, note: 'tending the relay horses of the road station (horse rations, POTTS2023: B; C)' },
      { when: /ewes|lamb/, anim: 'fodder', prop: 'basket_hip', animals: { kind: 'flock', species: SHEEP, n: 5 }, work: [], note: 'with the ewes at lambing (E-48, C): fodder scattered from a basket' },
      { when: /out and giving them water/, anim: 'fodder', prop: 'basket_hip', animals: { kind: 'flock', species: ['sheep', 'goat', 'sheep'], n: 4 }, work: [], note: 'letting the household’s animals out and giving them fodder and water (C)' },
      { when: 0.35, animals: { kind: 'beside', species: ['ox'] }, note: 'seeing to the household’s ox (cattle are not in population.json: Q-193; C)' }] },
  herd: { anim: 'herd', prop: 'staff', tier: 'C', animals: { kind: 'flock', species: SHEEP, n: 12, dogs: 2 }, sound: 'bleat',
    note: 'herding sheep and goats (state flocks attested, PF 58-60: A; the herder leaning on his staff, the flock grazing about him: C). The bleats are the flock’s. Two dogs with every flock (D-210: E-49’s participants “herders, dogs and donkeys”; the herders’ plans “with the dogs”; dogs spared by the magi, HDT 1.140, a claim; C), lying by the herdsman or at the flock’s edge and going round it; they bark at a stranger who comes close' },
  shear: { anim: 'shear', prop: 'knife', tier: 'C', animals: { kind: 'lying', species: ['sheep'] }, work: [{ kind: 'fleece', at: [0.55, 0, 0.3] }],
    note: 'shearing the state flock (E-47, season C): kneeling at a sheep laid on its side, the fleece cut with a knife (shears are not attested in the research files: Q-192; plucking, recalled for Babylonian temple flocks in E-47, is NOT SEEN)' },
  slaughter: { anim: 'butcher', prop: 'knife', tier: 'B', animals: { kind: 'tethered', species: ['goat', 'sheep'] }, work: [{ kind: 'butchery', at: [0, 0, 0.62] }, { kind: 'hides', at: [-0.9, 0, 0.1] }, { kind: 'basket_meat', at: [0.42, 0, 0.22] }],
    note: 'slaughter of small cattle at the stockyard (PF 58-60: A; their hides went to the Treasury): shown only as the evidence has it and without spectacle: live animals tethered, a butcher cutting joints on a hide, the meat in a basket, the hides stacked. No killing, no blood' },
  // D-209 (D-207: the most probable reconstruction, shown as action, fire, offering and wordless chant; no words invented)
  offer: { anim: 'barsom', prop: 'barsom', wear: ['mouth_cover'], tier: 'C', work: [{ kind: 'offering_set', at: [0, 0, 0.8] }],
    note: 'a magus (makuš) at an offering: the barsom held upright before him, the mouth covered, the issued barley and wine set out on the ground before him (the lan and the offerings and their commodities: HENK2008, B; the barsom and the mouth-cover: the Oxus plaques, B; set out, not poured: Herodotus 1.132 "no libations", read, a Greek claim). The rite itself is not attested: what is shown is the most probable reconstruction (C, D-209), with no words',
    variants: [
      { when: /a sheep issued/, anim: 'hold_lead', prop: 'lead', work: [], animals: { kind: 'lead', species: ['sheep'] }, note: 'a magus holding a sheep issued for an offering on its lead before the fire (small cattle for offerings: HENK2008, B; C)' },
      { when: /standing by with the barsom/, work: [], note: 'a magus standing by with the barsom while a man of the town calls on the god over his beast (Herodotus 1.132: "no sacrifice can be offered without a Magus", read, a Greek claim: B; C)' }] },
  tend_fire: { anim: 'feed_fire', prop: 'stick', wear: ['mouth_cover'], sound: 'fire', tier: 'C', work: [{ kind: 'brushwood', at: [0.75, 0, 0.1] }],
    note: 'a magus feeding the kept fire on the precinct\'s altar with dry wood, the mouth covered (the mouth-cover: the Oxus plaques, B; that it keeps the breath from the fire is later Iranian practice, RECOLLECTION: C; the kept fire C: D-209)' },
  chant: { anim: 'barsom', prop: 'barsom', wear: ['mouth_cover'], tier: 'C',
    note: 'a magus chanting at the fire or over an offering, the barsom upright, the mouth covered: a low intoned line WITHOUT WORDS (Herodotus 1.132 "a Magus comes near and chants", read, a Greek claim: B; the words are not attested and none are invented: D-207, D-209; the sound is the music system\'s, M-06, C)' },
  sacrifice: { anim: 'hold_lead', prop: 'lead', tier: 'B', animals: { kind: 'lead', species: ['sheep'] },
    note: 'a man of a Persian household with the beast he has led to the precinct, calling on the god and praying for the king and all the Persians (Herodotus 1.132, read, a Greek claim: B; the myrtle wreath on his cap is not modelled; the rest C: D-209)',
    variants: [
      { when: /standing by while the magus chants/, anim: 'mourn', prop: undefined, animals: undefined, work: [{ kind: 'grass_bed', at: [0, 0, 0.9] }], note: 'standing by, head bowed, while the magus chants over the boiled meat laid on soft grass (Herodotus 1.132, a Greek claim: B; C)' },
      { when: /goat/, animals: { kind: 'lead', species: ['goat'] }, note: 'the same with a goat (C)' }] },
  cut_offering: { anim: 'butcher', prop: 'knife', tier: 'C', work: [{ kind: 'butchery', at: [0, 0, 0.62] }, { kind: 'basket_meat', at: [0.42, 0, 0.22] }],
    note: 'the beast of a sacrifice cut limb from limb on its hide (Herodotus 1.132, read, a Greek claim: B); the killing itself is not shown: the performance is the butchery of the joints, without spectacle (D-142\'s rule; C: D-209)' },
  bury: { anim: 'hoe', prop: 'hoe', sound: 'hoe', tier: 'C', work: [{ kind: 'spoil', at: [-1.1, 0, 0.4] }, { kind: 'bier', at: [1.1, 0, 0.6], shared: 'group' }],
    note: 'the men of the house digging the grave with hoes and laying the dead, coated in wax and wrapped, in the earth, the bier set down beside (Herodotus 1.140, read, a Greek claim: B; the grave and the tools C: D-209). Nothing of the body is shown' },
  mourn: { anim: 'mourn', tier: 'C', note: 'standing in mourning at the grave, the head bowed and the hands joined (C: the gestures of mourning at Persepolis are not attested; nothing more is staged: D-209)' },
  clean: { anim: 'sweep', prop: 'broom', sound: 'broom', tier: 'C', note: 'sweeping the closed palaces and the stalls with a twig broom (C)' },
  garden_work: { anim: 'hoe', prop: 'hoe', sound: 'hoe', tier: 'C', note: 'hoeing, weeding and digging dung into the garden beds (C)',
    variants: [
      { when: /prun/, anim: 'pick', prop: 'knife', sound: undefined, note: 'pruning the garden trees with a knife (C)' },
      { when: /produce|tending the trees/, anim: 'pick', prop: undefined, sound: undefined, work: [{ kind: 'basket_fruit', at: [-0.32, 0, 0.42] }], note: 'tending the trees and gathering produce into a basket (C)' }] },
  field_work: { anim: 'hoe', prop: 'hoe', sound: 'hoe', tier: 'C', note: 'hoeing, weeding, clearing stubble, breaking clods and mending the banks of the fields (C)',
    variants: [
      { when: /driving the animals/, anim: 'drive', prop: 'goad', sound: undefined, animals: { kind: 'circle', species: ['ox', 'ox'] }, work: [{ kind: 'threshing_floor', at: [0, 0, 0], shared: 'place' }], note: 'a child driving the animals round the threshing floor with a stick (E-43; C)' },
      { when: /glean|stalks|sheaves to the stooks/, anim: 'gather', prop: 'basket_hip', sound: undefined, work: [{ kind: 'stooks', at: [1.8, 0, 1.2] }], note: 'gleaning the cut stalks behind the reapers into a basket (C)' },
      { when: /straw on the threshing floor/, anim: 'winnow', prop: 'fork', sound: undefined, work: [{ kind: 'threshing_floor', at: [0, 0, 0], shared: 'place' }], note: 'gathering and turning the straw on the threshing floor with a fork (C)' },
      { when: /seed|manur/, anim: 'fodder', prop: 'basket_hip', sound: undefined, note: 'sowing seed or spreading manure from a basket on the hip (C)' },
      { when: /minding the crop and the water/, anim: 'irrigate', note: 'minding the crop and the water in the furrows, leaning on the hoe (C)' }] },
  irrigate: { anim: 'irrigate', prop: 'hoe', sound: 'hoe', tier: 'C', note: 'a turn of water (CE-19): the runnel opened or closed with a few strokes of the hoe, then watching the water run (C)' },
  plough: { anim: 'plough', prop: 'goad', tier: 'C', animals: { kind: 'team', species: ['ox', 'ox'] }, work: [{ kind: 'ard', at: [0, 0, 0], follow: true }],
    note: 'ploughing and sowing with a yoked pair of oxen and a wooden ard (E-40, E-44): walking the furrow, the left hand on the stilt, a goad in the right. Draught animals C (cattle are not in population.json: Q-193); ard form C' },
  reap: { anim: 'reap', prop: 'sickle', sound: 'sickle', tier: 'C', work: [{ kind: 'sheaves', at: [0.9, 0, -0.5] }],
    note: 'reaping barley and wheat with a sickle (E-41, E-42): a handful grasped, cut below the hand, laid down behind (C)',
    variants: [{ when: /binding/, anim: 'bind', prop: undefined, sound: undefined, work: [{ kind: 'sheaf', at: [0, 0, 0.55] }, { kind: 'stooks', at: [1.6, 0, -0.8] }], note: 'binding sheaves with a band of twisted straw behind the reapers (C)' }] },
  thresh: { anim: 'winnow', prop: 'fork', tier: 'C', work: [{ kind: 'threshing_floor', at: [0, 0, 0], shared: 'place' }, { kind: 'grain_heap', at: [-0.4, 0, 1.2] }],
    note: 'threshing and winnowing on the village floor (E-43): the threshed grain tossed into the wind with a wooden fork (C)',
    variants: [
      { when: /driving the animals|under the animals/, anim: 'drive', prop: 'goad', animals: { kind: 'circle', species: ['ox', 'ox'] }, work: [{ kind: 'threshing_floor', at: [0, 0, 0], shared: 'place' }],
        note: 'threshing by treading: the animals driven round over the sheaves on the floor, the driver at the post in the middle (E-43; C)' },
      { when: /threshing and winnowing/, anim: 'winnow', note: 'threshing and winnowing on the village floor (C)' }] },
  dig_canal: { anim: 'hoe', prop: 'hoe', sound: 'hoe', tier: 'C', work: [{ kind: 'spoil', at: [-1.1, 0, 0.4] }], note: 'clearing the canal and its channels with the hoe (E-50; C)',
    variants: [{ when: /silt baskets/, anim: 'pass', prop: 'basket_both', sound: undefined, note: 'clearing the canal: silt baskets passed out of the channel (C)' }] },
  pick_fruit: { anim: 'pick', tier: 'C', work: [{ kind: 'basket_fruit', at: [-0.32, 0, 0.42] }], note: 'the vintage and the fig harvest (E-45, E-46): picking by hand into a basket on the ground (C)',
    variants: [{ when: /tread/, anim: 'tread', work: [{ kind: 'press', at: [0, 0, 0] }], note: 'treading the picked grapes in the press (E-45; C)' }] },
  craft: { anim: 'mend', prop: 'awl', prop2: 'basket_lap', tier: 'C', note: 'mending baskets, tools, harness and sandals, seated, with an awl (C)',
    variants: [
      { when: /kiln/, anim: 'stoke', prop: 'stick', prop2: undefined, sound: 'fire', work: [{ kind: 'brushwood', at: [-0.7, 0, 0.1] }], note: 'firing the kiln of the Persepolis West craft yard (kiln: PW2017, B; its firing C)' },
      { when: /pigment|colour/, anim: 'grind', prop: undefined, prop2: undefined, sound: 'quern', work: [{ kind: 'pigment_slab', at: [0, 0, 0.55] }], note: 'grinding pigments on a slab, Egyptian blue among them (PW-PIGMENT2021: B; the work C)' },
      { when: /clay/, anim: 'hoe', prop: 'hoe', prop2: undefined, sound: 'hoe', work: [{ kind: 'spoil', at: [-1.1, 0, 0.4] }], note: 'digging clay by the river for the kiln (C)' },
      { when: /picking over the grain/, prop: undefined, prop2: 'basket_lap', note: 'picking over the grain on a tray in the lap on the doorstep: the stones and the chaff out (D-211; C)' },
      { when: /mending clothes/, prop: 'awl', prop2: 'cloth', note: 'mending clothes on the doorstep, a needle of bone or bronze (C)' }] },
  carry_bier: { anim: 'bier_r', moving: true, sound: 'footsteps', tier: 'C', work: [{ kind: 'bier', at: [-0.46, 0, 0], shared: 'group', follow: true }],
    note: 'carrying the dead out of the settlement on a bier, four bearers (E-71; HDT 1.140 for burial in the earth: B claim). Exposure is never shown',
    variants: [{ when: 0.5, anim: 'bier_l', work: [{ kind: 'bier', at: [0.46, 0, 0], shared: 'group', follow: true }], note: 'a bearer with the bier’s pole on the left shoulder (C)' }] },
  wash: { anim: 'wash', prop: 'cloth', sound: 'wash', tier: 'C', work: [{ kind: 'wash_stone', at: [0, 0, 0.55] }, { kind: 'drying_rack', at: [1.7, 0, -0.6] }],
    note: 'washing clothes and wool at the water: rinsed, beaten on a stone, wrung, hung to dry (C)' },
  train: { anim: 'archery', prop: 'bow', prop2: 'arrow', sound: 'bow', tier: 'B', work: [{ kind: 'target', at: [0, 0, 22] }],
    note: 'boys of households of standing learning to shoot with the bow (HDT 1.136, a Greek claim: B; XEN-CYR 1.2.15; Q-146): shooting at a straw target at 22 m (C)',
    variants: [{ when: 0.35, anim: 'ride', prop: undefined, prop2: undefined, sound: undefined, work: [], animals: { kind: 'mount', species: ['horse_saddle'], pace: 0 },
      note: 'a boy of a household of standing learning to ride (HDT 1.136 “taught to ride”, a Greek claim: B), sitting a standing horse on a saddle cloth, no stirrups (blocklist; D-210; C)' }] },
  cook: { anim: 'cook', prop: 'ladle', prop2: 'stick', sound: 'fire', tier: 'C', work: [{ kind: 'hearth_pot', at: [0, 0, 0.58] }, { kind: 'brushwood', at: [-0.75, 0, 0.12] }],
    note: 'at dusk the hearth fire is lit and the evening meal warmed: squatting at the hearth, stirring the pot, feeding sticks under it (§9.2; C). The fire itself is the settlement’s hearth',
    variants: [{ when: /meat of the offering/, work: [{ kind: 'hearth_pot', at: [0, 0, 0.58] }, { kind: 'brushwood', at: [-0.75, 0, 0.12] }, { kind: 'grass_bed', at: [0.95, 0, 0.45] }],
      note: 'boiling the meat of a sacrifice in a pot on a small fire of brushwood at the precinct, the soft grass laid ready beside (Herodotus 1.132 "after boiling the flesh, spreads the softest grass", read, a Greek claim: B; the fire is the pot\'s, not an altar fire: C, D-209)' }] },
  // D-199 (court setting only): the king as the door-jamb and audience reliefs show him, and the two attendants behind him
  royal_walk: { anim: 'walk', moving: true, prop: 'sceptre', prop2: 'lotus', sound: 'footsteps', tier: 'B', note: 'the king walking, the long staff in his right hand and a lotus in his left (door-jamb reliefs of the Tachara and the Hadish, HADISH-JAMB: B); the gait and the pace C' },
  enthroned: { anim: 'enthroned', prop: 'sceptre', prop2: 'lotus', tier: 'B', work: [{ kind: 'throne', at: [0, 0, 0] }], note: 'the king enthroned at an audience, staff and lotus in his hands, his feet on the footstool (the Treasury audience relief, TREAS-AUD: B); where the throne stood in the Apadana and the hours C; the king does not move or speak (brief §1.1 restraint)' },
  bear_parasol: { anim: 'guard_walk', moving: true, prop: 'parasol', sound: 'footsteps', tier: 'B', note: 'an attendant walking behind the king holding the parasol over him (door-jamb reliefs: B); the parasol’s size and cloth C; the two are not held in step (each walks the view’s own route: C)' },
  attend_parasol: { anim: 'guard', prop: 'parasol', tier: 'C', note: 'the parasol bearer standing by while the king sits (C: indoors the reliefs show a canopy, not the parasol)' },
  bear_whisk: { anim: 'walk', moving: true, prop: 'whisk', prop2: 'towel', sound: 'footsteps', tier: 'B', note: 'a beardless attendant walking behind the king with a fly-whisk and a towel (door-jamb reliefs: B)' },
  attend_whisk: { anim: 'idle', prop: 'whisk', prop2: 'towel', tier: 'B', note: 'the fly-whisk and towel bearer standing behind the throne (the Treasury audience relief: a beardless attendant with a towel behind the king, TREAS-AUD: B)' },
};
/** the placeholders (none since D-142; tests pin this list as empty, and the lint fails if one is added back) */
export const ABSTRACT_PLACEHOLDERS = (Object.keys(ACTIVITIES) as ActivityId[]).filter(k => ACTIVITIES[k].abstractOnly || ACTIVITIES[k].placeholder);

/** a stable [0, 1) per person and activity (variant shares) */
const share = (seed: number, act: string) => { let h = seed | 0; for (let i = 0; i < act.length; i++) h = Math.imul(h ^ act.charCodeAt(i), 0x5bd1e995) ^ (h >>> 15); return ((h >>> 0) % 10007) / 10007; };
/** the performance a person gives of an activity: the first variant whose reason pattern matches `why`, or whose share
 *  covers the person; otherwise the base performance. Numeric shares are cumulative in the listed order */
export function performanceFor(act: ActivityId, why = '', seed = 0, force?: number, who?: Performer): Performance & { variant: number } {
  const P = ACTIVITIES[act]; if (!P?.variants) return { ...P, variant: -1 };
  const fits = (v: { sex?: 'm' | 'f'; ages?: [number, number] }) => !who || ((!v.sex || v.sex === who.sex) && (!v.ages || (who.age >= v.ages[0] && who.age <= v.ages[1])));
  if (force !== undefined) { const v = P.variants[force]; if (!v) return { ...P, variants: undefined, variant: -1 }; const { when: _w, variants: _v, sex: _s, ages: _a, ...rest } = v as any; return { ...P, variants: undefined, ...rest, variant: force }; }
  let acc = 0; const u = share(seed, act);
  for (let i = 0; i < P.variants.length; i++) { const v = P.variants[i];
    const hit = (v.when instanceof RegExp ? v.when.test(why) : (u >= acc && u < acc + v.when)) && fits(v); if (typeof v.when === 'number') acc += v.when;
    if (hit) { const { when: _w, variants: _v, sex: _s, ages: _a, ...rest } = v as any; return { ...P, variants: undefined, ...rest, variant: i }; } }
  return { ...P, variant: -1 };
}
