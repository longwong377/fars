# D-324 preview: the finished kit's pieces as the game places them, on a stand-in court facade (a 0.55 m wall under an
# eave of pole ends, a bench at its foot, a ladder, a street doorway with its jamb boards, threshold and doorsteps, and the
# brick courses where the plaster has fallen), rendered with Cycles, the baked AO and shade as the vertex colour.
# Evidence for review, never shipped. blender -b --factory-startup --python tools/blender/preview_housekit2.py -- <kit.json> <out.png> [view]
import bpy, json, sys, math
argv = sys.argv[sys.argv.index('--') + 1:]
kit = json.load(open(argv[0]))['pieces']; OUT = argv[1]; VIEW = argv[2] if len(argv) > 2 else 'wide'
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 64; sc.render.resolution_x = 1400; sc.render.resolution_y = 800
sc.view_settings.view_transform = 'AgX'
def mat(col, rough=0.9):
    m = bpy.data.materials.new('m'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'ao'; mu = nt.nodes.new('ShaderNodeMix'); mu.data_type = 'RGBA'; mu.blend_type = 'MULTIPLY'; mu.inputs[0].default_value = 1
    mu.inputs[6].default_value = (*col, 1); nt.links.new(a.outputs[0], mu.inputs[7]); nt.links.new(mu.outputs[2], b.inputs['Base Color']); b.inputs['Roughness'].default_value = rough; return m
M = {}
def m_(col): k = tuple(col); M.setdefault(k, mat(col)); return M[k]
def plain(col):
    m = bpy.data.materials.new('p'); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = 0.92; return m
def piece(name, O, X, Y, Z, col, flat=False):
    # world = O + X*x + Y*y + Z*z in game axes (y up); Blender = (x, -z, y)
    q = kit[name]; P = q['p']; n = len(P) // 3
    g = lambda v: (v[0], -v[2], v[1])
    V = []
    for k in range(n):
        x, y, z = P[k*3], P[k*3+1], P[k*3+2]
        V.append(g([O[j] + X[j] * x + Y[j] * y + Z[j] * z for j in range(3)]))
    F = [tuple(q['i'][t:t+3]) for t in range(0, len(q['i']), 3)]
    det = X[0] * (Y[1] * Z[2] - Y[2] * Z[1]) - X[1] * (Y[0] * Z[2] - Y[2] * Z[0]) + X[2] * (Y[0] * Z[1] - Y[1] * Z[0])
    if det < 0: F = [(a, c, b) for (a, b, c) in F]
    me = bpy.data.meshes.new(name); me.from_pydata(V, [], F); me.update(); ca = me.color_attributes.new('ao', 'FLOAT_COLOR', 'POINT')
    for k in range(n): a = q['ao'][k] * q['k'][k]; ca.data[k].color = (a, a, a, 1)
    for p in me.polygons: p.use_smooth = not flat
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob); me.materials.append(m_(col)); return ob
def box(c, s, col):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(c[0], -c[2], c[1])); o = bpy.context.active_object; o.scale = (s[0], s[2], s[1]); o.data.materials.append(plain(col)); return o
def pole(A, B, r, h, col, name='log0'):
    import mathutils
    d = mathutils.Vector(B) - mathutils.Vector(A); L = d.length; w = d / L
    up = mathutils.Vector((1, 0, 0)) if abs(w.y) > 0.9 else mathutils.Vector((0, 1, 0)); e1 = w.cross(up).normalized(); e2 = w.cross(e1)
    a = h * 6.283; X = (e1 * math.cos(a) + e2 * math.sin(a)) * r; Z = (-e1 * math.sin(a) + e2 * math.cos(a)) * r
    return piece(name, list(A), list(X), list(d), list(Z), col)
mud, wood, stone, brick = (0.56, 0.45, 0.33), (0.45, 0.37, 0.28), (0.53, 0.51, 0.47), (0.6, 0.5, 0.38)
# the court facade: wall along x, face at z = +0.275, 3.0 m tall; the roof over it with the eave oversailing toward +z
H = 3.0; box((0, H / 2, 0), (7, H, 0.55), mud)
# the brush layer and earth over the pole ends
box((0, H + 0.16 + 0.035, 0.1), (7.4, 0.07, 1.0), (0.52, 0.45, 0.31)); box((0, H + 0.16 + 0.07 + 0.09, 0.1), (7.4, 0.18, 1.0), mud)
for k in range(13):
    x = -3.3 + k * 0.55; r = 0.065 + 0.03 * ((k * 37) % 10) / 10; y = H + r
    # the body in the wall, the kit's end over the eave
    pole((x, y, -0.3), (x, y, 0.275), r, (k * 0.37) % 1, wood)
    L = 0.3 + 0.08 * ((k * 13) % 5) / 5
    pole((x, y, 0.275 - 0.05), (x, y, 0.275 + L), r, (k * 0.61) % 1, wood, name=f'pend{k % 3}')
# the bench at the foot, the ladder, the brick losses
piece('bench0', (-1.6, 0, 0.275 + 0.225), (1.6, 0, 0), (0, 0.42, 0), (0, 0, 0.45), mud)
for (x, v) in [(0.9, 0), (1.9, 1), (-2.8, 2)]:
    piece(f'bpl{v}', (x, 0.55, 0.2751 + 0.045), (1, 0, 0), (0, 1, 0), (0, 0, 1), mud); piece(f'bbr{v}', (x, 0.55, 0.2751 + 0.045), (1, 0, 0), (0, 1, 0), (0, 0, 1), brick)
# ladder leaning on the eave
import mathutils
foot = (2.9, 0.0, 1.2); top = (2.9, H + 0.4, 0.45)
for e in (-0.22, 0.22): pole((foot[0] + e, foot[1], foot[2]), (top[0] + e * 0.95, top[1], top[2]), 0.035, 0.3 + e, wood)
for i in range(10):
    t = (0.3 + i * 0.31) / (top[1] - foot[1]);
    if t > 0.97: break
    y = foot[1] + (top[1] - foot[1]) * t; z = foot[2] + (top[2] - foot[2]) * t
    pole((foot[0] - 0.235, y, z), (foot[0] + 0.235, y, z), 0.02, i * 0.13, wood, name=f'rung{i % 2}')
# ground
bpy.ops.mesh.primitive_plane_add(size=40); bpy.context.active_object.data.materials.append(plain((0.5, 0.44, 0.36)))
# a street doorway in a second wall, with jamb boards, threshold, doorsteps
box((-6.25, 1.5, 3.0), (2.5, 3.0, 0.7), mud); box((-3.6, 1.5, 3.0), (0.8, 3.0, 0.7), mud); box((-4.5, 2.57, 3.0), (1.0, 0.86, 0.7), mud)
piece('beam0', (-5.2, 2.0, 3.0 + 0.36), (1.4, 0, 0), (0, 0.14, 0), (0, 0, -0.72), wood)
for e, v in [(-5.06, 0), (-3.94, 1)]: piece(f'jamb{v}', (e, -0.02, 3.35 + 0.018), (0.12, 0, 0), (0, 2.02, 0), (0, 0, 0.05), wood, flat=True)
piece('sill0', (-4.5, -0.1, 3.0), (1.0, 0, 0), (0, 0.135, 0), (0, 0, 0.8), stone)
for e, v in [(-4.74, 1), (-4.26, 2)]: piece(f'stone{v}', (e, -0.06, 3.0 + 0.35 + 0.22), (0.46, 0, 0), (0, 0.15, 0), (0, 0, 0.4), stone)
sun = bpy.data.lights.new('s', 'SUN'); sun.energy = 2.6; sun.angle = 0.01; so = bpy.data.objects.new('s', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(50), 0, math.radians(-30))
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.5, 0.62, 0.8, 1); sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.7
cam = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
# views: (eye, target) in game axes (x along the wall, y up, z out of the court face), lens mm
views = {'wide': ((0.5, 1.7, 8.0), (0.0, 1.6, 0.0), 28), 'eave': ((-1.2, 2.2, 2.0), (-1.0, 3.15, 0.45), 30), 'foot': ((1.3, 1.0, 1.6), (1.35, 0.7, 0.3), 30),
         'door': ((-4.4, 1.5, 6.4), (-4.5, 1.2, 3.35), 30), 'ladder': ((1.6, 1.8, 3.2), (2.9, 1.6, 0.8), 28), 'bench': ((-0.4, 1.3, 2.4), (-1.6, 0.3, 0.5), 28)}
import mathutils
eye, tgt, lens = views[VIEW]; E = mathutils.Vector((eye[0], -eye[2], eye[1])); Tg = mathutils.Vector((tgt[0], -tgt[2], tgt[1]))
co.location = E; co.rotation_euler = (Tg - E).to_track_quat('-Z', 'Y').to_euler(); cam.lens = lens
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True); print('[preview]', OUT)
