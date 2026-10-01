# D-357: Cycles cross-check of the outdoor light bake's estimator (src/render/probes/outdoor_bake.ts outProbe).
# The synthetic lane of tests/outdoor_light.test.ts (two 3.5 m mud-plaster walls 2 m apart, a closed roofed room, open
# ground) under a uniform sky of radiance 1 (no sun): small white Lambertian sensor quads at named points, each seen by an
# orthographic camera filling the frame; a sensor's mean pixel radiance = its irradiance / pi, i.e. the bake's sky channel
# E_S(n) for that point and normal (open, up-facing: 1). Cycles traces every bounce; the bake one (so the bake should sit a
# few per cent under Cycles in the shade). Writes JSON to the path after "--".
#   blender -b --factory-startup --python tools/blender/lightmap_check.py -- out.json
import bpy, json, sys, math
from mathutils import Vector

out_path = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'lightmap_check.json'
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 512; sc.cycles.use_denoising = False
sc.cycles.max_bounces = 8; sc.cycles.diffuse_bounces = 8
sc.render.resolution_x = sc.render.resolution_y = 8; sc.render.image_settings.file_format = 'OPEN_EXR'
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.view_settings.exposure = 0; sc.view_settings.gamma = 1
world = bpy.data.worlds.new('sky'); sc.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1); world.node_tree.nodes['Background'].inputs[1].default_value = 1

def srgb2lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def mat(name, srgb):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*[srgb2lin(c) for c in srgb], 1); b.inputs['Roughness'].default_value = 1
    if 'Specular IOR Level' in b.inputs: b.inputs['Specular IOR Level'].default_value = 0
    return m
PLASTER, ROOF, ROAD = mat('plaster', (0.56, 0.47, 0.36)), mat('roof', (0.60, 0.53, 0.41)), mat('road', (0.66, 0.56, 0.45))
WHITE = bpy.data.materials.new('white'); WHITE.use_nodes = True
wn = WHITE.node_tree.nodes; wn.remove(wn['Principled BSDF']); d = wn.new('ShaderNodeBsdfDiffuse'); d.inputs[0].default_value = (1, 1, 1, 1)
WHITE.node_tree.links.new(d.outputs[0], wn['Material Output'].inputs[0])

# game axes: grid (e, n), up y  ->  Blender (x = e, y = n, z = up)
def box(e, n, sx, sn, y0, y1, m):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(e, n, (y0 + y1) / 2)); o = bpy.context.object
    o.scale = (sx, sn, y1 - y0); o.data.materials.append(m)
box(6, 3, 12, 0.5, -0.4, 3.5, PLASTER); box(6, 5, 12, 0.5, -0.4, 3.5, PLASTER); box(6, 8, 12, 0.5, -0.4, 3.5, PLASTER)
box(0, 6.5, 0.5, 3, -0.4, 3.5, PLASTER); box(12, 6.5, 0.5, 3, -0.4, 3.5, PLASTER); box(6, 6.5, 12.5, 3.5, 3.0, 3.35, ROOF)
box(6, 4, 2000, 2000, -1, 0, ROAD)  # the ground (the bake: 4 m tiles, then the plain of the same albedo)

# sensors: (name, point (e, n, y), normal (e, n, y))
SENS = [('open_up', (6, 0.5, 0.02), (0, 0, 1)), ('lane_up', (6, 4, 0.02), (0, 0, 1)), ('lane_face_s', (6, 4.74, 1.2), (0, -1, 0)),
        ('lane_face_n', (6, 3.26, 1.2), (0, 1, 0)), ('lane_mid_up', (6, 4, 1.2), (0, 0, 1)), ('room_up', (6, 6.5, 0.02), (0, 0, 1))]
res = {}
for name, (e, n, y), nrm in SENS:
    N = Vector((nrm[0], nrm[1], nrm[2])); P = Vector((e, n, y)) + N * 0.002
    bpy.ops.mesh.primitive_plane_add(size=0.04, location=P); s = bpy.context.object; s.data.materials.append(WHITE)
    s.rotation_euler = N.to_track_quat('Z', 'Y').to_euler()
    cam_d = bpy.data.cameras.new('c'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = 0.02; cam_d.clip_start = 0.001; cam_d.clip_end = 1
    cam = bpy.data.objects.new('c', cam_d); sc.collection.objects.link(cam); cam.location = P + N * 0.01
    cam.rotation_euler = (-N).to_track_quat('-Z', 'Y').to_euler(); sc.camera = cam
    cam.visible_diffuse = cam.visible_glossy = False
    s.visible_shadow = False  # the sensor casts nothing (it is 4 cm across anyway)
    sc.render.filepath = f'//_lmcheck_{name}.exr'; bpy.ops.render.render(write_still=False)
    img = bpy.data.images['Render Result']
    # read back through a saved copy (Render Result pixels are not directly readable)
    tmp = bpy.app.tempdir + f'lm_{name}.exr'; img.save_render(tmp); im = bpy.data.images.load(tmp)
    px = list(im.pixels); nP = len(px) // 4
    res[name] = sum(0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2] for i in range(nP)) / nP
    bpy.data.objects.remove(s); bpy.data.objects.remove(cam)
    print(name, res[name])
json.dump(res, open(out_path, 'w'), indent=1)
