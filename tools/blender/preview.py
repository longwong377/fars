# PARSA asset pipeline (D-305): node-side preview of a built GLB (screenshots find problems, tests measure). Renders the
# chosen level of detail from a 3/4 view in Cycles under one sun and a grey sky, in three modes side by side:
#   plain  - the level's geometry and normals only (what the game drew before the bake),
#   baked  - with the packed map: tangent-space normal (RGB) and ambient occlusion (A) multiplied into the albedo,
#   ao     - the occlusion alone.
# blender -b --factory-startup --python tools/blender/preview.py -- <glb> <out.png> [lod=0] [az=35] [el=20] [size=640] [device=CPU]
import bpy, sys, math, os
a = sys.argv[sys.argv.index('--') + 1:]
glb, out = a[0], a[1]
lod = int(a[2]) if len(a) > 2 else 0
az, el = (float(a[3]) if len(a) > 3 else 35.0), (float(a[4]) if len(a) > 4 else 20.0)
size = int(a[5]) if len(a) > 5 else 640
device = a[6] if len(a) > 6 else 'CPU'
zoom = float(a[7]) if len(a) > 7 else 1.0  # < 1: closer, aimed at the +x bull's head and chest
aim_x = float(a[8]) if len(a) > 8 else 0.55  # the aim's x as a fraction of the half-width
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.seed = 0
if device == 'GPU':
    p = bpy.context.preferences.addons['cycles'].preferences; p.compute_device_type = 'OPTIX'; p.get_devices()
    for d in p.devices: d.use = d.type == 'OPTIX'
    sc.cycles.device = 'GPU'
bpy.ops.import_scene.gltf(filepath=glb)
objs = [o for o in sc.objects if o.type == 'MESH']
keep = [o for o in objs if o.name.startswith(f'lod{lod}')]
for o in objs:
    if o not in keep: bpy.data.objects.remove(o, do_unlink=True)
o = keep[0]
# frame: bounding sphere
import mathutils
bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
c = sum(bb, mathutils.Vector()) / 8; r = max((v - c).length for v in bb)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 50; d = r / math.tan(math.radians(18)) * 1.05 * zoom
if zoom < 1: c = mathutils.Vector((c.x + aim_x * (max(v.x for v in bb) - c.x), c.y, c.z + 0.1 * r))
A, E = math.radians(az), math.radians(el)
cam.location = c + mathutils.Vector((d * math.sin(A) * math.cos(E), -d * math.cos(A) * math.cos(E), d * math.sin(E)))
cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 4; sun.data.angle = math.radians(0.5); sun.rotation_euler = (math.radians(50), 0, math.radians(az + 60))
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.35, 0.4, 0.5, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
sc.render.resolution_x = sc.render.resolution_y = size
sc.view_settings.view_transform = 'AgX'
mat = o.active_material; nt = mat.node_tree
img = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
nm = next(n for n in nt.nodes if n.type == 'NORMAL_MAP')
base = (0.62, 0.55, 0.45, 1)
mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
mix.inputs['A'].default_value = base
nt.links.new(img.outputs['Alpha'], mix.inputs['B'])
outs = []
for mode in ('plain', 'baked', 'ao'):
    for l in list(nt.links):
        if l.to_node == bsdf and l.to_socket.name in ('Normal', 'Base Color'): nt.links.remove(l)
    if mode == 'plain': bsdf.inputs['Base Color'].default_value = base
    if mode == 'baked': nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal']); nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    if mode == 'ao': nt.links.new(img.outputs['Alpha'], bsdf.inputs['Base Color'])
    sc.render.filepath = out.replace('.png', f'_{mode}.png'); bpy.ops.render.render(write_still=True); outs.append(sc.render.filepath)
# side by side
import numpy as np
ims = [bpy.data.images.load(p) for p in outs]; W, H = ims[0].size
px = [np.array(i.pixels[:], np.float32).reshape(H, W, 4) for i in ims]
sheet = bpy.data.images.new('sheet', W * 3, H); sheet.pixels.foreach_set(np.concatenate(px, axis=1).ravel())
sheet.filepath_raw = out; sheet.file_format = 'PNG'; sheet.save()
for p in outs: os.remove(p)
print('[preview]', out)
