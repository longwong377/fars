# Brief: speaking with the people (D-296; session 11)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-18, UD-08, UD-11 and the thresholds T-E9 ("share of the conversation test set (spoken or typed prompts to people within 3 m, every class of person, every hour) answered in character within 4 s, with nothing anachronistic (the T-I1 checklist) and no hint of the world's fate" >= 95 %).

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 2 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-296, Q-770..Q-779, B97..B99; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.

## Machine
On the GPU machine (session 11 on: Windows, NVIDIA T4, 16 cores, 63 GB, open internet), this clause governs where it
   differs from 3 and 7. Render with Playwright directly on the real GPU (`PW_CHANNEL=chrome --project=gpu`, your own
   E2E_PORT), at the player's lens and quality; a page load is ~11 min, a warm frame 0.1 s, so put all your views in one
   load (moments.spec.ts `BATCH=1`). Never edit files in a tree whose dev server is serving a render (it reloads the page).
   Run node jobs directly (no cpu_slot.sh, flock or python here). Surfaces must read as real at arm's length: use CC0
   scans and assets (Poly Haven, ambientCG; src/render/scans.ts; each recorded in ASSET_LEDGER.md) over the procedural
   base, keeping the measured tints and layouts; a procedural stand-in where a scan exists is a placeholder.

## Slots
- **Task:** study, design and prototype UD-18 as DECISIONS D-296 lays it out (read D-296 first). (1) Survey and MEASURE ON THE T4 the in-browser stacks: speech recognition (Whisper-class via transformers.js / ONNX Runtime Web / whisper-web), small language models (WebLLM / MLC, transformers.js, ONNX; 1-3 B, 4-bit: e.g. Qwen2.5, Llama 3.2, Gemma, Phi), voice synthesis (Piper/Kokoro/VITS ONNX in the browser): tokens/s, first-token latency, GPU memory, download size, licence. Downloads from Hugging Face / GitHub are approved by the user; record every model and its licence (personal non-commercial use is the project's licence; ASSET_LEDGER.md). (2) Design the baked lives: read src/people/ (population, households, plans, names, the year's events) and specify a per-person record (history, ties, debts and quarrels, temperament, speech habits, knowledge fence) generated offline from the simulation's own facts; generate a sample for ~50 people with a local model and judge it. (3) A working prototype on a dev page or a ?converse flag: speak (mic) or type to the nearest person on the Terrace; the model answers as that person from their record; the reply in the translation layer (English, out of world); heard: the person's voice with attested words where they exist (src/data, voices.ts) and period prosody, an English voice only as an out-of-world option. Never hint at the fate (the brief's §1.1); nothing anachronistic (research/ANACHRONISM_BLOCKLIST.md). (4) The T-E9 test set: ≥ 60 prompts across classes, places and hours incl. adversarial ones (the future, modern things, meta questions); score it. (5) GPU budget: the model must fit beside the renderer (T-K8); measure frame time with the model idle and answering.
- **Areas:** the Terrace first (nearest people), then any.
- **Files in scope:** new src/people/converse/** (or similar), a dev page, tools/dev/bake_lives.*, tests for it; read-only elsewhere except minimal hooks.
- **Done means:** T-E9 measured on the test set, the prototype working in the real Chrome on the GPU, a report with the stack chosen and measured, the baked-life schema and sample, the risks.
- **Reserved numbers:** D-296, Q-770..Q-779, B97..B99.
- **Render budget:** 2 browser runs for screenshots; the prototype itself may be driven by Playwright as often as needed (it is not a render job).
