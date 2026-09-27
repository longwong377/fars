# PARSA tree assets (D-327), the wood: every species variant's branch skeleton (src/world/trees/model.ts, written by
# tools/blender/sources/trees_src.ts) skinned into one continuous mesh per level of detail, at the game's triangle budgets
# (LOD0: 64 segments x 6 sides x 2 = 768 triangles; LOD1: its first 16 segments, 16 x 4 x 2 = 128), with bark UVs and
# Cycles-baked occlusion:
#  - chains: consecutive segments of one branch are one tube; a branch continues into its best-aligned child that starts
#    at its end (a stem into its leader limb, a limb into its outer shoot), so a crown is a few long tapering tubes that
#    bend smoothly (Catmull-Rom through the skeleton's points), not 64 separate cylinders overlapping at every joint;
#    children start on their parent's axis (inside it) and thicken a little into a branch collar where they leave it;
#  - sides and rings are spent where they show: 12 around a trunk, 3 around a twig, more rings where a limb bends; the
#    trunk's foot flares out and splits into shallow buttresses (C); open tips close in a short cone;
#  - UVs in bark tiles of the species' scan size (src/data/tree_bark.json): around, a whole number of tiles (no seam in
#    the pattern), along, the scan's aspect kept as the branch thins; tangents along u (around), for the scan's normal map;
#  - occlusion: Cycles AO baked to the vertices (every model and a ground plane; rays `ao_dist` x H long): crotches, the
#    inner side of forks and the trunk's foot are darker. The crown's leaves are not in it (they come and go with the
#    season: the game keeps its analytic crown occlusion for them, shade.ts).
# Output: <out>/wood.json (per level and model: vertex and index ranges, measured triangles) + <out>/wood.bin (float32
# vertices: position xyz, normal xyz, tangent xyz, u, v, ao; then uint16 indices), in the game's axes (y up, metres).
#   blender -b --factory-startup --python tools/blender/trees_wood.py -- <src.json> <tree_bark.json> <out_dir> [GPU|CPU]
import bpy, sys, json, math, os, time
import numpy as np

a = sys.argv[sys.argv.index('--') + 1:]
src, bark_json, out_dir = a[0], a[1], a[2]; dev = a[3] if len(a) > 3 else 'CPU'
os.makedirs(out_dir, exist_ok=True)
J = json.load(open(src)); BARK = json.load(open(bark_json))['species']
t0 = time.time(); log = lambda *x: print('[trees_wood]', f'{time.time() - t0:6.1f}s', *x, flush=True)
BUDGET = [768, 128]   # triangles per level (model.ts TRIS: M0 x SIDES0 x 2, M1 x SIDES1 x 2)
SEGS = [None, J['models'][0]['lod1_segs']]
AO_DIST, AO_SPP = 0.06, 64

def v3(p): return np.array(p, np.float64)
def close(p, q): return float(np.linalg.norm(v3(p) - v3(q))) < 1e-5

def chains_of(segs):
    ch = []
    for i, s in enumerate(segs):
        if ch and ch[-1][-1] == i - 1 and close(s['a'], segs[i - 1]['b']) and s['level'] == segs[i - 1]['level']: ch[-1].append(i)
        else: ch.append([i])
    # a chain continues into its best-aligned child starting at its end
    starts = {}
    for k, c in enumerate(ch): starts.setdefault(tuple(np.round(v3(segs[c[0]]['a']), 5)), []).append(k)
    used, out = set(), []
    for k, c in enumerate(ch):
        if k in used: continue
        used.add(k); seq = list(c)
        while True:
            e = segs[seq[-1]]; end = tuple(np.round(v3(e['b']), 5)); de = v3(e['b']) - v3(e['a']); de /= max(1e-9, np.linalg.norm(de))
            best, bs = None, 0.35
            for j in starts.get(end, []):
                if j in used: continue
                s0 = segs[ch[j][0]]; d = v3(s0['b']) - v3(s0['a']); d /= max(1e-9, np.linalg.norm(d))
                sc_ = float(de @ d) * (0.5 + 0.5 * s0['ra'] / max(1e-6, e['rb']))
                # a tube keeps its sides from foot to tip: it continues only while the child is at least a third as thick
                if sc_ > bs and s0['ra'] >= 0.35 * segs[seq[0]]['ra']: best, bs = j, sc_
            if best is None: break
            used.add(best); seq += ch[best]
        # points and radii along the chain; a continued child keeps the smaller radius at the joint
        P = [v3(segs[seq[0]]['a'])]; R = [segs[seq[0]]['ra']]; L = [segs[seq[0]]['level']]
        for i in seq: P.append(v3(segs[i]['b'])); R.append(segs[i]['rb']); L.append(segs[i]['level'])
        for q in range(1, len(seq)):
            if segs[seq[q]]['level'] != segs[seq[q - 1]]['level']: R[q] = min(R[q], segs[seq[q]]['ra'])
        out.append({'P': np.array(P), 'R': np.array(R), 'level': L[0], 'n': len(seq), 'SL': [segs[i]['level'] for i in seq]})
    return out

def catmull(P, R, k):
    """dense polyline through P (k points per span), radii linear"""
    n = len(P); pts, rad = [], []
    for i in range(n - 1):
        p0, p1, p2, p3 = P[max(0, i - 1)], P[i], P[i + 1], P[min(n - 1, i + 2)]
        for s in range(k):
            t = s / k; t2, t3 = t * t, t * t * t
            pts.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)); rad.append(R[i] + (R[i + 1] - R[i]) * t)
    pts.append(P[-1]); rad.append(R[-1])
    pts = np.array(pts); d = np.linalg.norm(np.diff(pts, axis=0), axis=1); s = np.concatenate([[0], np.cumsum(d)])
    return pts, np.array(rad), s

def sides_for(r, f): return max(3, min(12, int(round((3 + 60 * r) * f))))

def plan(chs, budget, H, lod):
    """sides and ring stations per chain within the budget: shrink sides, then rings, until it fits"""
    for sub_l in ((3, 2, 1), (2, 2, 1), (2, 1, 1), (1, 1, 1)):
        for f in np.arange(1.0, 0.04, -0.03):
            tot = 0; plans = []
            for c in chs:
                S = sides_for(c['R'][0], f); sub = sub_l[min(2, c['level'])]
                rings = sum(sub_l[min(2, l)] for l in c['SL']) + 1 + (3 if lod == 0 and c['level'] == 0 and c['P'][0][1] < 0.05 else 0)
                cap = S if lod == 0 and c['R'][-1] > 0 else 0  # LOD1 (beyond 30-70 m): no flare rings, no tip cones
                tot += S * 2 * (rings - 1) + cap; plans.append((S, sub_l))
            if tot <= budget: return plans, tot
    raise RuntimeError(f"cannot fit {len(chs)} chains in {budget} triangles: {tot} {[(c['n'], c['SL'], c['level']) for c in chs]}")

def frame(d):
    k = np.array([0, 1, 0.0]) if abs(d[1]) < 0.9 else np.array([1, 0, 0.0])
    e1 = np.cross(d, k); e1 /= np.linalg.norm(e1); e2 = np.cross(d, e1); return e1, e2

def build(m, lod):
    segs = m['segs'] if SEGS[lod] is None else m['segs'][:SEGS[lod]]
    chs = chains_of(segs); H = m['H']; B = BARK[m['species']]; sw, sh = B['size_m']
    plans, tot = plan(chs, BUDGET[lod], H, lod)
    rng = np.random.default_rng(m['row'] * 7 + lod)
    V, I = [], []
    for c, (S, sub_l) in zip(chs, plans):
        pts, rad, s = catmull(c['P'], c['R'], 8); Ls = s[-1]
        if Ls < 1e-5: continue
        base = lod == 0 and c['level'] == 0 and c['P'][0][1] < 0.05; r0 = c['R'][0]
        # ring stations: each span of the skeleton split by its level (trunk 3, limbs 2, shoots 1 at most), at the span's
        # arc length along the smoothed curve (the dense polyline has 8 points a span)
        st = [0.0]
        for j, l in enumerate(c['SL']):
            k = sub_l[min(2, l)]; sa, sb = s[j * 8], s[(j + 1) * 8]
            st += [sa + (sb - sa) * (q + 1) / k for q in range(k)]
        if base: st = sorted(set(st + [min(Ls * 0.5, x) for x in (0.08 + 0.3 * r0, 0.08 + 0.8 * r0, 0.08 + 1.6 * r0)]))
        st = np.array(st)
        P = np.stack([np.interp(st, s, pts[:, k]) for k in range(3)], 1); Rr = np.interp(st, s, rad)
        D = np.stack([np.gradient(P[:, k], st, edge_order=1) if len(st) > 1 else np.zeros(len(st)) for k in range(3)], 1)
        D /= np.maximum(1e-9, np.linalg.norm(D, axis=1))[:, None]
        e1, e2 = frame(D[0]); C0 = 2 * math.pi * max(1e-4, Rr[0]); Nu = max(1, round(C0 / sw))
        ph = rng.uniform(0, 2 * math.pi); vacc = 0.0; b0 = len(V)
        # a shoot leaving its limb thickens a little into a collar (C); the trunk's foot flares
        for i in range(len(st)):
            if i > 0:  # parallel transport
                ax = np.cross(D[i - 1], D[i]); sa = np.linalg.norm(ax)
                if sa > 1e-8:
                    ax /= sa; ca = float(np.clip(D[i - 1] @ D[i], -1, 1)); an = math.atan2(sa, ca)
                    rot = lambda v: v * math.cos(an) + np.cross(ax, v) * math.sin(an) + ax * (ax @ v) * (1 - math.cos(an))
                    e1 = rot(e1); e2 = rot(e2)
                e1 = e1 - D[i] * (e1 @ D[i]); e1 /= np.linalg.norm(e1); e2 = np.cross(D[i], e1)
                Ci = 2 * math.pi * max(1e-4, 0.5 * (Rr[i] + Rr[i - 1]))
                vacc += (st[i] - st[i - 1]) * Nu / Ci * (sw / sh)
            r = Rr[i]; y = P[i][1]
            if c['level'] > 1: r *= 1 + 0.12 * math.exp(-st[i] / max(1e-4, Rr[0]))  # a shoot's collar (limbs leave the fork at their own size)
            flare = 0.0
            if base: flare = math.exp(-max(0.0, y) / max(0.05, 0.9 * r0))
            for k in range(S + 1):
                th = 2 * math.pi * k / S; ct, stt = math.cos(th), math.sin(th)
                lob = 1 + flare * (0.45 + 0.22 * math.cos(5 * th + ph))
                N = ct * e1 + stt * e2; Tn = -stt * e1 + ct * e2
                p = P[i] + N * r * lob
                # taper tilts the normal toward the tip
                dr = (Rr[min(i + 1, len(st) - 1)] - Rr[max(i - 1, 0)]) / max(1e-6, st[min(i + 1, len(st) - 1)] - st[max(i - 1, 0)])
                n = N - D[i] * dr; n /= np.linalg.norm(n)
                V.append((*p, *n, *Tn, Nu * k / S, vacc, 1.0))
        nr = len(st)
        for i in range(nr - 1):
            for k in range(S):
                a0, a1 = b0 + i * (S + 1) + k, b0 + i * (S + 1) + k + 1
                c0, c1 = a0 + S + 1, a1 + S + 1
                I += [a0, a1, c0, a1, c1, c0]  # counter-clockwise seen from outside (D x T points in)
        if lod == 0 and Rr[-1] > 0:  # the tip closes in a short cone
            tip = P[-1] + D[-1] * Rr[-1] * 1.5; ti = len(V)
            V.append((*tip, *D[-1], *e1, Nu * 0.5, vacc + 1.5 * Rr[-1] * Nu / (2 * math.pi * max(1e-4, Rr[-1])) * (sw / sh), 1.0))
            last = b0 + (nr - 1) * (S + 1)
            for k in range(S): I += [last + k, last + k + 1, ti]
    V = np.array(V, np.float64); I = np.array(I, np.int32)
    return V, I, len(chs)

res = []
for m in J['models']:
    for lod in (0, 1):
        V, I, nch = build(m, lod); res.append((m, lod, V, I, nch))
        if len(I) // 3 > BUDGET[lod]: raise RuntimeError(f"{m['species']}/{m['variant']} lod{lod}: {len(I)//3} > {BUDGET[lod]}")
log('meshes', ', '.join(f"{m['species']}/{m['variant']}:{lod} {len(I)//3}t/{nch}c" for m, lod, V, I, nch in res[:6]), '...')

# ---- the occlusion bake (Cycles AO to the vertices), all models at once, far apart, each on a ground plane
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; cy = sc.cycles; cy.seed = 0; cy.samples = AO_SPP
dev_used = 'CPU'
if dev == 'GPU':
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for t in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = t; prefs.get_devices(); ds = [d for d in prefs.devices if d.type == t]
            if ds:
                for d in prefs.devices: d.use = d.type == t
                cy.device = 'GPU'; dev_used = t; break
        except Exception as e: log('device', t, 'unavailable', e)
w = bpy.data.worlds.new('w'); sc.world = w
objs = []
SP = 70.0
for q, (m, lod, V, I, nch) in enumerate(res):
    ox, oy = (q % 10) * SP, (q // 10) * SP
    # game (x, y up, z) -> Blender (x, -z, y)
    co = np.stack([V[:, 0] + ox, -V[:, 2] + oy, V[:, 1]], 1).astype(np.float32)
    me = bpy.data.meshes.new(f'w{q}'); me.vertices.add(len(co)); me.vertices.foreach_set('co', co.ravel())
    nt = len(I) // 3; me.loops.add(len(I)); me.loops.foreach_set('vertex_index', I.astype(np.int32))
    me.polygons.add(nt); me.polygons.foreach_set('loop_start', np.arange(0, len(I), 3, dtype=np.int32)); me.polygons.foreach_set('loop_total', np.full(nt, 3, np.int32))
    me.update(calc_edges=True)
    ca = me.color_attributes.new('ao', 'FLOAT_COLOR', 'POINT'); me.color_attributes.active_color = ca
    mat = bpy.data.materials.new(f'm{q}'); mat.use_nodes = True; me.materials.append(mat)
    ob = bpy.data.objects.new(f'w{q}', me); sc.collection.objects.link(ob); objs.append(ob)
    g = bpy.data.meshes.new(f'g{q}'); g.from_pydata([(ox - 30, oy - 30, 0), (ox + 30, oy - 30, 0), (ox + 30, oy + 30, 0), (ox - 30, oy + 30, 0)], [], [(0, 1, 2, 3)])
    go = bpy.data.objects.new(f'g{q}', g); sc.collection.objects.link(go)
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
AO_M = []
for q, (m, lod, V, I, nch) in enumerate(res): AO_M.append(AO_DIST * m['H'])
# one bake per model (the AO distance scales with the tree's height)
for q, o in enumerate(objs):
    for p in objs: p.select_set(p is o)
    bpy.context.view_layer.objects.active = o
    w.light_settings.distance = AO_M[q]
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', use_clear=True)
log('ao baked', dev_used)
chunks_v, chunks_i, meta = [], [], {'about': 'generated by tools/blender/trees_wood.py (D-327); do not edit', 'stride': 12, 'fields': ['px', 'py', 'pz', 'nx', 'ny', 'nz', 'tx', 'ty', 'tz', 'u', 'v', 'ao'],
    'budget': BUDGET, 'ao_dist_x_H': AO_DIST, 'ao_samples': AO_SPP, 'device': dev_used, 'blender': bpy.app.version_string, 'lods': [[], []]}
vo = io_ = 0
for q, ((m, lod, V, I, nch), o) in enumerate(zip(res, objs)):
    ao = np.zeros(len(V) * 4, np.float32); o.data.color_attributes['ao'].data.foreach_get('color', ao); ao = ao.reshape(-1, 4)[:, 0]
    V = V.copy(); V[:, 11] = ao
    chunks_v.append(V.astype(np.float32)); chunks_i.append(I.astype(np.uint16))
    meta['lods'][lod].append({'row': m['row'], 'species': m['species'], 'variant': m['variant'], 'v0': vo, 'nv': len(V), 'i0': io_, 'ni': len(I), 'tris': len(I) // 3, 'chains': nch, 'ao_mean': round(float(ao.mean()), 4)})
    vo += len(V); io_ += len(I)
vb = np.concatenate(chunks_v).ravel(); ib = np.concatenate(chunks_i)
meta['vertex_floats'] = int(vb.size); meta['indices'] = int(ib.size)
with open(os.path.join(out_dir, 'wood.bin'), 'wb') as f: f.write(vb.tobytes()); f.write(ib.tobytes())
json.dump(meta, open(os.path.join(out_dir, 'wood.json'), 'w'), indent=0)
log('written', out_dir, vo, 'vertices', io_ // 3, 'triangles')
