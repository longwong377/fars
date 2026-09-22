// Benchmark mode (brief §6 Delivery): flies fixed routes and writes a report. Out-of-world. ?bench=all|approach|vista|terrace
export const ROUTES: Record<string, { name: string; keys: [number, number, number, number, number][] /* east, north, eyeAboveGround, azTrue, pitch */; seconds: number; day: number; hour: number }> = {
  approach: { name: 'plain → Grand Stair → Gate of All Nations → Apadana', seconds: 40, day: 0, hour: 9,
    keys: [[-400, 122, 1.6, 71, 2], [-175, 122, 1.6, 71, 6], [-60, 122, 1.6, 71, 10], [-20, 124, 1.6, 71, 5], [0, 90, 1.6, 161, 0], [0, 40, 4.6, 161, 0], [0, -5, 4.6, 161, 8]] },
  vista: { name: 'Kuh-e Rahmat slope vista over the plain', seconds: 20, day: 0, hour: 17,
    keys: [[320, -60, 2, 251, -4], [320, -60, 2, 311, -4], [320, -60, 2, 191, -4]] },
  terrace: { name: 'Terrace loop', seconds: 40, day: 0, hour: 12,
    keys: [[-20, 124, 1.6, 161, 0], [150, 60, 1.6, 161, 0], [150, -150, 1.6, 251, 0], [0, -200, 7.6, 341, 0], [-40, -40, 1.6, 341, 0]] },
};
export async function runBench(which: string, api: any, frame: (dt?: number) => Promise<void>) {
  const list = which === 'all' ? Object.keys(ROUTES) : which.split(',');
  const report: any = { when: new Date().toISOString(), userAgent: navigator.userAgent, backend: api.backend, screen: [innerWidth, innerHeight, devicePixelRatio], routes: {} };
  for (const k of list) {
    const r = ROUTES[k]; if (!r) continue;
    api.setTime(r.day, r.hour);
    const times: number[] = [], draws: number[] = [], tris: number[] = [];
    const t0 = performance.now(); let last = t0;
    for (let i = 0; i < 30; i++) { const [e, n, h, az, p] = r.keys[0]; api.view(e, n, h, az, p); await frame(1 / 60); } // warm-up
    while (true) {
      const now = performance.now(), u = (now - t0) / 1000 / r.seconds; if (u >= 1) break;
      const f = u * (r.keys.length - 1), i = Math.min(r.keys.length - 2, Math.floor(f)), t = f - i;
      const a = r.keys[i], b = r.keys[i + 1]; let daz = b[3] - a[3]; if (daz > 180) daz -= 360; if (daz < -180) daz += 360;
      api.view(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + daz * t, a[4] + (b[4] - a[4]) * t);
      await frame(); const n2 = performance.now(); times.push(n2 - last); last = n2;
      const s = api.stats(); draws.push(s.drawCalls); tris.push(s.triangles);
    }
    const sorted = [...times].sort((x, y) => x - y), q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    report.routes[k] = { name: r.name, frames: times.length, medianMs: q(0.5), p95Ms: q(0.95), p99Ms: q(0.99), maxDrawCalls: Math.max(...draws), maxTriangles: Math.max(...tris) };
  }
  (window as any).__benchReport = report;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bench-${Date.now()}.json`; a.textContent = 'Download benchmark report';
  a.style.cssText = 'position:fixed;left:16px;bottom:16px;color:#fff;background:#000a;padding:8px;z-index:9'; document.body.append(a);
  const pre = document.createElement('pre'); pre.textContent = JSON.stringify(report, null, 1); pre.style.cssText = 'position:fixed;left:16px;top:16px;color:#dfd;background:#000c;padding:8px;max-height:80vh;overflow:auto;z-index:9;font:12px monospace'; document.body.append(pre);
}
