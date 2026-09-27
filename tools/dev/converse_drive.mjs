// D-296: drive the conversation lab (converse.html) in the installed Chrome on the real GPU and run one job, sampling the
// card's memory (nvidia-smi) as it goes. Needs a dev server on E2E_PORT (5261 for this worktree). Usage:
//   node tools/dev/converse_drive.mjs <job.mjs> [out.json]
// where job.mjs exports default async (page, lab, log) => result; lab(fn, ...args) runs window.__lab[fn](...args).
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PORT = process.env.E2E_PORT ?? '5261';
const [jobPath, outPath] = process.argv.slice(2);
const job = (await import(pathToFileURL(jobPath).href)).default;
const smi = () => { try { const [used, util] = execFileSync('nvidia-smi', ['--query-gpu=memory.used,utilization.gpu', '--format=csv,noheader,nounits']).toString().trim().split(',').map(Number); return { used, util }; } catch { return { used: NaN, util: NaN }; } };
const gpu = { base: smi(), samples: [] };
const timer = setInterval(() => gpu.samples.push({ t: Date.now(), ...smi() }), 1000);
const args = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', ...(process.env.FAKE_WAV ? ['--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${process.env.FAKE_WAV}`] : []), ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(' ') : [])];
// a persistent profile (PROFILE=dir): the browser's model cache has a disk-sized quota there (an ephemeral context ran out after two models)
const browser = process.env.PROFILE ? await chromium.launchPersistentContext(process.env.PROFILE, { channel: 'chrome', headless: !process.env.HEADED, args, viewport: { width: +(process.env.W ?? 1280), height: +(process.env.H ?? 720) } }) : await chromium.launch({ channel: 'chrome', headless: !process.env.HEADED, args });
const page = process.env.PROFILE ? (browser.pages()[0] ?? await browser.newPage()) : await browser.newPage({ viewport: { width: +(process.env.W ?? 1280), height: +(process.env.H ?? 720) } });
const logs = []; page.on('console', m => { const t = m.text(); if (logs.length < 400) logs.push(`[${m.type()}] ${t.slice(0, 300)}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${String(e).slice(0, 500)}`));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const url = process.env.URL ?? `http://localhost:${PORT}/converse.html`;
await page.goto(url, { timeout: 0 });
const readyExpr = process.env.READY ?? 'window.__lab && window.__lab.ready';
await page.waitForFunction(readyExpr, null, { timeout: 0, polling: 500 });
const lab = (fn, ...a) => page.evaluate(([fn, a]) => window.__lab[fn](...a), [fn, a]);
let result, error = null;
try { result = await job(page, lab, log, { smi, gpu }); } catch (e) { error = String(e?.stack ?? e); log('job failed', error); }
clearInterval(timer);
const out = { url, when: new Date().toISOString(), error, result, gpu: { base: gpu.base, max: Math.max(...gpu.samples.map(s => s.used)), samples: gpu.samples.length }, logs: logs.slice(-60) };
if (outPath) writeFileSync(outPath, JSON.stringify(out, null, 1)); else console.log(JSON.stringify(out, null, 1).slice(0, 4000));
await browser.close();
