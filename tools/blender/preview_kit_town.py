# D-802: a preview render of the town kit (tools/blender/kit_town.py's kit.json): each piece at a real size in a row, lit by a
# low sun, coloured mud plaster x its shade x its baked AO. `bpy_cli.sh -b --python tools/blender/preview_kit_town.py -- kit.json out.png`
import bpy, json, sys, math
argv = sys.argv[sys.argv.index('--') + 1:]
KIT, OUT = argv[0], argv[1]
PART = int(argv[2]) if len(argv) > 2 else -1  # 0: the walls and their parts, 1: the rest
P = json.load(open(KIT))['pieces']
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.device = 'CPU'
sc.render.resolution_x, sc.render.resolution_y = 1600, 700
# real sizes (game x, y, z in m) and a place in the row
SIZE = {'wall': (2, 2.8, 0.5), 'wallworn': (2, 2.8, 0.5), 'walllaced': (2, 2.8, 0.5), 'corner': (0.5, 2.8, 0.5), 'foot': (2, 0.5, 0.55), 'doorframe': (1, 1.9, 0.5),
        'window': (0.45, 0.35, 0.5), 'parapet': (2, 0.4, 0.5), 'roof': (1, 1, 1), 'hatch': (1, 1, 1), 'ladder': (0.45, 3, 1), 'steps': (1, 0.6, 0.9), 'awning': (1, 1, 1)}
mat = bpy.data.materials.new('kit'); mat.use_nodes = True; nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
a = nt.nodes.new('ShaderNodeAttribute'); a.attribute_name = 'ao'; s = nt.nodes.new('ShaderNodeAttribute'); s.attribute_name = 'shade'
m1 = nt.nodes.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; nt.links.new(a.outputs['Fac'], m1.inputs[0]); nt.links.new(s.outputs['Fac'], m1.inputs[1])
mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
mix.inputs['A'].default_value = (0.42, 0.33, 0.22, 1); nt.links.new(m1.outputs[0], mix.inputs['B'])
nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = 0.95
x = 0.0
names = [n for n in P if not n.endswith(('_l1', '_l2'))]
WALLS = ('wall', 'corner', 'foot')
if PART == 0: names = [n for n in names if n.startswith(WALLS)]
elif PART == 1: names = [n for n in names if not n.startswith(WALLS)]
for n in names:
    q = P[n]; kind = next(k for k in sorted(SIZE, key=len, reverse=True) if n.startswith(k)); sx, sy, sz = SIZE[kind]
    vs = [(q['p'][i * 3] * sx, -q['p'][i * 3 + 2] * sz, q['p'][i * 3 + 1] * sy) for i in range(len(q['p']) // 3)]
    fs = [tuple(q['i'][t * 3:t * 3 + 3]) for t in range(len(q['i']) // 3)]
    me = bpy.data.meshes.new(n); me.from_pydata(vs, [], fs); me.update()
    for p in me.polygons: p.use_smooth = True
    for nm, arr in (('ao', q['ao']), ('shade', q['k'])):
        at = me.attributes.new(nm, 'FLOAT', 'POINT')
        for i, v in enumerate(arr): at.data[i].value = v
    me.materials.append(mat); ob = bpy.data.objects.new(n, me); sc.collection.objects.link(ob)
    lift = 1.6 if kind == 'window' else 0.0
    ob.location = (x - min(v[0] for v in vs), 0, lift); x += (max(v[0] for v in vs) - min(v[0] for v in vs)) + 0.6
bpy.ops.mesh.primitive_plane_add(size=200, location=(x / 2, 0, 0))
g = bpy.context.active_object; gm = bpy.data.materials.new('g'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.35, 0.3, 0.24, 1); g.data.materials.append(gm)
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 4; so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(72), 0, math.radians(-78))  # a raking afternoon sun
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.5, 0.6, 0.75, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8; sc.world = w
cam = bpy.data.cameras.new('c'); cam.lens = 24; co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co)
co.location = (x / 2, -max(6.0, x * 0.55), 2.6); co.rotation_euler = (math.radians(84), 0, 0); sc.camera = co
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
print('[preview] wrote', OUT)
