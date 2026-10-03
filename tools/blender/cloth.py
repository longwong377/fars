# PARSA asset pipeline (D-305, D-307, D-322), the Blender stage of the people's garments: Blender's cloth solver settles each
# garment piece, cut and refined by the node source, on its group's reference body. Run headless, driven by
# tools/blender/build.mjs (people registry):
#   blender -b --factory-startup --python tools/blender/cloth.py -- <job.json>             (all simulations, by stage)
#   blender -b --factory-startup --python tools/blender/cloth.py -- <job.json> --sim <name> (one; what the first spawns)
# job.json (tools/blender/sources/people_cloth.ts): { "sims": [{ name, stage, over (names of simulations settled first whose
# cloth joins the collider), body (PLY: the collider), cloth (PLY: the cut), target (f32 x 3 per vertex: the fitted positions
# the pinned vertices are drawn to), pin (f32 per vertex: pin weight 0..1), frames, cloth_params }], parallel, threads }
# Per simulation: the body (and the settled garments under it: stage 2, D-322) is a collision object; the garment has a cloth
# modifier whose pin group is `pin` and a shape key 'fit' that moves the mesh from the cut to the fitted positions over the
# first `draw_frames` frames (pinned vertices follow the shape; the rest are simulated: gravity, the colliders, the cloth's
# own stiffness); the solver runs `frames` frames (24 fps) and the last frame's vertex positions are written as
# <cloth>.settled.f32 (Blender axes; the node post-step converts them). CPU only; every setting from the job (the registry),
# none by hand. The simulations of a stage run in parallel Blender processes (each deterministic on its own).
import bpy, sys, json, time, os, subprocess
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
job_path = argv[0]; job = json.load(open(job_path))
one = argv[argv.index('--sim') + 1] if '--sim' in argv else None
log = lambda *a: print('[cloth]', *a, flush=True)

def import_ply(path, name):
    bpy.ops.wm.ply_import(filepath=path)
    o = bpy.context.selected_objects[0]; o.name = name; o.data.name = name
    return o

def settled_path(S): return S['cloth'].replace('.ply', '.settled.f32')

def simulate(S):
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.frame_start = 1; sc.frame_end = S['frames']; sc.render.fps = 24
    P = S['cloth_params']
    body = import_ply(S['body'], 'body')
    # stage 2: the garments settled under this one join the collider (their settled positions on their own topology)
    by = {x['name']: x for x in job['sims']}
    for k, name in enumerate(S.get('over', [])):
        U = by[name]; u = import_ply(U['cloth'], f'under{k}')
        co = np.fromfile(settled_path(U), dtype=np.float32); assert len(co) == len(u.data.vertices) * 3, name
        u.data.vertices.foreach_set('co', co); u.data.update()
        bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); u.select_set(True); bpy.context.view_layer.objects.active = body
        bpy.ops.object.join()
    body.modifiers.new('collision', 'COLLISION')
    cs = body.collision; cs.thickness_outer = P['body_thickness']; cs.thickness_inner = 0.02 if not S.get('over') else 0.004; cs.cloth_friction = P['friction']; cs.damping = 0.1
    cl = import_ply(S['cloth'], 'cloth')
    me = cl.data; n = len(me.vertices)
    assert n == S['outer'], f"{S['name']}: {n} vertices, expected {S['outer']}"
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
    co.tofile(settled_path(S))
    d = (co - tgt).reshape(-1, 3); disp = np.sqrt((d ** 2).sum(1))
    r = { 'name': S['name'], 'key': S['key'], 'group': S['group'], 'stage': S.get('stage', 1), 'verts': n, 'seconds': round(time.time() - t0, 1), 'rms': float(np.sqrt((disp ** 2).mean())), 'max': float(disp.max()), 'finite': bool(np.isfinite(co).all()) }
    json.dump(r, open(settled_path(S).replace('.settled.f32', '.stats.json'), 'w'))
    log(json.dumps(r))

if one is not None:
    simulate(next(S for S in job['sims'] if S['name'] == one))
else:
    T0 = time.time(); report = []
    par = int(os.environ.get('CLOTH_PARALLEL', job.get('parallel', 8))); thr = str(int(job.get('threads', 2)))
    # (s18 C14: under the cloud's pip bpy there is no blender binary: the workers run through bpy_cli.py)
    EXE = [bpy.app.binary_path] if bpy.app.binary_path else [sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bpy_cli.py')]
    for stage in sorted(set(S.get('stage', 1) for S in job['sims'])):
        todo = [S for S in job['sims'] if S.get('stage', 1) == stage]
        # the heaviest first (the stage ends with its slowest simulation)
        todo.sort(key=lambda S: -S['outer'] * S['frames'] * int(S['cloth_params']['quality']))
        running = []
        while todo or running:
            while todo and len(running) < par:
                S = todo.pop(0)
                cmd = [*EXE, '-b', '--factory-startup', '-t', thr, '--python', os.path.abspath(__file__), '--', job_path, '--sim', S['name']]
                st = settled_path(S).replace('.settled.f32', '.stats.json')
                if os.path.exists(st): os.remove(st)
                lf = open(settled_path(S).replace('.settled.f32', '.log'), 'w')
                running.append((S, subprocess.Popen(cmd, stdout=lf, stderr=subprocess.STDOUT), lf))
            time.sleep(0.5)
            for x in list(running):
                S, p, lf = x
                if p.poll() is None: continue
                lf.close(); running.remove(x)
                if p.returncode != 0 or not os.path.exists(settled_path(S).replace('.settled.f32', '.stats.json')): raise SystemExit(f"[cloth] {S['name']} failed ({p.returncode}): see {lf.name}")
                r = json.load(open(settled_path(S).replace('.settled.f32', '.stats.json'))); report.append(r); log(json.dumps(r))
        log('stage', stage, 'done', round(time.time() - T0, 1), 's')
    report.sort(key=lambda r: r['name'])
    json.dump({ 'sims': report, 'seconds': round(time.time() - T0, 1), 'blender': bpy.app.version_string }, open(os.path.join(job['out_dir'], 'cloth_stats.json'), 'w'), indent=1)
    log('done', round(time.time() - T0, 1), 's')
