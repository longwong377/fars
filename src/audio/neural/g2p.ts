// D-336 (UD-22, the opt-in layer only): letters to phonemes for the Farsi and English the person may be heard in when the
// player asks for it. eSpeak-NG (GPL-3.0-or-later, the espeak-ng npm build: the whole program and its language data in one
// 18 MB WebAssembly module; compiled once, instantiated per call: a run of the program is one utterance). The period
// languages never pass through here: their phonemes are the lexicon's reconstructed IPA (kokoro.ts toKokoro).
let mod: Promise<WebAssembly.Module> | null = null;
async function wasmModule(): Promise<WebAssembly.Module> {
  return (mod ??= (async () => {
    const isNode = typeof process !== 'undefined' && !!process.versions?.node && typeof window === 'undefined' && typeof (globalThis as any).WorkerGlobalScope === 'undefined';
    if (isNode) { const { readFile } = await import('node:fs/promises'); const { createRequire } = await import('node:module');
      const p = createRequire(import.meta.url).resolve('espeak-ng').replace(/espeak-ng\.js$/, 'espeak-ng.wasm'); return WebAssembly.compile(await readFile(p)); }
    const url = new URL('../../../node_modules/espeak-ng/dist/espeak-ng.wasm', import.meta.url);
    return WebAssembly.compileStreaming(fetch(url));
  })());
}
/** eSpeak-NG's IPA for a text ('fa': Persian, 'en': American English), one line per clause */
export async function espeakIpa(text: string, lang: 'fa' | 'en'): Promise<string> {
  const [{ default: ESpeakNg }, m] = await Promise.all([import('espeak-ng'), wasmModule()]);
  const es = await ESpeakNg({
    arguments: ['--phonout', 'out', '-q', '-b', '1', '--ipa=3', '-v', lang === 'fa' ? 'fa' : 'en-us', '-f', 'in.txt'],
    preRun: [(M: any) => M.FS.writeFile('in.txt', text.replace(/‌/g, '‌'))],
    instantiateWasm: (imports: WebAssembly.Imports, ok: (i: WebAssembly.Instance) => void) => { WebAssembly.instantiate(m, imports).then(i => ok(i)); return {}; },
    print: () => {}, printErr: () => {},
  });
  return es.FS.readFile('out', { encoding: 'utf8' }) as string;
}
