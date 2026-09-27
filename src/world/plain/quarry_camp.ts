// The quarry camp's huts (B80, session 10): pure data shared by the builder (quarries.ts) and the quarrymen (world/traffic.ts).
/** B80 (session 10): the quarry camp's huts, where the fourteen men of the Majdabad quarry sleep from October to April and
 *  shelter from rain: three dry-stone huts below the camp, E of the sledge's way out (the quarry's own spoil, laid without mortar), roofed with rough slabs
 *  under earth, a doorway facing the camp (C: quarry and shepherd shelters of the Zagros; stone is what a quarry has). In the
 *  site's frame (u along the face, v downhill): centres, outer size 4.4 x 3.8 m, walls 0.55 m, inner height 1.95 m, the door
 *  0.9 m wide in the uphill wall (-v). Only at the working quarry (the drums come from Majdabad: traffic.ts) */
export const QUARRY_HUTS = { at: [[3.5, 32], [9.5, 31.5], [15.5, 31]] as [number, number][], w: 4.4, d: 3.8, wall: 0.55, h: 1.95, door: 0.9, site: 'quarry_majdabad' } as const;
/** the sleeping places inside the huts (site frame u, v), one per quarryman: five, five and four along the inner walls */
export function hutSleepSpot(i: number): [number, number] {
  const H = QUARRY_HUTS, k = i % 3, j = Math.floor(i / 3), [cu, cv] = H.at[k], iw = H.w - 2 * H.wall, id = H.d - 2 * H.wall;
  // two rows (the side walls), heads to the wall, the last man across the back
  const u = j < 4 ? cu + (j % 2 ? 1 : -1) * (iw / 2 - 0.45) : cu, v = j < 4 ? cv - id / 2 + 0.55 + 0.75 * Math.floor(j / 2) + 0.4 : cv + id / 2 - 0.45;
  return [u, v];
}
