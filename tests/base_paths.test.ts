// s15/ship (D-374): the public site lives under /fars/ (GitHub Pages), so no shipped module may fetch a public/ file by an
// absolute '/' path: every one goes through BASE (src/core/base.ts). The built site failed at the plain on one such fetch.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files: string[] = []; // (src/dev and *_probe.ts: dev pages, not shipped)
const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (n !== 'dev') walk(p); } else if (p.endsWith('.ts') && !p.endsWith('.test.ts') && !p.endsWith('_probe.ts')) files.push(p); } };
walk('src');
const BAD = [
  /fetch\(\s*['"`]\/(?!\/)/, // fetch('/x'), fetch(`/x`)
  /fetch\(\s*['"]\/['"]\s*\+/, // fetch('/' + p)
  /\b(load\w*|Terrain\.load)\(\s*['"]\/['"]\s*[,)]/, // loadModels('/')
  /['"`]\/(world-cache|generated|models|textures|lightmaps|voices|fonts)\//, // '/models/...'
];
describe('public/ fetches go through BASE (the site under /fars/)', () => {
  it('no shipped module fetches by an absolute path', () => {
    const hits: string[] = [];
    for (const f of files) readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      const code = l.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
      if (/__world-cache\/put/.test(code)) return; // (the dev server's bake endpoint: dev only)
      if (BAD.some(r => r.test(code))) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 120)}`);
    });
    expect(hits).toEqual([]);
  });
});
