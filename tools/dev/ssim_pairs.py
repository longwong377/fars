#!/usr/bin/env python3
# D-234 / T-E5 proxy: SSIM (grey, 7x7 Gaussian windows, the standard constants) between consecutive pairs of images
# <prefix>_0.png/_1.png, _2/_3, ... (house_preview.ts VIEWS door views of neighbouring houses). A CPU-preview proxy: the
# shader's surface detail is not in these images, so it measures the geometry and tone variation between instances only.
import sys, glob, numpy as np
from PIL import Image
def gauss(img, s=1.5):
    r = 3; x = np.arange(-r, r + 1); k = np.exp(-x ** 2 / (2 * s * s)); k /= k.sum()
    a = np.apply_along_axis(lambda m: np.convolve(m, k, mode='same'), 0, img)
    return np.apply_along_axis(lambda m: np.convolve(m, k, mode='same'), 1, a)
def ssim(a, b):
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    ma, mb = gauss(a), gauss(b); va = gauss(a * a) - ma * ma; vb = gauss(b * b) - mb * mb; cov = gauss(a * b) - ma * mb
    return float((((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2))).mean())
pre = sys.argv[1]; files = sorted(glob.glob(pre + '_*.png'), key=lambda f: int(f.rsplit('_', 1)[1].split('.')[0]))
vals = []
for i in range(0, len(files) - 1, 2):
    a = np.asarray(Image.open(files[i]).convert('L'), dtype=np.float64); b = np.asarray(Image.open(files[i + 1]).convert('L'), dtype=np.float64)
    v = ssim(a, b); vals.append(v); print(f'{files[i].rsplit("/", 1)[1]} vs {files[i + 1].rsplit("/", 1)[1]}: SSIM {v:.3f}')
print(f'pairs {len(vals)}: max {max(vals):.3f}, mean {sum(vals) / len(vals):.3f}; over 0.9: {sum(v > 0.9 for v in vals)}')
