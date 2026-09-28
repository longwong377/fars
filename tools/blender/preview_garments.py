# Blender side of the garments' contact sheet (D-322): renders each costume PLY written by tools/blender/preview_garments.ts
# from the front, three-quarter, side and back in Cycles (CPU), a low sun and a sky, one row per figure, and packs the views
# into one sheet. The cloth is a matte sheen material in its vertex colour: what is seen is the geometry.
#   blender -b --factory-startup --python tools/blender/preview_garments.py -- <job.json> <out.png>
import bpy, sys, json, math, os
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0])); out_png = argv[1]
R = int(job.get('res', 420)); S = int(job.get('samples', 24))
rows = []
for it in job['items']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = S; sc.cycles.use_denoising = True
    sc.render.resolution_x = R; sc.render.resolution_y = int(R * 1.5)
    try: sc.view_settings.view_transform = 'AgX'
    except Exception: pass
    w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.5, 0.58, 0.7, 1); bg.inputs['Strength'].default_value = 0.5
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 4.0; sun.angle = math.radians(1.0); so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(58), 0, math.radians(-30))
    cam = bpy.data.cameras.new('cam'); cam.lens = 85; co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    bpy.ops.wm.ply_import(filepath=it['file']); ob = bpy.context.selected_objects[0]
    for p in ob.data.polygons: p.use_smooth = True
    m = bpy.data.materials.new('m'); m.use_nodes = True; nt = m.node_tree; pb = nt.nodes['Principled BSDF']
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = ob.data.color_attributes[0].name if ob.data.color_attributes else 'Col'
    nt.links.new(at.outputs['Color'], pb.inputs['Base Color']); pb.inputs['Roughness'].default_value = 0.85
    try: pb.inputs['Sheen Weight'].default_value = 0.3
    except Exception: pass
    ob.data.materials.append(m)
    gp = bpy.data.meshes.new('ground'); gp.from_pydata([(-3, -3, 0), (3, -3, 0), (3, 3, 0), (-3, 3, 0)], [], [(0, 1, 2, 3)]); g = bpy.data.objects.new('ground', gp); sc.collection.objects.link(g)
    gm = bpy.data.materials.new('g'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.35, 0.3, 0.25, 1); gp.materials.append(gm)
    tiles = []
    for k, ang in enumerate((0, 35, 90, 180)):
        a = math.radians(ang); d = float(job.get('d', 4.4)); tz = float(job.get('tz', 0.92))
        co.location = (d * math.sin(a), -d * math.cos(a), tz + 0.13)
        dv = np.array((0, 0, tz)) - np.array(co.location); yaw = math.atan2(dv[0], dv[1]); pitch = math.atan2(dv[2], math.hypot(dv[0], dv[1]))
        co.rotation_euler = (math.pi / 2 + pitch, 0, -yaw)
        f = os.path.join(os.path.dirname(out_png), '_' + os.path.basename(out_png)[:-4] + f'_{len(rows)}_{k}.png'); sc.render.filepath = f; bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(f); tiles.append(np.array(img.pixels[:], dtype=np.float32).reshape(sc.render.resolution_y, R, 4)); bpy.data.images.remove(img)
    rows.append(np.concatenate(tiles, axis=1)); print('[preview_garments]', it['label'], flush=True)
sheet = np.concatenate(rows[::-1], axis=0)
img = bpy.data.images.new('sheet', sheet.shape[1], sheet.shape[0], alpha=True); img.pixels = sheet.ravel(); img.filepath_raw = out_png; img.file_format = 'PNG'; img.save()
print('[preview_garments] sheet', out_png)
