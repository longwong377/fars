// Phase 4 walkthrough routes (grid east, north): shared by the e2e bot and tools/dev/routecheck.ts
export const ROUTES: Record<string, { start: [number, number]; targets: [number, number, string][]; levels: Record<string, number> }> = {
  tachara: { start: [-2, -104], levels: { 'Tachara hall': 2.6, 'W room (W2)': 2.6, 'W room (W1)': 2.6, 'Tachara N room': 2.6, 'NE room': 2.6, 'E room (E2)': 2.6 }, targets: [
    [-21, -107, 'Tachara S court'], [-37.5, -100.1, 'W flight foot'], [-21, -100.3, 'central landing'], [-21.5, -95.9, 'portico'],
    [-21.5, -89.3, 'S doorway'], [-21.6, -82.7, 'Tachara hall'],
    // the W rooms through the lance-bearer doorways (D-130), and W3 through its narrow opening from W2
    [-30.25, -82.8, 'W doorway (S): lance-bearers'], [-33, -81, 'W room (W2)'], [-33.8, -86.9, 'W3, through the opening from W2'], [-33, -81, 'W2 again'],
    [-27.9, -78.8, 'hall, W aisle'], [-30.25, -74.95, 'W doorway (N): lance-bearers'], [-33, -75, 'W room (W1)'],
    // the two four-column N rooms, E1 behind the NE room, and E2 through the E doorway
    [-24.9, -76, 'hall, N aisle'], [-24.9, -72.1, 'N doorway (W)'], [-27.95, -65.65, 'Tachara N room'], [-24.9, -76, 'back in the hall'],
    [-18.25, -72.1, 'N doorway (E)'], [-15.25, -65.65, 'NE room'], [-10.4, -74.4, 'E1, through the NE room'], [-11.9, -70, 'NE room again'],
    [-18.25, -76, 'hall again'], [-12.85, -82.7, 'E doorway'], [-10, -80.5, 'E room (E2)'], [-15.2, -82.7, 'hall, E aisle'],
    [-21.5, -95.9, 'portico again'], [-4.5, -100.1, 'down the E flight'], [-2, -106, 'S court E'] ] },
  hadish: { start: [-12, -110], levels: { 'Hadish N court': 6.0, 'Hadish hall': 6.0 }, targets: [
    [-9, -123, 'W court'], [-6.2, -123, 'W stair entry (centre, side-on to the two lowest steps)'], [-3.8, -122.6, 'W stair: onto the N lower flight'], [-3.8, -116, 'W stair: N lower flight → landing'], [1.2, -122.5, 'W stair: N upper flight → top'],
    [20, -120, 'Hadish N court'], [22, -137.5, 'portico'], [16, -145, 'N doorway (W)'], [22, -159.5, 'Hadish hall'],
    [22, -174, 'S doorway'], [22, -178.5, 'S balcony'], [22, -159.5, 'hall again'], [36.5, -159.5, 'E doorway'], [44, -150, 'E apartment side'],
    [45, -120.5, 'E stair top'], [52.8, -114.2, 'E stair: upper flight down → N landing'], [57.5, -121, 'E stair: lower flight down'], [63, -121, 'E court'] ] },
  tripylon: { start: [82, -40], levels: { 'Tripylon hall': 2.6, 'Tripylon S court': 2.6 }, targets: [
    [66, -49.5, 'N stair W foot'], [82, -49, 'N central landing'], [82, -53, 'stair-head terrace'], [82, -62.5, 'N doorway'],
    [79, -72.7, 'Tripylon hall'], [82, -82.5, 'S doorway'], [82, -96, 'Tripylon S court'], [82, -111, 'S stair down'],
    [82, -96, 'S stair up'], [79, -72.7, 'hall again'], [90.5, -72.2, 'E doorway'], [96, -72.2, 'E corridor'], [101, -68, 'narrow stair head'],
    [101, -56, 'narrow stair foot'], [105, -50, 'passage'] ] },
  hall100: { start: [146, 45], levels: { 'Hall 100 portico': 0.5, 'Hall 100 hall': 0.5 }, targets: [
    [146, 29, 'step band'], [146, 17.5, 'Hall 100 portico'], [133.9, 5, 'N doorway'], [140, -29, 'Hall 100 hall'],
    [110.5, -16.5, 'W doorway'], [107, -16.5, 'W threshold down'], [110.5, -16.5, 'W threshold up'], [140, -29, 'hall again'],
    [158.9, -64.5, 'S doorway'], [158.9, -70, 'street'], [186, -41.5, 'outside the E doorway'], [175, -35, 'inside via E doorway'] ] },
  treasury: { start: [170, -71], levels: { 'Treasury inside': 0.3 }, targets: [
    [206.6, -74, 'street at the Treasury N door'], [206.6, -82, 'N doorway'], [199.7, -82.8, 'N-range vestibule'], [184.5, -88.5, 'court S of the N range'],
    [187.8, -82.6, "scribes' room (D-067)"], [184.5, -88.5, "out of the scribes' room"], [190, -120, 'Treasury inside'], [150, -150, 'Treasury SW'],
    [206.6, -82, 'back to the N doorway'], [201.8, -70, 'street'], [201.8, -60, 'garrison S door'], [200, -20, 'garrison court'],
    [183.3, 32, 'garrison W door'], [175, 33, 'court N of Hall 100'] ] },
  harem: { start: [109.5, -68], levels: { 'Harem court': 1.0, 'Harem hall': 1.0 }, targets: [
    [109.5, -76, 'N entrance steps'], [114, -118, 'Harem court'], [113.25, -129.5, 'portico'], [114.8, -134, 'N doorway'],
    [114.75, -142.5, 'Harem hall'], [105.5, -142.5, 'W doorway'], [114.75, -142.5, 'hall again'], [114, -118, 'court again'],
    [101, -114, 'W entrance'], [94, -114, 'outside W'] ] },
};

// the Phase 3 slice route (plain → Grand Stair → Gate → Apadana hall → back): tests/e2e/walkthrough.spec.ts, and offline with
// `npx tsx tools/dev/botcheck.ts slice` (D-052)
export const SLICE: { start: [number, number]; targets: [number, number, string][]; levels: Record<string, number> } = { start: [-175, 122.45], levels: {}, targets: [
  [-60, 122.5, 'stair foot court'], [-43.9, 153, 'N lower flight → outer landing'], [-36.4, 150, 'N upper flight'], [-36.4, 124.6, 'top landing'],
  [-20, 124.6, 'Gate W door'], [0.1, 124.6, 'inside the Gate'], [18, 124.6, 'Gate E door'], [0.1, 124.6, 'back inside'], [0.1, 100, 'Gate S door'],
  [0, 80, 'forecourt'], [-24, 55.5, 'Apadana N stair, W wing'], [-15.4, 45, 'N portico'], [1.9, 20, 'hall N door'], [1.9, -4.9, 'hall centre'],
  [26, -4.9, 'hall E door'], [40, -4.9, 'E portico'], [1.9, -4.9, 'back to the centre'], [-26, -4.9, 'hall W door'], [-40, -4.9, 'W portico'],
  [1.9, 40, 'N portico again'], [30, 55.5, 'Apadana N stair, E wing'], [48, 62, 'court E of the stair'], [-30, 100, 'court W'],
  [-36.4, 112, 'S head'], [-36.4, 96, 'S upper flight'], [-43.9, 92, 'S outer landing'], [-43.9, 116, 'S lower flight'], [-80, 122.5, 'plain'],
] };

/** H workstream (audit D M2): beyond the Terrace. Grid (east, north) waypoints, walked straight between them.
 *  - town: a lane of the quarter Persepolis West A (q_w1) through the street door (a full metre wide) of house q_w1-0004
 *    into its court: the town's lane graph route (settlement/walk.ts TownWalk.route) pushed to the lanes' middles (the raw
 *    route grazes wall corners and a walled prop: the controller stops there), checked offline with the people present;
 *  - plain: the fields W of the stair foot (the old near-ring collider covered them; no seam);
 *  - mountain: up Kuh-e Rahmat eastward across e 1,984 and 2,048 m, where the old terrain collider switched rings while
 *    the drawing did not (audit D M1: 12 of 24 crossings fell). */
export const BEYOND: Record<'town' | 'plain' | 'mountain', { start: [number, number]; targets: [number, number, string][] }> = {
  town: { start: [-484.88, 423.72], targets: [[-484.25, 414.74, 'lane'], [-483.18, 413.82, 'lane'], [-482.28, 400.85, 'lane'], [-481.09, 383.89, 'lane'], [-480.53, 375.91, 'lane'],
    [-480.32, 372.92, 'lane'], [-481.25, 371.85, 'lane S'], [-489.78, 362.04, 'lane'], [-490.44, 361.29, 'lane'], [-491.39, 359.11, 'lane corner'], [-492.32, 358.05, 'lane'], [-501.29, 357.42, 'lane'],
    [-518.25, 356.23, 'lane'], [-530.22, 355.4, 'lane'], [-531.22, 355.33, 'lane'], [-532.29, 356.25, 'before the door'], [-532.36, 357.25, 'street door of q_w1-0004'], [-534.35, 357.11, 'the court of q_w1-0004']] },
  plain: { start: [-600, 122.45], targets: [[-640, 170, 'field NW'], [-690, 215, 'field'], [-720, 260, 'field N']] },
  mountain: { start: [1900, -300], targets: [[1960, -300, 'slope'], [2000, -300, 'across e 1,984'], [2070, -300, 'across e 2,048'], [2150, -300, 'mountain, mid ring']] },
};
