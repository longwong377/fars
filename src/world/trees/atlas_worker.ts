// s17 (D-560, C4's boot profile: the leaf atlas cost ~2 s of main-thread JS at load): the leaf atlas decoded and assembled off
// the main thread. Receives the two WebP blobs and the manifest's shade, returns the Atlas with its level buffers transferred.
import { atlasFromImages } from './atlas';

const decode = async (blob: Blob) => {
  const bm = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const cv = new OffscreenCanvas(bm.width, bm.height), g = cv.getContext('2d', { willReadFrequently: true })!; g.drawImage(bm, 0, 0);
  const d = g.getImageData(0, 0, bm.width, bm.height).data, W = bm.width, H = bm.height; bm.close();
  const o = new Uint8Array(W * H * 4); for (let j = 0; j < H; j++) o.set(d.subarray((H - 1 - j) * W * 4, (H - j) * W * 4), j * W * 4); // (PNG/WebP rows top-down; the atlas's row 0 is v = 0)
  return { d: o, W, H };
};
self.onmessage = async (e: MessageEvent) => {
  try {
    const { col, tilt, shadeB } = e.data as { col: Blob; tilt: Blob; shadeB: number };
    const [c, t] = await Promise.all([decode(col), decode(tilt)]);
    const a = atlasFromImages(c.d, t.d, c.W, c.H, [0, shadeB], t.W, t.H);
    (self as any).postMessage({ atlas: a }, [...a.levels.map(l => l.data.buffer), ...a.tilt.map(l => l.data.buffer)]);
  } catch (err) { (self as any).postMessage({ error: String((err as Error)?.message ?? err) }); }
};
