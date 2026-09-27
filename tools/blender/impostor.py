# PARSA asset pipeline (D-305): an octahedral impostor atlas of a built GLB level, for far distances (research/BLENDER_PLAN.md
# row 19). Views on the upper hemisphere laid out on a hemi-octahedral grid (n x n cells; cell (i, j) looks from the
# direction octahedron-decoded from its centre), each an orthographic Cycles render of the level's world-space normal
# (packed 0.5 + 0.5 n, alpha = coverage), so the game can re-light it with its own sun and sky. Albedo is the game's (the
# surface's measured tint), not baked. NOT yet wired into the game (no loader path): built and measured here only.
# blender -b --factory-startup --python tools/blender/impostor.py -- <glb> <out.png> [lod=1] [n=8] [cell=128]
import bpy, sys, math, mathutils, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]
glb, out = a[0], a[1]; lod = int(a[2]) if len(a) > 2 else 1; n = int(a[3]) if len(a) > 3 else 8; px = int(a[4]) if len(a) > 4 else 128
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.seed = 0; sc.cycles.use_denoising = False
sc.render.film_transparent = True; sc.view_settings.view_transform = 'Standard'; sc.render.resolution_x = sc.render.resolution_y = px
sc.render.image_settings.color_mode = 'RGBA'
bpy.ops.import_scene.gltf(filepath=glb)
for o in [o for o in sc.objects if o.type == 'MESH' and not o.name.startswith(f'lod{lod}')]: bpy.data.objects.remove(o, do_unlink=True)
o = next(o for o in sc.objects if o.type == 'MESH')
m = bpy.data.materials.new('nrm'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
g = nt.nodes.new('ShaderNodeNewGeometry'); vm = nt.nodes.new('ShaderNodeVectorMath'); vm.operation = 'MULTIPLY_ADD'
vm.inputs[1].default_value = (0.5, 0.5, 0.5); vm.inputs[2].default_value = (0.5, 0.5, 0.5)
em = nt.nodes.new('ShaderNodeEmission'); outn = nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(g.outputs['Normal'], vm.inputs[0]); nt.links.new(vm.outputs['Vector'], em.inputs['Color']); nt.links.new(em.outputs['Emission'], outn.inputs['Surface'])
o.data.materials.clear(); o.data.materials.append(m)
bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]; c = sum(bb, mathutils.Vector()) / 8; r = max((v - c).length for v in bb)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2 * r; cam.data.clip_end = 4 * r
atlas = np.zeros((n * px, n * px, 4), np.float32)
for i in range(n):
    for j in range(n):
        u, v = (i + 0.5) / n * 2 - 1, (j + 0.5) / n * 2 - 1  # hemi-octahedral decode (Blender z up)
        x, y = (u + v) / 2, (u - v) / 2; z = 1 - abs(x) - abs(y)
        d = mathutils.Vector((x, y, max(z, 0))).normalized()
        cam.location = c + d * 2 * r; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = out + '.cell.png'; bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(sc.render.filepath, check_existing=False)
        atlas[j * px:(j + 1) * px, i * px:(i + 1) * px] = np.array(im.pixels[:], np.float32).reshape(px, px, 4); bpy.data.images.remove(im)
img = bpy.data.images.new('atlas', n * px, n * px, alpha=True); img.colorspace_settings.name = 'Non-Color'
img.pixels.foreach_set(atlas.ravel()); img.filepath_raw = out; img.file_format = 'PNG'; img.save()
import os; os.remove(out + '.cell.png')
print('[impostor]', out, f'{n}x{n} cells of {px} px, coverage {float((atlas[..., 3] > 0.5).mean()):.3f}')
