// debug (DBG=1): where does a frame hang? Loads a state, starts one renderOnce without awaiting it, and if it has not
// returned after WAIT s pauses the page through the DevTools protocol and prints the JavaScript call stack. Session 7:
// the rain-columns moment (day 2, 14:00, forced rain) never finished a frame at high or medium (58 min each).
// env: DAY, HOUR, W (weather), V (e,n,eye,az,pitch), Q, WAIT (s, default 150)
import { test } from '@playwright/test';
test('hang', async ({ page }) => {
  test.setTimeout(2400_000);
  const day = process.env.DAY ?? '2', hour = process.env.HOUR ?? '14', w = process.env.W ?? 'rain', v = (process.env.V ?? '-20,70,1.6,161,4').split(',').map(Number);
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text().slice(0, 200)); });
  await page.goto(`/?test&quality=${process.env.Q ?? 'medium'}&day=${day}&hour=${hour}&weather=${w}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 900_000 });
  console.log('ready');
  await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  await page.evaluate((c) => (window as any).__parsa.view(...c, 40), v);
  const cdp = await page.context().newCDPSession(page); await cdp.send('Debugger.enable');
  let paused: any = null; cdp.on('Debugger.paused', e => { paused = e; });
  for (let f = 0; f < 3; f++) {
    // not awaited: if the frame's synchronous part never returns, neither does this evaluate (session 7: it blocked 40 min)
    let syncDone = false; const ev = page.evaluate(() => { const w = window as any; w.__rDone = -1; const t = performance.now(); return Promise.resolve(w.__parsa.renderOnce()).then(() => (w.__rDone = performance.now() - t)); }).then(r => { syncDone = true; return r; }, () => { syncDone = true; return -1; });
    const t0 = Date.now(); let done = -1;
    while (Date.now() - t0 < +(process.env.WAIT ?? 150) * 1000) {
      await new Promise(r => setTimeout(r, 5000));
      if (syncDone) { done = await ev; break; }
      console.log('frame', f, 'not returned at', Math.round((Date.now() - t0) / 1000), 's');
    }
    if (done >= 0) { console.log('frame', f, 'ms', Math.round(done)); continue; }
    await cdp.send('Debugger.pause'); const t1 = Date.now(); while (!paused && Date.now() - t1 < 60_000) await new Promise(r => setTimeout(r, 500));
    if (!paused) { console.log('frame', f, 'not done and no JS to pause: waiting on the GPU (SwiftShader) or a promise'); }
    else { console.log('frame', f, 'PAUSED; stack:'); for (const c of paused.callFrames.slice(0, 25)) console.log('  ', c.functionName || '(anon)', c.url.replace(/^.*\/src\//, 'src/').slice(0, 90), c.location.lineNumber + 1); }
    break;
  }
});
