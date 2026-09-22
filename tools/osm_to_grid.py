"""Convert OSM/Overture/Pleiades footprints (WGS84) into the Persepolis grid frame.
Grid frame: origin = Apadana OSM centroid (29.9351174N, 52.8894969E; research/_extract_B.md G-1),
+x = grid east, +y = grid north, grid north = 341.0 deg true (rotated 19 deg W of true north; _extract_B G-3).
Transverse Mercator centred on the origin (scale error < 1e-6 within 1 km)."""
import json, sys, shapely.geometry as sg, shapely.affinity as sa
from shapely.ops import transform
from pyproj import Transformer
LAT0, LON0, GRID_ROT = 29.9351174, 52.8894969, 19.0
T = Transformer.from_crs(4326, f"+proj=tmerc +lat_0={LAT0} +lon_0={LON0} +k=1 +x_0=0 +y_0=0 +ellps=WGS84", always_xy=True)
def to_grid(geom):
    g = transform(lambda x, y, z=None: T.transform(x, y), geom)
    return sa.rotate(g, -GRID_ROT, origin=(0, 0))
NAMES = {  # OSM name (fa) -> our id
 'کاخ آپادانا':'apadana','دروازه ملل':'gate_nations','پلکان ملل':'grand_stair','کاخ تچر':'tachara','کاخ هدیش':'hadish',
 'تالار ۱۰۰ ستون':'hall100','کاخ سه در':'tripylon','خزانه شاهی':'treasury','کاخ ملکه':'harem','درب ناتمام':'unfinished_gate',
 'کاخ اردشیر اول':'palace_h','کاخ اردشیر سوم':'palace_a3_osm','نگهبانخانه و تالار ۳۲ ستون':'garrison','آرامگاه اردشیر دوم':'tomb_a2',
 'موزه تخت جمشید':'museum_modern'}
out = {}
fc = json.load(open('data/osm/overture_buildings_persepolis.geojson'))
for f in fc['features']:
    n = f['properties']['name']; cls = f['properties']['class']
    key = NAMES.get(n) or ('modern_roof_' + f['properties']['id'][:6] if cls == 'roof' else None)
    if not key: continue
    g = to_grid(sg.shape(f['geometry']))
    if g.geom_type == 'MultiPolygon': g = max(g.geoms, key=lambda p: p.area)
    out[key] = {'osm_name': n, 'overture_id': f['properties']['id'], 'polygon': [[round(x, 2), round(y, 2)] for x, y in g.exterior.coords],
                'bounds': [round(v, 2) for v in g.bounds], 'area': round(g.area, 1), 'centroid': [round(g.centroid.x, 2), round(g.centroid.y, 2)]}
p = json.load(open('data/osm/pleiades_922695.geojson'))
for feat in p['features']:
    geom = sg.shape(feat['geometry'])
    if geom.geom_type in ('LineString', 'Polygon'):
        poly = sg.Polygon(geom.coords if geom.geom_type == 'LineString' else geom.exterior.coords)
        g = to_grid(poly)
        out['terrace'] = {'osm_name': 'Pleiades 922695 outline', 'polygon': [[round(x, 2), round(y, 2)] for x, y in g.exterior.coords],
                          'bounds': [round(v, 2) for v in g.bounds], 'area': round(g.area, 1), 'centroid': [round(g.centroid.x, 2), round(g.centroid.y, 2)]}
json.dump({'_meta': {'frame': 'Persepolis grid; origin Apadana OSM centroid 29.9351174N 52.8894969E; grid north 341 deg true',
                     'licence': 'OpenStreetMap contributors (ODbL) via Overture Maps 2026-08-19.0 and Pleiades (CC-BY) mirror ryanfb/pleiades-geojson',
                     'tier': 'B (modern ruin footprints traced from imagery)'}, **out}, open('src/data/geo/footprints.json', 'w'), indent=1)
for k, v in out.items(): print(f"{k:18s} bounds={v['bounds']} area={v['area']}")
