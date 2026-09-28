const fs=require('fs');const p='T:/fars-wt/voices/tools/dev/voices_probe.mjs';let s=fs.readFileSync(p,'utf8');
s=s.replace("try { await p.waitForFunction(() => window.__probe?.done, null, { timeout: 900000, polling: 1000 }); } catch (e) { logs.push('timeout ' + e); }",
"const LIMIT = +(process.env.PROBE_S ?? 900) * 1000;\nwhile (Date.now() - t0 < LIMIT) { const st = await p.evaluate(() => ({ done: !!window.__probe?.done, keys: Object.keys(window.__probe ?? {}), stats: window.__probe?.stats0 ?? null })).catch(e => ({ err: String(e) }));\n  console.log(((Date.now() - t0) / 1000).toFixed(0), 's', JSON.stringify(st), logs.slice(-3).join(' | ').slice(0, 400)); if (st.done) break; await new Promise(r => setTimeout(r, 15000)); }");
fs.writeFileSync(p,s);
