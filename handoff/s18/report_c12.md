# s18 C12 report: the giant-holes audit (D-770)

**Broken, placeholder or unseen first.**
- Nothing was rendered for this audit.
- Every frame claim comes from the s17 final train (renders/2026-10-03T02-27-39-final2, before the s18 merges) and the
  crude cloud frames.
- The biggest find is a contradiction I could not resolve without a render. The life census feeds the renderer 41,000-62,000
  people, with about 100-240 within 60 m of every Terrace point and about 60-180 in every town lane. The frames of those same
  places are empty. The coverage frames' `life` field is empty, so no frame ever counted its people.

**What the audit gives the session.**
- handoff/s18/holes.md: 25 ranked holes (pass 1) with evidence, the most probable 467 fill, the fix size and the owner.
- Pass 2 adds:
  - life simulated but not drawn;
  - the working land empty even in the simulation (fields 88 %, quarries 100 %);
  - about 35 absence rules to overturn in the data and research text, including "court absent is the default" in 9 files;
  - skin tone not tied to origin;
  - the delegations without their animals;
  - the first ten minutes as a newcomer;
  - faces, mouths and the guards' look.
- The census output is in handoff/s18/holes_life_census.txt.
