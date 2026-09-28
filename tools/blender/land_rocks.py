# The hills' bedrock as real geometry (session 12, D-335; the land agent): CC0 scanned cliffs, rock faces, outcrops and scree
# (Poly Haven, CC0 1.0) cut into pieces, oriented, decimated to three levels, and their maps packed into one 2x2 atlas per
# class, so each class draws with one material (one pipeline) at every level.
#   blender -b --factory-startup --python tools/blender/land_rocks.py -- <jobs.json>
# jobs.json: { "out": dir, "tex": cell px, "classes": { <class>: [ { "src": .gltf, "id": piece id prefix, "segs": n,
#   "keep": [segment indices] | null, "flat": bool, "lods": [t0, t1, t2] } ... up to 4 sources (the atlas cells) ] } }
# Per source: import, join, apply transforms, weld the corners split along UV seams; a ledge (flat = false) is turned about
# the vertical so its area-weighted mean normal faces -Y (glTF +Z: the piece's front, set downhill at runtime); a long cliff is
# cut into `segs` pieces along X (bmesh bisect); each piece: footprint centred, base at z = 0 (its lowest 2 % of vertices),
# decimated (collapse) to its three levels (lod0 near, lod1 mid, lod2 far), its UVs moved into the source's atlas cell (a
# 24 px margin of the image's own edge pixels against mip bleeding). Output: <out>/<class>.glb (Draco; nodes <piece>__lod<k>,
# geometry only) and <out>/<class>_{diff,nor,arm}.jpg (atlases) and <out>/<class>.json (pieces: size, tris per level).
import bpy, bmesh, sys, json, os, math
import numpy as np
from mathutils import Vector, Matrix

job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
OUT, CELL = job['out'], job['tex']
MARGIN = 24
os.makedirs(OUT, exist_ok=True)

def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)

def load_img(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(a); a = a.reshape(h, w, 4)
    bpy.data.images.remove(img)
    return a

def resize(a, n):
    # box-filter down to n x n (source sizes are powers of two >= n)
    h, w = a.shape[:2]
    fy, fx = h // n, w // n
    if fy >= 1 and fx >= 1 and h % n == 0 and w % n == 0:
        return a.reshape(n, fy, n, fx, a.shape[2]).mean(axis=(1, 3))
    ys = (np.arange(n) * h / n).astype(int); xs = (np.arange(n) * w / n).astype(int)
    return a[ys][:, xs]

def cell_image(a, inner):
    # the image scaled to `inner` px with its edge pixels extended over the margin (CELL = inner + 2 MARGIN)
    r = resize(a, inner)
    return np.pad(r, ((MARGIN, MARGIN), (MARGIN, MARGIN), (0, 0)), mode='edge')

def textures_of(ob):
    maps = {}
    for slot in ob.material_slots:
        m = slot.material
        if not m or not m.use_nodes: continue
        for n in m.node_tree.nodes:
            if n.type != 'TEX_IMAGE' or not n.image: continue
            p = bpy.path.abspath(n.image.filepath)
            key = 'diff' if 'diff' in p else 'nor' if 'nor' in p else 'arm' if 'arm' in p else None
            if key: maps[key] = p
    return maps

ONLY = os.environ.get('CLS')
for cls, sources in job['classes'].items():
    if ONLY and cls != ONLY: continue
    atlas = {k: np.zeros((2 * CELL, 2 * CELL, 4), dtype=np.float32) for k in ('diff', 'nor', 'arm')}
    atlas['nor'][..., :] = (0.5, 0.5, 1.0, 1.0); atlas['arm'][..., :] = (1.0, 0.9, 0.0, 1.0)
    pieces_out = []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    keep_objs = []
    for si, s in enumerate(sources):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=s['src'])
        new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
        maps = textures_of(new[0])
        bpy.ops.object.select_all(action='DESELECT')
        for o in new: o.select_set(True)
        bpy.context.view_layer.objects.active = new[0]
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        if len(new) > 1: bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        for o in [o for o in bpy.data.objects if o not in before and o is not ob]: bpy.data.objects.remove(o, do_unlink=True)
        # weld coincident corners (the importer splits them along seams); UVs survive per face corner
        bm = bmesh.new(); bm.from_mesh(ob.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5 * max(ob.dimensions))
        # the front: the area-weighted mean normal, horizontal, turned to -Y
        if not s.get('flat'):
            nsum = Vector((0, 0, 0))
            for f in bm.faces: nsum += f.normal * f.calc_area()
            h = Vector((nsum.x, nsum.y, 0))
            if h.length > 1e-6:
                ang = math.atan2(h.x, -h.y)  # angle from -Y
                bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(ang, 3, 'Z'))
        bm.to_mesh(ob.data); bm.free(); ob.data.update()
        # the atlas cell of this source
        cx, cy = si % 2, si // 2
        inner = CELL - 2 * MARGIN
        for k in ('diff', 'nor', 'arm'):
            if k in maps:
                img = cell_image(load_img(maps[k]), inner)
                # Blender's pixel rows run bottom-up, as UV v does: cell (cx, cy) at v in [cy/2, (cy+1)/2]
                atlas[k][cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL, :img.shape[2]] = img
        u0, v0, sc = (cx * CELL + MARGIN) / (2 * CELL), (cy * CELL + MARGIN) / (2 * CELL), inner / (2 * CELL)
        uvl = ob.data.uv_layers.active
        for d in uvl.data:
            u, v = d.uv
            d.uv = (u0 + min(1, max(0, u)) * sc, v0 + min(1, max(0, v)) * sc)
        # cut into segments along X
        xs = [v.co.x for v in ob.data.vertices]
        x0, x1 = min(xs), max(xs)
        segs = s.get('segs', 1)
        keep = s.get('keep') or list(range(segs))
        for k in keep:
            a, b = x0 + (x1 - x0) * k / segs, x0 + (x1 - x0) * (k + 1) / segs
            p = ob.copy(); p.data = ob.data.copy(); bpy.context.scene.collection.objects.link(p)
            if segs > 1:
                bm = bmesh.new(); bm.from_mesh(p.data)
                if k > 0: bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(a, 0, 0), plane_no=(-1, 0, 0), clear_outer=True)
                if k < segs - 1: bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(b, 0, 0), plane_no=(1, 0, 0), clear_outer=True)
                bm.to_mesh(p.data); bm.free(); p.data.update()
            vs = [v.co for v in p.data.vertices]
            if len(vs) < 50: bpy.data.objects.remove(p, do_unlink=True); continue
            X = [v.x for v in vs]; Y = [v.y for v in vs]; Z = sorted(v.z for v in vs)
            ccx, ccy, z0 = (min(X) + max(X)) / 2, (min(Y) + max(Y)) / 2, Z[int(len(Z) * 0.02)]
            for v in p.data.vertices: v.co.x -= ccx; v.co.y -= ccy; v.co.z -= z0
            p.data.update()
            pid = s['id'] if segs == 1 else '%s_%d' % (s['id'], k)
            tris = {}
            lods = []
            prev = p  # each level decimated from the one before (a 1 M-triangle scan collapses once)
            for li, target in enumerate(s['lods']):
                q = prev.copy(); q.data = prev.data.copy(); bpy.context.scene.collection.objects.link(q); prev = q
                r = min(1.0, target / max(1, tri_count(q)))
                if r < 1.0:
                    m = q.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = r; m.use_collapse_triangulate = True
                    bpy.context.view_layer.objects.active = q; bpy.ops.object.modifier_apply(modifier='dec')
                q.name = '%s__lod%d' % (pid, li); q.data.name = q.name
                for sl in q.material_slots: sl.material = None
                q.data.materials.clear()
                tris['lod%d' % li] = tri_count(q); lods.append(q)
            vs = [v.co for v in p.data.vertices]
            size = [max(v.x for v in vs) - min(v.x for v in vs), max(v.z for v in vs) - min(v.z for v in vs), max(v.y for v in vs) - min(v.y for v in vs)]
            bpy.data.objects.remove(p, do_unlink=True)
            keep_objs += lods
            pieces_out.append({'id': pid, 'src': os.path.basename(s['src']).replace('.gltf', ''), 'cell': si, 'size_m': size, 'tris': tris, 'flat': bool(s.get('flat'))})
            print('[land_rocks]', cls, pid, size, tris)
        bpy.data.objects.remove(ob, do_unlink=True)
    # atlases
    for k, a in atlas.items():
        img = bpy.data.images.new('%s_%s' % (cls, k), 2 * CELL, 2 * CELL, alpha=False, float_buffer=False)
        if k != 'diff': img.colorspace_settings.name = 'Non-Color'
        img.pixels.foreach_set(np.ascontiguousarray(a, dtype=np.float32).ravel())
        img.filepath_raw = os.path.join(OUT, '%s_%s.jpg' % (cls, k)); img.file_format = 'JPEG'
        img.save(filepath=img.filepath_raw, quality=88)
    # geometry
    bpy.ops.object.select_all(action='DESELECT')
    for o in keep_objs: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, cls + '.glb'), export_format='GLB', use_selection=True,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                              export_apply=True, export_yup=True, export_tangents=False, export_materials='NONE', export_normals=True, export_texcoords=True)
    json.dump({'pieces': pieces_out}, open(os.path.join(OUT, cls + '.json'), 'w'), indent=1)
print('[land_rocks] done')
