"""§8.1 calibration scene (D-230): the camera of photograph #24 (references/INDEX.md §6; the Terrace W wall from the plain,
EXIF 2019-02-08 15:59:34, Olympus E-M1 II at 14 mm, Lightroom-cropped to 1500 x 905) solved against the model's own geometry:
six corner correspondences on the Terrace outline (src/data/geo/footprints.json: the Apadana salient's NW corner top and foot,
the far end of its N face, its SW corner, the wall's far end top and foot) and the mountain skyline traced on the photo
(sky/land boundary every 10 px) against the DEM horizon (public/generated/terrain_*.u16, curvature with k = 0.13).
Unknowns: grid position (east, north; the eye 1.6 m above the DEM), true azimuth, pitch, focal length (the crop is unknown)
and roll. Writes the overlay (skyline and outline over the photo) to shots/calib24_overlay.png.
Run: python3 tools/dev/calib24_camera.py        (needs numpy, scipy, Pillow)
"""
import json, math
import numpy as np
from PIL import Image, ImageDraw
from scipy.optimize import least_squares

PHOTO = 'references/persepolis and the mountain behind the ruins 2.webp'
W, H = 1500, 905
R, K = 6371000.0, 0.13
meta = json.load(open('public/generated/terrain.json'))
rings = {}
for k in ('near', 'mid', 'far'):
    m = meta['rings'][k]
    raw = np.fromfile('public/' + m['file'], dtype=np.uint16).reshape(m['n'], m['n']).astype(np.float64)
    rings[k] = (m, raw * m['step'] + m['asl_min'] - meta['court_asl'])  # true height above the court datum


def h_vec(e, n):
    e = np.atleast_1d(np.asarray(e, float)); n = np.atleast_1d(np.asarray(n, float)); x, z = e, -n
    out = np.full(e.shape, np.nan)
    for k, marg in (('near', 8), ('mid', 32), ('far', 0)):
        m, Hh = rings[k]; hf = m['half'] - marg
        sel = np.isnan(out) & (((np.abs(x) <= hf) & (np.abs(z) <= hf)) | (k == 'far'))
        if not sel.any(): continue
        gx, gy = (x[sel] + m['half']) / m['cell'], (z[sel] + m['half']) / m['cell']
        c0 = np.clip(np.floor(gx).astype(int), 0, m['n'] - 2); r0 = np.clip(np.floor(gy).astype(int), 0, m['n'] - 2)
        fx, fy = np.clip(gx - c0, 0, 1), np.clip(gy - r0, 0, 1)
        out[sel] = (Hh[r0, c0] * (1 - fx) + Hh[r0, c0 + 1] * fx) * (1 - fy) + (Hh[r0 + 1, c0] * (1 - fx) + Hh[r0 + 1, c0 + 1] * fx) * fy
    return out


class Cam:
    """pinhole camera in the grid frame (east, north, up), true azimuth (grid north = 341° true), pitch and roll in degrees"""
    def __init__(s, e, n, eye, az, pitch, f, roll=0.0, w=W, h=H):
        s.e, s.n, s.z = e, n, float(h_vec(e, n)[0]) + eye
        s.f, s.cx, s.cy = f, w / 2, h / 2
        a, p = math.radians(az - 341.0), math.radians(pitch)
        s.fwd = np.array([math.sin(a) * math.cos(p), math.cos(a) * math.cos(p), math.sin(p)])
        r0 = np.array([math.cos(a), -math.sin(a), 0.0]); u0 = np.cross(r0, s.fwd); q = math.radians(roll)
        s.right, s.up = r0 * math.cos(q) + u0 * math.sin(q), -r0 * math.sin(q) + u0 * math.cos(q)

    def proj(s, e, n, z):
        d = np.array([e - s.e, n - s.n, z - s.z], float); d[2] -= (d[0] ** 2 + d[1] ** 2) * (1 - K) / (2 * R)
        zc = d @ s.fwd
        return None if zc <= 0.1 else (s.cx + s.f * (d @ s.right) / zc, s.cy - s.f * (d @ s.up) / zc)

    def ray(s, u, v):
        return np.outer(u - s.cx, s.right) + np.outer(-(v - s.cy), s.up) + s.f * s.fwd


DIST = np.geomspace(60, 40000, 900)
AZ = np.arange(0, 360, 0.1)


def pano(e, n, zc):
    a = np.radians(AZ - 341.0)[:, None]; E, N = e + np.sin(a) * DIST, n + np.cos(a) * DIST
    Z = h_vec(E.ravel(), N.ravel()).reshape(E.shape) - DIST ** 2 * (1 - K) / (2 * R) - zc
    return np.max(np.arctan2(Z, DIST), axis=1)


def photo_skyline():
    im = np.asarray(Image.open(PHOTO).convert('RGB')).astype(float); r, b = im[..., 0], im[..., 2]
    land = ((r - b) > 10) & (r < 180)  # brown rock; the sunlit clouds are warm too but brighter
    out = []
    for x in range(0, W, 10):
        y = next((y for y in range(300, H) if land[y:y + 8, x].all()), None)
        if y is not None: out.append((x, y))
    return np.array(out, float)


# (east, north, height above the court or 'g' = the DEM at that point) -> photo pixel, read on 4x crops
CORNERS = [((-61.45, 59.71, 0), (187, 491)), ((-61.45, 59.71, 'g'), (187, 668)), ((-47.08, 59.66, 0), (117, 502)),
           ((-61.5, -70.77, 0), (1085, 565)), ((-52.51, -158.4, 0), (1318, 586)), ((-52.51, -158.4, 'g'), (1318, 660))]


def solve(eye=1.6):
    P = [((e, n, float(h_vec(e, n)[0]) if z == 'g' else z), uv) for (e, n, z), uv in CORNERS]
    sky = photo_skyline(); cache = {}

    def res(p):
        e, n, az, pitch, f, roll = p
        c = Cam(e, n, eye, az, pitch, f, roll)
        rc = []
        for X, uv in P:
            q = c.proj(*X); rc += [1e3, 1e3] if q is None else [q[0] - uv[0], q[1] - uv[1]]
        key = (round(e), round(n))
        if key not in cache: cache[key] = pano(e, n, c.z)
        vs = np.arange(250, 750, 1.0); rs = []
        for u, yo in sky:
            d = c.ray(np.full(vs.shape, u), vs)
            az_r = (341 + np.degrees(np.arctan2(d[:, 0], d[:, 1]))) % 360
            above = np.arctan2(d[:, 2], np.hypot(d[:, 0], d[:, 1])) > np.interp(az_r, AZ, cache[key])
            rs.append(vs[np.argmin(above) if not above.all() else -1] - yo)
        rs = np.array(rs); soft = np.sign(rs) * np.sqrt(10 * (np.sqrt(1 + (rs / 5) ** 2) - 1))
        return np.concatenate([rc, 0.5 * soft]), np.array(rc), rs

    x0 = [-182.25, 123.9, 117.53, 6.5, 1662.2, 0.66]  # from the corners alone
    r = least_squares(lambda p: res(p)[0], x0, diff_step=[1e-3, 1e-3, 1e-4, 1e-3, 1e-4, 1e-3],
                      bounds=([-3000, -3000, 0, -10, 600, -5], [0, 3000, 360, 30, 3000, 5]))
    _, rc, rs = res(r.x)
    return r.x, rc, rs


def overlay(c, path):
    im = Image.open(PHOTO).convert('RGB'); dr = ImageDraw.Draw(im); vs = np.arange(250, 800, 1.0); P = pano(c.e, c.n, c.z); pts = []
    for u in range(0, W, 5):
        d = c.ray(np.full(vs.shape, u), vs); az_r = (341 + np.degrees(np.arctan2(d[:, 0], d[:, 1]))) % 360
        above = np.arctan2(d[:, 2], np.hypot(d[:, 0], d[:, 1])) > np.interp(az_r, AZ, P); pts.append((u, vs[np.argmin(above)]))
    dr.line(pts, fill=(255, 0, 0), width=2)
    poly = json.load(open('src/data/geo/footprints.json'))['terrace']['polygon']
    for (e0, n0), (e1, n1) in zip(poly[:-1], poly[1:]):
        if e0 > 150 and e1 > 150: continue
        seg = [c.proj(e0 + (e1 - e0) * t, n0 + (n1 - n0) * t, 0.0) for t in np.linspace(0, 1, 12)]
        seg = [q for q in seg if q]
        if len(seg) > 1: dr.line(seg, fill=(255, 255, 0), width=2)
    im.save(path)


if __name__ == '__main__':
    x, rc, rs = solve()
    e, n, az, pitch, f, roll = x
    print(f'camera: grid ({e:.1f}, {n:.1f}), ground {float(h_vec(e, n)[0]) + 1625:.1f} m asl, azimuth {az:.2f}° true, pitch {pitch:.2f}°, roll {roll:.2f}°, '
          f'f {f:.0f} px (vertical fov {2 * math.degrees(math.atan(H / 2 / f)):.1f}°, horizontal {2 * math.degrees(math.atan(W / 2 / f)):.1f}°)')
    print(f'residuals: corners rms {np.sqrt(np.mean(rc ** 2)):.1f} px (max {np.abs(rc).max():.1f}); skyline median |{np.median(np.abs(rs)):.1f}| px, mean {np.mean(rs):+.1f} px over {len(rs)} columns')
    import os; os.makedirs('shots', exist_ok=True); overlay(Cam(e, n, 1.6, az, pitch, f, roll), 'shots/calib24_overlay.png')
