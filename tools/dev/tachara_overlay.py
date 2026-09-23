"""dev: the built Tachara against REF-PLAN (references/Persepolis Plan.webp), measured, not looked at (brief §3.4).

The plan is resampled into the grid with the Phase 4 transform (research/PHASE4_ACCESS.md §1: grid = s R [px, -py] + t,
s 0.47284 m/px, R rot(-18.51 deg), t (-37.664, 300.563)), bilinear, on a 0.1 m raster. A plan pixel is wall when
R+G+B < 392 (half-way between the yellow floor, ~545, and the olive wall fill, ~239) and it is not the Apadana's red.
The model mask is the horizontal section of the built walls and stone frames at 2 m above the floor
(tools/dev/tachara_section.ts; above the window sills, as a plan is drawn). Reports IoU, precision and recall of the wall
masks over the building's extent, and column position errors against the plan's column dots; writes an overlay PNG
(plan dimmed; green = both, red = plan only, blue = model only, yellow crosses = model columns).
Run: npx tsx tools/dev/tachara_section.ts > /tmp/s.json && python3 tools/dev/tachara_overlay.py /tmp/s.json [out.png]"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

im = np.array(Image.open('references/Persepolis Plan.webp').convert('RGB')).astype(float)
S = 0.47284; A = np.radians(-18.51); R = np.array([[np.cos(A), -np.sin(A)], [np.sin(A), np.cos(A)]]); T = np.array([-37.664, 300.563])
REGION = (-36.6, -5.6, -99.2, -58.26)  # the building's outer faces on the plan (x0, x1, y0, y1)
RES = 0.1


def sample(X, Y):
    g = np.stack([X - T[0], Y - T[1]], -1); p = (g @ R) / S
    px, py = p[..., 0], -p[..., 1]
    return np.stack([ndimage.map_coordinates(im[..., c], [py.ravel(), px.ravel()], order=1, mode='nearest').reshape(X.shape) for c in range(3)], -1)


sec = json.load(open(sys.argv[1]))
x0, x1, y0, y1 = REGION
xs = np.arange(x0 + RES / 2, x1, RES); ys = np.arange(y1 - RES / 2, y0, -RES)
X, Y = np.meshgrid(xs, ys)
rgb = sample(X, Y)
plan = (rgb.sum(-1) < 392) & ~((rgb[..., 0] > rgb[..., 1] + 50) & (rgb[..., 0] > rgb[..., 2] + 50))
model = np.zeros_like(plan)
for bx0, bx1, by0, by1 in sec['boxes']:
    model |= (X >= bx0) & (X < bx1) & (Y >= by0) & (Y < by1)
# columns: the plan's dots (dark blobs inside the rooms, away from walls) vs the model's column centres
wide = sample(*np.meshgrid(np.arange(-40, -3, 0.05), np.arange(-55, -102, -0.05)))
gx, gy = np.arange(-40, -3, 0.05), np.arange(-55, -102, -0.05)
m = wide.sum(-1) < 500; lab, n = ndimage.label(m); dots = []
for i in range(1, n + 1):
    yy, xx = np.nonzero(lab == i)
    if not (150 < len(yy) < 400): continue
    w = (545 - wide.sum(-1)[yy, xx]).clip(0); cx, cy = (gx[xx] * w).sum() / w.sum(), (gy[yy] * w).sum() / w.sum()
    if x0 < cx < x1 and y0 < cy < y1: dots.append((cx, cy))
# the column dots are not wall: left out of the plan's wall mask (within DOT_R of a dot centre)
DOT_R = 0.8
for cx, cy in dots: plan &= np.hypot(X - cx, Y - cy) > DOT_R
inter = (plan & model).sum(); union = (plan | model).sum()
iou = inter / union; prec = inter / max(model.sum(), 1); rec = inter / max(plan.sum(), 1)
print(f'wall section at {sec["level"]:.2f} m: IoU {iou:.3f}, precision {prec:.3f} (model wall on plan wall), recall {rec:.3f} (plan wall built); '
      f'plan {plan.sum() * RES * RES:.1f} m2, model {model.sum() * RES * RES:.1f} m2')
cols = sec['columns']; errs = []
for c in cols:
    d = min(np.hypot(c[0] - p[0], c[1] - p[1]) for p in dots) if dots else np.inf; errs.append(d)
matched = sum(e < 1.0 for e in errs)
print(f'columns: model {len(cols)}, plan dots {len(dots)}; model columns within 1 m of a plan dot {matched}; '
      f'error mean {np.mean(errs):.2f} m, max {np.max(errs):.2f} m' if cols else 'no columns')
if len(sys.argv) > 2:
    base = (rgb * 0.45 + 140).clip(0, 255).astype(np.uint8)
    base[plan & model] = (40, 170, 40); base[plan & ~model] = (220, 40, 40); base[~plan & model] = (40, 90, 230)
    img = Image.fromarray(base).resize((base.shape[1] * 3, base.shape[0] * 3), Image.NEAREST); d = ImageDraw.Draw(img)
    for c in cols:
        u, v = (c[0] - x0) / RES * 3, (y1 - c[1]) / RES * 3; d.line([(u - 6, v), (u + 6, v)], fill=(255, 220, 0), width=2); d.line([(u, v - 6), (u, v + 6)], fill=(255, 220, 0), width=2)
    for p in dots:
        u, v = (p[0] - x0) / RES * 3, (y1 - p[1]) / RES * 3; d.ellipse([u - 4, v - 4, u + 4, v + 4], outline=(0, 0, 0))
    img.save(sys.argv[2]); print('overlay written to', sys.argv[2])
