# PARSA birds (D-332; BLENDER_PLAN row 20), the Blender stage: every species of tools/blender/life_birds.json modelled from
# its field-guide proportions, headless and scripted:
#   blender -b --factory-startup --python tools/blender/life_birds.py -- <job.json>
# job.json: { "reg": "tools/blender/life_birds.json", "ids": [...], "out": dir, "device": "CPU"|"GPU", "threads": n }
# Per species:
#  1. the parametric bird (numpy, the game's frame: +z forward, y up, metres): a lofted body along a spine (tail root, body,
#     neck, head, bill; cross-sections from the species' girth, depth, head and bill), two-sheet wings (upper and under
#     surfaces: the planform from the species' chord, wrist, sweep and wing type), a two-sheet tail (fork, streamers,
#     wedge, round, square, pins), legs and toes, and the crest or ears. Two poses from the same parameters: in flight (wings
#     spread, legs tucked or trailing, the herons' neck folded) and standing (the body pitched, the neck and head raised, the
#     wings folded on the flanks, the legs down to the ground at y = 0). The uv layout is the parameters' own (the body's
#     length and girth, each wing's span and chord, the tail's width and length), so every level and both poses share one
#     pair of maps;
#  2. the dense source for the bakes: the same bird at ~100x the rings, the feathers as relief (the body's overlapping
#     feather tips, the wing coverts' rows, the flight feathers' vanes and shafts), the flight feathers' and tail feathers'
#     own tips cut out of the planform (the rounded tips, the eagles' and storks' fingers, a bat's membrane scallops), the
#     eyes, and the plumage as vertex colours from the species' palette and marks;
#  3. Cycles bakes onto lod0's uvs: tangent-space normal, ambient occlusion, albedo (emission of the plumage) and coverage
#     (the cut-out feather tips: the game's alpha test);
#  4. two PNGs: <id>_albedo.png (RGB albedo sRGB, A coverage) and <id>_nrm.png (RGB normal, A occlusion);
#  5. one GLB (no Draco: the game parses it itself, in the browser and in the tests): fly0, fly1, fly2 (in flight) and, for
#     the species drawn on the ground, stand0, stand1; COLOR_0.r on the flight levels is the wing weight (0 at the body, 1 at
#     the tip: the game's wingbeat).
import bpy, sys, os, json, math, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from life_lib import log, reset, Parts, grid_faces, orient, mesh_object, tris, triangulate, emit_mat, Baker, srgb, save_png, dilate_alpha_rgb, export_glb

job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
REG = json.load(open(job['reg']))
LODC = REG['lod']

def sm(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def lerp(a, b, t): return a + (b - a) * t

def pchip(xs, ys, x):
    """monotone cubic interpolation (Fritsch-Carlson) of ys over increasing xs at x"""
    xs = np.asarray(xs, float); ys = np.asarray(ys, float); x = np.clip(np.asarray(x, float), xs[0], xs[-1])
    h = np.diff(xs); d = np.diff(ys) / h; m = np.zeros_like(ys)
    for k in range(1, len(xs) - 1):
        if d[k - 1] * d[k] > 0: w1, w2 = 2 * h[k] + h[k - 1], h[k] + 2 * h[k - 1]; m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k])
    m[0], m[-1] = d[0], d[-1]
    i = np.clip(np.searchsorted(xs, x) - 1, 0, len(xs) - 2); t = (x - xs[i]) / h[i]
    h00, h10, h01, h11 = 2 * t**3 - 3 * t**2 + 1, t**3 - 2 * t**2 + t, -2 * t**3 + 3 * t**2, t**3 - t**2
    return h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] + h11 * h[i] * m[i + 1]

def hsh(*v):
    """a hash in 0..1 of integer arrays (the marks' jitter)"""
    h = np.uint64(1469598103934665603) * np.ones(np.broadcast(*[np.asarray(x) for x in v]).shape, np.uint64)
    for x in v:
        h ^= np.asarray(x, np.int64).astype(np.uint64); h *= np.uint64(1099511628211); h ^= h >> np.uint64(29)
    return (h & np.uint64(0xFFFFFF)).astype(np.float64) / float(0xFFFFFF)

# ---------------------------------------------------------------------------------------------------------- the bird
class Bird:
    def __init__(s, sp):
        s.sp = sp; L = s.L = sp['L']; s.S = sp['S']
        s.W = sp['girth'] * L / 2; s.H = s.W * sp.get('depth', 1.0)
        s.Lt = sp['tail'] * L; s.Lb = sp['bill'] * L; s.R = sp['head'] * L; s.Ln = sp['neck'] * L
        s.A = L - s.Lt - s.Lb - 2 * s.R - s.Ln
        assert s.A > 0.2 * L, (sp['name'], s.A / L)
        s.a_head = s.A + s.Ln; s.a_bill = s.a_head + 2 * s.R; s.a_tip = s.a_bill + s.Lb; s.z_tr = -L / 2 + s.Lt
        W, H, R = s.W, s.H, s.R; bs = sp['billShape']
        nr = R * (0.62 if s.Ln > 0.12 * L else 0.78)
        bw = sp['billW'] * L / 2; bh = bw * {'flat': 0.42, 'hook': 1.25, 'cone': 1.0, 'dagger': 0.95, 'gape': 0.45, 'fine': 0.8, 'decurved': 0.85, 'short': 0.9}[bs]
        ch = 0.26 * H if s.Ln < 0.05 * L else 0.1 * H
        st = [(-0.06 * L, 0.14 * W, 0.12 * H, 0.12 * H), (0.0, 0.55 * W, 0.5 * H, 0.14 * H), (0.25 * s.A, 0.88 * W, 0.9 * H, 0.03 * H), (0.5 * s.A, W, H, 0.0),
              (0.75 * s.A, 0.95 * W, H, 0.03 * H), (0.95 * s.A, 0.7 * W, 0.8 * H, 0.12 * H)]
        if s.Ln > 0.02 * L: st += [(s.A + 0.5 * s.Ln, nr, nr, 0.5 * (0.12 * H + ch))]
        st += [(s.a_head + 0.12 * R, 0.8 * R, 0.8 * R, ch), (s.a_head + R, R, 0.95 * R, ch), (s.a_bill - 0.12 * R, 0.62 * R, 0.66 * R, ch - 0.06 * R)]
        cb = ch - 0.12 * R; Lb = s.Lb
        if bs == 'hook': st += [(s.a_bill, bw, bh, cb), (s.a_bill + 0.55 * Lb, 0.62 * bw, 0.75 * bh, cb + 0.02 * Lb), (s.a_bill + 0.85 * Lb, 0.38 * bw, 0.55 * bh, cb - 0.12 * Lb), (s.a_tip, 0.06 * bw, 0.08 * bh, cb - 0.38 * Lb)]
        elif bs == 'decurved': st += [(s.a_bill, bw, bh, cb), (s.a_bill + 0.5 * Lb, 0.5 * bw, 0.5 * bh, cb - 0.06 * Lb), (s.a_tip, 0.06 * bw, 0.06 * bh, cb - 0.22 * Lb)]
        elif bs == 'flat': st += [(s.a_bill, bw, bh, cb), (s.a_bill + 0.5 * Lb, 0.95 * bw, 0.6 * bh, cb - 0.05 * Lb), (s.a_bill + 0.92 * Lb, 0.78 * bw, 0.35 * bh, cb - 0.08 * Lb), (s.a_tip, 0.2 * bw, 0.1 * bh, cb - 0.08 * Lb)]
        else: st += [(s.a_bill, bw, bh, cb), (s.a_bill + 0.5 * Lb, 0.52 * bw, 0.52 * bh, cb - 0.02 * Lb), (s.a_tip, 0.05 * bw, 0.05 * bh, cb - 0.04 * Lb)]
        st.sort(key=lambda r: r[0]); s.st = np.array(st)
        s.regions = [(-0.06 * L, 0.0), (0.0, 0.95 * s.A), (0.95 * s.A, s.a_head), (s.a_head, s.a_bill), (s.a_bill, s.a_tip)]
        # wing
        s.sx = 0.55 * W; s.c0 = sp['chord'] * L; s.half = s.S / 2; s.a_sh = 0.8 * s.A; s.y_sh = 0.5 * H
        s.stand = sp.get('stand', False); s.pitch = math.radians(sp.get('pitch', 15))
    def prof(s, a):
        return pchip(s.st[:, 0], s.st[:, 1], a), pchip(s.st[:, 0], s.st[:, 2], a), pchip(s.st[:, 0], s.st[:, 3], a)
    # --- the spine of a pose: arc position a -> (y, z) and the axis angle
    def spine(s, pose):
        sp = s.sp; L = s.L
        if pose == 'fly': ab, an, ah, nsc = 0.0, math.radians(sp.get('neckFly', 0)), math.radians(sp.get('headFly', 0)), sp.get('neckFlyScale', 1.0)
        else:
            p = s.pitch; ab = p; an = math.radians(sp.get('neckStand', math.degrees(p) + 20)); ah = math.radians(sp.get('headStand', 0)); nsc = 1.0
        a = np.linspace(-0.08 * L, s.a_tip + 0.02 * L, 2400); bw1 = max(0.03 * L, 0.3 * s.Ln); bw2 = s.R
        ang = ab + (an - ab) * sm((a - (s.A - bw1)) / (2 * bw1)) + (ah - an) * sm((a - (s.a_head - 0.2 * bw2)) / (2 * bw2))
        ds = np.where((a > s.A) & (a < s.a_head), nsc, 1.0) * np.gradient(a)
        y = np.cumsum(np.sin(ang) * ds); z = np.cumsum(np.cos(ang) * ds)
        i0 = np.searchsorted(a, 0.0); y -= y[i0]; z -= z[i0]
        return a, y, z, ang
    def body_to_pose(s, P, pose, tail=False):
        """attachments in the body's own frame (x, y, a: a along the body from the tail root) to the pose"""
        x, y, a = P[:, 0], P[:, 1], P[:, 2]
        if pose == 'fly': return np.stack([x, y, s.z_tr + a], 1)
        if tail:  # the tail droops a little more than the body when standing
            d = math.radians(s.sp.get('tailStand', -8)); y, a = y * math.cos(d) + a * math.sin(d), -y * math.sin(d) + a * math.cos(d)
        p = s.pitch; return np.stack([x, y * math.cos(p) + a * math.sin(p), -y * math.sin(p) + a * math.cos(p)], 1)

    # --- the body loft
    def ring_as(s, lvl):
        cnt = {0: [1, 7, 2, 4, 3], 1: [1, 3, 1, 2, 2], 2: [0, 2, 1, 1, 1], 'high': [10, 70, 24, 50, 40]}[lvl]
        if s.Ln < 0.02 * s.L and lvl != 'high': cnt = list(cnt); cnt[2] = max(0, cnt[2] - 1)
        out = []
        for (a0, a1), k in zip(s.regions, cnt):
            out += list(np.linspace(a0, a1, k + 1)[1:] if k else [])
        return np.array([s.regions[0][0]] + out)
    def body(s, lvl, pose, M, extra=None):
        a_r = s.ring_as(lvl); nseg = {0: LODC['segs'][0], 1: LODC['segs'][1], 2: LODC['segs'][2], 'high': 96}[lvl]
        th = np.linspace(0, 2 * math.pi, nseg + 1)
        sa, sy, sz, sang = s.spine(pose)
        rx, ry, cy = s.prof(a_r); yy = np.interp(a_r, sa, sy); zz = np.interp(a_r, sa, sz); an = np.interp(a_r, sa, sang)
        A, TH = np.meshgrid(a_r, th, indexing='ij')
        RX, RY, CY = rx[:, None], ry[:, None], cy[:, None]
        if extra is not None: RX, RY = extra(A, TH, RX, RY)
        upy, upz = np.cos(an)[:, None], -np.sin(an)[:, None]
        X = RX * np.sin(TH); Yl = CY - RY * np.cos(TH)
        Y = yy[:, None] + Yl * upy; Z = zz[:, None] + Yl * upz
        if pose == 'fly': Z = Z + s.z_tr
        V = np.stack([X, Y, Z], -1).reshape(-1, 3)
        # uv: the body's block [0, 0.4] x [0, 1]: u around (from the belly), v along
        vv = (A - s.regions[0][0]) / (s.a_tip - s.regions[0][0]); UV = np.stack([0.005 + 0.39 * TH / (2 * math.pi), 0.005 + 0.99 * vv], -1).reshape(-1, 2)
        F = grid_faces(len(a_r) - 1, nseg)
        # the two ends closed by fans to apex points just beyond the last rings
        n0 = len(V); tail_apex = V[:nseg + 1].mean(0) + np.array([0, 0, 0]) ; tip_apex = V[-(nseg + 1):].mean(0)
        dT = V[nseg + 1:2 * (nseg + 1)].mean(0) - tail_apex; dH = tip_apex - V[-2 * (nseg + 1):-(nseg + 1)].mean(0)
        V = np.concatenate([V, [tail_apex - 0.25 * dT, tip_apex + 0.25 * dH]]); UV = np.concatenate([UV, [[0.2, 0.0], [0.2, 1.0]]])
        last = (len(a_r) - 1) * (nseg + 1)
        for j in range(nseg): F.append([n0, j + 1, j]); F.append([n0 + 1, last + j, last + j + 1])
        cen = np.concatenate([np.stack([np.zeros_like(yy), yy + cy * np.cos(an), zz - cy * np.sin(an) + (s.z_tr if pose == 'fly' else 0)], 1)])
        def want(c, k):
            i = np.argmin(np.abs(cen[:, 2] - c[2]) + np.abs(cen[:, 1] - c[1])); return c - cen[i]
        F = orient(V, F, want)
        par = np.zeros((len(V), 4)); par[:, 0] = 0; par[:, 3] = 1
        return V, F, UV, (A.reshape(-1), TH.reshape(-1))
    # --- the wing planform (u along the half-span, v along the chord from the leading edge)
    def chord(s, u):
        w = s.sp['wing']; c0 = s.c0
        if w == 'pointed': return c0 * (0.14 + 0.86 * (1 - u) ** 0.85)
        if w == 'sickle': return c0 * (0.1 + 0.9 * (1 - u) ** 1.1)
        if w == 'rounded': return c0 * (1 - 0.45 * u ** 2.5)
        if w == 'fingered': return c0 * (1 - 0.12 * u ** 3)
        if w == 'bat': return c0 * (1 - 0.55 * u)
        return c0
    def le(s, u):
        uw = s.sp['wrist']; L = s.L
        return s.a_sh + 0.3 * s.c0 + 0.05 * L * np.sin(0.5 * math.pi * np.minimum(u / uw, 1)) - s.sp['sweep'] * L * np.maximum(0, (u - uw) / (1 - uw)) ** 1.6
    def wing_fly(s, U, Vv, side, sgn, t):
        x = sgn * (s.sx + U * (s.half - s.sx)); a = s.le(U) - Vv * s.chord(U)
        y = s.y_sh + 0.05 * s.chord(U) * np.sin(math.pi * Vv) * (1 - 0.6 * U) + side * t / 2
        return np.stack([x, y, a], -1)
    def wing_fold(s, U, Vv, side, sgn, t):
        L = s.L; a = s.a_sh + 0.1 * s.c0 - U * s.sp['fold'] * L
        rx, ry, cy = s.prof(np.maximum(a, -0.05 * L))
        yb, yt = cy - 0.35 * ry, cy + 0.8 * ry; y = yb + Vv * (yt - yb) * (1 - 0.35 * U) + 0.1 * U * ry
        e = np.clip((y - cy) / np.maximum(ry, 1e-6), -0.98, 0.98); xs = np.maximum(rx * np.sqrt(1 - e * e), 0.3 * s.W) * 1.04 + 0.004 * L * (1 - Vv)
        return np.stack([sgn * (xs + side * t / 2), y, a], -1)
    def wing(s, lvl, pose, sgn, high=False):
        nu, nv = ({0: 8, 1: 3, 2: 1}[lvl], {0: 3, 1: 1, 2: 1}[lvl]) if not high else (160, 64)
        u = np.linspace(0, 1, nu + 1); v = np.linspace(0, 1, nv + 1); U, Vv = np.meshgrid(u, v, indexing='ij'); t = 0.004 * s.L
        out = []
        for side in (1, -1):
            P = (s.wing_fly if pose == 'fly' else s.wing_fold)(U, Vv, side, sgn, t).reshape(-1, 3)
            P = s.body_to_pose(P, pose)
            # uv: upper surface [0.41, 0.995] x [0.005, 0.29], under [0.41, 0.995] x [0.3, 0.59]
            v0 = 0.005 if side > 0 else 0.3
            UV = np.stack([0.41 + 0.585 * U, v0 + 0.285 * Vv], -1).reshape(-1, 2)
            F = grid_faces(nu, nv)
            out.append((P, F, UV, U.reshape(-1), Vv.reshape(-1), side))
        return out
    # --- the tail (x across, from -1 to 1; w along, 0 at the root)
    def tail_len(s, xn):
        sh = s.sp['tailShape']; f = s.sp.get('tailFork', 0.2); ax = np.abs(xn)
        if sh == 'fork': return 1 - f * (1 - ax)
        if sh == 'streamers': return 1 - f * (1 - ax ** 3)
        if sh == 'wedge': return 1 - 0.5 * ax
        if sh == 'round': return 1 - 0.22 * ax ** 2
        if sh == 'notch': return 1 - 0.06 * (1 - ax)
        if sh == 'pin': return (1 - f) + f * np.clip(1 - ax / 0.15, 0, 1)
        if sh == 'membrane': return 1 - 0.3 * (1 - ax) ** 2
        return 1 - 0.04 * ax
    def tail(s, lvl, pose, high=False):
        nu, nv = ({0: 6, 1: 2, 2: 1}[lvl], {0: 3, 1: 1, 2: 1}[lvl]) if not high else (120, 60)
        xn = np.linspace(-1, 1, nu + 1); w = np.linspace(0, 1, nv + 1); X, Wg = np.meshgrid(xn, w, indexing='ij'); t = 0.003 * s.L
        hw0 = 0.5 * s.W; hw1 = s.sp['tailW'] * s.L * (1 if pose == 'fly' else 0.55); out = []
        for side in (1, -1):
            hw = lerp(hw0, hw1, Wg); lenw = s.Lt * s.tail_len(X) * Wg + 0.02 * s.L * (1 - Wg)
            x = X * hw; a = 0.02 * s.L - lenw; y = 0.16 * s.H + 0.1 * s.H * (1 - Wg) + side * t / 2 - 0.04 * s.L * Wg * (0 if pose == 'fly' else 1)
            P = s.body_to_pose(np.stack([x, y, a], -1).reshape(-1, 3), pose, tail=True)
            u0 = 0.41 if side > 0 else 0.705
            UV = np.stack([u0 + 0.285 * (X + 1) / 2, 0.6 + 0.24 * Wg], -1).reshape(-1, 2)
            out.append((P, grid_faces(nu, nv), UV, X.reshape(-1), Wg.reshape(-1), side))
        return out
    # --- legs: hip, heel, foot; toes
    def legs(s, lvl, pose):
        ns = {0: 4, 1: 3, 2: 0, 'high': 10}[lvl]
        if not ns: return []
        L = s.L; sp = s.sp; tar = sp['leg'] * L; tib = sp.get('tibia', 0.35 * sp['leg']) * L; r = max(0.0035 * L, 0.02 * s.W + 0.004 * L) * (0.6 if sp.get('legTrail') else 1.0)
        out = []
        for sgn in (1, -1):
            hip_b = np.array([[sgn * 0.35 * s.W, -0.45 * s.H, 0.45 * s.A]])
            if pose == 'fly':
                hip = s.body_to_pose(hip_b, 'fly')[0]
                if sp.get('legTrail'): heel = hip + [0, -0.1 * s.H, -tib]; foot = heel + [0, 0, -tar]
                else: heel = hip + [0, -0.25 * s.H, 0.05 * s.A]; foot = heel + [0, 0.1 * s.H, -tar * 0.9]
                toe_dir = np.array([0, 0, -1.0])
            else:
                hip = s.body_to_pose(hip_b, 'stand')[0]; heel = hip + [0, -tib * 0.9, -0.15 * tib]; foot = heel + [0, -tar, 0.12 * tar]; toe_dir = np.array([0, 0, 1.0])
            pts = [hip, heel, foot]; rr = [r * 1.6, r, r * 0.9]
            out.append(('leg', pts, rr, ns, sgn))
            if lvl in (0, 'high'):
                tl = 0.6 * tar if not sp.get('legTrail') else 0.45 * tar
                for k, ang in enumerate((-0.45, 0.0, 0.45, math.pi)):
                    d = np.array([math.sin(ang) * (1 if pose != 'fly' else 0.4), 0, math.cos(ang)]) * np.array([1, 1, toe_dir[2]]); ln = tl * (0.55 if k == 3 else 1.0)
                    tip = foot + d * ln + ([0, 0.0, 0] if pose != 'fly' else [0, 0.15 * s.H, 0])
                    out.append(('toe', [foot, tip], [r * 0.7, r * 0.35], max(3, ns - 1), sgn))
        return out
    def tube(s, pts, rr, ns, uvbox, flat_foot=False):
        pts = [np.asarray(p, float) for p in pts]; V = []; UV = []
        for i, (p, r) in enumerate(zip(pts, rr)):
            d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]); d /= np.linalg.norm(d) + 1e-12
            a = np.cross(d, [1, 0, 0]); a = a if np.linalg.norm(a) > 0.3 else np.cross(d, [0, 1, 0]); a /= np.linalg.norm(a); b = np.cross(d, a)
            for j in range(ns + 1):
                t = 2 * math.pi * j / ns; V.append(p + r * (math.cos(t) * a + math.sin(t) * b))
                UV.append([uvbox[0] + (uvbox[2] - uvbox[0]) * j / ns, uvbox[1] + (uvbox[3] - uvbox[1]) * i / (len(pts) - 1)])
        V = np.array(V); F = grid_faces(len(pts) - 1, ns)
        ax = [pts[min(k, len(pts) - 1)] for k in range(len(pts))]
        def want(c, k):
            i = k // ns; p0, p1 = ax[i], ax[i + 1]; d = p1 - p0; t = np.clip(np.dot(c - p0, d) / (np.dot(d, d) + 1e-12), 0, 1); return c - (p0 + t * d)
        return V, orient(V, F, want), np.array(UV)
    # --- crest (a two-sided fin on the crown) and ears (bat)
    def crest(s, lvl, pose, high=False):
        c = s.sp.get('crest'); e = s.sp.get('ears'); out = []
        if not c and not e: return out
        nu, nv = (4, 2) if lvl == 0 else (1, 1) if lvl in (1, 2) else (40, 20)
        sa, sy, sz, sang = s.spine(pose); ah = s.a_head + 0.7 * s.R
        yy, zz, an = np.interp(ah, sa, sy), np.interp(ah, sa, sz) + (s.z_tr if pose == 'fly' else 0), np.interp(ah, sa, sang)
        rx, ry, cy = s.prof(ah); top = np.array([0, yy + (cy + ry * 0.92) * math.cos(an), zz - (cy + ry * 0.92) * math.sin(an)])
        U, Vv = np.meshgrid(np.linspace(0, 1, nu + 1), np.linspace(0, 1, nv + 1), indexing='ij')
        if c:
            ln, h, back = c['len'] * s.L, c['h'] * s.L, math.radians(c.get('back', 45)) + (0 if pose == 'fly' else -0.25)
            # a fan: u along the crest (front to back), v up
            base_z = top[2] + s.R * 0.4 - U * ln * 0.6; tipd = np.array([0, math.sin(math.pi / 2 - back), -math.cos(math.pi / 2 - back)])
            hh = h * (0.4 + 0.6 * np.sin(math.pi * np.clip(U * 0.9 + 0.1, 0, 1))) + ln * 0.4 * U
            for side in (1, -1):
                P = np.stack([side * 0.0015 * s.L + 0 * U, top[1] + Vv * hh * tipd[1] - 0.2 * s.R * U, base_z + Vv * hh * tipd[2]], -1).reshape(-1, 3)
                UV = np.stack([0.705 + 0.14 * U + (0.145 if side < 0 else 0), 0.86 + 0.13 * Vv], -1).reshape(-1, 2)
                out.append((P, grid_faces(nu, nv), UV, np.array([side, 0, 0.0])))
        if e:
            ln, w = e['len'] * s.L, e['w'] * s.L
            for sgn in (1, -1):
                base = top + np.array([sgn * 0.45 * s.R, -0.1 * s.R, 0]); d = np.array([sgn * 0.45, 0.85, -0.2]); d /= np.linalg.norm(d)
                P = (base + (U[..., None] * ln) * d + (Vv[..., None] - 0.5) * w * np.array([0, 0, 1]) * (1 - 0.8 * U[..., None])).reshape(-1, 3)
                for side in (1, -1):
                    Pp = P + side * 0.001 * s.L * np.array([0, 0, 0]) + side * 0.0012 * s.L * np.array([-0.85 * sgn, 0.45, 0])
                    UV = np.stack([0.705 + 0.14 * Vv + (0.145 if side < 0 else 0), 0.86 + 0.13 * U], -1).reshape(-1, 2)
                    out.append((Pp, grid_faces(nu, nv), UV, np.array([-0.85 * sgn * side, 0.45 * side, 0.0])))
        return out

    # --- the whole bird at a level and pose: (V, F, UV, C); C.r = the wing weight
    def build(s, lvl, pose):
        pa = Parts()
        V, F, UV, _ = s.body(lvl, pose, None); pa.add(V, F, UV, np.tile([0, 0, 0, 1.0], (len(V), 1)))
        for sgn in (1, -1):
            for (P, Fw, UVw, U, Vv, side) in s.wing(lvl, pose, sgn):
                Fw = orient(P, Fw, (lambda c, k, sd=side, sg=sgn: np.array([0, sd, 0]) if pose == 'fly' else np.array([sg * sd, 0, 0])))
                C = np.zeros((len(P), 4)); C[:, 0] = U; C[:, 1] = 1; C[:, 3] = 1; pa.add(P, Fw, UVw, C)
        for (P, Ft, UVt, X, Wg, side) in s.tail(lvl, pose):
            up = s.body_to_pose(np.array([[0, 1.0, 0]]), pose, tail=True)[0] - s.body_to_pose(np.array([[0, 0, 0.0]]), pose, tail=True)[0]
            Ft = orient(P, Ft, lambda c, k, sd=side: sd * up); C = np.zeros((len(P), 4)); C[:, 2] = 1; C[:, 3] = 1; pa.add(P, Ft, UVt, C)
        for i, (kind, pts, rr, ns, sgn) in enumerate(s.legs(lvl, pose)):
            box = (0.41 + (0.0 if kind == 'leg' else 0.14) + (0.07 if sgn < 0 else 0), 0.855, 0.41 + (0.0 if kind == 'leg' else 0.14) + (0.07 if sgn < 0 else 0) + 0.065, 0.995)
            V, Fl, UVl = s.tube(pts, rr, ns, box); C = np.zeros((len(V), 4)); C[:, 3] = 1; pa.add(V, Fl, UVl, C)
        for (P, Fc, UVc, nrm) in s.crest(lvl, pose):
            Fc = orient(P, Fc, lambda c, k, n=nrm: n); C = np.zeros((len(P), 4)); C[:, 3] = 1; pa.add(P, Fc, UVc, C)
        return pa.arrays()

    # ------------------------------------------------------------------------------------ the dense source: relief, cut-outs, colour
    def pal(s, k, d=None):
        c = s.sp['colours']; return np.array(c.get(k, c.get(d, [1, 0, 1])) if d else c[k], float)
    def extras(s, typ): return [e for e in s.sp.get('extras', []) if e['type'] == typ]
    def body_colour(s, A, TH):
        L = s.L; c = s.sp['colours']; up = -np.cos(TH); lat = np.abs(np.sin(TH)); t = A / s.A
        n = len(A); col = np.zeros((n, 3))
        upper, under, rump, breast = s.pal('upper'), s.pal('under'), s.pal('rump', 'upper'), s.pal('breast', 'under')
        back = upper[None] * (1 - sm((0.25 - t) / 0.2))[:, None] + rump[None] * sm((0.25 - t) / 0.2)[:, None]
        if 'scapulars' in c: back = back + (s.pal('scapulars') - back) * (sm((t - 0.55) / 0.15) * sm((0.95 - t) / 0.1) * sm((0.55 - up) / 0.3) * sm((up - 0.05) / 0.2))[:, None]
        bel = under[None] + (breast - under)[None] * sm((t - 0.55) / 0.2)[:, None]
        if 'vent' in c: bel = bel + (s.pal('vent') - bel) * sm((0.2 - t) / 0.12)[:, None]
        w_up = sm((up + 0.05) / 0.4)[:, None]; col = bel * (1 - w_up) + back * w_up
        # neck
        neck = (A > 0.95 * s.A) & (A <= s.a_head)
        nape = s.pal('nape', 'crown') if s.Ln > 0.05 * L else s.pal('nape', 'upper'); fore = s.pal('throat') * 0.5 + breast * 0.5 if s.Ln > 0.05 * L else s.pal('throat')
        if 'nape' not in c and s.Ln > 0.05 * L: nape = s.pal('upper')
        wn = sm((up + 0.1) / 0.3)[:, None]; cn = fore[None] * (1 - wn) + nape[None] * wn
        tn = sm((A - 0.95 * s.A) / max(1e-6, 0.3 * (s.a_head - 0.95 * s.A) + 0.02 * L))[:, None]; col = np.where(neck[:, None], col * (1 - tn) + cn * tn, col)
        # head
        hd = (A > s.a_head) & (A <= s.a_bill); crown, face, throat = s.pal('crown'), s.pal('face'), s.pal('throat')
        ch = face[None] * np.ones((n, 1))
        ch = np.where((up > 0.38)[:, None], crown[None], ch); ch = np.where((up < -0.32)[:, None], throat[None], ch)
        ch = ch * 0.999 + 0.001
        # soft edges between them
        wc = sm((up - 0.28) / 0.2)[:, None]; wt = sm((-0.22 - up) / 0.2)[:, None]; ch = face[None] * (1 - wc - wt).clip(0, 1) + crown[None] * wc + throat[None] * wt
        if 'forehead' in c: ch = np.where(((A > s.a_bill - 0.5 * s.R) & (up > -0.4))[:, None], s.pal('forehead')[None], ch)
        if 'brow' in c: ch = np.where(((np.abs(up - 0.3) < 0.09) & (A > s.a_head + 0.3 * s.R))[:, None], s.pal('brow')[None], ch)
        th_ = sm((A - s.a_head) / (0.3 * s.R))[:, None]; col = np.where(hd[:, None], col * (1 - th_) + ch * th_, col)
        # the eye: a disc on each side of the head
        ae = s.a_head + 1.25 * s.R; eyeR = (0.16 if not s.extras('bigeye') else 0.3) * s.R; the = math.acos(-0.25)
        de = np.hypot(A - ae, s.R * np.minimum(np.abs(TH - the), np.abs(TH - (2 * math.pi - the))))
        for e in s.extras('mask'): col = np.where(((np.abs(up - 0.12) < 0.14) & (A > s.a_head + 0.2 * s.R) & (A < s.a_bill + 0.02 * L))[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('eyering'): col = np.where((de < eyeR * 1.8)[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('bigeye'): col = np.where((de < eyeR * 1.6)[:, None], np.array(e['colour'])[None], col)
        col = np.where((de < eyeR)[:, None], s.pal('eye')[None], col); col = np.where((de < eyeR * 0.5)[:, None], np.array([0.02, 0.02, 0.02])[None], col)
        # bill and cere
        bl = A > s.a_bill; col = np.where(bl[:, None], s.pal('bill')[None], col)
        if 'cere' in c: col = np.where((bl & (A < s.a_bill + 0.22 * s.Lb) & (up > -0.2))[:, None], s.pal('cere')[None], col)
        # marks
        for e in s.extras('streaks'):
            z = e.get('zone', 'upper'); m = np.zeros(n, bool)
            ph = TH * e.get('n', 8) / math.pi; stripe = np.abs(ph - np.round(ph)) < 0.16 + 0.1 * hsh(np.round(ph), (A / (0.03 * L)).astype(int))
            brk = hsh(np.round(ph), (A / (0.05 * L)).astype(int)) > 0.3
            if z == 'upper': m = (up > 0.15) & (A < 0.95 * s.A) & (A > 0.1 * s.A)
            elif z == 'breast': m = (up < -0.1) & (A > 0.4 * s.A) & (A < s.a_head)
            elif z == 'head': m = (A > 0.9 * s.A) & (A < s.a_bill) & (up > -0.3)
            col = np.where((m & stripe & brk)[:, None], np.array(e['colour'])[None] * 0.7 + col * 0.3, col)
        for e in s.extras('spots'):
            z = e.get('zone', 'all'); k = e.get('n', 12); gi, gj = np.floor(A / (L / (k * 2.2))), np.floor(TH * k / math.pi)
            ca = (gi + 0.5 + 0.4 * (hsh(gi, gj, 1) - 0.5)) * L / (k * 2.2); ct = (gj + 0.5 + 0.4 * (hsh(gi, gj, 2) - 0.5)) * math.pi / k
            d = np.hypot((A - ca) / (L / (k * 2.2)), (TH - ct) / (math.pi / k)); spot = (d < 0.22) & (hsh(gi, gj, 3) > 0.25)
            m = np.ones(n, bool) if z == 'all' else (up > 0.1) if z == 'upper' else (up < -0.1)
            m &= A < s.a_bill
            col = np.where((m & spot)[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('necklace'):
            lineA = s.a_head + 0.2 * s.R - (up + 0.3) * 0.9 * s.R
            col = np.where(((np.abs(A - lineA) < 0.12 * s.R) & (up < 0.2) & (A > 0.85 * s.A) & (A < s.a_bill))[:, None], np.array(e['colour'])[None], col)
            ms = (np.abs(up - 0.1) < 0.1) & (A > s.a_head + 0.4 * s.R) & (A < s.a_bill); col = np.where(ms[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('flankbars'):
            m = (np.abs(up) < 0.35) & (lat > 0.6) & (t > 0.2) & (t < 0.75); ph = (A / (s.A / e.get('n', 8)) + 0.3 * up) % 1
            col = np.where((m & (ph < 0.18))[:, None], np.array(e['colour'])[None], col); col = np.where((m & (ph >= 0.18) & (ph < 0.32))[:, None], np.array(e['colour2'])[None], col)
        for e in s.extras('gorget'):
            col = np.where(((np.abs(A - (s.a_head - 0.1 * s.R)) < 0.12 * s.R) & (up < -0.1))[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('collar'):
            col = np.where((np.abs(A - (s.A + 0.3 * s.Ln)) < 0.08 * s.Ln + 0.004 * L)[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('breastband'):
            col = np.where(((np.abs(t - 0.62) < 0.04) & (up < 0.2))[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('neckstripe'):
            col = np.where(((A > s.a_head - 0.5 * s.Ln) & (A < s.a_bill - 0.2 * s.R) & (np.abs(up - 0.0) < 0.22) & (lat > 0.5))[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('neckstreaks'):
            col = np.where(((A > s.A) & (A < s.a_head) & (up < -0.75) & ((A / (0.02 * L)) % 1 < 0.5))[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('brow'):
            col = np.where(((A > s.a_head + 0.2 * s.R) & (A < s.a_bill + 0.1 * s.R) & (np.abs(up - 0.45) < 0.15))[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('moustache'):
            col = np.where(((A > s.a_head + 0.9 * s.R) & (A < s.a_head + 1.4 * s.R) & (up < 0.05) & (up > -0.4))[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('mottle'):
            gi, gj = np.floor(A / (L / 30)), np.floor(TH * 10 / math.pi); ph = hsh(gi, gj, 7)
            fa, ft = (A / (L / 30)) % 1, (TH * 10 / math.pi) % 1; m = (A < s.a_head) & (np.hypot(fa - 0.5, (ft - 0.5) * 0.6) < 0.18 + 0.2 * ph) & (hsh(gi, gj, 8) > 0.35)
            col = np.where(m[:, None], col * 0.5 + np.array(e['colour'])[None] * 0.5, col)
        for e in s.extras('vermic'):
            m = (up < 0.4) & (up > -0.9) & (t > 0.15) & (t < 0.8); col = np.where((m & ((A / (0.006 * L)) % 1 < 0.35))[:, None], col * 0.6 + np.array(e['colour'])[None] * 0.4, col)
        for e in s.extras('sheen'):
            m = (A > 0.8 * s.A) & (A < s.a_head + 0.4 * s.R); col = np.where(m[:, None], col * 0.6 + np.array(e['colour'])[None] * 0.4, col)
        for e in s.extras('bars'):
            if e.get('zone') == 'upper': col = np.where(((up > 0.1) & (A < 0.95 * s.A) & ((A / (L / (2.5 * e.get('n', 8)))) % 1 < 0.3))[:, None], np.array(e['colour'])[None], col)
        if 'ruff' in c: col = np.where(((A > 0.9 * s.A) & (A < s.A + 0.15 * s.Ln))[:, None], s.pal('ruff')[None], col)
        # fine variation: each feather a shade lighter or darker (the scallop cells of relief_body)
        ru = A / (L / 70); cv = TH * 22 / math.pi + 0.5 * (np.floor(ru) % 2)
        col = col * (0.92 + 0.16 * hsh(np.floor(ru), np.floor(cv), 5))[:, None]
        return np.clip(col, 0, 1)
    def body_relief(s, A, TH, RX, RY):
        """the body's feathers: overlapping tips pointing back (a row every ~L/70), a shaft down each, none on the bill"""
        L = s.L; ru = A / (L / 70); row = np.floor(ru); cv = TH * 22 / math.pi + 0.5 * (row % 2); fv = cv - np.floor(cv) - 0.5
        h = 1 - ((ru + 0.8 * fv * fv) % 1); h = h + 0.25 * np.exp(-(fv / 0.06) ** 2) * h
        amp = 0.0035 * L * (A < s.a_bill - 0.05 * s.R) * (1 - 0.6 * sm((A - s.a_head) / s.R))
        if s.sp['wing'] == 'bat': amp = amp * 0.25
        k = 1 + amp * h / np.maximum(np.minimum(RX, RY), 1e-6)
        return RX * k, RY * k
    def wing_colour(s, U, Vv, side):
        c = s.sp['colours']; uw = s.sp['wrist']; n = len(U)
        vf = np.where(U < uw, 0.47 - 0.22 * U / uw, 0.25 - 0.1 * np.clip((U - uw) / (1 - uw), 0, 1))
        if s.sp['wing'] == 'bat': vf = np.full(n, 2.0)
        flight = Vv > vf; prim = U > uw
        if side > 0:
            col = np.where(flight[:, None], np.where(prim[:, None], s.pal('primaries')[None], s.pal('secondaries')[None]), s.pal('coverts')[None])
            gc = (~flight) & (Vv > vf - 0.16)
            if 'greater' in c: col = np.where(gc[:, None], s.pal('greater')[None], col)
            if 'tertials' in c: col = np.where((flight & (U < 0.12))[:, None], s.pal('tertials')[None], col)
            if 'scapulars' in c: col = np.where(((U < 0.1) & (Vv < 0.6))[:, None], s.pal('scapulars')[None], col)
            for e in s.extras('wingbar'): col = np.where((np.abs(Vv - (vf - 0.03)) < 0.035)[:, None] & (U < uw + 0.1)[:, None], np.array(e['colour'])[None], col)
            for e in s.extras('wingbars2'):
                for off in (0.05, 0.2): col = np.where((np.abs(Vv - (vf + off - 0.1)) < 0.03)[:, None] & (U < uw)[:, None], np.array(e['colour'])[None], col)
            for e in s.extras('bars'):
                if e.get('zone', 'wing') != 'wing' and e.get('zone') != 'upper': continue
                k = e.get('n', 5); ph = (U * k * 1.6 + Vv * 0.8) % 1
                m = (ph < 0.42) & (Vv > vf - 0.25) if e.get('zone', 'wing') == 'wing' else (~flight) & (((Vv * 9 + U * 3) % 1) < 0.3)
                col = np.where(m[:, None], np.array(e['colour'])[None], col)
            for e in s.extras('speculumedge'): col = np.where((flight & ~prim & ((np.abs(Vv - vf) < 0.04) | (Vv > 0.94)))[:, None], np.array(e['colour'])[None], col)
            for e in s.extras('primaryedge'): col = np.where((prim & flight & ((U * 10) % 1 < 0.35))[:, None], np.array(e['colour'])[None], col)
            for e in s.extras('flightbars'): col = np.where((flight & ((Vv * e.get('n', 6)) % 1 < 0.25))[:, None], col * 0.4 + np.array(e['colour'])[None] * 0.6, col)
            for e in s.extras('edges'):
                fu = (U * 20) % 1; col = np.where((flight & (fu < 0.12))[:, None], col * 0.55 + np.array(e['colour'])[None] * 0.45, col)
            for e in s.extras('tipband'): col = np.where((flight & (Vv > 0.88))[:, None], np.array(e['colour'])[None], col)
            for e in s.extras('spots'):
                if e.get('zone') in ('upper', 'all'):
                    gi, gj = np.floor(U * 12), np.floor(Vv * 6); d = np.hypot((U * 12 % 1) - 0.5, (Vv * 6 % 1) - 0.5)
                    col = np.where(((d < 0.18) & (hsh(gi, gj, 4) > 0.4) & ~flight)[:, None], np.array(e['colour'])[None], col)
        else:
            col = np.where(flight[:, None], s.pal('underFlight')[None], s.pal('underCoverts')[None])
            for e in s.extras('handpatch'): col = np.where((prim & flight & (Vv < 0.7))[:, None], np.array(e['colour'])[None], col)
            for e in s.extras('underbar'): col = np.where((np.abs(Vv - vf + 0.08) < 0.05)[:, None], np.array(e['colour'])[None], col)
            for e in s.extras('flightbars'): col = np.where((flight & ((Vv * e.get('n', 6)) % 1 < 0.25))[:, None], col * 0.5 + np.array(e['colour'])[None] * 0.5, col)
            for e in s.extras('bars'):
                if e.get('zone', 'wing') == 'wing':
                    k = e.get('n', 5); ph = (U * k * 1.6 + Vv * 0.8) % 1; col = np.where(((ph < 0.42) & (Vv > vf - 0.25))[:, None], np.array(e['colour'])[None], col)
            for e in s.extras('spots'):
                if e.get('zone') in ('under', 'all'):
                    d = np.hypot((U * 12 % 1) - 0.5, (Vv * 6 % 1) - 0.5); col = np.where(((d < 0.15) & ~flight)[:, None], np.array(e['colour'])[None], col)
        # each feather its own shade
        col = col * (0.93 + 0.14 * hsh(np.floor(U * 18), np.floor(Vv * (3 + 5 * (~flight))), 6 if side > 0 else 8))[:, None]
        return np.clip(col, 0, 1)
    def wing_relief_inside(s, U, Vv, side):
        """the wing's feathers: height (outward) and whether a point is on a feather (the tips cut out of the planform)"""
        w = s.sp['wing']; uw = s.sp['wrist']; nF = 20 if w != 'bat' else 1
        vf = np.where(U < uw, 0.47 - 0.22 * U / uw, 0.25 - 0.1 * np.clip((U - uw) / (1 - uw), 0, 1))
        f = (U * nF) % 1; inside = np.ones(len(U), bool)
        if w != 'bat':
            tip = 1 - 0.07 * (1 - np.sqrt(np.clip(1 - (2 * f - 1) ** 2, 0, 1)))
            inside &= Vv <= tip
            rr = {'rounded': 0.16, 'pointed': 0.06, 'sickle': 0.05, 'fingered': 0.05}.get(w, 0.08)
            corner = U > 1 - rr; inside &= ~(corner & ((((U - (1 - rr)) / rr) ** 2 + ((Vv - 0.5) / 0.52) ** 2) > 1))
            if w == 'fingered':
                n = s.sp.get('fingers', 6); fl = 0.2; uu = np.clip((U - (1 - fl)) / fl, 0, 1)
                for k in range(1, n):
                    vk = 0.08 + 0.84 * k / n; inside &= ~((np.abs(Vv - vk) < (0.42 / n) * uu ** 0.8) & (U > 1 - fl))
                umax = 1 - 0.3 * fl * ((Vv - 0.3) / 0.7) ** 2; inside &= U <= umax
        else:
            # a bat's membrane: scalloped between the finger tips, the fifth finger at u 0.45
            ph = np.where(U < 0.45, U / 0.45, 1 + (U - 0.45) / 0.55 * 2); fr = ph % 1
            inside &= Vv <= 1 - 0.28 * np.sin(math.pi * fr) * np.where(U < 0.45, 0.8, 1.0)
            inside &= ~((U > 0.9) & (Vv > 0.25 + (1 - U) * 5))
        # relief: flight feathers as vanes (a ramp across each, a shaft down its middle), coverts as scallop rows
        fl = Vv > vf
        hv = np.where(fl, (1 - f) * 0.7 + 0.5 * np.exp(-((f - 0.5) / 0.05) ** 2), 0)
        rows = (Vv / np.maximum(vf, 0.05)) * 4; fv = ((U * 26 + 0.5 * np.floor(rows)) % 1) - 0.5
        hc = np.where(~fl, 1 - ((rows + 0.6 * fv * fv) % 1), 0)
        h = hv + hc
        if w == 'bat': h = 0.3 * np.exp(-(((U * 3.2) % 1 - 0.5) / 0.05) ** 2) + 0.1 * np.sin(U * 90)
        return h * 0.0022 * s.L, inside
    def tail_colour(s, X, Wg, side):
        c = s.sp['colours']; n = len(X); col = np.tile(s.pal('tail' if side > 0 else 'underTail'), (n, 1)); ax = np.abs(X)
        for e in s.extras('tailband'): col = np.where((np.abs(Wg - e.get('at', 0.85)) < 0.08)[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('tailbars'): col = np.where(((Wg * e.get('n', 5)) % 1 < 0.28)[:, None], col * 0.4 + np.array(e['colour'])[None] * 0.6, col)
        for e in s.extras('tailT'):
            col = np.where(((Wg > 0.6) | ((ax < 0.2) & (Wg > 0.15)))[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('outertail'): col = np.where((ax > 0.75)[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('tailtips'): col = np.where((Wg > 0.86)[:, None] & (ax > 0.3)[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('tailspots'): col = np.where(((np.abs(Wg - 0.55) < 0.06) & (ax > 0.25) & (ax < 0.8))[:, None], np.array(e['colour'])[None], col)
        for e in s.extras('bars'):
            if e.get('zone', 'wing') == 'wing' and 'tailband' not in [x['type'] for x in s.sp.get('extras', [])]: col = np.where(((Wg * 3) % 1 < 0.3)[:, None], np.array(e['colour'])[None], col)
        col = col * (0.93 + 0.14 * hsh(np.floor((X + 1) * 6), 3, 9))[:, None]
        return np.clip(col, 0, 1)
    def tail_relief_inside(s, X, Wg):
        nfe = 12; f = ((X + 1) / 2 * nfe) % 1; ln = s.tail_len(X)
        tip = 1 - 0.06 * (1 - np.sqrt(np.clip(1 - (2 * f - 1) ** 2, 0, 1))) / np.maximum(ln, 0.3)
        inside = Wg <= tip
        if s.sp['tailShape'] == 'membrane': inside = np.ones(len(X), bool)
        h = (1 - f) * 0.6 + 0.5 * np.exp(-((f - 0.5) / 0.05) ** 2)
        return h * 0.002 * s.L, inside
    def build_high(s):
        """the dense source in flight: (V, F, C) with the plumage as C"""
        pa = Parts()
        V, F, UV, (A, TH) = s.body('high', 'fly', None, extra=s.body_relief)
        cb = s.body_colour(np.concatenate([A, [A.min(), A.max()]]), np.concatenate([TH, [0, 0]]))
        pa.add(V, F, None, np.concatenate([cb, np.ones((len(V), 1))], 1))
        # the eyes: dark glossy spheres set into the head
        ae = s.a_head + 1.25 * s.R; rx, ry, cy = s.prof(ae); eyeR = (0.16 if not s.extras('bigeye') else 0.3) * s.R
        sa, sy, sz, sang = s.spine('fly'); ey, ez, ea = np.interp(ae, sa, sy), np.interp(ae, sa, sz) + s.z_tr, np.interp(ae, sa, sang); the = math.acos(-0.25)
        for sgn in (1, -1):
            Yl = cy - ry * math.cos(the); c = np.array([sgn * rx * math.sin(the) * 0.97, ey + Yl * math.cos(ea), ez - Yl * math.sin(ea)]); th, ph = np.meshgrid(np.linspace(0, math.pi, 9), np.linspace(0, 2 * math.pi, 13), indexing='ij')
            P = c + eyeR * 0.9 * np.stack([np.sin(th) * np.cos(ph), np.cos(th), np.sin(th) * np.sin(ph)], -1).reshape(-1, 3)
            Fe = orient(P, grid_faces(8, 12), lambda cc, k, cen=c: cc - cen); ce = np.tile(np.append(s.pal('eye'), 1), (len(P), 1)); ce[:, :3] *= 0.6; pa.add(P, Fe, None, ce)
        for sgn in (1, -1):
            for (P, Fw, UVw, U, Vv, side) in s.wing('high', 'fly', sgn, high=True):
                h, inside = s.wing_relief_inside(U, Vv, side); P = P + np.outer(side * h, [0, 1, 0])
                nv = 65; keep = []
                for f in Fw:
                    if inside[f].all(): keep.append(f)
                keep = orient(P, keep, lambda c, k, sd=side: np.array([0, sd, 0]))
                pa.add(P, keep, None, np.concatenate([s.wing_colour(U, Vv, side), np.ones((len(P), 1))], 1))
        for (P, Ft, UVt, X, Wg, side) in s.tail('high', 'fly', high=True):
            h, inside = s.tail_relief_inside(X, Wg); P = P + np.outer(side * h, [0, 1, 0])
            keep = orient(P, [f for f in Ft if inside[f].all()], lambda c, k, sd=side: np.array([0, sd, 0]))
            pa.add(P, keep, None, np.concatenate([s.tail_colour(X, Wg, side), np.ones((len(P), 1))], 1))
        c = s.sp['colours']
        for (kind, pts, rr, ns, sgn) in s.legs('high', 'fly'):
            V, Fl, _ = s.tube(pts, rr, 10, (0, 0, 1, 1)); col = s.pal('feet', 'legs') if kind == 'toe' else s.pal('legs')
            pa.add(V, Fl, None, np.tile(np.append(col, 1), (len(V), 1)))
        for (P, Fc, UVc, nrm) in s.crest('high', 'fly'):
            n = len(P); uu = np.linspace(0, 1, 41).repeat(21) if n == 41 * 21 else np.zeros(n)
            col = np.tile(s.pal('crest', 'crown') if 'crest' in c or not s.sp.get('ears') else s.pal('upper'), (n, 1))
            if s.sp.get('ears'): col = np.tile(s.pal('face'), (n, 1))
            vv = np.tile(np.linspace(0, 1, 21), 41) if n == 41 * 21 else np.zeros(n)
            for e in s.extras('cresttips'): col = np.where((vv > 0.8)[:, None], np.array(e['colour'])[None], col)
            Fc2 = orient(P, Fc, lambda cc, k, nn=nrm: nn); pa.add(P, Fc2, None, np.concatenate([col, np.ones((n, 1))], 1))
        return pa.arrays()

# ------------------------------------------------------------------------------------------------------------- main
dev = reset(job.get('device', 'CPU'), job.get('threads', 0))
os.makedirs(job['out'], exist_ok=True); stats = {}
for sid in job['ids']:
    t0 = time.time(); sp = REG['species'][sid]; b = Bird(sp); L = b.L; bk = REG['bake']
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
    for im in list(bpy.data.images): bpy.data.images.remove(im)
    Vh, Fh, _, Ch = b.build_high(); high = mesh_object('high', Vh, Fh, None, Ch)
    lv = {}
    for lvl in (0, 1, 2):
        V, F, UV, C = b.build(lvl, 'fly'); lv[f'fly{lvl}'] = mesh_object(f'fly{lvl}', V, F, UV, C)
    if b.stand:
        for lvl in (0, 1):
            V, F, UV, C = b.build(lvl, 'stand'); V = V.copy(); V[:, 1] -= V[:, 1].min(); lv[f'stand{lvl}'] = mesh_object(f'stand{lvl}', V, F, UV, C)
    for o in lv.values(): triangulate(o)
    n = REG['tex'][sp.get('tex', 'small')]
    bkr = Baker(high, lv['fly0'], n, cage=bk['cage_per_len'] * L, ray=bk['ray_per_len'] * L, ao_dist=bk['ao_per_len'] * L, margin=bk['margin'])
    nrm = bkr.bake('NORMAL', bk['normal_samples'])
    ao = bkr.bake('AO', bk['ao_samples'])
    col = bkr.bake('EMIT', bk['emit_samples'], mat=emit_mat('plumage'))
    cov = bkr.bake('EMIT', 1, mat=emit_mat('cover', const=(1, 1, 1)), margin=0)
    alpha = (cov[:, 0] > 0.5).astype(np.float64)
    rgb = dilate_alpha_rgb(np.clip(col[:, :3], 0, 1), alpha, n, n)  # (the palette is sRGB already: written as it is)
    q_a = save_png(os.path.join(job['out'], f'{sid}_albedo.png'), np.concatenate([rgb, alpha[:, None]], 1), n)
    pk = nrm.copy(); pk[:, 3] = ao[:, 0]; q_n = save_png(os.path.join(job['out'], f'{sid}_nrm.png'), pk, n)
    bpy.data.objects.remove(high, do_unlink=True)
    order = [k for k in ('fly0', 'fly1', 'fly2', 'stand0', 'stand1') if k in lv]
    export_glb(os.path.join(job['out'], f'{sid}.glb'), [lv[k] for k in order])
    Vf, _, _, _ = b.build(0, 'fly')
    stats[sid] = {'tris': {k: tris(lv[k]) for k in order}, 'tex': n, 'L': L, 'S': b.S, 'sx': b.sx, 'half': b.half,
                  'cover': float(alpha.mean()), 'ao_mean': float(q_n[:, 3].mean() / 255), 'high_tris': len(Fh), 'seconds': round(time.time() - t0, 1), 'device': dev,
                  'bbox_fly': [Vf.min(0).tolist(), Vf.max(0).tolist()]}
    log(sid, json.dumps(stats[sid]))
json.dump(stats, open(os.path.join(job['out'], 'stats_' + '_'.join(job['ids'][:1]) + f'_{len(job["ids"])}.json'), 'w'), indent=1)
log('done', len(stats))
