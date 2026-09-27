// The census of the carved-relief atlas (D-320): every relief figure the world draws (the Apadana, the Phase 4 stairs and
// jambs, Naqsh-e Rustam, the rosette bands), grouped by definition (kind | seed) with the heights and depths it is drawn at,
// and the frame each definition is baked in. Shared by tools/blender/relief_atlas.ts and tests/relief_atlas.test.ts.
import { readFileSync } from 'node:fs';
import { buildTerrace } from '../../../src/arch/terrace';
import { buildReliefs, buildPhase4Reliefs, loadInscriptionFonts } from '../../../src/arch/decor';
import { ReliefSet } from '../../../src/arch/reliefs';

export interface Inst { S: number; D: number; minLod: number }
export interface DefUse { key: string; kind: string; seed: number; inst: Inst[] }
export async function census(): Promise<Map<string, DefUse>> {
  const out = new Map<string, DefUse>();
  const add = (kind: string, seed: number, S: number, D: number, minLod = 0) => { const key = `${kind}|${seed}`; let u = out.get(key); if (!u) out.set(key, u = { key, kind, seed, inst: [] }); u.inst.push({ S, D, minLod }); };
  const take = (s: ReliefSet) => { for (const it of s.items) add(it.kind, it.seed, it.S, it.D, it.minLod ?? 0); for (const r of s.rosettes) add('rosette', 0, r.S, r.D, 0); }; // (a rosette is carved within 2 m: the finest texel)
  const { manifest, doorways } = buildTerrace() as any;
  const ap = buildReliefs(manifest), p4 = buildPhase4Reliefs(doorways).group;
  for (const c of [...ap.children, ...p4.children]) if (c instanceof ReliefSet) take(c);
  { // Naqsh-e Rustam (the plain): its tomb façades' upper registers
    await loadInscriptionFonts(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; });
    const { buildNaqsh } = await import('../../../src/world/plain/naqsh');
    const { loadTerrain, loadRiversFile } = await import('../../../tests/plainLib');
    const g = buildNaqsh(loadTerrain(), (loadRiversFile() as any).nrAncientFootAsl).group;
    g.traverse(o => { if (o instanceof ReliefSet) take(o); });
  }
  return new Map([...out].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
}
/** the depth ratio and figure height a definition is baked at: its most common D/S (ties: the larger height's), at the
 *  largest height drawn with that ratio; the texel is sized for the largest height it is drawn at; `coarse` when it is never
 *  drawn at the finest level (minLod >= 1: the canopy) */
export function bakeFrame(u: DefUse) {
  const groups = new Map<string, { rho: number; n: number; S: number }>();
  for (const i of u.inst) { const k = (i.D / i.S).toFixed(4); const g = groups.get(k) ?? { rho: i.D / i.S, n: 0, S: 0 }; g.n++; g.S = Math.max(g.S, i.S); groups.set(k, g); }
  const best = [...groups.values()].sort((a, b) => b.n - a.n || b.S - a.S)[0];
  return { rho: best.rho, S: best.S, sMax: Math.max(...u.inst.map(i => i.S)), coarse: u.inst.every(i => i.minLod >= 1) };
}
