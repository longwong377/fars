# PARSA small life (D-332): contact sheets of the built life models, for checking by eye (not shipped):
#   blender -b --factory-startup --python tools/blender/life_preview.py -- <dir> <out.png> id [id ...]
# Each id's GLB (<dir>/<id>.glb) with its baked maps (<id>_albedo.png: RGB + coverage, <id>_nrm.png: normal + occlusion), one
# row per id: the nearest level in flight from above and behind, from below, the standing level (when there is one) from the
# side and at three quarters, and the far levels; each view framed on the object, perspective, Cycles CPU, a sky and a sun.
import bpy, sys, os, math
import numpy as np
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; d, out, ids = a[0], a[1], a[2:]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 32; sc.cycles.use_denoising = False
R = 360; sc.render.resolution_x = R; sc.render.resolution_y = R; sc.render.film_transparent = False; sc.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.63, 0.75, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.data.energy = 3.0; sun.rotation_euler = (math.radians(35), math.radians(10), math.radians(40))
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 50
gp = bpy.data.objects.new('ground', bpy.data.meshes.new('g')); gp.data.from_pydata([(-50, -50, 0), (50, -50, 0), (50, 50, 0), (-50, 50, 0)], [], [(0, 1, 2, 3)]); sc.collection.objects.link(gp)
gm = bpy.data.materials.new('gm'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.42, 0.36, 0.28, 1); gp.data.materials.append(gm)
VIEWS = os.environ.get('LIFE_VIEWS', 'fly0:above,fly0:below,stand0:side,stand0:q34,lod0:q34,lod0:side,lod0:above,lod1:q34,fly2:above')
def mat(idn):
    m = bpy.data.materials.new(idn); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    ia = nt.nodes.new('ShaderNodeTexImage'); ia.image = bpy.data.images.load(os.path.join(d, idn + '_albedo.png'))
    inn = nt.nodes.new('ShaderNodeTexImage'); inn.image = bpy.data.images.load(os.path.join(d, idn + '_nrm.png')); inn.image.colorspace_settings.name = 'Non-Color'
    nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(inn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs[0], b.inputs['Normal'])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 0.6
    nt.links.new(ia.outputs['Color'], mix.inputs[6]); nt.links.new(inn.outputs['Alpha'], mix.inputs[7]); nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    nt.links.new(ia.outputs['Alpha'], b.inputs['Alpha']); b.inputs['Roughness'].default_value = 0.85
    return m
def shoot(o, view):
    """render object o alone from a view direction, framed on its bounds"""
    for x in sc.objects:
        if x.type == 'MESH' and x is not gp: x.hide_render = x is not o
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]; c = sum(bb, Vector()) / 8; r = max((p - c).length for p in bb)
    dirs = {'above': (0.35, 0.75, 0.8), 'below': (0.3, 0.5, -0.9), 'side': (-1, 0.15, 0.12), 'q34': (-0.7, -0.6, 0.35), 'front': (0.2, -1, 0.25)}
    v = Vector(dirs[view]).normalized(); cam.location = c + v * r * 3.6; cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    gp.location = (0, 0, (min(p.z for p in bb) - 0.001) if view in ('side', 'q34', 'front') else -1000)
    p = out + '_shot.png'; sc.render.filepath = p; bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(p); px = np.array(im.pixels[:], np.float32).reshape(R, R, 4); bpy.data.images.remove(im); return px
rows = []
for idn in ids:
    for o in list(sc.objects):
        if o.type == 'MESH' and o is not gp: bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(d, idn + '.glb'))
    imp = {o.name.split('.')[0]: o for o in sc.objects if o.type == 'MESH' and o is not gp}; m = mat(idn)
    for o in imp.values(): o.data.materials.clear(); o.data.materials.append(m)
    views = [tuple(x.split(':')) for x in VIEWS.split(',')]; views = [(k, v) for k, v in views if k in imp][:5]
    tiles = [shoot(imp[k], v) for k, v in views]
    while len(tiles) < 5: tiles.append(np.ones((R, R, 4), np.float32) * 0.3)
    rows.append(np.concatenate(tiles, axis=1))
img = np.concatenate(rows[::-1], axis=0); H, W = img.shape[:2]
o = bpy.data.images.new('sheet', W, H, alpha=True); o.pixels.foreach_set(img.ravel()); o.filepath_raw = out; o.file_format = 'PNG'; o.save()
print('SHEET', out, W, H)
