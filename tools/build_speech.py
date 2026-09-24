"""Pre-render the scripted speech lines with eSpeak-NG (brief §10 Voice: "speech is synthesised from the lexicon's IPA,
converted to the synthesiser's own phoneme format (e.g. ... eSpeak-NG)"; "pre-rendered at build time where possible,
with varied voices, ages and sexes; post-processed; spatialised" — spatialisation happens at runtime).

- Input: the resolved lines (tools/speech_lines_json.ts): every word's IPA comes from research/LEXICON (tier_ipa C).
- IPA -> eSpeak-NG phoneme mnemonics by the table below. Checked by round trip: eSpeak's own IPA output of the
  mnemonic string is compared with the lexicon IPA (the build fails on any mismatch beyond the listed approximations).
- Base voice per language (C): Old Persian and Elamite through the Persian ('fa') phoneme rules, Aramaic through
  Arabic ('ar', which has the pharyngeals), Ionic Greek through eSpeak's own Ancient Greek voice ('grc': y, ɛː, ɔː and the
  diphthongs; aspirated stops approximated as stop + h, see MAP_BY_BASE). The base voice sets prosody defaults only; the
  phonemes are ours, and the lexicon's accent marks (ˈ) are passed on as eSpeak stress marks.
- Languages with no eSpeak voice of their own and no pre-rendering here (FORMANT_ONLY): Babylonian. eSpeak-NG 1.51
  has no Akkadian voice; its lines are voiced at runtime by the project's formant synthesiser (src/audio/speech.ts,
  D-011), which the RecordingBackend falls through to when a line has no clip (D-107).
- Voices (C): six classes (two men, an old man, two women, a child) = eSpeak variants + pitch + speed.
- Post-processing: trim silence, 80 Hz high-pass, peak-normalise to -3 dBFS, 10 ms fades; Ogg Opus mono 24 kHz at
  libsndfile compression level COMPRESSION (≈ 28 kb/s, down from ≈ 37 kb/s in D-055, to keep the bundle small; D-107).
- Output: public/voices/<lineId>.<voiceKey>.ogg + public/voices/manifest.json (lineId|voiceKey -> url, tier, backend,
  sha256 of the file; `lines`: lineId -> the IPA, intonation, base voice and eSpeak mnemonic each clip voices, which the
  language lint compares with the current lines, so stale or swapped audio fails; D-167).
eSpeak-NG is GPL-3; it is a build tool here and none of its code ships. Its output audio carries no licence of its own
(ASSET_LEDGER.md). Run: python3 tools/build_speech.py   (needs espeak-ng and python soundfile)"""
import json, subprocess, os, sys, tempfile, glob, hashlib
import numpy as np, soundfile as sf
from scipy import signal

# IPA -> eSpeak mnemonic (multi-char first). Approximations (C): ʕ -> ɣ (no voiced pharyngeal in the tables), ˤ dropped
# (no emphatics), ç -> x, syllabic r̩ -> 'r-', ɛ -> e (fa/ar tables only; grc has ɛ).
MAP = [('t͡ʃ', 'tS'), ('d͡ʒ', 'dZ'), ('r̩', 'r-'), ('aː', 'a:'), ('eː', 'e:'), ('iː', 'i:'), ('oː', 'o:'), ('uː', 'u:'), ('yː', 'y:'),
       ('ɛː', 'E:'), ('ɔː', 'O:'), ('ˈ', "'"),
       ('ʃ', 'S'), ('ʒ', 'Z'), ('θ', 'T'), ('ð', 'D'), ('ŋ', 'N'), ('ʔ', '?'), ('ħ', 'H'), ('ʕ', 'Q'), ('ç', 'x'), ('ɡ', 'g'),
       ('ə', '@'), ('ɛ', 'e'), ('ɔ', 'O'), ('ˤ', ''), ('r', 'R'), ('χ', 'X'), ('ɣ', 'Q')]
# Greek only (tried first): falling diphthongs as eSpeak diphthong phonemes (otherwise it splits them into two syllables),
# and aspiration as stop + h: eSpeak's aspirated-stop mnemonics (k#, p#, t#) render kʰ but drop a stress mark placed
# before them, which moved the accent (measured: ['p#eRe]] -> pʰerˈe). So kʰ is approximated by k+h (C).
MAP_BY_BASE = {'grc': [('ai', 'aI'), ('oi', 'oI'), ('eu', 'eU'), ('au', 'aU'), ('ʰ', 'h')]}
APPROX = {'ʕ': 'ɣ', 'ˤ': '', 'ç': 'x', 'ɛ': 'e'}  # what the round trip may legitimately differ by
APPROX_BY_BASE = {'grc': {'ʰ': 'h', 'ɪ': 'i', 'ʊ': 'u'}}  # Greek: ɛ is kept (the grc table has it); diphthongs print as aɪ oɪ eʊ
BASE = {'op': 'fa', 'el': 'fa', 'arc': 'ar', 'grc': 'grc'}
FORMANT_ONLY = {'bab': 'no eSpeak-NG voice for Akkadian; voiced at runtime by the formant synthesiser (src/audio/speech.ts, D-011; D-107)'}
# libsndfile Opus compression level (0 = highest bitrate, 1 = lowest). Measured on two lines (grc 1.27 s, arc 2.02 s):
# default (unset, D-055) ≈ 36-39 kb/s; 0.9 ≈ 33; 0.92 ≈ 28-29; 0.95 ≈ 22 kb/s. 0.92 keeps eSpeak speech intact (its own
# spectrum is band-limited and buzzy) while cutting the bundle by ~25 %; set None for the D-055 bitrate.
COMPRESSION = 0.92
VOICES = {  # key: (variant, pitch 0-99, speed wpm, note)
    'm1': ('m1', 38, 140, 'man, low'), 'm2': ('m3', 48, 150, 'man, mid'), 'm3': ('m7', 30, 125, 'old man'),
    'f1': ('f2', 62, 150, 'woman'), 'f2': ('f4', 55, 135, 'older woman'), 'c1': ('f5', 82, 160, 'child'),
}
def to_mnemonic(ipa: str, base: str = '') -> str:
    table = MAP_BY_BASE.get(base, []) + MAP
    out, i = [], 0
    while i < len(ipa):
        for a, b in table:
            if ipa.startswith(a, i): out.append(b); i += len(a); break
        else: out.append(ipa[i]); i += 1
    return ''.join(out)
def espeak_ipa(mn: str, base: str) -> str:
    return subprocess.run(['espeak-ng', '-v', base, '-q', '--ipa', f'[[{mn}]]'], capture_output=True, text=True).stdout.strip()
def norm(s: str, base: str) -> str:
    for k, v in {**APPROX, **APPROX_BY_BASE.get(base, {})}.items():
        if base == 'grc' and k == 'ɛ': continue  # the Greek table keeps ɛ
        s = s.replace(k, v)
    return s.replace('ˈ', '').replace('ˌ', '').replace(' ', '').replace('ɹ', 'r').replace('r̩', 'r').replace('_', '').replace('͡', '')

def main():
    lines = json.loads(subprocess.run(['npx', 'tsx', 'tools/speech_lines_json.ts'], capture_output=True, text=True, check=True).stdout)
    os.makedirs('public/voices', exist_ok=True)
    manifest, problems, skipped, voiced = {}, [], {}, {}
    for L in lines:
        if L['lang'] in FORMANT_ONLY: skipped[L['id']] = L['lang']; continue
        base = BASE[L['lang']]; mn = to_mnemonic(L['ipa'], base)
        # what each clip voices, so the language lint can fail on stale or swapped audio (D-167)
        voiced[L['id']] = {'lang': L['lang'], 'ipa': L['ipa'], 'intonation': L['intonation'], 'base': base, 'mnemonic': mn}
        back = espeak_ipa(mn, base)
        if norm(back, base) != norm(L['ipa'], base): problems.append(f"{L['id']}: lexicon /{L['ipa']}/ -> [[{mn}]] -> espeak /{back}/")
        text = f'[[{mn}]]' + ('?' if L['intonation'] == 'rise' else '.')
        for key, (variant, pitch, speed, note) in VOICES.items():
            with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
                subprocess.run(['espeak-ng', '-v', f'{base}+{variant}', '-p', str(pitch), '-s', str(speed), '-w', tmp.name, text], check=True)
                x, sr = sf.read(tmp.name, dtype='float32')
            if x.ndim > 1: x = x.mean(axis=1)
            nz = np.flatnonzero(np.abs(x) > 0.01 * np.abs(x).max()); x = x[max(0, nz[0] - int(0.02 * sr)): nz[-1] + int(0.08 * sr)]
            x = signal.sosfilt(signal.butter(2, 80, 'hp', fs=sr, output='sos'), x)
            x = signal.resample_poly(x, 24000, sr); sr = 24000
            x = x / max(1e-6, np.abs(x).max()) * 10 ** (-3 / 20)
            f = int(0.01 * sr); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
            path = f"public/voices/{L['id']}.{key}.ogg"
            sf.write(path, x.astype('float32'), sr, format='OGG', subtype='OPUS', **({} if COMPRESSION is None else {'compression_level': COMPRESSION}))
            with open(path, 'rb') as fh: sha = hashlib.sha256(fh.read()).hexdigest()
            manifest[f"{L['id']}|{key}"] = {'url': path.replace('public/', ''), 'tier': 'C', 'backend': 'espeak-ng', 'voice': note, 'sha256': sha}
    # clips of lines that no longer exist (or moved to the formant backend) are removed, so the bundle holds only what plays
    keep = {'public/' + m['url'] for m in manifest.values()}
    stale = [p for p in glob.glob('public/voices/*.ogg') if p not in keep]
    for p in stale: os.remove(p)
    meta = {'tool': 'tools/build_speech.py', 'synth': 'eSpeak-NG ' + subprocess.run(['espeak-ng', '--version'], capture_output=True, text=True).stdout.split()[3],
            'voices': {k: v[3] for k, v in VOICES.items()}, 'approximations': APPROX, 'approximations_by_base': APPROX_BY_BASE, 'base_voices': BASE,
            'opus_compression_level': COMPRESSION, 'formant_only': FORMANT_ONLY, 'formant_only_lines': sorted(skipped)}
    with open('public/voices/manifest.json', 'w') as fh:
        json.dump({'_meta': meta, 'lines': voiced, 'clips': manifest}, fh, indent=1, ensure_ascii=False)
    total = sum(os.path.getsize('public/' + m['url']) for m in manifest.values())
    print(f'{len(manifest)} clips, {total / 1024:.0f} KB; {len(skipped)} lines formant-only ({", ".join(sorted(set(skipped.values())))}); {len(stale)} stale clips removed')
    if problems: print('ROUND-TRIP MISMATCHES:\n  ' + '\n  '.join(problems)); sys.exit(1)

if __name__ == '__main__':
    main()
