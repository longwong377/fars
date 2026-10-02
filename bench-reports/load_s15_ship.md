# s15/ship (D-393): the static site's load: measured numbers

Setup: tools/deploy/build_site.mjs, run from a fresh `git clone` (C:/Users/Administrator/fars-train/ship-clone, node_modules
linked). Served by tools/deploy/serve.mjs under /fars/ the way Pages serves it (gzip, max-age=600, ETag), with a shared
cap of **100 Mbit/s**, on 127.0.0.2 (a public-style origin, so the models come from Hugging Face). Installed Chrome with an
empty profile, `?norender&quality=high&trace`. Box: Vagon, 2 cores / 4 threads, 16 GB RAM, Windows Defender scanning every
cache write. Run through `node tools/dev/gpu_slot.mjs` (tools/deploy/measure.mjs --visits cold,warm --talk).
Readiness means `__parsa.ready`: the world is built, the title is shown, and the player can walk.

## Latest run (commit ee9e76ad): downloads in the order the build uses them, the language model before the voices
Cold visit: **walkable at 148 s**, **227 MB in the first 60 s**, 341 MB before walkable, page memory 7.8 GB, **no console
errors**. The arch build started at 34 s (47 s before this change). The town's, plain's and hills' set (life, monuments,
trees, land kits: started once the Terrace's set was in) arrived at 68-70 s, and the settlement waited 15 s for it. The
animals arrived at 102 s, while the build ran. The talk model started loading 0.3 s after the world was built and was
**ready 50 s later** (77 s before, when it shared the line with Kokoro). Its 3 turns all answered, the first two in the
formant voice while Kokoro was still downloading and the last in Kokoro.

## Which talk model to ship (the converse lab, tools/dev/converse_drive.mjs, the 12 test-set prompts of benchLLM, T4)
| model | download | first token (median) | whole answer (median / p90) | fence refusals | answers |
|---|---|---|---|---|---|
| Qwen2.5-0.5B (the current default) | 276 MB | 79 ms | 0.6 / 0.9 s | 2 of 12 | mostly broken: ",.", "I am years old", wrong names, stage directions |
| Qwen2.5-1.5B | 951 MB | 179 ms | 1.0 / 1.7 s | 0 of 12 | grounded and plain: "I carry grain and loads up the stair", "It is the year 19 of King Xerxes" |
| Llama-3.2-1B | ~700 MB | not measured | | | the local copy is incomplete (438 MB): WebLLM aborted |
**Ship Qwen2.5-1.5B.** The 0.5B's answers break the illusion more often than they hold it, and its fence refusals (the
person shrugs) are the model's fault, not the fence's: "ancient times" is a real anachronism for a speaker in 467. The cost is
download time: at 100 Mbit/s the 1.5B takes ~80 s against ~23 s for the 0.5B, so talk is ready ~1.5-2 min after walkable. Until
then the person's own lines answer. Load times on this box (248 s / 319 s) are dominated by its CPU and disk, not by the
models. TALK_MODEL is the cloud's (models.ts, D-376): a one-line change.

## The run before it (commit 1db7a51a + build stamp)
| visit | ready (walkable) | downloaded before ready | first 60 s | page memory |
|---|---|---|---|---|
| cold (empty profile) | **155 s** | 334 MB | **235 MB** | 7.4 GB |
| warm (second visit, service worker) | **179 s** | 3.1 MB | 3.1 MB | 6.1 GB |

Cold boot by phase. Times are seconds from navigation. "busy" is the main thread's long-task time.
- 0-17 s: terrain and scans fetched and decoded (busy 9 s). 19 s: physics.
- 19-47 s: models downloaded and sculpt loaded (wait ~28 s; this was ~33 s before, when the carved pieces were fetched one by one).
- 47-144 s: **world build on the main thread, ~85 s of CPU**: arch 14, settlement 14, plain 15, fire 4, nav 5, crowd 7-9,
  **view 25** (PopGeo/PopView), fauna 7, crowd.imp 2.
- 144-155 s: the first frames (world.update in frame 0 takes 6.6 s).
- The warm visit fetches nothing. It is still 179 s because the build's CPU is the same (and noisier on this box). The cache
  saves only the network.

Talking (the same run), each person speaking to someone near them:
- Before the model is ready: an answer in the person's own line within 1 s, every time.
- The model: Qwen2.5-0.5B (285 MB) and Kokoro (163 MB + voices) from us.aws.cdn.hf.co, about 448 MB. Ready 77 s after walkable
  on the cold visit and 59 s after on the warm one. The weights come from IndexedDB on the warm visit; the network was still
  touched for Kokoro, because transformers.js's cache put fails on this box.
- The 6 model turns: 4 answered in the person's own voice (Kokoro) and 2 were refused by the fence (the person shrugs): one
  "ancient times" (a modern term), one with no hit listed. First-token time after priming was 0.2-0.9 s, and a whole turn took
  4-7 s. The 0.5B's answers are weak: "I am the king's seat", "I served as king for forty-five years". This is the cloud's
  talk quality, not a loading fault.

## Earlier runs (the same setup) and what each change did
| run | change | cold ready | before ready | first 60 s |
|---|---|---|---|---|
| 1 | s14-int at start (talk did not load) | 147.8 s | 333 MB | 273 MB |
| 2 | asset loaders begun before the scans | 192.8 s | 348 MB | 257 MB | (decoding them alongside the scans starved the 4 threads: reverted to bytes-only warming)
| 3 | bytes warming (295 MB), sculpt fetched in parallel | 176.5 s | 403 MB | 316 MB | (big files were fetched twice: see the put failure below)
| 4 | animals streamed late, warming only under the service worker | 189.3 s | 443 MB | 291 MB | (warming slowed the scans 17 s -> 37 s on this box)
| 5 | warming off by default (?warm), the service worker stores from bytes | 155.4 s | 334 MB | 235 MB |
Runs differ by up to about +/-20 s on this box from CPU noise alone (Defender, other agents). Compare phases, not totals.

## Found and fixed
- **The live URL served the raw source tree** (index.html loading /src/main.ts). Pages source is still "deploy from a
  branch": GitHub's own Jekyll run deployed s14-int's root about 8 s after the Actions deploy and won the race. The workflow
  now waits for that run and deploys last. **The user should still set Settings > Pages > Source = GitHub Actions.**
- **The talk model never loaded on a public origin.** Chrome's Cache Storage refuses Hugging Face Xet CDN responses
  (`Cache.add/put: network error`), while a plain fetch works. WebLLM now uses `cacheBackend: 'indexeddb'` off localhost.
- **Cache.put of any network-backed response over ~10 MB fails here** (our own 14-44 MB files too), so every visit fetched
  them again. The service worker now stores a Response built from the bytes, and the warm visit fetches 3 MB instead of 200 MB.
- The carved pieces were fetched one after another (~29 s of round trips). They are now fetched at once.
- A 404 for aerial_ground_rock/disp.jpg (the file does not exist) is no longer requested.
- `isLocal` (the /models/ store on localhost) now applies only on the dev server. A built site on localhost takes the
  public paths.

## Not met, and why
- **Walkable <= 60 s: not met (155 s).** About 85 s is synchronous main-thread world build and 7 s is frame 0. Neither
  downloads nor ordering can hide that: the units are monolithic synchronous builds. Running view or fauna after the title
  would freeze the game for 25 s while it looks playable. What it needs is the bake (s14-load): view/PopGeo 25 s, plain 15,
  settlement 14, arch 14, fauna 7, nav 5 as baked data. On a fast 8-core desktop the same CPU is maybe half: an estimate,
  not measured.
- **First-minute download <= 150 MB: not met (227 MB cold).** At 100 Mbit/s the download is not what limits the boot:
  the network sits idle through the ~85 s CPU build. Shifting fetches later only to fit the number would cost walk time. The build needs about 290 MB before it can run. Moving more
  off the critical path needs per-class late swaps: monuments (23 MB), relief atlas nao (26.5 MB), KTX2 low mips (115 MB of
  KTX2). The KTX2 swaps change texture dimensions and cannot be verified without rendering, which this box does not allow.
- The warm visit target (<= 20 s) is CPU-bound in the same way.
