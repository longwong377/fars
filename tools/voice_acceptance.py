"""The machine part of the §10 voice acceptance (D-167, D-185): pitch level, pitch movement and vowel space of the
pre-rendered clips, measured against published norms and a natural-speech control. Writes research/voice_acceptance.json,
which tests/voice_acceptance.test.ts re-checks (same clips by sha256; thresholds recomputed from the per-clip numbers).

What it measures, per clip (Praat through parselmouth: autocorrelation pitch, Burg formants; 10 ms frames):
- F0 median (Hz) of the voiced frames, compared by voice class with Hillenbrand, Getty, Clark & Wheeler 1995 (JASA 97:
  3099; vowdata, 1,668 /hVd/ tokens: men 131.2 ± 22.0 Hz, women 220.4 ± 23.2, children 236.9 ± 25.9, tokens pooled);
- F0 5-95 % range in semitones (monotony);
- the nuclear movement in semitones: where the clip ends (median of the last 3 voiced frames) against the highest
  (`nuclear_fall_st`) and the lowest (`nuclear_rise_st`) point of the second half of its voiced frames, 5-frame median
  smoothed; judged by utterance type (T3). The first definition, a line fitted to the last 30 % of the voiced frames
  (`terminal_st`), is still reported: it misses the fall of a word stressed on its first syllable, where the fall lies in
  the stressed syllable and the rest is low and level (D-185);
- the share of loud voiced frames (within 12 dB of the clip's peak) whose F1/F2 lie inside the convex hull of the same
  talker group's H95 vowels (as D-167).
The same measures are taken on a natural-speech control, the openai/whisper test clip tests/jfk.flac (an adult man,
1961), cut into phrases at its pauses.

The thresholds are D-185's (the acceptance of §10 is a human rating; these are the measurable preconditions for it):
  T1 pitch   each voice class's median F0 within its H95 group mean ± 1 SD;
  T2 range   median clip F0 5-95 % range ≥ 3 semitones, and ≥ 80 % of clips ≥ 2 semitones;
  T3 contour every question ends rising (≥ +1 st above the trough before it, and not ≥ 1 st below the peak); ≥ 90 % of
             statements, greetings and commands end falling (≥ 1 st below the peak, not ≥ 1 st above the trough); lists
             (counting, intonation 'level') are reported, not judged;
  T4 vowels  ≥ 85 % of loud voiced frames inside the H95 vowel space of the talker group (D-167 measured 89-95 %).
Inputs not in git (data/raw/, .gitignore): data/raw/hillenbrand_vowdata.csv (compi1234/spchlab data/hillenbrand/vowdata.csv),
data/raw/whisper_jfk.flac (openai/whisper tests/jfk.flac); both are fetched when missing.
Run: python3 tools/voice_acceptance.py [--out research/voice_acceptance.json] [--voices public/voices]
Needs: numpy, scipy, soundfile, praat-parselmouth (measurement tools only, nothing ships)."""
import argparse, csv, hashlib, json, os, sys, urllib.request
import numpy as np, soundfile as sf
from scipy.spatial import Delaunay

H95_URL = 'https://raw.githubusercontent.com/compi1234/spchlab/main/data/hillenbrand/vowdata.csv'
JFK_URL = 'https://raw.githubusercontent.com/openai/whisper/main/tests/jfk.flac'
H95_PATH, JFK_PATH = 'data/raw/hillenbrand_vowdata.csv', 'data/raw/whisper_jfk.flac'
GROUP_OF = {'m1': 'men', 'm2': 'men', 'm3': 'men', 'f1': 'women', 'f2': 'women', 'c1': 'children'}
H95_GIDS = {'men': ('m',), 'women': ('w',), 'children': ('b', 'g')}
# Praat analysis settings by talker group (its manual's usual advice: pitch 75-300 Hz men, 100-500 women; max formant
# 5000 Hz men, 5500 women; children higher). The men's floor is 60 Hz so that the old, too-low clips are measured too.
PITCH_RANGE = {'men': (60, 300), 'women': (100, 500), 'children': (120, 600)}
MAX_FORMANT = {'men': 5000, 'women': 5500, 'children': 6500}
THRESHOLDS = {'T1_sd': 1.0, 'T2_median_st': 3.0, 'T2_min_st': 2.0, 'T2_share': 0.8, 'T3_rise_st': 1.0, 'T3_fall_st': -1.0,
              'T3_share': 0.9, 'T4_inside': 0.85}

def fetch(path, url):
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True); urllib.request.urlretrieve(url, path)
    return path

def h95():
    num = lambda v: float(v) if v not in ('', '#N/A', 'NA') else 0.0  # missing measurements are 0 or #N/A in the file
    rows = [{k: (num(v) if k in ('f0', 'F1', 'F2') else v) for k, v in r.items()} for r in csv.DictReader(open(fetch(H95_PATH, H95_URL), encoding='utf-8-sig'))]
    out = {}
    for g, gids in H95_GIDS.items():
        rs = [r for r in rows if r['gid'] in gids]
        f0 = np.array([r['f0'] for r in rs if r['f0'] > 0])
        pts = np.array([(r['F1'], r['F2']) for r in rs if r['F1'] > 0 and r['F2'] > 0])
        out[g] = {'f0_mean': round(float(f0.mean()), 1), 'f0_sd': round(float(f0.std()), 1), 'n': int(len(f0)), 'hull': Delaunay(pts)}
    return out

def measure(x, sr, group, hull=None):
    import parselmouth
    snd = parselmouth.Sound(x.astype(np.float64), sampling_frequency=sr)
    lo, hi = PITCH_RANGE[group]
    pitch = snd.to_pitch_ac(time_step=0.01, pitch_floor=lo, pitch_ceiling=hi)
    f0 = pitch.selected_array['frequency']; t = pitch.xs()
    v = f0 > 0
    if v.sum() < 5: return None
    fv = f0[v]; p5, p95 = np.percentile(fv, [5, 95]); med = float(np.median(fv))
    # terminal movement: a straight line fitted (in semitones, against time) to the last 30 % of the voiced frames (at
    # least 5), its rise or fall across them; robust to single-frame jitter
    tv = t[v]; k = max(5, int(round(0.3 * len(fv)))); st = 12 * np.log2(fv[-k:] / med)
    slope = np.polyfit(tv[-k:], st, 1)[0] if tv[-1] > tv[-k] else 0.0
    terminal = slope * (tv[-1] - tv[-k])
    # the nuclear movement (the gated T3 measure): where the utterance ends (median of its last 3 voiced frames) against
    # the highest and the lowest point of its second half (5-frame median-smoothed), in semitones. A final fall ends near
    # the bottom well below the peak before it; a final rise ends near the top well above the trough before it.
    h = max(5, len(fv) // 2); sm = np.array([np.median(fv[max(0, i - 2): i + 3]) for i in range(len(fv) - h, len(fv))])
    end = float(np.median(fv[-3:]))
    fall, rise = 12 * np.log2(end / sm.max()), 12 * np.log2(end / sm.min())
    res = {'f0_median': round(med, 1), 'f0_p5': round(float(p5), 1), 'f0_p95': round(float(p95), 1),
           'range_st': round(float(12 * np.log2(p95 / p5)), 2), 'terminal_st': round(float(terminal), 2),
           'nuclear_fall_st': round(float(fall), 2), 'nuclear_rise_st': round(float(rise), 2),
           'voiced_s': round(float(v.sum()) * 0.01, 2)}
    if hull is not None:
        fm = snd.to_formant_burg(time_step=0.01, max_number_of_formants=5, maximum_formant=MAX_FORMANT[group])
        inten = snd.to_intensity(minimum_pitch=lo, time_step=0.01)
        ts = t[v]; db = np.array([inten.get_value(tt) for tt in ts]); db = np.nan_to_num(db, nan=-1e9)
        loud = ts[db >= db.max() - 12]
        pts = np.array([(fm.get_value_at_time(1, tt), fm.get_value_at_time(2, tt)) for tt in loud])
        pts = pts[np.all(np.isfinite(pts), axis=1)]
        if len(pts): res['vowel_inside'] = round(float((hull.find_simplex(pts) >= 0).mean()), 3); res['vowel_frames'] = int(len(pts))
    return res

def control(H):
    """natural-speech control: jfk.flac, phrases split at pauses of ≥ 150 ms (RMS 25 dB below the peak)"""
    x, sr = sf.read(fetch(JFK_PATH, JFK_URL), dtype='float32')
    if x.ndim > 1: x = x.mean(axis=1)
    hop = int(0.01 * sr); rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])
    loud = 20 * np.log10(rms / rms.max()) > -25
    phrases, start, quiet = [], None, 0
    for i, l in enumerate(loud):
        if l:
            if start is None: start = i
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet >= 15: phrases.append((start, i - quiet + 1)); start, quiet = None, 0
    if start is not None: phrases.append((start, len(loud)))
    out = []
    for a, b in phrases:
        if (b - a) * 0.01 < 0.4: continue
        m = measure(x[a * hop: b * hop], sr, 'men', H['men']['hull'])
        if m: out.append({'t0': round(a * 0.01, 2), 't1': round(b * 0.01, 2), **m})
    return out

def summarise(clips, lines, H):
    by_key = {}
    for c in clips: by_key.setdefault(c['voice'], []).append(c)
    T = THRESHOLDS; s = {'voices': {}, 'failures': []}
    for key, cs in sorted(by_key.items()):
        g = GROUP_OF[key]; lo = H[g]['f0_mean'] - T['T1_sd'] * H[g]['f0_sd']; hi = H[g]['f0_mean'] + T['T1_sd'] * H[g]['f0_sd']
        med = float(np.median([c['f0_median'] for c in cs]))
        s['voices'][key] = {'group': g, 'clips': len(cs), 'f0_median': round(med, 1), 'band': [round(lo, 1), round(hi, 1)],
                            'z': round((med - H[g]['f0_mean']) / H[g]['f0_sd'], 2), 'range_st_median': round(float(np.median([c['range_st'] for c in cs])), 2),
                            'vowel_inside_median': round(float(np.median([c['vowel_inside'] for c in cs if 'vowel_inside' in c])), 3)}
        if not lo <= med <= hi: s['failures'].append(f'T1 {key}: median F0 {med:.1f} Hz outside {lo:.1f}-{hi:.1f}')
    rng = np.array([c['range_st'] for c in clips])
    s['range_st'] = {'median': round(float(np.median(rng)), 2), 'p10': round(float(np.percentile(rng, 10)), 2), 'p90': round(float(np.percentile(rng, 90)), 2),
                     'share_ge_min': round(float((rng >= T['T2_min_st']).mean()), 3)}
    if np.median(rng) < T['T2_median_st']: s['failures'].append(f"T2 median range {np.median(rng):.2f} st < {T['T2_median_st']}")
    if (rng >= T['T2_min_st']).mean() < T['T2_share']: s['failures'].append(f"T2 {(rng >= T['T2_min_st']).mean():.0%} of clips ≥ {T['T2_min_st']} st < {T['T2_share']:.0%}")
    s['contour'] = {}
    for ut in sorted({lines[c['line']]['utterance'] for c in clips}):
        cs = [c for c in clips if lines[c['line']]['utterance'] == ut]
        term = np.array([c['terminal_st'] for c in cs]); fall = np.array([c['nuclear_fall_st'] for c in cs]); rise = np.array([c['nuclear_rise_st'] for c in cs])
        ends_falling = (fall <= T['T3_fall_st']) & (rise < T['T3_rise_st']); ends_rising = (rise >= T['T3_rise_st']) & (fall > T['T3_fall_st'])
        e = {'clips': len(cs), 'nuclear_fall_median': round(float(np.median(fall)), 2), 'nuclear_rise_median': round(float(np.median(rise)), 2),
             'share_ends_falling': round(float(ends_falling.mean()), 3), 'share_ends_rising': round(float(ends_rising.mean()), 3),
             # the first definition (slope over the last 30 %), kept for comparison, not gated (D-185)
             'slope_terminal_median': round(float(np.median(term)), 2), 'slope_share_rise': round(float((term >= T['T3_rise_st']).mean()), 3),
             'slope_share_fall': round(float((term <= T['T3_fall_st']).mean()), 3)}
        s['contour'][ut] = e
        if ut == 'question' and e['share_ends_rising'] < 1: s['failures'].append(f"T3 questions: {e['share_ends_rising']:.0%} end in a rise ≥ {T['T3_rise_st']} st")
        if ut in ('statement', 'greeting', 'command') and e['share_ends_falling'] < T['T3_share']:
            s['failures'].append(f"T3 {ut}: {e['share_ends_falling']:.0%} end in a fall ≤ {T['T3_fall_st']} st (< {T['T3_share']:.0%})")
    for g in H:
        vi = [c['vowel_inside'] for c in clips if GROUP_OF[c['voice']] == g and 'vowel_inside' in c]
        if vi and np.median(vi) < T['T4_inside']: s['failures'].append(f'T4 {g}: median {np.median(vi):.0%} inside the H95 vowel space')
    s['pass'] = not s['failures']
    return s

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default='research/voice_acceptance.json'); ap.add_argument('--voices', default='public/voices')
    a = ap.parse_args()
    man = json.load(open(os.path.join(a.voices, 'manifest.json'), encoding='utf-8'))
    H = h95(); clips = []
    lines = {}
    for lid, L in man['lines'].items():
        lines[lid] = {'utterance': L.get('utterance') or utterance_of(lid, L)}
    for key, c in sorted(man['clips'].items()):
        lid, vk = key.split('|'); path = os.path.join(os.path.dirname(a.voices), c['url'])
        buf = open(path, 'rb').read(); x, sr = sf.read(path, dtype='float32')
        if x.ndim > 1: x = x.mean(axis=1)
        g = GROUP_OF[vk]; m = measure(x, sr, g, H[g]['hull'])
        if m is None: print('no voiced frames:', key); continue
        clips.append({'line': lid, 'voice': vk, 'sha256': hashlib.sha256(buf).hexdigest(), **m})
    ctl = control(H)
    summ = summarise(clips, lines, H)
    summ['control'] = {'source': 'openai/whisper tests/jfk.flac (natural speech, adult man)', 'phrases': ctl,
                       'range_st_median': round(float(np.median([p['range_st'] for p in ctl])), 2) if ctl else None}
    rep = {'_meta': {'tool': 'tools/voice_acceptance.py', 'decision': 'D-185 (after D-167)', 'synth': man['_meta'].get('synth'),
                     'norms': {g: {k: v for k, v in h.items() if k != 'hull'} for g, h in H.items()},
                     'norms_source': 'Hillenbrand, Getty, Clark & Wheeler 1995, JASA 97:3099 (vowdata; tokens pooled; children = boys + girls)',
                     'thresholds': THRESHOLDS, 'praat_pitch_range': PITCH_RANGE, 'praat_max_formant': MAX_FORMANT},
           'lines': lines, 'summary': summ, 'clips': clips}
    os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
    with open(a.out, 'w', encoding='utf-8') as fh: json.dump(rep, fh, indent=1, ensure_ascii=False)
    print(f"{len(clips)} clips measured -> {a.out}")
    for k, v in summ['voices'].items(): print(f"  {k} ({v['group']}): F0 median {v['f0_median']} Hz (band {v['band'][0]}-{v['band'][1]}, z {v['z']:+}), range {v['range_st_median']} st, vowels inside {v['vowel_inside_median']:.0%}")
    print(f"  range: median {summ['range_st']['median']} st (p10 {summ['range_st']['p10']}, p90 {summ['range_st']['p90']}); ≥ 2 st: {summ['range_st']['share_ge_min']:.0%}")
    for ut, e in summ['contour'].items():
        print(f"  {ut}: {e['clips']} clips, nuclear fall median {e['nuclear_fall_median']:+} st, rise {e['nuclear_rise_median']:+} st; ends falling {e['share_ends_falling']:.0%}, rising {e['share_ends_rising']:.0%}"
              f" | slope measure: median {e['slope_terminal_median']:+} st, fall {e['slope_share_fall']:.0%}, rise {e['slope_share_rise']:.0%}")
    print(f"  control (jfk.flac, {len(ctl)} phrases): range median {summ['control']['range_st_median']} st; nuclear fall/rise {[(p['nuclear_fall_st'], p['nuclear_rise_st']) for p in ctl]}")
    print('PASS' if summ['pass'] else 'NOT MET:\n  ' + '\n  '.join(summ['failures']))

_LINES = None
def utterance_of(lid, L):
    """utterance type for a manifest written before D-185 (which records it): build_speech.py utterance_type"""
    global _LINES
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from build_speech import utterance_type, load_lines
    if _LINES is None: _LINES = {x['id']: x for x in load_lines()}
    return utterance_type(_LINES[lid])

if __name__ == '__main__':
    main()
