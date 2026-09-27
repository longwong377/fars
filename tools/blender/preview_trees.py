# Preview of the Blender tree wood (D-327): chosen model rows of wood.bin with their species' bark scan (diffuse x the
# species' measured tint, OpenGL normal map), their baked occlusion, a ground plane and a low sun, one Cycles render per
# row laid out in a contact sheet. For judging the branch meshes, UVs and bark scale before the game's render.
#   blender -b --factory-startup --python tools/blender/preview_trees.py -- <wood_dir> <bark_dir> <tree_bark.json> <src.json> <out.png> [rows=0,3,...] [lod=0] [px=512]
import bpy, sys, json, math, os
import numpy as np
a = sys.argv[sys.argv.index('--') + 1:]
wdir, bdir, bj, srcj, out = a[:5]; rows = [int(x) for x in (a[5] if len(a) > 5 else '0,3,6,9,12,15,18,21,24,27,30,33,36,39,42').split(',')]
lod = int(a[6]) if len(a) > 6 else 0; PX = int(a[7]) if len(a) > 7 else 512; mode = a[8] if len(a) > 8 else ''; close = mode == 'close'
meta = json.load(open(os.path.join(wdir, 'wood.json'))); BARK = json.load(open(bj))['species']; SRC = json.load(open(srcj))
raw = open(os.path.join(wdir, 'wood.bin'), 'rb').read(); VB = np.frombuffer(raw, np.float32, meta['vertex_floats']).reshape(-1, 12); IB = np.frombuffer(raw, np.uint16, meta['indices'], meta['vertex_floats'] * 4)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.use_denoising = True
sc.render.resolution_x = sc.render.resolution_y = PX; sc.view_settings.view_transform = 'AgX'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bgn = w.node_tree.nodes['Background']; bgn.inputs['Color'].default_value = (0.55, 0.7, 1.0, 1); bgn.inputs['Strength'].default_value = 0.6
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 4.0; sun.rotation_euler = (math.radians(55), 0, math.radians(35)); sc.collection.objects.link(sun)
g = bpy.data.meshes.new('g'); g.from_pydata([(-80, -80, 0), (80, -80, 0), (80, 80, 0), (-80, 80, 0)], [], [(0, 1, 2, 3)]); go = bpy.data.objects.new('g', g); sc.collection.objects.link(go)
gm = bpy.data.materials.new('gm'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.35, 0.3, 0.24, 1); g.materials.append(gm)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 35
tiles = []
for r in rows:
    e = next(x for x in meta['lods'][lod] if x['row'] == r); m = SRC['models'][r]; B = BARK[e['species']]
    V = VB[e['v0']:e['v0'] + e['nv']]; I = IB[e['i0']:e['i0'] + e['ni']].astype(np.int32)
    me = bpy.data.meshes.new(f'm{r}'); co = np.stack([V[:, 0], -V[:, 2], V[:, 1]], 1); me.vertices.add(len(co)); me.vertices.foreach_set('co', co.ravel().astype(np.float32))
    nt = len(I) // 3; me.loops.add(len(I)); me.loops.foreach_set('vertex_index', I); me.polygons.add(nt); me.polygons.foreach_set('loop_start', np.arange(0, len(I), 3, dtype=np.int32)); me.polygons.foreach_set('loop_total', np.full(nt, 3, np.int32)); me.update(calc_edges=True)
    uv = me.uv_layers.new(name='UV'); uv.data.foreach_set('uv', np.stack([V[I, 9], V[I, 10]], 1).ravel().astype(np.float32))
    ca = me.color_attributes.new('ao', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', np.repeat(V[:, 11:12], 4, 1).ravel().astype(np.float32))
    nrm = np.stack([V[:, 3], -V[:, 5], V[:, 4]], 1); me.normals_split_custom_set_from_vertices(nrm.astype(np.float32).tolist())
    mat = bpy.data.materials.new(f'b{r}'); mat.use_nodes = True; nt_ = mat.node_tree; bs = nt_.nodes['Principled BSDF']
    td = nt_.nodes.new('ShaderNodeTexImage'); td.image = bpy.data.images.load(os.path.join(bdir, B['scan'], 'diff.jpg'))
    tn = nt_.nodes.new('ShaderNodeTexImage'); tn.image = bpy.data.images.load(os.path.join(bdir, B['scan'], 'nor.jpg')); tn.image.colorspace_settings.name = 'Non-Color'
    nm = nt_.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = B['relief']; nt_.links.new(tn.outputs['Color'], nm.inputs['Color']); nt_.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    # the species' tint x the scan's luminance over its mean (the game's rule, render.ts), x the baked occlusion
    px = np.array(td.image.pixels[:], np.float32).reshape(-1, 4)[::97, :3]; lum = float((px @ np.array([0.2126, 0.7152, 0.0722])).mean())
    bw = nt_.nodes.new('ShaderNodeRGBToBW'); nt_.links.new(td.outputs['Color'], bw.inputs['Color'])
    mu = nt_.nodes.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'; mu.inputs[1].default_value = 1.0 / max(1e-3, lum); nt_.links.new(bw.outputs[0], mu.inputs[0])
    tint = [((c + 0.055) / 1.055) ** 2.4 for c in m['bark']]
    mix = nt_.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
    mix.inputs['A'].default_value = (*tint, 1); nt_.links.new(mu.outputs[0], mix.inputs['B'])
    at = nt_.nodes.new('ShaderNodeVertexColor'); at.layer_name = 'ao'
    m2 = nt_.nodes.new('ShaderNodeMix'); m2.data_type = 'RGBA'; m2.blend_type = 'MULTIPLY'; m2.inputs['Factor'].default_value = 1.0
    nt_.links.new(mix.outputs['Result'], m2.inputs['A']); nt_.links.new(at.outputs['Color'], m2.inputs['B']); nt_.links.new(m2.outputs['Result'], bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = 0.85
    me.materials.append(mat)
    ob = bpy.data.objects.new(f'm{r}', me); sc.collection.objects.link(ob)
    H = m['H']
    if mode == 'fork': cam.location = (0, -max(2.5, H * 0.3), m['CB'] * 0.95); cam.rotation_euler = (math.radians(88), 0, 0)
    elif close: cam.location = (0, -max(1.5, H * 0.18), H * 0.12); cam.rotation_euler = (math.radians(85), 0, 0)
    else: cam.location = (0, -H * 1.7, H * 0.45); cam.rotation_euler = (math.radians(83), 0, 0)
    for o in sc.objects:
        if o.name.startswith('m') and o is not ob: o.hide_render = True
    f = out + f'.{r}.png'; sc.render.filepath = f; bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(f); tiles.append(np.array(im.pixels[:], np.float32).reshape(PX, PX, 4)); bpy.data.images.remove(im); os.remove(f)
    ob.hide_render = True
n = len(tiles); cols = min(5, n); rws = (n + cols - 1) // cols
sheet = np.zeros((rws * PX, cols * PX, 4), np.float32); sheet[..., 3] = 1
for i, t in enumerate(tiles):
    r0 = (rws - 1 - i // cols) * PX; c0 = (i % cols) * PX; sheet[r0:r0 + PX, c0:c0 + PX] = t
img = bpy.data.images.new('sheet', cols * PX, rws * PX, alpha=True); img.pixels.foreach_set(sheet.ravel()); img.filepath_raw = out; img.file_format = 'PNG'; img.save()
print('[preview_trees]', out, rows)
