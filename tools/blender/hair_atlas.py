# PARSA asset pipeline (D-307, D-323), the people's hair: the strand atlas and the normal atlas the hair, beard and brow
# cards are textured with, rendered by Cycles from Blender hair curves. Called by hair_groom.py (render(job)), or alone:
#   blender -b --factory-startup --python tools/blender/hair_atlas.py -- <job.json>   (job = hair_groom's job['atlas'])
# job: { out_png, out_normal, size: [W, H], normal_scale, cols, rows: [{ kind, locks, strands, lock_r, curl_r, curl_pitch,
#   wave, len, width, tone_sd, fray, strays, roll, roll_r, irregular, src: { image, rect } }], samples, seed }
# The atlas is a grid of cells (rows = strand kinds, cols = eight variants of the kind with other seeds); a cell is one card:
# across its width, root (top) to tip (bottom). A cell holds a few LOCKS (clumps), each a bundle of strands round the lock's
# own axis (a disc of strands in its cross-section: front strands nearer the camera), the axis straight, waved, wound into
# a corkscrew (ringlets, curls) or rolled up at the tip (the court beard's row of curls). Structure at the scale of a lock,
# not only of a strand: the first atlas's evenly strewn strands resolved at conversation distance into noise ("stippled");
# a lock has a dense core and gaps beside it, which survive the mips.
# Every strand is a hair curve (a Blender Curves object per row, rendered as camera-facing ribbons about a pixel wide
# through an orthographic camera with a transparent film: the alpha is the strands' antialiased coverage). Emission data:
#   atlas  (out_png):    R shade (the MakeHuman CC0 hair texture's luminance at the strand's coordinates x a per-strand
#                        tone, mean ~0.5: the game multiplies by the person's hair colour); G depth (1 in front of the lock,
#                        0 behind); B the strand's direction across the card (0.5 + 0.5 x); A coverage;
#   normal (out_normal): the lock's surface normal at the strand in card space (x across, y root -> tip, z out of the card),
#                        R 0.5 + 0.5 nx, G 0.5 + 0.5 ny; B occlusion inside the lock (the core and the back strands
#                        darker); A coverage. Rendered at normal_scale of the atlas's size.
import bpy, sys, json, math, os, time, random
import numpy as np

def log(*a): print('[hair_atlas]', *a, flush=True)
def clamp01(x): return max(0.0, min(1.0, x))

def lock_axis(rng, row, CW, CH, xc, L):
    """a lock's axis as a function of t (0 root .. 1 tip): (x, y, z) in cell pixels"""
    wv = row.get('wave', 0.0) * CW; cr = row.get('curl_r', 0.0) * CW; cp = max(1e-3, row.get('curl_pitch', 0.1) * CH)
    irr = row.get('irregular', 0.0); roll = row.get('roll', 0.0); r0 = CW * row.get('roll_r', 0.05) * rng.uniform(0.8, 1.2)
    # sync: every lock of the cell curls in phase (the court beard's stacked rows of curls, the reliefs' convention)
    ph = rng.uniform(0, 2 * math.pi) if not row.get('sync') else 0.3 * rng.gauss(0, 1); sway = rng.uniform(0, 2 * math.pi); rdir = rng.choice((-1, 1))
    wf = [(rng.uniform(0.7, 2.5), rng.uniform(0, 2 * math.pi)) for _ in range(3)]
    wander = lambda t, s: sum(math.sin(2 * math.pi * f * t * (1 + s) + p) for f, p in wf) / 3
    y0 = CH * rng.uniform(0, row.get('root_jitter', 0.03)); drift = rng.gauss(0, row.get('drift', 0.04) * CW)
    def axis(t):
        tt = min(t, 1 - roll) if roll > 0 else t
        y = y0 + tt * L
        x = xc + wv * math.sin(2 * math.pi * tt * 1.3 + sway) + drift * tt * tt
        z = 0.0
        if roll > 0 and t > 1 - roll:  # the tip rolled up into a snail curl in the card's plane (the court beard's row of curls)
            u = (t - (1 - roll)) / roll; a = u * 2 * math.pi * row.get('roll_turns', 1.6); rr = r0 * (1 - 0.75 * u)
            x += rdir * rr * math.sin(a); y += rr * (1 - math.cos(a)); z += 2.0 * math.sin(a * 0.5)
        return x, y, z
    # the curl (a lock's strands wind round its axis together, a corkscrew; its radius and pitch wander: real curls are not
    # springs): the angle and radius at t, for a strand of phase offset dph
    def curl(t, dph):
        tt = min(t, 1 - roll) if roll > 0 else t
        a = ph + dph + 2 * math.pi * (tt * L) / (cp * (1 + irr * 0.4 * wander(tt, 1)))
        return a, cr * (1 + irr * 0.4 * wander(tt, 2)) * min(1, tt * 6 + 0.35)
    return axis, curl

def cell_strands(rng, row, CW, CH):
    """strand polylines of one cell: points (x, y, z) in cell pixels, per-point normal (card space) and occlusion, width,
    tone and source column per strand"""
    out = []
    k = row['kind']; Lr = row.get('len', [0.8, 1.0])
    if k == 'fine':  # short hairs each on its own slant, scattered over the cell (brows, short beards)
        for s in range(row.get('strands', 110)):
            L = CH * rng.uniform(Lr[0], Lr[1]); x0 = rng.uniform(0.04, 0.96) * CW; ys = rng.uniform(0, CH - L)
            ang = rng.gauss(0, row.get('slant_sd', 0.25)); bend = rng.gauss(0, 0.15); n = 6; pts = []
            for i in range(n + 1):
                t = i / n; a = ang + bend * t; pts.append((x0 + math.sin(a) * L * t, ys + math.cos(a) * L * t, rng.uniform(-2, 2)))
            nx = rng.uniform(-0.5, 0.5)
            out.append({'pts': pts, 'nrm': [(nx, 0, math.sqrt(1 - nx * nx))] * (n + 1), 'ao': [0.85] * (n + 1), 'w': row.get('width', 1.0) * rng.uniform(0.8, 1.2),
                        'tone': rng.uniform(1 - row.get('tone_sd', 0.25), 1 + row.get('tone_sd', 0.25)), 'su': rng.random()})
        return out
    nL = row.get('locks', 5)
    for li in range(nL):
        xc = CW * (0.1 + 0.8 * (li + 0.5 + rng.uniform(-0.3, 0.3)) / nL)
        L = CH * rng.uniform(Lr[0], Lr[1])
        axis, curl = lock_axis(rng, row, CW, CH, xc, L); curly = row.get('curl_r', 0) > 0
        R = row.get('lock_r', 0.04) * CW * rng.uniform(0.8, 1.2)
        ns = int(row.get('strands', 30) * rng.uniform(0.85, 1.15)); fray = row.get('fray', 0.3)
        # the lock's BODY: wider strands behind the fine ones (body per lock, body_w px wide, ending sooner), so a lock's core
        # is solid and its strands read in the shade, not as holes: at conversation distance a card is minified ~16x, and
        # a lock of evenly strewn one-pixel strands turned into alpha-tested pixel noise in the first GPU portraits (D-323)
        nb = row.get('body', 0)
        for s in range(ns + nb):
            body = s >= ns
            rho = R * (0.8 if body else 1.0) * math.sqrt(rng.random()); phi = rng.uniform(0, 2 * math.pi)
            n = max(12, int(L / 3)); tl = rng.uniform(0.62, 0.88) if body else rng.uniform(0.82, 1.0)  # strands end at different lengths: a tapered tip
            twist = rng.gauss(0, 0.6); dph = rng.gauss(0, row.get('phase_sd', 0.35)); rk = rng.uniform(0.7, 1.1)
            pts = []; nr = []; ao = []
            for i in range(n + 1):
                t = tl * i / n; x, y, z = axis(t)
                sp = 1 + fray * 2.2 * max(0.0, t - 0.6) ** 1.5 / 0.4 ** 1.5  # the tips fray: off the axis toward the tip
                a = phi + twist * t
                ox, oz = rho * sp * math.cos(a), rho * sp * math.sin(a)
                f = min(1.0, rho / max(R, 1e-6))
                if curly:  # the strand on the lock's corkscrew (the lock a rope of strands, wound)
                    ca, cr_ = curl(t, dph); ox = ox * 0.8 + cr_ * rk * math.cos(ca); oz = oz * 0.8 + cr_ * rk * math.sin(ca); a = ca; f = 1.0
                pts.append((x + ox, y, z + oz))
                # the lock's surface normal at the strand: out from the axis in the cross-section (the core: the card's)
                nx, nz = math.cos(a) * f, math.sin(a) * f + (1 - f)
                l = math.hypot(nx, nz) or 1; nr.append((nx / l, 0.0, nz / l))
                ao.append(clamp01(0.62 + 0.3 * math.sin(a) * f + 0.18 * f + 0.1 * t))
            if body: pts = [(x, y, z - 3.0) for (x, y, z) in pts]; ao = [a * 0.85 for a in ao]
            out.append({'pts': pts, 'nrm': nr, 'ao': ao, 'w': (row.get('body_w', 3.0) if body else row.get('width', 1.1)) * rng.uniform(0.8, 1.2),
                        'tone': rng.uniform(1 - row.get('tone_sd', 0.25), 1 + row.get('tone_sd', 0.25)), 'su': rng.random()})
    for s in range(row.get('strays', 0)):  # stray hairs off the locks (flyaways: a broken outline)
        x0 = rng.uniform(0.05, 0.95) * CW; L = CH * rng.uniform(0.3, 0.9); y0 = CH * rng.uniform(0, 0.3)
        ang = rng.gauss(0, 0.35); bend = rng.gauss(0, 0.5); n = max(8, int(L / 4)); pts = []
        for i in range(n + 1):
            t = i / n; a = ang + bend * t; pts.append((x0 + math.sin(a) * L * t * 0.6, y0 + L * t, rng.uniform(-2, 2)))
        out.append({'pts': pts, 'nrm': [(0, 0, 1)] * (n + 1), 'ao': [0.9] * (n + 1), 'w': 0.8, 'tone': rng.uniform(0.9, 1.2), 'su': rng.random()})
    return out

def render(job):
    t0 = time.time()
    W, H = job['size']; COLS = job['cols']; ROWS = job['rows']
    CW, CH = W / COLS, H / len(ROWS)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; cy = sc.cycles
    cy.seed = int(job.get('seed', 0)); cy.use_animated_seed = False
    cy.samples = int(job.get('samples', 32)); cy.use_adaptive_sampling = False; cy.use_denoising = False
    cy.max_bounces = 0; cy.diffuse_bounces = 0; cy.glossy_bounces = 0; cy.transmission_bounces = 0; cy.transparent_max_bounces = 0
    cy.device = 'CPU'; cy.pixel_filter_type = 'BLACKMAN_HARRIS'; cy.filter_width = 1.2
    sc.render.film_transparent = True; sc.render.threads_mode = 'FIXED'; sc.render.threads = 16
    try: sc.view_settings.view_transform = 'Raw'
    except Exception: sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'; sc.view_settings.exposure = 0; sc.view_settings.gamma = 1; sc.display_settings.display_device = 'sRGB'
    try: sc.cycles_curves.shape = 'RIBBONS'; sc.cycles_curves.subdivisions = 2
    except Exception as e: log('curves settings', e)
    im = sc.render.image_settings; im.file_format = 'PNG'; im.color_mode = 'RGBA'; im.color_depth = '8'; im.compression = 90
    w = bpy.data.worlds.new('none'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = max(W, H); cam.clip_end = 5000
    co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    co.location = (W / 2, -H / 2, 1000.0); co.rotation_euler = (0, 0, 0)

    images = {}
    def src_image(path):
        if path not in images:
            img = bpy.data.images.load(path, check_existing=True); img.colorspace_settings.name = 'Non-Color'; images[path] = img
        return images[path]
    def src_mean(src):
        img = src_image(src['image']); w_, h_ = img.size
        px = np.array(img.pixels[:], dtype=np.float32).reshape(h_, w_, 4)[::-1]
        x0, y0, x1, y1 = src['rect']; sub = px[int(y0 * h_):int(y1 * h_), int(x0 * w_):int(x1 * w_)]
        return max(0.02, float((sub[..., 0] * 0.2126 + sub[..., 1] * 0.7152 + sub[..., 2] * 0.0722).mean()))

    mats = []; nstr = 0
    for ri, row in enumerate(ROWS):
        P, R, D, N, UV = [], [], [], [], []; sizes = []
        rect = row['src']['rect']
        for ci in range(COLS):
            rng = random.Random(int(job.get('seed', 0)) * 1000003 + ri * 101 + ci)
            ox, oy = ci * CW, ri * CH
            for st in cell_strands(rng, row, CW, CH):
                pts = st['pts']; n = len(pts); sizes.append(n); nstr += 1
                for i, (x, y, z) in enumerate(pts):
                    a = pts[max(0, i - 1)]; b = pts[min(n - 1, i + 1)]; tx, ty = b[0] - a[0], b[1] - a[1]; l = math.hypot(tx, ty) or 1; tx, ty = tx / l, ty / l
                    if ty < 0: tx, ty = -tx, -ty
                    t = i / (n - 1)
                    cx = min(max(ox + x, ox + 1.5), ox + CW - 1.5); cyy = min(max(oy + y, oy + 1.5), oy + CH - 1.5)  # inside the cell
                    P.append((cx, -cyy, 10.0 + z)); R.append(0.5 * st['w'] * (1 - 0.6 * t * t))
                    nx, ny, nz = st['nrm'][i]
                    D.append((st['tone'], clamp01(0.5 + 0.5 * nz), 0.5 + 0.5 * tx, 1.0))
                    N.append((0.5 + 0.5 * nx, 0.5 + 0.5 * ny, st['ao'][i], 1.0))
                    UV.append((rect[0] + (rect[2] - rect[0]) * st['su'], 1 - (rect[1] + (rect[3] - rect[1]) * t)))
        hc = bpy.data.hair_curves.new(f'row{ri}'); hc.add_curves(sizes)
        hc.position_data.foreach_set('vector', np.array(P, dtype=np.float32).ravel())
        ra = hc.attributes.new('radius', 'FLOAT', 'POINT'); ra.data.foreach_set('value', np.array(R, dtype=np.float32))
        da = hc.attributes.new('data', 'FLOAT_COLOR', 'POINT'); da.data.foreach_set('color', np.array(D, dtype=np.float32).ravel())
        na = hc.attributes.new('nrm', 'FLOAT_COLOR', 'POINT'); na.data.foreach_set('color', np.array(N, dtype=np.float32).ravel())
        ua = hc.attributes.new('src', 'FLOAT2', 'POINT'); ua.data.foreach_set('vector', np.array(UV, dtype=np.float32).ravel())
        ob = bpy.data.objects.new(f'row{ri}', hc); sc.collection.objects.link(ob)
        # the emission is the data or the normal, switched per pass
        m = bpy.data.materials.new(f'row{ri}'); m.use_nodes = True; nt = m.node_tree; Nn = nt.nodes; Lk = nt.links
        for nd in list(Nn): Nn.remove(nd)
        out = Nn.new('ShaderNodeOutputMaterial'); em = Nn.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 1.0
        at = Nn.new('ShaderNodeAttribute'); at.attribute_name = 'data'; at.attribute_type = 'GEOMETRY'
        an = Nn.new('ShaderNodeAttribute'); an.attribute_name = 'nrm'; an.attribute_type = 'GEOMETRY'
        au = Nn.new('ShaderNodeAttribute'); au.attribute_name = 'src'; au.attribute_type = 'GEOMETRY'
        tex = Nn.new('ShaderNodeTexImage'); tex.image = src_image(row['src']['image']); tex.interpolation = 'Cubic'; tex.extension = 'CLIP'
        bw = Nn.new('ShaderNodeRGBToBW'); norm = Nn.new('ShaderNodeMath'); norm.operation = 'MULTIPLY'; norm.inputs[1].default_value = 0.5 / src_mean(row['src'])
        sep = Nn.new('ShaderNodeSeparateColor'); mt = Nn.new('ShaderNodeMath'); mt.operation = 'MULTIPLY'; cl = Nn.new('ShaderNodeClamp'); comb = Nn.new('ShaderNodeCombineColor')
        Lk.new(au.outputs['Vector'], tex.inputs['Vector']); Lk.new(tex.outputs['Color'], bw.inputs['Color']); Lk.new(bw.outputs['Val'], norm.inputs[0])
        Lk.new(at.outputs['Color'], sep.inputs['Color']); Lk.new(norm.outputs['Value'], mt.inputs[0]); Lk.new(sep.outputs[0], mt.inputs[1]); Lk.new(mt.outputs['Value'], cl.inputs['Value'])
        Lk.new(cl.outputs['Result'], comb.inputs[0]); Lk.new(sep.outputs[1], comb.inputs[1]); Lk.new(sep.outputs[2], comb.inputs[2])
        Lk.new(em.outputs['Emission'], out.inputs['Surface'])
        hc.materials.append(m); mats.append((m, comb, an, em))
    log('strands', nstr)
    def shoot(path, which, scale):
        for (m, comb, an, em) in mats:
            Lk = m.node_tree.links
            for l in list(em.inputs['Color'].links): Lk.remove(l)
            Lk.new((comb.outputs['Color'] if which == 'data' else an.outputs['Color']), em.inputs['Color'])
        sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = int(W * scale), int(H * scale), 100
        sc.render.filepath = path; bpy.ops.render.render(write_still=True); log('rendered', path, f'{time.time() - t0:.1f} s')
    shoot(job['out_png'], 'data', 1.0)
    if job.get('out_normal'): shoot(job['out_normal'], 'normal', job.get('normal_scale', 0.5))
    json.dump({'seconds': round(time.time() - t0, 1), 'strands': nstr, 'blender': bpy.app.version_string},
              open(os.path.join(os.path.dirname(job['out_png']), 'atlas_stats.json'), 'w'))

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    render(json.load(open(argv[0])))
