# PARSA (D-329): the Tol-e Ajori gate, modelled and baked in Blender (BLENDER_PLAN row 15). Headless:
#   blender -b --factory-startup --python tools/blender/ajori.py -- <job.json>
# job: { out_dir, device: CPU|GPU, plan: AJORI of src/world/settlement/plan.ts, stages: ["tiles", "model"], preview: bool }
# 1. tiles (ajori_tiles.py): the plain brick facing, and the glazed atlas (bull, mušḫuššu, plain blue, rosette band), carved
#    as height fields and baked (Cycles: tangent normal + AO); colour and roughness from the same fields.
# 2. model: the gate's massing from the plan (TOLAJORI2017, B: 39.07 x 29.05 m, 10.47 m walls round an 8.00 x 14.36 m room
#    with benches, corridors on the short sides; height 12 m, corridor 4.2 x 7.5 m, room 9 m high: C), the stepped merlons
#    (C; some unrepaired, 50-70 years old), the glazed fields flanking the corridor mouths and lining the corridors (rows C),
#    the figures as real relief geometry (the height field decimated), UV0 in the brick module, UV1 a light map baked in Cycles
#    (AO over 4 m and the weathering: splash at the foot, streaks below the merlons, dust on the ledges).
# Local frame: x = u (the long axis, + toward the ESE mouth), y = v, z up, the base (the lowest ground under the footprint)
# at z 0. glTF is y-up: game local (u, z, -v); the builder rotates it by the gate's theta about y (ajori.ts).
import bpy, bmesh, sys, os, json, math, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mon_lib as ml
import ajori_tiles as T

argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0])); OUT = job['out_dir']; os.makedirs(OUT, exist_ok=True)
stages = job.get('stages', ['tiles', 'model']); t0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
DEV = ml.cycles(job.get('device', 'CPU'))
stats = {'blender': bpy.app.version_string, 'device': DEV}
ATLAS_H = 2048
# atlas bands (image rows from the TOP of the image): name -> (row0, rows)
BANDS = {'bull': (0, T.H), 'dragon': (T.H, T.H), 'blue': (2 * T.H, T.H), 'rosette': (3 * T.H, T.RH)}
def band_v(name):
    """the band's Blender v range (v up from the image bottom)"""
    r0, n = BANDS[name]; return 1 - (r0 + n) / ATLAS_H, 1 - r0 / ATLAS_H

# ================================================================ 1. tiles
if 'tiles' in stages:
    rng = np.random.default_rng(4671)
    h, col, rough = T.brick_tile(rng)
    nrm, ao = ml.bake_tile(h, T.TW, T.TH, ao_dist=0.03, ao_samples=96)
    # one map (D-300's sampler budget: the body's surface already declares 4): R, G the tangent normal's x, y (z rebuilt in the
    # shader), B the brick's firing tone x the joints' occlusion, /2 (the albedo multiplier; hue from the tone in the shader)
    lum = (col * np.array([0.3, 0.55, 0.15])).sum(-1)
    ml.write_png(f'{OUT}/brick_n.png', ml.q8(np.stack([nrm[..., 0], nrm[..., 1], np.clip(lum * (0.35 + 0.65 * ao) / 2, 0, 1)], -1)))
    ml.write_png(f'{OUT}/brick_rake.png', ml.rake(nrm, ao))
    stats['brick'] = {'h_sd_mm': float(h.std() * 1000), 'ao_mean': float(ao.mean()), 'slope_sd': float(np.sqrt(((nrm[..., :2] * 2 - 1) ** 2).sum(-1).mean()))}
    ml.log('brick', stats['brick'])
    AC = np.zeros((ATLAS_H, T.W, 3)); AN = np.zeros((ATLAS_H, T.W, 3)); AA = np.zeros((ATLAS_H, T.W, 3)); HF = {}
    for name in ('bull', 'dragon', 'blue', 'rosette'):
        if name in ('bull', 'dragon'): h, col, rough, body = T.animal_tile(rng, name); HF[name] = (h, body)
        elif name == 'blue': h, col, rough = T.blue_tile(rng)
        else: h, col, rough = T.rosette_tile(rng)
        sy = h.shape[0] * T.PX
        nrm, ao = ml.bake_tile(h, T.TW, sy, ao_dist=0.04, ao_samples=96)
        r0, n = BANDS[name]
        AC[r0:r0 + n] = ml.srgb(col); AN[r0:r0 + n] = nrm; AA[r0:r0 + n] = np.stack([ao, np.full_like(ao, 0.5), rough], -1)
        stats[name] = {'h_max_mm': float(h.max() * 1000), 'ao_mean': float(ao.mean())}; ml.log(name, stats[name])
        np.save(f'{OUT}/hf_{name}.npy', h.astype(np.float32))
        if name in HF: np.save(f'{OUT}/fig_{name}.npy', HF[name][1].astype(np.float32))
    r = BANDS['rosette'][0] + T.RH  # pad: the plain blue again
    AC[r:] = AC[BANDS['blue'][0]:BANDS['blue'][0] + ATLAS_H - r]; AN[r:] = AN[BANDS['blue'][0]:BANDS['blue'][0] + ATLAS_H - r]; AA[r:] = AA[BANDS['blue'][0]:BANDS['blue'][0] + ATLAS_H - r]
    ml.write_png(f'{OUT}/glaze_c.png', ml.q8(AC)); ml.write_png(f'{OUT}/glaze_n.png', ml.q8(AN)); ml.write_png(f'{OUT}/glaze_a.png', ml.q8(AA))
    ml.write_png(f'{OUT}/glaze_rake.png', ml.rake(AN, AA[..., 0]))
    json.dump(stats, open(f'{OUT}/tiles_stats.json', 'w'), indent=1)

# ================================================================ 2. the model
if 'model' in stages:
    exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ajori_model.py')).read())
ml.log('done', f'{time.time() - t0:.0f} s')
