// Benchmark mode (brief §6 Delivery): flies fixed routes and writes a report. Out-of-world. ?bench=all|approach|vista|terrace
export const ROUTES: Record<string, { name: string; keys: [number, number, number, number, number][] /* east, north, eyeAboveGround, azTrue, pitch */; seconds: number; day: number; hour: number }> = {
  approach: { name: 'plain → Grand Stair → Gate of All Nations → Apadana', seconds: 40, day: 0, hour: 9,
    keys: [[-400, 122, 1.6, 71, 2], [-175, 122, 1.6, 71, 6], [-60, 122, 1.6, 71, 10], [-20, 124, 1.6, 71, 5], [0, 90, 1.6, 161, 0], [0, 40, 4.6, 161, 0], [0, -5, 4.6, 161, 8]] },
  vista: { name: 'Kuh-e Rahmat slope vista over the plain', seconds: 20, day: 0, hour: 17,
    keys: [[320, -60, 2, 251, -4], [320, -60, 2, 311, -4], [320, -60, 2, 191, -4]] },
  terrace: { name: 'Terrace loop', seconds: 40, day: 0, hour: 12,
    keys: [[-20, 124, 1.6, 161, 0], [150, 60, 1.6, 161, 0], [150, -150, 1.6, 251, 0], [0, -200, 7.6, 341, 0], [-40, -40, 1.6, 341, 0]] },
  palaces: { name: 'Phase 4 palaces: Tachara S court → Hadish N court → Tripylon → Hall of 100 Columns → Treasury hall → Harem court', seconds: 40, day: 25, hour: 11,
    keys: [[-21, -112, 1.6, 341, 4], [20, -120, 1.6, 161, 0], [82, -44, 1.6, 161, 4], [146, 40, 1.6, 161, 2], [180, -110, 1.6, 161, 0], [114, -116, 1.6, 161, 2]] },
};
/** frameMs = one frame's CPU work plus waiting for the GPU to finish it (serialised latency: an upper bound on the frame
 *  time of a pipelined run); cpuMs = the CPU part alone; gpuMs = GPU pass time from timestamp queries (null where the
 *  browser does not expose them). On SwiftShader all of these are software-rasteriser numbers and mean nothing for the
 *  60 fps target; draw calls and triangles are the proxies (README budgets). */
export async function runBench(which: string, api: any, frame: (dt?: number) => Promise<void>, gpuSync: () => Promise<void> = async () => {}, gpuMs: () => Promise<number | null> = async () => null) {
  const list = which === 'all' ? Object.keys(ROUTES) : which.split(',');
  const report: any = { when: new Date().toISOString(), userAgent: navigator.userAgent, backend: api.backend, screen: [innerWidth, innerHeight, devicePixelRatio], routes: {} };
  for (const k of list) {
    const r = ROUTES[k]; if (!r) continue;
    api.setTime(r.day, r.hour);
    const times: number[] = [], cpu: number[] = [], gpu: number[] = [], draws: number[] = [], tris: number[] = [];
    for (let i = 0; i < 30; i++) { const [e, n, h, az, p] = r.keys[0]; api.view(e, n, h, az, p); await frame(1 / 60); await gpuSync(); } // warm-up
    const t0 = performance.now();
    while (true) {
      const now = performance.now(), u = (now - t0) / 1000 / r.seconds; if (u >= 1) break;
      const f = u * (r.keys.length - 1), i = Math.min(r.keys.length - 2, Math.floor(f)), t = f - i;
      const a = r.keys[i], b = r.keys[i + 1]; let daz = b[3] - a[3]; if (daz > 180) daz -= 360; if (daz < -180) daz += 360;
      api.view(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + daz * t, a[4] + (b[4] - a[4]) * t);
      const f0 = performance.now(); await frame(); const f1 = performance.now(); await gpuSync(); const f2 = performance.now();
      cpu.push(f1 - f0); times.push(f2 - f0);
      const s = api.stats(); draws.push(s.drawCalls); tris.push(s.triangles);
      const g = await gpuMs(); if (g !== null) gpu.push(g);
    }
    const pct = (a: number[], p: number) => { if (!a.length) return null; const srt = [...a].sort((x, y) => x - y); return +srt[Math.min(srt.length - 1, Math.floor(p * srt.length))].toFixed(2); };
    const q = (p: number) => pct(times, p);
    const st = api.stats(); const pp = api.people?.();
    report.routes[k] = { name: r.name, frames: times.length, medianMs: q(0.5), p95Ms: q(0.95), p99Ms: q(0.99), cpuMedianMs: pct(cpu, 0.5), gpuMedianMs: pct(gpu, 0.5), gpuP95Ms: pct(gpu, 0.95), medianDrawCalls: pct(draws, 0.5), maxDrawCalls: Math.max(...draws), maxTriangles: Math.max(...tris), geometries: st.geometries, textures: st.textures, heapMB: st.heap ? +(st.heap / 1048576).toFixed(0) : null, people: pp ? pp.agents.filter((a: any) => !a.offmap).length : null };
  }
  (window as any).__benchReport = report;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bench-${Date.now()}.json`; a.textContent = 'Download benchmark report';
  a.style.cssText = 'position:fixed;left:16px;bottom:16px;color:#fff;background:#000a;padding:8px;z-index:9'; document.body.append(a);
  const pre = document.createElement('pre'); pre.textContent = JSON.stringify(report, null, 1); pre.style.cssText = 'position:fixed;left:16px;top:16px;color:#dfd;background:#000c;padding:8px;max-height:80vh;overflow:auto;z-index:9;font:12px monospace'; document.body.append(pre);
}
