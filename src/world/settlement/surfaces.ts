// Settlement surfaces (Phase 6), registered into the shared procedural surface table (render/materials.ts) so the town
// uses the same TSL surface model as the Terrace (weather wetting, puddles, snow, procedural relief). All tier C unless
// stated: no mud plaster, roof or refuse surface of Achaemenid Persepolis has been measured.
import { SURFACES, SurfaceDef } from '../../render/materials';

export const SETTLEMENT_SURFACES: Record<string, SurfaceDef> = {
  // town house walls: straw-tempered mud render over mud brick in the local loam (base colour per house from vertex
  // colours); roofs and wall tops: packed earth over reeds and poles
  mud_plaster: { albedo: [0.56, 0.47, 0.36], roughness: 0.95, porosity: 0.85, noiseScale: 0.9, noiseAmp: 0.13, bump: { amp: 0.012, freq: 1.6 }, top: 'mud_roof', tier: 'C', note: 'town walls: mud plaster (straw-tempered loam) over mud brick, local soil tone (C; no excavated Persepolis house)' },
  // D-223: the roof's finish coat is a fine clay-and-straw render (the region's kahgel), rolled and renewed before the rains
  // and bleached by the sun: lighter and yellower than the trodden, damp, littered earth of the lanes (was 0.49, 0.42, 0.33,
  // the lanes' own tone: from the Terrace the roofs did not read, rubric s7 pass 2 fix 9). C
  mud_roof: { albedo: [0.60, 0.53, 0.41], roughness: 0.97, porosity: 0.9, noiseScale: 0.5, noiseAmp: 0.12, bump: { amp: 0.01, freq: 1.8 }, chips: { cover: 0.05, size: 0.08, albedo: [0.66, 0.60, 0.46] }, tier: 'C', note: 'flat roof: packed earth over reeds and poles, a sun-bleached clay-and-straw finish coat renewed before the rains (C, D-223)' },
  // refuse: middens, dung, bone pits (base colour from vertex colours); sherds as chips
  refuse: { albedo: [0.32, 0.28, 0.23], roughness: 0.96, porosity: 0.9, noiseScale: 1.2, noiseAmp: 0.18, bump: { amp: 0.02, freq: 2.5 }, chips: { cover: 0.1, size: 0.05, albedo: [0.56, 0.36, 0.26] }, tier: 'C', note: 'middens, dung and ash: grime where work happens (brief 5.5), C' },
  // Tol-e Ajori facing: baked brick (AJORI-BRICK2018: baked and glazed brick with mud brick, B); brick ~0.33 m square,
  // courses ~0.09 m with mortar (C)
  baked_brick: { albedo: [0.62, 0.5, 0.36], roughness: 0.85, porosity: 0.5, noiseScale: 1.5, noiseAmp: 0.1, joints: { course: 0.09, block: 0.34, width: 0.012, dark: 0.15 }, bump: { amp: 0.002, freq: 5 }, top: 'mud_roof', tier: 'B/C', note: 'baked-brick facing of the Tol-e Ajori gate (materials B: AJORI-BRICK2018; brick size, 12 mm mortar joints and tone C)' },
  // limestone without the Terrace ashlar joint pattern (small blocks, kerbs, bases, the Takht-e Rustam courses have their own joints)
  stone_plain: { albedo: [0.5, 0.48, 0.44], roughness: 0.75, porosity: 0.35, noiseScale: 2, noiseAmp: 0.12, bump: { amp: 0.002, freq: 5 }, tier: 'C', note: 'local grey limestone (kerbs, well heads, column bases), C' },
  takht_stone: { albedo: [0.52, 0.5, 0.46], roughness: 0.7, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.12, joints: { course: 1.1, block: 2.6, width: 0.002, dark: 0.5 }, bump: { amp: 0.002, freq: 5 }, tier: 'C', note: 'Takht-e Rustam: local stone (LIVIUS-TR, B); block size C' },
  // earth roads: compacted, with fewer stones than the plain and no herb layer in the wheel tracks
  road: { albedo: [0.66, 0.56, 0.45], roughness: 0.96, porosity: 0.85, noiseScale: 0.6, noiseAmp: 0.1, bump: { amp: 0.006, freq: 1.5 }, chips: { cover: 0.03, size: 0.12, albedo: [0.6, 0.57, 0.5] }, tier: 'C', note: 'earth road, 6-8 m (settlement.json, C course)' },
  // D-234: the houses at full detail (houses.ts). Straw-tempered mud plaster over mud brick (earthen plaster at Pasargadae
  // and Persepolis: Stein et al. 2016, B; its tone the local loam per house, vertex colours, C): the renewed skirting coat,
  // damp and a salt line at the foot (D-218's model), float arcs and hairline shrinkage cracks, rain run-off below the tops
  // of exposed walls, a hand-laid undulation; the roofs' clay-and-straw coat on the up-facing faces
  house_plaster: { albedo: [0.56, 0.47, 0.36], roughness: 0.95, porosity: 0.85, noiseScale: 0.9, noiseAmp: 0.1, tone: { sd: 0.07, chroma: 0.012, patch: -0.05 }, foot: 1, skirt: { h: 0.45, dark: 0.1, salt: 0.05 }, runoff: 0.12, plasterWork: { float: 1, cracks: 1 }, bump: { amp: 0.008, freq: 1.4 }, micro: { amp: 0.0007, freq: 50, alb: 0.06 }, top: 'house_roof', tier: 'C', note: 'town house walls: straw-tempered mud plaster over mud brick (earthen plaster B: Stein et al. 2016; tone per house C), a renewed skirting coat with damp and salt at the foot, float arcs, shrinkage cracks, run-off under the tops (D-218 model, C)' },
  house_roof: { albedo: [0.60, 0.53, 0.41], roughness: 0.97, porosity: 0.9, noiseScale: 0.5, noiseAmp: 0.12, tone: { sd: 0.06, chroma: 0.01 }, bump: { amp: 0.01, freq: 1.8 }, chips: { cover: 0.05, size: 0.08, albedo: [0.66, 0.60, 0.46] }, micro: { amp: 0.0008, freq: 45, alb: 0.07 }, tier: 'C', note: 'flat roof and wall tops: packed earth with a sun-bleached clay-and-straw coat, rolled and renewed before the rains (C, D-223)' },
  // the footing: rough fieldstones (the local grey limestone) laid in mud mortar (stone foundations under mud brick at Hasanlu,
  // Baba Jan, Tall-i Takht: B analogues; C here)
  house_socle: { albedo: [0.53, 0.51, 0.47], roughness: 0.85, porosity: 0.45, noiseScale: 1.6, noiseAmp: 0.14, fieldstone: { size: 0.22, tone: 0.2, gap: 0.045, mortar: [0.4, 0.34, 0.26] }, bump: { amp: 0.004, freq: 3 }, micro: { amp: 0.0005, freq: 60, alb: 0.05 }, tier: 'C', note: 'house footing: rough fieldstones of the local limestone laid in mud (C; stone foundations under mud-brick walls at Hasanlu, Baba Jan, Tall-i Takht: B analogues)' },
  // poplar poles, battens, lintels, ladders, spouts and door leaves: grey-brown where weathered (vertex colours), not the
  // palaces' cedar; brush, matting, cloth and fleeces use the same surface with their own colours (C)
  house_timber: { albedo: [0.5, 0.43, 0.34], roughness: 0.8, porosity: 0.55, noiseScale: 5, noiseAmp: 0.16, streaks: { amp: 0.1, freq: 9, stretch: 0.06 }, bump: { amp: 0.0015, freq: 7 }, micro: { amp: 0.0004, freq: 70, alb: 0.07 }, tier: 'C', note: 'poplar (and plane) poles and planks, weathered grey-brown outside (C: poplar is the region\'s building timber, RECOLLECTION; the palaces\' cedar was not for town houses); brush, matting, cloth by colour' },
  // bare mud brick where the plaster has fallen: Achaemenid bricks ~33 cm square and ~10-12 cm thick (Iranica, search
  // extract: B), laid in mud mortar joints ~2 cm (C)
  house_brick: { albedo: [0.62, 0.53, 0.41], roughness: 0.95, porosity: 0.85, noiseScale: 1.2, noiseAmp: 0.12, joints: { course: 0.13, block: 0.35, width: 0.02, dark: 0.3 }, blockTone: 0.1, bump: { amp: 0.004, freq: 3 }, micro: { amp: 0.0006, freq: 50, alb: 0.06 }, tier: 'B/C', note: 'bare mud brick where the plaster has fallen: bricks ~33 cm square (Iranica, search extract, B), mud joints ~2 cm (C)' },
  bank: { albedo: [0.554, 0.462, 0.352], roughness: 0.95, porosity: 0.9, noiseScale: 0.5, noiseAmp: 0.12, bump: { amp: 0.01, freq: 1.2 }, herbs: 0.8, tier: 'C', note: 'canal bank: dug earth (C)' },
};
let done = false;
export function registerSettlementSurfaces() { if (done) return; done = true; Object.assign(SURFACES, SETTLEMENT_SURFACES); }
