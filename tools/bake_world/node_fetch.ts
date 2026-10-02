// s14/load (D-354): fetch('/x') in node served from public/x (the bake script and the identity test build the units with the
// page's own loaders). Relative URLs (three's loaders make a Request of them) resolve against http://localhost/, which is
// served from public/ too. Other URLs go to node's fetch.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const LOCAL = 'http://localhost/';
export function installFileFetch(root = process.cwd()) {
  const g = globalThis as any;
  if (g.__fileFetch) return; g.__fileFetch = true;
  const real = g.fetch, RealRequest = g.Request;
  g.Request = class extends RealRequest { constructor(u: any, init?: any) { super(typeof u === 'string' && !/^[a-z]+:/i.test(u) ? new URL(u, LOCAL).href : u, init); } };
  g.fetch = async (u: any, init?: any) => {
    let s = String(u?.url ?? u);
    if (s.startsWith(LOCAL)) s = s.slice(LOCAL.length - 1);
    if (!s.startsWith('/') && /^[a-z]+:/i.test(s)) return real(u, init);
    const p = resolve(root, 'public', decodeURIComponent(s.replace(/^\/+/, '').replace(/[?#].*$/, '')));
    if (!existsSync(p)) return new Response(null, { status: 404 });
    const b = readFileSync(p); return new Response(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, { status: 200 });
  };
}
