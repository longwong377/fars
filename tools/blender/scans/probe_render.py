# PARSA s14 (D-365): Cycles renders of a baked monument GLB (the build's pre-KTX2 output, PNG maps) at the photographs' angles,
# for the side-by-side review (REVIEWS/s14/monuments/). Stone: a pale limestone albedo, the packed map's RGB as the tangent
# normal map and its A (the baked occlusion) on the albedo; a sun and a sky. One Blender process, low memory.
#   blender -b --factory-startup --python tools/blender/scans/probe_render.py -- <in.glb> <outPrefix> <views.json> [scale=1]
# views.json: [{ "n": name, "eye": [x, y, z], "at": [x, y, z], "lens": mm, "sun": [azimuth deg, elevation deg] }] in the
# GLB's own axes (glTF: y up), metres after `scale`.
import bpy, sys, json, math, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]
src, outp, vpath = argv[0], argv[1], argv[2]
scale = float(argv[3]) if len(argv) > 3 else 1.0
views = json.load(open(vpath))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
for o in list(sc.objects):
    if o.type != 'MESH': continue
    if o.name.startswith('lod') and o.name != 'lod0': o.hide_render = True
    o.scale = (scale, scale, scale)
    for m in o.data.materials:
        nt = m.node_tree; bs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        img = next((n.image for n in nt.nodes if n.type == 'TEX_IMAGE'), None)
        bs.inputs['Base Color'].default_value = (0.56, 0.5, 0.42, 1); bs.inputs['Roughness'].default_value = 0.72
        if img:
            ti = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
            mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
            mix.inputs['A'].default_value = (0.56, 0.5, 0.42, 1)
            nt.links.new(ti.outputs['Alpha'], mix.inputs['B']); nt.links.new(mix.outputs['Result'], bs.inputs['Base Color'])
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.45, 0.6, 0.85, 1); bg.inputs['Strength'].default_value = 0.6
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.data.energy = 4.5; sun.data.angle = math.radians(0.53)
# ground plane
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
g = bpy.context.active_object; gm = bpy.data.materials.new('ground'); g.data.materials.append(gm); gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.4, 0.36, 0.3, 1)
sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.use_denoising = True; sc.cycles.device = 'CPU'
sc.render.resolution_x = 960; sc.render.resolution_y = 720; sc.view_settings.view_transform = 'AgX'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
G = lambda p: mathutils.Vector((p[0], -p[2], p[1]))  # glTF (y up) -> Blender (z up)
for v in views:
    e, a = G(v['eye']), G(v['at']); cam.location = e; cam.rotation_euler = (a - e).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = v.get('lens', 28)
    az, el = map(math.radians, v.get('sun', [140, 45]))
    d = mathutils.Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    sun.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f"{outp}_{v['n']}.png"; bpy.ops.render.render(write_still=True)
    print('[probe]', v['n'], flush=True)
