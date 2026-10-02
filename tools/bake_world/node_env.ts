// s15/load (D-386): the browser globals the world build touches, for running it in node (node_build.ts, the bake): a location
// with ?test&trace, self, navigator, ProgressEvent (three's FileLoader), fetch from public/ (node_fetch.ts), Worker from a
// blob: URL (node_worker.ts: the Draco and KTX2 decoders), and a document whose images take their file's size from its header
// and whose canvases are 2-D stand-ins (every drawing call a no-op, getImageData zeros). No pixels in node: what the build
// does with them is counted (images, canvasBytes), not drawn.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { installFileFetch } from './node_fetch';
import { installBlobWorker } from './node_worker';

export const nodeEnvStats = { images: new Map<string, number>(), canvasBytes: 0, canvases: 0 };
export function imageSize(root: string, u: string): [number, number] | null { try {
  const p = resolve(root, 'public', decodeURIComponent(u.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '').replace(/[?#].*$/, ''))); if (!existsSync(p)) return null;
  return sizeOfBytes(readFileSync(p)); } catch { return null; } }
/** an image's [width, height] from its file header (PNG, WebP, JPEG) */
export function sizeOfBytes(b: Buffer): [number, number] | null { try {
  if (b[0] === 0x89 && b[1] === 0x50) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') { const c = b.toString('ascii', 12, 16);
    if (c === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (c === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
    return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; }
  if (b[0] === 0xff && b[1] === 0xd8) { let i = 2; while (i + 9 < b.length) { const m = b[i + 1], len = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + len; } }
  return null; } catch { return null; } }

function ctx2d(cv: any): any {
  const imageData = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
  const target: any = { canvas: cv, getImageData: (_x: number, _y: number, w: number, h: number) => imageData(w, h), createImageData: (w: any, h?: number) => (typeof w === 'object' ? imageData(w.width, w.height) : imageData(w, h!)),
    measureText: (s: string) => ({ width: 8 * String(s).length, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), isPointInPath: () => false };
  return new Proxy(target, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^[a-z]/.test(k) && !/Style$|^line|^font|^global|^shadow|^text|^image/.test(k) ? () => {} : t[k]), set: (t, k, v) => { t[k] = v; return true; } });
}
class NodeCanvas { private w = 300; private h = 150; private c: any = null; style = {};
  get width() { return this.w; } set width(v: number) { this.w = v; this.count(); }
  get height() { return this.h; } set height(v: number) { this.h = v; this.count(); }
  private counted = 0; private count() { nodeEnvStats.canvasBytes += this.w * this.h * 4 - this.counted; this.counted = this.w * this.h * 4; }
  constructor(w?: number, h?: number) { if (w) this.w = w; if (h) this.h = h; nodeEnvStats.canvases++; this.count(); }
  getContext() { return (this.c ??= ctx2d(this)); } toDataURL() { return 'data:,'; } addEventListener() {} removeEventListener() {}
  convertToBlob() { return Promise.resolve(new Blob([])); } transferToImageBitmap() { return { width: this.w, height: this.h, close() {} }; } }

export function installNodeEnv(root = process.cwd(), search = '?test&trace&quality=high') {
  const g = globalThis as any;
  g.location ??= { search, href: 'http://localhost/' + search, origin: 'http://localhost', protocol: 'http:', host: 'localhost', pathname: '/' };
  g.self ??= g;
  // (an adapter with a desktop GPU's features, the T4's: the KTX2 transcodes target BC formats as the page's do, not RGBA)
  const features = new Set(['texture-compression-bc', 'float32-filterable', 'rg11b10ufloat-renderable', 'depth-clip-control', 'timestamp-query']);
  const gpu = { requestAdapter: async () => ({ features, limits: {}, info: { vendor: 'node' } }) };
  if (g.navigator) { if (!g.navigator.gpu) Object.defineProperty(g.navigator, 'gpu', { value: gpu, configurable: true }); } // (node 21+ has a navigator)
  else g.navigator = { hardwareConcurrency: 4, userAgent: 'node', gpu };
  g.ProgressEvent ??= class ProgressEvent extends Event { lengthComputable: boolean; loaded: number; total: number; constructor(t: string, o: any = {}) { super(t); this.lengthComputable = !!o.lengthComputable; this.loaded = o.loaded ?? 0; this.total = o.total ?? 0; } };
  installFileFetch(root); installBlobWorker();
  g.OffscreenCanvas ??= NodeCanvas;
  g.createImageBitmap ??= async (src: any) => { const b = src instanceof Blob ? Buffer.from(await src.arrayBuffer()) : null, d = b ? sizeOfBytes(b) : [src?.width ?? 1, src?.height ?? 1];
    if (!d) throw new Error('node createImageBitmap: unknown image'); nodeEnvStats.images.set(`bitmap#${nodeEnvStats.images.size}`, d[0] * d[1] * 4); return { width: d[0], height: d[1], close() {} }; };
  const img = () => { const L: Record<string, Function[]> = {}; const im: any = { width: 1, height: 1, naturalWidth: 1, naturalHeight: 1, complete: true, style: {}, decode: () => Promise.resolve(),
    addEventListener: (t: string, f: Function) => { (L[t] ??= []).push(f); }, removeEventListener: () => {} };
    Object.defineProperty(im, 'src', { set(v) { im._src = v; const d = imageSize(root, String(v)); if (d) { im.width = im.naturalWidth = d[0]; im.height = im.naturalHeight = d[1]; nodeEnvStats.images.set(String(v), d[0] * d[1] * 4); }
      setTimeout(() => { (L.load ?? []).forEach(f => f.call(im, { target: im })); im.onload?.({ target: im }); }, 0); }, get() { return im._src; } }); return im; };
  g.Image ??= function () { return img(); };
  g.document ??= { createElementNS: (_ns: string, t: string) => (t === 'canvas' ? new NodeCanvas() : img()), createElement: (t: string) => (t === 'canvas' ? new NodeCanvas() : img()),
    body: { appendChild() {}, removeChild() {} }, addEventListener() {}, fonts: { add() {}, ready: Promise.resolve() } };
}
