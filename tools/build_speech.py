"""Pre-render the scripted speech lines with eSpeak-NG (brief §10 Voice: "speech is synthesised from the lexicon's IPA,
converted to the synthesiser's own phoneme format (e.g. ... eSpeak-NG)"; "pre-rendered at build time where possible,
with varied voices, ages and sexes; post-processed; spatialised" — spatialisation happens at runtime).

- Input: the resolved lines (tools/speech_lines_json.ts): every word's IPA comes from research/LEXICON (tier_ipa C).
- IPA -> eSpeak-NG phoneme mnemonics by the table below. Checked by round trip: eSpeak's own IPA output of the
  mnemonic string is compared with the lexicon IPA (the build fails on any mismatch beyond the listed approximations).
- Stress (D-185, C): every word is sent with a stress mark on the syllable the formant voice stresses (speech.ts
  markStress: the lexicon's ˈ where it has one, else the language's STRESS_RULES; unaccented Greek clitics stay
  unaccented). eSpeak gives a phoneme string without stress marks no accent, and with no accent its intonation is flat:
  that was the measured monotony of D-167 (F0 5-95 % range 0.6-1.5 semitones). The line's IPA is unchanged.
- Utterance type (D-185, C) -> eSpeak clause type and pitch range: statement '.', question '?' (the line's intonation
  'rise'), command or exclamation '!', greeting '.' with a wider range, list (intonation 'level', counting) as one clause per
  word ending in ',' (a continuation, not a final fall). See UTTERANCE.
- Base voice per language (C): Old Persian and Elamite through the Persian ('fa') phoneme rules, Aramaic through
  Arabic ('ar', which has the pharyngeals), Ionic Greek through eSpeak's own Ancient Greek voice ('grc': y, ɛː, ɔː and the
  diphthongs; aspirated stops approximated as stop + h, see MAP_BY_BASE). The base voice sets prosody defaults only; the
  phonemes are ours.
- Languages with no eSpeak voice of their own and no pre-rendering here (FORMANT_ONLY): Babylonian. eSpeak-NG has no
  Akkadian voice; its lines are voiced at runtime by the project's formant synthesiser (src/audio/speech.ts, D-011),
  which the RecordingBackend falls through to when a line has no clip (D-107).
- Voices (C): six classes (two men, an old man, two women, a child) = eSpeak variant + pitch + range + speed. The pitch
  parameter of each class was set by measurement (tools/voice_acceptance.py) so that the class's median F0 lies inside
  published norms (VOICES, D-185).
- Post-processing: final lowering of statements and greetings (Praat PSOLA, see UTTERANCE), trim silence, 80 Hz high-pass, peak-normalise to -3 dBFS, 10 ms fades; Ogg Opus mono 24 kHz at
  libsndfile compression level COMPRESSION (≈ 28 kb/s, D-107).
- Output: public/voices/<lineId>.<voiceKey>.ogg + public/voices/manifest.json (lineId|voiceKey -> url, tier, backend,
  sha256 and seconds of the file; `lines`: lineId -> the IPA, intonation, utterance type, base voice, stressed IPA, eSpeak
  mnemonic and eSpeak input each clip voices, which the language lint compares with the current lines, so stale or swapped
  audio fails; D-167, D-185).
- Engines (D-185): `lib` = libespeak-ng through ctypes, from the PyPI package espeakng-loader (it ships libespeak-ng
  1.52.0 and its data, no command); `cmd` = the espeak-ng command (the D-055..D-107 path). `--engine auto` (default) takes
  the library when espeakng_loader imports, else the command.
eSpeak-NG is GPL-3; it is a build tool here and none of its code ships. Its output audio carries no licence of its own
(ASSET_LEDGER.md). Run: python3 tools/build_speech.py [--engine auto|lib|cmd] [--check]
(needs python soundfile, numpy, scipy, praat-parselmouth for the final lowering, and espeakng-loader or the espeak-ng
command). --check does the round trip only. Then re-measure: python3 tools/voice_acceptance.py (tests/voice_acceptance.test.ts
fails until the report matches the clips). A rebuild of unchanged inputs is byte-identical (fixed Ogg serials and noise
seeds, D-185)."""
import argparse, ctypes, json, subprocess, os, sys, tempfile, glob, hashlib, shutil
import numpy as np

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
# Voice classes (C). key: (eSpeak variant, pitch 0-99, pitch range 0-99, speed wpm, note, target median F0 Hz, source).
# The pitch parameter was set by measurement (tools/voice_acceptance.py over all clips, D-185) to put the class median
# near its target; the targets sit inside Hillenbrand et al. 1995 (vowdata tokens: men 131.2 ± 22.0 Hz, women 220.4 ± 23.2,
# children 10-12 y 236.9 ± 25.9) and follow the age trends of Hollien & Shipp 1972 (JSHR 15:155; men's F0 falls from
# the 20s to the 40s and rises again from the 60s) and Stoicheff 1981 (JSHR 24:437; women's F0 falls in the 50s, after
# the menopause, and stays lower) — the age studies read in their abstracts only (D-185). Before D-185 (pitch 38/48/30,
# 62/55, 82) the men measured a median 83 Hz, about 2 SD below the norm (D-167).
VOICES = {
    'm1': ('m1', 74, 50, 140, 'man, low', 118, 'H95 men mean - 0.6 SD'),
    'm2': ('m3', 78, 50, 150, 'man, mid', 135, 'H95 men mean + 0.2 SD'),
    'm3': ('m7', 70, 50, 125, 'old man', 125, 'H95 men; sim ages 50-55: Hollien & Shipp 1972, near the 40s minimum'),
    'f1': ('f2', 66, 50, 150, 'woman', 220, 'H95 women mean'),
    'f2': ('f4', 66, 50, 135, 'older woman', 205, 'H95 women - 0.7 SD; Stoicheff 1981: lower after the menopause'),
    'c1': ('f5', 70, 50, 160, 'child', 250, 'H95 children (10-12 y) + 0.5 SD: the sim children are 6-10 (voiceFor)'),
}
# Utterance type (C) -> eSpeak clause punctuation, the change to the voice's pitch range, and final lowering in semitones.
# eSpeak's own tunes carry the contour (statement: declination and a final fall; question: a final rise; exclamation: a
# high start and a steep fall; ',' a continuation rise); the range change widens greetings, calls and questions.
# Final lowering (D-185): eSpeak's statement tune ends on a nearly level low tail, so a word stressed on its first
# syllable (hutlak, haʃijam) falls within that syllable and then stays level; declaratives in natural speech keep falling
# to their end ("final lowering", Liberman & Pierrehumbert 1984). The last 35 % of the voiced span (at most 0.5 s) of a
# statement or greeting is lowered linearly to FINAL_LOWERING_ST below eSpeak's contour by Praat's PSOLA resynthesis
# (parselmouth), which keeps the formants. Chosen by measurement over eSpeak's other statement tunes (s2-s7) and a
# wider pitch range (T3, D-185). Measured by T3.
UTTERANCE = {
    'statement': ('.', 0, True), 'greeting': ('.', 15, True), 'command': ('!', 15, False), 'question': ('?', 30, False), 'list': (',', 0, False),
}
FINAL_LOWERING_ST, FINAL_LOWERING_SPAN, FINAL_LOWERING_MAX_S = 2.0, 0.35, 0.5
PSOLA_PITCH_RANGE = {'m': (60, 300), 'f': (100, 500), 'c': (120, 600)}  # Praat pitch analysis range by voice class

def utterance_type(L) -> str:
    """statement / greeting / command / question / list, from the line's intonation, intent and whether its (out-of-world)
    gloss is an exclamation (C, D-185)"""
    if L.get('intonation') == 'rise': return 'question'
    if L.get('intonation') == 'level': return 'list'
    if L.get('intent') in ('greet', 'reply', 'farewell'): return 'greeting'
    if L.get('exclaim') or L.get('intent') == 'call_workers': return 'command'
    return 'statement'

def to_mnemonic(ipa: str, base: str = '') -> str:
    table = MAP_BY_BASE.get(base, []) + MAP
    out, i = [], 0
    while i < len(ipa):
        for a, b in table:
            if ipa.startswith(a, i): out.append(b); i += len(a); break
        else: out.append(ipa[i]); i += 1
    return ''.join(out)

def espeak_input(mn: str, utterance: str) -> str:
    punct = UTTERANCE[utterance][0]
    if utterance == 'list': return ' '.join(f'[[{w}]],' for w in mn.split(' '))
    return f'[[{mn}]]{punct}'

def norm(s: str, base: str) -> str:
    for k, v in {**APPROX, **APPROX_BY_BASE.get(base, {})}.items():
        if base == 'grc' and k == 'ɛ': continue  # the Greek table keeps ɛ
        s = s.replace(k, v)
    return s.replace('ˈ', '').replace('ˌ', '').replace(' ', '').replace('ɹ', 'r').replace('r̩', 'r').replace('_', '').replace('͡', '')

# ---------------------------------------------------------------- engines
# eSpeak's women's and child variants (f2, f4, f5) add an echo (a 130-140 ms delay at 10-15 %). The world adds each space's
# own reverberation at runtime (§11), so these clips are reverberated twice, and the echo's tail can carry the pitch of the
# syllable before it past the end of the word. REMOVE_ECHO voices each class through a copy of its variant with the `echo`
# line removed, written into an overlay of the engine's data directory (nothing of eSpeak is stored in the repository).
# Measured in D-185 and NOT adopted: without the echo the contour thresholds still pass, but machine phone recovery of the
# woman's voice got worse (allosaurus, m1 + f1 over all 62 lines: mean phone error 0.745 -> 0.793, clips better than their
# shuffled control 53 % -> 44 %; the echo was the only change that moved it). Intelligibility wins (§10); the double
# reverberation stays logged (Q-287).
def overlay_data(data: str) -> str:
    """a temporary directory holding `espeak-ng-data`: links to everything in `data`, plus our variants `parsa-<key>`"""
    root = tempfile.mkdtemp(prefix='espeak-overlay-'); d = os.path.join(root, 'espeak-ng-data')
    os.makedirs(os.path.join(d, 'voices', '!v'))
    for n in os.listdir(data):
        if n != 'voices': os.symlink(os.path.join(data, n), os.path.join(d, n))
    for n in os.listdir(os.path.join(data, 'voices')):
        if n != '!v': os.symlink(os.path.join(data, 'voices', n), os.path.join(d, 'voices', n))
    for n in os.listdir(os.path.join(data, 'voices', '!v')):
        os.symlink(os.path.join(data, 'voices', '!v', n), os.path.join(d, 'voices', '!v', n))
    for key, v in VOICES.items():
        with open(os.path.join(data, 'voices', '!v', v[0]), encoding='utf-8') as fh: src = fh.read().splitlines()
        body = [ln for ln in src if not ln.strip().startswith(('echo', 'name') if REMOVE_ECHO else ('name',))]
        with open(os.path.join(d, 'voices', '!v', variant_name(key)), 'w', encoding='utf-8') as fh:
            fh.write('\n'.join([f'name {variant_name(key)}'] + body) + '\n')
    return root

def variant_name(key: str) -> str: return f'parsa-{key}'
REMOVE_ECHO = False

class CmdEngine:
    """the espeak-ng command (D-055..D-107). Pitch range through -P (espeak-ng's 'pitch range adjustment'; not
    exercised in session 6, where the command is absent)."""
    name = 'cmd'
    def __init__(self):
        if not shutil.which('espeak-ng'): raise RuntimeError('espeak-ng command not found')
        out = subprocess.run(['espeak-ng', '--version'], capture_output=True, text=True).stdout  # "... Data at: <dir>"
        self.path = overlay_data(out.split('Data at:')[1].strip())
    def version(self) -> str:
        return subprocess.run(['espeak-ng', '--version'], capture_output=True, text=True).stdout.split()[3]
    def ipa(self, mn: str, base: str) -> str:
        return subprocess.run(['espeak-ng', f'--path={self.path}', '-v', base, '-q', '--ipa', f'[[{mn}]]'], capture_output=True, text=True).stdout.strip()
    def synth(self, text: str, voice: str, pitch: int, rng: int, speed: int):
        import soundfile as sf
        with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
            subprocess.run(['espeak-ng', f'--path={self.path}', '-v', voice, '-p', str(pitch), '-P', str(rng), '-s', str(speed), '-w', tmp.name, text], check=True)
            x, sr = sf.read(tmp.name, dtype='float32')
        return (x.mean(axis=1) if x.ndim > 1 else x), sr

class LibEngine:
    """libespeak-ng through ctypes (speak_lib.h), library and data from PyPI espeakng-loader (D-185). Synchronous output
    to a callback; the IPA round trip reads eSpeak's phoneme trace (espeak_SetPhonemeTrace, as `espeak-ng -q --ipa`)."""
    name = 'lib'
    AUDIO_OUTPUT_SYNCHRONOUS, POS_CHARACTER = 2, 1
    CHARS_UTF8, PHONEMES, ENDPAUSE = 0x1, 0x100, 0x1000  # the flags the espeak-ng command synthesises with
    RATE, PITCH, RANGE = 1, 3, 4
    def __init__(self):
        import espeakng_loader
        c = ctypes
        lib = c.CDLL(espeakng_loader.get_library_path())
        lib.espeak_Initialize.argtypes = [c.c_int, c.c_int, c.c_char_p, c.c_int]; lib.espeak_Initialize.restype = c.c_int
        lib.espeak_Info.argtypes = [c.POINTER(c.c_char_p)]; lib.espeak_Info.restype = c.c_char_p
        lib.espeak_SetVoiceByName.argtypes = [c.c_char_p]; lib.espeak_SetVoiceByName.restype = c.c_int
        lib.espeak_SetParameter.argtypes = [c.c_int, c.c_int, c.c_int]; lib.espeak_SetParameter.restype = c.c_int
        lib.espeak_Synth.argtypes = [c.c_void_p, c.c_size_t, c.c_uint, c.c_int, c.c_uint, c.c_uint, c.c_void_p, c.c_void_p]
        lib.espeak_Synth.restype = c.c_int
        lib.espeak_Synchronize.restype = c.c_int
        lib.espeak_SetPhonemeTrace.argtypes = [c.c_int, c.c_void_p]
        data = overlay_data(espeakng_loader.get_data_path())
        self.sr = lib.espeak_Initialize(self.AUDIO_OUTPUT_SYNCHRONOUS, 0, data.encode(), 0)
        if self.sr <= 0: raise RuntimeError(f'espeak_Initialize failed ({self.sr}) with data {data}')
        self._buf = []
        CB = c.CFUNCTYPE(c.c_int, c.POINTER(c.c_short), c.c_int, c.c_void_p)
        def cb(wav, n, events):
            if n > 0 and wav: self._buf.append(np.ctypeslib.as_array(wav, shape=(n,)).copy())
            return 0
        self._cb = CB(cb); lib.espeak_SetSynthCallback(self._cb)
        self.libc = c.CDLL(None); self.libc.fopen.restype = c.c_void_p; self.libc.fopen.argtypes = [c.c_char_p, c.c_char_p]
        self.libc.fclose.argtypes = [c.c_void_p]
        self.lib = lib
    def version(self) -> str:
        p = ctypes.c_char_p(); return self.lib.espeak_Info(ctypes.byref(p)).decode()
    def _say(self, text: str, voice: str, pitch=50, rng=50, speed=175):
        if self.lib.espeak_SetVoiceByName(voice.encode()) != 0: raise RuntimeError(f'no eSpeak voice {voice}')
        self.lib.espeak_SetParameter(self.RATE, speed, 0); self.lib.espeak_SetParameter(self.PITCH, pitch, 0)
        self.lib.espeak_SetParameter(self.RANGE, rng, 0)
        b = text.encode('utf-8') + b'\0'; self._buf = []
        # eSpeak's breath noise is random (its own generator, and libc rand()): fixed seeds per clip make a rebuild identical
        self.lib.espeak_ng_SetRandSeed(ctypes.c_long(1)); self.libc.srand(1)
        r = self.lib.espeak_Synth(b, len(b), 0, self.POS_CHARACTER, 0, self.CHARS_UTF8 | self.PHONEMES | self.ENDPAUSE, None, None)
        if r != 0: raise RuntimeError(f'espeak_Synth error {r}')
        self.lib.espeak_Synchronize()
        return np.concatenate(self._buf) if self._buf else np.zeros(0, np.int16)
    def ipa(self, mn: str, base: str) -> str:
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as tf: path = tf.name
        fp = self.libc.fopen(path.encode(), b'w')
        try:
            self.lib.espeak_SetPhonemeTrace(0x02, fp)  # espeakPHONEMES_IPA
            self._say(f'[[{mn}]]', base)
        finally:
            self.lib.espeak_SetPhonemeTrace(0, None); self.libc.fclose(fp)
        with open(path, encoding='utf-8') as fh: out = fh.read().strip()
        os.unlink(path); return out
    def synth(self, text: str, voice: str, pitch: int, rng: int, speed: int):
        return self._say(text, voice, pitch, rng, speed).astype(np.float32) / 32768.0, self.sr

def get_engine(which: str):
    if which in ('auto', 'lib'):
        try: return LibEngine()
        except Exception as e:
            if which == 'lib': raise
            print(f'library engine unavailable ({e}); trying the espeak-ng command', file=sys.stderr)
    return CmdEngine()

# ---------------------------------------------------------------- build
def load_lines():
    return json.loads(subprocess.run(['npx', 'tsx', 'tools/speech_lines_json.ts'], capture_output=True, text=True, check=True).stdout)

def plan(L):
    """what a line's clips voice: the record the manifest keeps (and the lint compares)"""
    base = BASE[L['lang']]; ut = utterance_type(L)
    mn = to_mnemonic(L['stressed'], base)
    return {'lang': L['lang'], 'ipa': L['ipa'], 'intonation': L['intonation'], 'utterance': ut, 'base': base,
            'stressed': L['stressed'], 'mnemonic': mn, 'input': espeak_input(mn, ut)}

def render(eng, P, key):
    variant, pitch, rng, speed = VOICES[key][:4]
    x, sr = eng.synth(P['input'], f"{P['base']}+{variant_name(key)}", pitch, min(99, rng + UTTERANCE[P['utterance']][1]), speed)
    if UTTERANCE[P['utterance']][2]: x = final_lowering(x, sr, *PSOLA_PITCH_RANGE[key[0]])
    return x, sr

def final_lowering(x, sr, lo, hi):
    """lower the F0 of the last FINAL_LOWERING_SPAN of the voiced span linearly to FINAL_LOWERING_ST semitones at its end
    (Praat Manipulation, overlap-add resynthesis; D-185)"""
    import parselmouth
    from parselmouth.praat import call
    man = call(parselmouth.Sound(x.astype(np.float64), sampling_frequency=sr), 'To Manipulation', 0.01, lo, hi)
    tier = call(man, 'Extract pitch tier'); n = call(tier, 'Get number of points')
    if n < 4: return x
    ts = [call(tier, 'Get time from index', i) for i in range(1, n + 1)]; vs = [call(tier, 'Get value at index', i) for i in range(1, n + 1)]
    t1 = ts[-1]; t0 = max(t1 - FINAL_LOWERING_MAX_S, ts[0] + (1 - FINAL_LOWERING_SPAN) * (t1 - ts[0]))
    call(tier, 'Remove points between', ts[0] - 1, t1 + 1)
    for t, v in zip(ts, vs): call(tier, 'Add point', t, v * 2 ** (-FINAL_LOWERING_ST * max(0.0, (t - t0) / max(1e-6, t1 - t0)) / 12))
    call([man, tier], 'Replace pitch tier')
    return call(man, 'Get resynthesis (overlap-add)').values[0].astype(np.float32)

_CRC = []
def fix_ogg_serial(path: str, name: str):
    """libsndfile gives every Ogg stream a random serial number, so the same audio hashed differently on every build.
    Set the serial from the clip's name and recompute each page's CRC (Ogg: polynomial 0x04C11DB7, unreflected), so a
    rebuild of unchanged audio is byte-identical (D-185)."""
    if not _CRC:
        for i in range(256):
            r = i << 24
            for _ in range(8): r = ((r << 1) ^ 0x04C11DB7) & 0xFFFFFFFF if r & 0x80000000 else (r << 1) & 0xFFFFFFFF
            _CRC.append(r)
    serial = int(hashlib.sha256(name.encode()).hexdigest()[:8], 16)
    b = bytearray(open(path, 'rb').read()); i = 0
    while i < len(b):
        if b[i:i + 4] != b'OggS': raise ValueError(f'{path}: not an Ogg page at {i}')
        nseg = b[i + 26]; size = 27 + nseg + sum(b[i + 27: i + 27 + nseg])
        b[i + 14: i + 18] = serial.to_bytes(4, 'little'); b[i + 22: i + 26] = b'\0\0\0\0'
        crc = 0
        for byte in b[i: i + size]: crc = ((crc << 8) & 0xFFFFFFFF) ^ _CRC[((crc >> 24) & 0xFF) ^ byte]
        b[i + 22: i + 26] = crc.to_bytes(4, 'little'); i += size
    open(path, 'wb').write(bytes(b))

def post(x, sr):
    from scipy import signal
    nz = np.flatnonzero(np.abs(x) > 0.01 * np.abs(x).max()); x = x[max(0, nz[0] - int(0.02 * sr)): nz[-1] + int(0.08 * sr)]
    x = signal.sosfilt(signal.butter(2, 80, 'hp', fs=sr, output='sos'), x)
    x = signal.resample_poly(x, 24000, sr); sr = 24000
    x = x / max(1e-6, np.abs(x).max()) * 10 ** (-3 / 20)
    f = int(0.01 * sr); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    return x.astype('float32'), sr

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--engine', default='auto', choices=['auto', 'lib', 'cmd'])
    ap.add_argument('--check', action='store_true', help='IPA round trip only; write nothing')
    a = ap.parse_args()
    import soundfile as sf
    eng = get_engine(a.engine)
    lines = load_lines()
    os.makedirs('public/voices', exist_ok=True)
    manifest, problems, skipped, voiced = {}, [], {}, {}
    for L in lines:
        if L['lang'] in FORMANT_ONLY: skipped[L['id']] = L['lang']; continue
        P = plan(L)
        if P['stressed'].replace('ˈ', '') != L['ipa'].replace('ˈ', ''): problems.append(f"{L['id']}: stress marking changed the IPA ({P['stressed']})")
        # what each clip voices, so the language lint can fail on stale or swapped audio (D-167)
        voiced[L['id']] = P
        back = eng.ipa(P['mnemonic'], P['base'])
        if norm(back, P['base']) != norm(L['ipa'], P['base']): problems.append(f"{L['id']}: lexicon /{L['ipa']}/ -> [[{P['mnemonic']}]] -> espeak /{back}/")
        if a.check: continue
        for key, v in VOICES.items():
            x, sr = post(*render(eng, P, key))
            path = f"public/voices/{L['id']}.{key}.ogg"
            sf.write(path, x, sr, format='OGG', subtype='OPUS', **({} if COMPRESSION is None else {'compression_level': COMPRESSION}))
            fix_ogg_serial(path, f"{L['id']}.{key}")
            with open(path, 'rb') as fh: sha = hashlib.sha256(fh.read()).hexdigest()
            manifest[f"{L['id']}|{key}"] = {'url': path.replace('public/', ''), 'tier': 'C', 'backend': 'espeak-ng', 'voice': v[4], 'sha256': sha,
                                            'seconds': round(len(x) / sr, 3)}
    if a.check:
        print(f'round trip ({eng.name}, eSpeak-NG {eng.version()}): {len(voiced)} lines, {len(problems)} problems')
        if problems: print('  ' + '\n  '.join(problems)); sys.exit(1)
        return
    # clips of lines that no longer exist (or moved to the formant backend) are removed, so the bundle holds only what plays
    keep = {'public/' + m['url'] for m in manifest.values()}
    stale = [p for p in glob.glob('public/voices/*.ogg') if p not in keep]
    for p in stale: os.remove(p)
    meta = {'tool': 'tools/build_speech.py', 'synth': 'eSpeak-NG ' + eng.version(), 'engine': eng.name,
            'engine_note': {'lib': 'libespeak-ng via ctypes from PyPI espeakng-loader', 'cmd': 'the espeak-ng command'}[eng.name],
            'voices': {k: v[4] for k, v in VOICES.items()},
            'voice_params': {k: {'variant': v[0] + (' (any echo line removed)' if REMOVE_ECHO else ''), 'pitch': v[1], 'range': v[2], 'speed': v[3], 'target_f0_hz': v[5], 'target_source': v[6]} for k, v in VOICES.items()},
            'utterance': {k: {'punctuation': p, 'range_add': r, 'final_lowering_st': FINAL_LOWERING_ST if fl else 0} for k, (p, r, fl) in UTTERANCE.items()},
            'final_lowering': {'span': FINAL_LOWERING_SPAN, 'max_s': FINAL_LOWERING_MAX_S, 'method': 'Praat Manipulation, overlap-add (parselmouth)'},
            'approximations': APPROX, 'approximations_by_base': APPROX_BY_BASE, 'base_voices': BASE,
            'opus_compression_level': COMPRESSION, 'formant_only': FORMANT_ONLY, 'formant_only_lines': sorted(skipped),
            'decision': 'D-185 (pitch, stress, contour; library engine), after D-107 and D-167'}
    with open('public/voices/manifest.json', 'w') as fh:
        json.dump({'_meta': meta, 'lines': voiced, 'clips': manifest}, fh, indent=1, ensure_ascii=False)
    total = sum(os.path.getsize('public/' + m['url']) for m in manifest.values())
    print(f'{len(manifest)} clips, {total / 1024:.0f} KB ({eng.name}, eSpeak-NG {eng.version()}); {len(skipped)} lines formant-only ({", ".join(sorted(set(skipped.values())))}); {len(stale)} stale clips removed')
    if problems: print('ROUND-TRIP MISMATCHES:\n  ' + '\n  '.join(problems)); sys.exit(1)

if __name__ == '__main__':
    main()
