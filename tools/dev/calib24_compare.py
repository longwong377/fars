"""§8.1 calibration (D-230): compare photograph #24 with the renders of the same view (moments.spec calib-24-now, calib-24).
Regions are defined in the world and projected with each image's own camera (the photo's solved camera; the render's is
the rig view: same position and heading, vertical fov 34.4°, 960 x 540, no roll), so they cover the same stone and sky.
Only ratios are compared (the photo is a Lightroom-processed JPEG with an unknown tone curve and white balance; the render is
AgX-tone-mapped with auto exposure). Linear values from the sRGB decode.
Run: python3 tools/dev/calib24_compare.py [shots/moment-calib-24-now-high-webgpu.png ...] [--side out.jpg]
  --side: the photo resampled to the rig's angular scale (f 875 px), centred in a 960 x 540 frame, over the renders, labelled
  (REVIEWS/calib24/side_by_side.jpg; D-232)
"""
import sys, math, json
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, 'tools/dev')
from calib24_camera import Cam, h_vec, pano, AZ, PHOTO  # noqa: E402

PHOTO_CAM = dict(e=-166.644, n=108.873, eye=1.6, az=117.006, pitch=7.473, f=1461.47, roll=0.482)
RIG = dict(e=-166.6, n=108.9, eye=1.6, az=117.0, pitch=7.5, fov=34.4)


def lin(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(float) / 255
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def quad_mask(cam, w, h, corners):
    pts = [cam.proj(*c) for c in corners]
    if any(p is None for p in pts): return None
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).polygon(pts, fill=1)
    a = np.asarray(m).astype(bool)
    return a if a.sum() > 20 else None


def point_mask(cam, w, h, pts):
    a = np.zeros((h, w), bool)
    for X in pts:
        q = cam.proj(*X)
        if q and 1 <= q[0] < w - 1 and 1 <= q[1] < h - 1: a[int(q[1]) - 1:int(q[1]) + 2, int(q[0]) - 1:int(q[0]) + 2] = True
    return a


def regions(cam, w, h):
    R = {}
    R['wall_sun'] = quad_mask(cam, w, h, [(-61.45, 2, -1.0), (-61.45, 45, -1.0), (-61.45, 45, -6.5), (-61.45, 2, -6.5)])       # the salient's W face
    R['wall_shade'] = quad_mask(cam, w, h, [(-59.5, 59.71, -1.0), (-49.5, 59.71, -1.0), (-49.5, 59.71, -6.5), (-59.5, 59.71, -6.5)])  # its N face
    a = math.radians(RIG['az'] - 341.0); ge = []
    for d in np.linspace(8, 25, 12):
        for s in np.linspace(-12, 12, 9):
            e = cam.e + math.sin(a) * d + math.cos(a) * s; n = cam.n + math.cos(a) * d - math.sin(a) * s
            ge.append((e, n, float(h_vec(e, n)[0])))
    R['ground'] = point_mask(cam, w, h, ge)
    P = pano(cam.e, cam.n, cam.z); sk = []
    for az in np.arange(124, 138, 0.5):   # the sky over the ridge behind the S half of the wall, 2-4.5° above it
        hor = np.interp(az, AZ, P)
        for de in np.radians([2.0, 2.8, 3.6, 4.5]):
            el = hor + de; g = math.radians(az - 341.0); D = 5000.0
            sk.append((cam.e + math.sin(g) * math.cos(el) * D, cam.n + math.cos(g) * math.cos(el) * D, cam.z + math.sin(el) * D + D * D * (1 - 0.13) / (2 * 6371000)))
    R['sky_horizon'] = point_mask(cam, w, h, sk)
    # Kuh-e Rahmat's sunlit W slope above the N half of the wall (DEM points 0.6-1.2 km out, 96-106° true, seen over the
    # wall: their elevation above the wall top's)
    mt = []
    for az in np.arange(96, 106.5, 0.5):
        g = math.radians(az - 341.0)
        for d in np.linspace(600, 1200, 13):
            e, n = cam.e + math.sin(g) * d, cam.n + math.cos(g) * d; z = float(h_vec(e, n)[0])
            if (z - cam.z) / d > (0 - cam.z) / 160 + 0.004: mt.append((e, n, z))
    R['mountain'] = point_mask(cam, w, h, mt)
    return R


def stats(img, R):
    Y = 0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2]; out = {}
    for k, m in R.items():
        if m is None or m.sum() == 0: out[k] = None; continue
        c = img[m].mean(0); out[k] = dict(Y=float(Y[m].mean()), Ysd=float(Y[m].std() / Y[m].mean()), rg=float(c[0] / c[1]), bg=float(c[2] / c[1]), n=int(m.sum()))
    return out


def table(name, s):
    f = lambda a, b: (s[a]['Y'] / s[b]['Y']) if s.get(a) and s.get(b) else float('nan')
    r = dict(sun_shade=f('wall_sun', 'wall_shade'), sky_sun=f('sky_horizon', 'wall_sun'), ground_sun=f('ground', 'wall_sun'), sky_ground=f('sky_horizon', 'ground'),
             stone_rg=s['wall_sun']['rg'] if s.get('wall_sun') else float('nan'), stone_bg=s['wall_sun']['bg'] if s.get('wall_sun') else float('nan'),
             sky_bg=s['sky_horizon']['bg'] if s.get('sky_horizon') else float('nan'), wall_ystd=s['wall_sun']['Ysd'] if s.get('wall_sun') else float('nan'),
             mountain_sun=f('mountain', 'wall_sun'), mountain_sky=f('mountain', 'sky_horizon'),
             mountain_rg=s['mountain']['rg'] if s.get('mountain') else float('nan'), mountain_bg=s['mountain']['bg'] if s.get('mountain') else float('nan'),
             # white-balance-free hue: the stone's and the mountain's B/G against the sky's (a grade that multiplies channels cancels)
             stone_bg_rel_sky=(s['wall_sun']['bg'] / s['sky_horizon']['bg']) if s.get('wall_sun') and s.get('sky_horizon') else float('nan'))
    return name, r


def main(paths):
    rows = []
    c = Cam(PHOTO_CAM['e'], PHOTO_CAM['n'], PHOTO_CAM['eye'], PHOTO_CAM['az'], PHOTO_CAM['pitch'], PHOTO_CAM['f'], PHOTO_CAM['roll'])
    img = lin(PHOTO); R = regions(c, img.shape[1], img.shape[0]); rows.append(table('photo #24', stats(img, R)))
    dbg = [('photo', img, R)]
    for p in paths:
        img = lin(p); h, w = img.shape[:2]; f = (h / 2) / math.tan(math.radians(RIG['fov'] / 2))
        c = Cam(RIG['e'], RIG['n'], RIG['eye'], RIG['az'], RIG['pitch'], f, 0.0, w, h)
        R = regions(c, w, h); rows.append(table(p.split('/')[-1], stats(img, R))); dbg.append((p.split('/')[-1], img, R))
    keys = list(rows[0][1].keys())
    print('| image | ' + ' | '.join(keys) + ' |'); print('|---' * (len(keys) + 1) + '|')
    for n, r in rows: print(f'| {n} | ' + ' | '.join(f'{r[k]:.3f}' for k in keys) + ' |')
    for n, img, R in dbg:  # the regions drawn, for checking
        v = (np.clip(img, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8).copy()
        for k, col in (('wall_sun', (255, 255, 0)), ('wall_shade', (0, 255, 255)), ('ground', (255, 0, 255)), ('sky_horizon', (255, 0, 0)), ('mountain', (0, 255, 0))):
            m = R.get(k)
            if m is not None: v[m] = (0.5 * v[m] + 0.5 * np.array(col)).astype(np.uint8)
        Image.fromarray(v).save('shots/calib24_regions_' + n.replace('.png', '').replace(' ', '_').replace('#', '') + '.png')


def side_by_side(paths, out, labels=None):
    rows = []
    ph = Image.open(PHOTO).convert('RGB'); k = (540 / 2) / math.tan(math.radians(RIG['fov'] / 2)) / PHOTO_CAM['f']
    ph = ph.resize((round(ph.size[0] * k), round(ph.size[1] * k)), Image.LANCZOS)
    fr = Image.new('RGB', (960, 540), (40, 40, 40)); fr.paste(ph, ((960 - ph.size[0]) // 2, (540 - ph.size[1]) // 2)); rows.append((fr, 'photo #24 (2019-02-08 15:59 IRST, Lightroom), framed to the rig view'))
    for i, p in enumerate(paths): rows.append((Image.open(p).convert('RGB').resize((960, 540)), (labels or [])[i] if labels and i < len(labels) else p.split('/')[-1]))
    img = Image.new('RGB', (960, 540 * len(rows) + 20 * (len(rows) - 1)), (0, 0, 0)); d = ImageDraw.Draw(img)
    for i, (im, lab) in enumerate(rows):
        y = i * 560; img.paste(im, (0, y)); d.text((8, y + 6), lab, fill=(255, 255, 0))
    img.save(out, quality=88)


if __name__ == '__main__':
    a = sys.argv[1:]
    if '--side' in a:
        i = a.index('--side'); out = a[i + 1]; paths = a[:i] + a[i + 2:]
        side_by_side(paths, out, ['render: Now view (D-201), day 303 16:05 LMT, same sun (D-232)', 'render: 467 BCE, same frame (D-232)'])
    else:
        paths = a
    main(paths)
