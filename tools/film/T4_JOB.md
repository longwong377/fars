# The title film at full quality on Vagon's T4 (D-761)

The cloud renders the film at 640x268, 8 frames a second interpolated to 24, 14 samples (CPU). The full-quality pass is a
GPU job for Vagon's T4: 1920x804 (2.39:1), every frame at 24 fps, 64 samples, OptiX. About 3,500 frames.

```
git pull && npm ci
# the models' readable copies and the carved heightmaps (seconds)
for p in colossus_bull column_shaft_f48 capital_protome column_base_bell props/m_brazier decor/merlon; do node tools/film/glb_plain.mjs public/models/$p.glb tools/film/work/$(basename $p).glb; done
npx tsx tools/film/carve.ts tools/film/work
# the frames, one GPU slot (resumes where it stopped; a shot at a time is fine: --shot ember,stylus)
node tools/dev/gpu_slot.mjs film -- "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" -b --factory-startup --python tools/film/film.py -- --shot all --res 1920x804 --fps 24 --samples 64 --gpu --out T:/film_frames --work tools/film/work
# the edit and the encodes (the theme: tools/film/work/main_theme.opus, 192 kbps, committed by the score build)
node tools/film/assemble.mjs T:/film_frames
git add -f public/film && git commit -m "D-761: the title film at full quality (T4)" && git push
```
