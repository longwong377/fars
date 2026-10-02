// s17 C5 (D-590): screenshots of the out-of-world screens (tools/dev/shell_probe.ts). Serve the tree (npx vite --port $E2E_PORT), then
//   node tools/dev/shell_probe.mjs [outdir] [WxH]   (one png per screen)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'shots/shell', [W, H] = (process.argv[3] ?? '1600x900').split('x').map(Number); mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : { executablePath: process.env.CHROME ?? undefined });
const p = await b.newPage({ viewport: { width: W, height: H } }); const logs = [];
p.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const views = (process.env.VIEWS ?? 'loading&frac=0.08,loading&frac=0.55,loading&frac=0.95,title,title&continued,pause,settings&tab=0,settings&tab=1,settings&tab=3,controls,chronicle,subtitle,intro').split(',');
for (const v of views) {
  await p.goto(`http://localhost:${process.env.E2E_PORT ?? '5173'}/tools/dev/shell_probe.html?screen=${v}`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 120000 }); await p.waitForTimeout(2200); // the entrance animations
  const f = `${OUT}/${v.replace(/[&=]/g, '-')}.png`; await p.screenshot({ path: f }); console.log(f);
}
if (logs.length) console.log(logs.join('\n')); await b.close();
