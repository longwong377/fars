# C4 sky, night and far light (s18 cloud, D-680; branch cloud-s18-c4-sky)

## Broken, placeholder or unseen (first)
- **The far cascade is UNSEEN.** The cloud cannot draw Q=high: on WebGL2 every lit program fails validation and the device is
  lost (measured with the far cascade on AND with ?farcsm=0: same 24-30 errors, black frames, so not this change); on WebGPU
  SwiftShader caps a fragment stage at 16 sampled textures (18 needed) and the frame is black. The cascade is verified
  node-side only (shader build, sampler count, fit). **Needs one T4 frame**: the Terrace from the plain at 16 h, e.g.
  `view(-200, 1450, 1.7, 165, 1)` day 0 hour 16 clear, with `__parsaFarCascade.value = 0` then `1` in the same load.
- **Kuh-e Rahmat's bright streak is not fixed (not my files):** it is road_pasargadae's first segment (settlement.json
  [250,250] -> [2600,1900] -> [5200,2600]), a ruler-straight 7 m road climbing from 2 m to ~290 m straight up the mountain
  behind the Terrace and down again. In the dawn crude frame it draws as an orange-lit line, at noon as a pale scar. Asked of
  the lead: reroute vertices 0-2 round the north end (a 40 m least-cost course stays on the plain, 9.5 km, max 7 m).
- Seen in passing, not mine: from the plain 1.5 km N of the Terrace (16 h and noon) no town shows between the camera and the
  Terrace (q_n1 at -265,725 should be in frame): the town's far drawing (asks list item 1); the Terrace reads as a low box.
- The clouds at Q=low in SwiftShader with 2 frames are grainy (no TRAA convergence): their edge softness cannot be judged in
  the cloud. The T4's final cov-000 (01:55) also shows white dots over the ground and sky at night (particles?), unidentified.

## What a player meets now
- **Far views get sun shadows** (if the T4 confirms): past 600 m, where nothing had a sun shadow, a fifth map fitted to the
  Terrace and town box (east -1480..330, north -1580..840; 4096², texel <= 0.9 m at every sun) shades walls, porticoes and
  houses from 560-600 m out. Static: drawn at load and again only when the sun moves 0.4 deg (not while it is down). Read
  with textureLoad and a hand 2x2 comparison: **no sampler added** to any material (tests/far_cascade_d680.test.ts compares
  a lit surface's bindings with the cascade on and off). ?farcsm=0 or `__parsaFarCascade.value = 0` for the A/B.
- **Night:** the purple band and the horizon fan were already gone on this tree (V1's light v2/v2b); the crude cov-000 frame
  showed one remaining light streak rising from a horizon point in the SE: the Milky Way's cusp-shaped cross-section
  (exp(-|b|/w)) drew a thin bright ridge beside the Great Rift. Now a smooth Gaussian profile (skySystem.ts). Before/after:
  crude frames below.

## Frames (crude, WebGL2 SwiftShader, Q=low unless said; not the T4's look)
before: night cov-000; Rahmat dawn 5.22 h and noon from -322,90 (the road streak); plain at dawn/noon/16 h 1.5 km N of the
Terrace; plain at dusk; the Apadana at 22:30. after: night cov-000 with the smooth Milky Way. Attached to the lead's message.
