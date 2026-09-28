# PARSA (D-330): the stone frames' trim texture, carved and baked in Blender. Run headless by tools/blender/decor.mjs:
#   blender -b --factory-startup --python tools/blender/decor_trim.py -- <job.json> <out_dir> [GPU|CPU]
# job.json (tools/blender/sources/frame_trim.ts, from src/arch/frames.ts trimLayout): the texture's rows (convex arris,
# step, cornice, flat), each row's low-poly profile (the game's own) and its place in the texture, and the high source's
# profiles (the sharp corners to round, the cornice's fine torus and gorge).
# Per strip row, one period of the frame (job.period m) plus a margin either side:
#  1. the high source: the profile with its corners rounded (convex arrises worn round, the steps' feet a fine fillet),
#     swept along x on a ~0.6 x 0.5 mm grid, displaced along its normals by carving that repeats with the period (so the
#     texture tiles along the frame): the gorge's upright round-topped tongues (job.spec tongue_pitch, tongue_relief), chips
#     knocked out of every convex arris (conchoidal scoops, 1-4 mm deep), uneven wear of the arrises, a faint polish ripple;
#  2. the low level: the game's profile swept over exactly one period, UVs u = x / period, v = the row's place;
#  3. Cycles bakes the high's tangent-space normals (selected-to-active) and its AO onto the low levels' UVs, one 2-D image
#     for all rows; the flat row is written neutral (normal up, AO 1); packed RGB = normal, A = AO, one PNG.
# Every number comes from the job (the project's data) or is a named carving constant below (C); the seed is fixed.
import bpy, bmesh, sys, json, math, os, time
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0])); out_dir = argv[1]; device = argv[2] if len(argv) > 2 else 'CPU'
os.makedirs(out_dir, exist_ok=True)
t0 = time.time(); log = lambda *a: print('[decor_trim]', *a, flush=True)
P = job['period']; W, H = job['W'], job['H']
rng = np.random.default_rng(330)
# carving constants (C): chips per metre of arris, their size range; arris wear; polish ripple; the tongues' shape
CHIPS_PER_M = {'convex': 11, 'step': 7, 'cornice': 9}
CHIP_LEN = (0.004, 0.028); CHIP_DEPTH = (0.0008, 0.0035); CHIP_ACROSS = (0.003, 0.009)
WEAR = 0.0006; RIPPLE = 0.00005
DX = P / W  # one texel along x
DS = 0.0005

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; cy = sc.cycles; cy.seed = 0; cy.use_denoising = False
dev_used = 'CPU'
if device == 'GPU':
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for t in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = t; prefs.get_devices()
            if [d for d in prefs.devices if d.type == t]:
                for d in prefs.devices: d.use = d.type == t
                cy.device = 'GPU'; dev_used = t; break
        except Exception as e: log('device', t, 'unavailable', e)
log('device', dev_used)

def round_corners(pts, rounds):
    """the polyline with the listed corners replaced by circular fillets (radius r), densified to DS"""
    pts = [np.array(p, float) for p in pts]; out = []
    rmap = {r['i']: r['r'] for r in rounds}
    for i, p in enumerate(pts):
        if i in rmap and 0 < i < len(pts) - 1:
            a, b = pts[i - 1] - p, pts[i + 1] - p; la, lb = np.linalg.norm(a), np.linalg.norm(b); a /= la; b /= lb
            ang = math.acos(max(-1, min(1, float(a @ b)))); r = rmap[i]; t = r / math.tan(ang / 2)
            pa, pb = p + a * t, p + b * t; bis = (a + b) / np.linalg.norm(a + b); cc = p + bis * (r / math.sin(ang / 2))
            a0, a1 = math.atan2(*(pa - cc)[::-1]), math.atan2(*(pb - cc)[::-1]); d = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
            n = max(4, int(abs(d) * r / (DS * 0.5)))
            for k in range(n + 1): th = a0 + d * k / n; out.append(cc + r * np.array([math.cos(th), math.sin(th)]))
        else: out.append(p)
    # densify
    dense = [out[0]]
    for q in out[1:]:
        L = np.linalg.norm(q - dense[-1]); n = max(1, int(math.ceil(L / DS)))
        for k in range(1, n + 1): dense.append(dense[-1] + (q - dense[-1]) * (1 / (n - k + 1)))
    return np.array(dense)

def normals2d(pr):
    t = np.gradient(pr, axis=0); t /= np.linalg.norm(t, axis=1)[:, None]
    return np.stack([t[:, 1], -t[:, 0]], 1)  # the right of the traversal = outside

def periodic_noise(x, s, octaves, amp):
    """smooth noise periodic in x with the period P: sums of plane waves with whole cycles per period"""
    out = np.zeros(np.broadcast(x, s).shape)
    for (kx_max, ks, a) in octaves:
        for _ in range(12):
            kx = rng.integers(1, kx_max + 1) * rng.choice([-1, 1]); ksv = rng.normal(0, ks); ph = rng.uniform(0, 2 * math.pi)
            out += a * np.cos(2 * math.pi * kx * x / P + ksv * s + ph)
    return out * amp / math.sqrt(12 * len(octaves))

def carve(row, pr, arc, x):
    """the displacement (m, along the outward normal) of the high source at (x, arc)"""
    X, S = np.meshgrid(x, arc, indexing='xy')  # (ns, nx)
    D = periodic_noise(X, S, [(60, 200, 1.0), (300, 900, 0.5)], RIPPLE)
    # the arrises: worn round unevenly, and chipped
    H_ = job['high'][row]; pts = np.array(H_['pts'], float)
    for R in H_['round']:
        i = R['i']; a, b = pts[i - 1] - pts[i], pts[i + 1] - pts[i]; convex = (a[0] * b[1] - a[1] * b[0]) < 0  # (outward on the right: the path turns left at a convex arris)
        # the arc position of the corner: the densified point nearest the sharp corner's bisector point
        k = int(np.argmin(np.linalg.norm(pr - pts[i], axis=1))); sa = arc[k]
        if not convex:
            continue
        wear = WEAR * (0.5 + 0.5 * np.clip(periodic_noise(X, 0 * S, [(12, 0, 1.0), (40, 0, 0.6)], 1.8), -1, 1))
        D -= wear * np.exp(-((S - sa) / 0.004) ** 2)
        n = rng.poisson(CHIPS_PER_M[row] * P); chip = np.zeros_like(D)  # (overlapping chips: the deeper scoop, not their sum)
        for _ in range(n):
            xc = rng.uniform(0, P); lx = rng.uniform(*CHIP_LEN) / 2; dep = rng.uniform(*CHIP_DEPTH); ls = rng.uniform(*CHIP_ACROSS)
            off = rng.normal(0, 0.0015)  # (a chip centred on the arris, a little to either face)
            for sh in (-P, 0, P):
                dx = (X - xc - sh) / lx; ds = (S - sa - off) / ls; q = 1 - dx * dx - ds * ds
                m = q > 0
                if m.any(): chip[m] = np.maximum(chip[m], dep * np.power(q[m], 0.6))
        D -= chip
    if row == 'cornice':
        # the gorge's tongues: upright leaves `tongue_pitch` apart, round-topped, `tongue_relief` proud, grooves between
        sp = job['spec']; pitch = sp['tongue_pitch']; T = sp['tongue_relief']; g0, g1 = H_['gorge']
        wt = 0.78 * pitch; s_top = g1 - 0.012; s_bot = g0 + 0.008
        xi = ((X + pitch / 2) % pitch) - pitch / 2  # distance to the nearest tongue's axis (a tongue at x = 0 mod pitch)
        hw = np.where(S < s_top - wt / 2, wt / 2, np.sqrt(np.clip((wt / 2) ** 2 - (S - (s_top - wt / 2)) ** 2, 0, None)))
        inside = (S > s_bot) & (S < s_top) & (np.abs(xi) < hw)
        prof = np.zeros_like(D); r = np.abs(xi) / np.maximum(hw, 1e-6)
        prof[inside] = T * np.power(np.clip(1 - r[inside] ** 2, 0, 1), 0.35)  # (a leaf with a softly rounded edge)
        prof *= np.clip((S - s_bot) / 0.02, 0, 1)  # (rising out of the groove above the torus)
        D += prof
    return D

objs = {}
def make_row(row, y_off):
    """the high source and the low level of one strip row, placed `y_off` m apart from the others"""
    Rj = job['rows'][row]; H_ = job['high'][row]
    pr = round_corners(H_['pts'], H_['round']); nr = normals2d(pr)
    arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pr, axis=0), axis=1))])
    x = np.arange(-0.03, P + 0.03 + DX, DX)
    D = carve(row, pr, arc, x)
    ns, nx = D.shape
    # vertices: (x, h, z) = (x, profile + n * D); the profile plane is Blender (y, z), offset in y
    Xg = np.broadcast_to(x[None, :], (ns, nx))
    Yg = pr[:, 0][:, None] + nr[:, 0][:, None] * D + y_off
    Zg = pr[:, 1][:, None] + nr[:, 1][:, None] * D
    V = np.stack([Xg, Yg, Zg], -1).reshape(-1, 3)
    idx = np.arange(ns * nx).reshape(ns, nx)
    a, b, c, d = idx[:-1, :-1].ravel(), idx[:-1, 1:].ravel(), idx[1:, 1:].ravel(), idx[1:, :-1].ravel()
    # winding: the outside on the right of the traversal (s) looking along +x: (x, s) quads ordered so the normal points out
    F = np.stack([a, d, c, b], 1)
    me = bpy.data.meshes.new(f'high_{row}'); me.vertices.add(len(V)); me.vertices.foreach_set('co', V.astype(np.float32).ravel())
    me.loops.add(F.size); me.loops.foreach_set('vertex_index', F.astype(np.int32).ravel())
    me.polygons.add(len(F)); me.polygons.foreach_set('loop_start', (np.arange(len(F)) * 4).astype(np.int32)); me.polygons.foreach_set('loop_total', np.full(len(F), 4, np.int32))
    me.update(); me.validate()
    hi = bpy.data.objects.new(f'high_{row}', me); sc.collection.objects.link(hi)
    me.shade_smooth()
    # the low level: the game's profile over one period, UVs by the row's arc mapping
    lp = np.array(Rj['pts'], float); cum = np.array(Rj['cum'], float)
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    vv = [[bm.verts.new((xx, p[0] + y_off, p[1])) for p in lp] for xx in (0.0, P)]
    vcoord = lambda k: (Rj['v0'] + cum[k] / Rj['arc'] * Rj['px']) / H
    for k in range(len(lp) - 1):
        f = bm.faces.new((vv[0][k], vv[0][k + 1], vv[1][k + 1], vv[1][k]))
        uvs = [(0, vcoord(k)), (0, vcoord(k + 1)), (1, vcoord(k + 1)), (1, vcoord(k))]
        for lo, uv in zip(f.loops, uvs): lo[uvl].uv = uv
    bm.normal_update()
    lme = bpy.data.meshes.new(f'low_{row}'); bm.to_mesh(lme); bm.free()
    lo = bpy.data.objects.new(f'low_{row}', lme); sc.collection.objects.link(lo)
    # the low's normals must face out (the high's too): check against the profile's outward normal at the first segment
    n0 = np.array(lme.polygons[0].normal); seg = lp[1] - lp[0]; want = np.array([0, seg[1], -seg[0]]); want /= np.linalg.norm(want)
    if n0 @ want < 0:
        for p in lme.polygons: p.flip()
        lme.update()
    hn = np.array(me.polygons[len(me.polygons) // 2].normal); k = ns // 2; wantk = np.array([0, nr[k, 0], nr[k, 1]])
    if hn @ wantk < 0:
        for p in me.polygons: p.flip()
        me.update()
    objs[row] = (hi, lo)
    log(row, 'high', len(V), 'verts', f'D range {D.min()*1000:.2f}..{D.max()*1000:.2f} mm', 'low', len(lme.polygons), 'faces')

for k, row in enumerate(['convex', 'step', 'cornice']): make_row(row, k * 1.0)

# one image for every row; one bake per row (selected-to-active), each writing only its own faces' texels
img_n = bpy.data.images.new('trim_nrm', W, H, alpha=False, float_buffer=True); img_n.colorspace_settings.name = 'Non-Color'
img_a = bpy.data.images.new('trim_ao', W, H, alpha=False, float_buffer=True); img_a.colorspace_settings.name = 'Non-Color'
w = bpy.data.worlds.new('bake'); sc.world = w; w.light_settings.distance = 0.04
for row, (hi, lo) in objs.items():
    m = bpy.data.materials.new(f'm_{row}'); m.use_nodes = True; tn = m.node_tree.nodes.new('ShaderNodeTexImage'); m.node_tree.nodes.active = tn
    lo.data.materials.append(m); lo['tn'] = tn.name
    for k in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'): setattr(lo, k, False)
def bake(kind, img, samples):
    cy.samples = samples; first = True
    for row, (hi, lo) in objs.items():
        tn = lo.active_material.node_tree.nodes[lo['tn']]; tn.image = img; lo.active_material.node_tree.nodes.active = tn
        for x in bpy.context.view_layer.objects: x.select_set(False)
        hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
        kw = dict(type=kind, use_selected_to_active=True, cage_extrusion=0.012, max_ray_distance=0.03, margin=12, margin_type='EXTEND', use_clear=first)
        if kind == 'NORMAL': kw.update(normal_space='TANGENT')
        t = time.time(); bpy.ops.object.bake(**kw); first = False; log('baked', kind, row, f'{time.time() - t:.1f} s')
bake('NORMAL', img_n, 4); bake('AO', img_a, 128)
pn = np.empty(W * H * 4, np.float32); img_n.pixels.foreach_get(pn); pa = np.empty(W * H * 4, np.float32); img_a.pixels.foreach_get(pa)
out = pn.reshape(H, W, 4).copy(); out[..., 3] = pa.reshape(H, W, 4)[..., 0]
# the flat row and the margins between rows: neutral (normal up, no occlusion), so a plain face and a row's far mips read flat
rows = job['rows']; filled = np.zeros(H, bool)
for r in ('convex', 'step', 'cornice'): filled[max(0, rows[r]['v0'] - 12):rows[r]['v0'] + rows[r]['px'] + 12] = True
out[~filled] = [0.5, 0.5, 1.0, 1.0]
q = np.clip(np.floor(out * 255.0 + 0.5), 0, 255).astype(np.uint8)
packed = bpy.data.images.new('frame_trim', W, H, alpha=True, float_buffer=False); packed.colorspace_settings.name = 'Non-Color'; packed.alpha_mode = 'CHANNEL_PACKED'
packed.pixels.foreach_set((q.astype(np.float32) / 255.0).ravel())
path = os.path.join(out_dir, 'frame_trim.png'); packed.filepath_raw = path; packed.file_format = 'PNG'; packed.save()
stats = {'device': dev_used, 'seconds': round(time.time() - t0, 1), 'png': path,
         'rows': {r: {'ao_mean': float(q[rows[r]['v0']:rows[r]['v0'] + rows[r]['px'], :, 3].mean() / 255), 'n_z_min': float(q[rows[r]['v0']:rows[r]['v0'] + rows[r]['px'], :, 2].min() / 255)} for r in ('convex', 'step', 'cornice')}}
json.dump(stats, open(os.path.join(out_dir, 'frame_trim_stats.json'), 'w'), indent=1)
log('done', json.dumps(stats))
