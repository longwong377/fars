# Contact sheet of animal meshes (D-326): Workbench (fast, headless) or Cycles renders of PLY sources or built GLBs, side
# and three-quarter views, for looking at the modelled bodies before and after the bake. Not part of the build.
#   blender -b --factory-startup --python tools/blender/animals_preview.py -- <job.json>
# job.json: { "items": [{ "path": ply|glb, "label" }], "out": png, "engine": "WORKBENCH"|"CYCLES", "size": [w, h],
#             "views": ["side", "q34", "front"], "cols": n }
import bpy, sys, json, math, os
from mathutils import Vector

job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
W, H = job.get('size', [480, 360])
eng = job.get('engine', 'WORKBENCH')
sc.render.engine = 'BLENDER_WORKBENCH' if eng == 'WORKBENCH' else 'CYCLES'
if eng == 'WORKBENCH':
    sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'VERTEX'; sh.show_cavity = True; sh.cavity_type = 'BOTH'
    sh.show_shadows = True; sc.display.shadow_shift = 0.1
else:
    sc.cycles.samples = job.get('samples', 32); sc.cycles.use_denoising = True; sc.cycles.device = 'CPU'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.55, 0.62, 0.72, 1); bg.inputs[1].default_value = 0.6
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 4.5; sun.data.angle = 0.02
    sun.rotation_euler = (math.radians(50), 0, math.radians(35)); sc.collection.objects.link(sun)
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.film_transparent = False
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 50
views = job.get('views', ['side', 'q34'])
tiles = []
for it in job['items']:
    for o in list(bpy.data.objects):
        if o.type != 'CAMERA' and o.name != 'sun': bpy.data.objects.remove(o, do_unlink=True)
    p = it['path']
    if p.endswith('.ply'): bpy.ops.wm.ply_import(filepath=p)
    else: bpy.ops.import_scene.gltf(filepath=p)
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if it.get('only'): objs2 = [o for o in objs if o.name.startswith(it['only'])]; [bpy.data.objects.remove(o, do_unlink=True) for o in objs if o not in objs2]; objs = objs2
    for o in objs:
        for poly in o.data.polygons: poly.use_smooth = True
        if eng != 'WORKBENCH' and p.endswith('.ply') and len(o.data.color_attributes):
            m = bpy.data.materials.new('vc'); m.use_nodes = True; nt = m.node_tree
            a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = o.data.color_attributes[0].name
            nt.links.new(a.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color']); nt.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.85
            o.data.materials.clear(); o.data.materials.append(m)
    # ground
    bpy.ops.mesh.primitive_plane_add(size=20); gp = bpy.context.active_object
    if eng != 'WORKBENCH':
        gm = bpy.data.materials.new('g'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.35, 0.3, 0.24, 1); gp.data.materials.append(gm)
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for c in o.bound_box:
            v = o.matrix_world @ Vector(c); lo = Vector(map(min, lo, v)); hi = Vector(map(max, hi, v))
    ctr = (lo + hi) / 2; ext = max((hi - lo).length, 0.3)
    for vw in views:
        d = {'side': Vector((1, 0, 0.12)), 'q34': Vector((0.75, -0.75, 0.3)), 'front': Vector((0.1, -1, 0.15)), 'back': Vector((-0.6, 0.8, 0.3)), 'top': Vector((0.3, -0.3, 1)), 'head': Vector((1, -0.7, 0.15))}[vw].normalized()
        c0, e0 = ctr, ext
        if vw == 'head': d = Vector((1, -0.7, 0.15)).normalized(); c0 = Vector((ctr.x, lo.y + 0.16 * (hi.y - lo.y), lo.z + 0.78 * (hi.z - lo.z))); e0 = 0.42 * max(hi.y - lo.y, hi.z - lo.z)
        cam.location = c0 + d * e0 * 1.35
        cam.rotation_euler = (c0 - cam.location).to_track_quat('-Z', 'Y').to_euler()
        f = os.path.join(os.path.dirname(job['out']), f"_tile_{len(tiles)}.png"); sc.render.filepath = f
        bpy.ops.render.render(write_still=True); tiles.append((f, it.get('label', os.path.basename(p)) + ' ' + vw))
# compose the sheet
cols = job.get('cols', len(views))
rows = math.ceil(len(tiles) / cols)
import numpy as np
sheet = np.ones((rows * H, cols * W, 4), np.float32)
for i, (f, lab) in enumerate(tiles):
    im = bpy.data.images.load(f); px = np.array(im.pixels[:], np.float32).reshape(H, W, 4)
    r, c = i // cols, i % cols; sheet[(rows - 1 - r) * H:(rows - r) * H, c * W:(c + 1) * W] = px
    bpy.data.images.remove(im); os.remove(f)
out = bpy.data.images.new('sheet', cols * W, rows * H, alpha=True); out.pixels.foreach_set(sheet.ravel())
out.filepath_raw = job['out']; out.file_format = 'PNG'; out.save()
print('[preview] wrote', job['out'], len(tiles), 'tiles')
