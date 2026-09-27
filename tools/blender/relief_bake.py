# PARSA relief atlas (D-320), the Blender stage: bake each carved relief figure's normal map and ambient occlusion from its
# dense carved surface, seen from the front. Run headless, driven by tools/blender/relief_atlas.ts:
#   blender -b --factory-startup --python tools/blender/relief_bake.py -- <job.json>
# job.json: { "device": "CPU"|"GPU", "normal_samples", "ao_samples", "seed",
#             "figures": [{ "id", "xyz" (float32 grid, nx*ny*3, metres), "nx", "ny", "cell" (m), "zmax" (m), "ao_distance" (m),
#                           "out" (uint8 nx*ny*4: normal x, y, z, occlusion) }] }
# Per figure (every step scripted, no hand-edited file):
#  1. the carved surface: the figure's grid (tools/blender/relief_atlas.ts: the heightfield of src/arch/relief_field.ts at the
#     atlas texel, clamped at the wall face, with each outline's foot pulled in under its arris: the undercut) as a quad mesh,
#     smooth-shaded;
#  2. the target: one quad just in front of the carving, its UV square spanning the grid's texel centres exactly (texel (i, j)
#     is the grid point (i, j)); it is invisible to every ray, so it occludes nothing;
#  3. Cycles selected-to-active bakes from the quad along -z (an orthographic front view: the texel sees what a viewer square
#     to the wall sees): the surface normal in object space (the wall's frame: x along the figure, y up, z out of the wall)
#     antialiased over `normal_samples` rays per texel, and the ambient occlusion (`ao_samples` rays, `ao_distance` long: the
#     carving's own hollows, the foot of every step, the undercut's shadow line);
#  4. writes the normal (x, y, z: 0..255 for -1..1) and the occlusion (255 = open) as raw bytes, rows bottom-up (row j = grid
#     row j).
import bpy, sys, json, os, time
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
job = json.load(open(argv[0]))
log = lambda *a: print('[relief_bake]', *a, flush=True)
t00 = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.seed = int(job.get('seed', 0)); cy.use_animated_seed = False
cy.use_denoising = False
dev_used = 'CPU'
if job.get('device', 'CPU') == 'GPU':
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
w = bpy.data.worlds.new('bake'); sc.world = w

def grid_mesh(name, xyz, nx, ny):
    me = bpy.data.meshes.new(name)
    nv = nx * ny
    me.vertices.add(nv); me.vertices.foreach_set('co', xyz)
    ii, jj = np.meshgrid(np.arange(nx - 1, dtype=np.int32), np.arange(ny - 1, dtype=np.int32))
    a = (jj * nx + ii).ravel()
    quads = np.stack([a, a + 1, a + 1 + nx, a + nx], 1).ravel()
    nq = a.size
    me.loops.add(quads.size); me.loops.foreach_set('vertex_index', quads)
    me.polygons.add(nq); me.polygons.foreach_set('loop_start', np.arange(0, 4 * nq, 4, dtype=np.int32))
    me.update(calc_edges=True)
    me.polygons.foreach_set('use_smooth', np.ones(nq, dtype=bool))
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    return o

stats = []
for F in job['figures']:
    t0 = time.time()
    nx, ny, c = F['nx'], F['ny'], F['cell']
    xyz = np.fromfile(F['xyz'], dtype=np.float32)
    assert xyz.size == nx * ny * 3, (F['id'], xyz.size, nx, ny)
    high = grid_mesh('high', xyz, nx, ny)
    # the target quad: texel centres on the grid points (the quad reaches half a texel beyond the outer points)
    z = F['zmax'] + 0.004
    x0, y0 = float(xyz[0]) - c / 2, float(xyz[1]) - c / 2
    x1, y1 = x0 + nx * c, y0 + ny * c
    me = bpy.data.meshes.new('target')
    me.from_pydata([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [], [(0, 1, 2, 3)])
    uvl = me.uv_layers.new(name='uv')
    for li, (u, v) in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]): uvl.data[li].uv = (u, v)
    tgt = bpy.data.objects.new('target', me); sc.collection.objects.link(tgt)
    for k in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'): setattr(tgt, k, False)
    img = bpy.data.images.new('bake', nx, ny, alpha=False, float_buffer=True); img.colorspace_settings.name = 'Non-Color'
    mat = bpy.data.materials.new('target')
    if not mat.node_tree: mat.use_nodes = True
    tn = mat.node_tree.nodes.new('ShaderNodeTexImage'); tn.image = img; mat.node_tree.nodes.active = tn
    me.materials.append(mat)
    for o in sc.collection.objects: o.select_set(False)
    high.select_set(True); tgt.select_set(True); bpy.context.view_layer.objects.active = tgt
    ray = F['zmax'] + 0.01
    w.light_settings.distance = F['ao_distance']
    t1 = time.time()
    cy.samples = int(job.get('normal_samples', 4))
    bpy.ops.object.bake(type='NORMAL', normal_space='OBJECT', use_selected_to_active=True, cage_extrusion=0.0, max_ray_distance=ray, margin=0, use_clear=True)
    pn = np.empty(nx * ny * 4, np.float32); img.pixels.foreach_get(pn); pn = pn.reshape(-1, 4)
    t2 = time.time()
    cy.samples = int(job.get('ao_samples', 64))
    bpy.ops.object.bake(type='AO', use_selected_to_active=True, cage_extrusion=0.0, max_ray_distance=ray, margin=0, use_clear=True)
    pa = np.empty(nx * ny * 4, np.float32); img.pixels.foreach_get(pa); pa = pa.reshape(-1, 4)
    t3 = time.time()
    out = np.empty((nx * ny, 4), np.uint8)
    # object-space normal as baked: rgb = n * 0.5 + 0.5; a texel no ray hit (never, the quad lies within the grid) stays open
    out[:, 0] = np.clip(np.floor(pn[:, 0] * 255 + 0.5), 0, 255)
    out[:, 1] = np.clip(np.floor(pn[:, 1] * 255 + 0.5), 0, 255)
    out[:, 2] = np.clip(np.floor(pn[:, 2] * 255 + 0.5), 0, 255)
    out[:, 3] = np.clip(np.floor(pa[:, 0] * 255 + 0.5), 0, 255)
    out.tofile(F['out'])
    stats.append({'id': F['id'], 'nx': nx, 'ny': ny, 's': round(time.time() - t0, 2), 'ao_mean': float(pa[:, 0].mean()), 'nz_min': float((pn[:, 2] * 2 - 1).min())})
    log(F['id'], f'{nx}x{ny}', f'{time.time() - t0:.1f} s (setup {t1 - t0:.1f}, normal {t2 - t1:.1f}, ao {t3 - t2:.1f})', 'ao mean', round(float(pa[:, 0].mean()), 3))
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    for i in list(bpy.data.images): bpy.data.images.remove(i)
json.dump({'device': dev_used, 'blender': bpy.app.version_string, 'seconds': round(time.time() - t00, 1), 'figures': stats}, open(job['stats'], 'w'), indent=1)
log('done', len(stats), 'figures', f'{time.time() - t00:.1f} s')
