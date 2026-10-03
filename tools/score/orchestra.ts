// The score's orchestra (D-760, UD-38/UD-39): real recorded instruments only. Every sound is a sample of a player:
// Sonatina Symphonic Orchestra (peastman/sso, CC Sampling Plus 1.0: strings, brass, woodwinds, chorus, harp, timpani,
// cymbals), VSCO-2 Community Edition (sgossner/VSCO-2-CE, CC0: the big drum, hand drums, gong, suspended cymbal swells),
// and the MuseScore General soundfont (MIT: the taiko layer), rendered by sfizz and fluidsynth (tools/score/build.ts).
// Each instrument has its seat on the stage (pan -1..1, depth 0 near .. 1 far: more hall, less air) and its articulations,
// one SFZ each (a part is written per articulation; the parts of one instrument share its seat). The section brass and the
// solo winds were recorded as ~4 s notes: their 'sus' is the library's looped variant; their legato is not looped, so the
// composer keeps legato notes under ~4 s and holds longer notes with 'sus'.
//
// Stand-ins, said plainly: no free duduk or ney library is reachable from the cloud, so the "duduk" voice is SSO's cor
// anglais (its reedy alto, with bends written into the part) and the "ney" is SSO's alto flute (breathy, low); a recorded
// duduk would replace them through tools/score/fetch_vagon.mjs.

export type Art = 'sus' | 'leg' | 'mar' | 'stac' | 'pizz' | 'trem' | 'harm' | 'hit';
export interface Inst {
  /** sampler: an SFZ under the SSO or VSCO roots, the generated drum kit, or a soundfont program (fluidsynth) */
  src: { sso?: Partial<Record<Art, string>>; kit?: true; sf?: { file: string; program: number; bank?: number } };
  /** playable MIDI range */ lo: number; hi: number;
  pan: number; depth: number; /** stereo width kept from the samples (0 mono .. 1 as recorded) */ width: number;
  /** trim (dB) to sit the family against the others at equal written dynamics */ trim: number;
  /** a short instrument (no CC dynamics: velocity only) */ perc?: boolean;
  /** onset jitter (ms, sd) and how much a section lags at slow attacks */ jitter: number;
}

const S = (dir: string, name: string, arts: Art[], looped = false): Partial<Record<Art, string>> => {
  const map: Record<Art, string> = { sus: 'Sustain', leg: 'Legato', mar: 'Marcato', stac: 'Staccato', pizz: 'Pizzicato', trem: 'Tremolo', harm: 'Harmonics', hit: '' };
  return Object.fromEntries(arts.map(a => [a, `${dir}/${name} ${map[a]}${looped && a === 'sus' ? ' (looped)' : ''}.sfz`]));
};
const STR = 'Strings - Performance', BR = 'Brass - Performance', WW = 'Woodwinds - Performance';
const strArts: Art[] = ['sus', 'leg', 'mar', 'stac', 'pizz', 'trem'];

export const ORCH = {
  // strings: the classic seating, firsts left, celli right, basses behind them
  vn1: { src: { sso: { ...S(STR, '1st Violins', [...strArts, 'harm']) } }, lo: 55, hi: 100, pan: -0.6, depth: 0.3, width: 0.6, trim: 0, jitter: 9 },
  vn2: { src: { sso: { ...S(STR, '2nd Violins', [...strArts, 'harm']) } }, lo: 55, hi: 96, pan: -0.28, depth: 0.35, width: 0.5, trim: -1, jitter: 9 },
  va: { src: { sso: S(STR, 'Violas', [...strArts, 'harm']) }, lo: 48, hi: 88, pan: 0.18, depth: 0.35, width: 0.5, trim: 0, jitter: 9 },
  vc: { src: { sso: S(STR, 'Celli', [...strArts, 'harm']) }, lo: 36, hi: 79, pan: 0.42, depth: 0.32, width: 0.5, trim: 0, jitter: 8 },
  cb: { src: { sso: S(STR, 'Basses', strArts) }, lo: 28, hi: 60, pan: 0.62, depth: 0.45, width: 0.4, trim: 0, jitter: 10 },
  vcSolo: { src: { sso: S(STR, 'Cello Solo', ['sus', 'leg', 'mar', 'stac', 'pizz']) }, lo: 36, hi: 84, pan: 0.15, depth: 0.15, width: 0.3, trim: 1, jitter: 5 },
  vnSolo: { src: { sso: { leg: `${STR}/Violin Solo 2 Legato.sfz`, sus: `${STR}/Violin Solo 2 Sustain.sfz` } }, lo: 55, hi: 103, pan: -0.2, depth: 0.15, width: 0.3, trim: 0, jitter: 5 },
  // brass behind the woodwinds: horns left, trumpets and trombones right
  hn: { src: { sso: S(BR, 'Horns', ['sus', 'leg', 'mar', 'stac']) }, lo: 34, hi: 77, pan: -0.35, depth: 0.65, width: 0.5, trim: 0, jitter: 10 },
  hnSolo: { src: { sso: S(BR, 'Horn Solo', ['sus', 'leg', 'mar', 'stac'], true) }, lo: 34, hi: 77, pan: -0.3, depth: 0.55, width: 0.3, trim: 0, jitter: 6 },
  tpt: { src: { sso: S(BR, 'Trumpets', ['sus', 'leg', 'mar', 'stac'], true) }, lo: 54, hi: 82, pan: 0.2, depth: 0.7, width: 0.4, trim: -3, jitter: 8 },
  tbn: { src: { sso: S(BR, 'Trombones', ['sus', 'leg', 'mar', 'stac'], true) }, lo: 40, hi: 72, pan: 0.4, depth: 0.7, width: 0.4, trim: -1, jitter: 8 },
  btbn: { src: { sso: S(BR, 'Bass Trombone Solo', ['sus', 'leg', 'mar', 'stac'], true) }, lo: 28, hi: 65, pan: 0.5, depth: 0.7, width: 0.3, trim: -1, jitter: 8 },
  tuba: { src: { sso: S(BR, 'Tuba', ['sus', 'leg', 'mar', 'stac'], true) }, lo: 26, hi: 58, pan: 0.55, depth: 0.72, width: 0.3, trim: -2, jitter: 8 },
  // woodwinds in the middle
  fl: { src: { sso: S(WW, 'Flutes', ['sus', 'leg', 'stac'], true) }, lo: 60, hi: 96, pan: -0.12, depth: 0.5, width: 0.4, trim: -2, jitter: 7 },
  afl: { src: { sso: S(WW, 'Alto Flute Solo', ['sus', 'leg', 'stac'], true) }, lo: 55, hi: 86, pan: -0.08, depth: 0.25, width: 0.3, trim: 0, jitter: 5 }, // the ney's stand-in
  ob: { src: { sso: S(WW, 'Oboe Solo', ['sus', 'leg', 'stac'], true) }, lo: 58, hi: 91, pan: 0.05, depth: 0.45, width: 0.3, trim: -1, jitter: 5 },
  eh: { src: { sso: S(WW, 'Cor Anglais Solo', ['sus', 'leg', 'stac'], true) }, lo: 52, hi: 81, pan: 0.0, depth: 0.12, width: 0.3, trim: 1, jitter: 4 }, // the duduk's stand-in
  cl: { src: { sso: S(WW, 'Clarinets', ['sus', 'leg', 'stac'], true) }, lo: 50, hi: 91, pan: -0.15, depth: 0.5, width: 0.4, trim: -2, jitter: 7 },
  bcl: { src: { sso: S(WW, 'Bass Clarinet Solo', ['sus', 'leg', 'stac'], true) }, lo: 34, hi: 70, pan: 0.0, depth: 0.5, width: 0.3, trim: -1, jitter: 7 },
  bsn: { src: { sso: S(WW, 'Bassoons', ['sus', 'leg', 'stac'], true) }, lo: 34, hi: 72, pan: 0.12, depth: 0.5, width: 0.4, trim: -2, jitter: 7 },
  cbsn: { src: { sso: S(WW, 'Contrabassoon Solo', ['sus', 'leg', 'stac'], true) }, lo: 22, hi: 53, pan: 0.2, depth: 0.55, width: 0.3, trim: -2, jitter: 8 },
  // voices without words: the large chorus (vowel "ah" with the dynamics fading through "oo" at piano)
  choir: { src: { sso: { sus: 'Chorus - Performance/Large Chorus.sfz' } }, lo: 41, hi: 81, pan: 0, depth: 0.85, width: 1, trim: -1, jitter: 12 },
  harp: { src: { sso: { hit: 'Concert Harp.sfz' } }, lo: 24, hi: 103, pan: -0.65, depth: 0.45, width: 0.4, trim: 0, perc: true, jitter: 4 },
  celeste: { src: { sso: { hit: 'Percussion/Celeste.sfz' } }, lo: 60, hi: 108, pan: -0.45, depth: 0.55, width: 0.3, trim: -4, perc: true, jitter: 3 },
  timp: { src: { sso: { hit: 'Percussion/Timpani.sfz' } }, lo: 36, hi: 57, pan: 0.0, depth: 0.85, width: 0.6, trim: 0, perc: true, jitter: 4 },
  cym: { src: { sso: { hit: 'Percussion/Cymbals & Tamtam.sfz' } }, lo: 48, hi: 72, pan: 0.15, depth: 0.85, width: 1, trim: -4, perc: true, jitter: 4 },
  // the drums (VSCO-2 CE, the generated kit: KIT below) and the taiko layer (MuseScore General, Taiko Drum, GM 117)
  kit: { src: { kit: true }, lo: 30, hi: 60, pan: 0, depth: 0.75, width: 0.8, trim: 0, perc: true, jitter: 4 },
  taiko: { src: { sf: { file: 'MuseScore_General.sf3', program: 116 } }, lo: 30, hi: 60, pan: 0, depth: 0.8, width: 0.6, trim: -2, perc: true, jitter: 5 },
} satisfies Record<string, Inst>;
export type InstId = keyof typeof ORCH;

/** the drum kit's keys (the generated SFZ maps VSCO-2 CE's percussion to them) */
export const KIT = {
  bigDrum: 36, // the concert bass drum, hit, 7 layers, 2 round robins, tuned down a fourth: the taiko weight
  doum: 38, tak: 39, // the low hand drum (tumba): the open stroke and the rim tap (the frame drum's two voices, C)
  hiDoum: 40, hiTak: 41, // conga
  ruff: 42, ruffTap: 43, // quinto
  gong: 45, gongScrape: 46,
  swellLong: 48, swellMid: 49, swellShort: 50, // suspended cymbal crescendi (land on the beat they lead to: KIT_SWELL)
  rumble: 52, // the bass drum rubbed: thunder under a chord
} as const;
/** how long each cymbal swell runs before its peak (s), measured from the samples by build.ts (fallbacks here) */
export const KIT_SWELL: Record<number, number> = { 48: 6.0, 49: 3.5, 50: 1.8 };

/** the kit's SFZ, written with absolute sample paths under the VSCO-2 CE root */
export function kitSfz(vsco: string): string {
  const P = `${vsco}/Percussion`, out: string[] = ['<control>', '<global> amp_veltrack=100 ampeg_release=4'];
  const layered = (key: number, base: string, layers: number[], rr: number, extra = '') => {
    layers.forEach((v, i) => { const lo = Math.round((i * 127) / layers.length) + 1, hi = Math.round(((i + 1) * 127) / layers.length);
      for (let r = 1; r <= rr; r++) out.push(`<region> key=${key} lovel=${lo} hivel=${hi} seq_length=${rr} seq_position=${r} amp_velcurve_${hi}=1 sample=${P}/${base.replace('{v}', String(v)).replace('{r}', String(r))} ${extra}`); });
  };
  layered(KIT.bigDrum, 'BDrumNewhit_v{v}_rr{r}_Sum.wav', [1, 2, 3, 4, 5, 6, 7], 2, 'transpose=-5 pitch_keycenter=36');
  layered(KIT.doum, 'Tumba-HitN_v{v}_rr{r}_Sum.wav', [1, 2, 3], 2);
  layered(KIT.tak, 'Tumba-Tap1_v{v}_rr{r}_Sum.wav', [1], 2);
  layered(KIT.hiDoum, 'Conga-HitN_v{v}_rr{r}_Sum.wav', [1, 2, 3], 2);
  layered(KIT.hiTak, 'Conga-Tap1_v{v}_rr{r}_Sum.wav', [1], 2);
  layered(KIT.ruff, 'Quinto-HitN_v{v}_rr{r}_Sum.wav', [1, 2, 3], 2);
  layered(KIT.ruffTap, 'Quinto-Tap1_v{v}_rr{r}_Sum.wav', [1], 2);
  ['p', 'mf', 'f', 'fff'].forEach((d, i) => out.push(`<region> key=${KIT.gong} lovel=${i * 32 + 1} hivel=${i * 32 + 32} sample=${P}/gongHit_${d}.wav ampeg_release=8`));
  out.push(`<region> key=${KIT.gongScrape} sample=${P}/gongscrape_mf.wav`);
  out.push(`<region> key=${KIT.swellLong} sample=${P}/susCymb1-cresc-Long_v1.wav loop_mode=one_shot`);
  out.push(`<region> key=${KIT.swellMid} sample=${P}/susCymb1-cresc-Median_v1.wav loop_mode=one_shot`);
  out.push(`<region> key=${KIT.swellShort} sample=${P}/susCymb1-cresc-Short_v1.wav loop_mode=one_shot`);
  [1, 2, 3, 4].forEach(r => out.push(`<region> key=${KIT.rumble} seq_length=4 seq_position=${r} sample=${P}/bassdrum_rub${r}_v1.wav loop_mode=one_shot`));
  return out.join('\n') + '\n';
}
