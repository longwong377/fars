# PARSA asset pipeline (D-305, D-307), the Blender stage of the people's hair: render the strand atlas the hair, beard and
# brow cards are textured with. Run headless, driven by tools/blender/build.mjs (people registry, tools/blender/people.json):
#   blender -b --factory-startup --python tools/blender/hair_atlas.py -- <job.json>
# job.json (written by tools/blender/sources/people_hair.ts from the registry's numbers):
#   { "out_png", "size": [W, H], "cols", "rows": [{ "kind", "strands", "clumps", "curl_r", "curl_pitch", "wave", "len",
#     "width", "src": { "image", "rect": [x0, y0, x1, y1] } }], "samples", "seed", "device" }
# The atlas is a grid of cells (rows = strand kinds, cols = variants of the same kind with other seeds); a cell is one card:
# its width across the card, its height root (top) -> tip (bottom). Each strand is a ribbon about one pixel wide (a hair
# ~70 um at the cell's scale, ~80 um per pixel), rendered by Cycles through an orthographic camera with a transparent film,
# so the alpha is the strands' antialiased coverage. The ribbons are emissive, their colour a packed set of data:
#   R  shade: the MakeHuman CC0 hair texture's luminance at the strand's own coordinates (its photographed irregularity:
#      darker and lighter hairs, the clumps' shadows), times a per-strand random tone; mean ~0.5 (the game multiplies by the
#      person's hair colour, so the atlas carries no hue);
#   G  depth: 1 for a strand in front of its lock, 0 behind (curls and ringlets wind round their axis): the game darkens the
#      back strands (self-shadowing) and lets the front catch the highlight;
#   B  the strand's direction across the card (0.5 + 0.5 x its unit tangent's x, the tangent taken tip-ward): the game's
#      strand highlight (Kajiya-Kay) follows the curls instead of the card;
#   A  coverage.
# Every number that shapes a strand comes from the job (the registry and drape.ts: curl radii and pitch are C, after the
# reliefs' rows of ringlets and the MakeHuman hair); only the random draws are here, from the job's seed.
import bpy, sys, json, math, os, time, random
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
job = json.load(open(argv[0]))
t0 = time.time()
log = lambda *a: print('[hair_atlas]', *a, flush=True)
W, H = job['size']; COLS = job['cols']; ROWS = job['rows']
CW, CH = W / COLS, H / len(ROWS)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.seed = int(job.get('seed', 0)); cy.use_animated_seed = False
cy.samples = int(job.get('samples', 32)); cy.use_adaptive_sampling = False; cy.use_denoising = False
cy.max_bounces = 0; cy.diffuse_bounces = 0; cy.glossy_bounces = 0; cy.transmission_bounces = 0; cy.transparent_max_bounces = 0
cy.device = 'CPU'
cy.pixel_filter_type = 'BLACKMAN_HARRIS'; cy.filter_width = 1.2
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = int(W), int(H), 100
sc.render.film_transparent = True
sc.render.threads_mode = 'FIXED'; sc.render.threads = 16
try: sc.view_settings.view_transform = 'Raw'
except Exception as e: log('no Raw view', e); sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'; sc.view_settings.exposure = 0; sc.view_settings.gamma = 1
sc.display_settings.display_device = 'sRGB'

im = sc.render.image_settings; im.file_format = 'PNG'; im.color_mode = 'RGBA'; im.color_depth = '8'; im.compression = 90
w = bpy.data.worlds.new('none'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0
log('view transform', sc.view_settings.view_transform)

# camera: orthographic, looking down -Z at the plane z = 0; world units = pixels, image y down = world -y
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = max(W, H)
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
co.location = (W / 2, -H / 2, 100.0); co.rotation_euler = (0, 0, 0)
sc.render.pixel_aspect_x = sc.render.pixel_aspect_y = 1

# the MakeHuman source images (luminance used; loaded once each)
images = {}
def src_image(path):
    if path not in images:
        img = bpy.data.images.load(path, check_existing=True); img.colorspace_settings.name = 'Non-Color'; images[path] = img
    return images[path]
def src_mean(src):
    """the mean luminance of the source over its rect: the
    normaliser that puts the atlas shade around 0.5"""
    img = src_image(src['image']); w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]  # rows top-down
    x0, y0, x1, y1 = src['rect']; sub = px[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    lum = sub[..., 0] * 0.2126 + sub[..., 1] * 0.7152 + sub[..., 2] * 0.0722
    return max(0.02, float(lum.mean()))  # every pixel of the rect: the strands sample it all

# ---------------------------------------------------------------- strands
def helix_strand(rng, x0, y0, length, r, pitch, phase, wave, wobble, irregular=0.0):
    """a strand winding round a lock's axis (x0 at the root, running down): r radius (px), pitch (px per turn), phase; wave
    and wobble add the lock's own sway; `irregular` (0..1) lets the radius and the pitch wander along the strand (natural
    curls are not springs). Returns points (x, y, depth 0..1)"""
    n = max(8, int(length / 3))
    pts = []
    sway_ph = rng.uniform(0, 2 * math.pi)
    # smooth wandering: a sum of three sines of random phase and frequency (per strand)
    wf = [(rng.uniform(0.7, 2.5), rng.uniform(0, 2 * math.pi)) for _ in range(3)]
    wander = lambda t, k: sum(math.sin(2 * math.pi * f * t * (1 + k) + p) for f, p in wf) / 3
    a = phase
    for i in range(n + 1):
        t = i / n; y = y0 + t * length
        if pitch > 0 and i: a += 2 * math.pi * (length / n) / max(pitch * (1 + irregular * 0.45 * wander(t, 1)), 1e-3)
        rr = r * (1 + irregular * 0.4 * wander(t, 2))
        x = x0 + (rr * math.cos(a) if pitch > 0 else 0) + wave * math.sin(2 * math.pi * t * 1.3 + sway_ph) + wobble * (t ** 1.5) * math.sin(sway_ph * 3.1)
        d = 0.5 + 0.5 * math.sin(a) if pitch > 0 else rng.uniform(0.35, 0.65)
        pts.append((x, y, d))
    return pts

def cell_strands(rng, row, col):
    """strand polylines of one cell in cell pixels (x across, y root -> tip), with a width at the root and a source uv"""
    k = row['kind']; out = []
    L = row.get('len', [0.8, 1.0]); nS = row['strands']; nC = row.get('clumps', 6)
    wv = row.get('wave', 0.0) * CW; cr = row.get('curl_r', 0.0) * CW; cp = row.get('curl_pitch', 0.0) * CH
    centres = [CW * (0.08 + 0.84 * (i + rng.uniform(-0.3, 0.3)) / max(1, nC - 1)) if nC > 1 else CW / 2 for i in range(nC)]
    for s in range(nS):
        c = rng.randrange(nC); xc = centres[c]
        spread = row.get('spread', 0.09) * CW
        x0 = xc + rng.gauss(0, spread)
        length = CH * rng.uniform(L[0], L[1]) * (0.97 if k != 'fine' else 1)
        y0 = CH * rng.uniform(0, row.get('root_jitter', 0.03))
        if k in ('curly', 'ringlet'):
            # every strand of a lock follows the lock's helix (the lock's phase), offset a little inside it
            ph = c * 1.7 + rng.gauss(0, row.get('phase_sd', 0.35))
            r = cr * rng.uniform(0.75, 1.1)
            pts = helix_strand(rng, xc + rng.gauss(0, spread * 0.4), y0, length, r, cp * rng.uniform(0.9, 1.1), ph, wv * rng.uniform(0.5, 1), rng.gauss(0, wv), row.get('irregular', 0.0))
        elif k == 'fine':
            # short hairs, each on its own slant (brows, short beards, the hairline)
            ang = rng.gauss(0, row.get('slant_sd', 0.25)); n = 6; pts = []; bend = rng.gauss(0, 0.15)
            ys = rng.uniform(0, CH - length) if row.get('scatter', False) else y0
            for i in range(n + 1):
                t = i / n; a = ang + bend * t
                pts.append((x0 + math.sin(a) * length * t, ys + math.cos(a) * length * t, rng.uniform(0.3, 0.7)))
        else:  # straight / wavy
            pts = helix_strand(rng, x0, y0, length, 0, 0, 0, wv * rng.uniform(0.6, 1.2), rng.gauss(0, wv * 0.8))
            # clumping toward the lock's centre near the tips
            pts = [(x + (xc - x) * row.get('clump', 0.35) * ((y - y0) / length) ** 2, y, d) for (x, y, d) in pts]
        wid = row.get('width', 1.1) * rng.uniform(0.8, 1.2)
        tone = rng.uniform(1 - row.get('tone_sd', 0.25), 1 + row.get('tone_sd', 0.25))
        su = rng.random()  # the strand's column in the source image
        out.append((pts, wid, tone, su))
    # strands in front drawn last is irrelevant here (depth sorts), but the depth of straight strands varies by strand
    return out

# ---------------------------------------------------------------- one mesh of ribbons for the whole atlas
verts = []; faces = []; col_data = []; uv_data = []; tone_data = []
Z = lambda d: 1.0 + 2.0 * d   # nearer the camera when in front of the lock
for ri, row in enumerate(ROWS):
    for ci in range(COLS):
        rng = random.Random(int(job.get('seed', 0)) * 1000003 + ri * 101 + ci)
        ox, oy = ci * CW, ri * CH
        rect = row['src']['rect']
        for pts, wid, tone, su in cell_strands(rng, row, ci):
            n = len(pts)
            for i, (x, y, d) in enumerate(pts):
                # tangent (tip-ward) and its normal in the image plane
                a = pts[max(0, i - 1)]; b = pts[min(n - 1, i + 1)]
                tx, ty = b[0] - a[0], b[1] - a[1]; l = math.hypot(tx, ty) or 1; tx, ty = tx / l, ty / l
                if ty < 0: tx, ty = -tx, -ty
                t = i / (n - 1)
                hw = 0.5 * wid * (1 - 0.65 * t ** 2)  # tapering to the tip
                cx, cyy = ox + x, oy + y
                # clamp into the cell (a strand leaving its card would bleed into the neighbour)
                cx = min(max(cx, ox + 1), ox + CW - 1); cyy = min(max(cyy, oy + 1), oy + CH - 1)
                nx, ny = -ty, tx
                for sgn in (-1, 1):
                    verts.append((cx + sgn * nx * hw, -(cyy + sgn * ny * hw), Z(d)))
                    col_data.append((0.0, d, 0.5 + 0.5 * tx, 1.0))
                    # the source coordinates: across = the strand's column, along = its length (image v up in Blender)
                    u = rect[0] + (rect[2] - rect[0]) * su; v = rect[1] + (rect[3] - rect[1]) * t
                    uv_data.append((u, 1 - v)); tone_data.append(tone)
            base = len(verts) - 2 * n
            for i in range(n - 1):
                a0, a1, b0, b1 = base + 2 * i, base + 2 * i + 1, base + 2 * i + 2, base + 2 * i + 3
                faces.append((a0, b0, b1, a1))
log('ribbons', len(faces), 'quads,', len(verts), 'verts')

me = bpy.data.meshes.new('strands'); me.from_pydata(verts, [], faces); me.update()
ob = bpy.data.objects.new('strands', me); sc.collection.objects.link(ob)
ca = me.color_attributes.new('data', 'FLOAT_COLOR', 'POINT')
ca.data.foreach_set('color', np.array(col_data, dtype=np.float32).ravel())
uvl = me.uv_layers.new(name='src')
loop_v = np.zeros(len(me.loops), dtype=np.int32); me.loops.foreach_get('vertex_index', loop_v)
uva = np.array(uv_data, dtype=np.float32)[loop_v]; uvl.data.foreach_set('uv', uva.ravel())
ta = me.attributes.new('tone', 'FLOAT', 'POINT'); ta.data.foreach_set('value', np.array(tone_data, dtype=np.float32))
row_of_vert = []  # which row's source image: one material per row
mats = []
for ri, row in enumerate(ROWS):
    m = bpy.data.materials.new(f'row{ri}'); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; Lk = nt.links
    for nd in list(N): N.remove(nd)
    out = N.new('ShaderNodeOutputMaterial'); em = N.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 1.0
    at = N.new('ShaderNodeAttribute'); at.attribute_name = 'data'; at.attribute_type = 'GEOMETRY'
    tn = N.new('ShaderNodeAttribute'); tn.attribute_name = 'tone'; tn.attribute_type = 'GEOMETRY'
    uvn = N.new('ShaderNodeUVMap'); uvn.uv_map = 'src'
    tex = N.new('ShaderNodeTexImage'); tex.image = src_image(row['src']['image']); tex.interpolation = 'Cubic'; tex.extension = 'CLIP'
    bw = N.new('ShaderNodeRGBToBW')
    # the source's luminance normalised to the row's mean (job: src.mean), times the strand's tone, around 0.5
    norm = N.new('ShaderNodeMath'); norm.operation = 'MULTIPLY'; norm.inputs[1].default_value = 0.5 / max(1e-3, src_mean(row['src']))
    mt = N.new('ShaderNodeMath'); mt.operation = 'MULTIPLY'
    cl = N.new('ShaderNodeClamp')
    sep = N.new('ShaderNodeSeparateColor'); comb = N.new('ShaderNodeCombineColor')
    Lk.new(uvn.outputs['UV'], tex.inputs['Vector']); Lk.new(tex.outputs['Color'], bw.inputs['Color']); Lk.new(bw.outputs['Val'], norm.inputs[0])
    Lk.new(norm.outputs['Value'], mt.inputs[0]); Lk.new(tn.outputs['Fac'], mt.inputs[1]); Lk.new(mt.outputs['Value'], cl.inputs['Value'])
    Lk.new(at.outputs['Color'], sep.inputs['Color'])
    Lk.new(cl.outputs['Result'], comb.inputs[0]); Lk.new(sep.outputs[1], comb.inputs[1]); Lk.new(sep.outputs[2], comb.inputs[2])
    Lk.new(comb.outputs['Color'], em.inputs['Color']); Lk.new(em.outputs['Emission'], out.inputs['Surface'])
    me.materials.append(m); mats.append(m)
# faces' material by row (face centre's y)
fi = np.zeros(len(me.polygons), dtype=np.int32)
cent = np.zeros(len(me.polygons) * 3, dtype=np.float32); me.polygons.foreach_get('center', cent); cent = cent.reshape(-1, 3)
fi = np.clip((-cent[:, 1] // CH).astype(np.int32), 0, len(ROWS) - 1)
me.polygons.foreach_set('material_index', fi)

sc.render.filepath = job['out_png']
bpy.ops.render.render(write_still=True)
log('rendered', job['out_png'], f'{time.time() - t0:.1f} s')
json.dump({ 'seconds': round(time.time() - t0, 1), 'ribbons': len(faces), 'view_transform': sc.view_settings.view_transform, 'blender': bpy.app.version_string },
          open(os.path.join(os.path.dirname(job['out_png']), 'atlas_stats.json'), 'w'))
