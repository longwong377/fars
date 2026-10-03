// Animals the work needs (D-142): sheep and goats for the herd, shearing, lambing and the stockyard; the ox pair of the
// plough and the threshing floor; the donkey and horse of the household and the road station. Species from the evidence
// (population.json `animals`, research/PEOPLE.md P5.7: sheep_goat A, horse B, donkey B; cattle are NOT in population.json
// although the plans yoke oxen: Q-193); shapes, sizes and coats are C (procedural, not scans).
// D-210 (the gaps of REVIEWS/gap_audit.md items 5, 6, 11, 15, 16, 17): the dogs (population.json `dog`), the mule and the
// camels (population.json `mule`, `camel`; the Bactrian camel and the dromedary of the Apadana reliefs), the delegations'
// humped bull, the fowl (population.json `poultry`), the game of the paradise and the river (fauna.json: fallow deer,
// goitered gazelle, wild boar), and the gear of the animals that travel: panniers and sacks on the pack animals, a saddle
// cloth on a ridden horse (no stirrups: blocklist). Every one of these forms is C; the species' tiers are in ANIMAL_BUILD
// and src/data/fauna.json.
// Each animal is a simple rig: a body, a neck and head that pitch down to graze, four legs of two segments that swing in
// a lateral walk (hind-fore-hind-fore) and fold when lying, a tail that swishes. The fowl are the same rig on two legs (the
// head pitches down to peck). The rig runs in the vertex shader from per-vertex part weights and pivots and a per-instance
// state (gait phase, walk, graze, lie), with the same arithmetic on the CPU (deformAnimal) for tests and previews. One
// InstancedMesh per species: a draw per species in view.
// Placement (animalsFor) is closed-form in time from the performer's spot, like the birds and jackals (D-054): a flock
// grazes about its herder and drifts from spot to spot (its dogs about it), the yoked pair walks the furrow ahead of the
// ploughman, the threshing animals circle the floor, a donkey or horse stands to be rubbed down, a sheep lies to be shorn,
// a string of pack animals walks nose to tail behind its driver, an ox pair draws a cart behind its carter, a horse carries
// its rider.
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, positionGeometry, normalGeometry, modelViewMatrix, texture, uv, varying, mix, vec3, vec4, sin, cos, max, min, abs, sign, exp, fract, step, float, uniform, positionViewDirection, dot, pow, luminance } from 'three/tsl';
import { animalModel } from './animalModels';
import { realRig, realFrame } from './animalReal';
import { WEATHER } from '../render/materials';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { nearCascadesOnly } from './humanGPU';
import { interleave } from './props';
import type { AnimalSpec } from './activities';
import { RIDE } from './anim';

export type Species = 'sheep' | 'goat' | 'ox' | 'donkey' | 'horse' | 'dog' | 'mule' | 'camel' | 'dromedary' | 'zebu' | 'deer' | 'stag' | 'gazelle' | 'gazelle_m' | 'boar' | 'hen' | 'cock'
  | 'donkey_pack' | 'mule_pack' | 'camel_pack' | 'horse_saddle'
  | 'wolf' | 'lion' | 'lioness' | 'cheetah' | 'leopard' | 'hyena' | 'onager' | 'fox' | 'hare' | 'wild_goat' | 'urial' | 'cat'
  // D-256: the cows and calves of the village herds (WORLD_INVENTORY G17)
  | 'cow' | 'calf';
export const SPECIES: Species[] = ['sheep', 'goat', 'ox', 'donkey', 'horse', 'dog', 'mule', 'camel', 'dromedary', 'zebu', 'deer', 'stag', 'gazelle', 'gazelle_m', 'boar', 'hen', 'cock',
  'donkey_pack', 'mule_pack', 'camel_pack', 'horse_saddle', 'wolf', 'lion', 'lioness', 'cheetah', 'leopard', 'hyena', 'onager', 'fox', 'hare', 'wild_goat', 'urial', 'cow', 'calf', 'cat'];
type RGB = [number, number, number];
interface Build { len: number; h: number; girth: number; neck: number; neckA: number; nb?: number; head: number; headR: number; leg: number;
  tail: 'fat' | 'short' | 'long' | 'tuft' | 'hair' | 'curl' | 'hen' | 'cock' | 'brush' | 'cat'; ears: 'small' | 'long' | 'mid' | 'prick' | 'none';
  /** the lion's mane: a ruff about the head and neck (session 9) */
  ruff?: boolean;
  horns?: 'goat' | 'ox' | 'gazelle' | 'antler'; mane?: boolean; coat: RGB[]; stride: number; tier: string; note: string;
  /** the data row the species stands for: population.json `animals` id (the town's animals) or src/data/fauna.json id */
  row: string;
  /** humps (the camels), the zebu's hump at the withers, tusks (the boar), comb and wattles (the fowl), two legs (the fowl) */
  humps?: 1 | 2; withers?: boolean; tusks?: boolean; comb?: 'hen' | 'cock'; biped?: boolean;
  /** D-256: a cow's udder under the hind barrel */
  udder?: boolean;
  /** what it carries: panniers and sacks (pack animals), a saddle cloth (a ridden horse; no stirrups: blocklist) */
  gear?: 'pack' | 'pack_camel' | 'saddle' }
const DONKEY: Build = { len: 1.25, h: 1.08, girth: 0.5, neck: 0.56, neckA: 0.85, nb: -0.1, head: 0.46, headR: 0.1, leg: 0.034, tail: 'tuft', ears: 'long', mane: true, coat: [[0.46, 0.42, 0.37], [0.36, 0.31, 0.26], [0.55, 0.5, 0.44]], stride: 1.1, row: 'donkey',
  tier: 'B species (PFAT 0025 donkeys fed bread: POTTS2023) / C form', note: 'donkey, grey-brown with long ears and an upright mane (C)' };
const HORSE: Build = { len: 1.55, h: 1.38, girth: 0.6, neck: 0.8, neckA: 0.95, nb: -0.15, head: 0.56, headR: 0.1, leg: 0.036, tail: 'hair', ears: 'mid', mane: true, coat: [[0.35, 0.2, 0.12], [0.45, 0.28, 0.15], [0.22, 0.15, 0.11]], stride: 1.6, row: 'horse',
  tier: 'B species (horse rations: POTTS2023; relay horses HDT 8.98, a claim) / C form', note: 'horse, small by later standards (withers 1.38 m, C), bay or chestnut' };
const MULE: Build = { len: 1.45, h: 1.3, girth: 0.56, neck: 0.7, neckA: 0.9, nb: -0.13, head: 0.54, headR: 0.1, leg: 0.035, tail: 'hair', ears: 'long', mane: true, coat: [[0.3, 0.2, 0.13], [0.24, 0.17, 0.12], [0.4, 0.3, 0.22]], stride: 1.45, row: 'mule',
  tier: 'C species (population.json mule, MATCULT-R: pack transport, count C) / C form', note: 'mule: a horse’s body with the ass’s long ears and tufted-looking tail hair (C), dark bay' };
const CAMEL: Build = { len: 1.9, h: 1.85, girth: 0.8, neck: 0.95, neckA: 0.42, nb: -0.22, head: 0.5, headR: 0.11, leg: 0.05, tail: 'tuft', ears: 'small', humps: 2, coat: [[0.55, 0.42, 0.28], [0.45, 0.33, 0.22], [0.62, 0.5, 0.36]], stride: 1.9, row: 'camel',
  tier: 'B imagery (the Bactrian camels of the Apadana delegations, APA-RELIEF) / C: population.json camel 0-20 “caravans from outside Fars” (MATCULT-R); no PF text retrieved', note: 'Bactrian (two-humped) camel, woolly brown (form, size and coat C)' };
export const ANIMAL_BUILD: Record<Species, Build> = {
  sheep: { len: 0.95, h: 0.68, girth: 0.44, neck: 0.32, neckA: 0.6, head: 0.26, headR: 0.075, leg: 0.028, tail: 'fat', ears: 'small', coat: [[0.78, 0.72, 0.6], [0.7, 0.62, 0.5], [0.42, 0.33, 0.25], [0.2, 0.17, 0.15]], stride: 0.75, row: 'sheep_goat',
    tier: 'A species (PF 58-60, the state flocks) / C form', note: 'sheep, fat-tailed, small (form, size and coat C; the fat tail is a recollection of the region’s breeds, NOT SEEN)' },
  goat: { len: 0.85, h: 0.7, girth: 0.36, neck: 0.33, neckA: 0.75, head: 0.24, headR: 0.065, leg: 0.025, tail: 'short', ears: 'mid', horns: 'goat', coat: [[0.18, 0.15, 0.13], [0.33, 0.25, 0.18], [0.5, 0.45, 0.4]], stride: 0.75, row: 'sheep_goat',
    tier: 'A species (PF 58-60: goats among the small cattle) / C form', note: 'goat with back-curved horns (form and coat C)' },
  ox: { len: 1.85, h: 1.22, girth: 0.74, neck: 0.5, neckA: 0.5, nb: -0.12, head: 0.46, headR: 0.13, leg: 0.05, tail: 'tuft', ears: 'mid', horns: 'ox', coat: [[0.42, 0.26, 0.16], [0.3, 0.2, 0.13], [0.52, 0.36, 0.22]], stride: 1.5, row: 'cattle',
    tier: 'C (draught cattle: E-40 “draught animals (C)”; not in population.json, Q-193)', note: 'ox, humpless (the zebu is delegation imagery only: MATERIAL_CULTURE); size and coat C' },
  donkey: DONKEY,
  horse: HORSE,
  dog: { len: 0.82, h: 0.6, girth: 0.33, neck: 0.32, neckA: 1.05, nb: -0.05, head: 0.26, headR: 0.07, leg: 0.024, tail: 'curl', ears: 'prick', coat: [[0.62, 0.48, 0.3], [0.3, 0.24, 0.18], [0.78, 0.7, 0.55], [0.16, 0.13, 0.11]], stride: 0.95, row: 'dog',
    tier: 'B species (HDT 1.140: the magi kill every creature “except dogs and men”, a claim; population.json dog 100-400, C) / C form', note: 'dog of the pariah and herding type, tawny, black or cream, pricked ears and a curled tail (form and coat C: no Persepolis image of a dog was retrieved; Assyrian mastiff reliefs and the Persian-period dog burials at Ashkelon are recollections, NOT SEEN)' },
  mule: MULE,
  camel: CAMEL,
  dromedary: { ...CAMEL, len: 1.85, h: 1.9, girth: 0.72, humps: 1, coat: [[0.72, 0.6, 0.44], [0.64, 0.52, 0.38], [0.8, 0.7, 0.55]], stride: 2.0,
    tier: 'B imagery (the Arabs’ dromedary of the Apadana reliefs, APA-RELIEF) / C form', note: 'dromedary (one hump), pale (form, size and coat C); court setting: an Arab delegation’s animal' },
  zebu: { len: 1.75, h: 1.22, girth: 0.68, neck: 0.48, neckA: 0.5, nb: -0.12, head: 0.46, headR: 0.12, leg: 0.046, tail: 'tuft', ears: 'mid', horns: 'ox', withers: true, coat: [[0.7, 0.64, 0.56], [0.5, 0.42, 0.34], [0.38, 0.3, 0.24]], stride: 1.45, row: 'delegation_animals',
    tier: 'B imagery (the humped bull of the Babylonian and Gandaran delegations, APA-RELIEF) / C form', note: 'humped bull (zebu), pale grey (form and coat C); court setting only: a delegation’s gift at the camp' },
  deer: { len: 1.3, h: 0.92, girth: 0.46, neck: 0.55, neckA: 0.95, nb: -0.15, head: 0.3, headR: 0.065, leg: 0.022, tail: 'short', ears: 'mid', coat: [[0.6, 0.4, 0.24], [0.52, 0.34, 0.2], [0.66, 0.46, 0.28]], stride: 1.1, row: 'fallow_deer',
    tier: 'C (Mesopotamian fallow deer in the paradise: analogy with Xenophon’s paradise “full of wild beasts”, Anab. 1.2.7, a claim, RECOLLECTION NOT SEEN; the species’ former range in the Zagros, recollection)', note: 'Mesopotamian fallow deer, hind: rufous with pale spots not modelled (C)' },
  stag: { len: 1.4, h: 0.98, girth: 0.5, neck: 0.58, neckA: 0.95, nb: -0.15, head: 0.32, headR: 0.07, leg: 0.024, tail: 'short', ears: 'mid', horns: 'antler', coat: [[0.56, 0.36, 0.22], [0.5, 0.32, 0.2]], stride: 1.15, row: 'fallow_deer',
    tier: 'C (as the hinds)', note: 'Mesopotamian fallow deer, stag with palmate antlers (C)' },
  gazelle: { len: 0.95, h: 0.68, girth: 0.33, neck: 0.42, neckA: 1.0, nb: -0.15, head: 0.21, headR: 0.052, leg: 0.017, tail: 'short', ears: 'mid', coat: [[0.72, 0.56, 0.38], [0.66, 0.5, 0.33]], stride: 1.0, row: 'goitered_gazelle',
    tier: 'B species (goitered gazelle in the Zagros of Fars: SOUNDSCAPE.md §5, Bamu NP) / C in the paradise (Xenophon’s paradise analogy, RECOLLECTION NOT SEEN)', note: 'goitered gazelle, doe: sandy back, pale belly not modelled; hornless, as the females mostly are (C)' },
  gazelle_m: { len: 1.0, h: 0.72, girth: 0.35, neck: 0.44, neckA: 1.0, nb: -0.15, head: 0.22, headR: 0.055, leg: 0.018, tail: 'short', ears: 'mid', horns: 'gazelle', coat: [[0.7, 0.54, 0.36], [0.64, 0.48, 0.32]], stride: 1.05, row: 'goitered_gazelle',
    tier: 'B species / C (as the does)', note: 'goitered gazelle, buck with lyre-shaped horns (C)' },
  boar: { len: 1.3, h: 0.82, girth: 0.56, neck: 0.18, neckA: 0.15, nb: 0.05, head: 0.44, headR: 0.1, leg: 0.034, tail: 'tuft', ears: 'mid', mane: true, tusks: true, coat: [[0.22, 0.18, 0.15], [0.3, 0.25, 0.2], [0.17, 0.14, 0.12]], stride: 0.95, row: 'wild_boar',
    tier: 'B species (wild boar in the Zagros of Fars: SOUNDSCAPE.md §5, Bamu NP) / C in the Pulvar reeds', note: 'wild boar, dark bristled, with tusks; the young smaller (C)' },
  hen: { len: 0.42, h: 0.32, girth: 0.22, neck: 0.19, neckA: 1.15, nb: 0, head: 0.075, headR: 0.03, leg: 0.009, tail: 'hen', ears: 'none', comb: 'hen', biped: true, coat: [[0.55, 0.36, 0.2], [0.72, 0.56, 0.36], [0.3, 0.22, 0.16], [0.82, 0.76, 0.66]], stride: 0.22, row: 'poultry',
    tier: 'B (PF 2034: 1,044 poultry; fodder for poultry, IR-PET) / C form and breed', note: 'hen of the red-junglefowl type, brown, buff, dark or pale (C: the breed is not known)' },
  cock: { len: 0.46, h: 0.38, girth: 0.24, neck: 0.24, neckA: 1.2, nb: 0, head: 0.08, headR: 0.032, leg: 0.011, tail: 'cock', ears: 'none', comb: 'cock', biped: true, coat: [[0.62, 0.3, 0.12], [0.7, 0.42, 0.16], [0.5, 0.24, 0.1]], stride: 0.26, row: 'poultry',
    tier: 'B (PF 2034 poultry) / C form', note: 'cock of the red-junglefowl type, red-gold with a dark arched tail (C; “the Persian bird” of Aristophanes’ Birds is a recollection, NOT SEEN)' },
  // session 9 (the wild animals of Fars in 467: world/fauna.ts; fauna.json rows with the evidence). Forms from the living
  // species (C: size, proportion and coat); spots, rosettes and stripes are NOT modelled (plain coats: seen mostly far off)
  wolf: { len: 1.15, h: 0.78, girth: 0.36, neck: 0.36, neckA: 1, nb: -0.05, head: 0.3, headR: 0.075, leg: 0.026, tail: 'brush', ears: 'prick', coat: [[0.55, 0.5, 0.42], [0.47, 0.42, 0.35], [0.62, 0.55, 0.44]], stride: 1.25, row: 'wolf',
    tier: 'B species (grey wolf across Iran, the Zagros and Fars: range, RECOLLECTION NOT SEEN) / C form', note: 'grey wolf of the Iranian type, smaller and sandier than the northern wolves; coat pattern not modelled' },
  lion: { len: 1.75, h: 1.05, girth: 0.56, neck: 0.42, neckA: 0.8, nb: -0.08, head: 0.4, headR: 0.145, leg: 0.045, tail: 'cat', ears: 'small', ruff: true, coat: [[0.7, 0.55, 0.36], [0.64, 0.5, 0.33]], stride: 1.4, row: 'lion',
    tier: 'B species (the Asiatic lion in the Mesopotamian and Iranian lowlands and the Fars river valleys into the 20th c.: Dasht-e Arzhan by Shiraz, RECOLLECTION NOT SEEN; lions throughout Achaemenid art: the Persepolis door-jamb reliefs of the royal hero, A) / C form', note: 'Asiatic lion, male: the mane shorter than the African lion\'s (C), tawny' },
  lioness: { len: 1.5, h: 0.92, girth: 0.46, neck: 0.38, neckA: 0.8, nb: -0.08, head: 0.34, headR: 0.12, leg: 0.038, tail: 'cat', ears: 'small', coat: [[0.74, 0.6, 0.4], [0.68, 0.54, 0.36]], stride: 1.3, row: 'lion',
    tier: 'B species (as the lion) / C form', note: 'Asiatic lioness, tawny' },
  cheetah: { len: 1.25, h: 0.8, girth: 0.3, neck: 0.44, neckA: 0.9, nb: -0.05, head: 0.22, headR: 0.07, leg: 0.022, tail: 'cat', ears: 'small', coat: [[0.8, 0.66, 0.44], [0.76, 0.62, 0.42]], stride: 1.5, row: 'cheetah',
    tier: 'B species (the Asiatic cheetah on the open plains of Iran; the last wild ones survive in the central deserts: RECOLLECTION NOT SEEN) / C form', note: 'Asiatic cheetah: long-legged, small-headed; spots and the tear marks NOT modelled; the neck 0.44 m (a real one ~0.3 m) so the head reaches the water: the rig cannot crouch the forelegs to drink (C)' },
  leopard: { len: 1.3, h: 0.66, girth: 0.38, neck: 0.34, neckA: 0.85, nb: -0.05, head: 0.26, headR: 0.085, leg: 0.03, tail: 'cat', ears: 'small', coat: [[0.76, 0.6, 0.38], [0.7, 0.55, 0.34]], stride: 1.1, row: 'leopard',
    tier: 'B species (the Persian leopard in the Zagros, rocky slopes: RECOLLECTION NOT SEEN) / C form', note: 'Persian leopard, pale and large; rosettes NOT modelled' },
  hyena: { len: 1.05, h: 0.78, girth: 0.4, neck: 0.36, neckA: 0.95, nb: -0.08, head: 0.3, headR: 0.09, leg: 0.03, tail: 'brush', ears: 'prick', mane: true, coat: [[0.66, 0.6, 0.48], [0.58, 0.53, 0.42]], stride: 0.95, row: 'striped_hyena',
    tier: 'B species (the striped hyena across Iran, a scavenger at the edges of settlements: RECOLLECTION NOT SEEN) / C form', note: 'striped hyena: a crest of long hair along the back (the mane); stripes and the sloping back NOT modelled' },
  onager: { ...DONKEY, len: 1.35, h: 1.2, girth: 0.5, coat: [[0.74, 0.6, 0.44], [0.7, 0.56, 0.4], [0.78, 0.64, 0.48]], stride: 1.3, row: 'onager',
    tier: 'B species (the Persian onager on the steppes of Iran; hunted by the Achaemenid and Assyrian kings: the Nineveh reliefs, recollection; RECOLLECTION NOT SEEN) / C form', note: 'Persian onager (wild ass): sandy with a pale belly (belly NOT modelled), a dark dorsal stripe NOT modelled' },
  fox: { len: 0.68, h: 0.4, girth: 0.22, neck: 0.23, neckA: 1, nb: -0.05, head: 0.2, headR: 0.055, leg: 0.015, tail: 'brush', ears: 'prick', coat: [[0.72, 0.42, 0.22], [0.66, 0.44, 0.28]], stride: 0.7, row: 'red_fox',
    tier: 'B species (red fox in Fars: research/SOUNDSCAPE.md §5) / C form', note: 'red fox, rufous with a bushy tail (white tip and dark legs NOT modelled)' },
  // s18 C14 (D-790; D-771 unblocked the cat): the town's mousers
  cat: { len: 0.46, h: 0.26, girth: 0.15, neck: 0.1, neckA: 0.85, nb: -0.05, head: 0.1, headR: 0.04, leg: 0.012, tail: 'cat', ears: 'small', coat: [[0.48, 0.42, 0.34], [0.62, 0.5, 0.36], [0.3, 0.27, 0.24], [0.7, 0.62, 0.5]], stride: 0.42, row: 'cat',
    tier: 'C (D-771: the domestic cat kept in Egypt for millennia and known in the Near East; the town has Egyptian households; mousers in yards and stores probable)', note: 'domestic cat, a mackerel tabby, grey-brown, sandy or dark (the coat C); the body the leopard library model made small (animals_derive.py)' },
  hare: { len: 0.5, h: 0.32, girth: 0.2, neck: 0.1, neckA: 0.6, nb: 0.05, head: 0.13, headR: 0.045, leg: 0.012, tail: 'short', ears: 'long', coat: [[0.62, 0.52, 0.38], [0.56, 0.46, 0.33]], stride: 0.6, row: 'hare',
    tier: 'C (the Cape or European hare of the Iranian plateau: RECOLLECTION NOT SEEN)', note: 'hare, sandy brown, long ears (the hopping gait NOT modelled: it walks)' },
  wild_goat: { len: 1.2, h: 0.85, girth: 0.4, neck: 0.48, neckA: 0.8, head: 0.28, headR: 0.07, leg: 0.028, tail: 'short', ears: 'mid', horns: 'goat', coat: [[0.6, 0.48, 0.34], [0.52, 0.42, 0.3]], stride: 1.0, row: 'wild_goat',
    tier: 'B species (the bezoar wild goat of the Zagros: SOUNDSCAPE.md §5, Bamu NP) / C form', note: 'bezoar wild goat: the males\' long scimitar horns NOT modelled (the domestic goat\'s horns stand in)' },
  urial: { len: 1.15, h: 0.8, girth: 0.4, neck: 0.42, neckA: 0.75, head: 0.27, headR: 0.07, leg: 0.026, tail: 'short', ears: 'small', horns: 'goat', coat: [[0.64, 0.5, 0.36], [0.58, 0.46, 0.32]], stride: 1.0, row: 'wild_sheep',
    tier: 'B species (the wild sheep of the Zagros: SOUNDSCAPE.md §5, Bamu NP) / C form', note: 'wild sheep (urial type): the curled horns and the bib NOT modelled' },
  // D-256 (WORLD_INVENTORY G17; gap hunt A024, P-012): the village cattle. Cows and calves of the small humpless cattle of
  // the plateau (the ox's build, smaller and finer: C); the draught ox of the plough is the castrated male of the same herds
  cow: { len: 1.65, h: 1.12, girth: 0.64, neck: 0.46, neckA: 0.5, nb: -0.12, head: 0.43, headR: 0.115, leg: 0.042, tail: 'tuft', ears: 'mid', horns: 'ox', udder: true,
    coat: [[0.4, 0.25, 0.15], [0.24, 0.17, 0.12], [0.55, 0.4, 0.26], [0.62, 0.55, 0.45]], stride: 1.35, row: 'cattle',
    tier: 'C (cattle in the PF texts: RECOLLECTION, NOT SEEN, Q-193; the village herds of cows and calves C: an ox-ploughing country breeds its oxen, D-256)', note: 'cow, small and humpless, red-brown, dark, dun or pale; an udder under the hind barrel (form, size and coat C)' },
  calf: { len: 0.95, h: 0.78, girth: 0.38, neck: 0.3, neckA: 0.6, nb: -0.08, head: 0.3, headR: 0.08, leg: 0.03, tail: 'tuft', ears: 'mid',
    coat: [[0.46, 0.3, 0.18], [0.3, 0.22, 0.15], [0.6, 0.46, 0.3]], stride: 0.95, row: 'cattle',
    tier: 'C (as the cow)', note: 'calf of a few months, hornless, long-legged for its size (C)' },
  donkey_pack: { ...DONKEY, gear: 'pack', note: 'donkey with a pack saddle, two wicker panniers and a sack across the top (loads and gear C; pack donkeys: POTTS2023, B)' },
  mule_pack: { ...MULE, gear: 'pack', note: 'mule with a pack saddle, panniers and a sack (C)' },
  camel_pack: { ...CAMEL, gear: 'pack_camel', note: 'Bactrian camel with two great sacks slung each side and a bundle between the humps (C)' },
  horse_saddle: { ...HORSE, gear: 'saddle', note: 'horse with a saddle cloth over the back, as the Apadana horses carry (B imagery; cloth, size and colour C); no stirrups (blocklist)' },
};
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** per-vertex rig attributes: aLeg (gait phase offset, is leg, is lower leg, fore 1 / hind −1), aPiv (hip y, z, knee y, z),
 *  aHT (head weight, tail weight, pivot y, z) */
interface Part { g: THREE.BufferGeometry; col: RGB; leg?: [number, number, number, number]; piv?: [number, number, number, number]; ht?: [number, number, number, number] }
function tube(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, seg = 6, caps = true) {
  const L = a.distanceTo(b); const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, !caps).translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())).translate(a.x, a.y, a.z); return g;
}
/** D-326: how far below the horizontal each family carries its head at rest (rad; C, from the living animals: the horse's
 *  and the ass's head hangs steep from the poll, the cattle's, the small stock's, the deer's and the boar's less, the dog's,
 *  the cats' and the camel's nearly level). Q-980: the head has its own joint at the poll (aHT.y < 0: the skull's weight);
 *  grazing it straightens a carriage steeper than GRAZE_PITCH back to it, and the neck's joint brings that muzzle down */
const HEAD_PITCH: Record<string, number> = { equid: 0.95, bovid: 0.8, caprine: 0.75, cervid: 0.7, antelope: 0.65, suid: 0.85, camelid: 0.3, canid: 0.4, felid: 0.35 };
const GRAZE_PITCH = 0.55;
const FAMILY_OF = (sp: Species) => /^(donkey|horse|mule|onager)/.test(sp) ? 'equid' : /^(ox|cow|calf|zebu)$/.test(sp) ? 'bovid' : /^(sheep|goat|wild_goat|urial)$/.test(sp) ? 'caprine' : /^(deer|stag)$/.test(sp) ? 'cervid'
  : /^gazelle/.test(sp) ? 'antelope' : sp === 'boar' ? 'suid' : /^(camel|dromedary)/.test(sp) ? 'camelid' : /^(dog|wolf|fox|hyena)$/.test(sp) ? 'canid' : /^(lion|lioness|cheetah|leopard|cat)$/.test(sp) ? 'felid' : sp === 'hare' ? 'hare' : 'fowl';
/** the neck base (head pivot), the head's centre and direction, and the graze angle that brings the muzzle to the ground */
export function animalFrame(sp: Species) {
  const B = ANIMAL_BUILD[sp], RR = realRig(sp);
  if (RR) return realFrame(RR, GRAZE_PITCH);
  const bodyY = B.h - B.girth * 0.5;
  // the neck root: at the barrel's centre for the small stock, lower at the breast for the big animals (nb, x girth)
  const base = new THREE.Vector3(0, bodyY + B.girth * (B.nb ?? 0.04), B.len * 0.4);
  const top = base.clone().add(new THREE.Vector3(0, Math.sin(B.neckA), Math.cos(B.neckA)).multiplyScalar(B.neck));
  const ha = HEAD_PITCH[FAMILY_OF(sp)] ?? 0.55, hd = new THREE.Vector3(0, -Math.sin(ha), Math.cos(ha)); // the head points forward and down (D-326: at the family's own carriage)
  const muzzle = top.clone().add(hd.clone().multiplyScalar(B.head));
  // grazing, the poll's joint first turns a carriage steeper than GRAZE_PITCH back to it (bend, rad), then the neck's joint
  // pitches about the neck base (x) until that muzzle is 3 cm above the ground
  const g0 = Math.min(ha, GRAZE_PITCH), bend = ha - g0, muzzleG = top.clone().add(new THREE.Vector3(0, -Math.sin(g0), Math.cos(g0)).multiplyScalar(B.head));
  let lo = 0, hi = 1.9; for (let i = 0; i < 30; i++) { const a = (lo + hi) / 2, d = muzzleG.clone().sub(base); const y = base.y + d.y * Math.cos(a) - d.z * Math.sin(a); if (y > 0.03) lo = a; else hi = a; }
  return { bodyY, base, top, hd, muzzle, muzzleG, bend, graze: (lo + hi) / 2 };
}
/** how far ahead of its centre an animal's muzzle meets the ground when it grazes (local z, m): where its fodder lies */
export function grazeReach(sp: Species) { const F = animalFrame(sp), d = F.muzzleG.clone().sub(F.base); return F.base.z + d.y * Math.sin(F.graze) + d.z * Math.cos(F.graze); }
/** the top of the back at z (local, m): the body ellipsoid's upper surface */
const backAt = (B: Build, z: number) => B.h - B.girth * 0.5 + B.girth * 0.52 * Math.sqrt(Math.max(0, 1 - (z / (B.len * 0.5)) ** 2));
/** where a rider sits (animal-local: y of the seat's surface, z of the seat; ANIMAL_BUILD gear included): a horse's rider
 *  just behind the withers on the saddle cloth, a donkey's further back (C) */
export function mountSeat(sp: Species): { y: number; z: number } {
  const B = ANIMAL_BUILD[sp], z = B.len * (sp.startsWith('donkey') ? -0.08 : 0.06);
  // (V5 D-520: a library model's back stands where the build measured it: the gear's lift, or the barrel's top over z = 0)
  const RR = realRig(sp), dy = RR ? RR.gearDy ?? RR.backY - backAt(B, 0) : 0;
  return { y: backAt(B, z) + dy + (B.gear === 'saddle' ? 0.025 : 0), z };
}
/** how far a rider's root is lifted onto the mount (m): the seat's surface minus the riding pose's seat at the rider's
 *  stature (anim RIDE.seatK, measured on the rig: tests/fauna.test.ts) */
export const riderLift = (sp: Species, stature: number) => mountSeat(sp).y - RIDE.seatK * stature;
/** saddle cloth: a grid laid on the back's ellipsoid (+2.5 cm), from side to side over the barrel and 0.36 of the body
 *  long, with a fringe line at the lower edge */
function saddleCloth(B: Build, bodyY: number, zc: number): THREE.BufferGeometry {
  const rx = B.girth * 0.46 * 1.04 + 0.01, ry = B.girth * 0.52 * 1.04 + 0.01, rz = B.len * 0.5 * 1.02, P: number[] = [], nu = 8, nv = 3;
  const pt = (a: number, w: number) => { const z = zc + w * B.len * 0.18, k = Math.sqrt(Math.max(0, 1 - (z / rz) ** 2)); return [rx * Math.sin(a) * k, bodyY + ry * Math.cos(a) * k, z]; };
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a0 = -1.25 + (2.5 * i) / nu, a1 = -1.25 + (2.5 * (i + 1)) / nu, w0 = -1 + (2 * j) / nv, w1 = -1 + (2 * (j + 1)) / nv;
    const A = pt(a0, w0), Bq = pt(a1, w0), C = pt(a1, w1), D = pt(a0, w1); P.push(...A, ...C, ...Bq, ...A, ...D, ...C); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
}
/** D-362: a stand-in part's secondary motion (aJig): soft tissue below `soft` (y), an ear about its root, a load hanging from `load` (y) */
type PartJ = Part & { soft?: number; ear?: THREE.Vector3; load?: number };
export function animalGeometry(sp: Species): THREE.BufferGeometry {
  const B = ANIMAL_BUILD[sp], F = animalFrame(sp), V = THREE.Vector3, parts: PartJ[] = [];
  const white: RGB = [1, 1, 1], dark: RGB = [0.14, 0.12, 0.1], horn: RGB = [0.62, 0.56, 0.44], red: RGB = [0.62, 0.1, 0.08];
  // body (coat colour comes from the instance colour: the geometry is white where the coat is)
  parts.push({ g: new THREE.SphereGeometry(1, 12, 8).scale(B.girth * 0.46, B.girth * 0.52, B.len * 0.5).translate(0, F.bodyY, 0), col: white, soft: F.bodyY - B.girth * 0.1 });
  if (B.tail === 'fat') parts.push({ g: new THREE.SphereGeometry(B.girth * 0.26, 7, 5).scale(1.1, 1, 0.8).translate(0, F.bodyY - B.girth * 0.15, -B.len * 0.5), col: white });
  // humps (camels: two over the fore and hind barrel, one high in the middle for the dromedary) and the zebu's hump
  if (B.humps === 2) for (const z of [0.24, -0.2]) parts.push({ g: new THREE.SphereGeometry(B.girth * 0.27, 8, 6).scale(1, 1.25, 1.1).translate(0, F.bodyY + B.girth * 0.5, z * B.len), col: white });
  if (B.humps === 1) parts.push({ g: new THREE.SphereGeometry(B.girth * 0.36, 9, 6).scale(1, 1.15, 1.35).translate(0, F.bodyY + B.girth * 0.46, -0.02 * B.len), col: white });
  if (B.udder) parts.push({ g: new THREE.SphereGeometry(B.girth * 0.17, 8, 5).scale(1, 0.75, 1.1).translate(0, F.bodyY - B.girth * 0.46, -B.len * 0.22), col: [0.86, 0.62, 0.55], soft: F.bodyY - B.girth * 0.1 });
  if (B.withers) parts.push({ g: new THREE.SphereGeometry(B.girth * 0.2, 7, 5).scale(0.9, 1.3, 1).translate(0, F.bodyY + B.girth * 0.52, 0.3 * B.len), col: white });
  // legs: fore at +z, hind at −z; gait order LH 0, LF .25, RH .5, RF .75 (a lateral walk); the fowl: two legs under the body
  const hipY = F.bodyY - B.girth * 0.12, kneeY = hipY * 0.45;
  const legs: (readonly [number, number, number, number])[] = B.biped ? [[0.3, -0.04, 0.25, -1], [-0.3, -0.04, 0.75, -1]] : [[0.3, 0.34, 0.25, 1], [-0.3, 0.34, 0.75, 1], [0.3, -0.36, 0, -1], [-0.3, -0.36, 0.5, -1]];
  for (const [x, z, ph, fore] of legs) {
    const X = x * B.girth, Z = z * B.len, piv: [number, number, number, number] = [hipY, Z, kneeY, Z + (fore > 0 ? 0.01 : B.biped ? 0.012 : -0.03)];
    parts.push({ g: tube(new V(X, hipY, Z), new V(X, kneeY, piv[3]), B.leg * 1.5, B.leg * 1.05), col: B.biped ? white : white, leg: [ph * 2 * Math.PI, 1, 0, fore], piv });
    parts.push({ g: tube(new V(X, kneeY, piv[3]), new V(X, B.biped ? 0.012 : 0.05, piv[3]), B.leg * 1.0, B.leg * 0.8), col: B.biped ? [0.62, 0.52, 0.3] : white, leg: [ph * 2 * Math.PI, 1, 1, fore], piv });
    if (B.biped) parts.push({ g: new THREE.BoxGeometry(0.035, 0.012, 0.06).translate(X, 0.006, piv[3] + 0.015), col: [0.62, 0.52, 0.3], leg: [ph * 2 * Math.PI, 1, 1, fore], piv }); // toes
    else parts.push({ g: new THREE.BoxGeometry(B.leg * 2.2, 0.05, B.leg * 2.6).translate(X, 0.025, piv[3] + 0.005), col: sp === 'dog' ? white : dark, leg: [ph * 2 * Math.PI, 1, 1, fore], piv });
  }
  // neck and head (head weight 1 about the neck base)
  const ht: [number, number, number, number] = [1, -1, F.base.y, F.base.z]; // (y = -1: the skull, on the poll's joint too)
  parts.push({ g: tube(F.base.clone().add(new V(0, -0.02, -0.04)), F.top, B.girth * (B.biped ? 0.22 : 0.26), B.headR * 1.1, 7), col: white, ht: [1, 0, F.base.y, F.base.z] });
  const hc = F.top.clone().add(F.hd.clone().multiplyScalar(B.head * 0.5));
  parts.push({ g: new THREE.SphereGeometry(1, 9, 6).scale(B.headR * 1.05, B.headR * 1.15, B.head * 0.55).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V(0, 0, 1), F.hd)).translate(hc.x, hc.y, hc.z), col: white, ht });
  const muzzleCol: RGB = sp.startsWith('donkey') ? [1.35, 1.35, 1.35] : B.biped ? [0.72, 0.62, 0.3] : sp === 'dog' || sp === 'boar' ? [0.12, 0.1, 0.09] : [0.7, 0.66, 0.62];
  parts.push({ g: new THREE.SphereGeometry(B.headR * 0.8, 6, 4).translate(F.muzzle.x, F.muzzle.y + 0.01, F.muzzle.z - F.hd.z * 0.03), col: muzzleCol, ht });
  if (B.ears !== 'none') { const earL = B.ears === 'long' ? (sp.startsWith('mule') ? 0.16 : 0.22) : B.ears === 'mid' ? 0.1 : B.ears === 'prick' ? 0.09 : 0.07;
    for (const s of [-1, 1]) { const e0 = F.top.clone().add(new V(s * B.headR * 0.7, B.headR * 0.7, 0));
      const e1 = e0.clone().add(B.ears === 'long' ? new V(s * earL * 0.25, earL * 0.95, -earL * 0.2) : B.ears === 'prick' ? new V(s * earL * 0.3, earL * 0.92, -earL * 0.1) : new V(s * earL * 0.8, earL * 0.4, -earL * 0.2));
      parts.push({ g: tube(e0, e1, 0.02 + earL * 0.12, 0.008, 4), col: white, ht, ear: e0 }); } }
  if (B.horns === 'goat') for (const s of [-1, 1]) { let p = F.top.clone().add(new V(s * 0.03, B.headR * 0.9, 0.02)); const pts = [p]; for (let i = 1; i <= 4; i++) { p = p.clone().add(new V(s * 0.012, 0.045 - i * 0.012, -0.045)); pts.push(p); }
    for (let i = 0; i < 4; i++) parts.push({ g: tube(pts[i], pts[i + 1], 0.016 - i * 0.003, 0.013 - i * 0.003, 4), col: horn, ht }); }
  if (B.horns === 'ox') for (const s of [-1, 1]) { const a = F.top.clone().add(new V(s * B.headR * 0.8, B.headR * 0.6, -0.02)); const b = a.clone().add(new V(s * 0.16, 0.05, 0.03)), c = b.clone().add(new V(s * 0.04, 0.14, 0.06));
    parts.push({ g: tube(a, b, 0.03, 0.022, 5), col: horn, ht }, { g: tube(b, c, 0.022, 0.008, 5), col: horn, ht }); }
  // the gazelle buck's lyrate horns: up and back, then the tips turned up and in (C)
  if (B.horns === 'gazelle') for (const s of [-1, 1]) { const a = F.top.clone().add(new V(s * 0.022, B.headR * 0.9, 0.01)); const b = a.clone().add(new V(s * 0.03, 0.12, -0.06)), c = b.clone().add(new V(-s * 0.012, 0.1, 0.01));
    parts.push({ g: tube(a, b, 0.012, 0.009, 4), col: [0.2, 0.17, 0.14], ht }, { g: tube(b, c, 0.009, 0.004, 4), col: [0.2, 0.17, 0.14], ht }); }
  // the fallow stag's antlers: a beam up and back with a brow tine, ending in a flat palm (C)
  if (B.horns === 'antler') for (const s of [-1, 1]) { const a = F.top.clone().add(new V(s * 0.04, B.headR * 0.8, 0)); const b = a.clone().add(new V(s * 0.1, 0.2, -0.06)), c = b.clone().add(new V(s * 0.06, 0.14, -0.04));
    parts.push({ g: tube(a, b, 0.017, 0.013, 4), col: horn, ht }, { g: tube(a.clone().add(new V(s * 0.02, 0.04, 0)), a.clone().add(new V(s * 0.04, 0.09, 0.1)), 0.009, 0.004, 4), col: horn, ht });
    parts.push({ g: new THREE.BoxGeometry(0.02, 0.2, 0.13).rotateZ(-s * 0.5).translate(c.x, c.y + 0.06, c.z - 0.02), col: horn, ht }, { g: tube(b, c, 0.013, 0.01, 4), col: horn, ht }); }
  // the boar's tusks, curving up at the corners of the snout
  if (B.tusks) for (const s of [-1, 1]) { const a = F.muzzle.clone().add(new V(s * B.headR * 0.55, 0.0, -0.06)); parts.push({ g: tube(a, a.clone().add(new V(s * 0.02, 0.06, 0.03)), 0.011, 0.004, 4), col: [0.9, 0.86, 0.76], ht }); }
  // the fowl's comb and wattles (red)
  if (B.comb) { const ck = B.comb === 'cock' ? 1 : 0.55; parts.push({ g: new THREE.BoxGeometry(0.008, 0.04 * ck, 0.06 * ck).translate(F.top.x, F.top.y + B.headR * 0.9 + 0.012 * ck, F.top.z + 0.012), col: red, ht });
    parts.push({ g: new THREE.SphereGeometry(0.012 * ck + 0.004, 5, 3).scale(0.6, 1.2, 0.8).translate(F.muzzle.x, F.muzzle.y - 0.02, F.muzzle.z - 0.03), col: red, ht }); }
  if (B.mane) parts.push({ g: tube(F.base.clone().add(new V(0, B.girth * 0.22, -0.02)), F.top.clone().add(new V(0, B.headR * 0.9, -0.03)), 0.035, 0.025, 4).scale(0.55, 1, 1), col: sp.startsWith('donkey') ? [0.5, 0.5, 0.5] : sp === 'boar' ? [0.12, 0.1, 0.09] : [0.35, 0.3, 0.28], ht: [0.85, 0, F.base.y, F.base.z] });
  // the lion's mane (session 9): a ruff about the head and neck, darker than the coat (C)
  if (B.ruff) { const mc = F.base.clone().lerp(F.top, 0.55); parts.push({ g: new THREE.SphereGeometry(1, 9, 7).scale(B.headR * 2.1, B.headR * 2.3, B.head * 0.95).translate(mc.x, mc.y + B.headR * 0.2, mc.z - 0.04), col: [0.38, 0.25, 0.14], ht }); }
  // tail (weight 1 about its root)
  const tr = new V(0, F.bodyY + B.girth * 0.25, -B.len * 0.5), tht: [number, number, number, number] = [0, 1, tr.y, tr.z];
  if (B.tail === 'curl') { // the dog's tail carried up over the back in a loose curl
    const a = tr.clone(), b = a.clone().add(new V(0, 0.16, -0.08)), c = b.clone().add(new V(0.03, 0.08, 0.1));
    parts.push({ g: tube(a, b, 0.03, 0.026, 5), col: white, ht: tht }, { g: tube(b, c, 0.026, 0.015, 5), col: white, ht: tht }); }
  else if (B.tail === 'brush') { // the wolf's and the hyena's bushy tail, hanging (session 9)
    const k = B.h / 0.78, a = tr.clone(), b = a.clone().add(new V(0, -0.2 * k, -0.14 * k)), c = b.clone().add(new V(0, -0.2 * k, -0.05 * k)); // (sized by the animal: the fox's is a wolf's at half size)
    parts.push({ g: tube(a, b, 0.05 * k, 0.065 * k, 6), col: white, ht: tht }, { g: tube(b, c, 0.065 * k, 0.03 * k, 6), col: [0.3, 0.26, 0.22], ht: tht }); }
  else if (B.tail === 'cat') { // the cats' long tail: down, then the tip curving up; the lion's with a dark tuft (session 9)
    const L = B.len * 0.55, a = tr.clone(), b = a.clone().add(new V(0, -L * 0.55, -L * 0.3)), c = b.clone().add(new V(0, -L * 0.2, -L * 0.3)), d = c.clone().add(new V(0, L * 0.12, -L * 0.18));
    for (const [p0, p1, r0, r1] of [[a, b, 0.03, 0.026], [b, c, 0.026, 0.022], [c, d, 0.022, 0.018]] as const) parts.push({ g: tube(p0, p1, r0 * B.girth / 0.4, r1 * B.girth / 0.4, 5), col: white, ht: tht });
    if (B.ruff || sp === 'lioness') parts.push({ g: new THREE.SphereGeometry(0.045, 5, 4).scale(1, 1.6, 1).translate(d.x, d.y, d.z), col: [0.2, 0.14, 0.1], ht: tht }); }
  else if (B.tail === 'hen' || B.tail === 'cock') { // the fowl's tail: a raised fan of feathers; the cock's arched sickles dark
    const ck = B.tail === 'cock', a = new V(0, F.bodyY + B.girth * 0.2, -B.len * 0.42);
    parts.push({ g: new THREE.SphereGeometry(1, 6, 4).scale(0.02, ck ? 0.1 : 0.075, ck ? 0.07 : 0.055).rotateX(0.5).translate(a.x, a.y + 0.05, a.z - 0.03), col: ck ? [0.08, 0.1, 0.08] : white, ht: tht });
    if (ck) for (const s of [-1, 1]) { const b = a.clone().add(new V(s * 0.012, 0.16, -0.08)), c = b.clone().add(new V(0, -0.06, -0.12)); parts.push({ g: tube(a, b, 0.012, 0.01, 4), col: [0.06, 0.09, 0.07], ht: tht }, { g: tube(b, c, 0.01, 0.004, 4), col: [0.06, 0.09, 0.07], ht: tht }); } }
  else { const tl = B.tail === 'hair' ? 0.62 : B.tail === 'tuft' ? (sp === 'ox' || sp === 'zebu' ? 0.75 : sp.startsWith('camel') || sp === 'dromedary' ? 0.4 : sp === 'boar' ? 0.25 : 0.45) : B.tail === 'short' ? 0.1 : 0.14;
    const te = tr.clone().add(new V(0, B.tail === 'short' ? tl * 0.6 : -tl, B.tail === 'short' ? -0.05 : -tl * 0.18));
    parts.push({ g: tube(tr, te, B.tail === 'hair' ? 0.06 : 0.022, B.tail === 'hair' ? 0.04 : 0.012, 5), col: B.tail === 'hair' ? (sp.startsWith('mule') ? [0.2, 0.15, 0.12] : [0.5, 0.42, 0.4]) : white, ht: tht });
    if (B.tail === 'tuft') parts.push({ g: new THREE.SphereGeometry(0.045, 5, 4).scale(1, 1.8, 1).translate(te.x, te.y, te.z), col: dark, ht: tht }); }
  // gear: rides with the body (no rig weight), never below the belly (it lies down with its load: C)
  if (B.gear === 'pack') { const pad: RGB = [0.32, 0.2, 0.13], wick: RGB = [0.55, 0.44, 0.28], sack: RGB = [0.64, 0.58, 0.46], zc = -0.04 * B.len, top = backAt(B, zc);
    parts.push({ g: new THREE.BoxGeometry(B.girth * 0.7, 0.06, B.len * 0.42).translate(0, top + 0.02, zc), col: pad });
    for (const s of [-1, 1]) parts.push({ g: new THREE.BoxGeometry(0.2, B.girth * 0.62, B.len * 0.4).translate(s * (B.girth * 0.46 + 0.1), F.bodyY + B.girth * 0.08, zc), col: wick, load: top });
    parts.push({ g: new THREE.CylinderGeometry(0.11, 0.11, B.girth * 1.25, 8).rotateZ(Math.PI / 2).translate(0, top + 0.16, zc), col: sack, load: top + 0.27 }); }
  if (B.gear === 'pack_camel') { const sack: RGB = [0.6, 0.53, 0.42], sack2: RGB = [0.46, 0.36, 0.26];
    for (const s of [-1, 1]) parts.push({ g: new THREE.CylinderGeometry(0.2, 0.2, B.len * 0.5, 8).rotateX(Math.PI / 2).translate(s * (B.girth * 0.46 + 0.16), F.bodyY + B.girth * 0.18, 0.02 * B.len), col: s > 0 ? sack : sack2, load: F.bodyY + B.girth * 0.52 });
    parts.push({ g: new THREE.CylinderGeometry(0.16, 0.16, B.girth * 1.5, 8).rotateZ(Math.PI / 2).translate(0, F.bodyY + B.girth * 0.62, 0.02 * B.len), col: sack2, load: F.bodyY + B.girth * 0.62 + 0.18 }); }
  if (B.gear === 'saddle') { const zs = mountSeat(sp).z; parts.push({ g: saddleCloth(B, F.bodyY, zs), col: [0.52, 0.14, 0.1] }); }
  // bake attributes
  const gs = parts.map(pt => { const g = pt.g.index ? pt.g.toNonIndexed() : pt.g; if (g.getAttribute('uv')) g.deleteAttribute('uv'); if (!g.getAttribute('normal')) g.computeVertexNormals(); const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3), leg = new Float32Array(n * 4), piv = new Float32Array(n * 4), ht2 = new Float32Array(n * 4), jig = new Float32Array(n * 4), P = g.getAttribute('position');
    for (let i = 0; i < n; i++) { col.set(pt.col.map(c => (c > 1 ? c : lin(c))), i * 3); leg.set(pt.leg ?? [0, 0, 0, 0], i * 4); piv.set(pt.piv ?? [0, 0, 0, 0], i * 4); ht2.set(pt.ht ?? [0, 0, 0, 0], i * 4);
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      if (pt.soft !== undefined) jig[i * 4] = Math.min(1, Math.max(0, (pt.soft - y) / (pt.soft - (F.bodyY - B.girth * 0.52))));
      if (pt.ear) jig[i * 4 + 1] = Math.sign(pt.ear.x || 1) * Math.hypot(x - pt.ear.x, y - pt.ear.y, z - pt.ear.z);
      if (pt.ht && pt.ht[1] > 0) jig[i * 4 + 2] = Math.hypot(y - tr.y, z - tr.z, x);
      if (pt.load !== undefined) jig[i * 4 + 3] = 0.02 + Math.max(0, pt.load - y); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aLeg', new THREE.BufferAttribute(leg, 4)); g.setAttribute('aPiv', new THREE.BufferAttribute(piv, 4)); g.setAttribute('aHT', new THREE.BufferAttribute(ht2, 4)); g.setAttribute('aJig', new THREE.BufferAttribute(jig, 4)); return g; });
  // colour and the rig attributes in one interleaved buffer (WebGPU allows 8 vertex buffers per pipeline)
  const g = mergeGeometries(gs)!; interleave(g, ['color', 'aLeg', 'aPiv', 'aHT', 'aJig']); g.computeBoundingSphere(); return g;
}
/** the gaits (D-326): 0 the lateral walk, 1 the trot (diagonal pairs together), 2 the hare's bound (the fore pair together,
 *  the hind pair half a cycle later); weights [walk, trot, bound] */
export const gaitW = (g: number): [number, number, number] => { const t = Math.min(1, Math.max(0, g)), h = Math.min(1, Math.max(0, g - 1)); return [1 - t, t - h, h]; };
/** a leg's phase offset in a gait, from its walk offset (LH 0, LF pi/2, RH pi, RF 3pi/2) and fore/hind */
export const gaitOffset = (walkOff: number, fore: number, G: [number, number, number]) => G[0] * walkOff + G[1] * Math.PI * (1 - Math.cos(walkOff) + Math.sin(walkOff)) / 2 + G[2] * (Math.PI * fore + GALLOP_LEAD * (walkOff > 2.5 ? 1 : 0));
/** s18 C14 (D-790): the gallop's lead (rad): the right legs of each pair land a beat after the left (the transverse gallop of a
 *  horse, four beats; the hare's half-bound), where the bound set the pairs down together (C) */
export const GALLOP_LEAD = 0.65;
/** s18 C14: a mount's or a driven animal's gait (gaitW's 0 walk .. 1 trot .. 2 gallop) and stride factor from its pace (m/s;
 *  C: a horse walks to ~1.8 m/s, trots ~2.5-4, canters/gallops above; the stride lengthens ~1.3x trotting, ~2.4x galloping) */
export function gaitOfPace(pace: number): { gait: number; stride: number } {
  const t = Math.min(1, Math.max(0, (pace - 1.7) / 0.9)), h = Math.min(1, Math.max(0, (pace - 3.6) / 1.4));
  return { gait: t + h, stride: 1 + 0.3 * t + 1.1 * h };
}
/** rig constants: leg swing and knee flex at a full walk */
export const RIG = { swing: 0.42, knee: 0.75 } as const;
/** the lying drop: the belly on the ground */
export const lieDrop = (sp: Species) => { const B = ANIMAL_BUILD[sp], RR = realRig(sp); return RR ? RR.bellyY - 0.02 : B.h - B.girth * 1.02; }; // (V5 D-520: a library model's own belly)
/** the lying fold of a species, [fore hip, fore knee, hind hip, hind knee] (rad), from its build: the upper leg turns until
 *  the joint below it reaches the ground once the belly is down, and the lower leg lies flat under the body (fore: the
 *  knee forward, the cannon folded back under the chest; hind: the hock back, the cannon forward under the belly) */
export function foldOf(sp: Species): [number, number, number, number] {
  const B = ANIMAL_BUILD[sp], RR = realRig(sp), hipY = RR ? RR.hipY : B.h - B.girth * 0.62, kneeY = RR ? RR.kneeY : hipY * 0.45, u = hipY - kneeY, r = B.leg * 1.5;
  const a = Math.acos(Math.max(-1, Math.min(1, (hipY - lieDrop(sp) - r) / u))), flat = Math.PI / 2 - 0.12;
  return [-a, flat + a, a, -flat - a];
}
/** D-362: the secondary motion's constants (C, by eye from the living animals: a donkey's belly swings a few centimetres with
 *  its walk, a cow's dewlap more; ears flick every 5-11 s and settle in a quarter second; a tail swings as a chain, its tip
 *  lagging the root; panniers swing out from the flanks and surge with the stride). Each is the steady response of a damped
 *  spring to the gait (the stride's sway once per stride, its bob twice) with a fixed lag behind it, so it is closed-form in
 *  time like the rest of the rig, scaled by the walk (it builds as the animal sets off and settles as it stops), plus the
 *  idle cycles (breathing, the ears' flicks, the tail's slow swing) that go on when it stands. */
export const JIG = { bellyL: 0.05, bellyV: 0.035, breathe: 0.012, earFlick: 0.5, earNod: 0.12, tailIdle: 0.3, tailWalk: 0.22, tailK: 3, loadL: 0.12, loadZ: 0.05, loadV: 0.015 } as const;
/** an ear's flick at time t (rad; 0 between flicks): every 5-11 s (seed), a quick turn that rebounds and dies in ~0.4 s */
export const earFlick = (t: number, seed: number) => { const P = 5 + 6 * fr(seed * 7.13), tau = fr(t / P + seed) * P; return Math.exp(-6 * tau) * Math.sin(22 * tau); };
/** the secondary displacement of a vertex at rest x = x0 with weights jig (aJig) in the animal's rest frame (m; before the joints turn it) */
export function jiggle(sp: Species, j: ArrayLike<number>, st: { phase: number; walk: number }, time: number, seed: number, x0: number, out: number[] = [0, 0, 0]) {
  const g = ANIMAL_BUILD[sp].girth, w = st.walk, f = st.phase;
  let dx = j[0] * g * JIG.bellyL * w * Math.sin(f - 0.9), dy = j[0] * g * (JIG.bellyV * w * Math.sin(2 * f - 1.1) + JIG.breathe * Math.sin(1.4 * time + 6.28 * seed)), dz = 0;
  const le = Math.abs(j[1]), se = Math.sign(j[1]);
  if (le) { const th = JIG.earFlick * earFlick(time, fr(seed + (se > 0 ? 0.37 : 0))) + JIG.earNod * w * Math.sin(2 * f - 0.6); dx += se * le * th * 0.45; dy -= le * th * 0.15; dz -= le * th * 0.9; }
  const lt = j[2];
  if (lt) { const th = JIG.tailIdle * (1 - w) * Math.sin(1.7 * time + 6.28 * seed - JIG.tailK * lt) + JIG.tailWalk * w * Math.sin(f - 1.2 - JIG.tailK * lt), k = lt * Math.min(1, lt / 0.3); dx += th * k; dy -= w * 0.06 * k * Math.sin(2 * f - 1.5); }
  const ll = j[3];
  if (ll) { const sx = x0 < 0 ? -1 : 1; dx += sx * ll * JIG.loadL * w * Math.max(0, sx * Math.sin(f - 1.0)); dz += ll * JIG.loadZ * w * Math.sin(2 * f - 1.6); dy += Math.min(1, ll * 10) * JIG.loadV * w * Math.sin(2 * f - 1.3); }
  out[0] = dx; out[1] = dy; out[2] = dz; return out;
}
/** one vertex of an animal posed on the CPU (the vertex shader's arithmetic; tests and previews); jig, seed: D-362 */
export function deformAnimal(sp: Species, p: ArrayLike<number>, leg: ArrayLike<number>, piv: ArrayLike<number>, ht: ArrayLike<number>, st: { phase: number; walk: number; graze: number; lie: number; gait?: number }, time: number, out: number[] = [0, 0, 0], jig?: ArrayLike<number>, seed = 0) {
  const F = animalFrame(sp); let x = p[0], y = p[1], z = p[2];
  if (jig) { const J = jiggle(sp, jig, st, time, seed, x); x += J[0]; y += J[1]; z += J[2]; }
  const G = gaitW(st.gait ?? 0), fore = leg[3] > 0 ? 1 : 0, ph = st.phase + gaitOffset(leg[0], fore, G);
  const fo = foldOf(sp);
  const a1 = leg[1] * (st.walk * (RIG.swing + 0.14 * (G[1] + G[2])) * Math.sin(ph) + st.lie * (fore ? fo[0] : fo[2]));
  const a2 = leg[2] * (st.walk * RIG.knee * Math.max(0, Math.sin(ph - 0.6)) + st.lie * (fore ? fo[1] : fo[3]));
  const rx = (py: number, pz: number, a: number, cy: number, cz: number) => { const dy = py - cy, dz = pz - cz, c = Math.cos(a), s = Math.sin(a); return [cy + dy * c - dz * s, cz + dy * s + dz * c]; };
  [y, z] = rx(y, z, a2, piv[2], piv[3]); [y, z] = rx(y, z, a1, piv[0], piv[1]);
  const skull = Math.max(0, -ht[1]), tailW = Math.max(0, ht[1]);
  [y, z] = rx(y, z, -skull * F.bend * st.graze, F.top.y, F.top.z);
  const ah = ht[0] * (st.graze * F.graze + 0.05 * st.walk * Math.sin(2 * ph) + 0.04 * st.graze * Math.sin(time * 5.3));
  [y, z] = rx(y, z, ah, ht[2], ht[3]);
  const at = tailW * 0.3 * Math.sin(time * 1.1 + st.phase * 0.1), c = Math.cos(at), s = Math.sin(at), dx = x, dz = z - ht[3]; if (tailW) { x = dx * c + dz * s; z = ht[3] - dx * s + dz * c; }
  y += -st.lie * lieDrop(sp) + st.walk * (0.012 * G[0] * Math.sin(2 * ph) + 0.025 * G[1] * Math.abs(Math.sin(st.phase)) + 0.06 * G[2] * Math.max(0, Math.sin(st.phase)));
  out[0] = x; out[1] = y; out[2] = z; return out;
}

/** s18 C14 (D-790): where an animal's bit is at time t (the mouth's corner, a little behind the muzzle tip), in the
 *  performer's frame as `a` is placed (x, z, yaw, y): the reins' and the lead rope's far end (crowd draws the line from the
 *  hand). Follows the head's carriage, grazing and the walk's nod, as the vertex shader moves it */
export function bitAt(a: AnimalInst, time: number, out: number[] = [0, 0, 0]): number[] {
  const F = animalFrame(a.sp), m = F.muzzle, back = F.hd.clone().multiplyScalar(-0.06 * ANIMAL_BUILD[a.sp].head / 0.5);
  deformAnimal(a.sp, [m.x, m.y + back.y, m.z + back.z], [0, 0, 0, 0], [0, 0, 0, 0], [1, -1, F.base.y, F.base.z], { phase: a.phase, walk: a.walk, graze: a.graze, lie: a.lie, gait: a.gait }, time, out);
  const c = Math.cos(a.yaw), sn = Math.sin(a.yaw), x = out[0], z = out[2];
  out[0] = a.x + c * x + sn * z; out[1] = out[1] + (a.y ?? 0); out[2] = a.z - sn * x + c * z; return out;
}
/** an animal to draw: species, place in the performer's frame (x, z, yaw; y offset), state; roll: lying on its side */
export interface AnimalInst { sp: Species; x: number; z: number; yaw: number; y?: number; roll?: number; phase: number; walk: number; graze: number; lie: number; coat: number;
  /** placed relative to the performer's own path (the plough team) instead of the simulation's spot */ follow?: boolean;
  /** D-326: the gait when walking (0 the lateral walk, 1 the trot, 2 the bound; default: the hare bounds, the rest walk) */ gait?: number }
const fr = (x: number) => x - Math.floor(x);
const h1 = (a: number, b = 0) => fr(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
const TWO_PI = 2 * Math.PI;
/** the animals of a performance at time t (s), closed form; `path` = the performer's own path state (plough, drive) */
export function animalsFor(spec: AnimalSpec, t: number, seed: number, path?: { s?: number; yaw?: number }): AnimalInst[] {
  const out: AnimalInst[] = [], sp = (i: number) => spec.species[i % spec.species.length];
  switch (spec.kind) {
    case 'flock': { const n = spec.n ?? 10;
      for (let i = 0; i < n; i++) { const s = sp(i), B = ANIMAL_BUILD[s], T = 20 + 8 * h1(seed, i), tg = 0.6 * T, off = h1(i, seed) * T;
        const k = Math.floor((t + off) / T), u = (t + off) - k * T;
        const spot = (m: number) => { const a = 1.6 * Math.sin(0.31 * m + i * 1.9 + seed) + 0.5 * Math.sin(1.13 * m + i), r = 4.5 + 3.5 * Math.sin(0.23 * m + i * 1.7) + 2 * h1(i, 3); return [r * Math.sin(a), 2 + r * Math.cos(a)]; };
        const A = spot(k), Bp = spot(k + 1), w = u < tg ? 0 : Math.min(1, (u - tg) / (T - tg)), dx = Bp[0] - A[0], dz = Bp[1] - A[1];
        const walking = u >= tg; const yaw = Math.atan2(dx, dz) + (walking ? 0 : 0.5 * Math.sin(t * 0.07 + i));
        const look = !walking && fr((t + i * 3.1) / 9) > 0.8;
        out.push({ sp: s, x: A[0] + dx * w, z: A[1] + dz * w, yaw, phase: (TWO_PI * Math.hypot(dx, dz) * w) / B.stride + TWO_PI * h1(k, i), walk: walking ? Math.min(1, (u - tg) * 2, (T - u) * 2) : 0, graze: walking || look ? 0 : 1, lie: 0, coat: h1(seed + i, 7) }); }
      break; }
    // s17 V3 (C3's ask; the smallest hook in V5's file): a flock driven along a road, a loose mass walking ahead of the
    // herder (2-9 m ahead, 5 m wide), each animal drifting within it, now and then snatching a bite; all at the drive's pace
    case 'drive': { const n = spec.n ?? 12, pace = spec.pace ?? 0.9;
      for (let i = 0; i < n; i++) { const s = sp(i), B = ANIMAL_BUILD[s], u = h1(i, seed), v = h1(seed, i + 17);
        const x = 2.5 * (2 * u - 1) * (0.6 + 0.4 * v) + 0.5 * Math.sin(t * 0.11 + i * 1.7), z = 2.2 + 6.5 * v + 0.6 * Math.sin(t * 0.09 + i * 2.9);
        const bite = fr(t / (9 + 5 * u) + v) < 0.12;
        out.push({ sp: s, x, z, yaw: 0.25 * Math.sin(t * 0.13 + i * 2.1), phase: (TWO_PI * t * pace) / B.stride + TWO_PI * u, walk: bite ? 0.35 : 1, graze: bite ? 1 : 0, lie: 0, coat: h1(seed + i, 7) }); }
      if (spec.dogs) for (let i = 0; i < spec.dogs; i++) { const B = ANIMAL_BUILD.dog, side = i % 2 ? -1 : 1, z = 3.5 + 3 * Math.sin(t * 0.21 + i * 2.4 + seed), x = side * (3.4 + 0.6 * Math.sin(t * 0.37 + i));
        out.push({ sp: 'dog', x, z, yaw: 0.5 * Math.cos(t * 0.21 + i * 2.4 + seed) * side, phase: (TWO_PI * t * pace * 1.3) / B.stride + i, walk: 1, graze: 0, lie: 0, coat: h1(seed + i, 11) }); }
      break; }
    // s18 C14 (D-790): the royal chariot's team: four horses abreast, their necks at the yoke 2.9 m ahead of the car's axle
    // (workObjects 'chariot'), trotting or galloping by the pace
    case 'chariot': { const pace = spec.pace ?? 2.2, Gp = gaitOfPace(pace); for (let i = 0; i < 4; i++) { const s = sp(i), B = ANIMAL_BUILD[s];
      out.push({ sp: s, x: (i - 1.5) * 0.72, z: CHARIOT_YOKE - 0.4 * B.len, yaw: 0, phase: (TWO_PI * t * Math.max(pace, 0.5)) / (B.stride * Gp.stride) + i * 0.7, walk: pace > 0 ? 1 : 0, graze: 0, lie: 0, coat: h1(seed + i, 5), gait: Gp.gait, follow: true }); }
      break; }
    case 'team': { const s = path?.s ?? 0; for (let i = 0; i < 2; i++) out.push({ sp: sp(i), x: i ? -0.55 : 0.55, z: 3.35, yaw: 0, phase: (TWO_PI * s) / ANIMAL_BUILD[sp(i)].stride + i * 0.9, walk: 1, graze: 0, lie: 0, coat: h1(seed + i, 5), follow: true }); break; }
    case 'circle': { const a = path?.yaw ?? 0, n = spec.n ?? 2;
      for (let i = 0; i < n; i++) { const r = 2.1 + 0.8 * i, ph = a + 0.25; const x = r * Math.sin(ph), z = r * Math.cos(ph);
        out.push({ sp: sp(i), x, z, yaw: Math.atan2(-Math.cos(ph), Math.sin(ph)), phase: (TWO_PI * r * Math.abs(a)) / ANIMAL_BUILD[sp(i)].stride, walk: 1, graze: 0, lie: 0, coat: h1(seed + i, 5) }); }
      break; }
    case 'beside': { const s = sp(0), B = ANIMAL_BUILD[s], eat = fr(t / 17 + h1(seed)) < 0.72;
      out.push({ sp: s, x: 0.3, z: 0.5 + 0.45 * B.girth, yaw: Math.PI / 2, phase: 0, walk: 0, graze: eat ? 1 : 0, lie: 0, coat: h1(seed, 5) }); break; }
    case 'lying': { const B = ANIMAL_BUILD.sheep;
      out.push({ sp: 'sheep', x: 0.02, z: 0.66, yaw: Math.PI / 2, roll: Math.PI / 2, y: B.girth * 0.45 - (B.h - B.girth * 0.5), phase: 0, walk: 0, graze: 0, lie: 0, coat: h1(seed, 5) });
      for (let i = 0; i < 2; i++) out.push({ sp: sp(i + 1), x: -1.7 - 0.5 * i, z: 1.5 - 0.8 * i, yaw: 0.6 + 1.9 * i + 0.3 * Math.sin(t * 0.05 + i), phase: 0, walk: 0, graze: fr(t / 11 + i * 0.4) < 0.7 ? 1 : 0, lie: 0, coat: h1(seed + i, 9) });
      break; }
    case 'tethered': for (let i = 0; i < 2; i++) out.push({ sp: sp(i), x: 1.9 + 0.5 * i, z: 1.7 - 0.8 * i, yaw: -0.8 + 1.4 * i + 0.4 * Math.sin(t * 0.06 + i * 2), phase: 0, walk: 0, graze: fr(t / 13 + i * 0.5) < 0.6 ? 1 : 0, lie: 0, coat: h1(seed + i, 3) }); break;
    case 'lead': out.push({ sp: sp(0), x: -0.62, z: 0.55, yaw: 0.15 + 0.2 * Math.sin(t * 0.04), phase: 0, walk: 0, graze: fr(t / 15 + h1(seed)) < 0.35 ? 1 : 0, lie: 0, coat: h1(seed, 4) }); break;
    // D-210: a string of pack animals nose to tail behind its driver (`side`: beside him instead), walking at `pace` (m/s;
    // 0: standing, heads down now and then); `gap` = the lead rope between one animal's tail and the next one's head
    case 'string': { const n = spec.n ?? 3, pace = spec.pace ?? 1, gap = spec.gap ?? 0.8; let z = -(spec.lead ?? 1.1), x0 = spec.side ?? 0;
      for (let i = 0; i < n; i++) { const s = sp(i), B = ANIMAL_BUILD[s]; z -= B.len / 2 + (i ? gap : 0); const sway = 0.1 * Math.sin(t * 0.23 + i * 1.7 + seed);
        out.push({ sp: s, x: x0 + sway, z, yaw: 0.04 * Math.sin(t * 0.19 + i * 2.3), phase: (TWO_PI * t * pace) / B.stride + i * 1.3 + h1(seed, i), walk: pace > 0 ? 1 : 0,
          graze: pace > 0 ? 0 : fr(t / 13 + i * 0.37 + h1(seed, i)) < 0.3 ? 1 : 0, lie: 0, coat: h1(seed + i, 6) });
        z -= B.len / 2; }
      break; }
    // a rider's mount under him: its seat (mountSeat) under the rider's pelvis; walking at `pace` (0: standing, a step now
    // and then) — the rider's root is lifted onto it by the crowd (anim RIDE)
    // (s18 C14: trotting and galloping by the pace: the hunt's riders, the couriers)
    case 'mount': { const s = sp(0), B = ANIMAL_BUILD[s], pace = spec.pace ?? 0, st = pace > 0 ? 1 : fr(t / 23 + h1(seed)) < 0.08 ? 1 : 0, Gp = gaitOfPace(pace);
      out.push({ sp: s, x: 0, z: -mountSeat(s).z, yaw: 0, phase: (TWO_PI * t * Math.max(pace, 0.5)) / (B.stride * Gp.stride), walk: st, graze: 0, lie: 0, coat: h1(seed, 8), gait: Gp.gait }); break; }
    // an ox pair drawing a cart behind its carter (the cart: work object 'cart' at CART_AT), walking at `pace`
    // (D-256: `n` 4 = two yoke pairs, one behind the other, for the drum sledge from the quarry)
    case 'draught': { const pace = spec.pace ?? 0.9, pairs = Math.max(1, Math.round((spec.n ?? 2) / 2)); let z0 = -1.2;
      for (let k = 0; k < pairs; k++) { let L = 0; for (let i = 0; i < 2; i++) { const s = sp(2 * k + i), B = ANIMAL_BUILD[s]; L = Math.max(L, B.len);
        const Gp = gaitOfPace(pace); // (s18 C14: a team at the trot or gallop: the king's chariot)
        out.push({ sp: s, x: i ? -0.55 : 0.55, z: z0 - B.len / 2, yaw: 0, phase: (TWO_PI * t * pace) / (B.stride * Gp.stride) + i * 0.9 + k * 0.4, walk: pace > 0 ? 1 : 0, graze: 0, lie: 0, coat: h1(seed + i + 2 * k, 5), gait: Gp.gait }); }
        z0 -= L + 0.9; }
      break; }
    // D-256: animals penned in a fold (the brushwood fold beside a band's tents, the stockyard's fold: work object 'fold', its
    // centre FOLD_AT ahead of the performer): standing, turning and heads down at the fodder by day, most lying at night
    // (`pace` 1 = night: the share lying; C)
    case 'fold': { const n = spec.n ?? 12, R = FOLD_R - 0.9, night = (spec.pace ?? 0) > 0;
      for (let i = 0; i < n; i++) { const s = sp(i), B = ANIMAL_BUILD[s], a = TWO_PI * h1(i, seed + 11), r = R * Math.sqrt(0.08 + 0.92 * h1(seed, i + 31));
        const lying = night ? h1(i, 77 + seed) < 0.8 : fr(t / (60 + 30 * h1(i, 3)) + h1(i, 5)) < 0.25;
        const eat = !lying && fr(t / 13 + i * 0.37) < 0.55;
        out.push({ sp: s, x: r * Math.sin(a), z: FOLD_AT + r * Math.cos(a), yaw: TWO_PI * h1(seed + i, 13) + 0.3 * Math.sin(t * 0.03 + i), phase: 0, walk: 0, graze: eat ? 1 : 0, lie: lying ? 1 : 0, coat: h1(seed + i, 7) }); }
      break; }
  }
  // a flock's dogs (D-210: every flock and band has them, E-49's participants row “herders, dogs and donkeys”): the
  // herdsman's dog lies near him and now and then trots out round the flock and back; the others lie at the flock's edge
  // and move round it from time to time (C)
  if ((spec.kind === 'flock' || spec.kind === 'fold') && spec.dogs) for (let i = 0; i < spec.dogs; i++) {
    const T = 38 + 14 * h1(seed, 40 + i), off = h1(seed, 50 + i) * T, k = Math.floor((t + off) / T), u = t + off - k * T, go = T * (i ? 0.78 : 0.72);
    const spot = (m: number): [number, number] => { if (i === 0 && m % 2 === 0) return [1.1, 0.5]; const a = TWO_PI * h1(m + 7 * i, seed + i), r = 9 + 2.5 * h1(m, 3 + i); return [r * Math.sin(a), 2 + r * Math.cos(a)]; };
    const A = spot(k), Bp = spot(k + 1), dx = Bp[0] - A[0], dz = Bp[1] - A[1], w = u < go ? 0 : Math.min(1, (u - go) / (T - go)), walking = u >= go && Math.hypot(dx, dz) > 0.1;
    const lying = !walking && fr((t + i * 5.3) / 17) < 0.75, B = ANIMAL_BUILD.dog;
    out.push({ sp: 'dog', x: A[0] + dx * w, z: A[1] + dz * w, yaw: walking ? Math.atan2(dx, dz) : Math.atan2(A[0], A[1] - 2) + 0.4 * Math.sin(t * 0.05 + i), phase: (TWO_PI * Math.hypot(dx, dz) * w) / B.stride, walk: walking ? Math.min(1, (u - go) * 2, (T - u) * 2) : 0,
      graze: !walking && !lying && fr((t + i) / 7) < 0.3 ? 1 : 0, lie: lying ? 1 : 0, coat: h1(seed + i, 11) });
  }
  return out;
}
/** D-256: a fold's radius (m) and how far ahead of the performer its centre is (work object 'fold' at [0, 0, FOLD_AT]) */
export const FOLD_R = 6, FOLD_AT = 7.5;
/** where the cart stands behind its draught pair (the performer's frame: the axle, m; workObjects 'cart') */
/** s18 C14: the chariot's yoke ahead of its axle (m; workObjects 'chariot': the pole ends at z 2.9), and the car's floor (m) */
export const CHARIOT_YOKE = 2.95, CHARIOT_FLOOR = 0.55;
export const CART_AT: [number, number, number] = [0, 0, -(1.2 + 1.85 + 0.45 + 1.2)];

/** the animals: one instanced mesh per species and level, filled every frame by the crowd and the fauna (begin / push /
 *  end). D-326: a species whose modelled body is loaded (animalModels.ts) draws it, lod0 near and lod1 beyond its
 *  distance (the manifest's lod1At, m, from the eye given to begin); else its procedural stand-in (one level). */
type Slot = { mesh: THREE.InstancedMesh; data: THREE.InterleavedBuffer; state: THREE.InterleavedBufferAttribute; gait: THREE.InterleavedBufferAttribute; rot: THREE.InterleavedBufferAttribute[]; coat: THREE.InterleavedBufferAttribute | null; n: number; box: THREE.Box3; tris: number };
export class Animals {
  /** D-362: the secondary motion on (the probe's cost measurement builds a set without it) */
  static secondary = true;
  readonly group = new THREE.Group();
  private meshes = new Map<string, Slot>();
  private uTime = uniform(0);
  private eye: { x: number; y: number; z: number } | null = null;
  /** animals not drawn this frame because their species' instance cap was full (reported by stats: never silent) */
  dropped = 0;
  constructor(private cap = 512, name = 'animals:work') { this.group.name = name; }
  /** D-220: called for every animal pushed (the world's dust: a walking animal raises dust on dry earth) */
  onPush: ((a: AnimalInst, M: THREE.Matrix4) => void) | null = null;
  private mesh(sp: Species, lod: number): Slot {
    const key = `${sp}:${lod}`; let m = this.meshes.get(key); const model = animalModel(sp);
    if (m && (m.coat || !model)) return m;
    // (s15/ship D-393: the modelled bodies stream in after the world is up: a species first drawn as its procedural stand-in
    // is rebuilt as the model once it has arrived)
    if (m) { this.group.remove(m.mesh); m.mesh.geometry.dispose(); (m.mesh.material as THREE.Material).dispose(); this.meshes.delete(key); }
    const g = model ? model.lods[lod].clone() : animalGeometry(sp), F = animalFrame(sp), drop = lieDrop(sp), B0 = ANIMAL_BUILD[sp];
    if (model) interleave(g, ['aLeg', 'aPiv', 'aHT', 'aJig']);
    // per instance, in one interleaved buffer: the state (gait phase, walk, graze, lie), the instance's rotation (its
    // matrix's axes) and (the models) the coat colour. three.js applies the instance matrix to positionLocal BEFORE the
    // material's positionNode, so the rig deforms the raw geometry position in the animal's own frame and adds the
    // displacement turned by these axes (rotating legs about pivots in world space would throw them across the field)
    const names = ['aState', 'aRx', 'aRy', 'aRz', 'aGait', ...(model ? ['aCoat'] : [])];
    const data = interleave(g, names, { count: this.cap, sizes: [4, 3, 3, 3, 2, ...(model ? [3] : [])] }); data.setUsage(THREE.DynamicDrawUsage);
    const state = g.getAttribute('aState') as THREE.InterleavedBufferAttribute, rot = ['aRx', 'aRy', 'aRz'].map(n => g.getAttribute(n) as THREE.InterleavedBufferAttribute);
    const mat = new THREE.MeshStandardNodeMaterial({ roughness: model ? 0.82 : 0.95 }); mat.vertexColors = !model;
    const L = attribute('aLeg', 'vec4'), Pv = attribute('aPiv', 'vec4'), H = attribute('aHT', 'vec4'), S = attribute('aState', 'vec4');
    const rx = (p: any, a: any, cy: any, cz: any) => { const dy = p.y.sub(cy), dz = p.z.sub(cz), c = cos(a), s = sin(a); return vec3(p.x, cy.add(dy.mul(c)).sub(dz.mul(s)), cz.add(dy.mul(s)).add(dz.mul(c))); };
    // the gait's weights (walk, trot, bound: gaitW) and each leg's phase offset in it (gaitOffset)
    const G2 = attribute('aGait', 'vec2'), Gt = G2.x, seedN = G2.y, gT = Gt.clamp(0, 1), gH = Gt.sub(1).clamp(0, 1), gW0 = float(1).sub(gT), gW1 = gT.sub(gH);
    const fore = max(L.w, float(0));
    const ph = S.x.add(L.x.mul(gW0)).add(gW1.mul(Math.PI / 2).mul(float(1).sub(cos(L.x)).add(sin(L.x)))).add(gH.mul(fore.mul(Math.PI).add(step(2.5, L.x).mul(GALLOP_LEAD))));
    // arithmetic masks only (no select: D-012): fore = 1 for fore legs, 0 for hind
    const fo = foldOf(sp);
    const a1 = L.y.mul(S.y.mul(gW1.add(gH).mul(0.14).add(RIG.swing)).mul(sin(ph)).add(S.w.mul(fore.mul(fo[0] - fo[2]).add(fo[2]))));
    const a2 = L.z.mul(S.y.mul(RIG.knee).mul(max(sin(ph.sub(0.6)), 0)).add(S.w.mul(fore.mul(fo[1] - fo[3]).add(fo[3]))));
    const P0 = positionGeometry;
    // D-362: the secondary motion (jiggle: the same arithmetic) on the rest pose, before the joints turn it
    const Jg = attribute('aJig', 'vec4'), w = S.y, f = S.x, T = this.uTime;
    const flick = (sd: any) => { const Pd = fract(sd.mul(7.13)).mul(6).add(5), tau = fract(T.div(Pd).add(sd)).mul(Pd); return exp(tau.mul(-6)).mul(sin(tau.mul(22))); };
    let jx: any = Jg.x.mul(B0.girth * JIG.bellyL).mul(w).mul(sin(f.sub(0.9)));
    let jy: any = Jg.x.mul(B0.girth).mul(w.mul(JIG.bellyV).mul(sin(f.mul(2).sub(1.1))).add(sin(T.mul(1.4).add(seedN.mul(6.28))).mul(JIG.breathe)));
    let jz: any = float(0);
    const le = abs(Jg.y), se = sign(Jg.y), the = flick(fract(seedN.add(max(se, float(0)).mul(0.37)))).mul(JIG.earFlick).add(w.mul(JIG.earNod).mul(sin(f.mul(2).sub(0.6))));
    jx = jx.add(se.mul(le).mul(the).mul(0.45)); jy = jy.sub(le.mul(the).mul(0.15)); jz = jz.sub(le.mul(the).mul(0.9));
    const lt = Jg.z, kt = lt.mul(min(lt.div(0.3), float(1)));
    const tht = float(1).sub(w).mul(JIG.tailIdle).mul(sin(T.mul(1.7).add(seedN.mul(6.28)).sub(lt.mul(JIG.tailK)))).add(w.mul(JIG.tailWalk).mul(sin(f.sub(1.2).sub(lt.mul(JIG.tailK)))));
    jx = jx.add(tht.mul(kt)); jy = jy.sub(w.mul(0.06).mul(kt).mul(sin(f.mul(2).sub(1.5))));
    const ll = Jg.w, sx = step(float(0), P0.x).mul(2).sub(1);
    jx = jx.add(sx.mul(ll).mul(JIG.loadL).mul(w).mul(max(sx.mul(sin(f.sub(1.0))), float(0))));
    jz = jz.add(ll.mul(JIG.loadZ).mul(w).mul(sin(f.mul(2).sub(1.6)))); jy = jy.add(min(ll.mul(10), float(1)).mul(JIG.loadV).mul(w).mul(sin(f.mul(2).sub(1.3))));
    let p: any = rx(Animals.secondary ? P0.add(vec3(jx, jy, jz)) : P0, a2, Pv.z, Pv.w); p = rx(p, a1, Pv.x, Pv.y);
    // Q-980: the poll's joint (the skull's weight is -aHT.y): grazing, it straightens the carriage by F.bend
    const skullW = max(H.y.negate(), float(0)), tailW = max(H.y, float(0)), as = skullW.mul(S.z).mul(-F.bend);
    p = rx(p, as, float(F.top.y), float(F.top.z));
    const ah = H.x.mul(S.z.mul(F.graze).add(S.y.mul(0.05).mul(sin(ph.mul(2)))).add(S.z.mul(0.04).mul(sin(this.uTime.mul(5.3)))));
    p = rx(p, ah, H.z, H.w);
    const at = tailW.mul(0.3).mul(sin(this.uTime.mul(1.1).add(S.x.mul(0.1)))), c = cos(at), s = sin(at), dz = p.z.sub(H.w);
    p = vec3(p.x.mul(c).add(dz.mul(s)), p.y, H.w.sub(p.x.mul(s)).add(dz.mul(c)));
    const bob = gW0.mul(0.012).mul(sin(ph.mul(2))).add(gW1.mul(0.025).mul(sin(S.x).abs())).add(gH.mul(0.06).mul(max(sin(S.x), float(0))));
    p = p.add(vec3(0, S.w.mul(-drop).add(S.y.mul(bob)), 0));
    const d = p.sub(P0), Rx = attribute('aRx', 'vec3'), Ry = attribute('aRy', 'vec3'), Rz = attribute('aRz', 'vec3');
    mat.positionNode = positionLocal.add(Rx.mul(d.x)).add(Ry.mul(d.y)).add(Rz.mul(d.z)) as any;
    if (model) {
      // the surface turns with the rig: the normal and the tangent pitched by the joints' summed angle (every rotation of
      // the rig but the tail's is about a lateral axis), yawed by the tail's, carried to the world by the instance's axes
      // and to the view; the baked normal map on that frame, the occlusion on the indirect light
      const turn = (v: any) => { const A = a1.add(a2).add(ah).add(as), ca = cos(A), sa = sin(A); let q: any = vec3(v.x, v.y.mul(ca).sub(v.z.mul(sa)), v.y.mul(sa).add(v.z.mul(ca)));
        q = vec3(q.x.mul(c).add(q.z.mul(s)), q.y, q.x.mul(s).negate().add(q.z.mul(c))); return modelViewMatrix.mul(vec4(Rx.mul(q.x).add(Ry.mul(q.y)).add(Rz.mul(q.z)), 0)).xyz.normalize(); };
      const T4 = attribute('tangent', 'vec4'), vN = varying(turn(normalGeometry)), vT = varying(turn(T4.xyz)), vW = varying(T4.w);
      const tn = texture(model.nrm, uv()), ta = texture(model.albedo, uv()), m3 = tn.rgb.mul(2).sub(1);
      const N = vN.normalize(), T = vT.sub(N.mul(vT.dot(N))).normalize(), Bt = N.cross(T).mul(vW);
      mat.normalNode = T.mul(m3.x).add(Bt.mul(m3.y)).add(N.mul(m3.z)).normalize() as any;
      mat.aoNode = tn.a as any;
      // (V5 D-520: a library model's own colours lead; the instance's coat scales them about the species' mean coat)
      const base = model.real ? ta.rgb.mul(attribute('aCoat', 'vec3')) : mix(ta.rgb, attribute('aCoat', 'vec3').mul(ta.rgb).mul(2), ta.a);
      // V5 D-520: the coat's fuzz: hair scatters light forward at grazing angles, so a furred body's silhouette is lighter and
      // paler than its face-on hide (the sheen of fur and wool; a cheap stand-in for a sheen lobe, C). Only on the coat (mask)
      const nv = abs(dot(N, positionViewDirection)).clamp(0, 1), rim = pow(float(1).sub(nv), float(2.5)).mul(ta.a.mul(0.75).add(0.25));
      // V5 D-523: a coat soaked in the rain darkens (water fills the hair: ~0.6 of the dry albedo, C), loses its fuzz and
      // takes a dull sheen; it dries with the ground (the weather's surface wetness, the same uniform the ground reads)
      const wetA = WEATHER.wetness.mul(0.85).clamp(0, 1);
      mat.colorNode = mix(base, vec3(luminance(base)).mul(1.25).add(base.mul(0.35)), rim.mul(0.55).mul(float(1).sub(wetA))).mul(float(1).sub(wetA.mul(0.4))) as any;
      mat.roughnessNode = float(0.95).sub(float(1).sub(ta.a).mul(0.35)).sub(wetA.mul(0.35)) as any;
    }
    const mesh = new THREE.InstancedMesh(g, mat, this.cap); mesh.count = 0; mesh.visible = false; mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = true; mesh.boundingSphere = new THREE.Sphere();
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.name = `animals:${sp}${model ? `:lod${lod}` : ''}`; mesh.raycast = () => {};
    mesh.userData = { tier: 'C', src: 'RECON', note: `${ANIMAL_BUILD[sp].note}; ${ANIMAL_BUILD[sp].tier}${model ? `; modelled body level ${lod} (D-326: anatomy src/people/animalForm.ts, built in Blender by tools/blender/animals.mjs, baked coat maps)` : '; procedural stand-in (the modelled body not loaded)'}` };
    if (!model) mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    nearCascadesOnly(mesh);
    this.group.add(mesh); m = { mesh, data, state, gait: g.getAttribute('aGait') as THREE.InterleavedBufferAttribute, rot, coat: model ? g.getAttribute('aCoat') as THREE.InterleavedBufferAttribute : null, n: 0, box: new THREE.Box3(), tris: (g.index ? g.index.count : g.getAttribute('position').count) / 3 };
    this.meshes.set(key, m); return m;
  }
  /** a frame's start: the time (the rig's idle cycles) and the eye (the level of detail; none: the nearest level) */
  begin(time: number, eye?: { x: number; y: number; z: number } | null) { this.uTime.value = time % 100000; this.dropped = 0; this.eye = eye ?? null; for (const m of this.meshes.values()) { m.n = 0; m.box.makeEmpty(); } }
  /** an animal at a world transform with its state */
  push(a: AnimalInst, M: THREE.Matrix4) {
    this.onPush?.(a, M);
    const model = animalModel(a.sp), e = M.elements;
    const lod = model && this.eye && Math.hypot(e[12] - this.eye.x, e[13] - this.eye.y, e[14] - this.eye.z) > model.lod1At ? 1 : 0;
    const m = this.mesh(a.sp, lod); if (m.n >= this.cap) { this.dropped++; return; } const i = m.n++;
    m.mesh.setMatrixAt(i, M); m.state.setXYZW(i, a.phase % (TWO_PI * 64), a.walk, a.graze, a.lie); m.gait.setXY(i, a.gait ?? (a.sp === 'hare' ? 2 : 0), a.coat); // (D-362: y the animal's own seed, its ears' and tail's idle timing)
    m.rot[0].setXYZ(i, e[0], e[1], e[2]); m.rot[1].setXYZ(i, e[4], e[5], e[6]); m.rot[2].setXYZ(i, e[8], e[9], e[10]);
    const c = ANIMAL_BUILD[a.sp].coat, k = Math.min(c.length - 1, Math.floor(a.coat * c.length)); _c.setRGB(c[k][0], c[k][1], c[k][2], THREE.SRGBColorSpace);
    if (m.coat && model?.real) { const mu = coatMean(a.sp); m.coat.setXYZ(i, ...relCoat(_c, mu)); }
    else if (m.coat) m.coat.setXYZ(i, _c.r, _c.g, _c.b); else m.mesh.setColorAt(i, _c);
    m.box.expandByPoint(_p.setFromMatrixPosition(M));
  }
  end() {
    for (const m of this.meshes.values()) { const im = m.mesh; im.count = m.n; im.visible = m.n > 0; if (!m.n) continue;
      im.instanceMatrix.needsUpdate = true; im.instanceMatrix.clearUpdateRanges(); im.instanceMatrix.addUpdateRange(0, m.n * 16);
      m.data.needsUpdate = true; m.data.clearUpdateRanges(); m.data.addUpdateRange(0, m.n * m.data.stride);
      if (im.instanceColor) { im.instanceColor.needsUpdate = true; im.instanceColor.clearUpdateRanges(); im.instanceColor.addUpdateRange(0, m.n * 3); }
      m.box.getBoundingSphere(im.boundingSphere!); im.boundingSphere!.radius += 1.5; }
  }
  stats() { let draws = 0, instances = 0, triangles = 0, modelled = 0; const species: Record<string, number> = {};
    for (const [k, m] of this.meshes) if (m.n) { draws++; instances += m.n; triangles += m.n * m.tris; const sp = k.split(':')[0]; species[sp] = (species[sp] ?? 0) + m.n; if (m.coat) modelled += m.n; }
    return { draws, instances, triangles, species, dropped: this.dropped, modelled }; }
}
const _p = new THREE.Vector3(), _c = new THREE.Color();
/** V5 D-520: a species' mean coat (linear) and an instance's coat relative to it (the library model's texture is that mean
 *  animal: a dark sheep is the white fleece scaled down, a pale ox the brown hide scaled up), clamped to what a texture
 *  scaled per channel still reads as */
const COAT_MEAN = new Map<Species, THREE.Color>();
export function coatMean(sp: Species) { let c = COAT_MEAN.get(sp); if (c) return c; const P = ANIMAL_BUILD[sp].coat; c = new THREE.Color(0, 0, 0);
  for (const q of P) { const k = new THREE.Color().setRGB(q[0], q[1], q[2], THREE.SRGBColorSpace); c.r += k.r / P.length; c.g += k.g / P.length; c.b += k.b / P.length; }
  COAT_MEAN.set(sp, c); return c; }
export function relCoat(c: THREE.Color, mu: THREE.Color): [number, number, number] {
  const l = (x: THREE.Color) => 0.2126 * x.r + 0.7152 * x.g + 0.0722 * x.b, kl = Math.min(1.6, Math.max(0.3, l(c) / Math.max(1e-4, l(mu))));
  // the brightness follows the coat; the hue only a quarter of the way (a texture tinted fully goes flat)
  const ch = (a: number, b: number) => 1 + 0.25 * ((a / Math.max(1e-4, l(c))) / (b / Math.max(1e-4, l(mu))) - 1);
  return [kl * ch(c.r, mu.r), kl * ch(c.g, mu.g), kl * ch(c.b, mu.b)];
}
