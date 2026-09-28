# The plain's ground cover at the feet (session 12, D-335; the land agent): grass tufts from CC0 scans (Poly Haven
# grass_medium_02, grass_medium_01, grass_bermuda_01: the steppe's bunch grasses, fine tufts and the short sward of the banks and
# bunds) and the project's own models of what the scans lack: cereal stubble (the stalks the sickle left, ~10-25 cm, in the
# sown rows) and dung (a cattle pat, donkey and horse droppings, sheep and goat pellets), all in one 2x2 atlas (the three grass
# scans' maps, and a painted cell of straw and dung), three levels each.
#   blender -b --factory-startup --python tools/blender/land_cover.py -- <out dir>
# Output: <out>/cover.glb (Draco; nodes <piece>__lod<k>, geometry only), cover_{diff,nor,arm}.jpg, cover.json.
import bpy, bmesh, sys, json, os, math, random
import numpy as np
from mathutils import Vector, Matrix, noise

OUT = sys.argv[sys.argv.index('--') + 1]
SRC = os.environ.get('SRC', 'T:/fars-assets-s12/models/polyhaven')
CELL, MARGIN = 1024, 24
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def tri_count(ob): return sum(len(p.vertices) - 2 for p in ob.data.polygons)
def load_img(path):
    img = bpy.data.images.load(path); w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(a); bpy.data.images.remove(img); return a.reshape(h, w, 4)
def resize(a, n):
    h, w = a.shape[:2]
    if h % n == 0 and w % n == 0: return a.reshape(n, h // n, n, w // n, 4).mean(axis=(1, 3))
    ys = (np.arange(n) * h / n).astype(int); xs = (np.arange(n) * w / n).astype(int); return a[ys][:, xs]
def cell_image(a): return np.pad(resize(a, CELL - 2 * MARGIN), ((MARGIN, MARGIN), (MARGIN, MARGIN), (0, 0)), mode='edge')

atlas = {k: np.zeros((2 * CELL, 2 * CELL, 4), dtype=np.float32) for k in ('diff', 'nor', 'arm')}
atlas['nor'][..., :] = (0.5, 0.5, 1.0, 1.0); atlas['arm'][..., :] = (1.0, 0.85, 0.0, 1.0)
def cell_uv(ci, u, v):
    cx, cy = ci % 2, ci // 2; inner = CELL - 2 * MARGIN
    return ((cx * CELL + MARGIN + min(1, max(0, u)) * inner) / (2 * CELL), (cy * CELL + MARGIN + min(1, max(0, v)) * inner) / (2 * CELL))
pieces, keep = [], []

def finish(ob, pid, lods, kind):
    # base at z = 0, footprint centred; levels decimated from the one before
    vs = [v.co for v in ob.data.vertices]; X = [v.x for v in vs]; Y = [v.y for v in vs]; Z = [v.z for v in vs]
    cx, cy, z0 = (min(X) + max(X)) / 2, (min(Y) + max(Y)) / 2, min(Z)
    for v in ob.data.vertices: v.co.x -= cx; v.co.y -= cy; v.co.z -= z0
    ob.data.update(); prev, tris = ob, {}
    for li, target in enumerate(lods):
        q = prev.copy(); q.data = prev.data.copy(); bpy.context.scene.collection.objects.link(q); prev = q
        r = min(1.0, target / max(1, tri_count(q)))
        if r < 1.0:
            m = q.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = r; m.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = q; bpy.ops.object.modifier_apply(modifier='dec')
        q.name = '%s__lod%d' % (pid, li); q.data.name = q.name; q.data.materials.clear(); tris['lod%d' % li] = tri_count(q); keep.append(q)
    size = [max(X) - min(X), max(Z) - min(Z), max(Y) - min(Y)]
    pieces.append({'id': pid, 'kind': kind, 'size_m': size, 'tris': tris}); print('[land_cover]', pid, kind, size, tris)
    bpy.data.objects.remove(ob, do_unlink=True)

# ------------------------------------------------------------------ the grass scans: each tuft of a file is a piece
# (source, kind, atlas cell, short id, how many of its tufts (the fullest), levels)
GRASS = [('grass_medium_02', 'tuft', 0, 'm2', 5, [1500, 320, 70]), ('grass_medium_01', 'tuft', 1, 'm1', 5, [900, 220, 50]), ('grass_bermuda_01', 'sward', 2, 'bm', 4, [300, 90, 30])]
for name, kind, ci, short, pick, lods in GRASS:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath='%s/%s/2k/%s.gltf' % (SRC, name, name))
    new = sorted([o for o in bpy.data.objects if o not in before and o.type == 'MESH'], key=lambda o: o.name)
    m = new[0].material_slots[0].material
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            p = bpy.path.abspath(n.image.filepath); k = 'diff' if 'diff' in p else 'nor' if 'nor' in p else 'arm' if 'arm' in p else None
            if k: cx, cy = ci % 2, ci // 2; atlas[k][cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL] = cell_image(load_img(p))
    bpy.ops.object.select_all(action='DESELECT')
    for o in new:
        o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    full = sorted(new, key=lambda o: -tri_count(o))[:pick]
    for i, o in enumerate(new):
        if o not in full: bpy.data.objects.remove(o, do_unlink=True); continue
        for d in o.data.uv_layers.active.data: d.uv = cell_uv(ci, d.uv[0], d.uv[1])
        finish(o, '%s_%s%c' % (kind, short, 97 + i), lods, kind)

# ------------------------------------------------------------------ cell 3: straw (left half) and dung (right half), painted
rng = np.random.default_rng(7)
H = W = CELL - 2 * MARGIN
yy, xx = np.mgrid[0:H, 0:W] / H
cellD = np.zeros((H, W, 4), dtype=np.float32); cellD[..., 3] = 1
cellA = np.ones((H, W, 4), dtype=np.float32); cellN = np.zeros((H, W, 4), dtype=np.float32); cellN[..., :] = (0.5, 0.5, 1, 1)
L = xx < 0.5
# straw: pale gold stalks with darker nodes every ~6 cm along v, streaks across (the stalks' fibres), sRGB
streak = 0.85 + 0.15 * np.sin(xx * 900 + rng.random((H, W)) * 0.5)
node = 1 - 0.35 * np.exp(-(((yy * 8) % 1) - 0.5) ** 2 / 0.002)
for c, v in enumerate((0.78, 0.68, 0.45)): cellD[..., c] = np.where(L, v * streak * node, cellD[..., c])
# dung: dark olive-brown, fibrous (chewed straw) and cracked; lighter dried crust
f = np.zeros((H, W)); a = 1.0
for s in (8, 16, 32, 64, 128):
    f += a * np.kron(rng.random((s, s)), np.ones((H // s + 1, W // s + 1)))[:H, :W]; a *= 0.55
f = (f - f.min()) / (f.max() - f.min())
fib = 0.9 + 0.1 * np.sin(yy * 1200 + xx * 300 + f * 20)
for c, v in enumerate((0.23, 0.19, 0.13)): cellD[..., c] = np.where(L, cellD[..., c], v * (0.75 + 0.5 * f) * fib)
cellA[..., 1] = np.where(L, 0.7, 0.85 - 0.25 * f)  # roughness: the fresh dung smoother
cx, cy = 1, 1
for k, im in (('diff', cellD), ('nor', cellN), ('arm', cellA)): atlas[k][cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL] = np.pad(im, ((MARGIN, MARGIN), (MARGIN, MARGIN), (0, 0)), mode='edge')

def mesh_from(bm, name):
    for f_ in bm.faces: f_.smooth = True
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); return ob

# stubble: the stalks of a sickle-cut cereal in their sown rows (~18 cm apart), cut 8-25 cm high (a sickle cuts under the ears,
# and the stubble was grazed and gleaned: C), a few leaning, broken or fallen; a 0.6 x 0.6 m patch
def stubble(seed, n):
    R = random.Random(seed); bm = bmesh.new(); uvl = bm.loops.layers.uv.new()
    for i in range(n):
        row = R.randrange(4); x = -0.27 + row * 0.18 + R.gauss(0, 0.025); y = R.uniform(-0.3, 0.3); h = R.uniform(0.08, 0.25) * (0.35 if R.random() < 0.12 else 1)
        lean = Vector((R.gauss(0, 0.18), R.gauss(0, 0.18), 1)).normalized(); r = R.uniform(0.0015, 0.0028); sides = 5
        base = Vector((x, y, 0)); top = base + lean * h
        ax = lean.cross(Vector((0, 0, 1))); ax = ax.normalized() if ax.length > 1e-4 else Vector((1, 0, 0)); ay = lean.cross(ax).normalized()
        ring = lambda c, rr: [bm.verts.new(c + (ax * math.cos(2 * math.pi * k / sides) + ay * math.sin(2 * math.pi * k / sides)) * rr) for k in range(sides)]
        r0, r1 = ring(base, r), ring(top, r * 0.9); u0 = R.uniform(0.02, 0.4)
        for k in range(sides):
            f_ = bm.faces.new((r0[k], r0[(k + 1) % sides], r1[(k + 1) % sides], r1[k]))
            for lp, (uu, vv) in zip(f_.loops, ((k / sides, 0), ((k + 1) / sides, 0), ((k + 1) / sides, h * 4), (k / sides, h * 4))): lp[uvl].uv = cell_uv(3, u0 + uu * 0.05, vv)
    # fallen straw lying on the ground
    for i in range(n // 5):
        x, y, a_ = R.uniform(-0.3, 0.3), R.uniform(-0.3, 0.3), R.uniform(0, math.pi); l = R.uniform(0.08, 0.3); d = Vector((math.cos(a_), math.sin(a_), 0)) * l / 2; s_ = Vector((-d.y, d.x, 0)).normalized() * 0.003
        c = Vector((x, y, 0.003)); vv = [bm.verts.new(c - d - s_), bm.verts.new(c + d - s_), bm.verts.new(c + d + s_), bm.verts.new(c - d + s_)]
        f_ = bm.faces.new(vv)
        for lp, (uu, v2) in zip(f_.loops, ((0.1, 0), (0.1, l * 4), (0.15, l * 4), (0.15, 0))): lp[uvl].uv = cell_uv(3, uu, v2)
    return bm
for i, n in enumerate((60, 45, 80)): finish(mesh_from(stubble(11 + i, n), 'stubble'), 'stubble_%c' % (97 + i), [n * 12, n * 5, n * 2], 'stubble')

# dung: a cattle pat (a lumpy disc, 18-28 cm, its rim coiled), a heap of donkey or horse droppings (lumpy balls, 5-7 cm), a
# scatter of sheep and goat pellets (1 cm)
def lumpy_ball(bm, uvl, c, r, R, sq=0.8, sub=1):
    geom = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    for v in geom['verts']:
        p = v.co.copy(); k = 1 + 0.18 * noise.noise(p * (6 / r) + Vector((R.random() * 9, 0, 0))); v.co = Vector((p.x * k, p.y * k, p.z * k * sq)) + c
    for f_ in {f for v in geom['verts'] for f in v.link_faces}:
        for lp in f_.loops: lp[uvl].uv = cell_uv(3, 0.55 + 0.4 * (0.5 + lp.vert.co.x * 3) % 0.4, (0.5 + lp.vert.co.y * 3) % 1)
def pat(seed):
    R = random.Random(seed); bm = bmesh.new(); uvl = bm.loops.layers.uv.new(); r = R.uniform(0.09, 0.14)
    g = bmesh.ops.create_circle(bm, cap_ends=True, segments=20, radius=r); bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    for v in bm.verts:
        d = v.co.length / r; v.co.z = 0.028 * max(0, 1 - d ** 2.2) * (1 + 0.25 * math.sin(d * 14)) + 0.004 * noise.noise(v.co * 40)
        v.co.x *= 1 + 0.12 * noise.noise(Vector((v.co.x, v.co.y, 1)) * 12); v.co.y *= 1 + 0.12 * noise.noise(Vector((v.co.x, v.co.y, 5)) * 12)
    for f_ in bm.faces:
        for lp in f_.loops: lp[uvl].uv = cell_uv(3, 0.55 + 0.4 * (lp.vert.co.x / r * 0.5 + 0.5), lp.vert.co.y / r * 0.5 + 0.5)
    return bm
def droppings(seed, n, r0, r1, spread, sq=0.8, sub=1):
    R = random.Random(seed); bm = bmesh.new(); uvl = bm.loops.layers.uv.new()
    for i in range(n):
        r = R.uniform(r0, r1); c = Vector((R.gauss(0, spread), R.gauss(0, spread), r * 0.6 * (1 + (0.8 if R.random() < 0.3 and n < 12 else 0))))
        lumpy_ball(bm, uvl, c, r, R, sq, sub)
    return bm
finish(mesh_from(pat(3), 'pat'), 'dung_pat', [900, 260, 40], 'dung')
finish(mesh_from(pat(5), 'pat'), 'dung_pat2', [900, 260, 40], 'dung')
finish(mesh_from(droppings(7, 7, 0.028, 0.036, 0.05), 'drop'), 'dung_horse', [560, 140, 36], 'dung')
finish(mesh_from(droppings(9, 18, 0.005, 0.007, 0.06, 0.85, 1), 'pell'), 'dung_sheep', [720, 180, 36], 'dung')

for k, a in atlas.items():
    img = bpy.data.images.new('cover_%s' % k, 2 * CELL, 2 * CELL, alpha=False)
    if k != 'diff': img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(np.ascontiguousarray(a, dtype=np.float32).ravel()); img.filepath_raw = os.path.join(OUT, 'cover_%s.jpg' % k); img.file_format = 'JPEG'; img.save(filepath=img.filepath_raw, quality=88)
bpy.ops.object.select_all(action='DESELECT')
for o in keep: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'cover.glb'), export_format='GLB', use_selection=True, export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                          export_apply=True, export_yup=True, export_tangents=False, export_materials='NONE', export_normals=True, export_texcoords=True)
json.dump({'pieces': pieces}, open(os.path.join(OUT, 'cover.json'), 'w'), indent=1)
print('[land_cover] done', len(pieces))
