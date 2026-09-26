"""§8.1 calibration (D-232): Kuh-e Rahmat in photograph #24 against the renders of the same view (calib-24, calib-24-now).
The mountain mask is defined in the world: pixels whose ray meets the DEM 0.4-2.5 km out, kept 6 px clear of the traced
skyline and of the Terrace (the ray must pass over the wall top line + margin); a column range per image excludes the 467
buildings. The photo is resampled to the rig's angular resolution (f 875 px at 960 x 540) so the texture measures compare
like with like. Reported (linear Y from the sRGB decode; the photo's Lightroom grade is unknown, so only ratios):
  mountain / sky above the ridge, mountain / sunlit wall, R/G, B/G, and their ratio to the sky's (a channel gain cancels);
  texture: the median of Ystd/Y in 12 x 12 px windows, and the bedding's anisotropy (the energy of the vertical luminance
  gradient over the horizontal: bands along the contours raise it above 1).
Run: python3 tools/dev/calib24_mountain.py [render.png:x0-x1 ...]   (x0-x1: the columns of the render the mountain is read in)
"""
import sys, math
import numpy as np
from PIL import Image
from scipy.ndimage import binary_erosion, uniform_filter
sys.path.insert(0, 'tools/dev')
from calib24_camera import Cam, h_vec, PHOTO  # noqa: E402
from calib24_compare import PHOTO_CAM, RIG, lin, regions  # noqa: E402

D = np.geomspace(60, 6000, 500)


def hit_dist(cam, w, h, rows):
    """distance (m) at which each pixel's ray first meets the DEM (inf: sky); rows limits the work"""
    out = np.full((h, w), np.inf)
    for v in rows:
        d = cam.ray(np.arange(w, dtype=float), np.full(w, float(v)))
        d /= np.linalg.norm(d, axis=1)[:, None]
        hz = np.hypot(d[:, 0], d[:, 1])
        E = cam.e + d[:, 0:1] / hz[:, None] * D; N = cam.n + d[:, 1:2] / hz[:, None] * D
        Z = cam.z + d[:, 2:3] / hz[:, None] * D - D ** 2 * (1 - 0.13) / (2 * 6371000)
        G = h_vec(E.ravel(), N.ravel()).reshape(E.shape)
        below = Z <= G
        first = np.where(below.any(1), below.argmax(1), -1)
        out[v] = np.where(first >= 0, D[np.clip(first, 0, None)], np.inf)
    return out


def mask(cam, w, h, cols=None):
    dist = hit_dist(cam, w, h, range(0, h))
    m = (dist >= 400) & (dist <= 2500)
    sky = ~np.isfinite(dist)
    m &= ~(uniform_filter(sky.astype(float), 13) > 0)  # 6 px clear of the skyline
    # clear of the Terrace: above the projected line of its W and S wall tops (+1 m: the parapet) by 6 px
    import json
    poly = json.load(open('src/data/geo/footprints.json'))['terrace']['polygon']
    top = np.full(w, float(h))
    for (e0, n0), (e1, n1) in zip(poly[:-1], poly[1:]):
        if e0 > 150 and e1 > 150: continue
        for t in np.linspace(0, 1, 200):
            q = cam.proj(e0 + (e1 - e0) * t, n0 + (n1 - n0) * t, 1.0)
            if q and 0 <= q[0] < w: top[int(q[0])] = min(top[int(q[0])], q[1])
    top = np.array([top[max(0, x - 3):x + 4].min() for x in range(w)])  # (a column's neighbours: the parapet's steps)
    rows = np.arange(h)[:, None]
    m &= rows < (top[None, :] - 6)
    if cols: c = np.zeros(w, bool); c[cols[0]:cols[1]] = True; m &= c[None, :]
    return m, dist


def stats(img, m, R):
    Y = img @ np.array([0.2126, 0.7152, 0.0722])
    c = img[m].mean(0); sk = img[R['sky_horizon']].mean(0) if R.get('sky_horizon') is not None else None
    ws = img[R['wall_sun']].mean(0) if R.get('wall_sun') is not None else None
    lum = lambda v: float(v @ [0.2126, 0.7152, 0.0722])
    mu = uniform_filter(Y, 12); sd = np.sqrt(np.maximum(uniform_filter(Y * Y, 12) - mu * mu, 0))
    core = binary_erosion(m, iterations=6)
    cv = np.median((sd / np.maximum(mu, 1e-6))[core]) if core.sum() > 50 else float('nan')
    gy, gx = np.gradient(Y)
    an = float((gy[core] ** 2).sum() / max((gx[core] ** 2).sum(), 1e-12)) if core.sum() > 50 else float('nan')
    return dict(n=int(m.sum()), Y=lum(c), mtn_sky=lum(c) / lum(sk) if sk is not None else float('nan'), mtn_wall=lum(c) / lum(ws) if ws is not None else float('nan'),
                rg=c[0] / c[1], bg=c[2] / c[1], bg_rel_sky=(c[2] / c[1]) / (sk[2] / sk[1]) if sk is not None else float('nan'),
                rg_rel_sky=(c[0] / c[1]) / (sk[0] / sk[1]) if sk is not None else float('nan'), cv12=float(cv), aniso=an,
                p90_p10=float(np.percentile(Y[m], 90) / max(np.percentile(Y[m], 10), 1e-6)))


def main(args):
    rows = []
    f = 875.0 / PHOTO_CAM['f']  # the photo resampled to the rig's angular resolution
    ph = Image.open(PHOTO).convert('RGB'); W, H = round(ph.size[0] * f), round(ph.size[1] * f)
    img = lin_img(ph.resize((W, H), Image.LANCZOS))
    c = Cam(PHOTO_CAM['e'], PHOTO_CAM['n'], PHOTO_CAM['eye'], PHOTO_CAM['az'], PHOTO_CAM['pitch'], PHOTO_CAM['f'] * f, PHOTO_CAM['roll'], W, H)
    m, _ = mask(c, W, H); rows.append(('photo #24 (resampled)', stats(img, m, regions(c, W, H)), m, img))
    for a in args:
        p, _, cr = a.partition(':'); cols = tuple(map(int, cr.split('-'))) if cr else None
        img = lin(p); h, w = img.shape[:2]; fr = (h / 2) / math.tan(math.radians(RIG['fov'] / 2))
        c = Cam(RIG['e'], RIG['n'], RIG['eye'], RIG['az'], RIG['pitch'], fr, 0.0, w, h)
        m, _ = mask(c, w, h, cols); rows.append((p.split('/')[-1], stats(img, m, regions(c, w, h)), m, img))
    keys = ['n', 'mtn_sky', 'mtn_wall', 'rg', 'bg', 'rg_rel_sky', 'bg_rel_sky', 'cv12', 'p90_p10', 'aniso']
    print('| image | ' + ' | '.join(keys) + ' |'); print('|---' * (len(keys) + 1) + '|')
    for n, s, *_ in rows: print(f'| {n} | ' + ' | '.join(f'{s[k]:.3f}' if isinstance(s[k], float) else str(s[k]) for k in keys) + ' |')
    for n, s, m, img in rows:
        v = (np.clip(img, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8).copy(); v[m] = (0.6 * v[m] + 0.4 * np.array([0, 255, 0])).astype(np.uint8)
        Image.fromarray(v).save('shots/calib24_mtnmask_' + n.split(' ')[0].replace('.png', '').replace('#', '') + '.png')


def lin_img(im):
    a = np.asarray(im).astype(float) / 255
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


if __name__ == '__main__':
    main(sys.argv[1:])
