# Blender side of the people's contact sheet (D-307; iteration, not evidence): renders each OBJ written by
# tools/blender/preview_people.ts from the front, three-quarter and profile in Cycles (CPU), a sun and a sky, the hair cards
# textured from the strand atlas (R shade, G depth, A coverage) in a dark brown, and packs the views into one sheet.
#   blender -b --factory-startup --python tools/blender/preview_people.py -- <preview_job.json>
import bpy, sys, json, math, os
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0]))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; cy = sc.cycles; cy.device = 'CPU'; cy.samples = int(job.get('samples', 48)); cy.use_denoising = True
cy.max_bounces = 4; cy.transparent_max_bounces = 32
R = int(job.get('res', 480)); sc.render.resolution_x = sc.render.resolution_y = R
try: sc.view_settings.view_transform = 'AgX'
except Exception: pass
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.45, 0.55, 0.7, 1); bg.inputs['Strength'].default_value = 0.6
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.5; sun.angle = math.radians(1.5); so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(50), 0, math.radians(35))
atlas = bpy.data.images.load(job['atlas']); atlas.colorspace_settings.name = 'Non-Color'; atlas.alpha_mode = 'STRAIGHT'
HAIR = job.get('hair', (0.045, 0.03, 0.02))

def body_mat():
    m = bpy.data.materials.new('body'); m.use_nodes = True; N = m.node_tree.nodes; L = m.node_tree.links; p = N['Principled BSDF']
    a = N.new('ShaderNodeVertexColor'); a.layer_name = 'Color'; L.new(a.outputs['Color'], p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = 0.55
    try: p.inputs['Subsurface Weight'].default_value = 0.15; p.inputs['Subsurface Radius'].default_value = (0.004, 0.0016, 0.0008)
    except Exception: pass
    return m
def card_mat():
    m = bpy.data.materials.new('cards'); m.use_nodes = True; N = m.node_tree.nodes; L = m.node_tree.links; p = N['Principled BSDF']
    t = N.new('ShaderNodeTexImage'); t.image = atlas; t.interpolation = 'Linear'
    sep = N.new('ShaderNodeSeparateColor'); L.new(t.outputs['Color'], sep.inputs['Color'])
    vc = N.new('ShaderNodeVertexColor'); vc.layer_name = 'Color'; sv = N.new('ShaderNodeSeparateColor'); L.new(vc.outputs['Color'], sv.inputs['Color'])
    # shade x 2 x (0.55 + 0.45 depth) x ao x hair colour
    m1 = N.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; m1.inputs[1].default_value = 2.0; L.new(sep.outputs[0], m1.inputs[0])
    d = N.new('ShaderNodeMapRange'); d.inputs['To Min'].default_value = 0.55; L.new(sep.outputs[1], d.inputs['Value'])
    m2 = N.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; L.new(m1.outputs[0], m2.inputs[0]); L.new(d.outputs['Result'], m2.inputs[1])
    m3 = N.new('ShaderNodeMath'); m3.operation = 'MULTIPLY'; L.new(m2.outputs[0], m3.inputs[0]); L.new(sv.outputs[0], m3.inputs[1])
    mc = N.new('ShaderNodeMix'); mc.data_type = 'RGBA'; mc.blend_type = 'MULTIPLY'; mc.inputs['Factor'].default_value = 1
    mc.inputs[6].default_value = (*HAIR, 1); cc = N.new('ShaderNodeCombineColor'); [L.new(m3.outputs[0], cc.inputs[k]) for k in range(3)]
    L.new(cc.outputs['Color'], mc.inputs[7]); L.new(mc.outputs[2], p.inputs['Base Color'])
    L.new(t.outputs['Alpha'], p.inputs['Alpha']); p.inputs['Roughness'].default_value = 0.45
    return m
BM, CM = body_mat(), card_mat()
cam = bpy.data.cameras.new('cam'); cam.lens = 85; co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
tiles = []
for it in job['items']:
    for o in list(sc.objects):
        if o.type == 'MESH': bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.wm.obj_import(filepath=it['obj'], forward_axis='Y', up_axis='Z')
    for o in sc.objects:
        if o.type != 'MESH': continue
        o.data.materials.clear(); o.data.materials.append(BM if o.name.startswith('body') else CM)
        for f in o.data.polygons: f.use_smooth = True
    ey, hz = it['eyeY'], it['hz']
    row = []
    for k, ang in enumerate((0, 35, 90)):
        a = math.radians(ang); dist = 0.62; tgt = (0, -hz, ey - 0.03)
        co.location = (tgt[0] + dist * math.sin(a), tgt[1] - dist * math.cos(a), tgt[2] + 0.02)
        d = np.array(tgt) - np.array(co.location); yaw = math.atan2(d[0], d[1]); pitch = math.atan2(d[2], math.hypot(d[0], d[1]))
        co.rotation_euler = (math.pi / 2 + pitch, 0, -yaw)
        f = os.path.join(os.path.dirname(job['out_png']), f'_v{len(tiles)}_{k}.png'); sc.render.filepath = f; bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(f); px = np.array(img.pixels[:], dtype=np.float32).reshape(R, R, 4); row.append(px); bpy.data.images.remove(img)
    tiles.append(np.concatenate(row, axis=1))
sheet = np.concatenate(tiles[::-1], axis=0)
out = bpy.data.images.new('sheet', sheet.shape[1], sheet.shape[0], alpha=True); out.pixels = sheet.ravel(); out.filepath_raw = job['out_png']; out.file_format = 'PNG'; out.save()
print('[preview] sheet', job['out_png'])
