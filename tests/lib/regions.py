#!/usr/bin/env python3
"""dev (D-157): region statistics of rendered PNGs, as the photoreal triage measured them: mean sRGB, display-linear
Rec. 709 luminance Y, Ystd/Y (1 sigma of linear Y over the region / its mean) and linear R/G.
usage: regions.py file.png name:x0,y0,x1,y1 [name:x0,y0,x1,y1 ...]"""
import sys
import numpy as np
from PIL import Image


def lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def stats(img, box):
    x0, y0, x1, y1 = box
    a = img[y0:y1, x0:x1, :3].astype(np.float64)
    L = lin(a)
    Y = 0.2126 * L[..., 0] + 0.7152 * L[..., 1] + 0.0722 * L[..., 2]
    m = a.reshape(-1, 3).mean(0)
    rg = L[..., 0].mean() / max(L[..., 1].mean(), 1e-9)
    return m, Y.mean(), Y.std() / max(Y.mean(), 1e-9), rg


if __name__ == '__main__':
    img = np.asarray(Image.open(sys.argv[1]).convert('RGB'))
    for spec in sys.argv[2:]:
        name, box = spec.split(':')
        b = [int(v) for v in box.split(',')]
        m, y, ystd, rg = stats(img, b)
        print(f'{name:24s} sRGB {m[0]:6.1f} {m[1]:6.1f} {m[2]:6.1f}  Y {y:.4f}  Ystd/Y {ystd:.3f}  R/G(lin) {rg:.2f}')
