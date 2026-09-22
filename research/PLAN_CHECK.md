# PLAN_CHECK — layout vs a supplied Schmidt-derived plan (references/Persepolis Plan.webp)

Method: colour segmentation of the 8 filled buildings; least-squares similarity fit (plan px → grid m) of their centroids onto the OSM footprint centroids (tools/plan_check.py).
The plan is a redrawn copy of uncertain provenance (tier B for layout at best). The OSM footprints are ruin traces. Agreement between two independent tracings supports both.

- Fitted scale: **2.115 px/m**. The plan's own 100 m scale bar measures 213 px → 2.130 px/m. Ratio 0.993 (1.000 = consistent).
- Fitted rotation (plan-up → grid): **-18.51°**. If the plan's arrow is true north, grid north is -18.5° from true north; ours is −19° (341° true).

| building | residual (m) | area plan (m², via fitted scale) | area OSM (m²) | ratio |
|---|---|---|---|---|
| apadana | 10.2 | 11741 | 13688 | 0.86 |
| hall100 | 2.6 | 6785 | 5478 | 1.24 |
| treasury | 6.4 | 9652 | 11968 | 0.81 |
| tachara | 0.3 | 1034 | 1432 | 0.72 |
| tripylon | 31.5 | 30 | 865 | 0.03 |
| hadish | 2.5 | 3297 | 4174 | 0.79 |
| harem | 57.2 | 4357 | 6563 | 0.66 |
| gate_nations | 7.4 | 666 | 1100 | 0.61 |

Fit uses 6 buildings; excluded as outliers (definition mismatch, > 15 m): harem, tripylon.
Inlier RMS residual **5.9 m**, max 10.2 m.
Interpretation: centroid positions of the main buildings agree between the OSM ruin traces and this plan to within the inlier residuals.
Excluded buildings are drawn with different extents in the two sources: the plan colours only the Harem's E wing, and the Council Hall region is small. They need a per-building outline comparison, not a centroid one.
