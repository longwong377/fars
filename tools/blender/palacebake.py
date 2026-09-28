# D-334: the palaces' earthen finishes, baked from dense Blender surfaces into tileable world-space detail maps (the palace
# meshes carry no UVs: the game lays them triplanar, src/render/scans.ts WALL_BAKE), as D-324's tools/blender/wallbake.py did
# for the houses. Two variants, each a periodic height field at ~2 mm a vertex built into a ~2.6 M-triangle Blender mesh:
#  wall (2.61 m tile): the palaces' mud plaster as fresh in 467 (maintained royal works, not a house's patched coat): a finer
#    finish coat than the houses' (0.8 mm of relief between 0.2 and 1 m), the wide sweeps of the finishing float (low ridges
#    0.3-0.5 mm on arcs 0.3-0.8 m across), fine chaff pressed flat (few weathered out), little grit, few and fine shrinkage
#    cracks, and the courses of the square mud bricks (33 cm, 13 cm a course with its joint) just readable through the coat;
#  roof (3.13 m tile): the roofs' clay-and-straw coat (the region's kahgel), rolled with a stone roller: its tracks 0.55 m
#    wide along the tile with their faint lips, coarse chopped straw 2-6 cm, a third weathered out, grit and small stones,
#    a shrinkage network of 0.1-0.25 m cells mostly open.
# Tier C (earthen plaster at Persepolis and Pasargadae: Stein et al. 2016 (Aloiz, Douglas, Nagel), 'earthen plaster tempered
# with gravel, earthen plaster tempered with organic matter', B; the finish, the roller and the brick size by the region's
# building tradition and the excavated bricks, C). Cycles bakes the tangent normal (OpenGL) onto a flat tile; the cavity (the
# height against its 8 mm blur) from the same field; packed PNG: R, G the normal's x, y; B the cavity (0.5 neutral).
# Reproducible: blender -b --factory-startup --python tools/blender/palacebake.py -- <wall|roof> <out.png> [res=1024] [samples=32]
import bpy, sys, math, json
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
VAR = argv[0] if argv else 'wall'
OUT = argv[1] if len(argv) > 1 else f'T:/fars-assets-s12/palacewalls/{VAR}.png'
RES = int(argv[2]) if len(argv) > 2 else 1024
SAMPLES = int(argv[3]) if len(argv) > 3 else 32
TILE = {'wall': 2.61, 'roof': 3.13}[VAR]
N = 1344                     # samples over the tile (1.9 / 2.3 mm)
rng = np.random.default_rng({'wall': 4611, 'roof': 5173}[VAR])
x = (np.arange(N) + 0.5) / N * TILE
X, Y = np.meshgrid(x, x, indexing='xy')   # X along the surface, Y up the wall (the roof: across the roller's tracks)
k = np.fft.fftfreq(N, d=TILE / N); KX, KY = np.meshgrid(k, k, indexing='xy'); K = np.hypot(KX, KY) + 1e-9

def band_noise(lo, hi, rms, aniso=1.0):
    # periodic noise with wavelengths between lo and hi metres (FFT-filtered white noise), scaled to rms metres; aniso > 1
    # stretches it along X
    w = rng.standard_normal((N, N)); F = np.fft.fft2(w); Ka = np.hypot(KX * aniso, KY) + 1e-9
    m = ((Ka >= 1 / hi) & (Ka <= 1 / lo)).astype(float) / np.sqrt(Ka)
    h = np.real(np.fft.ifft2(F * m)); return h / (h.std() + 1e-12) * rms

def wrapd(a, b):
    d = a - b; return d - TILE * np.round(d / TILE)

def stamp(cx, cy, reach, fn):
    # add fn(dx, dy) over a window of +-reach metres round (cx, cy), periodic
    i0, j0 = int(cx / TILE * N), int(cy / TILE * N); hw = int(reach / TILE * N) + 2
    ii = np.arange(i0 - hw, i0 + hw + 1) % N; jj = np.arange(j0 - hw, j0 + hw + 1) % N
    sx, sy = wrapd(X[np.ix_(jj, ii)], cx), wrapd(Y[np.ix_(jj, ii)], cy)
    h[np.ix_(jj, ii)] += fn(sx, sy)

def straw(count, L0, L1, w0, w1, out_share, ridge, groove):
    for _ in range(count):
        cx, cy = rng.uniform(0, TILE, 2); L = rng.uniform(L0, L1); th = rng.uniform(0, math.pi); w = rng.uniform(w0, w1)
        bend = rng.uniform(-8, 8)  # a slight curve (1/m)
        d = groove if rng.random() < out_share else ridge
        def f(sx, sy, L=L, th=th, w=w, bend=bend, d=d):
            u = sx * math.cos(th) + sy * math.sin(th); v = -sx * math.sin(th) + sy * math.cos(th) - bend * u * u
            return d * np.exp(-(v / w) ** 2) * np.clip(1 - np.abs(u) / (L / 2), 0, 1) ** 0.3
        stamp(cx, cy, L / 2 + 0.005, f)

def grit(count, r0, r1, d0, d1, pit_share):
    for _ in range(count):
        cx, cy = rng.uniform(0, TILE, 2); rr = rng.uniform(r0, r1); d = rng.uniform(d0, d1) * (-1 if rng.random() < pit_share else 0.7)
        stamp(cx, cy, rr * 2.5, lambda sx, sy, rr=rr, d=d: d * np.exp(-(sx * sx + sy * sy) / (rr * rr)))

def cracks(cells, depth, width, open_bias):
    P = rng.uniform(0, TILE, (cells, 2)); d1 = np.full((N, N), 9.0); d2 = np.full((N, N), 9.0)
    for (px, py) in P:
        d = np.hypot(wrapd(X, px), wrapd(Y, py)); lo = np.minimum(d1, d); d2 = np.where(d < d1, d1, np.minimum(d2, d)); d1 = lo
    edge = d2 - d1; open_ = np.clip((band_noise(0.3, 1.2, 1.0) - open_bias) * 1.5, 0, 1)
    return -depth * np.exp(-(edge / width) ** 2) * open_

if VAR == 'wall':
    h = band_noise(0.2, 1.0, 0.0008) + band_noise(0.02, 0.3, 0.00016)
    # the finishing float's sweeps: wide arcs of low ridges (its trailing edge), the swept band a touch smoother and lower
    for _ in range(120):
        cx, cy = rng.uniform(0, TILE, 2); R = rng.uniform(0.15, 0.4); a0 = rng.uniform(0, 2 * math.pi); span = rng.uniform(1.2, 2.8)
        dx, dy = wrapd(X, cx), wrapd(Y, cy); r = np.hypot(dx, dy); ang = np.mod(np.arctan2(dy, dx) - a0, 2 * math.pi)
        inside = np.clip(1 - np.abs(ang - span / 2) / (span / 2), 0, 1) ** 0.5
        w = rng.uniform(0.005, 0.009); h += rng.uniform(0.0003, 0.0005) * np.exp(-((r - R) / w) ** 2) * inside
        h -= 0.0002 * np.clip(1 - r / R, 0, 1) * inside
    straw(1800, 0.005, 0.02, 0.0008, 0.0013, 0.12, 0.00018, -0.0006)   # fine chaff of the finish coat
    grit(2200, 0.001, 0.0035, 0.0003, 0.0008, 0.5)
    h += cracks(55, 0.0008, 0.0012, 0.75)
    # the square bricks' courses through the coat: bed joints every 0.13 m, head joints every 0.33 m staggered by half a brick
    cy_ = np.mod(Y, 0.13); course = np.floor(Y / 0.13); head = np.mod(X + (course % 2) * 0.165, 0.33)
    joint = np.maximum(np.exp(-(cy_ / 0.011) ** 2) + np.exp(-((cy_ - 0.13) / 0.011) ** 2), np.exp(-(head / 0.013) ** 2) + np.exp(-((head - 0.33) / 0.013) ** 2))
    h -= 0.00022 * np.clip(joint, 0, 1) * np.clip(band_noise(0.4, 1.5, 1.0) + 0.2, 0, 1)
else:
    h = band_noise(0.3, 1.5, 0.0016) + band_noise(0.03, 0.3, 0.0003)
    # the roller's tracks: 0.55 m wide bands along X (Y the across-track axis), each pressed a little flatter than its lips
    TW = TILE / 6  # six tracks a tile (0.52 m: a stone roller ~0.5-0.6 m long)
    off = rng.uniform(-0.04, 0.04, 6)
    for t in range(6):
        c = (t + 0.5) * TW + off[t]; dy = wrapd(Y, c)
        wav = 1 + 0.2 * np.sin(2 * math.pi * X / TILE * (t + 2) + rng.uniform(0, 6.3))
        h += 0.0005 * np.exp(-((np.abs(dy) - TW / 2) / 0.012) ** 2) * wav   # the lips squeezed out at the track's edges
        h -= 0.0003 * np.clip(1 - np.abs(dy) / (TW / 2), 0, 1) ** 0.5          # the track itself pressed
    h += band_noise(0.005, 0.04, 0.00012, aniso=6)   # fine striations along the roll
    straw(2600, 0.02, 0.06, 0.0012, 0.0022, 0.33, 0.0003, -0.0011)
    grit(3000, 0.0015, 0.005, 0.0004, 0.0012, 0.45)
    grit(160, 0.006, 0.012, 0.0012, 0.0025, 0.1)      # small stones in the earth
    h += cracks(160, 0.0016, 0.0016, 0.05)
print(f'[palacebake:{VAR}] height field', N, 'x', N, 'rms %.2f mm, range %.2f..%.2f mm' % (h.std() * 1e3, h.min() * 1e3, h.max() * 1e3))

# ---- the dense surface in Blender (the tile and a 0.2 m margin, wrapped), and the flat tile to bake onto
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
M = 0.2; S = TILE + 2 * M; NV = int(round(S / (TILE / N)))
bpy.ops.mesh.primitive_grid_add(x_subdivisions=NV, y_subdivisions=NV, size=S, location=(TILE / 2, TILE / 2, 0))
hi_ob = bpy.context.active_object; me = hi_ob.data
co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
wx = co[:, 0] + TILE / 2; wy = co[:, 1] + TILE / 2
fi = np.mod(wx / TILE * N - 0.5, N); fj = np.mod(wy / TILE * N - 0.5, N); i0 = np.floor(fi).astype(int); j0 = np.floor(fj).astype(int); tx = fi - i0; ty = fj - j0
i1 = (i0 + 1) % N; j1 = (j0 + 1) % N
z = (h[j0, i0] * (1 - tx) * (1 - ty) + h[j0, i1] * tx * (1 - ty) + h[j1, i0] * (1 - tx) * ty + h[j1, i1] * tx * ty)
co[:, 2] = z; me.vertices.foreach_set('co', co.ravel()); me.update()
for p in me.polygons: p.use_smooth = True
print(f'[palacebake:{VAR}] dense mesh', len(me.polygons) * 2, 'triangles')
bpy.ops.mesh.primitive_plane_add(size=TILE, location=(TILE / 2, TILE / 2, 0)); lo_ob = bpy.context.active_object
img_n = bpy.data.images.new('nrm', RES, RES, alpha=False, float_buffer=True); img_n.colorspace_settings.name = 'Non-Color'
mat = bpy.data.materials.new('bake'); mat.use_nodes = True; lo_ob.data.materials.append(mat); nt = mat.node_tree
tex = nt.nodes.new('ShaderNodeTexImage'); nt.nodes.active = tex
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.seed = 0
sc.world = bpy.data.worlds.new('w')
bk = sc.render.bake; bk.use_selected_to_active = True; bk.cage_extrusion = 0.02; bk.max_ray_distance = 0.05; bk.margin = 0
bpy.ops.object.select_all(action='DESELECT'); hi_ob.select_set(True); lo_ob.select_set(True); bpy.context.view_layer.objects.active = lo_ob
tex.image = img_n; bk.normal_space = 'TANGENT'; bpy.ops.object.bake(type='NORMAL'); print(f'[palacebake:{VAR}] normal baked')
n = np.array(img_n.pixels[:], np.float32).reshape(RES, RES, 4)
G = np.exp(-2 * (math.pi * 0.008) ** 2 * (KX ** 2 + KY ** 2))
cav = h - np.real(np.fft.ifft2(np.fft.fft2(h) * G)); cav = np.clip(0.5 + cav / 0.0025, 0, 1)
gi = ((np.arange(RES) + 0.5) / RES * N - 0.5); i0 = np.floor(gi).astype(int) % N; i1 = (i0 + 1) % N; t = gi - np.floor(gi)
cr = cav[:, i0] * (1 - t) + cav[:, i1] * t; cav2 = cr[i0, :] * (1 - t)[:, None] + cr[i1, :] * t[:, None]
out = np.ones((RES, RES, 4), np.float32); out[..., 0] = n[..., 0]; out[..., 1] = n[..., 1]; out[..., 2] = cav2
st = {'variant': VAR, 'tile_m': TILE, 'res': RES, 'field_n': N, 'h_rms_mm': float(h.std() * 1e3), 'nx_sd': float(n[..., 0].std()), 'ny_sd': float(n[..., 1].std()),
      'nx_mean': float(n[..., 0].mean()), 'ny_mean': float(n[..., 1].mean()), 'cav_mean': float(cav2.mean()), 'cav_sd': float(cav2.std()), 'blender': bpy.app.version_string}
print(f'[palacebake:{VAR}] stats', json.dumps(st))
img = bpy.data.images.new('packed', RES, RES, alpha=False); img.colorspace_settings.name = 'Non-Color'; img.pixels.foreach_set(out.ravel())
import os; os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True)
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '8'; sc.render.image_settings.color_management = 'OVERRIDE'
try: sc.render.image_settings.view_settings.view_transform = 'Standard'
except Exception: pass
img.save_render(OUT, scene=sc)
with open(OUT[:-4] + '.json', 'w') as f: json.dump(st, f, indent=1)
print(f'[palacebake:{VAR}] wrote', OUT)
