# The knotted pile of the palace carpets as a tiling normal map (session 12, D-325): public/models/props/carpet_pile_n.png.
# Headless: blender -b --factory-startup --python tools/blender/carpet_pile.py -- <out.png>
# A 2 cm square of pile at the Pazyryk carpet's density (about 36 symmetrical knots per cm^2, i.e. 6 per cm: PAZYRYK, B for
# the craft): 12 x 12 knots, each showing on the surface as two tufts side by side (the knot's two legs), jittered a little
# (hand knotting), cut to an even height with the fibres' fuzz on top. The height field is periodic over the tile (the
# jitter hashes the knot's indices modulo the tile), and its gradient is the tangent-space normal (x across the tile's u,
# y across v), written 8-bit RGB. The game samples it in world x-z at 2 cm per tile on the carpets' upward faces
# (furnish_palaces.ts carpet material).
import bpy, sys, numpy as np
out = sys.argv[sys.argv.index('--') + 1]
R, N, TILE = 256, 12, 0.02          # pixels, knots per tile side, tile side (m)
u = (np.arange(R) + 0.5) / R
U, V = np.meshgrid(u, u, indexing='xy')
def hsh(i, j, k):
    x = np.sin((i % N) * 12.9898 + (j % N) * 78.233 + k * 37.719) * 43758.5453
    return x - np.floor(x)
h = np.zeros((R, R))
ci, cj = np.floor(U * N).astype(int), np.floor(V * N).astype(int)
for di in (-1, 0, 1):
    for dj in (-1, 0, 1):
        i, j = ci + di, cj + dj
        cx = (i + 0.5 + 0.18 * (hsh(i, j, 1) - 0.5)) / N; cy = (j + 0.5 + 0.18 * (hsh(i, j, 2) - 0.5)) / N
        for side in (-1, 1):  # the knot's two legs, side by side along u
            lx = cx + side * 0.23 / N; ly = cy
            dx = (U - lx) * N; dy = (V - ly) * N
            r2 = (dx / 0.3) ** 2 + (dy / 0.42) ** 2
            h = np.maximum(h, np.clip(1 - r2, 0, None) ** 0.6 * (0.85 + 0.3 * hsh(i, j, 3 + side)))
# the fibres' fuzz: fine periodic noise (sums of sines with integer frequencies over the tile)
rng = np.random.default_rng(7); fuzz = np.zeros((R, R))
for _ in range(40):
    fx, fy = rng.integers(20, 80, 2); ph = rng.uniform(0, 2 * np.pi); fuzz += np.sin(2 * np.pi * (fx * U + fy * V) + ph)
h = h + 0.06 * fuzz / 40 ** 0.5
# gradient (periodic) -> normal; the cut surface undulates ~0.4 mm over a knot 1.7 mm across (the pile's full depth is not
# what the eye reads at a metre: the tufts' tops are): the slope scale
depth = 0.0004; px = TILE / R
gx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) / (2 * px) * depth
gy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) / (2 * px) * depth
n = np.stack([-gx, -gy, np.ones_like(gx)], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
rgba = np.concatenate([n * 0.5 + 0.5, np.ones((R, R, 1))], -1).astype(np.float32)
img = bpy.data.images.new('pile', R, R, alpha=False, float_buffer=False); img.colorspace_settings.name = 'Non-Color'
img.pixels.foreach_set(rgba.ravel()); img.filepath_raw = out; img.file_format = 'PNG'; img.save()
print('[carpet_pile] wrote', out, 'mean |slope| %.3f' % float(np.sqrt(gx ** 2 + gy ** 2).mean()))
