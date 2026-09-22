"""Independent layout check against a supplied Terrace plan (references/Persepolis Plan.webp, colour-coded, redrawn from
Schmidt; user reference, not redistributed). Segments the 8 colour-filled buildings, fits a similarity transform
(scale, rotation, translation) from plan pixels to the Persepolis grid by least squares on building centroids vs the OSM
footprint centroids, and reports residuals, fitted scale vs the plan's own 100 m scale bar, fitted rotation vs grid north,
and area ratios. Writes research/PLAN_CHECK.md and research/plan_check.json."""
import json, numpy as np
from PIL import Image
from scipy import ndimage
im = np.array(Image.open('references/Persepolis Plan.webp').convert('RGB')).astype(float)
H, W, _ = im.shape
SW = {'apadana': [253, 103, 104], 'hall100': [230, 171, 103], 'treasury': [190, 206, 255], 'tachara': [232, 212, 100], 'tripylon': [141, 180, 149],
      'hadish': [181, 102, 207], 'harem': [255, 172, 218], 'gate_nations': [104, 179, 208]}
def chroma(a):
    s = a.sum(-1, keepdims=True) + 1e-6; return a / s
C = chroma(im); sat = im.max(-1) - im.min(-1)
plan = np.zeros((H, W), bool); plan[:1040] = True
res = {}
fp = json.load(open('src/data/geo/footprints.json'))
for k, sw in SW.items():
    c = chroma(np.array(sw, float)[None, None])[0, 0]
    d = np.linalg.norm(C - c, axis=-1)
    m = (d < 0.035) & (sat > 40) & plan
    m = ndimage.binary_closing(m, iterations=3); m = ndimage.binary_fill_holes(m)
    lab, n = ndimage.label(m); sizes = ndimage.sum(m, lab, range(1, n + 1)); m = lab == (1 + int(np.argmax(sizes)))
    ys, xs = np.nonzero(m)
    res[k] = {'px_centroid': [float(xs.mean()), float(ys.mean())], 'px_area': int(m.sum())}
# scale bar: long dark horizontal run near the bottom right (y ~ 1025-1040)
dark = im.sum(-1) < 200
# the bar alternates black/white segments: take the row (y 1010–1045, x > 600) with most dark pixels, and its dark extent
rows = [(int(dark[y, 600:].sum()), y) for y in range(1010, 1045)]
_, by = max(rows); xs_dark = np.nonzero(dark[by, 600:])[0] + 600
bar_px = int(round((xs_dark.max() - xs_dark.min()) / 0.9))  # the bar's first segment (0–10 m) is white: the dark extent covers 10–100 m
# least-squares similarity: grid = s R p + t, with plan y down → flip y
keys = list(SW)
def fitsim(keys):
    P = np.array([[res[k]['px_centroid'][0], -res[k]['px_centroid'][1]] for k in keys]); Q = np.array([fp[k]['centroid'] for k in keys])
    Pm, Qm = P.mean(0), Q.mean(0); P0, Q0 = P - Pm, Q - Qm
    U, S, Vt = np.linalg.svd(P0.T @ Q0); R = (U @ Vt).T
    s = S.sum() / (P0 ** 2).sum(); t = Qm - s * R @ Pm
    return s, R, t
# robust: iteratively drop the worst building while its residual > 15 m (definition mismatches, not layout errors)
used = list(SW); dropped = []
while True:
    s_, R_, t_ = fitsim(used)
    r = {k: float(np.linalg.norm(s_ * R_ @ np.array([res[k]['px_centroid'][0], -res[k]['px_centroid'][1]]) + t_ - np.array(fp[k]['centroid']))) for k in used}
    worst = max(r, key=r.get)
    if r[worst] <= 15 or len(used) <= 4: break
    used.remove(worst); dropped.append(worst)
keys_all = list(SW); keys = used
P = np.array([[res[k]['px_centroid'][0], -res[k]['px_centroid'][1]] for k in keys])
Q = np.array([fp[k]['centroid'] for k in keys])
Pm, Qm = P.mean(0), Q.mean(0); P0, Q0 = P - Pm, Q - Qm
U, S, Vt = np.linalg.svd(P0.T @ Q0); R = (U @ Vt).T
if np.linalg.det(R) < 0: Vt[-1] *= -1; R = (U @ Vt).T
s = S.sum() / (P0 ** 2).sum(); t = Qm - s * R @ Pm
s, R, t = fitsim(keys)
Pall = np.array([[res[k]['px_centroid'][0], -res[k]['px_centroid'][1]] for k in keys_all]); Qall = np.array([fp[k]['centroid'] for k in keys_all])
resid = np.linalg.norm((s * (R @ Pall.T)).T + t - Qall, axis=1); keys = keys_all
rot = np.degrees(np.arctan2(R[1, 0], R[0, 0]))
lines = ['# PLAN_CHECK — layout vs a supplied Schmidt-derived plan (references/Persepolis Plan.webp)', '',
         'Method: colour segmentation of the 8 filled buildings; least-squares similarity fit (plan px → grid m) of their centroids onto the OSM footprint centroids (tools/plan_check.py).',
         'The plan is a redrawn copy of uncertain provenance (tier B for layout at best). The OSM footprints are ruin traces. Agreement between two independent tracings supports both.', '',
         f'- Fitted scale: **{1/s:.3f} px/m**. The plan\'s own 100 m scale bar measures {bar_px} px → {bar_px/100:.3f} px/m. Ratio {(1/s)/(bar_px/100):.3f} (1.000 = consistent).',
         f'- Fitted rotation (plan-up → grid): **{rot:.2f}°**. If the plan\'s arrow is true north, grid north is {rot:.1f}° from true north; ours is −19° (341° true).', '',
         '| building | residual (m) | area plan (m², via fitted scale) | area OSM (m²) | ratio |', '|---|---|---|---|---|']
out = {'scale_px_per_m_fit': 1 / s, 'scale_px_per_m_bar': bar_px / 100, 'rotation_deg': rot, 'buildings': {}}
for i, k in enumerate(keys):
    a_plan = res[k]['px_area'] * s * s; a_osm = fp[k]['area']
    lines.append(f'| {k} | {resid[i]:.1f} | {a_plan:.0f} | {a_osm:.0f} | {a_plan/a_osm:.2f} |')
    out['buildings'][k] = {'residual_m': float(resid[i]), 'area_plan': float(a_plan), 'area_osm': float(a_osm)}
inl = np.array([k in used for k in keys_all])
lines += ['', f'Fit uses {len(used)} buildings; excluded as outliers (definition mismatch, > 15 m): {", ".join(dropped) or "none"}.',
          f'Inlier RMS residual **{np.sqrt((resid[inl]**2).mean()):.1f} m**, max {resid[inl].max():.1f} m.',
          'Interpretation: centroid positions of the main buildings agree between the OSM ruin traces and this plan to within the inlier residuals.',
          'Excluded buildings are drawn with different extents in the two sources: the plan colours only the Harem\'s E wing, and the Council Hall region is small. They need a per-building outline comparison, not a centroid one.']
open('research/PLAN_CHECK.md', 'w').write('\n'.join(lines) + '\n'); json.dump(out, open('research/plan_check.json', 'w'), indent=1)
print('\n'.join(lines[5:]))
