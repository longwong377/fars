// D-232: the plain's loam and Kuh-e Rahmat's rock against the photographs (linear sRGB decode, boxes in
// tools/dev/ground_photo_d232.py; references/INDEX.md §6): the satellite view #13 (NASA EO, natural colour)
// and the airliner view #8 give the mountain's brightness relative to the open plain and both hues; the ground photographs'
// grade (#24 Lightroom, #21 golden light) keeps them to hue ratios. Munsell: dry calcareous loam 10YR 5.5/3-6/3 (RECOLLECTION
// of the plain's soil descriptions, C), textbook dry-soil albedo 0.2-0.35 (Oke 1987, RECOLLECTION, C).
import { describe, it, expect } from 'vitest';
import { SURFACES } from '../src/render/materials';
import { HILL } from '../src/world/plain/terrainPlain';
import { GROUND_RHO } from '../src/sky/skySystem';

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (a: readonly number[]) => a.map(lin);
const Y = (a: readonly number[]) => { const l = L(a); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
const rg = (a: readonly number[]) => { const l = L(a); return l[0] / l[1]; }, bg = (a: readonly number[]) => { const l = L(a); return l[2] / l[1]; };
/** photo measurements (mountain / open plain in Y; hue of the mountain) */
const PHOTO = { mtnOverPlain: { sat13: 1.32, air8: 0.75, air8north: 1.01 }, mtnHue13: { rg: 1.22, bg: 0.73 }, plainHue13: { rg: 1.24, bg: 0.68 } };
const BEFORE = { loam: [0.43, 0.36, 0.27], rock: [0.50, 0.48, 0.45], scree: [0.58, 0.55, 0.50], soil: [0.47, 0.43, 0.37] };

describe('the plain\'s loam (D-232)', () => {
  it('a dry soil\'s albedo (0.2-0.3) and a buff hue; the probe bake\'s plain and the sky\'s ground bounce follow it', () => {
    const loam = SURFACES.earth.albedo;
    console.log(`loam Y ${Y(BEFORE.loam).toFixed(3)} -> ${Y(loam).toFixed(3)}; R/G ${rg(loam).toFixed(2)} B/G ${bg(loam).toFixed(2)} (satellite plain ${PHOTO.plainHue13.rg} / ${PHOTO.plainHue13.bg} through haze)`);
    expect(Y(loam)).toBeGreaterThan(0.2); expect(Y(loam)).toBeLessThan(0.3);
    expect(rg(loam)).toBeGreaterThan(PHOTO.plainHue13.rg); expect(bg(loam)).toBeLessThan(PHOTO.plainHue13.bg); // haze makes the satellite's bluer
    const cf = L(SURFACES.court_fill.albedo), e = L(loam);
    GROUND_RHO.forEach((g, i) => expect(g).toBeCloseTo((cf[i] + e[i]) / 2, 1));
  });
});

describe('Kuh-e Rahmat\'s rock (D-232)', () => {
  it('warm grey-brown like the photographs, not neutral grey; the mountain against the plain inside the photographs\' range', () => {
    const mtn = (h: typeof BEFORE | typeof HILL) => 0.4 * Y(h.rock) + 0.35 * Y(h.scree) + 0.25 * Y((h as any).slopeSoil ?? (h as any).soil); // a mix of the hills' covers (C)
    const before = mtn(BEFORE) / Y(BEFORE.loam), after = mtn(HILL) / Y(SURFACES.earth.albedo);
    console.log(`rock R/G ${rg(BEFORE.rock).toFixed(2)} -> ${rg(HILL.rock).toFixed(2)}, B/G ${bg(BEFORE.rock).toFixed(2)} -> ${bg(HILL.rock).toFixed(2)} (satellite ${PHOTO.mtnHue13.rg} / ${PHOTO.mtnHue13.bg}); mountain / plain ${before.toFixed(2)} -> ${after.toFixed(2)} (photos ${PHOTO.mtnOverPlain.air8}-${PHOTO.mtnOverPlain.sat13})`);
    for (const k of ['rock', 'scree', 'slopeSoil'] as const) { expect(rg(HILL[k])).toBeGreaterThanOrEqual(PHOTO.mtnHue13.rg); expect(bg(HILL[k])).toBeLessThanOrEqual(PHOTO.mtnHue13.bg); }
    expect(after).toBeGreaterThan(PHOTO.mtnOverPlain.air8); expect(after).toBeLessThan(PHOTO.mtnOverPlain.sat13);
    expect(before).toBeGreaterThan(PHOTO.mtnOverPlain.sat13); // the old loam was too dark for either photograph
    // the luminances of the hills' covers kept within 10 % (the change is hue and contrast, not brightness)
    expect(Math.abs(Y(HILL.rock) / Y(BEFORE.rock) - 1)).toBeLessThan(0.1); expect(Math.abs(Y(HILL.scree) / Y(BEFORE.scree) - 1)).toBeLessThan(0.1);
  });
});
