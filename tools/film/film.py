# The title film (D-761; UD-38, UD-39): the opening's pre-rendered title sequence, in the manner of a prestige historical
# series' main titles: macro shots of cut and pressed writing, carved and glazed surfaces, fire, haze and the Terrace's stone
# giants, cut to the main theme's bars (public/audio/score/manifest.json marks), ending on the place's name in its own script.
# Everything is built here from the project's own data and models: the XPa text of the Gate of All Nations as its stone has
# it (src/data/inscriptions.json op_signs, D-184), an Elamite tablet's lines (src/data/writing.json), the Gate bull, the
# double-bull capital and the fluted shafts (public/models, their geometry; their KTX2 maps are not readable by Blender's
# importer, so the film shades them with its own limestone), the twelve-petalled rosette of the borders. Out of world: a
# title sequence is not the place itself, but nothing in it is foreign to the place (C: its compositions, light and grading).
#
#   python tools/blender/bpy_cli.py -b --python tools/film/film.py -- --shot <id|all> [--res 960x402] [--fps 12]
#       [--samples 24] [--out DIR] [--work DIR] [--every N] [--only-still]
# Frames: <out>/<shot>/<frame>.png (existing frames are kept: a run resumes). tools/film/assemble.mjs makes the video.
import bpy, sys, os, math, json, random, mathutils
from mathutils import Vector, Euler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(k, d=None):
    return argv[argv.index(k) + 1] if k in argv else d
SHOT = arg('--shot', 'all'); RES = [int(x) for x in arg('--res', '960x402').split('x')]; FPS = int(arg('--fps', '12'))
SAMPLES = int(arg('--samples', '24')); OUT = arg('--out', '/tmp/film_frames'); WORK = arg('--work', os.path.join(ROOT, 'tools/film/work'))
EVERY = int(arg('--every', '1')); STILL = '--only-still' in argv; THREADS = int(arg('--threads', '0')); OFFSET = int(arg('--offset', '0'))
MODELS = arg('--models', WORK)  # where glb_plain.mjs left the readable copies of the game's models
M = json.load(open(os.path.join(ROOT, 'public/audio/score/manifest.json')))['cues']['main_theme']['marks']
CARVE = json.load(open(os.path.join(WORK, 'carve.json')))
def bar(n): return M[f'bar{n}']

# ------------------------------------------------------------------------------------------------------------------ scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.03
    sc.cycles.max_bounces = 6; sc.cycles.volume_bounces = 1; sc.cycles.glossy_bounces = 3; sc.cycles.transmission_bounces = 2
    sc.cycles.volume_step_rate = 4.0; sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
    sc.render.resolution_x, sc.render.resolution_y = RES; sc.render.resolution_percentage = 100
    sc.render.fps = 24; sc.render.film_transparent = False
    if THREADS: sc.render.threads_mode = 'FIXED'; sc.render.threads = THREADS
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'; sc.view_settings.exposure = 0
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '8'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0, 0, 0, 1)
    return sc

def node_mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); return m, nt, out

def limestone(name='limestone', tint=(0.74, 0.69, 0.6), rough=0.72, bump=0.6, scale=1.0):
    """the Terrace's grey-cream limestone: the stone's tone wandering in broad clouds, fine grain and pitting, a dusty bloom"""
    m, nt, out = node_mat(name); N = nt.nodes; L = nt.links.new
    bsdf = N.new('ShaderNodeBsdfPrincipled'); L(bsdf.outputs[0], out.inputs['Surface'])
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale,) * 3; L(tc.outputs['Object'], mp.inputs[0])
    big = N.new('ShaderNodeTexNoise'); big.inputs['Scale'].default_value = 1.6; big.inputs['Detail'].default_value = 6; L(mp.outputs[0], big.inputs[0])
    ramp = N.new('ShaderNodeValToRGB'); L(big.outputs['Fac'], ramp.inputs[0])
    ramp.color_ramp.elements[0].color = (tint[0] * 0.86, tint[1] * 0.85, tint[2] * 0.82, 1); ramp.color_ramp.elements[1].color = (tint[0] * 1.06, tint[1] * 1.05, tint[2] * 1.03, 1)
    grain = N.new('ShaderNodeTexNoise'); grain.inputs['Scale'].default_value = 340; grain.inputs['Detail'].default_value = 3; L(mp.outputs[0], grain.inputs[0])
    vor = N.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 120; L(mp.outputs[0], vor.inputs[0])
    pits = N.new('ShaderNodeMath'); pits.operation = 'LESS_THAN'; pits.inputs[1].default_value = 0.06; L(vor.outputs['Distance'], pits.inputs[0])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs['Factor'].default_value = 0.12; L(ramp.outputs[0], mix.inputs['A']); L(grain.outputs['Color'], mix.inputs['B'])
    L(mix.outputs['Result'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = rough
    hsum = N.new('ShaderNodeMath'); hsum.operation = 'SUBTRACT'; L(grain.outputs['Fac'], hsum.inputs[0]); L(pits.outputs[0], hsum.inputs[1])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.25 * bump; bp.inputs['Distance'].default_value = 0.002; L(hsum.outputs[0], bp.inputs['Height']); L(bp.outputs[0], bsdf.inputs['Normal'])
    return m

def clay():
    m, nt, out = node_mat('clay'); N = nt.nodes; L = nt.links.new
    bsdf = N.new('ShaderNodeBsdfPrincipled'); L(bsdf.outputs[0], out.inputs['Surface']); bsdf.inputs['Roughness'].default_value = 0.88
    tc = N.new('ShaderNodeTexCoord'); n1 = N.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 30; n1.inputs['Detail'].default_value = 8; L(tc.outputs['Object'], n1.inputs[0])
    ramp = N.new('ShaderNodeValToRGB'); L(n1.outputs['Fac'], ramp.inputs[0]); ramp.color_ramp.elements[0].color = (0.33, 0.21, 0.13, 1); ramp.color_ramp.elements[1].color = (0.52, 0.36, 0.23, 1)
    L(ramp.outputs[0], bsdf.inputs['Base Color'])
    n2 = N.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 900; L(tc.outputs['Object'], n2.inputs[0])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.15; L(n2.outputs['Fac'], bp.inputs['Height']); L(bp.outputs[0], bsdf.inputs['Normal'])
    return m

def gold():
    m, nt, out = node_mat('gold'); N = nt.nodes; L = nt.links.new
    bsdf = N.new('ShaderNodeBsdfPrincipled'); L(bsdf.outputs[0], out.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = (1.0, 0.72, 0.32, 1); bsdf.inputs['Metallic'].default_value = 1.0
    tc = N.new('ShaderNodeTexCoord'); n = N.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 60; L(tc.outputs['Object'], n.inputs[0])
    r = N.new('ShaderNodeMapRange'); r.inputs['To Min'].default_value = 0.16; r.inputs['To Max'].default_value = 0.34; L(n.outputs['Fac'], r.inputs[0]); L(r.outputs[0], bsdf.inputs['Roughness'])
    return m

def glaze(mask_img):
    """glazed brick: a turquoise-blue ground, the rosettes in yellow and white glaze (the mask: the rosette relief's height)"""
    m, nt, out = node_mat('glaze'); N = nt.nodes; L = nt.links.new
    bsdf = N.new('ShaderNodeBsdfPrincipled'); L(bsdf.outputs[0], out.inputs['Surface'])
    bsdf.inputs['Roughness'].default_value = 0.18; bsdf.inputs['Coat Weight'].default_value = 0.6; bsdf.inputs['Coat Roughness'].default_value = 0.08
    uv = N.new('ShaderNodeTexCoord'); tex = N.new('ShaderNodeTexImage'); tex.image = mask_img; tex.extension = 'REPEAT'; L(uv.outputs['UV'], tex.inputs[0])
    ramp = N.new('ShaderNodeValToRGB'); L(tex.outputs['Color'], ramp.inputs[0]); cr = ramp.color_ramp
    cr.elements[0].position = 0.27; cr.elements[0].color = (0.012, 0.06, 0.2, 1); cr.elements[1].position = 0.33; cr.elements[1].color = (0.78, 0.5, 0.08, 1)
    e = cr.elements.new(0.9); e.color = (0.85, 0.58, 0.12, 1); e = cr.elements.new(0.985); e.color = (0.86, 0.82, 0.7, 1)
    n = N.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 25; L(uv.outputs['Object'], n.inputs[0])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs['Factor'].default_value = 0.1; L(ramp.outputs[0], mix.inputs['A']); L(n.outputs['Color'], mix.inputs['B'])
    L(mix.outputs['Result'], bsdf.inputs['Base Color'])
    crk = N.new('ShaderNodeTexVoronoi'); crk.feature = 'DISTANCE_TO_EDGE'; crk.inputs['Scale'].default_value = 45; L(uv.outputs['Object'], crk.inputs[0])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.08; L(crk.outputs['Distance'], bp.inputs['Height']); L(bp.outputs[0], bsdf.inputs['Normal'])
    return m

def emission(color, strength, name='em'):
    m, nt, out = node_mat(name); e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = (*color, 1); e.inputs[1].default_value = strength
    nt.links.new(e.outputs[0], out.inputs['Surface']); return m

def haze(density=0.02, color=(1, 1, 1), anis=0.55, center=(0, 0, 0), size=(6, 6, 4)):
    """the air: a box of scattering volume round the set (sunbeams, the depth of a colonnade); bounded, so the sun still
    reaches it (a world volume would absorb the sun over its infinite path)"""
    bpy.ops.mesh.primitive_cube_add(size=1); b = bpy.context.active_object; b.name = 'haze'; b.location = center; b.scale = size
    m, nt, out = node_mat('haze'); v = nt.nodes.new('ShaderNodeVolumePrincipled'); nt.links.new(v.outputs[0], out.inputs['Volume'])
    v.inputs['Density'].default_value = density; v.inputs['Anisotropy'].default_value = anis; v.inputs['Color'].default_value = (*color, 1)
    b.data.materials.append(m); b.visible_shadow = False; return b

def sky(sun_elev_deg, sun_rot_deg, strength=1.0, dust=2.0):
    w = bpy.context.scene.world; nt = w.node_tree; s = nt.nodes.new('ShaderNodeTexSky')
    s.sky_type = 'NISHITA' if 'NISHITA' in [e.identifier for e in s.bl_rna.properties['sky_type'].enum_items] else s.sky_type
    try:
        s.sun_elevation = math.radians(sun_elev_deg); s.sun_rotation = math.radians(sun_rot_deg); s.dust_density = dust; s.air_density = 1.2; s.sun_disc = True
    except Exception: pass
    nt.links.new(s.outputs[0], nt.nodes['Background'].inputs[0]); nt.nodes['Background'].inputs[1].default_value = strength * 0.2
    bpy.context.scene.view_settings.exposure = -2.2  # daylight: the physical sky is far brighter than the night and lamp sets
    return s

def sun(elev, azim, energy=4.0, color=(1, 0.8, 0.6), angle=1.0):
    l = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); bpy.context.scene.collection.objects.link(l)
    l.data.energy = energy * (1.6 if bpy.context.scene.view_settings.exposure < -1 else 1); l.data.color = color; l.data.angle = math.radians(angle)
    l.rotation_euler = Euler((math.radians(90 - elev), 0, math.radians(azim)), 'XYZ'); return l

def point(loc, energy, color=(1, 0.55, 0.25), radius=0.02, name='pt'):
    l = bpy.data.objects.new(name, bpy.data.lights.new(name, 'POINT')); bpy.context.scene.collection.objects.link(l)
    l.data.energy = energy; l.data.color = color; l.data.shadow_soft_size = radius; l.location = loc; return l

def area(loc, rot, size, energy, color=(1, 0.9, 0.8)):
    l = bpy.data.objects.new('area', bpy.data.lights.new('area', 'AREA')); bpy.context.scene.collection.objects.link(l)
    l.data.energy = energy; l.data.size = size; l.data.color = color; l.location = loc; l.rotation_euler = rot; return l

def camera(lens=50, fstop=None, focus=None):
    c = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); bpy.context.scene.collection.objects.link(c); bpy.context.scene.camera = c
    c.data.lens = lens; c.data.sensor_width = 36; c.data.clip_start = 0.005; c.data.clip_end = 3000
    if fstop: c.data.dof.use_dof = True; c.data.dof.aperture_fstop = fstop; c.data.dof.focus_distance = focus or 1.0
    return c

def look(obj, at):
    obj.rotation_euler = (Vector(at) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def ease(u):  # smootherstep
    u = max(0.0, min(1.0, u)); return u * u * u * (u * (u * 6 - 15) + 10)

def lerp(a, b, u): return [x + (y - x) * u for x, y in zip(a, b)] if isinstance(a, (list, tuple, Vector)) else a + (b - a) * u

def grid_displaced(name, size_x, size_y, nx, ny, img_path, depth, mat, invert=False, mid=1.0):
    """a dense grid displaced by a heightmap (1 = the surface): cut writing, pressed wedges, relief"""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=nx, y_subdivisions=ny, size=1)
    o = bpy.context.active_object; o.name = name; o.scale = (size_x, size_y, 1); bpy.ops.object.transform_apply(scale=True)
    img = bpy.data.images.load(img_path); img.colorspace_settings.name = 'Non-Color'
    tex = bpy.data.textures.new(name + '_h', 'IMAGE'); tex.image = img; tex.extension = 'EXTEND'
    md = o.modifiers.new('carve', 'DISPLACE'); md.texture = tex; md.texture_coords = 'UV'; md.strength = depth; md.mid_level = mid
    o.data.materials.append(mat); bpy.ops.object.shade_smooth(); return o

def import_glb(name):
    p = os.path.join(MODELS, name + '.glb')
    before = set(bpy.context.scene.objects); bpy.ops.import_scene.gltf(filepath=p)
    objs = [o for o in bpy.context.scene.objects if o not in before]
    for o in objs:
        if o.type == 'MESH':
            for poly in o.data.polygons: poly.use_smooth = True
            if hasattr(o.data, 'has_custom_normals') and o.data.has_custom_normals: pass
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    for o in objs:
        if o.parent is None: o.parent = root
    return root, [o for o in objs if o.type == 'MESH']

def assign(objs, mat):
    for o in objs:
        o.data.materials.clear(); o.data.materials.append(mat)

def embers(n, box_min, box_max, seed=7, size=0.004, strength=60):
    """sparks rising from a fire: small glowing beads, each on its own drifting path (keyed per frame by drive())"""
    rnd = random.Random(seed); mat = emission((1.0, 0.45, 0.12), strength, 'ember'); out = []
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size); proto = bpy.context.active_object; proto.data.materials.append(mat)
    for i in range(n):
        o = proto.copy(); o.data = proto.data; bpy.context.scene.collection.objects.link(o)
        o['p0'] = [lerp(box_min[k], box_max[k], rnd.random()) for k in range(3)]; o['ph'] = rnd.random() * 6.28; o['v'] = 0.15 + 0.35 * rnd.random(); o['life'] = 2 + 3 * rnd.random(); o['t0'] = -rnd.random() * 5
        out.append(o)
    bpy.data.objects.remove(proto)
    return out

def drive_embers(es, t, box_min, box_max):
    for o in es:
        age = (t - o['t0']) % o['life']; p0 = Vector(o['p0']); v = o['v']; ph = o['ph']
        o.location = p0 + Vector((0.05 * math.sin(age * 1.7 + ph) + 0.02 * age, 0.04 * math.cos(age * 1.3 + ph), v * age))
        s = max(0.0, math.sin(math.pi * age / o['life'])) ** 0.6; o.scale = (s, s, s)

def flame(base, size=1.0, seed=0.0):
    """a fire standing on `base`: a volume of turbulent noise flowing upward, cut to a tongue that narrows with height; its
    light is its heat (blackbody), hottest low and in the dense core. Returns (gain, noise, flow) to animate."""
    bpy.ops.mesh.primitive_cube_add(size=1); dom = bpy.context.active_object; dom.scale = (0.6 * size, 0.6 * size, 1.2 * size); dom.location = (base[0], base[1], base[2] + 0.6 * size)
    m, nt, out = node_mat('flame%d' % len(bpy.data.materials)); N = nt.nodes; L = nt.links.new
    def mth(op, a, b=None, v=None):
        n = N.new('ShaderNodeMath'); n.operation = op
        for i, x in enumerate((a, b)):
            if x is None: continue
            if isinstance(x, (int, float)): n.inputs[i].default_value = x
            else: L(x, n.inputs[i])
        return n.outputs[0]
    v = N.new('ShaderNodeVolumePrincipled'); L(v.outputs[0], out.inputs['Volume'])
    tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ'); L(tc.outputs['Object'], sep.inputs[0])
    h = mth('ADD', sep.outputs[2], 0.5)                                    # 0 at the bowl .. 1 at the top
    r = mth('SQRT', mth('ADD', mth('MULTIPLY', sep.outputs[0], sep.outputs[0]), mth('MULTIPLY', sep.outputs[1], sep.outputs[1])))
    flow = N.new('ShaderNodeMapping'); L(tc.outputs['Object'], flow.inputs[0]); flow.inputs['Scale'].default_value = (1, 1, 0.55)
    nz = N.new('ShaderNodeTexNoise'); nz.noise_dimensions = '4D'; nz.inputs['Scale'].default_value = 5.0; nz.inputs['Detail'].default_value = 8
    nz.inputs['Roughness'].default_value = 0.62; nz.inputs['Distortion'].default_value = 1.2; L(flow.outputs[0], nz.inputs['Vector'])
    width = mth('ADD', mth('MULTIPLY', mth('POWER', mth('SUBTRACT', 1.0, h), 1.4), 0.3), 0.01)
    core = mth('SUBTRACT', width, r)                                        # > 0 inside the tongue
    d = mth('ADD', mth('MULTIPLY', core, 5.0), mth('MULTIPLY', mth('SUBTRACT', nz.outputs['Fac'], 0.5), 2.2))
    dens = mth('MULTIPLY', mth('MINIMUM', mth('MAXIMUM', mth('MULTIPLY', d, 5.0), 0.0), 1.0), mth('SUBTRACT', 1.0, h))
    gain = N.new('ShaderNodeMath'); gain.operation = 'MULTIPLY'; gain.inputs[1].default_value = 0.0; L(dens, gain.inputs[0])
    L(mth('MULTIPLY', gain.outputs[0], 0.15), v.inputs['Density']); v.inputs['Color'].default_value = (0.05, 0.03, 0.02, 1)
    L(gain.outputs[0], v.inputs['Blackbody Intensity'])
    L(mth('ADD', 1000.0, mth('MULTIPLY', mth('MULTIPLY', mth('SUBTRACT', 1.0, h), dens), 1000.0)), v.inputs['Temperature'])
    dom.data.materials.append(m)
    dom.data.materials.append(m); nz.inputs['W'].default_value = seed
    return gain, nz, flow

# ------------------------------------------------------------------------------------------------------------------ shots
# each shot: (id, start, end, build) — build(sc) returns update(t) where t = seconds into the FILM (keys are by film time)
SHOTS = []
def shot(id, t0, t1):
    def deco(f): SHOTS.append((id, t0, t1, f)); return f
    return deco

@shot('ember', 0.0, bar(3))
def s_ember(sc):
    """night: a single ember drifts past the carved stone; the rosettes appear in its passing light"""
    W = 2.2; o = grid_displaced('band', W, W / 8, 1600, 200, os.path.join(WORK, 'rosettes.png'), 0.018, limestone(scale=3), mid=1.0)
    o.rotation_euler = (math.radians(90), 0, 0)
    c = camera(40, fstop=2.0, focus=0.32); ember = point((0, -0.12, 0.0), 2.0, (1, 0.5, 0.18), 0.005)
    bead = bpy.data.objects.new('bead', bpy.data.meshes.new('b'));
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.0025); bead = bpy.context.active_object; bead.data.materials.append(emission((1, 0.45, 0.12), 25, 'bead'))
    es = embers(10, (-0.6, -0.12, -0.3), (0.2, -0.04, -0.1), seed=3, size=0.0008, strength=20)
    T = bar(3)
    def up(t):
        u = t / T; x = lerp(-0.55, 0.05, ease(u)); ember.location = (x + 0.02 * math.sin(t * 2.1), -0.09 + 0.01 * math.sin(t * 1.3), -0.06 + 0.07 * u)
        ember.data.energy = (0.6 + 0.4 * (0.8 + 0.2 * math.sin(t * 9) * math.sin(t * 5.3))) * min(1, t / 1.8) * 0.09
        bead.location = ember.location
        c.location = (lerp(-0.42, -0.18, ease(u)), -0.34 + 0.04 * u, -0.02); look(c, (c.location[0] + 0.12, 0, 0.0)); c.data.dof.focus_distance = 0.34 - 0.03 * u
        drive_embers(es, t, None, None)
    return up

@shot('stylus', bar(3), bar(5))
def s_stylus(sc):
    """the reed stylus presses wedges into wet clay; each impression is there as it lifts away"""
    Wd = CARVE['wedges']; sx = 0.08; sy = sx * Wd['h'] / Wd['w']
    base = grid_displaced('clay', sx, sy, 700, 480, os.path.join(WORK, 'wedge0.png'), 0.0, clay())
    mods = []
    for i in range(len(Wd['list'])):
        img = bpy.data.images.load(os.path.join(WORK, f'wedge{i}.png')); img.colorspace_settings.name = 'Non-Color'
        tex = bpy.data.textures.new(f'w{i}', 'IMAGE'); tex.image = img; tex.extension = 'EXTEND'
        md = base.modifiers.new(f'w{i}', 'DISPLACE'); md.texture = tex; md.texture_coords = 'UV'; md.mid_level = 1.0; md.strength = 0.0; mods.append(md)
    # the stylus: a reed cut square at the end, its corner the wedge's head
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.0035, depth=0.16); st = bpy.context.active_object
    sm, snt, sout = node_mat('reed'); b = snt.nodes.new('ShaderNodeBsdfPrincipled'); b.inputs['Base Color'].default_value = (0.42, 0.33, 0.18, 1); b.inputs['Roughness'].default_value = 0.5; snt.links.new(b.outputs[0], sout.inputs['Surface']); st.data.materials.append(sm)
    c = camera(90, fstop=2.8, focus=0.16); key = area((-0.14, -0.04, 0.05), Euler((math.radians(70), 0, math.radians(-75))), 0.04, 0.35, (1, 0.8, 0.58)); fill = area((0.1, 0.1, 0.1), Euler((math.radians(40), 0, math.radians(140))), 0.2, 0.04, (0.6, 0.7, 1))
    T0, T1 = bar(3), bar(5); presses = [(T0 + 0.6 + i * (T1 - T0 - 1.2) / len(Wd['list'])) for i in range(len(Wd['list']))]
    def px2w(x, y): return (-sx / 2 + sx * x / Wd['w'], sy / 2 - sy * y / Wd['h'])
    def up(t):
        k = None
        for i, tp in enumerate(presses):
            mods[i].strength = 0.0018 if t >= tp + 0.35 else 0.0
            if tp - 0.6 <= t < tp + 0.9: k = i
        if k is None: k = 0
        q = Wd['list'][k]; x, y = px2w(q['x'] + 0.25 * q['len'] * math.cos(q['ang']), q['y'] + 0.25 * q['len'] * math.sin(q['ang'])); tp = presses[k]
        dz = 0.02 * (1 - ease(1 - abs(t - (tp + 0.15)) / 0.6)) if abs(t - (tp + 0.15)) < 0.6 else 0.02
        st.location = (x, y, 0.08 + dz - 0.0); st.rotation_euler = (math.radians(28), 0, -q['ang'] + math.radians(90))
        u = (t - T0) / (T1 - T0); c.location = (lerp(-0.03, 0.02, u), -0.12, 0.085); look(c, (lerp(-0.012, 0.012, u), 0, 0)); c.data.dof.focus_distance = (c.location - Vector((x, y, 0))).length
    return up

@shot('tablet', bar(5), bar(7))
def s_tablet(sc):
    """lines of signs on a tablet's face, the light of a lamp crossing them"""
    tw = 0.11; th = tw * CARVE['tablet']['h'] / CARVE['tablet']['w']
    face = grid_displaced('tab', tw, th, 900, 620, os.path.join(WORK, 'tablet.png'), 0.0016, clay())
    sd = face.modifiers.new('pillow', 'SIMPLE_DEFORM'); sd.deform_method = 'BEND'; sd.angle = math.radians(5); sd.deform_axis = 'Y'
    c = camera(100, fstop=3.2, focus=0.2); lamp = point((-0.15, 0.02, 0.03), 0.12, (1, 0.6, 0.3), 0.01)
    area((0.2, 0.3, 0.3), Euler((math.radians(50), 0, math.radians(150))), 0.3, 0.02, (0.55, 0.65, 1))
    T0, T1 = bar(5), bar(7)
    def up(t):
        u = (t - T0) / (T1 - T0); lamp.location = (lerp(-0.16, 0.12, ease(u)), 0.05, 0.025 + 0.02 * u); lamp.data.energy = 0.12 * (0.9 + 0.1 * math.sin(t * 11))
        c.location = (lerp(-0.035, 0.03, u), -0.17, 0.09); look(c, (lerp(-0.03, 0.03, u), 0.0, 0.0)); c.data.dof.focus_distance = 0.19
    return up

def inscription(sc, t0, t1, x0, x1, focus_line):
    xw = 1.9; xh = xw * CARVE['xpa']['h'] / CARVE['xpa']['w']
    o = grid_displaced('xpa', xw, xh, 1700, 900, os.path.join(WORK, 'xpa.png'), 0.012, limestone(scale=2, bump=0.8))
    o.rotation_euler = (math.radians(90), 0, 0)
    c = camera(65, fstop=2.4, focus=0.9); s = sun(18, -70, 6.0, (1, 0.72, 0.45), 0.6)
    w = sc.world.node_tree.nodes['Background']; w.inputs[0].default_value = (0.02, 0.025, 0.04, 1)
    def up(t):
        u = (t - t0) / (t1 - t0); y_line = xh / 2 - (0.06 + focus_line * xh / 6.5)
        c.location = (lerp(x0, x1, ease(u)), -0.75, lerp(0.05, -0.02, u)); look(c, (c.location[0] + 0.25, 0, lerp(0.02, -0.05, u)))
        c.data.dof.focus_distance = 0.8 + 0.06 * math.sin(u * math.pi)
        s.rotation_euler = Euler((math.radians(90 - lerp(10, 22, u)), 0, math.radians(lerp(-82, -62, u))), 'XYZ'); s.data.energy = lerp(2.5, 6.0, ease(u))
    return up

@shot('inscription1', bar(7), bar(9))
def s_insc1(sc): return inscription(sc, bar(7), bar(9), -0.9, -0.55, 1)

@shot('inscription2', bar(9), bar(11))
def s_insc2(sc): return inscription(sc, bar(9), bar(11), 0.1, 0.45, 3)

@shot('glaze', bar(11), bar(15))
def s_glaze(sc):
    """the glazed frieze: rosettes in yellow and white on the lapis-blue ground, the sun sliding along the glaze"""
    img = bpy.data.images.load(os.path.join(WORK, 'rosettes.png')); img.colorspace_settings.name = 'Non-Color'
    W = 2.4; o = grid_displaced('frieze', W, W / 8, 1600, 200, os.path.join(WORK, 'rosettes.png'), 0.01, glaze(img))
    o.rotation_euler = (math.radians(90), 0, 0)
    # the brick courses above and below (glazed blue, plain)
    for zc in (W / 16 + 0.06, -W / 16 - 0.06):
        bpy.ops.mesh.primitive_cube_add(size=1); b = bpy.context.active_object; b.scale = (W, 0.05, 0.11); b.location = (0, 0.03, zc)
        bv = b.modifiers.new('bv', 'BEVEL'); bv.width = 0.006; bv.segments = 3; b.data.materials.append(bpy.data.materials['glaze'])
    c = camera(85, fstop=2.0, focus=1.0); s = sun(14, -40, 2.2, (1, 0.78, 0.55), 0.5); haze(0.25, (1, 0.95, 0.9), 0.7, (0, -0.6, 0), (3, 1.2, 1.2))
    motes = embers(60, (-0.8, -0.6, -0.25), (0.8, -0.1, 0.2), seed=11, size=0.0008, strength=4)
    for m_ in motes: m_.data.materials[0] = emission((1, 0.95, 0.85), 3, 'mote')
    T0, T1 = bar(11), bar(15)
    def up(t):
        u = (t - T0) / (T1 - T0); c.location = (lerp(-0.9, 0.5, u), -0.95, lerp(0.0, 0.05, u)); look(c, (c.location[0] + 0.3, 0, 0))
        c.data.dof.focus_distance = 1.0
        s.rotation_euler = Euler((math.radians(90 - 14), 0, math.radians(lerp(-60, -30, u))), 'XYZ')
        for i, m_ in enumerate(motes):
            p0 = Vector(m_['p0']); m_.location = p0 + Vector((0.03 * math.sin(t * 0.3 + m_['ph']), 0.02 * math.cos(t * 0.25 + m_['ph']), -0.004 * t + 0.02 * math.sin(t * 0.2 + i)))
    return up

@shot('fire', bar(15), bar(17))
def s_fire(sc):
    """darkness; the brazier catches, and the fire stands up"""
    root, objs = import_glb('m_brazier'); assign(objs, gold()); root.scale = (1.2,) * 3; bpy.context.view_layer.update()
    top = max((o.matrix_world @ Vector(c_)).z for o in objs for c_ in o.bound_box)
    gain, nz, flow = flame((0, 0, top - 0.05))
    light = point((0, 0, top + 0.3), 0, (1, 0.55, 0.22), 0.2)
    es = embers(40, (-0.25, -0.25, top), (0.25, 0.25, top + 0.4), seed=5, size=0.006)
    c = camera(50, fstop=2.8, focus=3.0)
    T0, T1 = bar(15), bar(17)
    def up(t):
        u = (t - T0) / (T1 - T0); g = ease(min(1, max(0, (t - T0 - 0.4) / 2.5)))
        gain.inputs[1].default_value = 25 * g; nz.inputs['W'].default_value = t * 0.9; flow.inputs['Location'].default_value = (0, 0, -t * 0.9)
        light.data.energy = 900 * g * (0.85 + 0.15 * math.sin(t * 13) * math.sin(t * 7.1))
        c.location = (lerp(1.6, 1.2, u), -2.6 + 0.4 * u, top + 0.1); look(c, (0, 0, top + 0.35)); c.data.dof.focus_distance = (c.location - Vector((0, 0, top))).length
        drive_embers(es, t, None, None)
        for e in es: e.scale = e.scale * g
    return up

@shot('braziers', bar(17), bar(19))
def s_braziers(sc):
    """night in the hall: down the rows of columns the braziers catch one after another, toward the lens (on the drums)"""
    cols, h = colonnade(3, 6)
    w = sc.world.node_tree.nodes['Background']; w.inputs[0].default_value = (0.004, 0.006, 0.014, 1)
    T0, T1 = bar(17), bar(19); fires = []
    for j in range(6):
        for side in (-1, 1):
            p = (4.35 + side * 2.6, (5 - j) * 8.7 + 4.35, 0.0)
            br, bo = import_glb('m_brazier'); assign(bo, gold()); br.location = p; bpy.context.view_layer.update()
            top = max((o.matrix_world @ Vector(c_)).z for o in bo for c_ in o.bound_box)
            g, nz, fl = flame((p[0], p[1], top - 0.05), 1.0, j * 3.1 + side)
            lt = point((p[0], p[1], top + 0.4), 0, (1, 0.5, 0.2), 0.25)
            fires.append((T0 + 0.25 + j * (T1 - T0 - 1.0) / 6, g, nz, fl, lt))
    haze(0.012, (1, 0.9, 0.8), 0.5, (0, 22, 8), (30, 60, 16))
    c = camera(32, fstop=4, focus=15)
    def up(t):
        u = (t - T0) / (T1 - T0)
        for (ti, g, nz, fl, lt) in fires:
            k = ease(min(1, max(0, (t - ti) / 0.8))); g.inputs[1].default_value = 25 * k
            nz.inputs['W'].default_value += 0; fl.inputs['Location'].default_value = (0, 0, -t * 0.9)
            lt.data.energy = 650 * k * (0.85 + 0.15 * math.sin(t * 13 + ti) * math.sin(t * 7.1 + ti))
        c.location = (4.35 + lerp(-0.5, 0.4, u), lerp(-6.0, -2.5, ease(u)), lerp(1.6, 2.4, u)); look(c, (4.35, 40, lerp(3.0, 4.5, u)))
    return up

def colonnade(n=5, m=5, pitch=8.7, h=19.0):
    shaft, sh = import_glb('column_shaft_f48'); cap, cp = import_glb('capital_protome'); base, bs = import_glb('column_base_bell')
    stone = limestone(tint=(0.72, 0.67, 0.58), scale=0.4)
    for o in sh + cp + bs: o.data.materials.clear(); o.data.materials.append(stone)
    def dims(objs):
        mn = Vector((1e9,) * 3); mx = -mn
        for o in objs:
            for c in o.bound_box:
                w = o.matrix_world @ Vector(c); mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
        return mn, mx
    smn, smx = dims(sh); bmn, bmx = dims(bs); cmn, cmx = dims(cp)
    sh_h = smx.z - smn.z; s_scale = (h - (bmx.z - bmn.z) - (cmx.z - cmn.z)) / sh_h
    cols = []
    for i in range(n):
        for j in range(m):
            x, y = (i - (n - 1) / 2) * pitch, j * pitch
            for root, mn, z, sc_ in ((base, bmn, 0, 1), (shaft, smn, bmx.z - bmn.z, s_scale), (cap, cmn, (bmx.z - bmn.z) + sh_h * s_scale, 1)):
                inst = root.copy() if (i or j) else root
                if inst is not root:
                    bpy.context.scene.collection.objects.link(inst)
                    for ch in root.children:
                        cc = ch.copy(); bpy.context.scene.collection.objects.link(cc); cc.parent = inst
                inst.location = (x, y, z - mn.z * sc_); inst.scale = (1, 1, sc_) if root is shaft else (1, 1, 1)
            cols.append((x, y))
    # the floor
    bpy.ops.mesh.primitive_plane_add(size=200); fl = bpy.context.active_object; fl.data.materials.append(limestone(tint=(0.6, 0.56, 0.5), scale=0.2))
    return cols, h

@shot('columns', bar(19), bar(23))
def s_columns(sc):
    """the hall's forest of columns in the morning haze, the camera rising between them"""
    cols, h = colonnade(5, 6)
    sky(4, -100, 0.6, 3); s = sun(6, -100, 6.0, (1, 0.62, 0.36), 0.7); haze(0.02, (1, 0.95, 0.9), 0.65, (0, 20, 10), (60, 70, 22))
    c = camera(35, fstop=8, focus=20)
    T0, T1 = bar(19), bar(23)
    def up(t):
        u = (t - T0) / (T1 - T0); c.location = (lerp(-2.0, 2.5, u), lerp(-12, -2, ease(u)), lerp(2.0, 9.0, ease(u))); look(c, (c.location[0] + 3, c.location[1] + 25, lerp(7, 15, u)))
    return up

@shot('capital', bar(23), bar(27))
def s_capital(sc):
    """up a column to the double bull at its head, the sky blazing behind"""
    cols, h = colonnade(3, 3)
    sky(7, -95, 0.9, 2.5); s = sun(8, -95, 7.0, (1, 0.7, 0.42), 0.6); haze(0.01, (1, 0.95, 0.9), 0.6, (0, 8, 10), (40, 40, 22))
    c = camera(28, fstop=4, focus=8)
    T0, T1 = bar(23), bar(27)
    def up(t):
        u = (t - T0) / (T1 - T0); c.location = (lerp(3.5, 3.0, u), lerp(2.6, 3.4, u), lerp(3.0, h - 3.5, ease(u))); look(c, (0, 8.7, lerp(h * 0.55, h - 1.0, ease(u)) + 1.2))
        c.data.dof.focus_distance = (c.location - Vector((0, 8.7, h - 1.0))).length
    return up

def stair(sc, steps=60):
    """a flight of the Terrace's shallow steps (rise 0.1 m, tread 0.38 m), its parapets crowned with stepped merlons"""
    stone = limestone(tint=(0.7, 0.66, 0.58), scale=0.5); W = 7.0
    for k in range(steps):
        bpy.ops.mesh.primitive_cube_add(size=1); s = bpy.context.active_object; s.scale = (W, 0.38, 0.1); s.location = (0, k * 0.38 + 0.19, k * 0.1 + 0.05)
        bv = s.modifiers.new('bv', 'BEVEL'); bv.width = 0.015; bv.segments = 2; s.data.materials.append(stone)
    mer, ms = import_glb('merlon')
    for side in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1); p = bpy.context.active_object; L_ = steps * 0.38
        p.scale = (0.6, L_, 1.6); p.location = (side * (W / 2 + 0.3), L_ / 2, 0.8); p.rotation_euler = (math.atan2(steps * 0.1, L_), 0, 0); p.data.materials.append(stone)
        for k in range(0, steps, 3):
            mm = mer.copy(); bpy.context.scene.collection.objects.link(mm)
            for ch in mer.children:
                cc = ch.copy(); bpy.context.scene.collection.objects.link(cc); cc.parent = mm
            mm.location = (side * (W / 2 + 0.3), k * 0.38, k * 0.1 + 1.55); mm.rotation_euler = (0, 0, math.pi / 2)
    for o in ms: o.data.materials.clear(); o.data.materials.append(stone)
    bpy.data.objects.remove(mer) if False else None
    return W

@shot('stair1', bar(27), bar(31))
def s_stair1(sc):
    """low over the steps, climbing toward the sunrise at the top"""
    W = stair(sc, 70)
    sky(3, 0, 0.8, 3); s = sun(4, 0, 6.0, (1, 0.6, 0.35), 0.8); haze(0.01, (1, 0.93, 0.88), 0.7, (0, 15, 4), (14, 40, 10))
    c = camera(24, fstop=5.6, focus=6)
    T0, T1 = bar(27), bar(31)
    def up(t):
        u = (t - T0) / (T1 - T0); y = lerp(-3, 12, u); c.location = (lerp(-1.2, 0.8, u), y, max(0, y) * 0.1 / 0.38 + 1.1); look(c, (0, y + 14, c.location[2] + 1.6))
    return up

@shot('stair2', bar(31), bar(33))
def s_stair2(sc):
    """the parapet's merlons in silhouette sliding across the risen sun (a long lens)"""
    W = stair(sc, 40)
    sky(3, -90, 1.0, 3.5); s = sun(3, -90, 6.0, (1, 0.62, 0.36), 0.6)
    c = camera(135, fstop=4, focus=40)
    T0, T1 = bar(31), bar(33)
    def up(t):
        u = (t - T0) / (T1 - T0); c.location = (W / 2 + 40, lerp(4, 9, u), 1.0); look(c, (W / 2 + 0.3, lerp(4, 9, u) + 0.6, lerp(2.4, 2.6, u) + lerp(4, 9, u) * 0.26))
    return up

@shot('summit', bar(33), bar(35))
def s_summit(sc):
    """the hall against the risen sun: the columns and their bulls in silhouette, the light pouring between them"""
    cols, h = colonnade(5, 4)
    sky(4, 180, 0.5, 4); s = sun(4, 180, 9.0, (1, 0.66, 0.38), 0.5); haze(0.004, (1, 0.93, 0.85), 0.85, (0, 13, 10), (60, 50, 22)); sc.view_settings.exposure = -3.4
    c = camera(40, fstop=8, focus=30)
    T0, T1 = bar(33), bar(35)
    def up(t):
        u = (t - T0) / (T1 - T0); c.location = (lerp(-6, 2, u), lerp(-34, -28, u), lerp(3.0, 5.5, ease(u))); look(c, (lerp(-3, 1, u), 20, lerp(9, 11, u)))
    return up

@shot('title', bar(35), M['end'])
def s_title(sc):
    """the name in its own script, in gold, out of the dark"""
    fnt = bpy.data.fonts.load(os.path.join(ROOT, 'public/fonts/NotoSansOldPersian-Regular.ttf'))
    cu = bpy.data.curves.new('title', 'FONT'); cu.font = fnt; cu.body = '\U000103B1\U000103A0\U000103BC\U000103BF'; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    cu.extrude = 0.012; cu.bevel_depth = 0.005; cu.bevel_resolution = 4; cu.size = 0.2
    o = bpy.data.objects.new('title', cu); sc.collection.objects.link(o); o.rotation_euler = (math.radians(90), 0, 0); o.data.materials.append(gold())
    sweep = area((-1.5, -1.0, 0.6), Euler((math.radians(70), 0, math.radians(-50))), 0.4, 0, (1, 0.85, 0.65))
    fillr = area((0, -2, -0.5), Euler((math.radians(100), 0, 0)), 3, 0, (1, 0.7, 0.45))
    es = embers(25, (-1.2, -0.5, -0.6), (1.2, 0.3, -0.2), seed=21, size=0.003)
    c = camera(60, fstop=4, focus=2.2)
    T0, T1 = bar(35), M['end']
    def up(t):
        u = (t - T0) / (T1 - T0); g = ease(min(1, (t - T0) / 3.0)) * (1 - ease(max(0, (t - (T1 - 4)) / 3.5)))
        sweep.location = (lerp(-1.6, 1.6, ease(min(1, (t - T0) / 9))), -1.0, 0.6); sweep.data.energy = 140 * g; fillr.data.energy = 6 * g
        c.location = (0, lerp(-2.4, -2.1, u), 0); look(c, (0, 0, 0))
        drive_embers(es, t, None, None)
        for e in es: e.scale = e.scale * g
    return up

# ------------------------------------------------------------------------------------------------------------------ render
def render(id, t0, t1, build):
    sc = reset(); up = build(sc)
    d = os.path.join(OUT, id); os.makedirs(d, exist_ok=True)
    n = max(1, int(round((t1 - t0) * FPS)))
    frames = [n // 2] if STILL else range(OFFSET, n, EVERY)
    for k in frames:
        t = t0 + k / FPS; f = os.path.join(d, f'{k:05d}.png')
        if os.path.exists(f): continue
        up(t); sc.render.filepath = f; bpy.ops.render.render(write_still=True)
        print(f'[film] {id} {k + 1}/{n} t={t:.2f}', flush=True)
    json.dump({'id': id, 't0': t0, 't1': t1, 'fps': FPS, 'frames': n, 'res': RES}, open(os.path.join(d, 'shot.json'), 'w'))

for id, t0, t1, f in SHOTS:
    if SHOT in ('all', id) or id in SHOT.split(','):
        render(id, t0, t1, f)
