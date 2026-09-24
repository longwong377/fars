"""Machine phone recovery of the pre-rendered voices with allosaurus (D-167's approach 2, re-implemented in D-185; D-167's
own script was not kept, so absolute numbers differ from D-167's). Per clip: the phone error rate of allosaurus's output
(inventory pes for Old Persian and Elamite, arb for Aramaic, ell for Greek) against the line's IPA by semi-global
alignment (free hypothesis ends), and against the same phones shuffled (10 draws), the chance control.
Run: python3 tools/dev/voice_phones.py public/voices out.json   (needs allosaurus + torch, soundfile, scipy; its model is
downloaded on first use; ~20-40 min for 372 clips on 4 CPU cores). A measurement tool only (GPL-3), nothing ships."""
import sys, json, os, random, tempfile, collections
import numpy as np, soundfile as sf
from scipy import signal
from allosaurus.app import read_recognizer

voices_dir = sys.argv[1]
man = json.load(open(os.path.join(voices_dir, 'manifest.json')))
rec = read_recognizer()
INV = {'op': 'pes', 'el': 'pes', 'arc': 'arb', 'grc': 'ell'}

def phones(ipa):
    s = ipa.replace('ˈ', '').replace('ˌ', '').replace('ː', '').replace('ˤ', '').replace('ʰ', '').replace('̩', '').replace('ɡ', 'g')
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == ' ': i += 1; continue
        if i + 2 < len(s) and s[i + 1] == '͡': out.append(c + s[i + 2]); i += 3; continue
        out.append(c); i += 1
    # geminates as one phone
    res = []
    for p in out:
        if res and res[-1] == p and p not in 'aeiouyɛɔə': continue
        res.append(p)
    return res

def hnorm(h):
    return [p.replace('ː', '').replace('ɡ', 'g').replace('ʰ', '').replace('ˤ', '').replace('͡', '') for p in h.split()]

def semiglobal(ref, hyp):
    n, m = len(ref), len(hyp)
    D = np.zeros((n + 1, m + 1)); D[:, 0] = np.arange(n + 1)  # free leading hyp
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            D[i, j] = min(D[i - 1, j] + 1, D[i, j - 1] + 1, D[i - 1, j - 1] + (ref[i - 1] != hyp[j - 1]))
    return D[n].min() / n  # free trailing hyp

res = collections.defaultdict(list)
rng = random.Random(7)
for key, c in sorted(man['clips'].items()):
    lid, vk = key.split('|'); L = man['lines'][lid]
    x, sr = sf.read(os.path.join(os.path.dirname(voices_dir), c['url']), dtype='float32')
    x = signal.resample_poly(x, 16000, sr)
    with tempfile.NamedTemporaryFile(suffix='.wav') as tf:
        sf.write(tf.name, x, 16000, subtype='PCM_16')
        hyp = hnorm(rec.recognize(tf.name, INV[L['lang']]))
    ref = phones(L['ipa'])
    if not hyp: per, sh = 1.0, 1.0
    else:
        per = semiglobal(ref, hyp)
        sh = np.mean([semiglobal(rng.sample(ref, len(ref)), hyp) for _ in range(10)])
    res[L['lang']].append((per, sh))
out = {}
for lang, v in sorted(res.items()):
    a = np.array(v)
    out[lang] = {'clips': len(a), 'per_median': round(float(np.median(a[:, 0])), 3), 'shuffled_median': round(float(np.median(a[:, 1])), 3), 'better_than_shuffled': round(float((a[:, 0] < a[:, 1]).mean()), 3)}
    print(lang, out[lang])
json.dump(out, open(sys.argv[2], 'w'), indent=1)
