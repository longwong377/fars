"""Terrain pipeline (brief §5.2). Layers:
 1. Copernicus GLO-30 DSM (data/dem/*.tif) -> resampled into the Persepolis grid frame (tools/osm_to_grid.py frame).
 2. 'Bare earth' approximation: on low-slope ground, remove positive bumps (trees, buildings, the 1971 tent city)
    with a grey-scale opening (min then max filter), radius 110 m, applied where the 150 m-smoothed slope is < 3-6%. Tier C; logged in research/LANDSCAPE.md.
 3. Terrace and its foot: inside the terrace polygon (OSM, minus the Grand Stair recess) the ground is held at plain level,
    hidden under the platform; the platform is modelled as geometry by the architecture generators, so no terrain cliff pokes through the walls. A 25-90 m band outside the W/N/S walls is replaced by a harmonic
    (Laplace) infill from the surrounding plain, removing the DSM's smear of the terrace wall and modern spoil. Tier C.
 4. Output rings (Uint16 heights, h = asl_min + q * step) + JSON metadata into public/generated/.
Validation spot checks: tests/terrain.test.ts."""
import json, glob, numpy as np, rasterio
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_origin
from scipy import ndimage
from shapely.geometry import Polygon, Point
import shapely
from pyproj import CRS
import os
LAT0, LON0, ROT = 29.9351174, 52.8894969, 19.0
spec = json.load(open('src/data/site_spec.json'))
COURT = spec['global']['court_asl']['v']
fp = json.load(open('src/data/geo/footprints.json'))
terr = Polygon(fp['terrace']['polygon'])
stair = Polygon(fp['grand_stair']['polygon'])
terr_platform = terr.difference(stair)  # the Grand Stair is recessed into the W wall: ground under it is the plain (SITE_SPEC terrace.stair_recess)
# CRS: oblique transverse mercator is not needed; use tmerc then rotate grid by sampling rotated coordinates.
tm = CRS.from_proj4(f"+proj=tmerc +lat_0={LAT0} +lon_0={LON0} +k=1 +x_0=0 +y_0=0 +ellps=WGS84")
tifs = sorted(glob.glob('data/dem/Copernicus_DSM_COG_10_*_DEM.tif'))
assert tifs, 'no DEM tiles in data/dem (see NEEDS_FROM_ME.md)'
from rasterio.merge import merge
srcs = [rasterio.open(t) for t in tifs]
mosaic, mtrans = merge(srcs)
mosaic = mosaic[0].astype(np.float32)
src_crs = srcs[0].crs
rings = {  # name: (half-size m, cell m) — built coarse to fine so finer rings can blend their edges into the coarser one
    'far': (71680, 80.0),  # ±71.7 km: the ranges 55-66 km away at 150-160, 230-250 and 270-290 deg true rise above the 41 km skyline (Q-053)
    'mid': (10240, 16.0),
    'near': (2048, 4.0),
}
built = {}
os.makedirs('public/generated', exist_ok=True)
meta = {'frame': 'Persepolis grid (x grid-east, y grid-north), origin Apadana centroid', 'court_asl': COURT, 'rings': {}}
c, s = np.cos(np.radians(ROT)), np.sin(np.radians(ROT))
for name, (half, cell) in rings.items():
    n = int(2 * half / cell) + 1
    # sample on a tm grid big enough to contain the rotated square, then rotate-sample
    big = half * 1.42 + cell * 2
    nb = int(2 * big / cell) + 1
    dst = np.zeros((nb, nb), np.float32)
    reproject(mosaic, dst, src_transform=mtrans, src_crs=src_crs, dst_transform=from_origin(-big, big, cell, cell),
              dst_crs=tm, resampling=Resampling.cubic if cell < 30 else Resampling.average)
    # grid coords -> tm coords: tm = R(+19deg ccw?) grid. grid was obtained by rotating tm by -19 deg, so tm = rotate(grid, +19)
    gx = np.linspace(-half, half, n); gy = np.linspace(half, -half, n)
    GX, GY = np.meshgrid(gx, gy)
    TX = GX * c - GY * s; TY = GX * s + GY * c
    col = (TX + big) / cell; row = (big - TY) / cell
    h = ndimage.map_coordinates(dst, [row, col], order=1, mode='nearest').astype(np.float32)
    # layer 2: bare-earth opening on low slope
    r = max(1, int(round(110 / cell)))
    if cell <= 16:
        # alternating sequential filter: opening removes bumps (trees, buildings), closing fills ditches (modern canals, road cuts)
        opened = ndimage.grey_opening(h, size=(2 * r + 1, 2 * r + 1))
        opened = ndimage.grey_closing(opened, size=(2 * r + 1, 2 * r + 1))
        opened = ndimage.gaussian_filter(opened, sigma=max(1, r / 1.5))
        gyy, gxx = np.gradient(ndimage.gaussian_filter(h, sigma=max(1, 150 / cell)), cell)  # regional slope, so tree/building edges don't count as 'steep'
        slope = np.hypot(gxx, gyy)
        w = np.clip((0.06 - slope) / 0.03, 0, 1)  # full bare-earth where regional slope < 3% (alluvial plain), none > 6% (mountain kept)
        hs = ndimage.gaussian_filter(h, sigma=max(1, 300 / cell))
        w *= np.clip((1660.0 - hs) / 30.0, 0, 1)  # only on the valley floor: ridge crests have ~0 regional slope but must not be flattened
        h = w * opened + (1 - w) * h
    # layer 3: terrace + foot
    if cell <= 16:
        inside = shapely.contains_xy(terr_platform, GX, GY)
        foot = shapely.contains_xy(terr.buffer(90), GX, GY) & ~inside
        # harmonic infill of the foot band west/north/south where ground is below court (east side is mountain: keep)
        mountain = (h > COURT + 2.0) & (GX > 100)  # E side: terrace abuts Kuh-e Rahmat, keep DSM
        band = foot & ~mountain
        ring = shapely.contains_xy(terr.buffer(160), GX, GY) & ~shapely.contains_xy(terr.buffer(90), GX, GY) & (GX < 100)
        plain_ref = float(np.median(h[ring]))
        hh = h.copy()
        known = ~band
        hh[band] = plain_ref  # seed with the W plain level: Jacobi converges slowly, so start close to the answer
        hh[inside] = plain_ref  # Dirichlet under the platform: the foot interpolates plain-to-plain, no DSM terrace smear or mountain leaks in
        for _ in range(3000 if cell < 8 else 400):
            avg = 0.25 * (np.roll(hh, 1, 0) + np.roll(hh, -1, 0) + np.roll(hh, 1, 1) + np.roll(hh, -1, 1))
            hh[band] = avg[band]
        h = hh
        under_stair = shapely.contains_xy(stair.buffer(0.5), GX, GY)
        h[under_stair] = np.minimum(h[under_stair], COURT - 12.0 - 0.3)  # below the stair's plain-level pavement (plain_at_stair = court - 12)
        h[inside] = np.minimum(h[inside], COURT - 1.0)  # hidden under the platform (top = court): the platform geometry alone forms the retaining walls
    # seam blending (C0 continuity between rings): over the outer 12 cells, fade toward the next-coarser ring
    coarser = {'mid': 'far', 'near': 'mid'}.get(name)
    if coarser:
        ch, chalf, ccell = built[coarser]
        cn = ch.shape[0]
        col = (GX + chalf) / ccell; row = (chalf - GY) / ccell
        hc = ndimage.map_coordinates(ch, [row, col], order=1, mode='nearest')
        dist_edge = np.minimum(np.minimum(GX + half, half - GX), np.minimum(GY + half, half - GY)) / cell
        wb = np.clip((dist_edge - 1) / 11.0, 0, 1); wb = wb * wb * (3 - 2 * wb)
        h = wb * h + (1 - wb) * hc
    built[name] = (h.astype(np.float32), half, cell)
    lo = float(np.floor(h.min())); step = max(0.01, round((float(h.max()) - lo) / 65000 + 0.0005, 3))
    q = np.clip(np.round((h - lo) / step), 0, 65535).astype('<u2')
    q.tofile(f'public/generated/terrain_{name}.u16')
    meta['rings'][name] = {'half': half, 'cell': cell, 'n': n, 'asl_min': lo, 'step': step, 'file': f'generated/terrain_{name}.u16',
                           'min': float(h.min()), 'max': float(h.max())}
    print(name, n, 'x', n, 'range', round(float(h.min()), 1), round(float(h.max()), 1), 'step', step)
json.dump(meta, open('public/generated/terrain.json', 'w'), indent=1)
