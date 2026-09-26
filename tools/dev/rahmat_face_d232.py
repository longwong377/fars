"""D-232: Kuh-e Rahmat's face in the plain view rahmat-west-pm (plain.spec: from (-250, 500) looking E at 16:00, day 0):
luminance spread and local texture over the face (rows 200-320, columns 0-880: the massif above the plain, left of the
Terrace), and its hue. Run: python3 tools/dev/rahmat_face_d232.py <render.png> ..."""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import uniform_filter
for p in sys.argv[1:]:
    a = np.asarray(Image.open(p).convert('RGB').resize((960, 540))).astype(float) / 255
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4); Y = lin @ [0.2126, 0.7152, 0.0722]
    r = (slice(200, 320), slice(0, 880)); y = Y[r]; c = lin[r].reshape(-1, 3).mean(0)
    mu = uniform_filter(Y, 12); sd = np.sqrt(np.maximum(uniform_filter(Y * Y, 12) - mu * mu, 0)); cv = np.median((sd / np.maximum(mu, 1e-6))[210:310, 10:870])
    hf = np.abs(Y - uniform_filter(Y, 3))[r].mean() / y.mean()
    print(f'{p.split("/")[-1]}: Y {y.mean():.3f} Ystd/Y {y.std() / y.mean():.3f} cv12 {cv:.3f} HF {hf:.3f} R/G {c[0] / c[1]:.2f} B/G {c[2] / c[1]:.2f}')
