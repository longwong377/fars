# s18 C14 — people up close and the last procedural animals (D-790; branch cloud-s18-c14-faces)

**Broken, placeholder or unseen first.**
- **Unseen on the T4.** Every frame below is the cloud's software renderer (SwiftShader, WebGL2, Q medium, humanlab) or a
  Blender Cycles preview: crude shape and motion, not the look. Skin, the strand brows and the eyes need a T4 close-up
  (`node tools/dev/face_probe.mjs <out>` against a served tree, `WEBGL=0` there) before anyone calls them AAA.
- **Faces still read as game NPCs at 0.5 m in these frames**: MakeHuman heads, the bob-cut hair cards' hard helmet edge, the
  plastic skin of the software renderer. What changed is how they move and look at you (below), the brows and the lids;
  the head meshes, hair cards and skin maps are as they were (a Blender re-groom of hair and a face-scan-grade skin are
  T4/Vagon work).
- **The mouth speaks a babble until the voice hands over its text**: `FaceState.say = { text, t0, seconds }` is ready, but
  crowd.ts (C5) and the voice (C8) must set it (asked). Today a talking jaw drives a seeded babble of phones in the period's
  shape; the jaw no longer follows a sine.
- **The Cycles people impostor atlas reads stale** (tests/impostor_assets "current"): IMP_INPUTS hashes humanRig.ts. The bake
  itself is unchanged (the face moves only with a clock: an impostor bake has none), but the guard needs
  `node tools/blender/impostors.mjs` on Vagon (~4 min on the T4; the cloud's ktx stand-in cannot assemble given mips).
  "within budget" (56.6 vs 56.1 MB) fails as on the base.
- **Boar and hare still procedural** (B820): the library (huggingface.co, sketchfab.com) is blocked at the cloud's proxy. A
  boar derived from the hyena read as a hyena with a beak and was not shipped. The pack camel's sacks are the anatomy's gear
  set on a real back: they now hang against the flanks with the bundle in the saddle, but are smooth ellipsoids.
- **B550 in part** (B821): lying still folds coarse library hides up to 30 cm; horned heads (cattle, goats, wild sheep, stags)
  get no ear flick (their horns would flick too); sheep/goat/dog tails still barely swing.
- Seen in passing, not mine: the porter's headband floats ~2 cm off the scalp all round (C13); a young porter with no beard
  (the reliefs show bearded men: looks, C13).

**Round 5 (the cloud builds the people's assets; skin pores; mocap).** Broken or open first:
- **people_models "drape sets sane" is RED**: the women's veil (veil@0|women#1) settles to 0.255 m max against the 0.2 m
  bound since people_cloth was rebuilt on s17-int 0323bc96 (0.108 before; headcloth@0|women 0.056 → 0.146). Deterministic
  here; likely the women's costume changes (C13's necklaces) under the stage-2 drape, unconfirmed (C13 asked; a Vagon GPU
  rebuild would tell the build machine apart).
- tests/impostor_frames: 'recline' has no frame within 0.09 m (another agent's anim; fails on the base too).
- The ACCAD Male2 brisk walk put the fly-whisk bearer's towel 0.02 mm over its bound: dropped (not shipped).
Done: people_hair and people_cloth build and reproduce in the cloud (pip bpy; tools/blender/ktx_cli.mjs now does given mip
levels, arrays, RDO and extract; cloth.py's workers run through bpy_cli.py). The skin's scanned micro-relief (ShareTextures
Human Skin, CC0) rides in the scan layers' alpha (scans.ktx2 re-baked: 13.2 MB, was 11.8) and is laid triplanar in place of
the finer pore noise: no new sampler; unseen at the cloud's distances. The court shell's snail cells on scalp and cheeks at
0.15. Mocap: BVH takes read into the CMU retarget (tools/mocap/bvh.ts); a woman's own walk, stance and talk from ACCAD's
Female1 (CC BY 3.0) in the women's sets, a woman carrying a box, one more man's walk. The CMU database's index is not
reachable from the cloud (the work and play takes need it to be chosen: kneeling, jars, children); 100STYLE not yet used.

**Round 4 (the face assets, the litter's crews).** The scanned face's relief (Lee Perry-Smith, CC BY 3.0) is in every head's
crease channel: subtle in the cloud's renderer (≤0.3 mm), unseen on the T4. Its albedo is deliberately not used (one man's
stubble and brows). The hair atlas's curls are loosened and rebuilt in the cloud; the people impostors were not re-baked
(Vagon: `node tools/blender/impostors.mjs`). Eyes unchanged (procedural since D-155). Biers and litters on the move are
carried in formation (the bearers at their corners, the object at the centre); the toddler sits where it plopped and hurries
after. Still open: a parent stooping to pick the toddler up; the litter's poles at hip height (C13's model, asked).

**Round 2-3 (the leads' asks).** Still open: the toddler's pick-up after a plop needs a crowd "hold in place" state (the
plop itself is in: anim toddle(…, plop)); the litter's royal woman is not drawn (C13 to hide or seat her: the cabin is
closed); each body its own idle (C5's poses). Unseen on the T4: the chariot, the litter, reins, wheels, door donkeys.
Done: the mouth takes the voices' IPA (crowd.voice's 5th argument; world.ts:815 to pass it), mounts trot/gallop by pace with
the rider's seat following, the wild herds bolt and come back (alarm, hooves, watching, walking home), herds to water at dawn
and dusk, the domestic cat in town yards (from the leopard body), the child's hand-hold fixed (people_children palms); the
toddler's gait and the children's stature ±3 %; carts' and chariots' wheels split out and rolled by the distance driven;
reins and lead ropes from the hands to the bit (people/reins.ts); the royal chariot driven (the king standing in the car,
anim charioteer; four horses abreast at the yoke, trotting by the pace; activities 'in the royal chariot'); the royal women's
curtained litter on four bearers' shoulders (workObjects 'litter'; carry_bier variants on a why naming 'curtained litter');
lane life: strays roam their lanes and bark at a stranger, penned stock mills, household donkeys tied at about one lane door
in twelve by day (fauna.json donkey; out on errands some hours, in at night, a bray now and then), hens out at the door
pecking in the lane and back in by the door.

**What a player now meets (measured, node + crude frames).**
- A person talking to you shapes the mouth: rounded on u/o/w, spread on i/e, lips pressed on m/b/p, the lower lip under the
  teeth on f/v, the jaw opening on the vowels (coarticulated, ~12 phones a second); the brows lift on stressed syllables, the
  head gives a small nod on the stress, the chest draws breath in the pauses.
- Their eyes jump and fixate (0.3-2.2 s) between your two eyes and your mouth, with a blink after most large jumps; listening,
  they nod now and then and tilt the head; a faint smile for the one they look at, warmer in some.
- A captured talking head no longer rolls its eyes up under the brows: the head follows the eyes (eye offset from the target,
  talk capture, 10 s: 0.70-0.85 rad without, 0.21-0.27 rad with, of which ~0.18 is the dead zone).
- The lids rest 1-2 mm over the iris (no doll's stare); the brows are clumps of hairs up close (visible at 0.3 m), the white of
  the eye shades into its corners.
- Cost: +1.6 us per near person per rig solve (face only where the crowd animates the face: lod 0-1), +48 B per person of
  palette, a few dozen ALU per human vertex; no new texture or sampler.
- Animals: the Bactrian camel and the pack camel have two humps (over the withers and the loins), the winter hair under the
  throat, on the upper fore legs and the humps, a browner coat; the zebu a rounded hump and a deep dewlap, grey-white. Library
  animals flick their ears (1.5-2.4 cm: donkeys, mules, horses, sheep, dogs, camels, deer, lions, wolves); the camels' and the
  dromedary's tails swing (19 cm walking). All four of the brief's procedural animals: camel and zebu now real-derived, boar
  and hare not (B820).

**Frames** (handoff/s18/c14/): faces_before_after.jpg (three faces at 0.5 m, before | after), talk_after.jpg (a talking face
over a second), mouth_after.jpg (the mouth at 0.34 m), animals_before_after.jpg (Cycles previews: camel, camel_pack, zebu
before | after; the anatomy models' white is the coat mask the game tints; boar and hare unchanged).

**Files.** src/people/face.ts (new), humanRig.ts, bodyShape.ts, humanMaterial.ts, animalRig.ts, animalModels.ts;
tools/blender/animals_derive.py (new), animals_look.py (new), lib/ktx2png.mjs (new), animals_real.{mjs,json},
lib/animal_inputs.mjs; tools/dev/face_probe.mjs (new); public/models/animals/{camel,camel_pack,zebu}.*, manifest.json;
tests/face_motion.test.ts (new), tests/animal_motion.test.ts (library ears now asserted).
**Tests.** face_motion, humans, humans_shader, body_variety, carry_props, people_models, vertex_inputs, react, animal_models,
animal_motion, fauna, solids, terrace_foot pass; humans_faces kandys fails as on the base; impostor_assets as above.
