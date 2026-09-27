"""Build the people's scanned layers (D-304, session 11): MakeHuman's CC0 skins and CC0 textile/leather scans, as the
layers the human material samples (src/people/humanScans.ts). Run: py -3 tools/build_humans_scans.py [assets dir]

Skin (public/generated/humans/scans/skin_NN.jpg, 1024^2, sRGB): each MakeHuman skin (CC0, 2020 release; a painted and
photo-sourced albedo in the MakeHuman body UV, the UV our bodies keep) is
  - limited to the body's UV islands (rasterised from humans.bin; the margins, with MakeHuman's logo, are filled with the
    island mean so mip levels do not bleed the logo or the background into the skin),
  - scalp flattened (hair.png G, the scalp hair density: MakeHuman paints hair on some scalps; ours is worn hair or skin),
  - rescaled per channel (linear) so its mean over the head, neck, arms and hands equals the reference tone the
    renderer rescales from (REF_TONE, humanMaterial.ts); the renderer then applies each person's own tone (looks.ts),
    so the texture brings the variation (lips, lids, knuckles, blotches, veins, age) and never the tone.
Cloth (public/generated/humans/scans/cloth_N.jpg + cloth_N_h.jpg, 1024^2): the scan's colour divided by its own mean
(linear) times CLOTH_K (so the stored mean is CLOTH_K and the renderer multiplies by 1/CLOTH_K: the garment keeps its dye),
and its displacement normalised to mean 0.5 (a grey PNG). Measured means, thread counts (FFT) and tile sizes go to
public/generated/humans/scans/scans.json (read by humanScans.ts) and are printed for src/data/scans.json.
Tier C: modern textiles and modern skin for 467's; the dye, the tone and the cut stay the evidence's."""
import json, sys, os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\Administrator\fars-assets'
MH = os.path.join(ASSETS, 'humans', 'makehuman_cc0', 'skins')
TX = os.path.join(ASSETS, 'textures')
OUT = os.path.join(ROOT, 'public', 'generated', 'humans', 'scans')
N = 1024
REF_TONE = (0.72, 0.53, 0.42)  # sRGB, humanMaterial.ts REF_TONE
CLOTH_K = 0.4

def lin(s): s = np.asarray(s, np.float64); return np.where(s <= 0.04045, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)
def srgb(l): l = np.clip(l, 0, 1); return np.where(l <= 0.0031308, l * 12.92, 1.055 * l ** (1 / 2.4) - 0.055)

# the skin layers: (id, MakeHuman skin folder, file). Light-toned sources first, then the dark-toned (humanScans.ts maps
# every body variant to one of each by sex and age and blends them by the person's tone)
SKINS = [
  ('m_young_a', 'young_caucasian_male2', 'young_lightskinned_male_diffuse2.png'),
  ('m_young_b', 'young_asian_male', 'young_lightskinned_male_diffuse3.png'),
  ('m_mid', 'middleage_caucasian_male', 'middleage_lightskinned_male_diffuse.png'),
  ('m_old', 'old_caucasian_male', 'old_lightskinned_male_diffuse.png'),
  ('f_young_a', 'young_caucasian_female', 'young_lightskinned_female_diffuse.png'),
  ('f_young_b', 'young_asian_female', 'young_lightskinned_female_diffuse3.png'),
  ('f_mid', 'middleage_caucasian_female', 'middleage_lightskinned_female_diffuse.png'),
  ('f_old', 'old_caucasian_female', 'old_lightskinned_female_diffuse.png'),
  ('m_young_d', 'young_african_male', 'young_darkskinned_male_diffuse.png'),
  ('m_old_d', 'old_african_male', 'old_darkskinned_male_diffuse.png'),
  ('f_young_d', 'young_african_female', 'young_darkskinned_female_diffuse.png'),
  ('f_old_d', 'old_african_female', 'old_darkskinned_female_diffuse.png'),
]
# cloth layers: (id, scan dir, fabric, threads per metre the garment should show: humanMaterial DRAPE.weave.fq)
CLOTH = [
  ('linen', 'polyhaven/rough_linen', 'linen', 1500),
  ('wool', 'ambientcg/Fabric031', 'wool', 700),
  ('felt', 'ambientcg/Fabric034', 'felt', 0),
  ('leather', 'ambientcg/Leather014', 'leather', 0),
]

def body_mask():
    meta = json.load(open(os.path.join(ROOT, 'public/generated/humans/humans.json')))
    b = open(os.path.join(ROOT, 'public/generated/humans/humans.bin'), 'rb').read()
    def view(k, dt):
        l = meta['layout'][k]; return np.frombuffer(b, dt, l['count'] * l['itemSize'], l['offset'])
    uv = view('uv', np.uint16).reshape(-1, 2) / 65535.0
    orig = view('orig', np.uint16); part = view('part', np.uint8); tri = view('lod0', np.uint16).reshape(-1, 3)
    S = 2048
    m = Image.new('L', (S, S), 0); d = ImageDraw.Draw(m)
    reg = Image.new('L', (S, S), 0); dr = ImageDraw.Draw(reg)  # 1 = head/neck/arms/hands (the tone reference region)
    for a, bb, c in tri:
        p = [part[orig[i]] for i in (a, bb, c)]
        if max(p) >= 17: continue  # eyes, teeth, tongue, lashes
        pts = [(uv[i, 0] * S, (1 - uv[i, 1]) * S) for i in (a, bb, c)]
        d.polygon(pts, fill=255)
        if all(q in (0, 1, 5, 6, 7, 8, 9, 10) for q in p): dr.polygon(pts, fill=255)
    return np.asarray(m) > 127, np.asarray(reg) > 127

def fill_margin(img, mask):
    """margins → the island mean, then a few blurred dilations so the islands' edge colour runs out (mip bleed)"""
    out = img.copy(); mean = img[mask].mean(0); out[~mask] = mean
    from scipy import ndimage
    grown = mask.copy()
    for _ in range(6):
        nxt = ndimage.binary_dilation(grown, iterations=2)
        ring = nxt & ~grown
        blur = np.stack([ndimage.uniform_filter(np.where(grown, out[..., c], 0), 5) for c in range(3)], -1)
        w = ndimage.uniform_filter(grown.astype(np.float64), 5)[..., None]
        out[ring] = (blur / np.maximum(w, 1e-6))[ring]
        grown = nxt
    return out

def build_skins(mask, reg):
    hair = np.asarray(Image.open(os.path.join(ROOT, 'public/generated/humans/hair.png')).convert('RGBA').resize((2048, 2048), Image.BILINEAR), np.float64) / 255
    scalp = np.clip((hair[..., 1] - 0.15) / 0.5, 0, 1); beard = hair[..., 0]
    from scipy import ndimage
    ref = lin(REF_TONE); rows = []
    for k, (sid, folder, f) in enumerate(SKINS):
        im = np.asarray(Image.open(os.path.join(MH, folder, f)).convert('RGB'), np.float64) / 255
        L = lin(im)
        # the scalp and the painted hair: MakeHuman paints hair on some scalps, hairlines, sideburns and beards; ours is
        # worn hair, a beard shell, a cap or the skin itself. Painted hair (darker than half the head's median, within the
        # dilated scalp or the beard region) and the scalp take the surrounding skin's colour (a normalised low-pass of the
        # skin left) with a tenth of their own detail
        Y = (L * [0.2126, 0.7152, 0.0722]).sum(-1)
        head = reg & (ndimage.binary_dilation(scalp > 0.05, iterations=90) | (beard > 0.08))
        med = np.median(Y[reg & (scalp < 0.05)])
        hairP = head & (Y < 0.55 * med)
        lab, nl = ndimage.label(hairP); touch = np.unique(lab[(scalp > 0.05) & hairP]); hairP = np.isin(lab, touch[touch > 0])  # (only hair joined to the scalp: not the eyes, nostrils or the lips' line)
        hairP = ndimage.binary_dilation(hairP, iterations=3)
        cut = np.clip(np.maximum(scalp, ndimage.gaussian_filter(hairP.astype(np.float64), 3) * 1.5), 0, 1)
        keep = (1 - cut) * reg
        fore = L[reg & (cut < 0.05)].mean(0); lo = np.broadcast_to(fore, L.shape).copy()
        for sg in (160, 60, 25):  # coarse to fine: each level where the kept skin around is dense enough
            wk = ndimage.gaussian_filter(keep, sg)
            lv = np.stack([ndimage.gaussian_filter(L[..., c] * keep, sg) for c in range(3)], -1) / np.maximum(wk, 1e-6)[..., None]
            a = np.clip((wk - 0.05) / 0.25, 0, 1)[..., None]; lo = lo * (1 - a) + lv * a
        own = np.stack([ndimage.gaussian_filter(L[..., c], 8) for c in range(3)], -1)
        L = L * (1 - cut[..., None]) + (lo * (1 + 0.1 * (L / np.maximum(own, 1e-4) - 1))) * cut[..., None]
        hairShare = float(hairP[reg].mean())
        mean = L[reg].mean(0)
        L = L * (ref / mean)
        L = fill_margin(L, mask)
        out = srgb(L)
        Image.fromarray((out * 255 + 0.5).astype(np.uint8)).resize((N, N), Image.LANCZOS).save(os.path.join(OUT, f'skin_{k:02d}.jpg'), quality=92)
        # measured: the source's mean (linear, tone region), its sRGB, and the local contrast kept (sd of log luminance
        # after a 16 px (2 cm-ish) high-pass, head region)
        Y = (L * [0.2126, 0.7152, 0.0722]).sum(-1); Yl = ndimage.gaussian_filter(Y, 16)
        hp = np.log(np.maximum(Y, 1e-4) / np.maximum(Yl, 1e-4))[reg & (cut < 0.05)]
        rows.append({'id': sid, 'layer': k, 'source': f'makehuman_cc0/skins/{folder}/{f}', 'meanLinear': [round(x, 5) for x in mean],
                     'meanSRGB': [round(float(x), 4) for x in srgb(mean)], 'hpSD': round(float(hp.std()), 4), 'paintedHairShare': round(hairShare, 4)})
        print('skin', k, sid, rows[-1]['meanSRGB'], 'hp sd', rows[-1]['hpSD'], 'hair', hairShare)
    return rows

def threads_per_tile(g):
    """dominant spatial frequency (cycles per tile) of the grey scan, from the FFT's strongest off-axis-free peak"""
    g = g - g.mean(); F = np.abs(np.fft.fft2(g)); n = g.shape[0]
    F[0, 0] = 0; fy = np.fft.fftfreq(n) * n
    R = np.hypot(*np.meshgrid(fy, fy, indexing='ij'))
    F[(R < 30)] = 0  # below 30 cycles per tile is drape and lighting, not threads
    i = np.unravel_index(np.argmax(F), F.shape)
    return float(R[i])

def build_cloth():
    rows = []
    for k, (cid, d, fab, fq) in enumerate(CLOTH):
        base = os.path.join(TX, d)
        info = json.load(open(os.path.join(base, '_info.json'), encoding='utf8'))
        im = Image.open(os.path.join(base, 'diff.jpg')).convert('RGB')
        sq = min(im.size); im = im.crop((0, 0, sq, sq))
        L = lin(np.asarray(im, np.float64) / 255); mean = L.reshape(-1, 3).mean(0)
        det = L / mean * CLOTH_K
        clip = float((det > 1).mean())
        Image.fromarray((srgb(det) * 255 + 0.5).astype(np.uint8)).resize((N, N), Image.LANCZOS).save(os.path.join(OUT, f'cloth_{k}.jpg'), quality=92)
        h = np.asarray(Image.open(os.path.join(base, 'disp.jpg')).convert('L').crop((0, 0, sq, sq)), np.float64) / 255
        h = np.clip(h - h.mean() + 0.5, 0, 1)
        Image.fromarray((h * 255 + 0.5).astype(np.uint8)).resize((N, N), Image.LANCZOS).save(os.path.join(OUT, f'cloth_{k}_h.jpg'), quality=90)
        g = np.asarray(im.convert('L').resize((1024, 1024), Image.LANCZOS), np.float64)
        tpt = threads_per_tile(g) if fq else 0
        dims = info.get('dimensions')  # Poly Haven: mm
        tile = (tpt / fq) if fq else (0.2 if fab == 'felt' else 0.25)
        arm = None
        if os.path.exists(os.path.join(base, 'arm.jpg')): arm = np.asarray(Image.open(os.path.join(base, 'arm.jpg')).convert('RGB'), np.float64)[..., 1].mean() / 255
        elif os.path.exists(os.path.join(base, 'rough.jpg')): arm = np.asarray(Image.open(os.path.join(base, 'rough.jpg')).convert('L'), np.float64).mean() / 255
        rows.append({'id': cid, 'layer': k, 'scan': os.path.basename(d), 'source': d, 'fabric': fab, 'meanLinear': [round(float(x), 5) for x in mean],
                     'meanRough': round(float(arm), 4) if arm is not None else None, 'threadsPerTile': round(tpt, 1), 'tile': round(tile, 4),
                     'scanDimsMm': dims, 'clipShare': round(clip, 5), 'k': CLOTH_K,
                     'name': info.get('name') or info.get('displayName'), 'authors': list((info.get('authors') or {}).keys()) if isinstance(info.get('authors'), dict) else ['ambientCG (Lennart Demes)'],
                     'url': (f"https://polyhaven.com/a/{os.path.basename(d)}" if d.startswith('polyhaven') else f"https://ambientcg.com/view?id={os.path.basename(d)}")})
        print('cloth', k, cid, rows[-1])
    return rows

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    mask, reg = body_mask()
    print('islands', round(float(mask.mean()), 3), 'tone region', round(float(reg.mean()), 3))
    skins = build_skins(mask, reg)
    cloth = build_cloth()
    json.dump({'note': 'D-304: the people\'s scanned layers (tools/build_humans_scans.py). skin: MakeHuman CC0 skins rescaled to REF_TONE; cloth: CC0 scans / their mean x k (sRGB), heights mean 0.5',
               'size': N, 'refTone': REF_TONE, 'skin': skins, 'cloth': cloth}, open(os.path.join(OUT, 'scans.json'), 'w'), indent=1)
