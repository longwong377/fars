# s18 cloud lead handoff (old lead session_01JNSEZTcqarLMRgqNU97TUk -> new lead, 2026-10-03 ~06:10 UTC)

The user asked for a fresh lead because the old one's context grew long and it dropped work (see "What went wrong").
Read first, in order: CLAUDE.md, USER_DIRECTIONS.md (UD-38, UD-39 are this session's), sessions/s18-start.md, this file,
handoff/s18/sessions.md (every agent, its files, branch, session id), handoff/s18/holes.md (the audit ledger),
handoff/s18/asks_vagon.md and asks_cloud.md (last lines), handoff/s18/agent_rules.md (the agents' shared rules).

## Branches
- **s17-int** is the integration branch (designated for this session); **cloud-s17-int** is kept equal to it
  (`git push origin s17-int && git push origin s17-int:cloud-s17-int` after every merge).
- **s14-int** deploys the live site (GitHub Pages). Live = s14-int c3bde8ab (Vagon deployed 04:50 UTC; first frames 39.2 s T4).
  Everything since (all of s18's cloud work, V8/V9, sound, score) is unmeasured on a GPU: deploy only after a Vagon budget run.
- Agent branches: cloud-s18-c1-tick ... cloud-s18-c15-beyond; C6's frames on s18-renders-cloud (data, never merged).

## The merge loop (what the lead does)
1. `git pull --no-rebase origin s17-int`; `git fetch origin 'refs/heads/cloud-s18-*:refs/remotes/origin/cloud-s18-*'`.
2. For each branch ahead of HEAD: `git merge --no-edit origin/cloud-s18-X`. Conflicts only in DECISIONS / OPEN_QUESTIONS /
   BLOCKERS / PROGRESS / ASSET_LEDGER: `python3 tools/dev/union_records.py <files>` (keeps both sides), add, commit.
   Any other conflicted file: read both sides and merge by hand (e.g. groundCover.ts imports: keep both). Blocklist files
   (src/data/blocklist.json, research/ANACHRONISM_BLOCKLIST.md): C12's side wins (D-771).
3. `npx tsc --noEmit` must be 0 errors (fix small type errors yourself with a cast and tell the owner); `npm run guards`
   25/25 (the pre-commit hook runs it; never bypass). The clone must be unshallow (`git fetch --unshallow`) or guards fail.
4. Push both branches; tell C6 (renders) and C7 (tests) the new head; tell C12 (pagecheck) the new head.
5. world.ts is the LEAD's file: agents send one-line hooks for it (done so far: sim.aheadMs / sliced jumpTo D-650,
   view.setDoorways D-690, apadanaRoom/banquetHall D-780, caption lang cast). Apply them when asked.

## Agents (15) and what each is on now (06:10 UTC)
- C1 tick/population: 9 building gangs living in villages (not pushed yet), new game starts the day after the court arrives;
  next: people at C3's works spots (worksLayout API), meals/feeds kept, household religion, names (W1/W2/W10), chronicle text,
  then save/load identity and the far-jump CPU.
- C2 town: merged 803a0e76 (roofs as lips not trays, doors drawn, every house enterable, lower-city belt ~680 plots, washes);
  open: stiff laundry (fill_line model), fill_skin slab, half-built house (plot id to C1), village_p22 triangle gate (2.05 > 2.0 M),
  settlement_build mesh count 55 > 45, plan build 19 -> 37 s (baked). ASKS pending for the lead: rebuild the nav grid for the
  new doors (tools build_nav: give to C5) and let build_nav take the town's colliders at the Terrace foot.
- C3 plain: merged 31473ba9 (one wind for all plants, works built with worksLayout API, qanats, tree rebake in worker, fords
  dedupe, river period names). Open: millet, soil moisture (P2-10), river banks.
- C4 sky/night: far sun cascade merged; on night light (torches, braziers, lit doorways, moon maria, seasonal clouds, star
  extinction, heat shimmer, snow cap, comet, dusk timing), banquet lamps after C9's fireOcc bake.
- C5 crowds/walk: merged crowd spacing; TOP: the drawing drop (people simulated but not drawn: C9 found only humans:*:lod3
  visible in the page, every lod0-2 and people:impostors visible=false); then props (done, unpushed), visitor default + guards
  that stop you, src/world/visitor/, player lamp, rides (row 23), gates barred at night, parasol follows the king, daily relook.
- C6 cloud eyes: round 2 on 77dced10 running since 05:55 (20 views incl. a face at 0.5 m, gift-day morning, banquet night,
  people drawn vs sim per view); then C11's 'stars' and 'town' opening shots; coverage cameras that face walls (row 22).
- C7 CI: full suite on ca471bef (~70/271), then 132ab90c; table in handoff/s18/ci.md; ~15 old failures fixed or root-caused.
- C8 depth: E talks to anyone (merged); on the W5-W22 dialogue fixes, trading (bread/beer), trespass deed, econ steps through
  plan rules (land_work), court people not sent to market (C7's patch at economy/plans.ts:280), visemes text to crowd.voice,
  talk panel strings, period-accent voices.
- C9 budget: merged KTX2 everywhere (ready 64 -> 52 s cloud, memory 5.35 -> 4.55 GB); on: dist prune (~934 MB of 1 GB, +44 MB
  score, film <= 12 MB: guard at ~950 MB), RGBA8 -> KTX2, writeMask validation error, frame time 135 ms / settle 922 s, fireOcc
  for banquet lamps, wildlife on the sun.
- C10 Terrace: merlons, hangings, standards, tower windows merged; TOP: the full polychromy pass (walls, capitals, colossi,
  frames, timber, reliefs fully painted; the 'Treasury alone' and relief 'do not paint' tests change; palace plaster sound, no
  V9 plaster loss), grime/scans fresh stone; then reliefs triangle gate (cypress), 4 Blender assets, roofs/tower stairs, ramp.
- C11 cinematic/score: merged (62-min score on sampled orchestra, no §11 cliché; opening re-cut; polished UI; one talk key);
  the title film rendering in the cloud (~45 %); T4 job and fetch_vagon on Vagon's list.
- C12 audit: four passes done; now the in-page truth check (tools/dev/pagecheck.mjs, handoff/s18/pagecheck.md) on every head,
  and the LEDGER: a 'sent to / status' column on every holes.md row, UNSENT list to the lead after each run. Dispatch from it.
- C13 court: merged (programme, dress, guards, kidaris); on the king daily (walk to audience, rides, chariot arrival), gift
  models, proskynesis pose, festive dress/toys/jewellery (P2-7), headbands fit.
- C14 faces/animals: lips/visemes (hook in crowd.ts), idles, camel/zebu merged; on horses' gaits, the royal chariot, beasts that
  flee (beasts.ts), storks/bats/cats, the mother-child hand-hold, the impostor atlas rebuild.
- C15 beyond (new 05:57): Naqsh-e Rustam painted and all three inscription versions carved, second tomb being cut, estates /
  pavilion / Dasht-e Gohar hall as painted porticoed buildings, villages coloured, Akhor Rostam niches and rock tombs.

## Rules learned this session (binding)
- Judge the living city of 467 BC, never the ruin (CLAUDE.md, review_briefs.md BINDING OVERRIDE, agent_rules.md last paragraph).
- A node census is not the page: verify every fix class in the page (C12's pagecheck) or a frame before calling it done
  (the roofs and the people both passed in node and failed on screen).
- Dispatch from the ledger, row by row; never say "every row has an owner" without checking holes.md's status column.

## What went wrong (so the new lead does not repeat it)
- The lead routed C12's audit from its summary messages and dropped rows (row 20 Naqsh-e Rustam/estates; rows 22, 23,
  P2-7, P2-9, P2-10) until the user asked. Fixed by the ledger column.
- The lead spent an hour hand-fixing one road (D-730) instead of dispatching; delegate small fixes.

## Vagon
s17 Vagon session closed (sessions/s17.md; its final note is the last 'Vagon lead' line of handoff/s18/asks_cloud.md). The
user is starting an s18 Vagon session on s17-int; its list is the last 'cloud lead' lines of handoff/s18/asks_vagon.md:
the empty-frames check (cov-252/cov-037 with the F3 population line), a budget run vs c3bde8ab, one batched render, the 6
failed sound sets, C11's fetch_vagon.mjs and T4 film job, deploy only if no metric is worse. The Freesound key appeared in a
chat transcript: the user may regenerate it.

## The user
Wants full steam, bulk work, every hole found before they find it, AAA open-world look, the living city not the ruin, a
Hollywood-level opening and score (UD-38/39). Status messages short: what changed, what is broken first. Usage: every
session shows the 7-day limit warning.
