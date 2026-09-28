// rejoin <file>.partNN into <file> and check every sha256 of SHA256SUMS
import { readFileSync, readdirSync, openSync, closeSync, writeSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap(e => e.name === '.git' ? [] : e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const parts = walk('.').filter(f => /\.part00$/.test(f));
for (const p0 of parts) { const base = p0.slice(0, -7), ps = readdirSync(dirname(p0)).filter(n => n.startsWith(basename(base) + '.part')).sort();
  const fd = openSync(base, 'w'); for (const n of ps) { const b = readFileSync(join(dirname(p0), n)); writeSync(fd, b); } closeSync(fd); }
let bad = 0; for (const l of readFileSync('SHA256SUMS', 'utf8').split('\n').filter(Boolean)) { const [h, f] = l.split(/\s+/);
  const x = createHash('sha256').update(readFileSync(f)).digest('hex'); if (x !== h) { bad++; console.log('BAD', f); } }
console.log(bad ? `${bad} bad` : 'all files rejoined and verified');
