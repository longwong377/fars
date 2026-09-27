# The project's modelled props (session 12, D-325): every prop, furnishing, door fitting, fire object and held or worked
# object of the world that no CC0 scan covers, modelled in Blender from the numbers of the builders that place them (SITE_SPEC
# rows, the builders' own dimensions) and written to public/models/props/<id>.glb as levels lod0 / lod1 of named parts
# (lod<i>__<part>): each builder draws each part with its own surface or vertex colour, as it drew its procedural stand-in.
# Headless: blender -b --factory-startup --python tools/blender/model_props.py -- <jobs.json>
#   jobs.json: { "out_dir": ..., "ids": [...] }  -> <out_dir>/<id>.glb and <out_dir>/model_props.out.json (triangles per
#   level and part, the model's box in the game's axes)
# Every form is C (reconstruction) unless its builder's note says otherwise; the sources of each form are in its docstring.
# Axes: Blender's, z up; the game's +z (front) is Blender's -y (see lib/mp_lib.py).
import bpy, sys, os, json, math, random, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
from mp_lib import *  # noqa
from mathutils import Vector, Matrix

ASSETS = {}
def asset(ao=True, ground=True, lod1=0.35):
    """register a modelling function: it returns {part: object} at lod0 detail and optionally per-part lod1 targets"""
    def reg(f): ASSETS[f.__name__[2:]] = dict(fn=f, ao=ao, ground=ground, lod1=lod1); return f
    return reg

# ======================================================================================================== palace furnishings
F = dict(couch=dict(len=2.0, w=0.85, h=0.55, head=0.9, leg_r=0.045, mattress=0.12), table=dict(len=0.9, w=0.55, h=0.6), stool=dict(w=0.45, h=0.45),
         footstool=dict(len=0.55, w=0.35, h=0.12), burner=dict(h=0.95, r=0.18), lamp=dict(h=1.3, r=0.16), chest=dict(len=1.0, w=0.55, h=0.55),
         carpet=dict(thick=0.012), roll=dict(r=0.13, len=2.0), hanging=dict(w=2.0, h=3.0, rod_r=0.025, thick=0.006), canopy=dict(w=4.0, d=4.4, h=3.4, fringe=0.3, pole_r=0.06),
         mat=dict(size=(2.0, 1.2), thick=0.01))  # SITE_SPEC global.r_palace_furnishings (the same numbers; the builder fits to its own)

def couch_legs(L, W, top, r, paws=False):
    legs = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            if paws:
                p = lion_paw(r * 1.25, 'paw'); leg = turned_leg(top - 0.07, r, 14, 'leg'); xform(leg, (0, 0, 0.07))
                legs.append(join([p, leg]))
            else:  # the Assyrian couch leg: an inverted pine-cone foot, rings, a volute capital under the rail (analogy, C)
                p = [(0.0, 0), (r * 0.55, 0), (r * 1.25, 0.12 * top), (r * 1.4, 0.2 * top), (r * 0.9, 0.24 * top), (r * 1.15, 0.28 * top), (r * 0.75, 0.32 * top),
                     (r * 0.72, 0.62 * top), (r * 1.1, 0.66 * top), (r * 0.8, 0.7 * top), (r * 0.8, 0.8 * top), (r * 1.5, 0.9 * top), (r * 1.45, top), (0.0, top)]
                leg = lathe(p, 14, 'leg')
            xform(leg, (sx * (L / 2 - 0.06), sy * (W / 2 - 0.06), 0))
            legs.append(leg)
    return legs

@asset()
def a_couch():
    """a couch 'richly covered' (Herodotus 9.80/9.82: gilded or silvered couches): after the high couch of the Assurbanipal
    garden relief (analogy): turned legs with inverted pine-cone feet, a rail frame with slats, a raised head end with a
    scrolled top at +x, a soft mattress and a bolster at the head (C)"""
    C = F['couch']; L, W, H, head = C['len'], C['w'], C['h'], C['head']; fy = H - C['mattress'] - 0.1
    metal = couch_legs(L, W, fy, C['leg_r'])
    for sy in (-1, 1): metal.append(box(L, 0.05, 0.1, (0, sy * (W / 2 - 0.025), fy), bevel=0.008))
    for sx in (-1, 1): metal.append(box(0.05, W - 0.1, 0.1, (sx * (L / 2 - 0.025), 0, fy), bevel=0.008))
    for i in range(7): metal.append(box(0.06, W - 0.1, 0.02, (-L / 2 + 0.15 + i * (L - 0.3) / 6, 0, fy + 0.07), bevel=0.004))
    # the head end: a board rising from the rail, leaning outward a little, with a rounded roll along its top
    hb = box(0.05, W - 0.04, head - fy - 0.04, (L / 2 - 0.035, 0, fy + 0.02), 'head', bevel=0.01)
    for v in hb.data.vertices: v.co.x += 0.06 * ((v.co.z - fy) / (head - fy)) ** 2
    metal.append(hb)
    metal.append(sweep([(L / 2 + 0.03, -W / 2 + 0.01, head - 0.03), (L / 2 + 0.03, W / 2 - 0.01, head - 0.03)], 0.035, 14, 'scroll'))
    mat = box(L - 0.1, W - 0.04, C['mattress'], (-0.04, 0, fy + 0.1), 'mattress', bevel=0.045, segs=4)
    subdiv(mat, 1); displace(mat, 0.012, 0.25, seed=3)
    # the mattress sags a little in the middle and is buttoned (tufts) in two rows
    for v in mat.data.vertices:
        if v.co.z > fy + 0.1 + C['mattress'] * 0.6: v.co.z -= 0.015 * math.cos(math.pi * v.co.x / (L - 0.1)) * math.cos(math.pi * v.co.y / (W - 0.04))
    bol = lathe([(0.0, -W / 2 + 0.06), (0.05, -W / 2 + 0.05), (0.09, -W / 2 + 0.1), (0.1, -W / 2 + 0.2), (0.1, W / 2 - 0.2), (0.09, W / 2 - 0.1), (0.05, W / 2 - 0.05), (0.0, W / 2 - 0.06)], 16, 'bolster')
    xform(bol, (L / 2 - 0.2, 0, H + 0.08), (math.pi / 2, 0, 0))
    displace(bol, 0.006, 0.1, seed=4)
    return dict(metal=join(metal, 'metal'), mattress=mat, bolster=bol)

@asset()
def a_couch_covered():
    """a couch under a linen cover while the court is away: the cover draped by Blender's cloth solver over the couch's
    body and head end, hanging to a hand's breadth off the floor (C)"""
    C = F['couch']; L, W, H, head = C['len'], C['w'], C['h'], C['head']; fy = H - C['mattress'] - 0.1
    legs = couch_legs(L, W, fy, C['leg_r'])
    body = box(L, W, H - fy, (0, 0, fy), 'body', bevel=0.03)
    hd = box(0.12, W, head - fy, (L / 2 - 0.06, 0, fy), 'hd', bevel=0.03)
    cl = grid(L + 0.6, W + 0.6, 70, 34, 'cover', z=head + 0.08)
    drape(cl, [body, hd] + legs, frames=70, mass=0.25, bending=0.2, thickness=0.006)
    bpy.data.objects.remove(body, do_unlink=True); bpy.data.objects.remove(hd, do_unlink=True)
    solidify(cl, 0.004, 1)
    return dict(metal=join(legs, 'metal'), cover=cl)

@asset()
def a_table():
    """a small table, gilded or silvered ('tables of gold and silver', Herodotus 9.82): a top with a moulded edge on four
    turned legs with lion's-paw feet and stretchers (the table beside the couch on the Assurbanipal relief: analogy; C)"""
    T = F['table']; L, W, H = T['len'], T['w'], T['h']
    parts = [box(L, W, 0.04, (0, 0, H - 0.04), bevel=0.012, segs=3)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (L / 2 - 0.06), sy * (W / 2 - 0.06)
            p = lion_paw(0.035); leg = turned_leg(H - 0.04 - 0.045, 0.022, 12); xform(leg, (0, 0, 0.045))
            parts.append(xform(join([p, leg]), (x, y, 0)))
    for sy in (-1, 1): parts.append(sweep([(-L / 2 + 0.06, sy * (W / 2 - 0.06), 0.16), (L / 2 - 0.06, sy * (W / 2 - 0.06), 0.16)], 0.012, 8))
    parts.append(sweep([(0, -W / 2 + 0.06, 0.16), (0, W / 2 - 0.06, 0.16)], 0.011, 8))
    return dict(metal=join(parts, 'metal'))

@asset()
def a_stool():
    """a wooden stool: a slightly dished seat on four turned legs with stretchers (C)"""
    S = F['stool']; w, h = S['w'], S['h']
    seat = box(w, w, 0.05, (0, 0, h - 0.05), bevel=0.01, segs=3)
    for v in seat.data.vertices:
        if v.co.z > h - 0.01: v.co.z -= 0.012 * (1 - (2 * v.co.x / w) ** 2) * (1 - (2 * v.co.y / w) ** 2)
    parts = [seat]
    for sx in (-1, 1):
        for sy in (-1, 1):
            leg = lathe([(0.0, 0), (0.022, 0), (0.02, 0.1), (0.026, 0.14), (0.018, 0.2), (0.017, h - 0.12), (0.024, h - 0.09), (0.02, h - 0.05), (0.0, h - 0.05)], 10, 'leg')
            parts.append(xform(leg, (sx * (w / 2 - 0.04), sy * (w / 2 - 0.04), 0)))
    for sx in (-1, 1): parts.append(sweep([(sx * (w / 2 - 0.04), -w / 2 + 0.04, 0.14), (sx * (w / 2 - 0.04), w / 2 - 0.04, 0.14)], 0.011, 6))
    for sy in (-1, 1): parts.append(sweep([(-w / 2 + 0.04, sy * (w / 2 - 0.04), 0.2), (w / 2 - 0.04, sy * (w / 2 - 0.04), 0.2)], 0.011, 6))
    return dict(wood=join(parts, 'wood'))

@asset()
def a_footstool():
    """a footstool (the audience reliefs' footstool before the throne, TREAS-AUD: B; C form): a board with a moulded edge
    on four short bull's legs ending in hooves"""
    S = F['footstool']; L, W, h = S['len'], S['w'], S['h']
    parts = [box(L, W, 0.06, (0, 0, h - 0.06), bevel=0.012, segs=3)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            hf = hoof(0.026); leg = lathe([(0.0, 0.03), (0.018, 0.03), (0.02, h - 0.06), (0.0, h - 0.06)], 8)
            parts.append(xform(join([hf, leg]), (sx * (L / 2 - 0.05), sy * (W / 2 - 0.05), 0)))
    return dict(frame=join(parts, 'frame'))

@asset()
def a_burner():
    """an incense burner as before the king on the audience reliefs (TREAS-AUD: B): a tall bronze stand on three lion's
    paws, a slender shaft with collars, a bowl, and a stepped conical lid with crenellated tiers and a knob; size C"""
    B = F['burner']; h, r = B['h'], B['r']
    parts = []
    for k in range(3):
        a = TAU * k / 3 + math.pi / 2; p = lion_paw(r * 0.28, 'paw')
        xform(p, (math.cos(a) * r * 0.62, math.sin(a) * r * 0.62, 0), (0, 0, a + math.pi / 2)); parts.append(p)
    prof = [(0.0, 0.05), (r * 0.9, 0.05), (r * 0.95, 0.07), (r * 0.7, 0.09), (r * 0.45, 0.12), (r * 0.2, h * 0.17), (r * 0.16, h * 0.2), (r * 0.24, h * 0.22), (r * 0.14, h * 0.24),
            (r * 0.12, h * 0.42), (r * 0.2, h * 0.44), (r * 0.12, h * 0.46), (r * 0.11, h * 0.6), (r * 0.22, h * 0.63), (r * 0.5, h * 0.66), (r * 0.9, h * 0.7), (r * 1.0, h * 0.73), (r * 0.96, h * 0.745),
            (r * 0.82, h * 0.75), (r * 0.82, h * 0.775), (r * 0.62, h * 0.79), (r * 0.62, h * 0.83), (r * 0.44, h * 0.845), (r * 0.44, h * 0.885), (r * 0.27, h * 0.9), (r * 0.27, h * 0.93),
            (r * 0.1, h * 0.95), (r * 0.12, h * 0.975), (r * 0.08, h * 0.995), (0.0, h)]
    parts.append(lathe(prof, 28, 'stand'))
    # crenellated tiers: stepped merlons round each tier's rim (the Persian stepped crenellation, as on the parapets; C)
    for zr, rr, n in ((h * 0.775, r * 0.82, 16), (h * 0.83, r * 0.62, 12), (h * 0.885, r * 0.44, 9)):
        for k in range(n):
            a = TAU * (k + 0.5) / n
            m = box(0.018, 0.012, 0.02, (0, 0, 0), bevel=0.002); m2 = box(0.01, 0.012, 0.012, (0, 0, 0.02), bevel=0.001)
            parts.append(xform(join([m, m2]), (math.cos(a) * rr, math.sin(a) * rr, zr), (0, 0, a + math.pi / 2)))
    return dict(bronze=join(parts, 'bronze'))

@asset()
def a_lamp_stand():
    """a bronze lamp stand: three legs curving out to lion's paws, a shaft with collars, a dish at the top, and a clay oil
    lamp (an open saucer with a pinched spout) on it; unlit (C; candles are blocklisted)"""
    Ls = F['lamp']; h, r = Ls['h'], Ls['r']
    parts = []
    for k in range(3):
        a = TAU * k / 3
        pts = [(math.cos(a) * r * (0.1 + 0.9 * t), math.sin(a) * r * (0.1 + 0.9 * t), 0.3 - 0.26 * t ** 0.8) for t in (0, 0.25, 0.5, 0.75, 1.0)]
        parts.append(sweep(pts, [0.016, 0.014, 0.012, 0.012, 0.013], 8, 'legk'))
        p = lion_paw(0.022); parts.append(xform(p, (math.cos(a) * r, math.sin(a) * r, 0), (0, 0, a + math.pi / 2)))
    prof = [(0.0, 0.26), (0.03, 0.26), (0.034, 0.3), (0.018, 0.33), (0.015, h * 0.5), (0.026, h * 0.52), (0.015, h * 0.54), (0.013, h - 0.06), (0.024, h - 0.04), (0.02, h - 0.02),
            (r * 0.7, h - 0.005), (r * 0.75, h + 0.012), (r * 0.7, h + 0.014), (r * 0.66, h + 0.004), (0.0, h + 0.004)]
    parts.append(lathe(prof, 20, 'shaft'))
    lamp = vessel([(0.02, 0), (0.05, 0.004), (0.065, 0.02), (0.068, 0.03)], 0.005, 20, 'lamp', 0.02, seed=5)
    for v in lamp.data.vertices:  # the pinched spout toward +x: the rim drawn out and in
        a = math.atan2(v.co.y, v.co.x)
        if abs(a) < 0.7 and v.co.z > 0.012:
            k = (1 - abs(a) / 0.7) ** 2; v.co.x += 0.035 * k; v.co.y *= 1 - 0.7 * k
    xform(lamp, (0, 0, h + 0.004))
    return dict(bronze=join(parts, 'bronze'), clay=lamp)

@asset()
def a_chest():
    """a wooden chest of boards with bronze bands: the sides of three boards each, corner posts running down to short feet, a
    lid of boards overhanging a little, two bronze bands round body and lid with round-headed studs (C)"""
    C = F['chest']; L, W, H = C['len'], C['w'], C['h']; lid = 0.06; body_h = H - lid
    wood = []
    nb = 3; bh = (body_h - 0.04) / nb
    for i in range(nb):
        z = 0.04 + i * bh
        for sy in (-1, 1): wood.append(box(L - 0.08, 0.022, bh - 0.004, (0, sy * (W / 2 - 0.011), z + 0.002), bevel=0.004))
        for sx in (-1, 1): wood.append(box(0.022, W - 0.08, bh - 0.004, (sx * (L / 2 - 0.011), 0, z + 0.002), bevel=0.004))
    for sx in (-1, 1):
        for sy in (-1, 1): wood.append(box(0.05, 0.05, body_h, (sx * (L / 2 - 0.025), sy * (W / 2 - 0.025), 0), bevel=0.006))
    wood.append(box(L - 0.06, W - 0.06, 0.02, (0, 0, 0.05), bevel=0.003))
    lidp = []
    for i in range(4): lidp.append(box((L + 0.04), (W + 0.04) / 4 - 0.004, lid, (0, -(W + 0.04) / 2 + (i + 0.5) * (W + 0.04) / 4, body_h), bevel=0.006, segs=2))
    br = []
    for x in (-0.3 * L, 0.3 * L):
        br.append(box(0.04, W + 0.012, body_h - 0.01, (x, 0, 0.01), bevel=0.003))
        br.append(box(0.04, W + 0.052, 0.012, (x, 0, H - 0.004), bevel=0.003))
        for sy in (-1, 1):
            for z in (0.12, 0.3, 0.44):
                s = lathe([(0.0, 0), (0.012, 0), (0.011, 0.004), (0.006, 0.008), (0.0, 0.009)], 8, 'stud')
                br.append(xform(s, (x, sy * (W / 2 + 0.006), z), (sy * -math.pi / 2, 0, 0)))
    return dict(wood=join(wood, 'wood'), lid=join(lidp, 'lid'), bronze=join(br, 'bronze'))

@asset(ao=False, ground=False)
def a_carpet():
    """a knotted-pile carpet (after the Pazyryk carpet, c. 400 BCE, B for the craft): the pile slab a unit square (the
    builder scales it to each carpet) with rounded, slightly rolled edges, and the warp ends knotted into a fringe of
    tassels beyond the two short ends. The pile itself is the carpet's normal map (carpet_pile_n.png)"""
    t = F['carpet']['thick']
    s = box(1.0, 1.0, t, (0, 0, 0), 'pile', bevel=t * 0.45, segs=3)
    fr = []
    n = 44
    for sx in (-1, 1):
        for k in range(n):
            y = -0.49 + 0.98 * (k + 0.5) / n; ln = 0.05 + 0.012 * math.sin(k * 2.3 + sx)
            pts = [(sx * 0.498, y, t * 0.4), (sx * (0.5 + ln * 0.5), y + 0.002 * math.sin(k), t * 0.25), (sx * (0.5 + ln), y + 0.004 * math.sin(k * 1.7), 0.0015)]
            fr.append(sweep(pts, [0.0035, 0.0028, 0.0022], 4, 'tassel', scale=(1.0, 0.6)))
    return dict(pile=s, fringe=join(fr, 'fringe'))

@asset(ground=True)
def a_roll():
    """a carpet or hanging rolled for store: the cloth wound in a spiral (visible at both ends), the roll a little flattened
    by its own weight and sagging; length along x, 1 m long and 1 m across (the builder fits it to r and len) (C)"""
    turns, r0, r1, th = 3.2, 0.12, 0.5, 0.06
    N = int(turns * 24)
    ph = -math.pi / 2 - 0.35 - TAU * turns  # the outer end comes to rest under the roll, a little to the front
    outer = [((r0 + (r1 - r0) * i / N) * math.cos(TAU * turns * i / N + ph), (r0 + (r1 - r0) * i / N) * math.sin(TAU * turns * i / N + ph)) for i in range(N + 1)]
    inner = [((r0 - th + (r1 - r0) * i / N) * math.cos(TAU * turns * i / N + ph), (r0 - th + (r1 - r0) * i / N) * math.sin(TAU * turns * i / N + ph)) for i in range(N + 1)]
    poly = outer + list(reversed(inner))
    import bmesh
    bm = bmesh.new(); segs = 6; rings = []
    for j in range(segs + 1):
        x = -0.5 + j / segs; sag = 0.02 * math.sin(math.pi * j / segs)
        rings.append([bm.verts.new((x, py * 0.5, pz * 0.44 + 0.5 * 0.44 - sag + 0.02)) for (py, pz) in poly])
    M = len(poly)
    for j in range(segs):
        for k in range(M):
            bm.faces.new((rings[j][k], rings[j][(k + 1) % M], rings[j + 1][(k + 1) % M], rings[j + 1][k]))
    for ring in (rings[0], rings[-1]):
        f = bm.faces.new(ring)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4], quad_method='BEAUTY', ngon_method='EAR_CLIP')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = from_bm(bm, 'roll'); sharp(ob, 50)
    return dict(textile=ob)

@asset()
def a_hanging():
    """a woven wall hanging on a gilded rod ('gaily coloured hangings', Herodotus 9.82): the cloth falling in soft vertical
    folds from rings on the rod, three woven bands, a knotted fringe at the foot; the cloth's top at z = h (the builder sets
    its height), its back 5 cm off the wall (y = 0 is the cloth's mean plane; the room is toward -y) (C)"""
    H = F['hanging']; w, h = H['w'], H['h']
    nx, nz = 60, 30
    def fold(x, z):  # folds deepen toward the foot; the top gathered at the rings
        k = 0.35 + 0.65 * (1 - z / h)
        return -(0.018 * math.sin(TAU * 6.5 * x / w) + 0.008 * math.sin(TAU * 13 * x / w + 1.3)) * k
    cl = grid(w, h, nx, nz, 'cloth');
    for v in cl.data.vertices:
        x, z0 = v.co.x, v.co.y + h / 2; v.co = Vector((x, fold(x, z0), z0 - 0.012 * (1 - z0 / h) * math.cos(TAU * 3 * x / w)))
    solidify(cl, H['thick'], 0)
    bands = []
    for f in (0.12, 0.5, 0.88):
        zc = h * (1 - f); b = grid(w, h * 0.06, nx, 2, 'band')
        for v in b.data.vertices:
            x, z0 = v.co.x, v.co.y + zc; v.co = Vector((x, fold(x, z0) - H['thick'] * 0.5 - 0.0015, z0 - 0.012 * (1 - z0 / h) * math.cos(TAU * 3 * x / w)))
        bands.append(b)
    for k in range(70):  # the fringe
        x = -w / 2 + w * (k + 0.5) / 70; z0 = 0.0 - 0.012 * math.cos(TAU * 3 * x / w)
        bands.append(sweep([(x, fold(x, 0), z0), (x + 0.004 * math.sin(k), fold(x, 0) - 0.004, z0 - 0.045), (x + 0.006 * math.sin(k * 1.3), fold(x, 0) - 0.006, z0 - 0.085)], [0.004, 0.0035, 0.003], 4, 'fr'))
    rod = [sweep([(-w / 2 - 0.1, 0, h + 0.03), (w / 2 + 0.1, 0, h + 0.03)], H['rod_r'], 12, 'rod')]
    for sx in (-1, 1):
        rod.append(xform(lathe([(0.0, 0), (0.03, 0.004), (0.04, 0.03), (0.02, 0.05), (0.028, 0.065), (0.0, 0.08)], 12, 'fin'), (sx * (w / 2 + 0.1), 0, h + 0.03), (0, sx * math.pi / 2, 0)))
    for k in range(8):
        x = -w / 2 + 0.1 + (w - 0.2) * k / 7
        tor = sweep([(x + 0.03 * math.cos(a), 0.03 * math.sin(a) * 0.3, h + 0.03 + 0.035 * math.sin(a) - 0.01) for a in [TAU * i / 12 for i in range(13)]], 0.004, 5, 'ring', caps=False)
        rod.append(tor)
    return dict(cloth=cl, band=join(bands, 'band'), rod=join(rod, 'rod'))

@asset()
def a_canopy():
    """the canopy over the king's place (the canopy over the king on the audience reliefs: B): four gilded poles on bell bases
    with knob finials, the cloth roof sagging between them, a deep fringed band all round with tassels (C)"""
    C = F['canopy']; w, d, h, fr, pr = C['w'], C['d'], C['h'], C['fringe'], C['pole_r']
    gilt = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            p = lathe([(0.0, 0), (pr * 2.6, 0), (pr * 2.4, 0.04), (pr * 1.6, 0.1), (pr * 1.2, 0.18), (pr * 1.0, 0.3), (pr * 0.95, h - 0.1), (pr * 1.5, h - 0.05), (pr * 1.5, h + 0.02),
                       (pr * 1.1, h + 0.05), (pr * 1.6, h + 0.12), (pr * 0.6, h + 0.2), (0.0, h + 0.22)], 14, 'pole')
            gilt.append(xform(p, (sx * w / 2, sy * d / 2, 0)))
    roof = grid(w + 0.1, d + 0.1, 40, 44, 'roof', z=h)
    for v in roof.data.vertices:
        v.co.z = h + 0.01 - 0.09 * math.cos(math.pi * v.co.x / (w + 0.1)) * math.cos(math.pi * v.co.y / (d + 0.1))
    solidify(roof, 0.006, 0)
    band = []
    for (x0, y0, x1, y1) in ((-1, -1, 1, -1), (1, -1, 1, 1), (1, 1, -1, 1), (-1, 1, -1, -1)):
        ax, ay = x0 * (w / 2 + 0.05), y0 * (d / 2 + 0.05); bx, by = x1 * (w / 2 + 0.05), y1 * (d / 2 + 0.05)
        L = math.hypot(bx - ax, by - ay); n = int(L / 0.04)
        b = grid(L, fr * 0.7, n, 3, 'b')
        ang = math.atan2(by - ay, bx - ax)
        for v in b.data.vertices:
            u, z = v.co.x, v.co.y
            v.co = Vector(((ax + bx) / 2 + u * math.cos(ang), (ay + by) / 2 + u * math.sin(ang), h + 0.01 - fr * 0.35 + z))
            nx_, ny_ = math.sin(ang), -math.cos(ang); off = 0.006 * math.sin(TAU * u / 0.3)
            v.co.x += nx_ * off; v.co.y += ny_ * off
        band.append(b)
        for k in range(int(L / 0.08)):
            u = -L / 2 + (k + 0.5) * 0.08; px, py = (ax + bx) / 2 + u * math.cos(ang), (ay + by) / 2 + u * math.sin(ang)
            band.append(xform(lathe([(0.0, 0), (0.012, 0.01), (0.009, 0.06), (0.004, fr * 0.3), (0.006, fr * 0.33), (0.0, fr * 0.36)], 6, 'tas'), (px, py, h + 0.01 - fr)))
    return dict(gilt=join(gilt, 'gilt'), cloth=roof, band=join(band, 'band'))

@asset(ground=True)
def a_mat():
    """a reed mat: split reeds side by side along x, twined across with five cords (C); 2.0 x 1.2 m, 1 cm thick"""
    Sx, Sy = F['mat']['size']; t = F['mat']['thick']
    reeds = []; n = int(Sy / 0.012)
    for i in range(n):
        y = -Sy / 2 + (i + 0.5) * Sy / n; wob = 0.004 * math.sin(i * 1.7)
        reeds.append(sweep([(-Sx / 2 + wob, y, t * 0.45), (0, y + 0.001 * math.sin(i), t * 0.5), (Sx / 2 - wob, y, t * 0.45)], 0.0055, 5, 'reed', scale=(1.0, 0.8)))
    for k in range(5):
        x = -Sx / 2 + 0.12 + k * (Sx - 0.24) / 4
        reeds.append(sweep([(x, -Sy / 2, t * 0.95), (x, Sy / 2, t * 0.95)], 0.0022, 4, 'cord'))
    return dict(matting=join(reeds, 'matting'))

@asset()
def a_throne():
    """the king's throne and footstool at an audience (court setting; the Treasury audience relief, TREAS-AUD: B): a
    high-backed chair on turned legs with rings, lion's-paw feet on low drums, stretchers between the legs, the back upright
    with knob finials; the footstool before it on four bull's legs with hooves; a cushion on the seat. In the performer's
    frame (origin under the seated king's root, the seat behind, the footstool in front); the sizes the builder's (seat top
    0.525 m, footstool 0.105 m: fitted to the enthroned pose, C)"""
    seatY = 0.525; g = []
    g.append(box(0.62, 0.46, 0.05, (0, 0, seatY - 0.09 - 0.025 + 0.025), bevel=0.01, segs=3))
    g.append(box(0.6, 0.045, 0.82, (0, 0.245, seatY - 0.04), bevel=0.012, segs=3))
    for x in (-0.29, 0.29):
        g.append(xform(lathe([(0.0, 0), (0.022, 0), (0.026, 0.03), (0.014, 0.05), (0.03, 0.08), (0.0, 0.1)], 12, 'fin'), (x, 0.245, seatY + 0.78)))
    for x in (-0.27, 0.27):
        for y in (-0.2, 0.2):
            drum = lathe([(0.0, 0), (0.05, 0), (0.052, 0.012), (0.044, 0.02), (0.0, 0.02)], 14, 'drum')
            paw = lion_paw(0.034); xform(paw, (0, 0, 0.02))
            leg = turned_leg(seatY - 0.09 - 0.07, 0.024, 14); xform(leg, (0, 0, 0.07))
            g.append(xform(join([drum, paw, leg]), (x, y, 0)))
    for y in (-0.2, 0.2): g.append(sweep([(-0.27, y, 0.2), (0.27, y, 0.2)], 0.014, 8))
    for x in (-0.27, 0.27): g.append(sweep([(x, -0.2, 0.24), (x, 0.2, 0.24)], 0.013, 8))
    # the footstool
    g.append(box(0.56, 0.36, 0.05, (0, -0.37, 0.055), bevel=0.01, segs=3))
    for x in (-0.24, 0.24):
        for y in (-0.23, -0.51):
            hf = hoof(0.024); leg = lathe([(0.0, 0.028), (0.016, 0.028), (0.018, 0.058), (0.0, 0.058)], 8)
            g.append(xform(join([hf, leg]), (x, y, 0)))
    cush = box(0.6, 0.43, 0.05, (0, 0, seatY - 0.045), 'cushion', bevel=0.02, segs=3); subdiv(cush, 1); displace(cush, 0.006, 0.15, seed=9)
    return dict(gilt=join(g, 'gilt'), cushion=cush)

# ======================================================================================================== doors (unit forms)
@asset(ao=True, ground=False, lod1=0.5)
def a_door_leaf():
    """a door leaf as a unit box (the instanced leaf is scaled to each doorway's length, height and thickness): five
    vertical planks with V-joints on both faces, each plank's face a little proud or sunk, the arrises chamfered, the end
    grain at top and bottom (C; timber species unknown)"""
    n = 5; parts = []
    for i in range(n):
        x0 = -0.5 + i / n; wdt = 1 / n
        off = 0.03 * math.sin(i * 2.7 + 0.4)
        p = box(wdt - 0.004, 1.0 + off * 0.2, 1.0, (x0 + wdt / 2, 0, -0.5), bevel=0.025, segs=1, base=True)
        for v in p.data.vertices: v.co.y *= 1.0  # thickness along y
        parts.append(p)
    ob = join(parts, 'leaf')
    # unit box: x = length, y = thickness, z = height (three: x, -z, y -> the instanced box's x, y(height), z(thickness))
    for v in ob.data.vertices: v.co.y = max(-0.5, min(0.5, v.co.y))
    return dict(leaf=ob)

@asset(ao=False, ground=False)
def a_door_band():
    """a bronze band across a leaf as a unit box: a strap with rounded edges and a raised rib along each edge (C)"""
    b = box(1.0, 1.0, 1.0, (0, 0, -0.5), 'band', bevel=0.12, segs=3)
    return dict(band=b)

@asset(ao=False, ground=False)
def a_door_boss():
    """a bronze boss (a nail head) as a unit: a dome on a flat collar, facing the game's +z (Blender -y), base at 0 (C)"""
    ob = lathe([(0.0, 0), (1.0, 0), (1.0, 0.12), (0.86, 0.2), (0.8, 0.42), (0.66, 0.7), (0.42, 0.9), (0.14, 0.99), (0.0, 1.0)], 14, 'boss')
    xform(ob, (0, 0, 0), (math.pi / 2, 0, 0))
    return dict(boss=ob)

@asset(ao=False, ground=False)
def a_door_shoe():
    """the bronze shoe of a pivot post as a unit cylinder (r 1, height 1, centred): a sleeve with a lip at each end and a
    ring of rivets (C)"""
    ob = lathe([(0.0, -0.5), (1.0, -0.5), (1.08, -0.46), (1.08, -0.36), (1.0, -0.32), (1.0, 0.32), (1.08, 0.36), (1.08, 0.46), (1.0, 0.5), (0.0, 0.5)], 20, 'shoe')
    parts = [ob]
    for k in range(8):
        a = TAU * k / 8; r = lathe([(0.0, 0), (0.1, 0), (0.08, 0.05), (0.0, 0.07)], 6, 'riv')
        parts.append(xform(r, (math.cos(a) * 0.99, math.sin(a) * 0.99, 0), (0, math.pi / 2, a)))
    return dict(shoe=join(parts, 'shoe'))

@asset(ao=False, ground=False)
def a_door_post():
    """a pivot post as a unit cylinder: hewn, its sides dressed in long adze facets, the top rounded (C)"""
    seg = 10; prof = [(0.0, -0.5), (1.0, -0.5), (1.0, 0.49), (0.9, 0.5), (0.0, 0.5)]
    ob = lathe(prof, seg, 'post')
    for v in ob.data.vertices:
        a = math.atan2(v.co.y, v.co.x); k = 1 + 0.035 * math.sin(a * 3 + 1.1) + 0.02 * math.sin(a * 7)
        v.co.x *= k; v.co.y *= k
    return dict(post=sharp(ob, 30))

# ======================================================================================================== fire objects
def gv(x, y, z):
    """a point given in the game's axes (x, y up, z front) in Blender's"""
    return (x, -z, y)

def stone_lump(r, seed, name='stone', flat=0.7):
    """a field stone: an irregular lump (metaballs, then displaced), r its half size"""
    rnd = random.Random(seed); e = []
    for k in range(4):
        e.append(('ELLIPSOID', (rnd.uniform(-0.35, 0.35) * r, rnd.uniform(-0.35, 0.35) * r, rnd.uniform(0.1, 0.4) * r * flat), r * rnd.uniform(0.55, 0.8), (rnd.uniform(0.8, 1.3), rnd.uniform(0.8, 1.2), flat * rnd.uniform(0.8, 1.1)), 2))
    ob = meta(e, res=r / 6, name=name)
    displace(ob, r * 0.12, r * 0.6, seed=seed)
    for v in ob.data.vertices:
        if v.co.z < 0: v.co.z *= 0.3
    return ob

@asset()
def a_brazier():
    """a brazier after the incense stands of the audience reliefs (B type): a bronze tripod on lion's paws, a shaft with
    collars and a wide shallow bowl with a rolled rim, its top at 1.02 m (fire.ts LIFT), charcoal heaped in it (C)"""
    top = 1.02; parts = []
    for k in range(3):
        a = TAU * k / 3 + 0.3
        pts = [(math.cos(a) * 0.04, math.sin(a) * 0.04, 0.32), (math.cos(a) * 0.12, math.sin(a) * 0.12, 0.2), (math.cos(a) * 0.19, math.sin(a) * 0.19, 0.08)]
        parts.append(sweep(pts, [0.018, 0.016, 0.015], 8, 'leg'))
        parts.append(xform(lion_paw(0.028), (math.cos(a) * 0.2, math.sin(a) * 0.2, 0), (0, 0, a + math.pi / 2)))
    prof = [(0.0, 0.3), (0.05, 0.3), (0.06, 0.34), (0.035, 0.37), (0.03, 0.6), (0.05, 0.62), (0.03, 0.64), (0.028, 0.82), (0.06, 0.85), (0.2, 0.9), (0.33, 0.96), (0.37, top - 0.02),
            (0.375, top), (0.35, top + 0.005), (0.33, top - 0.015), (0.2, 0.93), (0.0, 0.91)]
    parts.append(lathe(prof, 28, 'bowl'))
    coal = meta([('ELLIPSOID', (0, 0, 0.93), 0.26, (1.0, 1.0, 0.25), 2)] + [('BALL', (0.18 * math.cos(k * 2.4), 0.18 * math.sin(k * 2.4), 0.96), 0.05, None, 2) for k in range(7)], res=0.02, name='coal')
    displace(coal, 0.015, 0.05, seed=11)
    return dict(bronze=join(parts, 'bronze'), coal=coal)

@asset(ground=False)
def a_torch():
    """a torch in its wall bracket, in fire.ts's frame (the base the bracket point on the wall, the shaft leaning out 0.25
    rad): a wooden shaft, its head wrapped in pitch-soaked tow bound with cord, an iron ring and arm to a wall plate (C)"""
    a = -0.25
    def rot(x, y, z): return gv(x, y * math.cos(a) - z * math.sin(a), y * math.sin(a) + z * math.cos(a))
    shaft = sweep([rot(0, -0.25, 0.1), rot(0, 0.05, 0.1), rot(0, 0.3, 0.1)], [0.022, 0.026, 0.028], 10, 'shaft')
    head = meta([('ELLIPSOID', rot(0, 0.3 + 0.02 * k, 0.1), 0.05 - 0.006 * abs(k - 2), (1.0, 1.0, 0.9), 2) for k in range(5)], res=0.008, name='head')
    displace(head, 0.006, 0.03, seed=12)
    br = [sweep([rot(0.036 * math.cos(t), 0.0, 0.1 + 0.036 * math.sin(t)) for t in [TAU * i / 14 for i in range(15)]], 0.006, 6, 'ring', caps=False),
          sweep([rot(0, 0.0, 0.064), rot(0, -0.02, 0.0)], 0.008, 6, 'arm'), box(0.09, 0.012, 0.14, gv(0, -0.07, -0.006), 'plate', bevel=0.003)]
    return dict(wood=shaft, head=head, bracket=join(br, 'bracket'))

@asset(ground=True)
def a_hearth():
    """a hearth: a ring of eleven field stones of their own sizes and tilts round a bed of ash with charcoal (C; fire.ts's
    ring of 0.45 m radius)"""
    st = []
    for i in range(11):
        a = TAU * i / 11 + 0.2 * math.sin(i * 7.1); h = lambda k: 0.5 + 0.5 * math.sin(i * 12.9898 + k * 78.233)
        s = stone_lump(0.15 * (0.9 + 0.4 * h(1)), 20 + i, flat=0.8)
        st.append(xform(s, (math.cos(a) * (0.45 + 0.04 * h(6)), math.sin(a) * (0.45 + 0.04 * h(6)), 0), (0.2 * (h(5) - 0.5), 0, a + h(4))))
    ash = lathe([(0.0, 0.035), (0.2, 0.03), (0.36, 0.015), (0.42, 0.0)], 20, 'ash', wobble=0.06, seed=3)
    displace(ash, 0.01, 0.08, seed=13)
    return dict(stone=join(st, 'stone'), ash=ash)

@asset(ground=True)
def a_oven():
    """a domed clay bread oven (fire.ts: 0.6 m radius): a thick dome of clay built up in coils, a mouth arched at the front
    (game +z), a vent at the top, the surface uneven and cracked (C)"""
    dome = lathe([(0.0, 0.0), (0.6, 0.0), (0.61, 0.08), (0.58, 0.25), (0.5, 0.42), (0.36, 0.54), (0.16, 0.6), (0.09, 0.61), (0.09, 0.64), (0.0, 0.64)], 36, 'dome', wobble=0.025, seed=4)
    subdiv(dome, 1); displace(dome, 0.012, 0.12, seed=14)
    for v in dome.data.vertices:  # coil courses: faint horizontal ridges
        v.co.x *= 1 + 0.006 * math.sin(v.co.z * 70); v.co.y *= 1 + 0.006 * math.sin(v.co.z * 70)
    # the mouth: an arched opening at the front (Blender -y), cut through the wall
    cut = sweep([(0, -0.8, 0.0), (0, -0.3, 0.0)], 0.2, 16, 'cut'); xform(cut, (0, 0, 0.0))
    for v in cut.data.vertices: v.co.z = max(v.co.z, -0.02) * 1.3 + 0.0
    boolean(dome, cut)
    return dict(mud=dome)

@asset(ground=True)
def a_lamp():
    """a clay oil lamp: an open saucer, its rim pinched into a spout for the wick (the ordinary lamp of the period: B type;
    C form), 0.13 m long"""
    lamp = vessel([(0.02, 0), (0.05, 0.004), (0.065, 0.02), (0.068, 0.03)], 0.005, 22, 'lamp', 0.02, seed=5)
    for v in lamp.data.vertices:
        a = math.atan2(v.co.y, v.co.x)
        if abs(a) < 0.7 and v.co.z > 0.012:
            k = (1 - abs(a) / 0.7) ** 2; v.co.x += 0.035 * k; v.co.y *= 1 - 0.7 * k
    return dict(clay=lamp)

# ======================================================================================================== vessels
def handle(p0, p1, bulge, r=0.009, seg=6, name='handle'):
    """a loop handle from p0 to p1 bowing out by `bulge` (a vector)"""
    P0, P1, B = Vector(p0), Vector(p1), Vector(bulge)
    pts = [P0.lerp(P1, t) + B * math.sin(math.pi * t) for t in [i / 8 for i in range(9)]]
    return sweep(pts, r, seg, name, scale=(1.0, 0.7))

@asset()
def a_jar_store():
    """a storage jar of the period's plain buff ware (MATERIAL_CULTURE storage jars: C): an ovoid body on a small flat base,
    a short neck and a thickened rolled rim, thrown by hand (the wobble), 0.9 m (the palace's jar; builders fit it)"""
    h = 0.9; r = 0.28
    o = [(0.1, 0.0), (0.16, 0.03), (0.24, 0.14), (0.28, 0.34), (0.275, 0.5), (0.24, 0.64), (0.17, 0.74), (0.11, 0.8), (0.1, 0.84), (0.115, 0.87), (0.12, 0.89), (0.11, h)]
    j = vessel(o, 0.014, 32, 'body', 0.012, seed=21)
    for v in j.data.vertices:  # faint throwing ridges on the shoulder
        rr = math.hypot(v.co.x, v.co.y)
        if 0.5 < v.co.z < 0.78 and rr > 0.12: k = 1 + 0.004 * math.sin(v.co.z * 90); v.co.x *= k; v.co.y *= k
    return dict(clay=j)

@asset()
def a_jar_water():
    """a water jar with two loop handles on the shoulder (C form), 0.46 m"""
    o = [(0.06, 0.0), (0.1, 0.02), (0.155, 0.12), (0.16, 0.22), (0.14, 0.31), (0.09, 0.37), (0.055, 0.4), (0.05, 0.43), (0.06, 0.45), (0.058, 0.46)]
    j = vessel(o, 0.008, 28, 'body', 0.012, seed=22)
    hs = [handle((s * 0.13, 0, 0.3), (s * 0.06, 0, 0.405), (s * 0.05, 0, 0.01), 0.011) for s in (-1, 1)]
    return dict(clay=join([j] + hs, 'clay'))

@asset()
def a_jar_neck():
    """a narrow-necked jar for oil or wine (C form), 0.43 m"""
    o = [(0.04, 0.0), (0.09, 0.02), (0.135, 0.12), (0.14, 0.2), (0.11, 0.3), (0.05, 0.36), (0.035, 0.39), (0.04, 0.42), (0.045, 0.43)]
    return dict(clay=vessel(o, 0.007, 26, 'body', 0.01, seed=23))

@asset()
def a_bowl():
    """a carinated bowl of the Achaemenid ware (the bowl type: B; C size): a small ring foot, a sharp carination, a flaring
    rim; 0.2 m across"""
    o = [(0.03, 0.0), (0.035, 0.006), (0.04, 0.008), (0.075, 0.03), (0.09, 0.045), (0.087, 0.055), (0.095, 0.075), (0.1, 0.085)]
    return dict(clay=vessel(o, 0.005, 32, 'bowl', 0.008, seed=24))

@asset(ao=True)
def a_phiale():
    """a lobed phiale of silver (Achaemenid phialai, B type): a shallow bowl, its wall pushed out in 16 tear-drop lobes round a
    raised omphalos, the rim plain; 0.2 m across (C size)"""
    o = [(0.0, 0.0), (0.03, 0.003), (0.07, 0.012), (0.095, 0.03), (0.1, 0.04)]
    b = vessel(o, 0.003, 64, 'phiale', 0.0, seed=25)
    for v in b.data.vertices:
        rr = math.hypot(v.co.x, v.co.y); a = math.atan2(v.co.y, v.co.x)
        if 0.025 < rr < 0.092: k = math.sin(math.pi * (rr - 0.025) / 0.067) * 0.007 * max(0, math.cos(a * 16)) ** 0.6; v.co.x *= 1 + k / rr; v.co.y *= 1 + k / rr; v.co.z -= k * 0.5
        if rr < 0.022: v.co.z += 0.012 * (1 - rr / 0.022) ** 1.5
    return dict(metal=b)

@asset()
def a_cookpot():
    """a globular cooking pot with a hole mouth and two lug handles, its lower body blackened (the soot is the builder's
    colour; C), 0.25 m"""
    o = [(0.04, 0.0), (0.1, 0.03), (0.155, 0.1), (0.17, 0.15), (0.155, 0.2), (0.12, 0.235), (0.105, 0.245), (0.11, 0.252)]
    p = vessel(o, 0.007, 28, 'pot', 0.015, seed=26)
    lugs = [xform(meta([('ELLIPSOID', (0, 0, 0), 0.028, (1.0, 0.6, 0.45), 2)], res=0.006, name='lug'), (s * 0.165, 0, 0.18)) for s in (-1, 1)]
    return dict(clay=join([p] + lugs, 'clay'))

@asset()
def a_milkpot():
    """a round-bellied clay pot with a short neck for the milk (C), 0.29 m"""
    o = [(0.05, 0.0), (0.09, 0.02), (0.135, 0.09), (0.14, 0.13), (0.125, 0.2), (0.09, 0.25), (0.078, 0.265), (0.085, 0.28), (0.09, 0.29)]
    return dict(clay=vessel(o, 0.007, 28, 'pot', 0.012, seed=27))

@asset()
def a_basin():
    """a wide shallow clay basin with a thickened rim (plain wide bowls and basins are ordinary finds: B; C), 0.46 m across"""
    o = [(0.09, 0.0), (0.12, 0.005), (0.18, 0.035), (0.215, 0.075), (0.23, 0.098), (0.235, 0.105)]
    return dict(clay=vessel(o, 0.01, 36, 'basin', 0.01, seed=28))

@asset()
def a_jug():
    """a small jug with a handle from rim to shoulder (C), 0.17 m"""
    o = [(0.03, 0.0), (0.05, 0.01), (0.072, 0.06), (0.07, 0.09), (0.045, 0.125), (0.033, 0.145), (0.037, 0.165), (0.04, 0.17)]
    j = vessel(o, 0.004, 22, 'jug', 0.012, seed=29)
    return dict(clay=join([j, handle((-0.036, 0, 0.16), (-0.066, 0, 0.08), (-0.035, 0, 0.01), 0.0065)], 'clay'))

@asset()
def a_vat():
    """a large wide-mouthed vat (pithos) for brewing and storage: a heavy rolled rim, rope-impressed bands round the body,
    0.75 m, 0.72 m across (C form)"""
    o = [(0.17, 0.0), (0.24, 0.05), (0.31, 0.15), (0.35, 0.3), (0.36, 0.42), (0.34, 0.56), (0.3, 0.66), (0.26, 0.7), (0.26, 0.72), (0.285, 0.735), (0.285, 0.75)]
    v_ = vessel(o, 0.022, 36, 'vat', 0.012, seed=30)
    bands = []
    for z in (0.3, 0.45, 0.58):
        R = [rr for rr, zz in o]; zs = [zz for rr, zz in o]
        k = next(i for i in range(len(zs) - 1) if zs[i] <= z <= zs[i + 1]); t = (z - zs[k]) / (zs[k + 1] - zs[k]); rz = R[k] + (R[k + 1] - R[k]) * t
        bands.append(sweep([((rz + 0.004) * math.cos(a), (rz + 0.004) * math.sin(a), z + 0.004 * math.sin(a * 40)) for a in [TAU * i / 96 for i in range(97)]], 0.009, 6, 'rope', caps=False))
    return dict(clay=join([v_] + bands, 'clay'))

@asset(ao=False, ground=False)
def a_sherds():
    """four sherds of a broken jar: curved pieces of a 1 cm wall with jagged broken edges, each lying on its convex side or
    its concave side, 6-14 cm across (C); parts s0..s3 (roadLitter.ts draws one per sherd)"""
    out = {}
    for k in range(4):
        rnd = random.Random(40 + k); R = rnd.uniform(0.14, 0.24); th = 0.009
        n = 9; sz = rnd.uniform(0.035, 0.07)
        outline = [(math.cos(TAU * i / n) * sz * rnd.uniform(0.6, 1.2), math.sin(TAU * i / n) * sz * rnd.uniform(0.6, 1.2)) for i in range(n)]
        import bmesh as _bm
        bm = _bm.new(); top = []; bot = []
        for (u, w) in outline:  # u along the circumference, w up the jar: on a cylinder of radius R
            a = u / R
            for (lst, rr) in ((top, R), (bot, R - th)):
                lst.append(bm.verts.new((rr * math.sin(a), -(rr * math.cos(a) - R), w)))
        ft = bm.faces.new(top); fb = bm.faces.new(list(reversed(bot)))
        for i in range(n): bm.faces.new((top[i], bot[i], bot[(i + 1) % n], top[(i + 1) % n]))
        _bm.ops.triangulate(bm, faces=[ft, fb]); _bm.ops.recalc_face_normals(bm, faces=bm.faces)
        ob = from_bm(bm, 's%d' % k, smooth=False); sharp(ob, 35)
        # lie it on the ground: the piece's w axis flat (rotate so the wall lies down), convex up or down
        xform(ob, (0, 0, 0), (math.pi / 2 if k % 2 else -math.pi / 2, 0, rnd.uniform(0, TAU)))
        zs = [v.co.z for v in ob.data.vertices]; z0 = min(zs)
        for v in ob.data.vertices: v.co.z -= z0
        out['s%d' % k] = ob
    return out

@asset(ground=True)
def a_sack():
    """a grain sack standing, filled and tied at the neck: a sewn tube of coarse cloth, filled (the cloth solver's pressure),
    settled on the ground under its own weight so that it slumps and creases, the gathered neck bound with a cord and the
    ears of the tie standing up (C), ~0.6 m"""
    prof = [(0.0, 0.0), (0.17, 0.0), (0.2, 0.03), (0.21, 0.12), (0.21, 0.3), (0.2, 0.4), (0.15, 0.47), (0.07, 0.52), (0.045, 0.55), (0.05, 0.6), (0.0, 0.62)]
    s = lathe(prof, 24, 'sack', wobble=0.03, seed=31); subdiv(s, 1)
    g = box(3, 3, 0.1, (0, 0, -0.1), 'floor')
    drape(s, [g], frames=36, mass=0.6, bending=2.0, thickness=0.004, pressure=6.0, pin=lambda p: 1.0 if p.z > 0.5 else 0.0)
    bpy.data.objects.remove(g, do_unlink=True)
    for v in s.data.vertices: v.co.z = max(0.0, v.co.z)
    tex = bpy.data.textures.new('crease', 'STUCCI'); tex.noise_scale = 0.08
    m = s.modifiers.new('d', 'DISPLACE'); m.texture = tex; m.strength = 0.006; m.mid_level = 0.5; apply_mods(s)
    cord = sweep([(0.052 * math.cos(a), 0.052 * math.sin(a), 0.545) for a in [TAU * i / 16 for i in range(17)]], 0.006, 5, 'cord', caps=False)
    return dict(cloth=s, cord=cord)

@asset(ground=True)
def a_sack_lying():
    """a filled grain sack lying on its side (the piles of the depot and the store, the cart's load, a sack on the shoulder):
    the standing sack's sewn tube laid along x, settled by the cloth solver so it flattens under its weight, the tied end at
    +x (C), ~0.62 m long"""
    prof = [(0.0, 0.0), (0.17, 0.0), (0.2, 0.03), (0.21, 0.12), (0.21, 0.3), (0.2, 0.4), (0.15, 0.47), (0.07, 0.52), (0.045, 0.55), (0.05, 0.6), (0.0, 0.62)]
    s = lathe(prof, 24, 'sack', wobble=0.03, seed=32); subdiv(s, 1)
    xform(s, (-0.3, 0, 0.22), (0, math.pi / 2, 0))
    g = box(3, 3, 0.1, (0, 0, -0.1), 'floor')
    drape(s, [g], frames=36, mass=0.6, bending=2.0, thickness=0.004, pressure=5.0)
    bpy.data.objects.remove(g, do_unlink=True)
    zs = [v.co.z for v in s.data.vertices]; z0 = min(zs)
    for v in s.data.vertices: v.co.z -= z0
    tex = bpy.data.textures.new('crease', 'STUCCI'); tex.noise_scale = 0.08
    m = s.modifiers.new('d', 'DISPLACE'); m.texture = tex; m.strength = 0.006; m.mid_level = 0.5; apply_mods(s)
    # the cord round the neck: find the neck's centre (x ~ 0.245 along the laid tube) from the settled surface
    nk = [v.co for v in s.data.vertices if 0.23 < v.co.x < 0.26]
    cz = sum(p.z for p in nk) / max(1, len(nk)); cy = sum(p.y for p in nk) / max(1, len(nk))
    cord = sweep([(0.245, cy + 0.05 * math.cos(a), cz + 0.05 * math.sin(a)) for a in [TAU * i / 16 for i in range(17)]], 0.006, 5, 'cord', caps=False)
    return dict(cloth=s, cord=cord)

# ======================================================================================================== driver
if __name__ == '__main__':
    job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
    outd = job['out_dir']; os.makedirs(outd, exist_ok=True); report = {}
    for id_ in job['ids']:
        t0 = time.time(); A = ASSETS[id_]
        clear()
        parts = A['fn']()
        lod0 = {}; lod1 = {}
        tgt = job.get('targets', {}).get(id_, {})
        for p, ob in parts.items():
            triangulate(ob); weld(ob)
            t = tgt.get(p)
            if t: decimate(ob, t[0])
            lod0[p] = ob
            o1 = copy(ob, ob.name + '_1'); decimate(o1, t[1] if t else max(8, int(tris(ob) * A['lod1']))); lod1[p] = o1
        if A['ao']:
            for o in lod1.values(): o.hide_render = True
            bake_ao(list(lod0.values()), ground=A['ground'])
            for o in lod1.values(): o.hide_render = False
            for o in lod0.values(): o.hide_render = True
            bake_ao(list(lod1.values()), ground=A['ground'])
            for o in lod0.values(): o.hide_render = False
        # the model's box (game axes: x, y up, z = -Blender y) over lod0
        pts = [o.matrix_world @ Vector(c) for o in lod0.values() for c in o.bound_box]
        box_ = [[min(p.x for p in pts), min(p.z for p in pts), min(-p.y for p in pts)], [max(p.x for p in pts), max(p.z for p in pts), max(-p.y for p in pts)]]
        tr = export(os.path.join(outd, id_ + '.glb'), [lod0, lod1], ao=A['ao'])
        report[id_] = dict(tris=tr, box=box_, seconds=round(time.time() - t0, 1), ao=A['ao'])
        print('[model_props]', id_, json.dumps(report[id_]), flush=True)
    json.dump(report, open(os.path.join(outd, 'model_props.out.json'), 'w'), indent=1)
