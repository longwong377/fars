"""Pre-render the scripted speech lines with eSpeak-NG (brief §10 Voice: "speech is synthesised from the lexicon's IPA,
converted to the synthesiser's own phoneme format (e.g. ... eSpeak-NG)"; "pre-rendered at build time where possible,
with varied voices, ages and sexes; post-processed; spatialised" — spatialisation happens at runtime).

- Input: the resolved lines (tools/speech_lines_json.ts): every word's IPA comes from research/LEXICON (tier_ipa C).
- IPA -> eSpeak-NG phoneme mnemonics by the table below. Checked by round trip: eSpeak's own IPA output of the
  mnemonic string is compared with the lexicon IPA (the build fails on any mismatch beyond the listed approximations).
- Base voice per language (C): Old Persian and Elamite through the Persian ('fa') phoneme rules, Aramaic through
  Arabic ('ar', which has the pharyngeals). The base voice sets prosody defaults only; the phonemes are ours.
- Voices (C): six classes (two men, an old man, two women, a child) = eSpeak variants + pitch + speed.
- Post-processing: trim silence, 80 Hz high-pass, peak-normalise to -3 dBFS, 10 ms fades; Ogg Opus 32 kb/s mono 24 kHz.
- Output: public/voices/<lineId>.<voiceKey>.ogg + public/voices/manifest.json (lineId|voiceKey -> url, tier, backend).
eSpeak-NG is GPL-3; it is a build tool here and none of its code ships. Its output audio carries no licence of its own
(ASSET_LEDGER.md). Run: python3 tools/build_speech.py   (needs espeak-ng and python soundfile)"""
import json, subprocess, os, sys, tempfile
import numpy as np, soundfile as sf
from scipy import signal

# IPA -> eSpeak mnemonic (multi-char first). Approximations (C): ʕ -> ɣ (no voiced pharyngeal in the tables), ˤ dropped
# (no emphatics), ç -> x, syllabic r̩ -> 'r-', ɛ -> e.
MAP = [('t͡ʃ', 'tS'), ('d͡ʒ', 'dZ'), ('r̩', 'r-'), ('aː', 'a:'), ('eː', 'e:'), ('iː', 'i:'), ('oː', 'o:'), ('uː', 'u:'),
       ('ʃ', 'S'), ('ʒ', 'Z'), ('θ', 'T'), ('ð', 'D'), ('ŋ', 'N'), ('ʔ', '?'), ('ħ', 'H'), ('ʕ', 'Q'), ('ç', 'x'), ('ɡ', 'g'),
       ('ə', '@'), ('ɛ', 'e'), ('ˤ', ''), ('r', 'R'), ('χ', 'X'), ('ɣ', 'Q')]
APPROX = {'ʕ': 'ɣ', 'ˤ': '', 'ç': 'x', 'ɛ': 'e'}  # what the round trip may legitimately differ by
BASE = {'op': 'fa', 'el': 'fa', 'arc': 'ar'}
VOICES = {  # key: (variant, pitch 0-99, speed wpm, note)
    'm1': ('m1', 38, 140, 'man, low'), 'm2': ('m3', 48, 150, 'man, mid'), 'm3': ('m7', 30, 125, 'old man'),
    'f1': ('f2', 62, 150, 'woman'), 'f2': ('f4', 55, 135, 'older woman'), 'c1': ('f5', 82, 160, 'child'),
}
def to_mnemonic(ipa: str) -> str:
    out, i = [], 0
    while i < len(ipa):
        for a, b in MAP:
            if ipa.startswith(a, i): out.append(b); i += len(a); break
        else: out.append(ipa[i]); i += 1
    return ''.join(out)
def espeak_ipa(mn: str, base: str) -> str:
    return subprocess.run(['espeak-ng', '-v', base, '-q', '--ipa', f'[[{mn}]]'], capture_output=True, text=True).stdout.strip()
def norm(s: str) -> str:
    for k, v in APPROX.items(): s = s.replace(k, v)
    return s.replace('ˈ', '').replace('ˌ', '').replace(' ', '').replace('ɹ', 'r').replace('r̩', 'r').replace('_', '')

def main():
    lines = json.loads(subprocess.run(['npx', 'tsx', 'tools/speech_lines_json.ts'], capture_output=True, text=True, check=True).stdout)
    os.makedirs('public/voices', exist_ok=True)
    manifest, problems = {}, []
    for L in lines:
        mn = to_mnemonic(L['ipa']); base = BASE[L['lang']]
        back = espeak_ipa(mn, base)
        if norm(back) != norm(L['ipa']): problems.append(f"{L['id']}: lexicon /{L['ipa']}/ -> [[{mn}]] -> espeak /{back}/")
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
            sf.write(path, x.astype('float32'), sr, format='OGG', subtype='OPUS')
            manifest[f"{L['id']}|{key}"] = {'url': path.replace('public/', ''), 'tier': 'C', 'backend': 'espeak-ng', 'voice': note}
    json.dump({'_meta': {'tool': 'tools/build_speech.py', 'synth': 'eSpeak-NG ' + subprocess.run(['espeak-ng', '--version'], capture_output=True, text=True).stdout.split()[3], 'voices': {k: v[3] for k, v in VOICES.items()}, 'approximations': APPROX}, 'clips': manifest}, open('public/voices/manifest.json', 'w'), indent=1, ensure_ascii=False)
    total = sum(os.path.getsize('public/' + m['url']) for m in manifest.values())
    print(f'{len(manifest)} clips, {total / 1024:.0f} KB')
    if problems: print('ROUND-TRIP MISMATCHES:\n  ' + '\n  '.join(problems)); sys.exit(1)
main()
