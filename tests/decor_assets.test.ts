// D-330: the Blender-built decor and tents (tools/blender/decor.mjs): every file the game loads is present with the bytes its
// build recorded, and every build is current with its inputs (the scripts and the data they read).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import META from '../src/data/decor_assets.json';
// @ts-expect-error (a .mjs helper without types)
import { decorInputHash } from '../tools/blender/lib/decor_inputs.mjs';

const A = (META as any).assets as Record<string, { inHash: string; files: Record<string, { sha256: string; bytes: number }> }>;
describe('decor assets (D-330)', () => {
  it('the frames\' trim and the merlon are built', () => { expect(A.trim).toBeDefined(); expect(A.merlon).toBeDefined(); });
  for (const [id, a] of Object.entries(A)) {
    it(`${id}: current with its inputs; its files present, as built`, () => {
      expect(a.inHash, `${id} is stale: run node tools/blender/decor.mjs ${id}`).toBe(decorInputHash(id));
      for (const [f, r] of Object.entries(a.files)) { const p = `public/${f}`; expect(existsSync(p), p).toBe(true); const b = readFileSync(p);
        expect(b.length, p).toBe(r.bytes); expect(createHash('sha256').update(b).digest('hex'), p).toBe(r.sha256); }
    });
  }
});
