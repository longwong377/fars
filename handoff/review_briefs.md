# Review briefs (to launch after the merges and the full high-quality render pass)

## Common preamble
You are an independent reviewer for PĀRSA (a Three.js 1:1 reconstruction of Persepolis in 467 BCE, repo at /home/user/fars,
branch claude/amazing-fermi-40ds7j). You have NOT seen the build process; audit what exists. Read PERSEPOLIS_BRIEF.md in full
(the binding spec: §1.1 intent, §3 rules, §7–§13 requirements, §14 gates), then CLAUDE.md, PROGRESS.md (the builder's own
account: treat it as claims to check, not facts), BLOCKERS.md, and the DECISIONS/OPEN_QUESTIONS rows your scope needs.
Do not edit source files; do not run Playwright (the renders are done: shots/*.png with luminance/stats JSON next to them).
You may run: `npx vitest run <files> --maxWorkers=1`, `npx tsx tools/lint_chrono.ts`, `npx tsc --noEmit`, node scripts that
read data. 4 CPU cores are shared; keep runs targeted. Look at every PNG you cite with the Read tool.
Write your review to REVIEWS/<name>.md: lead with CRITICAL findings (a gate text that is false, a §3 rule broken, a
chronology/anachronism breach, a claim in PROGRESS that the evidence contradicts), then MAJOR, MINOR, and a table of what
you verified and how. Every finding cites the file/line, the render, or the test output. Pass = no open CRITICAL finding.
Your final message: the verdict (PASS / FAIL), the CRITICAL list, and the path of your review.

## Phase 3+4 (the Terrace) — REVIEWS/phase3-4.md
Gates: Phase 3 "All §13 checks pass for the slice; a walkthrough bot completes the route; the §1.1 moments on this route land
in review"; Phase 4 "§13 passes for the whole Terrace". Scope: src/arch, src/render, src/sky, src/world (Terrace parts), the
camera-rig renders shots/moment-*.png, shots/sculpt-*.png, shots/relief-*.png, the plan overlay/dimension tests, walkthrough
bot results (tools/dev/botcheck.ts output; e2e walkthrough logs if present), the probe/exposure/detail tests, performance
proxies (bench-reports/, shots/*stats*.json). Check the §1.1 moments on the route AS SCENES (does each land?).

## Phase 5 (people and animals at scale) — REVIEWS/phase5.md
Gate: "Full evidence-based population simulated; rendered floors met within budget; no pop-in; soak test (§13.11) passes".
Scope: src/people, src/world/wildlife.ts, research/PEOPLE.md, tools/soak.ts output (latest soak report), the shadow reviews
REVIEWS/shadow_phase5*.md, the crowd-scale report REVIEWS/agent_crowd_scale.md, activity coverage (§9.5: no placeholder
performance anywhere), rendered-floor measurements and renders (shots/agent-crowd/, court assembly).

## Phase 6+7 (settlement and plain) — REVIEWS/phase6-7.md
Gates: Phase 6 "Lints pass; layout sourced and tiered"; Phase 7 "Lints pass; proxy performance at the plain vista".
Scope: src/world/settlement, src/world/plain, src/world/trees, research/SETTLEMENT.md, PLAIN.md, LANDSCAPE.md, the renders
shots/plain-*.png, shots/settlement-*.png, shots/agent-plain/, plain-stats.json (draw calls, triangles), the blocklist
(research/ANACHRONISM_BLOCKLIST.md: modern landscape, Sasanian features at Naqsh-e Rustam).

## Phase 8 (language, speech, music, translation layer) — REVIEWS/phase8.md
Gate: "Language lint passes; every translation is sourced". Scope: research/LANGUAGES.md, research/LEXICON/, src/speech or
src/audio, src/ui (translation layer, map, chronicle), music (research/SOUNDSCAPE.md), tests/language.test.ts, lang/speech/
music tests, NEEDS_FROM_ME.md #14. Verify that no modern language is rendered or heard in-world, every inscription is a
published text, and every translation shown in the layer is sourced (or flagged as blocked).

## §8.2 rubric — REVIEWS/rubric_phase9.md
A vision-capable reviewer scores camera-rig screenshots, 1–5 in seven categories: light, materials, scale cues, detail,
people, weather, atmosphere. Pass: no category below 4; anything that "reads as CG" goes on the fix list. Reference
photographs: none reachable (B6, logged exception); use references/ (catalogued in references/INDEX.md: reconstructions and
one photoreal mood image, NOT photographs of the site) and the reviewer's knowledge of real photographs of Persepolis, the
Marvdasht plain and comparable limestone architecture, and say so in the review. Judge the §1.1 moments as scenes.

## Shadow review round 5 (§13.11) — REVIEWS/shadow_phase5_r5.md
Input: `npx tsx tools/shadow_days.ts 1 97 > REVIEWS/shadow_days_input_seed1_pick97.txt` on the merged tree (after D-150).
Fresh reviewer, round-3 protocol (REVIEWS/shadow_phase5_r3.md ll. 3–33): score all 20 from the timelines + research files
first, save the scores to a scratch file, only then read earlier rounds/code. Pass: no score below 4.
