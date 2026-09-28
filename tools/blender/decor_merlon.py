# PARSA (D-330): the four-stepped merlon's high source, modelled in Blender from the game's own merlon (lod0.ply, written by
# tools/blender/sources/merlon.ts from src/arch/decor.ts crenellationGeometry). Run headless by tools/blender/decor.mjs:
#   blender -b --factory-startup --python tools/blender/decor_merlon.py -- <job.json> <out_dir>
# What it does (every step scripted, the seed fixed; the weathering constants are the job's, C):
#  1. the game's merlon, welded;
#  2. its arrises worn round (Bevel modifier, `bevel` m, 3 segments, on edges sharper than 30 degrees);
#  3. chips knocked out of the convex arrises: ellipsoids placed along every convex edge (`chips_per_m`, sizes `chip_len`
#     along and `chip_across` across the arris), subtracted (Boolean, exact);
#  4. a uniform surface (voxel remesh at `voxel` m), softened (corrective smooth), and the stone's weathering: shallow
#     pitting and grain (two Displace modifiers on procedural noise, `pits` and `grain`);
#  5. exported as high.ply (Blender axes), which tools/blender/bake.py bakes onto lod0 (normal + AO).
import bpy, bmesh, sys, json, math, random, time
from mathutils import Vector, Matrix
argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0])); t0 = time.time()
log = lambda *a: print('[decor_merlon]', *a, flush=True)
rnd = random.Random(job['seed'])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.ply_import(filepath=job['low'])
o = bpy.context.selected_objects[0]; o.name = 'high'; bpy.context.view_layer.objects.active = o
bpy.ops.mesh.customdata_custom_splitnormals_clear()
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=1e-5); bpy.ops.object.mode_set(mode='OBJECT')
# the convex arrises of the game's merlon (before the bevel): for the chips
bm = bmesh.new(); bm.from_mesh(o.data); bm.edges.ensure_lookup_table()
arr = []
for e in bm.edges:
    if len(e.link_faces) != 2: continue
    a, b = e.link_faces; ang = a.normal.angle(b.normal)
    if ang < math.radians(30): continue
    # convex: the other face's centre lies behind this face's plane
    if (b.calc_center_median() - a.calc_center_median()).dot(a.normal) > 1e-6: continue
    arr.append((e.verts[0].co.copy(), e.verts[1].co.copy(), (a.normal + b.normal).normalized()))
bm.free()
log('convex arrises', len(arr))
# one closed surface first (the game's merlon is three solids meeting inside the stone): voxel remesh; the arrises are then
# worn round by smoothing (a few voxels: ~`bevel` m) after the chips are cut
r = o.modifiers.new('remesh', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = job['voxel']; r.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier='remesh'); log('after remesh', len(o.data.vertices))
# the chips: one mesh of ellipsoids
chips = bmesh.new(); n = 0
for (p0, p1, nb) in arr:
    L = (p1 - p0).length; k = max(0, int(round(rnd.gauss(job['chips_per_m'] * L, math.sqrt(job['chips_per_m'] * L + 1e-9)))))
    d = (p1 - p0).normalized()
    for _ in range(k):
        t = rnd.uniform(0.05, 0.95); c = p0 + (p1 - p0) * t
        la = rnd.uniform(*job['chip_len']) / 2; lc = rnd.uniform(*job['chip_across']) / 2
        # the ellipsoid's axes: along the arris, along the bisector (outward) and across both
        x = d; z = nb; y = z.cross(x).normalized()
        c2 = c + z * (lc * rnd.uniform(0.25, 0.55)) + y * rnd.gauss(0, lc * 0.3)
        M = Matrix((x * la, y * lc, z * lc * rnd.uniform(0.8, 1.2))).transposed().to_4x4(); M.translation = c2
        r = bmesh.ops.create_icosphere(chips, subdivisions=2, radius=1.0, matrix=M); n += 1
cm = bpy.data.meshes.new('chips'); chips.to_mesh(cm); chips.free()
co = bpy.data.objects.new('chips', cm); bpy.context.scene.collection.objects.link(co)
log('chips', n)
if n:
    b = o.modifiers.new('chips', 'BOOLEAN'); b.operation = 'DIFFERENCE'; b.object = co; b.solver = 'MANIFOLD'
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='chips'); log('after chips', len(o.data.vertices))
bpy.data.objects.remove(co, do_unlink=True)
r = o.modifiers.new('remesh2', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = job['voxel']; r.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier='remesh2'); log('after remesh 2', len(o.data.vertices))
# the arrises worn round: Laplacian smoothing over ~bevel / voxel rings (volume kept), as a mason's arris wears
s = o.modifiers.new('wear', 'LAPLACIANSMOOTH'); s.iterations = max(2, int(round(job['bevel'] / job['voxel'] * 2))); s.lambda_factor = 0.5; s.use_volume_preserve = True
bpy.ops.object.modifier_apply(modifier='wear')
for key, tex_type in (('pits', 'VORONOI'), ('grain', 'CLOUDS')):
    P = job[key]; t = bpy.data.textures.new(key, tex_type); t.noise_scale = P['scale']
    if tex_type == 'VORONOI': t.distance_metric = 'DISTANCE'; t.noise_intensity = 1.0
    else: t.noise_depth = 2
    d = o.modifiers.new(key, 'DISPLACE'); d.texture = t; d.strength = P['strength']; d.mid_level = 0.5 if tex_type == 'CLOUDS' else 0.0; d.texture_coords = 'GLOBAL'
    if tex_type == 'VORONOI': d.strength = -P['strength']  # (pits: the Voronoi cells' centres sink)
    bpy.ops.object.modifier_apply(modifier=key)
bpy.ops.object.shade_smooth()
bpy.ops.wm.ply_export(filepath=job['high'], export_selected_objects=False, apply_modifiers=True, export_normals=False, export_uv=False, export_colors='NONE', export_triangulated_mesh=True)
log('high', len(o.data.vertices), 'verts', len(o.data.polygons), 'faces', f'{time.time() - t0:.1f} s')
