# PARSA asset pipeline (D-305, D-307), the Blender stage of the people's garment drape: Blender's cloth solver settles each
# procedural garment piece on its group's reference body. Run headless, driven by tools/blender/build.mjs (people registry):
#   blender -b --factory-startup --python tools/blender/cloth.py -- <job.json>
# job.json (tools/blender/sources/people_cloth.ts): { "sims": [{ key, group, body (PLY: the collider), cloth (PLY: the cut,
# the wide start of a gathered skirt), target (f32 x 3 per vertex: the fitted positions the pinned vertices are drawn to),
# pin (f32 per vertex: pin weight 0..1), frames, cloth_params }], "substeps" }
# Per simulation: the body is a collision object; the garment has a cloth modifier whose pin group is `pin` and a shape key
# 'fit' that moves the mesh from the cut to the fitted positions over the first `draw_frames` frames (pinned vertices
# follow the shape; the rest are simulated: gravity, the body, the cloth's own stiffness and self-collision); the solver
# runs `frames` frames (24 fps) and the last frame's vertex positions are written as <cloth>.settled.f32 (Blender axes;
# the node post-step converts them). CPU only; every setting from the job (the registry), none by hand.
import bpy, sys, json, time, os
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0]))
log = lambda *a: print('[cloth]', *a, flush=True)
T0 = time.time(); report = []

def import_ply(path, name):
    bpy.ops.wm.ply_import(filepath=path)
    o = bpy.context.selected_objects[0]; o.name = name; o.data.name = name
    return o

for S in job['sims']:
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.frame_start = 1; sc.frame_end = S['frames']; sc.render.fps = 24
    P = S['cloth_params']
    body = import_ply(S['body'], 'body')
    body.modifiers.new('collision', 'COLLISION')
    cs = body.collision; cs.thickness_outer = P['body_thickness']; cs.thickness_inner = 0.02; cs.cloth_friction = P['friction']; cs.damping = 0.1
    cl = import_ply(S['cloth'], 'cloth')
    me = cl.data; n = len(me.vertices)
    assert n == S['outer'], f"{S['key']}: {n} vertices, expected {S['outer']}"
    pin = np.fromfile(S['pin'], dtype=np.float32); tgt = np.fromfile(S['target'], dtype=np.float32)
    vg = cl.vertex_groups.new(name='pin')
    for i, w in enumerate(pin):
        if w > 1e-4: vg.add([i], float(w), 'REPLACE')
    # shape keys: the cut (basis) and the fitted piece ('fit'), drawn in over the first frames
    cl.shape_key_add(name='cut', from_mix=False); fit = cl.shape_key_add(name='fit', from_mix=False)
    fit.data.foreach_set('co', tgt)
    df = int(P['draw_frames'])
    fit.value = 0.0; fit.keyframe_insert('value', frame=1); fit.value = 1.0; fit.keyframe_insert('value', frame=df)
    m = cl.modifiers.new('cloth', 'CLOTH'); c = m.settings; cc = m.collision_settings
    c.quality = int(P['quality']); c.mass = P['mass']; c.air_damping = P['air_damping']
    c.tension_stiffness = c.compression_stiffness = P['tension']; c.shear_stiffness = P['shear']; c.bending_stiffness = P['bending']
    c.tension_damping = c.compression_damping = P['tension_damping']; c.bending_damping = P['bending_damping']
    c.vertex_group_mass = 'pin'; c.pin_stiffness = P['pin_stiffness']
    c.use_pressure = False; c.shrink_min = 0.0
    cc.use_collision = True; cc.distance_min = P['distance']; cc.collision_quality = int(P['collision_quality'])
    cc.use_self_collision = bool(P['self_collision']); cc.self_distance_min = P['self_distance']; cc.self_friction = 5.0
    cc.impulse_clamp = 0.0
    m.point_cache.frame_start = 1; m.point_cache.frame_end = S['frames']
    for f in range(1, S['frames'] + 1): sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get(); ev = cl.evaluated_get(dg); em = ev.to_mesh()
    co = np.zeros(len(em.vertices) * 3, dtype=np.float32); em.vertices.foreach_get('co', co); ev.to_mesh_clear()
    out = S['cloth'].replace('.ply', '.settled.f32'); co.tofile(out)
    d = (co - tgt).reshape(-1, 3); disp = np.sqrt((d ** 2).sum(1))
    r = { 'key': S['key'], 'group': S['group'], 'verts': n, 'seconds': round(time.time() - t0, 1), 'rms': float(np.sqrt((disp ** 2).mean())), 'max': float(disp.max()) }
    report.append(r); log(json.dumps(r))
json.dump({ 'sims': report, 'seconds': round(time.time() - T0, 1), 'blender': bpy.app.version_string }, open(os.path.join(job['out_dir'], 'cloth_stats.json'), 'w'), indent=1)
log('done', round(time.time() - T0, 1), 's')
