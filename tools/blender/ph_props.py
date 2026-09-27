# CC0 scanned props for the game (session 12, D-310): Poly Haven glTF downloads -> public/models/props/<id>.glb.
# Headless: blender -b --factory-startup --python tools/blender/ph_props.py -- <jobs.json>
# jobs.json: [{ "id", "src" (the downloaded .gltf), "out" (.glb), "lod0", "lod1" (target triangles), "tex" (px) }]
# Per job: import, parent-clear + apply transforms, join into one mesh (every chosen asset has one material), put the
# base at y = 0 and the footprint's centre at the origin, decimate (collapse) to lod0 and to lod1 (a second object),
# scale the images to `tex`, export a Draco GLB with objects `lod0`, `lod1` sharing the material (JPEG images).
# The measured triangles per level are written to <out>.json for the manifest.
import bpy, sys, json, os

jobs = json.load(open(sys.argv[sys.argv.index('--') + 1]))

def tri_count(ob):
    me = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
    n = sum(len(p.vertices) - 2 for p in me.polygons)
    return n

def clusters(meshes, split):
    # split: the scan file lays several variants side by side; objects whose footprints overlap are one variant
    if not split: return [meshes]
    import mathutils
    boxes = []
    for o in meshes:
        ws = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
        boxes.append((min(v.x for v in ws), max(v.x for v in ws), min(v.y for v in ws), max(v.y for v in ws)))
    par = list(range(len(meshes)))
    def f(i):
        while par[i] != i: par[i] = par[par[i]]; i = par[i]
        return i
    for i in range(len(meshes)):
        for k in range(i + 1, len(meshes)):
            A, B = boxes[i], boxes[k]
            if A[0] < B[1] and B[0] < A[1] and A[2] < B[3] and B[2] < A[3]: par[f(i)] = f(k)
    groups = {}
    for i, o in enumerate(meshes): groups.setdefault(f(i), []).append(o)
    return sorted(groups.values(), key=lambda g: min(b.name for b in g))

out_all = []
for j in jobs:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=j['src'])
    allm = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    groups = clusters(allm, j.get('split', False))
    names = [[o.name for o in g] for g in groups]
    for gi, gnames in enumerate(names):
      if len(names) > 1:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=j['src'])
      meshes = [bpy.data.objects[n] for n in gnames]
      vid = j['id'] if len(names) == 1 else '%s_v%d' % (j['id'], gi + 1)
      outp = j['out'] if len(names) == 1 else j['out'].replace(j['id'] + '.glb', vid + '.glb')
      bpy.ops.object.select_all(action='DESELECT')
      for o in meshes: o.select_set(True)
      bpy.context.view_layer.objects.active = meshes[0]
      bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
      bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
      if len(meshes) > 1: bpy.ops.object.join()
      ob = bpy.context.view_layer.objects.active
      for o in list(bpy.context.scene.objects):
          if o is not ob: bpy.data.objects.remove(o, do_unlink=True)
      xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]; zs = [v.co.z for v in ob.data.vertices]
      cx, cy, z0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
      for v in ob.data.vertices: v.co.x -= cx; v.co.y -= cy; v.co.z -= z0
      tris0 = tri_count(ob)
      ob.name = 'lod0'; ob.data.name = 'lod0'
      lod1 = ob.copy(); lod1.data = ob.data.copy(); lod1.name = 'lod1'; lod1.data.name = 'lod1'; bpy.context.scene.collection.objects.link(lod1)
      res = {}
      for o, target in ((ob, j['lod0']), (lod1, j['lod1'])):
          r = min(1.0, target / max(1, tris0))
          if r < 1.0:
              m = o.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = r; m.use_collapse_triangulate = True
              bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='dec')
          res[o.name] = tri_count(o)
      for img in bpy.data.images:
          if img.size[0] > j['tex']: img.scale(j['tex'], j['tex'])
      bpy.ops.export_scene.gltf(filepath=outp, export_format='GLB', export_draco_mesh_compression_enable=True,
                                export_draco_mesh_compression_level=6, export_image_format='JPEG', export_jpeg_quality=85,
                                export_apply=True, export_yup=True, export_tangents=False, export_materials='EXPORT')
      size = [max(xs) - min(xs), max(zs) - min(zs), max(ys) - min(ys)]
      out_all.append({'id': vid, 'of': j['id'], 'file': outp, 'src_tris': tris0, 'tris': res, 'size_m': size, 'tex': j['tex']})
      print('[ph_props]', vid, tris0, res, size)
json.dump(out_all, open(sys.argv[sys.argv.index('--') + 1] + '.out.json', 'w'))
