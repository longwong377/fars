# Cloud addendum 2 (UD-31): page memory and the world-build bake — node-side, so the Vagon box never freezes again

The Vagon box (16 GB) froze three times tonight because one full-world page now holds ~10 GB. The load work moves to you.
Branch: start from origin/s14-load (git fetch origin && git merge origin/s14-load into cloud-s15-depth, or a new branch
cloud-s15-load from it; push only your own branch). Read src/world/cache/** (the world cache, session 14 + 15),
tools/bake_world/**, and the last commits of s14-load (8a1ac34f: a page-memory probe by GPU object kind; 63f8581e: WIP).

Do, all node-side (vitest, tsx; never needs a GPU):
1. Memory: measure the CPU-side size of every world unit as built in node (instance buffers, geometry, the grime/fill maps,
   bodies' per-instance data, the plain cover, the 1M-probe light field, textures decoded in JS) and cut the biggest: share
   geometry, drop CPU copies after upload (geometry.attributes array release), quantise (16-bit positions/normals, 8-bit
   maps), stream far units by distance instead of building them at start. Target: the whole page <= 5 GB.
2. The world-build bake: every pure-CPU stage over ~2 s (settlement plan and house geometry, Terrace meshes, merged instance
   buffers, fill/grime maps, probe tables, population start state) baked by tools/bake_world into compact files and read back,
   stale entries rebuilt live. The bake must run in GitHub Actions too (the public URL builds from git alone).
3. Report the measured node-side build time and the memory per unit before and after, in bench-reports/load_s15.md.
The Vagon lead verifies in the browser after you push. One DECISIONS line (your next D number).
