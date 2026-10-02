// s15/load (D-386): a Worker for node made from a blob: URL (three's DRACOLoader and KTX2Loader build theirs from inline source
// and the decoder's own JS), run in this thread in a vm context whose global is the worker's `self`. Enough for the world
// build in node (tools/bake_world/node_build.ts, the bake) to decode the Draco meshes and transcode the KTX2 textures the page
// does, so node counts the same geometry. Messages are structured clones delivered on a later tick (four Draco workers share one config object: by reference, their modules overwrote each other). A
// module worker from a file URL (the page's own workers) still throws, as before: its callers keep their main-thread fallback.
import vm from 'node:vm';
import { resolveObjectURL } from 'node:buffer';

/** typed arrays out of a clone remade as views of this realm's current constructors (a tool may have replaced them: MEMSITES) */
const rebind = (v: any): any => { if (!v || typeof v !== 'object') return v;
  if (ArrayBuffer.isView(v) && !(v instanceof DataView)) { const C = (globalThis as any)[v.constructor.name]; return C && v.constructor !== C ? new C(v.buffer, v.byteOffset, (v as any).length) : v; }
  if (v instanceof ArrayBuffer) return v; if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = rebind(v[i]); return v; }
  for (const k of Object.keys(v)) v[k] = rebind(v[k]); return v; };
type Listener = (e: { data: any }) => void;
class Port {
  onmessage: Listener | null = null; private L: Listener[] = [];
  addEventListener(t: string, f: Listener) { if (t === 'message') this.L.push(f); }
  removeEventListener(t: string, f: Listener) { this.L = this.L.filter(x => x !== f); }
  deliver(data: any, transfer?: any[]) { const d = structuredClone(data, transfer?.length ? { transfer: transfer.filter(t => t instanceof ArrayBuffer) } : undefined); setImmediate(() => { const e = { data: rebind(d) }; this.onmessage?.(e); for (const f of this.L) f(e); }); }
}
export class BlobWorker extends Port {
  private inner = new Port(); private ready: Promise<void>; private ctx: any;
  constructor(url: string | URL) {
    super(); const u = String(url);
    if (!u.startsWith('blob:')) throw new Error(`node worker: only blob: URLs (${u.slice(0, 80)})`);
    const blob = resolveObjectURL(u); if (!blob) throw new Error('node worker: unknown blob URL');
    const inner = this.inner, outer = this;
    // (this realm's typed arrays and WebAssembly: the decoders look them up on self by name, and what they return is used out here)
    const self: any = { Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, ArrayBuffer, DataView, WebAssembly, Promise, console, setTimeout, clearTimeout, setInterval, clearInterval, TextDecoder, TextEncoder, performance, URL, Blob, fetch: (globalThis as any).fetch,
      location: { href: 'http://localhost/worker.js' }, importScripts: () => { throw new Error('node worker: importScripts'); },
      postMessage: (d: any, t?: any[]) => outer.deliver(d, t),
      addEventListener: (t: string, f: Listener) => inner.addEventListener(t, f), removeEventListener: (t: string, f: Listener) => inner.removeEventListener(t, f) };
    self.self = self; self.globalThis = self;
    const ctx = vm.createContext(self); this.ctx = ctx;
    // the worker's own `onmessage = ...` assigns its global: read it from the context at each delivery
    inner.onmessage = e => { const f = this.ctx?.onmessage; if (typeof f === 'function') f.call(this.ctx, e); };
    this.ready = blob.text().then(src => { vm.runInContext(src, ctx, { filename: 'blob-worker.js' }); });
  }
  postMessage(data: any, transfer?: any[]) { if (!this.ctx) return; const d = structuredClone(data, transfer?.length ? { transfer: transfer.filter(t => t instanceof ArrayBuffer) } : undefined); void this.ready.then(() => this.inner.deliver(d)); }
  /** drop the context (its wasm heap goes with it at the next GC, as a terminated worker's does) */
  terminate() { this.ctx = null; this.inner = new Port(); this.onmessage = null; }
}
export function installBlobWorker() { const g = globalThis as any; g.Worker ??= BlobWorker; }
