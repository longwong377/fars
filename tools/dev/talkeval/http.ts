// D-456: the talk eval's one HTTP call to the CPU runner (qwen_mlc.py serve).
import { request } from 'node:http';
/** a POST with no timeout (fetch's 300 s headers timeout dropped 57 turns of the first run while the box was busy) */
export function post(u: string, body: unknown): Promise<any> {
  return new Promise((res, rej) => { const r = request(u, { method: 'POST', headers: { 'content-type': 'application/json' } }, x => { let b = ''; x.setEncoding('utf8'); x.on('data', c => b += c); x.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }); r.on('error', rej); r.end(JSON.stringify(body)); });
}
