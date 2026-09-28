# PARSA (D-329): the Ka'ba-ye Zardosht (exec'd by tools/blender/naqsh.py). Frame: X east, Y toward the cliff (the door side,
# the game's -z), Z up from the ground at its foot; glTF y-up gives the game (x, z, -y) = world offsets from (kx, gy, -ky).
# From naqsh.ts kaba() (sizes plain.json naqsh_e_rustam.kaba: 12 m tower on a triple-stepped base, 14.12 m with it, side
# 7.30 m, 30-step stair to a 1.7 x 0.87 m door; C where the game said C) and the monument's known form (B, SX: white limestone,
# dark stone blind windows; C here: their frames, the corner piers, the wall recesses' size and rows): the tower with slightly
# projecting corner piers, rows of small rectangular recesses over the walls (baked from real cut geometry), block joints in
# 0.95 m courses, the dentil cornice and roof slabs, the blind windows as dark stone frames round a sunk panel (two tiers of
# two on three faces, Q-078), the door frame, the stair between its side walls. Two meshes: white and dark, one baked atlas.
from mathutils import Vector, Matrix
K = job['kaba']; parts = {'white': [], 'dark': []}
for o in list(sc.objects):
    if o.name != 'facade': bpy.data.objects.remove(o, do_unlink=True)
keep_prev = [o for o in sc.objects]
S, nb, Ht = K['base_side_m'], K['base_steps'], K['height_m']
step = (K['height_with_base_m'] - Ht) / nb
def kbox(kind, cx, cy, cz, sx, sy, sz, bev=0.01):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts); bmesh.ops.translate(bm, vec=(cx, cy, cz), verts=bm.verts)
    if bev > 0: bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bev, segments=1, affect='EDGES', profile=0.5)
    me = bpy.data.meshes.new(kind); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(kind, me); sc.collection.objects.link(o); parts[kind].append(o); return o
for i in range(nb):   # the stepped base (inset 0.5 m per step, C); the lowest step runs 0.6 m below ground (as the game's)
    w = S + 2 * 0.5 * (nb - i); z0 = step * i - (0.6 if i == 0 else 0); z1 = step * (i + 1)
    kbox('white', 0, 0, (z0 + z1) / 2, w, w, z1 - z0, 0.02)
base = nb * step
kbox('white', 0, 0, base + (Ht - 0.8) / 2, S, S, Ht - 0.8, 0.015)                       # the tower
for sx in (-1, 1):
    for sy in (-1, 1): kbox('white', sx * (S / 2 - 0.3), sy * (S / 2 - 0.3), base + (Ht - 0.8) / 2, 0.62, 0.62, Ht - 0.8, 0.012)  # corner piers, 1 cm proud
kbox('white', 0, 0, base + Ht - 0.25, S + 0.5, S + 0.5, 0.5, 0.02)                       # cornice and roof slabs
for k in range(14):   # dentils under the cornice on four sides
    t = -S / 2 - 0.1 + (k + 0.5) * (S + 0.2) / 14
    for s in (-1, 1):
        kbox('white', t, s * (S / 2 + 0.08), base + Ht - 0.62, 0.22, 0.16, 0.24, 0); kbox('white', s * (S / 2 + 0.08), t, base + Ht - 0.62, 0.16, 0.22, 0.24, 0)
sill = 8.1; ns = K['stair_steps']; riser = sill / ns; tread = 0.3; sw = 1.6
for i in range(ns):   # the stair (door side, +Y)
    yc = S / 2 + (ns - i - 0.5) * tread; top = riser * (i + 1)
    kbox('white', 0, yc, (top - 0.3) / 2, sw, tread, top + 0.3, 0.006)
for s in (-1, 1): kbox('white', s * (sw / 2 + 0.2), S / 2 + ns * tread / 2, sill / 2, 0.4, ns * tread, sill, 0.015)
# the door (dark frame, the opening a dark recess)
dwk, dhk = K['door_w_m'], K['door_h_m']
kbox('dark', 0, S / 2 + 0.03, sill + dhk / 2, dwk + 0.4, 0.08, dhk + 0.4, 0.01)
kbox('dark', 0, S / 2 + 0.06, sill + dhk / 2, dwk, 0.04, dhk, 0.004)
# blind windows: a stepped dark frame round a sunk panel, two tiers of two on the three other faces
def window(face, u, zc):
    ww, wh = 0.8, 1.6
    for (dw_, dh_, out) in ((ww + 0.36, wh + 0.36, 0.04), (ww + 0.16, wh + 0.16, 0.07), (ww, wh, 0.02)):
        if face == 'S': kbox('dark', u, -S / 2 - out / 2, zc, dw_, out, dh_, 0.006)
        else: kbox('dark', (1 if face == 'E' else -1) * (S / 2 + out / 2), u, zc, out, dw_, dh_, 0.006)
for face in ('S', 'E', 'W'):
    for u in (-1.4, 1.4): window(face, u, base + 5.0); window(face, u, base + 8.6)
# ---- join per stone, one atlas for both
objs = {}
for kind, lst in parts.items():
    for x in list(sc.objects): x.select_set(False)
    for o in lst: o.select_set(True)
    bpy.context.view_layer.objects.active = lst[0]; bpy.ops.object.join(); o = lst[0]; o.name = 'kaba_' + kind; o.data.name = o.name
    m = bpy.data.materials.new(kind); m.use_nodes = True; o.data.materials.clear(); o.data.materials.append(m); m.node_tree.nodes.new('ShaderNodeTexImage'); objs[kind] = o
for x in list(sc.objects): x.select_set(False)
both = [objs['white'], objs['dark']]
wcopy = objs['white'].copy(); wcopy.data = objs['white'].data.copy(); sc.collection.objects.link(wcopy); dcopy = objs['dark'].copy(); dcopy.data = objs['dark'].data.copy(); sc.collection.objects.link(dcopy)
for o in both: o.select_set(True)
bpy.context.view_layer.objects.active = both[0]; bpy.ops.object.join(); low = both[0]; low.name = 'kaba'
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.003, scale_to_bounds=True); bpy.ops.object.mode_set(mode='OBJECT')
# ---- the high: the tower's four walls as carved height fields (1.5 cm): the recesses and the block joints cut in; the rest as
# modelled (the tower box itself left out of the high copy, so the walls' rays meet only the carved surface)
NW, NH, ND = 0.24, 0.42, 0.06   # the recesses (C): 24 x 42 cm, 6 cm deep
rng = np.random.default_rng(543)
wins = [(u, base + 5.0) for u in (-1.4, 1.4)] + [(u, base + 8.6) for u in (-1.4, 1.4)]
G = 0.015; nu, nz = int(S / G) + 1, int((Ht - 0.8) / G) + 1
U = -S / 2 + np.arange(nu) * G; Zs = base + np.arange(nz) * G
UU, ZZ = np.meshgrid(U, Zs)
def rectdepth(u0, u1, z0, z1, dep, ch=0.01):
    du = np.minimum(UU - u0, u1 - UU); dz = np.minimum(ZZ - z0, z1 - ZZ); d = np.minimum(du, dz)
    return dep * np.clip(d / ch, 0, 1)
walls = []
for face, n, t in (('S', Vector((0, -1, 0)), Vector((1, 0, 0))), ('N', Vector((0, 1, 0)), Vector((-1, 0, 0))), ('E', Vector((1, 0, 0)), Vector((0, 1, 0))), ('W', Vector((-1, 0, 0)), Vector((0, -1, 0)))):
    dep = np.zeros_like(UU)
    zz = base + 0.9
    while zz < base + Ht - 1.3:
        uu = -S / 2 + 0.9
        while uu < S / 2 - 0.85:
            uw = uu * (t.x + t.y)   # the along-wall coordinate is the same u for every face (symmetric layout)
            clear_win = face != 'N' and any(abs(uu - a_) < 0.85 and abs(zz - b_) < 1.25 for a_, b_ in wins)
            clear_door = face == 'N' and abs(uu) < 1.0 and zz > sill - 0.4
            if not clear_win and not clear_door: dep = np.maximum(dep, rectdepth(uu - NW / 2, uu + NW / 2, zz - NH / 2, zz + NH / 2, ND))
            uu += 0.62
        zz += 0.95
    rz = np.mod(ZZ - base, 0.95); jz = np.clip(1 - np.abs(rz - 0.0) / 0.012, 0, 1) + np.clip(1 - np.abs(rz - 0.95) / 0.012, 0, 1)
    course = np.floor((ZZ - base) / 0.95); ru = np.mod(UU + S / 2 - 0.6 + np.where(course % 2 == 1, 0.95, 0.0), 1.9)
    ju = np.clip(1 - np.minimum(ru, 1.9 - ru) / 0.012, 0, 1)
    dep = np.maximum(dep, 0.005 * np.clip(jz + ju, 0, 1))
    dep += 0.0015 * ml.noise2(rng, nz, nu, 2, 40)          # the dressed face's tooling (C)
    P0 = Vector((0, 0, 0)) + n * (S / 2)
    X = P0.x + t.x * UU - n.x * dep; Y = P0.y + t.y * UU - n.y * dep; Zc = ZZ
    o = ml.mesh_from_grid('wall_' + face, X, Y, Zc); o.data.update()
    # make the grid face outward
    bm = bmesh.new(); bm.from_mesh(o.data); bm.normal_update(); bm.faces.ensure_lookup_table()
    if bm.faces[0].normal.dot(n) < 0: bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bm.to_mesh(o.data); bm.free(); walls.append(o)
# the high copy without the tower box: rebuild from the white parts minus the tower (the tower is parts['white'][nb])
high = wcopy
bm = bmesh.new(); bm.from_mesh(high.data); bm.normal_update()
dead = [f for f in bm.faces if abs(f.calc_center_median().x) < S / 2 - 0.62 + 1e-3 and abs(abs(f.calc_center_median().y) - S / 2) < 0.002 and abs(f.normal.y) > 0.9 and base < f.calc_center_median().z < base + Ht - 0.8]
dead += [f for f in bm.faces if abs(f.calc_center_median().y) < S / 2 - 0.62 + 1e-3 and abs(abs(f.calc_center_median().x) - S / 2) < 0.002 and abs(f.normal.x) > 0.9 and base < f.calc_center_median().z < base + Ht - 0.8]
bmesh.ops.delete(bm, geom=dead, context='FACES'); bm.to_mesh(high.data); bm.free()
for x in list(sc.objects): x.select_set(False)
for o in [high, dcopy] + walls: o.select_set(True)
bpy.context.view_layer.objects.active = high; bpy.ops.object.join()
KW = job.get('kaba_tex', 2048)
nI = ml.bake_image('NORMAL', high, low, KW, KW, 1, cage=0.08, ray=0.16, margin=8)
aI = ml.bake_image('AO', high, low, KW, KW, job.get('ao_samples_facade', 96), cage=0.08, ray=0.16, ao_dist=0.8, margin=8)
cov = np.abs(nI[..., :3]).sum(-1) > 0.05; nI[~cov, :3] = (0.5, 0.5, 1.0); aoK = np.where(cov, aI[..., 0], 1.0)
ml.write_png(f'{OUT}/kaba_n.png', ml.q8(nI[..., :3])); ml.write_png(f'{OUT}/kaba_a.png', ml.q8(np.stack([aoK, np.full_like(aoK, 0.5), np.full_like(aoK, 0.5)], -1)))
bpy.data.objects.remove(high, do_unlink=True)
bpy.context.view_layer.objects.active = low; bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
meshes_ = [o for o in sc.objects if o.type == 'MESH' and o.data.materials and o not in keep_prev]
for i, o in enumerate(meshes_): o.name = f'tmp{i}'
for o in meshes_:
        o.name = 'kaba_' + o.data.materials[0].name; o.data.name = o.name
        tm = o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh(); tm.calc_loop_triangles(); stats['tris_' + o.name] = len(tm.loop_triangles)
stats['kaba'] = {'cover': float(cov.mean()), 'ao_mean': float(aoK[cov].mean()), 'recesses': len([1])}
ml.log('kaba', {k: v for k, v in stats.items() if k.startswith('tris_kaba')}, stats['kaba'])
if job.get('preview'):
    for o in keep_prev: o.hide_render = True
    for o in list(sc.objects):
        if o.name.startswith('kaba_') and o not in keep_prev: ml.preview_material(o, f'{OUT}/kaba_n.png', f'{OUT}/kaba_a.png', base=(0.7, 0.68, 0.62) if o.name.endswith('white') else (0.12, 0.11, 0.1))
    ml.preview_render(f'{OUT}/preview_kaba', [('near', (14, -10, 1.6), (0, 0, 7)), ('stair', (-6, 22, 1.6), (0, 3, 6))], sun_rot=(55, 0, 40))
    for o in keep_prev: o.hide_render = False
