# s18 lead 3 -> lead 4 handoff (12:00 UTC). Read in order: CLAUDE.md, USER_DIRECTIONS.md, handoff/s18/STATUS.md (one page:
# what is broken, live, who works on what), handoff/s18/reset.md (the finish line, the blind review, the review loop, the
# asset replacement), handoff/s18/lost_work.md, handoff/s18/sessions.md (agent session ids). Then this file.

## The user, today (in their words, paraphrased only where noted)
- "The lead is the game director: decide and deploy, don't ask for approval." Budget is tight (weekly usage ~85-93 %): the
  game has to look and play as well as possible by then; the blind reviewers scored it 3/10 and the user wants it fixed, then
  re-reviewed, "again and again until everything passes". Short, honest status; lead with what is broken.
- They asked: are we missing work (yes: 3 unmerged branches + 2 unwired features found; see lost_work.md), too many sessions
  (cut to ~10), who plays the game end to end (C7, now playtester + full CI).

## Your loop
1. Merge: `SKIP=c14-faces bash tools/dev/mergeloop.sh` (drop the SKIP once C14 says its hair/cloth/impostor rebuild landed
   green), `npx tsc --noEmit`, `npm run guards`, `git push origin s17-int && git push origin s17-int:cloud-s17-int`. The loop
   also lists every unmerged non-data branch (UNMERGED lines): the 6 listed now are known (lost_work.md).
2. Send priority changes to agents with send_message priority "now": a normal message waits behind a long agent turn (C4 and
   C10 sat on old plans for an hour because of this).
3. Deploy (no approval needed): when C9 says 'DEPLOY OK <head>', `git push origin <head>:s14-int`, one DECISIONS line, and
   check the Pages run (mcp github actions_list, workflow pages.yml). Pending: C9 is checking s17-int 4cb2ca34.
4. Review loop: C6 renders the 13-view review set (renders/_sets/review.json on s18-renders-cloud) on a head you name;
   cycle 1 (head e1520f63) lands ~12:20 in s18-renders-cloud renders/*review*. Copy the frames to your scratchpad and run
   TWO fresh blind reviewer subagents with the cycle-0 prompts (a blunt game-art critic scoring 1-10 vs "a photoreal AAA
   open-world game recreating Persepolis in 467 BC as a living city"; a player of AC Origins/RDR2/KCD2 with gut reaction and
   score). Record scores in reset.md, retarget owners on the top items, then cycle 2 on the head with C4's light + C2's decals.
5. Keep handoff/s18/STATUS.md current; check-ins with send_later ~30 min.

## Open right now
- C14's bacc6d1d (anatomy) waits for its rebuild (~1 h): do NOT merge it alone (mergeloop SKIP).
- econ_plans: 1 red left after C8's patch ("every laid stretch is performed ... nobody moves without a walk"): C8/C1.
- C7's last full run: 78 reds on an old head; C7 re-runs on the current head and reports owners.
- Town walking: plans 4-11 % on the move (C1, 4f5cf872); C1 is measuring what the view draws.
- C2: hatched decals first (the reviewers' "bug"), the town kit on walls, roofs, test scopes (fields, herb, dung).
- C10: Terrace kit batches 1-2 merged (cornices, plinths, tower windows); next the cov-252 slab and capitals, ashlar.
- C4: daytime light steps 1-2 merged; continues (interiors >= 40/255 at 10:00).
