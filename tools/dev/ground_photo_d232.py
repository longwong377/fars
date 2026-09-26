"""D-232: the ground and Kuh-e Rahmat measured on the site photographs (references/INDEX.md §6): mean linear RGB (sRGB decode),
Y, R/G, B/G in boxes picked by eye (checked on the debug overlays written to shots/ground_d232_<n>.png).
#13 NASA Earth Observatory satellite image (natural colour): the mountain against the open plain and both hues.
#8 airliner view (hazy): the unpaved plain at the Terrace foot against the mountain's sunlit slopes.
#21 the Gate in low golden sun: the mountain's hue against the weathered stone under the same light.
#24 (Lightroom): the unpaved strip at the wall foot (winter, moist, grassy) against the sunlit wall and the modern gravel.
Run: python3 tools/dev/ground_photo_d232.py
"""
import numpy as np
from PIL import Image, ImageDraw

BOXES = {
    '13': ('references/another view from above.jpg', {'mtnNE': (480, 20, 700, 150), 'mtnE': (520, 200, 700, 330), 'mtnN': (370, 0, 470, 120), 'mtnSE': (600, 380, 700, 460),
                                                     'fieldsS': (250, 300, 330, 380), 'plainN': (280, 120, 340, 180), 'plainW': (60, 200, 130, 260), 'plainSW': (140, 380, 220, 440)}),
    '8': ('references/aeriel view of persepolis and surrounding mountains.webp', {'plainFoot': (330, 520, 460, 580), 'plainN': (180, 480, 300, 520), 'mtnSun': (520, 400, 640, 460),
                                                                                 'mtnMid': (380, 300, 500, 340), 'mtnL': (100, 380, 200, 420), 'court': (440, 640, 520, 680)}),
    '21': ('references/gate of all nations more.webp', {'mtnSun': (700, 520, 840, 640), 'mtnR': (1290, 480, 1420, 600), 'mtnL': (20, 590, 180, 640), 'skyHor': (700, 440, 1000, 480),
                                                       'column': (870, 420, 900, 600), 'bankFar': (620, 690, 760, 720)}),
    '24': ('references/persepolis and the mountain behind the ruins 2.webp', {'footStrip': (420, 662, 1000, 668), 'gravel': (400, 700, 1000, 740), 'wallSun': (300, 500, 700, 560)}),
}


def main():
    for n, (f, boxes) in BOXES.items():
        im = Image.open(f).convert('RGB'); a = np.asarray(im).astype(float) / 255
        lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4); dbg = im.copy(); d = ImageDraw.Draw(dbg)
        print(f'#{n} {f}')
        for lab, (x0, y0, x1, y1) in boxes.items():
            r = lin[y0:y1, x0:x1].reshape(-1, 3); m = r.mean(0); Y = float(m @ [0.2126, 0.7152, 0.0722])
            print(f'  {lab:10s} Y {Y:.3f}  R/G {m[0] / m[1]:.2f}  B/G {m[2] / m[1]:.2f}')
            d.rectangle([x0, y0, x1, y1], outline=(255, 0, 0)); d.text((x0 + 2, y0 + 2), lab, fill=(255, 255, 0))
        dbg.save(f'shots/ground_d232_{n}.png')


if __name__ == '__main__':
    main()
