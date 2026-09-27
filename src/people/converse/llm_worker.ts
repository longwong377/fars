// D-296: the language model runs in its own worker (WebLLM on WebGPU) so the render loop's main thread never waits on it
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';
import { isLocal } from './models';
// a lost device says why (the driver's watchdog, memory): logged to the page's console for the measurements
const gpu = (navigator as any).gpu; if (gpu) { const ra = gpu.requestAdapter.bind(gpu);
  gpu.requestAdapter = async (...a: any[]) => { const ad = await ra(...a); if (!ad) return ad; const rd = ad.requestDevice.bind(ad);
    ad.requestDevice = async (...b: any[]) => { const d = await rd(...b); d.lost.then((i: any) => console.error(`[llm] device lost: ${i.reason} ${i.message}`)); d.addEventListener?.('uncapturederror', (e: any) => console.error(`[llm] gpu error: ${e.error?.message}`)); return d; }; return ad; }; }
// in a dev tree the weights are already on the local disk (the dev server's /models/): the browser's cache would copy each
// model into the profile again (1-4 GB; the box's disk ran short), so here the cache passes every read to the server. On a
// public URL the browser's cache keeps the weights after the first visit, as intended.
if (isLocal(self.location.origin)) { const pass = { add: async () => {}, addAll: async () => {}, put: async () => {}, delete: async () => true, keys: async () => [], matchAll: async () => [],
  match: async (r: any) => { const res = await fetch(typeof r === 'string' ? r : r.url); return res.ok ? res : undefined; } };
  (self as any).caches.open = async () => pass; (self as any).caches.has = async () => true; }
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg);
