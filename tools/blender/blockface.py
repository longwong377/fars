# PARSA (D-321): the dressed stone's block-face detail set, carved and baked in Blender.
#   blender -b --factory-startup --python tools/blender/blockface.py -- <job.json>
# job: { "spec": tools/blender/blockface.json, "out_dir", "device": "CPU"|"GPU", "only": [layer ids] | null, "preview": bool }
# For each layer of the spec:
#  1. carves its surface in numpy (Blender's own Python): a quarry-rough face (band-limited periodic noise) lowered by tool
#     strokes, each the tool's profile swept along the stroke (toothed chisel: a shallow arc along the stroke, the teeth's
#     ridges across it, the facet tilted; flat chisel: no teeth; point: a V groove deepest where the point entered), the
#     surface the minimum of the face and every cut (material removal: the order of the strokes does not matter), then
#     rubbed (the peaks above a local mean lowered). Strip layers carve 16 arris strips: margin strokes along the arris and
#     conchoidal chips at it (Poisson along the arris), or (rough) a pitched irregular arris and larger spalls;
#  2. builds the carved surface as a mesh (a vertex per texel, 1 mm, with a wrapped margin so normals and AO tile) and a flat
#     plane over the tile, and bakes with Cycles, selected to active: tangent-space normals and ambient occlusion;
#  3. packs RGBA (normal x, normal y, 0.5 + h / hscale, AO), quantised (round half up), rows in the heightfield's order (row 0
#     = v 0), writes <out_dir>/<id>.png and the layer's statistics (<out_dir>/blockface_stats.json).
import bpy, sys, json, os, time, math, zlib, struct
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0]))
spec = json.load(open(job['spec']))
R, S, MPX = spec['res'], spec['size_m'], spec['margin_px']
PX_MM = S * 1000.0 / R  # millimetres per texel (1.0)
OUT = job['out_dir']; os.makedirs(OUT, exist_ok=True)
log = lambda *a: print('[blockface]', *a, flush=True)
t0 = time.time()

fx = np.fft.fftfreq(R)  # cycles per texel
F2 = fx[:, None] ** 2 + fx[None, :] ** 2

def noise2(rng, lam_lo, lam_hi, slope=1.0):
    """periodic band-limited noise, unit sd; wavelengths lam_lo..lam_hi (texels)"""
    f = np.sqrt(F2); f[0, 0] = 1.0
    filt = f ** (-slope) * np.exp(-(f * lam_lo) ** 2) * (1.0 - np.exp(-(f * lam_hi) ** 2)); filt[0, 0] = 0.0
    n = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((R, R))) * filt))
    return n / max(n.std(), 1e-12)

def noise1(rng, n, lam_lo, lam_hi):
    f = np.abs(np.fft.fftfreq(n)); f[0] = 1.0
    filt = f ** -1.0 * np.exp(-(f * lam_lo) ** 2) * (1.0 - np.exp(-(f * lam_hi) ** 2)); filt[0] = 0.0
    x = np.real(np.fft.ifft(np.fft.fft(rng.standard_normal(n)) * filt))
    return x / max(x.std(), 1e-12)

def blur(h, sigma):
    return np.real(np.fft.ifft2(np.fft.fft2(h) * np.exp(-2.0 * (np.pi * sigma) ** 2 * F2)))

def carve(h, cx, cy, ang, L, W, cut, rows=None):
    """lower h by one stroke: centre (cx, cy) texels, direction ang, length L and width W (texels); cut(u, v) the tool's
    surface (mm) in the stroke's frame (u along, v across, texels from the centre); anti-aliased footprint; periodic.
    `rows`: limit to texel rows [r0, r1) (a strip), no wrap in v"""
    r = int(math.ceil(0.5 * math.hypot(L, W))) + 2
    x0, y0 = int(math.floor(cx)) - r, int(math.floor(cy)) - r
    xs, ys = np.arange(x0, x0 + 2 * r + 1), np.arange(y0, y0 + 2 * r + 1)
    if rows is not None:
        ys = ys[(ys >= rows[0]) & (ys < rows[1])]
        if ys.size == 0: return
    dx, dy = (xs + 0.5 - cx)[None, :], (ys + 0.5 - cy)[:, None]
    c, s = math.cos(ang), math.sin(ang)
    u, v = dx * c + dy * s, -dx * s + dy * c
    m = np.clip(L / 2 + 0.5 - np.abs(u), 0, 1) * np.clip(W / 2 + 0.5 - np.abs(v), 0, 1)
    if not m.any(): return
    ix, iy = np.ix_(ys % R, xs % R)
    sub = h[ix, iy]
    z = cut(u, v)
    h[ix, iy] = sub - m * np.maximum(0.0, sub - z)

def seeds_voronoi(rng, lo, hi):
    """periodic patch seeds ~ lo..hi texels apart: positions and a nearest-seed query"""
    n = max(4, int(R * R / (0.5 * (lo + hi)) ** 2))
    P = rng.uniform(0, R, (n, 2))
    def nearest(q):  # q: (m, 2) texels -> seed index (wrapped distance)
        d = np.abs(q[:, None, :] - P[None, :, :]); d = np.minimum(d, R - d)
        return np.argmin((d ** 2).sum(-1), axis=1)
    return P, nearest

def strokes_in_patches(rng, P, nearest, dirs, W, L, rowK, alongK, reach):
    """stroke centres in rows along each patch's direction, kept where the centre lies in that patch"""
    out = []
    for k, (px, py) in enumerate(P):
        th = dirs[k]; c, s = math.cos(th), math.sin(th)
        rs, al = rowK * np.mean(W), alongK * np.mean(L)
        nr, na = int(reach / rs) + 1, int(reach / al) + 1
        J, I = np.meshgrid(np.arange(-na, na + 1), np.arange(-nr, nr + 1))
        a = J * al + rng.uniform(-0.18, 0.18, J.shape) * al + (I % 2) * 0.5 * al
        b = I * rs + rng.uniform(-0.1, 0.1, I.shape) * rs
        q = np.stack([px + a * c - b * s, py + a * s + b * c], -1).reshape(-1, 2) % R
        keep = nearest(q) == k
        for (x, y) in q[keep]: out.append((x, y, th + rng.normal(0, 0.05)))
    return out

def claw_face(rng, C, base, h):
    """toothed-chisel strokes over h (in place): each stroke cuts to the dressed plane `base` (+ the facet's tilt, − the arc
    along the stroke), its teeth leaving ridges `g` mm high every `pitch` mm across"""
    P, nearest = seeds_voronoi(rng, *C['patch'])
    sgn = rng.choice([-1, 1], len(P)); dirs = np.radians(C['dir0'] * sgn + rng.normal(0, C['dirSd'], len(P)))
    S_ = strokes_in_patches(rng, P, nearest, dirs, C['W'], C['L'], C['row'], C['along'], 1.6 * C["patch"][1])
    rng.shuffle(S_)
    pitch = C['pitch'] / PX_MM
    for (x, y, th) in S_:
        W, L = rng.uniform(*C['W']) / PX_MM, rng.uniform(*C['L']) / PX_MM
        z0 = base[int(y) % R, int(x) % R]
        tu, tv = rng.normal(0, C['tilt']) * PX_MM, rng.normal(0, C['tilt']) * PX_MM
        ph, g, arc = rng.uniform(0, 1), C['g'] * rng.uniform(0.7, 1.2), C['arc'] * rng.uniform(0.6, 1.4)
        def cut(u, v, z0=z0, tu=tu, tv=tv, ph=ph, g=g, arc=arc, L=L):
            t = np.abs(((v / pitch + ph) % 1.0) - 0.5) * 2.0          # 1 at a tooth's centre line ... 0 midway between teeth
            ridge = g * (1.0 - t) ** 2                                 # the ridge left between two teeth
            return z0 + tu * u + tv * v - arc * (1.0 - (2.0 * u / L) ** 2) + ridge
        carve(h, x, y, th, L, W, cut)
    return len(S_)

def flat_face(rng, Fp, C, base, h):
    P, nearest = seeds_voronoi(rng, *C['patch'])
    # the flat chisel works across the claw's strokes, in rows whose direction wanders slowly over the face (no patch edges)
    field = noise2(rng, 250, 1400)
    dirs = np.radians(Fp.get('dir0', 0) + 50.0 * field[P[:, 1].astype(int) % R, P[:, 0].astype(int) % R])
    S_ = strokes_in_patches(rng, P, nearest, dirs, Fp['W'], Fp['L'], Fp['row'], Fp['along'], 1.6 * C["patch"][1])
    skip = rng.uniform(0, 1, len(P)) > Fp['cover']  # patches the flat chisel did not pass
    n = 0
    for (x, y, th) in S_:
        if skip[nearest(np.array([[x, y]]))[0]]: continue
        W, L = rng.uniform(*Fp['W']) / PX_MM, rng.uniform(*Fp['L']) / PX_MM
        z0 = base[int(y) % R, int(x) % R] - 0.05
        tu, tv, arc = rng.normal(0, Fp['tilt']) * PX_MM, rng.normal(0, Fp['tilt']) * PX_MM, Fp['arc'] * rng.uniform(0.6, 1.4)
        # the blade's corners rounded and the stroke run out at its end: the cut shallower toward its sides and its end, so the
        # facets' edges are soft steps, not a patchwork of rectangles
        carve(h, x, y, th, L, W, lambda u, v, z0=z0, tu=tu, tv=tv, arc=arc, L=L, W=W: z0 + tu * u + tv * v - arc * (1.0 - (2.0 * u / L) ** 2)
              + Fp.get('side', 0.12) * (2.0 * v / W) ** 4 + Fp.get('side', 0.12) * np.clip(2.0 * u / L - 0.4, 0, 1) ** 2)
        n += 1
    return n

def rub(h, amount, sigma=6.0, off=0.04):
    ref = blur(h, sigma) + off
    return h - amount * np.maximum(0.0, h - ref)

def layer_claw(L, rng):
    C = L['claw']
    base = noise2(rng, 90, 700) * C['base']                            # the face's flatness: ±base mm over 0.1-0.7 m
    h = base + C['rough'] * (1.2 + np.abs(noise2(rng, 6, 60)))         # the face as the point left it, above the plane
    n = claw_face(rng, C, base, h)
    info = {'strokes': n}
    if L['kind'] == 'flat':
        info['flat_strokes'] = flat_face(rng, L['flat'], C, base, h)
        h = rub(h, L['flat']['rub'])
    h = rub(h, C['rub'])
    return h, info

def layer_point(L, rng):
    Pp = L['point']
    base = noise2(rng, Pp['baseLam'][0], Pp['baseLam'][1]) * Pp['base']
    h = base + 3.5 + np.abs(noise2(rng, 20, 120)) * 1.5
    # the strikes: scattered (Poisson), each driven along a direction that wanders slowly over the face (the mason's stance) with
    # its own scatter, lengths and depths varied: a pocked face of short grooves, no rows or patch edges
    field = noise2(rng, 180, 900)
    n = int(R * R / Pp['area'])
    X, Y = rng.uniform(0, R, n), rng.uniform(0, R, n)
    th = np.radians(Pp['dir0'] + Pp['dirSd'] * field[Y.astype(int), X.astype(int)] + rng.normal(0, Pp['scatter'], n))
    S_ = list(zip(X, Y, th))
    for (x, y, th) in S_:
        W, Ln, D = rng.uniform(*Pp['W']) / PX_MM, rng.uniform(*Pp['L']) / PX_MM, rng.uniform(*Pp['depth'])
        z0 = base[int(y) % R, int(x) % R] + 0.6
        def cut(u, v, z0=z0, W=W, Ln=Ln, D=D):
            prof = np.clip(0.5 - u / Ln, 0, 1) ** 0.6                 # deepest where the point entered (u = −L/2), out at the end
            return z0 - D * prof * np.clip(1.0 - np.abs(2.0 * v / W), 0, 1) ** 1.3
        carve(h, x, y, th, Ln, W, cut)
    return h, {'strikes': len(S_)}

def chip_cut(a, b, D, ph):
    """a conchoidal chip at the arris (v = 0): a shell-shaped scoop a (along) by b (into the face) mm, D mm deep at the arris,
    its inner rim a small hinge step, faint ripple rings round the point of impact"""
    def cut(u, v):
        rr = np.sqrt((u / a) ** 2 + (np.maximum(v, 0) / b) ** 2)
        inside = rr < 1.0
        depth = D * np.clip(1.0 - rr, 0, 1) ** 1.4 + 0.12 * D * inside
        ripple = 0.06 * D * np.sin(2 * np.pi * (rr * 3.2 + ph)) * np.clip(1.0 - rr, 0, 1)
        return np.where(inside, -(depth + ripple), 1e3)
    return cut

def layer_strip(L, rng):
    St, rows, spx = L['strip'], spec['strip_rows'], spec['strip_px']
    h = np.zeros((R, R))
    V = (np.arange(R) % spx + 0.5)[:, None] * PX_MM * np.ones((1, R))  # mm from the arris
    info = {'chips': 0, 'margin_strokes': 0}
    for r in range(rows):
        r0, r1 = r * spx, (r + 1) * spx
        if 'margin' in St:  # the margin: flat/claw strokes along the arris, cut from a pre-dressed band down to the face's plane
            M = St['margin']
            pre = M['pre'] * (1.0 + 0.5 * noise1(rng, R, 8, 80))[None, :] * np.clip((M['end'] - V[r0:r1]) / 6.0, 0, 1)
            h[r0:r1] += np.maximum(pre, 0)
            pitch = M['pitch'] / PX_MM
            for vc in M['rows']:
                x0 = rng.uniform(0, R); x = x0
                while x < x0 + R + 40:  # once round the (periodic) strip, overlapping where it closes
                    W, Ln = rng.uniform(*M['W']) / PX_MM, rng.uniform(*M['L']) / PX_MM
                    th = rng.normal(0, 0.03); ph, g, arc = rng.uniform(0, 1), M['g'] * rng.uniform(0.6, 1.2), M['arc'] * rng.uniform(0.6, 1.4)
                    tu, tv = rng.normal(0, 0.004) * PX_MM, rng.normal(0, 0.004) * PX_MM
                    def cut(u, v, tu=tu, tv=tv, ph=ph, g=g, arc=arc, Ln=Ln):
                        t = np.abs(((v / pitch + ph) % 1.0) - 0.5) * 2.0
                        return tu * u + tv * v - arc * (1.0 - (2.0 * u / Ln) ** 2) + g * (1.0 - t) ** 2
                    # the first row is worked right to the arris (its stroke overhangs it): no lip is left standing at the joint,
                    # where the neighbouring block's face continues at the same level
                    vcj = W * PX_MM / 2 - 1.0 if vc == M['rows'][0] else vc + rng.normal(0, 1.2)
                    carve(h, x % R, r0 + vcj / PX_MM, th, Ln, W, cut, rows=(r0, r1)); info['margin_strokes'] += 1
                    x += Ln * rng.uniform(0.62, 0.8)
        if 'pitch' in St:  # the pitched arris: an irregular bevel knocked off along the whole edge
            Pc = St['pitch']; c = Pc['c'][0] + (Pc['c'][1] - Pc['c'][0]) * np.clip(0.5 + 0.35 * noise1(rng, R, 10, 300), 0, 1)
            vv = V[r0:r1]; h[r0:r1] = np.minimum(h[r0:r1], -np.maximum(c[None, :] - vv, 0) * Pc['slope'] + 0.0)
            h[r0:r1] += 0.4 * noise2(rng, 4, 40)[r0:r1] * np.clip(1.0 - vv / (c[None, :] + 20), 0, 1)
        Ch = St['chips']; x = rng.exponential(1000.0 / Ch['rate'])
        while x < R:
            a = min(Ch['aMax'], Ch['a0'] + rng.exponential(Ch['aMean'])) / 2.0
            b = 2 * a * rng.uniform(*Ch['b']); D = b * rng.uniform(*Ch['d'])
            carve(h, x / PX_MM, r0, rng.normal(0, 0.15), 2 * a / PX_MM + 2, 2 * b / PX_MM + 2, chip_cut(a / PX_MM, b / PX_MM, D, rng.uniform()), rows=(r0, r1))
            info['chips'] += 1
            x += rng.exponential(1000.0 / Ch['rate'])
    # the far end of each strip is the plain face (h 0): the shader hands over to the face layer before it
    return h, info

# ---------------------------------------------------------------- Cycles
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; cy = sc.cycles; cy.device = 'CPU'; dev = 'CPU'
if job.get('device') == 'GPU':
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for t in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = t; prefs.get_devices(); ds = [d for d in prefs.devices if d.type == t]
            if ds:
                for d in prefs.devices: d.use = d.type == t
                cy.device = 'GPU'; dev = t; break
        except Exception as e: log('device', t, 'unavailable', e)
log('device', dev)
cy.use_denoising = False
world = bpy.data.worlds.new('bake'); sc.world = world

def build_high(h):
    """the carved surface as a grid mesh: a vertex per texel centre (1 mm), MPX texels of wrapped margin on every side"""
    n = R + 2 * MPX
    idx = (np.arange(n) - MPX) % R
    Hm = h[np.ix_(idx, idx)] / 1000.0  # metres
    X, Y = np.meshgrid((np.arange(n) - MPX + 0.5) * S / R, (np.arange(n) - MPX + 0.5) * S / R)
    co = np.stack([X, Y, Hm], -1).reshape(-1, 3).astype(np.float32)
    me = bpy.data.meshes.new('high'); me.vertices.add(n * n); me.vertices.foreach_set('co', co.ravel())
    i = np.arange(n - 1)[:, None] * n + np.arange(n - 1)[None, :]
    quads = np.stack([i, i + 1, i + 1 + n, i + n], -1).reshape(-1).astype(np.int32)
    nq = (n - 1) ** 2
    me.loops.add(nq * 4); me.loops.foreach_set('vertex_index', quads)
    me.polygons.add(nq); me.polygons.foreach_set('loop_start', np.arange(0, nq * 4, 4, dtype=np.int32))
    me.update(); me.validate(verbose=False)
    me.shade_smooth() if hasattr(me, 'shade_smooth') else me.polygons.foreach_set('use_smooth', np.ones(nq, bool))
    o = bpy.data.objects.new('high', me); sc.collection.objects.link(o)
    return o

def build_low():
    me = bpy.data.meshes.new('low')
    me.from_pydata([(0, 0, 0), (S, 0, 0), (S, S, 0), (0, S, 0)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name='UVMap')
    for li, (u, v) in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]): uv.data[li].uv = (u, v)
    o = bpy.data.objects.new('low', me); sc.collection.objects.link(o)
    mat = bpy.data.materials.new('low'); mat.use_nodes = True; me.materials.append(mat)
    tn = mat.node_tree.nodes.new('ShaderNodeTexImage'); mat.node_tree.nodes.active = tn
    for k in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'): setattr(o, k, False)
    return o, tn

def bake(kind, high, low, tn, samples):
    img = bpy.data.images.new(kind, R, R, alpha=False, float_buffer=True); img.colorspace_settings.name = 'Non-Color'
    tn.image = img
    for x in bpy.context.view_layer.objects: x.select_set(False)
    high.select_set(True); low.select_set(True); bpy.context.view_layer.objects.active = low
    cy.samples = samples
    kw = dict(type=kind, use_selected_to_active=True, cage_extrusion=0.06, max_ray_distance=0.12, margin=0, use_clear=True)
    if kind == 'NORMAL': kw.update(normal_space='TANGENT')
    t = time.time(); bpy.ops.object.bake(**kw); log('baked', kind, f'{time.time() - t:.1f} s')
    px = np.empty(R * R * 4, np.float32); img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(R, R, 4)  # Blender's rows bottom-up = v up = heightfield rows

def write_png(path, arr):
    H, W, C = arr.shape; ct = {1: 0, 3: 2, 4: 6}[C]
    raw = np.concatenate([np.zeros((H, 1), np.uint8), arr.reshape(H, W * C)], axis=1).tobytes()
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, ct, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 6)) + ch(b'IEND', b''))

stats_path = os.path.join(OUT, 'blockface_stats.json')
stats = json.load(open(stats_path)) if os.path.exists(stats_path) else {}
stats['_bake'] = {'device': dev, 'blender': bpy.app.version_string}
for L in spec['layers']:
    if job.get('only') and L['id'] not in job['only']: continue
    tl = time.time(); rng = np.random.default_rng(L['seed'])
    h, info = (layer_claw if L['kind'] in ('claw', 'flat') else layer_point if L['kind'] == 'point' else layer_strip)(L, rng)
    h = h - (np.median(h) if L['kind'] != 'strip' else 0.0)   # the face's median at 0 (strips: the plain face is 0)
    log(L['id'], 'carved', info, f'h p1 {np.percentile(h, 1):.3f} p50 {np.median(h):.3f} p99 {np.percentile(h, 99):.3f} mm', f'{time.time() - tl:.1f} s')
    world.light_settings.distance = L['ao_distance']
    high = build_high(h); low, tn = build_low()
    nrm = bake('NORMAL', high, low, tn, 1)
    ao = bake('AO', high, low, tn, spec['ao_samples'])
    bpy.data.objects.remove(high, do_unlink=True); bpy.data.objects.remove(low, do_unlink=True)
    for m in list(bpy.data.meshes):
        if m.users == 0: bpy.data.meshes.remove(m)
    q = lambda x: np.clip(np.floor(x * 255.0 + 0.5), 0, 255).astype(np.uint8)
    hv = 0.5 + h / L['hscale']
    out = np.stack([q(nrm[..., 0]), q(nrm[..., 1]), q(hv), q(ao[..., 0])], -1)
    write_png(os.path.join(OUT, L['id'] + '.png'), out)
    nx, ny = nrm[..., 0] * 2 - 1, nrm[..., 1] * 2 - 1
    st = {'kind': L['kind'], 'hscale': L['hscale'], 'ao_mean': float(ao[..., 0].mean()), 'ao_p05': float(np.percentile(ao[..., 0], 5)),
          'h_mean': float(h.mean()), 'h_sd': float(h.std()), 'h_p01': float(np.percentile(h, 1)), 'h_p99': float(np.percentile(h, 99)),
          'h_clip': float(np.mean(np.abs(h) > L['hscale'] / 2)), 'slope_sd': float(np.sqrt((nx ** 2 + ny ** 2).mean())), **info,
          'seconds': round(time.time() - tl, 1)}
    if L['kind'] == 'strip':  # per mm from the arris: the mean AO and the share of chipped texels (h < −0.3 mm)
        v = np.arange(R) % spec['strip_px']
        st['ao_by_v'] = [round(float(ao[v == k, :, 0].mean()), 4) for k in range(0, spec['strip_px'], 8)]
        st['chipped_by_v'] = [round(float((h[v == k] < -0.3).mean()), 4) for k in range(0, spec['strip_px'], 8)]
    stats[L['id']] = st
    log(L['id'], json.dumps({k: v for k, v in st.items() if not isinstance(v, list)}))
    if job.get('preview'):  # a raking-light preview (sun 12° above the face from the upper left): what the bake looks like
        n3 = np.stack([nx, ny, np.sqrt(np.clip(1 - nx ** 2 - ny ** 2, 0, 1))], -1)
        sun = np.array([-0.6, 0.55, 0.21]); sun /= np.linalg.norm(sun)
        sh = np.clip((n3 @ sun), 0, 1) * (0.6 + 0.4 * ao[..., 0])
        img = q(np.clip(sh / max(np.percentile(sh, 99), 1e-6), 0, 1))
        write_png(os.path.join(OUT, L['id'] + '_rake.png'), img[::-1, :, None][:1024, :1024])
    json.dump(stats, open(stats_path, 'w'), indent=1)
log('done', f'{time.time() - t0:.1f} s')
