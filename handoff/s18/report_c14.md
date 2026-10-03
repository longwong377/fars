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

**Round 2 (the leads' asks), still open.** The royal chariot driven with four horses and turning wheels, reins and turning
cart wheels need moving vehicle geometry in workObjects/crowd (C5's files): not started, proposed to the lead. Mules and camels
"cut from the plain for budget": not found which cut (asked C9/the lead). Each body its own idle: poses are C5's (asked).
Storks and bats exist in wildlife.ts (C12's "none" is likely their months and hours: storks Mar-Aug by day, bats at dusk Mar-Oct).
Done: the mouth takes the voices' IPA (crowd.voice's 5th argument; world.ts:815 to pass it), mounts trot/gallop by pace with
the rider's seat following, the wild herds bolt and come back (alarm, hooves, watching, walking home), herds to water at dawn
and dusk, the domestic cat in town yards (from the leopard body), the child's hand-hold fixed (people_children palms).

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
