// Seasonal state of the herb layer on uncultivated ground (C). Fars has winter rain (Nov–Apr) and a dry summer (climate
// normals, src/data/climate: A for the modern regime); annual herbs green up with the winter rains, peak in spring, and
// stand as straw from June to the autumn rains. The curve is a reconstruction (tier C); crops and fields are Phase 7.
// Keyed by Gregorian day of year (solar season), converted from the world clock's day index.
export const SEASON_TABLE: { doy: number; green: number; dry: number }[] = [
  { doy: 0, green: 0.45, dry: 0.15 }, { doy: 60, green: 0.8, dry: 0.05 }, { doy: 105, green: 1.0, dry: 0.0 }, { doy: 135, green: 0.7, dry: 0.25 },
  { doy: 166, green: 0.25, dry: 0.65 }, { doy: 196, green: 0.05, dry: 0.8 }, { doy: 288, green: 0.05, dry: 0.55 }, { doy: 334, green: 0.3, dry: 0.3 }, { doy: 365, green: 0.45, dry: 0.15 },
];
/** day index 0 = 1 Nisannu 467 BCE = 17 April (proleptic Julian) ≈ Gregorian day of year 102 in that century (Julian − 5 d) */
export const DOY_AT_DAY0 = 102;
export function seasonAt(dayIndex: number): { green: number; dry: number } {
  const doy = ((DOY_AT_DAY0 + dayIndex) % 365 + 365) % 365;
  for (let i = 1; i < SEASON_TABLE.length; i++) { const a = SEASON_TABLE[i - 1], b = SEASON_TABLE[i];
    if (doy <= b.doy) { const t = (doy - a.doy) / (b.doy - a.doy); return { green: a.green + (b.green - a.green) * t, dry: a.dry + (b.dry - a.dry) * t }; } }
  return SEASON_TABLE[0];
}

/** V5 D-522: the season's palette (sRGB), the one place it lives (the art direction: spring's young green, summer's straw
 *  and stubble, autumn's bare and ploughed earth): the herb layer's green and straw (materials.ts herbs, terrainPlain.ts wild
 *  ground and the foot's herbs, water.ts verges, groundCover.ts tufts), the stubble fresh and grazed grey. Spring green is
 *  the one saturated colour of the land (C: young wheat, barley and the wild grasses of a Fars April after the winter rain;
 *  the first pass's olive (0.31, 0.36, 0.18) read as a dry summer khaki at the player's lens) */
export const SEASON_PALETTE = {
  green: [0.34, 0.45, 0.16] as const,
  straw: [0.64, 0.56, 0.36] as const,
  stubble: [0.72, 0.64, 0.42] as const,
  stubbleOld: [0.58, 0.55, 0.47] as const,
};
/** a palette colour in linear RGB (for shader constants) */
export const paletteLinear = (c: readonly number[]): [number, number, number] => c.map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
