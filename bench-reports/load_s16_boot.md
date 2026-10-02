# s16 boot: the built site's "hang" (D-463)

## Broken or unmeasured first
- **The hang was the harness, not the site.** s16-candidate's built site reaches ready on every load measured here. What
  hung on Vagon was `tools/deploy/measure.mjs` blocking its own node process (a synchronous PowerShell memory probe every
  5 s), which starves Playwright and leaves Chrome waiting. Fixed in measure.mjs; **not yet re-run on the Vagon box itself**
  (Windows, installed Chrome, T4): do one `measure.mjs dist --visits cold,warm --params norender` there before trusting the
  Windows numbers.
- Ready is still over the 60 s target (UD-31): 100 s cold on this 4-core container at 100 Mbit.
- Page memory 5.59 GB cold (target 5).
- The site ships the jpg scans: `textures/ktx.json` and `textures/ground/ground.json` (the KTX2 scan and ground bakes,
  tools/bake_world/ktx_scans.ts, ktx_ground.ts, D-354) are never produced by the site build, so the page falls back to the
  jpgs. That is 2 x 404, handled, and a quarter of the memory those scans would cost as BC7 left on the table.
- The other 4 of the 6 x 404 seen on Vagon were not seen here. tools/deploy/boot_probe.mjs prints each failing URL; run it
  there to name them.

## Cause (reproduced)
measure.mjs polled memory with `execFileSync('powershell', Get-CimInstance Win32_Process …)` on a 5 s interval. On a busy
4-core Windows box one call takes about as long as the interval, so node's event loop is blocked almost all the time.
Playwright must attach to every new worker before it runs (the page spawns dozens: KTX2 and Draco pools per module, the
bake and impostor workers), and it must read Chrome's CDP stream. Blocked, it does neither, and the page waits with
the CPU idle. That matches Vagon's symptom, with and without the shared decoder.

Reproduction (Linux, headless Chromium 141, same dist, the probe replaced by a 6 s blocking call):
| | probe blocking 6 s / 5 s | no blocking |
|---|---|---|
| scans decoded (page clock) | 41.5 s | 15-23 s |
| world: assets awaited | 528 s | 7.9-16 s |
| at 10.6 min | world:arch, renderer ~0 CPU | ready at 94-125 s |

"process not found" was Get-Process on a chrome.exe that exited between the CIM query and the lookup (now SilentlyContinue).
The bake agent's 84.6 s run used tools/bake_world/site_probe.mjs, which has no memory probe.

Fix: the memory probe runs asynchronously (`execFile`), never overlaps itself, and works off Windows (`ps` over the
processes whose command line names the profile), so memory is measured here too.

## Measured (s16-candidate 76369f8 + fix; BAKE_SEEDS=1; 4-core cloud container; headless Chromium 141; built site via
tools/deploy/serve.mjs, 100 Mbit/s cap; empty profile)
| run | seed | backend | ready | world built | before ready | memory |
|---|---|---|---|---|---|---|
| measure.mjs (fixed), cold | 5150 (pool draw, unbaked) | WebGL2 | **100.1 s** | 92.1 s | 323 MB, 758 requests | 5.59 GB |
| measure.mjs (fixed), warm | 5150 | WebGL2 | **70.3 s** | 61.8 s | 1 MB, 8 requests (service worker) | 5.47 GB |
| measure.mjs (old probe, no PowerShell here), cold | 1 (baked) | WebGL2 | 124.9 s | 117.7 s | 321 MB | n/a |
| boot_probe.mjs, cold | 467 (unbaked) | WebGL2 | 121.9 s | 116.0 s | | |
| boot_probe.mjs, cold, `--swiftshader-webgpu` | 2203 (pool draw, unbaked) | WebGPU | 94.5 s | 89.1 s | | |

The spread between runs (94-125 s) is the shared 4-core container. It is not the seed: unbaked seeds 5150, 467 and 2203
were not slower than baked seed 1.

## The 404s
Here 2 per visit, both optional and handled:
- `textures/ktx.json` (src/render/scans.ts: no KTX2 scans, the jpgs load)
- `textures/ground/ground.json` (scans.ts: no baked ground set)

An unbaked pool seed causes no 404. Its seeded units (zones, grime, vsites, fill) are manifest misses: built live, then
kept in Cache Storage (`parsa-world-cache-v1`, 5 entries after the cold visit).
