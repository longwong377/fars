I stopped at session close. Everything is committed on branch `worktree-agent-ad15c96a0cad2c7c4` (not pushed). Last commit is 7ea6b85, a WIP commit on top of e223bac.

**Broken or not checked (read first)**
- **One known failure.** The people_days run was stopped at close, but before that one test had failed: "on the dust days nobody sits in the lane while the dust is in the air". It is probably caused by the new care layer: the barber in the lane or the doorstep scenes during dust hours. The shaves and combing skip days when `C.wx.dust` is set; they probably also need to check `wx.dustH`. Not fixed.
- **Not re-run after the second commit:** the rest of people_days, performances, impostor_frames, popview, humans_runtime and audio_population. I changed audio_population myself (the new lullaby test and the wordless-sound lists). I also added 4 impostor frames, so the atlas has more rows; the pinning tests have not been re-run.
- **No render at all.** Neither of the 2 browser runs was used, and no moment was added to moments.spec.ts. `tools/dev/body_find.ts` is written, to find a pregnant woman in a morning lane and a camera pose, but I never ran it.
- **Not recorded:** no DECISIONS D-292 row, no WORLD_INVENTORY status changes, and COVERAGE.md is not regenerated. No Q or B numbers used.
- **Known limitation:** impostors, the stand-in people at distance, do not show the belly.

**Done and tested (commit e223bac)**
- **Visible pregnancy (C-D09).**
  - `Population.gravid`, `dueIn` and `expecting` come from this year's births. The women who give birth in the next year's first months are drawn at the same rate from a separate random stream, so no other draw moves.
  - The belly is drawn in the humans' vertex shader (humanMaterial). It mirrors `drape.ts bellyOffset`, uses spare slots in the per-person data row, and follows the normals. Clothes are taken up by the belly without ever passing into the body.
  - The crowd refreshes the belly daily. The dev overlay (F3) says "with child, birth in N days".
  - `tests/people_belly.test.ts` passes: about 15 cm at term, growth with the months, head, hands and back untouched, no body through the clothes.
  - Seed 1, 6 sampled days: 5.38 % of women 15-44 visibly with child (target 3-6 %), 0 bellies on women who give no birth, and no day-to-day jumps.
  - humans_shader and people_pieces pass. I checked the shape in node side-view previews.

**Done, only partly tested (commit 7ea6b85)**
- **The body's care.** It is a new layer on top of the day plans that reads only other people's raw plans, so no plan waits on another. It adds a new activity, `tend_body`, with 3 new animations (face washing, delousing, shaving), impostor frames and a basin object.
  - Morning wash: everyone of three and over in the town and the plain washes at rising. The minutes come off the end of the night's sleep, so no morning work moves.
  - A child's hair gone through for lice on the doorstep; the view seats the child in front of the woman.
  - Barbers in each town quarter shave men in the lane in their free hours.
  - `tests/people_care.test.ts` (5 tests) passes. It checks that washing moves no morning work, that the pairs are together at the same hours, that the care adds no plan faults (checkPlan and checkDay), and the poses.
  - Trace, seed 1, every 3rd person: 3.54 washes per household-day, delousing 0.1 per household-day, 0.61 shaves per man per month.
- **Washing rule (Hdt 1.138).** Persians and guards wash clothes on the bank with water drawn in a jar, with a matching pose and a jar on the bank. Trace: 0 of 1,794 washings in the stream.
- **Only checked by the type-checker:**
  - the wordless lullaby (voices.ts, plus a new test that has not been run);
  - the herd boy's sling, a new animation shown on 45 % of boys 8-17 while herding;
  - a word and a look at the well before a wedding;
  - work injuries that give a limp on a staff for 3-12 days.

**Commits**
- e223bac: visible pregnancy.
- 7ea6b85: WIP, everything else.
