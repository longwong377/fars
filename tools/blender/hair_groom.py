# PARSA asset pipeline (D-307, D-323), the Blender stage of the people's hair: groom hair curves over the reference head and
# convert them to cards, then render the strand and normal atlases the cards are textured with (hair_atlas.py).
#   blender -b --factory-startup --python tools/blender/hair_groom.py -- <job.json>
# job.json (tools/blender/sources/people_hair.ts): { head (head.json: the reference head/neck/chest surface, its region
# masks and landmarks), out_cards, out_blend, seed, styles (the registry's numbers), atlas (hair_atlas.py's job) }.
#
# The groom (every number from the job; the random draws from its seed):
#  * roots: area-weighted samples over the triangles of the style's region mask, thinned to the layer's spacing;
#  * guide curves: each grown from its root in steps along the style's flow (away from the crown's whorl and down, combed
#    back from the brow, the beard down from the jaw and the moustache out to the mouth's corners, the brows out from the
#    nose), turning toward the ground by the layer's gravity, kept at the layer's lift off the head by the head's BVH (hair
#    has volume: the lift grows from root to tip), falling free where the surface falls away (below the jaw, the ears);
#    cut square on the style's plane (the nape, the jaw line of the bob, the beard's square cut below the chin), pushed out
#    of the bunch's ellipsoid and a robe's thickness off the chest; an outer layer's guides are jittered in direction and
#    lifted at the tip (a broken outline: the first review's "helmets" were cards lying flat at one lift);
#  * the guides are a Blender hair-curves object (Curves) on the head mesh, saved to out_blend for inspection;
#  * cards: each guide becomes a strip of quads along it, its width tapering root to tip, lying on the head where the guide
#    touches it (the strip across the flow, its face outward) and facing out from the head's (or the beard's) axis where
#    it hangs free; each strip vertex anchored where its guide last touched the head (local triangle, barycentrics, offset),
#    so the post-step binds it to every body variant. Hanging strips of a two-sided style (the bob, the long beard) get a
#    back face (the human material is one-sided).
import bpy, sys, json, math, os, time, random
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
job = json.load(open(argv[0]))
t0 = time.time()
log = lambda *a: print('[hair_groom %.1fs]' % (time.time() - t0), *a, flush=True)
H = json.load(open(job['head']))
LM = H['lm']
V = np.array(H['pos'], dtype=np.float64).reshape(-1, 3); VN = np.array(H['nrm'], dtype=np.float64).reshape(-1, 3)
T = np.array(H['tris'], dtype=np.int64).reshape(-1, 3)
MASK = {k: np.array(v, dtype=np.float64) for k, v in H['masks'].items()}
bvh = BVHTree.FromPolygons([Vector(v) for v in V], T.tolist(), all_triangles=True)
TN = np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]]); TA = np.linalg.norm(TN, axis=1) / 2
v3 = lambda a: np.array(a, dtype=np.float64)
def nrmz(a):
    l = np.linalg.norm(a); return a / l if l > 1e-12 else a
clamp = lambda x, a=0.0, b=1.0: max(a, min(b, x))
lerp = lambda a, b, t: a + (b - a) * t
def sstep(e0, e1, x):
    t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t)

def bary(ti, p):
    a, b, c = V[T[ti, 0]], V[T[ti, 1]], V[T[ti, 2]]
    v0, v1, v2 = b - a, c - a, p - a
    d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
    den = d00 * d11 - d01 * d01
    if abs(den) < 1e-18: return (1.0, 0.0, 0.0)
    v = (d11 * d20 - d01 * d21) / den; w = (d00 * d21 - d01 * d20) / den
    u = 1 - v - w
    # clamp into the triangle (find_nearest's point is on it; rounding)
    u, v, w = max(0, u), max(0, v), max(0, w); s = u + v + w
    return (u / s, v / s, w / s)
class Hit:
    __slots__ = ('q', 'n', 't', 'b', 'd')
def nearest(p, r):
    loc, fn, idx, dist = bvh.find_nearest(Vector(p), r)
    if loc is None: return None
    h = Hit(); h.q = v3(loc); h.t = idx; h.b = bary(idx, h.q); h.d = dist
    n = h.b[0] * VN[T[idx, 0]] + h.b[1] * VN[T[idx, 1]] + h.b[2] * VN[T[idx, 2]]; h.n = nrmz(n)
    return h

# ---------------------------------------------------------------- landmarks and the style rules
eyeY, hz, chin, nose = LM['eyeY'], LM['hz'], v3(LM['chin']), v3(LM['nose'])
headTop, jaw, neck, mouthY = v3(LM['headTop']), v3(LM['jaw']), v3(LM['neck']), LM['mouthY']
BUN_C, BUN_R = v3(LM['bun']['c']), v3(LM['bun']['r'])
CHEST = LM['chest']; EAR = LM['ear']
DOWN = v3([0, -1, 0])
whorl = v3([0, headTop[1] - 0.012, hz - 0.035])  # the crown's whorl, a little behind the top (C)
def scalpFlow(p, n):
    r = p - whorl; r[1] = min(r[1], 0) - 0.02; return nrmz(nrmz(r) + DOWN * 0.35)
def backFlow(p, n):  # combed back from the brow, down behind the ears to the nape (the reliefs; C for real hair)
    k = sstep(eyeY + 0.03, eyeY - 0.03, p[1])
    # at the front hairline the comb goes up and over (back is into the forehead there: projected, it pointed down the face)
    front = sstep(hz + 0.03, hz + 0.075, p[2]) * sstep(eyeY + 0.02, eyeY + 0.05, p[1])
    y = -0.45 - 0.5 * sstep(hz, hz - 0.06, p[2]) - 2.5 * k
    return nrmz(v3([p[0] * 1.5, lerp(y, 1.0, front), -1 + 0.8 * k]))
def bobFlow(p, n):  # combed back over the front half of the head (no fringe: it read as the 1920s in the D-307 review)
    return backFlow(p, n) if p[2] > hz else scalpFlow(p, n)
def inFace(p):  # the face (brows to chin, cheek to cheek, in front of the ears): no scalp card hangs in front of it
    return abs(p[0]) < 0.066 and p[1] < eyeY + 0.035 and p[2] > hz + 0.03
def isMoustache(p): return p[1] > mouthY - 0.004 and abs(p[0]) < 0.035 and p[2] > nose[2] - 0.045
def beardFlow(p, n):
    if isMoustache(p): return nrmz(v3([math.copysign(0.9, p[0] or 1), -0.55, 0]))
    return nrmz(v3([p[0] * 0.8, -1, 0.15]))
def browFlow(p, n): return nrmz(v3([math.copysign(1, p[0] or 1), 0.35 * (1 - clamp(abs(p[0]) / 0.055)), 0]))
FLOWS = {'scalp': scalpFlow, 'back': backFlow, 'bob': bobFlow, 'beard': beardFlow, 'brow': browFlow, 'down': lambda p, n: DOWN}
def chestZ(y):
    for (cy, cz) in CHEST:
        if cy <= y: return cz
    return CHEST[-1][1]
def offChest(q, clear):
    if q[1] > chin[1] - 0.01: return q
    z = chestZ(q[1]) + clear
    return v3([q[0], q[1], z]) if q[2] < z else q
def outOfBun(q, pad=0.006):
    R = BUN_R + pad; e = (q - BUN_C) / R; l = np.linalg.norm(e)
    if l >= 1 or q[2] > BUN_C[2] + 0.01: return q
    return BUN_C + e / max(l, 1e-6) * R
def cutY(kind, S):
    if kind == 'nape': return lambda q, root: neck[1] + 0.012
    if kind == 'jaw': return lambda q, root: jaw[1] - S.get('cut_dy', 0.02)
    if kind == 'beard': return lambda q, root: chin[1] - S['below']
    return None
def inEar(p):  # the pinna: no card crosses it (a strip through the ear read as a slit)
    return abs(p[0]) > 0.064 and EAR['bot'] < p[1] < EAR['top'] and EAR['z0'] < p[2] < EAR['z1']

# ---------------------------------------------------------------- roots
def sample_roots(region, thr, spacing, rng, keep=None):
    m = MASK[region]; mt = (m[T[:, 0]] + m[T[:, 1]] + m[T[:, 2]]) / 3
    ids = np.nonzero(mt >= thr)[0]
    if not len(ids): return []
    ar = TA[ids]; cum = np.cumsum(ar); tot = cum[-1]
    want = int(math.ceil(tot / (spacing * spacing) * 3))
    cand = []
    for _ in range(want):
        x = rng.random() * tot; k = int(np.searchsorted(cum, x)); t = ids[min(k, len(ids) - 1)]
        u, v = rng.random(), rng.random()
        if u + v > 1: u, v = 1 - u, 1 - v
        a, b, c = V[T[t, 0]], V[T[t, 1]], V[T[t, 2]]; p = a + (b - a) * u + (c - a) * v
        if keep is None or keep(p): cand.append(p)
    # thinning on a hash grid of the spacing
    G = spacing; grid = {}; out = []
    for p in cand:
        k = tuple((p // G).astype(int)); ok = True
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for q in grid.get((k[0] + dx, k[1] + dy, k[2] + dz), ()):
                        if np.sum((p - q) ** 2) < spacing * spacing: ok = False; break
                    if not ok: break
                if not ok: break
            if not ok: break
        if not ok: continue
        h = nearest(p, 0.01)
        if h is None: continue
        grid.setdefault(k, []).append(p); out.append(h)
    return out

# ---------------------------------------------------------------- guides
def rot_about(v, axis, ang):
    axis = nrmz(axis); c, s = math.cos(ang), math.sin(ang)
    return v * c + np.cross(axis, v) * s + axis * (axis @ v) * (1 - c)
def grow(root, S, L, rng):
    """one guide curve: points, the hit each point is anchored at, the surface normal there, free flags"""
    lk = L.get('lenK')
    Ln = lerp(L['len'][0], L['len'][1], rng.random()) * (0.032 / L['len'][1] if lk == 'moustache' and isMoustache(root.q) else 1)
    # the sideburns and the hair at the temples are short (long, they hung down the cheek as a beard; a child's read as one)
    q0 = root.q
    if S.get('short_sides') and abs(q0[0]) > 0.05 and q0[1] < eyeY + 0.015 and q0[2] > hz - 0.015: Ln *= S['short_sides']
    segs = L['segs']; step = Ln / segs
    flow = FLOWS[S['flow']]
    d = flow(root.q, root.n); d = nrmz(d - root.n * (d @ root.n))
    if not np.all(np.isfinite(d)): return None
    jit = L.get('jitter', 0.0)
    if jit: d = rot_about(d, root.n, rng.gauss(0, jit))
    lift0, lift1 = L['lift']
    tipLift = L.get('tip_lift', 0.0) * rng.random()
    p = root.q + root.n * lift0; contact = root
    pts, hits, free = [p], [root], [False]
    cut = cutY(S.get('cut'), S); stick = S.get('stick')
    for k in range(1, segs + 1):
        t = k / segs; lift = lerp(lift0, lift1, t) + tipLift * t * t
        d = nrmz(d + DOWN * L['gravity'] * step)
        q = p + d * step
        h = nearest(q, lift + 0.012)
        onS = False
        if h is not None:
            e = (q - h.q) @ h.n
            canStick = stick != 'aboveChin' or q[1] > chin[1] + 0.004
            if e < lift or (e < lift + S.get('stick_tol', 0.006) and d @ h.n > -0.2 and canStick):
                q = h.q + h.n * lift; contact = h; onS = True
        if S.get('push') == 'bun': q = outOfBun(q)
        if S.get('push') == 'chest': q = offChest(q, S.get('chest_clear', 0.022))
        if S.get('ear_guard', True) and inEar(q) and not inEar(p): break  # (the bob falls over the ears)
        if S.get('face_guard') and inFace(q): break
        if cut is not None and q[1] < cut(q, root.q):
            c = cut(q, root.q); f = (p[1] - c) / max(1e-6, p[1] - q[1]); q = p + (q - p) * clamp(f)
            pts.append(q); hits.append(contact); free.append(not onS); break
        d = nrmz(q - p); p = q; pts.append(p); hits.append(contact); free.append(not onS)
    if len(pts) < 2: return None
    return pts, hits, free
def card_from(guide, S, L, rng, cls):
    pts, hits, free = guide; n = len(pts)
    axisZ = S.get('axis_z', hz - 0.01)
    across = []
    for k in range(n):
        dd = nrmz(pts[min(n - 1, k + 1)] - pts[max(0, k - 1)])
        radial = nrmz(v3([pts[k][0], 0, pts[k][2] - axisZ]))
        nk = hits[0].n if k == 0 else (radial if free[k] or np.linalg.norm(pts[k] - hits[k].q) > L['lift'][1] + 0.014 else hits[k].n)
        a = np.cross(dd, nk)
        if np.linalg.norm(a) < 1e-4: a = across[-1] if across else v3([1, 0, 0])
        across.append(nrmz(a))
    # a twist along an outer strip (C): it turns a little about its own axis, so neighbouring strips do not read as one sheet
    tw = L.get('twist', 0.0) * rng.gauss(0, 1)
    if tw:
        for k in range(n):
            dd = nrmz(pts[min(n - 1, k + 1)] - pts[max(0, k - 1)]); across[k] = rot_about(across[k], dd, tw * k / max(1, n - 1))
    w0, w1 = L['width']; wk = rng.uniform(0.85, 1.15)
    width = [lerp(w0, w1, k / (n - 1)) * wk for k in range(n)]
    return {'pts': pts, 'across': across, 'hits': hits, 'width': width, 'cls': cls, 'col': rng.randrange(8), 'ao': L['ao'],
            'both': bool(L.get('both')) and any(free), 'free': free}

def bun_cards(S, rng):
    """the bunch at the nape: strips laid over the bun's ellipsoid from its top down its back (outfits.ts bunGeo draws the
    core under them); an outer layer hangs its tips free (the curled locks' ends)"""
    out = []
    def onE(q, l):
        Rl = BUN_R + l; e = (q - BUN_C) / Rl; m = np.linalg.norm(e) or 1
        p = BUN_C + e / m * Rl; nn = nrmz((p - BUN_C) / (Rl * Rl)); return p, nn
    for L in S['layers']:
        sp = L['spacing']; na = int(round(math.pi * BUN_R[0] / sp)); ne = max(2, int(round(0.5 * math.pi * BUN_R[1] / sp)))
        for i in range(na):
            for j in range(ne):
                az = (-0.5 + (i + 0.5 + (rng.random() - 0.5) * 0.7) / na) * math.pi * 0.95
                el = (0.12 + (j + (rng.random() - 0.5) * 0.7) / ne * 0.6) * math.pi
                lift = lambda t: lerp(L['lift'][0], L['lift'][1], t)
                p, nn = onE(BUN_C + v3([math.sin(az) * math.sin(el), math.cos(el), -math.cos(az) * math.sin(el)]), lift(0))
                root = nearest(p, 0.14)
                if root is None: continue
                if (p - root.q) @ root.n < lift(0): p = root.q + root.n * lift(0)
                Ln = lerp(L['len'][0], L['len'][1], rng.random()); segs = L['segs']; step = Ln / segs
                pts, free = [p], [False]
                hang = L.get('hang', 0.0)
                for k in range(1, segs + 1):
                    t = k / segs; d = nrmz(DOWN - nn * (DOWN @ nn))
                    q, nn2 = onE(p + d * step, lift(t))
                    if hang and t > 1 - hang:  # the tip leaves the mass and hangs
                        q = p + nrmz(DOWN * 0.8 + nn * 0.2) * step; nn2 = nn; free.append(True)
                    else: free.append(False)
                    hq = nearest(q, 0.03)  # where the ellipsoid dips into the neck, the strip is kept on the neck's surface
                    if hq is not None and (q - hq.q) @ hq.n < lift(t): q = hq.q + hq.n * lift(t)
                    p, nn = q, nn2; pts.append(p)
                n = len(pts); across = []
                for k in range(n):
                    dd = nrmz(pts[min(n - 1, k + 1)] - pts[max(0, k - 1)]); nk = onE(pts[k], 0)[1]; across.append(nrmz(np.cross(dd, nk)))
                wk = rng.uniform(0.85, 1.15); width = [lerp(L['width'][0], L['width'][1], k / (n - 1)) * wk for k in range(n)]
                hits = [nearest(q, 0.14) or root for q in pts]  # each point anchored at the nape nearest it (its offset points out of the head)
                out.append({'pts': pts, 'across': across, 'hits': hits, 'width': width, 'cls': L['cls'], 'col': rng.randrange(8), 'ao': L['ao'],
                            'both': bool(L.get('both')) and any(free), 'free': free})
    return out

# ---------------------------------------------------------------- groom every style
rng0 = random.Random(int(job.get('seed', 7)))
sets = {}; guides_all = {}
for sid, S in job['styles'].items():
    rng = random.Random(rng0.randrange(1 << 30))
    cards = []
    if S.get('mode') == 'bun': cards = bun_cards(S, rng)
    else:
        for li, L in enumerate(S['layers']):
            roots = sample_roots(S['region'], S.get('thr', 0.5), L['spacing'], rng)
            for h in roots:
                if S.get('ear_guard', True) and inEar(h.q): continue
                g = grow(h, S, L, rng)
                if g is None: continue
                cards.append(card_from(g, S, L, rng, L['cls']))
    guides_all[sid] = [c['pts'] for c in cards]
    if S.get('crown_split'):
        hatY, slope = LM['hatY'], LM['hatSlope']
        crown = lambda c: c['hits'][0].q[1] > hatY - slope * max(0, hz - c['hits'][0].q[2])
        sets[S['crown_split']] = {'cards': [c for c in cards if crown(c)], 'note': S['note'] + ' (above the hat line: worn bareheaded only)'}
        sets[sid] = {'cards': [c for c in cards if not crown(c)], 'note': S['note'] + ' (below the hat line; above it: ' + S['crown_split'] + ')'}
    else: sets[sid] = {'cards': cards, 'note': S['note']}
    log(sid, len(cards), 'cards')

# ---------------------------------------------------------------- the hair curves (for inspection: out_blend)
try:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    me = bpy.data.meshes.new('head'); me.from_pydata([(x, -z, y) for x, y, z in V], [], T.tolist()); me.update()
    ho = bpy.data.objects.new('head', me); bpy.context.scene.collection.objects.link(ho)
    for sid, G in guides_all.items():
        if not G: continue
        hc = bpy.data.hair_curves.new(sid); hc.add_curves([len(g) for g in G])
        P = np.array([(p[0], -p[2], p[1]) for g in G for p in g], dtype=np.float32); hc.position_data.foreach_set('vector', P.ravel())
        o = bpy.data.objects.new(sid, hc); bpy.context.scene.collection.objects.link(o); o.parent = ho
        hc.surface = ho
    bpy.ops.wm.save_as_mainfile(filepath=job['out_blend'], compress=True)
    log('guides saved', job['out_blend'])
except Exception as e:
    log('guides not saved:', e)

# ---------------------------------------------------------------- cards out (local triangle anchors; the post-step binds)
r6 = lambda x: round(float(x), 6)
out = {'sets': {}}
for sid, st in sets.items():
    cs = []
    for c in st['cards']:
        pts = c['pts']; n = len(pts); P = []
        for k in range(n):
            h = c['hits'][k]
            for s in (-1, 1):
                p = pts[k] + c['across'][k] * (s * c['width'][k] / 2)
                P.append({'t': int(h.t), 'b': [r6(h.b[0]), r6(h.b[1])], 'o': [r6(x) for x in (p - h.q)]})
        cs.append({'v': P, 'n': n, 'cls': c['cls'], 'col': c['col'], 'ao': c['ao'], 'both': c['both'], 'free': [bool(x) for x in c['free']]})
    out['sets'][sid] = {'note': st['note'], 'cards': cs}
json.dump(out, open(job['out_cards'], 'w'))
log('cards written', job['out_cards'], {k: len(v['cards']) for k, v in out['sets'].items()})

# ---------------------------------------------------------------- the atlases
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hair_atlas
hair_atlas.render(job['atlas'])
log('done')
