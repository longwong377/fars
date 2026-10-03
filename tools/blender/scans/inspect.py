# PARSA s14 (D-365): look at a downloaded scan headless: import the GLB, join, report the bounding box, render workbench views.
#   blender -b --factory-startup --python tools/blender/scans/inspect.py -- <in.glb> <out_prefix> [views=side+,side-,front,top,back]
import bpy, sys, math, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]
src, outp = argv[0], argv[1]
views = (argv[2] if len(argv) > 2 else 'sidep,siden,front,top,back').split(',')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = ms[0]
if len(ms) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
lo = mathutils.Vector([min(v.co[i] for v in me.vertices) for i in range(3)]); hi = mathutils.Vector([max(v.co[i] for v in me.vertices) for i in range(3)])
print('[scan] verts', len(me.vertices), 'polys', len(me.polygons), 'min', [round(x, 3) for x in lo], 'max', [round(x, 3) for x in hi], flush=True)
c = (lo + hi) / 2; R = (hi - lo).length * 0.6
sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'SINGLE'
sc.display.shading.show_cavity = True; sc.render.resolution_x = 900; sc.render.resolution_y = 900
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = (hi - lo).length * 0.95
D = {'sidep': (0, 0, 1), 'siden': (0, 0, -1), 'front': (1, 0, 0), 'back': (-1, 0, 0), 'top': (0, 1, 0.001), 'q': (0.7, 0.2, 0.7)}
for v in views:
    d = mathutils.Vector(D[v]).normalized(); cam.location = c + d * R * 3
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); cam.data.clip_end = R * 10
    sc.render.filepath = f'{outp}_{v}.png'; bpy.ops.render.render(write_still=True)
print('[scan] done', flush=True)
