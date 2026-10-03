// D-680 (C12's ledger: "one cumulus deck all year"): the season's cloud types over Fars (C, the climate's general pattern:
// winter's frontal stratus and nimbostratus from the Mediterranean lows, spring's afternoon cumulus over the heated plateau,
// summer's clear sky under the subtropical high with dust haze and a little high cloud, autumn's cirrus and altocumulus ahead
// of the first fronts). Two weights the sky reads: `stratus` (the volumetric deck flattened, lowered and evened into a sheet)
// and `cirrus` (a high fibrous veil drawn in the dome, skySystem.ts), by the day of the year, smoothed between months.
/** per month (0 = January): [stratus, cirrus] */
export const CLOUD_KIND: [number, number][] = [
  [0.75, 0.3], [0.65, 0.3], [0.35, 0.3], [0.15, 0.3], [0.05, 0.25], [0, 0.2], [0, 0.15], [0, 0.2], [0.05, 0.4], [0.2, 0.55], [0.45, 0.5], [0.7, 0.35],
];
/** day of the year (0..365) of a game day (the year starts on 17 April: day of year 106) */
export const doyOf = (gameDay: number) => (((106 + gameDay) % 365) + 365) % 365;
/** the season's weights on a day of the year, interpolated between mid-months */
export function cloudKind(doy: number): { stratus: number; cirrus: number } {
  const m = doy / 30.44 - 0.5, i = Math.floor(m), f = m - i, a = CLOUD_KIND[((i % 12) + 12) % 12], b = CLOUD_KIND[(((i + 1) % 12) + 12) % 12];
  return { stratus: a[0] + (b[0] - a[0]) * f, cirrus: a[1] + (b[1] - a[1]) * f };
}
/** today's cirrus veil (0..1): the season's share, more on days with some cover, none in rain (C) */
export const cirrusToday = (doy: number, cover: number, rain: number) => cloudKind(doy).cirrus * (0.4 + 0.6 * Math.min(1, cover * 2)) * (1 - Math.min(1, rain * 2));
