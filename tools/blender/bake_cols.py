# PARSA asset pipeline (D-328), the columns' Blender stage: tools/blender/bake.py (D-305) with two changes, so the other assets
# built by bake.py are untouched:
#  a. a level may keep the UVs of its PLY (job lods[i].uv = "source": the shaft tiles, whose map the game samples at its own
#     analytic tile coordinates, src/arch/sculpt.ts shaftUV) instead of Smart UV Project;
#  b. the rays leave from a CAGE object: a copy of the level welded whole, shaded smooth and pushed out along its averaged
#     normals by `cage`. bake.py extrudes the level along its own split normals, so the rays fan apart or cross at every
#     crease and the texels along a crease see the wrong part of the source: the seam streaks the volute member's reeded panel
#     showed (BLENDER_PLAN row 1). A smooth cage sends every ray along one continuous field.
# Below, bake.py's own description:
# PARSA asset pipeline (D-305), the Blender stage: bake a high-resolution source onto the game's low-poly levels and export
# one GLB. Run headless, driven by tools/blender/build.mjs (never by hand-edited .blend files):
#   blender -b --factory-startup --python tools/blender/bake.py -- <job.json>
# job.json (written by build.mjs from tools/blender/assets.json):
#   { "id", "high": ply, "lods": [{ "ply", "tex" (px) }], "out_glb", "out_dir", "device": "GPU"|"CPU",
#     "bake": { "cage", "ray", "margin", "ao_samples", "ao_distance", "uv_angle", "uv_margin" }, "seed" }
# What it does, in order (every step scripted so the asset is reproducible from its inputs):
#  1. imports the high source and each level as PLY (written in Blender's z-up axes by lib/ply.ts; normals as custom normals);
#  2. unwraps each level (Smart UV Project at a fixed angle and margin: deterministic);
#  3. bakes, per level, the high source's tangent-space normals (selected-to-active, a cage `cage` out and rays up to `ray`
#     long, both in the source's units) and its ambient occlusion (Cycles AO from the high surface, `ao_samples` samples,
#     rays `ao_distance` long), on the T4 (OptiX, else CUDA) or the CPU;
#  4. packs normal (RGB, linear) and occlusion (A) into one PNG per level: one sampler in the game's fragment stage (D-295);
#  5. exports the levels (named lod0, lod1, ...) with UVs, normals and MikkTSpace tangents to one GLB, Draco-compressed,
#     the packed map as each level's normalTexture (the alpha holds the occlusion; the game's loader reads it,
#     src/render/models.ts).
import bpy, sys, json, math, os, time
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
job = json.load(open(argv[0]))
B = job['bake']
t0 = time.time()
log = lambda *a: print('[bake]', *a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.seed = int(job.get('seed', 0)); cy.use_animated_seed = False
cy.use_denoising = False
dev_used = 'CPU'
if job.get('device', 'GPU') == 'GPU':
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for t in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = t; prefs.get_devices()
            ds = [d for d in prefs.devices if d.type == t]
            if ds:
                for d in prefs.devices: d.use = d.type == t
                cy.device = 'GPU'; dev_used = t; break
        except Exception as e:
            log('device', t, 'unavailable', e)
log('device', dev_used)

def import_ply(path, name):
    bpy.ops.object.select_all(action='DESELECT') if bpy.context.view_layer.objects.active else None
    bpy.ops.wm.ply_import(filepath=path)  # the file is in Blender's z-up axes already (tools/blender/lib/ply.ts)
    o = bpy.context.selected_objects[0]; o.name = name; o.data.name = name
    return o

high = import_ply(job['high'], 'high')
log('high', len(high.data.polygons), 'faces, custom normals', high.data.has_custom_normals)
if B.get('high_normals', 'custom') == 'geometry':
    # the bake reads the high surface's own (smooth) normals; the imported custom ones are dropped
    bpy.context.view_layer.objects.active = high; bpy.ops.mesh.customdata_custom_splitnormals_clear(); bpy.ops.object.shade_smooth()
# the world for the AO bake: black (only occlusion matters), AO distance in the source's units
w = bpy.data.worlds.new('bake'); sc.world = w
w.light_settings.distance = B['ao_distance']

levels = []
for i, L in enumerate(job['lods']):
    o = import_ply(L['ply'], f'lod{i}')
    # UVs: Smart UV Project, fixed parameters
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    # weld the corners the game's mesh splits at its creases (one vertex per normal): UV islands follow the surface, not the
    # normals; the custom normals stay per corner (sharp edges marked where they differ)
    bpy.ops.mesh.remove_doubles(threshold=1e-6, use_sharp_edge_from_normals=True)
    if L.get('uv') == 'source':
        if not o.data.uv_layers: raise RuntimeError(f'lod{i}: uv "source" but the PLY carries no UVs')
    else:
      bpy.ops.uv.smart_project(angle_limit=math.radians(B['uv_angle']), island_margin=B['uv_margin'], area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    # the cage: the welded level with its smooth (averaged) vertex normals, pushed out by B["cage"]
    import bmesh
    cage = o.copy(); cage.data = o.data.copy(); cage.name = f'cage{i}'; sc.collection.objects.link(cage)
    bm = bmesh.new(); bm.from_mesh(cage.data); bm.normal_update()  # (the level is welded already: same topology, as the bake requires)
    for v in bm.verts: v.co += v.normal * B['cage']
    bm.to_mesh(cage.data); bm.free()
    if cage.data.has_custom_normals:
        bpy.context.view_layer.objects.active = cage; bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for k in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'): setattr(cage, k, False)
    n = L['tex']
    img_n = bpy.data.images.new(f'lod{i}_nrm', n, n, alpha=False, float_buffer=True); img_n.colorspace_settings.name = 'Non-Color'
    img_a = bpy.data.images.new(f'lod{i}_ao', n, n, alpha=False, float_buffer=True); img_a.colorspace_settings.name = 'Non-Color'
    mat = bpy.data.materials.new(f'lod{i}')
    if not mat.node_tree: mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
    tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = img_n
    o.data.materials.clear(); o.data.materials.append(mat)
    levels.append((o, mat, tn, img_n, img_a, n, cage))

def bake(kind, o, tn, img, cage):
    tn.image = img
    for x in bpy.context.view_layer.objects: x.select_set(False)
    high.select_set(True); o.select_set(True); bpy.context.view_layer.objects.active = o
    nt = o.active_material.node_tree; nt.nodes.active = tn
    kw = dict(type=kind, use_selected_to_active=True, use_cage=True, cage_object=cage.name, max_ray_distance=B['ray'], margin=B['margin'], margin_type='EXTEND', use_clear=True)
    if kind == 'NORMAL': kw.update(normal_space='TANGENT')
    t = time.time(); bpy.ops.object.bake(**kw); log('baked', kind, o.name, f'{time.time() - t:.1f} s')

stats = {'device': dev_used, 'levels': []}
# the levels themselves must not occlude the high surface's AO rays (they lie around it, a few mm in or out): every level is
# invisible to all ray types; the bake still writes to the active one
for (o, *_rest) in levels:
    for k in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'): setattr(o, k, False)
for (o, mat, tn, img_n, img_a, n, cage) in levels:
    cy.samples = B.get('normal_samples', 1); bake('NORMAL', o, tn, img_n, cage)  # > 1: antialiased within the texel (the lock grooves)
    cy.samples = B['ao_samples']; bake('AO', o, tn, img_a, cage)
    px_n = np.empty(n * n * 4, np.float32); img_n.pixels.foreach_get(px_n)
    px_a = np.empty(n * n * 4, np.float32); img_a.pixels.foreach_get(px_a)
    out = px_n.reshape(-1, 4).copy(); out[:, 3] = px_a.reshape(-1, 4)[:, 0]
    if B.get('max_tilt'):
        # c. (D-328) a baked normal tilted further than max_tilt from the level's own is a facet of the level bridging a groove
        # of the source (the volute's reeds): the map cannot draw that groove on that facet, only a streak; it is laid back to
        # max_tilt, keeping its direction
        v = out[:, :3] * 2.0 - 1.0; t = np.hypot(v[:, 0], v[:, 1]); a = np.arctan2(t, v[:, 2]); m = a > math.radians(B['max_tilt'])
        s_, c_ = math.sin(math.radians(B['max_tilt'])), math.cos(math.radians(B['max_tilt']))
        v[m, 0] = v[m, 0] / np.maximum(t[m], 1e-6) * s_; v[m, 1] = v[m, 1] / np.maximum(t[m], 1e-6) * s_; v[m, 2] = c_
        out[:, :3] = (v + 1.0) * 0.5; stats.setdefault('tilt_clamped', []).append(float(m.mean()))
    # quantise here (round half up), so the PNG holds exactly these bytes whatever Blender's own float->byte conversion does
    q = np.clip(np.floor(out * 255.0 + 0.5), 0, 255).astype(np.uint8)
    packed = bpy.data.images.new(f'{job["id"]}_{o.name}', n, n, alpha=True, float_buffer=False)
    packed.colorspace_settings.name = 'Non-Color'; packed.alpha_mode = 'CHANNEL_PACKED'
    packed.pixels.foreach_set((q.astype(np.float32) / 255.0).ravel())
    path = os.path.join(job['out_dir'], f'{job["id"]}_{o.name}.png')
    packed.filepath_raw = path; packed.file_format = 'PNG'; packed.save()
    ao = q[:, 3].astype(np.float64) / 255.0
    stats['levels'].append({'name': o.name, 'tris': sum(len(p.vertices) - 2 for p in o.data.polygons), 'tex': n, 'png': path,
                            'ao_mean': float(ao.mean()), 'ao_p05': float(np.percentile(ao, 5))})
    # the export material: the packed map as the normal map (tangent space); the base colour is the game's to set
    nt = mat.node_tree; nt.nodes.remove(tn)
    ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = bpy.data.images.load(path); ti.image.colorspace_settings.name = 'Non-Color'; ti.image.alpha_mode = 'CHANNEL_PACKED'
    nm = nt.nodes.new('ShaderNodeNormalMap'); nm.space = 'TANGENT'
    nt.links.new(ti.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], nt.nodes['Principled BSDF'].inputs['Normal'])
    nt.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.8, 0.75, 0.66, 1)
    nt.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.6

bpy.data.objects.remove(high, do_unlink=True)
for (_o, *_r, cage) in levels: bpy.data.objects.remove(cage, do_unlink=True)
for o in list(bpy.data.objects): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=job['out_glb'], export_format='GLB', use_selection=False, export_yup=True,
    export_normals=True, export_tangents=True, export_materials='EXPORT', export_image_format='AUTO',
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6, export_draco_position_quantization=14,
    export_draco_normal_quantization=10, export_draco_texcoord_quantization=12, export_draco_generic_quantization=12,
    export_extras=False, export_animations=False, export_cameras=False, export_lights=False)
stats['seconds'] = round(time.time() - t0, 1)
json.dump(stats, open(os.path.join(job['out_dir'], 'bake_stats.json'), 'w'), indent=1)
log('done', json.dumps(stats))
