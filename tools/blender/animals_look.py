# Textured contact sheet of built animals (s18 C14, D-790): Cycles renders of public/models/animals/<sp>.glb (lod0) with their
# decoded maps (albedo, tangent normal), side and three-quarter views on a sandy ground under a sun. Not part of the build.
#   blender -b --factory-startup --python tools/blender/animals_look.py -- <job.json>
# job.json: { "items": [{ "glb", "albedo": png, "nrm": png, "label" }], "out": png, "size": [w, h], "samples": n, "views": ["side", "q34"] }
import bpy, sys, json, math
from mathutils import Vector
job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = job.get('samples', 24); sc.cycles.use_denoising = False; sc.cycles.device = 'CPU'
W, H = job.get('size', [640, 420]); sc.render.resolution_x, sc.render.resolution_y = W, H; sc.render.film_transparent = False
sc.view_settings.view_transform = 'AgX'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.65, 0.85, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.8
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 4.5; sun.rotation_euler = (math.radians(50), 0, math.radians(35)); sc.collection.objects.link(sun)
gm = bpy.data.materials.new('ground'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.45, 0.36, 0.26, 1)
bpy.ops.mesh.primitive_plane_add(size=60); bpy.context.active_object.data.materials.append(gm)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 50
shots = []
for it in job['items']:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=it['glb'])
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.type == 'MESH' and not o.name.startswith('lod0'): o.hide_render = True
    body = next(o for o in new if o.type == 'MESH' and o.name.startswith('lod0'))
    m = bpy.data.materials.new('coat'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    ta = nt.nodes.new('ShaderNodeTexImage'); ta.image = bpy.data.images.load(it['albedo']); nt.links.new(ta.outputs['Color'], b.inputs['Base Color'])
    tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = bpy.data.images.load(it['nrm']); tn.image.colorspace_settings.name = 'Non-Color'
    nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = 0.8
    body.data.materials.clear(); body.data.materials.append(m)
    for p in body.data.polygons: p.use_smooth = True
    bb = [body.matrix_world @ Vector(c) for c in body.bound_box]; lo = Vector([min(v[i] for v in bb) for i in range(3)]); hi = Vector([max(v[i] for v in bb) for i in range(3)])
    shots.append((it.get('label', ''), new, lo, hi))
for o in bpy.data.objects: pass
import os
out = []
for i, (label, objs, lo, hi) in enumerate(shots):
    for o2 in [o for s in shots for o in s[1]]: o2.hide_render = o2 not in objs or (o2.type == 'MESH' and not o2.name.startswith('lod0'))
    c = (lo + hi) / 2; size = max(hi - lo)
    for v in job.get('views', ['side', 'q34']):
        az = {'side': 90, 'q34': 40, 'front': 0, 'back': 180}[v]
        d = size * 1.55; a = math.radians(az)
        cam.location = (c.x + d * math.sin(a), c.y - d * math.cos(a), c.z + size * 0.12)
        cam.rotation_euler = (Vector(c) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        p = job['out'].replace('.png', f'_{i}_{v}.png'); sc.render.filepath = p; bpy.ops.render.render(write_still=True); out.append(p)
print('[animals_look]', json.dumps(out))
