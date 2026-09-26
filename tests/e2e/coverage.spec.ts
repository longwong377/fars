import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync, realpathSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { depHash } from '../../tools/dev/coverage_dep';
// Coverage pass (D-233, D-235): renders the sampled viewpoints (tests/data/coverage_points.json, from
// tools/dev/coverage_points.ts) with the player's camera (the player's field of view, 70°; nobody kept off the lens: the
// rig's 2.5 m clearance is set to 0) and measures each view: the share of pixels drawn by PLACEHOLDER-flagged objects,
// missing pixels (sky through the ground, black, blown, large flat regions), flatness, low-detail pixels (flag-free:
// triangles per steradian and shading detail), visible tiling, identical instances near the eye, the life in view (people
// moving, working, idle; frozen, sliding, clipping), draw calls and triangles. One page load per run; views are ordered by
// world state and each state is set with __parsa.setTime / setWeather (plain.spec's method). Results are appended to
// shots/coverage.json after EVERY view (checkpoint), keyed `${id}|${Q}|${project}`, and views already there are skipped, so
// an interrupted chunk resumes where it stopped (REDO=1 renders them again). Thumbnails: shots/coverage/<id>-<Q>.jpg.
// Env: Q=test|high|ultra  FRAMES (frames per view; default 3 at test, 6 otherwise)  START, END (index range into the
// points), CHUNK (max views per run, default 40: keep a run under the watchdog)  STRIDE, OFFSET (every STRIDE-th point:
// a pilot over all states and areas)  FOV=photo (40°) instead of the player's  LIFE=0 (skip the life probe)
// VARIETY=N (before the points: the first N variety places, each at the same hour on the file's days; D-236)  POINTS=0 (variety only)
// TIMEOUT (s, default 7000; a run stops starting views 10 min before it)  OUT (default shots/coverage.json)
const PTS = JSON.parse(readFileSync('tests/data/coverage_points.json', 'utf8'));
const Q = process.env.Q ?? 'test', FRAMES = +(process.env.FRAMES ?? (Q === 'test' ? 3 : 6)), TIMEOUT = +(process.env.TIMEOUT ?? 7000);
const OUT = process.env.OUT ?? 'shots/coverage.json', VOUT = OUT.replace(/\.json$/, '_variety.json');
const fovArg = process.env.FOV === 'photo' ? 40 : undefined;
/** the evidence's commit: the tree the snapshot was taken from (its shots/ link points into it), '-dirty' if it had changes */
function evidenceCommit() {
  if (process.env.COMMIT) return process.env.COMMIT;
  try { const root = dirname(realpathSync('shots')); const h = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['-C', root, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim(); return dirty ? h + '-dirty' : h; } catch { return 'unknown'; }
}

function loadJson(f: string) { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; } catch { return {}; } }
function saveJson(f: string, key: string, v: any) { const all = loadJson(f); all[key] = v; writeFileSync(f + '.tmp', JSON.stringify(all)); renameSync(f + '.tmp', f); }

/** the PNG drawn down in the page: a JPEG thumbnail and a 64×36 luminance grid */
async function thumb(page: Page, png: Buffer) {
  return page.evaluate(async (b64) => {
    const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const c = new OffscreenCanvas(480, 270); c.getContext('2d')!.drawImage(img, 0, 0, 480, 270);
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.85 }); const u8 = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    const g = new OffscreenCanvas(64, 36), gx = g.getContext('2d')!; gx.drawImage(img, 0, 0, 64, 36); const d = gx.getImageData(0, 0, 64, 36).data, Y: number[] = [];
    for (let i = 0; i < d.length; i += 4) Y.push(Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]));
    return { jpg: btoa(s), Y };
  }, png.toString('base64'));
}

async function shoot(page: Page, v: any, day: number, hour: number, w: string, state: { key: string }) {
  const k = `${day}|${hour}|${w}`;
  if (state.key !== k) { await page.evaluate(([d, h, ww]) => { const p = (window as any).__parsa; p.setTime(d, h); p.setWeather(ww); }, [day, hour, w] as [number, number, string]); state.key = k; }
  const args = [v.e, v.n, v.eye, v.az, v.pitch, fovArg, { cast: v.cast, rigClear: 0 }];
  await page.evaluate((a) => (window as any).__parsa.view(...a), args);
  // one update lets the plain build its lazy colliders around the eye (river corridor, villages); view again so the eye
  // stands on what is drawn (plain.spec)
  await page.evaluate(() => (window as any).__parsa.tick()); await page.evaluate((a) => (window as any).__parsa.view(...a), args);
  for (let i = 0; i < FRAMES; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
  const png = await page.screenshot();
  const st = await page.evaluate(() => { const p = (window as any).__parsa, s = p.stats(); return { drawCalls: s.drawCalls, triangles: s.triangles, backend: s.backend, sky: p.sky() }; });
  const fm = await page.evaluate((b64) => (window as any).__parsa.flagMask({ frame: b64, mask: true }), png.toString('base64'));
  const rep = await page.evaluate(() => (window as any).__parsa.coverageRepeat(30));
  const life = process.env.LIFE === '0' ? null : await page.evaluate(() => (window as any).__parsa.coverageLife(2)); // last: it advances the world 2 s
  const th = await thumb(page, png);
  return { png, st, fm, rep, life, th };
}

test('coverage', async ({ page }, info) => {
  test.setTimeout(TIMEOUT * 1000);
  const t0 = Date.now(), errs: string[] = [];
  page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  mkdirSync('shots/coverage', { recursive: true });
  const COMMIT = evidenceCommit(), DEP = depHash('.'); // the snapshot's own files: what was rendered
  console.log(`evidence commit ${COMMIT}, dependency hash ${DEP}, sample seed ${PTS.meta.seed} (commit ${PTS.meta.commit ?? '-'})`);
  const variety = +(process.env.VARIETY ?? 0);
  // the work list
  const all = PTS.points as any[], done = loadJson(OUT), tag = (id: string) => `${id}|${Q}|${info.project.name}`;
  const start = +(process.env.START ?? 0), stride = +(process.env.STRIDE ?? 1), off = +(process.env.OFFSET ?? 0), chunk = +(process.env.CHUNK ?? 40);
  const end = Math.min(all.length, +(process.env.END ?? all.length));
  const work = process.env.POINTS === '0' ? [] : all.map((p, i) => ({ p, i })).filter(({ p, i }) => i >= start && i < end && (i - off) % stride === 0 && (process.env.REDO || !done[tag(p.id)])).slice(0, chunk).map(x => x.p);
  const vwork = variety ? (PTS.variety as any[]).slice(0, variety) : [];
  console.log(`coverage: ${work.length} views (of ${all.length}; ${Object.keys(done).length} done) + ${vwork.length} variety places × ${vwork[0]?.days.length ?? 0} days at Q=${Q}, ${FRAMES} frames, fov ${fovArg ?? 'player'}`);
  if (!work.length && !vwork.length) return;
  const first = work[0] ?? { day: vwork[0].days[0], hour: vwork[0].hour, w: vwork[0].w };
  // the default world has the court (UD-10); camera rigs pin court=evidence unless asked: COURT=evidence to sample that setting
  await page.goto(`/?test&quality=${Q}&day=${first.day}&hour=${first.hour}&weather=${first.w}&court=${process.env.COURT ?? "seasonal"}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 900_000 });
  await page.evaluate(() => (window as any).__parsa?.renderer?.setAnimationLoop(null)); // frozen test world: no frames behind the screenshots
  const err = await page.evaluate(() => (window as any).__parsa.error); if (err) throw new Error(err);
  console.log(`page ready in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const state = { key: `${first.day}|${first.hour}|${first.w}` };
  const late = () => Date.now() - t0 > (TIMEOUT - 600) * 1000; // a heavy view takes up to ~7 min under load

  // variety (D-236): the same place at the same hour on several days; how different are the scenes?
  for (const pl of vwork) {
    const shots: any[] = [];
    for (const day of pl.days) {
      if (late()) break;
      const t1 = Date.now();
      const r = await shoot(page, pl, day, pl.hour, pl.w, state);
      const id = `${pl.place}-d${day}`; writeFileSync(`shots/coverage/var-${id}-${Q}.jpg`, Buffer.from(r.th.jpg, 'base64'));
      shots.push({ day, objects: Object.fromEntries((r.fm.objects ?? []).map((o: any) => [o.key, o.share])), people: r.life?.keys ?? [], acts: r.life?.acts ?? {}, byCls: r.life?.byCls ?? null,
        animals: r.life?.animals?.instances ?? 0, impostors: r.life?.impostors ?? 0, Y: r.th.Y, sky: r.fm.shares.sky, ms: Date.now() - t1 });
      console.log(`variety ${id}: people ${r.life?.people} acts ${JSON.stringify(r.life?.acts)} (${((Date.now() - t1) / 1000).toFixed(0)} s)`);
    }
    saveJson(VOUT, `${pl.place}|${Q}|${info.project.name}`, { place: pl.place, sub: pl.sub, seed: PTS.meta.seed, commit: COMMIT, dep: DEP, cam: [pl.e, pl.n, pl.eye, pl.az, pl.pitch], hour: pl.hour, w: pl.w, shots, at: new Date().toISOString() });
  }

  for (const v of work) {
    if (late()) { console.log('coverage: out of time; stopping (resume with the same env)'); break; }
    const t1 = Date.now();
    try {
      const r = await shoot(page, v, v.day, v.hour, v.w, state);
      writeFileSync(`shots/coverage/${v.id}-${Q}.jpg`, Buffer.from(r.th.jpg, 'base64')); if (r.fm.maskPng) writeFileSync(`shots/coverage/${v.id}-${Q}-mask.png`, Buffer.from(r.fm.maskPng, 'base64'));
      const f = r.fm.frame ?? {};
      const rec = { id: v.id, place: v.place, area: v.area, sub: v.sub, state: v.state, month: v.month, band: v.band, weather: v.weather, day: v.day, hour: v.hour, w: v.w, forced: !!v.forced,
        moonFrac: v.moonFrac, moonAlt: v.moonAlt, rigClear: 0, court: process.env.COURT ?? 'seasonal', revisit: !!v.revisit, extra: !!v.extra, seed: PTS.meta.seed, commit: COMMIT, dep: DEP, q: Q, project: info.project.name, fov: fovArg ?? 'player', frames: FRAMES,
        cam: [v.e, v.n, v.eye, v.az, v.pitch], sunAlt: +r.st.sky.sunAlt.toFixed(1), drawCalls: r.st.drawCalls, triangles: r.st.triangles, backend: r.st.backend,
        shares: r.fm.shares, gate: r.fm.gate ?? null, missing: f.missing ?? null, flatness: f.flatness ?? null, lowDetail: f.lowDetail ?? null, frame: f, objects: r.fm.objects, phObjects: r.fm.phObjects, groups: r.fm.groups,
        visibleMeshes: r.fm.visibleMeshes, tieredSourced: r.fm.tieredSourced, untieredKeys: r.fm.untieredKeys, materials: r.fm.materials, geometries: r.fm.geometries, hiddenTop: r.fm.hiddenTop, flagMs: r.fm.ms,
        repetition: r.rep, life: r.life ? { ...r.life, keys: undefined } : null, lumGrid: r.th.Y, ms: Date.now() - t1, at: new Date().toISOString() };
      saveJson(OUT, tag(v.id), rec);
      console.log(`${v.id} ${v.sub} m${v.month} ${v.state}${v.forced ? ' (forced)' : ''}: A1 ${r.fm.shares.phOrUntiered} A2f ${r.fm.gate?.flatRegion} A3c ${r.fm.gate?.clipped} luma ${r.fm.gate?.meanLuma} ph ${r.fm.shares.placeholder} miss ${f.missing} low ${f.lowDetail} flat ${f.flatness} tile ${f.tiling?.periodic}/${f.tiling?.textured} rep ${r.rep.maxIdentical} people ${r.life?.people ?? '-'} (${((Date.now() - t1) / 1000).toFixed(0)} s)`);
    } catch (e) {
      const msg = String(e).slice(0, 400); console.log(`${v.id} FAILED: ${msg}`);
      if (/Target closed|Execution context was destroyed|has been closed|crash/i.test(msg)) throw e; // the page is gone: resume in a new run
      saveJson(OUT, tag(v.id), { id: v.id, place: v.place, area: v.area, sub: v.sub, state: v.state, seed: PTS.meta.seed, commit: COMMIT, dep: DEP, q: Q, project: info.project.name, error: msg, at: new Date().toISOString() });
    }
  }

  console.log('errors:', errs.slice(0, 12).join('\n'));
});
