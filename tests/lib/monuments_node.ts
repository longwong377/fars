// D-329: the Blender-built monuments in node (the committed plain GLBs of public/models/monuments/, parsed by the game's own
// parser, maps as blank stand-ins), so the builders' tests draw and count what the page draws.
import { readFileSync, existsSync } from 'node:fs';
import { registerMonument, type MonumentManifest } from '../../src/render/monuments';

export function loadMonumentsNode(): string[] {
  const P = 'public/models/monuments/manifest.json'; if (!existsSync(P)) return [];
  const man = JSON.parse(readFileSync(P, 'utf8')) as MonumentManifest;
  for (const [id, e] of Object.entries(man.assets)) { const b = readFileSync('public/' + e.file); registerMonument(id, e, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
  return Object.keys(man.assets);
}
