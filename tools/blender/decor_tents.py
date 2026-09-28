# PARSA (D-330): the court camps' tents, pitched by Blender's cloth solver. Run headless by tools/blender/decor.mjs:
#   blender -b --factory-startup --python tools/blender/decor_tents.py -- <job.json> <out_dir>
# job.json (tools/blender/sources/tents.ts, from src/world/tentForms.ts): per tent kind, its cloth panels as grids in their
# pitched rest shape (Blender axes), the vertices held (pinned: the ridge on its pole, the pole tops, the eave and hem at the
# guy ropes and pegs, the edges roped taut), the door cut out, and the poles. Per kind:
#  1. every panel a cloth object (its pin group), the ground a collider; the solver runs `frames` frames under gravity: the
#     cloth sags between its holds, the walls hang and fold, the hems lie on the ground between the pegs;
#  2. the settled panels joined: the high source (tent_<kind>_high.ply: every fold at the 5 cm grid);
#  3. two game levels decimated from it (collapse, `lod_tris`): tent_<kind>_lod0.ply, _lod1.ply, which tools/blender/bake.py
#     unwraps and bakes the folds onto (normal + AO), then exports as one GLB.
# CPU only; every setting from the job; deterministic for a given Blender build.
import bpy, sys, json, time, os
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0])); out = argv[1]; os.makedirs(out, exist_ok=True)
ONLY = argv[2].split(',') if len(argv) > 2 else None  # (a subset of the kinds, for iterating)
log = lambda *a: print('[decor_tents]', *a, flush=True)
C = job['cloth']; T0 = time.time(); stats = {'kinds': [], 'per': {}}

def mesh_obj(name, verts, faces):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces]); me.update()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o

for K in job['kinds']:
    t0 = time.time(); kind = K['kind']
    if ONLY and kind not in ONLY: continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.frame_start = 1; sc.frame_end = C['frames']; sc.render.fps = 24
    # the ground: a collider under the whole tent
    g = mesh_obj('ground', [(-20, -20, 0), (20, -20, 0), (20, 20, 0), (-20, 20, 0)], [(0, 1, 2, 3)])
    g.modifiers.new('collision', 'COLLISION'); g.collision.thickness_outer = 0.01; g.collision.cloth_friction = 20
    cloths = []
    for P in K['panels']:
        o = mesh_obj(P['id'], P['verts'], P['faces'])
        vg = o.vertex_groups.new(name='pin'); vg.add(P['pins'], 1.0, 'REPLACE')
        m = o.modifiers.new('cloth', 'CLOTH'); c = m.settings; cc = m.collision_settings
        c.quality = int(C['quality']); c.mass = C['mass']; c.air_damping = C['air']
        c.tension_stiffness = c.compression_stiffness = C['tension']; c.shear_stiffness = C['shear']; c.bending_stiffness = C['bending']
        c.vertex_group_mass = 'pin'; c.pin_stiffness = 1.0
        c.shrink_min = -C.get('slack', 0.0)  # (the cloth a little longer than the taut rest shape: it hangs in catenaries between its holds)
        cc.use_collision = True; cc.distance_min = C['thickness']; cc.use_self_collision = False
        m.point_cache.frame_start = 1; m.point_cache.frame_end = C['frames']
        cloths.append(o)
    for f in range(1, C['frames'] + 1): sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get(); parts = []
    for o in cloths:
        ev = o.evaluated_get(dg); em = ev.to_mesh(); co = np.zeros(len(em.vertices) * 3, np.float32); em.vertices.foreach_get('co', co); ev.to_mesh_clear()
        assert np.isfinite(co).all(), f'{kind} {o.name}: the simulation diverged'
        rest = np.array(o.data.vertices[0].co)  # (the object's own mesh stays the rest shape)
        o.modifiers.clear(); o.data.vertices.foreach_set('co', co); o.data.update(); parts.append(o)
    bpy.data.objects.remove(g, do_unlink=True)
    # sag statistics: how far the cloth moved from its rest shape (a check that it hung, and did not explode)
    moved = []
    for o, P in zip(parts, K['panels']):
        co = np.zeros(len(o.data.vertices) * 3, np.float32); o.data.vertices.foreach_get('co', co); d = co.reshape(-1, 3) - np.array(P['verts'], np.float32); moved.append(np.linalg.norm(d, axis=1))
    mv = np.concatenate(moved)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); hi = bpy.context.view_layer.objects.active; hi.name = 'high'
    # the solver's grid-scale noise smoothed away (the folds, 10 cm and up, kept)
    sm = hi.modifiers.new('smooth', 'LAPLACIANSMOOTH'); sm.iterations = 3; sm.lambda_factor = 0.4; sm.use_volume_preserve = False; sm.use_normalized = True
    bpy.ops.object.modifier_apply(modifier='smooth')
    bpy.ops.object.shade_smooth()
    hi_path = os.path.join(out, f'tent_{kind}_high.ply')
    bpy.ops.wm.ply_export(filepath=hi_path, export_selected_objects=True, apply_modifiers=True, export_normals=False, export_uv=False, export_colors='NONE', export_triangulated_mesh=True)
    nh = sum(len(p.vertices) - 2 for p in hi.data.polygons)
    lods = []
    for i, target in enumerate(job['lod_tris']):
        lo = hi.copy(); lo.data = hi.data.copy(); lo.name = f'lod{i}'; sc.collection.objects.link(lo)
        d = lo.modifiers.new('dec', 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = min(1.0, target / nh * 0.98); d.use_collapse_triangulate = True
        bpy.ops.object.select_all(action='DESELECT')
        lo.select_set(True); bpy.context.view_layer.objects.active = lo; bpy.ops.object.modifier_apply(modifier='dec')
        path = os.path.join(out, f'tent_{kind}_lod{i}.ply')
        bpy.ops.wm.ply_export(filepath=path, export_selected_objects=True, apply_modifiers=True, export_normals=False, export_uv=False, export_colors='NONE', export_triangulated_mesh=True)
        lods.append({'ply': path, 'tris': len(lo.data.polygons)})
    stats['kinds'].append(kind)
    stats['per'][kind] = {'high_tris': nh, 'lods': [l['tris'] for l in lods], 'moved_mean_m': float(mv.mean()), 'moved_p95_m': float(np.percentile(mv, 95)), 'moved_max_m': float(mv.max()), 'seconds': round(time.time() - t0, 1)}
    log(kind, json.dumps(stats['per'][kind]))
    json.dump(stats['per'][kind], open(os.path.join(out, f'tent_{kind}_stats.json'), 'w'), indent=1)
stats['seconds'] = round(time.time() - T0, 1)
json.dump(stats, open(os.path.join(out, 'tents_stats.json'), 'w'), indent=1)
log('done', stats['seconds'], 's')
