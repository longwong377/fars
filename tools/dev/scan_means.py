"""Measure a CC0 scan's means for src/data/scans.json (D-295, D-302): the diffuse map's linear-sRGB mean (the scans are laid
over the procedural albedo as scan / its own mean), the packed arm map's AO and roughness means, and (D-302) the
displacement map's mean (the ground layers' bump is disp - its mean). Metadata from the Poly Haven record (_info.json) in
C:/Users/Administrator/fars-assets/textures/polyhaven/<id>/ when present.
Run: py -3 tools/dev/scan_means.py <id> [<id> ...]   (prints the JSON entries; merge them into src/data/scans.json)"""
import sys, json, os
import numpy as np
from PIL import Image

ASSETS = 'C:/Users/Administrator/fars-assets/textures/polyhaven/'


def lin(a):
    a = a / 255.0
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def main(ids):
    out = {}
    for i in ids:
        d = f'public/textures/{i}/'
        diff = lin(np.asarray(Image.open(d + 'diff.jpg').convert('RGB').resize((512, 512), Image.BILINEAR), float))
        arm = np.asarray(Image.open(d + 'arm.jpg').convert('RGB').resize((512, 512), Image.BILINEAR), float) / 255
        e = {'meanLinear': [round(float(v), 5) for v in diff.reshape(-1, 3).mean(0)], 'meanAO': round(float(arm[..., 0].mean()), 4),
             'meanRough': round(float(arm[..., 1].mean()), 4)}
        if os.path.exists(d + 'disp.jpg'):
            disp = np.asarray(Image.open(d + 'disp.jpg').convert('L').resize((512, 512), Image.BILINEAR), float) / 255
            e['meanDisp'] = round(float(disp.mean()), 4); e['sdDisp'] = round(float(disp.std()), 4)
        info = ASSETS + i + '/_info.json'
        if os.path.exists(info):
            j = json.load(open(info, encoding='utf8'))
            e.update({'name': j['name'], 'authors': list(j['authors'].keys()), 'licence': 'CC0', 'source': f'https://polyhaven.com/a/{i}',
                      'res': '2k', 'tileMetres': round(j['dimensions'][0] / 1000, 2),
                      'maps': ['diff.jpg (sRGB)', 'arm.jpg (R ao, G roughness, B metal)'] + (['disp.jpg (height, linear)'] if 'meanDisp' in e else [])})
        out[i] = e
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main(sys.argv[1:])
