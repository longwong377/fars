// Settlement surfaces (Phase 6), registered into the shared procedural surface table (render/materials.ts) so the town
// uses the same TSL surface model as the Terrace (weather wetting, puddles, snow, procedural relief). All tier C unless
// stated: no mud plaster, roof or refuse surface of Achaemenid Persepolis has been measured.
import { SURFACES, SurfaceDef } from '../../render/materials';

export const SETTLEMENT_SURFACES: Record<string, SurfaceDef> = {
  // town house walls: straw-tempered mud render over mud brick in the local loam (base colour per house from vertex
  // colours); roofs and wall tops: packed earth over reeds and poles
  mud_plaster: { albedo: [0.56, 0.47, 0.36], roughness: 0.95, porosity: 0.85, noiseScale: 0.9, noiseAmp: 0.13, bump: { amp: 0.012, freq: 1.6 }, top: 'mud_roof', tier: 'C', note: 'town walls: mud plaster (straw-tempered loam) over mud brick, local soil tone (C; no excavated Persepolis house)' },
  mud_roof: { albedo: [0.49, 0.42, 0.33], roughness: 0.97, porosity: 0.9, noiseScale: 0.5, noiseAmp: 0.12, bump: { amp: 0.01, freq: 1.8 }, chips: { cover: 0.05, size: 0.08, albedo: [0.62, 0.56, 0.42] }, tier: 'C', note: 'flat roof: packed earth over reeds and poles, straw in the mud (C)' },
  // refuse: middens, dung, bone pits (base colour from vertex colours); sherds as chips
  refuse: { albedo: [0.32, 0.28, 0.23], roughness: 0.96, porosity: 0.9, noiseScale: 1.2, noiseAmp: 0.18, bump: { amp: 0.02, freq: 2.5 }, chips: { cover: 0.1, size: 0.05, albedo: [0.56, 0.36, 0.26] }, tier: 'C', note: 'middens, dung and ash: grime where work happens (brief 5.5), C' },
  // Tol-e Ajori facing: baked brick (AJORI-BRICK2018: baked and glazed brick with mud brick, B); brick ~0.33 m square,
  // courses ~0.09 m with mortar (C)
  baked_brick: { albedo: [0.62, 0.5, 0.36], roughness: 0.85, porosity: 0.5, noiseScale: 1.5, noiseAmp: 0.1, joints: { course: 0.09, block: 0.34, width: 0.012, dark: 0.15 }, bump: { amp: 0.002, freq: 5 }, top: 'mud_roof', tier: 'B/C', note: 'baked-brick facing of the Tol-e Ajori gate (materials B: AJORI-BRICK2018; brick size, 12 mm mortar joints and tone C)' },
  // limestone without the Terrace ashlar joint pattern (small blocks, kerbs, bases, the Takht-e Rustam courses have their own joints)
  stone_plain: { albedo: [0.5, 0.48, 0.44], roughness: 0.75, porosity: 0.35, noiseScale: 2, noiseAmp: 0.12, bump: { amp: 0.002, freq: 5 }, tier: 'C', note: 'local grey limestone (kerbs, well heads, column bases), C' },
  takht_stone: { albedo: [0.52, 0.5, 0.46], roughness: 0.7, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.12, joints: { course: 1.1, block: 2.6, width: 0.002, dark: 0.5 }, bump: { amp: 0.002, freq: 5 }, tier: 'C', note: 'Takht-e Rustam: local stone (LIVIUS-TR, B); block size C' },
  // earth roads: compacted, with fewer stones than the plain and no herb layer in the wheel tracks
  road: { albedo: [0.52, 0.45, 0.35], roughness: 0.96, porosity: 0.85, noiseScale: 0.6, noiseAmp: 0.1, bump: { amp: 0.006, freq: 1.5 }, chips: { cover: 0.03, size: 0.12, albedo: [0.6, 0.57, 0.5] }, tier: 'C', note: 'earth road, 6-8 m (settlement.json, C course)' },
  bank: { albedo: [0.45, 0.38, 0.28], roughness: 0.95, porosity: 0.9, noiseScale: 0.5, noiseAmp: 0.12, bump: { amp: 0.01, freq: 1.2 }, herbs: 0.8, tier: 'C', note: 'canal bank: dug earth (C)' },
};
let done = false;
export function registerSettlementSurfaces() { if (done) return; done = true; Object.assign(SURFACES, SETTLEMENT_SURFACES); }
