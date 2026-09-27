# Contact sheet of the garment drape (D-307; iteration, not evidence): for each simulation of a cloth job, the fitted
# procedural piece (left) and what Blender's cloth solver settled (right), on the reference body, front and three-quarter.
#   blender -b --factory-startup --python tools/blender/preview_cloth.py -- <job.json> <out.png> [key|group ...]
import bpy, sys, json, math, os
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0])); out_png = argv[1]; want = set(argv[2:])
R = 400
def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.use_denoising = True; sc.cycles.device = 'CPU'
    sc.render.resolution_x = sc.render.resolution_y = R
    w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.5, 0.55, 0.62, 1)
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.0; so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(55), 0, math.radians(30))
    cam = bpy.data.cameras.new('cam'); cam.lens = 50; co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    return sc, co
def mat(name, col):
    m = bpy.data.materials.new(name); m.use_nodes = True; p = m.node_tree.nodes['Principled BSDF']; p.inputs['Base Color'].default_value = (*col, 1); p.inputs['Roughness'].default_value = 0.8; return m
tiles = []
for S in job['sims']:
    if want and f"{S['key']}|{S['group']}" not in want: continue
    row = []
    for settled in (False, True):
        sc, co = setup()
        bpy.ops.wm.ply_import(filepath=S['body']); b = bpy.context.selected_objects[0]; b.data.materials.append(mat('skin', (0.55, 0.38, 0.28)))
        bpy.ops.wm.ply_import(filepath=S['cloth']); c = bpy.context.selected_objects[0]; c.data.materials.append(mat('cloth', (0.62, 0.2, 0.12)))
        co_arr = np.fromfile(S['cloth'].replace('.ply', '.settled.f32') if settled else S['target'], dtype=np.float32); c.data.vertices.foreach_set('co', co_arr); c.data.update()
        for p in c.data.polygons: p.use_smooth = True
        for p in b.data.polygons: p.use_smooth = True
        mid = co_arr.reshape(-1, 3).mean(0); ext = np.ptp(co_arr.reshape(-1, 3), 0).max()
        for k, ang in enumerate((0, 40)):
            a = math.radians(ang); d = max(1.2, ext * 2.6)
            co.location = (mid[0] + d * math.sin(a), mid[1] - d * math.cos(a), mid[2] + 0.1)
            dv = np.array(mid) - np.array(co.location); yaw = math.atan2(dv[0], dv[1]); pitch = math.atan2(dv[2], math.hypot(dv[0], dv[1]))
            co.rotation_euler = (math.pi / 2 + pitch, 0, -yaw)
            f = os.path.join(os.path.dirname(out_png), f'_c{len(tiles)}_{int(settled)}_{k}.png'); sc.render.filepath = f; bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(f); row.append(np.array(img.pixels[:], dtype=np.float32).reshape(R, R, 4)); bpy.data.images.remove(img)
    tiles.append(np.concatenate(row, axis=1)); print('[preview_cloth]', S['key'], S['group'], flush=True)
sheet = np.concatenate(tiles[::-1], axis=0)
img = bpy.data.images.new('sheet', sheet.shape[1], sheet.shape[0], alpha=True); img.pixels = sheet.ravel(); img.filepath_raw = out_png; img.file_format = 'PNG'; img.save()
print('[preview_cloth] sheet', out_png)
