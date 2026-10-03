// D-740 (s18 C9): every KTX2 the page loads instead of an image is still made from that image. The bakes (tools/bake_world/
// ktx_scans, ktx_ground, ktx_low, ktx_humans, ktx_bark, ktx_maps) record the hash of their sources; a source changed without
// a re-bake would ship the old picture, so this fails and names the tool to run.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const sha = (b: Buffer | string) => createHash('sha1').update(b).digest('hex').slice(0, 16);
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
describe('KTX2 copies match their sources (D-740)', () => {
  it('the scans (ktx_scans.ts) and their low-first twins (ktx_low.ts)', () => {
    const maps = json('public/textures/ktx.json').maps as Record<string, string>, bad: string[] = [];
    for (const [k, h] of Object.entries(maps)) { const j = `public/textures/${k}.jpg`; if (existsSync(j) && sha(readFileSync(j)) !== h) bad.push(k); if (!existsSync(`public/textures/${k}.ktx2`)) bad.push(`${k}: no ktx2`); }
    expect(bad, 'run tools/bake_world/ktx_scans.ts').toEqual([]);
    const low = json('public/textures/ktx_low.json').maps as Record<string, string>, stale: string[] = [];
    for (const [k, h] of Object.entries(low)) if (sha(readFileSync(`public/textures/${k}.ktx2`)) !== h || !existsSync(`public/textures/${k}.low.ktx2`)) stale.push(k);
    expect(stale, 'run tools/bake_world/ktx_low.ts').toEqual([]);
  });
  it('the people\'s layers (ktx_humans.ts): the same hash over the same images in the same order', () => {
    const D = 'public/generated/humans/scans', m = json(join(D, 'scans_ktx.json')), meta = json(join(D, 'scans.json')), h = createHash('sha1'); h.update(`v1|${meta.size}`);
    for (const s of meta.skin) h.update(readFileSync(join(D, `skin_${String(s.layer).padStart(2, '0')}.jpg`)));
    for (const c of meta.cloth) { h.update(readFileSync(join(D, `cloth_${c.layer}.jpg`))); h.update(readFileSync(join(D, `cloth_${c.layer}_h.jpg`))); }
    const F = json('public/models/people/people_cloth.json').folds; if (F) h.update(readFileSync(join('public/models/people', F.file)));
    expect(h.digest('hex').slice(0, 16), 'run tools/bake_world/ktx_humans.ts').toBe(m.src);
  });
  it('the bark (ktx_bark.ts) and the loadMap images (ktx_maps.ts)', () => {
    const b = json('public/models/trees/bark/bark.json'), bad: string[] = [];
    for (const [f, h] of Object.entries(b.sources as Record<string, string>)) if (sha(readFileSync(`public/models/trees/bark/${f}`)) !== h) bad.push(f);
    expect(bad, 'run tools/bake_world/ktx_bark.ts').toEqual([]);
    const m = json('public/ktx_maps.json').maps as Record<string, string>, stale: string[] = [];
    for (const k of Object.keys(m)) if (!existsSync(`public/${k.replace(/\.(jpg|png|webp)$/, '.ktx2')}`)) stale.push(k);
    expect(stale, 'run tools/bake_world/ktx_maps.ts').toEqual([]);
  });
});
