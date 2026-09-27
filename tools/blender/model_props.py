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
    # (the lid plain-stepped: the relief's lid form is open, Q-971)
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
    # the metaballs' surface lies inside their radii: scaled so the stone's larger footprint side is 2r
    xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]; k = 2 * r / max(1e-6, max(max(xs) - min(xs), max(ys) - min(ys)))
    for v in ob.data.vertices: v.co *= k
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

# ======================================================================================================== held props (people/props.ts)
# In the props' own frames (props.ts): the Phase 3 kinds keep their origins (the spear at its butt, +Y up the shaft; the
# mallet at the grip, its handle down -Y); the tools of the work cycles are in a grip frame: origin at the grip, +Z (game)
# toward the working end, +Y the tool's roll reference. Sizes are the procedural forms' (so the placements hold); the
# forms are C unless props.ts's note says otherwise. Parts are named by what they are made of (props.ts TOOL_PAINT colours
# them): wood, wood_d, iron, bronze, silver, gold, straw, cloth, wool, bone, clay, cord, leather, reed, cane, linen, hair.
def G(p): return Vector((p[0], -p[2], p[1]))
def rodG(a, b, r0, r1=None, seg=6, name='rod', caps=True, scale=None):
    return sweep([G(a), G(b)], [r0, r0 if r1 is None else r1], seg, name, caps, scale=scale)
def pathG(pts, radii, seg=6, name='path', caps=True, scale=None, up=(0, 0, 1)):
    return sweep([G(p) for p in pts], radii, seg, name, caps, scale=scale, up=up)
def alongZ(ob, z0=0.0):
    """a lathe built along Blender z turned to run along the game's +Z from z0"""
    return xform(ob, (0, -z0, 0), (math.pi / 2, 0, 0))
def atG(ob, p):
    q = G(p); return xform(ob, (q.x, q.y, q.z))
def leaf_blade(y0, L, w, t, seg=4, name='blade', axis='y'):
    """a leaf-shaped blade with a midrib (a diamond section) from y0 along game +Y (axis 'y') or +Z (axis 'z'), length L,
    greatest width w at 30 %"""
    ts = [i / 8 for i in range(9)]
    wf = lambda s: w * (math.sin(math.pi * min(1, s / 0.3) / 2) if s < 0.3 else (1 - (s - 0.3) / 0.7) ** 0.8) + 0.0015
    pts = [(0, y0 + L * s, 0) if axis == 'y' else (0, 0, y0 + L * s) for s in ts]
    return pathG(pts, lambda s: wf(s), seg, name, scale=(1.0, t / w), up=(0, 1, 0) if axis == 'y' else (0, 0, 1))

def spear_common(butt):
    wood = [pathG([(0, 0.08, 0), (0.002, 1.1, 0), (0, 2.18, 0)], [0.016, 0.015, 0.014], 7, 'shaft')]
    br = [rodG((0, 2.16, 0), (0, 2.25, 0), 0.0175, 0.0145, 8, 'socket'), rodG((0, 2.165, 0), (0, 2.18, 0), 0.0195, 0.0195, 8, 'ring'),
          leaf_blade(2.24, 0.27, 0.029, 0.009, 4, 'blade')]
    b = []
    if butt == 'apple':
        b.append(atG(lathe([(0.0, -0.043), (0.03, -0.04), (0.047, -0.015), (0.047, 0.012), (0.035, 0.035), (0.012, 0.042), (0.0, 0.036)], 12, 'apple'), (0, 0.045, 0)))
        b.append(rodG((0, 0.08, 0), (0, 0.1, 0), 0.004, 0.006, 5, 'stalk'))
    else:
        b.append(atG(lathe([(0.0, -0.045), (0.03, -0.04), (0.046, -0.01), (0.044, 0.02), (0.03, 0.038), (0.016, 0.045), (0.014, 0.05)], 12, 'pom'), (0, 0.05, 0)))
        for k in range(6):  # the crown of sepals toward the shaft
            a = TAU * k / 6; b.append(rodG((0.012 * math.cos(a), 0.095, 0.012 * math.sin(a)), (0.02 * math.cos(a), 0.118, 0.02 * math.sin(a)), 0.005, 0.002, 4, 'sepal'))
    return wood, br, b

@asset(ground=False)
def a_tool_spear():
    """the long spear of the guards (props.ts: a pomegranate butt, silver for the ordinary guards: B; C form): a tapering
    ash shaft 2.1 m, a bronze socket with a ring and a leaf-shaped blade with a midrib, the pomegranate butt with its crown"""
    w, br, b = spear_common('pom'); return dict(wood=join(w, 'wood'), bronze=join(br, 'bronze'), silver=join(b, 'silver'))
@asset(ground=False)
def a_tool_spear_apple():
    """the spear with an apple of gold at the butt (Herodotus 7.41: B; C form)"""
    w, br, b = spear_common('apple'); return dict(wood=join(w, 'wood'), bronze=join(br, 'bronze'), gold=join(b, 'gold'))
@asset(ground=False)
def a_tool_spear_gpom():
    """the spear with a golden pomegranate at the butt (Herodotus 7.41: B; C form)"""
    w, br, b = spear_common('pom'); return dict(wood=join(w, 'wood'), bronze=join(br, 'bronze'), gold=join(b, 'gold'))

@asset(ground=False)
def a_tool_mallet():
    """a wooden mallet: a barrel head on a handle with a swelling at the grip end (legacy frame: the handle down -Y from the
    grip, the head across x at -0.3 m) (C)"""
    h = pathG([(0, 0.02, 0), (0, -0.14, 0), (0, -0.3, 0)], [0.017, 0.015, 0.014], 7, 'handle')
    k = atG(lathe([(0.0, 0), (0.019, 0), (0.021, 0.012), (0.0, 0.02)], 8, 'knob'), (0, 0.015, 0))
    head = lathe([(0.0, -0.06), (0.043, -0.06), (0.05, -0.045), (0.052, 0.0), (0.05, 0.045), (0.043, 0.06), (0.0, 0.06)], 12, 'head')
    xform(head, (0, 0, -0.3), (0, math.pi / 2, 0))
    return dict(wood=join([h, k], 'wood'), wood_d=head)

@asset(ground=False)
def a_tool_sickle():
    """an iron sickle (the sickle of the ancient Near East: B type; C form): the blade leaving the handle's thumb end and
    curving toward +Y in a flat crescent that narrows to the point, its inner edge toothed; a wooden handle with a pommel"""
    r = 0.13; pts = []
    for i in range(12):
        a = (i / 11) * math.pi * 1.05; pts.append((0, r - r * math.cos(a), 0.07 + r * math.sin(a)))
    blade = pathG(pts, lambda t: 0.013 * (1 - 0.75 * t) + 0.002, 4, 'blade', scale=(1.0, 0.18), up=(1, 0, 0))
    handle = pathG([(0, 0, -0.075), (0, 0.002, 0), (0, 0, 0.075)], [0.017, 0.015, 0.016], 7, 'handle')
    pom = atG(lathe([(0.0, 0), (0.02, 0.002), (0.022, 0.012), (0.0, 0.016)], 8, 'pom'), (0, 0, -0.078))
    alongZ(pom, 0.078)
    return dict(iron=blade, wood=join([handle, pom], 'wood'))

@asset(ground=False)
def a_tool_spindle():
    """a drop spindle hanging on its yarn (spindle whorls of the period: B): the yarn from the hand, the cop of spun wool on
    the shaft, a domed stone whorl low on a tapering wooden shaft (C); the parts below the hand are moved by the yarn's length"""
    yarn = rodG((0, 0, 0), (0, -0.012, 0), 0.0012, 0.0012, 4, 'yarn')
    shaft = pathG([(0, -0.01, 0), (0, -0.16, 0), (0, -0.3, 0)], [0.0035, 0.005, 0.003], 6, 'shaft')
    whorl = atG(lathe([(0.0, -0.006), (0.02, -0.006), (0.025, -0.002), (0.022, 0.004), (0.012, 0.009), (0.0, 0.01)], 12, 'whorl'), (0, -0.245, 0))
    cop = atG(lathe([(0.0, -0.03), (0.006, -0.03), (0.013, -0.018), (0.014, 0.01), (0.009, 0.026), (0.0, 0.03)], 8, 'cop'), (0, -0.07, 0))
    return dict(wood=shaft, stone=whorl, wool=join([cop, yarn], 'wool'))

@asset(ground=False)
def a_tool_distaff():
    """a distaff: a rod with a hank of combed wool bound round its head (C)"""
    rod = pathG([(0, 0, -0.1), (0, 0, 0.12), (0, 0, 0.42)], [0.008, 0.0085, 0.006], 6, 'rod')
    wool = meta([('ELLIPSOID', G((0, 0, 0.33 + 0.02 * k)), 0.05 - 0.004 * abs(k - 2), (1.0, 1.0, 1.1), 2) for k in range(5)], res=0.009, name='wool')
    displace(wool, 0.008, 0.02, seed=51)
    return dict(wood=rod, wool=wool)

@asset(ground=False)
def a_tool_trowel():
    """a small bronze trowel for mud mortar: a leaf blade on a cranked tang, a wooden handle (C)"""
    h = pathG([(0, 0, -0.065), (0, 0, 0.0), (0, 0, 0.06)], [0.013, 0.015, 0.012], 7, 'handle')
    tang = pathG([(0, 0, 0.055), (0, -0.004, 0.075), (0, -0.01, 0.085)], 0.004, 5, 'tang')
    bl = [(0, -0.011, 0.085 + 0.13 * t) for t in [i / 6 for i in range(7)]]
    blade = pathG(bl, lambda t: 0.04 * math.sin(math.pi * (0.25 + 0.75 * t)) ** 0.7 + 0.002, 4, 'blade', scale=(1.0, 0.06), up=(0, 0, 1))
    return dict(wood=h, bronze=join([tang, blade], 'bronze'))

@asset(ground=True)
def a_tool_brick():
    """a sun-dried mud brick 33 x 33 x 11 cm: the arrises worn round, the faces a little uneven, straw ends in them (C)"""
    b = box(0.33, 0.33, 0.11, (0, 0, -0.055), 'brick', bevel=0.012, segs=2)
    subdiv(b, 1); displace(b, 0.004, 0.05, seed=52)
    return dict(mud=b)

@asset(ground=False)
def a_tool_knife():
    """an iron knife: a curved back and straight edge, a bolster and a wooden handle with rivets (C)"""
    h = pathG([(0, 0, -0.06), (0, 0.001, 0), (0, 0, 0.05)], [0.012, 0.014, 0.013], 7, 'handle')
    pts = [(0, -0.004 + 0.012 * t * (1 - t), 0.05 + 0.15 * t) for t in [i / 7 for i in range(8)]]
    blade = pathG(pts, lambda t: 0.015 * (1 - t ** 1.5) + 0.0015, 4, 'blade', scale=(1.0, 0.18), up=(1, 0, 0))
    bol = rodG((0, 0, 0.046), (0, 0, 0.056), 0.014, 0.012, 7, 'bolster')
    return dict(wood_d=h, iron=join([blade, bol], 'iron'))

@asset(ground=False)
def a_tool_cloth():
    """a wet cloth or a hank of wool being washed, twisted between the hands (C)"""
    pts = [(-0.18 + 0.36 * t, 0.012 * math.sin(t * 9), 0.01 * math.cos(t * 7)) for t in [i / 12 for i in range(13)]]
    c = pathG(pts, [0.04, 0.046, 0.04, 0.047, 0.042, 0.048, 0.043, 0.047, 0.04, 0.046, 0.041, 0.045, 0.038], 7, 'cloth', scale=(1.0, 0.72))
    displace(c, 0.006, 0.02, seed=53)
    return dict(cloth=c)

@asset(ground=False)
def a_tool_wisp():
    """a twist of straw for rubbing down an animal: a bundle of stalks bound in the middle (C)"""
    parts = []
    for k in range(9):
        a = TAU * k / 9; r = 0.012 + 0.006 * (k % 2)
        parts.append(pathG([(r * math.cos(a) * 0.6, r * math.sin(a) * 0.6, -0.07), (r * math.cos(a) * 0.4, r * math.sin(a) * 0.4, 0.0), (r * math.cos(a) * 1.6, r * math.sin(a) * 1.6, 0.17)], 0.0035, 3, 'stalk'))
    return dict(straw=join(parts, 'straw'))

@asset(ground=False)
def a_tool_rag():
    """a crumpled polishing rag (C)"""
    r = meta([('ELLIPSOID', (0.008 * k - 0.012, 0.006 * (k % 2), 0.004 * k), 0.028, (1.0, 1.3, 0.75), 2) for k in range(4)], res=0.007, name='rag')
    displace(r, 0.008, 0.015, seed=54); alongZ(r, 0)
    return dict(cloth=r)

@asset(ground=False)
def a_tool_awl():
    """a bone awl: a knuckle-end handle and a polished point (C)"""
    h = meta([('ELLIPSOID', G((0, 0, -0.03)), 0.017, (1.0, 1.0, 2.2), 2), ('ELLIPSOID', G((0, 0, -0.055)), 0.014, (1.3, 1.0, 1.0), 2)], res=0.004, name='h')
    p = pathG([(0, 0, 0.0), (0, 0, 0.06), (0, 0, 0.125)], [0.008, 0.004, 0.0008], 5, 'pt')
    return dict(bone=join([h, p], 'bone'))

@asset(ground=False)
def a_tool_arrow():
    """a reed arrow with a bronze trilobate head and three fletchings (arrowheads by the hundred in the Treasury: B; C form)"""
    shaft = pathG([(0, 0, 0.0), (0, 0, 0.35), (0, 0, 0.7)], [0.0042, 0.0045, 0.004], 5, 'shaft')
    nock = rodG((0, 0, -0.004), (0, 0, 0.012), 0.005, 0.0045, 5, 'nock')
    head = []
    for k in range(3):
        a = TAU * k / 3; head.append(pathG([(0, 0, 0.7), (0.009 * math.cos(a), 0.009 * math.sin(a), 0.715), (0, 0, 0.745)], [0.0015, 0.0012, 0.0003], 3, 'lobe'))
    head.append(rodG((0, 0, 0.695), (0, 0, 0.745), 0.004, 0.0008, 5, 'core'))
    fl = []
    for k in range(3):
        a = TAU * k / 3 + 0.3
        v = [G((0.002 * math.cos(a), 0.002 * math.sin(a), 0.02)), G((0.011 * math.cos(a), 0.011 * math.sin(a), 0.035)), G((0.011 * math.cos(a), 0.011 * math.sin(a), 0.1)), G((0.002 * math.cos(a), 0.002 * math.sin(a), 0.11))]
        import bmesh as _b
        bm = _b.new(); vs = [bm.verts.new(p) for p in v]; bm.faces.new(vs); ob = from_bm(bm, 'vane'); solidify(ob, 0.0006, 0); fl.append(ob)
    return dict(reed=join([shaft, nock], 'reed'), bronze=join(head, 'bronze'), feather=join(fl, 'feather'))

@asset(ground=False)
def a_tool_lead():
    """a lead rope of twisted plant fibre, down from the hand to an animal (C)"""
    return dict(cord=pathG([(0, 0, 0), (0, -0.05, 0.3), (0, -0.1, 0.65)], 0.0075, 6, 'lead'))

@asset(ground=False)
def a_tool_ladle():
    """a wooden ladle: a deep bowl carved with its handle, the handle ending in a hook (C)"""
    h = pathG([(0, 0.012, -0.09), (0, 0, 0.0), (0, 0, 0.2), (0, 0.01, 0.36)], [0.009, 0.011, 0.01, 0.012], 6, 'handle')
    bowl = vessel([(0.0, 0.0), (0.03, 0.004), (0.045, 0.022), (0.048, 0.04)], 0.004, 14, 'bowl', 0.02, seed=55)
    xform(bowl, (0, -0.4, -0.01 + 0.0))
    return dict(wood=join([h, bowl], 'wood'))

@asset(ground=False)
def a_tool_stick():
    """a brushwood stick for the fire: crooked, with a side twig and knots (C)"""
    s = pathG([(0, 0, -0.15), (0.01, 0.004, 0.1), (-0.006, 0.0, 0.3), (0.008, 0.006, 0.55)], [0.013, 0.011, 0.01, 0.007], 5, 'stick')
    t = pathG([(0.004, 0.003, 0.22), (0.05, 0.01, 0.33)], [0.005, 0.003], 4, 'twig')
    return dict(wood_d=join([s, t], 'wood_d'))

@asset(ground=False)
def a_tool_barsom():
    """the barsom: a bundle of thin twigs held upright, tied near the foot (OXUS-PLAQUE: B; C length and form)"""
    tw = []
    for k in range(7):
        a = TAU * k / 7; r = 0.008
        tw.append(pathG([(r * math.cos(a), r * math.sin(a), -0.1), (r * math.cos(a) * 0.8, r * math.sin(a) * 0.8, -0.04), (r * math.cos(a) * 1.8 + 0.002 * k, r * math.sin(a) * 1.8, 0.36 - 0.01 * (k % 3))], 0.0028, 3, 'twig'))
    tie = rodG((0, 0, -0.06), (0, 0, -0.045), 0.011, 0.011, 7, 'tie')
    return dict(wood=join(tw, 'wood'), cord=tie)

@asset(ground=False)
def a_tool_stylus():
    """a reed stylus cut to a wedge at the tip (C)"""
    s = pathG([(0, 0, -0.07), (0, 0, 0.05), (0, 0, 0.075)], [0.0045, 0.004, 0.0012], 4, 'stylus')
    return dict(reed=s)

@asset(ground=False)
def a_tool_hoe():
    """a hoe: an iron blade with a socket eye on a 1.25 m wooden handle (C)"""
    h = pathG([(0, 0, -0.45), (0, 0.003, 0.2), (0, 0, 0.8)], [0.016, 0.017, 0.018], 6, 'handle')
    eye = rodG((0, 0.03, 0.8), (0, -0.04, 0.82), 0.026, 0.024, 7, 'eye')
    bl = pathG([(0, -0.03, 0.81), (0, -0.12, 0.812), (0, -0.2, 0.815)], [0.06, 0.075, 0.085], 4, 'blade', scale=(1.0, 0.09), up=(0, 0, 1))
    return dict(wood=h, iron=join([eye, bl], 'iron'))

@asset(ground=False)
def a_tool_fork():
    """a wooden winnowing fork: a shaft, a crosspiece lashed on, four tines curving up (C)"""
    s = pathG([(0, 0, -0.55), (0, 0.004, 0.3), (0, 0, 1.15)], [0.015, 0.016, 0.017], 6, 'shaft')
    cp = rodG((-0.11, 0, 1.15), (0.11, 0, 1.15), 0.016, 0.016, 6, 'cross', scale=(1.0, 1.6))
    tines = [pathG([(x, 0, 1.15), (x * 1.1, 0.01, 1.3), (x * 1.2, 0.045, 1.48)], [0.008, 0.007, 0.004], 5, 'tine') for x in (-0.09, -0.03, 0.03, 0.09)]
    lash = rodG((0, 0, 1.13), (0, 0, 1.17), 0.021, 0.021, 7, 'lash')
    return dict(wood=s, wood_d=join([cp] + tines, 'wood_d'), cord=lash)

@asset(ground=False)
def a_tool_goad():
    """a goad stick with an iron point (C)"""
    return dict(wood_d=pathG([(0, 0, -0.25), (0.006, 0, 0.5), (0, 0.004, 1.12)], [0.011, 0.009, 0.007], 5, 'goad'), iron=rodG((0, 0.004, 1.11), (0, 0.004, 1.16), 0.006, 0.0008, 4, 'pt'))

@asset(ground=False)
def a_tool_staff():
    """a herder's staff: a natural stick, a little crooked, its top worn smooth (C)"""
    return dict(wood=pathG([(0, 0, -0.12), (0.01, 0.005, 0.4), (-0.006, 0, 1.0), (0.004, 0.006, 1.5)], [0.017, 0.018, 0.017, 0.016], 6, 'staff'))

@asset(ground=False)
def a_tool_broom():
    """a handleless broom: a bundle of twigs bound tight at one end, spreading at the other (C)"""
    tw = []
    for k in range(12):
        a = TAU * k / 12; r0 = 0.02 + 0.006 * (k % 2)
        tw.append(pathG([(r0 * math.cos(a), r0 * math.sin(a), -0.1), (r0 * 0.9 * math.cos(a), r0 * 0.9 * math.sin(a), 0.18), (r0 * 4.2 * math.cos(a), r0 * 3.0 * math.sin(a), 0.56)], [0.004, 0.004, 0.0025], 3, 'tw'))
    bind = rodG((0, 0, 0.1), (0, 0, 0.18), 0.03, 0.031, 8, 'bind')
    return dict(straw=join(tw, 'straw'), cord=bind)

@asset(ground=True)
def a_tool_mould():
    """a wooden brick mould: an open frame of four boards pegged at the corners, a handle at each end (for 33 cm bricks: C;
    the brick mould attested in Babylonia: B)"""
    w, h, t = 0.36, 0.11, 0.022; parts = []
    for s in (-1, 1):
        parts.append(box(t, w + 0.02, h, (s * (w / 2 - t / 2), 0, 0), bevel=0.003))
        parts.append(box(w, t, h, (0, s * (w / 2 - t / 2), 0), bevel=0.003))
        parts.append(pathG([(s * (w / 2 + 0.01), h * 0.7, -0.02), (s * (w / 2 + 0.07), h * 0.72, 0.0), (s * (w / 2 + 0.01), h * 0.7, 0.02)], 0.011, 6, 'handle'))
    return dict(wood=join(parts, 'wood'))

@asset(ground=False)
def a_tool_rope():
    """a hauling rope of plant fibre (the path the rope props.ts gives it), three-strand laid (C)"""
    pts = [(0, -0.55, -0.62), (0, -0.1, -0.42), (0, 0, -0.26), (0, 0, 0.3), (0, -0.06, 1.5), (0, -0.22, 3), (0, -0.5, 4.6)]
    fine = []
    for i in range(len(pts) - 1):
        for k in range(4): t = k / 4; fine.append(tuple(pts[i][j] + (pts[i + 1][j] - pts[i][j]) * t for j in range(3)))
    fine.append(pts[-1])
    return dict(cord=pathG(fine, lambda t: 0.013 * (1 + 0.08 * math.sin(t * 900)), 6, 'rope', caps=True))

@asset(ground=False)
def a_tool_adze():
    """a carpenter's adze: an iron blade across the haft's end, lashed to a crooked haft (C)"""
    h = pathG([(0, 0, -0.08), (0, 0.004, 0.2), (0, 0, 0.46)], [0.015, 0.016, 0.018], 6, 'haft')
    bl = pathG([(0, 0.035, 0.44), (0, -0.025, 0.46), (0, -0.085, 0.47)], [0.018, 0.024, 0.028], 4, 'blade', scale=(1.0, 0.12), up=(0, 0, 1))
    lash = rodG((0, 0, 0.42), (0, 0, 0.46), 0.02, 0.021, 7, 'lash')
    return dict(wood=h, iron=bl, cord=lash)

def bow_limbs(half, th, recurve=1.0):
    P = lambda u: (0, half * u, (0.06 * abs(u) ** 2 - 0.1 * abs(u) + (0.35 * (abs(u) - 0.8) if abs(u) > 0.8 else 0)) * recurve)
    us = [i / 10 for i in range(-10, 11)]
    limb = pathG([P(u) for u in us], lambda t: (0.016 - 0.009 * abs(2 * t - 1)) * th + 0.0015, 6, 'limb', scale=(1.0, 0.7), up=(0, 1, 0))
    grip = rodG(P(-0.1), P(0.1), 0.019 * th, 0.019 * th, 7, 'grip')
    return limb, grip, P

@asset(ground=False)
def a_tool_bow():
    """the composite bow, recurved (the guards' bows of the reliefs and the Susa bricks: B; C form): limbs of horn, wood
    and sinew tapering to stiff recurved ears, a leather-wrapped grip; the string is the builder's (drawn back per frame)"""
    limb, grip, P = bow_limbs(0.52, 1.0)
    return dict(wood=limb, leather=grip)
@asset(ground=False)
def a_tool_toy_bow():
    """a boy's small bow of the recurved form, 0.6 m (C)"""
    limb, grip, P = bow_limbs(0.3, 0.6)
    return dict(wood=limb, leather=grip)

@asset(ground=False)
def a_tool_beater():
    """a wooden weaving sword: a long flat blade thinning to one edge, rounded ends (C)"""
    b = box(0.62, 0.06, 0.012, (0, 0, -0.006), 'b', bevel=0.004)
    for v in b.data.vertices:
        if v.co.y < 0: v.co.z *= 0.35
        v.co.y *= 1 - 0.15 * (abs(v.co.x) / 0.31) ** 4
    return dict(wood=b)

@asset(ground=False)
def a_tool_paddle():
    """a wooden stirring paddle for the mash: a pole and a broad blade (C)"""
    s = pathG([(0, 0, -0.55), (0, 0.003, 0.2), (0, 0, 0.9)], [0.017, 0.017, 0.018], 6, 'pole')
    bl = pathG([(0, 0, 0.88), (0, 0, 1.0), (0, 0, 1.13)], [0.035, 0.06, 0.055], 6, 'blade', scale=(1.0, 0.16), up=(0, 0, 1))
    return dict(wood=s, wood_d=bl)

@asset(ground=False)
def a_tool_sceptre():
    """the king's long staff, gilded, with a knob (door-jamb and audience reliefs: B; C form)"""
    s = pathG([(0, 0, -0.75), (0, 0, 0.9)], [0.013, 0.012], 8, 'staff')
    knob = alongZ(lathe([(0.0, 0), (0.016, 0.004), (0.03, 0.025), (0.028, 0.045), (0.012, 0.06), (0.0, 0.062)], 12, 'knob'), 0.885)
    ferrule = rodG((0, 0, -0.76), (0, 0, -0.72), 0.015, 0.014, 8, 'ferrule')
    return dict(gold=join([s, knob, ferrule], 'gold'))

@asset(ground=False)
def a_tool_parasol():
    """the parasol held over the king (HADISH-JAMB: B): a 2 m pole, ribs under a cloth canopy 1.2 m across with a fringed
    edge, a finial (C)"""
    pole = pathG([(0, 0, -0.3), (0, 0, 1.78)], [0.016, 0.014], 7, 'pole')
    can = lathe([(0.0, 0.2), (0.08, 0.18), (0.3, 0.11), (0.52, 0.035), (0.6, 0.0), (0.59, -0.005), (0.3, 0.1), (0.0, 0.19)], 16, 'can')
    alongZ(can, 1.56)
    ribs = [pathG([(0, 0, 1.63), (0.55 * math.cos(TAU * k / 12), 0.55 * math.sin(TAU * k / 12), 1.57)], 0.004, 3, 'rib') for k in range(12)]
    fringe = alongZ(lathe([(0.6, 0.0), (0.605, -0.07), (0.59, -0.07), (0.585, 0.0)], 24, 'fr'), 1.56)
    fin = alongZ(lathe([(0.0, 0), (0.02, 0.01), (0.012, 0.05), (0.0, 0.06)], 8, 'fin'), 1.76)
    return dict(wood=pole, cloth=can, gold=join(ribs + [fin], 'gold'), band=fringe)

@asset(ground=False)
def a_tool_lotus():
    """a lotus flower on its stem in the king's left hand (the reliefs: B; C form): a stem, a calyx and a cup of petals"""
    stem = pathG([(0, 0, -0.04), (0.004, 0, 0.1), (0, 0, 0.2)], 0.004, 4, 'stem')
    pet = []
    for k in range(7):
        a = TAU * k / 7
        pet.append(pathG([(0, 0, 0.2), (0.012 * math.cos(a), 0.012 * math.sin(a), 0.225), (0.022 * math.cos(a), 0.022 * math.sin(a), 0.27)], [0.004, 0.009, 0.002], 4, 'p', scale=(1.0, 0.3), up=(math.cos(a), math.sin(a), 0)))
    return dict(green=stem, petal=join(pet, 'petal'))

@asset(ground=False)
def a_tool_whisk():
    """the fly-whisk (door-jamb reliefs: B): a gilded handle and a long horsehair tuft falling from it (C)"""
    h = pathG([(0, 0, -0.08), (0, 0, 0.26)], [0.012, 0.011], 7, 'h')
    cap = alongZ(lathe([(0.0, 0), (0.016, 0.0), (0.02, 0.02), (0.014, 0.03), (0.0, 0.03)], 8, 'c'), 0.25)
    hairs = [pathG([(0.004 * math.cos(TAU * k / 9), 0.004 * math.sin(TAU * k / 9), 0.27), (0.02 * math.cos(TAU * k / 9), 0.02 * math.sin(TAU * k / 9), 0.45), (0.04 * math.cos(TAU * k / 9), 0.035 * math.sin(TAU * k / 9) - 0.01, 0.62)], [0.006, 0.006, 0.003], 3, 'hr') for k in range(9)]
    return dict(gold=join([h, cap], 'gold'), hair=join(hairs, 'hair'))

@asset(ground=False)
def a_tool_towel():
    """the folded linen towel over the hand (door-jamb reliefs: B; C form)"""
    t = box(0.08, 0.34, 0.02, (0, 0, -0.01), 't', bevel=0.006, segs=2)
    xform(t, (0, 0.12, 0))
    for v in t.data.vertices: v.co.z += 0.02 * math.sin(v.co.y * 18)
    return dict(linen=t)

@asset(ground=False)
def a_tool_ball():
    """a child's stitched leather ball, 10 cm (C)"""
    b = lathe([(0.0, -0.05)] + [(0.05 * math.sin(math.pi * k / 8), -0.05 * math.cos(math.pi * k / 8)) for k in range(1, 8)] + [(0.0, 0.05)], 10, 'ball')
    displace(b, 0.002, 0.02, seed=56)
    return dict(leather=b)

@asset(ground=False)
def a_tool_rattle():
    """a hollow fired-clay rattle with a stub handle (C)"""
    body = alongZ(lathe([(0.0, 0.0), (0.02, 0.005), (0.034, 0.03), (0.032, 0.05), (0.018, 0.068), (0.0, 0.072)], 10, 'b'), 0.065)
    h = pathG([(0, 0, -0.03), (0, 0, 0.07)], [0.011, 0.014], 6, 'h')
    return dict(clay=join([body, h], 'clay'))

@asset(ground=False)
def a_tool_hammer():
    """a smith's hammer: an iron head with a flat face and a peen, wedged on a wooden haft (C)"""
    h = pathG([(0, 0, -0.06), (0, 0.002, 0.12), (0, 0, 0.3)], [0.013, 0.014, 0.016], 6, 'haft')
    head = pathG([(0, 0.05, 0.29), (0, 0.0, 0.29), (0, -0.07, 0.29)], [0.02, 0.022, 0.012], 6, 'head', scale=(1.0, 1.15), up=(1, 0, 0))
    return dict(wood=h, iron=head)

@asset(ground=False)
def a_tool_tongs():
    """a smith's iron tongs holding a bar at a red heat (C)"""
    arms = []
    for s in (-1, 1):
        arms.append(pathG([(0, 0.008 * s, -0.08), (0, 0.012 * s, 0.34), (0, 0.004 * s, 0.44)], [0.007, 0.006, 0.005], 5, 'arm'))
    piv = rodG((-0.012, 0, 0.34), (0.012, 0, 0.34), 0.008, 0.008, 6, 'pivot')
    bar = box(0.018, 0.16, 0.018, G((0, -0.009, 0.5)), 'bar', bevel=0.002)
    return dict(iron=join(arms + [piv], 'iron'), hot=bar)

@asset(ground=False)
def a_tool_hammer_s():
    """a goldsmith's small hammer (C)"""
    h = pathG([(0, 0, -0.04), (0, 0, 0.18)], [0.008, 0.009], 6, 'h')
    head = pathG([(0, 0.02, 0.18), (0, 0.0, 0.18), (0, -0.04, 0.18)], [0.01, 0.011, 0.006], 6, 'hd', up=(1, 0, 0))
    return dict(wood=h, bronze=head)

@asset(ground=False)
def a_tool_punch():
    """a bronze chasing punch (C)"""
    return dict(bronze=pathG([(0, 0, -0.04), (0, 0, 0.05), (0, 0, 0.07)], [0.0055, 0.0045, 0.002], 6, 'p'))

@asset(ground=False)
def a_tool_balance():
    """a hand balance: a bronze beam on a cord with knobbed ends, two pans on three cords each (B by analogy; C form); the
    pans rock with the builder's parameter"""
    cord = [rodG((0, 0, 0), (0, -0.1, 0), 0.0018, 0.0018, 4, 'c')]
    beam = [pathG([(-0.165, -0.1, 0), (0, -0.098, 0), (0.165, -0.1, 0)], [0.004, 0.005, 0.004], 6, 'beam')]
    for s in (-1, 1): beam.append(atG(lathe([(0.0, -0.006), (0.007, -0.004), (0.007, 0.004), (0.0, 0.006)], 6, 'k'), (0.168 * s, -0.1, 0)))
    pans = []
    for s in (-1, 1):
        for k in range(3):
            a = TAU * k / 3; cord.append(rodG((0.16 * s, -0.1, 0), (0.16 * s + 0.045 * math.cos(a), -0.265, 0.045 * math.sin(a)), 0.0012, 0.0012, 3, 'pc'))
        pans.append(atG(vessel([(0.0, 0.0), (0.03, 0.002), (0.052, 0.014), (0.058, 0.02)], 0.002, 14, 'pan', 0.0), (0.16 * s, -0.285, 0)))
    return dict(cord=join(cord, 'cord'), bronze=join(beam + pans, 'bronze'))

@asset(ground=False)
def a_tool_seal_cyl():
    """a stone cylinder seal, 3 cm, bored through, its surface cut in intaglio (the rolling's figures not modelled; C)"""
    s = lathe([(0.0035, -0.016), (0.009, -0.016), (0.0092, -0.012), (0.0092, 0.012), (0.009, 0.016), (0.0035, 0.016), (0.0035, -0.016)], 10, 's')
    xform(s, (0, 0, 0), (0, math.pi / 2, 0))
    return dict(stone=s)

@asset(ground=False)
def a_tool_drill_bow():
    """the seal cutter's bow for the drill: a bent stick and its thong (B by analogy; C)"""
    y = lambda a: 0.05 * math.sin(math.pi * a)
    stick = pathG([(0, y(i / 8), i / 8 * 0.46 - 0.02) for i in range(9)], [0.009, 0.008, 0.008, 0.008, 0.007, 0.007, 0.007, 0.006, 0.006], 5, 'stick')
    thong = rodG((0, 0, -0.02), (0, 0, 0.44), 0.002, 0.002, 3, 'thong')
    return dict(wood_d=stick, leather=thong)

@asset(ground=False)
def a_tool_scraper():
    """a tanner's two-handled scraper: a curved iron blade between two wooden handles (C)"""
    bl = pathG([(-0.13, -0.03, 0.03), (0, -0.03, 0.04), (0.13, -0.03, 0.03)], 0.025, 4, 'bl', scale=(0.12, 1.0), up=(0, 0, 1))
    hs = [pathG([(0.15 * s, -0.05, 0.02), (0.15 * s, 0.0, 0.01), (0.15 * s, 0.06, 0.0)], [0.013, 0.015, 0.014], 6, 'h') for s in (-1, 1)]
    return dict(iron=bl, wood=join(hs, 'wood'))

@asset(ground=False)
def a_tool_pestle():
    """a long wooden pestle, waisted for the hands, its pounding end broad and worn (C)"""
    return dict(wood=pathG([(0, 0, -0.62), (0, 0, -0.2), (0, 0, 0.2), (0, 0, 0.5), (0, 0, 0.6), (0, 0, 0.66)], [0.034, 0.028, 0.028, 0.034, 0.043, 0.04], 8, 'p'))

@asset(ground=False)
def a_tool_pen():
    """a reed pen for ink, its tip cut and inked (C)"""
    return dict(reed=pathG([(0, 0, -0.1), (0, 0, 0.07)], [0.0035, 0.003], 5, 'p'), ink=rodG((0, 0, 0.07), (0, 0, 0.085), 0.003, 0.0008, 5, 'ink'))

@asset(ground=False)
def a_tool_plectrum():
    """a plectrum stick (C)"""
    return dict(bone=pathG([(0, 0, -0.03), (0, 0, 0.1), (0, 0, 0.13)], [0.005, 0.004, 0.002], 5, 'p', scale=(1.0, 0.6)))

# ======================================================================================================== work objects (people/workObjects.ts)
# In the performer's frame (origin on the ground, +Z the performer's forward), at the procedural forms' sizes and places.
# Parts are named for what they are (workObjects.ts WORK_PAINT colours them): mud, mud_wet, brick, straw, straw_d, ears, wood,
# wood_d, stone, lime, pot, wool, hide, iron, meat, fat, earth, linen, cord, red, blue, warp, ash, ember, grape, nut, fish,
# thorn, grass, bone, silver, skin, liquor, stain, water, milk, green, clay_toy, lapis
def boxG(w, h, d, x=0, y=0, z=0, bevel=0.0, name='box', yaw=0.0, orbit=0.0):
    """the procedural box(w, h, d, x, y, z) (base at y); `yaw` turns it about its own centre, `orbit` about the origin after
    it is placed (three's translate-then-rotateY)"""
    b = box(w, d, h, (0, 0, 0), name, bevel=bevel, segs=2 if bevel else 1)
    if yaw: xform(b, (0, 0, 0), (0, 0, yaw))
    q = G((x, y, z)); xform(b, (q.x, q.y, q.z))
    if orbit: xform(b, (0, 0, 0), (0, 0, orbit))
    return b
def log(a, b, r0, r1=None, seg=8, name='log', seed=0, bark=0.004):
    """a round timber or pole with its bark: a slightly crooked sweep, displaced"""
    A, B = Vector(a), Vector(b); pts = []
    rnd = random.Random(seed)
    for i in range(6):
        t = i / 5; p = A.lerp(B, t); off = 0.0 if i in (0, 5) else (A - B).length * 0.01
        pts.append((p.x + rnd.uniform(-off, off), p.y + rnd.uniform(-off, off) * 0.5, p.z + rnd.uniform(-off, off)))
    ob = pathG(pts, [r0 + ((r0 if r1 is None else r1) - r0) * t for t in [i / 5 for i in range(6)]], seg, name)
    if bark: subdiv(ob, 1); displace(ob, bark, 0.03, seed=seed + 300)
    return ob
def heap(r, h, x=0, z=0, seed=0, lump=0.2, name='heap', res=None, flat=0.0):
    """a heap (earth, mud, grain, straw, dung): metaball lumps, displaced; its base flat on the ground"""
    rnd = random.Random(seed); e = [('ELLIPSOID', (0, 0, h * 0.35), r * 0.8, (1.0, 1.0, h / r * 0.9 + 0.1), 2)]
    for k in range(5):
        a = rnd.uniform(0, TAU); d = rnd.uniform(0.2, 0.6) * r
        e.append(('ELLIPSOID', (d * math.cos(a), d * math.sin(a), h * rnd.uniform(0.1, 0.3)), r * rnd.uniform(0.35, 0.55), (1.0, 1.0, h / r * 0.8 + 0.1), 2))
    ob = meta(e, res=res or max(0.01, r / 7), name=name)
    displace(ob, r * lump * 0.25, r * 0.5, seed=seed + 400)
    for v in ob.data.vertices: v.co.z = max(0.0, v.co.z)
    # the metaballs' surface lies inside their radii: scaled to the heap's footprint (2r across) and height h
    xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]; zs = [v.co.z for v in ob.data.vertices]
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2; kx = 2 * r / max(1e-6, max(xs) - min(xs)); ky = 2 * r / max(1e-6, max(ys) - min(ys)); kz = h / max(1e-6, max(zs))
    for v in ob.data.vertices: v.co.x = (v.co.x - cx) * kx; v.co.y = (v.co.y - cy) * ky; v.co.z *= kz
    q = G((x, 0, z)); return xform(ob, (q.x, q.y, 0))
def brick_piece(seed, w=0.33, h=0.105, d=0.33):
    b = box(w, d, h, (0, 0, 0), 'brick', bevel=0.01, segs=1); displace(b, 0.004, 0.06, seed=seed); return b
def sheaf(L=0.9, seed=0):
    """a sheaf of cut barley along +Y (game) from its butt: the stalks narrowing to the band, the ears flaring beyond it
    (C): a fluted lathe, the ears roughened"""
    prof = [(0.0, 0.0), (0.075, 0.01), (0.07, 0.25 * L), (0.05, 0.45 * L), (0.058, 0.52 * L), (0.1, 0.66 * L), (0.12, 0.8 * L), (0.1, 0.9 * L), (0.06, 0.97 * L), (0.0, L)]
    s = lathe(prof, 14, 'sheaf', wobble=0.05, seed=seed)
    for v in s.data.vertices:
        a = math.atan2(v.co.y, v.co.x); k = 1 + 0.08 * math.sin(a * 14 + v.co.z * 30)
        v.co.x *= k; v.co.y *= k
    stalks = copy(s, 'stalks'); ears = s
    # split by height: below the band stalks, above it ears (by deleting faces)
    import bmesh as _b
    for ob, keep in ((stalks, lambda z: z < 0.53 * L), (ears, lambda z: z >= 0.5 * L)):
        bm = _b.new(); bm.from_mesh(ob.data)
        dels = [f for f in bm.faces if not keep(sum(v.co.z for v in f.verts) / len(f.verts))]
        _b.ops.delete(bm, geom=dels, context='FACES'); bm.to_mesh(ob.data); bm.free()
    displace(ears, 0.01, 0.02, seed=seed + 7)
    band = sweep([(0.058 * math.cos(a), 0.058 * math.sin(a), 0.52 * L) for a in [TAU * i / 12 for i in range(13)]], 0.008, 4, 'band', caps=False)
    return stalks, ears, band
def to_game_y(ob):
    """an object built along Blender z (up) is already along the game's +Y"""
    return ob
def lying_along_x(ob):
    """an object built along Blender z turned to lie along the game's +X (butt at the origin)"""
    return xform(ob, (0, 0, 0), (0, math.pi / 2, 0))
def wheel_disc(R, t, name='wheel'):
    """a solid wheel of three boards with two battens across and a hub (Near Eastern tripartite wheel: B type; C), axis x"""
    parts = []
    for i, (y0, y1) in enumerate(((-R, -R / 3), (-R / 3, R / 3), (R / 3, R))):
        pts = []
        prof = []
        # a board: the part of the disc between y0 and y1, extruded along x by t
        bm_pts = []
        for k in range(17):
            yy = y0 + (y1 - y0) * k / 16; zz = math.sqrt(max(0.0, R * R - yy * yy)); bm_pts.append((yy, zz))
        import bmesh as _b
        bm = _b.new(); top = [bm.verts.new((-t / 2, yy, zz)) for yy, zz in bm_pts] + [bm.verts.new((-t / 2, yy, -zz)) for yy, zz in reversed(bm_pts)]
        bot = [bm.verts.new((t / 2, v.co.y, v.co.z)) for v in top]
        n = len(top); f1 = bm.faces.new(top); f2 = bm.faces.new(list(reversed(bot)))
        for k in range(n): bm.faces.new((top[k], top[(k + 1) % n], bot[(k + 1) % n], bot[k]))
        _b.ops.triangulate(bm, faces=[f1, f2]); _b.ops.recalc_face_normals(bm, faces=bm.faces)
        ob = from_bm(bm, 'board', smooth=False); sharp(ob, 30)
        for v in ob.data.vertices: v.co.y *= 0.985 if abs(v.co.y) > 0.01 else 1
        parts.append(ob)
    for s in (-1, 1):
        parts.append(box(0.025, R * 1.6, 0.06, (s * (t / 2 + 0.012), 0, -0.03 + s * R * 0.45), bevel=0.004))
    hub = lathe([(0.0, -t / 2 - 0.06), (R * 0.2, -t / 2 - 0.05), (R * 0.22, -t / 2), (R * 0.22, t / 2), (R * 0.2, t / 2 + 0.05), (0.0, t / 2 + 0.06)], 12, 'hub')
    xform(hub, (0, 0, 0), (0, math.pi / 2, 0)); parts.append(hub)
    return join(parts, name)
def wheel_spoked(R, n=8, name='wheel'):
    """a spoked chariot wheel: felloe, n spokes, a long hub (the Apadana chariots: B; C), axis x"""
    fel = sweep([(0, (R - 0.03) * math.cos(a), (R - 0.03) * math.sin(a)) for a in [TAU * i / 32 for i in range(33)]], 0.035, 6, 'felloe', caps=False, scale=(1.0, 0.8))
    parts = [fel]
    for k in range(n):
        a = TAU * k / n; parts.append(sweep([(0, 0.06 * math.cos(a), 0.06 * math.sin(a)), (0, (R - 0.06) * math.cos(a), (R - 0.06) * math.sin(a))], [0.016, 0.012], 5, 'spoke'))
    hub = lathe([(0.0, -0.16), (0.05, -0.15), (0.07, -0.05), (0.075, 0.0), (0.07, 0.05), (0.05, 0.15), (0.0, 0.16)], 12, 'hub'); xform(hub, (0, 0, 0), (0, math.pi / 2, 0)); parts.append(hub)
    return join(parts, name)

def woW(fn):
    """register a work object's model: wo_<kind>"""
    return asset(ground=True, lod1=0.4)(fn)

@woW
def a_wo_drum_sledge():
    """a column drum on a wooden sledge, hauled with ropes (drums dressed on the Terrace: B; sledge C): the drum with its
    point-dressed face, two runners with upturned fronts, three crosspieces pegged on, the rope forward"""
    drum = lathe([(0.0, 0.0), (0.62, 0.0), (0.625, 0.05), (0.62, 0.85), (0.61, 0.9), (0.0, 0.9)], 32, 'drum', wobble=0.008, seed=61)
    displace(drum, 0.006, 0.05, seed=62); atG(drum, (0, 0.27, 0))
    runners = []
    for x in (-0.45, 0.45):
        runners.append(pathG([(x, 0.07, -0.95), (x, 0.07, 0.7), (x, 0.1, 0.88), (x, 0.17, 0.97)], 0.075, 4, 'runner', scale=(1.0, 1.0)))
    cross = [boxG(1.1, 0.12, 0.2, 0, 0.14, z, bevel=0.01) for z in (-0.7, 0, 0.7)]
    rope = pathG([(0, 0.2, -0.95), (0, 0.28, -1.3), (0, 0.35, -1.6)], 0.018, 6, 'rope')
    return dict(lime=drum, wood_d=join(runners, 'wood_d'), wood=join(cross, 'wood'), cord=rope)

@woW
def a_wo_brick_stack():
    """a stack of sun-dried mud bricks, five courses of four, each brick its own (C)"""
    b = []
    for l in range(5):
        for i in range(2):
            for j in range(2):
                p = brick_piece(70 + l * 4 + i * 2 + j); q = G(((i - 0.5) * 0.35 + (l % 2) * 0.02, l * 0.11, (j - 0.5) * 0.35))
                b.append(xform(p, (q.x, q.y, q.z), (0, 0, 0.03 * math.sin(l * 3 + i + j))))
    return dict(brick=join(b, 'brick'))

@woW
def a_wo_mud_heap():
    """mud tempered with straw for the moulds (C): a wet heap with straw ends in it"""
    h = heap(0.4, 0.2, seed=71, lump=0.35, name='mud')
    st = [pathG([(0.15 * math.cos(k * 1.7), 0.12 + 0.03 * math.sin(k), 0.15 * math.sin(k * 1.7)), (0.15 * math.cos(k * 1.7) + 0.1 * math.cos(k), 0.14, 0.15 * math.sin(k * 1.7) + 0.1 * math.sin(k))], 0.003, 3, 'st') for k in range(8)]
    return dict(mud_wet=h, straw=join(st, 'straw'))

@woW
def a_wo_brick_field():
    """moulded bricks drying in rows on the ground, the newest still dark (C)"""
    wet, dry = [], []
    for r in range(3):
        for c in range(5):
            p = brick_piece(80 + r * 5 + c, h=0.1); q = G((c * 0.4 - 0.8, 0, r * 0.4 - 0.4)); xform(p, (q.x, q.y, q.z), (0, 0, 0.04 * math.sin(r * 5 + c)))
            (wet if (r == 0 and c < 2) else dry).append(p)
    return dict(mud=join(wet, 'mud'), brick=join(dry, 'brick'))

@woW
def a_wo_mortar_tub():
    """a basket tub of mud mortar: a coiled-basket tub with a rim, the mortar inside (C)"""
    tub = vessel([(0.2, 0.0), (0.22, 0.05), (0.25, 0.15), (0.26, 0.2)], 0.012, 20, 'tub', 0.02, seed=81)
    for v in tub.data.vertices: k = 1 + 0.012 * math.sin(v.co.z * 180); v.co.x *= k; v.co.y *= k
    mud = lathe([(0.0, 0.17), (0.24, 0.165), (0.25, 0.155)], 16, 'mud'); displace(mud, 0.01, 0.06, seed=82)
    return dict(wicker=tub, mud_wet=mud)

@woW
def a_wo_brick_course():
    """the course being laid: bricks in a bed of mud mortar (C)"""
    bed = boxG(1.5, 0.014, 0.36, 0, 0, 0, bevel=0.005); displace(bed, 0.003, 0.05, seed=83)
    br = []; mud = []
    for i in range(4):
        p = brick_piece(84 + i); q = G((i * 0.345 - 0.52, 0.012, 0)); xform(p, (q.x, q.y, q.z), (0, 0, 0.02 * math.sin(i)))
        (mud if i == 3 else br).append(p)
    return dict(mud_wet=bed, brick=join(br, 'brick'), mud=join(mud, 'mud'))

@woW
def a_wo_beam():
    """a squared timber on two stone blocks, being dressed with the adze, chips on the ground (C)"""
    bm = boxG(3.0, 0.24, 0.26, 0, 0.32, 0, bevel=0.012); subdiv(bm, 1); displace(bm, 0.004, 0.08, seed=91)
    stones = [xform(stone_lump(0.19, 92 + k, flat=0.9), (x, 0, 0)) for k, x in enumerate((-1.1, 1.1))]
    chips = [boxG(0.05, 0.012, 0.03, 0.4 * math.sin(i * 12.9) - 0.1, 0, 0.35 + 0.25 * math.sin(i * 4.1), orbit=math.sin(i * 3.3) * 3) for i in range(8)]
    return dict(wood=bm, stone=join(stones, 'stone'), chips=join(chips, 'chips'))

@woW
def a_wo_loom():
    """the horizontal ground loom (the ground loom chosen over the warp-weighted loom: D-142, Q-190; C): the front beam and the
    back beam pegged to the ground, the warp threads running between, the woven cloth at the front with its stripes, the
    heddle rod resting on two stones, the shed stick"""
    wood = []; wd = []
    for z in (-0.8, 1.9):
        wood.append(log((-0.55, 0.06, z), (0.55, 0.06, z), 0.032, 0.03, 8, 'beam', seed=int(z * 10) + 100))
        for x in (-0.58, 0.58): wd.append(pathG([(x, -0.03, z + (0.12 if z > 0 else -0.12)), (x, 0.13, z)], [0.02, 0.016], 5, 'peg'))
    cloth = boxG(0.9, 0.004, 0.8, 0, 0.03, -0.4); subdiv(cloth, 1); displace(cloth, 0.002, 0.05, seed=101)
    blue = [boxG(0.9, 0.005, 0.03, 0, 0.0315, -0.7 + i * 0.18) for i in range(4)]
    warp = []
    for i in range(44):
        x = -0.43 + 0.86 * i / 43; warp.append(pathG([(x, 0.034, 0.0), (x, 0.05, 0.9), (x, 0.06, 1.88)], 0.0014, 3, 'w', caps=False))
    wood.append(log((-0.55, 0.22, 0.28), (0.55, 0.22, 0.28), 0.014, 0.013, 6, 'heddle', seed=102, bark=0))
    st = [xform(stone_lump(0.08, 103 + k, flat=1.2), G((x, 0, 0.28))) for k, x in enumerate((-0.52, 0.52))]
    wd.append(boxG(1.0, 0.035, 0.07, 0, 0.065, 0.62, bevel=0.006))
    return dict(wood=join(wood, 'wood'), wood_d=join(wd, 'wood_d'), red=cloth, blue=join(blue, 'blue'), warp=join(warp, 'warp'), stone=join(st, 'stone'))

@woW
def a_wo_dung_cakes():
    """dung cakes set out to dry for fuel: flattened patties, each with the hand's print (C)"""
    c = []
    for i in range(7):
        p = heap(0.1, 0.035, (i % 4) * 0.26 - 0.3, math.floor(i / 4) * 0.26, seed=110 + i, lump=0.4, name='cake', res=0.012)
        c.append(p)
    return dict(dung=join(c, 'dung'))

@woW
def a_wo_fodder():
    """a heap of fodder, straw and dry herbage (C)"""
    h = heap(0.34, 0.16, seed=120, lump=0.5, name='fodder')
    st = [pathG([(0.25 * math.cos(k), 0.05, 0.25 * math.sin(k)), (0.4 * math.cos(k + 0.2), 0.02, 0.4 * math.sin(k + 0.2))], 0.003, 3, 's') for k in range(10)]
    return dict(straw_d=join([h] + st, 'straw_d'))

@woW
def a_wo_fleece():
    """a shorn fleece lying in a heap: the wool in locks (C)"""
    f = heap(0.26, 0.12, seed=130, lump=0.8, name='f'); f2 = heap(0.16, 0.08, 0.22, 0.12, seed=131, lump=0.8, name='f2')
    return dict(wool=f, wool_d=f2)

def hide_sheet(w, d, seed, name='hide'):
    """an animal's hide lying flat: the outline with the legs and the neck, the edges a little curled (C)"""
    rnd = random.Random(seed); n = 28; pts = []
    for i in range(n):
        a = TAU * i / n; r = 1.0 + 0.25 * max(0, math.cos(4 * a)) ** 3 + 0.06 * rnd.uniform(-1, 1)
        pts.append((w / 2 * r * math.cos(a), d / 2 * r * math.sin(a)))
    import bmesh as _b
    bm = _b.new(); vs = [bm.verts.new((x, y, 0.004 + 0.01 * (abs(x) / w + abs(y) / d) ** 2)) for x, y in pts]; f = bm.faces.new(vs)
    _b.ops.triangulate(bm, faces=[f]); ob = from_bm(bm, name); solidify(ob, 0.006, 1); return ob

@woW
def a_wo_butchery():
    """a hide spread on the ground with the joints of a divided carcass (PF 58-60: B; shown without spectacle, C)"""
    h = hide_sheet(1.05, 0.72, 140); xform(h, (0, 0, 0), (0, 0, 0.1))
    meat = []; bone = []
    for (x, z, r, l, a) in ((-0.25, 0.1, 0.07, 0.17, 0.4), (0.02, -0.1, 0.06, 0.15, -0.3), (0.28, 0.12, 0.08, 0.2, 1.2), (0.05, 0.2, 0.05, 0.1, 2)):
        m = meta([('ELLIPSOID', (0, 0, r * 0.6), r, (l / r, 1.0, 0.7), 2), ('ELLIPSOID', (l * 0.4, 0, r * 0.5), r * 0.7, (1.2, 0.9, 0.7), 2)], res=r / 5, name='j')
        displace(m, r * 0.08, r * 0.8, seed=int(x * 100) + 150)
        q = G((x, 0.01, z)); meat.append(xform(m, (q.x, q.y, q.z), (0, 0, a)))
        b = pathG([(x + math.sin(a) * l * 0.8, r * 0.5, z + math.cos(a) * l * 0.8), (x + math.sin(a) * l * 1.15, r * 0.5, z + math.cos(a) * l * 1.15)], [r * 0.3, r * 0.4], 6, 'bone')
        bone.append(b)
    return dict(hide=h, meat=join(meat, 'meat'), fat=join(bone, 'fat'))

@woW
def a_wo_hides():
    """folded hides stacked for the Treasury (PF 58-60: A; stack C)"""
    hs = []; hs2 = []
    for i in range(4):
        h = hide_sheet(0.62, 0.46, 160 + i); q = G((0.02 * math.sin(i * 3), i * 0.036, 0.02 * math.sin(i * 5)))
        xform(h, (q.x, q.y, q.z), (0, 0, 0.15 * math.sin(i * 7)))
        (hs if i % 2 else hs2).append(h)
    return dict(hide=join(hs, 'hide'), hide_d=join(hs2, 'hide_d'))

def contents_heap(r, h, y0, seed, name):
    return xform(heap(r, h, seed=seed, lump=0.3, name=name), G((0, y0, 0)))
@woW
def a_wo_meat():
    """the meat in a basket (C): joints heaped"""
    return dict(meat=contents_heap(0.17, 0.08, 0.1, 170, 'meat'))
@woW
def a_wo_grapes():
    """grapes or figs heaped in a basket (C): clusters of berries"""
    b = []; rnd = random.Random(171)
    for k in range(60):
        a = rnd.uniform(0, TAU); d = rnd.uniform(0, 0.16); y = 0.12 + 0.08 * (1 - d / 0.16) * rnd.uniform(0.5, 1.0)
        b.append(xform(lathe([(0.0, -0.011), (0.009, -0.008), (0.011, 0.0), (0.009, 0.008), (0.0, 0.011)], 6, 'g'), G((d * math.cos(a), y, d * math.sin(a)))))
    return dict(grape=join(b, 'grape'))
@woW
def a_wo_nuts():
    """wild pistachios and almonds in their husks heaped in a basket (C)"""
    b = []; rnd = random.Random(172)
    for k in range(70):
        a = rnd.uniform(0, TAU); d = rnd.uniform(0, 0.17); y = 0.12 + 0.08 * (1 - d / 0.17) * rnd.uniform(0.5, 1.0)
        n = lathe([(0.0, -0.012), (0.007, -0.008), (0.008, 0.002), (0.004, 0.01), (0.0, 0.013)], 6, 'n')
        b.append(xform(n, G((d * math.cos(a), y, d * math.sin(a))), (rnd.uniform(0, 3), rnd.uniform(0, 3), 0)))
    return dict(nut=join(b, 'nut'))
def fish_body(L, name='fish'):
    """a barbel or carp: a spindle body, the tail fin, the dorsal fin (C)"""
    body = lathe([(0.0, 0.0), (L * 0.06, L * 0.05), (L * 0.11, L * 0.25), (L * 0.1, L * 0.55), (L * 0.05, L * 0.8), (L * 0.025, L * 0.88), (0.0, L * 0.9)], 8, name)
    for v in body.data.vertices: v.co.y *= 0.55
    import bmesh as _b
    bm = _b.new(); vs = [bm.verts.new(p) for p in ((0, 0, L * 0.86), (0, L * 0.09, L * 1.0), (0, 0, L * 0.95), (0, -L * 0.09, L * 1.0))]; bm.faces.new(vs); t = from_bm(bm, 'tail'); solidify(t, 0.002, 0)
    return join([body, t], name)
@woW
def a_wo_fish():
    """the catch: four barbel and carp in the basket (C)"""
    f = []
    for i in range(4):
        b = fish_body(0.3 - 0.02 * i); xform(b, (0, 0, 0), (0, math.pi / 2, i * 0.8))
        q = G((0.06 * math.sin(i * 3), 0.16 + 0.02 * i, 0.06 * math.cos(i * 2))); f.append(xform(b, (q.x - 0.13 * math.cos(i * 0.8), q.y - 0.13 * math.sin(i * 0.8), q.z)))
    return dict(fish=join(f, 'fish'))

@woW
def a_wo_threshing_floor():
    """the village threshing floor: a beaten circle 7 m across, sheaves and straw spread on it, a post in the middle (C)"""
    floor = lathe([(0.0, 0.05), (3.5, 0.045), (3.55, 0.0)], 40, 'floor', wobble=0.01, seed=180)
    straw = lathe([(0.0, 0.1), (2.2, 0.12), (2.9, 0.1), (3.3, 0.06), (3.35, 0.05)], 40, 'straw', wobble=0.02, seed=181); subdiv(straw, 1); displace(straw, 0.03, 0.2, seed=182)
    post = log((0, 0, 0), (0, 1.5, 0), 0.07, 0.06, 8, 'post', seed=183)
    return dict(earth=floor, straw=straw, wood_d=post)

@woW
def a_wo_stooks():
    """three stooks of five sheaves standing ears up, leaning together (C)"""
    st, ea, bd = [], [], []
    for i in range(3):
        for j in range(5):
            s, e, b = sheaf(0.82 + 0.06 * math.sin((i * 5 + j) * 2.1), seed=190 + i * 5 + j)
            for o in (s, e, b):
                xform(o, (0, 0, 0), (0.24, 0, 0)); xform(o, (0, -0.17, 0)); xform(o, (0, 0, 0), (0, 0, TAU * j / 5 + 0.3 * math.sin(i * 3)))
                q = G((i * 0.9, 0, 0.15 * math.sin(i))); xform(o, (q.x, q.y, q.z))
            st.append(s); ea.append(e); bd.append(b)
    return dict(straw=join(st, 'straw'), ears=join(ea, 'ears'), straw_d=join(bd, 'straw_d'))

def lying_sheaf(L, seed):
    s, e, b = sheaf(L, seed)
    for o in (s, e, b):
        xform(o, (0, 0, 0), (0, math.pi / 2, 0));
        for v in o.data.vertices: v.co.z *= 0.75
        xform(o, (0, 0, 0.085))
    return s, e, b
@woW
def a_wo_sheaves():
    """handfuls and sheaves lying where the reapers laid them (C)"""
    st, ea, bd = [], [], []
    for i in range(4):
        s, e, b = lying_sheaf(0.82 + 0.08 * math.sin(i * 5), 200 + i)
        for o in (s, e, b):
            xform(o, (0, 0, 0), (0, 0, -math.pi / 2 + 1.2 + 0.4 * math.sin(i))); q = G((0.35 * i - 0.4, 0, 0.3 * math.sin(i * 4))); xform(o, (q.x, q.y, q.z))
        st.append(s); ea.append(e); bd.append(b)
    return dict(straw=join(st, 'straw'), ears=join(ea, 'ears'), straw_d=join(bd, 'straw_d'))
@woW
def a_wo_sheaf():
    """a sheaf being bound (C)"""
    s, e, b = lying_sheaf(0.9, 210)
    for o in (s, e, b): xform(o, G((-0.45, 0, 0)))
    return dict(straw=s, ears=e, straw_d=b)

@woW
def a_wo_grain_heap():
    """the heap of threshed grain and the chaff blown beside it (C)"""
    g = lathe([(0.0, 0.45), (0.15, 0.4), (0.4, 0.22), (0.6, 0.05), (0.66, 0.0)], 24, 'grain', wobble=0.05, seed=220); subdiv(g, 1); displace(g, 0.012, 0.05, seed=221)
    ch = heap(0.9, 0.08, 0.5, 0.3, seed=222, lump=0.3, name='chaff')
    return dict(grain=g, chaff=ch)

@woW
def a_wo_spoil():
    """earth and silt dug out, in clods (C)"""
    return dict(earth=heap(0.55, 0.3, seed=230, lump=0.6, name='spoil'))

@woW
def a_wo_press():
    """a plastered treading basin full of grapes (C)"""
    floor = boxG(1.7, 0.02, 1.7, 0, 0, 0, bevel=0.005)
    walls = [boxG(w, 0.32, d, x, 0, z, bevel=0.03) for (x, z, w, d) in ((0, 0.82, 1.74, 0.1), (0, -0.82, 1.74, 0.1), (0.82, 0, 0.1, 1.54), (-0.82, 0, 0.1, 1.54))]
    mash = boxG(1.5, 0.03, 1.5, 0, 0.1, 0); subdiv(mash, 2); displace(mash, 0.02, 0.05, seed=240)
    return dict(lime=join([floor] + walls, 'lime'), grape=mash)

@woW
def a_wo_brushwood():
    """brushwood gathered for the fire: crooked branches with side twigs (C)"""
    b = []
    for i in range(9):
        a = math.sin(i * 12.9898) * 3; l = 0.55 + 0.3 * abs(math.sin(i * 4.1))
        b.append(log((-math.cos(a) * l / 2, 0.03 + 0.03 * (i % 3), -math.sin(a) * l / 2), (math.cos(a) * l / 2, 0.05 + 0.04 * (i % 3), math.sin(a) * l / 2), 0.013, 0.008, 5, 'br', seed=250 + i, bark=0.002))
        b.append(pathG([(math.cos(a) * l / 4, 0.05, math.sin(a) * l / 4), (math.cos(a + 0.5) * l / 2.2, 0.08, math.sin(a + 0.5) * l / 2.2)], [0.006, 0.003], 4, 'tw'))
    return dict(wood_d=join(b, 'wood_d'))

@woW
def a_wo_pigment_slab():
    """a grinding slab with its muller and heaps of pigment, Egyptian blue among them (PW-PIGMENT2021: B; C)"""
    slab = boxG(0.36, 0.07, 0.26, 0, 0, 0, bevel=0.012); displace(slab, 0.003, 0.05, seed=260)
    mul = xform(stone_lump(0.07, 261, flat=0.6), G((0.04, 0.07, 0.02)))
    pig = {}
    for i, k in enumerate(('blue', 'green', 'red', 'ochre')):
        pig[k] = heap(0.035, 0.025, -0.12 + i * 0.08, -0.08, seed=262 + i, lump=0.3, name=k, res=0.006); xform(pig[k], (0, 0, G((0, 0.07, 0)).z))
    return dict(stone=slab, stone_d=mul, **{'pig_' + k: v for k, v in pig.items()})

@woW
def a_wo_bier():
    """a bier of two poles and crossbars with a plank, the dead wrapped in a linen shroud (E-71; HDT 1.140: B claim; C)"""
    y = 1.4; w = [log((x, y, -1.35), (x, y, 1.35), 0.024, 0.022, 7, 'pole', seed=270 + int(x * 10), bark=0.001) for x in (-0.31, 0.31)]
    wd = [boxG(0.66, 0.04, 0.09, 0, y - 0.05, z, bevel=0.006) for z in (-0.85, -0.3, 0.3, 0.85)] + [boxG(0.5, 0.02, 1.8, 0, y - 0.01, 0, bevel=0.004)]
    body = meta([('ELLIPSOID', G((0, y + 0.1, z)), r, (1.0, 1.0, 1.0), 2) for z, r in ((-0.65, 0.12), (-0.35, 0.15), (0.0, 0.16), (0.35, 0.14), (0.62, 0.1), (0.8, 0.1))], res=0.02, name='shroud')
    for v in body.data.vertices: v.co.x *= 1.05; v.co.z = max(v.co.z, y + 0.005); v.co.z = y + (v.co.z - y) * 0.7
    displace(body, 0.006, 0.08, seed=272)
    return dict(wood=join(w + [wd[-1]], 'wood'), wood_d=join(wd[:-1], 'wood_d'), linen=body)

@woW
def a_wo_wash_stone():
    """a flat stone at the water's edge for beating cloth, the wet cloth heaped by it (C)"""
    s = stone_lump(0.3, 280, flat=0.45); xform(s, G((0, -0.02, 0)))
    c = heap(0.18, 0.08, 0.45, -0.1, seed=281, lump=0.4, name='cloth')
    return dict(stone=s, cloth=c)

@woW
def a_wo_drying_rack():
    """two forked posts and a pole with washed cloth hung over it to dry (the cloths draped by the cloth solver; C)"""
    posts = []
    for x in (-0.95, 0.95):
        posts.append(log((x, 0, 0), (x, 1.5, 0), 0.03, 0.025, 6, 'post', seed=290 + int(x * 10)))
        for s in (-1, 1): posts.append(pathG([(x, 1.45, 0), (x, 1.62, s * 0.06)], [0.018, 0.012], 5, 'fork'))
    pole = log((-1.05, 1.58, 0), (1.05, 1.58, 0), 0.022, 0.02, 6, 'pole', seed=293)
    cloths = {}
    for k, (x0, w, h, key) in enumerate(((-0.45, 0.7, 1.6, 'linen'), (0.45, 0.6, 1.2, 'red'))):
        c = grid(w, h, 14, 24, 'c', z=0.0)
        for v in c.data.vertices:  # hung over the pole: the sheet folded in two over it
            u, t = v.co.x, v.co.y / h + 0.5
            side = 1 if t > 0.5 else -1; dd = abs(t - 0.5) * h
            q = G((x0 + u, 1.6 - dd, side * (0.03 + 0.01 * dd) * (1 if dd > 0.02 else dd / 0.02)))
            v.co = q
        solidify(c, 0.003, 0); cloths[key] = c
    return dict(wood_d=join(posts, 'wood_d'), wood=pole, **cloths)

@woW
def a_wo_target():
    """a straw butt bound with cords, a hide face with a dark mark, on a post, for archery practice (C)"""
    post = log((0, 0, 0.12), (0, 1.1, 0.12), 0.05, 0.045, 7, 'post', seed=300)
    butt = lathe([(0.0, -0.125), (0.38, -0.125), (0.42, -0.08), (0.43, 0.0), (0.42, 0.08), (0.38, 0.125), (0.0, 0.125)], 20, 'butt', wobble=0.02, seed=301)
    subdiv(butt, 1); displace(butt, 0.012, 0.04, seed=302); xform(butt, (0, 0, 0), (math.pi / 2, 0, 0)); xform(butt, G((0, 1.2, 0)))
    cords = [sweep([G((0.425 * math.cos(a), 1.2 + 0.425 * math.sin(a), zz)) for a in [TAU * i / 24 for i in range(25)]], 0.008, 4, 'cord', caps=False) for zz in (-0.06, 0.06)]
    face = lathe([(0.0, 0.0), (0.36, 0.0), (0.365, 0.004)], 20, 'face'); xform(face, (0, 0, 0), (-math.pi / 2, 0, 0)); xform(face, G((0, 1.2, -0.128)))
    mark = lathe([(0.0, 0.0), (0.08, 0.0), (0.082, 0.002)], 12, 'mark'); xform(mark, (0, 0, 0), (-math.pi / 2, 0, 0)); xform(mark, G((0, 1.2, -0.131)))
    return dict(wood_d=post, straw=butt, cord=join(cords, 'cord'), hide=face, dark=mark)

@woW
def a_wo_hearth_pot():
    """three hearth stones, ash and embers, a round-bottomed cooking pot on the stones with its sooted belly, sticks feeding
    the fire (C; the fire is the settlement's own)"""
    ash = lathe([(0.0, 0.03), (0.2, 0.025), (0.3, 0.01), (0.32, 0.0)], 16, 'ash', wobble=0.06, seed=310); displace(ash, 0.006, 0.05, seed=311)
    st = []
    for i in range(3):
        a = i * 2.1 + 0.3; s = stone_lump(0.08, 312 + i, flat=1.0); st.append(xform(s, G((math.cos(a) * 0.17, 0, math.sin(a) * 0.17)), (0, 0, a)))
    emb = heap(0.08, 0.03, 0, 0, seed=315, lump=0.5, name='emb', res=0.01); xform(emb, G((0, 0.02, 0)))
    sticks = [log((-0.3 + 0.05 * i, 0.03, -0.05 + 0.05 * i), (0.05 * i, 0.06, 0.02 * i), 0.015, 0.012, 5, 'st', seed=316 + i, bark=0.002) for i in range(3)]
    return dict(ash=ash, stone=join(st, 'stone'), ember=emb, wood_d=join(sticks, 'wood_d'))

@woW
def a_wo_ard():
    """a wooden ard (the scratch plough of the ancient Near East: B type; C form) in the ploughman's frame: the stilt rising to
    his left hand, the sole with an iron share running in the soil, the beam forward to the yoke on the oxen's necks, the yoke
    with its bows"""
    w = [log((0.12, 0.92, 0.52), (0.06, 0.08, 1.02), 0.028, 0.034, 7, 'stilt', seed=320, bark=0.002), log((0.05, 0.12, 1.05), (0, 1.08, 4.02), 0.04, 0.032, 7, 'beam', seed=321, bark=0.003),
         log((-0.72, 1.12, 4.05), (0.72, 1.12, 4.05), 0.045, 0.045, 8, 'yoke', seed=322, bark=0.002)]
    wd = [pathG([(0.12, 0.92, 0.52), (0.24, 0.98, 0.48)], [0.022, 0.02], 6, 'handle'), pathG([(0.06, 0.05, 0.93), (0.04, 0.0, 1.2), (0.02, -0.04, 1.42)], [0.045, 0.04, 0.028], 6, 'sole', scale=(1.0, 0.7))]
    for x in (-0.55, 0.55):
        for s in (-0.2, 0.2): wd.append(pathG([(x + s, 1.14, 4.05), (x + s * 0.95, 0.98, 4.02), (x + s * 0.9, 0.86, 4.02)], 0.013, 4, 'bow'))
    share = pathG([(0.02, -0.03, 1.4), (0.02, -0.055, 1.47), (0.02, -0.07, 1.53)], [0.032, 0.026, 0.004], 4, 'share', scale=(1.0, 0.35))
    lash = rodG((0.05, 0.1, 1.0), (0.05, 0.15, 1.1), 0.05, 0.05, 7, 'lash')
    return dict(wood=join(w, 'wood'), wood_d=join(wd, 'wood_d'), iron=share, cord=lash)

def cart_base(R=0.46, bedY=0.62):
    wd = [xform(wheel_disc(R, 0.09), (x, 0, R)) for x in (-0.82, 0.82)]
    w = [log((-0.9, R, 0), (0.9, R, 0), 0.045, 0.045, 7, 'axle', seed=330, bark=0.001), boxG(1.44, 0.07, 2.1, 0, bedY - 0.07, -0.05, bevel=0.008),
         log((0, bedY - 0.04, 0.95), (0, 1.1, 3.45), 0.05, 0.04, 7, 'pole', seed=331, bark=0.002), log((-0.78, 1.14, 3.48), (0.78, 1.14, 3.48), 0.045, 0.045, 8, 'yoke', seed=332, bark=0.001)]
    for x in (-0.55, 0.55):
        for d in (-0.2, 0.2): w.append(pathG([(x + d, 1.14, 3.48), (x + d * 0.9, 0.88, 3.45)], 0.012, 4, 'bow'))
    return wd, w
@woW
def a_wo_cart():
    """an ox cart: a plank bed with side boards on two solid wheels of three boards with battens, a pole to the yoke, loaded
    with sacks of grain (B analogy, the Assyrian reliefs; C)"""
    R, bedY = 0.46, 0.62; wd, w = cart_base(R, bedY)
    sides = [boxG(0.05, 0.28, 2.1, x, bedY, -0.05, bevel=0.006) for x in (-0.7, 0.7)] + [boxG(1.44, 0.28, 0.05, 0, bedY, -1.08, bevel=0.006)]
    return dict(wood_d=join(wd + sides, 'wood_d'), wood=join(w, 'wood'))
@woW
def a_wo_cart_timber():
    """an ox cart carrying five roof beams of ~6 m lashed on, overhanging behind (C)"""
    R, bedY = 0.46, 0.62; wd, w = cart_base(R, bedY)
    beams = []
    for i in range(5):
        x = -0.5 + i * 0.25; y = bedY + 0.14 + (i % 2) * 0.22; r = 0.12 + 0.02 * math.sin(i + 7)
        beams.append(log((x, y, 0.9), (x, y - 0.05, -5.1), r, r * 0.9, 9, 'beam', seed=340 + i, bark=0.006))
    lash = [boxG(1.3, 0.03, 0.04, 0, bedY + 0.52, z) for z in (0.4, -0.8)]
    return dict(wood_d=join(wd, 'wood_d'), wood=join(w, 'wood'), beam=join(beams, 'beam'), cord=join(lash, 'cord'))
@woW
def a_wo_chariot():
    """a two-wheeled chariot with eight-spoked wheels, a box of wicker faced with leather for the driver, and a pole curving to
    the yoke of two horses (the Apadana reliefs and HDT 7.40-41: B; C form); court setting only"""
    R = 0.5; wd = [xform(wheel_spoked(R, 8), (x, 0, R)) for x in (-0.7, 0.7)]
    w = [log((-0.8, R, 0), (0.8, R, 0), 0.04, 0.04, 7, 'axle', seed=350, bark=0.001), boxG(1.0, 0.05, 0.8, 0, R + 0.02, -0.05, bevel=0.01),
         pathG([(0, R + 0.05, 0.36), (0, 0.95, 1.4), (0, 1.12, 2.2), (0, 1.22, 2.9)], [0.04, 0.036, 0.033, 0.03], 7, 'pole'), log((-0.62, 1.24, 2.9), (0.62, 1.24, 2.9), 0.04, 0.04, 8, 'yoke', seed=351, bark=0.001)]
    box_ = [boxG(1.0, 0.72, 0.04, 0, R + 0.07, 0.34, bevel=0.012)] + [boxG(0.04, 0.6, 0.72, x, R + 0.07, -0.05, bevel=0.012) for x in (-0.5, 0.5)]
    rail = [pathG([(-0.5, R + 0.79, -0.4), (-0.5, R + 0.8, 0.34), (0.5, R + 0.8, 0.34), (0.5, R + 0.79, -0.4)], 0.02, 6, 'rail')]
    hubs = [xform(lathe([(0.0, -0.16), (0.075, -0.1), (0.075, 0.1), (0.0, 0.16)], 10, 'h'), (x, 0, R), (0, math.pi / 2, 0)) for x in (-0.7, 0.7)]
    return dict(wood_d=join(wd, 'wood_d'), wood=join(w, 'wood'), leather=join(box_ + rail, 'leather'), gilt=join(hubs, 'gilt'))
@woW
def a_wo_wagon():
    """a covered four-wheeled wagon (harmamaxa) for the royal women (HDT 7.83: a claim; C form): a box on solid wheels under
    an arched cloth cover on hoops, a pole to the yoke; court setting only"""
    R = 0.42; wd = [xform(wheel_disc(R, 0.09), (x, -z, R)) for z in (-0.95, 0.95) for x in (-0.82, 0.82)]
    w = [log((-0.88, R, z), (0.88, R, z), 0.04, 0.04, 6, 'axle', seed=360 + int(z * 10), bark=0.001) for z in (-0.95, 0.95)]
    w += [log((0, 0.7, 1.4), (0, 1.08, 3.9), 0.045, 0.04, 7, 'pole', seed=362), log((-0.7, 1.12, 3.92), (0.7, 1.12, 3.92), 0.04, 0.04, 7, 'yoke', seed=363)]
    body = boxG(1.5, 0.45, 2.7, 0, 0.62, 0, bevel=0.015)
    cov = grid(math.pi * 0.75, 2.6, 16, 20, 'cover')
    for v in cov.data.vertices:
        a = v.co.x / 0.75; zz = v.co.y; sag = 0.02 * math.cos(TAU * 5 * zz / 2.6)
        v.co = G(((0.75 - sag) * math.sin(a), 1.07 + (0.75 - sag) * math.cos(a), zz))
    solidify(cov, 0.005, 0)
    hoops = [sweep([G((0.76 * math.sin(a), 1.07 + 0.76 * math.cos(a), zz)) for a in [-math.pi / 2 + math.pi * i / 16 for i in range(17)]], 0.018, 5, 'hoop', caps=False) for zz in (-1.2, -0.4, 0.4, 1.2)]
    return dict(wood_d=join(wd, 'wood_d'), wood=join(w + hoops, 'wood'), red=body, cloth=cov)

@woW
def a_wo_hurdles():
    """the state poultry yard: a ring of wattle hurdles (stakes woven with withies) with a gate gap, a low mud-brick coop with
    its door, water and grain dishes (PF 2034: B; C)"""
    R, n = 9, 26; hur = []; stakes = []
    for i in range(1, n):
        a = TAU * i / n; x, z = R * math.cos(a), R * math.sin(a); w = TAU * R / n + 0.05; tx, tz = -math.sin(a), math.cos(a)
        for k in range(5):
            y = 0.1 + 0.17 * k
            hur.append(pathG([(x - tx * w / 2, y, z - tz * w / 2), (x + tx * w * 0.0 + 0.02 * math.cos(a) * (1 if k % 2 else -1), y + 0.02, z + 0.02 * math.sin(a) * (1 if k % 2 else -1)), (x + tx * w / 2, y, z + tz * w / 2)], 0.022, 4, 'withy'))
        for s in (-0.5, 0.0, 0.5): stakes.append(log((x + tx * w * s, 0, z + tz * w * s), (x + tx * w * s, 1.0, z + tz * w * s), 0.03, 0.025, 5, 'stake', seed=int(i * 10 + s * 4), bark=0))
    coop = boxG(3.2, 1.6, 2.2, 0, 0, -R + 2.2, bevel=0.04); displace(coop, 0.01, 0.2, seed=370)
    roof = boxG(3.5, 0.12, 2.5, 0, 1.6, -R + 2.2, bevel=0.03)
    door = boxG(0.6, 0.7, 0.05, 0, 0, -R + 3.32, bevel=0.01)
    dishes = [xform(vessel([(0.15, 0.0), (0.2, 0.02), (0.22, 0.08), (0.22, 0.1)], 0.02, 14, 'dish', 0.02, seed=371 + i), G((-2 + i * 2, 0, 2.5 - i))) for i in range(3)]
    return dict(wattle=join(hur, 'wattle'), wood_d=join(stakes + [door], 'wood_d'), mud=coop, mud_roof=roof, pot=join(dishes, 'pot'))

def astragal(seed):
    """a knucklebone (a sheep's astragalus): the waisted block with its two rolled ends (C)"""
    m = meta([('ELLIPSOID', (-0.006, 0, 0), 0.009, (1.0, 0.8, 0.75), 2), ('ELLIPSOID', (0.006, 0, 0), 0.009, (1.0, 0.8, 0.75), 2), ('ELLIPSOID', (0, 0, 0.003), 0.006, (1.4, 0.6, 0.6), 2)], res=0.002, name='astr')
    return m
@woW
def a_wo_knucklebones():
    """five knucklebones in the dust (astragali: B objects; the game C)"""
    b = []
    for i in range(5):
        a = i * 2.4; r = 0.05 + 0.03 * (i % 3); k = astragal(i)
        b.append(xform(k, G((math.cos(a) * r, 0.006, math.sin(a) * r)), (0.3 * i, 0, a * 1.7)))
    return dict(bone=join(b, 'bone'))

@woW
def a_wo_toy_wheeled():
    """a fired-clay humped bull on four clay wheels on axles, pulled by a cord (RECOLLECTION: C)"""
    body = meta([('ELLIPSOID', G((0, 0.07, 0)), 0.05, (1.0, 1.7, 0.75), 2), ('ELLIPSOID', G((0, 0.1, -0.01)), 0.022, (1.0, 1.0, 1.0), 2), ('ELLIPSOID', G((0, 0.095, 0.085)), 0.026, (0.9, 1.2, 0.9), 2),
                 ('ELLIPSOID', G((0.018, 0.11, 0.1)), 0.008, (0.6, 0.6, 1.5), 2), ('ELLIPSOID', G((-0.018, 0.11, 0.1)), 0.008, (0.6, 0.6, 1.5), 2)], res=0.006, name='bull')
    wheels = []
    for z in (-0.05, 0.05):
        for x in (-0.055, 0.055): wheels.append(xform(lathe([(0.0, -0.006), (0.025, -0.006), (0.025, 0.006), (0.0, 0.006)], 10, 'w'), G((x, 0.025, z)), (0, math.pi / 2, 0)))
    axles = [rodG((-0.06, 0.025, z), (0.06, 0.025, z), 0.004, 0.004, 4, 'ax') for z in (-0.05, 0.05)]
    cord = pathG([(0, 0.09, 0.11), (0, 0.3, 0.45), (0, 0.45, 0.7)], 0.0025, 3, 'cord')
    return dict(clay_toy=join([body] + wheels, 'clay_toy'), wood_d=join(axles, 'wood_d'), cord=cord)

@woW
def a_wo_offering_set():
    """the lan set out before the fire: barley heaped on a cloth and wine in a clay bowl beside it (PF 1955: B; C)"""
    cl = grid(0.56, 0.42, 12, 10, 'cloth')
    for v in cl.data.vertices: v.co.z = 0.004 + 0.003 * math.sin(v.co.x * 30) * math.cos(v.co.y * 20)
    solidify(cl, 0.003, 0)
    barley = heap(0.15, 0.08, -0.1, 0, seed=380, lump=0.15, name='barley', res=0.012)
    bowl = xform(vessel([(0.03, 0.0), (0.06, 0.004), (0.085, 0.035), (0.09, 0.05)], 0.005, 16, 'bowl', 0.01, seed=381), G((0.15, 0.008, 0.03)))
    wine = xform(lathe([(0.0, 0.0), (0.074, 0.0)], 16, 'wine'), G((0.15, 0.045, 0.03)))
    return dict(linen=cl, grain=barley, pot=bowl, wine=wine)

@woW
def a_wo_grass_bed():
    """the boiled meat of a sacrifice laid on soft grass (Herodotus 1.132: B; C)"""
    g = grid(0.95, 0.62, 16, 12, 'grass')
    for v in g.data.vertices: v.co.z = 0.012 + 0.01 * math.sin(v.co.x * 41 + v.co.y * 13) * math.cos(v.co.y * 37)
    solidify(g, 0.01, -1)
    meat = [heap(0.07 + 0.03 * abs(math.sin(i)), 0.05, 0.3 * math.sin(i * 2.3), 0.2 * math.sin(i * 3.1), seed=390 + i, lump=0.3, name='m', res=0.01) for i in range(7)]
    for m in meat: xform(m, (0, 0, 0.02))
    return dict(grass=g, meat_boiled=join(meat, 'meat_boiled'))

@woW
def a_wo_anvil():
    """the smith's anvil: an iron block with a horn on a wooden stump, a few scales of iron and a spare bar at its foot (C)"""
    stump = log((0, 0, 0), (0, 0.5, 0), 0.2, 0.19, 12, 'stump', seed=400, bark=0.008)
    an = boxG(0.16, 0.12, 0.26, 0, 0.5, 0, bevel=0.008)
    horn = pathG([(0, 0.59, 0.13), (0, 0.585, 0.2), (0, 0.575, 0.26)], [0.03, 0.02, 0.006], 6, 'horn')
    bar = boxG(0.03, 0.03, 0.5, 0.3, 0, -0.1, orbit=0.4)
    sc = [boxG(0.03, 0.006, 0.02, 0.25 * math.sin(i * 12.9), 0, 0.25 + 0.1 * math.sin(i * 4.1), orbit=math.sin(i * 7) * 3) for i in range(5)]
    return dict(wood_d=stump, iron=join([an, horn, bar], 'iron'), scale=join(sc, 'scale'))

def goatskin(sx, sy, sz, seed):
    """a goatskin bag: the skin whole, the legs tied off (C)"""
    e = [('ELLIPSOID', (0, 0, 0), 1.0, (sx, sz, sy), 2)]
    for (dx, dz) in ((0.7, 0.6), (-0.7, 0.6), (0.7, -0.6), (-0.7, -0.6)):
        e.append(('ELLIPSOID', (dx * sx, dz * sz, -0.2 * sy), 0.25, (sx * 0.4, sz * 0.4, sy * 0.4), 2))
    m = meta(e, res=0.012, name='skin'); displace(m, 0.006, 0.05, seed=seed); return m
@woW
def a_wo_bellows_stand():
    """a goatskin bag bellows on a low mud stand with a clay nozzle into the forge, worked by hand (B by analogy; C)"""
    stand = boxG(0.34, 0.5, 0.3, 0, 0, 0, bevel=0.03); displace(stand, 0.008, 0.1, seed=410)
    sk = goatskin(0.16, 0.08, 0.2, 411); xform(sk, G((0, 0.56, 0)))
    noz = pathG([(0.02, 0.56, 0), (0.34, 0.5, -0.05)], [0.03, 0.022], 7, 'noz')
    han = pathG([(0, 0.64, 0.04), (0, 0.66, 0.14)], 0.012, 5, 'h')
    return dict(mud=stand, skin=sk, pot=noz, wood=han)
@woW
def a_wo_bellows():
    """a pair of goatskin bag bellows on the ground with clay nozzles into the forge (B by analogy; C)"""
    sk = []; nz = []
    for x in (-0.15, 0.15):
        s = goatskin(0.13, 0.12, 0.17, 412 + int(x * 10)); xform(s, G((x, 0.12, 0))); sk.append(s)
        nz.append(pathG([(x, 0.1, 0.12), (x * 0.3, 0.12, 0.6)], [0.025, 0.02], 7, 'n'))
    return dict(skin=join(sk, 'skin'), pot=join(nz, 'pot'))

@woW
def a_wo_stake():
    """a goldsmith's stake in a wooden block, a silver bowl on it being chased, a tray of finished phialai beside (C)"""
    block = log((0, 0, 0), (0, 0.2, 0), 0.15, 0.14, 10, 'block', seed=420, bark=0.006)
    st = rodG((0, 0.2, 0), (0, 0.27, 0), 0.012, 0.01, 6, 'stake')
    bowl = vessel([(0.0, 0.0), (0.03, 0.002), (0.07, 0.018), (0.085, 0.038)], 0.002, 16, 'b', 0.0)
    xform(bowl, (0, 0, 0), (math.pi, 0, 0)); xform(bowl, G((0, 0.3, 0)))  # upside down on the stake
    tray = boxG(0.32, 0.02, 0.22, 0.38, 0, -0.2, bevel=0.005)
    ph = [xform(vessel([(0.0, 0.0), (0.03, 0.002), (0.07, 0.016), (0.085, 0.036)], 0.002, 16, 'p', 0.0), G((x, 0.02, z))) for x, z in ((0.3, -0.24), (0.44, -0.16))]
    return dict(wood_d=block, iron=st, silver=join([bowl] + ph, 'silver'), wood=tray)

@woW
def a_wo_weigh_table():
    """a low table with graded stone weights (the duck-shaped weights of the period: B; RECOLLECTION), the silver in a bowl and
    a clay tablet (C)"""
    top = 0.72; t = [boxG(0.62, 0.035, 0.4, 0, top - 0.035, 0, bevel=0.008)] + [log((x, 0, z), (x, top - 0.035, z), 0.02, 0.02, 6, 'leg', seed=430 + i, bark=0) for i, (x, z) in enumerate(((-0.27, -0.16), (-0.27, 0.16), (0.27, -0.16), (0.27, 0.16)))]
    ducks = []
    for i in range(5):
        r = 0.012 + 0.008 * i
        d = meta([('ELLIPSOID', (0, 0, 0), r, (1.6, 1.0, 0.8), 2), ('ELLIPSOID', (r * 1.3, 0, r * 0.4), r * 0.45, (1.0, 0.8, 0.8), 2)], res=r / 4, name='duck')
        ducks.append(xform(d, G((-0.24 + i * 0.07 + r, top + r * 0.6, -0.1))))
    bowl = xform(vessel([(0.03, 0.0), (0.06, 0.005), (0.09, 0.035), (0.09, 0.04)], 0.004, 14, 'bowl', 0.01, seed=436), G((0.12, top, 0.05)))
    silver = [boxG(0.018, 0.008, 0.012, 0.12 + 0.04 * math.sin(i * 3), top + 0.02 + 0.004 * i, 0.05 + 0.04 * math.sin(i * 5), yaw=i) for i in range(7)]
    tab = boxG(0.07, 0.022, 0.05, -0.15, top, 0.1, bevel=0.006)
    return dict(wood=join(t, 'wood'), diorite=join(ducks, 'diorite'), pot=bowl, silver=join(silver, 'silver'), tablet=tab)

@woW
def a_wo_seal_bench():
    """the seal cutter's low block: the bow drill's shaft upright on a stone blank, a bowl of wet abrasive sand, two finished
    cylinder seals (C)"""
    bl = boxG(0.36, 0.24, 0.3, 0, 0, 0, bevel=0.02); displace(bl, 0.004, 0.06, seed=440)
    sh = rodG((0, 0.24, 0), (0, 0.44, 0), 0.006, 0.006, 5, 'shaft')
    blank = xform(lathe([(0.0, -0.015), (0.012, -0.015), (0.012, 0.015), (0.0, 0.015)], 8, 'blank'), G((0, 0.255, 0)))
    bowl = xform(vessel([(0.03, 0.0), (0.05, 0.004), (0.07, 0.03), (0.068, 0.032)], 0.004, 12, 'b', 0.01, seed=441), G((0.12, 0.24, 0.06)))
    sand = xform(lathe([(0.0, 0.0), (0.06, 0.0)], 12, 's'), G((0.12, 0.265, 0.06)))
    seals = [xform(lathe([(0.0, -0.015), (0.009, -0.015), (0.009, 0.015), (0.0, 0.015)], 8, 'seal'), G((x, 0.25, 0.08)), (0, math.pi / 2, 0)) for x in (-0.1, -0.13)]
    return dict(stone=bl, wood=sh, lapis=join([blank] + seals, 'lapis'), pot=bowl, sand=sand)

@woW
def a_wo_tan_beam():
    """a tanner's beam: a log sloping from the tanner's thighs to the ground on two legs, a hide over it, the scrapings of flesh
    and hair heaped at its foot and the ground dark round it (hides: PF 58-60, A; tanning C)"""
    a, b = (0, 0.86, 0.32), (0, 0.05, 1.3)
    beam = log(a, b, 0.11, 0.13, 10, 'beam', seed=450, bark=0.005)
    legs = [log((s * 0.2, 0, 0.42), (0, 0.78, 0.4), 0.03, 0.03, 5, 'leg', seed=451 + int(s)) for s in (-1, 1)]
    hide = grid(0.5, 1.0, 10, 18, 'hide')
    L = math.hypot(b[1] - a[1], b[2] - a[2]); ang = math.atan2(a[1] - b[1], b[2] - a[2])
    for v in hide.data.vertices:
        u, t = v.co.x / 0.25, v.co.y / 1.0 + 0.5  # across and along
        th = u * 1.6; r = 0.14
        along = a[2] + (b[2] - a[2]) * (0.1 + 0.8 * t); up = a[1] + (b[1] - a[1]) * (0.1 + 0.8 * t)
        v.co = G((r * math.sin(th), up + r * math.cos(th) * math.cos(ang), along + r * math.cos(th) * math.sin(ang) * 0.3))
    solidify(hide, 0.005, 0)
    stain = boxG(1.5, 0.004, 1.9, 0, 0, 0.9)
    scr = heap(0.22, 0.09, -0.35, 1.25, seed=452, lump=0.5, name='scr')
    return dict(wood_d=join([beam] + legs, 'wood_d'), hide_w=hide, stain=stain, scrap=scr)

@woW
def a_wo_tan_vat():
    """a tanning vat sunk in the ground with a mud-brick rim, the hides soaking in dark liquor (C)"""
    vat = vessel([(0.62, 0.0), (0.64, 0.2), (0.66, 0.45)], 0.03, 24, 'vat', 0.01, seed=460)
    liq = lathe([(0.0, 0.39), (0.62, 0.39)], 24, 'liq')
    hides = [xform(hide_sheet(0.5, 0.36, 461 + i), G((0.2 * math.sin(i * 3), 0.395, 0.2 * math.sin(i * 5))), (0, 0, math.sin(i * 7) * 2)) for i in range(3)]
    rim = []
    for x in (-0.7, 0.7):
        for c in range(3):
            for k in range(4): rim.append(xform(brick_piece(465 + c * 4 + k + int(x * 10), 0.14, 0.1, 0.33), G((x, 0.15 * c, -0.52 + 0.345 * k + 0.1 * (c % 2)))))
    return dict(mud=vat, liquor=liq, hide=join(hides, 'hide'), brick=join(rim, 'brick'))

@woW
def a_wo_hide_frames():
    """the tannery's ground: three wooden frames with hides laced in them drying, a heap of lime, the ground stained (C)"""
    ground = boxG(4.2, 0.004, 2.6, 0, 0, 0)
    lime = heap(0.45, 0.3, -1.7, -0.8, seed=470, lump=0.3, name='lime')
    fr, hd, hd2, lace = [], [], [], []
    for i in range(3):
        x, z, yaw = -1.2 + i * 1.2, 0.4 + 0.15 * math.sin(i), 0.2 * math.sin(i * 2)
        parts = [log((sx, 0, 0), (sx, 1.5, 0), 0.03, 0.028, 5, 'p', seed=471 + i * 3 + int(sx * 10), bark=0.002) for sx in (-0.55, 0.55)]
        parts += [log((-0.58, y, 0), (0.58, y, 0), 0.025, 0.025, 5, 'r', seed=480 + i + int(y * 10), bark=0.002) for y in (0.25, 1.4)]
        h = hide_sheet(0.95, 1.0, 490 + i); xform(h, (0, 0, 0), (math.pi / 2, 0, 0)); xform(h, G((0, 0.82, 0)))
        ls = [pathG([(0.47 * s, 0.4 + 0.18 * k, 0), (0.55 * s, 0.45 + 0.18 * k, 0)], 0.003, 3, 'l') for s in (-1, 1) for k in range(5)]
        grp = parts + [h] + ls
        for o in grp: xform(o, (0, 0, 0), (0, 0, yaw)); q = G((x, 0, z)); xform(o, (q.x, q.y, q.z))
        fr += parts; (hd2 if i == 1 else hd).append(h); lace += ls
    return dict(stain=ground, lime=lime, wood_d=join(fr, 'wood_d'), hide=join(hd, 'hide'), hide_w=join(hd2, 'hide_w'), cord=join(lace, 'cord'))

@woW
def a_wo_oil_press():
    """a stone mortar for pounding roasted sesame, the crushed paste in it (the sack and the basket beside it are the builder's)
    (PF 56: A for the sesame; C for the method)"""
    mort = vessel([(0.22, 0.0), (0.26, 0.2), (0.26, 0.35)], 0.08, 20, 'mortar', 0.02, seed=500); displace(mort, 0.006, 0.08, seed=501)
    paste = lathe([(0.0, 0.28), (0.14, 0.27), (0.17, 0.25)], 14, 'paste'); displace(paste, 0.006, 0.05, seed=502)
    return dict(stone=mort, paste=paste)

@woW
def a_wo_fold():
    """a fold for the night: a ring of cut thorn brush about 12 m across, heaped chest-high, the gate closed with a bundle (C)"""
    R, n = 6, 30; th = []; th2 = []
    for i in range(n):
        a = TAU * i / n + math.pi / 2
        if i in (n // 2, n // 2 + 1): continue
        x, z = R * math.cos(a), R * math.sin(a); h = 1.0 + 0.3 * abs(math.sin(i * 4))
        c = meta([('ELLIPSOID', (0, 0, h * 0.4), 0.7, (1.1, 0.85, h * 0.9), 2), ('ELLIPSOID', (0.3, 0.1, h * 0.3), 0.45, (1.0, 1.0, h), 2), ('ELLIPSOID', (-0.3, -0.1, h * 0.35), 0.45, (1.0, 1.0, h), 2)], res=0.12, name='brush')
        displace(c, 0.12, 0.25, seed=510 + i)
        for v in c.data.vertices: v.co.z = max(0.0, v.co.z)
        (th if math.sin(i * 12.9) > 0 else th2).append(xform(c, G((x, 0, z)), (0, 0, -a)))
    straw = [heap(0.45, 0.25, -1.5 + 1.5 * i, 1.2 * math.sin(i * 7), seed=540 + i, lump=0.5, name='s') for i in range(3)]
    return dict(thorn=join(th, 'thorn'), thorn_d=join(th2, 'thorn_d'), straw_d=join(straw, 'straw_d'))

def sledge_parts():
    runners = [pathG([(x, 0.1, -1.55), (x, 0.1, 1.2), (x, 0.14, 1.45), (x, 0.24, 1.58)], 0.1, 4, 'runner') for x in (-0.6, 0.6)]
    cross = [boxG(1.5, 0.12, 0.24, 0, 0.18, z, bevel=0.012) for z in (-1.0, 0, 1.0)]
    traces = [pathG([(x, 0.2, 1.55), (x * 0.3, 1.0, 3.0)], 0.025, 5, 'tr') for x in (-0.35, 0.35)]
    return runners, cross, traces
@woW
def a_wo_drum_haul():
    """a rough-cut column drum lying on a heavy wooden sledge, roped down, the traces forward to the yokes (construction.ts
    E-61; the stone from Majdabad: B; sledge and haul C)"""
    drum = lathe([(0.0, -0.65), (0.86, -0.65), (0.87, -0.6), (0.87, 0.6), (0.86, 0.65), (0.0, 0.65)], 28, 'drum', wobble=0.02, seed=550); displace(drum, 0.015, 0.1, seed=551)
    xform(drum, (0, 0, 0), (0, math.pi / 2, 0)); xform(drum, G((0, 0.28 + 0.86, 0)))
    r, c, t = sledge_parts()
    ropes = [sweep([G((x, 0.28 + 0.86 + 0.88 * math.cos(a), 0.88 * math.sin(a))) for a in [TAU * i / 24 for i in range(25)]], 0.02, 4, 'rope', caps=False) for x in (-0.45, 0.45)]
    return dict(lime=drum, wood_d=join(r, 'wood_d'), wood=join(c, 'wood'), cord=join(t + ropes, 'cord'))
@woW
def a_wo_sledge():
    """the drum sledge going back empty to the quarry (C)"""
    r, c, t = sledge_parts()
    return dict(wood_d=join(r, 'wood_d'), wood=join(c, 'wood'), cord=join(t, 'cord'))
@woW
def a_wo_drum_rough():
    """a column drum roughed out at the quarry, over-size, the point marks on it, chips about its foot (C)"""
    drum = lathe([(0.0, 0.0), (0.88, 0.0), (0.86, 0.65), (0.84, 1.3), (0.0, 1.3)], 24, 'drum', wobble=0.03, seed=560); subdiv(drum, 1); displace(drum, 0.02, 0.06, seed=561)
    chips = [heap(0.18 + 0.08 * abs(math.sin(i)), 0.07, 1.0 * math.cos(i * 1.1), 1.0 * math.sin(i * 1.1), seed=562 + i, lump=0.8, name='c', res=0.03) for i in range(6)]
    return dict(lime=drum, chips=join(chips, 'chips'))

@woW
def a_wo_fish_trap():
    """a conical wicker fish trap at the water's edge, weighted with a stone (C): the rods, the hoops, the mouth"""
    rods = []
    for k in range(14):
        a = TAU * k / 14; rods.append(pathG([(0.28 * math.cos(a), 0.28 + 0.28 * math.sin(a), -0.35), (0.14 * math.cos(a), 0.28 + 0.14 * math.sin(a), 0.2), (0.02 * math.cos(a), 0.28 + 0.02 * math.sin(a), 0.75)], [0.006, 0.005, 0.003], 3, 'rod'))
    hoops = [sweep([G((r * math.cos(a), 0.28 + r * math.sin(a), z)) for a in [TAU * i / 16 for i in range(17)]], 0.006, 4, 'hoop', caps=False) for (r, z) in ((0.28, -0.35), (0.22, -0.15), (0.16, 0.1), (0.09, 0.4))]
    st = xform(stone_lump(0.12, 570, flat=0.7), G((0, 0, -0.45)))
    return dict(wicker=join(rods + hoops, 'wicker'), stone=st)

@woW
def a_wo_snare():
    """a pegged snare line: a cord between two pegs with horsehair nooses along it (C)"""
    pegs = [pathG([(x, -0.05, 0), (x, 0.2, 0)], [0.012, 0.009], 5, 'peg') for x in (-0.5, 0.5)]
    cord = pathG([(-0.5, 0.12, 0), (0, 0.11, 0), (0.5, 0.12, 0)], 0.003, 3, 'cord')
    noose = [sweep([G((-0.36 + 0.18 * i + 0.035 * math.cos(a), 0.08 + 0.035 * math.sin(a), 0)) for a in [TAU * j / 10 for j in range(11)]], 0.0018, 3, 'n', caps=False) for i in range(5)]
    return dict(wood=join(pegs, 'wood'), cord=cord, hair=join(noose, 'hair'))

@woW
def a_wo_hives():
    """clay-pipe hives: a dozen long cylinders laid in rows in a low mud wall, their ends stopped with mud, a flight hole in
    each (RECOLLECTION, NOT SEEN; C)"""
    wall = boxG(2.4, 0.9, 0.8, 0, 0, 0, bevel=0.05); displace(wall, 0.015, 0.2, seed=580)
    pipes = []; caps = []
    for r in range(2):
        for c in range(6):
            x, y = -1.0 + 0.4 * c, 0.25 + 0.36 * r
            p = vessel([(0.16, 0.0), (0.162, 0.43), (0.16, 0.86)], 0.015, 12, 'pipe', 0.01, seed=581 + r * 6 + c)
            xform(p, (0, 0, 0), (math.pi / 2, 0, 0)); xform(p, G((x, y, -0.43)))
            pipes.append(p)
            cp = lathe([(0.0, 0.0), (0.15, 0.0), (0.15, 0.02), (0.0, 0.02)], 12, 'cap'); xform(cp, (0, 0, 0), (-math.pi / 2, 0, 0)); xform(cp, G((x, y, -0.43)))
            caps.append(cp)
    return dict(mud=wall, pot=join(pipes, 'pot'), mud_wet=join(caps, 'mud_wet'))

@woW
def a_wo_milk():
    """the milk in the pot (C)"""
    return dict(milk=lathe([(0.0, 0.0), (0.075, 0.0)], 12, 'milk'))

# ======================================================================================================== the Treasury's goods and the rooms' fittings (world/furnish.ts)
@asset()
def a_alabastron():
    """an alabaster vessel of the alabastron form (stone vessels inscribed for the Achaemenid kings in the Treasury: B; the
    form C): a tall rounded body, a narrow neck, a broad flat rim, 0.26 m"""
    o = [(0.045, 0.0), (0.06, 0.008), (0.071, 0.04), (0.075, 0.1), (0.074, 0.15), (0.063, 0.19), (0.04, 0.215), (0.024, 0.235), (0.026, 0.245), (0.04, 0.252), (0.041, 0.258), (0.02, 0.262)]
    return dict(stone=vessel(o, 0.006, 28, 'alab', 0.004, seed=601))

@asset()
def a_rhyton():
    """a gold rhyton: a drinking horn ending in the forepart of a winged animal (Achaemenid rhyta: B type; the forepart here a
    simple animal head, C), lying on its side as the Treasury's bench holds it"""
    horn = sweep([(0.0, 0.0, 0.0), (0.05, 0.0, 0.05), (0.08, 0.0, 0.12), (0.09, 0.0, 0.2), (0.085, 0.0, 0.26)], [0.011, 0.02, 0.035, 0.05, 0.058], 18, 'horn', caps=False)
    solidify(horn, 0.003, -1)
    head = meta([('ELLIPSOID', (-0.01, 0.0, -0.01), 0.028, (1.3, 0.9, 1.0), 2), ('ELLIPSOID', (-0.035, 0.0, -0.02), 0.015, (1.2, 0.8, 0.8), 2), ('ELLIPSOID', (0.0, 0.012, 0.012), 0.008, (0.6, 0.6, 1.5), 2), ('ELLIPSOID', (0.0, -0.012, 0.012), 0.008, (0.6, 0.6, 1.5), 2)], res=0.004, name='head')
    ob = join([horn, head], 'gold'); xform(ob, (0, 0, 0), (0, math.pi / 2 - 0.3, 0))
    zs = [v.co.z for v in ob.data.vertices]; z0 = min(zs)
    for v in ob.data.vertices: v.co.z -= z0
    return dict(gold=ob)

@asset()
def a_mortar_set():
    """a green chert mortar and pestle of the Treasury's ritual sets (inscribed green chert mortars, pestles and plates of the
    haoma rite: B; C form): a footed bowl and a pestle lying across it"""
    m = vessel([(0.06, 0.0), (0.07, 0.008), (0.06, 0.02), (0.075, 0.03), (0.095, 0.05), (0.1, 0.065), (0.098, 0.07)], 0.012, 28, 'mortar', 0.004, seed=602)
    p = sweep([(0.0, 0.0, 0.0), (0.0, 0.0, 0.08), (0.0, 0.0, 0.16)], [0.022, 0.017, 0.019], 12, 'pestle')
    xform(p, (-0.05, 0.0, 0.035), (0, 1.2, 0))
    return dict(stone=join([m, p], 'stone'))

@asset()
def a_shield():
    """a round shield leaning on the wall: a convex face of hide over wicker, a bound rim and a bronze boss (the Persian
    infantry's shields: B for round shields; C form), 0.69 m across"""
    face = lathe([(0.0, 0.058), (0.05, 0.056), (0.2, 0.04), (0.31, 0.018), (0.335, 0.006), (0.33, -0.004), (0.2, 0.022), (0.05, 0.038), (0.0, 0.04)], 40, 'face', wobble=0.004, seed=603)
    rim = sweep([(0.338 * math.cos(a), 0.338 * math.sin(a), 0.002) for a in [TAU * i / 48 for i in range(49)]], 0.009, 6, 'rim', caps=False)
    boss = lathe([(0.0, 0.086), (0.03, 0.083), (0.055, 0.063), (0.062, 0.056), (0.0, 0.056)], 20, 'boss')
    for o in (face, rim, boss): xform(o, (0, 0, 0), (1.35, 0, 0)); xform(o, (0, -0.1, 0.33))
    return dict(hide=face, cord=rim, bronze=boss)

@asset()
def a_tusk():
    """an elephant's tusk lying on the bench (ivory among the Treasury's goods: B; C): a tapering curve, oval in section"""
    pts = [(-0.3 + 0.45 * math.cos(a) - 0.45 * math.cos(0), 0.045, -0.15 + 0.45 * math.sin(a)) for a in [1.1 * i / 10 for i in range(11)]]
    t = sweep([(p[0], -p[2], p[1]) for p in pts], lambda s: 0.045 * (1 - s) ** 0.6 + 0.004, 12, 'tusk', scale=(1.0, 0.85))
    zs = [v.co.z for v in t.data.vertices]; z0 = min(zs)
    for v in t.data.vertices: v.co.z -= z0
    return dict(ivory=t)

@asset()
def a_glass_bowl():
    """a cut-glass bowl (Achaemenid cut glass: B; C form): a hemispherical bowl, its wall cut in a zone of almond facets"""
    o = [(0.0, 0.0), (0.04, 0.002), (0.07, 0.015), (0.088, 0.035), (0.095, 0.06), (0.092, 0.066)]
    b = vessel(o, 0.004, 48, 'bowl', 0.0, seed=604)
    for v in b.data.vertices:
        rr = math.hypot(v.co.x, v.co.y); a = math.atan2(v.co.y, v.co.x)
        if 0.03 < rr and v.co.z < 0.05: k = 1 - 0.035 * max(0, math.cos(a * 16)) ** 4; v.co.x *= k; v.co.y *= k
    return dict(glass=b)

@asset()
def a_beads():
    """a bowl heaped with beads of glass, carnelian and lapis (C)"""
    bw = vessel([(0.05, 0.0), (0.07, 0.02), (0.08, 0.04), (0.085, 0.05)], 0.004, 24, 'bowl', 0.008, seed=605)
    b = []; rnd = random.Random(606)
    for k in range(90):
        a = rnd.uniform(0, TAU); d = rnd.uniform(0, 0.07); z = 0.03 + 0.03 * (1 - d / 0.07) * rnd.uniform(0.6, 1.0)
        b.append(xform(lathe([(0.0, -0.004), (0.004, -0.003), (0.005, 0.0), (0.004, 0.003), (0.0, 0.004)], 5, 'bd'), (d * math.cos(a), d * math.sin(a), z)))
    return dict(pot=bw, beads=join(b, 'beads'))

@asset()
def a_quern():
    """a saddle quern: the lower stone a long slab with rounded ends, its top worn into a hollow along its length, the upper
    (rubbing) stone lying on it (querns of the period: B type; C), unit size (the builder scales it)"""
    s = box(1.0, 1.0, 0.12, (0, 0, 0), 'slab', bevel=0.04, segs=3); subdiv(s, 2)
    for v in s.data.vertices:
        u, t = v.co.x / 0.5, v.co.y / 0.5
        if v.co.z > 0.1: v.co.z -= 0.04 * max(0.0, 1 - u * u) * max(0.0, 1 - t * t)
        v.co.x *= 1 - 0.12 * abs(t) ** 4; v.co.y *= 1 - 0.15 * abs(u) ** 4
    displace(s, 0.006, 0.2, seed=607)
    r = meta([('ELLIPSOID', (0.05, 0, 0.11), 0.2, (1.8, 3.1, 0.38), 2)], res=0.02, name='rubber'); displace(r, 0.006, 0.2, seed=608)
    return dict(stone=join([s, r], 'stone'))

@asset()
def a_bale():
    """a bale of folded cloth tied with two cords (textiles among the Treasury's goods: B; C): soft, bulging, creased,
    unit size (the builder scales it)"""
    e = [('ELLIPSOID', (x, 0, 0.5), 0.5, (1.0, 1.0, 1.0), 2) for x in (-0.25, 0.0, 0.25)]
    b = meta(e, res=0.05, name='bale')
    xs = [v.co.x for v in b.data.vertices]; ys = [v.co.y for v in b.data.vertices]; zs = [v.co.z for v in b.data.vertices]
    for v in b.data.vertices:
        v.co.x = (v.co.x - (min(xs) + max(xs)) / 2) / (max(xs) - min(xs)); v.co.y = (v.co.y - (min(ys) + max(ys)) / 2) / (max(ys) - min(ys)); v.co.z = (v.co.z - min(zs)) / (max(zs) - min(zs))
        # squared off (a folded bale is box-like) and pinched by the cords at a quarter of the length from each end
        k = 1 - 0.1 * math.exp(-((abs(v.co.x) - 0.25) / 0.035) ** 2)
        v.co.y = math.copysign(abs(2 * v.co.y) ** 0.55 / 2, v.co.y) * k; v.co.z = 0.5 + math.copysign(abs(2 * (v.co.z - 0.5)) ** 0.55 / 2, v.co.z - 0.5) * k
        v.co.x = math.copysign(abs(2 * v.co.x) ** 0.7 / 2, v.co.x)
    tex = bpy.data.textures.new('cr', 'STUCCI'); tex.noise_scale = 0.15
    m = b.modifiers.new('d', 'DISPLACE'); m.texture = tex; m.strength = 0.02; m.mid_level = 0.5; apply_mods(b)
    cords = [sweep([(x, 0.5 * 0.92 * math.cos(a), 0.5 + 0.5 * 0.92 * math.sin(a)) for a in [TAU * i / 24 for i in range(25)]], 0.012, 5, 'cord', caps=False) for x in (-0.25, 0.25)]
    return dict(cloth=b, cord=join(cords, 'cord'))

# ======================================================================================================== the town's and villages' fittings (settlement/build.ts fittingGeom)
# In the fitting's frame (u along the fitting's rotation = game x, v = game z; base on y = 0), at the procedural boxes' sizes
@asset(ground=True)
def a_forge():
    """a smith's forge: a low block of mud brick plastered, a hollow hearth in its top with charcoal, a clay tuyere entering
    from the side where the bellows are worked, soot on the plaster (C), 1.0 x 0.65 x 0.8 m"""
    blk = box(1.0, 0.8, 0.65, (0, 0, 0), 'forge', bevel=0.05, segs=2); subdiv(blk, 1); displace(blk, 0.012, 0.15, seed=701)
    for v in blk.data.vertices:
        if v.co.z > 0.6 and abs(v.co.x) < 0.3 and abs(v.co.y) < 0.25: v.co.z -= 0.08 * (1 - (v.co.x / 0.3) ** 2) * (1 - (v.co.y / 0.25) ** 2)
    coal = heap(0.24, 0.05, 0, 0, seed=702, lump=0.6, name='coal', res=0.02); xform(coal, (0, 0, 0.56))
    tuy = sweep([(-0.62, 0, 0.5), (-0.5, 0, 0.52), (-0.28, 0, 0.56)], [0.05, 0.045, 0.04], 10, 'tuyere')
    return dict(mud=blk, coal=coal, clay=tuy)

@asset(ground=True)
def a_kiln():
    """a potter's updraft kiln: a round firing chamber of mud brick, plastered, its domed top with a vent, the stoking mouth
    arched at the foot (C), 2.4 m across and 2.0 m high at size 1"""
    r = 1.2
    k = lathe([(0.0, 0.0), (r, 0.0), (r * 1.01, 0.4), (r * 0.97, 1.0), (r * 0.92, 1.3), (r * 0.7, 1.65), (0.4, 1.92), (0.3, 2.0), (0.22, 2.0), (0.22, 1.9), (0.0, 1.9)], 32, 'kiln', wobble=0.02, seed=703)
    subdiv(k, 1); displace(k, 0.02, 0.3, seed=704)
    cut = sweep([(0, -1.6, 0.0), (0, -0.8, 0.0)], 0.35, 14, 'cut')
    for v in cut.data.vertices: v.co.z = max(v.co.z, -0.1)
    boolean(k, cut)
    return dict(mud=k)

@asset(ground=True)
def a_loom_upright():
    """an upright loom against a wall: two posts, a top beam and a lower beam, the warp between them with the woven cloth rising
    from the foot, the heddle bar across (C), 1.6 m wide, 1.72 m high"""
    posts = [pathG([(s, -0.1, 0), (s, 1.72, 0)], [0.05, 0.045], 8, 'post') for s in (-0.7, 0.7)]
    beams = [pathG([(-0.8, y, 0), (0.8, y, 0)], 0.04, 8, 'beam') for y in (1.67, 0.25)]
    heddle = pathG([(-0.72, 1.0, 0.06), (0.72, 1.0, 0.06)], 0.015, 6, 'heddle')
    warp = []
    for i in range(40):
        x = -0.6 + 1.2 * i / 39; warp.append(pathG([(x, 0.26, 0.02), (x, 1.66, 0.02)], 0.0016, 3, 'w', caps=False))
    cloth = boxG(1.22, 0.55, 0.008, 0, 0.27, 0.02); subdiv(cloth, 1); displace(cloth, 0.003, 0.05, seed=705)
    return dict(wood=join(posts + beams + [heddle], 'wood'), warp=join(warp, 'warp'), cloth=cloth)

@asset(ground=True)
def a_timber_stack():
    """squared timbers stacked on the ground, three below and two across the top of them (C), 1 m long (the builder scales the
    length)"""
    t = []
    for x in range(5):
        b = boxG(1.0, 0.24 if x < 3 else 0.23, 0.26, 0, 0 if x < 3 else 0.26, -0.3 + (x % 3) * 0.3 + (0.15 if x > 2 else 0), bevel=0.01)
        subdiv(b, 1); displace(b, 0.004, 0.08, seed=710 + x); t.append(b)
    return dict(wood=join(t, 'wood'))

@asset(ground=True)
def a_bench():
    """a wooden work bench: a thick plank top on four legs with stretchers (C), 1.6 x 0.5 x 0.8 m"""
    parts = [box(1.6, 0.5, 0.07, (0, 0, 0.73), bevel=0.01)]
    for sx in (-1, 1):
        for sy in (-1, 1): parts.append(box(0.07, 0.07, 0.73, (sx * 0.7, sy * 0.19, 0), bevel=0.006))
    for sy in (-1, 1): parts.append(box(1.4, 0.04, 0.06, (0, sy * 0.19, 0.18), bevel=0.004))
    b = join(parts, 'wood'); displace(b, 0.002, 0.1, seed=715)
    return dict(wood=b)

@asset(ground=True)
def a_trough():
    """a stone trough hollowed from a block, water standing in it (C), 1.4 x 0.56 x 0.55 m at size 1"""
    b = box(1.4, 0.56, 0.55, (0, 0, 0), 'block', bevel=0.03, segs=2)
    cut = box(1.2, 0.36, 0.5, (0, 0, 0.12), 'cut', bevel=0.05, segs=3)
    boolean(b, cut); displace(b, 0.006, 0.12, seed=720)
    w = box(1.18, 0.34, 0.005, (0, 0, 0.4), 'water')
    return dict(stone=b, water=w)

@asset(ground=True)
def a_manger():
    """a manger of mud brick, plastered, its top hollowed for the fodder, some straw in it (C), 1.8 x 0.6 x 0.9 m"""
    b = box(1.8, 0.6, 0.9, (0, 0, 0), 'manger', bevel=0.04, segs=2)
    cut = box(1.6, 0.4, 0.3, (0, 0, 0.72), 'cut', bevel=0.06, segs=3)
    boolean(b, cut); subdiv(b, 1); displace(b, 0.01, 0.15, seed=725)
    st = heap(0.7, 0.08, 0, 0, seed=726, lump=0.6, name='straw', res=0.03)
    for v in st.data.vertices: v.co.y *= 0.25
    xform(st, (0, 0, 0.74))
    return dict(mud=b, straw=st)

# ======================================================================================================== instruments (people/instrumentForms.ts; the strings stay the builder's)
@asset(ground=False)
def a_tool_harp_v():
    """the vertical angular harp's wooden parts (M-19, M-20: B type; C form): the soundbox, a long box tapering to its foot,
    its face of hide, leaning over the strings (HARP_V.lean), and the string rod through its foot with a knob at each end"""
    lean, L, W, D = 0.26, 0.95, 0.085, 0.11
    sb = box(W, D, L, (0, 0, 0), 'sb', bevel=0.012, segs=2)
    for v in sb.data.vertices:  # tapering toward the foot, the back rounded
        t = v.co.z / L; k = 0.55 + 0.45 * t; v.co.x *= k; v.co.y *= 0.7 + 0.3 * t
    xform(sb, (0, 0, -0.03)); xform(sb, (0, 0, 0), (lean, 0, 0))  # (three rotateX(lean) of a box along +Y: the game's X rotation)
    rod = pathG([(0, 0, -0.05), (0, 0, 0.5)], [0.018, 0.0144], 10, 'rod')
    knobs = [atG(lathe([(0.0, -0.02), (0.022, -0.012), (0.024, 0.0), (0.016, 0.014), (0.0, 0.02)], 10, 'k'), (0, 0, z)) for z in (-0.055, 0.505)]
    return dict(wood=sb, wood_d=join([rod] + knobs, 'wood_d'))

@asset(ground=False)
def a_tool_harp_h():
    """the horizontal angular harp's wooden parts (M-21: B type; C form): the soundbox held level under the arm, tapering, and
    the rising string arm with a knob"""
    L, W, H = 0.72, 0.085, 0.1
    sb = box(W, L, H, (0, -L / 2, -H / 2), 'sb', bevel=0.012, segs=2)
    for v in sb.data.vertices: t = -v.co.y / L; v.co.x *= 1.0 - 0.35 * t; v.co.z *= 1.0 - 0.35 * t
    arm = pathG([(0, 0.05, 0.68), (0, 0.22, 0.66), (0, 0.4, 0.6)], [0.017, 0.015, 0.013], 8, 'arm')
    knob = atG(lathe([(0.0, -0.01), (0.02, 0.0), (0.012, 0.03), (0.0, 0.035)], 8, 'k'), (0, 0.41, 0.6))
    return dict(wood=sb, wood_d=join([arm, knob], 'wood_d'))

@asset(ground=False)
def a_tool_lyre():
    """the round-bodied lyre's wooden parts (SOUND-R: C): a round soundbox, domed at the back, its face flat with the bridge,
    two curving arms and the yoke with its turning pegs"""
    r, th = 0.15, 0.07
    body = lathe([(0.0, -th / 2 - 0.012), (r * 0.6, -th / 2 - 0.006), (r * 0.95, -th / 2 + 0.01), (r, 0.0), (r * 0.99, th / 2), (0.0, th / 2)], 24, 'body')
    xform(body, G((0, 0, r)))  # (the lathe's axis is the game's Y: the disc lies in the game's X-Z plane, its faces toward +-Y)
    arms = [pathG([(s * 0.1, 0, 0.24), (s * 0.125, 0, 0.4), (s * 0.13, 0, 0.54)], [0.014, 0.012, 0.011], 7, 'arm') for s in (-1, 1)]
    yoke = pathG([(-0.16, 0, 0.54), (0.16, 0, 0.56)], 0.012, 8, 'yoke')
    pegs = [rodG((-0.06 + 0.12 * i / 8 * 1.25, 0.0, 0.535), (-0.06 + 0.12 * i / 8 * 1.25, 0.03, 0.535), 0.004, 0.004, 4, 'peg') for i in range(9)]
    bridge = boxG(0.14, 0.012, 0.012, 0, 0.039, 0.1)
    return dict(wood=body, wood_d=join(arms + [yoke, bridge] + pegs, 'wood_d'))

@asset(ground=False)
def a_tool_frame_drum():
    """the frame drum: a wooden hoop 0.36 m across with the membrane laced over its front face (C)"""
    hoop = lathe([(0.176, -0.06), (0.18, -0.06), (0.18, 0.0), (0.176, 0.0)], 32, 'hoop'); xform(hoop, (0, 0, 0), (math.pi / 2, 0, 0))
    skin = lathe([(0.0, 0.0015), (0.179, 0.0005), (0.182, -0.004)], 32, 'skin'); xform(skin, (0, 0, 0), (math.pi / 2, 0, 0))
    back = lathe([(0.0, -0.059), (0.176, -0.059)], 32, 'back'); xform(back, (0, 0, 0), (math.pi / 2, 0, 0))
    lace = [pathG([(0.18 * math.cos(a), 0.18 * math.sin(a), -0.005), (0.183 * math.cos(a), 0.183 * math.sin(a), -0.03)], 0.0018, 3, 'l') for a in [TAU * i / 24 for i in range(24)]]
    return dict(wood=hoop, skin=join([skin, back], 'skin'), cord=join(lace, 'cord'))

@asset(ground=False)
def a_tool_double_pipe():
    """the double pipe: two canes diverging from the mouth, each with its node rings and a bound mouthpiece (C)"""
    p = []; mp = []
    for s in (-1, 1):
        e = (s * math.sin(0.21) * 0.34, 0, math.cos(0.21) * 0.34)
        p.append(pathG([(0, 0, 0.005), e], [0.0064, 0.008], 7, 'cane'))
        for t in (0.35, 0.7): p.append(rodG((e[0] * t, 0, e[2] * t - 0.002), (e[0] * t, 0, e[2] * t + 0.002), 0.0088, 0.0088, 7, 'node'))
        mp.append(rodG((0, 0, -0.012), (0, 0, 0.012), 0.0056, 0.0064, 6, 'mp'))
    return dict(cane=join(p, 'cane'), cord=join(mp, 'cord'))

@asset(ground=False)
def a_tool_reed_pipe():
    """a herder's cane pipe with its nodes and a cut reed (M-18: C); the finger-holes are the builder's"""
    p = [pathG([(0, 0, -0.005), (0, 0, 0.3)], 0.0085, 8, 'cane')]
    for z in (0.08, 0.22): p.append(rodG((0, 0, z - 0.002), (0, 0, z + 0.002), 0.0093, 0.0093, 8, 'node'))
    return dict(cane=join(p, 'cane'))

@asset(ground=True)
def a_roller():
    """a roof roller: a limestone cylinder with a socket at each end for the wooden handle, the face worn smooth, the ends
    rough (the flat roofs rolled after rain: RECOLLECTION of the Iranian village practice; C), 0.6 m long, 0.28 m across,
    lying along x"""
    r = lathe([(0.0, -0.3), (0.12, -0.3), (0.135, -0.285), (0.14, -0.2), (0.142, 0.0), (0.14, 0.2), (0.135, 0.285), (0.12, 0.3), (0.0, 0.3)], 18, 'roller', wobble=0.02, seed=801)
    displace(r, 0.004, 0.06, seed=802)
    for v in r.data.vertices:
        if abs(v.co.z) > 0.295 and math.hypot(v.co.x, v.co.y) < 0.03: v.co.z *= 0.9  # the handle's sockets
    xform(r, (0, 0, 0.142), (0, math.pi / 2, 0))
    return dict(stone=r)

@asset(ground=True)
def a_fire_altar():
    """the precinct's fire altar (the altar on the Naqsh-e Rustam tomb facades: a stepped foot, a square shaft, a stepped top:
    NR-ALTAR, B; its steps and sizes the precinct's, settlement/precinct.ts PRECINCT.altar, C): each step a limestone block
    with its arrises worn round, the lowest set 0.25 m into the ground, a shallow hollow in the top for the fire with ash
    and embers in it"""
    foot = [(0.45, 0.12), (0.37, 0.12), (0.29, 0.12)]; shaft = (0.22, 0.5); top = [(0.29, 0.1), (0.37, 0.1), (0.45, 0.12)]
    st = []; y = 0.0
    for i, (hh, h) in enumerate(foot + [shaft] + top):
        y0 = -0.25 if i == 0 else y; b = box(2 * hh, 2 * hh, h + (y - y0), (0, 0, y0), 'step', bevel=0.012, segs=2)
        displace(b, 0.003, 0.08, seed=900 + i); st.append(b); y += h
    stone = join(st, 'stone')
    for v in stone.data.vertices:  # the fire's hollow in the top
        if v.co.z > y - 0.01 and abs(v.co.x) < 0.36 and abs(v.co.y) < 0.36: v.co.z -= 0.05 * (1 - (v.co.x / 0.36) ** 2) * (1 - (v.co.y / 0.36) ** 2)
    ash = heap(0.3, 0.05, 0, 0, seed=910, lump=0.4, name='ash', res=0.02); xform(ash, (0, 0, y - 0.045))
    return dict(stone=stone, ash=ash)

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
