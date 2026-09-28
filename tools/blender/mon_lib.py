# PARSA (D-329): helpers shared by the monuments' Blender scripts (tools/blender/ajori.py, tools/blender/naqsh.py).
# numpy only (Blender 5.0.1's Python has no scipy/PIL): periodic band-limited noise, blurs, a polygon rasteriser for the
# figures' outlines, PNG writing, the Cycles device set-up, and the height-field tile bake (a dense carved grid baked onto a
# flat plane: tangent-space normal, OpenGL, and ambient occlusion). Images are returned and written with row 0 = the TOP of
# the image (the PNG's order), i.e. Blender v = 1 first: the glTF exporter flips v (v_gltf = 1 - v_blender) and the game
# samples with flipY = false, so image top = gltf v 0 = Blender v 1.
import bpy, math, os, struct, time, zlib
import numpy as np

def log(*a): print('[mon]', *a, flush=True)

# ---------------------------------------------------------------- noise and filters (periodic, FFT)
def fgrid(H, W):
    fy, fx = np.fft.fftfreq(H), np.fft.fftfreq(W)
    return fy[:, None], fx[None, :]

def noise2(rng, H, W, lam_lo, lam_hi, slope=1.0, aniso=(1.0, 1.0)):
    """periodic band-limited noise (unit sd), wavelengths lam_lo..lam_hi texels; aniso stretches (y, x) wavelengths"""
    fy, fx = fgrid(H, W); f = np.sqrt((fy * aniso[0]) ** 2 + (fx * aniso[1]) ** 2); f[0, 0] = 1.0
    filt = f ** (-slope) * np.exp(-(f * lam_lo) ** 2) * (1.0 - np.exp(-(f * lam_hi) ** 2)); filt[0, 0] = 0.0
    n = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((H, W))) * filt))
    return n / max(n.std(), 1e-12)

def blur(a, sy, sx=None):
    """periodic Gaussian blur, sigma in texels"""
    sx = sy if sx is None else sx
    H, W = a.shape; fy, fx = fgrid(H, W)
    return np.real(np.fft.ifft2(np.fft.fft2(a) * np.exp(-2.0 * math.pi ** 2 * ((fy * sy) ** 2 + (fx * sx) ** 2))))

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0); return t * t * (3 - 2 * t)

# ---------------------------------------------------------------- outlines
def cubic(p0, p1, p2, p3, n=18):
    t = np.linspace(0, 1, n)[1:, None]
    return ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3

class Path:
    """a canvas-style path (moveTo, lineTo, bezierCurveTo, closePath) flattened into polygons"""
    def __init__(self): self.polys = []; self.cur = None
    def M(self, x, y): self.cur = [np.array([x, y], float)]; self.polys.append(self.cur); return self
    def L(self, x, y): self.cur.append(np.array([x, y], float)); return self
    def C(self, x1, y1, x2, y2, x, y):
        p0 = self.cur[-1]; pts = cubic(p0, np.array([x1, y1]), np.array([x2, y2]), np.array([x, y]))
        self.cur.extend(list(pts)); return self

def raster(polys, H, W, sx, sy, ox=0.0, oy=0.0, ss=3):
    """even-odd fill of polygons given in source units (x right, y DOWN), mapped to texels x' = ox + x*sx, y' = oy + y*sy
    (texel rows top-down); ss x ss supersampling -> coverage 0..1"""
    out = np.zeros((H * ss, W * ss), np.float32)
    edges = []
    for P in polys:
        P = np.array(P); X = (ox + P[:, 0] * sx) * ss; Y = (oy + P[:, 1] * sy) * ss
        X2, Y2 = np.roll(X, -1), np.roll(Y, -1); edges.append(np.stack([X, Y, X2, Y2], 1))
    E = np.concatenate(edges, 0)
    ys = np.arange(H * ss) + 0.5
    for r, y in enumerate(ys):
        a = E[((E[:, 1] <= y) & (E[:, 3] > y)) | ((E[:, 3] <= y) & (E[:, 1] > y))]
        if len(a) == 0: continue
        xs = np.sort(a[:, 0] + (y - a[:, 1]) * (a[:, 2] - a[:, 0]) / (a[:, 3] - a[:, 1]))
        for i in range(0, len(xs) - 1, 2):
            x0, x1 = int(max(0, math.ceil(xs[i] - 0.5))), int(min(W * ss, math.floor(xs[i + 1] - 0.5) + 1))
            if x1 > x0: out[r, x0:x1] = 1.0 - out[r, x0:x1]
    return out.reshape(H, ss, W, ss).mean((1, 3))

def disc(H, W, cx, cy, r):
    """antialiased disc coverage (texel units, rows top-down)"""
    y, x = np.mgrid[0:H, 0:W] + 0.5
    return np.clip(r + 0.5 - np.hypot(x - cx, y - cy), 0, 1)

# ---------------------------------------------------------------- images
def write_png(path, arr):
    """arr: H x W x C uint8, row 0 = image top"""
    if arr.ndim == 2: arr = arr[..., None]
    H, W, C = arr.shape; ct = {1: 0, 3: 2, 4: 6}[C]
    raw = np.concatenate([np.zeros((H, 1), np.uint8), arr.reshape(H, W * C)], axis=1).tobytes()
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, ct, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 6)) + ch(b'IEND', b''))

def q8(x): return np.clip(np.floor(np.asarray(x) * 255.0 + 0.5), 0, 255).astype(np.uint8)

def srgb(lin): lin = np.clip(lin, 0, 1); return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)
def lin(s): s = np.asarray(s, float); return np.where(s <= 0.04045, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)

# ---------------------------------------------------------------- Cycles
def cycles(device='CPU'):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; cy = sc.cycles; cy.device = 'CPU'; dev = 'CPU'
    if device == 'GPU':
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for t in ('OPTIX', 'CUDA'):
            try:
                prefs.compute_device_type = t; prefs.get_devices(); ds = [d for d in prefs.devices if d.type == t]
                if ds:
                    for d in prefs.devices: d.use = d.type == t
                    cy.device = 'GPU'; dev = t; break
            except Exception as e: log('device', t, 'unavailable', e)
    cy.use_denoising = False
    if sc.world is None: sc.world = bpy.data.worlds.new('bake')
    log('device', dev); return dev

def mesh_from_grid(name, X, Y, Z):
    """a quad grid mesh from H x W arrays of vertex coordinates"""
    H, W = Z.shape
    co = np.stack([X, Y, Z], -1).reshape(-1, 3).astype(np.float32)
    me = bpy.data.meshes.new(name); me.vertices.add(H * W); me.vertices.foreach_set('co', co.ravel())
    i = np.arange(H - 1)[:, None] * W + np.arange(W - 1)[None, :]
    quads = np.stack([i, i + 1, i + 1 + W, i + W], -1).reshape(-1).astype(np.int32); nq = (H - 1) * (W - 1)
    me.loops.add(nq * 4); me.loops.foreach_set('vertex_index', quads)
    me.polygons.add(nq); me.polygons.foreach_set('loop_start', np.arange(0, nq * 4, 4, dtype=np.int32))
    me.update(); me.validate(verbose=False); me.polygons.foreach_set('use_smooth', np.ones(nq, bool))
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o

def bake_image(kind, high, low, W, H, samples=1, cage=0.05, ray=0.1, ao_dist=None, margin=4):
    """selected-to-active bake of `high` onto `low` (whose active material has an image node set active): returns
    H x W x 4 float, row 0 = image top"""
    sc = bpy.context.scene
    img = bpy.data.images.new(kind, W, H, alpha=False, float_buffer=True); img.colorspace_settings.name = 'Non-Color'
    mat = low.active_material; tn = [n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'][0]; tn.image = img; mat.node_tree.nodes.active = tn
    for x in list(bpy.context.scene.objects):
        if x is not None: x.select_set(False)
    if high is not None: high.select_set(True)
    low.select_set(True); bpy.context.view_layer.objects.active = low
    sc.cycles.samples = samples
    if ao_dist is not None: sc.world.light_settings.distance = ao_dist
    kw = dict(type=kind, use_selected_to_active=high is not None, margin=margin, use_clear=True)
    if high is not None: kw.update(cage_extrusion=cage, max_ray_distance=ray)
    if kind == 'NORMAL': kw.update(normal_space='TANGENT')
    t = time.time(); bpy.ops.object.bake(**kw); log('baked', kind, W, 'x', H, f'{time.time() - t:.1f} s')
    px = np.empty(W * H * 4, np.float32); img.pixels.foreach_get(px); bpy.data.images.remove(img)
    return px.reshape(H, W, 4)[::-1].copy()

def bake_plane(W, H, sx, sy):
    """the flat low plane of a tile (W x H texels over sx x sy metres) with a bake material"""
    me = bpy.data.meshes.new('low')
    me.from_pydata([(0, 0, 0), (sx, 0, 0), (sx, sy, 0), (0, sy, 0)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name='UVMap')
    for li, (u, v) in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]): uv.data[li].uv = (u, v)
    o = bpy.data.objects.new('low', me); bpy.context.scene.collection.objects.link(o)
    mat = bpy.data.materials.new('low'); mat.use_nodes = True; me.materials.append(mat); mat.node_tree.nodes.new('ShaderNodeTexImage')
    for k in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'): setattr(o, k, False)
    return o

def bake_tile(h_m, sx, sy, margin_px=48, ao_dist=0.05, ao_samples=128, cage=None):
    """bake a periodic height field h_m (H x W metres, row 0 = image top) over a tile sx x sy metres: returns (normal RGB
    0..1, AO 0..1), each H x W, row 0 = top. The high mesh carries a wrapped margin so normals and AO tile."""
    H, W = h_m.shape; M = margin_px
    hb = h_m[::-1]  # Blender order: row 0 = v 0 (bottom)
    ry, rx = (np.arange(H + 2 * M) - M) % H, (np.arange(W + 2 * M) - M) % W
    Z = hb[np.ix_(ry, rx)]
    X, Y = np.meshgrid((np.arange(W + 2 * M) - M + 0.5) * sx / W, (np.arange(H + 2 * M) - M + 0.5) * sy / H)
    high = mesh_from_grid('high', X, Y, Z); low = bake_plane(W, H, sx, sy)
    ext = float(np.abs(h_m).max()) + 0.005 if cage is None else cage
    nrm = bake_image('NORMAL', high, low, W, H, 1, cage=ext, ray=2 * ext)
    ao = bake_image('AO', high, low, W, H, ao_samples, cage=ext, ray=2 * ext, ao_dist=ao_dist)
    for o in (high, low): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        if m.users == 0: bpy.data.meshes.remove(m)
    return nrm[..., :3], ao[..., 0]

def rake(nrm, ao, sun=(-0.6, 0.55, 0.3)):
    """a raking-light preview (sun from the upper left) of a baked normal + AO: grey uint8"""
    n = nrm * 2 - 1; s = np.array(sun); s = s / np.linalg.norm(s)
    sh = np.clip(n @ s, 0, 1) * (0.55 + 0.45 * ao)
    return q8(np.clip(sh / max(np.percentile(sh, 99.5), 1e-6), 0, 1))
