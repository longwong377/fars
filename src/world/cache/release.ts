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
}

/** hook the renderer's texture uploads (call once, after the renderer is made) */
export function releaseUploadedTextures(renderer: THREE.WebGPURenderer) {
  const tx = (renderer as any)._textures; if (!tx?.updateTexture || tx.__release) return; tx.__release = true;
  const up = tx.updateTexture.bind(tx);
  tx.updateTexture = (t: THREE.Texture, o?: any) => { const r = up(t, o); try { const d = tx.get(t);
    if (t.version > 0 && d?.isDefaultTexture === false && (t as any).source?.dataReady !== false) release(t); } catch { /* keep it */ } return r; };
}
