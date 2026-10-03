# PĀRSA s18 status board (lead 4 from 11:55 UTC; one page; replaces the scattered notes for "where are we")
Updated 12:05 UTC, s17-int fd762af7 (C2 decals off + C10 kit merged) (= cloud-s17-int). Plan and finish line: handoff/s18/reset.md. Lost work: lost_work.md.

## Finish (UD-40): presentable by 93 % weekly usage. Feature freeze now; agents land only green review fixes; the lead deploys the best DEPLOY OK head and stops work in flight before 93 %.

## Broken or unknown, first
- LOOK: two blind reviewers 3/10 (cycle 0). Review cycle 1 rendering on e1520f63 (~12:20); cycle 2 after C4's light + C2's decals.
- MEMORY: JS heap ~3.5 GB at the 4 GB tab cap: players may crash on a long walk. C9's geometry release merged, unmeasured.
- SIZE: current build ~1,014 MB > Pages' 1 GB: no deploy possible until C9's prune is measured (~907 MiB expected).
- TESTS: last full run 78 reds (old head eb6f768f, 11 unconfirmed timeouts); C7 re-runs on the current head.
- PEOPLE: 2 % walking in town (target 5 %); route backlog ~290 (was 3,563); gift-day middle thin; some lie in courts.
- UNSEEN: nothing since the morning has been seen on a real GPU (the Vagon box is off).

## Live
https://longwong377.github.io/fars/ = s14-int ab009bc8 (D-813, 12:57): the UD-40 freeze head.

## Agents (9 working)
| agent | job now |
|---|---|
| C4 | daytime light (step 1 merged: ambient 1/4.5, filmic grade, contact AO) |
| C2 | hatched decals + D-303 scans port, then C15's town kit on every house wall, roofs, test scopes |
| C10 | Terrace kit (cornices/plinths/tower windows merged), then the plain wall faces, capitals, ashlar |
| C14 | base body (anatomy, variety, skin), impostor budget red |
| C13 | garments as baked cloth (robe family first) |
| C5 + C1 | routes, walking, crowd spread; no lying/rows/bind pose |
| C9 | heap and dist size, the deploy check |
| C7 | playtester + full CI on every head |
| C6 | the review set (13 views) per cycle |
| C8 | lands the lost s14-simtalk conversations + drinking red, then stops |
Stopped (work merged): C3 plain, C11 film/score, C12 audit, C15 beyond/town kit.

## Merged today that a player should notice (judged in the review cycles)
Black screen fixed; film + score; painted Terrace (white walls, red/blue crests) with modelled cornices, plinths, tower windows;
portico hangings and royal standards + drum road (wired by the lead); lower town to the Terrace foot; Naqsh-e Rustam, estates,
villages, roadside; blended fields, river, herders; night sky, fires, comet; faces (beards, brows, head tilt, skin sheen),
women's walks; banquet seated; crowds unstuck after time jumps.

## Never merged before today (now being ported)
s14-simtalk (conversations from the simulation) -> C8; s11-realism-town (scanned town surfaces, lane litter) -> C2;
cloud-s15-load (memory cuts) -> C9. Built but never wired: C10's dressings + drum road (wired 7c7bea63).
