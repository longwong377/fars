// s14/load (D-354): fetch('/x') in node served from public/x (the bake script and the identity test build the units with the
// page's own loaders). Other URLs go to node's fetch. s15 (D-386): a Request made from a relative URL (three's FileLoader
// wraps every URL in one: the GLB models) resolves against http://localhost/, and fetch serves that origin from public/ too
// (before, node's Request threw on '/models/x.glb' and every model fell back to its stand-in in node).
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const LOCAL = 'http://localhost/';
const TYPES: Record<string, string> = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', ktx2: 'image/ktx2', json: 'application/json', glb: 'model/gltf-binary', wasm: 'application/wasm', js: 'text/javascript' };
export function installFileFetch(root = process.cwd()) {
  const g = globalThis as any;
  if (g.__fileFetch) return; g.__fileFetch = true;
  const real = g.fetch, R = g.Request;
  g.Request = class extends R { constructor(u: any, init?: any) { super(typeof u === 'string' && !/^[a-z]+:/i.test(u) ? new URL(u, LOCAL).href : u, init); } };
  g.fetch = async (u: any, init?: any) => {
    let s = String(u?.url ?? u);
    if (s.startsWith(LOCAL)) s = s.slice(LOCAL.length - 1);
    if (!s.startsWith('/') && /^[a-z]+:/i.test(s)) return real(u, init);
    const p = resolve(root, 'public', decodeURIComponent(s.replace(/^\/+/, '').replace(/[?#].*$/, '')));
    if (!existsSync(p)) return new Response(null, { status: 404 });
    const b = readFileSync(p), ext = p.slice(p.lastIndexOf('.') + 1).toLowerCase(), type = TYPES[ext] ?? 'application/octet-stream';
    return new Response(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, { status: 200, headers: { 'content-type': type } });
  };
}
