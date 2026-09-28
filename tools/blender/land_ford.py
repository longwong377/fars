# The fords (session 12, D-335; plain/crossings.ts D-257): the causeway's river cobbles and the Kur's round hide boat, modelled
# for the project (no CC0 scan of a cobble causeway or a coracle exists):
#  - cobble tiles: 2 x 2 m of river cobbles (rounded, flattened by the water: 12-35 cm, a few larger) packed by dart throwing
#    at the causeway's density, settled into a bed of gravel; three variants; each cobble's colour a weathered limestone or
#    sandstone grey-brown (vertex colour) with the occlusion baked in (Cycles AO, vertex colour alpha -> 'ao' at runtime);
#  - the boat: a round hide boat (Herodotus 1.194: willow ribs covered with hides; C for its size here, 2.7 m, and its form), a
#    shallow bowl of ribs under the hide, the rim bound, lying upturned; its pole.
# Three levels each (lod0/1/2). Output: <out>/ford.glb (nodes <piece>__lod<k>, COLOR_0 = rgb x ao), ford.json.
#   blender -b --factory-startup --python tools/blender/land_ford.py -- <out dir>
import bpy, bmesh, sys, os, json, math, random
from mathutils import Vector, noise

OUT = sys.argv[sys.argv.index('--') + 1]
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
pieces, keep = [], []
def tri_count(ob): return sum(len(p.vertices) - 2 for p in ob.data.polygons)
def to_obj(bm, name):
    for f in bm.faces: f.smooth = True
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); return ob

COB = [(0.47, 0.44, 0.39), (0.39, 0.37, 0.33), (0.53, 0.50, 0.44), (0.44, 0.40, 0.34), (0.36, 0.33, 0.29)]  # river cobbles (the ford's COBBLE palette, sRGB)
def srgb2lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def cobble_tile(seed, sub, minr=0.0):
    R = random.Random(seed); bm = bmesh.new(); col = bm.loops.layers.color.new('Col')
    placed = []
    for t in range(4000):
        r = R.choice([R.uniform(0.06, 0.12), R.uniform(0.08, 0.17), R.uniform(0.15, 0.24)]) if R.random() < 0.97 else R.uniform(0.25, 0.32)
        x, y = R.uniform(-1 + r * 0.6, 1 - r * 0.6), R.uniform(-1 + r * 0.6, 1 - r * 0.6)
        if any((x - a) ** 2 + (y - b) ** 2 < (r + q) ** 2 * 0.5 for a, b, q in placed): continue
        placed.append((x, y, r))
    if minr: placed = [p for p in placed if p[2] >= minr]
    for (x, y, r) in placed:
        g = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1)
        ang = R.uniform(0, math.pi); sx, sy, sz = r * R.uniform(1.0, 1.35), r * R.uniform(0.8, 1.0), r * R.uniform(0.45, 0.7)
        c = COB[R.randrange(len(COB))]; k = R.uniform(0.88, 1.1)
        rgb = tuple(srgb2lin(min(1, v * k)) for v in c)
        vs = g['verts']
        for v in vs:
            p = v.co.copy(); w = 1 + 0.12 * noise.noise(p * 2.2 + Vector((seed, x * 7, y * 7)))
            q = Vector((p.x * sx * w, p.y * sy * w, p.z * sz * w)); ca, sa = math.cos(ang), math.sin(ang)
            v.co = Vector((x + q.x * ca - q.y * sa, y + q.x * sa + q.y * ca, max(-0.05, q.z + sz * 0.35)))
        for f in {f for v in vs for f in v.link_faces}:
            for lp in f.loops: lp[col] = (*rgb, 1.0)
    # the gravel bed between them: a gently bumped plate just under the cobbles' shoulders
    g = bmesh.ops.create_grid(bm, x_segments=8, y_segments=8, size=1.0)
    for v in g['verts']: v.co.z = 0.02 + 0.02 * noise.noise(v.co * 5)
    for f in {f for v in g['verts'] for f in v.link_faces}:
        for lp in f.loops: lp[col] = (srgb2lin(0.42), srgb2lin(0.39), srgb2lin(0.34), 1.0)
    return bm, len(placed)

def bake_ao(ob):
    # Cycles AO into the colour attribute's alpha (multiplied into rgb at export): the gaps between cobbles dark
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.device = 'CPU'
    me = ob.data
    if not me.color_attributes.get('AO'): me.color_attributes.new('AO', 'FLOAT_COLOR', 'CORNER')
    me.color_attributes.active_color = me.color_attributes['AO']
    mat = bpy.data.materials.new('ao'); mat.use_nodes = True; me.materials.clear(); me.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    sc.render.bake.target = 'VERTEX_COLORS'; bpy.ops.object.bake(type='AO')
    base, ao = me.color_attributes['Col'], me.color_attributes['AO']
    for i in range(len(base.data)):
        a = ao.data[i].color[0]; c = base.data[i].color; base.data[i].color = (c[0] * (0.35 + 0.65 * a), c[1] * (0.35 + 0.65 * a), c[2] * (0.35 + 0.65 * a), 1)
    me.color_attributes.remove(ao); me.color_attributes.active_color = me.color_attributes['Col']; me.materials.clear()

def levels(obs, pid, kind, size):
    tris = {}
    for li, ob in enumerate(obs): ob.name = '%s__lod%d' % (pid, li); ob.data.name = ob.name; tris['lod%d' % li] = tri_count(ob); keep.append(ob)
    pieces.append({'id': pid, 'kind': kind, 'size_m': size, 'tris': tris}); print('[land_ford]', pid, kind, tris)

for i in range(3):
    obs = []
    for sub, minr in ((2, 0.0), (1, 0.0), (1, 0.13)): # (Blender's icosphere: 1 = the 20-face icosahedron, 2 = 80)
        bm, n = cobble_tile(101 + i, sub, minr); ob = to_obj(bm, 'tile'); obs.append(ob)
    # the far level: the gravel plate and the larger cobbles only (every cobble at 20 triangles would still be ~1.5 k)
    bake_ao(obs[0]); bake_ao(obs[1])
    bake_ao(obs[2])
    levels(obs, 'cobbles_%c' % (97 + i), 'cobbles', [2, 0.3, 2])

# the boat: a shallow round bowl (radius 1.35 m, 0.55 m deep) of hides over willow ribs, upturned (dome up), the rim bound
def boat(seg, rings, ribs):
    bm = bmesh.new(); col = bm.loops.layers.color.new('Col'); R0, D = 1.35, 0.55
    hide = tuple(srgb2lin(v) for v in (0.40, 0.30, 0.21)); rim = tuple(srgb2lin(v) for v in (0.33, 0.25, 0.17))
    verts = []
    for j in range(rings + 1):
        t = j / rings; ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg; r = R0 * math.sin(t * math.pi / 2) ** 0.8
            z = D * math.cos(t * math.pi / 2) ** 1.4
            # the hide sags between the ribs and wrinkles at the seams (C)
            rib = abs(math.cos(a * ribs / 2)) ** 8; sag = (1 - rib) * 0.018 * math.sin(t * math.pi)
            rr = r - sag + 0.006 * noise.noise(Vector((math.cos(a) * 3, math.sin(a) * 3, t * 5)))
            ring.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, z + 0.02)))
        verts.append(ring)
    for j in range(rings):
        for i in range(seg):
            f = bm.faces.new((verts[j][i], verts[j][(i + 1) % seg], verts[j + 1][(i + 1) % seg], verts[j + 1][i]))
            for lp in f.loops: lp[col] = (*(rim if j == rings - 1 else hide), 1)
    top = bm.verts.new((0, 0, D + 0.02))
    for i in range(seg):
        f = bm.faces.new((top, verts[0][(i + 1) % seg], verts[0][i]))
        for lp in f.loops: lp[col] = (*hide, 1)
    # the bound rim: a roll of withies round the edge
    g = bmesh.ops.create_circle(bm, cap_ends=False, segments=seg, radius=R0 + 0.03)
    for v in g['verts']: v.co.z = 0.03
    ext = bmesh.ops.extrude_edge_only(bm, edges=list({e for v in g['verts'] for e in v.link_edges}))
    for v in [x for x in ext['geom'] if isinstance(x, bmesh.types.BMVert)]: v.co.z = 0.1; v.co.x *= 0.985; v.co.y *= 0.985
    for f in bm.faces:
        if not f.loops[0][col][3]:
            for lp in f.loops: lp[col] = (*rim, 1)
    return bm
obs = [to_obj(boat(s, r, rb), 'boat') for s, r, rb in ((48, 10, 16), (24, 5, 16), (12, 3, 16))]
for ob in obs[:2]: bake_ao(ob)
levels(obs, 'coracle', 'boat', [2.76, 0.6, 2.76])

bpy.ops.object.select_all(action='DESELECT')
for o in keep: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'ford.glb'), export_format='GLB', use_selection=True, export_draco_mesh_compression_enable=False,
                          export_apply=True, export_yup=True, export_materials='NONE', export_normals=True, export_texcoords=False, export_vertex_color='ACTIVE')
json.dump({'pieces': pieces}, open(os.path.join(OUT, 'ford.json'), 'w'), indent=1)
print('[land_ford] done', len(pieces))
