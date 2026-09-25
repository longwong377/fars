import { test } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { lumStats } from './lib/lum';
// Camera-rig prototypes for §1.1 moments (fixed views; world state frozen via ?test&day&hour&weather).
// fov: vertical field of view of the capture (degrees; session 4). Photographs of the site are taken at 24–35 mm: 46° (24 mm
// at 16:9) indoors and in courts, 40° (≈ 28 mm) for the wider outdoor views. FOV=game renders at the player's setting (70°,
// a 14 mm lens: for judging first-person presence).
const IN = 46, OUT = 40;
// carry: [view, s] = the eye carried over from an earlier view of the same world state, adapted for s seconds since (the
// frozen test world otherwise adapts every frame fully; __parsa.carryEye, D-187): the entry sequence steps from the sun
// into the dark with the eye it had outside
// ab: object names hidden for a second capture of the same view (…-no<tag>), rendered after the moment itself, so the
// difference between the two measures what those objects add (the second capture's TRAA history still holds some of the
// first: the difference is a lower bound)
const SHOTS: { n: string; day: number; hour: number; w: string; v: [number, number, number, number, number]; fov?: number; frames?: number; court?: boolean; carry?: [string, number]; now?: boolean; ab?: { tag: string; hide: string[] } }[] = [
  // dawn before sunrise (D-118): day 0 (17 Apr 467 BCE) 05:24, the sun 2.9° below the horizon (sunrise ~05:35): the
  // Earth's shadow and the antitwilight arch over the W plain, no sun shadows; the old slot (05:51, sun +2.5°) and a view
  // E into the glow over Kuh-e Rahmat are kept for comparison
  // re-posed (D-187, rubric fix 5): the W views from the landing's edge held only the plain (the landing's W edge has no
  // parapet, and the lower flights' parapets lie 10 m below it, hidden by the edge at any pitch that keeps the horizon);
  // now from the N end of the top landing (grid (−36.4, 135.5)) looking WNW (grid 300°): the N upper flight's W parapet
  // and merlons across the lower part of the frame, the landing's floor at the bottom left, the plain and the
  // Earth's shadow (anti-sun, grid ≈ 272°) beyond. (A first try, from 4.5 m down the N flight looking SSW, looked back UP
  // the flight at the landing's edge: no plain; quality-test render, D-187.) Rendered at high at −8° pitch the parapet
  // wall filled the lower half (its top at y ≈ 280 of 540, the horizon at y 165); −5° moves the frame 39 px: the wall's
  // top to y ≈ 320 (the lower 40 %), its merlons rising past the horizon at y ≈ 204 (computed: not rendered at −5°).
  // Old poses: (−39.6, 122.45, 1.6, 251, −4) and (−40.2, 122.45, 1.6, 251, −12)
  { n: 'dawn-stair-top', day: 0, hour: 5.40, w: 'clear', v: [-36.4, 135.5, 1.6, 281, -5], ab: { tag: 'smoke', hide: ['landsmoke', 'settlement:haze', 'fire:smoke', 'dust'] } }, // D-220: the villages' dawn smoke measured
  { n: 'dawn-sunrise', day: 0, hour: 5.85, w: 'clear', v: [-36.4, 135.5, 1.6, 281, -5] },
  { n: 'dawn-sunrise-nw', day: 0, hour: 5.85, w: 'clear', v: [-36.4, 134.8, 1.6, 311, -8] }, // from the N end of the top landing: the N upper flight descending on the right, the plain to the NW
  { n: 'dawn-stair-top-nw', day: 0, hour: 5.40, w: 'clear', v: [-36.4, 134.8, 1.6, 311, -8] }, // the pre-sunrise moment from the head of the N upper flight: the stair descending, the plain to the NW (session 4)
  { n: 'dawn-glow-e', day: 0, hour: 5.40, w: 'clear', v: [-36.4, 122.45, 1.6, 79, 6] },
  // §1.1 "how small a person is at the foot of a gate", as the fires are lit (session 7 reframe: the old view, (0.1, 118)
  // looking N, stood inside the Gate hall facing a blank wall between two columns): from the Grand Stair's top landing 24 m
  // W of the Gate's W façade (x −16.4), looking E along the doorway's axis (y 124.6): the 18.5 m wall and the 10 m doorway
  // with its colossi, the guards at their feet and the braziers (pitch 15° at the photographic 40°: the wall top at +35°)
  { n: 'gate-dusk', day: 0, hour: 19.25, w: 'clear', v: [-40, 124.6, 1.6, 90, 15] },
  // §1.1 "smoke rising from the town at dusk as lamps are lit" (D-220; rubric s7 pass 2 fix 5: no render existed). Day 14
  // (1 May 467 BCE), one of the stillest dry evenings of the spring (wind 0.8 m/s at 18:48; weather seed 1), 13 min after
  // sunset (18:35, sun −4.6°): the households' evening fires were lit before the meal (the people sim: the meal ~0.7 h before
  // sunset, the fire lit 0.35 h before it) and their smoke lies over the quarters under the evening inversion. From the
  // Terrace 2.3 m inside its W edge, looking SSW over the lower town (quarters q_s1-q_s4 at 0.9-1.6 km, bearings 185-217°
  // true, 20 m below) with a 55 mm lens (24°); and from Kuh-e Rahmat E of the Terrace (+65 m) over the Terrace to the S and
  // W quarters (bearings 205-249°). Each is captured again with the smoke and dust hidden (ab), so their contrast is measured
  { n: 'town-smoke-dusk', day: 14, hour: 18.8, w: 'clear', v: [-50.5, -120, 1.6, 205, -1.5], fov: 24, ab: { tag: 'smoke', hide: ['landsmoke', 'settlement:haze', 'fire:smoke', 'dust'] } },
  { n: 'town-smoke-dusk-rahmat', day: 14, hour: 18.8, w: 'clear', v: [380, -60, 1.6, 228, -4], ab: { tag: 'smoke', hide: ['landsmoke', 'settlement:haze', 'fire:smoke', 'dust'] } },
  // the Now view (D-201, stretch, out of world): the same spots as the ruin stands today (C, recollection)
  { n: 'now-stair-top', day: 25, hour: 10, w: 'clear', v: [-36.4, 122.45, 1.6, 79, 6], now: true },
  { n: 'now-apadana', day: 25, hour: 10, w: 'clear', v: [1.9, 75, 1.6, 161, 8], now: true },
  { n: 'night-terrace', day: 5, hour: 22.5, w: 'clear', v: [0, 92, 1.6, 161, 6] },
  // moonless pre-dawn (day 1 = 18 Apr 467 BCE, the moon a thin crescent set in the evening): the Milky Way from Cygnus to
  // Sagittarius over the SE, seen from the Grand Stair top (D-047)
  // session 7 reframe: at 03:30 the band runs from Deneb (grid 83°, alt 58°) through l = 60° near the zenith (grid 136°, alt
  // 72°) to l = 30° (grid 204°, alt 59°) and the centre (grid 225°, alt 32°) (astronomy-engine, precessed; grid north 341°
  // true). The old view (grid 125°, pitch 28°) held only the band's lower edge and the fire-lit Gate wall set the exposure;
  // now toward the centre over the dark plain, the band rising out of the frame's top left
  { n: 'night-milkyway', day: 1, hour: 3.5, w: 'clear', v: [-36, 125, 1.6, 215, 38], fov: 60 },
  // §1.1 "night with fire, moon and stars" in ONE frame (rubric s7 pass 2 fix 14: no render held the moon; session 8): day 11
  // (28 Apr 467 BCE) at 02:45 the moon, 95 % lit, stands 14.1° up at true azimuth 253.5° over the plain, the sun 31° down
  // (astronomy-engine; tools/dev/moon_find.ts). The view's azimuth is TRUE (main.ts: yaw = −(az − 341°)): 253.5° true is
  // grid 272.5°, due W along the landing. From 10 m E of the S stair-head brazier (x −33.4, y 121; lit until after sunrise),
  // 1.5 m N of its line: the flame low left of centre, the parapet, the moonlit plain, the moon above. (First render, from 4 m
  // at az 272.5 read as grid: the moon 19° off-axis and the eye adapted to the near fire, exposure 1.09: the plain black.)
  { n: 'night-moon-fire', day: 11, hour: 2.75, w: 'clear', v: [-23.4, 122.5, 1.6, 253.5, 6] },
  { n: 'brazier-close', day: 0, hour: 21.5, w: 'clear', v: [-36.4, 132, 1.6, 161, -8], fov: IN },
  { n: 'apadana-hall-torch', day: 0, hour: 21, w: 'clear', v: [-8, 0, 4.6, 161, 6], fov: IN },
  { n: 'rain-columns', day: 2, hour: 14, w: 'rain', v: [-20, 70, 1.6, 161, 4] },
  // §1.1 "rain moving across the plain toward the columns": day 12's rain episode reaches the Terrace at 06:01 from the
  // WSW (245°); at 05:40 its cell is ~6 km out over the plain (WeatherSystem.rainCell); seen from the Apadana W portico
  // session 7 re-time (11.1 → 11.45): at 11:06 the cell stood 14.9 km out (near edge 9 km); with the day's haze (V ≈ 30 km) the
  // air passes ~10 % of the curtain's contrast there, and a ?shaftdbg=1 render showed the solid-red shafts as a faint pink:
  // placed right, washed out by the air as the physics says. At 11:27 the cell is ~8.5 km out (near edge ~2.5 km, T ≈ 0.7)
  // session 8 (D-219): from inside the Apadana W portico (sky visibility 0.05) the eye law set exposure 36 and the sky sat on
  // AgX's shoulder at 5-7× display white: even a solid-red shaft rendered pale pink and the real curtain (22 % darker in
  // linear light) moved the PNG 4 %. The moment moves into the open: the Grand Stair's top landing, looking the same way over
  // the plain toward the cell (old view: [-38, -5, 1.6, 232, 3])
  { n: 'rain-approach', day: 299, hour: 11.45, w: 'auto', v: [-38, 124, 1.6, 232, 3] }, // a heavy cell (14 mm) SW over the plain, 50 min before it arrives (D-060, D-064, D-219)
  // from the sunlit N court, 10 m out from the N portico's outer row (y 48), between its two axial columns (x −2.4, 6.2):
  // sunlit pavement, the portico's shade and the black doorway 27 m off (session 4 reframe; the old view stood in the
  // portico facing two blank walls)
  // §1.1 "entering the Apadana from bright sun" as a sequence (D-187, rubric fix 5): the N stair's top landing and the
  // whole portico lie in the building's shade at 11:00 (the sun at 72° from the SSE; tests/e2e ray check), so the sunlit
  // court is 3 m beyond the stair's foot. 1 court: in the sun 16 m out from the stair's façade, the sunlit pavement in the
  // lower third, the stair, the portico's shade and the top of the doorway above it (adapted to the sun; from 7 m out the
  // façade filled the frame, quality-test render); 2 apadana-enter: the old view, on the landing; 3 portico: adapted to the portico;
  // 4 door: on the threshold (the wall's outer face is y 30.67) with the eye the portico gave it: the hall a dark void;
  // 5 hall: 8 m on (≈6 s at walking pace), the eye still opening (dark adaptation τ 3 s, exposure.ts); 6 apadana-hall-axis
  // (below), adapted. And the look back out: from inside toward the sunlit court (hall-out)
  { n: 'apadana-enter-court', day: 25, hour: 11, w: 'clear', v: [1.9, 75, 1.6, 161, 2], fov: IN },
  { n: 'apadana-enter', day: 25, hour: 11, w: 'clear', v: [1.9, 58, 1.6, 161, 4], fov: IN },
  { n: 'apadana-enter-portico', day: 25, hour: 11, w: 'clear', v: [1.9, 36, 1.6, 161, 2], fov: IN }, // the old view, in the portico
  { n: 'apadana-enter-door', day: 25, hour: 11, w: 'clear', v: [1.9, 31.0, 1.6, 161, 2], fov: IN, carry: ['apadana-enter-portico', 0] },
  { n: 'apadana-enter-hall', day: 25, hour: 11, w: 'clear', v: [1.9, 23.0, 1.6, 161, 4], fov: IN, carry: ['apadana-enter-door', 6] },
  { n: 'apadana-hall-out', day: 25, hour: 11, w: 'clear', v: [1.9, 18, 1.6, 341, 3], fov: IN }, // 7 m inside, looking N out through the doorway to the portico and the sunlit court, adapted to the hall
  // inside the hall, one bay E of the axis (between column lines x 6.2 and 14.9), looking SSW and up: the capitals and
  // beams close overhead, the far doorway the one bright thing low in the frame (session 4 reframe)
  { n: 'apadana-hall-in', day: 25, hour: 11, w: 'clear', v: [10.55, 12.4, 1.6, 170, 20], fov: 50 },
  { n: 'apadana-hall-axis', day: 25, hour: 11, w: 'clear', v: [1.9, 12, 1.6, 161, 6], fov: IN }, // the old view: 18 m inside the N doorway, along the axis
  // the Apadana N stair façade (y 59.05) in raking light. Re-timed and re-posed (D-187): on day 60 at 18:18 the sun met
  // the façade at 41° (not raking); on day 25 at 16:00 (az 271°, alt 32°) at 17° (asin(cos alt · cos(az − 341°)),
  // src/sky/ephemeris.ts), the whole façade in sun (ray check); shares its state with stair-climb-pm. The old camera looked
  // E along the façade with that sun behind it (flat light, quality-test render); now from the N court 8 m out, looking
  // WSW along the façade toward the light (the sun 57° right of the view, out of frame), the carving's shadows falling
  // toward the camera. Old: day 60, 18.3, (−30, 63.5, 1.6, 83, −3)
  { n: 'reliefs-raking', day: 25, hour: 16, w: 'clear', v: [8, 67, 1.6, 216, -3] },
  // the E-facing Apadana stair façade (x 72.19) at 10:00: the sun (az 111°, alt 61°) meets it at 22° from the SSE, high:
  // the carving's shadows fall north and down; from the E court 8 m out, looking NW along the façade's middle (D-187)
  { n: 'apadana-e-stair-raking', day: 25, hour: 10, w: 'clear', v: [80, -14, 1.6, 300, 0] },
  // inside the scribes' room (D-067): from just W of the S doorway (x 184.0–185.1), looking ENE at the scribe by the desk
  // (186.8, −83.2), so the door's light falls across him as a side key (session 4 reframe; the old view from the NE corner
  // saw him as a silhouette against the door)
  // re-posed (D-187, rubric fix 5): half the old frame was empty floor. Now at seated eye height (1.0 m: a second scribe on
  // the floor across the desk), 2.6 m from the desk at his front right (the desk faces grid E), looking W at the scribe,
  // the unfinished tablet and the drying board, the S doorway's light on him from the left (a first try 1.4 m away had
  // him fill the frame, quality-test render). Old: (183.2, −83.9, 1.6, 60, −20)
  { n: 'scribe-at-work', day: 25, hour: 10, w: 'clear', v: [189.4, -84.2, 1.0, 269, -12], fov: 50 },
  { n: 'scribe-room-ne', day: 25, hour: 10, w: 'clear', v: [190.9, -82.0, 1.7, 235, -15], fov: 50 }, // the old view from the NE corner
  { n: 'stair-climb', day: 25, hour: 8.5, w: 'clear', v: [-43.9, 128, 1.6, 341, 12] },
  { n: 'stair-climb-pm', day: 25, hour: 16, w: 'clear', v: [-43.9, 128, 1.6, 341, 12] }, // the W-facing stair in the afternoon sun (the morning view is in the Terrace's shadow); shares its state with tripylon-n-stair
  { n: 'snow-terrace', day: 280, hour: 10, w: 'snow', v: [-20, 70, 1.6, 161, 4] },
  // Phase 4: the rest of the Terrace
  // re-timed (D-187): at 15:30 the S façade was in shade (the sun behind it); at 09:30 (az 104°, alt 55°) the sun meets it
  // at 19° from the E, the whole central façade in sun (ray check); shares its state with hall100-site. Old: 15.5
  { n: 'tachara-s-stair', day: 25, hour: 9.5, w: 'clear', v: [-21, -112, 1.6, 341, 6] },
  // the lance-bearers of the W2 doorway (x −31.08…−29.42, y −83.45…−82.15; D-132): each reveal carries one, 1.8 m tall, at
  // the hall end of the passage (x −30.08…−29.54). Re-posed (D-187): the old wide view stood 0.93 m from the axis of the
  // hall column at (−26.4, −80.75) and looked straight at its shaft; the old close view looked at the S reveal, which faces
  // N, away from the hall's light (the S door and windows): the probe field gives it zero skylight (the hall probes' L1 is
  // negative facing away from the openings) and it rendered black. Both now look at the N reveal (facing S, into the
  // hall's light), from the S aisle, clear of the columns; 16:00 shares a state with stair-climb-pm. Old: 15.5 and
  // (−25.5, −80.5, 1.6, 225, 5), (−28.8, −82.0, 1.6, 206, −10)
  { n: 'tachara-lance-bearers', day: 25, hour: 16, w: 'clear', v: [-26.9, -86.0, 1.6, 304, -4], fov: IN }, // 4.8 m from the figure, 37° off its face: the doorway, its frame and folded leaves, the W wall
  { n: 'tachara-lance-bearer-close', day: 25, hour: 16, w: 'clear', v: [-28.4, -84.6, 1.6, 311, -10], fov: IN }, // 2.8 m from the figure, 30° off its face
  { n: 'hadish-hall', day: 25, hour: 11, w: 'clear', v: [22, -150, 1.6, 161, 2], fov: IN },
  { n: 'hall100-site', day: 25, hour: 9.5, w: 'clear', v: [146, 45, 1.6, 161, 4], ab: { tag: 'dust', hide: ['dust'] } }, // D-220: the masons' and haulers' dust measured
  { n: 'tripylon-n-stair', day: 25, hour: 16, w: 'clear', v: [82, -38, 1.6, 161, 6] },
  { n: 'harem-portico', day: 25, hour: 10, w: 'clear', v: [114, -114, 1.6, 161, 4], fov: IN },
  // §1.1 "the court in full assembly on the Terrace" (D-182): ONLY with the court setting (?court=seasonal, C; the default
  // is the court absent, B9). Day 30 (17 May 467 BCE), 10:00, a day well inside the resident season: from the W end of the
  // forecourt looking E across the files of the king's spearmen lining the way from the Gate to the Apadana, petitioners
  // and delegations waiting, nobles by the Apadana; the view the node scan found with the most people visible on the
  // Terrace (tools/dev/court_scan.ts). The king is not shown (B9); delegation dress is a placeholder (D-182)
  { n: 'court-assembly', day: 30, hour: 10, w: 'clear', v: [-35, 85, 1.6, 71, -2], fov: IN, court: true },
];
test('moments', async ({ page }, info) => {
  // under the 25-min watchdog (LIMIT 1500 s); views sharing a world state share a page load (≤ 3 loads per run). TIMEOUT (s) and FRAMES
  // override it and the per-view frame count (session 5: WebGL2 at high under SwiftShader did not finish 8 frames of one view in 23 min)
  test.setTimeout(+(process.env.TIMEOUT ?? 1380) * 1000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') { if (m.text().startsWith('shaftdbg')) console.log(m.text().slice(0, 3000)); else errs.push(m.text().slice(0, 200)); } });
  const only = process.env.ONLY?.split(',');
  // WEBGL=1 forces the WebGL2 backend inside the webgpu project (the render queue runs one project): shots are suffixed
  // -webgl2-forced and __parsa.backend is logged
  const WEBGL = !!process.env.WEBGL, proj = WEBGL ? 'webgl2-forced' : info.project.name;
  // one page load per world state: views that share day, hour and weather reuse the loaded world (a page load is
  // ~3–5 min at high under SwiftShader; the state is frozen, so only the camera moves between them)
  let loaded = '';
  const stateOf = (s: typeof SHOTS[number]) => `${s.day}|${s.hour}|${s.w}|${s.court ? 'court' : ''}`;
  // views grouped by world state (a stable sort: within a state the list's order, which the carried eyes rely on), so each
  // state costs one page load however the list is ordered (D-187)
  const firstAt = new Map<string, number>(); SHOTS.forEach((s, i) => { if (!firstAt.has(stateOf(s))) firstAt.set(stateOf(s), i); });
  const ordered = SHOTS.map((s, i) => ({ s, i })).sort((a, b) => firstAt.get(stateOf(a.s))! - firstAt.get(stateOf(b.s))! || a.i - b.i).map(q => q.s);
  const eyeAt = new Map<string, number>(); // exposure of each view rendered on the current page load (carried eyes)
  for (const s of ordered) {
    if (only && !only.includes(s.n)) continue;
    const state = stateOf(s);
    if (state !== loaded) { eyeAt.clear();
      await page.goto(`/?test&quality=${process.env.Q ?? 'test'}&day=${s.day}&hour=${s.hour}&weather=${s.w}${s.court ? '&court=seasonal' : ''}${WEBGL ? '&webgl=1' : ''}${process.env.URLX ?? ''}`); // URLX: extra query for debug runs (e.g. &shaftdbg=1)
      await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 600_000 });
      // the world is frozen in test mode: stop the animation loop, so the screenshot does not wait behind its frames under
      // SwiftShader (minutes each; the Phase 4 render helper found this, tests/e2e/lib/p4views.ts)
      await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
      loaded = state;
    }
    const fov = process.env.FOV === 'game' ? undefined : s.fov ?? OUT;
    if (s.carry) { // the eye of an earlier view of this state; rendered here (2 frames, no capture) if it was not
      const [fromN, secs] = s.carry, from = SHOTS.find(q => q.n === fromN)!;
      if (stateOf(from) !== state) throw new Error(`${s.n} carries the eye of ${fromN}, another world state`);
      if (!eyeAt.has(fromN)) { await page.evaluate(([v, f]) => { const p = (window as any).__parsa; p.carryEye(null); p.view(...v, f); }, [from.v, process.env.FOV === 'game' ? undefined : from.fov ?? OUT] as const);
        for (let i = 0; i < 2; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
        eyeAt.set(fromN, await page.evaluate(() => (window as any).__parsa.exposureInfo().exposure)); }
      await page.evaluate(([x, t]) => (window as any).__parsa.carryEye(x, t), [eyeAt.get(fromN)!, secs] as const);
    } else await page.evaluate(() => (window as any).__parsa.carryEye?.(null));
    await page.evaluate((on) => (window as any).__parsa.nowView?.(on), !!s.now); // the Now view (D-201): the ruin today
    await page.evaluate(([v, f]) => (window as any).__parsa.view(...v, f), [s.v, fov] as const);
    for (let i = 0; i < (process.env.FRAMES ? +process.env.FRAMES : s.frames ?? 8); i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    const png = await page.screenshot({ path: `shots/moment-${s.n}${process.env.TAG ? '-' + process.env.TAG : ''}-${proj}.png` }); // TAG: debug runs keep the moment's own image
    // §8.3 luminance (display-referred sRGB luma): whole frame; appended to shots/moments-lum.json
    const lum = await lumStats(page, png); const exp = await page.evaluate(() => (window as any).__parsa.exposureInfo()); eyeAt.set(s.n, exp.exposure);
    mkdirSync('shots', { recursive: true }); const f = 'shots/moments-lum.json'; const all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
    all[`${s.n}${process.env.TAG ? '-' + process.env.TAG : ''}|${process.env.Q ?? 'test'}|${proj}`] = { lum, exposure: +exp.exposure.toFixed(3), meterEV: +(exp.meterEV ?? 0).toFixed(2), sunAlt: +exp.sunAlt.toFixed(1), fov: fov ?? 'game', ...(s.carry ? { carry: s.carry } : {}) }; writeFileSync(f, JSON.stringify(all, null, 1));
    console.log(s.n, JSON.stringify(lum), 'backend', await page.evaluate(() => (window as any).__parsa.backend));
    if (s.ab) { // the same view with the named objects hidden (D-220: the smoke's own contrast); their state and the draw calls logged
      const nFr = process.env.FRAMES ? +process.env.FRAMES : s.frames ?? 8;
      const st = await page.evaluate((names) => { const P = (window as any).__parsa, W = P.world, r = W.root, S = W.smoke;
        const vis = Object.fromEntries(names.map((n: string) => { const o = r.getObjectByName(n); return [n, o ? o.visible : null]; }));
        return { vis, draws: P.stats().drawCalls, tris: P.stats().triangles, cells: S?.land.count, inside: S?.land.inside, fire: W.fire?.stats(), dust: S?.dust.stats, link: S?.model.linkStats().linked,
          sample: S?.model.cells.slice(0, 3).map((c: any) => ({ id: c.id, sigma: +c.sigma.toExponential(2), E: Math.round(c.E), H1: Math.round(c.H1), tail: Math.round(c.tail) })) }; }, s.ab.hide);
      console.log(s.n, 'smoke state', JSON.stringify(st));
      await page.evaluate((names) => { const r = (window as any).__parsa.world.root; for (const n of names) { const o = r.getObjectByName(n); if (o) o.userData.__hideAB = true; } }, s.ab.hide);
      // hidden every frame (the world's update sets their visibility each frame): patched onBeforeRender is not enough, so
      // the spec wraps the world's update
      await page.evaluate(() => { const W = (window as any).__parsa.world; if (W.__abWrapped) return; const up = W.update.bind(W); W.update = (dt: number, ctx: any) => { up(dt, ctx); W.root.traverse((o: any) => { if (o.userData?.__hideAB) o.visible = false; }); }; W.__abWrapped = true; });
      for (let i = 0; i < nFr; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
      const drawsB = await page.evaluate(() => (window as any).__parsa.stats().drawCalls);
      const pngB = await page.screenshot({ path: `shots/moment-${s.n}-no${s.ab.tag}-${proj}.png` });
      const lumB = await lumStats(page, pngB); console.log(s.n, `no${s.ab.tag}`, JSON.stringify(lumB), 'draws with', st.draws, 'without', drawsB);
      await page.evaluate(() => { const r = (window as any).__parsa.world.root; r.traverse((o: any) => { if (o.userData?.__hideAB) { delete o.userData.__hideAB; o.visible = true; } }); });
    }
  }
  console.log(errs.slice(0, 5).join('\n'));
});
