// s18 C7 (D-710): the playtest — a scripted play-through of the BUILT site, as a player meets it, at default quality on
// ?webgl=1 (the cloud's SwiftShader): title -> Enter -> walk a town lane -> walk on the Terrace -> talk to three people (each
// must answer from their own life) -> follow one person to the evening -> skip six hours -> at every step: page errors, render
// faults, black frames (canvas mean), the clock and the frame count moving (nothing frozen), the JS heap. Built on C9's
// tools/dev/live_path.mjs (same server and launch flags).
//   (cd <tree> && npx vite build --outDir <dist>) ; node tools/dev/playtest.mjs <dist> <outdir> [--port 4187] [--q <quality>]
// Writes <outdir>/playtest.json and one screenshot per step; prints PASS or the breaks. Out of world, English.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const dist = resolve(a[0] ?? 'dist'), out = resolve(a[1] ?? 'playtest'), port = +opt('--port', 4187), q = opt('--q', ''); mkdirSync(out, { recursive: true });
const COV = JSON.parse(readFileSync(new URL('../../tests/data/coverage_points.json', import.meta.url), 'utf8')).points;
const lane = COV.find(p => p.sub === 'town:lanes'), terr = COV.find(p => p.area === 'terrace');
const srv = spawn(process.execPath, [join(new URL('.', import.meta.url).pathname, '../deploy/serve.mjs'), dist, String(port), '/fars/'], { stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch {} }); await new Promise(r => setTimeout(r, 1500));
const b = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errs = [], t0 = Date.now(), s = () => +((Date.now() - t0) / 1000).toFixed(0);
p.on('pageerror', e => errs.push(`${s()}s PAGEERROR ${String(e.stack ?? e).slice(0, 300)}`));
p.on('console', m => { if (m.type() === 'error') errs.push(`${s()}s ${m.text().slice(0, 300)}`); });
const R = { dist, steps: [], breaks: [] }, brk = (what) => { R.breaks.push(what); console.log('BREAK', what); };
await p.goto(`http://127.0.0.2:${port}/fars/?seed=1&webgl=1${q ? `&quality=${q}` : ''}`);
await p.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 2_400_000, polling: 1000 });
R.readyS = s(); R.error = await p.evaluate(() => window.__parsa.error ?? null); if (R.error) brk(`boot error: ${R.error}`);
const ev = (f, ...x) => p.evaluate(f, ...x).catch(e => ({ evalError: String(e).slice(0, 200) }));
const step = async (label) => {
  const st = await ev(() => { const P = window.__parsa, t = P.getTime?.() ?? null, S = P.stats?.() ?? {}; return { time: t, frame: S.frame ?? S.frames ?? null, draws: S.drawCalls ?? null,
    faults: (window.__renderFaults ?? []).length, frameFaults: P.exposureInfo?.()?.frameFaults ?? null, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(0) : null }; });
  const png = await p.screenshot({ timeout: 180000 }).catch(() => null); let mean = null;
  if (png) { writeFileSync(join(out, `${label}.png`), png); const d = await sharp(png).removeAlpha().raw().toBuffer(); let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i]; mean = +(sum / d.length).toFixed(1); }
  const row = { label, atS: s(), mean, ...st, errors: errs.length }; R.steps.push(row); console.log(JSON.stringify(row));
  if (mean !== null && mean < 8) brk(`${label}: black frame (mean ${mean})`); if (!png) brk(`${label}: no screenshot (page hung?)`);
  return row;
};
const r0 = await step('ready');
await p.waitForTimeout(15000); await step('title');
await ev(() => [...document.querySelectorAll('button')].find(x => /^(Enter|Continue the visit)$/.test(x.textContent.trim()))?.click());
for (let i = 0; i < 4; i++) { await p.waitForTimeout(1500); await p.keyboard.press('Escape'); await p.keyboard.press('Space'); }
await p.waitForTimeout(20000); const r1 = await step('entered');
if (r1.mean === r0.mean && r1.time?.hour === r0.time?.hour) brk('entered: nothing changed since ready (frozen?)');
// walk a town lane (the walkthrough bot's fixed-step steering), then on the Terrace
for (const [label, P] of [['lane', lane], ['terrace', terr]]) {
  const res = await ev((P) => { const A = window.__parsa; A.teleport(P.e, P.n); const az = P.az * Math.PI / 180;
    const w = A.walkTo(P.e + 25 * Math.sin(az), P.n + 25 * Math.cos(az), 90); return { reached: w.reached, stuck: w.stuck, t: +w.t.toFixed(1) }; }, P);
  R[label] = res; await p.waitForTimeout(3000); await step(`walk-${label}`);
  if (res.evalError) brk(`walk ${label}: ${res.evalError}`); else if (!res.reached) brk(`walk ${label} from (${P.e}, ${P.n}) toward az ${P.az}: ${res.stuck ? 'stuck' : 'not reached'} after ${res.t} s`);
}
// talk to three people: the nearest population person or agent in town, each asked of their work; each must answer, and
// not all the same words
R.talks = [];
const spots = [[lane.e, lane.n], [terr.e, terr.n], [-175, 122.45]];
for (const [e, n] of spots) {
  const t = await ev(async ([e, n]) => { const A = window.__parsa; A.teleport(e, n); for (let i = 0; i < 30; i++) A.tick?.();
    const C = window.__converse; if (!C) return { none: 'no __converse' }; let who = C.nearest?.();
    if (!who) { const P = A.people?.(), ag = P?.agents?.filter(x => !x.offmap).sort((x, y) => Math.hypot(x.e - e, x.n - n) - Math.hypot(y.e - e, y.n - n))[0];
      if (!ag) return { none: 'nobody near' }; A.teleport(ag.e + 0.8, ag.n); for (let i = 0; i < 10; i++) A.tick?.(); who = C.nearest?.(); }
    const r = await Promise.race([C.say('Greetings. What is your work, and where is your house?'), new Promise(res => setTimeout(() => res({ timeout: true }), 90000))]);
    return { who: who?.pid ?? null, reply: r?.reply?.slice?.(0, 200) ?? null, own: !!r?.own, timeout: !!r?.timeout }; }, [e, n]);
  R.talks.push(t); console.log('talk', JSON.stringify(t));
}
const answered = R.talks.filter(t => t.reply && t.reply.length > 10);
if (answered.length < 3) brk(`talk: ${answered.length}/3 answered (${R.talks.map(t => t.none ?? (t.timeout ? 'timeout' : t.evalError ?? (t.reply ? 'ok' : 'empty'))).join(', ')})`);
if (new Set(answered.map(t => t.reply)).size < answered.length) brk('talk: two people gave the same answer');
await step('talked');
// follow one person to the evening: the first who answered, through the hours to 19:30; their day must end at their house
R.follow = await ev((pid) => { const A = window.__parsa, W = A.people?.(); if (pid === null || pid === undefined) return { none: 'nobody to follow' };
  const t = A.getTime(); A.advanceWorld(Math.max(0, (19.5 - t.hour) * 3600)); const P = window.__parsa.people?.(); return { pid, time: A.getTime() }; }, R.talks.find(t => t.who !== null)?.who);
await step('evening');
// skip six hours (the clock set forward; the world must catch up: the sliced day change of D-650)
const before = await ev(() => window.__parsa.getTime());
await ev(() => { const A = window.__parsa, t = A.getTime(); A.setTime(t.day + Math.floor((t.hour + 6) / 24), (t.hour + 6) % 24); });
await p.waitForTimeout(20000); const r6 = await step('skip6h');
if (r6.time && before && Math.abs(((r6.time.hour - before.hour + 24) % 24) - 6) > 1.5) brk(`skip 6 h: the clock went ${before.hour?.toFixed?.(2)} -> ${r6.time.hour?.toFixed?.(2)}`);
await p.waitForTimeout(15000); const r7 = await step('after');
if (r7.time?.hour === r6.time?.hour && r7.frame === r6.frame) brk('after the skip: the clock and frames stopped (frozen)');
const faults = Math.max(...R.steps.map(x => x.faults ?? 0)); if (faults) brk(`${faults} render faults`);
const pageErr = errs.filter(e => /PAGEERROR/.test(e)); if (pageErr.length) brk(`${pageErr.length} page errors: ${pageErr[0].slice(0, 200)}`);
R.errors = [...new Set(errs)].slice(0, 40); R.heapMB = R.steps.map(x => x.heapMB); R.pass = !R.breaks.length;
writeFileSync(join(out, 'playtest.json'), JSON.stringify(R, null, 1));
console.log(R.pass ? 'PASS' : `BREAKS ${R.breaks.length}:\n - ${R.breaks.join('\n - ')}`); console.log('heap MB', R.heapMB.join(' '), '; console errors', errs.length);
await b.close(); srv.kill(); process.exit(0);
