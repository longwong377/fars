// s14/load (D-354): fetch('/x') in node served from public/x (the bake script and the identity test build the units with the
// page's own loaders). Other URLs go to node's fetch.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
export function installFileFetch(root = process.cwd()) {
  const real = globalThis.fetch;
  (globalThis as any).fetch = async (u: any, init?: any) => {
    const s = String(u?.url ?? u);
    if (!s.startsWith('/') && /^[a-z]+:/i.test(s)) return real(u, init);
    const p = resolve(root, 'public', s.replace(/^\/+/, '').replace(/[?#].*$/, ''));
    if (!existsSync(p)) return new Response(null, { status: 404 });
    const b = readFileSync(p); return new Response(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, { status: 200 });
  };
}
