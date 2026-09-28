# The ledges' face (session 12, D-335): a scanned bedded cliff (Poly Haven coastal_cliff_04, CC0: 87 m of cliff band, 11 m
# high) baked from the front into a strip of maps for the hills' ledge strips (src/world/hills/ledges.ts): albedo, a
# tangent-space normal (u along the ledge, v up its face; the scan's own normal map included) and the face's relief (how far
# each point stands out, 1 = the frontmost), by Cycles selected-to-active bakes onto a plane behind the face whose rays run
# forward through it.
#   blender -b --factory-startup --python tools/blender/land_ledgeface.py -- <out dir> [src.gltf]
# Output: <out>/ledgeface_{diff,nor,height}.png and ledgeface.json (the face's metres, the relief's depth).
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]; SRC = args[1] if len(args) > 1 else 'T:/fars-assets-s12/models/polyhaven/coastal_cliff_04/2k/coastal_cliff_04.gltf'
W = int(os.environ.get('W', '4096'))
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in obs: o.select_set(True)
bpy.context.view_layer.objects.active = obs[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if len(obs) > 1: bpy.ops.object.join()
cliff = bpy.context.view_layer.objects.active
me = cliff.data; nsum = Vector((0, 0, 0))
for p in me.polygons: nsum += p.normal * p.area
ang = math.atan2(nsum.x, -nsum.y); me.transform(Matrix.Rotation(ang, 4, 'Z')); me.update()
xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
x0, x1, z0, z1, y0, y1 = min(xs), max(xs), min(zs), max(zs), min(ys), max(ys)
H = int(round(W * (z1 - z0) / (x1 - x0) / 8)) * 8
print('[ledgeface] face %.1f x %.1f m, depth %.1f m -> %d x %d px' % (x1 - x0, z1 - z0, y1 - y0, W, H))
# the plane behind the face, its normal toward the front (-Y), UV 0..1 over the face (u = x, v = z)
bpy.ops.mesh.primitive_plane_add(size=1)
pl = bpy.context.active_object; pl.name = 'strip'
pl.data.transform(Matrix.Rotation(math.radians(90), 4, 'X'))  # the plane's normal +Z -> -Y
pl.data.transform(Matrix.Diagonal((x1 - x0, 1, z1 - z0, 1)))
pl.location = ((x0 + x1) / 2, y1 + 1.0, (z0 + z1) / 2)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for p in pl.data.polygons: print('[ledgeface] plane normal', tuple(round(c, 3) for c in p.normal))
uvl = pl.data.uv_layers.active
for lp in pl.data.loops:
    co = pl.data.vertices[lp.vertex_index].co; uvl.data[lp.index].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
mat = bpy.data.materials.new('bake'); mat.use_nodes = True; pl.data.materials.append(mat)
nt = mat.node_tree; tex = nt.nodes.new('ShaderNodeTexImage'); nt.nodes.active = tex
imgs = {}
for k in ('diff', 'nor', 'height'):
    imgs[k] = bpy.data.images.new('ledgeface_' + k, W, H, alpha=False, float_buffer=True)
    if k != 'diff': imgs[k].colorspace_settings.name = 'Non-Color'
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 4
try:
    if os.environ.get('CPU'): raise RuntimeError('CPU asked (the GPU slots busy)')
    prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = 'GPU'
except Exception as e: print('[ledgeface] CPU bake', e)
bk = sc.render.bake; bk.use_selected_to_active = True; bk.use_cage = False; bk.cage_extrusion = (y1 - y0) + 2.0; bk.max_ray_distance = (y1 - y0) + 4.0; bk.margin = 16
def bake(kind, img, **kw):
    tex.image = img; bpy.ops.object.select_all(action='DESELECT'); cliff.select_set(True); pl.select_set(True); bpy.context.view_layer.objects.active = pl
    bpy.ops.object.bake(type=kind, **kw); print('[ledgeface] baked', kind)
bake('DIFFUSE', imgs['diff'], pass_filter={'COLOR'})
bake('NORMAL', imgs['nor'], normal_space='TANGENT')
# the relief: an emission of the hit point's y (the front 1, the back 0)
em = bpy.data.materials.new('relief'); em.use_nodes = True; t = em.node_tree
for n in list(t.nodes): t.nodes.remove(n)
geo = t.nodes.new('ShaderNodeNewGeometry'); sep = t.nodes.new('ShaderNodeSeparateXYZ'); mr = t.nodes.new('ShaderNodeMapRange'); es = t.nodes.new('ShaderNodeEmission'); mo = t.nodes.new('ShaderNodeOutputMaterial')
mr.inputs['From Min'].default_value = y1; mr.inputs['From Max'].default_value = y0; mr.clamp = True
t.links.new(geo.outputs['Position'], sep.inputs[0]); t.links.new(sep.outputs['Y'], mr.inputs['Value']); t.links.new(mr.outputs['Result'], es.inputs['Color']); t.links.new(es.outputs[0], mo.inputs['Surface'])
cliff.data.materials.clear(); cliff.data.materials.append(em)
bake('EMIT', imgs['height'])
def save(k, fmt='PNG', depth='16'):
    img = imgs[k]; img.filepath_raw = os.path.join(OUT, 'ledgeface_%s.png' % k); img.file_format = fmt
    sc.render.image_settings.color_depth = depth
    img.save(filepath=img.filepath_raw)
for k in imgs: save(k)
json.dump({'width_m': x1 - x0, 'height_m': z1 - z0, 'depth_m': y1 - y0, 'W': W, 'H': H, 'src': os.path.basename(SRC)}, open(os.path.join(OUT, 'ledgeface.json'), 'w'))
print('[ledgeface] done')
