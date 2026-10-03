// s15/load (D-354): page memory. A static texture's pixels are kept twice: by the page (the decoded or transcoded data three
// holds for a re-upload) and by the GPU. Once a texture is on the GPU and nothing will upload it again, the page's copy is
// dropped: every compressed texture (KTX2: the scans, the block faces, the models' maps; their mips come with the file) and
// any texture marked userData.release (a DataTexture built once, e.g. the ground layers). userData.keepData keeps a copy
// (a texture updated in place later). ?keeptex turns it off (A/B).
import type * as THREE from 'three/webgpu';

export const releaseStats = { textures: 0, bytes: 0 };
const on = typeof location === 'undefined' || !new URLSearchParams(location.search).has('keeptex');

function release(t: THREE.Texture) {
  const u = t.userData as any; if (!on || u?.keepData || u?.released) return;
  let b = 0;
  if ((t as any).isCompressedTexture) { for (const m of (t as any).mipmaps ?? []) if (m?.data) { b += m.data.byteLength ?? 0; m.data = null; } }
  else if (u?.release && (t as any).image?.data) { b = (t as any).image.data.byteLength ?? 0; (t as any).image.data = null; }
  else return;
  u.released = true; releaseStats.textures++; releaseStats.bytes += b;
  // (D-740: whoever flags a released texture for upload again is recorded, once, for the warning below)
  if (!Object.prototype.hasOwnProperty.call(t, 'needsUpdate')) { const set = Object.getOwnPropertyDescriptor(findProto(t), 'needsUpdate')?.set;
    if (set) Object.defineProperty(t, 'needsUpdate', { configurable: true, set(v: boolean) { if (v && u.released && !u.flaggedBy) u.flaggedBy = (new Error().stack ?? '').split('\n').slice(2, 5).map(l => l.trim()).join(' <- '); set.call(this, v); } }); }
}
function findProto(t: any): any { for (let p = Object.getPrototypeOf(t); p; p = Object.getPrototypeOf(p)) if (Object.getOwnPropertyDescriptor(p, 'needsUpdate')) return p; return t; }

/** hook the renderer's texture uploads (call once, after the renderer is made) */
export function releaseUploadedTextures(renderer: THREE.WebGPURenderer) {
  const tx = (renderer as any)._textures; if (!tx?.updateTexture || tx.__release) return; tx.__release = true;
  const up = tx.updateTexture.bind(tx);
  tx.updateTexture = (t: THREE.Texture, o?: any) => {
    // D-740 (s18, the black screen): a texture whose page copy was released and is flagged for upload again has nothing to
    // upload; three would pass null to writeTexture, which throws and aborts the whole frame. Skip it (the GPU keeps the
    // last upload) and say so once.
    let dd: any = null; try { dd = tx.get(t); } catch { /* */ }
    if ((t.userData as any)?.released && dd?.initialized === true && dd.version !== t.version && (((t as any).isCompressedTexture && ((t as any).mipmaps ?? []).some((m: any) => !m?.data)) || (!(t as any).isCompressedTexture && (t as any).image && (t as any).image.data == null))) {
      if (!(t.userData as any).warnedNoData) { (t.userData as any).warnedNoData = true; console.warn(`[release] ${t.name || t.uuid} (${(t as any).constructor?.name} ${(t as any).image?.width}x${(t as any).image?.height}${(t as any).image?.depth ? 'x' + (t as any).image.depth : ''}, ${(t as any).userData?.src ?? (t as any).source?.data?.src ?? ''}): flagged for upload after its data was released; skipped (the GPU copy stays) | flagged by ${String((t as any).userData?.flaggedBy ?? '?')}`); }
      dd.version = t.version; return; }
    const r = up(t, o); try { const d = tx.get(t);
    if (t.version > 0 && d?.isDefaultTexture === false && (t as any).source?.dataReady !== false) release(t); } catch { /* keep it */ } return r; };
}
