"""D-285: the texture of mud plaster and of the Gate's stone measured on the Gate photographs (references/INDEX.md §6), for the
Terrace's plastered walls (materials.ts `mudbrick`, `plasterWeather`) and its ashlar (B40).

No plaster of 467 survives. The only mud plaster in the reference photographs is the site's modern maintenance coat: the
kahgel-plastered platform edge round the Gate's hall and the plastered site walls behind it in #21 ('gate of all nations
more.webp', low golden sun). It is an analogue (the same earth, the same climate, a coat some years old: C), used for the
spread of a maintained plaster face. The Gate's stone piers (#5, #21) give the weathered stone's spread at the same scale.

Linear luminance Y from the sRGB decode (processed JPEG/WebP: ratios only). Ystd/Y in square windows of a given size in metres,
the photo resampled to the render's pixel footprint first (matched scale): the metric of B40/B57 at the render's scale.
Boxes are hand-picked inside the faces, off the rope, the posts and the crack (checked on the overlay written with --overlay).
Run: python3 tools/dev/plaster_photo_d285.py [--overlay out.png]
"""
import sys, json
import numpy as np
from PIL import Image, ImageDraw

REF = 'references/'
P21 = 'gate of all nations more.webp'   # #21 the Gate in low golden sun (1440 x 1084)
P05 = 'The Gate of All Nations 2.webp'  # #5 the Gate's E doorway (1080 x 1630)

# #21: the plastered platform edge (about 0.9 m high, 12-25 m from the camera; the rope posts, 1.0 m, give the scale: ~1.6 cm
# per pixel at x 700): boxes in image pixels (x0, y0, x1, y1), sunlit face only
PLINTH21 = [[440, 776, 470, 792], [482, 780, 512, 796], [566, 787, 596, 803], [608, 790, 638, 806], [684, 797, 714, 813],
            [726, 800, 756, 816], [768, 804, 798, 820], [810, 807, 840, 823], [852, 811, 882, 826], [894, 814, 924, 828],
            [936, 818, 966, 831], [978, 822, 1008, 834], [1010, 825, 1040, 838], [1070, 830, 1100, 842], [1105, 833, 1135, 845],
            # below the rope, where the face is taller (nearer the camera)
            [940, 842, 970, 855], [990, 844, 1020, 862], [1062, 852, 1092, 872], [1100, 854, 1130, 878]]
PLINTH21_MPX = 0.016   # m per pixel at the plinth (the posts: 1.0 m over ~62 px)
# #21: the Gate's sunlit N pier (weathered stone), the courses below the colossus' wing level
PIER21 = [[440, 440, 600, 560], [440, 580, 600, 690]]
PIER21_MPX = 0.022     # the pier ~25 m away (the column shafts, 1.6 m across the base: ~72 px)
# #5: the S pier's face beside the colossus (weathered stone, full sun)
PIER05 = [[150, 480, 330, 600], [640, 450, 780, 560]]
PIER05_MPX = 0.0086    # the colossi ~5.5 m over ~640 px


def load(f):
    a = np.asarray(Image.open(REF + f).convert('RGB')).astype(float) / 255
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]


def resample(Y, k):
    """box-average by the factor k >= 1 (the photo's pixels to the render's footprint)"""
    if k <= 1.0001: return Y
    h, w = Y.shape; im = Image.fromarray(Y.astype(np.float32), mode='F')
    return np.asarray(im.resize((max(1, round(w / k)), max(1, round(h / k))), Image.BOX)).astype(float)


def window_stat(Y, boxes, mpx, render_mpx, win_m):
    """median Ystd/Y over windows of win_m metres inside the boxes, the photo resampled to render_mpx per pixel"""
    k = render_mpx / mpx; v = []
    for x0, y0, x1, y1 in boxes:
        p = resample(Y[y0:y1, x0:x1], k); w = max(2, round(win_m / render_mpx))
        h_, w_ = p.shape
        if h_ < w or w_ < w:  # the box is smaller than a window: the box itself
            v.append(p.std() / p.mean()); continue
        for yy in range(0, h_ - w + 1, max(1, w // 2)):
            for xx in range(0, w_ - w + 1, max(1, w // 2)):
                q = p[yy:yy + w, xx:xx + w]; v.append(q.std() / q.mean())
    return float(np.median(v)), len(v)


def measure(render_mpx=0.032, win_m=0.5):
    out = {}
    Y = load(P21)
    out['plaster21'] = window_stat(Y, PLINTH21, PLINTH21_MPX, render_mpx, win_m)
    out['pier21'] = window_stat(Y, PIER21, PIER21_MPX, render_mpx, win_m)
    Y = load(P05)
    out['pier05'] = window_stat(Y, PIER05, PIER05_MPX, render_mpx, win_m)
    return out


def main():
    a = sys.argv[1:]
    res = {}
    for mpx, win in ((0.032, 0.5), (0.032, 1.0), (0.016, 0.5), (0.05, 1.5)):
        m = measure(mpx, win); res[f'{mpx}m/px,{win}m'] = {k: round(v[0], 4) for k, v in m.items()}
        print(f'render footprint {mpx} m/px, windows {win} m: ' + ', '.join(f'{k} {v[0]:.3f} (n {v[1]})' for k, v in m.items()))
    if '--json' in a: print(json.dumps(res))
    if '--overlay' in a:
        out = a[a.index('--overlay') + 1]
        im = Image.open(REF + P21).convert('RGB'); d = ImageDraw.Draw(im)
        for b in PLINTH21: d.rectangle(b, outline=(255, 0, 0))
        for b in PIER21: d.rectangle(b, outline=(0, 255, 0))
        im.save(out)


if __name__ == '__main__':
    main()
