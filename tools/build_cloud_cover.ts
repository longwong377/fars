// Measure the volumetric cloud layer's column cover as a function of the shader's coverage uniform (D-064) and write
// src/data/cloud_cover_table.json (the sky inverts it). Usage: npx tsx tools/build_cloud_cover.ts
import { writeFileSync } from 'node:fs';
import { columnCover, domeCover, CLOUD } from '../src/sky/cloudCover';
const GRID = 48, STEPS = 32;
const cov: number[] = [0], frac: number[] = [0];
for (let c = 0.3; c <= 0.7001; c += 0.01) { cov.push(+c.toFixed(2)); frac.push(columnCover(c, GRID, STEPS)); }
cov.push(1); frac.push(1);
// the local curve: column cover for a FIXED effective cover c (the weather field's multiplier replaced by c everywhere)
const lc: number[] = [0], lf: number[] = [0];
for (let c = 0.3; c <= 0.7001; c += 0.01) { lc.push(+c.toFixed(2)); lf.push(columnCover(0, GRID, STEPS, c)); }
lc.push(1); lf.push(1);
for (let i = 1; i < lf.length; i++) lf[i] = Math.max(lf[i], lf[i - 1]);
// the dome curve (D-145): the fraction of the sky dome an observer sees covered, for a fixed effective cover c
const dc: number[] = [0], df: number[] = [0];
for (let c = 0.3; c <= 0.7001; c += 0.01) { dc.push(+c.toFixed(2)); df.push(domeCover(c)); }
dc.push(1); df.push(1);
for (let i = 1; i < df.length; i++) df[i] = Math.max(df[i], df[i - 1]);
for (let i = 1; i < frac.length; i++) frac[i] = Math.max(frac[i], frac[i - 1]); // monotone (sampling noise)
writeFileSync('src/data/cloud_cover_table.json', JSON.stringify({ _meta: { what: 'fraction of vertical columns with optical depth > 1 (over one weather tile) drawn by the volumetric cloud shader, per value of its coverage uniform', grid: GRID, steps: STEPS, cloud: CLOUD, tool: 'tools/build_cloud_cover.ts', tier: 'measured (of our own shader); the mapping of weather cover to column cover is C' }, cov, frac: frac.map(f => +f.toFixed(4)), local: { c: lc, frac: lf.map(f => +f.toFixed(4)) }, dome: { c: dc, frac: df.map(f => +f.toFixed(4)), what: 'fraction of the sky dome (solid angle above the shader horizon cut) seen covered by an observer, per fixed effective cover (D-145)' } }, null, 1) + '\n');
console.log('dome', dc.map((c, i) => `${c}:${df[i].toFixed(3)}`).join(' '));
console.log(cov.map((c, i) => `${c}:${frac[i].toFixed(3)}`).join(' '));
