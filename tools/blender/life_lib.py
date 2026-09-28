# PARSA small life (D-332; BLENDER_PLAN rows 13 and 20): the Blender helpers shared by the birds (life_birds.py), the small
# creatures (life_small.py) and the ground flora (life_flora.py). Headless Blender 5.0.1; imported with sys.path set to this
# folder. The models are built as arrays in the game's frame (x right, y up, z forward: the glTF frame) and converted here
# to Blender's z-up frame (x, -z, y), so the exporter's +Y-up conversion hands the game back exactly its own coordinates.
import bpy, bmesh, math, os, time, json
import numpy as np

def log(*a): print('[life]', *a, flush=True)

def reset(device='CPU', threads=0):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'
    cy = sc.cycles; cy.seed = 0; cy.use_animated_seed = False; cy.use_denoising = False
    if threads: sc.render.threads_mode = 'FIXED'; sc.render.threads = int(threads)
    dev = 'CPU'
    if device == 'GPU':
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for t in ('OPTIX', 'CUDA'):
            try:
                prefs.compute_device_type = t; prefs.get_devices()
                if [d for d in prefs.devices if d.type == t]:
                    for d in prefs.devices: d.use = d.type == t
                    cy.device = 'GPU'; dev = t; break
            except Exception as e: log('device', t, e)
    return dev

def g2b(P):
    """game (x, y up, z forward) -> Blender (x, -z, y)"""
    P = np.asarray(P, np.float64); return np.stack([P[:, 0], -P[:, 2], P[:, 1]], axis=1)

class Parts:
    """a mesh assembled from parts: vertices (game frame), faces (vertex index lists), per-vertex uv and colour"""
    def __init__(s): s.V = []; s.F = []; s.UV = []; s.C = []; s.n = 0
    def add(s, V, F, UV=None, C=None):
        V = np.asarray(V, np.float64).reshape(-1, 3); k = len(V)
        s.V.append(V); s.F += [[s.n + i for i in f] for f in F]
        s.UV.append(np.zeros((k, 2)) if UV is None else np.asarray(UV, np.float64).reshape(-1, 2))
        s.C.append(np.ones((k, 4)) if C is None else np.asarray(C, np.float64).reshape(-1, 4))
        s.n += k; return s.n - k
    def arrays(s):
        return (np.concatenate(s.V) if s.V else np.zeros((0, 3)), s.F, np.concatenate(s.UV) if s.UV else np.zeros((0, 2)), np.concatenate(s.C) if s.C else np.zeros((0, 4)))

def grid_faces(nu, nv, o=0, flip=False, wrap_u=False):
    """quads of a (nu+1) x (nv+1) vertex grid indexed o + i*(nv+1) + j (i along u, j along v)"""
    F = []; W = nv + 1
    for i in range(nu):
        for j in range(nv):
            a, b, c, d = o + i * W + j, o + (i + 1) * W + j, o + (i + 1) * W + j + 1, o + i * W + j + 1
            F.append([a, d, c, b] if flip else [a, b, c, d])
    return F

def orient(V, F, want):
    """flip each face whose normal points against `want` (a function of the face centre and its index -> vector)"""
    out = []
    for k, f in enumerate(F):
        p = V[f]; c = p.mean(axis=0); n = np.zeros(3)
        for i in range(len(f)): n += np.cross(p[i] - c, p[(i + 1) % len(f)] - c)
        out.append(f[::-1] if np.dot(n, want(c, k)) < 0 else f)
    return out

def mesh_object(name, V, F, UV=None, C=None, smooth=True):
    """a Blender object from game-frame arrays; UV per vertex (written per loop), C per vertex (float colour attribute 'Col')"""
    me = bpy.data.meshes.new(name); B = g2b(V)
    me.from_pydata([tuple(v) for v in B], [], [tuple(f) for f in F]); me.update()
    if UV is not None:
        uvl = me.uv_layers.new(name='UVMap'); li = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', li)
        uvl.data.foreach_set('uv', np.asarray(UV, np.float32)[li].ravel())
    if C is not None:
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', np.asarray(C, np.float32).ravel())
        me.color_attributes.active_color = ca
    for p in me.polygons: p.use_smooth = smooth
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o

def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)

def activate(o):
    for x in bpy.data.objects: x.select_set(False)
    o.select_set(True); bpy.context.view_layer.objects.active = o

def triangulate(o):
    activate(o); m = o.modifiers.new('tri', 'TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=m.name)

def emit_mat(name, source='Col', channel=None, const=None):
    """an emission material: the vertex colour attribute (RGB), one of its channels as grey, or a constant"""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission'); o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0], o.inputs['Surface'])
    if const is not None: e.inputs['Color'].default_value = (*const, 1.0); return m
    a = nt.nodes.new('ShaderNodeAttribute'); a.attribute_type = 'GEOMETRY'; a.attribute_name = source
    if channel is None: nt.links.new(a.outputs['Color'], e.inputs['Color'])
    else:
        sp = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(a.outputs['Color'], sp.inputs[0]); nt.links.new(sp.outputs[channel], e.inputs['Color'])
    return m

class Baker:
    """selected-to-active Cycles bakes from `high` (materials swapped per pass) onto `low`'s UVs at n x m px"""
    def __init__(s, high, low, n, m=None, cage=0.01, ray=0.02, ao_dist=0.1, margin=3):
        s.high, s.low, s.n, s.m = high, low, n, (m or n); s.cage, s.ray, s.margin = cage, ray, margin
        s.img = bpy.data.images.new('bake_' + low.name, s.n, s.m, alpha=True, float_buffer=True); s.img.colorspace_settings.name = 'Non-Color'
        tm = bpy.data.materials.new('target_' + low.name); tm.use_nodes = True; s.tn = tm.node_tree.nodes.new('ShaderNodeTexImage'); s.tn.image = s.img; tm.node_tree.nodes.active = s.tn
        low.data.materials.clear(); low.data.materials.append(tm)
        w = bpy.data.worlds.new('bake'); bpy.context.scene.world = w; w.light_settings.distance = ao_dist
        for k in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'): setattr(low, k, False)
    def bake(s, kind, samples=4, mat=None, margin=None):
        if mat is not None:
            s.high.data.materials.clear(); s.high.data.materials.append(mat)
        for x in bpy.data.objects: x.select_set(False)
        s.high.select_set(True); s.low.select_set(True); bpy.context.view_layer.objects.active = s.low
        bpy.context.scene.cycles.samples = samples
        kw = dict(type=kind, use_selected_to_active=True, cage_extrusion=s.cage, max_ray_distance=s.ray, margin=s.margin if margin is None else margin, margin_type='EXTEND', use_clear=True)
        if kind == 'NORMAL': kw['normal_space'] = 'TANGENT'
        t = time.time(); bpy.ops.object.bake(**kw)
        px = np.empty(s.n * s.m * 4, np.float32); s.img.pixels.foreach_get(px); log('baked', kind, s.low.name, f'{time.time() - t:.1f} s'); return px.reshape(-1, 4)

def srgb(lin):
    lin = np.clip(lin, 0, 1); return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)

def save_png(path, arr, n, m=None):
    """RGBA float 0..1 (rows bottom-up, Blender's order) quantised here (round half up) and written as 8-bit PNG"""
    m = m or n; q = np.clip(np.floor(np.asarray(arr, np.float64) * 255.0 + 0.5), 0, 255)
    im = bpy.data.images.new(os.path.basename(path), n, m, alpha=True, float_buffer=False); im.colorspace_settings.name = 'Non-Color'; im.alpha_mode = 'CHANNEL_PACKED'
    im.pixels.foreach_set((q.astype(np.float32) / 255.0).ravel()); im.filepath_raw = path; im.file_format = 'PNG'; im.save(); return q

def dilate_alpha_rgb(rgb, alpha, n, m, it=6):
    """spread the colour of covered texels (alpha > 0.5) into the uncovered ones, so mip levels and filtering near a cut-out
    edge do not bleed the bake's background into it"""
    c = rgb.reshape(m, n, 3).copy(); a = (alpha.reshape(m, n) > 0.5).astype(np.float64)
    for _ in range(it):
        s = np.zeros_like(c); w = np.zeros((m, n))
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            s += np.roll(np.roll(c * a[..., None], dy, 0), dx, 1); w += np.roll(np.roll(a, dy, 0), dx, 1)
        fill = (a < 0.5) & (w > 0); c[fill] = s[fill] / w[fill][:, None]; a = np.where(fill, 1.0, a)
    return c.reshape(-1, 3)

def export_glb(path, objs):
    for x in bpy.data.objects: x.select_set(False)
    for o in objs: o.data.materials.clear(); o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_normals=True, export_tangents=False,
        export_materials='NONE', export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True,
        export_draco_mesh_compression_enable=False, export_extras=False, export_animations=False, export_cameras=False, export_lights=False, export_morph=False)
