# D-324: the town's and villages' plastered walls, baked from a dense Blender wall into a tileable world-space detail map (the
# house meshes carry no UVs: the game lays it triplanar, src/render/scans.ts WALL_BAKE). A 2.37 m square of hand-laid mud
# plaster over mud brick is modelled as a height field at ~1.9 mm a vertex (periodic, so the tile repeats seamlessly):
#  - the coat's own relief between 0.2 and 1 m (the house geometry's bulge carries the metre scale),
#  - the float's arcs: the trailing edge of the wooden float leaves low ridges in sweeps 0.3-0.9 m across,
#  - the straw temper: chopped straw 1-4 cm long pressed flat in the surface, and the grooves where it has weathered out,
#  - grit and pits, shrinkage cracks along a cell network (only part of it open), and
#  - the brick courses read faintly through a thin coat (the plaster sinks a little over the joints as it dries).
# All tier C (Stein et al. 2016 for earthen plaster at Persepolis and Pasargadae, B; the finish by the region's vernacular).
# Cycles then bakes, from the dense mesh (~2 M triangles) onto a flat tile, its tangent-space normal map (OpenGL) and its
# cavity (the height against its own 8 mm blur: the grooves, pits and cracks dark, the ridges pale) comes from the same field;
# the two are packed in one JPEG (R, G: the normal's x, y; B: the cavity) so the game
# pays one sampler. Reproducible: blender -b --factory-startup --python tools/blender/wallbake.py -- <out.jpg> [res=1024] [samples=32]
import bpy, bmesh, sys, math
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'public/textures/housewall_bake/bake.jpg'
RES = int(argv[1]) if len(argv) > 1 else 1024
SAMPLES = int(argv[2]) if len(argv) > 2 else 32
TILE = 2.37           # metres (not the clay_plaster scan's 2.0 m: the two repeats do not line up)
N = 1280              # height-field samples over the tile (1.85 mm)
rng = np.random.default_rng(3241)
x = (np.arange(N) + 0.5) / N * TILE
X, Y = np.meshgrid(x, x, indexing='xy')   # X along the wall, Y up

def band_noise(lo, hi, rms):
    # periodic noise with wavelengths between lo and hi metres (FFT-filtered white noise), scaled to rms metres
    w = rng.standard_normal((N, N)); F = np.fft.fft2(w)
    k = np.fft.fftfreq(N, d=TILE / N); KX, KY = np.meshgrid(k, k, indexing='xy'); K = np.hypot(KX, KY) + 1e-9
    m = ((K >= 1 / hi) & (K <= 1 / lo)).astype(float) / np.sqrt(K)
    h = np.real(np.fft.ifft2(F * m)); return h / (h.std() + 1e-12) * rms

def wrapd(a, b):
    d = a - b; return d - TILE * np.round(d / TILE)

h = band_noise(0.2, 1.0, 0.0012) + band_noise(0.02, 0.3, 0.00025)
# the float's arcs: sweeps of ridges (the trailing edge), 0.5-0.8 mm high, 6-10 mm wide
for _ in range(90):
    cx, cy = rng.uniform(0, TILE, 2); R = rng.uniform(0.15, 0.45); a0 = rng.uniform(0, 2 * math.pi); span = rng.uniform(1.0, 2.4)
    dx, dy = wrapd(X, cx), wrapd(Y, cy); r = np.hypot(dx, dy); ang = np.mod(np.arctan2(dy, dx) - a0, 2 * math.pi)
    inside = np.clip(1 - np.abs(ang - span / 2) / (span / 2), 0, 1) ** 0.5
    w = rng.uniform(0.006, 0.01); h += rng.uniform(0.0005, 0.0008) * np.exp(-((r - R) / w) ** 2) * inside
    h -= 0.0003 * np.clip(1 - r / R, 0, 1) * inside  # the swept area a little lower and smoother
# straw: 1-4 cm pieces, 1.2-2 mm wide; most pressed flat (a faint ridge), a third weathered out (a groove)
for _ in range(2600):
    cx, cy = rng.uniform(0, TILE, 2); L = rng.uniform(0.01, 0.04); th = rng.uniform(0, math.pi); w = rng.uniform(0.001, 0.0016)
    i0, j0 = int(cx / TILE * N), int(cy / TILE * N); hw = int((L / 2 + 0.004) / TILE * N) + 2
    ii = np.arange(i0 - hw, i0 + hw + 1) % N; jj = np.arange(j0 - hw, j0 + hw + 1) % N
    sx, sy = wrapd(X[np.ix_(jj, ii)], cx), wrapd(Y[np.ix_(jj, ii)], cy)
    u = sx * math.cos(th) + sy * math.sin(th); v = -sx * math.sin(th) + sy * math.cos(th)
    prof = np.exp(-(v / w) ** 2) * np.clip(1 - np.abs(u) / (L / 2), 0, 1) ** 0.3
    h[np.ix_(jj, ii)] += (-0.0009 if rng.random() < 0.35 else 0.00025) * prof
# grit and pits
for _ in range(5000):
    cx, cy = rng.uniform(0, TILE, 2); rr = rng.uniform(0.0015, 0.005); d = rng.uniform(0.0004, 0.0013) * (-1 if rng.random() < 0.55 else 0.6)
    i0, j0 = int(cx / TILE * N), int(cy / TILE * N); hw = int(rr * 2.5 / TILE * N) + 2
    ii = np.arange(i0 - hw, i0 + hw + 1) % N; jj = np.arange(j0 - hw, j0 + hw + 1) % N
    sx, sy = wrapd(X[np.ix_(jj, ii)], cx), wrapd(Y[np.ix_(jj, ii)], cy)
    h[np.ix_(jj, ii)] += d * np.exp(-(sx * sx + sy * sy) / (rr * rr))
# shrinkage cracks: the edges of a periodic cell network (0.15-0.3 m), 1.2 mm deep, open where a broad noise says so
P = rng.uniform(0, TILE, (60, 2)); d1 = np.full((N, N), 9.0); d2 = np.full((N, N), 9.0)
for (px, py) in P:
    d = np.hypot(wrapd(X, px), wrapd(Y, py)); lo = np.minimum(d1, d); d2 = np.where(d < d1, d1, np.minimum(d2, d)); d1 = lo
edge = d2 - d1; open_ = np.clip((band_noise(0.3, 1.2, 1.0) - 0.2) * 1.5, 0, 1)
h -= 0.0014 * np.exp(-(edge / 0.0018) ** 2) * open_
# the brick courses through a thin coat: joints 2 cm wide every 13 cm, the head joints staggered by half a 33 cm brick
cy_ = np.mod(Y, 0.13); course = np.floor(Y / 0.13)
head = np.mod(X + (course % 2) * 0.165, 0.33)
joint = np.maximum(np.exp(-((cy_ - 0.0) / 0.01) ** 2) + np.exp(-((cy_ - 0.13) / 0.01) ** 2), np.exp(-((head - 0.0) / 0.012) ** 2) + np.exp(-((head - 0.33) / 0.012) ** 2))
h -= 0.00035 * np.clip(joint, 0, 1) * np.clip(band_noise(0.4, 1.5, 1.0) + 0.3, 0, 1)
print('[wallbake] height field', N, 'x', N, 'rms %.2f mm, range %.2f..%.2f mm' % (h.std() * 1e3, h.min() * 1e3, h.max() * 1e3))

# ---- the dense wall in Blender (the tile and a 0.2 m margin, wrapped), and the flat tile to bake onto
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
M = 0.2; S = TILE + 2 * M; NV = int(round(S / (TILE / N)))
bpy.ops.mesh.primitive_grid_add(x_subdivisions=NV, y_subdivisions=NV, size=S, location=(TILE / 2, TILE / 2, 0))
hi_ob = bpy.context.active_object; me = hi_ob.data
co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
wx = co[:, 0] + TILE / 2; wy = co[:, 1] + TILE / 2   # (the grid is centred on its location; co are local)
fi = np.mod(wx / TILE * N - 0.5, N); fj = np.mod(wy / TILE * N - 0.5, N); i0 = np.floor(fi).astype(int); j0 = np.floor(fj).astype(int); tx = fi - i0; ty = fj - j0
i1 = (i0 + 1) % N; j1 = (j0 + 1) % N
z = (h[j0, i0] * (1 - tx) * (1 - ty) + h[j0, i1] * tx * (1 - ty) + h[j1, i0] * (1 - tx) * ty + h[j1, i1] * tx * ty)
co[:, 2] = z; me.vertices.foreach_set('co', co.ravel()); me.update()
for p in me.polygons: p.use_smooth = True
bpy.ops.mesh.primitive_plane_add(size=TILE, location=(TILE / 2, TILE / 2, 0)); lo_ob = bpy.context.active_object
img_n = bpy.data.images.new('nrm', RES, RES, alpha=False, float_buffer=True); img_n.colorspace_settings.name = 'Non-Color'
mat = bpy.data.materials.new('bake'); mat.use_nodes = True; lo_ob.data.materials.append(mat); nt = mat.node_tree
tex = nt.nodes.new('ShaderNodeTexImage'); nt.nodes.active = tex
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.seed = 0
sc.world = bpy.data.worlds.new('w'); sc.world.light_settings.distance = 0.006
bk = sc.render.bake; bk.use_selected_to_active = True; bk.cage_extrusion = 0.02; bk.max_ray_distance = 0.05; bk.margin = 0
bpy.ops.object.select_all(action='DESELECT'); hi_ob.select_set(True); lo_ob.select_set(True); bpy.context.view_layer.objects.active = lo_ob
tex.image = img_n; bk.normal_space = 'TANGENT'; bpy.ops.object.bake(type='NORMAL'); print('[wallbake] normal baked')
n = np.array(img_n.pixels[:], np.float32).reshape(RES, RES, 4)
# the cavity (B): the height against its own 8 mm blur (periodic: an FFT Gaussian), from -1.25 to +1.25 mm onto 0..1: the grooves,
# pits and cracks dark, the float's ridges and the straw pale; resampled from the field onto the bake's grid (both span the tile)
k = np.fft.fftfreq(N, d=TILE / N); KX, KY = np.meshgrid(k, k, indexing='xy'); G = np.exp(-2 * (math.pi * 0.008) ** 2 * (KX ** 2 + KY ** 2))
cav = h - np.real(np.fft.ifft2(np.fft.fft2(h) * G)); cav = np.clip(0.5 + cav / 0.0025, 0, 1)
gi = ((np.arange(RES) + 0.5) / RES * N - 0.5); i0 = np.floor(gi).astype(int) % N; i1 = (i0 + 1) % N; t = gi - np.floor(gi)
cr = cav[:, i0] * (1 - t) + cav[:, i1] * t; cav2 = cr[i0, :] * (1 - t)[:, None] + cr[i1, :] * t[:, None]
a = np.repeat(cav2[..., None], 4, axis=2)  # (image rows run up the tile, as the field's)
out = np.ones((RES, RES, 4), np.float32); out[..., 0] = n[..., 0]; out[..., 1] = n[..., 1]; out[..., 2] = a[..., 0]
print('[wallbake] normal x %.3f +- %.3f, y %.3f +- %.3f; cavity mean %.3f sd %.3f' % (n[..., 0].mean(), n[..., 0].std(), n[..., 1].mean(), n[..., 1].std(), a[..., 0].mean(), a[..., 0].std()))
img = bpy.data.images.new('packed', RES, RES, alpha=False); img.colorspace_settings.name = 'Non-Color'; img.pixels.foreach_set(out.ravel())
import os; os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True)
sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 95; sc.render.image_settings.color_management = 'OVERRIDE'
try: sc.render.image_settings.view_settings.view_transform = 'Standard'
except Exception: pass
img.save_render(OUT, scene=sc); print('[wallbake] wrote', OUT)
