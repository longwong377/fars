# The modelling library of the project's modelled props (session 12, D-325; tools/blender/model_props.py builds the assets).
# Everything is made from numbers in a script (no hand-shaped .blend): lathes (turned and thrown forms, with the wobble of a
# hand-thrown pot), sweeps (a profile swept along a path: rods, handles, blades, bow limbs), bevelled boxes (boards, planks,
# straps), metaballs (organic forms: a lion's paw, a bull's hoof, a filled sack, a heap), voxel remeshing (one closed surface
# from a union of parts), cloth simulation (a cover draped over a couch, a sack settled on the ground), noise displacement,
# weld + collapse decimation to each level's triangle target, and an ambient-occlusion bake into a vertex colour (Cycles,
# CPU: the crevices of a paw, the joints of planks, the underside of a bowl's rim).
# Axes: Blender's (z up). The game's +z (the builders' "front", toward the performer or into the room) is Blender's -y; the
# glTF export (export_yup) turns Blender (x, y, z) into three (x, z, -y).
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, noise

TAU = math.tau

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def link(me, name):
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); return ob

def from_bm(bm, name, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = link(me, name)
    if smooth:
        for p in me.polygons: p.use_smooth = True
    return ob

def sharp(ob, deg=40):
    """smooth shading with sharp edges above `deg` (the exporter splits normals there)"""
    me = ob.data
    for p in me.polygons: p.use_smooth = True
    try: me.set_sharp_from_angle(angle=math.radians(deg))
    except Exception: pass
    return ob

def select_only(obs, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = active or obs[0]

def apply_mods(ob):
    select_only([ob])
    for m in list(ob.modifiers):
        try: bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as e: print('[mp] modifier', m.name, 'failed on', ob.name, e); ob.modifiers.remove(m)
    return ob

def apply_xf(ob):
    select_only([ob]); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); return ob

def join(obs, name=None):
    obs = [o for o in obs if o is not None]
    if not obs: return None
    for o in obs: apply_mods(o)
    select_only(obs, obs[0]); bpy.ops.object.join(); ob = bpy.context.view_layer.objects.active
    if name: ob.name = name; ob.data.name = name
    apply_xf(ob); return ob

def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)

def weld(ob, dist=1e-5):
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist); bm.to_mesh(ob.data); bm.free(); return ob

def triangulate(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.triangulate(bm, faces=bm.faces); bm.to_mesh(ob.data); bm.free(); return ob

def decimate(ob, target):
    """weld, then collapse to about `target` triangles (the silhouette-keeping quadric collapse)"""
    weld(ob); n = tris(ob)
    if n > target:
        m = ob.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = max(0.001, target / n); m.use_collapse_triangulate = True
        apply_mods(ob)
    return ob

def copy(ob, name):
    o = ob.copy(); o.data = ob.data.copy(); o.name = name; o.data.name = name; bpy.context.scene.collection.objects.link(o); return o

def xform(ob, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    ob.location = loc; ob.rotation_euler = rot; ob.scale = scale; return apply_xf(ob)

def move_mesh(ob, M):
    ob.data.transform(M); ob.data.update(); return ob

# ---------------------------------------------------------------------------------------------------------------- shapes
def lathe(profile, seg=24, name='lathe', wobble=0.0, seed=0, smooth=True, close_top=True, close_bottom=True, ellip=(1, 1)):
    """a surface of revolution about z: profile = [(r, z), ...] bottom to top. Points with r = 0 become poles. `wobble`:
    the hand-thrown irregularity (a fraction of r, low-frequency round the pot and up it); `ellip` squashes x, y"""
    bm = bmesh.new(); rings = []
    rnd = random.Random(seed); ph = [rnd.random() * TAU for _ in range(4)]
    for (r, z) in profile:
        if r <= 1e-6:
            rings.append([bm.verts.new((0, 0, z))]); continue
        ring = []
        for i in range(seg):
            a = TAU * i / seg
            w = 1 + wobble * (math.sin(2 * a + ph[0] + 3 * z) * 0.6 + math.sin(3 * a + ph[1] + 5 * z) * 0.4 + 0.5 * math.sin(a + ph[2]))
            ring.append(bm.verts.new((r * w * math.cos(a) * ellip[0], r * w * math.sin(a) * ellip[1], z + wobble * r * 0.15 * math.sin(a + ph[3]))))
        rings.append(ring)
    for k in range(len(rings) - 1):
        A, B = rings[k], rings[k + 1]
        if len(A) == 1 and len(B) == 1: continue
        if len(A) == 1:
            for i in range(seg): bm.faces.new((A[0], B[i], B[(i + 1) % seg]))
        elif len(B) == 1:
            for i in range(seg): bm.faces.new((A[i], B[0], A[(i + 1) % seg]))
        else:
            for i in range(seg): bm.faces.new((A[i], A[(i + 1) % seg], B[(i + 1) % seg], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bm(bm, name, smooth)

def vessel(outer, wall=0.008, seg=28, name='vessel', wobble=0.01, seed=0, lip=True):
    """a thrown vessel: the outer profile [(r, z)] from the foot to the rim, the inner wall `wall` inside it, the rim rounded;
    one closed surface (inside visible through the mouth)"""
    inner = []
    for i in range(len(outer) - 1, -1, -1):
        r, z = outer[i]
        if i == 0: inner.append((0.0, z + wall)); continue
        inner.append((max(0.0, r - wall), max(z, outer[0][1] + wall)))
    rim_r, rim_z = outer[-1]
    prof = [(0.0, outer[0][1])] + outer + [(rim_r - wall * 0.5, rim_z + wall * 0.35)] + inner[1:]
    # the inner profile runs top to bottom: the lathe keeps the order, so the inner faces face inward
    return lathe(prof, seg, name, wobble, seed)

def sweep(points, radius, seg=8, name='sweep', caps=True, scale=None, smooth=True, twist=0.0, up=(0, 0, 1)):
    """a tube along a polyline `points` with `radius` (a number, a list per point, or a function of t in 0..1); `scale` (sx,
    sy) flattens the section (a blade, a limb); `up` the section's reference direction"""
    pts = [Vector(p) for p in points]; n = len(pts)
    rad = (lambda t: radius) if isinstance(radius, (int, float)) else (lambda t, r=radius: r[min(len(r) - 1, int(round(t * (len(r) - 1))))]) if isinstance(radius, (list, tuple)) else radius
    bm = bmesh.new(); rings = []; U = Vector(up)
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        x = U.cross(d);
        if x.length < 1e-6: x = Vector((1, 0, 0)).cross(d)
        x.normalize(); y = d.cross(x).normalized(); t = i / max(1, n - 1); r = rad(t)
        sx, sy = (scale if scale else (1, 1)); ring = []
        for k in range(seg):
            a = TAU * k / seg + twist * t
            ring.append(bm.verts.new(p + x * (math.cos(a) * r * sx) + y * (math.sin(a) * r * sy)))
        rings.append(ring)
    for i in range(n - 1):
        A, B = rings[i], rings[i + 1]
        for k in range(seg): bm.faces.new((A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]))
    if caps:
        bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bm(bm, name, smooth)

def cyl(r, h, seg=12, name='cyl', loc=(0, 0, 0), r2=None, caps=True):
    """a cylinder (or frustum r -> r2) standing on z = loc.z"""
    return sweep([(loc[0], loc[1], loc[2]), (loc[0], loc[1], loc[2] + h)], [r, r if r2 is None else r2], seg, name, caps, smooth=True)

def box(sx, sy, sz, loc=(0, 0, 0), name='box', bevel=0.0, segs=2, base=True):
    """a box sx x sy x sz; `base`: loc is the middle of its bottom face (else its centre); `bevel` the rounded arris width"""
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz + (sz / 2 if base else 0))) + Vector(loc)
    ob = from_bm(bm, name, smooth=False)
    if bevel > 0:
        m = ob.modifiers.new('bev', 'BEVEL'); m.width = bevel; m.segments = segs; m.limit_method = 'NONE'; m.harden_normals = False
        apply_mods(ob)
    return sharp(ob, 50)

def meta(elems, res=0.01, name='meta', thresh=0.6):
    """metaballs -> mesh: elems = [(type, (x, y, z), radius, (sx, sy, sz) or None, stiffness)]; `res` the polygonising size"""
    mb = bpy.data.metaballs.new(name); mb.resolution = res; mb.render_resolution = res; mb.threshold = thresh
    for e in elems:
        typ, co, r = e[0], e[1], e[2]; el = mb.elements.new(type=typ); el.co = co; el.radius = r
        if len(e) > 3 and e[3] is not None: el.size_x, el.size_y, el.size_z = e[3]
        if len(e) > 4: el.stiffness = e[4]
        if len(e) > 5: el.rotation = e[5]
    mo = bpy.data.objects.new(name + '_mb', mb); bpy.context.scene.collection.objects.link(mo)
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(mo.evaluated_get(dg)); bpy.data.objects.remove(mo, do_unlink=True)
    ob = link(me, name)
    for p in me.polygons: p.use_smooth = True
    return ob

def remesh(ob, voxel, smooth=True):
    m = ob.modifiers.new('rm', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = voxel; m.use_smooth_shade = smooth; apply_mods(ob); return ob

def displace(ob, strength, size, seed=0, kind='CLOUDS', mid=0.5):
    tex = bpy.data.textures.new('d%d' % seed, kind); tex.noise_scale = size
    try: tex.noise_depth = 2
    except Exception: pass
    m = ob.modifiers.new('disp', 'DISPLACE'); m.texture = tex; m.strength = strength; m.mid_level = mid; m.texture_coords = 'OBJECT'
    e = bpy.data.objects.new('e%d' % seed, None); bpy.context.scene.collection.objects.link(e); e.location = (seed * 1.37, seed * 2.11, seed * 0.73); m.texture_coords_object = e
    apply_mods(ob); bpy.data.objects.remove(e, do_unlink=True); return ob

def subdiv(ob, levels=1):
    m = ob.modifiers.new('sub', 'SUBSURF'); m.levels = levels; m.render_levels = levels; apply_mods(ob); return ob

def solidify(ob, t, offset=-1):
    m = ob.modifiers.new('sol', 'SOLIDIFY'); m.thickness = t; m.offset = offset; apply_mods(ob); return ob

def bevel(ob, w, segs=2, angle=40):
    m = ob.modifiers.new('bev', 'BEVEL'); m.width = w; m.segments = segs; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(angle); apply_mods(ob); return ob

def boolean(ob, cutter, op='DIFFERENCE'):
    m = ob.modifiers.new('bool', 'BOOLEAN'); m.operation = op; m.object = cutter; m.solver = 'EXACT'
    apply_mods(ob); bpy.data.objects.remove(cutter, do_unlink=True); return ob

def grid(sx, sy, nx, ny, name='grid', z=0.0):
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=nx, y_segments=ny, size=0.5)
    for v in bm.verts: v.co = Vector((v.co.x * sx, v.co.y * sy, z))
    return from_bm(bm, name)

def drape(cloth, colliders, frames=40, mass=0.3, bending=0.5, thickness=0.004, pin=None, pressure=0.0, gravity=True, shrink=0.0):
    """cloth simulation: `cloth` settles on `colliders` for `frames` frames (24 fps); `pin` a function of the vertex
    position returning a pin weight (0..1); `pressure` inflates a closed cloth (a filled sack). The result replaces the mesh"""
    sc = bpy.context.scene; sc.frame_start = 1; sc.frame_end = frames
    for c in colliders:
        m = c.modifiers.new('col', 'COLLISION'); c.collision.thickness_outer = thickness; c.collision.cloth_friction = 8
    if pin:
        vg = cloth.vertex_groups.new(name='pin')
        for v in cloth.data.vertices:
            w = pin(cloth.matrix_world @ v.co)
            if w > 1e-4: vg.add([v.index], float(w), 'REPLACE')
    m = cloth.modifiers.new('cloth', 'CLOTH'); s = m.settings; cs = m.collision_settings
    s.quality = 8; s.mass = mass; s.bending_stiffness = bending; s.tension_stiffness = s.compression_stiffness = 15; s.shear_stiffness = 5
    s.air_damping = 1.0; s.shrink_min = shrink
    if not gravity: s.effector_weights.gravity = 0.0
    if pin: s.vertex_group_mass = 'pin'
    if pressure:
        s.use_pressure = True; s.uniform_pressure_force = pressure; s.use_pressure_volume = False
    cs.use_collision = True; cs.distance_min = thickness; cs.use_self_collision = True; cs.self_distance_min = thickness
    m.point_cache.frame_start = 1; m.point_cache.frame_end = frames
    for f in range(1, frames + 1): sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(cloth.evaluated_get(dg))
    old = cloth.data; cloth.modifiers.clear(); cloth.data = me; bpy.data.meshes.remove(old)
    for c in colliders: c.modifiers.clear()
    for p in cloth.data.polygons: p.use_smooth = True
    sc.frame_set(1)
    return cloth

# ---------------------------------------------------------------------------------------------------------------- animal feet
def lion_paw(r=0.05, name='paw'):
    """a lion's paw (the throne's and the tables' feet on the Treasury audience relief): a pad, four toes forward, the
    dew-claw behind; standing on z = 0, facing -y (the game's front); r is the paw's half width"""
    e = [('ELLIPSOID', (0, 0.1 * r, 0.55 * r), r, (1.0, 1.1, 0.75), 2)]
    for i, x in enumerate((-0.62, -0.21, 0.21, 0.62)):
        e.append(('ELLIPSOID', (x * r, -0.85 * r + abs(x) * 0.25 * r, 0.3 * r), 0.36 * r, (0.9, 1.25, 0.95), 2))
    e.append(('ELLIPSOID', (0, 0.25 * r, 1.25 * r), 0.8 * r, (0.9, 0.9, 1.1), 2))  # the ankle rising into the leg
    ob = meta(e, res=r / 9, name=name)
    # flatten the sole on z = 0
    for v in ob.data.vertices:
        if v.co.z < 0: v.co.z = 0
    return ob

def hoof(r=0.04, name='hoof'):
    """a bull's cloven hoof and fetlock (the footstool's legs), standing on z = 0, facing -y"""
    e = [('ELLIPSOID', (-0.45 * r, -0.2 * r, 0.45 * r), 0.55 * r, (0.9, 1.3, 1.0), 2), ('ELLIPSOID', (0.45 * r, -0.2 * r, 0.45 * r), 0.55 * r, (0.9, 1.3, 1.0), 2),
         ('ELLIPSOID', (0, 0.15 * r, 1.3 * r), 0.75 * r, (1.0, 1.0, 1.1), 2), ('ELLIPSOID', (0, 0.45 * r, 1.0 * r), 0.3 * r, (1.0, 1.0, 1.0), 2)]
    ob = meta(e, res=r / 9, name=name)
    for v in ob.data.vertices:
        if v.co.z < 0: v.co.z = 0
    # the cleft between the two claws
    for v in ob.data.vertices:
        if abs(v.co.x) < 0.1 * r and v.co.y < -0.1 * r and v.co.z < 0.8 * r: v.co.y += 0.25 * r * (1 - abs(v.co.x) / (0.1 * r))
    return ob

def turned_leg(h, r, seg=12, name='leg', feet=None):
    """a turned leg (bead and reel, a capital under the rail) from z = 0 to h, radius r at the shaft"""
    p = [(0.0, 0), (r * 1.25, 0), (r * 1.3, 0.03 * h), (r * 0.9, 0.06 * h), (r * 1.2, 0.1 * h), (r * 0.8, 0.14 * h), (r * 0.72, 0.4 * h), (r * 1.15, 0.47 * h),
         (r * 1.15, 0.5 * h), (r * 0.75, 0.54 * h), (r * 0.7, 0.78 * h), (r * 1.05, 0.83 * h), (r * 0.85, 0.87 * h), (r * 1.35, 0.95 * h), (r * 1.35, h), (0.0, h)]
    return lathe(p, seg, name)

# ---------------------------------------------------------------------------------------------------------------- AO + export
def bake_ao(obs, samples=48, ground=False, dist=0.15):
    """ambient occlusion baked into each object's vertex colour 'ao' (Cycles, CPU): the objects occlude each other (and a
    floor at z = 0 when `ground`)"""
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
    w = bpy.data.worlds.new('w') if not sc.world else sc.world; sc.world = w
    w.light_settings.distance = dist
    g = None
    if ground:
        bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.0005)); g = bpy.context.active_object
    for o in obs:
        me = o.data
        if not me.materials:
            mat = bpy.data.materials.get('bake') or bpy.data.materials.new('bake'); me.materials.append(mat)
        a = me.color_attributes.get('ao') or me.color_attributes.new('ao', 'BYTE_COLOR', 'POINT')
        me.color_attributes.active_color = a
        try: me.attributes.active_color = a
        except Exception: pass
        select_only([o])
        sc.render.bake.target = 'VERTEX_COLORS'
        try: bpy.ops.object.bake(type='AO')
        except Exception as e: print('[mp] AO bake failed on', o.name, e)
        unbury(o)
    if g: bpy.data.objects.remove(g, do_unlink=True)

def unbury(o, dark=0.08):
    """vertices buried inside another part (a board's end inside a corner post, a leg's top inside the rail) bake black and
    the per-vertex occlusion smears that black over the visible faces round them: each such vertex takes the mean of its
    unburied neighbours, spreading inward ring by ring; a piece buried whole keeps 1"""
    import numpy as np
    me = o.data; a = me.color_attributes.get('ao')
    if a is None or a.domain != 'POINT': return
    n = len(me.vertices); c = np.zeros(n * 4, dtype=np.float32); a.data.foreach_get('color', c); c = c.reshape(-1, 4)
    ao = c[:, 0].copy(); known = ao >= dark
    ev = np.zeros(len(me.edges) * 2, dtype=np.int64); me.edges.foreach_get('vertices', ev); ev = ev.reshape(-1, 2)
    for _ in range(64):
        if known.all(): break
        s = np.zeros(n); k = np.zeros(n)
        for i, j in ((0, 1), (1, 0)):
            m = known[ev[:, i]] & ~known[ev[:, j]]
            np.add.at(s, ev[m, j], ao[ev[m, i]]); np.add.at(k, ev[m, j], 1)
        new = (k > 0) & ~known
        if not new.any(): break
        ao[new] = s[new] / k[new]; known |= new
    ao[~known] = 1.0
    c[:, 0] = c[:, 1] = c[:, 2] = ao; a.data.foreach_set('color', c.ravel())

def export(path, lods, ao=True):
    """lods = [{part: object}, ...] -> one GLB with nodes lod<i>__<part> (no Draco, no UVs, no materials: the game draws them
    with its own surfaces; COLOR_0 = the baked occlusion when `ao`)"""
    keep = []
    for i, parts in enumerate(lods):
        for part, ob in parts.items():
            ob.name = 'lod%d__%s' % (i, part); ob.data.name = ob.name
            for p in ob.data.polygons: pass
            keep.append(ob)
    for o in list(bpy.context.scene.objects):
        if o not in keep: bpy.data.objects.remove(o, do_unlink=True)
    select_only(keep)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_materials='NONE',
              export_texcoords=False, export_normals=True, export_draco_mesh_compression_enable=False)
    try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE' if ao else 'NONE')
    except TypeError: bpy.ops.export_scene.gltf(**kw)
    return {o.name: tris(o) for o in keep}
