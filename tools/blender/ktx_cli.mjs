// A stand-in for the KTX-Software `ktx` CLI (session 17, cloud: its release downloads are blocked there), over the npm
// ktx2-encoder (Basis Universal WASM). It accepts the one call tools/blender/build.mjs makes:
//   ktx --version
//   ktx create --format R8G8B8A8_UNORM --assign-tf linear|srgb --encode uastc --uastc-quality N --zstd L --generate-mipmap in.png out.ktx2
//   ktx create ... --levels N level0.png .. levelN-1.png out.ktx2   (s18 C14: a mip chain given level by level, the people's hair
//     atlas's coverage-preserving mips, D-307: each level encoded alone, then the levels put in one container with ktx-parse)
//   ktx create ... --layers N [--generate-mipmap] layer0.png .. layerN-1.png out.ktx2   (s18 C14: an array, the people's scan
//     layers, tools/bake_world/ktx_humans.ts: each layer encoded alone without supercompression, the layers' blocks joined
//     level by level, each level zstd-compressed; --uastc-rdo honoured, --threads ignored)
// UASTC with zstd supercompression and mipmaps, like ktx.exe's output (not byte-identical: a different encoder build).
// Use: KTX=tools/blender/ktx_cli.sh node tools/blender/build.mjs <id>   (needs `npm i --no-save ktx2-encoder`)
import { readFileSync, writeFileSync } from 'node:fs';
const a = process.argv.slice(2);
if (a.includes('--version')) { console.log('ktx version: v4.4.2-compatible (ktx2-encoder, Basis Universal WASM)'); process.exit(0); }
// (s18 C14: `ktx extract --transcode rgba8 in.ktx2 out.png`: level 0 decoded through three's Basis transcoder, the impostors' source)
if (a[0] === 'extract') { const [inp, out] = a.filter(x => !x.startsWith('--') && x !== 'extract' && x !== 'rgba8').slice(-2);
  const { ktx2rgba } = await import('./lib/ktx2png.mjs'); const { w, h, data } = await ktx2rgba(inp);
  await (await import('sharp')).default(Buffer.from(data), { raw: { width: w, height: h, channels: 4 } }).png().toFile(out); console.log(`ktx_cli: extracted ${inp} -> ${out}`); process.exit(0); }
if (a[0] !== 'create') { console.error('ktx_cli: only `create`, `extract` and `--version`'); process.exit(2); }
const opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
if (opt('--encode') === 'basis-lz') { console.error('ktx_cli: basis-lz (ETC1S) is not supported here'); process.exit(3); }
const { encodeToKTX2 } = await import('ktx2-encoder');
// (s18 C14: --uastc-rdo [--uastc-rdo-l L]: the RDO post-pass, as ktx.exe's)
const RDO = a.includes('--uastc-rdo') ? { enableRDO: true, rdoQualityLevel: +(opt('--uastc-rdo-l') ?? 1) } : {};
const sharp = (await import('sharp')).default;
const imageDecoder = async buf => { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data: new Uint8Array(data), width: info.width, height: info.height }; };
const enc = (file, mips) => encodeToKTX2(new Uint8Array(readFileSync(file)), {
  isUASTC: (opt('--encode') ?? 'uastc') === 'uastc', uastcLDRQualityLevel: Math.min(3, +(opt('--uastc-quality') ?? 2)),
  needSupercompression: opt('--zstd') !== undefined, generateMipmap: mips,
  isSetKTX2SRGBTransferFunc: opt('--assign-tf') === 'srgb', isKTX2File: true, imageDecoder, ...RDO,
});
const ai = a.indexOf('--layers');
if (ai >= 0) {
  const n = +a[ai + 1], files = a.slice(-(n + 1), -1), out = a[a.length - 1];
  const { read, write } = await import('ktx-parse'); const { zstdCompressSync, constants } = await import('node:zlib');
  const enc0 = f => encodeToKTX2(new Uint8Array(readFileSync(f)), { isUASTC: true, uastcLDRQualityLevel: Math.min(3, +(opt('--uastc-quality') ?? 2)), needSupercompression: false,
    generateMipmap: a.includes('--generate-mipmap'), isSetKTX2SRGBTransferFunc: opt('--assign-tf') === 'srgb', isKTX2File: true, imageDecoder, ...RDO });
  const parts = []; for (const f of files) parts.push(read(await enc0(f)));
  const c = parts[0], L = c.levels.length; if (parts.some(p => p.levels.length !== L || p.pixelWidth !== c.pixelWidth)) throw new Error('ktx_cli: layers differ in size');
  const zl = +(opt('--zstd') ?? 0);
  c.layerCount = n;
  c.levels = c.levels.map((_, i) => { const raw = Buffer.concat(parts.map(p => Buffer.from(p.levels[i].levelData)));
    return { levelData: zl ? new Uint8Array(zstdCompressSync(raw, { params: { [constants.ZSTD_c_compressionLevel]: zl } })) : new Uint8Array(raw), uncompressedByteLength: raw.length }; });
  if (zl) { c.supercompressionScheme = 2; for (const d of c.dataFormatDescriptor) d.bytesPlane = d.bytesPlane.map(() => 0); }
  const k2 = write(c); writeFileSync(out, k2); console.log(`ktx_cli: ${n} layers, ${L} levels -> ${out} (${k2.length} B)`);
  process.exit(0);
}
const li = a.indexOf('--levels');
if (li >= 0) {
  const n = +a[li + 1], lv = a.slice(li + 2, li + 2 + n), out = a[a.length - 1];
  const { read, write } = await import('ktx-parse');
  const parts = []; for (const f of lv) parts.push(read(await enc(f, false)));
  const c = parts[0]; c.levels = parts.map(p => p.levels[0]); c.levelCount = n;
  const k2 = write(c); writeFileSync(out, k2); console.log(`ktx_cli: ${n} given levels -> ${out} (${k2.length} B)`);
  process.exit(0);
}
const files = a.filter((x, i) => !x.startsWith('--') && i > 0 && !a[i - 1].startsWith('--') || (i > 0 && ['--generate-mipmap'].includes(a[i - 1]) && !x.startsWith('--')));
const [inp, out] = files.slice(-2);
const k2 = await enc(inp, a.includes('--generate-mipmap'));
writeFileSync(out, k2); console.log(`ktx_cli: ${inp} -> ${out} (${k2.length} B)`);
