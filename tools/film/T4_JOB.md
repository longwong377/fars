# The title film on Vagon's T4, in under 2 hours (D-761)

The cloud's film is 640x268, 4-8 rendered frames a second interpolated to 24, 10-14 samples (CPU). Vagon timed the T4
(OptiX, 'ember', 1920x804): 64 spp 12 s a frame, 16 spp 5.9 s. A pass that fits a short session:
**1280x536, 12 rendered frames a second (interpolated to 24 by the edit), 16 spp, OptiX denoising.** About 1,750 frames at
~2.6 s for the light shots and ~6-8 s for the volume shots (fire, braziers, glaze, colonnade, summit): ~1.6-1.9 h. If the
session is shorter, run only the volume shots, the ones the CPU pass cannot make look right (they are the most visibly
noisy and sparsest there): `--shot fire,braziers,glaze,columns,summit` (~1 h); the edit takes the other shots from the
cloud's frames (copy the cloud's folders next to them: one frames directory, any mix of rates).

```
git pull && npm ci
for p in colossus_bull column_shaft_f48 capital_protome column_base_bell props/m_brazier decor/merlon; do node tools/film/glb_plain.mjs public/models/$p.glb tools/film/work/$(basename $p).glb; done
npx tsx tools/film/carve.ts tools/film/work
# the frames (one GPU slot; resumes where it stopped)
node tools/dev/gpu_slot.mjs film -- "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" -b --factory-startup --python tools/film/film.py -- --shot all --res 1280x536 --fps 24 --every 2 --samples 16 --gpu --out T:/film_frames --work tools/film/work
# the edit (each shot interpolated from its own rate to 24; the theme from tools/film/work/main_theme.opus) and the encodes,
# kept under the 12 MB budget for public/film (agreed with C9): check the printed sizes
node tools/film/assemble.mjs T:/film_frames
git add -f public/film && git commit -m "D-761: the title film from the T4 (1280x536)" && git push
```
