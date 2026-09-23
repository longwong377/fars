"""Terrain pipeline (brief §5.2). Layers:
 1. Copernicus GLO-30 DSM (data/dem/*.tif) -> resampled into the Persepolis grid frame (tools/osm_to_grid.py frame).
 2. 'Bare earth' approximation: on low-slope ground, remove positive bumps (trees, buildings, the 1971 tent city)
    with a grey-scale opening (min then max filter), radius 110 m, applied where the 150 m-smoothed slope is < 3-6%. Tier C; logged in research/LANDSCAPE.md.
 3. Terrace and its foot: inside the terrace polygon (OSM, minus the Grand Stair recess) the ground is held at plain level,
    hidden under the platform; the platform is modelled as geometry by the architecture generators, so no terrain cliff pokes through the walls. A 25-90 m band outside the W/N/S walls is replaced by a harmonic
    (Laplace) infill from the surrounding plain, removing the DSM's smear of the terrace wall and modern spoil. Tier C.
 4. Rivers (Phase 7, D-037): the bare-earth filter fills the river channels, so the Pulvar and Kur channels are carved
    back under their plain.json courses. Bank-top level = bare-earth floodplain on the centreline, smoothed (sigma 200 m)
    and forced non-increasing downstream (running minimum); bed = bank - channel.bank_height_m. Every sample within
    (channel top width / 2 + one cell) of the centreline is lowered to bed - 0.3 m, so the terrain stays below the
    river corridor mesh drawn over it (src/world/plain/rivers.ts). The profile is written to public/generated/rivers.json.
    Tier C (course modern, level reconstruction).
 5. Naqsh-e Rustam (Phase 7): the ancient ground at the cliff foot lies at least 5 m below the present ground (NR-IRANICA),
    tapering to 0 at 250 m out (C); the ground in front of the cliff face line (plain.json naqsh_e_rustam.cliff) and two
    cells behind it is held at that ancient level, so the vertical face drawn by src/world/plain/naqsh.ts is not
    hidden by the 16 m heightfield's smoothed ramp. Tier C.
 6. Output rings (Uint16 heights, h = asl_min + q * step) + JSON metadata into public/generated/.
Validation spot checks: tests/terrain.test.ts, tests/plain.test.ts."""
import json, glob, numpy as np, rasterio
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_origin
from scipy import ndimage
from shapely.geometry import Polygon, Point
import shapely
from pyproj import CRS
from scipy.spatial import cKDTree
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
plain = json.load(open('src/data/plain.json'))
PF = {f['id']: f for f in plain['features']}


def base_ring(half, cell):
    """layers 1-3 for one ring: DSM resampled into the grid, bare earth, Terrace foot. Returns (h, GX, GY)."""
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
    return h, GX, GY


def bilinear(h, half, cell, x, y):
    """ring height at grid (x, y); row 0 = grid north"""
    return ndimage.map_coordinates(h, [(half - np.asarray(y, float)) / cell, (np.asarray(x, float) + half) / cell], order=1, mode='nearest')


def resample(poly, step):
    """polyline (list of [x, y]) resampled every `step` m along its length; returns (pts, s)"""
    p = np.asarray(poly, float); seg = np.hypot(*np.diff(p, axis=0).T); cum = np.concatenate([[0], np.cumsum(seg)])
    s_new = np.arange(0, cum[-1], step)
    return np.stack([np.interp(s_new, cum, p[:, 0]), np.interp(s_new, cum, p[:, 1])], 1), s_new


def river_profiles(rings_h):
    """Bank-top and bed levels along each river (layer 4). The parts of a course (clipped OSM pieces) are joined in order."""
    out = {}
    fh, fhalf, fcell = rings_h['far']; mh, mhalf, mcell = rings_h['mid']
    # far ring: an opening (r 240 m) removes riparian trees and villages that the 80 m average keeps (no bare-earth filter there)
    f_open = ndimage.grey_opening(fh, size=(7, 7))
    kur_course = np.asarray([pt for part in PF['river_kur']['polylines'] for pt in part], float)
    for rid in ('river_pulvar', 'river_kur'):
        f = PF[rid]; ch = f['channel']
        course = [pt for part in f['polylines'] for pt in part]
        if rid == 'river_pulvar':  # the OSM Pulvar line stops ~340 m short of the Kur: join it to the nearest point of the Kur (C)
            kd, _ = resample(kur_course, 5.0); j = int(np.argmin(np.hypot(*(kd - np.asarray(course[-1])).T))); course = course + [list(kd[j])]
        pts, sdist = resample(course, 20.0)
        zf = bilinear(f_open, fhalf, fcell, pts[:, 0], pts[:, 1])
        inmid = (np.abs(pts[:, 0]) < mhalf - 256) & (np.abs(pts[:, 1]) < mhalf - 256)
        zf[inmid] = bilinear(mh, mhalf, mcell, pts[inmid, 0], pts[inmid, 1])
        zs = ndimage.gaussian_filter1d(zf, sigma=200 / 20.0, mode='nearest')
        bank = np.minimum.accumulate(zs)  # non-increasing downstream, never above the smoothed floodplain
        out[rid] = {'pts': pts, 's': sdist, 'floodplain': zs, 'bank': bank, 'bed': bank - ch['bank_height_m'], 'channel': ch}
    # the Pulvar ends in the Kur: its last 1.5 km of bed converge on the Kur's level at the confluence (no step between surfaces)
    P, K = out['river_pulvar'], out['river_kur']
    end = P['pts'][-1]; ki = int(np.argmin(np.hypot(*(K['pts'] - end).T)))
    target = K['bank'][ki]; L = 1500.0; w = np.clip((P['s'] - (P['s'][-1] - L)) / L, 0, 1)
    P['bank'] = np.minimum.accumulate(P['bank'] * (1 - w) + np.minimum(P['bank'], target) * w)
    P['bed'] = P['bank'] - P['channel']['bank_height_m']
    return out


def top_width(ch):
    return ch['bed_width_m'] + 2 * ch['side_slope_h_per_v'] * ch['bank_height_m']


def carve_rivers(h, GX, GY, cell, prof):
    """lower every sample within (top/2 + cell) of a centreline below the bed (layer 4): 0.3 m, plus the bed's fall over one
    cell at 2 m/km, so the bilinear surface between samples stays under the channel even where the bed falls along the reach"""
    margin = 0.3 + 0.002 * cell * 2
    for rid, P in prof.items():
        rc = top_width(P['channel']) / 2 + cell
        dense, _ = resample(P['pts'], 4.0)
        bed_d = np.interp(np.linspace(0, len(P['pts']) - 1, len(dense)), np.arange(len(P['pts'])), P['bed'])
        tree = cKDTree(dense)
        x0, x1 = dense[:, 0].min() - rc, dense[:, 0].max() + rc; y0, y1 = dense[:, 1].min() - rc, dense[:, 1].max() + rc
        idx = np.nonzero((GX >= x0) & (GX <= x1) & (GY >= y0) & (GY <= y1))
        d, k = tree.query(np.stack([GX[idx], GY[idx]], 1), distance_upper_bound=rc)
        hit = np.isfinite(d)
        rr, cc = idx[0][hit], idx[1][hit]
        h[rr, cc] = np.minimum(h[rr, cc], bed_d[k[hit]] - margin)
        print(f'  carved {rid}: {hit.sum()} samples at {cell:.0f} m (radius {rc:.1f} m)')


def smooth01(t):
    t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)


def carve_naqsh(h, GX, GY, half, cell):
    """layer 5: the ancient ground in front of the Naqsh-e Rustam cliff; the face line and two cells behind it held there"""
    nr = plain['naqsh_e_rustam']; cl = nr['cliff']; ag = nr['ancient_ground']
    fy, (xa, xb) = cl['face_y'], cl['x_range']
    ramp = 2 * cell  # the carve fades out over two cells beyond the ends of the face line
    wx = np.clip(np.minimum(GX - (xa - ramp), (xb + ramp) - GX) / ramp, 0, 1)
    d = fy - GY  # metres in front (grid S) of the face line; negative = behind it
    # present ground at the foot: 30 m in front of the face (the DSM ramp of the smoothed cliff starts about there)
    foot = float(np.median(bilinear(h, half, cell, np.linspace(xa, xb, 40), np.full(40, fy - 30.0))))
    anc_foot = foot - ag['drop_at_foot_m']
    target = h - ag['drop_at_foot_m'] * (1 - smooth01(d / ag['taper_m']))
    target = np.where(d < 2 * cell, np.minimum(target, anc_foot + 0.02 * np.clip(d, 0, None)), target)  # the DSM's smeared cliff foot flattened
    target = np.where(d <= 0, anc_foot, target)  # two cells behind the face: inside the rock (under the cliff mesh's top), held low
    sel = (wx > 0) & (d > -2 * cell - 1) & (d < ag['taper_m'])
    h[sel] = np.minimum(h[sel], (wx * target + (1 - wx) * h)[sel])
    print(f'  Naqsh-e Rustam: present foot {foot:.1f} m, ancient foot {anc_foot:.1f} m asl; {sel.sum()} samples at {cell:.0f} m')
    return anc_foot


# layers 1-3 per ring
H = {}
for name, (half, cell) in rings.items():
    h, GX, GY = base_ring(half, cell)
    H[name] = (h, GX, GY, half, cell)
    print(name, 'base built')
# layer 4: river profiles from the base rings, then carve far and mid (the rivers stay > 3 km from the Apadana: outside the near ring)
prof = river_profiles({k: (v[0], v[3], v[4]) for k, v in H.items()})
for name in ('far', 'mid'):
    h, GX, GY, half, cell = H[name]
    carve_rivers(h, GX, GY, cell, prof)
# layer 5: Naqsh-e Rustam lies 6.2 km out, inside the mid ring only
anc_foot = carve_naqsh(H['mid'][0], H['mid'][1], H['mid'][2], H['mid'][3], H['mid'][4])
rivers_out = {'_meta': {'frame': 'Persepolis grid (x grid-east, y grid-north, m); levels m asl (true, no curvature)', 'step_m': 20.0,
                        'source': 'tools/build_terrain.py layer 4 (D-037); courses and channel parameters from src/data/plain.json', 'tier': 'C'},
              'naqsh_e_rustam': {'ancient_foot_asl': round(anc_foot, 2)}, 'rivers': {}}
for rid, P in prof.items():
    ch = P['channel']
    rivers_out['rivers'][rid] = {'top_width_m': round(top_width(ch), 2), 'carve_radius_m': {k: round(top_width(ch) / 2 + rings[k][1], 2) for k in ('far', 'mid')},
                                 'channel': {k: ch[k] for k in ('bed_width_m', 'side_slope_h_per_v', 'bank_height_m')},
                                 'x': [round(float(v), 1) for v in P['pts'][:, 0]], 'y': [round(float(v), 1) for v in P['pts'][:, 1]],
                                 'bank': [round(float(v), 2) for v in P['bank']], 'floodplain': [round(float(v), 2) for v in P['floodplain']]}
    dz = P['floodplain'] - P['bank']
    print(f'  {rid}: {len(P["pts"])} pts, bank {P["bank"][0]:.1f} -> {P["bank"][-1]:.1f} m, floodplain - bank: median {np.median(dz):.2f}, p95 {np.percentile(dz, 95):.2f}, max {dz.max():.2f} m')
json.dump(rivers_out, open('public/generated/rivers.json', 'w'))
# seam blending and output, coarse to fine (each finer ring blends into the final coarser one)
for name, (half, cell) in rings.items():
    h, GX, GY, _, _ = H[name]; n = h.shape[0]
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
