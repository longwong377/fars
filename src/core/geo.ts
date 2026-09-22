// Geodetic ↔ Persepolis grid ↔ world. Local ellipsoidal tangent approximation about the origin (Apadana OSM centroid);
// relative error < 2e-4 within 20 km — adequate for placement; data processing uses pyproj (tools/osm_to_grid.py).
export const ORIGIN_LAT = 29.9351174, ORIGIN_LON = 52.8894969, GRID_ROT_DEG = 19.0; // grid north = 341° true
const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f);
const lat0 = (ORIGIN_LAT * Math.PI) / 180;
const Mr = (a * (1 - e2)) / Math.pow(1 - e2 * Math.sin(lat0) ** 2, 1.5); // meridian radius
const Nr = a / Math.sqrt(1 - e2 * Math.sin(lat0) ** 2); // prime vertical radius
export function latLonToGrid(lat: number, lon: number): [number, number] {
  const e = ((lon - ORIGIN_LON) * Math.PI) / 180 * Nr * Math.cos(lat0);
  const n = ((lat - ORIGIN_LAT) * Math.PI) / 180 * Mr;
  const r = (-GRID_ROT_DEG * Math.PI) / 180; // grid = rotate(true, −19°)
  return [e * Math.cos(r) - n * Math.sin(r), e * Math.sin(r) + n * Math.cos(r)];
}
export function gridToLatLon(east: number, north: number): [number, number] {
  const r = (GRID_ROT_DEG * Math.PI) / 180;
  const e = east * Math.cos(r) - north * Math.sin(r), n = east * Math.sin(r) + north * Math.cos(r);
  return [ORIGIN_LAT + (n / Mr) * (180 / Math.PI), ORIGIN_LON + (e / (Nr * Math.cos(lat0))) * (180 / Math.PI)];
}
/** distance (m) and true bearing (deg) between two lat/lon points (derived from coordinates, brief §5.2.4) */
export function distanceBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371008.8, p1 = (lat1 * Math.PI) / 180, p2 = (lat2 * Math.PI) / 180, dl = ((lon2 - lon1) * Math.PI) / 180;
  const d = 2 * R * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2));
  const b = (Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) * 180) / Math.PI;
  return { distance: d, bearing: (b + 360) % 360 };
}
