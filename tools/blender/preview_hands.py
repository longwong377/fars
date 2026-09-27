# Blender side of the hands' contact sheet (D-323; iteration evidence): renders each OBJ written by
# tools/blender/preview_hands.ts (the game's simplified hand and the full MakeHuman hand, open and gripping) from the back of the
# hand and from the palm side, in Cycles (CPU), a sun and a sky; the skin atlas's albedo half as the colour and its crease
# channel (right half, R: 0.5 + h / 0.9 mm) as a bump in metres, so the baked relief of the simplified hand shows.
#   blender -b --factory-startup --python tools/blender/preview_hands.py -- <hands_job.json>
import bpy, sys, json, math, os
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0]))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; cy = sc.cycles; cy.device = 'CPU'; cy.samples = int(job.get('samples', 64)); cy.use_denoising = True
R = int(job.get('res', 480)); sc.render.resolution_x = sc.render.resolution_y = R
try: sc.view_settings.view_transform = 'AgX'
except Exception: pass
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.45, 0.55, 0.7, 1); bg.inputs['Strength'].default_value = 0.5
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.5; sun.angle = math.radians(1.5); so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(55), 0, math.radians(-60))
skin = bpy.data.images.load(job['skin']); skin.colorspace_settings.name = 'sRGB'; skin.alpha_mode = 'CHANNEL_PACKED'

def skin_mat():
    m = bpy.data.materials.new('skin'); m.use_nodes = True; N = m.node_tree.nodes; L = m.node_tree.links; p = N['Principled BSDF']
    uvn = N.new('ShaderNodeUVMap'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(uvn.outputs['UV'], sep.inputs['Vector'])
    ua = N.new('ShaderNodeMath'); ua.operation = 'MULTIPLY'; ua.inputs[1].default_value = 0.5; L.new(sep.outputs['X'], ua.inputs[0])
    ud = N.new('ShaderNodeMath'); ud.operation = 'ADD'; ud.inputs[1].default_value = 0.5; L.new(ua.outputs[0], ud.inputs[0])
    ca = N.new('ShaderNodeCombineXYZ'); L.new(ua.outputs[0], ca.inputs['X']); L.new(sep.outputs['Y'], ca.inputs['Y'])
    cd = N.new('ShaderNodeCombineXYZ'); L.new(ud.outputs[0], cd.inputs['X']); L.new(sep.outputs['Y'], cd.inputs['Y'])
    ta = N.new('ShaderNodeTexImage'); ta.image = skin; ta.interpolation = 'Cubic'; L.new(ca.outputs[0], ta.inputs['Vector'])
    td = N.new('ShaderNodeTexImage'); td.image = skin; td.interpolation = 'Cubic'; L.new(cd.outputs[0], td.inputs['Vector'])
    L.new(ta.outputs['Color'], p.inputs['Base Color'])
    sr = N.new('ShaderNodeSeparateColor'); L.new(td.outputs['Color'], sr.inputs['Color'])
    h = N.new('ShaderNodeMapRange'); h.inputs['From Min'].default_value = 0; h.inputs['From Max'].default_value = 1; h.inputs['To Min'].default_value = -0.00045; h.inputs['To Max'].default_value = 0.00045
    L.new(sr.outputs[0], h.inputs['Value'])
    b = N.new('ShaderNodeBump'); b.inputs['Distance'].default_value = 1.0; b.inputs['Strength'].default_value = 1.0; L.new(h.outputs['Result'], b.inputs['Height']); L.new(b.outputs['Normal'], p.inputs['Normal'])
    p.inputs['Roughness'].default_value = 0.5
    try: p.inputs['Subsurface Weight'].default_value = 0.2; p.inputs['Subsurface Radius'].default_value = (0.004, 0.0016, 0.0008); p.inputs['Subsurface Scale'].default_value = 1.0
    except Exception: pass
    return m
SM = skin_mat(); SM_FLAT = skin_mat(); SM_FLAT.node_tree.nodes['Bump'].inputs['Strength'].default_value = 0.0
cam = bpy.data.cameras.new('cam'); cam.lens = 85; co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
tiles = {}
for it in job['items']:
    for o in list(sc.objects):
        if o.type == 'MESH': bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.wm.obj_import(filepath=it['obj'], forward_axis='Y', up_axis='Z')
    for o in sc.objects:
        if o.type != 'MESH': continue
        o.data.materials.clear(); o.data.materials.append(SM if it['name'] == 'game' else SM_FLAT)  # the full hand carries its relief as geometry
        for f in o.data.polygons: f.use_smooth = True
    wx, wy, wz = it['wrist']; tgt = np.array([wx, wy, wz - 0.085])
    row = []
    for k, (ang, el) in enumerate(((-90, 10), (60, 5))):  # the back of the (right) hand faces -x; the palm side from the front and inside
        a = math.radians(ang); dist = 0.42 if it['curl'] == 0 else 0.55
        loc = tgt + np.array([dist * math.sin(a), -dist * math.cos(a), dist * math.sin(math.radians(el))]); co.location = tuple(loc)
        d = tgt - loc; yaw = math.atan2(d[0], d[1]); pitch = math.atan2(d[2], math.hypot(d[0], d[1])); co.rotation_euler = (math.pi / 2 + pitch, 0, -yaw)
        f = os.path.join(os.path.dirname(job['out_png']), f"_h_{it['name']}_{it['curl']}_{k}.png"); sc.render.filepath = f; bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(f); px = np.array(img.pixels[:], dtype=np.float32).reshape(R, R, 4); row.append(px); bpy.data.images.remove(img)
    tiles[(it['curl'], it['name'])] = row
curls = sorted(set(c for c, _ in tiles)); rows = []
for c in curls: rows.append(np.concatenate(tiles[(c, 'game')] + tiles[(c, 'full')], axis=1))  # game back, game palm, full back, full palm
sheet = np.concatenate(rows[::-1], axis=0)
out = bpy.data.images.new('sheet', sheet.shape[1], sheet.shape[0], alpha=True); out.pixels = sheet.ravel(); out.filepath_raw = job['out_png']; out.file_format = 'PNG'; out.save()
print('[preview_hands] sheet', job['out_png'])
