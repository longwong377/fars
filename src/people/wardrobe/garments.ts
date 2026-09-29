// D-345 (ROADMAP 3d): the garments of 467 BCE Parsa, as the wardrobe draws them. Tiers: A attested (the Persepolis reliefs:
// the pleated Persian robe, the Median riding dress of tunic, trousers, kandys cloak and soft cap), B inferred (the ordinary
// wool/linen knee tunic and the women's long dress and mantle of the Achaemenid-period figurines and the Fortification
// tablets' garment issues, PF 1165/1166-type "garments" rations), C reconstructed (the sleeping shift, the face wrap, the
// counts per household by wealth, dirt and wear rates).
export type Slot = 'body' | 'legs' | 'over' | 'head' | 'sleep';
export type Quality = 'coarse' | 'plain' | 'good' | 'fine';
export type GarmentKind = 'tunic' | 'dress' | 'robe' | 'trousers' | 'kandys' | 'cloak' | 'mantle' | 'cap' | 'wrap' | 'shift' | 'child_tunic';
export interface GarmentDef { kind: GarmentKind; slot: Slot; tier: 'A' | 'B' | 'C'; note: string }
export const GARMENTS: Record<GarmentKind, GarmentDef> = {
  tunic: { kind: 'tunic', slot: 'body', tier: 'B', note: 'knee-length belted wool tunic of working men (Achaemenid-period figurines; tablets’ garment issues)' },
  dress: { kind: 'dress', slot: 'body', tier: 'B', note: 'ankle-length wool or linen dress of women (figurines, the women of the Oxus plaques)' },
  robe: { kind: 'robe', slot: 'body', tier: 'A', note: 'the pleated Persian robe of the reliefs, worn by Persians of standing' },
  trousers: { kind: 'trousers', slot: 'legs', tier: 'A', note: 'Median riding trousers under the tunic (Apadana reliefs)' },
  kandys: { kind: 'kandys', slot: 'over', tier: 'A', note: 'the sleeved Median coat worn over the shoulders (reliefs)' },
  cloak: { kind: 'cloak', slot: 'over', tier: 'B', note: 'a plain wool cloak against the cold (C in cut, B in use)' },
  mantle: { kind: 'mantle', slot: 'head', tier: 'B', note: 'a woman’s mantle over the head and shoulders (figurines)' },
  cap: { kind: 'cap', slot: 'head', tier: 'A', note: 'the soft felt cap with flaps (reliefs)' },
  wrap: { kind: 'wrap', slot: 'head', tier: 'C', note: 'a cloth wrapped over the face against the dust (C; the plans’ dust wear)' },
  shift: { kind: 'shift', slot: 'sleep', tier: 'C', note: 'a plain linen or wool undershift, slept in (C)' },
  child_tunic: { kind: 'child_tunic', slot: 'body', tier: 'C', note: 'a small tunic of a child (C)' },
};
/** how many day garments of the body slot a person owns, by the household's wealth (C) */
export const BODY_COUNT: Record<Wealth, number> = { poor: 2, middle: 3, rich: 5 };
export type Wealth = 'poor' | 'middle' | 'rich';
/** dirt a garment takes per hour of an activity (0..1 scale; 1 = filthy; C) */
export const DIRT_HEAVY = 0.02, DIRT_MEDIUM = 0.008, DIRT_LIGHT = 0.003, DIRT_SLEEP = 0.001, DIRT_DUST = 0.01;
/** wear per day worn and per washing (0..1; 1 = rags; C) */
export const WEAR_DAY = 0.0015, WEAR_WASH = 0.004;
export const HEAVY = new Set(['reap', 'thresh', 'field_work', 'dig_canal', 'mould_brick', 'lay_brick', 'haul', 'plough', 'quarry', 'tan', 'slaughter', 'irrigate', 'carry_sack', 'herd', 'dress_stone', 'bury', 'smith', 'shear']);
export const MEDIUM = new Set(['craft', 'grind', 'knead', 'bake', 'cook', 'weave', 'spin', 'draw_water', 'tend_animals', 'garden_work', 'work_wood', 'clean', 'gather', 'brew', 'pick_fruit', 'press_oil', 'milk', 'fish', 'carry_jar', 'carry_jar_head', 'tend_fire', 'wash', 'play']);
/** dyes by wealth (keys of looks.ts DYES where they exist; C) */
export const DYE_BY_WEALTH: Record<Wealth, string[]> = { poor: ['wool', 'wool', 'brown', 'grey', 'linen'], middle: ['wool', 'linen', 'madder', 'weld', 'woad', 'ochre'], rich: ['madder', 'kermes', 'woad', 'weld', 'purple', 'turquoise'] };
