# PARSA ground flora (D-332; BLENDER_PLAN row 13), the Blender stage: every kind of tools/blender/life_flora.json modelled as
# the real species, headless and scripted:
#   blender -b --factory-startup --python tools/blender/life_flora.py -- <job.json>
# job.json: { "reg": "tools/blender/life_flora.json", "ids": [...], "out": dir, "device": "CPU"|"GPU", "threads": n }
# Per kind:
#  1. the atlas: tiles x tiles squares, each a Cycles render (orthographic, from the card's own side) of a modelled sprig in
#     the card's plane: rachises, leaflets, spines, twigs, bracts, florets, petals, each a small mesh with its colour (jittered
#     per element) and its curvature out of the plane. Three passes per tile: the albedo (emission of the colour; the film's
#     alpha is the coverage), the normal (the surface normal facing the camera, as the card's tangent space) and the
#     occlusion (Cycles' AO shader at a few millimetres of the sprig);
#  2. the plant in the game's frame at its unit size: stems and branches as tubes (their uvs on a bark tile), the foliage as
#     cards on the tiles (the tragacanth: a lumpy dome under bristling tufts standing out of it; camelthorn: branching stems with
#     twig cards along them; the thistle: a winged stem, a rosette and stem leaves bent in two, globose heads under floret
#     tufts; the rose: arching canes, leaf sprays, blooms; the spring flowers: stalks, leaves and blooms), two levels (lod1 with
#     fewer cards and sides); COLOR_0.r = the part (0 foliage, 1 flowers: shown by season);
#  3. <id>_albedo.png (RGB, A coverage), <id>_nrm.png (RGB normal, A occlusion), <id>.glb (lod0, lod1).
import bpy, sys, os, json, math, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from life_lib import log, reset, Parts, grid_faces, orient, mesh_object, tris, triangulate, save_png, dilate_alpha_rgb, export_glb

job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
REG = json.load(open(job['reg'])); TS = REG['tile']; NT = REG['tiles']; N = TS * NT

class R:
    """a deterministic random stream"""
    def __init__(s, seed): s.g = np.random.default_rng(seed)
    def u(s, a=0.0, b=1.0): return float(s.g.uniform(a, b))
    def j(s, c, k=0.08): return np.clip(np.array(c, float) * (1 + s.g.uniform(-k, k)) + s.g.uniform(-k, k) * 0.2, 0, 1)

# ------------------------------------------------------------------------------------ the tile scene (Blender frame, z to camera)
class Tile:
    def __init__(s): s.V = []; s.F = []; s.C = []; s.n = 0
    def add(s, V, F, col):
        V = np.asarray(V, float); s.V.append(V); s.F += [[s.n + i for i in f] for f in F]; c = np.asarray(col, float)
        s.C.append(np.tile(np.append(c, 1), (len(V), 1)) if c.ndim == 1 else np.concatenate([c, np.ones((len(c), 1))], 1)); s.n += len(V)
    def tube(s, pts, radii, col, sides=6):
        pts = [np.asarray(p, float) for p in pts]; V = []
        for i, p in enumerate(pts):
            d = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]; d /= np.linalg.norm(d) + 1e-12
            a = np.cross(d, [0, 0, 1.0]); a = a if np.linalg.norm(a) > 0.2 else np.cross(d, [1.0, 0, 0]); a /= np.linalg.norm(a); b = np.cross(d, a)
            for k in range(sides): t = 2 * math.pi * k / sides; V.append(p + radii[i] * (math.cos(t) * a + math.sin(t) * b))
        F = [[i * sides + k, i * sides + (k + 1) % sides, (i + 1) * sides + (k + 1) % sides, (i + 1) * sides + k] for i in range(len(pts) - 1) for k in range(sides)]
        s.add(V, F, col)
    def blade(s, base, ang, length, width_fn, col, n=10, curl=0.0, z=0.0, rib=None):
        """a flat organ (leaflet, petal, bract, leaf) along direction ang (radians from +y), width_fn(t) its half width"""
        d = np.array([math.sin(ang), math.cos(ang), 0]); p = np.array([d[1], -d[0], 0]); V = []; C = []
        for i in range(n + 1):
            t = i / n; w = width_fn(t); c = np.asarray(base, float) + d * length * t + np.array([0, 0, z + curl * length * t * t])
            V += [c - p * w, c, c + p * w]; C += [col, rib if rib is not None else col, col]
        F = [[3 * i + a, 3 * (i + 1) + a, 3 * (i + 1) + a + 1, 3 * i + a + 1] for i in range(n) for a in (0, 1)]
        s.add(V, F, np.array(C))
    def spine(s, base, ang, length, r, col_base, col_tip):
        d = np.array([math.sin(ang), math.cos(ang), 0]); V = []; C = []; sides = 5
        for i, (t, rr) in enumerate(((0, r), (0.6, r * 0.6), (1, r * 0.05))):
            c = np.asarray(base, float) + d * length * t; a = np.array([d[1], -d[0], 0]); b = np.array([0, 0, 1.0])
            for k in range(sides): q = 2 * math.pi * k / sides; V.append(c + rr * (math.cos(q) * a + math.sin(q) * b)); C.append(np.array(col_base) * (1 - t) + np.array(col_tip) * t)
        F = [[i * sides + k, i * sides + (k + 1) % sides, (i + 1) * sides + (k + 1) % sides, (i + 1) * sides + k] for i in range(2) for k in range(sides)]
        s.add(V, F, np.array(C))
    def quad(s, x0, y0, x1, y1, col, z=-0.2):
        s.add([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [[0, 1, 2, 3]], col)

def ell(t, w): return w * math.sin(math.pi * min(max(t, 0), 1)) ** 0.8
def lance(t, w): return w * (math.sin(math.pi * min(max(t, 0), 1) ** 0.7)) ** 1.0

def setup_render():
    sc = bpy.context.scene; sc.render.resolution_x = TS; sc.render.resolution_y = TS; sc.render.film_transparent = True; sc.cycles.samples = 12
    sc.view_settings.view_transform = 'Raw'; sc.render.image_settings.color_mode = 'RGBA'; sc.render.image_settings.color_depth = '16'
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.0
    cam.location = (0, 0, 5); cam.rotation_euler = (0, 0, 0); cam.data.clip_start = 0.1; cam.data.clip_end = 20
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = 0.0
    mats = {}
    for kind in ('col', 'nrm', 'ao'):
        m = bpy.data.materials.new(kind); m.use_nodes = True; nt = m.node_tree
        for nd in list(nt.nodes): nt.nodes.remove(nd)
        e = nt.nodes.new('ShaderNodeEmission'); o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0], o.inputs['Surface'])
        if kind == 'col':
            a = nt.nodes.new('ShaderNodeAttribute'); a.attribute_type = 'GEOMETRY'; a.attribute_name = 'Col'; nt.links.new(a.outputs['Color'], e.inputs['Color'])
        elif kind == 'nrm':
            g = nt.nodes.new('ShaderNodeNewGeometry'); neg = nt.nodes.new('ShaderNodeVectorMath'); neg.operation = 'SCALE'; neg.inputs[3].default_value = -1.0; nt.links.new(g.outputs['Normal'], neg.inputs[0])
            mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'VECTOR'; nt.links.new(g.outputs['Backfacing'], mx.inputs[0]); nt.links.new(g.outputs['Normal'], mx.inputs[4]); nt.links.new(neg.outputs[0], mx.inputs[5])
            ma = nt.nodes.new('ShaderNodeVectorMath'); ma.operation = 'MULTIPLY_ADD'; ma.inputs[1].default_value = (0.5, 0.5, 0.5); ma.inputs[2].default_value = (0.5, 0.5, 0.5)
            nt.links.new(g.outputs['Normal'], ma.inputs[0]); nt.links.new(ma.outputs[0], e.inputs['Color'])  # (Cycles' shading normal already faces the camera)
        else:
            ao = nt.nodes.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = 0.04; ao.samples = 16; nt.links.new(ao.outputs['AO'], e.inputs['Color'])
        mats[kind] = m
    return mats

def render_tile(t, mats, scale=1.0):
    """t: a Tile in [-0.5, 0.5]^2 (x, y); returns (albedo rgba, normal rgb, ao) arrays TS x TS (rows bottom-up)"""
    me = bpy.data.meshes.new('tile'); V = np.concatenate(t.V) * [scale, scale, 1]; me.from_pydata([tuple(v) for v in V], [], [tuple(f) for f in t.F]); me.update()
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', np.concatenate(t.C).astype(np.float32).ravel())
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new('tile', me); bpy.context.scene.collection.objects.link(o); out = {}
    for kind in ('col', 'nrm', 'ao'):
        me.materials.clear(); me.materials.append(mats[kind]); path = os.path.join(job['out'], f'_tile_{os.getpid()}.png'); bpy.context.scene.render.filepath = path
        bpy.ops.render.render(write_still=True); im = bpy.data.images.load(path); im.colorspace_settings.name = 'Non-Color'; px = np.array(im.pixels[:], np.float32).reshape(TS, TS, 4); bpy.data.images.remove(im); out[kind] = px
    bpy.data.objects.remove(o, do_unlink=True); bpy.data.meshes.remove(me)
    return out['col'], out['nrm'][..., :3], out['ao'][..., 0]

# ------------------------------------------------------------------------------------------------ the sprigs of each species
GREY_GREEN, SILVER, STRAW = [0.4, 0.45, 0.33], [0.56, 0.6, 0.5], [0.8, 0.74, 0.56]
def astragalus_sprig(t, r, x0, y0, ang, L, leaves=True):
    tip = [x0 + math.sin(ang) * L, y0 + math.cos(ang) * L, 0]; mid = [x0 + math.sin(ang) * L * 0.5 + r.u(-0.02, 0.02), y0 + math.cos(ang) * L * 0.5, 0.01]
    t.tube([[x0, y0, 0], mid, tip], [0.006, 0.0045, 0.002], r.j(STRAW if not leaves else [0.62, 0.6, 0.45]), 5)
    t.spine(tip, ang, 0.06, 0.004, r.j(STRAW), [0.9, 0.85, 0.7])
    if not leaves: return
    npair = int(r.u(6, 10))
    for k in range(npair):
        f = 0.15 + 0.8 * k / npair; b = [x0 + math.sin(ang) * L * f, y0 + math.cos(ang) * L * f, 0.005]; ln = 0.05 * (1.2 - 0.5 * f) * r.u(0.8, 1.2)
        for side in (-1, 1):
            c = r.j(GREY_GREEN if r.u() > 0.35 else SILVER, 0.12)
            t.blade(b, ang + side * r.u(0.7, 1.1), ln, lambda q, w=ln * 0.32: ell(q, w), c, n=6, curl=r.u(-0.3, 0.3), rib=np.array(c) * 1.1)
def tile_astragalus_tuft(seed, flowers=False):
    t = Tile(); r = R(seed)
    for k in range(int(r.u(5, 8))):
        a = r.u(-0.55, 0.55); astragalus_sprig(t, r, r.u(-0.08, 0.08), -0.5, a, r.u(0.6, 0.95) / math.cos(a) * 0.85, leaves=r.u() > 0.15)
    return t
def tile_astragalus_surface(seed):
    t = Tile(); r = R(seed); t.quad(-0.52, -0.52, 0.52, 0.52, [0.3, 0.33, 0.24], z=-0.3)
    for k in range(170):
        astragalus_sprig(t, r, r.u(-0.55, 0.55), r.u(-0.55, 0.55), r.u(0, 6.28), r.u(0.1, 0.22), leaves=r.u() > 0.1)
    return t
def tile_astragalus_flowers(seed):
    t = Tile(); r = R(seed)
    for k in range(9):
        c = [r.u(-0.38, 0.38), r.u(-0.4, 0.3), 0.02]
        for p in range(int(r.u(3, 6))):
            b = [c[0] + r.u(-0.05, 0.05), c[1] + r.u(-0.05, 0.05), 0.02]; a0 = r.u(0, 6.28); col = r.j([0.93, 0.87, 0.55], 0.06)
            t.blade(b, a0, 0.07, lambda q: ell(q, 0.028), col, n=5, curl=0.3); t.blade(b, a0 + 2.6, 0.045, lambda q: ell(q, 0.02), np.array(col) * 0.92, n=4)
            t.blade(b, a0 - 2.6, 0.045, lambda q: ell(q, 0.02), np.array(col) * 0.92, n=4); t.tube([[b[0], b[1] - 0.04, 0], b], [0.004, 0.004], [0.5, 0.55, 0.4], 4)
    return t

def twig(t, r, x0, y0, ang, L, flowers=False, leaves=True):
    tip = [x0 + math.sin(ang) * L, y0 + math.cos(ang) * L, 0]; green = r.j([0.34, 0.44, 0.2], 0.1)
    t.tube([[x0, y0, 0], [(x0 + tip[0]) / 2 + r.u(-0.01, 0.01), (y0 + tip[1]) / 2, 0], tip], [0.012, 0.009, 0.005], green, 6)
    n = int(r.u(7, 11))
    for k in range(n):
        f = 0.1 + 0.85 * k / n; b = [x0 + math.sin(ang) * L * f, y0 + math.cos(ang) * L * f, 0.004]; side = 1 if k % 2 else -1; sa = ang + side * r.u(0.6, 0.95)
        sl = r.u(0.14, 0.26) * (1.1 - 0.4 * f); t.spine(b, sa, sl, 0.007, green, [0.8, 0.66, 0.35])
        if leaves: lc = r.j([0.38, 0.5, 0.24], 0.1); t.blade(b, ang - side * r.u(0.5, 0.9), r.u(0.08, 0.13), lambda q: ell(q, 0.022), lc, n=6, curl=r.u(-0.2, 0.2), rib=np.array(lc) * 1.12)
        if flowers:
            for q in range(int(r.u(1, 4))):
                fb = [b[0] + math.sin(sa) * sl * r.u(0.3, 0.85), b[1] + math.cos(sa) * sl * r.u(0.3, 0.85), 0.02]; pc = r.j([0.78, 0.3, 0.36], 0.08)
                t.blade(fb, sa + 1.2, 0.045, lambda qq: ell(qq, 0.018), pc, n=4, curl=0.4); t.blade(fb, sa - 0.6, 0.035, lambda qq: ell(qq, 0.014), np.array(pc) * 0.85, n=4)
def tile_alhagi(seed, flowers=False):
    t = Tile(); r = R(seed); twig(t, r, r.u(-0.05, 0.05), -0.5, r.u(-0.12, 0.12), 0.98, flowers=flowers, leaves=True)
    for k in range(2): y = r.u(-0.4, -0.05); twig(t, r, 0.0, y, (1 if k else -1) * r.u(0.35, 0.6), r.u(0.45, 0.6), flowers=flowers, leaves=True)
    return t
def tile_bark(seed, base, stripe, alpha=False):
    t = Tile(); r = R(seed); t.quad(-0.52, -0.52, 0.52, 0.52, base, z=-0.3)
    for k in range(60): x = r.u(-0.5, 0.5); t.quad(x, -0.52, x + r.u(0.005, 0.02), 0.52, r.j(stripe, 0.1), z=-0.29)
    return t

def thistle_leaf(t, r, base, ang, L, W, col, spine=[0.85, 0.78, 0.45], lobes=5):
    wf = lambda q: W * math.sin(math.pi * min(max(q, 0), 1)) ** 0.6 * (0.55 + 0.45 * abs(math.sin(lobes * math.pi * q)))
    t.blade(base, ang, L, wf, col, n=40, curl=0.05, rib=[0.85, 0.87, 0.8])
    d = np.array([math.sin(ang), math.cos(ang)]); p = np.array([d[1], -d[0]])
    for k in range(lobes * 2):
        q = (k // 2 + 0.5) / lobes; side = 1 if k % 2 else -1; w = W * math.sin(math.pi * q) ** 0.6
        b = np.array(base[:2]) + d * L * q + p * side * w; t.spine([b[0], b[1], 0.01], ang + side * 1.1, 0.06 * L / 0.8, 0.004, spine, [0.95, 0.9, 0.7])
    t.spine([base[0] + d[0] * L, base[1] + d[1] * L, 0.01], ang, 0.07, 0.005, spine, [0.95, 0.9, 0.7])
def tile_thistle_leaf(seed):
    t = Tile(); r = R(seed); thistle_leaf(t, r, [0, -0.5, 0], r.u(-0.1, 0.1), 0.9, 0.3, r.j([0.48, 0.54, 0.42], 0.05)); return t
def tile_thistle_wing(seed):
    t = Tile(); r = R(seed); t.quad(-0.03, -0.52, 0.03, 0.52, [0.55, 0.6, 0.5], z=-0.05)
    for k in range(9):
        y = -0.5 + k * 0.115
        for side in (-1, 1):
            t.blade([side * 0.02, y, 0], side * 1.2, 0.2, lambda q: 0.05 * math.sin(math.pi * q) ** 0.7, r.j([0.5, 0.56, 0.44], 0.06), n=8, rib=[0.8, 0.82, 0.75])
            t.spine([side * 0.2 * math.sin(1.2), y + 0.2 * math.cos(1.2), 0.01], side * 1.2, 0.08, 0.004, [0.85, 0.78, 0.45], [0.95, 0.9, 0.7])
    return t
def tile_bracts(seed):
    t = Tile(); r = R(seed); t.quad(-0.52, -0.52, 0.52, 0.52, [0.3, 0.34, 0.24], z=-0.3)
    for k in range(260):
        b = [r.u(-0.55, 0.55), r.u(-0.55, 0.55), r.u(0, 0.05)]; a = r.u(-0.4, 0.4); c = r.j([0.46, 0.52, 0.36], 0.12)
        t.blade(b, a, 0.12, lambda q: 0.03 * (1 - q) ** 0.8, c, n=4, curl=0.2, rib=np.array(c) * 1.15); t.spine([b[0] + math.sin(a) * 0.12, b[1] + math.cos(a) * 0.12, b[2]], a, 0.06, 0.004, [0.8, 0.72, 0.4], [0.95, 0.9, 0.7])
    return t
def tile_florets(seed, col=[0.6, 0.24, 0.55]):
    t = Tile(); r = R(seed)
    for k in range(140):
        a = r.u(-0.9, 0.9); b = [r.u(-0.25, 0.25), -0.5, r.u(-0.02, 0.02)]; L = r.u(0.55, 0.95) * math.cos(a * 0.6)
        t.blade(b, a, L, lambda q: 0.012 * (0.4 + q), r.j(col, 0.1), n=6, curl=r.u(-0.1, 0.1))
    return t

def rose_leaf(t, r, base, ang, L):
    tip = [base[0] + math.sin(ang) * L, base[1] + math.cos(ang) * L, 0]; t.tube([base, tip], [0.006, 0.004], [0.3, 0.32, 0.15], 4)
    for k, f in enumerate((0.3, 0.6, 1.0)):
        b = [base[0] + math.sin(ang) * L * f, base[1] + math.cos(ang) * L * f, 0.004]; c = r.j([0.2, 0.33, 0.13], 0.1)
        sides = (-1, 1) if f < 1 else (0,)
        for s_ in sides:
            wf = lambda q: 0.075 * math.sin(math.pi * q) ** 0.7 * (1 + 0.08 * math.sin(q * 40))
            t.blade(b, ang + s_ * 1.0, 0.2, wf, c, n=14, curl=r.u(-0.2, 0.2), rib=np.array(c) * 1.3)
def tile_rose_leaves(seed):
    t = Tile(); r = R(seed); t.tube([[0, -0.5, 0], [0.02, 0.5, 0]], [0.012, 0.008], [0.35, 0.3, 0.16], 5)
    for k in range(5): y = -0.4 + k * 0.2; side = 1 if k % 2 else -1; rose_leaf(t, r, [0.01 * side, y, 0.01], side * r.u(0.7, 1.0), r.u(0.25, 0.38))
    for k in range(6): y = r.u(-0.45, 0.45); t.spine([0, y, 0], r.u(-2, 2), 0.04, 0.006, [0.55, 0.3, 0.25], [0.8, 0.7, 0.55])
    return t
def tile_bloom(seed, col=[0.9, 0.55, 0.62], n_rings=3, petals=6, centre=[0.9, 0.75, 0.2], R0=0.45, blotch=None, cup=0.0):
    t = Tile(); r = R(seed)
    for ring in range(n_rings):
        k = petals + ring * 2; rr = R0 * (1 - ring * 0.25)
        for p in range(k):
            a = 2 * math.pi * (p + ring * 0.5) / k + r.u(-0.1, 0.1); c = r.j(np.array(col) * (1 - 0.08 * ring), 0.06)
            t.blade([0, 0, 0.02 * ring], a, rr, lambda q, w=rr * 0.42: w * math.sin(math.pi * min(q * 1.05, 1)) ** 0.5, c, n=8, curl=cup + 0.1 * ring, rib=np.array(c) * 1.04)
            if blotch is not None and ring == 0: t.blade([0, 0, 0.005], a, rr * 0.28, lambda q, w=rr * 0.2: w * math.sin(math.pi * q) ** 0.5, blotch, n=4, z=0.012)
    for k in range(40): a = r.u(0, 6.28); d = r.u(0, 0.09); t.spine([math.cos(a) * d, math.sin(a) * d, 0.08], a, 0.03, 0.006, centre, np.array(centre) * 0.8)
    return t
def tile_bells(seed, col, n=26, top=0.45):
    t = Tile(); r = R(seed); t.tube([[0, -0.5, 0], [0, 0.5, 0]], [0.018, 0.012], [0.3, 0.38, 0.2], 5)
    for k in range(n):
        y = 0.5 - top * (k / n) ** 0.9 - 0.02; a = (k * 2.4) % 6.28; x = math.cos(a) * 0.06 * (0.6 + 0.8 * k / n)
        c = r.j(col, 0.06) * (0.75 + 0.35 * (k / n)); t.blade([x, y + 0.03, 0.05 * math.sin(a)], math.pi, 0.08, lambda q: 0.035 * math.sin(math.pi * min(q * 1.1, 1)) ** 0.4, c, n=6, curl=0.4)
    return t
def tile_straps(seed, n=3, col=[0.3, 0.42, 0.2], W=0.05):
    t = Tile(); r = R(seed)
    for k in range(n): a = r.u(-0.35, 0.35); t.blade([r.u(-0.05, 0.05), -0.5, 0], a, r.u(0.8, 1.0), lambda q: W * (1 - 0.7 * q), r.j(col, 0.08), n=12, curl=r.u(-0.1, 0.1), rib=np.array(col) * 1.2)
    return t
def tile_cutleaves(seed, col=[0.3, 0.45, 0.18]):
    t = Tile(); r = R(seed)
    for k in range(4):
        a = r.u(-0.6, 0.6); b = [0, -0.5, 0]; L = r.u(0.5, 0.8); tip = [math.sin(a) * L, -0.5 + math.cos(a) * L, 0]; t.tube([b, tip], [0.01, 0.006], [0.3, 0.4, 0.18], 4)
        for q in range(6): f = 0.3 + 0.7 * q / 6; bb = [math.sin(a) * L * f, -0.5 + math.cos(a) * L * f, 0.004]; s_ = 1 if q % 2 else -1
        for q in range(6):
            f = 0.3 + 0.7 * q / 6; bb = [math.sin(a) * L * f, -0.5 + math.cos(a) * L * f, 0.004]; s_ = 1 if q % 2 else -1
            t.blade(bb, a + s_ * 0.9, 0.12, lambda z: 0.035 * math.sin(math.pi * z) ** 0.6, r.j(col, 0.1), n=6, rib=np.array(col) * 1.2)
    return t

# the atlas plan of each kind: a tile builder per slot (index = row * NT + col)
PLAN = {
    'cushion': [lambda: tile_astragalus_tuft(1), lambda: tile_astragalus_tuft(2), lambda: tile_astragalus_tuft(3), lambda: tile_astragalus_tuft(4), lambda: tile_astragalus_tuft(5), lambda: tile_astragalus_tuft(6),
                lambda: tile_astragalus_surface(7), lambda: tile_astragalus_flowers(8), lambda: tile_astragalus_surface(9)],
    'camelthorn': [lambda: tile_alhagi(11), lambda: tile_alhagi(12), lambda: tile_alhagi(13), lambda: tile_alhagi(14), lambda: tile_alhagi(15, True), lambda: tile_alhagi(16, True), lambda: tile_bark(17, [0.3, 0.4, 0.18], [0.4, 0.48, 0.26])],
    'thistle': [lambda: tile_thistle_leaf(21), lambda: tile_thistle_leaf(22), lambda: tile_thistle_wing(23), lambda: tile_bracts(24), lambda: tile_florets(25), lambda: tile_bark(26, [0.5, 0.56, 0.44], [0.7, 0.72, 0.64]), lambda: tile_thistle_leaf(27)],
    'rose': [lambda: tile_rose_leaves(31), lambda: tile_rose_leaves(32), lambda: tile_rose_leaves(33), lambda: tile_bloom(34), lambda: tile_bloom(35, [0.86, 0.48, 0.56]), lambda: tile_bloom(36, [0.55, 0.65, 0.35], n_rings=1, petals=5, centre=[0.6, 0.55, 0.3], R0=0.25, cup=0.6), lambda: tile_bark(37, [0.3, 0.3, 0.15], [0.45, 0.28, 0.2])],
    'flower_violet': [lambda: tile_bells(41, [0.28, 0.22, 0.58]), lambda: tile_straps(42), lambda: tile_bells(43, [0.32, 0.25, 0.62])],
    'flower_yellow': [lambda: tile_bloom(51, [0.95, 0.8, 0.1], n_rings=1, petals=5, centre=[0.55, 0.6, 0.2], R0=0.45, cup=0.25), lambda: tile_bloom(52, [0.95, 0.78, 0.1], n_rings=1, petals=5, centre=[0.55, 0.6, 0.2], R0=0.45, cup=0.9), lambda: tile_cutleaves(53), lambda: tile_bark(54, [0.3, 0.42, 0.18], [0.36, 0.5, 0.22])],
    'flower_red': [lambda: tile_bloom(61, [0.8, 0.07, 0.04], n_rings=1, petals=4, centre=[0.15, 0.18, 0.1], R0=0.47, blotch=[0.06, 0.04, 0.04], cup=0.2), lambda: tile_bloom(62, [0.78, 0.08, 0.05], n_rings=1, petals=4, centre=[0.15, 0.18, 0.1], R0=0.45, blotch=[0.06, 0.04, 0.04], cup=1.0), lambda: tile_cutleaves(63, [0.34, 0.45, 0.2]), lambda: tile_bark(64, [0.32, 0.42, 0.2], [0.4, 0.5, 0.26])],
    'flower_crown': [lambda: tile_bloom(71, [0.9, 0.45, 0.1], n_rings=1, petals=6, centre=[0.9, 0.8, 0.3], R0=0.46, cup=1.4), lambda: tile_straps(72, 5, [0.3, 0.45, 0.2], 0.07), lambda: tile_straps(73, 8, [0.32, 0.47, 0.22], 0.06), lambda: tile_bark(74, [0.3, 0.42, 0.2], [0.36, 0.5, 0.24])],
}

def rect(i, inset=0.004):
    c, rr = i % NT, i // NT; return (c / NT + inset, rr / NT + inset, (c + 1) / NT - inset, (rr + 1) / NT - inset)

# ------------------------------------------------------------------------------------ the plants (the game's frame, unit size)
class Plant:
    def __init__(s): s.pa = Parts()
    def card(s, base, up, side, h, w, tile, part=0, bend=0.0, nv=1):
        """a card: from base along `up` (h), across `side` (w, centred); bent back by `bend` (x h) along its length"""
        up = np.asarray(up, float); up /= np.linalg.norm(up); side = np.asarray(side, float); side -= up * np.dot(side, up); side /= np.linalg.norm(side); nrm = np.cross(side, up)
        x0, y0, x1, y1 = rect(tile); V = []; UV = []
        for j in range(nv + 1):
            t = j / nv; c = np.asarray(base, float) + up * h * t + nrm * bend * h * t * t
            for i in (0, 1): V.append(c + side * w * (i - 0.5)); UV.append([x0 + (x1 - x0) * i, y0 + (y1 - y0) * t])
        F = [[2 * j, 2 * j + 1, 2 * j + 3, 2 * j + 2] for j in range(nv)]
        C = np.zeros((len(V), 4)); C[:, 0] = part; C[:, 3] = 1; s.pa.add(V, F, UV, C)
    def tube(s, pts, radii, tile, sides=4, part=0):
        pts = [np.asarray(p, float) for p in pts]; V = []; UV = []; x0, y0, x1, y1 = rect(tile); L = [0]
        for i in range(1, len(pts)): L.append(L[-1] + np.linalg.norm(pts[i] - pts[i - 1]))
        for i, p in enumerate(pts):
            d = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]; d /= np.linalg.norm(d) + 1e-12
            a = np.cross(d, [0, 1.0, 0]); a = a if np.linalg.norm(a) > 0.2 else np.cross(d, [1.0, 0, 0]); a /= np.linalg.norm(a); b = np.cross(d, a)
            for k in range(sides + 1): t = 2 * math.pi * k / sides; V.append(p + radii[i] * (math.cos(t) * a + math.sin(t) * b)); UV.append([x0 + (x1 - x0) * k / sides, y0 + (y1 - y0) * (L[i] / max(L[-1], 1e-9))])
        F = [[i * (sides + 1) + k, (i + 1) * (sides + 1) + k, (i + 1) * (sides + 1) + k + 1, i * (sides + 1) + k + 1] for i in range(len(pts) - 1) for k in range(sides)]
        cen = pts; F = orient(np.array(V), F, lambda c, kk: c - cen[min(kk // sides, len(cen) - 1)])
        C = np.zeros((len(V), 4)); C[:, 0] = part; C[:, 3] = 1; s.pa.add(V, F, UV, C)
    def dome(s, rx, ry, nu, nv, tile, r):
        th = np.linspace(0, 2 * math.pi, nu + 1); ph = np.linspace(0, math.pi / 2, nv + 1); x0, y0, x1, y1 = rect(tile); V = []; UV = []
        lump = lambda a, b: 1 + 0.08 * math.sin(3 * a + 1.3) * math.sin(4 * b) + 0.05 * math.sin(7 * a)
        for j, p in enumerate(ph):
            for i, t in enumerate(th):
                k = lump(t, p) if j < nv else 1; x, z = rx * math.cos(t) * math.cos(p) * k, rx * math.sin(t) * math.cos(p) * k; V.append([x, ry * math.sin(p) * k - 0.02, z])
                UV.append([x0 + (x1 - x0) * (1 - abs(t / math.pi - 1)), y0 + (y1 - y0) * (p / (math.pi / 2))])
        F = grid_faces(nv, nu); F = [[f[0], f[1], f[2], f[3]] for f in F]
        Fi = []
        for jj in range(nv):
            for ii in range(nu): a = jj * (nu + 1) + ii; Fi.append([a, a + 1, a + nu + 2, a + nu + 1])
        Vn = np.array(V); Fi = orient(Vn, Fi, lambda c, kk: c - np.array([0, -0.2, 0]))
        C = np.zeros((len(V), 4)); C[:, 3] = 1; s.pa.add(V, Fi, UV, C)
        return lambda t, p: np.array([rx * math.cos(t) * math.cos(p) * lump(t, p), ry * math.sin(p) * lump(t, p) - 0.02, rx * math.sin(t) * math.cos(p) * lump(t, p)])

def perp(d):
    d = np.asarray(d, float); a = np.cross(d, [0, 1.0, 0]); a = a if np.linalg.norm(a) > 0.1 else np.cross(d, [1.0, 0, 0]); return a / np.linalg.norm(a)
def rotv(v, axis, ang):
    axis = np.asarray(axis, float) / np.linalg.norm(axis); v = np.asarray(v, float); return v * math.cos(ang) + np.cross(axis, v) * math.sin(ang) + axis * np.dot(axis, v) * (1 - math.cos(ang))

def plant_cushion(lvl):
    p = Plant(); r = R(100); surf = p.dome(0.5, 0.55, 12 if lvl == 0 else 8, 4 if lvl == 0 else 3, 6, r)
    nf = 300 if lvl == 0 else 60; tiles = [0, 1, 2, 3, 4, 5]
    for k in range(nf):
        t = r.u(0, 6.28); ph = math.asin(r.u(0.0, 0.98)); c = surf(t, ph); n = np.array([math.cos(t) * math.cos(ph) / 0.5, math.sin(ph) / 0.55, math.sin(t) * math.cos(ph) / 0.5]); n /= np.linalg.norm(n)
        side = rotv(perp(n), n, r.u(0, 6.28)); up = n + side * r.u(-0.25, 0.25); h = r.u(0.07, 0.13) * (1.4 if lvl else 1)
        p.card(c - n * 0.03, up, side, h, h * 1.1, tiles[k % 6])
    for k in range(40 if lvl == 0 else 10):  # the flowers in the axils, in season (part 1)
        t = r.u(0, 6.28); ph = math.asin(r.u(0.2, 0.95)); c = surf(t, ph); n = c / np.linalg.norm(c); side = perp(n); p.card(c - n * 0.01, n, side, 0.07, 0.08, 7, part=1)
    return p
def plant_camelthorn(lvl):
    p = Plant(); r = R(200); stems = 9 if lvl == 0 else 6
    for k in range(stems):
        a = 2 * math.pi * k / stems + r.u(-0.3, 0.3); tilt = r.u(0.4, 1.1); d = np.array([math.sin(tilt) * math.cos(a), math.cos(tilt), math.sin(tilt) * math.sin(a)]); L = r.u(0.7, 1.0) / max(0.8, d[1] + 0.2)
        pts = [np.array([r.u(-0.03, 0.03), 0, r.u(-0.03, 0.03)])]
        for j in range(4): dd = d + np.array([r.u(-0.1, 0.1), -0.05 * j, r.u(-0.1, 0.1)]); pts.append(pts[-1] + dd / np.linalg.norm(dd) * L / 4)
        pts = [q if q[1] <= 0.98 else q * [1, 0.98 / q[1], 1] for q in pts]
        p.tube(pts, [0.012, 0.01, 0.008, 0.006, 0.004], 6, sides=3 if lvl == 0 else 3)
        for j in range(1, len(pts)):
            seg = pts[j] - pts[j - 1]; nb = 3 if lvl == 0 else 1
            for q in range(nb):
                base = pts[j - 1] + seg * r.u(0.0, 0.8); bd = rotv(seg / np.linalg.norm(seg), perp(seg), r.u(0.5, 1.0) * (1 if q % 2 else -1)); bd = rotv(bd, seg, r.u(0, 6.28)); bl = r.u(0.18, 0.3)
                if lvl == 0: p.tube([base, base + bd * bl], [0.005, 0.003], 6, sides=3)
                for c in range(2 if lvl == 0 else 1):
                    side = rotv(perp(bd), bd, r.u(0, 3.14)); fl = r.u() < 0.3
                    p.card(base + bd * bl * 0.1 * c, bd, side, bl * 0.95, bl * 0.9, (4 + int(r.u(0, 2))) if fl else int(r.u(0, 4)), part=1 if fl else 0)
            side = rotv(perp(seg), seg, r.u(0, 3.14)); p.card(pts[j - 1], seg, side, np.linalg.norm(seg) * 1.1, 0.16, int(r.u(0, 4)))
    return p
def plant_thistle(lvl):
    p = Plant(); r = R(300); top = np.array([0, 0.86, 0])
    stem = [np.array([0, 0, 0]), np.array([0.01, 0.3, 0]), np.array([-0.01, 0.6, 0.01]), top]; p.tube(stem, [0.016, 0.014, 0.011, 0.008], 5, sides=5 if lvl == 0 else 3)
    for a in (0, math.pi / 2): side = np.array([math.cos(a), 0, math.sin(a)]); p.card(np.array([0, 0.05, 0]), [0, 1, 0], side, 0.8, 0.09, 2)
    for k in range(6 if lvl == 0 else 4):  # the rosette
        a = 2 * math.pi * k / 6 + r.u(-0.2, 0.2); d = np.array([math.cos(a), 0.35, math.sin(a)]); side = np.array([-math.sin(a), 0, math.cos(a)]); p.card(np.array([0, 0.01, 0]), d, side, r.u(0.3, 0.4), 0.22, [0, 1, 6][k % 3], bend=-0.35, nv=2 if lvl == 0 else 1)
    for k in range(4 if lvl == 0 else 2):  # stem leaves
        y = 0.25 + 0.14 * k; a = k * 2.3; d = np.array([math.cos(a), 0.9, math.sin(a)]); side = np.array([-math.sin(a), 0, math.cos(a)]); p.card(np.array([0, y, 0]), d, side, 0.22 - 0.03 * k, 0.14, [0, 1, 6][k % 3], bend=-0.3, nv=2 if lvl == 0 else 1)
    heads = [top + [0, 0.1, 0], top + [0.1, 0.06, 0.03], top + [-0.07, 0.04, -0.08]]
    for k, h in enumerate(heads if lvl == 0 else heads[:2]):
        p.tube([top, h - [0, 0.03, 0]], [0.006, 0.005], 5, sides=3)
        rr = 0.045 - 0.006 * k; th = np.linspace(0, 2 * math.pi, 7 if lvl == 0 else 5); ph = np.linspace(-1.2, 1.3, 5 if lvl == 0 else 3); x0, y0, x1, y1 = rect(3); V = []; UV = []
        for j, q in enumerate(ph):
            for i, t in enumerate(th): V.append(h + rr * np.array([math.cos(t) * math.cos(q), math.sin(q), math.sin(t) * math.cos(q)])); UV.append([x0 + (x1 - x0) * i / (len(th) - 1), y0 + (y1 - y0) * j / (len(ph) - 1)])
        F = [[j * len(th) + i, j * len(th) + i + 1, (j + 1) * len(th) + i + 1, (j + 1) * len(th) + i] for j in range(len(ph) - 1) for i in range(len(th) - 1)]
        F = orient(np.array(V), F, lambda c, kk, hh=h: c - hh); C = np.zeros((len(V), 4)); C[:, 3] = 1; p.pa.add(V, F, UV, C)
        for a in (0, math.pi / 2): side = np.array([math.cos(a), 0, math.sin(a)]); p.card(h + [0, rr * 0.4, 0], [0, 1, 0], side, rr * 1.6, rr * 2.2, 4, part=1)
    return p
def plant_rose(lvl):
    p = Plant(); r = R(400); canes = 8 if lvl == 0 else 5
    for k in range(canes):
        a = 2 * math.pi * k / canes + r.u(-0.3, 0.3); tilt = r.u(0.3, 0.9); d0 = np.array([math.sin(tilt) * math.cos(a), math.cos(tilt), math.sin(tilt) * math.sin(a)])
        pts = [np.array([0, 0, 0])]
        for j in range(4): dd = d0 + np.array([0, -0.25 * j, 0]); pts.append(pts[-1] + dd / np.linalg.norm(dd) * 0.26)
        p.tube(pts, [0.012, 0.01, 0.008, 0.006, 0.005], 6, sides=3)
        for j in range(1, len(pts)):
            seg = pts[j] - pts[j - 1]
            for q in range(3 if lvl == 0 else 1):
                base = pts[j - 1] + seg * r.u(0, 1); bd = rotv(seg / np.linalg.norm(seg), perp(seg), r.u(-0.9, 0.9)); side = rotv(perp(bd), bd, r.u(0, 3.14))
                p.card(base, bd, side, 0.24, 0.24, int(r.u(0, 3)))
        for q in range(2 if lvl == 0 else 1):  # blooms and buds at the canes' ends, facing out and up (part 1)
            c = pts[-1 - q] + [0, 0.03, 0]; n = (c - [0, 0.3, 0]); n /= np.linalg.norm(n); side = perp(n)
            p.card(c - n * 0.01 - rotv(side, n, 1.57) * 0.06, rotv(side, n, 1.57), side, 0.12, 0.12, 3 + (k + q) % 2 if (k + q) % 3 else 5, part=1)
    return p
def plant_flower(kind, lvl):
    p = Plant(); r = R(500 + len(kind))
    if kind == 'flower_violet':
        p.tube([[0, 0, 0], [0, 0.6, 0]], [0.02, 0.015], 0, sides=3)
        for a in (0, math.pi / 2): side = np.array([math.cos(a), 0, math.sin(a)]); p.card(np.array([0, 0.5, 0]), [0, 1, 0], side, 0.5, 0.22, 0 if a == 0 else 2, part=1)
        for k in range(3 if lvl == 0 else 2): a = k * 2.1; d = np.array([math.cos(a), 1.2, math.sin(a)]); side = np.array([-math.sin(a), 0, math.cos(a)]); p.card(np.array([0, 0, 0]), d, side, 0.7, 0.12, 1, bend=-0.4, nv=2 if lvl == 0 else 1)
    elif kind in ('flower_yellow', 'flower_red'):
        heads = [np.array([0, 1.0, 0]), np.array([0.14, 0.82, 0.08])] if kind == 'flower_yellow' else [np.array([0.04, 1.0, 0])]
        for h in heads:
            p.tube([[0, 0, 0], [h[0] * 0.5, 0.5, h[2] * 0.5], h - [0, 0.04, 0]], [0.018, 0.015, 0.012], 3, sides=3)
            s_ = 0.26 if kind == 'flower_yellow' else 0.34; p.card(h - [s_ / 2, 0.0, 0], [1, 0.12, 0], [0, 0, 1], s_, s_, 0, part=1)  # (the bloom seen from above: the card lies nearly flat)
            if lvl == 0:
                for a in (0.4, 0.4 + math.pi / 2): side = np.array([math.cos(a), 0, math.sin(a)]); p.card(h - [0, s_ * 0.35, 0], [0, 1, 0], side, s_ * 0.5, s_ * 0.9, 1, part=1)
        for k in range(3 if lvl == 0 else 2): a = k * 2.1 + 0.5; d = np.array([math.cos(a), 0.5, math.sin(a)]); side = np.array([-math.sin(a), 0, math.cos(a)]); p.card(np.array([0, 0.02, 0]), d, side, 0.35, 0.3, 2, bend=-0.2, nv=2 if lvl == 0 else 1)
    else:  # crown imperial: a tall stem, a whorl of hanging bells under a crown of leaves, strap leaves up the stem
        p.tube([[0, 0, 0], [0, 0.5, 0], [0, 0.9, 0]], [0.02, 0.017, 0.013], 3, sides=5 if lvl == 0 else 3)
        for k in range(5):
            a = 2 * math.pi * k / 5; c = np.array([0.07 * math.cos(a), 0.8, 0.07 * math.sin(a)]); side = np.array([-math.sin(a), 0, math.cos(a)])
            p.card(c + [0, 0.02, 0], [0.4 * math.cos(a), -1, 0.4 * math.sin(a)], side, 0.14, 0.1, 0, part=1)
        for a in (0, math.pi / 2): side = np.array([math.cos(a), 0, math.sin(a)]); p.card(np.array([0, 0.84, 0]), [0, 1, 0], side, 0.2, 0.3, 2)
        for k in range(6 if lvl == 0 else 3): a = k * 2.4; y = 0.1 + 0.07 * k; d = np.array([math.cos(a), 1.0, math.sin(a)]); side = np.array([-math.sin(a), 0, math.cos(a)]); p.card(np.array([0, y, 0]), d, side, 0.3, 0.1, 1, bend=-0.3, nv=2 if lvl == 0 else 1)
    return p
PLANTS = {'cushion': plant_cushion, 'camelthorn': plant_camelthorn, 'thistle': plant_thistle, 'rose': plant_rose}

dev = reset(job.get('device', 'CPU'), job.get('threads', 0)); os.makedirs(job['out'], exist_ok=True); mats = setup_render(); stats = {}
for sid in job['ids']:
    t0 = time.time(); sp = REG['species'][sid]
    for o in [o for o in bpy.data.objects if o.type == 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
    alb = np.zeros((N, N, 4)); nrm = np.zeros((N, N, 3)); nrm[..., 2] = 1; ao = np.ones((N, N))
    for i, build in enumerate(PLAN[sid]):
        c, n_, a = render_tile(build(), mats); cx, cy = (i % NT) * TS, (i // NT) * TS
        alb[cy:cy + TS, cx:cx + TS] = c; nrm[cy:cy + TS, cx:cx + TS] = np.where(c[..., 3:4] > 0.01, n_ / np.maximum(c[..., 3:4], 1e-3) if False else n_, [0.5, 0.5, 1.0]); ao[cy:cy + TS, cx:cx + TS] = np.where(c[..., 3] > 0.01, a, 1.0)
    # the film's colour is premultiplied by its coverage: un-premultiply, then spread the covered colour into the gaps
    A = alb[..., 3:4]; rgb = np.where(A > 0.02, alb[..., :3] / np.maximum(A, 1e-3), 0); alpha = (A[..., 0] > 0.45).astype(float)
    nr = np.where(A > 0.02, nrm / np.maximum(A, 1e-3), 0.5)
    rgb2 = dilate_alpha_rgb(np.clip(rgb.reshape(-1, 3), 0, 1), alpha.ravel(), N, N, it=10); nr2 = dilate_alpha_rgb(np.clip(nr.reshape(-1, 3), 0, 1), alpha.ravel(), N, N, it=10)
    save_png(os.path.join(job['out'], f'{sid}_albedo.png'), np.concatenate([rgb2, alpha.reshape(-1, 1)], 1), N)
    save_png(os.path.join(job['out'], f'{sid}_nrm.png'), np.concatenate([nr2, np.clip(ao, 0, 1).reshape(-1, 1)], 1), N)
    objs = []
    for lvl in (0, 1):
        pl = (PLANTS.get(sid) or (lambda l: plant_flower(sid, l)))(lvl); V, F, UV, C = pl.pa.arrays(); o = mesh_object(f'lod{lvl}', V, F, UV, C); triangulate(o); objs.append(o)
    export_glb(os.path.join(job['out'], f'{sid}.glb'), objs)
    bb = np.array([list(v.co) for v in objs[0].data.vertices]); bbg = np.stack([bb[:, 0], bb[:, 2], -bb[:, 1]], 1)
    stats[sid] = {'tris': {'lod0': tris(objs[0]), 'lod1': tris(objs[1])}, 'tex': N, 'unit': sp['unit'], 'cover': float(alpha.mean()), 'bbox': [bbg.min(0).tolist(), bbg.max(0).tolist()], 'seconds': round(time.time() - t0, 1), 'device': dev}
    log(sid, json.dumps(stats[sid]))
json.dump(stats, open(os.path.join(job['out'], 'stats_' + job['ids'][0] + f'_{len(job["ids"])}.json'), 'w'), indent=1)
log('done', len(stats))
