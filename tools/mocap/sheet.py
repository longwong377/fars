# D-333: renders a contact sheet OBJ written by tools/mocap/preview.ts (iteration only): Workbench, studio light,
# orthographic views framed on the whole grid; one PNG per view (<png>_<view>.png). A ground plane with a 0.5 m grid.
#   blender -b --factory-startup --python tools/mocap/sheet.py -- <job.json>
import bpy, sys, json, math
from mathutils import Vector
job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'SINGLE'; sh.single_color = (0.75, 0.62, 0.5); sh.show_shadows = True; sh.show_cavity = True
bpy.ops.wm.obj_import(filepath=job['obj'], forward_axis='NEGATIVE_Z', up_axis='Y')
objs = [o for o in sc.objects if o.type == 'MESH']
lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
for o in objs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c); lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
lo.z = min(lo.z, 0)
pad = float(job.get('pad', 0.6))
# ground grid
bpy.ops.mesh.primitive_grid_add(x_subdivisions=int((hi.x - lo.x + 2 * pad) / 0.5), y_subdivisions=int((hi.y - lo.y + 2 * pad) / 0.5), size=1, location=((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, 0))
g = sc.objects[-1] if sc.objects[-1].type == 'MESH' else bpy.context.active_object
g.scale = (hi.x - lo.x + 2 * pad, hi.y - lo.y + 2 * pad, 1)
mod = g.modifiers.new('w', 'WIREFRAME'); mod.thickness = 0.01
R = int(job.get('res', 1600))
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
cx, cy, cz = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2
for view in job['views']:
    if view == 'side':   # looking along -X at the +Z-forward bodies' right side... from +X: forward (game +Z = blender -Y) to the left
        co.rotation_mode = 'XYZ'; co.location = (hi.x + 10, cy, cz); co.rotation_euler = (math.pi / 2, 0, math.pi / 2); w, h = hi.y - lo.y, hi.z - lo.z
    elif view == 'front':  # from the game's +Z (blender -Y) looking back at the faces
        co.rotation_mode = 'XYZ'; co.location = (cx, lo.y - 10, cz); co.rotation_euler = (math.pi / 2, 0, 0); w, h = hi.x - lo.x, hi.z - lo.z
    else:  # three-quarter
        c = Vector((cx, cy, cz)); d = Vector((1, -1, 0.7)).normalized(); co.location = c + d * 30
        co.rotation_mode = 'QUATERNION'; co.rotation_quaternion = (-d).to_track_quat('-Z', 'Y'); w, h = (hi.x - lo.x + hi.y - lo.y) * 0.72, (hi.x - lo.x + hi.y - lo.y) * 0.45 + (hi.z - lo.z)
    cam.ortho_scale = max(w, h) * 1.05 + 0.2
    asp = max(0.2, min(5, (w + 0.2) / (h + 0.2)))
    sc.render.resolution_x = R if asp >= 1 else int(R * asp); sc.render.resolution_y = int(R / asp) if asp >= 1 else R
    sc.render.filepath = job['png'].replace('.png', '_' + view + '.png'); bpy.ops.render.render(write_still=True)
