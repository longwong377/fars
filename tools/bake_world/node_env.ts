// s15/load (D-392): the browser globals the world's build touches, for running it in node (the bake, the node traces):
// fetch from public/ (node_fetch.ts), a location (?quality=high&trace: the built site's own query, so the units' keys are the
// page's), stand-in images (1 x 1, loaded at once: three's ImageLoader; no pixels in node, the build only needs them to exist)
// and canvases whose 2D context draws nothing and reads back zeros (the build's canvas textures are the page's; the bake
// keeps no unit that depends on their pixels). Import it before any module of src/.
import { installFileFetch } from './node_fetch';
const QUERY = process.env.PARSA_QUERY ?? '?quality=high&trace';
installFileFetch(process.cwd());
const g = globalThis as any;
g.location ??= { search: QUERY, href: 'http://localhost/' + QUERY, origin: 'http://localhost', protocol: 'http:', host: 'localhost' };
g.self ??= g;
g.navigator ??= { hardwareConcurrency: 4, userAgent: 'node' };
const fakeCtx = (cv: any) => new Proxy({ canvas: cv }, { get(t: any, k) { if (k in t) return t[k];
  if (k === 'getImageData' || k === 'createImageData') return (a: any, b: any, w?: number, h?: number) => { const W = typeof a === 'object' ? a.width : (w ?? a), H = typeof a === 'object' ? a.height : (h ?? b); return { width: W, height: H, data: new Uint8ClampedArray(Math.max(1, W * H * 4)) }; };
  if (k === 'measureText') return () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 });
  if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop() {} });
  return () => {}; }, set(t: any, k, v) { t[k] = v; return true; } });
class FakeCanvas { width: number; height: number; style = {}; constructor(w = 300, h = 150) { this.width = w; this.height = h; } getContext() { return fakeCtx(this); }
  toDataURL() { return ''; } convertToBlob() { return Promise.resolve(new Blob([])); } transferToImageBitmap() { return { width: this.width, height: this.height, close() {} }; } addEventListener() {} }
g.OffscreenCanvas ??= FakeCanvas;
g.ProgressEvent ??= class extends Event { lengthComputable: boolean; loaded: number; total: number; constructor(t: string, o: any = {}) { super(t); this.lengthComputable = !!o.lengthComputable; this.loaded = o.loaded ?? 0; this.total = o.total ?? 0; } };
g.createImageBitmap ??= async (x: any) => ({ width: x?.width ?? 1, height: x?.height ?? 1, close() {} });
g.document ??= { createElement: (t: string) => (t === 'canvas' ? new FakeCanvas() : g.document.createElementNS('', t)), createElementNS: () => { const L: Record<string, Function[]> = {}; const im: any = { width: 1, height: 1, complete: true, style: {},
  addEventListener: (t: string, f: Function) => { (L[t] ??= []).push(f); }, removeEventListener: () => {} };
  Object.defineProperty(im, 'src', { set(v) { im._src = v; setTimeout(() => (L.load ?? []).forEach(f => f.call(im, { target: im })), 0); }, get() { return im._src; } }); return im; } };
export {};
