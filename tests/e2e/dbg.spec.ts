import { test } from '@playwright/test';
test('dbg', async ({ page }) => {
  for (const q of ['', '&noshadow', '&hemi=10', '&hour=12']) {
    await page.goto(`/?test&quality=test&day=0&weather=clear${q.includes("hour") ? q : "&hour=5.85" + q}`);
    await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 600_000 });
    await page.evaluate(() => (window as any).__parsa.view(-36.4, 122.45, 1.6, 251, -2));
    await page.evaluate(() => (window as any).__parsa.renderOnce()); await page.evaluate(() => (window as any).__parsa.renderOnce());
    await page.screenshot({ path: `shots/dbg.png` });
    const { execSync } = await import('node:child_process');
    console.log(q, execSync(`python3 -c "from PIL import Image; im=Image.open('shots/dbg.png').convert('RGB'); print(im.getpixel((480,330)), im.getpixel((480,480)))"`).toString().trim());
  }
});
