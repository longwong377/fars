// D-325: the project's modelled props in node: the committed GLBs (public/models/props/m_*.glb, plain, no Draco) parsed by the
// game's own parser (scanProps.ts parseModelGLB) and registered, so the builders' tests draw the real models.
import { readFileSync } from 'node:fs';
import { parseModelGLB, registerModel, modelIds, type ModelEntry } from '../../src/render/scanProps';

export function loadModelsNode(): string[] {
  const man = JSON.parse(readFileSync('public/models/props/manifest.json', 'utf8'));
  for (const [id, e] of Object.entries<any>(man.assets)) {
    if (!e.parts) continue;
    const b = readFileSync('public/' + e.file);
    registerModel(id, e as ModelEntry, parseModelGLB(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)));
  }
  return modelIds();
}
