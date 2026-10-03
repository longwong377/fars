# s18 cloud lead handoff: lead 2 (session_01KpNq4F3cEPrA46Jxc87gdC) -> lead 3, 2026-10-03 ~09:15 UTC

Read first: CLAUDE.md, USER_DIRECTIONS.md (UD-38/39 are today's), handoff/s18/lead_handoff.md (lead 1's handoff + the
"Lead 2 state" section at its end), handoff/s18/sessions.md (every agent: files, branch, session id), handoff/s18/holes.md
(C12's ledger; dispatch from its status column), the last lines of handoff/s18/asks_cloud.md (Vagon -> cloud) and
asks_vagon.md (cloud -> Vagon), handoff/s18/agent_rules.md.

## Setup and the merge loop
`git fetch --unshallow origin s17-int || true; git checkout s17-int; npm ci --ignore-scripts; git config core.hooksPath .githooks`.
Integrate on s17-int, keep cloud-s17-int equal: after every merge `npx tsc --noEmit` (0), `npm run guards` (25/25), then
`git push origin s17-int && git push origin s17-int:cloud-s17-int`. Loop: `git pull --no-rebase origin s17-int;
git fetch origin 'refs/heads/cloud-s18-*:refs/remotes/origin/cloud-s18-*'; bash tools/dev/mergeloop.sh` (merges every ahead
branch, unions record files via tools/dev/union_records.py, STOPS on code conflicts: read both sides; JSON manifests: union by
key with node so floats keep JS formatting; the owner of a file wins a conflict in it). Vagon (the user's GPU box) also pushes
to s17-int: pull before pushing. Check-ins: send_later every ~25 min (the last one armed by lead 2 fires ~09:26 into lead 2's
session; lead 3 arms its own).

## THE TOP ITEM: the live site is black for players (deploy)
- Live = s14-int c3bde8ab (black on a real GPU). Deploy = push the head to s14-int (GitHub Actions builds Pages).
- The user APPROVED a cloud deploy on C9's clean check (DECISIONS D-810 + amendment). The auto-mode classifier blocks a
  self-initiated production push, so confirm with the user in one line before pushing if it blocks again.
- Candidate: s17-int e8e271e8 (or later). C9 (session_01HZDVcFsLpJxZXhbSEgB5FL) is building it and running the live path:
  (a) ?webgl=1&quality=low&nointro bright, (b) ?webgl=1 default (bright or __safeMode then bright), (c) WebGPU 0 'destroyed'.
  On 'DEPLOY OK <head>': push <head>:s14-int, log in DECISIONS and asks_vagon, tell the user.
- Causes found and fixed today: plain-stone dispose (C3); ground array null re-upload (C9 scans.ts); tone mapping left 0 after
  a throw (C4 824e2238); progressive compile deferring every full-screen quad (C4 da893241: THE live black); dispose mid-frame
  (C9 54402da5 deferDisposals); TRAA depth copy on WebGL (C9 c00c02d9 net + C4 e8e271e8 proper); black-frame watchdog that
  falls back to the low output (C4 e8e271e8). The cloud (SwiftShader) cannot render quality high on either backend: only a
  T4 run proves high. Next Vagon session: live_check on the deployed head first (asks_vagon.md has the list).
- Dist ~935 MB of the 950 MB deploy limit: C9 tracks it per merge; first cut = plant scans and plaster001 to KTX2.

## Open, by owner (all agents report ONLY to the lead; the old lead 1 is retired)
- C1 (pop): walkers barely reach the screen (C12 runs 5-6: 0-5 per view; 141 'at home' at the cov-142 lane 13:48) although
  the out-of-doors day is merged: C1+C5 tracing one errand through popview. The far fields (4-7 km) are empty at working
  hours: villages must work their own fields (C3 exposes plot data). Then fishers/shadufs spots, quarry gangs (traffic.ts is
  C1's), crafts reds (tannery/press spots), 'apart' children.
- C2 (town): building the lower town up to the Terrace's foot (it narrows settlement.test:35-40 itself); then C9 KTX2s
  plaster001, C5 rebuilds the nav grid. Town plastered 94.7 %, roofs on every room, shrines, life objects: merged.
- C3 (plain): plain relief/holdings merged; water surface and banks next; millet parked (box load).
- C4 (sky/night): night list (Milky Way sky for C11's stars shot, banquet and portico lamps, COURT_NIGHT_FIRES braziers,
  longer dusk), ledges.ts swap-before-dispose, town smoke over the Terrace (town_glow red), HDRI calibration.
- C5 (crowds): walkers trace with C1; T1 stale people after setTime (popview cache); pool saturation (400); popview reds.
- C6 (renders): round 4 on the current head: banquet near the throne ~20:00 day 15/19, night Terrace, town at 20/200 m noon,
  Terrace from 100 m. Forward its worst 5 to owners.
- C7 (CI): full run; population.test on the current head for C2/C1; the determinism bug (laid days dropped once the world
  passes them) is C8's.
- C8 (depth): the determinism bug above (A/B test), `ev: this.evSeen` in deeds save(), the 8 remaining walk issues, asks
  round trip, chains (hunger never happens).
- C9 (budget): the deploy check; dist; settle 1266 s and +41 MB before ready (from Vagon's budget run).
- C10 (Terrace): silent since 07:36 after the polychromy pass (merged). Chased: arris.ts swap-before-dispose, relief grounds and
  ceilings, Vagon surfaces grain, roofs/stairs, gates barred at night, planters. Chase again.
- C11 (film/score): done and merged (146 s film 8.9 MB, real hall IR). Next: higher-quality cloud film, town shot, stars shot
  after C4's sky, a listening self-review.
- C12 (audit): pagecheck on every head with C1/C5 people changes; chases 'sent, no commit' rows at 60 min.
- C13 (court): night servants, couches, noble houses merged; sealed-letter test timeout; people_drape far-colour red (ΔE 12).
- C14 (faces/animals): hair rebuilt in the cloud (reproduces), cloth rebuilding; then crown shell noise, ShareTextures pore bake,
  people impostors in the cloud, mocap (branch s18-mocap).
- C15 (beyond): villages and estates in use; report pending.

## Assets Vagon fetched (keep assets-raw on its branches; commit only built outputs; CC0/CC-BY; ledger rows)
s18-face-assets (faces, plants, props, surfaces, hdri, score) and s18-mocap (CMU, ACCAD, 100STYLE). Library props: only
culture-neutral ones (UD-37). Digital Emily 2 (a real actress's face, own NC licence) left out: the user has not decided.

## The user
Wants everything working and fantastic today; full steam; short status lines that lead with what is broken. Never deploy
without the clean check; never loosen a gate.
