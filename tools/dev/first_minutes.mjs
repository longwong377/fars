// s17 C5 (D-590): a player's first minutes on the BUILT site, driven end to end, every console error and unhandled rejection
// listed: title -> Enter (new visit) -> the opening -> skip -> walk -> pause -> settings (every tab, a slider, Esc back)
// -> save -> reload -> continue (no opening) -> walk; then the talk: the nearest person spoken to while the model is still
// streaming (or blocked), the reply's path and what the page says.
//   npx vite build && node tools/dev/first_minutes.mjs [dist] [--params "norender&seed=1"] [--talk]
// Headless Chromium (CHROME= its path); serves the dist as Pages does (tools/deploy/serve.mjs, /fars/).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const dist = resolve(a[0] && !a[0].startsWith('--') ? a[0] : 'dist'), params = opt('--params', 'norender&seed=1'), port = +opt('--port', 4190);
const here = new URL('.', import.meta.url).pathname;
const srv = spawn(process.execPath, [join(here, '../deploy/serve.mjs'), dist, String(port), '/fars/'], { stdio: ['ignore', 'ignore', 'inherit'] });
process.on('exit', () => { try { srv.kill(); } catch {} });
const host = `http://127.0.0.2:${port}`;
for (let i = 0; i < 50; i++) { try { if ((await fetch(`${host}/fars/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--enable-unsafe-webgpu'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage();
const errors = [], steps = [], t0 = Date.now(), s = () => +((Date.now() - t0) / 1000).toFixed(1);
page.on('console', m => { if (m.type() === 'error') errors.push({ at: s(), kind: 'console', text: m.text().slice(0, 400) }); });
page.on('response', r => { if (r.status() >= 400) errors.push({ at: s(), kind: `http ${r.status()}`, text: r.url().replace(host, '') }); });
page.on('pageerror', e => errors.push({ at: s(), kind: 'pageerror', text: String(e).slice(0, 400) }));
const step = (name, ok, info = '') => { steps.push({ at: s(), name, ok, info }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${s()} s ${name}${info ? ' · ' + info : ''}`); };
const ready = () => page.waitForFunction(() => window.__parsa?.ready || window.__parsa?.error, null, { timeout: 1_200_000 });
const mode = () => page.evaluate(() => window.__shell?.mode);
const clickText = async (txt) => { const el = page.locator('#shell button', { hasText: txt }).first(); await el.click({ timeout: 10_000 }); };
// the walk as a player does it: W held (the pointer is locked after Enter, so the keys drive; unlocked, the bot input does)
const walk = async (sec) => { const p0 = await page.evaluate(() => window.__parsa.playerState()); await page.evaluate(() => window.__parsa.setInput({ forward: 1 })); await page.keyboard.down('KeyW');
  await page.waitForTimeout(sec * 1000); await page.keyboard.up('KeyW'); await page.evaluate(() => window.__parsa.setInput({ forward: 0 })); const p1 = await page.evaluate(() => window.__parsa.playerState());
  return Math.hypot(p1.x - p0.x, p1.z - p0.z); };

try {
  await page.goto(`${host}/fars/?${params}`); await ready();
  const err = await page.evaluate(() => window.__parsa.error); step('ready', !err, err ?? `${s()} s`);
  step('title shown', (await mode()) === 'title' && await page.locator('.front .wordmark').count() > 0);
  step('the loading screen leaves', (await page.waitForFunction(() => !document.querySelector('.load'), null, { timeout: 5000 }).then(() => true).catch(() => false)));
  const enter = await page.locator('#shell button.primary').innerText(); step('new visit offers Enter', enter.trim() === 'Enter', enter);
  await clickText('Enter');
  await page.waitForTimeout(300);
  const intro = await page.evaluate(() => ({ playing: !!window.__intro?.playing, log: window.__intro?.log }));
  step('the opening plays after Enter', intro.playing, JSON.stringify(intro.log));
  await page.waitForTimeout(2500); // the first shot; then a key skips
  const h0 = await page.evaluate(() => window.__parsa.clockLabel());
  await page.keyboard.press('KeyK'); await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({ playing: !!window.__intro?.playing, log: window.__intro?.log, bars: !!document.querySelector('.intro-bars.on'), cls: document.body.className, mode: window.__shell.mode }));
  step('a key skips the opening', !after.playing && after.mode === 'playing', `${h0} -> ${await page.evaluate(() => window.__parsa.clockLabel())} · log ${JSON.stringify(after.log?.map(l => l.shot))}`);
  await page.waitForTimeout(1500); step('the letterbox and the intro class are gone', !(await page.evaluate(() => !!document.querySelector('.intro-bars, .intro-fade') || document.body.classList.contains('intro'))));
  const d1 = await walk(3); step('walk', d1 > 1, `${d1.toFixed(1)} m in 3 s`);
  // Esc as the player presses it: the pointer lock ends and the walk pauses (a headless page's Esc does not leave the lock)
  const locked = await page.evaluate(() => !!document.pointerLockElement);
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); else window.__shell.pause(); }); await page.waitForTimeout(400);
  step('pause', (await mode()) === 'paused' && await page.locator('.front.paused').count() === 1, `${locked ? 'by leaving the pointer lock' : 'no lock: direct'} · ` + await page.locator('.front .when').allInnerTexts().then(t => t.join(' / ')));
  await clickText('Settings');
  const tabs = await page.locator('.tabs button').allInnerTexts(); let tabsOk = true;
  for (let i = 0; i < tabs.length; i++) { await page.locator('.tabs button').nth(i).click(); const rows = await page.locator('.sheet .body .row').count(); if (!rows) tabsOk = false; }
  step('settings: every tab has its rows', tabsOk && tabs.length === 5, tabs.join(', '));
  await page.locator('.tabs button').nth(1).click();
  const fov = page.locator('.sheet input[type=range]').first(); await fov.fill('75'); await fov.dispatchEvent('input');
  step('settings: the field of view applies', await page.evaluate(() => JSON.parse(localStorage.getItem('parsa.settings.v1') ?? '{}').fov) === 75);
  await page.keyboard.press('Escape'); step('Esc goes back to the pause menu', (await page.locator('.front.paused').count()) === 1);
  await clickText('Save the visit'); await page.waitForTimeout(500);
  const saved = await page.locator('#shell button', { hasText: /^Saved$|Save failed/ }).first().innerText().catch(() => '?'); step('save', saved === 'Saved', saved);
  await page.evaluate(() => window.__parsa.saveFlushed?.()); await page.waitForTimeout(800);
  await page.reload(); await ready(); step('reload: ready', true, `${s()} s`);
  const cont = await page.locator('#shell button.primary').innerText(); step('reload: the title offers to continue', /Continue/.test(cont), cont);
  await clickText('Continue'); await page.waitForTimeout(800);
  step('continue: no opening, walking', !(await page.evaluate(() => !!window.__intro?.playing)) && (await mode()) === 'playing');
  const d2 = await walk(2); step('walk after continue', d2 > 0.5, `${d2.toFixed(1)} m`);
  if (a.includes('--talk')) {
    const has = await page.evaluate(() => !!window.__converse); step('talk: the talk layer is mounted', has);
    if (has) {
      const who = await page.evaluate(() => { const P = window.__parsa.people(); const ag = P?.agents.find(x => !x.offmap); if (!ag) return null; window.__parsa.teleport(ag.e + 0.8, ag.n); return ag.name; });
      await page.evaluate(() => window.__parsa.tick());
      const st0 = await page.evaluate(() => ({ status: window.__converse.state.status, loaded: window.__converse.state.loaded, progress: window.__converse.state.progress }));
      const r = await Promise.race([page.evaluate(() => window.__converse.say('Greetings. What is your work?').then(r => r && { name: r.name, reply: r.reply, own: !!r.own, ok: r.ok, ms: Math.round(r.ms ?? 0) })), new Promise(res => setTimeout(() => res({ hung: true }), 60_000))]);
      const panel = await page.evaluate(() => { const p = document.getElementById('converse'); return p ? { shown: p.style.display !== 'none', text: p.innerText.slice(0, 300) } : null; });
      step('talk: a reply comes (or an honest note), never a hang', !(r && r.hung) && !!r, `to ${who} · model ${JSON.stringify(st0)} · reply ${JSON.stringify(r)} · panel ${JSON.stringify(panel)}`);
    }
  }
} catch (e) { step('driver', false, String(e).slice(0, 400)); }
console.log('\nerrors:', errors.length ? '' : 'none'); for (const e of errors) console.log(`  ${e.at} s ${e.kind}: ${e.text}`);
console.log(JSON.stringify({ steps, errors }));
await b.close(); process.exit(steps.every(x => x.ok) ? 0 : 1);
