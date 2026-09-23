import type { Page } from '@playwright/test';
/** Luminance statistics of a PNG screenshot, decoded in the page (no image library in node). Rec. 709 luma on the
 *  8-bit sRGB display values: mean, percentiles, darkest/brightest, and the fraction of clipped (≥ 254) pixels. */
export async function lumStats(page: Page, png: Buffer, region?: { x0: number; y0: number; x1: number; y1: number }) {
  return page.evaluate(async ({ b64, region }) => {
    const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext('2d')!; g.drawImage(img, 0, 0);
    const r = region ? { x0: Math.round(region.x0 * img.width), y0: Math.round(region.y0 * img.height), x1: Math.round(region.x1 * img.width), y1: Math.round(region.y1 * img.height) } : { x0: 0, y0: 0, x1: img.width, y1: img.height };
    const d = g.getImageData(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0).data; const L: number[] = []; let clip = 0;
    for (let i = 0; i < d.length; i += 4) { const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; L.push(y); if (d[i] >= 254 || d[i + 1] >= 254 || d[i + 2] >= 254) clip++; }
    L.sort((a, b) => a - b); const q = (f: number) => +L[Math.min(L.length - 1, Math.floor(f * L.length))].toFixed(1);
    return { mean: +(L.reduce((a, b) => a + b, 0) / L.length).toFixed(1), min: q(0), p01: q(0.01), p50: q(0.5), p99: q(0.99), max: q(1), clipped: +(clip / L.length).toFixed(4) };
  }, { b64: png.toString('base64'), region });
}
