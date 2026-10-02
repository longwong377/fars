# s17 C7 (D-610): the period kit's pieces for the furnished rooms (src/world/interiors/draw.ts) that model_props.py does not
# have: a wool cushion, a plait of onions and a bunch of herbs hung from the ceiling poles, a low tray-table, a potter's
# turntable, the quilts on a mud ledge. Built with model_props.py's library and its driver's levels (lod0, lod1, lod2: the
# rooms draw lod2), written as public/models/props/m_i_<id>.glb by tools/blender/interior_props.mjs. Every form C (the
# region's household things by analogy; no excavated house of Achaemenid Fars, research/SETTLEMENT.md §8); the shapes from
# the period kit's own vocabulary (UD-37: nothing from a library carries a culture's shape).
# Headless: blender -b --factory-startup --python tools/blender/interior_props.py -- <jobs.json>
import bpy, sys, os, json, math, random, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
from mp_lib import *  # noqa
from mathutils import Vector

ASSETS = {}
def asset(ao=True, ground=True, lod1=0.35):
    def reg(f): ASSETS[f.__name__[2:]] = dict(fn=f, ao=ao, ground=ground, lod1=lod1); return f
    return reg

@asset(ground=True)
def a_i_cushion():
    """a floor cushion of woven wool stuffed with wool: square, plump in the middle, its seam piped with a cord, a tassel
    at each corner (C), 0.5 x 0.14 x 0.42 m"""
    c = box(0.5, 0.42, 0.14, (0, 0, 0), 'cushion', bevel=0.05, segs=3); subdiv(c, 1)
    for v in c.data.vertices:  # the stuffing: the middle swells, the corners pinch, the top a little sat in
        x, y = v.co.x / 0.25, v.co.y / 0.21; k = max(0.0, 1 - x * x) * max(0.0, 1 - y * y)
        v.co.z = 0.07 + (v.co.z - 0.07) * (0.55 + 0.6 * k) - 0.012 * k * (1 if v.co.z > 0.07 else 0)
    displace(c, 0.006, 0.08, seed=6101)
    pts = [(0.25 * math.cos(a) / max(abs(math.cos(a)), abs(math.sin(a))) * 0.98, 0.21 * math.sin(a) / max(abs(math.cos(a)), abs(math.sin(a))) * 0.98, 0.07) for a in [TAU * i / 48 for i in range(49)]]
    seam = sweep(pts, 0.008, 5, 'seam', caps=False)
    tas = [xform(lathe([(0.0, 0.0), (0.014, 0.01), (0.01, 0.05), (0.004, 0.06)], 6, 'tassel'), (sx * 0.25, sy * 0.21, 0.08), (math.pi / 2 * sy, 0, 0)) for sx in (-1, 1) for sy in (-1, 1)]
    return dict(textile=c, cord=join([seam] + tas, 'cord'))

@asset(ground=False)
def a_i_onions():
    """a plait of onions and garlic hung from a ceiling pole: the dry stems plaited into a rope of straw, the bulbs along
    it, the lowest the smallest (C), 0.16 x 0.6 x 0.16 m, the cord's loop at the top (y = 0.6)"""
    rnd = random.Random(6201); bulbs = []; stems = []
    for k in range(13):
        t = k / 12; y = 0.5 - 0.42 * t; a = k * 2.1; r = 0.045 - 0.015 * t + rnd.uniform(-0.006, 0.006); garlic = k % 4 == 3
        c = (0.035 * math.cos(a), 0.035 * math.sin(a), y)
        b = lathe([(0.0, -r * 0.9), (r * 0.7, -r * 0.6), (r, 0.0), (r * 0.75, r * 0.6), (r * 0.25, r * 1.0), (0.0, r * 1.35)], 8, 'bulb', wobble=0.08 if not garlic else 0.18, seed=6202 + k)
        xform(b, c, (rnd.uniform(-0.4, 0.4), rnd.uniform(-0.4, 0.4), 0)); bulbs.append(b)
        stems.append(sweep([c, (c[0] * 0.3, c[1] * 0.3, y + 0.06)], [0.006, 0.004], 4, 'st'))
    plait = sweep([(0.012 * math.sin(i * 1.3), 0.012 * math.cos(i * 1.3), 0.08 + 0.52 * i / 20) for i in range(21)], 0.014, 6, 'plait')
    loop = sweep([(0.03 * math.sin(a), 0, 0.6 + 0.03 * (1 - math.cos(a))) for a in [math.pi * i / 8 for i in range(-8, 9)]], 0.004, 4, 'loop', caps=False)
    # Blender z up: the game's y; the hang is along z here
    return dict(bulb=join(bulbs, 'bulb'), stem=join(stems + [plait], 'stem'), cord=loop)

@asset(ground=False)
def a_i_herbs():
    """a bunch of herbs (mint, thyme, dill) hung head down from a ceiling pole to dry: the stems bound with a cord, the
    leaves in drooping clusters (C), 0.2 x 0.45 x 0.2 m, the cord at the top"""
    rnd = random.Random(6301); st = []; lv = []
    for k in range(16):
        a = rnd.uniform(0, TAU); s = rnd.uniform(0.0, 0.05); L = rnd.uniform(0.3, 0.42)
        top = (0.004 * math.cos(a), 0.004 * math.sin(a), 0.42); bot = (s * math.cos(a), s * math.sin(a), 0.42 - L)
        st.append(sweep([top, ((top[0] + bot[0]) / 2, (top[1] + bot[1]) / 2, 0.42 - L * 0.5), bot], [0.003, 0.0025, 0.002], 3, 'stem'))
        for j in range(5):
            t = 0.35 + 0.65 * j / 4; p = (top[0] + (bot[0] - top[0]) * t, top[1] + (bot[1] - top[1]) * t, 0.42 - L * t)
            leaf = lathe([(0.0, 0.0), (0.012, 0.01), (0.009, 0.03), (0.0, 0.045)], 4, 'leaf', ellip=(1, 0.25))
            xform(leaf, p, (math.pi + rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.uniform(0, TAU))); lv.append(leaf)
    tie = sweep([(0.02 * math.cos(a), 0.02 * math.sin(a), 0.4) for a in [TAU * i / 10 for i in range(11)]], 0.004, 4, 'tie', caps=False)
    hang = sweep([(0, 0, 0.4), (0.01, 0, 0.45)], 0.003, 4, 'hang')
    return dict(leaf=join(lv, 'leaf'), stem=join(st, 'stem'), cord=join([tie, hang], 'cord'))

@asset(ground=True)
def a_i_low_table():
    """a low tray-table of wood, where the household eats sitting on the mat: a tray of boards with a raised rim on four
    short turned legs (C; the region's low tables, by analogy), 0.72 x 0.28 x 0.5 m"""
    top = box(0.72, 0.5, 0.03, (0, 0, 0.24), 'top', bevel=0.01, segs=2)
    rim = [box(0.72, 0.025, 0.035, (0, sy * 0.2375, 0.27), bevel=0.006) for sy in (-1, 1)] + [box(0.025, 0.45, 0.035, (sx * 0.3475, 0, 0.27), bevel=0.006) for sx in (-1, 1)]
    legs = [xform(lathe([(0.0, 0.0), (0.022, 0.0), (0.026, 0.03), (0.018, 0.08), (0.024, 0.14), (0.017, 0.2), (0.022, 0.24), (0.0, 0.24)], 8, 'leg'), (sx * 0.3, sy * 0.19, 0)) for sx in (-1, 1) for sy in (-1, 1)]
    ob = join([top] + rim + legs, 'wood'); displace(ob, 0.002, 0.05, seed=6401)
    return dict(wood=ob)

@asset(ground=True)
def a_i_wheel():
    """a potter's turntable (the tournette): a heavy wheel of wood plastered with clay on a pivot set in a stone socket, a
    lump of clay on it (C; slow wheels of the region's potters, B by analogy), 0.62 x 0.42 x 0.62 m"""
    sock = lathe([(0.0, 0.0), (0.17, 0.0), (0.19, 0.06), (0.16, 0.12), (0.06, 0.13), (0.0, 0.13)], 10, 'socket', wobble=0.06, seed=6501); displace(sock, 0.008, 0.06, seed=6502)
    piv = cyl(0.04, 0.22, 8, 'pivot', (0, 0, 0.1))
    wheel = lathe([(0.0, 0.3), (0.3, 0.3), (0.31, 0.33), (0.3, 0.37), (0.04, 0.37), (0.0, 0.36)], 20, 'wheel', wobble=0.01, seed=6503)
    clay = lathe([(0.0, 0.37), (0.09, 0.37), (0.08, 0.42), (0.03, 0.44), (0.0, 0.44)], 10, 'clay', wobble=0.12, seed=6504)
    return dict(stone=sock, wood=join([piv, wheel], 'wood'), clay=clay)

@asset(ground=True)
def a_i_bedding():
    """the household's quilts folded and stacked on a low ledge of mud against the wall, a bolster on top (C), 0.75 x 0.5 x
    0.5 m"""
    ledge = box(0.75, 0.5, 0.16, (0, 0, 0), 'ledge', bevel=0.03, segs=2); displace(ledge, 0.006, 0.1, seed=6601)
    qa = []; qb = []; z = 0.16; rnd = random.Random(6602)
    for k in range(5):
        th = rnd.uniform(0.05, 0.07); q = box(0.68 + rnd.uniform(-0.03, 0.03), 0.44 + rnd.uniform(-0.03, 0.02), th, (rnd.uniform(-0.015, 0.015), rnd.uniform(-0.01, 0.01), z), 'q', bevel=0.022, segs=3)
        displace(q, 0.004, 0.05, seed=6603 + k); (qa if k % 2 == 0 else qb).append(q); z += th * 0.94
    bol = sweep([(-0.3, 0, z + 0.06), (0.3, 0, z + 0.06)], 0.065, 12, 'bolster'); displace(bol, 0.004, 0.05, seed=6610)
    return dict(mud=ledge, textile_a=join(qa, 'qa'), textile_b=join(qb + [bol], 'qb'))

# ======================================================================================================== driver (model_props.py's)
if __name__ == '__main__':
    job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
    outd = job['out_dir']; os.makedirs(outd, exist_ok=True); report = {}
    for id_ in job['ids']:
        t0 = time.time(); A = ASSETS[id_]
        clear()
        parts = A['fn']()
        lod0 = {}; lod1 = {}; lod2 = {}
        tgt = job.get('targets', {}).get(id_, {})
        for p, ob in parts.items():
            triangulate(ob); weld(ob)
            t = tgt.get(p)
            if t: decimate(ob, t[0])
            lod0[p] = ob
            o1 = copy(ob, ob.name + '_1'); decimate(o1, t[1] if t else max(8, int(tris(ob) * A['lod1']))); lod1[p] = o1
            o2 = copy(o1, ob.name + '_2'); decimate(o2, t[2] if t and len(t) > 2 else (tris(o1) if tris(o1) < 300 else max(100, int(tris(o1) * 0.3)))); lod2[p] = o2
        if A['ao']:
            levels = [lod0, lod1, lod2]
            for i, L in enumerate(levels):
                for j, M in enumerate(levels):
                    for o in M.values(): o.hide_render = j != i
                bake_ao(list(L.values()), ground=A['ground'])
            for L in levels:
                for o in L.values(): o.hide_render = False
        pts = [o.matrix_world @ Vector(c) for o in lod0.values() for c in o.bound_box]
        box_ = [[min(p.x for p in pts), min(p.z for p in pts), min(-p.y for p in pts)], [max(p.x for p in pts), max(p.z for p in pts), max(-p.y for p in pts)]]
        tr = export(os.path.join(outd, id_ + '.glb'), [lod0, lod1, lod2], ao=A['ao'])
        report[id_] = dict(tris=tr, box=box_, seconds=round(time.time() - t0, 1), ao=A['ao'])
        print('[interior_props]', id_, json.dumps(report[id_]), flush=True)
    json.dump(report, open(os.path.join(outd, 'interior_props.out.json'), 'w'), indent=1)
