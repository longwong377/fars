# D-311 preview: the kit's pieces on a stand-in wall (a crest run on a 0.7 m wall, a lintel log, a tannur, a door leaf),
# rendered with Cycles and the baked AO shown as the vertex colour. Evidence for review, never shipped.
import bpy, json, sys, math
argv = sys.argv[sys.argv.index('--') + 1:]
kit = json.load(open(argv[0]))['pieces']; OUT = argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.render.resolution_x = 1200; sc.render.resolution_y = 700
def mat(col):
    m = bpy.data.materials.new('m'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'ao'; mu = nt.nodes.new('ShaderNodeMix'); mu.data_type = 'RGBA'; mu.blend_type = 'MULTIPLY'; mu.inputs[0].default_value = 1
    mu.inputs[6].default_value = (*col, 1); nt.links.new(a.outputs[0], mu.inputs[7]); nt.links.new(mu.outputs[2], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.9; return m
def piece(name, loc, scale, col, rot=0):
    q = kit[name]; P = q['p']; n = len(P) // 3
    V = [(P[k*3] * scale[0], -P[k*3+2] * scale[2], P[k*3+1] * scale[1]) for k in range(n)]; F = [tuple(q['i'][t:t+3]) for t in range(0, len(q['i']), 3)]
    me = bpy.data.meshes.new(name); me.from_pydata(V, [], F); me.update(); ca = me.color_attributes.new('ao', 'FLOAT_COLOR', 'POINT')
    for k in range(n): a = q['ao'][k] * q['k'][k]; ca.data[k].color = (a, a, a, 1)
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob); ob.location = loc; ob.rotation_euler[2] = rot; me.materials.append(mat(col)); return ob
mud = (0.56, 0.45, 0.33)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.0)); w = bpy.context.active_object; w.scale = (6, 0.7, 2.0); w.data.materials.append(mat(mud))
for k in range(3): piece(f'crest{k}', (-2 + 2 * k, 0, 2.0), (1, 1, 0.77), mud)
piece('tannur0', (1.5, -1.3, 0), (0.82, 1, 0.82), (0.6, 0.47, 0.34))
piece('leaf1', (-1.5, -0.4, 0), (1, 1.95, 1), (0.53, 0.45, 0.35))
lg = piece('log0', (-2.5, -0.5, 2.1), (0.08, 3.0, 0.08), (0.5, 0.42, 0.33)); lg.rotation_euler = (0, math.pi / 2, 0)
bpy.ops.mesh.primitive_plane_add(size=30); bpy.context.active_object.data.materials.append(mat((0.5, 0.44, 0.36)))
sun = bpy.data.lights.new('s', 'SUN'); sun.energy = 4; so = bpy.data.objects.new('s', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(55), 0, math.radians(35))
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.5, 0.6, 0.75, 1); sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
cam = bpy.data.cameras.new('c'); cam.lens = 35; co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
co.location = (1.5, -5.5, 2.2); co.rotation_euler = (math.radians(82), 0, math.radians(8))
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True); print('[preview]', OUT)
