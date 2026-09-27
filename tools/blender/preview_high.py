# PARSA asset pipeline (D-306): a node-side look at a SOURCE surface (the dense high.ply the bake reads), to check the carving
# layer (tools/blender/lib/carving.ts) before a bake: the motifs' placement against the photographs. Screenshots find
# problems; the build's tests measure.
#   blender -b --factory-startup --python tools/blender/preview_high.py -- <high.ply> <out.png> <views json> [size=900]
# views: [[target x, y, z (game axes), azimuth deg (0 = looking from +z toward -z, 90 = from +x), elevation deg, distance], ...]
# rendered side by side, Cycles CPU, one low sun raking across the surface (the carving reads in raking light).
import bpy, sys, math, json, os
import numpy as np, mathutils
a = sys.argv[sys.argv.index('--') + 1:]
ply, out, views = a[0], a[1], json.loads(a[2])
size = int(a[3]) if len(a) > 3 else 900
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.seed = 0; sc.cycles.use_denoising = False
bpy.ops.wm.ply_import(filepath=ply)
o = bpy.context.selected_objects[0]
bpy.context.view_layer.objects.active = o
try: bpy.ops.mesh.customdata_custom_splitnormals_clear()
except Exception: pass
bpy.ops.object.shade_smooth()
m = bpy.data.materials.new('stone'); m.use_nodes = True
b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (0.62, 0.55, 0.45, 1); b.inputs['Roughness'].default_value = 0.8
o.data.materials.append(m)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 50
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.data.energy = 4.5; sun.data.angle = math.radians(1)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.4, 0.45, 0.55, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
sc.render.resolution_x = sc.render.resolution_y = size; sc.view_settings.view_transform = 'AgX'
g2b = lambda p: mathutils.Vector((p[0], -p[2], p[1]))  # game (x, y, z) -> Blender (x, -z, y)
tiles = []
for i, (tx, ty, tz, az, el, dist) in enumerate(views):
    t = g2b((tx, ty, tz)); A, E = math.radians(az), math.radians(el)
    dirg = (math.sin(A) * math.cos(E), math.sin(E), math.cos(A) * math.cos(E))  # from the target toward the camera, game axes
    cam.location = t + g2b(dirg) * dist
    cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sun.rotation_euler = (math.radians(60), 0, math.radians(-az + 150))  # raking, from the upper side
    p = out.replace('.png', f'_{i}.png'); sc.render.filepath = p; bpy.ops.render.render(write_still=True); tiles.append(p)
ims = [bpy.data.images.load(p) for p in tiles]; W, H = ims[0].size
px = [np.array(im.pixels[:], np.float32).reshape(H, W, 4) for im in ims]
sheet = bpy.data.images.new('sheet', W * len(px), H); sheet.pixels.foreach_set(np.concatenate(px, axis=1).ravel())
sheet.filepath_raw = out; sheet.file_format = 'PNG'; sheet.save()
for p in tiles: os.remove(p)
print('[preview_high]', out)
