# s18 C7 report (CI and the old failing tests; D-710; cloud-s18-c7-ci)
**Broken / unseen first.** CI is not green. The last full run (eb6f768f) had 78 red tests in 41 files (11 of them load timeouts);
the list with owners and first-bad commits is in ci.md and ci_fails_eb6f768f.txt. A confirmation rerun on e782fc37 was stopped
on the lead's order before it finished, so nothing is confirmed on the current head. Open, not mine: C2's belt (D-661) reds,
C13/C14 Blender rebuilds (people_hair/cloth, impostors, lamassu), C8's deeds overlay (patch in handoff/s18/patches), the
plans-read-after-the-world-moved determinism bug (C8/C1), C1's name share and tannery spot, C11's Math.random, C15's DNc text.
**Done:** ~20 old reds root-caused; fixed in tests/data/tools where the change behind them was shown intended (instruments,
religion, sculpt, humans_faces, people_children lame, popview, coverage, arch, blender hashes, r3 water, person_census,
adult_only via roadFolk.ts, horizon re-bake); coverage views now face open bearings (holes row 22); no threshold loosened.
