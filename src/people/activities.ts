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
  | 'tend_fire' | 'chant' | 'sacrifice' | 'cut_offering' | 'bury' | 'mourn'
  // D-255: the crafts and the records (WORLD_INVENTORY G20, G26-G29, GB4, GB13)
  | 'smith' | 'goldsmith' | 'weigh' | 'seal' | 'cut_seal' | 'tan' | 'press_oil'
  // D-256: the work on the land the gap hunters found missing (WORLD_INVENTORY G12-G17, G30): milking, fishing, fowling and
  // snaring, the quarry, the bees
  | 'milk' | 'fish' | 'fowl' | 'quarry' | 'bees'
  // D-292: the body's care (gap hunter C, C-D04..C-D07)
  | 'tend_body';

/** props an activity can put in the hands (props.ts PROPS) */
export type PropKind = 'spear' | 'sack' | 'jar' | 'jar_head' | 'tablet' | 'mallet' | 'basket' | 'bread'
  // D-780: the delegations' gifts (tools/blender/model_props.py gift_*)
  | 'gift_amphora' | 'gift_armlets' | 'gift_tusk' | 'gift_daggers' | 'gift_bows' | 'gift_cloth'
  | 'hoe' | 'sickle' | 'fork' | 'goad' | 'staff' | 'broom' | 'spindle' | 'distaff' | 'trowel' | 'mould' | 'brick' | 'brick_l' | 'rope' | 'adze' | 'bow' | 'arrow'
  | 'knife' | 'beater' | 'paddle' | 'cloth' | 'wisp' | 'bowl' | 'rag' | 'awl' | 'ladle' | 'stick' | 'lead' | 'jar_both' | 'sack_both' | 'basket_hip' | 'basket_both' | 'basket_lap'
  // instruments (D-200: played only in a playing performance, playing.ts)
  | 'harp_v' | 'harp_h' | 'plectrum' | 'lyre' | 'frame_drum' | 'double_pipe' | 'reed_pipe'
  | 'sceptre' | 'lotus' | 'parasol' | 'whisk' | 'towel'
  // D-215: the gilded spear butts (court) and children's toys
  | 'spear_apple' | 'spear_gpom' | 'ball' | 'toy_bow' | 'rattle'
  // D-209: the magus's barsom
  | 'barsom'
  // D-221: the scribes' writing things
  | 'stylus' | 'pen' | 'leather'
  // D-255: the crafts' and the records' tools
  | 'hammer' | 'tongs' | 'hammer_s' | 'punch' | 'balance' | 'seal_cyl' | 'drill_bow' | 'scraper' | 'pestle';
/** sounds a performance makes (soundscape.ts strike kinds; 'murmur' and 'footsteps' are layers, 'fire' the fire's own) */
export type SoundKind = 'chisel' | 'quern' | 'fire' | 'murmur' | 'footsteps' | 'dice' | 'water' | 'hoe' | 'sickle' | 'loom' | 'trowel' | 'adze' | 'mould' | 'wash' | 'broom' | 'bow' | 'bleat'
  | 'hammer' | 'bellows' | 'chase' | 'clink' | 'drill' | 'scrape' | 'pound'
  // D-256: a cow's low (the cattle's voice), the bees' buzz at the hives
  | 'low' | 'buzz';
/** a thing at the place (workObjects.ts), in the performer's frame (m: right −x / left +x, ahead +z; yaw rad). `follow`:
 *  moves with the performer's own path (the ard behind the team); `shared`: one for everyone doing it at the same place
 *  (the threshing floor, the drum on its sledge) or in the same group (the bier) */
export interface WorkSpec { kind: WorkKind; at: [number, number, number]; follow?: boolean; shared?: 'place' | 'group' }
/** animals the work needs (animals.ts): a flock grazing about the herder, the yoked pair ahead of the ploughman, the
 *  animals treading the threshing floor, one standing to be groomed, a sheep lying to be shorn, stock tethered by the
 *  butcher, a sheep on a lead */
export interface AnimalSpec { kind: 'flock' | 'drive' | 'team' | 'circle' | 'beside' | 'lying' | 'tethered' | 'lead' | 'string' | 'mount' | 'draught'
  /** D-256: penned in a fold (the fold's centre FOLD_AT ahead; `pace` 1 = night, most lying) */
  | 'fold'; species: Species[]; n?: number;
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
/** D-256: a village herd of cows and calves (C: about one calf to three cows) */
const CATTLE: Species[] = ['cow', 'cow', 'calf', 'cow', 'cow', 'calf', 'cow', 'cow'];
/** D-256: the fold (animals.ts FOLD_AT) and the drum sledge behind two yoke pairs (animals.ts 'draught' n 4) */
const FOLD: WorkSpec = { kind: 'fold', at: [0, 0, 7.5] }, DRUM_BEHIND: WorkSpec = { kind: 'drum_haul', at: [0, 0, -9.0] };
export const ACTIVITIES: Record<ActivityId, Performance> = {
  walk: { anim: 'walk', moving: true, sound: 'footsteps', tier: 'C', note: 'walking',
    // D-210 (gap audit item 6): the animals that travel with the people who lead them (world/traffic.ts, the court's parties)
    variants: [
      // D-780 (s18 C13): the court's programme (people/ceremony.ts, court.ts): riding with the king, to the hunt and at exercise;
      // grooms leading the king's horses; a delegate leading his people's gift animals up the Apadana's stair (the reliefs, B)
      { when: /in the royal chariot/, anim: 'ride', sound: undefined, animals: { kind: 'mount', species: ['horse_saddle'], pace: 1.8 },
        note: 'the king driving out in the royal chariot (the reliefs, B): drawn mounted until the chariot and its pair are drawn under him (C14, the animals: C: D-780)' },
      { when: /on horseback/, anim: 'ride', sound: undefined, animals: { kind: 'mount', species: ['horse_saddle'], pace: 1.8 },
        note: 'riding with the king, to the hunt or at exercise, on a saddle cloth, no stirrups (blocklist; Cyr. 8.3, 1.4: claims, B; the pace C: D-780)' },
      { when: /leading the king’s horses|leading the horses back/, animals: { kind: 'string', species: ['horse_saddle', 'horse_saddle', 'horse_saddle'], n: 3, pace: 1.0 }, note: 'a groom leading the king’s saddled horses on a string (C: D-780)' },
      { when: /leading the gift animals, the horses/, animals: { kind: 'string', species: ['horse', 'horse'], n: 2, pace: 0.9 }, note: 'a delegate leading his people’s gift horses up to the king (the Apadana reliefs: seven delegations lead horses, B; C: D-780)' },
      { when: /leading the gift animals, the Bactrian camel/, animals: { kind: 'string', species: ['camel'], n: 1, pace: 0.9, gap: 1.2, lead: 1.4 }, note: 'a delegate leading the Bactrian camel up to the king (the Apadana reliefs, B; C: D-780)' },
      { when: /leading the gift animals, the dromedary/, animals: { kind: 'string', species: ['dromedary'], n: 1, pace: 0.9, gap: 1.2, lead: 1.4 }, note: 'an Arab delegate leading the dromedary up to the king (the Apadana reliefs, B; C: D-780)' },
      { when: /leading the gift animals, the humped bull/, animals: { kind: 'string', species: ['zebu'], n: 1, pace: 0.8 }, note: 'a delegate leading the humped bull up to the king (the Apadana reliefs, B; C: D-780)' },
      { when: /leading the gift animals, the fat-tailed rams/, animals: { kind: 'string', species: ['sheep', 'sheep'], n: 2, pace: 0.9 }, note: 'a delegate leading the fat-tailed rams up to the king (the Apadana reliefs, B; C: D-780)' },
      { when: /leading the gift animals, the wild ass/, animals: { kind: 'string', species: ['onager'], n: 1, pace: 0.9 }, note: 'a delegate leading the wild ass up to the king (the Apadana reliefs, B; C: D-780)' },
      // D-209: a man of the town leading the beast for his sacrifice to the precinct (Herodotus 1.132: B claim; C)
      { when: /leading a sheep/, animals: { kind: 'string', species: ['sheep'], n: 1, pace: 1.0 }, note: 'leading a sheep on a rope to the precinct for a sacrifice (Herodotus 1.132, a Greek claim: B; C)' },
      // D-359: the draught ox or the ewes bought at the exchange after a loss (economy/plans.ts animal_bought)
      { when: /leading the new ox home/, animals: { kind: 'string', species: ['ox'], n: 1, pace: 0.9 }, note: 'leading home on a rope the draught ox bought to replace the one the house lost (C: D-359)' },
      { when: /driving the ewes home/, animals: { kind: 'string', species: ['sheep', 'sheep', 'sheep'], n: 3, pace: 0.9 }, note: 'driving home the ewes bought to make up the flock after a loss (C: D-359)' },
      // s17 V3 (C3's ask): a flock driven along the road, walking ahead of its herder in a loose mass with the dogs at its flanks
      { when: /driving a flock|driving the flock/, prop: 'staff', sound: 'bleat', animals: { kind: 'drive', species: SHEEP, n: 16, dogs: 2, pace: 0.9 },
        note: 'a herder driving the flock along the road at a slow walk, the sheep and goats ahead of him in a loose mass, two dogs working its flanks (E-49 herders and dogs; the drive, its size and pace C)' },
      { when: /leading a goat/, animals: { kind: 'string', species: ['goat'], n: 1, pace: 1.0 }, note: 'leading a goat on a rope to the precinct for a sacrifice (C)' },
      { when: /string of pack|pack train/, animals: { kind: 'string', species: ['donkey_pack', 'donkey_pack', 'mule_pack', 'donkey_pack', 'donkey_pack'], n: 5, pace: 1.0 },
        note: 'a driver leading a string of five pack animals nose to tail, donkeys and a mule with panniers and sacks (pack donkeys: POTTS2023, B; mules: population.json, C; strings of five, the loads and the pace C)' },
      { when: /unloaded string/, animals: { kind: 'string', species: ['donkey', 'donkey', 'mule', 'donkey', 'donkey'], n: 5, pace: 1.0 }, note: 'a driver leading his string back unladen (C)' },
      { when: /string of Bactrian camels/, animals: { kind: 'string', species: ['camel_pack'], n: 4, pace: 1.0, gap: 1.2, lead: 1.4 },
        note: 'a camel driver leading four Bactrian camels roped nose to tail, sacks slung each side (camels: the Apadana reliefs, B imagery; population.json camel 0-20 “caravans from outside Fars”, C; the string C)' },
      { when: /unladen camels/, animals: { kind: 'string', species: ['camel'], n: 4, pace: 1.0, gap: 1.2, lead: 1.4 }, note: 'a camel driver leading his string back unladen (C)' },
      { when: /courier riding/, anim: 'ride', sound: undefined, animals: { kind: 'mount', species: ['horse_saddle'], pace: 1.8 },
        note: 'a royal courier riding a relay horse at a walk into or out of the road station (the relay: HDT 8.98, a claim, B; horse rations POTTS2023, B; riding HDT 1.136, B); a saddle cloth, no stirrups (blocklist); walking the horse near the station and its pace C' },
      // D-256 (G30; A505/A506, P-034): the column drums hauled from the quarry across the plain (world/traffic.ts)
      { when: /dragging a column drum/, prop: 'goad', animals: { kind: 'draught', species: ['ox', 'ox', 'ox', 'ox'], n: 4, pace: 0.4 }, work: [DRUM_BEHIND],
        note: 'a driver walking ahead of two yoke pairs of oxen dragging a rough-cut column drum on a wooden sledge from the quarry to the Terrace, at a slow walk (drums from the quarry: construction.ts E-61, the stone from Majdabad by petrography, B; how they travelled is not attested: sledge, oxen, route and pace C, D-256)' },
      { when: /empty sledge/, prop: 'goad', animals: { kind: 'draught', species: ['ox', 'ox', 'ox', 'ox'], n: 4, pace: 0.8 }, work: [{ kind: 'sledge', at: [0, 0, -9.0] }],
        note: 'driving the two yoke back to the quarry with the empty sledge (C: D-256)' },
      { when: /beside the drum sledge/, note: 'one of the gang walking beside the drum sledge, with the levers and the rollers for the bad places of the road (C: D-256)' },
      // session 9 (G77): the roof timbers for the building works, beams hauled in on ox carts along the royal road (C)
      { when: /cart of roof timbers|emptied timber cart/, animals: { kind: 'draught', species: ['ox', 'ox'], pace: 0.9 }, work: [{ kind: 'cart_timber', at: [0, 0, -4.7] }],
        note: 'a carter walking ahead of his yoked oxen and a cart of roof beams for the building works (the Susa charter\'s timbers from far: A for Susa, B analogy here; carts, loads and rate C)' },
      // s17 V3 (C3's ask): the quarry's stone for the door and window frames, one rough block a cart, at a slower walk
      { when: /ox cart of building stone|cart of building stone|emptied stone cart/, prop: 'goad', animals: { kind: 'draught', species: ['ox', 'ox'], pace: 0.7 }, work: [{ kind: 'cart_stone', at: [0, 0, -4.7] }],
        note: 'a carter walking ahead of his yoked oxen and a cart with a rough-cut block from the quarry for the Hall of 100 Columns’ door and window frames (the stone from Majdabad: construction.ts E-61, B; carts, loads and pace C)' },
      { when: /ox cart/, animals: { kind: 'draught', species: ['ox', 'ox'], pace: 0.9 }, work: [{ kind: 'cart', at: [0, 0, -4.7] }],
        note: 'a carter walking ahead of his yoked oxen and their cart of grain sacks on the road (carts silent at Persepolis, Assyrian reliefs B analogy; draught cattle Q-193; C)' }] },
  carry_sack: { anim: 'carry_shoulder', moving: true, prop: 'sack', sound: 'footsteps', tier: 'B', note: 'sack on the shoulder (porters on the tribute reliefs carry skins and bags: B)',
    variants: [
      // D-359: the household's washing taken to the water in a basket (wardrobe/washing.ts)
      { when: /the washing/, anim: 'carry_front', prop: 'basket', note: 'carrying the household’s clothes to the water and back in a basket held before her (C: D-359)' },
      { when: /bundles of brushwood|the fuel/, note: 'carrying bundles of brushwood or a sack of dung cakes over the shoulder (C: D-359)' },
      { when: /the catch|the nuts|the acorns|the birds|the garlic|the honey/, note: 'carrying home what the day gathered, in a bag over the shoulder: the fish, the nuts or acorns, the snared birds, the wild garlic, the combs in a covered pot (C: D-256)' },{ when: /loading the donkeys|unloading the donkeys|pitching the tents|loading the animals|unloading the party/, animals: { kind: 'beside', species: ['donkey_pack'] },
      note: 'loading or unloading the pack donkeys by the tents, a loaded donkey standing by (E-49 “herders, dogs and donkeys”; C)' }] },
  carry_jar: { anim: 'carry_shoulder', moving: true, prop: 'jar', sound: 'footsteps', tier: 'B', note: 'jar on the shoulder (tribute reliefs: B)' },
  carry_jar_head: { anim: 'carry_head', moving: true, prop: 'jar_head', sound: 'footsteps', tier: 'C', note: 'water jar carried on the head (C)' },
  carry_bread: { anim: 'carry_front', moving: true, prop: 'basket', sound: 'footsteps', tier: 'C', note: 'basket of bread for the gang’s meal (C)',
    variants: [{ when: /meat of the offering/, note: 'carrying the boiled meat of a sacrifice home in a basket (Herodotus 1.132 "the sacrificer carries away the flesh and uses it as he pleases", read, a Greek claim: B; C: D-209)' }] },
  stand_guard: { anim: 'guard', prop: 'spear', tier: 'B', note: 'spear upright, butt on the ground (guard files on the reliefs: B)' },
  patrol: { anim: 'guard_walk', moving: true, prop: 'spear', sound: 'footsteps', tier: 'C', note: 'guard walking a round (C)',
    variants: [{ when: /beating the reeds/, prop: 'stick', note: 'a beater driving the game out of the river reeds toward the riders (Cyr. 1.4: a claim, B; C: D-780)' }] },
  dress_stone: { anim: 'chisel', prop: 'mallet', sound: 'chisel', tier: 'B', note: 'dressing a block with mallet and chisel (tool marks on the stone: B)' },
  grind: { anim: 'grind', sound: 'quern', tier: 'B', note: 'kneeling at a saddle quern (saddle querns are the period type: B)' },
  knead: { anim: 'knead', tier: 'C', note: 'kneading dough in a trough (C)' },
  bake: { anim: 'bake', sound: 'fire', tier: 'C', note: 'slapping flat loaves into the oven (C)' },
  draw_water: { anim: 'draw_water', prop: 'jar', sound: 'water', tier: 'C', note: 'filling a jar at the water point (C)' },
  write_tablet: { anim: 'write', prop: 'tablet', prop2: 'stylus', tier: 'B', note: 'writing on a clay tablet held in the left hand with a reed stylus in the right (PF/PT tablets: A; the stylus B by analogy; posture C; D-221: the stylus drawn)',
    // D-221: the Aramaic secretary writes with a reed pen and ink on leather (Aramaic epigraphs in ink on PF tablets: B;
    // the Treasury tablets' leather duplicates, Cameron's inference: B)
    variants: [{ when: /in Aramaic/, prop: 'leather', prop2: 'pen', note: 'writing Aramaic with a reed pen and ink on a sheet of leather on the left palm (Aramaic ink epigraphs on Persepolis tablets: B; leather documents in the chancery: B by analogy; posture C; the writing on the sheet is not drawn: D-221)' }] },
  eat: { anim: 'eat', sound: 'murmur', tier: 'C', note: 'sitting and eating bread (rations: B)',
    // D-359: the bread brought along on an errand or a summons (economy/plans.ts feed)
    variants: [{ when: /at the king’s banquet/, anim: 'sit', prop: 'bowl', note: 'seated at a low table at the king’s banquet, eating and drinking (Heracleides in Athenaeus 4.145: a claim, B; C: D-780)' },
      { when: /^bread and water brought along/, prop: 'bread', note: 'eating a flat loaf brought along from home, wrapped in a cloth, where the day’s business holds them (C: D-359)' }] },
  sleep: { anim: 'sleep', tier: 'C', note: 'lying asleep on a mat (C)',
    variants: [
      // D-256: the drum haul's night halt by the road (world/traffic.ts), the oxen unyoked and lying by it
      { when: /by the drum sledge/, work: [{ kind: 'drum_haul', at: [-2.6, 0, 0.6] }], animals: { kind: 'fold', species: ['ox'], n: 4, pace: 1 },
        note: 'asleep in a cloak on the ground by the drum sledge where the haul halted for the night, the oxen unyoked and lying by it (C: D-256)' },
      { when: /by the empty sledge/, work: [{ kind: 'sledge', at: [-2.6, 0, 0.6] }], animals: { kind: 'fold', species: ['ox'], n: 4, pace: 1 },
        note: 'asleep by the empty sledge on the way back to the quarry, the oxen lying by it (C: D-256)' }] },
  talk: { anim: 'talk', sound: 'murmur', tier: 'C', note: 'talking with gestures',
    // session 10 (D-283; gap hunter C, C-D28): the wine and beer rations drunk in company of an evening, the jar on the ground
    // between them (wine and beer issued to workers: E-02, PF 50, A; the Persians "very fond of wine", Hdt 1.133, B claim; the
    // company and the jar C)
    variants: [
      // D-359: the economy's visits (economy/plans.ts): silver weighed at the lender's, the pledge handed over, barley brought
      { when: /loan of silver; it is weighed out|seeing it weighed/, work: [{ kind: 'weigh_table', at: [0.55, 0, 0.5] }], note: 'at a lender’s house: the silver weighed out on a hand balance on a low table between them, the terms said before a witness (silver loans with interest: the Babylonian loan texts, B analogy; C: D-359)' },
      { when: /the dowry set down|^(talking over the marriage|visiting her father’s house to agree the marriage)/, work: [{ kind: 'jar', at: [0.6, 0, 0.5] }, { kind: 'basket_fruit', at: [-0.6, 0, 0.5] }], note: 'the families together over the marriage, or the dowry set down in the groom’s courtyard: jars and a basket of the gifts between them (bride-gift and dowry: the Neo-Babylonian marriage contracts, B analogy; C: D-359)' },
      { when: /handing over the pledge|^bringing barley/, work: [{ kind: 'jar', at: [0.5, 0, 0.45] }], note: 'at another house, a jar set down between them: the pledge for an unpaid debt handed over, or barley brought in it (C: D-359)' },
      { when: /a jar of (beer|wine)/, work: [{ kind: 'jar', at: [0.5, 0, 0.4] }], note: 'drinking the ration in company of an evening, a jar of beer or wine set on the ground between them, poured into cups in turn (the rations: E-02, A; the evening company C: D-283)' }] },
  rest: { anim: 'sit', tier: 'C', note: 'sitting and resting' },
  gamble: { anim: 'dice', sound: 'dice', tier: 'C', note: 'throwing knucklebones (astragali are common finds of the period: B object, C scene)' },
  inspect: { anim: 'inspect', tier: 'C', note: 'official looking over work, hands clasped (C)',
    // D-780: the court's audience and banquet (court.ts): the bow before the king (drawn with the bowed head and joined hands
    // of the mourning pose until a proskynesis pose exists: C), and the servers at the banquet's tables
    variants: [{ when: /bowing low before the king|right hand raised before his mouth/, anim: 'proskynesis', note: 'proskynesis before the king: bowing from the hips, the right hand raised before the mouth (the Treasury relief, B; HDT 1.134, a claim: B; the depth and timing C: D-780)' },
      { when: /pouring wine at the tables/, anim: 'pour', prop: 'jar', note: 'pouring wine at the king’s banquet (C: D-780)' },
      { when: /serving at the tables/, anim: 'serve', prop: 'bowl', note: 'serving dishes at the king’s banquet (C: D-780)' }] },
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
    variants: [
      // D-359 (B235): the haggled deals walked to the market ground (economy/plans.ts): the selling house's stall, the buyer at it
      { when: /^selling barley from a stall/, anim: 'sit', prop: 'bowl', work: [{ kind: 'grain_heap', at: [0, 0, 0.8] }, { kind: 'jar', at: [0.75, 0, 0.3] }],
        note: 'a seller sitting at a stall on the market ground, barley poured out of the sacks in a heap before them, a bowl to measure it out, a jar by them; a buyer stands haggling (exchange in kind and in silver by weight, no coins: lives.json, B by analogy with the Babylonian market texts; the stall, the heap and the measure C: D-359)' },
      { when: /^selling brushwood/, anim: 'sit', prop: undefined, work: [{ kind: 'brushwood', at: [0, 0, 0.8] }, { kind: 'dung_cakes', at: [0.85, 0, 0.25] }],
        note: 'a seller sitting at a stall on the market ground by bundles of brushwood and a stack of dried dung cakes for the hearth; a buyer stands haggling (C: D-359)' },
      { when: /^haggling/, note: 'a buyer standing at a stall (or in the seller’s doorway) haggling with a basket in hand: offer, refusal, a gesture at the goods, counter-offer, until the price is agreed (the haggle itself: speech/haggle.ts, D-351; C: D-359)' },
      { when: /^exchanging silver for barley|^exchanging for brushwood/, note: 'a buyer at the exchange with a basket to carry the barley or the fuel home, silver weighed out against it (exchange in kind and silver by weight: lives.json; C: D-359)' },
      { when: /^exchanging a jar and a cloth/, prop: 'jar', note: 'a house selling its own things at the exchange: a jar held out, a cloth over the arm (C: D-359)' },
      { when: /from a tray/, anim: 'sit', prop: 'basket_lap', note: 'a woman selling her wares from a tray at her door in the lane, for barley or oil in kind (D-211; lanes as working space: analogy, C)' }] },
  lie_ill: { anim: 'sleep', tier: 'C', note: 'lying ill on a mat at home (E-72 sickness; C)' },
  // ============================================ the abstract population's work (D-142; every motion C)
  haul: { anim: 'haul', prop: 'rope', tier: 'C', work: [{ kind: 'drum_sledge', at: [0, 0, 6.2], shared: 'place' }],
    note: 'the labour gang hauling a column drum on a sledge with ropes, heaving in time (construction by ramp and sledge: C; the gangs are attested, PT-WAGE: B)',
    variants: [
      // D-256: the drum's gang at the quarry and at the drum ground (the drum on its sledge is the driver's: world/traffic.ts)
      // D-359: the hired day at the royal store and the debt-bound son's yard work in the creditor's house (economy/plans.ts)
      { when: /royal store|carrying sacks/, anim: 'pass', prop: 'sack', work: [{ kind: 'sealed_jars', at: [-1.0, 0, 0.35] }],
        note: 'hired hands at the royal store passing sacks of barley along a chain into the store, the sealed jars and sacks of the store by them (the royal stores receive grain: PF 2-8, A; the day hire and the chain C: D-359)' },
      { when: /water, dung and fodder/, anim: 'fodder', prop: 'fork', work: [{ kind: 'fodder', at: [0.8, 0, 0.45] }],
        note: 'a debt-bound son of another house doing the yard work of the creditor’s house: fodder forked to the animals, the dung carried out, water brought (the pledged person working in the creditor’s house: Babylonian loan texts, B analogy; C: D-359)' },
      { when: /roping the drum|levering the drum/, work: [], note: 'the haul\'s gang roping the rough drum down on its sledge at the quarry, or levering it off at the drum ground below the Terrace (C: D-256)' },
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
    variants: [
      // D-256 (G14, GA1, G16): the wild harvests
      { when: /nuts|pistachio|almond/, anim: 'pick', prop: undefined, work: [{ kind: 'basket_nuts', at: [-0.32, 0, 0.42] }], note: 'gathering wild pistachios and almonds off the scrub of the slopes into a basket, August and September (plain.json crops.pistachio_almond "nuts gathered Aug-Sep", the pollen B; the gathering C: D-256)' },
      { when: /acorns/, note: 'gathering the acorns of the oaks of the slopes into a basket on the hip, in the autumn, for flour and for the animals (Zagros oak woodland, RECOLLECTION NOT SEEN; C: D-256)' },
      { when: /garlic/, note: 'collecting wild garlic and onions on the steppe in the month named for it, Θāigraciš, "garlic-collecting" (the month name: A; the act C: D-256)' },
      { when: /shaping|cakes/, anim: 'pat', prop: undefined, work: [{ kind: 'dung_cakes', at: [0.5, 0, 0.35] }], note: 'shaping dung cakes for the fire and setting them out to dry (C)' }] },
  brew: { anim: 'stir', prop: 'paddle', tier: 'C', work: [{ kind: 'vat', at: [0, 0, 0.72] }], note: 'brewing beer from tarmu (PF 40 “he made beer”: A for the work): stirring the mash in a vat with a paddle (C)' },
  tend_animals: { anim: 'groom', prop: 'wisp', tier: 'C', animals: { kind: 'beside', species: ['donkey'] }, work: [{ kind: 'fodder', at: [0.95, 0, 1.55] }],
    note: 'seeing to the household’s animals: rubbing down and feeding (donkeys and horses are attested with rations, POTTS2023: B; the work C)',
    variants: [
      // D-210 (gap audit item 6): a driver holding his string or his cart while the loads come off (world/traffic.ts)
      { when: /holding the string/, anim: 'hold_lead', prop: 'lead', work: [], animals: { kind: 'string', species: ['donkey_pack', 'donkey_pack', 'mule_pack', 'donkey_pack', 'donkey_pack'], n: 5, pace: 0, side: -0.9, lead: -1.2 },
        note: 'a driver holding his string of pack animals while the loads are taken off (C)' },
      { when: /holding the camels/, anim: 'hold_lead', prop: 'lead', work: [], animals: { kind: 'string', species: ['camel_pack'], n: 4, pace: 0, gap: 1.2, side: -1.1, lead: -1.5 },
        note: 'a camel driver holding his string while the loads are taken off (C)' },
      { when: /holding the timber cart/, anim: 'hold_lead', prop: 'goad', work: [{ kind: 'cart_timber', at: [0, 0, -4.7] }], animals: { kind: 'draught', species: ['ox', 'ox'], pace: 0 },
        note: 'a carter standing by his oxen while the beams are levered off at the drum ground (C)' },
      { when: /holding the stone cart/, anim: 'hold_lead', prop: 'goad', work: [{ kind: 'cart_stone', at: [0, 0, -4.7] }], animals: { kind: 'draught', species: ['ox', 'ox'], pace: 0 },
        note: 'a carter holding his yoked oxen while the block is levered off his cart (s17 V3, C3’s ask; C)' },
      { when: /holding the ox cart/, anim: 'hold_lead', prop: 'goad', work: [{ kind: 'cart', at: [0, 0, -4.7] }], animals: { kind: 'draught', species: ['ox', 'ox'], pace: 0 },
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
      // D-256: the animals penned against the wolves (session 9's wolves: world/beasts.ts), the cattle and the flocks
      { when: /folding it|in the fold|the fold\b/, anim: 'fodder', prop: 'basket_hip', animals: { kind: 'fold', species: SHEEP, n: 20 }, work: [FOLD],
        note: 'the flock penned in a fold of thorn brush against the wolves and fed from a basket (folds of brush and stone for the night: pastoral practice across the Zagros, RECOLLECTION NOT SEEN; C: D-256)' },
      { when: /drum sledge|drum ground/, anim: 'fodder', prop: 'basket_hip', animals: { kind: 'fold', species: ['ox'], n: 4 }, work: [{ kind: 'drum_haul', at: [-2.6, 0, 0.6] }],
        note: 'unyoking the oxen by the drum sledge at the day\'s halt and giving them straw and water (C: D-256)' },
      { when: /out and giving them water/, anim: 'fodder', prop: 'basket_hip', animals: { kind: 'flock', species: ['sheep', 'goat', 'sheep'], n: 4 }, work: [], note: 'letting the household’s animals out and giving them fodder and water (C)' },
      { when: 0.35, animals: { kind: 'beside', species: ['ox'] }, note: 'seeing to the household’s ox (cattle are not in population.json: Q-193; C)' }] },
  herd: { anim: 'herd', prop: 'staff', tier: 'C', animals: { kind: 'flock', species: SHEEP, n: 12, dogs: 2 }, sound: 'bleat',
    variants: [
      // D-256 (G17; A024, P-012): the village cattle, out by turns with a man of the village or a boy of a house with a cow
      { when: /cows|cattle|calves/, sound: undefined, animals: { kind: 'flock', species: CATTLE, n: 8, dogs: 1 },
        note: 'herding the village cows and calves on the river meadow and the fallow, a dog with them (cattle breed the plough oxen of the plain, E-40; the herd, its size and its grounds C: D-256). Their lowing is theirs (crowd.ts: a low now and then, the strike low)' },
      // D-256: the flock watched at night in its fold (the bands' watch by turns: E-49; the fold C)
      { when: /in the night|by turns/, animals: { kind: 'fold', species: SHEEP, n: 24, pace: 1, dogs: 2 }, work: [FOLD],
        note: 'watching the flock penned in its thorn fold through the night, by turns, with the dogs, against the wolves (the watch: E-49 herders and dogs, C; the fold C: D-256)' },
      // D-292 (GC27, C-D38): a herd boy turns a stray back or scares off a dog or a wolf with a stone from his sling
      { when: 0.45, anim: 'sling', prop: 'lead', sex: 'm', ages: [8, 17],
        note: 'a herd boy with his sling, now and then whirling a stone about his head and letting it go at a stray at the flock\'s edge (slings and sling stones are common finds of the Near East, and slingers are named among the Achaemenid troops: B analogy; the herd boy\'s use C: D-292)' }],
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
  clean: { anim: 'sweep', prop: 'broom', sound: 'broom', tier: 'C', note: 'sweeping the closed palaces and the stalls with a twig broom (C)',
    variants: [
      // D-359: a house that burnt (economy/plans.ts house_fire)
      { when: /burnt beams/, work: [{ kind: 'beam', at: [1.0, 0, 0.4] }], note: 'clearing the ash and the charred beams of a burnt roof out of the house with a broom, a blackened beam dragged out beside (house fires: C; D-359)' },
      { when: /^readying the (new )?house/, note: 'sweeping out the new house for the bride, the mats laid, the jars set out (C: D-211)' }] },
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
    note: 'washing clothes and wool at the water: rinsed, beaten on a stone, wrung, hung to dry (C)',
    // D-292 (gap hunter C, C-D46): a Persian or a guard does it on the bank from a jar, never in the stream
    variants: [{ when: /on the bank, with water drawn up in a jar/, work: [{ kind: 'wash_stone', at: [0, 0, 0.55] }, { kind: 'jar', at: [0.62, 0, 0.3] }, { kind: 'drying_rack', at: [1.7, 0, -0.6] }],
      note: 'washing clothes on the bank with water drawn up from the stream in a jar, rinsed and beaten on a stone well back from the water, wrung, hung to dry: the Persians neither wash in a river nor let others do so (Herodotus 1.138, a Greek claim: B; the jar and the place C: D-292)' }] },
  train: { anim: 'archery', prop: 'bow', prop2: 'arrow', sound: 'bow', tier: 'B', work: [{ kind: 'target', at: [0, 0, 22] }],
    note: 'boys of households of standing learning to shoot with the bow (HDT 1.136, a Greek claim: B; XEN-CYR 1.2.15; Q-146): shooting at a straw target at 22 m (C)',
    variants: [{ when: 0.35, anim: 'ride', prop: undefined, prop2: undefined, sound: undefined, work: [], animals: { kind: 'mount', species: ['horse_saddle'], pace: 0 },
      note: 'a boy of a household of standing learning to ride (HDT 1.136 “taught to ride”, a Greek claim: B), sitting a standing horse on a saddle cloth, no stirrups (blocklist; D-210; C)' }] },
  cook: { anim: 'cook', prop: 'ladle', prop2: 'stick', sound: 'fire', tier: 'C', work: [{ kind: 'hearth_pot', at: [0, 0, 0.58] }, { kind: 'brushwood', at: [-0.75, 0, 0.12] }],
    note: 'at dusk the hearth fire is lit and the evening meal warmed: squatting at the hearth, stirring the pot, feeding sticks under it (§9.2; C). The fire itself is the settlement’s hearth',
    variants: [{ when: /meat of the offering/, work: [{ kind: 'hearth_pot', at: [0, 0, 0.58] }, { kind: 'brushwood', at: [-0.75, 0, 0.12] }, { kind: 'grass_bed', at: [0.95, 0, 0.45] }],
      note: 'boiling the meat of a sacrifice in a pot on a small fire of brushwood at the precinct, the soft grass laid ready beside (Herodotus 1.132 "after boiling the flesh, spreads the softest grass", read, a Greek claim: B; the fire is the pot\'s, not an altar fire: C, D-209)' }] },
  // ============================================ D-255: the crafts and the records (WORLD_INVENTORY G20, G26-G29, GB4, GB13; research/CRAFTS.md)
  smith: { anim: 'smith', prop: 'hammer', prop2: 'tongs', sound: 'hammer', tier: 'C',
    work: [{ kind: 'anvil', at: [0.02, 0, 0.55] }, { kind: 'bellows_stand', at: [0.36, 0, 0.3] }, { kind: 'jar', at: [-0.4, 0, 0.62] }],
    note: 'a smith at the forge of a metal workshop: the bar held at a red heat in the tongs on the anvil and hammered, turned, hammered; laid back in the fire of the workshop’s forge on his left while he works the bag bellows with his right hand; every third heat quenched in the water jar first. The sounds are the blows, the bellows’ breath and the hiss of the quench (metal workshops among the Treasury’s craftsmen, PT: B; iron-working in the period B; the smith’s forms and motions C: research/CRAFTS.md)',
    variants: [{ when: /bellows/, anim: 'bellows', prop: undefined, prop2: undefined, sound: 'bellows', work: [{ kind: 'bellows', at: [0, 0, 0.42] }],
      note: 'working the pair of bag bellows at the forge for the smith, squatting, the bags pressed in turn with the hands, their clay nozzles into the fire (bag bellows: Egyptian tomb paintings, B by analogy, there trodden; C)' }] },
  goldsmith: { anim: 'chasing', prop: 'punch', prop2: 'hammer_s', sound: 'chase', tier: 'B', work: [{ kind: 'stake', at: [0, 0, 0.42] }],
    note: 'a goldsmith of the Treasury chasing a silver bowl on a stake set in a block: a punch held on the metal in the left hand and tapped with a small hammer, moved on along the line (goldsmiths among the Treasury craftsmen, PT: B; chased and repoussé vessels of the period B; the stake and the motion C)',
    variants: [{ when: /raising|forging/, prop: undefined, note: 'a goldsmith raising a sheet of gold or silver into a bowl over the stake, the left hand turning it under the small hammer’s blows (PT goldsmiths: B; the work C)' }] },
  weigh: { anim: 'weigh', prop: 'balance', sound: 'clink', tier: 'B', work: [{ kind: 'weigh_table', at: [0, 0, 0.45] }],
    note: 'weighing silver on a hand balance at the Treasury: the balance held up by its cord, a stone weight or the silver laid in a pan, the beam watched until it settles; the weights graded in a row on the table (silver paid by weight in lieu of rations, PT via E-05: B; inscribed stone weights of Darius from the Treasury: RECOLLECTION, NOT SEEN; the balance’s form C). Was performed as `inspect`, hands clasped, with nothing in them (REVIEWS/escapes.md)' },
  seal: { anim: 'seal', prop: 'tablet', prop2: 'seal_cyl', tier: 'B',
    note: 'sealing a clay tablet: the tablet on the left palm, a cylinder seal rolled across it under the fingers of the right hand, the edge turned and rolled too (the rollings on the Fortification and Treasury tablets, PFS: A; the posture C). Silent',
    variants: [{ when: /jars|sacks|stopper|store/, anim: 'seal_jar', prop: 'seal_cyl', prop2: undefined, work: [{ kind: 'sealed_jars', at: [0, 0, 0.45] }],
      note: 'sealing the store’s jars and sacks: a lump of clay pressed over the stopper and the cord and a seal rolled over it (sealings of jars and sacks: A as objects; RECOLLECTION of the Treasury’s finds, NOT SEEN; C). Silent' }] },
  cut_seal: { anim: 'drill', prop: 'drill_bow', sound: 'drill', tier: 'C', work: [{ kind: 'seal_bench', at: [0, 0, 0.38] }],
    note: 'a seal cutter at his block working a stone cylinder with the bow drill, the drill’s cap pressed down with the left hand, the bow drawn back and forth, wet sand for the cutting (seals by the thousand on the tablets, PFS: A; their cutting at Persepolis and the workers C: WORLD_INVENTORY G29)' },
  tan: { anim: 'scrape', prop: 'scraper', sound: 'scrape', tier: 'C', work: [{ kind: 'tan_beam', at: [0, 0, 0] }, { kind: 'hide_frames', at: [2.6, 0, 1.2], shared: 'place' }],
    note: 'a tanner at the beam: a hide over the sloping log, the flesh and then the hair scraped off with a two-handled scraper; the drying frames, the lime heap and the stained ground of the tannery about him (hides of the slaughter to the Treasury and its workshops: PF 58-60, CE-07: A; tanning and its methods C). The flies are heard there (D-210 flies)',
    variants: [{ when: /soaking|vat|liquor/, anim: 'stir', prop: 'paddle', sound: undefined, work: [{ kind: 'tan_vat', at: [0, 0, 0.72] }, { kind: 'hide_frames', at: [2.6, 0, 1.2], shared: 'place' }],
      note: 'turning the hides in the tanning vat with a pole (C)' }] },
  press_oil: { anim: 'pound', prop: 'pestle', sound: 'pound', tier: 'C', work: [{ kind: 'oil_press', at: [0, 0, 0.42] }, { kind: 'oil_jars', at: [1.2, 0, 0.5], shared: 'place' }],
    note: 'pounding roasted sesame in a stone mortar with a long pestle, for its oil (sesame in the Fortification texts, PF 56: A; sesame oil the Near East’s lamp and cooking oil: B by analogy; the pounding and the hot-water method C: research/CRAFTS.md)',
    variants: [{ when: /skimming|hot water|the oil off/, anim: 'cook', prop: 'ladle', prop2: 'stick', sound: 'fire', work: [{ kind: 'hearth_pot', at: [0, 0, 0.58] }, { kind: 'brushwood', at: [-0.75, 0, 0.12] }, { kind: 'oil_jars', at: [1.2, 0, 0.5], shared: 'place' }],
      note: 'the crushed sesame worked in hot water over a small fire and the oil skimmed off the top into the jars with a ladle (C)' }] },
  // ============================================ D-256: the work on the land (WORLD_INVENTORY G12-G17, G30; every motion C)
  milk: { anim: 'shear', tier: 'C', animals: { kind: 'beside', species: ['cow'] }, work: [{ kind: 'milk_pot', at: [0.12, 0, 0.42] }],
    note: 'milking the household\'s cow into a pot, kneeling at her flank in the courtyard at first light and in the evening (milk, curds and butter of the villages: the "bread and curds" of the herders\' meals; the cow and the hours C: D-256)' },
  fish: { anim: 'hold_lead', prop: 'lead', sound: 'water', tier: 'C', work: [{ kind: 'basket_fish', at: [0.55, 0, -0.25] }],
    note: 'fishing from the bank with a hand line (the line into the water is not drawn beyond an arm\'s length), the catch in a basket beside him: the barbels and carp of the Kur basin (fish in the rivers: RECOLLECTION NOT SEEN; lines, the catch and the place C: D-256)',
    variants: [
      { when: /trap/, anim: 'pick', prop: undefined, work: [{ kind: 'fish_trap', at: [0, 0, 0.75] }, { kind: 'basket_fish', at: [0.55, 0, -0.25] }],
        note: 'lifting and baiting a wicker fish trap set in the water at the bank (wicker traps: the river fishing of the region, RECOLLECTION NOT SEEN; C: D-256)' }] },
  fowl: { anim: 'pick', tier: 'C', work: [{ kind: 'snare', at: [0, 0, 0.55] }, { kind: 'snare', at: [1.3, 0, 1.4] }],
    note: 'setting horsehair nooses on a pegged line for partridge, quail and sandgrouse at the field edge and the reeds (snaring: the commoners\' fowling of the plateau, RECOLLECTION NOT SEEN; C: D-256)',
    variants: [
      { when: /\bbow\b/, anim: 'archery', prop: 'bow', prop2: 'arrow', sound: 'bow', work: [], ages: [14, 90], note: 'shooting at the waterfowl in the reeds with the bow (HDT 1.136, a Greek claim, for the bow: B; the fowling C: D-256)' },
      { when: /\bbow\b/, anim: 'archery', prop: 'toy_bow', prop2: 'arrow', sound: 'bow', work: [], note: 'a boy shooting at the small birds of the reeds with his small bow (C: D-256)' }] },
  quarry: { anim: 'chisel', prop: 'mallet', sound: 'chisel', tier: 'C', work: [{ kind: 'drum_rough', at: [0, 0, 0.95] }],
    note: 'a quarryman roughing out a column drum at the quarry with mallet and point, the drum still over-size for the masons to finish at the Terrace (the drums finished on the Terrace: construction.ts, B; roughing at the quarry C: D-256)',
    variants: [
      { when: /cutting the channel/, anim: 'hoe', prop: 'adze', work: [{ kind: 'spoil', at: [-1.1, 0, 0.4] }],
        note: 'cutting the channel round the next drum in the bench with a quarry pick (channels cut round the block and wedges driven under it: the ancient quarrying method, RECOLLECTION NOT SEEN; C: D-256)' },
      { when: /loading/, anim: 'haul', prop: 'rope', sound: undefined, work: [],
        note: 'levering and roping a rough drum onto the sledge for the haul to the Terrace, round the sledge the driver stands by (the drum and sledge are the haul\'s: world/traffic.ts; C: D-256)' }] },
  bees: { anim: 'pick', tier: 'C', work: [{ kind: 'hives', at: [0, 0, 0.9] }],
    note: 'seeing to the hives: clay-pipe hives stacked in a low wall in the garden, the ends opened and looked into; the buzz of the bees comes from the hives (crowd.ts, the strike buzz) (honey in the PF texts: RECOLLECTION NOT SEEN; the clay-pipe hive of Iran and the Near East, recollection; C: D-256)',
    variants: [{ when: /honey|comb/, prop: 'knife', work: [{ kind: 'hives', at: [0, 0, 0.9] }, { kind: 'jar', at: [0.6, 0, 0.1] }], note: 'taking the honey: the combs cut from the back of the pipe hives with a knife into a jar, some left for the bees for the winter (C: D-256)' }] },
  // ============================================ D-292: the body's care (gap hunter C, C-D04..C-D07; population.ts care; every motion C)
  tend_body: { anim: 'wash_face', sound: 'water', tier: 'C', work: [{ kind: 'basin', at: [0, 0, 0.42] }],
    note: 'washing the face and hands at rising, kneeling over a clay basin by the house\'s water jar, the water scooped up in both hands and poured from a small jug; never in running water (the Persians\' care for water, Herodotus 1.138, a Greek claim: B; the daily custom and the basin C: D-292)',
    variants: [
      { when: /^picking the lice/, anim: 'delouse', sound: undefined, work: [],
        note: 'going through a child\'s hair for lice on the doorstep, the child sitting in front of her; the fingers part the hair and pick (lice combs of wood and bone are ordinary finds of the period: B analogy; a comb is not drawn; the doorstep and the hour C: D-292)' },
      { when: /^having (his|her) hair gone through/, anim: 'sit', sound: undefined, work: [], note: 'a child sitting still on the doorstep while its hair is gone through for lice (C: D-292)' },
      { when: /^shaving men/, anim: 'shave', prop: 'knife', sound: undefined, work: [{ kind: 'jar', at: [-0.42, 0, 0.3] }],
        note: 'the quarter\'s barber kneeling up in the lane in front of a man sitting on the ground, a bronze razor in his right hand, his left steadying the head, the razor rinsed in a water jar (barbers, gallabu, in the Neo-Babylonian texts: B analogy; bronze razors are known finds of the region: RECOLLECTION, NOT SEEN; the man, the lane and the hour C: D-292)' },
      { when: /^being shaved/, anim: 'sit', sound: undefined, work: [], note: 'a man sitting on the ground in the lane, his beard trimmed or his cheeks shaved by the quarter\'s barber (C: D-292)' },
      // D-347 (wardrobe/washing.ts): the body washed every few days (C: no text gives the rate)
      { when: /^bathing at home/, work: [{ kind: 'basin', at: [0, 0, 0.42] }, { kind: 'jar', at: [0.55, 0, 0.2] }], note: 'bathing in the courtyard: kneeling by a clay basin, the water poured over the head and body from a jug and wiped off with a cloth, the used water thrown on the ground, never into running water (C: D-347; the Persians\' care for water, Herodotus 1.138, a Greek claim: B)' },
      { when: /^bathing in the canal/, work: [], note: 'men and boys of the non-Persian households bathing in the quarter\'s canal in the warm months, crouching in the shallows and washing the dust off with both hands (C: D-347; the Persians keep out of running water, B as above)' }] },
  // D-199 (court setting only): the king as the door-jamb and audience reliefs show him, and the two attendants behind him
  royal_walk: { anim: 'walk', moving: true, prop: 'sceptre', prop2: 'lotus', sound: 'footsteps', tier: 'B', note: 'the king walking, the long staff in his right hand and a lotus in his left (door-jamb reliefs of the Tachara and the Hadish, HADISH-JAMB: B); the gait and the pace C' },
  enthroned: { anim: 'enthroned', prop: 'sceptre', prop2: 'lotus', tier: 'B', work: [{ kind: 'throne', at: [0, 0, 0] }], note: 'the king enthroned at an audience, staff and lotus in his hands, his feet on the footstool (the Treasury audience relief, TREAS-AUD: B); where the throne stood in the Apadana and the hours C; the king does not move or speak (brief §1.1 restraint)' },
  bear_parasol: { anim: 'guard_walk', moving: true, prop: 'parasol', sound: 'footsteps', tier: 'B', note: 'an attendant walking behind the king holding the parasol over him (door-jamb reliefs: B); the parasol’s size and cloth C; the two are not held in step (each walks the view’s own route: C)' },
  attend_parasol: { anim: 'guard', prop: 'parasol', tier: 'C', note: 'the parasol bearer standing by while the king sits (C: indoors the reliefs show a canopy, not the parasol)' },
  bear_whisk: { anim: 'walk', moving: true, prop: 'whisk', prop2: 'towel', sound: 'footsteps', tier: 'B', note: 'a beardless attendant walking behind the king with a fly-whisk and a towel (door-jamb reliefs: B)' },
  attend_whisk: { anim: 'fan', prop: 'whisk', prop2: 'towel', tier: 'B', note: 'the fly-whisk and towel bearer standing behind the throne (the Treasury audience relief: a beardless attendant with a towel behind the king, TREAS-AUD: B)' },
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
