# PARSA animals (D-326; BLENDER_PLAN row 4), the Blender stage for one species: from the anatomy's two sources
# (tools/blender/sources/animal.ts: base.ply, the plain surface; high.ply, the dense surface with the coat's relief and its
# albedo + coat mask as vertex colours) to the game's two levels with their baked maps, headless and scripted:
#   blender -b --factory-startup --python tools/blender/animals.py -- <job.json>
# job.json: { "sp", "base", "high", "out_dir", "tris": [lod0, lod1], "tex", "cage", "ray", "ao_samples", "ao_distance",
#             "uv_angle", "uv_margin", "margin", "device", "threads" }
#  1. lod0 = the base surface decimated (quadric collapse, Blender's) to its triangle target, smooth-shaded;
#  2. Smart UV Project at a fixed angle and margin (deterministic);
#  3. Cycles selected-to-active bakes from the dense source: tangent-space normal, ambient occlusion (the level itself
#     invisible to rays), the albedo (emission of the vertex colour) and the coat mask (emission of its alpha);
#  4. two PNGs: <sp>_nrm.png (RGB = normal, A = occlusion, linear) and <sp>_albedo.png (RGB = albedo sRGB-encoded, A = the
#     coat mask, linear), quantised here (round half up) so the bytes are the script's, not the image writer's;
#  5. lod1 = lod0 decimated again (its UVs kept: both levels share the maps);
#  6. one GLB (Draco) with the two levels (named lod0, lod1), UVs, normals and MikkTSpace tangents; no materials (the game
#     builds its own: src/people/animalModels.ts).
import bpy, sys, json, math, os, time
import numpy as np

job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
t0 = time.time()
log = lambda *a: print('[animals]', *a, flush=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
cy = sc.cycles; cy.seed = 0; cy.use_animated_seed = False; cy.use_denoising = False
if job.get('threads'): sc.render.threads_mode = 'FIXED'; sc.render.threads = int(job['threads'])
dev = 'CPU'
if job.get('device') == 'GPU':
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for t in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = t; prefs.get_devices()
            if [d for d in prefs.devices if d.type == t]:
                for d in prefs.devices: d.use = d.type == t
                cy.device = 'GPU'; dev = t; break
        except Exception as e: log('device', t, e)
log('device', dev)

def imp(path, name):
    bpy.ops.wm.ply_import(filepath=path)
    o = bpy.context.selected_objects[0]; o.name = name; o.data.name = name
    for p in o.data.polygons: p.use_smooth = True
    return o
def activate(o):
    for x in bpy.context.view_layer.objects: x.select_set(False)
    o.select_set(True); bpy.context.view_layer.objects.active = o
def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)
def decimate(o, target):
    activate(o); n = tris(o)
    if n > target:
        m = o.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = target / n; m.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=m.name)
    m = o.modifiers.new('tri', 'TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=m.name)

high = imp(job['high'], 'high')
ca = high.data.color_attributes[0].name if len(high.data.color_attributes) else None
log('high', tris(high), 'tris; colour attribute', ca)
lod0 = imp(job['base'], 'lod0')
decimate(lod0, job['tris'][0])
# UVs
activate(lod0); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(job['uv_angle']), island_margin=job['uv_margin'], area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, margin=job['uv_margin'])  # (fill the square: the texel density is the maps' whole point)
bpy.ops.object.mode_set(mode='OBJECT')
log('lod0', tris(lod0), 'tris')

# the source's materials: its vertex colour (RGB) and its coat mask (A) as emission
def emit_mat(name, alpha):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    a = nt.nodes.new('ShaderNodeAttribute'); a.attribute_type = 'GEOMETRY'; a.attribute_name = ca
    e = nt.nodes.new('ShaderNodeEmission'); o = nt.nodes.new('ShaderNodeOutputMaterial')
    if alpha:
        c = nt.nodes.new('ShaderNodeCombineColor'); nt.links.new(a.outputs['Alpha'], c.inputs[0]); nt.links.new(a.outputs['Alpha'], c.inputs[1]); nt.links.new(a.outputs['Alpha'], c.inputs[2]); nt.links.new(c.outputs[0], e.inputs['Color'])
    else: nt.links.new(a.outputs['Color'], e.inputs['Color'])
    nt.links.new(e.outputs[0], o.inputs['Surface']); return m
m_col, m_mask = emit_mat('src_col', False), emit_mat('src_mask', True)
m_diff = bpy.data.materials.new('src_diffuse'); m_diff.use_nodes = True
high.data.materials.clear(); high.data.materials.append(m_col)
# the target's material holds the image node the bake writes to
n = job['tex']
imgs = {k: bpy.data.images.new(f'{job["sp"]}_{k}', n, n, alpha=False, float_buffer=True) for k in ('nrm', 'ao', 'col', 'mask')}
for im in imgs.values(): im.colorspace_settings.name = 'Non-Color'
tm = bpy.data.materials.new('target'); tm.use_nodes = True; tn = tm.node_tree.nodes.new('ShaderNodeTexImage')
lod0.data.materials.clear(); lod0.data.materials.append(tm)
w = bpy.data.worlds.new('bake'); sc.world = w; w.light_settings.distance = job['ao_distance']
for k in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'): setattr(lod0, k, False)

def bake(kind, key, samples):
    tn.image = imgs[key]; tm.node_tree.nodes.active = tn
    for x in bpy.context.view_layer.objects: x.select_set(False)
    high.select_set(True); lod0.select_set(True); bpy.context.view_layer.objects.active = lod0
    cy.samples = samples
    kw = dict(type=kind, use_selected_to_active=True, cage_extrusion=job['cage'], max_ray_distance=job['ray'], margin=job['margin'], margin_type='EXTEND', use_clear=True)
    if kind == 'NORMAL': kw['normal_space'] = 'TANGENT'
    t = time.time(); bpy.ops.object.bake(**kw); log('baked', key, f'{time.time() - t:.1f} s')
    px = np.empty(n * n * 4, np.float32); imgs[key].pixels.foreach_get(px); return px.reshape(-1, 4)
nrm = bake('NORMAL', 'nrm', job.get('normal_samples', 4))
ao = bake('AO', 'ao', job['ao_samples'])
high.data.materials[0] = m_col; col = bake('EMIT', 'col', job.get('emit_samples', 4))
high.data.materials[0] = m_mask; mask = bake('EMIT', 'mask', job.get('emit_samples', 4))

def save(name, arr):
    q = np.clip(np.floor(arr * 255.0 + 0.5), 0, 255).astype(np.uint8)
    im = bpy.data.images.new(name, n, n, alpha=True, float_buffer=False); im.colorspace_settings.name = 'Non-Color'; im.alpha_mode = 'CHANNEL_PACKED'
    im.pixels.foreach_set((q.astype(np.float32) / 255.0).ravel())
    p = os.path.join(job['out_dir'], name + '.png'); im.filepath_raw = p; im.file_format = 'PNG'; im.save(); return p, q
pk = nrm.copy(); pk[:, 3] = ao[:, 0]
p_n, qn = save(f'{job["sp"]}_nrm', pk)
lin = np.clip(col[:, :3], 0, 1); s = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
pa = np.concatenate([s, mask[:, :1]], axis=1)
p_a, qa = save(f'{job["sp"]}_albedo', pa)

# lod1: lod0 decimated again, UVs kept
activate(lod0); bpy.ops.object.duplicate(); lod1 = bpy.context.active_object; lod1.name = 'lod1'; lod1.data.name = 'lod1'
decimate(lod1, job['tris'][1])
bpy.data.objects.remove(high, do_unlink=True)
for o in (lod0, lod1): o.data.materials.clear()
for o in list(bpy.data.objects): o.select_set(o.name in ('lod0', 'lod1'))
out_glb = os.path.join(job['out_dir'], job['sp'] + '.glb')
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', use_selection=True, export_yup=True,
    export_normals=True, export_tangents=True, export_materials='NONE',
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6, export_draco_position_quantization=14,
    export_draco_normal_quantization=10, export_draco_texcoord_quantization=12, export_draco_generic_quantization=12,
    export_extras=False, export_animations=False, export_cameras=False, export_lights=False)
stats = {'sp': job['sp'], 'device': dev, 'lod0': tris(lod0), 'lod1': tris(lod1), 'high': None, 'tex': n,
         'ao_mean': float(qn[:, 3].mean() / 255), 'mask_mean': float(qa[:, 3].mean() / 255), 'seconds': round(time.time() - t0, 1)}
json.dump(stats, open(os.path.join(job['out_dir'], 'stats.json'), 'w'), indent=1)
log('done', json.dumps(stats))
