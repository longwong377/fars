# s18 reset (lead 3, ~09:50 UTC, after the user: "no excuse for it being so unfinished; what are we doing wrong")

## What we are doing wrong
1. Breadth over finish. 15 agents each add content (stars, wayside wells, tomb inscriptions, estates, a film score) while the
   basics a player meets in the first minute are broken: the live site black for hours, nobody walking in town, roofless
   lanes, black interiors. CLAUDE.md's own rule (UD-19) says a plan whose next step is a detail while the whole reads as CG is
   wrong; the lead (me, today) kept dispatching details.
2. Building blind. The cloud cannot render quality high; the T4 is rarely up; so work is "done" on node tests and crude frames.
   Nobody owns the one thing the player actually runs: the deployed URL.
3. Everyone touches everything. One change (the town belt) broke tests owned by four others; the lead spends the day relaying.
4. No finish line. "Done" was never a list of measured facts, so every round adds more.

## The finish line (the slice, measured in the cloud on every head; nothing else counts until all pass)
A. The deployed URL is lit on the live path (title, Enter, 60 s walk) on WebGL low and WebGPU, no faults (C9 live_path).
B. People move: at every C12 pagecheck town view >= 5 % of in-frustum people walking; popview unresolved routes drain to
   < 200 within 2 game-minutes; Terrace gift-day draws >= 50 % of the people planned within 60 m (C5/C1, C12 measures).
C. The town reads lived-in: open-to-sky cells < 20 % in C6's town views; no interior below mean 40/255 at 10:00 (C2, C4).
D. Faces have no bugs at 0.5 m (beard cards, head roll, torc) (C14).
E. CI green on the head (C7).

## Who works (everyone else finishes their current commit, pushes, reports, and stops)
C9 deploy + live path + load; C4 interiors/night light + render path; C5 + C1 routes/walkers; C2 roofs/walls; C14 face bugs;
C13 banquet hall tables/seats only; C10 paint that reads at 0.6-2 km only; C7 CI; C12 pagecheck each head; C6 renders each head.
Stopped: C3, C8, C11, C15 (their merged work stays).

## Blind review (10:1x UTC, two independent reviewers, T4 frames 9700b06d + cloud frames c7dcb652): 3/10 and 3/10
"A mid-2000s mod built from boxes" / "an Unreal Marketplace ancient-city demo: placeholder skin and mannequin people".
Works: the Apadana hall crowd, the painted porch, the terrain and far views. Retargeted to the reviewers' top fixes:
1. Light (C4): GI/AO, contact shadows, bounce, interiors exposed, filmic grade; flat grey-beige everywhere.
2. Surfaces (C2 town, C10 Terrace): the hatched decals with cut-out blotches read as a bug (kill or redo); no bare box walls,
   mud-box courts or single-brick slabs: courses, timbers, parapets, doors, awnings, worn edges, AO at the wall foot.
3. Ground and dressing (C3 plain, C15): fields in hard colour strips and sparse sprites -> blended dense cover; clutter in
   every court and lane.
4. People (C14 close-up: faces, beard cards, clipping; C5/C1: no rows, no one lying in the court, crowds spread, no arms-out pose).

## The review loop (the user, ~10:10 UTC: "fix, then do it again and again until everything passes")
Cycle: owners push fixes -> lead merges -> C6 renders the fixed REVIEW SET (13 views) on that head -> two fresh blind
reviewers score it (same prompts as the first review) -> lead retargets owners on their top items -> repeat.
Pass = both blind reviewers >= 7/10 AND finish lines A-E. Deploy whenever a cycle's score rises and C9's live path is clean.
Scores: cycle 0 (9700b06d T4 + c7dcb652 cloud): 3/10, 3/10. Cycle 1 (e1520f63, 7 views + 5 c7dcb652 baselines; pre decals-off/C5 crowds): critic 3/10, player 3/10. Both top items: light/atmosphere (black interior, no haze/smoke) C4; faces + frozen mid-poses, floating pots, wall clipping C14/C5; roofless box town, no doors, repeated plaster patch C2; colour-band fields, blob trees, grey river C3; empty banquet C13. Best: Apadana hall 5, banquet 5.

## The asset replacement (the user, ~10:45 UTC: "get it done, it should have been done years ago")
The big forms are still code boxes (398 modelled files are props, columns, animals) and the people a MakeHuman base. Now:
- C15 D-802: the town kit in Blender (public/models/kit/town/, manifest with footprints/sockets); C2 places it along every
  house wall instead of Batch.box (boxes only as the far LOD).
- C10 D-803: the Terrace kit in Blender (ashlar facing, merlons, stairs, stone frames with cavetto cornices, plastered walls);
  Gate and Apadana first.
- C14: the base body reworked in Blender (anatomy, variety by age/work, skin, hair on every head); C13 D-804: the garments
  as baked cloth simulation.
Budgets bind (load, frame, heap, 950 MB dist). Verification: the review loop.
