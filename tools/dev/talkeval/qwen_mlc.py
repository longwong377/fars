# D-456: the shipped talk model (Qwen2.5-1.5B-Instruct, MLC q4f16_1, D-394) run on CPU with numpy, read straight from the
# MLC shards the game streams (git branch models-archive). No llama.cpp: the cloud box may not build code fetched from
# GitHub, so this is a small reference Qwen2 forward pass (f32 compute over the exact dequantized 4-bit weights).
#
#   python3 tools/dev/talkeval/qwen_mlc.py <mlc dir> check        # tokenizer + sanity prompts
#   python3 tools/dev/talkeval/qwen_mlc.py <mlc dir> serve [port]  # HTTP: POST /chat {messages, max_tokens, temperature, ...}
#
# The weights: q_weight [out, in/8] uint32 holds 8 four-bit values, low nibble first; q_scale [out, in/32] float16;
# w = (q - 7) * scale (MLC GroupQuantize, group 32, symmetric, max_int 7). c_attn is q|k|v fused (1536+256+256, with bias),
# gate_up_proj is gate|up (8960+8960); the embedding is tied to the head.
# The tokenizer: the archive has merges.txt but no vocab.json/tokenizer.json for this model, so the vocabulary is rebuilt
# (byte-level BPE: the 256 byte symbols in GPT-2 order, then one token per merge, in order; specials from 151643). check
# verifies it against ids published for Qwen2's tokenizer.
# Sampling follows WebLLM (mind.ts): temperature, top_p, frequency/presence penalties over the generated tokens, and the
# chat config's repetition_penalty 1.1 (WebLLM applies the mlc-chat-config default when the request leaves it unset).
import sys, os, json, time, threading, queue, unicodedata
import numpy as np
import regex

D, H, KVH, HD, FF, NL, V = 1536, 12, 2, 128, 8960, 28, 151936
EPS, THETA = 1e-6, 1e6
SPECIAL = {'<|endoftext|>': 151643, '<|im_start|>': 151644, '<|im_end|>': 151645}
STOP = {151643, 151645}

# ---------- tokenizer ----------
def bytes_to_unicode():
    bs = list(range(ord('!'), ord('~') + 1)) + list(range(ord('¡'), ord('¬') + 1)) + list(range(ord('®'), ord('ÿ') + 1))
    cs = bs[:]; n = 0
    for b in range(256):
        if b not in bs: bs.append(b); cs.append(256 + n); n += 1
    return dict(zip(bs, map(chr, cs)))

PAT = regex.compile(r"""(?i:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+""")
SPLIT_SPECIAL = regex.compile('(' + '|'.join(regex.escape(s) for s in SPECIAL) + ')')

class Tokenizer:
    def __init__(self, merges_path):
        b2u = bytes_to_unicode(); self.b2u = b2u; self.u2b = {v: k for k, v in b2u.items()}
        order = list(b2u.values())  # GPT-2 order: printable bytes first
        self.vocab = {c: i for i, c in enumerate(order)}; self.ranks = {}
        with open(merges_path, encoding='utf-8') as f:
            for i, line in enumerate(l.rstrip('\n') for l in f):
                if not line or line.startswith('#version'): continue
                a, b = line.split(' '); self.ranks[(a, b)] = len(self.ranks); self.vocab[a + b] = 256 + len(self.ranks) - 1
        assert len(self.vocab) == 151643, len(self.vocab)
        self.inv = {i: s for s, i in self.vocab.items()}
        for s, i in SPECIAL.items(): self.inv[i] = s
        self.cache = {}
    def bpe(self, word):
        if word in self.cache: return self.cache[word]
        parts = list(word)
        while len(parts) > 1:
            best, bi = None, -1
            for i in range(len(parts) - 1):
                r = self.ranks.get((parts[i], parts[i + 1]))
                if r is not None and (best is None or r < best): best, bi = r, i
            if best is None: break
            parts[bi:bi + 2] = [parts[bi] + parts[bi + 1]]
        ids = [self.vocab[p] for p in parts]; self.cache[word] = ids; return ids
    def encode(self, text):
        out = []
        for chunk in SPLIT_SPECIAL.split(text):
            if not chunk: continue
            if chunk in SPECIAL: out.append(SPECIAL[chunk]); continue
            for w in PAT.findall(unicodedata.normalize('NFC', chunk)):
                out.extend(self.bpe(''.join(self.b2u[b] for b in w.encode('utf-8'))))
        return out
    def decode_bytes(self, ids):
        bs = bytearray()
        for i in ids:
            s = self.inv[i]
            if i >= 151643: bs.extend(s.encode()); continue
            bs.extend(self.u2b[c] for c in s)
        return bytes(bs)
    def decode(self, ids): return self.decode_bytes(ids).decode('utf-8', errors='replace')

def chat_text(messages):
    """the qwen2 conv template of mlc-chat-config.json (system, user/assistant turns, then the assistant's turn opened)"""
    s = ''
    if not messages or messages[0]['role'] != 'system': s += '<|im_start|>system\nYou are a helpful assistant.<|im_end|>\n'
    for m in messages: s += f"<|im_start|>{m['role']}\n{m['content']}<|im_end|>\n"
    return s + '<|im_start|>assistant\n'

# ---------- weights ----------
def load_raw(mdir):
    idx = json.load(open(os.path.join(mdir, 'ndarray-cache.json'))); out = {}
    for shard in idx['records']:
        p = os.path.join(mdir, shard['dataPath'])
        if os.path.exists(p): buf = open(p, 'rb').read()
        else:  # split into .partNN files in the archive (GitHub's 100 MB limit)
            k = 0; chunks = []
            while os.path.exists(f'{p}.part{k:02d}'): chunks.append(open(f'{p}.part{k:02d}', 'rb').read()); k += 1
            buf = b''.join(chunks)
        assert len(buf) == shard['nbytes'], (p, len(buf), shard['nbytes'])
        for r in shard['records']:
            a = np.frombuffer(buf, dtype=np.dtype(r['dtype']), count=int(np.prod(r['shape'])), offset=r['byteOffset']).reshape(r['shape'])
            out[r['name']] = a
    return out

def deq(qw, qs):
    """[out, in/8] uint32 + [out, in/32] f16 -> [out, in] f32"""
    o = qw.shape[0]; sh = (np.arange(8, dtype=np.uint32) * 4)
    q = ((qw[:, :, None] >> sh) & 0xF).reshape(o, -1).astype(np.float32) - 7.0
    return (q.reshape(o, -1, 32) * qs.astype(np.float32)[:, :, None]).reshape(o, -1)

def load_weights(mdir, cache_dir):
    os.makedirs(cache_dir, exist_ok=True); f = os.path.join(cache_dir, 'w.npz')
    names = ['embed', 'norm'] + [f'{n}{i}' for i in range(NL) for n in ('ln1_', 'ln2_', 'qkv_', 'qkvb_', 'o_', 'gu_', 'dn_')]
    if all(os.path.exists(os.path.join(cache_dir, n + '.npy')) for n in names):
        return {n: np.load(os.path.join(cache_dir, n + '.npy'), mmap_mode='r') for n in names}
    R = load_raw(mdir); W = {}
    W['embed'] = deq(R['model.embed_tokens.q_weight'], R['model.embed_tokens.q_scale'])
    W['norm'] = R['model.norm.weight'].astype(np.float32)
    for i in range(NL):
        p = f'model.layers.{i}.'
        W[f'ln1_{i}'] = R[p + 'input_layernorm.weight'].astype(np.float32); W[f'ln2_{i}'] = R[p + 'post_attention_layernorm.weight'].astype(np.float32)
        W[f'qkv_{i}'] = deq(R[p + 'self_attn.c_attn.q_weight'], R[p + 'self_attn.c_attn.q_scale']); W[f'qkvb_{i}'] = R[p + 'self_attn.c_attn.bias'].astype(np.float32)
        W[f'o_{i}'] = deq(R[p + 'self_attn.o_proj.q_weight'], R[p + 'self_attn.o_proj.q_scale'])
        W[f'gu_{i}'] = deq(R[p + 'mlp.gate_up_proj.q_weight'], R[p + 'mlp.gate_up_proj.q_scale'])
        W[f'dn_{i}'] = deq(R[p + 'mlp.down_proj.q_weight'], R[p + 'mlp.down_proj.q_scale'])
    for n, a in W.items(): np.save(os.path.join(cache_dir, n + '.npy'), np.ascontiguousarray(a))
    return {n: np.load(os.path.join(cache_dir, n + '.npy'), mmap_mode='r') for n in names}

# ---------- model ----------
INV = 1.0 / (THETA ** (np.arange(0, HD, 2, dtype=np.float64) / HD))
def rope(x, pos):  # x [n, heads, HD], pos [n]
    f = np.outer(pos, INV); c = np.cos(f).astype(np.float32)[:, None, :]; s = np.sin(f).astype(np.float32)[:, None, :]
    a, b = x[..., :HD // 2], x[..., HD // 2:]
    return np.concatenate([a * c - b * s, b * c + a * s], axis=-1)
def rms(x, w): return x / np.sqrt((x * x).mean(-1, keepdims=True) + EPS) * w
def silu(x): return x / (1.0 + np.exp(-x))

class Seq:
    """one sequence's KV cache (grown in blocks)"""
    def __init__(self, cap=1024):
        self.k = np.zeros((NL, KVH, cap, HD), np.float32); self.v = np.zeros((NL, KVH, cap, HD), np.float32); self.n = 0; self.toks = []
    def ensure(self, n):
        if n <= self.k.shape[2]: return
        cap = max(n, self.k.shape[2] * 2)
        for a in ('k', 'v'):
            z = np.zeros((NL, KVH, cap, HD), np.float32); z[:, :, :self.n] = getattr(self, a)[:, :, :self.n]; setattr(self, a, z)
    def copy_prefix(self, n):
        s = Seq(max(1024, n + 256)); s.k[:, :, :n] = self.k[:, :, :n]; s.v[:, :, :n] = self.v[:, :, :n]; s.n = n; s.toks = self.toks[:n]; return s

class Model:
    def __init__(self, W): self.W = W
    def forward(self, seqs, toks_per_seq):
        """seqs: list of Seq; toks_per_seq: list of token lists (new tokens for each). Returns the last position's logits [B, V].
        Matmuls are batched over every new token of every sequence; attention is per sequence."""
        W = self.W; ids = [t for ts in toks_per_seq for t in ts]
        x = np.asarray(W['embed'][ids], np.float32)
        pos = np.concatenate([np.arange(s.n, s.n + len(ts)) for s, ts in zip(seqs, toks_per_seq)])
        for s, ts in zip(seqs, toks_per_seq): s.ensure(s.n + len(ts))
        for i in range(NL):
            h = rms(x, W[f'ln1_{i}'])
            qkv = h @ W[f'qkv_{i}'].T + W[f'qkvb_{i}']
            q = rope(qkv[:, :D].reshape(-1, H, HD), pos); k = rope(qkv[:, D:D + KVH * HD].reshape(-1, KVH, HD), pos); v = qkv[:, D + KVH * HD:].reshape(-1, KVH, HD)
            att = np.empty((len(ids), H, HD), np.float32); o = 0
            for s, ts in zip(seqs, toks_per_seq):
                m = len(ts); n0 = s.n
                s.k[i, :, n0:n0 + m] = k[o:o + m].transpose(1, 0, 2); s.v[i, :, n0:n0 + m] = v[o:o + m].transpose(1, 0, 2)
                K = s.k[i, :, :n0 + m]; Vv = s.v[i, :, :n0 + m]  # [KVH, T, HD]
                qq = q[o:o + m].reshape(m, KVH, H // KVH, HD).transpose(1, 2, 0, 3)  # [KVH, G, m, HD]
                sc = qq @ K[:, None].transpose(0, 1, 3, 2) / np.sqrt(HD)  # [KVH, G, m, T]
                if m > 1: sc = sc + np.triu(np.full((m, n0 + m), -1e30, np.float32), k=n0 + 1)
                sc = np.exp(sc - sc.max(-1, keepdims=True)); sc /= sc.sum(-1, keepdims=True)
                att[o:o + m] = (sc @ Vv[:, None]).transpose(2, 0, 1, 3).reshape(m, H, HD); o += m
            x = x + att.reshape(-1, D) @ W[f'o_{i}'].T
            h = rms(x, W[f'ln2_{i}']); gu = h @ W[f'gu_{i}'].T
            x = x + (silu(gu[:, :FF]) * gu[:, FF:]) @ W[f'dn_{i}'].T
        for s, ts in zip(seqs, toks_per_seq): s.n += len(ts); s.toks += ts
        ends = np.cumsum([len(ts) for ts in toks_per_seq]) - 1
        return rms(x[ends], W['norm']) @ W['embed'].T

def sample(logits, gen, p, rng):
    l = logits.astype(np.float64).copy()
    if gen:
        u, c = np.unique(gen, return_counts=True)
        rp = p.get('repetition_penalty', 1.1)
        if rp != 1.0: l[u] = np.where(l[u] > 0, l[u] / rp, l[u] * rp)
        l[u] -= c * p.get('frequency_penalty', 0.0) + p.get('presence_penalty', 0.0)
    t = p.get('temperature', 0.7)
    if t <= 1e-5: return int(np.argmax(l))
    l = l / t; l -= l.max(); pr = np.exp(l); pr /= pr.sum()
    tp = p.get('top_p', 1.0)
    o = np.argsort(-pr); cs = np.cumsum(pr[o]); keep = o[:max(1, int(np.searchsorted(cs, tp) + 1))]
    q = pr[keep] / pr[keep].sum(); return int(rng.choice(keep, p=q))

# ---------- the batching engine ----------
class Engine:
    def __init__(self, model, tok, max_batch=16, cache_n=32):
        self.m, self.tok, self.max_batch = model, tok, max_batch; self.q = queue.Queue(); self.lru = []  # [(toks, Seq)]
        self.cache_n = cache_n; self.lock = threading.Lock(); self.stats = {'prefill_tok': 0, 'prefill_s': 0.0, 'decode_steps': 0, 'decode_tok': 0, 'decode_s': 0.0}
        threading.Thread(target=self.loop, daemon=True).start()
    def submit(self, req):
        ev = threading.Event(); req['_ev'] = ev; self.q.put(req); ev.wait(); return req['_out']
    def take_prefix(self, toks):
        best, bn = None, 0
        for i, (t, s) in enumerate(self.lru):
            n = 0; L = min(len(t), len(toks) - 1)
            while n < L and t[n] == toks[n]: n += 1
            if n > bn: best, bn = s, n
        return (best.copy_prefix(bn) if best is not None and bn >= 16 else Seq(max(1024, len(toks) + 256))), (bn if bn >= 16 else 0)
    def remember(self, s):
        self.lru.append((s.toks[:], s)); self.lru = self.lru[-self.cache_n:]
    def loop(self):
        active = []
        while True:
            while len(active) < self.max_batch:
                try: r = self.q.get(block=not active)
                except queue.Empty: break
                toks = self.tok.encode(chat_text(r['messages'])); s, hit = self.take_prefix(toks)
                r.update(seq=s, todo=toks[hit:], gen=[], ptoks=len(toks), cached=hit, t0=time.time(), rng=np.random.default_rng(r.get('seed', 0)))
                active.append(r)
            # prefill the new ones one at a time (they are long), then one decode step for all
            new = [r for r in active if r['todo']]
            if new:  # (all the new ones in one batched pass)
                t0 = time.time(); pre = [r for r in new if len(r['todo']) > 1]
                if pre: self.m.forward([r['seq'] for r in pre], [r['todo'][:-1] for r in pre])
                dt = time.time() - t0; self.stats['prefill_tok'] += sum(len(r['todo']) - 1 for r in new); self.stats['prefill_s'] += dt
                for r in new: r['last'] = r['todo'][-1]; r['todo'] = []; r['prefill_s'] = dt
            t0 = time.time(); lg = self.m.forward([r['seq'] for r in active], [[r['last']] for r in active]); dt = time.time() - t0
            self.stats['decode_steps'] += 1; self.stats['decode_tok'] += len(active); self.stats['decode_s'] += dt
            done = []
            for r, l in zip(active, lg):
                if 'ttft' not in r: r['ttft'] = time.time() - r['t0']
                t = sample(l, r['gen'], r, r['rng'])
                if t in STOP or len(r['gen']) + 1 >= r.get('max_tokens', 64):
                    if t not in STOP: r['gen'].append(t)
                    done.append(r); continue
                r['gen'].append(t); r['last'] = t
            for r in done:
                active.remove(r); text = self.tok.decode(r['gen'])
                for ss in r.get('stop', []) or []:
                    if ss in text: text = text[:text.index(ss)]
                self.remember(r['seq'])
                r['_out'] = {'text': text, 'completion_tokens': len(r['gen']), 'prompt_tokens': r['ptoks'], 'cached_tokens': r['cached'],
                             'prefill_s': r.get('prefill_s', 0.0), 'total_s': time.time() - r['t0'], 'ttft_s': r['ttft'], 'batch': len(active) + 1}
                r['_ev'].set()

def serve(engine, port):
    from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
    class Hd(BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def do_GET(self):
            b = json.dumps(engine.stats).encode(); self.send_response(200); self.send_header('content-type', 'application/json'); self.end_headers(); self.wfile.write(b)
        def do_POST(self):
            req = json.loads(self.rfile.read(int(self.headers['content-length'])))
            out = engine.submit({k: req[k] for k in ('messages', 'max_tokens', 'temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'repetition_penalty', 'seed', 'stop') if k in req})
            b = json.dumps(out).encode(); self.send_response(200); self.send_header('content-type', 'application/json'); self.end_headers(); self.wfile.write(b)
    print(f'serving on {port}', flush=True); ThreadingHTTPServer(('127.0.0.1', port), Hd).serve_forever()

def check(model, tok):
    # ids published for Qwen2's tokenizer (Qwen2.5 model card examples and the HF tokenizer): "Hello world" -> [9707, 1879]
    for s, want in [('Hello world', [9707, 1879]), ('<|im_start|>user\nhi<|im_end|>', None), (' Persepolis, the king’s seat', None)]:
        ids = tok.encode(s); print(repr(s), ids, repr(tok.decode(ids)), 'OK' if want is None or ids == want else f'MISMATCH want {want}')
        assert tok.decode(ids) == s
    eng = Engine(model, tok, max_batch=4)
    for q in ['What is the capital of France? Answer in one word.', 'Count from one to five in words.', 'Write one sentence about bread.']:
        t0 = time.time(); r = eng.submit({'messages': [{'role': 'user', 'content': q}], 'max_tokens': 40, 'temperature': 0})
        print(q, '->', repr(r['text']), f"{r['completion_tokens']} tok {time.time() - t0:.1f}s")
    print(engine_stats(eng))
def engine_stats(e): s = e.stats; return {**s, 'prefill_tps': s['prefill_tok'] / max(s['prefill_s'], 1e-9), 'decode_tps': s['decode_tok'] / max(s['decode_s'], 1e-9)}

if __name__ == '__main__':
    mdir, cmd = sys.argv[1], sys.argv[2]; cache = os.environ.get('TALKEVAL_CACHE', os.path.expanduser('~/.cache/talkeval'))
    tok = Tokenizer(os.path.join(mdir, 'merges.txt')); t0 = time.time(); model = Model(load_weights(mdir, cache)); print(f'weights {time.time() - t0:.1f}s', flush=True)
    if cmd == 'check': check(model, tok)
    else: serve(Engine(model, tok, max_batch=int(os.environ.get('TALKEVAL_BATCH', '12'))), int(sys.argv[3]) if len(sys.argv) > 3 else 8765)
