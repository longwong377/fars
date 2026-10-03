# PARSA s17 V4 (D-510; B361): the Gate's W bull, joined into one carved surface (Blender, headless).
#   blender -b --factory-startup --python tools/blender/scans/bull_graft.py -- <dir> [voxel=0.006] [smooth=60]
# Reads <dir>/bull_body.ply (the lamassu's bull body with the wing pressed and the human head drawn in) and <dir>/bull_head.ply
# (the bull-head scan set on the shoulders), both written by tools/blender/scans/bull_from_lamassu.ts in the game's frame
# (tools/blender/lib/ply.ts stores Blender axes: X = x, Y = -z, Z = y). Then:
#  - the pressed wing's area (and the back's round where the wing lay) is relaxed with the selection's border held, so the
#    flattened feather plates melt into a plain flank;
#  - the head's scan is closed (its cut neck) and smoothed (the scan's facets), one Catmull-Clark level;
#  - both are joined (the neck's scan set into the shoulders; voxel remesh optional: the lamassu is not watertight and OpenVDB
#    turned it into a double shell);
#  - written as <dir>/bull_remesh.ply (positions and normals, triangles) for colossus_scan.ts (`bull_graft`).
import bpy, bmesh, sys, os

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
D = argv[0]
VOX = float(argv[1]) if len(argv) > 1 else 0.0  # 0: no remesh (the sculpt is not watertight: OpenVDB thickened it into a double shell, measured s17)
SM = int(argv[2]) if len(argv) > 2 else 300

def imp(p):
    bpy.ops.wm.ply_import(filepath=p)
    return bpy.context.selected_objects[0]

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
body = imp(os.path.join(D, 'bull_body.ply'))
head = imp(os.path.join(D, 'bull_head.ply'))

# the wing's area in the side view (game x, y), as bull_from_lamassu.ts WING, and the back's round where the wing lay
WING = [(-0.45, 3.0), (0.3, 2.52), (0.87, 2.08), (1.5, 1.72), (2.12, 1.4), (2.16, 1.98), (1.95, 2.7), (1.72, 3.6), (1.3, 3.95), (0.4, 3.95), (-0.45, 3.5)]
def inpoly(x, y, P):
    c = False; j = len(P) - 1
    for i in range(len(P)):
        xi, yi = P[i]; xj, yj = P[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
        j = i
    return c
ZS = 0.23
bm = bmesh.new(); bm.from_mesh(body.data)
sel = 0
for v in bm.verts:
    x, y, z = v.co.x, v.co.z, -v.co.y  # game axes
    on = (inpoly(x, y, WING) and z > ZS - 0.05) or (-0.6 < x < 1.25 and 2.8 < y < 3.6 and z > ZS - 0.1)
    v.select = on; sel += on
bm.select_flush(True)
# relax: the selection smoothed with its unselected border held (plates melt, the flank round them stays)
bm.to_mesh(body.data); bm.free()
bpy.context.view_layer.objects.active = body
for o in bpy.context.selected_objects: o.select_set(False)
body.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.vertices_smooth(factor=1.0, repeat=SM)
bpy.ops.object.mode_set(mode='OBJECT')
print('[bull_graft] relaxed', sel, 'vertices x', SM)

# the head: close the cut neck, take the facets off, one smooth level
bpy.context.view_layer.objects.active = head
for o in bpy.context.selected_objects: o.select_set(False)
head.select_set(True)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0005)
bpy.ops.mesh.fill_holes(sides=0)
bpy.ops.mesh.vertices_smooth(factor=0.5, repeat=4)
bpy.ops.object.mode_set(mode='OBJECT')
sub = head.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; sub.render_levels = 1
bpy.ops.object.modifier_apply(modifier='sub')

# join and remesh
body.select_set(True); head.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
if VOX > 0:
    body.data.remesh_voxel_size = VOX
    body.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()
print('[bull_graft] joined', len(body.data.polygons), 'faces; voxel', VOX)
bpy.ops.wm.ply_export(filepath=os.path.join(D, 'bull_remesh.ply'), export_selected_objects=False, export_uv=False, export_normals=True,
                      export_colors='NONE', export_attributes=False, export_triangulated_mesh=True, ascii_format=False, apply_modifiers=True)
print('[bull_graft] wrote', os.path.join(D, 'bull_remesh.ply'))
