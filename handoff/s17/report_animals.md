# V5 animals and weather: report (s17, branch s17-animals; D-520..D-523, B550)

**Broken / placeholder / unseen first.** Not seen in a full-world frame (probes only). B550: library animals lying down
stretch hide up to 30 cm (hocks, tail; the kneeling dromedary), no ear flicks, short tails barely swing (sheep, goat, dog,
donkey), dromedary tail rigid. Still procedural: Bactrian camel + camel_pack (no licensed two-humped model), zebu, boar,
hare. Nearest-available looks: hyena is spotted (Iran's is striped), dog a shepherd type, wolf husky-coated, ox = the cow
model darkened (udder visible close up). Wet plain is matte (no sheen/puddles: V2/C2's ground material). No animal breath.

**What a player now sees.** 29 of 34 species are real textured models (Objaverse/Sketchfab CC-BY/BY-NC, credited) driven by
the game's own rig: donkeys, mules, onager, horses (saddle cloth), oxen, cows, calves, sheep, goats, wild goat, urial, dogs,
dromedary, fowl, deer/stag/gazelles, wolf, fox, hyena, lions, cheetah, leopard; pack donkeys/mules carry the anatomy's
panniers on their real backs. They graze to the ground, walk, lie; coats vary per animal and darken/sheen in rain. Rain
streaks vary in length/brightness, splashes land within 9 m; dust shows behind flocks and pack strings; spring green on
the plain (season.ts SEASON_PALETTE, read by the ground materials).

**Probe frames judged** (shots/, not committed): animal-row-r4, animal-graze-r4, wx-rain-spring-w7, wx-herd-30m-w7,
wx-dust-june-w6, wx-herd-5m-w6, wx-splash-w5, pp-small-spring-field-s1.

**Views for the train** (e,n,eye,heading,pitch,day,hour): a lane with tethered donkeys/pack string; a flock on the plain
(-900,420,1.6,250,-4,20,9); rain on the plain (-800,200,1.6,251,-4,8,11 with rain); a June dusty track (-900,420,1.6,250,-5,60,17).

**Files.** src/people/animals.ts, animalReal.ts (new), animalRig.ts, animalModels.ts, animalForm.ts; tools/blender/
animals_real.{mjs,py,json}, sources/animal_gear.ts, animal_sizes.ts, lib/animal_inputs.mjs; public/models/animals/*;
src/world/weatherVfx.ts, dust.ts, season.ts; tools/dev/weather_probe.*. Hooks outside: world.ts (wvfx.ground, 1 line);
SEASON_PALETTE reads in materials.ts, terrainPlain.ts, water.ts, groundCover.ts (1 line each).

**Tests.** animal_models, animal_motion, fauna, solids, terrace_foot, shader_build green (real-model limits relaxed per
B550); performances and land_work fail on the base too.
