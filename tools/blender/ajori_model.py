# PARSA (D-329): the Tol-e Ajori gate's model (exec'd by tools/blender/ajori.py after the tiles: job, OUT, ml, T, np, bpy,
# band_v, stats are in scope). See ajori.py for the frame and the sources.
import bmesh
from mathutils import Vector, Matrix
A = job['plan']
L, Wd = A['long'] / 2, A['short'] / 2
rl, rw = A['room'][0] / 2, A['room'][1] / 2
cw, TOP = A['corridorW'] / 2, A['height']
CORR_H, ROOM_H, FOUND = 7.5, 9.0, -0.6       # C (ajori.ts)
rng = np.random.default_rng(467)
sc = bpy.context.scene
for o in list(sc.objects): bpy.data.objects.remove(o, do_unlink=True)

def box_obj(name, x0, x1, y0, y1, z0, z1):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), (y0 + y1) / 2 + v.co.y * (y1 - y0), (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); return o

def apply_mods(o):
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

def join(objs, name):
    for x in list(sc.objects): x.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); objs[0].name = name; return objs[0]

def mat(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True; return m

# ---------------------------------------------------------------- the massing: a block pierced by the passage and the room
body = box_obj('body', -L, L, -Wd, Wd, FOUND, TOP)
for nm, b in (('corr', (-L - 1, L + 1, -cw, cw, FOUND - 1, CORR_H)), ('room', (-rl, rl, -rw, rw, FOUND - 1, ROOM_H))):
    cut = box_obj(nm, *b); mod = body.modifiers.new(nm, 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'EXACT'
    apply_mods(body); bpy.data.objects.remove(cut, do_unlink=True)
# the floor of the passage and the room at the base (z 0): a slab closes the cut below ground
parts = [body]
# benches along the room walls, broken by the corridor openings (existence B: TOLAJORI2017; 0.45 x 0.6 m C)
BH, BD = 0.45, 0.6
parts += [box_obj('b', -rl, rl, rw - BD, rw, 0, BH), box_obj('b', -rl, rl, -rw, -rw + BD, 0, BH)]
for s in (-1, 1):
    x0, x1 = (rl - BD, rl) if s > 0 else (-rl, -rl + BD)
    parts += [box_obj('b', x0, x1, cw, rw - BD, 0, BH), box_obj('b', x0, x1, -rw + BD, -cw, 0, BH)]
# stepped merlons along the roof edge (C: the Babylonian and Achaemenid stepped crenellation), 3 steps, some damaged
STEPS = [(1.10, 0.45), (0.74, 0.40), (0.38, 0.40)]; MD = 0.9; merl = {'n': 0, 'damaged': 0}
def merlon(cx, cy, along_x, inward):
    z = TOP; k = len(STEPS); r = rng.random()
    if r < 0.05: k = 1
    elif r < 0.17: k = 2
    if k < 3: merl['damaged'] += 1
    merl['n'] += 1
    for i, (w, hgt) in enumerate(STEPS[:k]):
        d = MD - 0.08 * i
        if along_x: o = box_obj('m', cx - w / 2, cx + w / 2, cy - (d if inward < 0 else 0), cy + (d if inward > 0 else 0), z, z + hgt)
        else: o = box_obj('m', cx - (d if inward < 0 else 0), cx + (d if inward > 0 else 0), cy - w / 2, cy + w / 2, z, z + hgt)
        parts.append(o); z += hgt
    if k < 3:  # the broken top: a few fallen bricks' worth of irregularity on the last step (C)
        parts[-1].location.z -= rng.uniform(0.03, 0.12)
u = -L + 0.6
while u + 1.1 < L - 0.5:
    merlon(u + 0.55, Wd, True, -1); merlon(u + 0.55, -Wd, True, 1); u += 2.2
v = -Wd + 2.8
while v + 1.1 < Wd - 2.2:
    merlon(L, v + 0.55, False, -1); merlon(-L, v + 0.55, False, 1); v += 2.2
body = join(parts, 'body')
for o in [body]:
    bpy.context.view_layer.objects.active = o; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# worn arrises: a 25 mm two-segment bevel on the sharp edges (the brick facing's corners rounded by 50-70 years)
bv = body.modifiers.new('bevel', 'BEVEL'); bv.width = 0.025; bv.segments = 2; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(40)
apply_mods(body)
# UV0: the brick module (u along the face, v up, in tiles of 2.070 x 1.140 m; horizontal faces in plan)
def planar_uv(o, uvname, sx, sy):
    me = o.data; uvl = me.uv_layers.get(uvname) or me.uv_layers.new(name=uvname)
    for p in me.polygons:
        n = p.normal
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if abs(n.z) > 0.7: uu, vv = co.x, co.y
            else:
                t = Vector((-n.y, n.x, 0)).normalized(); uu, vv = co.dot(t), co.z
            uvl.data[li].uv = (uu / sx, vv / sy)
planar_uv(body, 'UVMap', T.TW, T.TH)
body.data.materials.append(mat('brick'))

# ---------------------------------------------------------------- the glazed fields and the relief figures
PROUD = 0.012
FAC_ROWS = [('rosette', 0.95, 0.38), ('bull', 1.33, 1.14), ('gap', 2.47, 0.38), ('dragon', 2.85, 1.14), ('gap', 3.99, 0.38),
            ('bull', 4.37, 1.14), ('gap', 5.51, 0.38), ('dragon', 5.89, 1.14), ('rosette', 7.03, 0.38)]
COR_ROWS = [('rosette', 0.95, 0.38), ('bull', 1.33, 1.14), ('gap', 2.47, 0.38), ('dragon', 2.85, 1.14), ('rosette', 3.99, 0.38)]
gv = [], [], []   # verts, faces, uvs
def band(name, frac=1.0):
    b0, b1 = band_v('blue' if name == 'gap' else name)
    if name == 'gap': b1 = b0 + (b1 - b0) * frac
    return b0, b1
def quad(P0, r, n, t0, t1, z0, z1, u0, u1, v0, v1):
    V, F, U = gv; k = len(V)
    for (t, z) in ((t0, z0), (t1, z0), (t1, z1), (t0, z1)): V.append(P0 + r * t + Vector((0, 0, z)) + n * PROUD)
    F.append((k, k + 1, k + 2, k + 3)); U.append([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
# the figure meshes: the relief height field of each kind, gridded every 4 texels (8 mm) where the figure is, decimated
def figure_mesh(kind, target):
    h = np.load(f'{OUT}/hf_{kind}.npy'); m = np.load(f'{OUT}/fig_{kind}.npy')
    hb = ml.blur(np.clip(h, 0, None), 1.5)[::-1]; mb = ml.blur(m, 3.0)[::-1] > 0.02   # Blender order: row 0 = bottom
    S = 4; Hh, Ww = hb.shape; ys, xs = np.arange(0, Hh, S), np.arange(0, Ww, S)
    Z = hb[np.ix_(ys, xs)]; M = mb[np.ix_(ys, xs)]
    X, Y = np.meshgrid((xs + 0.5) * T.TW / Ww, (ys + 0.5) * T.TH / Hh)
    Z = np.where(M, Z, -0.002)
    o = ml.mesh_from_grid('fig_' + kind, X, Y, Z)
    bm = bmesh.new(); bm.from_mesh(o.data)
    keep = set()
    Mi = M.ravel(); nx = len(xs)
    dead = [f for f in bm.faces if not any(Mi[v.index] for v in f.verts)]
    bmesh.ops.delete(bm, geom=dead, context='FACES'); bm.to_mesh(o.data); bm.free()
    uvl = o.data.uv_layers.new(name='UVMap'); b0, b1 = band_v(kind)
    for li, lp in enumerate(o.data.loops):
        co = o.data.vertices[lp.vertex_index].co; uvl.data[li].uv = (co.x / T.TW, b0 + (b1 - b0) * co.y / T.TH)
    dm = o.modifiers.new('dec', 'DECIMATE'); dm.ratio = min(1.0, target / max(1, len(o.data.polygons) * 2)); dm.use_collapse_triangulate = True
    apply_mods(o); return o
FIG = {k: figure_mesh(k, job.get('figure_tris', 420)) for k in ('bull', 'dragon')}
figs = []
def place_figure(kind, P0, r, n, t_mouth, sign, k, z0):
    src = FIG[kind]; o = src.copy(); o.data = src.data.copy(); sc.collection.objects.link(o)
    # tile x -> t = t_mouth - sign (k+1) TW + sign x ; tile y -> z ; tile z (height) -> along n
    tx = t_mouth - sign * (k + 1) * T.TW
    base = P0 + r * tx + Vector((0, 0, z0)) + n * PROUD
    Mx = Matrix(((r.x * sign, 0, n.x, base.x), (r.y * sign, 0, n.y, base.y), (r.z * sign, 1, n.z, base.z), (0, 0, 0, 1)))
    o.matrix_world = Mx; figs.append(o)
def field(P0, r, n, t_a, t_b, t_mouth, rows):
    """a glazed field on the wall through P0 with right vector r and normal n, spanning t in [t_a, t_b]; the figures face the
    mouth end (t_mouth, one of t_a / t_b), whole tiles from it, the rest of a figure row plain blue"""
    sign = 1 if t_mouth == t_b else -1   # +1: the figures face +r
    nt = int((t_b - t_a) // T.TW)
    for name, z0, hgt in rows:
        if name in ('rosette', 'gap'):
            b0, b1 = band(name, hgt / 1.14)
            quad(P0, r, n, t_a, t_b, z0, z0 + hgt, sign * (t_a - t_mouth) / T.TW, sign * (t_b - t_mouth) / T.TW, b0, b1)
            continue
        b0, b1 = band(name)
        t_far = t_mouth - sign * nt * T.TW
        lo, hi = min(t_mouth, t_far), max(t_mouth, t_far)
        quad(P0, r, n, lo, hi, z0, z0 + hgt, sign * (lo - t_mouth) / T.TW, sign * (hi - t_mouth) / T.TW, b0, b1)
        bb0, bb1 = band('blue')
        if sign > 0 and lo > t_a + 0.01: quad(P0, r, n, t_a, lo, z0, z0 + hgt, t_a / T.TW, lo / T.TW, bb0, bb1)
        if sign < 0 and hi < t_b - 0.01: quad(P0, r, n, hi, t_b, z0, z0 + hgt, hi / T.TW, t_b / T.TW, bb0, bb1)
        for k in range(nt): place_figure(name, P0, r, n, t_mouth, sign, k, z0)
up = Vector((0, 0, 1)); nfields = 0
for s in (-1, 1):   # façades at x = s L, normal (s, 0, 0); the figures face the passage (C)
    n = Vector((s, 0, 0)); r = (-n).cross(up); P0 = Vector((s * L, 0, 0))
    for side in (-1, 1):
        a0, a1 = side * (cw + 0.45), side * (Wd - 0.75)          # v coordinates of the field's ends (mouth end first)
        ta, tb = a0 * r.y, a1 * r.y                              # t along r (r = (0, +-1, 0))
        field(P0, r, n, min(ta, tb), max(ta, tb), ta, FAC_ROWS); nfields += 1
    for side in (-1, 1):  # the corridor walls: at y = side cw, normal (0, -side, 0), x from s rl to s L; figures face the mouth (C)
        n = Vector((0, -side, 0)); r = (-n).cross(up); P0 = Vector((0, side * cw, 0))
        xa, xb = s * rl, s * (L - 0.45); ta, tb = xa * r.x, xb * r.x
        field(P0, r, n, min(ta, tb), max(ta, tb), tb, COR_ROWS); nfields += 1
V, F, U = gv
me = bpy.data.meshes.new('glaze'); me.from_pydata([tuple(v) for v in V], [], F); uvl = me.uv_layers.new(name='UVMap')
for fi, p in enumerate(me.polygons):
    for j, li in enumerate(p.loop_indices): uvl.data[li].uv = U[fi][j]
me.polygons.foreach_set('use_smooth', np.zeros(len(me.polygons), bool)); me.update()
gl = bpy.data.objects.new('glaze', me); sc.collection.objects.link(gl)
for o in figs:
    mirrored = o.matrix_world.determinant() < 0
    bpy.context.view_layer.objects.active = o
    for x in list(sc.objects): x.select_set(False)
    o.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if mirrored:  # a mirrored figure keeps its winding through transform_apply: reverse it so its faces look out of the wall
        bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.reverse_faces(bm, faces=bm.faces[:]); bm.to_mesh(o.data); bm.free(); o.data.update()
glaze = join([gl] + figs, 'glaze')
for k, o in FIG.items(): bpy.data.objects.remove(o, do_unlink=True)
# normals out of the wall (the mirrored figures were applied with a negative determinant: recalculated outward)
bpy.context.view_layer.objects.active = glaze
for x in list(sc.objects): x.select_set(False)
glaze.select_set(True)
out_ok = 0
for p in glaze.data.polygons:
    c = p.center; exp = Vector((math.copysign(1, c.x), 0, 0)) if abs(c.x) > L - 0.2 else Vector((0, -math.copysign(1, c.y), 0))
    out_ok += p.normal.dot(exp) > 0
stats['glaze_out_frac'] = out_ok / len(glaze.data.polygons); ml.log('glaze faces facing out of the wall', stats['glaze_out_frac'])
glaze.data.materials.append(mat('glaze'))
stats['figures'] = len(figs); stats['fields'] = nfields; stats['merlons'] = merl

# ---------------------------------------------------------------- the light map (UV1): AO over 4 m and the weathering
both = join([body, glaze], 'gate')
me = both.data; lm = me.uv_layers.new(name='light'); me.uv_layers.active = lm
bpy.context.view_layer.objects.active = both; bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.002, area_weight=0.0, scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')
LM = job.get('lightmap', 2048)
for m in me.materials:
    m.node_tree.nodes.clear(); out = m.node_tree.nodes.new('ShaderNodeOutputMaterial'); em = m.node_tree.nodes.new('ShaderNodeEmission')
    geo = m.node_tree.nodes.new('ShaderNodeNewGeometry'); m.node_tree.links.new(em.outputs[0], out.inputs[0]); m.node_tree.nodes.new('ShaderNodeTexImage')
def bake_self(kind, samples=1, ao=None, socket=None):
    img = bpy.data.images.new(kind, LM, LM, alpha=False, float_buffer=True); img.colorspace_settings.name = 'Non-Color'
    for m in me.materials:
        nt = m.node_tree; tn = [x for x in nt.nodes if x.type == 'TEX_IMAGE'][0]; tn.image = img; nt.nodes.active = tn
        if socket: nt.links.new([x for x in nt.nodes if x.type == 'NEW_GEOMETRY'][0].outputs[socket], [x for x in nt.nodes if x.type == 'EMISSION'][0].inputs[0])
    for x in list(sc.objects): x.select_set(False)
    both.select_set(True); bpy.context.view_layer.objects.active = both; sc.cycles.samples = samples
    if ao: sc.world.light_settings.distance = ao
    t = time.time(); bpy.ops.object.bake(type=kind, margin=6, use_clear=True, uv_layer='light'); ml.log('lightmap', kind, socket, f'{time.time() - t:.1f} s')
    px = np.empty(LM * LM * 4, np.float32); img.pixels.foreach_get(px); bpy.data.images.remove(img); return px.reshape(LM, LM, 4)[::-1]
aoL = bake_self('AO', job.get('ao_samples', 128), ao=4.0)[..., 0]
pos = bake_self('EMIT', 1, socket='Position')[..., :3]; nor = bake_self('EMIT', 1, socket='Normal')[..., :3]
X, Y, Z = pos[..., 0], pos[..., 1], pos[..., 2]; nz = nor[..., 2]
hcoord = X * 0.6 + Y * 0.8
f1 = lambda t: np.sin(t) * 0.55 + np.sin(t * 2.13 + 1.7) * 0.3 + np.sin(t * 4.71 + 0.4) * 0.15
g = np.ones_like(Z)
g *= 1 - 0.22 * np.clip(1 - Z / 1.1, 0, 1) ** 1.5 * (0.8 + 0.2 * f1(hcoord * 3.1))                     # damp and splash at the foot
streak = np.clip(f1(hcoord * 5.3) * 0.6 + f1(hcoord * 17.0 + 2) * 0.4, 0, 1)
g *= 1 - 0.14 * streak * np.clip((Z - 5.0) / 7.0, 0, 1) * (np.abs(nz) < 0.5)                              # run-off below the merlons
g *= np.where(nz > 0.7, 1.12 + 0.05 * f1(X * 0.7 + Y), 1.0)                                              # dust on the ledges and the roof
g *= 1 + 0.04 * f1(X * 0.41 + Z * 0.9 + Y * 0.37)                                                        # broad tone drift
valid = (np.abs(pos).sum(-1) > 1e-6)
aoL = np.where(valid, aoL, 1.0); g = np.where(valid, g, 1.0)
ml.write_png(f'{OUT}/light_a.png', ml.q8(np.stack([aoL, np.clip(g / 2, 0, 1), np.full_like(g, 0.5)], -1)))
stats['light'] = {'ao_mean': float(aoL[valid].mean()), 'ao_p05': float(np.percentile(aoL[valid], 5)), 'grime_mean': float(g[valid].mean()), 'fill': float(valid.mean())}
ml.log('light', stats['light'])
# separate again by material (UV0 first, 'light' second: TEXCOORD_0, TEXCOORD_1)
bpy.context.view_layer.objects.active = both; bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
objs = {}
for o in sc.objects:
    if o.type != 'MESH': continue
    nm = o.data.materials[0].name; o.name = 'body' if nm == 'brick' else 'glaze'; o.data.name = o.name; objs[o.name] = o
    o.data.uv_layers.active = o.data.uv_layers['UVMap']
    tm = o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh(); tm.calc_loop_triangles(); stats[f'tris_{o.name}'] = len(tm.loop_triangles)
ml.log('tris', {k: v for k, v in stats.items() if k.startswith('tris_')}, 'figures', len(figs))
for x in list(sc.objects): x.select_set(False)
for o in objs.values(): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=f'{OUT}/ajori.glb', export_format='GLB', use_selection=True, export_texcoords=True, export_normals=True,
                          export_materials='PLACEHOLDER', export_apply=True, export_yup=True, export_attributes=False, export_extras=False)
json.dump(stats, open(f'{OUT}/model_stats.json', 'w'), indent=1)

# ---------------------------------------------------------------- a preview render (Cycles, the player's lens), for the record
if job.get('preview'):
    def img(p, srgb=False):
        i = bpy.data.images.load(p); i.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'; return i
    def uvn(nt, name):
        u = nt.nodes.new('ShaderNodeUVMap'); u.uv_map = name; return u
    for o in objs.values():
        m = o.data.materials[0]; nt = m.node_tree; nt.nodes.clear(); out = nt.nodes.new('ShaderNodeOutputMaterial'); bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
        nt.links.new(bs.outputs[0], out.inputs[0]); u0, u1 = uvn(nt, 'UVMap'), uvn(nt, 'light')
        la = nt.nodes.new('ShaderNodeTexImage'); la.image = img(f'{OUT}/light_a.png'); nt.links.new(u1.outputs[0], la.inputs[0])
        sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(la.outputs[0], sep.inputs[0])
        pre = 'brick' if o.name == 'body' else 'glaze'
        cN = nt.nodes.new('ShaderNodeTexImage'); cN.image = img(f'{OUT}/{pre}_n.png'); nt.links.new(u0.outputs[0], cN.inputs[0])
        nm_ = nt.nodes.new('ShaderNodeNormalMap'); nm_.uv_map = 'UVMap'; nt.links.new(cN.outputs[0], nm_.inputs[1]); nt.links.new(nm_.outputs[0], bs.inputs['Normal'])
        cA = nt.nodes.new('ShaderNodeTexImage'); cA.image = img(f'{OUT}/{pre}_a.png'); nt.links.new(u0.outputs[0], cA.inputs[0])
        sa = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(cA.outputs[0], sa.inputs[0]); nt.links.new(sa.outputs[2], bs.inputs['Roughness'])
        cC = nt.nodes.new('ShaderNodeTexImage'); cC.image = img(f'{OUT}/{pre}_c.png', pre == 'glaze'); nt.links.new(u0.outputs[0], cC.inputs[0])
        mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs[0].default_value = 1.0
        if pre == 'brick':
            k = nt.nodes.new('ShaderNodeMix'); k.data_type = 'RGBA'; k.blend_type = 'MULTIPLY'; k.inputs[0].default_value = 1.0
            k.inputs[6].default_value = (0.62 * 2, 0.5 * 2, 0.36 * 2, 1); nt.links.new(cC.outputs[0], k.inputs[7]); base = k.outputs[2]
        else: base = cC.outputs[0]
        g2 = nt.nodes.new('ShaderNodeMath'); g2.operation = 'MULTIPLY'; g2.inputs[1].default_value = 2.0; nt.links.new(sep.outputs[1], g2.inputs[0])
        nt.links.new(base, mul.inputs[6]); nt.links.new(g2.outputs[0], mul.inputs[7]); nt.links.new(mul.outputs[2], bs.inputs['Base Color'])
    ground = box_obj('ground', -200, 200, -200, 200, -1, 0); gm = mat('ground'); ground.data.materials.append(gm)
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.32, 0.26, 0.19, 1)
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 5.0; sun.angle = math.radians(0.53); so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(55), 0, math.radians(35))
    wn = sc.world.node_tree.nodes if sc.world.use_nodes else None
    sc.world.use_nodes = True; bg = sc.world.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.45, 0.6, 0.85, 1); bg.inputs[1].default_value = 0.6
    cam = bpy.data.cameras.new('cam'); cam.angle = math.radians(70); co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720; sc.cycles.samples = job.get('preview_samples', 48); sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'AgX'
    for name, loc, look in (('far', (L + 38, 14, 1.6), (L, -2, 5)), ('near', (L + 7, 6.5, 1.6), (L, 5.5, 3.0)), ('corr', (L + 3, 0.2, 1.6), (0, cw, 2.2))):
        co.location = loc; d = Vector(look) - Vector(loc); co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = f'{OUT}/preview_{name}.png'; t = time.time(); bpy.ops.render.render(write_still=True); ml.log('preview', name, f'{time.time() - t:.0f} s')
