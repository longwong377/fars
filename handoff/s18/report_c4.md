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
- The night clouds' "hard round edges": not judged (Q=low frames are grainy). The clouds at Q=low in SwiftShader with 2 frames are grainy (no TRAA convergence): their edge softness cannot be judged in
  the cloud. The T4's final cov-000 (01:55) also shows white dots over the ground and sky at night (particles?), unidentified.

## The black screen (the lead's urgent ask, mid-session)
- Fixed on the cloud's live path (da893241): progressive compile deferred the full-screen quads drawn last in a frame (the
  post pipeline's at high, the renderer's own output quad at low) every frame while the world streamed in: black canvas,
  unwritten meter. Also 824e2238: tone mapping restored around the post pass however it ends; meter readback timeout and
  zero-readback rejection, falling back to the lux law. Frames: c4_frames/live_black_before.png, live_after_quadfix.png.
- e8e271e8: TRAA's depth-history copy threw every frame on WebGL (black at quality high, ?webgl=1): fixed; and a black-frame
  watchdog switches to the renderer's own output (window.__safeMode) if the post output stays black, times out or throws.
  Unseen on a real GPU; the cloud's SwiftShader gives out at ~500 s at quality high.
- NOT fixed by me: the T4's "[Buffer] used in submit while destroyed" in ShadowMaterial pipelines (C9's deferred-dispose
  work); the far cascade disposes nothing (?farcsm=0 rules it out on the T4).

## The night list (after the first DONE; leads 2-3)
- Pushed: stars by magnitude/colour through the twilight, extinction, twinkle; a luminous moonless dome (land dark against it);
  the Moon's maria; the night grade cooler and less saturated (high only); the night's fires (watch braziers, banquet
  braziers, door torches; occlusion re-baked); the town's dusk smoke (tau 0.34 over the gate 0.3); the nightingale, dawn
  chorus and noon hush; ledges dispose after swap. Frames: c4_frames/dusk-west-1900/1925, predawn-rahmat-stars,
  night-plain-after-dome, night-apadana-portico-Qlow.
- Broken/unseen: the fires' nights need world.ts to call fire.setDay (asked; until then the watch burns every night and the
  banquet never); fire light pools cannot be judged at Q=low in the cloud (few or no fire lights there); the night grade is
  post (high) only, unseen; town_glow keeps two red assertions about the sim's warm-evening hearths (C2's belt, routed);
  lint:lang is red on a texture not mine (public/textures/plaster001/arm.jpg unregistered).
- Since: the comet of 467 (comet.ts: 75 evenings from mid-July, east of the sun, tail away from it; C, Plutarch Lys. 12 / Pliny
  NH 2.149) and the season's clouds (cloudKind.ts: winter stratiform sheets, spring/summer cumulus, autumn cirrus veil).
- Not done: the spring flood and the dust-storm wall (weather/river owners' systems), heat shimmer by default (its composite
  graph unverified on a GPU: left opt-in); the snow cap exists through the shared snowline (January 725 m over the court:
  Rahmat's tops and the far Zagros) but is unseen.

## What a player meets now
- **Far views get sun shadows** (if the T4 confirms): past 600 m, where nothing had a sun shadow, a fifth map fitted to the
  Terrace and town box (east -1480..330, north -1580..840; 4096², texel <= 0.9 m at every sun) shades walls, porticoes and
  houses from 560-600 m out. Static: drawn at load and again only when the sun moves 0.4 deg (not while it is down). Read
  with textureLoad and a hand 2x2 comparison: **no sampler added** to any material (tests/far_cascade_d680.test.ts compares
  a lit surface's bindings with the cascade on and off). ?farcsm=0 or `__parsaFarCascade.value = 0` for the A/B.
- **Night:** the purple band and the many-ray fan were already gone on this tree (V1's light v2/v2b). One light streak still
  rose from a horizon point (cloud frames and the T4's final cov-000 alike). By elimination (Milky Way hidden: still there;
  clouds hidden: gone; world-fixed at another resolution and heading) and a CPU replica of the cloud march, it was a clear
  slit in the cloud deck: the noise volume tiles every 7 km, so a ray along a lattice axis samples one periodic column again
  and again, and an empty column draws a slit to the horizon; all slits converge on the axis's horizon point (the "fan").
  The base shapes are now warped by the weather field (clouds.ts, mirror cloudCover.ts; no extra fetch): near-horizon rays
  along the axes were clear 2.9x as often as rays off them, now 1.2x (tests/cloud_slits_d680.test.ts, which fails unwarped).
  Cover calibration unchanged (cloudcover tests pass). A Milky Way edit tried on the way was reverted (not the cause).

## Frames (crude, WebGL2 SwiftShader, Q=low unless said; not the T4's look)
before: night cov-000; Rahmat dawn 5.22 h and noon from -322,90 (the road streak); plain at dawn/noon/16 h 1.5 km N of the
Terrace; plain at dusk; the Apadana at 22:30. after: night cov-000 with the warped cloud field (night-cov000_after-warp.jpg). In handoff/s18/c4_frames/.
