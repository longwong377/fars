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
