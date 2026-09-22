"""Independent elevation reference for terrain spot checks (review MJ-4): AWS Terrain Tiles (Tilezen/Mapzen 'terrarium',
SRTM-derived in this region; s3://elevation-tiles-prod, public), independent of the Copernicus GLO-30 DSM used to build
the terrain. Samples fixed points (plain, foothills, mountain, Naqsh-e Rustam) at zoom 14 (~9 m/px) and writes
tests/data/srtm_points.json."""
import math, urllib.request, io, json
from PIL import Image
POINTS = []
# deterministic grid of points across the plain and mountains around the site (lat/lon), skipping the Terrace itself
for i, lat in enumerate([29.90, 29.915, 29.93, 29.945, 29.96, 29.975]):
    for j, lon in enumerate([52.84, 52.86, 52.875, 52.905, 52.92, 52.94]):
        POINTS.append((f'g{i}{j}', lat, lon))
POINTS += [('plainW', 29.9360, 52.8845), ('rahmat_crest', 29.9457, 52.9133), ('naqsh_foot', 29.9889, 52.8747)]
cache = {}
def elev(lat, lon, z=14):
    n = 2 ** z; x = (lon + 180) / 360 * n; y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    tx, ty = int(x), int(y)
    if (tx, ty) not in cache:
        url = f'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{tx}/{ty}.png'
        cache[(tx, ty)] = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=30).read())).convert('RGB')
    im = cache[(tx, ty)]; px = min(255, int((x - tx) * 256)); py = min(255, int((y - ty) * 256))
    r, g, b = im.getpixel((px, py)); return r * 256 + g + b / 256 - 32768
import glob, rasterio
from rasterio.merge import merge
m, tr = merge([rasterio.open(t) for t in sorted(glob.glob('data/dem/*.tif'))]); m = m[0]; inv = ~tr
def raw(lat, lon): c, r = inv * (lon, lat); return round(float(m[int(r), int(c)]), 1)
out = [{'id': k, 'lat': la, 'lon': lo, 'h': round(elev(la, lo), 1), 'copernicus_raw': raw(la, lo)} for k, la, lo in POINTS]
json.dump({'source': 'AWS Terrain Tiles (terrarium, zoom 14), SRTM-derived; s3://elevation-tiles-prod; fetched by tools/fetch_srtm_points.py', 'points': out}, open('tests/data/srtm_points.json', 'w'), indent=0)
print(len(out))
