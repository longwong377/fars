// The 22° halo and the sun dogs (session 9; WORLD_INVENTORY G10, A physics): light refracted through the hexagonal ice
// crystals of thin cirrus. The ring lies 22° from the sun (the minimum deviation of a 60° ice prism: 21.8°), sharp and
// reddish on its inside, white and fading outward; the sun dogs (parhelia) sit on the sun's own altitude beside the ring,
// farther out as the sun climbs (plate crystals falling flat), coloured red toward the sun with a white tail away from it,
// and fade out above ~50° of sun. No cirrus layer is modelled apart: a day with thin, broken cover and no rain carries
// cirrostratus on a share of days (C), drawn by the sky dome's shader (skySystem.ts) as a brightening of the dome.
import { Rng } from '../core/rng';

/** the ring's radius (deg) by colour: the inner edge red, blue a little farther out (ice dispersion, C) */
export const HALO_R = { r: 21.9, g: 22.2, b: 22.5 } as const;
/** the sun dog's distance from the sun (deg) along the parhelic circle at sun altitude `alt` (deg): 22° at the horizon,
 *  ~23.5° at 20°, ~29° at 40° (a fit to the minimum-deviation geometry of flat plates; C) */
export const parhelionDistance = (alt: number) => 22 + 0.0045 * alt * alt;
/** the ring's relative brightness at `deg` from the sun for ring radius `c`: steep inside, slow fall outside */
export const ringProfile = (deg: number, c: number) => Math.exp(-(((deg - c) / (deg < c ? 0.35 : 1.6)) ** 2));
/** the share of days with a halo-bearing cirrus veil among the days of thin, broken, dry cover (C) */
export const HALO_DAY_SHARE = 0.4;
/** how strong the halo is today (0-1): thin broken cover (0.15-0.65), no rain, and the day is a cirrus day; the sun up */
export function haloAmount(seed: number, dayIndex: number, cloud: number, rain: number, sunAlt: number): number {
  if (rain > 0.02 || sunAlt < 1 || cloud < 0.15 || cloud > 0.65) return 0;
  if (new Rng(seed >>> 0, `halo:${dayIndex}`).next() >= HALO_DAY_SHARE) return 0;
  const veil = Math.min(1, (cloud - 0.15) / 0.15, (0.65 - cloud) / 0.15);
  return veil * Math.min(1, sunAlt / 5);
}
