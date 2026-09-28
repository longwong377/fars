# A contact sheet of prop GLBs (session 12, D-325): every GLB given, its levels side by side (lod0 left, lod1 right; the
# modelled props' parts together), in one Cycles CPU render with a sun and a sky, each prop scaled to a common height so the
# forms can be compared, with its true height printed to stdout.
#   blender -b --factory-startup --python tools/blender/preview_props.py -- out.png a.glb b.glb ...
# Iteration only (renders go to T:, never to git).
import bpy, sys, math, os
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
out, files = args[0], args[1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
cols = max(1, math.ceil(math.sqrt(len(files) * 1.6)))
cell = 1.5
for i, f in enumerate(files):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f)
    new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    for lod in ('lod0', 'lod1'):
        obs = [o for o in new if o.name.split('.')[0] == lod or o.name.startswith(lod + '_') or o.name == lod]
        if not obs: continue
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in obs for c in o.bound_box]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        size = hi - lo; s = float(os.environ.get('FIT', '0.62')) / max(size.x, size.y, size.z, 1e-6)
        print('[preview]', os.path.basename(f), lod, 'size %.3f %.3f %.3f' % (size.x, size.y, size.z), 'tris', sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in obs))
        cx, cy = (i % cols) * cell * 1.0, -(i // cols) * cell
        off = Vector((cx + (0 if lod == 'lod0' else 0.68), cy, 0))
        for o in obs:
            o.matrix_world = o.matrix_world.copy()
            o.location = (o.location - Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))) * s + off
            o.scale = o.scale * s
    for o in new:
        if not (o.name.startswith('lod0') or o.name.startswith('lod1')): bpy.data.objects.remove(o, do_unlink=True)
        elif os.environ.get('NOAO'):
            for a in list(o.data.color_attributes): o.data.color_attributes.remove(a)
# ground, light, camera
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
g = bpy.context.active_object; gm = bpy.data.materials.new('ground'); gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.35, 0.33, 0.3, 1); g.data.materials.append(gm)
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.5; sun.angle = 0.05
so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(50), 0, math.radians(35))
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.62, 0.75, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7; sc.world = w
rows = math.ceil(len(files) / cols)
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = max(cols * cell, rows * cell * 1.78) * 1.02
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co)
mx, my = (cols - 1) * cell / 2 + 0.34, -(rows - 1) * cell / 2
co.location = (mx, my - 30, 22); co.rotation_euler = (math.radians(55), 0, 0)
az = math.radians(float(os.environ.get('AZ', '25'))); el = math.radians(float(os.environ.get('EL', '32')))
co.location = Vector((mx, my, 0.2)) + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * 40
co.rotation_euler = (math.pi / 2 - el, 0, az)
sc.camera = co
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = int(os.environ.get('SAMPLES', '24')); sc.cycles.use_denoising = False
sc.render.resolution_x = int(os.environ.get('W', '1920')); sc.render.resolution_y = int(os.environ.get('H', '1080'))
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('[preview] wrote', out)
