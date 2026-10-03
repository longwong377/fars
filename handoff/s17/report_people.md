# s17 V3 people — report (D-500; branch s17-people)

**Broken / placeholder / unseen first.** Not seen in the full world (no world loads by rule): every frame below is humanlab at
the player's lens (fov 60, 1920x1080, Q high). Faces at 0.3-0.7 m still read as game NPCs, not AAA heroes: MakeHuman heads,
painted-looking brows, flat eyes; the shadow on a face is still a little stair-stepped (coarse LOD 2 caster). No new mocap
performances (CMU reachable again; takes for sweep 13_23-25, mop 14_13, drink 13_09, dance 55_01/90_30 are listed in
T:/s17-v3-mocap/takes.txt for the next pass; B181 stands). tests/impostor_assets "within budget" fails (56.6 vs 56.1 MB) as
before this branch (atlas size unchanged). Timing tests (humans_runtime, performances, popview costs) fail only under load.

**What a player now sees differently.** Upright people: the CMU captures' forward-tipped pelvis removed (no sway-back, no pot
bellies); men's tunics taper to the belt instead of ballooning; short sleeves no longer stand out as epaulettes; no
stair-stepped self-shadow blotches on faces and tunics (casters drawn inside the surface); dense beards and fringes (no
see-through net); hair lifted from black with sheen; warmer, sun-tanned skin, living colour in nose/cheeks/ears, lips not
lipstick; warmer undyed cloth with wear mottling; no stepped streaks on garments (fold bump fixed); headbands sit on the head;
long skirts no longer kicked through; calmer talking arms; relaxed hands. Wounds from the deeds (bandage head/forearm, splint,
broken-leg limp) and healed scars from marks.ts. C3 asks landed: walk /driving a flock/ (animal kind 'drive') and /ox cart of
building stone/, /emptied stone cart/, /holding the stone cart/ (cart_stone). Cloth, hair and Cycles impostors rebuilt.

**Probe frames judged** (shots/v3/, not in git): base/* (before), r19, r21, r25 d03-court, r26 d1-beard, r27 d1-worker, r28
fire and lane, r29 d02-sit/d10, r30 d10, r31 lane, r13 asks, r17 marks, r23 walkseq3.
Driver: `PW_CHANNEL=chrome node tools/dev/gpu_slot.mjs v3 -- node tools/dev/people_probe.mjs <out> [shots]`.

**Views for the lead's train** (e,n,eye,heading,pitch,day,hour): a town lane at 10:00 and 17:00; the market at 10:00; the
Apadana court with guards at 10:00; any road with a /driving a flock/ herder (C3).

**Files.** src/people/{mocap,anim,humanRig,drape,looks,humanMaterial,outfits,peopleModels,crowd,activities,animals (hook),
workObjects}.ts; src/dev/humanLab.ts (marks API); public/models/people/*, public/models/impostors/*; tools/dev/people_probe.mjs
and small node probes. **Tests:** body_variety, people_drape, people_models, humans_shader, people_look, performances (alone),
impostor_frames, guards — pass; humans_faces kandys and popview child width fail as on s17-int before this branch.
