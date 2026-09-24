import { test } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { lumStats } from './lib/lum';
// Camera-rig prototypes for §1.1 moments (fixed views; world state frozen via ?test&day&hour&weather).
// fov: vertical field of view of the capture (degrees; session 4). Photographs of the site are taken at 24–35 mm: 46° (24 mm
// at 16:9) indoors and in courts, 40° (≈ 28 mm) for the wider outdoor views. FOV=game renders at the player's setting (70°,
// a 14 mm lens: for judging first-person presence).
const IN = 46, OUT = 40;
const SHOTS: { n: string; day: number; hour: number; w: string; v: [number, number, number, number, number]; fov?: number; frames?: number; court?: boolean }[] = [
  // dawn before sunrise (D-118): day 0 (17 Apr 467 BCE) 05:24, the sun 2.9° below the horizon (sunrise ~05:35): the
  // Earth's shadow and the antitwilight arch over the W plain, no sun shadows; the old slot (05:51, sun +2.5°) and a view
  // E into the glow over Kuh-e Rahmat are kept for comparison
  { n: 'dawn-stair-top', day: 0, hour: 5.40, w: 'clear', v: [-39.6, 122.45, 1.6, 251, -4] }, // 1 m from the W edge of the top landing (x −40.6), so the frame shows the descent and the plain, not 4 m of pavement (session 4)
  { n: 'dawn-sunrise', day: 0, hour: 5.85, w: 'clear', v: [-40.2, 122.45, 1.6, 251, -12] }, // at the landing's W parapet, pitched down so its merlons stand in the foreground (session 4: at −4° the frame held only the plain)
  { n: 'dawn-sunrise-nw', day: 0, hour: 5.85, w: 'clear', v: [-36.4, 134.8, 1.6, 311, -8] }, // from the N end of the top landing: the N upper flight descending on the right, the plain to the NW
  { n: 'dawn-stair-top-nw', day: 0, hour: 5.40, w: 'clear', v: [-36.4, 134.8, 1.6, 311, -8] }, // the pre-sunrise moment from the head of the N upper flight: the stair descending, the plain to the NW (session 4)
  { n: 'dawn-glow-e', day: 0, hour: 5.40, w: 'clear', v: [-36.4, 122.45, 1.6, 79, 6] },
  { n: 'gate-dusk', day: 0, hour: 19.25, w: 'clear', v: [0.1, 118, 1.6, 341, 4] },
  { n: 'night-terrace', day: 5, hour: 22.5, w: 'clear', v: [0, 92, 1.6, 161, 6] },
  // moonless pre-dawn (day 1 = 18 Apr 467 BCE, the moon a thin crescent set in the evening): the Milky Way from Cygnus to
  // Sagittarius over the SE, seen from the Grand Stair top (D-047)
  { n: 'night-milkyway', day: 1, hour: 3.5, w: 'clear', v: [-36, 125, 1.6, 125, 28], fov: 60 },
  { n: 'brazier-close', day: 0, hour: 21.5, w: 'clear', v: [-36.4, 132, 1.6, 161, -8], fov: IN },
  { n: 'apadana-hall-torch', day: 0, hour: 21, w: 'clear', v: [-8, 0, 4.6, 161, 6], fov: IN },
  { n: 'rain-columns', day: 2, hour: 14, w: 'rain', v: [-20, 70, 1.6, 161, 4] },
  // §1.1 "rain moving across the plain toward the columns": day 12's rain episode reaches the Terrace at 06:01 from the
  // WSW (245°); at 05:40 its cell is ~6 km out over the plain (WeatherSystem.rainCell); seen from the Apadana W portico
  { n: 'rain-approach', day: 299, hour: 11.1, w: 'auto', v: [-38, -5, 1.6, 232, 3] }, // a heavy cell (14 mm) 15 km SW over the plain, seen out of the Apadana W portico, 50 min before it arrives (D-060, D-064)
  // from the sunlit N court, 10 m out from the N portico's outer row (y 48), between its two axial columns (x −2.4, 6.2):
  // sunlit pavement, the portico's shade and the black doorway 27 m off (session 4 reframe; the old view stood in the
  // portico facing two blank walls)
  { n: 'apadana-enter', day: 25, hour: 11, w: 'clear', v: [1.9, 58, 1.6, 161, 4], fov: IN },
  { n: 'apadana-enter-portico', day: 25, hour: 11, w: 'clear', v: [1.9, 36, 1.6, 161, 2], fov: IN }, // the old view, in the portico
  // inside the hall, one bay E of the axis (between column lines x 6.2 and 14.9), looking SSW and up: the capitals and
  // beams close overhead, the far doorway the one bright thing low in the frame (session 4 reframe)
  { n: 'apadana-hall-in', day: 25, hour: 11, w: 'clear', v: [10.55, 12.4, 1.6, 170, 20], fov: 50 },
  { n: 'apadana-hall-axis', day: 25, hour: 11, w: 'clear', v: [1.9, 12, 1.6, 161, 6], fov: IN }, // the old view: 18 m inside the N doorway, along the axis
  { n: 'reliefs-raking', day: 60, hour: 18.3, w: 'clear', v: [-30, 63.5, 1.6, 83, -3] }, // 4.5 m off the Apadana N stair façade, looking E along it: the low NW sun grazes the procession (session 3)
  // inside the scribes' room (D-067): from just W of the S doorway (x 184.0–185.1), looking ENE at the scribe by the desk
  // (186.8, −83.2), so the door's light falls across him as a side key (session 4 reframe; the old view from the NE corner
  // saw him as a silhouette against the door)
  { n: 'scribe-at-work', day: 25, hour: 10, w: 'clear', v: [183.2, -83.9, 1.6, 60, -20], fov: 50 },
  { n: 'scribe-room-ne', day: 25, hour: 10, w: 'clear', v: [190.9, -82.0, 1.7, 235, -15], fov: 50 }, // the old view from the NE corner
  { n: 'stair-climb', day: 25, hour: 8.5, w: 'clear', v: [-43.9, 128, 1.6, 341, 12] },
  { n: 'stair-climb-pm', day: 25, hour: 16, w: 'clear', v: [-43.9, 128, 1.6, 341, 12] }, // the W-facing stair in the afternoon sun (the morning view is in the Terrace's shadow); shares its state with tripylon-n-stair
  { n: 'snow-terrace', day: 280, hour: 10, w: 'snow', v: [-20, 70, 1.6, 161, 4] },
  // Phase 4: the rest of the Terrace
  { n: 'tachara-s-stair', day: 25, hour: 15.5, w: 'clear', v: [-21, -112, 1.6, 341, 6] },
  // inside the Tachara hall, in the W aisle, looking SW at the doorway into the W2 room: its S reveal carries a
  // lance-bearer with a wicker shield (D-132); the W1 doorway and the hall niches are to the right
  { n: 'tachara-lance-bearers', day: 25, hour: 15.5, w: 'clear', v: [-25.5, -80.5, 1.6, 225, 5], fov: IN }, // from the hall, 5 m E of the W2 doorway (x −30.25, y −83.45…−82.15): its frame, the folded leaves and the jambs' reliefs (reframed again in session 4: at 46° the old spot saw only the leaves)
  { n: 'tachara-lance-bearer-close', day: 25, hour: 15.5, w: 'clear', v: [-28.8, -82.0, 1.6, 206, -10], fov: IN }, // at the hall end of the W2 passage, looking SW at the S jamb's reveal and its lance-bearer (the old spot, mid-passage, rendered black)
  { n: 'hadish-hall', day: 25, hour: 11, w: 'clear', v: [22, -150, 1.6, 161, 2], fov: IN },
  { n: 'hall100-site', day: 25, hour: 9.5, w: 'clear', v: [146, 45, 1.6, 161, 4] },
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
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  const only = process.env.ONLY?.split(',');
  // WEBGL=1 forces the WebGL2 backend inside the webgpu project (the render queue runs one project): shots are suffixed
  // -webgl2-forced and __parsa.backend is logged
  const WEBGL = !!process.env.WEBGL, proj = WEBGL ? 'webgl2-forced' : info.project.name;
  // one page load per world state: views that share day, hour and weather reuse the loaded world (a page load is
  // ~3–5 min at high under SwiftShader; the state is frozen, so only the camera moves between them)
  let loaded = '';
  for (const s of SHOTS) {
    if (only && !only.includes(s.n)) continue;
    const state = `${s.day}|${s.hour}|${s.w}|${s.court ? 'court' : ''}`;
    if (state !== loaded) {
      await page.goto(`/?test&quality=${process.env.Q ?? 'test'}&day=${s.day}&hour=${s.hour}&weather=${s.w}${s.court ? '&court=seasonal' : ''}${WEBGL ? '&webgl=1' : ''}`);
      await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 600_000 });
      // the world is frozen in test mode: stop the animation loop, so the screenshot does not wait behind its frames under
      // SwiftShader (minutes each; the Phase 4 render helper found this, tests/e2e/lib/p4views.ts)
      await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
      loaded = state;
    }
    const fov = process.env.FOV === 'game' ? undefined : s.fov ?? OUT;
    await page.evaluate(([v, f]) => (window as any).__parsa.view(...v, f), [s.v, fov] as const);
    for (let i = 0; i < (process.env.FRAMES ? +process.env.FRAMES : s.frames ?? 8); i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    const png = await page.screenshot({ path: `shots/moment-${s.n}-${proj}.png` });
    // §8.3 luminance (display-referred sRGB luma): whole frame; appended to shots/moments-lum.json
    const lum = await lumStats(page, png); const exp = await page.evaluate(() => (window as any).__parsa.exposureInfo());
    mkdirSync('shots', { recursive: true }); const f = 'shots/moments-lum.json'; const all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
    all[`${s.n}|${process.env.Q ?? 'test'}|${proj}`] = { lum, exposure: +exp.exposure.toFixed(3), meterEV: +(exp.meterEV ?? 0).toFixed(2), sunAlt: +exp.sunAlt.toFixed(1), fov: fov ?? 'game' }; writeFileSync(f, JSON.stringify(all, null, 1));
    console.log(s.n, JSON.stringify(lum), 'backend', await page.evaluate(() => (window as any).__parsa.backend));
  }
  console.log(errs.slice(0, 5).join('\n'));
});
